#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting deployment with robust file copying..."

cd .. 

# Clean everything first
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf .vercel
rm -rf node_modules/.vite

# Verify source images exist
echo "📋 Verifying source images exist..."
for file in "stanford.png" "stanford.svg" "share.png" "robots.txt" "sitemap.xml"; do
    if [ ! -f "public/$file" ]; then
        echo "❌ ERROR: public/$file not found!"
        exit 1
    else
        echo "✅ Found public/$file"
    fi
done

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Verify dist directory was created
if [ ! -d "dist" ]; then
    echo "❌ ERROR: dist directory not created!"
    exit 1
fi

# Double-check and force copy critical files
echo "📁 Ensuring all critical files are in dist..."
for file in "stanford.png" "stanford.svg" "share.png" "robots.txt" "sitemap.xml" "_headers"; do
    if [ -f "public/$file" ]; then
        cp "public/$file" "dist/$file"
        if [ -f "dist/$file" ]; then
            echo "✅ Copied $file to dist"
        else
            echo "❌ Failed to copy $file to dist"
            exit 1
        fi
    fi
done

# List all files in dist for debugging
echo "📄 All files in dist directory:"
find dist -type f -name "*.png" -o -name "*.svg" -o -name "*.txt" -o -name "*.xml" -o -name "_headers" | sort

# Verify critical files exist in dist
echo "🔍 Final verification of critical files in dist..."
for file in "stanford.png" "stanford.svg" "share.png"; do
    if [ ! -f "dist/$file" ]; then
        echo "❌ CRITICAL ERROR: dist/$file is missing!"
        exit 1
    else
        echo "✅ Verified dist/$file exists"
        ls -la "dist/$file"
    fi
done

# Deploy to Firebase (functions and Firestore only)
echo "🔥 Deploying Firebase functions and Firestore..."
firebase deploy --only functions,firestore

# Deploy to Vercel
echo "☁️ Deploying to Vercel..."
npx vercel --prod --public --yes

# Wait for propagation
echo "⏰ Waiting for deployment to propagate..."
sleep 15

# Test critical files
echo "🧪 Testing deployed files..."
for file in "stanford.png" "stanford.svg" "share.png"; do
    echo "Testing https://pastchances.com/$file"
    curl -s -o /dev/null -w "Status: %{http_code}\n" "https://pastchances.com/$file"
done

# Git operations
echo "📝 Committing changes..."
git add .

if ! git diff --staged --quiet; then
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    git commit -m "Deploy with verified static file deployment - $TIMESTAMP"
    git push
    echo "📤 Changes pushed to git"
else
    echo "📝 No changes to commit"
fi

echo ""
echo "🎉 Deployment complete!"
echo "Frontend: https://pastchances.com"
echo ""
echo "🔧 Next steps:"
echo "1. Wait 30 seconds for full propagation"
echo "2. Run: cd scripts/tools && node test-images.js"
echo "3. Clear browser cache completely"
echo "4. Test social media previews"