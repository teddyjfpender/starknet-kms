#!/bin/bash

echo "Setting up starknet-kms repository..."

# Check if Bun is available
if ! command -v bun &> /dev/null; then
    echo "Error: Bun is required but not found. Please install Bun before running this script."
    exit 1
fi

echo "Installing dependencies with Bun..."
# Install dependencies
bun install

echo "Building the project..."
# Build the project
bun run build

echo "Setup complete! The starknet-kms repository is now ready to use." 