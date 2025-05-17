#!/bin/bash
# Simple setup script for starknet-kms

echo "Setting up starknet-kms repository..."
mkdir -p ./offline-cache/packages

# Check environment
if [ -f "/.dockerenv" ]; then
    echo "Docker environment detected."
fi

# Check connectivity
if ping -c 1 registry.npmjs.org &> /dev/null; then
    echo "Online mode - installing and caching dependencies"
    bun install 
    cp -r node_modules ./offline-cache/
    
    # Cache package dependencies
    for pkg in packages/*; do
        if [ -d "$pkg/node_modules" ]; then
            pkg_name=$(basename "$pkg")
            mkdir -p "./offline-cache/packages/$pkg_name"
            cp -r "$pkg/node_modules" "./offline-cache/packages/$pkg_name/"
        fi
    done
else
    echo "Offline mode - using cached dependencies"
    if [ -d "./offline-cache/node_modules" ]; then
        cp -r ./offline-cache/node_modules ./
        
        # Restore package dependencies
        for pkg in packages/*; do
            pkg_name=$(basename "$pkg")
            if [ -d "./offline-cache/packages/$pkg_name/node_modules" ]; then
                cp -r "./offline-cache/packages/$pkg_name/node_modules" "$pkg/"
            fi
        done
    else
        echo "Warning: No cached dependencies found"
    fi
fi

echo "Building the project..."
bun run build 

echo "Running checks..."
bun run lint || echo "Warning: Linting errors"
bun run typecheck || echo "Warning: Type errors"
bun run test:unit || echo "Warning: Test failures"

touch .container-ready
echo "Setup complete!" 