import {
  type Point,
  type Scalar,
  poseidonHashScalars, // Use the centralized Poseidon hashing utility
} from "../core/curve"

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
 * @throws Error if the point conversion to affine coordinates fails (e.g., if `P` is the point at infinity,
 *         though `toAffine()` on `@scure/starknet` points typically handles this by returning specific values or throwing).
 *         The behavior for the point at infinity should be tested and handled consistently if it can be an input.
 *         (Note: Chaum-Pedersen points U,V,P,Q are typically not the point at infinity in valid proofs).
 */
export function serializePointForTranscript(P: Point): bigint[] {
  const PAffine = P.toAffine() // Converts to affine { x, y }
  // Standard Starknet serialization for Poseidon hashing involves x and y-parity.
  return [PAffine.x, PAffine.y & 1n]
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
 *               in a Chaum-Pedersen proof.
 * @returns A `Scalar` (bigint) representing the challenge `c`, where `0 <= c < CURVE_ORDER`.
 * @throws Error if point serialization or hashing fails.
 */
export function generateChallenge(...points: Point[]): Scalar {
  // Flatten the serialized representation of all points into a single array of bigints.
  const serializedInputs: bigint[] = points.flatMap(serializePointForTranscript)

  // Use the centralized poseidonHashScalars utility from core/curve.ts.
  // This function handles hashing an array of bigints with Poseidon and
  // ensures the result is correctly reduced modulo CURVE_ORDER.
  return poseidonHashScalars(serializedInputs)
}
