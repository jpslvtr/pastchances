#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment process..."

cd .. 

# Build the project
echo "Building project..."
npm run build

# Ensure critical images are in dist (in case Vite doesn't copy them)
echo "Ensuring critical images are in dist..."
if [ ! -f "dist/stanford.png" ]; then
    echo "Copying stanford.png..."
    cp public/stanford.png dist/
fi

if [ ! -f "dist/stanford.svg" ]; then
    echo "Copying stanford.svg..."
    cp public/stanford.svg dist/
fi

if [ ! -f "dist/share.png" ]; then
    echo "Copying share.png..."
    cp public/share.png dist/
fi

# Verify images are there
echo "Verifying images in dist..."
ls -la dist/*.png dist/*.svg

# Deploy to Firebase (functions and Firestore only, not hosting)
echo "Deploying Firebase functions and Firestore..."
firebase deploy --only functions,firestore

# Deploy to Vercel (hosting)
echo "Deploying to Vercel..."
npx vercel --prod --public --yes

# Get the latest deployment URL and assign the domain
echo "Assigning domain to latest deployment..."
DEPLOYMENT_URL=$(npx vercel ls --limit 1 | grep https | head -1 | awk '{print $2}')
echo "Latest deployment: $DEPLOYMENT_URL"

# Assign pastchances.com to the latest deployment
npx vercel alias set $DEPLOYMENT_URL pastchances.com

# Git operations
echo "Committing changes to git..."
git add .

# Check if there are any changes to commit
if git diff --staged --quiet; then
    echo "No changes to commit"
else
    # Get current timestamp for commit message
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    git commit -m "updates - $TIMESTAMP"
    
    echo "Pushing to git..."
    git push
fi

echo "Deployment complete"
echo "Frontend: https://pastchances.com (Vercel)"
echo "Backend: Firebase Functions & Firestore"

# Test the deployment
echo "Testing deployment..."
sleep 10
curl -I https://pastchances.com/stanford.png
echo "✅ Deployment and domain assignment complete!"