import { ec, encode, hash, num } from "starknet"
import {
  addPointsStarknet,
  generateRandomScalarStarknet,
  getPublicKeyStarknet,
  scalarMultiplyStarknet,
} from "../starknet"

const STARKNET_CURVE = ec.starkCurve
const CURVE_ORDER = STARKNET_CURVE.CURVE.n

// Domain separation tag for hashing the shared secret point to derive k or k'
const DOMAIN_TAG_K_STRING = "starknet_stealth_k_v1"
const DOMAIN_TAG_K_HEX = encode.buf2hex(encode.utf8ToArray(DOMAIN_TAG_K_STRING)) // Pre-calculated hex of domain tag

/**
 * Creates a Starknet stealth address for a recipient.
 *
 * This process involves the sender generating an ephemeral key pair (`r`, `R`)
 * and using the recipient's public view key (`Y`) and public spend key (`X`)
 * to compute the stealth address `P = X + H_s(rY)G`.
 * `H_s` is a hash function (starknetKeccak with domain separation).
 * `G` is the STARK curve generator point.
 *
 * @param recipientPubSpendKeyHex The recipient's public spend key (`X`) as a 0x-prefixed hex string.
 *                                This key is part of the final stealth address.
 * @param recipientPubViewKeyHex The recipient's public view key (`Y`) as a 0x-prefixed hex string.
 *                               This key is used by the sender to generate the shared secret.
 * @returns An object containing:
 *   - `ephemeralScalarHex`: The sender's ephemeral private scalar (`r`) as a 0x-prefixed hex string.
 *                           This MUST be kept secret by the sender if they need to reconstruct `k` later,
 *                           but is typically discarded after `R` is computed.
 *   - `ephemeralPublicKeyHex`: The sender's ephemeral public key (`R = rG`) as a 0x-prefixed hex string.
 *                              This is transmitted publicly (e.g., on-chain) alongside the stealth address.
 *   - `stealthAddressHex`: The generated stealth address (`P = X + kG`) as a 0x-prefixed hex string.
 *                          `k = H_s("starknet_stealth_k_v1" || rY_compressed)`.
 * @throws Error if any underlying cryptographic operation fails.
 */
export function createStealthAddressStarknet(
  recipientPubSpendKeyHex: string,
  recipientPubViewKeyHex: string,
): {
  ephemeralScalarHex: string
  ephemeralPublicKeyHex: string
  stealthAddressHex: string
} {
  // 1. Sender picks an ephemeral scalar r.
  const r_scalarHex = generateRandomScalarStarknet()

  // 2. Compute ephemeral public key R = r*G.
  const R_publicKeyHex = getPublicKeyStarknet(r_scalarHex)

  // 3. Compute shared secret point S = r*Y (where Y is recipient's public view key).
  const S_sharedSecretPointHex = scalarMultiplyStarknet(
    r_scalarHex,
    recipientPubViewKeyHex,
  )

  // 4. Compute scalar k = H_s("starknet_stealth_k_v1" || S_compressed).
  //    S_compressed is the compressed form of the shared secret point S.
  const S_point = STARKNET_CURVE.ProjectivePoint.fromHex(
    encode.removeHexPrefix(S_sharedSecretPointHex),
  )
  const S_compressedBytes = S_point.toRawBytes(true) // true for compressed
  const pointHex = encode.buf2hex(S_compressedBytes) // Hex of compressed point, no "0x"

  // Concatenate domain tag hex with point hex, then add "0x" for Keccak input.
  const k_hashInputConcatenatedHex = DOMAIN_TAG_K_HEX + pointHex
  const k_hashedBigInt = num.toBigInt(
    hash.starknetKeccak(encode.addHexPrefix(k_hashInputConcatenatedHex)),
  )
  const k_scalar = k_hashedBigInt % CURVE_ORDER
  const k_scalarHex = num.toHex(k_scalar)

  // 5. Compute P_stealth_intermediate = k*G.
  const P_stealth_intermediateHex = getPublicKeyStarknet(k_scalarHex)

  // 6. Compute final stealth address P = X + k*G (where X is recipient's public spend key).
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
 * Checks if a given Starknet stealth address belongs to the recipient.
 *
 * The recipient uses their private view key (`y`) and public spend key (`X`),
 * along with the sender's ephemeral public key (`R`), to reconstruct the
 * candidate stealth address `P' = X + H_s(yR)G`.
 * If `P'` matches the provided `stealthAddressHex`, the recipient owns it.
 *
 * @param recipientPrivateViewKeyHex The recipient's private view key (`y`) as a 0x-prefixed hex string.
 * @param recipientPubSpendKeyHex The recipient's public spend key (`X`) as a 0x-prefixed hex string.
 * @param ephemeralPublicKeyHex The sender's ephemeral public key (`R`) as a 0x-prefixed hex string,
 *                              retrieved publicly (e.g., from the transaction).
 * @param stealthAddressHex The stealth address (`P`) to check, as a 0x-prefixed hex string.
 * @returns `true` if the recipient owns the stealth address, `false` otherwise.
 * @throws Error if any underlying cryptographic operation fails.
 */
export function checkStealthAddressOwnershipStarknet(
  recipientPrivateViewKeyHex: string,
  recipientPubSpendKeyHex: string,
  ephemeralPublicKeyHex: string,
  stealthAddressHex: string,
): boolean {
  // 1. Compute shared secret S' = y*R (where y is recipient's private view key, R is sender's ephemeral public key).
  const S_prime_sharedSecretPointHex = scalarMultiplyStarknet(
    recipientPrivateViewKeyHex,
    ephemeralPublicKeyHex,
  )

  // 2. Compute scalar k' = H_s("starknet_stealth_k_v1" || S'_compressed).
  const S_prime_point = STARKNET_CURVE.ProjectivePoint.fromHex(
    encode.removeHexPrefix(S_prime_sharedSecretPointHex),
  )
  const S_prime_compressedBytes = S_prime_point.toRawBytes(true)
  const pointPrimeHex = encode.buf2hex(S_prime_compressedBytes) // Hex of compressed point, no "0x"

  // Concatenate domain tag hex with point hex, then add "0x" for Keccak input.
  const k_prime_hashInputConcatenatedHex = DOMAIN_TAG_K_HEX + pointPrimeHex
  const k_prime_hashedBigInt = num.toBigInt(
    hash.starknetKeccak(encode.addHexPrefix(k_prime_hashInputConcatenatedHex)),
  )
  const k_prime_scalar = k_prime_hashedBigInt % CURVE_ORDER
  const k_prime_scalarHex = num.toHex(k_prime_scalar)

  // 3. Compute P'_candidate_intermediate = k'*G.
  const P_prime_candidate_intermediateHex =
    getPublicKeyStarknet(k_prime_scalarHex)

  // 4. Compute candidate stealth address P' = X + k'*G (where X is recipient's public spend key).
  const P_prime_candidateHex = addPointsStarknet(
    recipientPubSpendKeyHex,
    P_prime_candidate_intermediateHex,
  )

  // 5. Compare candidate P' (hex) with the provided stealthAddressHex (hex), case-insensitively.
  return P_prime_candidateHex.toLowerCase() === stealthAddressHex.toLowerCase()
}

/**
 * Derives the private key corresponding to a Starknet stealth address.
 *
 * The recipient uses their private spend key (`x`) and the scalar `k'`
 * (derived from their private view key `y` and the sender's ephemeral public key `R`
 * as `k' = H_s(yR_compressed)`) to compute the stealth private key:
 * `p_stealth = (x + k') mod n`, where `n` is the curve order.
 *
 * @param recipientPrivateSpendKeyHex The recipient's private spend key (`x`) as a 0x-prefixed hex string.
 * @param recipientPrivateViewKeyHex The recipient's private view key (`y`) as a 0x-prefixed hex string.
 * @param ephemeralPublicKeyHex The sender's ephemeral public key (`R`) as a 0x-prefixed hex string.
 * @returns The derived stealth private key (`p_stealth`) as a 0x-prefixed hex string.
 * @throws Error if the derived stealth private key is zero, which is an invalid private key.
 * @throws Error if any underlying cryptographic operation fails.
 */
export function deriveStealthPrivateKeyStarknet(
  recipientPrivateSpendKeyHex: string,
  recipientPrivateViewKeyHex: string,
  ephemeralPublicKeyHex: string,
): string {
  // 1. Compute shared secret S' = y*R (same as in ownership check).
  const S_prime_sharedSecretPointHex = scalarMultiplyStarknet(
    recipientPrivateViewKeyHex,
    ephemeralPublicKeyHex,
  )

  // 2. Compute scalar k' = H_s("starknet_stealth_k_v1" || S'_compressed) (same as in ownership check).
  const S_prime_point = STARKNET_CURVE.ProjectivePoint.fromHex(
    encode.removeHexPrefix(S_prime_sharedSecretPointHex),
  )
  const S_prime_compressedBytes = S_prime_point.toRawBytes(true)
  const pointPrimeHex = encode.buf2hex(S_prime_compressedBytes) // Hex of compressed point, no "0x"

  // Concatenate domain tag hex with point hex, then add "0x" for Keccak input.
  const k_prime_hashInputConcatenatedHex = DOMAIN_TAG_K_HEX + pointPrimeHex
  const k_prime_hashedBigInt = num.toBigInt(
    hash.starknetKeccak(encode.addHexPrefix(k_prime_hashInputConcatenatedHex)),
  )
  const k_prime_scalar = k_prime_hashedBigInt % CURVE_ORDER

  // 3. Retrieve recipient's private spend key x as a scalar.
  const x_recipientPrivateSpendScalar = num.toBigInt(
    recipientPrivateSpendKeyHex, // Assumes 0x-prefixed hex
  )

  // 4. Compute stealth private key p_stealth = (x + k') mod n.
  const p_stealth_scalar =
    (x_recipientPrivateSpendScalar + k_prime_scalar) % CURVE_ORDER

  // 5. Validate that the derived private key is not zero.
  // A private key of 0 is invalid as it leads to a known public key (point at infinity).
  if (p_stealth_scalar === 0n) {
    throw new Error(
      "Derived stealth private key is zero, which is invalid. This would lead to a known public key (point at infinity).",
    )
  }

  return num.toHex(p_stealth_scalar)
}
