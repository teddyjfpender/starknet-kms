# @starkms/crypto - Cryptographic Primitives

Welcome to the `@starkms/crypto` package! This library provides a suite of robust cryptographic primitives, with a current focus on a Zero-Knowledge Proof (ZKP) system: the Chaum-Pedersen protocol, tailored for the STARK curve.

## Features

*   **Chaum-Pedersen Protocol:**
    *   **Purpose:** Allows a prover to demonstrate knowledge of a secret scalar `x` such that `U = xG` and `V = xH` for public points `U`, `V`, `G`, and `H`, without revealing `x`.
    *   **STARK Curve:** Implemented specifically for the STARK elliptic curve (secp256k1 variant used by Starknet), utilizing `@scure/starknet` for core curve operations.
    *   **Interactive & Non-Interactive Modes:** Supports both:
        *   **Interactive Protocol:** `commit`, `respond` functions for a step-by-step proof generation process.
        *   **Non-Interactive (Fiat-Shamir) Protocol:** `proveFS` and `verify` functions for generating and verifying proofs without direct interaction, using a cryptographic hash function.
    *   **Secure Secondary Generator `H`:** The point `H` is deterministically derived using `H = hG` where `h = SHA256("starkex.chaum-pedersen.H.v1") % CURVE_ORDER`. This ensures its discrete logarithm relative to `G` is unknown, a critical security requirement.
    *   **Poseidon Hash for Fiat-Shamir:** Utilizes the Poseidon hash function (via `poseidonHashScalars` from `core/curve.ts`) for generating the challenge in the Fiat-Shamir transformation, aligning with Starknet ecosystem standards.
*   **Core Elliptic Curve Utilities (`core/curve.ts` & `starknet-curve.ts`):**
    *   Provides foundational elements for STARK curve operations, including `Scalar` (bigint) and `Point` types, and robust arithmetic functions.
    *   Offers both a low-level API working directly with `Point` objects and `Scalar` bigints (`core/curve.ts`).
    *   Provides a convenient hex-string based API layer (`starknet-curve.ts`) for easier integration with StarkNet.js and similar environments.
    *   All curve utilities are thoroughly tested for correctness and edge cases.
*   **StarkNet Stealth Address Implementation (`starknet-stealth.ts`):**
    *   Implements a scheme for generating and managing stealth addresses on StarkNet.
    *   Includes functions to create stealth addresses, check ownership, and derive stealth private keys.
    *   Features domain separation in hash computations for enhanced security and robust error handling (e.g., for zero derived private keys).
    *   Comprehensively tested for various scenarios, including input validation and edge cases.

## Installation

This package is intended to be used within the `@starkms` monorepo. If you were to use it as a standalone package (e.g., after publishing to a registry), you would typically install it along with its peer dependencies:

```bash
npm install @starkms/crypto @scure/starknet @noble/hashes
# or
yarn add @starkms/crypto @scure/starknet @noble/hashes
```
*(Note: `@scure/starknet` provides STARK curve operations, and `@noble/hashes` provides hashing utilities like SHA256.)*

## Usage Examples

### Non-Interactive Proof (`proveFS` and `verify`)

This is the most common way to use the Chaum-Pedersen protocol for proving knowledge of a secret `x`.

```typescript
import {
  proveFS,
  verify,
  randScalar,
  Statement, // Type for { U, V }
  Proof,     // Type for { P, Q, c, e }
  // G and H are implicitly used by proveFS and verify
  // but can be imported from core/curve and chaum-pedersen/generators if needed directly.
} from "@starkms/crypto"; // Assuming main index exports from chaum-pedersen

// 1. Prover: Knows a secret scalar 'x'
// randScalar() generates a cryptographically secure random scalar modulo CURVE_ORDER.
const secretX = randScalar();

// 2. Prover: Generate a non-interactive proof for 'secretX'
// This computes U = xG, V = xH and the proof components P, Q, c, e.
const { stmt, proof } = proveFS(secretX);

// 'stmt' (Statement) contains public points U and V.
// 'proof' (Proof) contains commitment points P, Q, challenge c, and response e.

console.log("Prover's Statement (U, V):");
// Points can be converted to hex for display or transmission
console.log("  U:", stmt.U.toHex());
console.log("  V:", stmt.V.toHex());

console.log("Prover's Proof (P, Q, c, e):");
console.log("  P:", proof.P.toHex());
console.log("  Q:", proof.Q.toHex());
// Scalars are bigints; convert to string or hex as needed.
console.log("  c (challenge):", proof.c.toString(16));
console.log("  e (response):", proof.e.toString(16));

// 3. Verifier: Receives the statement (U,V) and proof (P,Q,c,e) from the prover.
// The verifier also uses the same public parameters G and H.

const isValid = verify(stmt, proof);

if (isValid) {
  console.log("Proof is valid! The prover has demonstrated knowledge of the secret x.");
} else {
  console.log("Proof is invalid! Verification failed.");
}
```

### Interactive Proof (Conceptual Steps)

The interactive protocol involves a back-and-forth between prover and verifier.

```typescript
import {
  commit,
  generateChallenge, // Typically, verifier generates or it's from transcript
  respond,
  verify,
  randScalar,
  Statement,
  Proof,
  G, // Base point G from core/curve
  H, // Derived generator H from chaum-pedersen/generators
} from "@starkms/crypto"; // Assuming main index exports necessary items

// --- Prover Side ---
const secretX_interactive = randScalar();
const proverNonce_r = randScalar(); // Prover generates a secret nonce

// Step 1: Prover commits
// P = rG, Q = rH
const { commit: proverCommitment, nonce: returnedNonce } = commit(proverNonce_r);
// Prover sends proverCommitment { P, Q } to Verifier. `returnedNonce` should be same as `proverNonce_r`.

// --- Verifier Side ---
// Verifier receives P, Q.
// For the challenge, U and V (related to secretX_interactive) are also needed.
// These are typically known to the verifier as part of the public statement.
const U_interactive = G.multiply(secretX_interactive);
const V_interactive = H.multiply(secretX_interactive);
const publicStatement: Statement = { U: U_interactive, V: V_interactive };

// Step 2: Verifier (or a transcript) generates a challenge 'c'
// The challenge incorporates P, Q from prover, and the public U, V.
const challenge_c = generateChallenge(proverCommitment.P, proverCommitment.Q, publicStatement.U, publicStatement.V);
// Verifier sends challenge_c to Prover.

// --- Prover Side ---
// Step 3: Prover computes response 'e'
// e = (r + c*x) mod n
const response_e = respond(secretX_interactive, proverNonce_r, challenge_c);
// Prover sends response_e to Verifier.

// --- Verifier Side ---
// Step 4: Verifier verifies the proof
const finalProof: Proof = { ...proverCommitment, c: challenge_c, e: response_e };
const isInteractiveValid = verify(publicStatement, finalProof);

console.log("Interactive proof is valid:", isInteractiveValid);
```

## API Overview

The primary Chaum-Pedersen functionalities are typically exported from `@starkms/crypto` (or a sub-path like `@starkms/crypto/chaum-pedersen`).

### Key Types:
*   `Scalar`: `bigint` representing a scalar value modulo the STARK curve's order.
*   `Point`: Represents an elliptic curve point on the STARK curve (an instance of `ProjectivePoint` from `@scure/starknet`).
*   `Statement`: An object `{ U: Point, V: Point }` defining the public values `U=xG, V=xH`.
*   `Proof`: An object `{ P: Point, Q: Point, c: Scalar, e: Scalar }` representing the non-interactive proof.
*   `InteractiveCommit`: An object `{ P: Point, Q: Point }` representing the prover's initial commitment in the interactive protocol.

### Main Functions:
*   `proveFS(secretX: Scalar): { stmt: Statement, proof: Proof }`: Creates a non-interactive (Fiat-Shamir) proof for the given `secretX`.
*   `verify(stmt: Statement, proof: Proof): boolean`: Verifies a non-interactive proof against a statement.
*   `commit(nonce_r?: Scalar): { commit: InteractiveCommit, nonce: Scalar }`: (Interactive use) Generates commitment points `P, Q` from a nonce `r`. If `r` is not provided, it's generated randomly.
*   `generateChallenge(...points: Point[]): Scalar`: (Used in Fiat-Shamir) Generates a challenge scalar by hashing input points using Poseidon.
*   `respond(secretX: Scalar, nonce_r: Scalar, challenge_c: Scalar): Scalar`: (Interactive use) Computes the response scalar `e`.
*   `encodeProof(proof: Proof): Uint8Array`: Serializes a proof object into a compact byte array (192 bytes).
*   `decodeProof(bytes: Uint8Array): Proof`: Deserializes a byte array back into a proof object.
*   `randScalar(): Scalar`: Utility to generate a cryptographically secure random scalar `s` where `0 < s < CURVE_ORDER`.

### Core Elliptic Curve Elements (from `core/curve.ts`):
*   `G`: The standard base point (generator) of the STARK curve.
*   `H`: The secondary generator point, securely derived as `hG` where `h = SHA256("starkex.chaum-pedersen.H.v1") % CURVE_ORDER`.
*   `CURVE_ORDER`: The order `n` of the STARK curve's base field.
*   `ProjectivePoint`: The class representing elliptic curve points from `@scure/starknet`.

## Security Considerations

The security of the Chaum-Pedersen protocol implementation hinges on several standard cryptographic assumptions and practices:
1.  **Discrete Logarithm Problem (DLP):** The fundamental security relies on the hardness of computing the secret `x` given public points like `U = xG` (or `V = xH`) on the STARK curve.
2.  **Cryptographic Hash Function Properties:** The Poseidon hash function, used for the Fiat-Shamir transformation to create non-interactive proofs, is assumed to behave like a random oracle. Its resistance to preimage and collision attacks is crucial.
3.  **Secure Generator Parameters:**
    *   `G` is the standard, well-vetted base point of the STARK curve.
    *   `H` is generated using a "nothing-up-my-sleeve" number derived from the SHA256 hash of a domain separation tag (`"starkex.chaum-pedersen.H.v1"`). This method ensures that the discrete logarithm of `H` with respect to `G` (`log_G(H)`) is unknown and intractable to compute.
4.  **Nonce Security:** The random nonce `r` used in the commitment phase (`P=rG, Q=rH`) must be:
    *   Chosen uniformly at random from the range `[1, CURVE_ORDER-1]`.
    *   Kept secret by the prover until the response phase (in interactive scenarios).
    *   Never reused for different proofs with the same secret `x`, as this can lead to leaking `x`. The `randScalar()` function is designed to provide such nonces. `proveFS` handles this internally.
5.  **Input Validation:** The `verify` function includes checks for point validity on the curve for all points involved in the proof (`U, V, P, Q`).

## Advanced Details & Specification

For a more in-depth technical understanding of the Chaum-Pedersen implementation, including cryptographic details of parameter generation, the Fiat-Shamir transformation, and security rationale, please consult the detailed specification document:

[Chaum-Pedersen ZKP Implementation Specification](./docs/chaum-pedersen.md)

*(Note: The path to `chaum-pedersen.md` assumes it will be located in a `docs` subdirectory within the `packages/crypto` directory. Adjust the link if the file structure differs.)*

---

This README aims to provide a comprehensive starting point for developers. For specific API details, always refer to the JSDoc comments within the source code and the detailed specification document.