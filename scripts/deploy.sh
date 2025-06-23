#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting comprehensive deployment..."

cd .. 

# Clean everything
echo "🧹 Cleaning..."
rm -rf dist
rm -rf .vercel

# Verify source files
echo "📋 Verifying source files..."
for file in stanford.png stanford.svg share.png robots.txt sitemap.xml; do
    if [ ! -f "public/$file" ]; then
        echo "❌ Missing: public/$file"
        exit 1
    fi
    echo "✅ Found: public/$file ($(ls -lh "public/$file" | awk '{print $5}'))"
done

# Build
echo "🔨 Building..."
npm run build

# Verify dist was created
if [ ! -d "dist" ]; then
    echo "❌ dist directory not created!"
    exit 1
fi

# Force copy files manually with bash
echo "📁 Force copying files..."
for file in stanford.png stanford.svg share.png robots.txt sitemap.xml; do
    if [ -f "public/$file" ]; then
        cp "public/$file" "dist/$file"
        if [ -f "dist/$file" ]; then
            echo "✅ Copied $file ($(ls -lh "dist/$file" | awk '{print $5}'))"
        else
            echo "❌ Failed to copy $file"
            exit 1
        fi
    fi
done

# Verify all critical files are in dist
echo "🔍 Final verification..."
ls -la dist/

echo "📏 Critical files in dist:"
for file in stanford.png stanford.svg share.png; do
    if [ -f "dist/$file" ]; then
        ls -lh "dist/$file"
    else
        echo "❌ CRITICAL: dist/$file missing!"
        exit 1
    fi
done

# Git commit and push BEFORE deployment
echo "📝 Committing changes..."
git add .
if ! git diff --staged --quiet; then
    git commit -m "Deploy with verified static files - $(date '+%Y-%m-%d %H:%M:%S')"
    git push
    echo "📤 Changes pushed to git"
else
    echo "📝 No changes to commit"
fi

# Deploy to Firebase
echo "🔥 Firebase deploy..."
firebase deploy --only functions,firestore

# Deploy to Vercel
echo "☁️ Vercel deploy..."
npx vercel --prod --public --yes

# Get the latest deployment URL
echo "🔍 Getting latest deployment URL..."
sleep 3
LATEST_URL=$(npx vercel ls | grep "https://" | head -1 | awk '{print $2}')
echo "Latest deployment: $LATEST_URL"

# Test files on both URLs
echo "🧪 Testing files..."
sleep 5

echo "Testing on latest deployment URL:"
for file in stanford.png stanford.svg share.png; do
    echo -n "  $file: "
    curl -s -o /dev/null -w "HTTP %{http_code} (%{size_download} bytes)" "$LATEST_URL/$file"
    echo ""
done

echo "Testing on custom domain:"
for file in stanford.png stanford.svg share.png; do
    echo -n "  $file: "
    curl -s -o /dev/null -w "HTTP %{size_download} bytes)" "https://pastchances.com/$file"
    echo ""
done

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Wait 30 seconds for full propagation"
echo "2. Run: cd scripts/tools && node test-images.js"
echo "3. Clear browser cache and test favicon"
echo "4. Test social media previews"