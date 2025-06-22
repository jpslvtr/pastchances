#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment process..."

cd .. 

# Build the project
echo "Building project..."
npm run build

# Force copy critical images (don't rely on Vite)
echo "Force copying critical images..."
cp public/stanford.png dist/stanford.png
cp public/stanford.svg dist/stanford.svg  
cp public/share.png dist/share.png

# Verify images are there
echo "Verifying images in dist..."
ls -la dist/stanford.png dist/stanford.svg dist/share.png

# Deploy to Firebase (functions and Firestore only, not hosting)
echo "Deploying Firebase functions and Firestore..."
firebase deploy --only functions,firestore

# Deploy to Vercel (hosting)
echo "Deploying to Vercel..."
DEPLOY_OUTPUT=$(npx vercel --prod --public --yes 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract the deployment URL from the output
DEPLOYMENT_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://stanford-lastchances-[a-z0-9]*-jpslvtrs-projects\.vercel\.app' | head -1)

if [ -z "$DEPLOYMENT_URL" ]; then
    echo "❌ Could not extract deployment URL. Manual assignment needed."
    echo "Please run: npx vercel ls"
    echo "Then: npx vercel alias set [LATEST_URL] pastchances.com"
else
    echo "✅ Deployment URL: $DEPLOYMENT_URL"
    
    # Test the deployment URL directly first
    echo "Testing deployment URL directly..."
    sleep 5
    curl -I "$DEPLOYMENT_URL/stanford.png"
    
    # Assign domain
    echo "Assigning domain pastchances.com to $DEPLOYMENT_URL..."
    npx vercel alias set "$DEPLOYMENT_URL" pastchances.com
    
    # Test the custom domain
    echo "Testing custom domain..."
    sleep 10
    curl -I https://pastchances.com/stanford.png
fi

# Git operations
echo "Committing changes to git..."
git add .

if git diff --staged --quiet; then
    echo "No changes to commit"
else
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    git commit -m "updates - $TIMESTAMP"
    git push
fi

echo "Deployment complete"
echo "Frontend: https://pastchances.com (Vercel)"
echo "Backend: Firebase Functions & Firestore"