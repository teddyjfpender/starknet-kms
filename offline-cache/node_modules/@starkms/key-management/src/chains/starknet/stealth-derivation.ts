import { randomBytes } from "node:crypto"
import { bytesToHex } from "@noble/curves/abstract/utils"
import { ec, encode, hash, num } from "starknet"

/**
 * Generate a fresh ephemeral private scalar using secure randomness.
 */
export function generateEphemeralScalar(): bigint {
  const raw = randomBytes(32) // 32 bytes
  // The curve's private keys must be in [1..curve_order-1]
  // but for simplicity, we interpret 32 random bytes as a BigInt
  // Then we mod it by curve order to get a valid scalar on StarkCurve
  const curveOrder = ec.starkCurve.CURVE.n
  return BigInt(`0x${bytesToHex(Uint8Array.from(raw))}`) % curveOrder
}

/**
 * Convert a private key (bigint or hex) to a public key on Starknet curve.
 */
export function starknetPublicKeyFromPrivateKey(privKeyHex: string): string {
  // ec.getPublicKey returns a Uint8Array. We'll encode it in hex
  const pubKeyBytes = ec.starkCurve.getPublicKey(privKeyHex, false)
  return encode.buf2hex(pubKeyBytes)
}

/**
 * Create a stealth address given the recipient's public spend/view keys (X, Y).
 *
 * @param recipientPubSpendKey The recipient's public spend key (hex, 0x‐prefixed).
 * @param recipientPubViewKey  The recipient's public view key (hex, 0x‐prefixed).
 * @returns An object containing:
 *   - ephemeralPrivateScalar  The sender's ephemeral private scalar `r` (for demonstration)
 *   - ephemeralPublicKey      R = r * G
 *   - stealthAddress          P = X + k*G where k = Hash(r * Y)
 */
export function createStealthOutput(
  recipientPubSpendKey: string,
  recipientPubViewKey: string,
) {
  // 1. Sender picks ephemeral r
  const r = generateEphemeralScalar()

  // 2. R = r * G
  const R = ec.starkCurve.getPublicKey(num.toHex(r), false)
  const Rhex = encode.buf2hex(R)

  // 3. k = Hash(r * Y)
  // Convert Y from hex to a point:
  const Ypoint = ec.starkCurve.ProjectivePoint.fromHex(
    recipientPubViewKey.replace(/^0x/, ""),
  )
  const rTimesY = Ypoint.multiply(r) // big point
  // We do a Starknet keccak, for instance:
  const kBigInt = hash.starknetKeccak(encode.buf2hex(rTimesY.toRawBytes(true)))

  // 4. k is a scalar, so we might take mod n:
  const kMod = BigInt(kBigInt) % ec.starkCurve.CURVE.n

  // 5. P = X + k*G
  //    But note: X is a point, so we do Xpoint + (k * G).
  const Xpoint = ec.starkCurve.ProjectivePoint.fromHex(
    recipientPubSpendKey.replace(/^0x/, ""),
  )
  const stealthPoint =
    ec.starkCurve.ProjectivePoint.BASE.multiply(kMod).add(Xpoint)
  const stealthHex = encode.buf2hex(stealthPoint.toRawBytes(false))

  return {
    ephemeralPrivateScalar: `0x${r.toString(16)}`,
    ephemeralPublicKey: encode.addHexPrefix(Rhex),
    stealthAddress: encode.addHexPrefix(stealthHex),
  }
}

/**
 * Check if a stealth output belongs to the recipient:
 * @param recipientPrivateViewKey y (hex)
 * @param recipientPublicSpendKey X (hex)
 * @param ephemeralPublicKey R (hex)
 * @param stealthAddress P (hex)
 *
 * Steps:
 *   k' = Hash(y * R)
 *   Check if P == X + k'*G
 */
export function checkStealthOwnership(
  recipientPrivateViewKey: string,
  recipientPublicSpendKey: string,
  ephemeralPublicKey: string,
  stealthAddress: string,
): boolean {
  // Convert ephemeral R to point:
  const Rpoint = ec.starkCurve.ProjectivePoint.fromHex(
    ephemeralPublicKey.replace(/^0x/, ""),
  )
  // y is the private view key:
  const yBN = BigInt(recipientPrivateViewKey)
  const yTimesR = Rpoint.multiply(yBN)

  // k' = starknetKeccak(yTimesR)
  const kPrimeBigInt = hash.starknetKeccak(
    encode.buf2hex(yTimesR.toRawBytes(true)),
  )
  const kPrime = BigInt(kPrimeBigInt) % ec.starkCurve.CURVE.n

  // Recompute P' = X + k'*G
  const Xpoint = ec.starkCurve.ProjectivePoint.fromHex(
    recipientPublicSpendKey.replace(/^0x/, ""),
  )
  const computedStealthPoint =
    ec.starkCurve.ProjectivePoint.BASE.multiply(kPrime).add(Xpoint)
  const computedStealthHex = encode.buf2hex(
    computedStealthPoint.toRawBytes(false),
  )

  // Compare with the provided stealthAddress
  // For safety, do a case-insensitive check or normalize to lowerCase
  return (
    stealthAddress.toLowerCase() === `0x${computedStealthHex}`.toLowerCase()
  )
}
