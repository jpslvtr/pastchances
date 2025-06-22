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

# Deploy to Vercel (hosting) with public and yes flags
echo "Deploying to Vercel..."
npx vercel --prod --public --yes

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