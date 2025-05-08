import { utf8ToBytes } from "@noble/hashes/utils";
import { num } from "starknet"; // Import ec for POINT_AT_INFINITY check
import {
  G,
  Point,
  Scalar,
  moduloOrder,
  poseidonHashScalars, // Use the core Poseidon utility
  POINT_AT_INFINITY, // For sanity check
} from "../core/curve";

// --- AUDIT WARNING --- START ---
// The method used below for generating H (h_scalar * G) is explicitly
// called out by the security audit as a soundness risk if h_scalar is knowable (as it is here).
// This is because the recommended fix, using `hashToCurve` from `@noble/curves/stark`,
// failed due to module resolution errors (`Cannot find module '@noble/curves/stark'`).
//
// CRITICAL TODO: Resolve the dependency/import issue and replace this implementation
// with one based on a secure hash-to-curve function where the discrete log
// log_G(H) is unknown.
//
// The code below is a temporary fallback to allow the project to build and test other parts.
// --- AUDIT WARNING --- END ---

/**
 * [TEMPORARY FALLBACK - See AUDIT WARNING above]
 * Hashes an arbitrary string to a field element < CURVE_ORDER using Poseidon.
 * Note: Poseidon is designed for field elements. Hashing arbitrary bytes might not be its primary design.
 * We convert bytes to bigint for input.
 */
function hashDomainToScalarPoseidon(domain: string): Scalar {
  const domainBytes = utf8ToBytes(domain);
  // Represent bytes as a single large BigInt - simple method, might not be canonical
  // Consider padding or specific encoding if needed for stricter domain separation.
  const domainBigInt = num.toBigInt("0x" + Buffer.from(domainBytes).toString("hex"));
  // Poseidon hash expects an array
  const hashedScalar = poseidonHashScalars([domainBigInt]);
  return moduloOrder(hashedScalar); // Ensure result is < CURVE_ORDER
}

/**
 * [TEMPORARY FALLBACK - See AUDIT WARNING above]
 * Secondary generator H = h * G, where h = PoseidonHash(domain_string_bytes).
 * WARNING: log_G(H) = h, and h is publicly computable.
 */
const h_scalar_public = hashDomainToScalarPoseidon("ChaumPedersen.H (v1 fallback)");
if (h_scalar_public === 0n) {
  // This is unlikely if Poseidon is cryptographically sound.
  throw new Error("[Temporary H Gen Fallback] Hash for H resulted in a zero scalar.");
}
export const H: Point = G.multiply(h_scalar_public);

// Sanity check H
if (H.equals(POINT_AT_INFINITY)) {
    throw new Error("[Temporary H Gen Fallback] Derived generator H is the point at infinity.");
}
if (H.equals(G)) {
    // This would happen if hash(...) = 1, extremely unlikely.
    console.warn("[Temporary H Gen Fallback] Derived generator H is equal to G. Check domain string or hash function.");
} 