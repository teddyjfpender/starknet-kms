import { concatBytes } from "@noble/hashes/utils"
// import { utils as starkUtils } from "@scure/starknet"; // Not used if reverting to self-contained BE conversion
import {
  G,
  type Point,
  // ProjectivePoint, // Removed unused import
  type Scalar,
  hexToPoint, // Ensure this is imported
  moduloOrder,
  randScalar,
  scalarMultiply, // Add this import for safe scalar multiplication
  // CURVE_ORDER, // Not strictly needed here if inputs are well-formed
} from "../core/curve"
import { H } from "./generators"
import { generateChallenge } from "./transcript"

/* ------------------------  Public types  ------------------------ */

/**
 * Defines the public statement for which a Chaum-Pedersen proof is created.
 * It asserts knowledge of a secret scalar `x` such that `U = xG` and `V = xH`,
 * where `G` is the standard base point and `H` is a secondary generator point.
 * The discrete logarithm of `H` with respect to `G` must be unknown.
 */
export interface Statement {
  /**
   * Point `U = xG`, where `x` is the secret scalar and `G` is the primary curve generator.
   */
  U: Point
  /**
   * Point `V = xH`, where `x` is the secret scalar and `H` is the secondary curve generator.
   */
  V: Point
}

/**
 * Represents the commitment part of an interactive Chaum-Pedersen proof,
 * or the commitment part of a non-interactive proof.
 * It consists of two points `P = rG` and `Q = rH`, where `r` is a random nonce.
 */
export interface InteractiveCommit {
  /**
   * Commitment point `P = rG`, where `r` is the prover's random nonce.
   */
  P: Point
  /**
   * Commitment point `Q = rH`, where `r` is the prover's random nonce.
   */
  Q: Point
}

/**
 * Represents a full non-interactive Chaum-Pedersen proof.
 * This proof demonstrates that the same secret `x` forms the basis for the public points `U` and `V`
 * in the {@link Statement} (`U = xG`, `V = xH`).
 *
 * The proof consists of:
 * - Commitments `P = rG` and `Q = rH` made with a random nonce `r`.
 * - A challenge scalar `c`, typically derived via Fiat-Shamir from `(P, Q, U, V)`.
 * - A response scalar `e = (r + c*x) mod n`, where `n` is the curve order.
 *
 * Security relies on:
 * - The hardness of the discrete logarithm problem in the STARK curve group.
 * - `G` and `H` being suitable generators with an unknown discrete log relationship (`log_G(H)` unknown).
 * - The hash function used for `c` behaving as a random oracle.
 */
export interface Proof extends InteractiveCommit {
  /**
   * The challenge scalar `c`, derived via Fiat-Shamir by hashing `(P, Q, U, V)`.
   * It must be a scalar modulo the curve order `n`.
   */
  c: Scalar
  /**
   * The response scalar `e = (r + c*x) mod n`.
   * `x` is the secret, `r` is the nonce from the commitment phase, `c` is the challenge.
   * `n` is the order of the curve.
   */
  e: Scalar
}

/* ------------------------  Algorithms  -------------------------- */

/**
 * Generates the prover's commitment in the first step of an interactive Chaum-Pedersen proof.
 *
 * The prover chooses a random scalar nonce `r` (secret) and computes commitment points:
 * `P = rG`
 * `Q = rH`
 *
 * These points `(P, Q)` are sent to the verifier. The nonce `r` must be kept secret
 * by the prover for the {@link respond} step.
 *
 * @param r Optional. A pre-generated random nonce scalar. If not provided, a secure random scalar
 *          `r` (where `0 < r < CURVE_ORDER`) will be generated using `randScalar()`.
 *          Reusing `r` values for different proofs with the same secret `x` can leak the secret.
 * @returns An object containing:
 *          - `commit`: The commitment points {@link InteractiveCommit} `{ P, Q }`.
 *          - `nonce`: The scalar nonce `r` used to generate the commitment. This must be used in the {@link respond} step.
 * @throws Error if `randScalar()` fails or if point operations encounter issues.
 */
export function commit(r: Scalar = randScalar()): {
  commit: InteractiveCommit
  nonce: Scalar
} {
  // Ensure r is a valid scalar (randScalar() already ensures 0 < r < CURVE_ORDER)
  // If r is provided, it's assumed to be a valid secret nonce.
  // No explicit moduloOrder(r) here, as G.multiply and H.multiply will handle scalars correctly.
  return {
    commit: {
      P: G.multiply(r), // P = rG
      Q: H.multiply(r), // Q = rH
    },
    nonce: r,
  }
}

/**
 * Computes the prover's response `e` in the second step of an interactive Chaum-Pedersen proof,
 * or as part of generating a non-interactive {@link Proof}.
 *
 * The response is calculated as: `e = (r + c*x) mod n`
 * where:
 * - `x` is the secret scalar (witness).
 * - `r` is the random nonce used in the {@link commit} phase.
 * - `c` is the challenge scalar (either provided by a verifier in interactive mode, or
 *   derived via Fiat-Shamir in non-interactive mode).
 * - `n` is the order of the elliptic curve.
 *
 * @param x The secret scalar (witness) such that `U = xG` and `V = xH`.
 *          It is assumed `0 < x < CURVE_ORDER`.
 * @param r The random nonce scalar used during the {@link commit} phase.
 *          It is assumed `0 < r < CURVE_ORDER`.
 * @param c The challenge scalar. It is assumed `0 <= c < CURVE_ORDER`.
 * @returns The response scalar `e`, guaranteed to be in the range `[0, CURVE_ORDER - 1]`.
 * @throws Error if scalar arithmetic encounters issues.
 */
export function respond(x: Scalar, r: Scalar, c: Scalar): Scalar {
  // x, r, c are assumed to be scalars (bigint).
  // Multiplication and addition are standard bigint operations.
  const cx = c * x // c*x can be > CURVE_ORDER
  const r_plus_cx = r + cx // r + c*x can be > CURVE_ORDER
  return moduloOrder(r_plus_cx) // Ensures result is in [0, CURVE_ORDER - 1]
}

/**
 * Creates a complete non-interactive Chaum-Pedersen proof using the Fiat-Shamir heuristic.
 *
 * This function proves knowledge of a secret scalar `x` such that `U = xG` and `V = xH`.
 *
 * The process involves:
 * 1. Computing the public statement values `U = xG` and `V = xH`.
 * 2. Generating a commitment: A random nonce `r` is chosen, and `P = rG`, `Q = rH` are computed.
 * 3. Deriving a challenge: The challenge `c` is computed by hashing `(P, Q, U, V)`
 *    using {@link generateChallenge}. This step makes the proof non-interactive.
 * 4. Computing the response: The response `e = (r + c*x) mod n` is calculated.
 *
 * The resulting proof is `(P, Q, c, e)` along with the statement `(U, V)`.
 *
 * @param x The secret scalar (witness) for which to generate the proof.
 *          It must be a valid scalar, ideally `0 < x < CURVE_ORDER`.
 * @returns An object containing:
 *          - `stmt`: The public statement {@link Statement} `{ U, V }`.
 *          - `proof`: The non-interactive {@link Proof} `{ P, Q, c, e }`.
 * @throws Error if any underlying cryptographic operation (scalar generation, point arithmetic, hashing) fails.
 */
export function proveFS(x: Scalar): { stmt: Statement; proof: Proof } {
  // x is assumed to be a valid secret scalar, e.g. 0 < x < CURVE_ORDER.
  // If x could be >= CURVE_ORDER, it should be reduced: x = moduloOrder(x).
  // However, typically x is a private key, already in range.

  const U = G.multiply(x) // U = xG
  const V = H.multiply(x) // V = xH

  // Generate nonce r and commitments P = rG, Q = rH
  const { commit: interactiveCommit, nonce: r } = commit()

  // Generate challenge c = Hash(P, Q, U, V)
  // generateChallenge is expected to return a scalar c in [0, CURVE_ORDER - 1]
  const c = generateChallenge(interactiveCommit.P, interactiveCommit.Q, U, V)

  // Compute response e = (r + c*x) mod n
  const e = respond(x, r, c)

  return {
    stmt: { U, V },
    proof: { ...interactiveCommit, c, e }, // Proof = (P, Q, c, e)
  }
}

/**
 * Verifies a non-interactive Chaum-Pedersen {@link Proof} against a public {@link Statement}.
 *
 * The verification involves checking two equations:
 * 1. `eG = P + cU`
 * 2. `eH = Q + cV`
 *
 * where:
 * - `(U, V)` are from the public statement.
 * - `(P, Q, c, e)` are from the proof.
 * - `G` is the primary curve generator.
 * - `H` is the secondary curve generator.
 *
 * Before performing calculations, this function validates that all input points (`U, V, P, Q`)
 * are valid points on the STARK curve using their `assertValidity()` method.
 *
 * @param stmt The public statement {@link Statement} `{ U, V }` being verified.
 * @param proof The non-interactive proof {@link Proof} `{ P, Q, c, e }` to verify.
 * @returns `true` if the proof is valid for the given statement, `false` otherwise.
 *          Returns `false` if any input point is invalid.
 * @throws Error if point operations or comparisons encounter issues, though typical errors
 *         during verification (e.g., failed equality checks) result in `false`.
 */
export function verify(stmt: Statement, proof: Proof): boolean {
  const { U, V } = stmt
  const { P, Q, c, e } = proof

  // Validate that all provided points are valid on the curve.
  // ProjectivePoint.assertValidity() checks if the point is on the curve
  // and not the point at infinity (if that's a constraint of the specific implementation).
  // For STARK curve (cofactor 1), any affine point (x,y) satisfying curve equation is valid.
  try {
    // Assuming U, V, P, Q are instances of ProjectivePoint from @scure/starknet
    U.assertValidity()
    V.assertValidity()
    P.assertValidity()
    Q.assertValidity()
  } catch (error) {
    // If any point is not valid (e.g., not on the curve), the proof is invalid.
    // console.error("Point validation failed during Chaum-Pedersen verify:", error);
    return false
  }

  // Scalars c and e are assumed to be in [0, CURVE_ORDER - 1].
  // If they could be outside this range, they should be reduced modulo CURVE_ORDER.
  // c comes from generateChallenge, which should ensure this.
  // e comes from respond, which uses moduloOrder.

  // Calculate Left-Hand Sides of the verification equations:
  // eG = G.multiply(e)
  // eH = H.multiply(e)
  const eG = scalarMultiply(e, G)
  const eH = scalarMultiply(e, H)

  // Calculate Right-Hand Sides of the verification equations:
  // P_plus_cU = P.add(U.multiply(c))
  // Q_plus_cV = Q.add(V.multiply(c))
  const cU = scalarMultiply(c, U)
  const P_plus_cU = P.add(cU)

  const cV = scalarMultiply(c, V)
  const Q_plus_cV = Q.add(cV)

  // Verify the equalities:
  // eG == P + cU  AND  eH == Q + cV
  return eG.equals(P_plus_cU) && eH.equals(Q_plus_cV)
}

/**
 * Serializes a {@link Proof} into a `Uint8Array` of 192 bytes.
 * The format is the concatenation of six 32-byte big-endian representations of:
 * P.x, P.y (affine coordinates), Q.x, Q.y (affine coordinates), c, e.
 *
 * Note: Points P and Q are converted to affine coordinates for serialization.
 * If a point is the point at infinity, its affine coordinates (x, y) are (0, 0).
 * This serialization matches common practices for elliptic curve points and scalars.
 *
 * @param proof The {@link Proof} object `{ P, Q, c, e }` to serialize.
 * @returns A `Uint8Array` of 192 bytes representing the proof.
 * @throws Error if BigInt conversion to bytes fails (e.g., too large for 32 bytes).
 */
export function encodeProof({ P, Q, c, e }: Proof): Uint8Array {
  const be = (n: bigint): Uint8Array => {
    const arr = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      arr[31 - i] = Number(n & 0xffn) // Get the least significant byte
      n >>= 8n // Shift right by 8 bits
    }
    // After shifting 32 times (for 32 bytes), if n is not zero, it means the original number was too large.
    if (n !== 0n && n !== -1n) {
      // For negative numbers, if all bits were 1s, n would become -1 after shifting.
      // This check is primarily for positive numbers. A more robust check for strict positive range might be needed
      // if the scalar can be negative and occupy full 32 bytes. Given c and e are field elements (positive),
      // n !== 0n is the main concern.
      throw new Error("BigInt too large for 32 bytes BE representation")
    }
    return arr
  }

  const PAffine = P.toAffine()
  const QAffine = Q.toAffine()

  return concatBytes(
    be(PAffine.x),
    be(PAffine.y),
    be(QAffine.x),
    be(QAffine.y),
    be(c),
    be(e),
  )
}

/**
 * Deserializes a {@link Proof} from a `Uint8Array` (expected 192 bytes).
 * This function is the inverse of {@link encodeProof}.
 *
 * It reads six 32-byte big-endian values for P.x, P.y, Q.x, Q.y, c, and e,
 * then reconstructs the points P and Q from their affine coordinates.
 *
 * @param bytes The `Uint8Array` (192 bytes) to deserialize.
 * @returns The deserialized {@link Proof} object `{ P, Q, c, e }`.
 * @throws Error if the byte array has an unexpected length or if point reconstruction fails.
 */
export function decodeProof(bytes: Uint8Array): Proof {
  if (bytes.length !== 192) {
    throw new Error(
      `Invalid byte array length for proof decoding. Expected 192, got ${bytes.length}`,
    )
  }

  const read = (offset: number): bigint => {
    let result = 0n
    for (let i = 0; i < 32; i++) {
      const byteValue = bytes[offset + i] // Remove explicit type annotation
      if (byteValue === undefined) {
        // This path should ideally be impossible if bytes.length check is correct
        // and bytes is a Uint8Array.
        throw new Error(
          `Byte value at offset ${offset + i} is unexpectedly undefined during proof decoding.`,
        )
      }
      result = (result << 8n) | BigInt(byteValue)
    }
    return result
  }

  const Px_val: bigint = read(0)
  const Py_val: bigint = read(32)
  const Qx_val: bigint = read(64)
  const Qy_val: bigint = read(96)
  const c_scalar: bigint = read(128)
  const e_scalar: bigint = read(160)

  const coordToHex = (coord: bigint): string => {
    const hex = coord.toString(16)
    // Field elements of Starknet curve are < 2^252, so their hex representation is <= 63 chars.
    // Pad to 64 chars (32 bytes).
    if (hex.length > 64) {
      // This should ideally not happen if coord is a valid field element from the curve.
      throw new Error(`Coordinate hex representation is too long: ${hex}`)
    }
    return hex.padStart(64, "0")
  }

  // Reconstruct points from their uncompressed hex representation
  const P_hex = `0x04${coordToHex(Px_val)}${coordToHex(Py_val)}`
  const P = hexToPoint(P_hex)

  const Q_hex = `0x04${coordToHex(Qx_val)}${coordToHex(Qy_val)}`
  const Q = hexToPoint(Q_hex)

  return {
    P, // hexToPoint should return type Point
    Q, // hexToPoint should return type Point
    c: c_scalar,
    e: e_scalar,
  }
}
