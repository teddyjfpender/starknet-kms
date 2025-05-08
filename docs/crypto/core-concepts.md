# Core Elliptic Curve Concepts

This section explains the fundamental mathematical objects used in the elliptic curve cryptography implementations within this package.

## Elliptic Curve Cryptography (ECC)

At a high level, ECC is a type of public-key cryptography based on the algebraic structure of elliptic curves over finite fields. Instead of relying on the difficulty of factoring large numbers (like RSA), ECC relies on the difficulty of the Elliptic Curve Discrete Logarithm Problem (ECDLP).

Key advantages include smaller key sizes for equivalent security levels compared to non-ECC methods.

## The Starknet Curve (`stark_curve`)

Starknet uses a specific elliptic curve, often referred to as `stark_curve`. This curve has specific parameters (like its equation, the prime field `p` it's defined over, and the order `n` of its main subgroup) that are crucial for security and compatibility within the Starknet ecosystem.

Our `core/curve.ts` module encapsulates these parameters using the `starknet.js` library's representation.

## Key Mathematical Objects

### Scalars (`Scalar`)

*   **What:** A scalar is essentially a large integer (`bigint` in TypeScript). In ECC, scalars are typically used as **private keys** or intermediate values in calculations.
*   **Range:** For cryptographic operations on the Starknet curve, scalars must belong to the finite field defined by the curve's order, denoted `n`. This means they are integers in the range `[0, n-1]`. Private keys specifically should be in the range `[1, n-1]` (0 is invalid as a private key).
*   **Operations:** Standard arithmetic operations (addition, multiplication) are performed modulo `n`.
*   **Representation:** Handled as `bigint` in the `core` module.

### Points (`Point`)

*   **What:** A point represents a location `(x, y)` that satisfies the specific elliptic curve equation used by Starknet. They are the fundamental elements of the elliptic curve group.
*   **Public Keys:** Elliptic curve points are typically used as **public keys**.
*   **Representation:** Internally represented by `starknet.js`'s `ProjectivePoint` objects for efficient computation. These can be converted to/from affine coordinates `(x, y)`.
*   **Special Points:**
    *   **Generator Point (`G`):** A standard, publicly known base point on the curve. Public keys are derived by multiplying `G` by a private key scalar `x` (i.e., `PublicKey = x * G`).
    *   **Point at Infinity (`O`):** This is the identity element for the group operation (point addition). Adding `O` to any point `P` results in `P` (`P + O = P`). It doesn't have standard `(x, y)` coordinates.

### Group Operation: Point Addition

The primary operation on elliptic curve points is "point addition". Given two points `P1` and `P2` on the curve, there's a defined geometric rule to find a third point `P3 = P1 + P2` which is also on the curve. This operation gives the curve its useful cryptographic group structure.

*   **Scalar Multiplication:** This is defined as repeated point addition. Multiplying a point `P` by a scalar `k` (i.e., `k * P`) means adding `P` to itself `k` times (`P + P + ... + P`). This is how public keys are generated (`PublicKey = privateKey * G`). The hardness of ECC comes from the fact that given `PublicKey` and `G`, it's computationally infeasible to find `privateKey` (this is the ECDLP).

Understanding these core concepts is crucial for understanding the primitives and protocols built upon them. 