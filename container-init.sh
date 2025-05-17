#!/bin/bash
# Container initialization script for starknet-kms

echo "Initializing container environment for starknet-kms..."

# Install dependencies if needed
if ! command -v npm &> /dev/null || ! command -v node &> /dev/null; then
    echo "Installing Node.js and npm..."
    apt-get update
    apt-get install -y curl nodejs npm
    apt-get clean
    rm -rf /var/lib/apt/lists/*
fi

# Install Bun if not already installed
if ! command -v bun &> /dev/null; then
    echo "Installing Bun..."
    npm install -g bun
    # Alternative: curl -fsSL https://bun.sh/install | bash
fi

# Install critical tools globally
echo "Installing critical development tools globally..."
npm install -g turbo typescript @biomejs/biome

# Force a fresh install of dependencies
echo "Force reinstalling all dependencies for current platform..."
rm -rf node_modules
find ./packages -name "node_modules" -type d -exec rm -rf {} +

# Install dependencies with Bun
echo "Installing dependencies with Bun..."
bun install

echo "Building the project..."
npx turbo run build || bun run build

echo "Container environment initialized successfully!"
echo "You can now run './setup.sh' for normal operation." 