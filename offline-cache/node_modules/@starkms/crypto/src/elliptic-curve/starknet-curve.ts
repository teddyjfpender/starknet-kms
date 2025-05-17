import {
  G as CORE_G,
  POINT_AT_INFINITY as CORE_POINT_AT_INFINITY,
  addPoints as coreAddPoints,
  bigIntToHex as coreBigIntToHex,
  getPublicKey as coreGetPublicKey,
  hexToBigInt as coreHexToBigInt,
  hexToPoint as coreHexToPoint,
  pointToHex as corePointToHex,
  // Scalar as CoreScalar,
  // Point as CorePoint,
  randScalar as coreRandScalar,
  scalarMultiply as coreScalarMultiply,
} from "./core/curve"

// This constant was defined in the original starknet-curve.ts
// It can now be derived from the core POINT_AT_INFINITY and pointToHex utility
export const POINT_AT_INFINITY_HEX_UNCOMPRESSED = corePointToHex(
  CORE_POINT_AT_INFINITY,
  false,
)

/**
 * Generates a cryptographically secure random scalar suitable for use as a private key
 * on the Starknet elliptic curve.
 * The scalar is returned as a 0x-prefixed hex string.
 */
export function generateRandomScalarStarknet(): string {
  return coreBigIntToHex(coreRandScalar())
}

/**
 * Derives the public key from a private key on the Starknet elliptic curve.
 * @param privateKeyHex - The private key as a 0x-prefixed hex string.
 * @param compressed - (Optional) Whether to return the compressed public key. Defaults to false (uncompressed).
 * @returns The public key as a 0x-prefixed hex string.
 */
export function getPublicKeyStarknet(
  privateKeyHex: string,
  compressed = false,
): string {
  const privateKeyScalar = coreHexToBigInt(privateKeyHex)
  const publicKeyPoint = coreGetPublicKey(privateKeyScalar)
  return corePointToHex(publicKeyPoint, compressed)
}

/**
 * Performs scalar multiplication (k * P) on the Starknet elliptic curve.
 * @param scalarHex - The scalar k as a 0x-prefixed hex string.
 * @param pointHex - The elliptic curve point P as a 0x-prefixed hex string (uncompressed or compressed).
 * @returns The resulting point (k * P) as an uncompressed 0x-prefixed hex string ("0x04" + x + y).
 */
export function scalarMultiplyStarknet(
  scalarHex: string,
  pointHex: string,
): string {
  const scalar = coreHexToBigInt(scalarHex)
  const point = coreHexToPoint(pointHex)
  const resultPoint = coreScalarMultiply(scalar, point)
  return corePointToHex(resultPoint, false) // Default to uncompressed output as per original function
}

/**
 * Adds two elliptic curve points (P1 + P2) on the Starknet elliptic curve.
 * @param point1Hex - The first point P1 as a 0x-prefixed hex string (uncompressed or compressed).
 * @param point2Hex - The second point P2 as a 0x-prefixed hex string (uncompressed or compressed).
 * @returns The resulting point (P1 + P2) as an uncompressed 0x-prefixed hex string ("0x04" + x + y).
 */
export function addPointsStarknet(
  point1Hex: string,
  point2Hex: string,
): string {
  const point1 = coreHexToPoint(point1Hex)
  const point2 = coreHexToPoint(point2Hex)
  const resultPoint = coreAddPoints(point1, point2)
  return corePointToHex(resultPoint, false) // Default to uncompressed output
}

/**
 * Retrieves the generator point (base point G) of the Starknet elliptic curve.
 * @param compressed - (Optional) Whether to return the compressed base point. Defaults to false (uncompressed).
 * @returns The base point G as a 0x-prefixed hex string.
 */
export function getBasePointStarknet(compressed = false): string {
  return corePointToHex(CORE_G, compressed)
}
