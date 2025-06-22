#!/bin/bash

set -e

echo "🔧 FIXING VERCEL DEPLOYMENT"

cd "$(dirname "$0")/.."

# Clean everything
echo "Cleaning previous builds..."
rm -rf .vercel
rm -rf dist

# Build
echo "Building..."
npm run build

# Verify images
echo "Verifying images in dist..."
ls -la dist/*.png dist/*.svg

# Deploy to Vercel with public access
echo "Deploying to Vercel (public)..."
npx vercel --prod --public --yes

# Get the deployment URL
DEPLOYMENT_URL=$(npx vercel ls --limit 1 | grep https | head -1 | awk '{print $2}')
echo "Latest deployment: $DEPLOYMENT_URL"

# Assign domain
echo "Assigning domain..."
npx vercel alias set $DEPLOYMENT_URL pastchances.com

# Test
echo "Testing deployment..."
sleep 10

echo "Testing Vercel URL:"
curl -I $DEPLOYMENT_URL/stanford.png

echo "Testing custom domain:"
curl -I https://pastchances.com/stanford.png

echo "✅ Deployment complete!"