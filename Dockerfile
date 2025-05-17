FROM oven/bun:1.1.34 as base

WORKDIR /app

# Install Node.js and npm for platform-specific fallbacks
RUN apt-get update && apt-get install -y \
    curl \
    nodejs \
    npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Pre-install critical tools globally to provide fallbacks
RUN npm install -g turbo typescript @biomejs/biome

# Copy the entire repository
COPY . .

# Make the setup script executable
RUN chmod +x setup.sh

# Run the unified setup script
RUN ./setup.sh

# Set up entrypoint
ENTRYPOINT ["bun", "run"]
CMD ["build"] 