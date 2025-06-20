import { concatBytes } from "@noble/hashes/utils"
import {
  G,
  type Point,
  type Scalar,
  hexToPoint,
  moduloOrder,
  randScalar,
  scalarMultiply,
  CURVE_ORDER,
  POINT_AT_INFINITY,
} from "../core/curve"
import { H } from "./generators"
import { generateChallenge } from "./transcript"

/* ------------------------  Input Validation Helpers  -------------------- */

/**
 * Validates that a scalar is in the valid range [1, CURVE_ORDER - 1]
 * @param scalar The scalar to validate
 * @param name The name of the scalar for error messages
 * @throws Error if scalar is invalid
 */
function validateScalar(scalar: Scalar, name: string): void {
  if (typeof scalar !== 'bigint') {
    throw new Error(`${name} must be a bigint`)
  }
  if (scalar <= 0n || scalar >= CURVE_ORDER) {
    throw new Error(`${name} must be in range [1, ${CURVE_ORDER - 1n}], got ${scalar}`)
  }
}

/**
 * Validates that a scalar is in the valid range [0, CURVE_ORDER - 1]
 * @param scalar The scalar to validate
 * @param name The name of the scalar for error messages
 * @throws Error if scalar is invalid
 */
function validateScalarIncludingZero(scalar: Scalar, name: string): void {
  if (typeof scalar !== 'bigint') {
    throw new Error(`${name} must be a bigint`)
  }
  if (scalar < 0n || scalar >= CURVE_ORDER) {
    throw new Error(`${name} must be in range [0, ${CURVE_ORDER - 1n}], got ${scalar}`)
  }
}

/**
 * Validates that a point is valid and not the point at infinity
 * @param point The point to validate
 * @param name The name of the point for error messages
 * @throws Error if point is invalid
 */
function validatePoint(point: Point, name: string): void {
  if (!point) {
    throw new Error(`${name} cannot be null or undefined`)
  }
  
  if (point.equals(POINT_AT_INFINITY)) {
    throw new Error(`${name} cannot be the point at infinity`)
  }
  
  try {
    point.assertValidity()
  } catch (error) {
    throw new Error(`${name} is not a valid point on the curve: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

/**
 * Validates a complete statement
 * @param stmt The statement to validate
 * @throws Error if statement is invalid
 */
function validateStatement(stmt: Statement): void {
  if (!stmt) {
    throw new Error("Statement cannot be null or undefined")
  }
  validatePoint(stmt.U, "Statement.U")
  validatePoint(stmt.V, "Statement.V")
}

/**
 * Validates a complete proof
 * @param proof The proof to validate
 * @throws Error if proof is invalid
 */
function validateProof(proof: Proof): void {
  if (!proof) {
    throw new Error("Proof cannot be null or undefined")
  }
  validatePoint(proof.P, "Proof.P")
  validatePoint(proof.Q, "Proof.Q")
  validateScalarIncludingZero(proof.c, "Proof.c")
  validateScalar(proof.e, "Proof.e")
}

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
export function commit(r?: Scalar): {
  commit: InteractiveCommit
  nonce: Scalar
} {
  const nonce = r ?? randScalar()
  
  // Validate the nonce if provided
  if (r !== undefined) {
    validateScalar(r, "nonce r")
  }

  // Compute commitment points
  const P = scalarMultiply(nonce, G)
  const Q = scalarMultiply(nonce, H)

  // Validate the generated points (should never fail with valid inputs)
  validatePoint(P, "Generated commitment P")
  validatePoint(Q, "Generated commitment Q")

  return {
    commit: { P, Q },
    nonce,
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
 *          It must be in the range `[1, CURVE_ORDER - 1]`.
 * @param r The random nonce scalar used during the {@link commit} phase.
 *          It must be in the range `[1, CURVE_ORDER - 1]`.
 * @param c The challenge scalar. It must be in the range `[0, CURVE_ORDER - 1]`.
 * @returns The response scalar `e`, guaranteed to be in the range `[0, CURVE_ORDER - 1]`.
 * @throws Error if scalar arithmetic encounters issues or inputs are invalid.
 */
export function respond(x: Scalar, r: Scalar, c: Scalar): Scalar {
  // Validate all inputs
  validateScalar(x, "secret x")
  validateScalar(r, "nonce r")
  validateScalarIncludingZero(c, "challenge c")

  // Compute response: e = (r + c*x) mod n
  const cx = c * x
  const r_plus_cx = r + cx
  const e = moduloOrder(r_plus_cx)

  // Validate the result (should be in valid range)
  if (e < 0n || e >= CURVE_ORDER) {
    throw new Error(`Internal error: computed response e=${e} is out of range`)
  }

  return e
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
 *          It must be in the range `[1, CURVE_ORDER - 1]`.
 * @returns An object containing:
 *          - `stmt`: The public statement {@link Statement} `{ U, V }`.
 *          - `proof`: The non-interactive {@link Proof} `{ P, Q, c, e }`.
 * @throws Error if any underlying cryptographic operation fails or inputs are invalid.
 */
export function proveFS(x: Scalar): { stmt: Statement; proof: Proof } {
  // Validate the secret
  validateScalar(x, "secret x")

  // Compute public statement points
  const U = scalarMultiply(x, G)
  const V = scalarMultiply(x, H)

  // Validate generated statement points
  validatePoint(U, "Generated statement U")
  validatePoint(V, "Generated statement V")

  // Generate nonce r and commitments P = rG, Q = rH
  const { commit: interactiveCommit, nonce: r } = commit()

  // Generate challenge c = Hash(P, Q, U, V)
  const c = generateChallenge(interactiveCommit.P, interactiveCommit.Q, U, V)

  // Compute response e = (r + c*x) mod n
  const e = respond(x, r, c)

  const stmt = { U, V }
  const proof = { ...interactiveCommit, c, e }

  // Final validation
  validateStatement(stmt)
  validateProof(proof)

  return { stmt, proof }
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
 * are valid points on the STARK curve and that all scalars are in valid ranges.
 *
 * @param stmt The public statement {@link Statement} `{ U, V }` being verified.
 * @param proof The non-interactive proof {@link Proof} `{ P, Q, c, e }` to verify.
 * @returns `true` if the proof is valid for the given statement, `false` otherwise.
 *          Returns `false` if any input is invalid.
 * @throws Error only for unexpected internal errors, not for invalid proofs.
 */
export function verify(stmt: Statement, proof: Proof): boolean {
  try {
    // Validate all inputs
    validateStatement(stmt)
    validateProof(proof)
  } catch (error) {
    // Invalid inputs result in failed verification, not thrown errors
    return false
  }

  const { U, V } = stmt
  const { P, Q, c, e } = proof

  try {
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
  } catch (error) {
    // Any computation error during verification means the proof is invalid
    return false
  }
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
 * @throws Error if BigInt conversion to bytes fails or if proof is invalid.
 */
export function encodeProof(proof: Proof): Uint8Array {
  // Validate the proof before encoding
  validateProof(proof)

  const { P, Q, c, e } = proof

  const be = (n: bigint): Uint8Array => {
    if (n < 0n || n >= (1n << 256n)) {
      throw new Error(`BigInt ${n} is out of range for 32-byte encoding`)
    }

    const arr = new Uint8Array(32)
    let num = n
    for (let i = 0; i < 32; i++) {
      arr[31 - i] = Number(num & 0xffn)
      num >>= 8n
    }
    
    if (num !== 0n) {
      throw new Error(`BigInt ${n} is too large for 32-byte encoding`)
    }
    
    return arr
  }

  try {
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
  } catch (error) {
    throw new Error(`Failed to encode proof: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
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
 * @throws Error if the byte array has an unexpected length, if point reconstruction fails,
 *         or if the resulting proof is invalid.
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
      const byteValue = bytes[offset + i]
      if (byteValue === undefined) {
        throw new Error(
          `Byte value at offset ${offset + i} is unexpectedly undefined during proof decoding.`,
        )
      }
      result = (result << 8n) | BigInt(byteValue)
    }
    return result
  }

  try {
    const Px_val: bigint = read(0)
    const Py_val: bigint = read(32)
    const Qx_val: bigint = read(64)
    const Qy_val: bigint = read(96)
    const c_scalar: bigint = read(128)
    const e_scalar: bigint = read(160)

    const coordToHex = (coord: bigint): string => {
      const hex = coord.toString(16)
      if (hex.length > 64) {
        throw new Error(`Coordinate hex representation is too long: ${hex}`)
      }
      return hex.padStart(64, "0")
    }

    // Reconstruct points from their uncompressed hex representation
    const P_hex = `0x04${coordToHex(Px_val)}${coordToHex(Py_val)}`
    const P = hexToPoint(P_hex)

    const Q_hex = `0x04${coordToHex(Qx_val)}${coordToHex(Qy_val)}`
    const Q = hexToPoint(Q_hex)

    const proof: Proof = {
      P,
      Q,
      c: c_scalar,
      e: e_scalar,
    }

    // Validate the decoded proof
    validateProof(proof)

    return proof
  } catch (error) {
    throw new Error(`Failed to decode proof: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}
