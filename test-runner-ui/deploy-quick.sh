#!/bin/bash

# Quick deployment script using your existing AWS credentials
source .env.local

# Export AWS credentials
export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
export AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN

# Use EU region instead of US
export AWS_REGION="eu-west-1"
echo "🌍 Using region: $AWS_REGION (Ireland)"

# Use your existing bucket
BUCKET_NAME="mobile-automation-testing-ui"
echo "🪣 Using existing bucket: $BUCKET_NAME"

# Configure Next.js for static export
echo "⚙️ Configuring Next.js for static export..."
cat > next.config.ts << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Disable API routes for static export
  experimental: {
    appDir: true
  }
}

export default nextConfig
EOF

# Build the app
echo "🔨 Building the application..."
npm run build

if [ ! -d "out" ]; then
    echo "❌ Build failed - 'out' directory not created"
    echo "This might mean the app has server-side features that prevent static export"
    exit 1
fi

# Upload to S3
echo "📤 Uploading to S3..."
aws s3 sync out/ s3://$BUCKET_NAME --delete

# Since bucket is already public, just ensure website hosting is enabled
echo "🌐 Configuring website hosting..."

# Enable website hosting
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document error.html

# Get the website URL
echo "✅ Deployment complete!"
echo "🌐 Your site is available at:"
echo "   http://$BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
echo ""
echo "📝 Save this URL for future reference"
echo "⚠️  Note: Your AWS session token will expire, so save the bucket name: $BUCKET_NAME"