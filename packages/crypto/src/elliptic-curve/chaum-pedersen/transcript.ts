import { hash, num } from "starknet";
import {
  CURVE_ORDER,
  Point,
  Scalar,
} from "../core/curve";

/**
 * Serializes an elliptic curve point for the transcript.
 * For a point P=(x,y), it returns [x, y & 1n] (y-parity).
 * Ensures the point is affine before serialization.
 * @param P The point to serialize.
 * @returns An array of two bigints: [x, y_parity].
 */
export function serializePointForTranscript(P: Point): bigint[] {
  const PAffine = P.toAffine(); // Ensure we have affine coordinates
  return [PAffine.x, PAffine.y & 1n];
}

/**
 * Generates a challenge scalar by hashing a series of points using Poseidon.
 * The points are first serialized to [x, y_parity].
 * @param points An array of points to include in the hash.
 * @returns A challenge scalar (bigint < CURVE_ORDER).
 */
export function generateChallenge(...points: Point[]): Scalar {
  const serializedInputs: bigint[] = points.flatMap(serializePointForTranscript);
  
  const hashedHex = hash.computePoseidonHashOnElements(serializedInputs);
  // The audit suggests a single reduction to avoid potential (though extremely small) bias.
  // num.toBigInt(hashedHex) will be a positive BigInt if hashedHex is a valid hex string from Poseidon.
  // Then, % CURVE_ORDER gives a result in [0, CURVE_ORDER - 1].
  return num.toBigInt(hashedHex) % CURVE_ORDER;
  // The `as Scalar` cast from the audit is implicit if the return type is Scalar (bigint).
} 