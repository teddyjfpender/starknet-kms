import {
  type Point,
  type Scalar,
  addPoints,
  arePointsEqual,
  generateChallenge,
  hexToPoint,
  moduloOrder,
  pointToHex,
  randScalar,
  scalarMultiply,
} from "@starkms/crypto"

// Remasking interfaces
export interface ElGamalParameters {
  generator: Point
}

export interface ElGamalPublicKey {
  point: Point
}

export interface MaskedCard {
  c1: Point // randomness component
  c2: Point // ciphertext component
}

export interface RemaskingProof {
  commitmentG: Point
  commitmentH: Point
  challenge: Scalar
  response: Scalar
}

/**
 * Core remasking operation following the Rust implementation.
 *
 * This implements the `Remask` trait from the Rust code:
 * ```rust
 * fn remask(
 *     &self,
 *     pp: &el_gamal::Parameters<C>,
 *     shared_key: &el_gamal::PublicKey<C>,
 *     alpha: &C::ScalarField,
 * ) -> Result<el_gamal::Ciphertext<C>, CardProtocolError>
 * ```
 *
 * The algorithm:
 * 1. Create an encryption of zero: (alpha*G, alpha*shared_key)
 * 2. Add this homomorphically to the existing masked card
 *
 * @param pp ElGamal parameters containing the generator
 * @param sharedKey The aggregate public key
 * @param originalMasked The original masked card to remask
 * @param alpha The remasking scalar factor
 * @returns The remasked card
 */
export function remask(
  pp: ElGamalParameters,
  sharedKey: ElGamalPublicKey,
  originalMasked: MaskedCard,
  alpha: Scalar,
): MaskedCard {
  // Create encryption of zero (plaintext = 0): (alpha*G, alpha*shared_key)
  const zeroEncC1 = scalarMultiply(alpha, pp.generator)
  const zeroEncC2 = scalarMultiply(alpha, sharedKey.point)

  // Homomorphic addition: original + zero_encryption
  const remaskedC1 = addPoints(originalMasked.c1, zeroEncC1)
  const remaskedC2 = addPoints(originalMasked.c2, zeroEncC2)

  return {
    c1: remaskedC1,
    c2: remaskedC2,
  }
}

/**
 * Generate a Chaum-Pedersen proof for remasking operation.
 *
 * This proves that the same scalar `alpha` was used for both:
 * - diffC1 = alpha * G
 * - diffC2 = alpha * shared_key
 *
 * Where diffC1 and diffC2 are the differences between remasked and original cards.
 *
 * @param pp ElGamal parameters
 * @param sharedKey The aggregate public key
 * @param originalMasked Original masked card
 * @param remaskedCard Remasked card
 * @param alpha The remasking factor used
 * @param nonce Optional nonce for deterministic proof generation
 * @returns Chaum-Pedersen proof
 */
export function proveRemasking(
  pp: ElGamalParameters,
  sharedKey: ElGamalPublicKey,
  originalMasked: MaskedCard,
  remaskedCard: MaskedCard,
  alpha: Scalar,
  nonce?: Scalar,
): RemaskingProof {
  // Calculate the differences (what was added during remasking)
  const diffC1 = addPoints(remaskedCard.c1, originalMasked.c1.negate()) // alpha*G
  const diffC2 = addPoints(remaskedCard.c2, originalMasked.c2.negate()) // alpha*shared_key

  // Generate random nonce for the proof
  const k = nonce || randScalar()

  // Commitments: P = k*G, Q = k*shared_key
  const commitmentG = scalarMultiply(k, pp.generator)
  const commitmentH = scalarMultiply(k, sharedKey.point)

  // Challenge: c = Hash(G, shared_key, diffC1, diffC2, P, Q)
  const challenge = generateChallenge(
    pp.generator,
    sharedKey.point,
    diffC1,
    diffC2,
    commitmentG,
    commitmentH,
  )

  // Response: z = (k + c * alpha) mod curve_order
  const response = moduloOrder(k + moduloOrder(challenge * alpha))

  return {
    commitmentG,
    commitmentH,
    challenge,
    response,
  }
}

/**
 * Verify a remasking proof.
 *
 * Verifies that the same scalar was used for both difference components:
 * - z*G = P + c*diffC1
 * - z*shared_key = Q + c*diffC2
 *
 * @param pp ElGamal parameters
 * @param sharedKey The aggregate public key
 * @param originalMasked Original masked card
 * @param remaskedCard Remasked card
 * @param proof The remasking proof to verify
 * @returns true if proof is valid, false otherwise
 */
export function verifyRemasking(
  pp: ElGamalParameters,
  sharedKey: ElGamalPublicKey,
  originalMasked: MaskedCard,
  remaskedCard: MaskedCard,
  proof: RemaskingProof,
): boolean {
  try {
    // Calculate the differences (what was added during remasking)
    const diffC1 = addPoints(remaskedCard.c1, originalMasked.c1.negate())
    const diffC2 = addPoints(remaskedCard.c2, originalMasked.c2.negate())

    // Verify first equation: z*G = P + c*diffC1
    const lhs1 = scalarMultiply(proof.response, pp.generator)
    const rhs1 = addPoints(
      proof.commitmentG,
      scalarMultiply(proof.challenge, diffC1),
    )

    if (!arePointsEqual(lhs1, rhs1)) {
      return false
    }

    // Verify second equation: z*shared_key = Q + c*diffC2
    const lhs2 = scalarMultiply(proof.response, sharedKey.point)
    const rhs2 = addPoints(
      proof.commitmentH,
      scalarMultiply(proof.challenge, diffC2),
    )

    if (!arePointsEqual(lhs2, rhs2)) {
      return false
    }

    // Recompute challenge to ensure proof consistency
    const expectedChallenge = generateChallenge(
      pp.generator,
      sharedKey.point,
      diffC1,
      diffC2,
      proof.commitmentG,
      proof.commitmentH,
    )

    // Verify challenge matches
    return proof.challenge === expectedChallenge
  } catch (error) {
    return false
  }
}

/**
 * Combined remasking operation with proof generation.
 *
 * This is a convenience function that performs remasking and generates
 * a proof in one operation.
 *
 * @param pp ElGamal parameters
 * @param sharedKey The aggregate public key
 * @param originalMasked Original masked card
 * @param alpha The remasking scalar factor
 * @param nonce Optional nonce for deterministic proof generation
 * @returns Remasked card and proof
 */
export function remaskWithProof(
  pp: ElGamalParameters,
  sharedKey: ElGamalPublicKey,
  originalMasked: MaskedCard,
  alpha: Scalar,
  nonce?: Scalar,
): {
  remaskedCard: MaskedCard
  proof: RemaskingProof
} {
  const remaskedCard = remask(pp, sharedKey, originalMasked, alpha)
  const proof = proveRemasking(
    pp,
    sharedKey,
    originalMasked,
    remaskedCard,
    alpha,
    nonce,
  )

  return { remaskedCard, proof }
}

// Utility functions for serialization and conversion

/**
 * Convert MaskedCard to hex representation
 */
export function maskedCardToHex(maskedCard: MaskedCard): string {
  return JSON.stringify({
    c1: pointToHex(maskedCard.c1),
    c2: pointToHex(maskedCard.c2),
  })
}

/**
 * Convert hex representation to MaskedCard
 */
export function hexToMaskedCard(hex: string): MaskedCard {
  const obj = JSON.parse(hex)
  return {
    c1: hexToPoint(obj.c1),
    c2: hexToPoint(obj.c2),
  }
}

/**
 * Convert RemaskingProof to hex representation
 */
export function remaskingProofToHex(proof: RemaskingProof): string {
  return JSON.stringify({
    commitmentG: pointToHex(proof.commitmentG),
    commitmentH: pointToHex(proof.commitmentH),
    challenge: proof.challenge.toString(16),
    response: proof.response.toString(16),
  })
}

/**
 * Convert hex representation to RemaskingProof
 */
export function hexToRemaskingProof(hex: string): RemaskingProof {
  const obj = JSON.parse(hex)
  return {
    commitmentG: hexToPoint(obj.commitmentG),
    commitmentH: hexToPoint(obj.commitmentH),
    challenge: BigInt(`0x${obj.challenge}`),
    response: BigInt(`0x${obj.response}`),
  }
}

/**
 * Check if two MaskedCards are equal
 */
export function maskedCardsEqual(
  card1: MaskedCard,
  card2: MaskedCard,
): boolean {
  return (
    arePointsEqual(card1.c1, card2.c1) && arePointsEqual(card1.c2, card2.c2)
  )
}

/**
 * Check if two RemaskingProofs are equal
 */
export function remaskingProofsEqual(
  proof1: RemaskingProof,
  proof2: RemaskingProof,
): boolean {
  return (
    arePointsEqual(proof1.commitmentG, proof2.commitmentG) &&
    arePointsEqual(proof1.commitmentH, proof2.commitmentH) &&
    proof1.challenge === proof2.challenge &&
    proof1.response === proof2.response
  )
}
