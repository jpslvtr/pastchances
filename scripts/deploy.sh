#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment process..."

cd .. 

# Build the project
echo "Building project..."
npm run build

# Deploy to Firebase
echo "Deploying to Firebase..."
firebase deploy

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