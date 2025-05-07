import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { num, ec } from "starknet";
import { G, Point, Scalar, toFr } from "./curve-glue";

// AUDIT WARNING: The method used below for generating H (h_scalar * G) is explicitly
// called out by the audit as a soundness risk if h_scalar is knowable, as it is here.
// The recommended fix is to use `hashToCurve` from `@noble/curves/stark`.
// This requires ensuring `@noble/curves` (>=1.5, ideally latest) is a direct dependency
// and the import `import { hashToCurve } from "@noble/curves/stark";` works.
// The code below is a temporary placeholder to allow other audit fixes to proceed.

/**
 * [TEMPORARY - SEE AUDIT WARNING ABOVE]
 * Hashes an arbitrary string to a field element < CURVE_ORDER.
 */
function hashToPublicScalar(domain: string): Scalar {
  const digestBytes = sha256(utf8ToBytes(domain));
  const hexDigest = bytesToHex(digestBytes);
  const bigIntValue = num.toBigInt(`0x${hexDigest}`);
  return toFr(bigIntValue);
}

/**
 * [TEMPORARY - SEE AUDIT WARNING ABOVE]
 * Secondary generator H = h * G.
 */
const h_scalar_public = hashToPublicScalar("ChaumPedersen.H"); // This makes log_G(H) known
if (h_scalar_public === 0n) {
  throw new Error("[Temporary H Gen] Hash for H resulted in a zero scalar.");
}
export const H: Point = G.multiply(h_scalar_public);

if (H.equals(ec.starkCurve.ProjectivePoint.ZERO)) {
    throw new Error("[Temporary H Gen] Derived generator H is the point at infinity.");
}

// Optional Sanity Checks (requires importing G):
// import { G } from "./curve-glue";
// if (H.equals(G)) {
//   console.warn("Derived generator H is equal to G. This might be an issue for Chaum-Pedersen if not intended.");
// }
// if (H.equals(ec.starkCurve.ProjectivePoint.ZERO)) {
//   throw new Error("Derived generator H is the point at infinity, which is invalid.");
// } 