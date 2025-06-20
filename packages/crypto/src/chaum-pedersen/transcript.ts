import {
  type Point,
  type Scalar,
  POINT_AT_INFINITY,
} from "../core/curve"
import { poseidonHashScalars } from "../core/hash"

/**
 * Serializes an elliptic curve point for inclusion in a transcript hash.
 * This function converts a point `P` (potentially in projective coordinates)
 * into a standardized array of two bigints suitable for hashing.
 *
 * The serialization uses a form of compressed-y coordinates:
 * 1. The point `P` is converted to its affine representation `(x, y)`.
 * 2. The output is `[x, y_parity]`, where `x` is the affine x-coordinate
 *    and `y_parity` is the least significant bit of the affine y-coordinate (`y & 1n`).
 *
 * This format `[x, y_parity]` is common in cryptographic protocols on elliptic curves
 * as it uniquely represents the point (given the curve equation) while reducing data size.
 *
 * @param P The elliptic curve point (`Point` type, typically `ProjectivePoint` from `@scure/starknet`) to serialize.
 * @returns An array of two `bigint` values: `[affine_x_coordinate, y_parity]`.
 * @throws Error if the point is null/undefined, the point at infinity, or point conversion fails.
 */
export function serializePointForTranscript(P: Point): bigint[] {
  if (!P) {
    throw new Error("Point cannot be null or undefined for transcript serialization")
  }
  
  if (P.equals(POINT_AT_INFINITY)) {
    throw new Error("Point at infinity cannot be serialized for transcript")
  }
  
  try {
    P.assertValidity()
  } catch (error) {
    throw new Error(`Invalid point for transcript serialization: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
  
  try {
    const PAffine = P.toAffine() // Converts to affine { x, y }
    // Standard Starknet serialization for Poseidon hashing involves x and y-parity.
    return [PAffine.x, PAffine.y & 1n]
  } catch (error) {
    throw new Error(`Failed to convert point to affine coordinates: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}

/**
 * Generates a cryptographic challenge scalar `c` for the Fiat-Shamir transformation
 * by hashing a series of elliptic curve points.
 *
 * The process is as follows:
 * 1. Each input point is serialized using {@link serializePointForTranscript}
 *    to obtain an array `[affine_x, y_parity]`.
 * 2. All serialized point data (which are `bigint` arrays) are flattened into a single
 *    array of `bigint`s.
 * 3. This flat array of `bigint`s is then hashed using `poseidonHashScalars`
 *    (from `../core/curve.ts`), which employs the Poseidon hash function.
 *    Poseidon is the standard hash function in the Starknet ecosystem, chosen for its
 *    efficiency in ZK-STARK contexts.
 * 4. `poseidonHashScalars` ensures the final hash output is a valid scalar `c`
 *    modulo `CURVE_ORDER`, suitable for use in cryptographic computations within the STARK curve's field.
 *
 * This challenge scalar `c` is essential for making interactive ZKPs like Chaum-Pedersen
 * non-interactive, forming a core part of the Fiat-Shamir heuristic.
 *
 * @param points An array of `Point` objects to be included in the hash.
 *               These points typically form the context of the proof, e.g., `(P, Q, U, V)`
 *               in a Chaum-Pedersen proof. Must contain at least one point.
 * @returns A `Scalar` (bigint) representing the challenge `c`, where `0 <= c < CURVE_ORDER`.
 * @throws Error if point serialization or hashing fails, or if no points are provided.
 */
export function generateChallenge(...points: Point[]): Scalar {
  if (points.length === 0) {
    throw new Error("At least one point is required for challenge generation")
  }
  
  try {
    // Flatten the serialized representation of all points into a single array of bigints.
    const serializedInputs: bigint[] = points.flatMap(serializePointForTranscript)

    if (serializedInputs.length === 0) {
      throw new Error("Internal error: no serialized inputs generated")
    }

    // Use the centralized poseidonHashScalars utility from core/curve.ts.
    // This function handles hashing an array of bigints with Poseidon and
    // ensures the result is correctly reduced modulo CURVE_ORDER.
    return poseidonHashScalars(serializedInputs)
  } catch (error) {
    throw new Error(`Failed to generate challenge: ${error instanceof Error ? error.message : 'unknown error'}`)
  }
}
