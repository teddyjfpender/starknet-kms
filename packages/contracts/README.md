# @starkms/contracts

Account contracts for starkms.

## Features

- 📜 **KageAccount Contract ABI**: Automatically extracted from Cairo contract artifacts
- 🔄 **Auto-sync**: ABI is extracted during build from the latest compiled contracts
- 📦 **TypeScript Support**: Fully typed with Starknet.js `Abi` type

## Installation

```bash
bun add @starkms/contracts
```

## Usage

### Import the KageAccount ABI

```typescript
import { KAGE_ACCOUNT_ABI, getKageAccountAbi } from '@starkms/contracts'
import { Contract, RpcProvider } from 'starknet'

// Use the ABI constant directly
const provider = new RpcProvider({ nodeUrl: 'YOUR_NODE_URL' })
const contract = new Contract(KAGE_ACCOUNT_ABI, 'YOUR_CONTRACT_ADDRESS', provider)

// Or use the getter function
const abi = getKageAccountAbi()
```

## Development

### Extract ABI from Contracts

The ABI is automatically extracted during the build process. To manually extract:

```bash
bun run extract-abi
```

This reads the contract class JSON from `@cairo/account/target/dev/account_KageAccount.contract_class.json` and writes the ABI to `src/artifacts/account_KageAccount.abi.json`.

### Build

```bash
bun run build
```

The build process:
1. Extracts the latest ABI from Cairo artifacts (prebuild hook)
2. Compiles TypeScript
3. Bundles with tsup