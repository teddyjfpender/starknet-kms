# Offline Development Guide

This guide explains how to set up and develop the starknet-kms project in an offline or isolated environment.

## Prerequisites

- A clone of the repository with all build artifacts included
- Bun 1.1.34 or compatible version installed

## Setup Process

The repository includes a unified setup script (`setup.sh`) that handles both online and offline environments, as well as Docker containers:

```bash
# Run with internet access to cache dependencies for later offline use
./setup.sh

# Run in offline environment - will use cached dependencies
./setup.sh

# Run in Docker container - automatically detects container environment
./setup.sh
```

## How It Works

### Environment Detection

The setup script automatically detects:
- Whether you have internet connectivity
- Whether you're running in a Docker container

### Offline Cache

When run with internet access, the script:
- Installs all dependencies
- Creates an `offline-cache` directory
- Stores a copy of all node_modules in the cache

When run without internet access, the script:
- Detects the offline state
- Restores dependencies from the cache

### Build Artifacts

The repository is configured to include build artifacts in version control:
- `dist` directories are included
- `build` directories are included
- `.turbo` cache is included

This ensures that the project can be run without rebuilding from source.

## Using Docker

### Option 1: Docker CLI

```bash
# Build the Docker image
docker build -t starknet-kms .

# Run the container
docker run -it starknet-kms

# Run a specific command
docker run -it starknet-kms test:unit
```

### Option 2: Docker Compose (Recommended)

For a better development experience, use Docker Compose:

```bash
# Start development environment
docker-compose up starknet-kms

# Run tests
docker-compose run test

# Run a specific command
docker-compose run --rm starknet-kms bun run lint

# Build the image
docker-compose build
```

Docker Compose offers several advantages:
- Persists the offline cache between container runs
- Provides consistent development environment
- Mounts source code for live editing
- Separate services for development and testing

## Development Workflow

1. Clone the repository with all build artifacts:
   ```bash
   git clone https://github.com/yourusername/starknet-kms.git
   ```

2. Run the setup script:
   ```bash
   ./setup.sh
   ```

3. Build and run the project:
   ```bash
   bun run build
   ```

4. Run tests:
   ```bash
   bun run test:unit
   ```

## Troubleshooting

- If you encounter missing dependencies in offline mode, ensure you've run the setup script with internet access first
- Check that your `.gitignore` doesn't exclude build artifacts needed for offline development
- Verify that the Bun version in your environment matches the required version (1.1.34)
- If using Docker, ensure the offline-cache volume is properly created with `docker volume ls` 