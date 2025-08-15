#!/bin/bash

echo "Setting up iOS Simulator MCP for Vault22 Testing..."

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed. Please install Xcode from the App Store."
    exit 1
fi

# Check if IDB is installed
if ! command -v idb &> /dev/null; then
    echo "⚠️  IDB is not installed. Installing via Homebrew..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew is not installed. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    # Install IDB
    brew tap facebook/fb
    brew install idb-companion
    pip3 install fb-idb
else
    echo "✅ IDB is already installed"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js."
    exit 1
fi

echo "✅ All prerequisites are installed"

# Install iOS Simulator MCP package
echo "Installing iOS Simulator MCP..."
npm install --save-dev ios-simulator-mcp

echo ""
echo "Setup complete! To use the iOS Simulator MCP:"
echo "1. Start an iOS Simulator from Xcode"
echo "2. Install your app in the simulator"
echo "3. The MCP tools will be available in Claude Code"
echo ""
echo "Available MCP commands:"
echo "  - Get simulator info"
echo "  - Describe screen elements"
echo "  - Tap on elements or coordinates"
echo "  - Input text"
echo "  - Swipe gestures"
echo "  - Take screenshots"