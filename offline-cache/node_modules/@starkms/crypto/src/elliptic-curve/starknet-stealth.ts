import { ec, encode, hash, num } from "starknet"
import {
  addPointsStarknet,
  generateRandomScalarStarknet,
  getPublicKeyStarknet,
  scalarMultiplyStarknet,
} from "./starknet-curve"

const STARKNET_CURVE = ec.starkCurve
const CURVE_ORDER = STARKNET_CURVE.CURVE.n

/**
 * Creates a stealth address for a recipient.
 *
 * @param recipientPubSpendKeyHex The recipient's public spend key (X) as a 0x-prefixed hex string.
 * @param recipientPubViewKeyHex The recipient's public view key (Y) as a 0x-prefixed hex string.
 * @returns An object containing:
 *   - ephemeralScalarHex: The sender's ephemeral private scalar (r) as a 0x-prefixed hex string.
 *   - ephemeralPublicKeyHex: The sender's ephemeral public key (R = r*G) as a 0x-prefixed hex string.
 *   - stealthAddressHex: The generated stealth address (P = X + H(r*Y)*G) as a 0x-prefixed hex string.
 */
export function createStealthAddressStarknet(
  recipientPubSpendKeyHex: string,
  recipientPubViewKeyHex: string,
) {
  // 1. Sender picks ephemeral scalar r
  const r_scalarHex = generateRandomScalarStarknet()

  // 2. Compute ephemeral public key R = r*G
  const R_publicKeyHex = getPublicKeyStarknet(r_scalarHex)

  // 3. Compute shared secret point S = r*Y
  //    (Y is recipientPubViewKeyHex)
  const S_sharedSecretPointHex = scalarMultiplyStarknet(
    r_scalarHex,
    recipientPubViewKeyHex,
  )

  // 4. Compute k = Hash(S_compressed)
  //    S_compressed is the compressed form of the shared secret point S
  const S_point = STARKNET_CURVE.ProjectivePoint.fromHex(
    encode.removeHexPrefix(S_sharedSecretPointHex),
  )
  const S_compressedBytes = S_point.toRawBytes(true) // true for compressed
  const k_hashInputHex = encode.buf2hex(S_compressedBytes)
  const k_hashedBigInt = num.toBigInt(hash.starknetKeccak(k_hashInputHex))
  const k_scalar = k_hashedBigInt % CURVE_ORDER
  const k_scalarHex = num.toHex(k_scalar)

  // 5. Compute P_stealth_intermediate = k*G
  const P_stealth_intermediateHex = getPublicKeyStarknet(k_scalarHex)

  // 6. Compute stealth address P = X + k*G
  //    (X is recipientPubSpendKeyHex)
  const P_stealthAddressHex = addPointsStarknet(
    recipientPubSpendKeyHex,
    P_stealth_intermediateHex,
  )

  return {
    ephemeralScalarHex: r_scalarHex,
    ephemeralPublicKeyHex: R_publicKeyHex,
    stealthAddressHex: P_stealthAddressHex,
  }
}

/**
 * Checks if a stealth address belongs to the recipient.
 *
 * @param recipientPrivateViewKeyHex The recipient's private view key (y) as a 0x-prefixed hex string.
 * @param recipientPubSpendKeyHex The recipient's public spend key (X) as a 0x-prefixed hex string.
 * @param ephemeralPublicKeyHex The sender's ephemeral public key (R) as a 0x-prefixed hex string.
 * @param stealthAddressHex The stealth address (P) to check, as a 0x-prefixed hex string.
 * @returns True if the recipient owns the stealth address, false otherwise.
 */
export function checkStealthAddressOwnershipStarknet(
  recipientPrivateViewKeyHex: string,
  recipientPubSpendKeyHex: string,
  ephemeralPublicKeyHex: string,
  stealthAddressHex: string,
): boolean {
  // 1. Compute shared secret S' = y*R
  //    (y is recipientPrivateViewKeyHex, R is ephemeralPublicKeyHex)
  const S_prime_sharedSecretPointHex = scalarMultiplyStarknet(
    recipientPrivateViewKeyHex,
    ephemeralPublicKeyHex,
  )

  // 2. Compute k' = Hash(S'_compressed)
  const S_prime_point = STARKNET_CURVE.ProjectivePoint.fromHex(
    encode.removeHexPrefix(S_prime_sharedSecretPointHex),
  )
  const S_prime_compressedBytes = S_prime_point.toRawBytes(true)
  const k_prime_hashInputHex = encode.buf2hex(S_prime_compressedBytes)
  const k_prime_hashedBigInt = num.toBigInt(
    hash.starknetKeccak(k_prime_hashInputHex),
  )
  const k_prime_scalar = k_prime_hashedBigInt % CURVE_ORDER
  const k_prime_scalarHex = num.toHex(k_prime_scalar)

  // 3. Compute P'_candidate_intermediate = k'*G
  const P_prime_candidate_intermediateHex =
    getPublicKeyStarknet(k_prime_scalarHex)

  // 4. Compute candidate P' = X + k'*G
  //    (X is recipientPubSpendKeyHex)
  const P_prime_candidateHex = addPointsStarknet(
    recipientPubSpendKeyHex,
    P_prime_candidate_intermediateHex,
  )

  // 5. Compare P' with the provided stealthAddressHex
  return P_prime_candidateHex.toLowerCase() === stealthAddressHex.toLowerCase()
}

/**
 * Derives the private key for a given stealth address.
 *
 * @param recipientPrivateSpendKeyHex The recipient's private spend key (x) as a 0x-prefixed hex string.
 * @param recipientPrivateViewKeyHex The recipient's private view key (y) as a 0x-prefixed hex string.
 * @param ephemeralPublicKeyHex The sender's ephemeral public key (R) as a 0x-prefixed hex string.
 * @returns The derived stealth private key (p_stealth = x + H(y*R)) as a 0x-prefixed hex string.
 */
export function deriveStealthPrivateKeyStarknet(
  recipientPrivateSpendKeyHex: string,
  recipientPrivateViewKeyHex: string,
  ephemeralPublicKeyHex: string,
): string {
  // 1. Compute shared secret S' = y*R (same as in ownership check)
  const S_prime_sharedSecretPointHex = scalarMultiplyStarknet(
    recipientPrivateViewKeyHex,
    ephemeralPublicKeyHex,
  )

  // 2. Compute k' = Hash(S'_compressed) (same as in ownership check)
  const S_prime_point = STARKNET_CURVE.ProjectivePoint.fromHex(
    encode.removeHexPrefix(S_prime_sharedSecretPointHex),
  )
  const S_prime_compressedBytes = S_prime_point.toRawBytes(true)
  const k_prime_hashInputHex = encode.buf2hex(S_prime_compressedBytes)
  const k_prime_hashedBigInt = num.toBigInt(
    hash.starknetKeccak(k_prime_hashInputHex),
  )
  const k_prime_scalar = k_prime_hashedBigInt % CURVE_ORDER

  // 3. Retrieve recipient's private spend key x
  const x_recipientPrivateSpendScalar = num.toBigInt(
    recipientPrivateSpendKeyHex,
  )

  // 4. Compute stealth private key p_stealth = (x + k') mod n
  const p_stealth_scalar =
    (x_recipientPrivateSpendScalar + k_prime_scalar) % CURVE_ORDER

  // Ensure the result is not 0, which is not a valid private key.
  // If (x + k') is a multiple of CURVE_ORDER, it effectively becomes 0.
  // While extremely rare for distinct x and k', it's a theoretical possibility.
  // A private key of 0 would lead to a public key of point at infinity.
  if (p_stealth_scalar === 0n) {
    // This case is highly unlikely but indicates an issue if it occurs.
    // Depending on context, could throw or return a specific value indicating an invalid derived key.
    // For now, we let it be, as getPublicKeyStarknet(0x0) would yield point at infinity.
    // Standard practice is that private keys should not be 0.
    // However, the math x+k could yield 0 mod n.
    // Let's assume the consumer of this private key handles 0 if it's an issue for them.
  }

  return num.toHex(p_stealth_scalar)
}
