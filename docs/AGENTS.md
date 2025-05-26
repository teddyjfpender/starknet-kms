# StarKMS Contributor Guide

This document provides guidance for AI agents and human contributors working with the StarKMS repository.

## Project Overview

StarKMS is an exploratory Starknet Key Management System, currently in proof-of-concept stage. The project is organized as a monorepo using Bun as the package manager and Turborepo for task orchestration.

## Repository Structure

- `packages/`: Contains the core packages of the project
  - `crypto/`: Exploratory cryptographic primitives
  - `key-management/`: Key management system for Starknet
  - `util/`: Utility functions for Starknet
  - `common/`: Shared code and utilities

## Development Environment Setup

- Use Bun as the package manager
- The project uses TypeScript with strict typing
- Biome is used for linting and formatting

## Common Commands

### Installation
```bash
bun install
```

### Building
```bash
# Build all packages
bun run build

# Build specific packages
turbo run build --filter=@starkms/crypto
turbo run build --filter=@starkms/key-management
turbo run build --filter=@starkms/util

# Available build shortcuts
bun run build:extension
bun run build:features
```

### Testing
```bash
# Run all tests from root
bun test

# Run all unit tests from root
bun run test:unit

# Run tests for specific packages
cd packages/crypto && bun test
cd packages/key-management && bun test
cd packages/util && bun test
```

### Linting and Formatting
```bash
# Run linter from root
bun run lint

# Fix linting issues from root
bun run lint:fix

# Format code from root
bun run format
```

## Contribution Guidelines

> Applies to **all packages** in the StarKMS monorepo (backend TypeScript SDK for key-management & cryptography).  
> Treat every change as security-critical.

---

### 0 · Quick Path 🏃‍♂️

1. Fork → branch → hack → PR  
   ~~~sh
   git checkout -b feat/<scope>     # or fix/, chore/
   bun run ci                       # typecheck + lint + tests
   ~~~
2. **No red CI** – if it fails locally it will fail in GitHub Actions.  
3. Commits **must** follow Conventional Commits (`feat: …`, `fix: …`).

---

### 1 · TypeScript Standards

| Rule | Crypto rationale |
|------|------------------|
| `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` **ON** | remove surprise `undefined`s |
| Zero `any` → use `unknown` + type-guard/schema (`zod`) | forces validation |
| Branded types for `PrivateKey`, `PublicKey`, `Signature` | prevents key/nonce mix-ups |
| Pure, side-effect-free functions & `readonly` data | easier formal reasoning |
| Exhaustive switches (fail on missing `never`) | guards against logic drift |

---

### 2 · Cryptography & Security

* **Never roll your own crypto** – use audited primitives in `packages/crypto`.  
* Constant-time helpers for secret-dependent branches.  
* Wipe secrets from memory with `secureErase` after use.  
* All external input validated at boundaries; reject early.  
* Key material is **never** logged or surfaced in errors.

---

### 3 · Structure & Architecture
packages/
crypto/ # primitives (no FS/network)
key-management/ # HD wallets, storage adaptors
util/ # old unused things
common/ # shared types & errors


* Modules are single-purpose, side-effect-free; no circular deps.  
* Depend on **interfaces**, inject implementations.  
* Design **public API first** (types & signatures) before internals.  

---

### 4 · Testing

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit  | Vitest (Bun) | ≥ 95 % in `crypto/`, ≥ 90 % elsewhere |
| Property-based | fast-check | edge-case discovery |
| Integration | Bun test + official vectors | MUST include known-answer tests |

* Tests are deterministic; seed RNG or use fixtures.  
* No network calls in unit tests – mock or stub.

---

### 5 · Tooling

| Task | Command (root) | CI-gated |
|------|----------------|----------|
| Lint & format | `bun run lint` (Biome) | ✅ |
| Lint & fix | `bun run lint:fix` |  ✅ |
| Type-check | `bun typecheck` | ✅ |
| Build all | `bun run build` (Turborepo) | ✅ |
| Full pipeline | `bun run ci` | ✅ |

---

### 6 · Pull-Request Checklist

- [ ] `bun run ci` green  
- [ ] No new lint/type errors  
- [ ] Coverage ≥ previous  
- [ ] Public API docs (TSDoc + README) updated  
- [ ] PR body explains **security impact** & **testing**  
- [ ] Related issues linked; commits follow Conventional-Commits

---

### 7 · Documentation

* Exported symbols → **TSDoc** with examples.  
* Each package keeps an up-to-date **README** (install, quick-start, API).  
* Major decisions recorded as **ADRs** in `docs/adr/`.

---

### 8 · Release & Versioning

* **SemVer**: `feat:` → minor, `fix:` → patch, breaking → major.  
* Changesets generates tags & changelogs on merge to `main`.

---

By opening a PR you agree to these rules and the Code of Conduct.  
**Thank you for helping keep StarKMS correct and secure!** 🚀
