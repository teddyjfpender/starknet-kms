#!/bin/bash
# Simple setup script for starknet-kms

echo "Setting up starknet-kms repository..."
mkdir -p ./offline-cache/packages

# Detect platform
PLATFORM="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
    if [[ $(uname -m) == "arm64" ]]; then
        PLATFORM="macos-arm64"
    fi
fi
echo "Detected platform: $PLATFORM"

# Check environment
if [ -f "/.dockerenv" ]; then
    echo "Docker environment detected."
    DOCKER=true
else
    DOCKER=false
fi

# Function to check for platform mismatch in binaries
check_platform_mismatch() {
    MISMATCH=false
    
    # Check for turbo binary mismatch
    if [ "$PLATFORM" == "linux" ] && [ -d "node_modules/turbo-darwin-arm64" ] && [ ! -d "node_modules/turbo-linux-64" ]; then
        echo "WARNING: Found macOS turbo binary but missing Linux binary"
        MISMATCH=true
    fi
    
    # Check for biome binary mismatch
    if [ "$PLATFORM" == "linux" ] && [ ! -f "node_modules/@biomejs/cli-linux-x64/biome" ] && [ -f "node_modules/@biomejs/cli-darwin-arm64/biome" ]; then
        echo "WARNING: Found macOS biome binary but missing Linux binary"
        MISMATCH=true
    fi
    
    if [ "$MISMATCH" == "true" ]; then
        echo "Platform mismatch detected in binaries! Need to reinstall dependencies."
        return 0
    else
        return 1
    fi
}

# Check connectivity
if ping -c 1 registry.npmjs.org &> /dev/null; then
    echo "Online mode - installing and caching dependencies"
    
    # Clean node_modules to ensure fresh install
    rm -rf node_modules
    find ./packages -name "node_modules" -type d -exec rm -rf {} +
    
    echo "Installing dependencies with Bun..."
    bun install 
    
    # Cache dependencies
    echo "Caching dependencies for offline use..."
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
        echo "Restoring from cache..."
        cp -r ./offline-cache/node_modules ./
        
        # Restore package dependencies
        for pkg in packages/*; do
            pkg_name=$(basename "$pkg")
            if [ -d "./offline-cache/packages/$pkg_name/node_modules" ]; then
                cp -r "./offline-cache/packages/$pkg_name/node_modules" "$pkg/"
            fi
        done
        
        # Check for platform mismatch after restoring from cache
        if check_platform_mismatch; then
            echo "CRITICAL: Platform mismatch detected, but we're offline. Cannot rebuild binaries."
            echo "You need to run this setup in an online environment first."
            echo "This is likely because you're copying macOS binaries to a Linux environment."
            
            # Try to use npx/npm for critical tools if they're available
            if command -v npm &> /dev/null; then
                echo "Attempting emergency npm installs of critical tools..."
                npm install -g turbo typescript @biomejs/biome
                mkdir -p node_modules/.bin
                
                # Create symbolic links to global binaries
                if command -v turbo &> /dev/null; then
                    ln -sf $(which turbo) node_modules/.bin/turbo
                    echo "Created link to global turbo installation"
                fi
                
                if command -v tsc &> /dev/null; then
                    ln -sf $(which tsc) node_modules/.bin/tsc
                    echo "Created link to global TypeScript installation"
                fi
                
                if command -v biome &> /dev/null; then
                    ln -sf $(which biome) node_modules/.bin/biome
                    echo "Created link to global Biome installation"
                fi
            fi
        fi
    else
        echo "WARNING: No cached dependencies found and no internet connection."
        echo "Cannot proceed with setup without either cached dependencies or internet access."
        exit 1
    fi
fi

echo "Building the project..."
if [ "$PLATFORM" == "linux" ]; then
    echo "Using npx for build on Linux to avoid binary compatibility issues..."
    if command -v npx &> /dev/null; then
        npx turbo run build || echo "WARNING: Build failed"
    else
        bun run build || echo "WARNING: Build failed"
    fi
else
    bun run build || echo "WARNING: Build failed"
fi

echo "Running checks..."
if [ "$PLATFORM" == "linux" ]; then
    # Use npx for tools on Linux to avoid binary compatibility issues
    if command -v npx &> /dev/null; then
        echo "Running linting with npx..."
        npx @biomejs/biome check . || echo "Warning: Linting errors"
        
        echo "Running type checks with npx..."
        npx tsc --noEmit || echo "Warning: Type errors"
        
        echo "Running tests with npx..."
        npx turbo run test:unit || echo "Warning: Test failures"
    else
        bun run lint || echo "Warning: Linting errors"
        bun run typecheck || echo "Warning: Type errors"
        bun run test:unit || echo "Warning: Test failures"
    fi
else
    bun run lint || echo "Warning: Linting errors"
    bun run typecheck || echo "Warning: Type errors"
    bun run test:unit || echo "Warning: Test failures"
fi

touch .container-ready
echo "Setup complete!" 