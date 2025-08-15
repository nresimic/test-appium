#!/bin/bash

# S3 Deployment Script for Next.js Static Export
# Usage: ./deploy-to-s3.sh your-bucket-name

BUCKET_NAME=$1

if [ -z "$BUCKET_NAME" ]; then
    echo "Usage: ./deploy-to-s3.sh <bucket-name>"
    exit 1
fi

echo "🚀 Deploying test-runner-ui to S3 bucket: $BUCKET_NAME"

# Step 1: Update Next.js config for static export
cat > next.config.ts << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
}

export default nextConfig
EOF

echo "✅ Updated next.config.ts for static export"

# Step 2: Build the static site
echo "🔨 Building static site..."
npm run build

if [ ! -d "out" ]; then
    echo "❌ Build failed - 'out' directory not created"
    exit 1
fi

echo "✅ Build complete"

# Step 3: Upload to S3
echo "📤 Uploading to S3..."
aws s3 sync out/ s3://$BUCKET_NAME --delete --cache-control "public, max-age=3600"

# Step 4: Configure S3 for static website hosting
echo "⚙️ Configuring S3 bucket for static website hosting..."
aws s3 website s3://$BUCKET_NAME \
    --index-document index.html \
    --error-document 404.html

# Step 5: Set bucket policy for public access
echo "🔓 Setting bucket policy for public access..."
cat > /tmp/bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file:///tmp/bucket-policy.json
rm /tmp/bucket-policy.json

# Get the website URL
REGION=$(aws s3api get-bucket-location --bucket $BUCKET_NAME --query 'LocationConstraint' --output text)
if [ "$REGION" = "None" ]; then
    REGION="us-east-1"
fi

echo "✅ Deployment complete!"
echo "🌐 Your site is available at:"
echo "   http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo ""
echo "Optional: Set up CloudFront for HTTPS and better performance"