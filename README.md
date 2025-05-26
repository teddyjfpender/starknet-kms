# StarKMS

An exploratory Starknet Key Management System designed for secure key derivation, management, and cryptographic operations on the Starknet network.

> **⚠️ Warning**: This is currently a proof of concept and should not be used in production environments.

## Features

- 🔐 **Secure Key Management**: HD wallet implementation with BIP-44 derivation
- 🔒 **Cryptographic Primitives**: Exploratory cryptographic operations for Starknet
- 🛡️ **Stealth Addresses**: Privacy-preserving address generation
- 🧪 **Zero-Knowledge Proofs**: Chaum-Pedersen ZKP implementation
- 📦 **Modular Architecture**: Clean separation of concerns across packages

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.1.34
- Node.js >= 18

### Installation

```bash
# Clone the repository
git clone https://github.com/teddyjfpender/starkms.git
cd starkms

# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test:unit
```

### Development

```bash
# Run the full CI pipeline (typecheck, lint, build, test)
bun run ci

# Format code
bun run format

# Lint code
bun run lint
```

## Architecture

This project is organized as a monorepo with the following packages:

- **[@starkms/crypto](./packages/crypto)**: Core cryptographic primitives and operations
- **[@starkms/key-management](./packages/key-management)**: Key derivation, storage, and management
- **[@starkms/util](./packages/util)**: Utility functions and helpers
- **[@starkms/common](./packages/common)**: Shared types and common functionality

## Documentation

- [Contributor Guide](./docs/AGENTS.md) - Guidelines for contributors and development practices
- [Chaum-Pedersen ZKP Specification](./docs/chaum-pedersen.md) - Implementation details for zero-knowledge proofs

## Scripts

| Command | Description |
|---------|-------------|
| `bun run build` | Build all packages |
| `bun run test:unit` | Run unit tests |
| `bun run lint` | Check code style and quality |
| `bun run format` | Format code with Biome |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run ci` | Run full CI pipeline |

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

## Contributing

Please read our [Contributor Guide](./docs/AGENTS.md) for details on our code of conduct and the process for submitting pull requests.

## Security

This is an experimental project. Please do not use in production environments. For security concerns, please review our security guidelines in the contributor documentation.
