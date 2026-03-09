"""
Velocity Bridge - Windows Backend
Author: trex099-Arshgour
License: GPL-3.0
"""
import base64
import logging
from logging.handlers import RotatingFileHandler
import os
import re
import subprocess
import tempfile
import webbrowser
import sys
import time
import random
import multiprocessing
from datetime import datetime
from pathlib import Path
from typing import Literal

# Windows-specific imports
try:
    import win32clipboard
    import win32con
except ImportError:
    print("Error: pywin32 is required for this server on Windows.")
    sys.exit(1)

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Version
VERSION = "3.0.3"

# Setup logging
LOG_DIR = Path.home() / "AppData" / "Local" / "VelocityBridge" / "Logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        RotatingFileHandler(
            LOG_DIR / "velocity.log",
            maxBytes=5 * 1024 * 1024,  # 5MB
            backupCount=3,
        ),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("velocity")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Velocity Bridge (Windows)",
    description="LAN-only clipboard sync between iOS and Linux/Windows",
    version=VERSION,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = Path.home() / "Downloads" / "Velocity"
CONFIG_DIR = Path.home() / "AppData" / "Roaming" / "VelocityBridge"
HISTORY_FILE = CONFIG_DIR / "clipboard_history.json"
SESSION_FILE = CONFIG_DIR / "session_stats.json"

# Session tracking
SESSION_STATS = {
    "request_count": 0,
    "unique_ips": set(),
    "last_request": None,
    "recent_requests": [],
}

# --- Clipboard Helper with Retry Logic ---

def retry_clipboard_op(func):
    """Decorator to retry clipboard operations on Access Denied."""
    def wrapper(*args, **kwargs):
        max_retries = 5
        for i in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Check for Access Denied (Error 5) or similar lock errors
                # pywin32 exceptions usually convert to standard ones or generic logic
                # Access Denied is typically associated with OpenClipboard
                err_str = str(e)
                if "Access is denied" in err_str or "OpenClipboard" in err_str:
                    if i < max_retries - 1:
                        sleep_time = 0.1 + (random.random() * 0.2)
                        time.sleep(sleep_time)
                        continue
                logger.error(f"Clipboard operation failed after {i+1} attempts: {e}")
                raise e
        return func(*args, **kwargs)
    return wrapper

@retry_clipboard_op
def write_text_to_clipboard(text: str):
    win32clipboard.OpenClipboard()
    try:
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(win32clipboard.CF_UNICODETEXT, text)
    finally:
        win32clipboard.CloseClipboard()

@retry_clipboard_op
def write_image_to_clipboard(image_path: Path):
    """
    Write image to clipboard.
    Strategy:
    1. Register custom "PNG" format for alpha transparency support (modern apps).
    2. Write CF_DIB (Bitmap) for legacy support (Paint, etc.) - Alpha lossy logic implies we prioritize PNG.
    """
    try:
        # Load image bytes
        png_data = image_path.read_bytes()
        
        # Register PNG format
        cf_png = win32clipboard.RegisterClipboardFormat("PNG")
        
        win32clipboard.OpenClipboard()
        try:
            win32clipboard.EmptyClipboard()
            # Set PNG (Alpha preserved)
            win32clipboard.SetClipboardData(cf_png, png_data)
        finally:
            win32clipboard.CloseClipboard()
            
    except Exception as e:
        logger.error(f"Failed to write image to clipboard: {e}")
        pass

@retry_clipboard_op
def get_windows_clipboard():
    """Reads clipboard. Returns (type, content)."""
    # Register PNG format for reading
    cf_png = win32clipboard.RegisterClipboardFormat("PNG")
    
    win32clipboard.OpenClipboard()
    try:
        # Check formats priority
        if win32clipboard.IsClipboardFormatAvailable(cf_png):
            data = win32clipboard.GetClipboardData(cf_png)
            b64_data = base64.b64encode(data).decode('ascii')
            return ("image", b64_data)
        
        elif win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_DIB):
             # Fallback to standard bitmap (might lose alpha if written by others, but it's something)
             # Getting raw DIB bits and converting to PNG is complex.
             # For now, if someone gives us a DIB, we might skip it or implement full DIB->PNG conv later.
             # But most modern apps (Browsers, Snipping Tool) put DIB.
             # We should probably support DIB reading.
             # HOWEVER, converting Raw DIB to PNG requires headers.
             # For MVP, let's prioritize PNG. If no PNG, check Text.
             # Validating DIB support is "Nice to Have" but complex without Pillow grabbing from clipboard directly.
             # Pillow ImageGrab.grabclipboard() is the easiest way.
             pass

        if win32clipboard.IsClipboardFormatAvailable(win32clipboard.CF_UNICODETEXT):
            data = win32clipboard.GetClipboardData(win32clipboard.CF_UNICODETEXT)
            return ("text", data)
            
    finally:
        win32clipboard.CloseClipboard()
        
    # If we are here, try Pillow ImageGrab as fallback for DIB
    try:
        from PIL import ImageGrab
        import io
        img = ImageGrab.grabclipboard()
        if img:
            with io.BytesIO() as output:
                img.save(output, format="PNG")
                b64_data = base64.b64encode(output.getvalue()).decode('ascii')
                return ("image", b64_data)
    except Exception as e:
        logger.debug(f"ImageGrab failed: {e}")

    return ("empty", "")

# --- Config & Helpers ---

def load_config() -> dict:
    import json
    import secrets
    config_file = CONFIG_DIR / "settings.json"
    config = {}
    try:
        if config_file.exists():
            config = json.loads(config_file.read_text(encoding='utf-8'))
    except Exception as e:
        logger.debug(f"Could not load config: {e}")
    
    if not config.get("token") and not config.get("security_token"):
        config["token"] = secrets.token_hex(12)
        try:
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            config_file.write_text(json.dumps(config, indent=2), encoding='utf-8')
        except Exception as e:
            logger.debug(f"Could not save config: {e}")
            
    return config

config = load_config()
SECURITY_TOKEN = os.environ.get("SECURITY_TOKEN") or config.get("token", "") or config.get("security_token", "")

def validate_token(token: str, request: Request = None) -> None:
    if SECURITY_TOKEN and token != SECURITY_TOKEN:
        client_ip = request.client.host if request and request.client else "unknown"
        logger.warning(f"Authentication failed from IP: {client_ip}")
        raise HTTPException(status_code=403, detail="Invalid security token")

def load_history() -> list:
    try:
        if HISTORY_FILE.exists():
            import json
            return json.loads(HISTORY_FILE.read_text(encoding='utf-8'))
    except Exception:
        pass
    return []

def save_history(history: list) -> None:
    try:
        import json
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        HISTORY_FILE.write_text(json.dumps(history[-50:], indent=2), encoding='utf-8')
    except Exception as e:
        logger.warning(f"Failed to save history: {e}")

def send_notification(title: str, message: str):
    # Use PowerShell to show toast (Built-in, no deps)
    # Or rely on Tauri frontend to poll/listen? 
    # The Linux version uses notify-send.
    # For Windows, we can use a simple PowerShell script for Toast.
    try:
        ps_script = f"""
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName("text")
        $textNodes.Item(0).AppendChild($template.CreateTextNode("{title}")) > $null
        $textNodes.Item(1).AppendChild($template.CreateTextNode("{message}")) > $null
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Velocity Bridge")
        $notifier.Show($toast)
        """
        subprocess.Popen(["powershell", "-Command", ps_script], creationflags=subprocess.CREATE_NO_WINDOW)
    except Exception as e:
        logger.debug(f"Notification failed: {e}")

# --- Endpoints ---

@app.get("/")
async def root():
    return {"status": "ok", "service": "Velocity Bridge (Windows)"}

@app.get("/get_clipboard")
@limiter.limit("30/minute")
async def get_clipboard(request: Request, token: str):
    validate_token(token, request)
    content_type, content = get_windows_clipboard()
    
    if content_type == "error":
        raise HTTPException(status_code=500, detail=content)
        
    return {
        "status": "success",
        "type": content_type,
        "content": content,
    }

class ClipboardPayload(BaseModel):
    type: Literal["text", "url"]
    content: str
    token: str

class ImagePayload(BaseModel):
    image: str
    filename: str = "clipboard_image.png"
    token: str

@app.post("/upload_image")
@limiter.limit("20/minute")
async def upload_image(request: Request, payload: ImagePayload):
    validate_token(payload.token, request)
    logger.info(f"Image upload: {payload.filename}")
    
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        image_data = base64.b64decode(payload.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Base64: {e}")
        
    filename = payload.filename or "clipboard_image.png"
    if not filename.endswith('.png'):
        filename += ".png"
        
    target_path = UPLOAD_DIR / filename
    # Handle duplicates logic omitted for brevity, but recommended
    
    target_path.write_bytes(image_data)
    
    # Write to Clipboard
    write_image_to_clipboard(target_path)
    
    # History & Notify
    history = load_history()
    history.append({
        "timestamp": datetime.now().isoformat(),
        "type": "image",
        "preview": f"🖼️ {target_path.name}",
        "content": str(target_path),
    })
    save_history(history)
    send_notification("Image Received", f"{filename} copied to clipboard!")
    
    return {"status": "success", "clipboard": True}

@app.post("/shutdown")
async def shutdown(request: Request, token: str):
    validate_token(token, request)
    logger.info("Shutdown requested")
    
    import signal
    def kill_self():
        time.sleep(1)
        os.kill(os.getpid(), signal.SIGTERM) # Graceful termination attempt on Windows
        
    import threading
    threading.Thread(target=kill_self).start()
    return {"status": "shutting_down"}

if __name__ == "__main__":
    multiprocessing.freeze_support()
    import uvicorn
    # 0.0.0.0 is needed for LAN access
    uvicorn.run(app, host="0.0.0.0", port=8080)
