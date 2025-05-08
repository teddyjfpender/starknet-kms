# Chaum-Pedersen Zero-Knowledge Proof (`chaum-pedersen/`)

This module implements the Chaum-Pedersen interactive identification protocol, adapted as a non-interactive zero-knowledge proof (NIZK) using the Fiat-Shamir transformation. It allows a Prover to convince a Verifier that two elliptic curve points, `U` and `V`, share the same discrete logarithm (secret exponent `x`) with respect to two different base points (`G` and `H`), without revealing the secret `x` itself.

Specifically, it proves knowledge of `x` such that:

*   `U = x * G`
*   `V = x * H`

Where `G` is the standard base point of the Starknet curve, and `H` is a secondary base point derived such that its discrete logarithm with respect to `G` is unknown.

## ELI5: What is a Zero-Knowledge Proof?

Imagine you know a secret password (`x`) that opens two different magic doors (`U` and `V`). You want to convince your friend (the Verifier) that you know the *same* password for both doors, but you absolutely don't want to tell them the password.

A Zero-Knowledge Proof is like a clever challenge game you play with your friend. You perform some actions involving the doors (making commitments `P`, `Q`) in a way that depends on your secret password *and* some random choices (`r`). Your friend then gives you a random challenge (`c`). You use your secret password, your random choices, and the challenge to give a final response (`e`).

Your friend can check your initial actions (`P`, `Q`), their challenge (`c`), and your final response (`e`) against the magic doors (`U`, `V`). If everything matches up according to the game's rules, they become convinced you must know the same secret password for both doors, even though they never learned the password itself!

The Chaum-Pedersen protocol is one specific set of rules for this game.

## The Protocol

### Actors

*   **Prover:** Knows the secret `x`, wants to prove knowledge.
*   **Verifier:** Wants to be convinced the Prover knows `x` linking `U` and `V`.

### Statement

The public information both parties agree on:
*   Points `U` and `V`.
*   Base points `G` and `H`.

### Interactive Protocol Flow

1.  **Commit (Prover):**
    *   Chooses a secret random nonce `r` (a scalar).
    *   Computes commitment points: `P = r * G` and `Q = r * H`.
    *   Sends `P` and `Q` to the Verifier.
2.  **Challenge (Verifier):**
    *   Chooses a random challenge `c` (a scalar).
    *   Sends `c` to the Prover.
3.  **Response (Prover):**
    *   Computes the response `e = r + c*x` (modulo `n`, the curve order).
    *   Sends `e` to the Verifier.
4.  **Verify (Verifier):**
    *   Checks if two equations hold:
        *   `e * G == P + c * U`
        *   `e * H == Q + c * V`
    *   If both hold, the Verifier accepts the proof.

**Why does verification work?**
Substitute the definitions:
*   `e*G = (r + c*x)*G = r*G + c*x*G = P + c*U`
*   `e*H = (r + c*x)*H = r*H + c*x*H = Q + c*V`

### Non-Interactive Proof (Fiat-Shamir)

To avoid the back-and-forth, the Prover can simulate the Verifier's challenge by hashing the public information available after the commit step. This makes the proof non-interactive (a NIZK).

1.  **Prover:**
    *   Knows secret `x`.
    *   Computes `U = x*G`, `V = x*H`.
    *   Chooses random nonce `r`, computes `P = r*G`, `Q = r*H`.
    *   **Generates challenge `c` itself:** `c = Hash(G, H, U, V, P, Q)` (using a suitable cryptographic hash function like Poseidon).
    *   Computes response `e = r + c*x` (mod `n`).
    *   The **proof** consists of `{ P, Q, c, e }`.
The **statement** is `{ U, V }`.
2.  **Verifier:**
    *   Receives the statement `{ U, V }` and proof `{ P, Q, c, e }`.
    *   **Re-calculates the challenge `c'` itself:** `c' = Hash(G, H, U, V, P, Q)`.
    *   Checks if `c' == c` (ensures challenge wasn't manipulated).
    *   Checks the two verification equations:
        *   `e * G == P + c * U`
        *   `e * H == Q + c * V`
    *   If all checks pass, the proof is valid.
    (Our implementation combines the `c' == c` check implicitly, as the verifier uses the `c` from the proof directly in the equations).

## Implementation (`chaum-pedersen/`)

This module uses the core primitives and implements the Fiat-Shamir version.

### `generators.ts`

*   **Purpose:** Defines the secondary generator `H`.
*   **`H: Point`**: The secondary generator point.
    > **SECURITY WARNING (from Audit):** Due to issues resolving the recommended `hashToCurve` import from `@noble/curves/stark`, this module currently uses a **temporary fallback method** for generating `H`. It calculates `H = h*G`, where `h` is derived by hashing the public domain string "ChaumPedersen.H (v1 fallback)" using Poseidon.
    > 
    > **This means `h = log_G(H)` is publicly computable, which breaks the soundness property required by the Chaum-Pedersen ZKP in scenarios where the statement (`U`, `V`) might be maliciously crafted.**
    > 
    > **CRITICAL TODO:** The underlying dependency issue preventing the import of a proper `hashToCurve` function **MUST** be resolved, and this implementation **MUST** be replaced to ensure the discrete log relationship between `G` and `H` is unknown.

### `transcript.ts`

*   **Purpose:** Handles challenge generation using Poseidon hash.
*   **`serializePointForTranscript(P: Point): bigint[]`**: Converts a `Point` to `[x, y_parity]` for hashing.
*   **`generateChallenge(...points: Point[]): Scalar`**: Computes `c = PoseidonHash(serialize(points)...)` modulo `CURVE_ORDER`.

### `chaum-pedersen.ts`

*   **Purpose:** Contains the main ZKP logic.
*   **Types:**
    *   `Statement { U: Point, V: Point }`
    *   `Proof { P: Point, Q: Point, c: Scalar, e: Scalar }`
*   **`commit(r: Scalar = randScalar())`**: *Internal helper/Interactive step 1.* Generates `{ P, Q }` and returns `{ commit: { P, Q }, nonce: r }`.
*   **`respond(x: Scalar, r: Scalar, c: Scalar): Scalar`**: *Internal helper/Interactive step 2.* Calculates `e = r + c*x` mod `n`.
*   **`proveFS(x: Scalar)`**: Generates a full non-interactive proof `{ stmt: { U, V }, proof: { P, Q, c, e } }` for a secret `x`.
*   **`verify(stmt: Statement, proof: Proof): boolean`**: Verifies a non-interactive proof. Includes point validity checks and the two core verification equations.

### `index.ts`

Barrel file exporting the public API (`Statement`, `Proof`, `proveFS`, `verify`, etc.). 