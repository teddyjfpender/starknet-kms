import { randomBytes } from "node:crypto";
import { bytesToHex } from "@noble/hashes/utils";
import { ec, encode, num } from "starknet";

const STARKNET_CURVE = ec.starkCurve;
const CURVE_ORDER = STARKNET_CURVE.CURVE.n;

// Uncompressed point at infinity (0x04 + 32 zero bytes for x + 32 zero bytes for y)
const POINT_AT_INFINITY_HEX_UNCOMPRESSED = `0x04${"00".repeat(64)}`;

/**
 * Converts a private key (hex string or BigInt) to its BigInt representation.
 * @param privateKey - The private key (hex string or BigInt).
 * @returns The BigInt representation of the private key.
 * @throws Error if the private key format is invalid.
 */
function toBigIntPrivateKey(privateKey: string | bigint): bigint {
  if (typeof privateKey === 'bigint') {
    return privateKey;
  }
  if (typeof privateKey === 'string') {
    return num.toBigInt(privateKey);
  }
  throw new Error("Invalid private key format. Expected hex string or BigInt.");
}

/**
 * Generates a cryptographically secure random scalar suitable for use as a private key
 * on the Starknet elliptic curve.
 * The scalar is returned as a 0x-prefixed hex string.
 * @returns A random scalar as a 0x-prefixed hex string.
 */
export function generateRandomScalarStarknet(): string {
  const raw = randomBytes(32); // 32 bytes for a ~256-bit number
  // Modulo curve order to ensure it's a valid scalar for the Starknet curve
  const scalar = BigInt(`0x${bytesToHex(Uint8Array.from(raw))}`) % CURVE_ORDER;
  // Ensure it's not zero, though highly improbable
  if (scalar === 0n) {
    return generateRandomScalarStarknet(); // Recurse if zero, extremely unlikely
  }
  return num.toHex(scalar);
}

/**
 * Derives the public key from a private key on the Starknet elliptic curve.
 * @param privateKeyHex - The private key as a 0x-prefixed hex string.
 * @param compressed - (Optional) Whether to return the compressed public key. Defaults to false (uncompressed).
 * @returns The public key as a 0x-prefixed hex string.
 *          Uncompressed: "0x04" + x-coord + y-coord
 *          Compressed: "0x02" or "0x03" + x-coord
 */
export function getPublicKeyStarknet(privateKeyHex: string, compressed: boolean = false): string {
  const privateKeyBigInt = toBigIntPrivateKey(privateKeyHex);

  // A private key of 0 is invalid in most EC contexts as it maps to the point at infinity.
  // The underlying noble library expects 0 < privateKey < CURVE_ORDER.
  if (privateKeyBigInt === 0n) {
    return POINT_AT_INFINITY_HEX_UNCOMPRESSED; 
    // Note: A compressed point at infinity is not well-defined or typically used.
    // For consistency, we return the uncompressed version. If compressed is requested for 0,
    // this behavior might need further review based on specific use-case requirements for such an edge case.
  }

  const publicKeyBytes = STARKNET_CURVE.getPublicKey(num.toHex(privateKeyBigInt), compressed);
  return encode.addHexPrefix(encode.buf2hex(publicKeyBytes));
}

/**
 * Performs scalar multiplication (k * P) on the Starknet elliptic curve.
 * @param scalarHex - The scalar k as a 0x-prefixed hex string.
 * @param pointHex - The elliptic curve point P as a 0x-prefixed hex string (uncompressed or compressed).
 * @returns The resulting point (k * P) as an uncompressed 0x-prefixed hex string ("0x04" + x + y).
 * @throws Error if the point or scalar is invalid.
 */
export function scalarMultiplyStarknet(scalarHex: string, pointHex: string): string {
  const scalarBigInt = num.toBigInt(scalarHex);

  // Handle scalar being 0, CURVE_ORDER, or any multiple of CURVE_ORDER
  // k*P = O if k is a multiple of the curve order n (including 0)
  if (scalarBigInt % CURVE_ORDER === 0n) {
    return POINT_AT_INFINITY_HEX_UNCOMPRESSED;
  }

  // Avoid issues if pointHex is already the point at infinity, k*O = O
  if (pointHex.toLowerCase() === POINT_AT_INFINITY_HEX_UNCOMPRESSED.toLowerCase()) {
    return POINT_AT_INFINITY_HEX_UNCOMPRESSED;
  }

  const point = STARKNET_CURVE.ProjectivePoint.fromHex(encode.removeHexPrefix(pointHex));
  const resultPoint = point.multiply(scalarBigInt);

  if (resultPoint.equals(STARKNET_CURVE.ProjectivePoint.ZERO)) {
    return POINT_AT_INFINITY_HEX_UNCOMPRESSED;
  }
  return encode.addHexPrefix(encode.buf2hex(resultPoint.toRawBytes(false))); // false for uncompressed
}

/**
 * Adds two elliptic curve points (P1 + P2) on the Starknet elliptic curve.
 * @param point1Hex - The first point P1 as a 0x-prefixed hex string (uncompressed or compressed).
 * @param point2Hex - The second point P2 as a 0x-prefixed hex string (uncompressed or compressed).
 * @returns The resulting point (P1 + P2) as an uncompressed 0x-prefixed hex string ("0x04" + x + y).
 * @throws Error if points are invalid.
 */
export function addPointsStarknet(point1Hex: string, point2Hex: string): string {
  const p1HexLower = point1Hex.toLowerCase();
  const p2HexLower = point2Hex.toLowerCase();

  if (p1HexLower === POINT_AT_INFINITY_HEX_UNCOMPRESSED.toLowerCase()) {
    return point2Hex; // O + P2 = P2
  }
  if (p2HexLower === POINT_AT_INFINITY_HEX_UNCOMPRESSED.toLowerCase()) {
    return point1Hex; // P1 + O = P1
  }

  const point1 = STARKNET_CURVE.ProjectivePoint.fromHex(encode.removeHexPrefix(point1Hex));
  const point2 = STARKNET_CURVE.ProjectivePoint.fromHex(encode.removeHexPrefix(point2Hex));
  const resultPoint = point1.add(point2);

  if (resultPoint.equals(STARKNET_CURVE.ProjectivePoint.ZERO)) {
    return POINT_AT_INFINITY_HEX_UNCOMPRESSED;
  }
  return encode.addHexPrefix(encode.buf2hex(resultPoint.toRawBytes(false))); // false for uncompressed
}

/**
 * Retrieves the generator point (base point G) of the Starknet elliptic curve.
 * @param compressed - (Optional) Whether to return the compressed base point. Defaults to false (uncompressed).
 * @returns The base point G as a 0x-prefixed hex string.
 */
export function getBasePointStarknet(compressed: boolean = false): string {
  const G = STARKNET_CURVE.ProjectivePoint.BASE;
  return encode.addHexPrefix(encode.buf2hex(G.toRawBytes(compressed)));
} 