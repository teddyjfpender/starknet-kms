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

// Reveal interfaces
export interface ElGamalParameters {
  generator: Point
}

export interface ElGamalPublicKey {
  point: Point
}

export interface ElGamalSecretKey {
  scalar: Scalar
}

export interface MaskedCard {
  c1: Point // randomness component
  c2: Point // ciphertext component
}

export interface RevealToken {
  point: Point
}

export interface RevealProof {
  commitmentG: Point
  commitmentH: Point
  challenge: Scalar
  response: Scalar
}

/**
 * Core reveal operation following the Rust implementation.
 *
 * This implements the `Reveal` trait from the Rust code:
 * ```rust
 * fn reveal(
 *     &self,
 *     cipher: &el_gamal::Ciphertext<C>,
 * ) -> Result<el_gamal::Plaintext<C>, CardProtocolError> {
 *     let neg_one = -C::ScalarField::one();
 *     let negative_token = *self * neg_one;
 *     let decrypted = negative_token + el_gamal::Plaintext(cipher.1);
 *     Ok(decrypted)
 * }
 * ```
 *
 * The algorithm:
 * 1. Compute negative_token = -reveal_token
 * 2. Compute decrypted = negative_token + cipher.c2
 * 3. Return decrypted
 *
 * @param revealToken The reveal token (typically sk * c1)
 * @param maskedCard The masked card to reveal
 * @returns The revealed plaintext point
 */
export function reveal(
  revealToken: RevealToken,
  maskedCard: MaskedCard,
): Point {
  // Rust: let negative_token = *self * neg_one;
  const negativeToken = revealToken.point.negate()

  // Rust: let decrypted = negative_token + el_gamal::Plaintext(cipher.1);
  // cipher.1 is the second component (c2) of the ciphertext
  const decrypted = addPoints(negativeToken, maskedCard.c2)

  return decrypted
}

/**
 * Compute a reveal token for a given secret key and masked card.
 *
 * The reveal token is computed as: token = sk * c1
 * This allows the holder of the secret key to later reveal the plaintext.
 *
 * @param pp ElGamal parameters
 * @param secretKey Player's secret key
 * @param maskedCard The masked card
 * @returns The reveal token
 */
export function computeRevealToken(
  _pp: ElGamalParameters,
  secretKey: ElGamalSecretKey,
  maskedCard: MaskedCard,
): RevealToken {
  // token = sk * c1
  const tokenPoint = scalarMultiply(secretKey.scalar, maskedCard.c1)

  return { point: tokenPoint }
}

/**
 * Generate a Chaum-Pedersen proof for reveal token computation.
 *
 * This proves that the same secret key `sk` was used for both:
 * - pk = sk * G (public key)
 * - token = sk * c1 (reveal token)
 *
 * @param pp ElGamal parameters
 * @param secretKey Player's secret key
 * @param publicKey Player's public key
 * @param maskedCard The masked card
 * @param revealToken The computed reveal token
 * @param nonce Optional nonce for deterministic proof generation
 * @returns Chaum-Pedersen proof
 */
export function proveReveal(
  pp: ElGamalParameters,
  secretKey: ElGamalSecretKey,
  publicKey: ElGamalPublicKey,
  maskedCard: MaskedCard,
  revealToken: RevealToken,
  nonce?: Scalar,
): RevealProof {
  // Generate random nonce for the proof
  const k = nonce || randScalar()

  // Commitments: P = k*G, Q = k*c1
  const commitmentG = scalarMultiply(k, pp.generator)
  const commitmentH = scalarMultiply(k, maskedCard.c1)

  // Challenge: c = Hash(G, c1, pk, token, P, Q)
  const challenge = generateChallenge(
    pp.generator,
    maskedCard.c1,
    publicKey.point,
    revealToken.point,
    commitmentG,
    commitmentH,
  )

  // Response: z = (k + c * sk) mod curve_order
  const response = moduloOrder(k + moduloOrder(challenge * secretKey.scalar))

  return {
    commitmentG,
    commitmentH,
    challenge,
    response,
  }
}

/**
 * Verify a reveal proof.
 *
 * Verifies that the same secret key was used for both the public key and reveal token:
 * - z*G = P + c*pk
 * - z*c1 = Q + c*token
 *
 * @param pp ElGamal parameters
 * @param publicKey Player's public key
 * @param maskedCard The masked card
 * @param revealToken The reveal token
 * @param proof The reveal proof to verify
 * @returns true if proof is valid, false otherwise
 */
export function verifyReveal(
  pp: ElGamalParameters,
  publicKey: ElGamalPublicKey,
  maskedCard: MaskedCard,
  revealToken: RevealToken,
  proof: RevealProof,
): boolean {
  try {
    // Verify first equation: z*G = P + c*pk
    const lhs1 = scalarMultiply(proof.response, pp.generator)
    const rhs1 = addPoints(
      proof.commitmentG,
      scalarMultiply(proof.challenge, publicKey.point),
    )

    if (!arePointsEqual(lhs1, rhs1)) {
      return false
    }

    // Verify second equation: z*c1 = Q + c*token
    const lhs2 = scalarMultiply(proof.response, maskedCard.c1)
    const rhs2 = addPoints(
      proof.commitmentH,
      scalarMultiply(proof.challenge, revealToken.point),
    )

    if (!arePointsEqual(lhs2, rhs2)) {
      return false
    }

    // Recompute challenge to ensure proof consistency
    const expectedChallenge = generateChallenge(
      pp.generator,
      maskedCard.c1,
      publicKey.point,
      revealToken.point,
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
 * Combined reveal token computation with proof generation.
 *
 * This is a convenience function that computes a reveal token and generates
 * a proof in one operation.
 *
 * @param pp ElGamal parameters
 * @param secretKey Player's secret key
 * @param publicKey Player's public key
 * @param maskedCard The masked card
 * @param nonce Optional nonce for deterministic proof generation
 * @returns Reveal token and proof
 */
export function computeRevealTokenWithProof(
  pp: ElGamalParameters,
  secretKey: ElGamalSecretKey,
  publicKey: ElGamalPublicKey,
  maskedCard: MaskedCard,
  nonce?: Scalar,
): {
  revealToken: RevealToken
  proof: RevealProof
} {
  const revealToken = computeRevealToken(pp, secretKey, maskedCard)
  const proof = proveReveal(
    pp,
    secretKey,
    publicKey,
    maskedCard,
    revealToken,
    nonce,
  )

  return { revealToken, proof }
}

/**
 * Multi-party reveal operation.
 *
 * Combines multiple reveal tokens to recover the original plaintext.
 * This is used when multiple parties need to cooperate to reveal a card.
 *
 * @param revealTokens Array of reveal tokens from different parties
 * @param maskedCard The masked card to reveal
 * @returns The revealed plaintext point
 */
export function multiPartyReveal(
  revealTokens: RevealToken[],
  maskedCard: MaskedCard,
): Point {
  if (revealTokens.length === 0) {
    throw new Error("At least one reveal token is required")
  }

  // Aggregate all reveal tokens
  let aggregatedToken = revealTokens[0]!.point
  for (let i = 1; i < revealTokens.length; i++) {
    aggregatedToken = addPoints(aggregatedToken, revealTokens[i]!.point)
  }

  // Apply reveal algorithm with aggregated token
  const aggregatedRevealToken: RevealToken = { point: aggregatedToken }
  return reveal(aggregatedRevealToken, maskedCard)
}

// Utility functions for serialization and conversion

/**
 * Convert RevealToken to hex representation
 */
export function revealTokenToHex(revealToken: RevealToken): string {
  return pointToHex(revealToken.point)
}

/**
 * Convert hex representation to RevealToken
 */
export function hexToRevealToken(hex: string): RevealToken {
  return { point: hexToPoint(hex) }
}

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
 * Convert RevealProof to hex representation
 */
export function revealProofToHex(proof: RevealProof): string {
  return JSON.stringify({
    commitmentG: pointToHex(proof.commitmentG),
    commitmentH: pointToHex(proof.commitmentH),
    challenge: proof.challenge.toString(16),
    response: proof.response.toString(16),
  })
}

/**
 * Convert hex representation to RevealProof
 */
export function hexToRevealProof(hex: string): RevealProof {
  const obj = JSON.parse(hex)
  return {
    commitmentG: hexToPoint(obj.commitmentG),
    commitmentH: hexToPoint(obj.commitmentH),
    challenge: BigInt(`0x${obj.challenge}`),
    response: BigInt(`0x${obj.response}`),
  }
}

/**
 * Check if two RevealTokens are equal
 */
export function revealTokensEqual(
  token1: RevealToken,
  token2: RevealToken,
): boolean {
  return arePointsEqual(token1.point, token2.point)
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
 * Check if two RevealProofs are equal
 */
export function revealProofsEqual(
  proof1: RevealProof,
  proof2: RevealProof,
): boolean {
  return (
    arePointsEqual(proof1.commitmentG, proof2.commitmentG) &&
    arePointsEqual(proof1.commitmentH, proof2.commitmentH) &&
    proof1.challenge === proof2.challenge &&
    proof1.response === proof2.response
  )
}
