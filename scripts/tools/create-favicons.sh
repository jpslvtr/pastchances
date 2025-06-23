#!/bin/bash

echo "🎨 Creating properly sized favicons from 894x1348 Stanford logo..."

cd ../public

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found."
    echo "🔧 Install with: brew install imagemagick (on macOS)"
    echo "🌐 Or use online tool: https://realfavicongenerator.net/"
    exit 1
fi

echo "📐 Original Stanford logo: 894x1348 pixels"

# Create a square version with white padding (1348x1348 to fit the height)
echo "🔲 Creating square version with white padding..."
convert stanford.png -background white -gravity center -extent 1348x1348 stanford-square.png

# Generate different favicon sizes from the square version
echo "📏 Generating favicon sizes..."

convert stanford-square.png -resize 16x16 favicon-16x16.png
convert stanford-square.png -resize 32x32 favicon-32x32.png  
convert stanford-square.png -resize 48x48 favicon-48x48.png
convert stanford-square.png -resize 180x180 apple-touch-icon.png
convert stanford-square.png -resize 192x192 android-chrome-192x192.png
convert stanford-square.png -resize 512x512 android-chrome-512x512.png

# Create ICO file (supports multiple sizes)
convert stanford-square.png \( +clone -resize 16x16 \) \( +clone -resize 32x32 \) \( +clone -resize 48x48 \) -delete 0 favicon.ico

echo "✅ Created favicon files:"
ls -la favicon-*.png apple-touch-icon.png android-chrome-*.png favicon.ico stanford-square.png

echo ""
echo "🔧 Generated files:"
echo "• favicon-16x16.png - Small browser tab"
echo "• favicon-32x32.png - Standard browser tab" 
echo "• favicon-48x48.png - Large browser tab"
echo "• apple-touch-icon.png - iOS home screen"
echo "• android-chrome-192x192.png - Android chrome"
echo "• android-chrome-512x512.png - High-res displays"
echo "• favicon.ico - Legacy favicon"
echo "• stanford-square.png - Square source (for reference)"