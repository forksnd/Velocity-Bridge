#!/bin/bash
set -e

# Get script directory to allow running from anywhere
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "🐍 Rebuilding Python Backend..."

# Check for venv
if [ -d "src-python/venv" ]; then
    source src-python/venv/bin/activate
else
    echo "⚠️  Virtual environment not found in src-python/venv"
    echo "   Attempting to use system python or failing..."
    # Fallback or exit? For now, assume venv is required as per project setup.
    # But for CI/CD, maybe just 'python' is enough.
    # Let's try to proceed if pyinstaller is in path
    if ! command -v pyinstaller &> /dev/null; then
        echo "❌ PyInstaller not found and no venv detected."
        exit 1
    fi
fi

cd src-python
# Clean previous builds
rm -rf build dist
# Run PyInstaller - use velocity-backend to match tauri.conf.json/git binary
pyinstaller --onefile --name velocity-backend --clean server.py --distpath dist --workpath build --specpath .

# Copy to Tauri binaries
echo "🚚 Copying binary to src-tauri location..."
mkdir -p ../src-tauri/binaries
cp dist/velocity-backend ../src-tauri/binaries/velocity-backend-x86_64-unknown-linux-gnu

chmod +x ../src-tauri/binaries/velocity-backend-x86_64-unknown-linux-gnu
echo "✅ Python Sidecar Built Successfully!"

