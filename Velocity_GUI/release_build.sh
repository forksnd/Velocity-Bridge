#!/bin/bash
# Velocity Bridge - Unified Release Build Script
# Automates the multi-step build process for DEB, RPM, and AppImage.

set -e

# Configuration
VERSION="3.0.1"
RELEASE_DIR="../$VERSION release"
PROJECT_ROOT=$(pwd)
TAURI_BUNDLE_DIR="src-tauri/target/release/bundle"

echo "🚀 Starting Unified Build for Velocity Bridge v$VERSION..."

# 1. Build the Python Sidecar
echo "📦 Building Python sidecar..."
npm run build:sidecar

# 2. Run Tauri Build (DEB, RPM, and AppDir preparation)
echo "🏗️  Running Tauri build..."
# We ignore errors from this command because the AppImage bundler currently fails 
# even though it successfully generates the AppDir we need.
npm run tauri build || echo "⚠️  Tauri build reported an error (this is expected during AppImage bundling). Proceeding with manual AppImage creation..."

# 3. Create the Release Directory
mkdir -p "$RELEASE_DIR"

# 4. Manual AppImage Creation
echo "💎 Patching and creating AppImage..."
APPDIR="$TAURI_BUNDLE_DIR/appimage/Velocity-Bridge.AppDir"
APPIMAGE_NAME="Velocity-Bridge_${VERSION}_amd64.AppImage"
FINAL_APPIMAGE="$TAURI_BUNDLE_DIR/appimage/$APPIMAGE_NAME"

if [ -d "$APPDIR" ]; then
    # Ensure the icon is in the root of the AppDir (Fixes AppImage desktop integration)
    cp "$APPDIR/usr/share/icons/hicolor/128x128/apps/velocity_tauri.png" "$APPDIR/velocity_tauri.png"
    
    # Run the external appimagetool
    ARCH=x86_64 /tmp/appimagetool --appimage-extract-and-run "$APPDIR" "$FINAL_APPIMAGE"
    
    # Copy to release folder
    cp "$FINAL_APPIMAGE" "$RELEASE_DIR/"
    echo "✅ AppImage created and moved to $RELEASE_DIR"
else
    echo "❌ Error: AppDir not found at $APPDIR. Build failed."
    exit 1
fi

# 5. Collect DEB and RPM
echo "🚚 Collecting DEB and RPM packages..."
find "$TAURI_BUNDLE_DIR/deb" -name "*.deb" -exec cp {} "$RELEASE_DIR/" \;
find "$TAURI_BUNDLE_DIR/rpm" -name "*.rpm" -exec cp {} "$RELEASE_DIR/" \;

echo "--------------------------------------------------"
echo "✨ Build Process Complete!"
echo "📦 Artifacts available in: $RELEASE_DIR"
ls -lh "$RELEASE_DIR"
echo "--------------------------------------------------"

# 6. Helper instructions
echo "💡 To test a fresh install, run:"
echo "   rm -rf ~/.local/share/com.arsh.velocity-bridge ~/.config/com.arsh.velocity-bridge"
echo "   '$RELEASE_DIR/$APPIMAGE_NAME'"
