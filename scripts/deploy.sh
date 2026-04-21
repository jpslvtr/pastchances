#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment..."

cd .. 

# Detect current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"

# Validate branch
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "dev" ]; then
    echo "Error: Can only deploy from 'main' or 'dev' branch"
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Set domain based on branch
if [ "$CURRENT_BRANCH" = "main" ]; then
    DOMAIN="pastchances.com"
    echo "Deploying main branch to $DOMAIN"
elif [ "$CURRENT_BRANCH" = "dev" ]; then
    DOMAIN="secondchances.app"
    echo "Deploying dev branch to $DOMAIN"
fi

# Clean everything
echo "Cleaning..."
rm -rf dist
rm -rf .vercel

# Verify source files
echo "Verifying source files..."
for file in stanford.png stanford.svg share.png robots.txt sitemap.xml; do
    if [ ! -f "public/$file" ]; then
        echo "Missing: public/$file"
        exit 1
    fi
    echo "Found: public/$file ($(ls -lh "public/$file" | awk '{print $5}'))"
done

# Build
echo "Building..."
npm run build

# Verify dist was created
if [ ! -d "dist" ]; then
    echo "dist directory not created"
    exit 1
fi

# Force copy files manually with bash
echo "Force copying files..."
for file in stanford.png stanford.svg share.png robots.txt sitemap.xml; do
    if [ -f "public/$file" ]; then
        cp "public/$file" "dist/$file"
        if [ -f "dist/$file" ]; then
            echo "Copied $file ($(ls -lh "dist/$file" | awk '{print $5}'))"
        else
            echo "Failed to copy $file"
            exit 1
        fi
    fi
done

# Verify all critical files are in dist
echo "Final verification..."
ls -la dist/

echo "Critical files in dist:"
for file in stanford.png stanford.svg share.png; do
    if [ -f "dist/$file" ]; then
        ls -lh "dist/$file"
    else
        echo "dist/$file missing"
        exit 1
    fi
done

# Git commit and push BEFORE deployment
echo "Committing changes..."
git add .
if ! git diff --staged --quiet; then
    git commit -m "Deploy $CURRENT_BRANCH with verified static files - $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin $CURRENT_BRANCH
    echo "Changes pushed to $CURRENT_BRANCH"
else
    echo "No changes to commit"
fi

# Deploy to Firebase
echo "Firebase deploy..."
firebase deploy --only functions,firestore,storage

# Prepare Vercel prebuilt output so the server-side build is skipped.
# src/data/ is gitignored, so Vercel's cloud build can't compile the TypeScript.
# --prebuilt tells Vercel to serve .vercel/output/static directly.
echo "Preparing Vercel prebuilt output..."
rm -rf .vercel/output
mkdir -p .vercel/output/static
cp -r dist/. .vercel/output/static/
cat > .vercel/output/config.json << 'VERCEL_CONFIG'
{
  "version": 3,
  "routes": [
    {
      "src": "/[^/]+\\.png",
      "headers": {
        "Content-Type": "image/png",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      },
      "continue": true
    },
    {
      "src": "/[^/]+\\.svg",
      "headers": {
        "Content-Type": "image/svg+xml",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      },
      "continue": true
    },
    {
      "src": "/(.*)",
      "headers": {
        "X-Frame-Options": "SAMEORIGIN",
        "X-Content-Type-Options": "nosniff"
      },
      "continue": true
    },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
VERCEL_CONFIG

# Deploy to Vercel
echo "Vercel deploy..."
npx vercel deploy --prod --yes --prebuilt

# Get the latest deployment URL
echo "Getting latest deployment URL..."
sleep 3
LATEST_URL=$(npx vercel ls | grep "https://" | head -1 | awk '{print $2}')
echo "Latest deployment: $LATEST_URL"

# Test files on both URLs
echo "Testing files..."
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
    curl -s -o /dev/null -w "HTTP %{http_code} (%{size_download} bytes)" "https://$DOMAIN/$file"
    echo ""
done

echo ""
echo "Deployment complete to $DOMAIN"
echo ""
echo "Next steps:"
echo "1. Wait 30 seconds for full propagation"
echo "2. Run: cd scripts/tools && node test-images.js"
echo "3. Clear browser cache and test favicon"
echo "4. Test social media previews"
echo "5. Verify at: https://$DOMAIN"