FROM oven/bun:1.1.34 as base

WORKDIR /app

# Copy the entire repository
COPY . .

# Make the setup script executable
RUN chmod +x setup.sh

# Run the unified setup script
RUN ./setup.sh

# Set up entrypoint
ENTRYPOINT ["bun", "run"]
CMD ["build"] 