# Cryptography Package Overview

This package provides cryptographic primitives and protocols specifically tailored for use with the Starknet ecosystem, primarily focusing on elliptic curve cryptography (ECC) operations on the Starknet curve (`stark_curve`).

## Goals

*   **Security:** Implementations follow cryptographic best practices and recommendations from security audits.
*   **Modularity:** Core primitives are separated from protocol-specific logic and serialization formats.
*   **Starknet Focus:** Utilize `starknet.js` and associated libraries effectively.
*   **Clarity:** Provide well-documented and tested code.

## Modules

This documentation covers the following key modules within the `packages/crypto/src/elliptic-curve/` directory:

1.  **[Core ECC Concepts](./core-concepts.md):** Fundamental ideas behind the elliptic curve math used.
2.  **[Core Primitives API](./core-primitives.md):** Low-level functions operating directly on curve points and scalars (`core/curve.ts`).
3.  **[Stealth Addresses](./starknet-stealth.md):** Implementation of a privacy-enhancing address scheme.
4.  **[Chaum-Pedersen ZKP](./chaum-pedersen.md):** Implementation of a Zero-Knowledge Proof protocol.

**(Note:** An auxiliary `starknet-curve.ts` file exists primarily to provide a hex-string-based API wrapper around the core primitives for convenience or legacy compatibility.) 