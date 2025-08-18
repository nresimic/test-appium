#!/bin/bash

# Vault22 Test Runner - One-Command Deployment Script
# Usage: ./deploy.sh

set -e  # Exit on any error

echo "🚀 Starting Vault22 Test Runner Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="https://zis3j10xnc.execute-api.eu-west-1.amazonaws.com/prod"
S3_BUCKET="vault22-test-runner-ui"

# Step 1: Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install Node.js${NC}"
    exit 1
fi

if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ CDK not found. Installing...${NC}"
    npm install -g aws-cdk
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured or expired${NC}"
    echo "Please run: export AWS_ACCESS_KEY_ID=your_key"
    echo "           export AWS_SECRET_ACCESS_KEY=your_secret"
    echo "           export AWS_SESSION_TOKEN=your_token"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Step 2: Deploy Backend Infrastructure
echo -e "${BLUE}🏗️  Deploying backend infrastructure...${NC}"
cd aws-infrastructure

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing CDK dependencies..."
    npm install
fi

# Deploy CDK stack
echo "Deploying CDK stack..."
npm run cdk deploy -- --require-approval never

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Backend deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend infrastructure deployed${NC}"

# Step 3: Install Lambda Dependencies
echo -e "${BLUE}📦 Installing Lambda dependencies...${NC}"
cd ../lambda

if [ ! -d "node_modules" ] || [ package.json -nt node_modules/.package-lock.json ]; then
    echo "Installing Lambda dependencies..."
    npm install
fi

echo -e "${GREEN}✅ Lambda dependencies installed${NC}"

# Step 4: Build and Deploy Frontend
echo -e "${BLUE}🎨 Building and deploying frontend...${NC}"
cd ../test-runner-ui

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf .next dist

# Build with production API URL
echo "Building frontend with API URL: $API_URL"
NEXT_PUBLIC_API_URL=$API_URL npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

# Deploy to S3
echo "Deploying static assets to S3..."

# Clear S3 bucket (optional - comment out if you want to keep old files)
echo "Clearing old files from S3..."
aws s3 rm s3://$S3_BUCKET --recursive --exclude "*.ico"

# Deploy _next/static files
echo "Uploading static assets..."
aws s3 sync .next/static s3://$S3_BUCKET/_next/static --delete

# Deploy server-rendered pages (excluding API routes)
echo "Uploading pages..."
aws s3 sync .next/server/app s3://$S3_BUCKET/ --exclude "**/route.*" --delete

# Deploy additional static assets from dist if it exists
if [ -d "dist" ]; then
    echo "Uploading additional static files..."
    aws s3 sync dist/ s3://$S3_BUCKET/ --exclude "_next/*"
fi

# Set correct content types
echo "Setting content types..."
aws s3 cp s3://$S3_BUCKET/index.html s3://$S3_BUCKET/index.html --content-type "text/html" --metadata-directive REPLACE
aws s3 cp s3://$S3_BUCKET/_next/static/css/ s3://$S3_BUCKET/_next/static/css/ --recursive --content-type "text/css" --metadata-directive REPLACE
aws s3 cp s3://$S3_BUCKET/_next/static/chunks/ s3://$S3_BUCKET/_next/static/chunks/ --recursive --content-type "application/javascript" --metadata-directive REPLACE

echo -e "${GREEN}✅ Frontend deployed successfully${NC}"

# Step 5: Deployment Verification
echo -e "${BLUE}🔍 Verifying deployment...${NC}"

# Test website
echo "Testing website accessibility..."
WEBSITE_URL="http://$S3_BUCKET.s3-website-eu-west-1.amazonaws.com"
if curl -s --head $WEBSITE_URL | head -n 1 | grep -q "200 OK"; then
    echo -e "${GREEN}✅ Website is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Website may not be immediately accessible (S3 propagation delay)${NC}"
fi

# Test API
echo "Testing API endpoints..."
if curl -s "$API_URL/api/builds" > /dev/null; then
    echo -e "${GREEN}✅ API is responding${NC}"
else
    echo -e "${YELLOW}⚠️  API may not be immediately accessible (Lambda cold start)${NC}"
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo "  🌐 Website URL: $WEBSITE_URL"
echo "  🔌 API URL: $API_URL"
echo "  📊 CloudWatch Logs: /aws/lambda/TestRunnerStack-*"
echo "  🪣 S3 Buckets:"
echo "    - Frontend: $S3_BUCKET"
echo "    - Builds: vault22-builds"
echo "    - Tests: vault22-tests"
echo "    - Reports: vault22-test-reports"
echo
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "  1. Upload your test package: aws s3 cp test-package.zip s3://vault22-tests/"
echo "  2. Upload your app builds: aws s3 cp app.apk s3://vault22-builds/android/"
echo "  3. Visit the website and start testing!"
echo
echo -e "${YELLOW}💡 Tip: Run this script again anytime to deploy updates${NC}"