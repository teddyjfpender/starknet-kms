import {
  type Point,
  ProjectivePoint,
  type Scalar,
  addPoints,
  arePointsEqual,
  bigIntToHex,
  generateChallenge,
  hexToBigInt,
  hexToPoint,
  moduloOrder,
  pointToHex,
  randScalar,
  scalarMultiply,
} from "@starkms/crypto"
import * as ElGamal from "./elgamal"

// Card and masking interfaces
export interface Card {
  point: Point
}

export interface MaskedCard {
  c1: Point
  c2: Point
}

export interface MaskingProof {
  commitment: Point
  challenge: Scalar
  response: Scalar
}

/**
 * Mask a card using ElGamal encryption
 */
export function mask(
  elgamalParams: ElGamal.ElGamalParameters,
  publicKey: ElGamal.ElGamalPublicKey,
  card: Card,
  randomness?: Scalar,
): {
  maskedCard: MaskedCard
  proof: MaskingProof
} {
  const r = randomness || randScalar()

  // ElGamal encrypt the card
  const plaintext: ElGamal.ElGamalPlaintext = { point: card.point }
  const { ciphertext, proof: elgamalProof } = ElGamal.encrypt(
    elgamalParams,
    publicKey,
    plaintext,
    r,
  )

  const maskedCard: MaskedCard = {
    c1: ciphertext.c1,
    c2: ciphertext.c2,
  }

  // Convert ElGamal proof to masking proof format
  const proof: MaskingProof = {
    commitment: elgamalProof.commitment,
    challenge: elgamalProof.challenge,
    response: elgamalProof.response,
  }

  return { maskedCard, proof }
}

/**
 * Verify a card masking proof
 */
export function verifyMask(
  elgamalParams: ElGamal.ElGamalParameters,
  publicKey: ElGamal.ElGamalPublicKey,
  card: Card,
  maskedCard: MaskedCard,
  proof: MaskingProof,
): boolean {
  const plaintext: ElGamal.ElGamalPlaintext = { point: card.point }
  const ciphertext: ElGamal.ElGamalCiphertext = {
    c1: maskedCard.c1,
    c2: maskedCard.c2,
  }

  const elgamalProof: ElGamal.ChaumPedersenProof = {
    commitment: proof.commitment,
    challenge: proof.challenge,
    response: proof.response,
  }

  return ElGamal.verifyEncryption(
    elgamalParams,
    publicKey,
    plaintext,
    ciphertext,
    elgamalProof,
  )
}

/**
 * Remask an already masked card
 */
export function remask(
  elgamalParams: ElGamal.ElGamalParameters,
  publicKey: ElGamal.ElGamalPublicKey,
  maskedCard: MaskedCard,
  additionalRandomness?: Scalar,
): {
  remaskedCard: MaskedCard
  proof: MaskingProof
} {
  const r = additionalRandomness || randScalar()

  // For remasking, we directly create a new masking layer by adding fresh randomness
  // We create (g^r, h^r) which is an encryption of the identity element (0)
  // This is done by directly computing the ciphertext components

  const c1 = scalarMultiply(r, elgamalParams.generator) // g^r
  const c2 = scalarMultiply(r, publicKey.point) // h^r

  // This represents an encryption of zero: (g^r, h^r)
  const zeroEncryption: ElGamal.ElGamalCiphertext = { c1, c2 }

  // Add the zero encryption to the existing masked card (homomorphic property)
  const originalCiphertext: ElGamal.ElGamalCiphertext = {
    c1: maskedCard.c1,
    c2: maskedCard.c2,
  }

  const remaskedCiphertext = ElGamal.addCiphertexts(
    originalCiphertext,
    zeroEncryption,
  )

  const remaskedCard: MaskedCard = {
    c1: remaskedCiphertext.c1,
    c2: remaskedCiphertext.c2,
  }

  // For the proof, we need to show that the added encryption is of zero
  // We use the Chaum-Pedersen proof but need to avoid using point at infinity
  // Instead, we'll prove the discrete log relation directly

  const k = randScalar()
  const A = scalarMultiply(k, elgamalParams.generator) // g^k
  const B = scalarMultiply(k, publicKey.point) // h^k

  // Generate challenge
  const challenge = generateChallenge(
    elgamalParams.generator,
    publicKey.point,
    c1, // g^r
    c2, // h^r
    A, // g^k
    B, // h^k
  )

  // Response: z = k + c * r (mod curve_order)
  const cr = moduloOrder(challenge * r)
  const response = moduloOrder(k + cr)

  const proof: MaskingProof = {
    commitment: A,
    challenge,
    response,
  }

  return { remaskedCard, proof }
}

/**
 * Verify a remasking proof
 */
export function verifyRemask(
  elgamalParams: ElGamal.ElGamalParameters,
  publicKey: ElGamal.ElGamalPublicKey,
  originalMasked: MaskedCard,
  remaskedCard: MaskedCard,
  proof: MaskingProof,
): boolean {
  try {
    // The proof should verify that the difference between remasked and original
    // is created by the same randomness r for both g^r and h^r components
    const diffC1 = addPoints(remaskedCard.c1, originalMasked.c1.negate()) // g^r
    const diffC2 = addPoints(remaskedCard.c2, originalMasked.c2.negate()) // h^r

    // Verify: g^z = A + (diffC1)^c
    const gz = scalarMultiply(proof.response, elgamalParams.generator)
    const diffC1c = scalarMultiply(proof.challenge, diffC1)
    const left1 = addPoints(proof.commitment, diffC1c)

    if (!arePointsEqual(gz, left1)) {
      return false
    }

    // Verify: h^z = B + (diffC2)^c
    const hz = scalarMultiply(proof.response, publicKey.point)
    const diffC2c = scalarMultiply(proof.challenge, diffC2)

    // Recompute B from the proof verification equation
    const B = addPoints(hz, diffC2c.negate())

    // Recompute challenge to verify it matches
    const expectedChallenge = generateChallenge(
      elgamalParams.generator,
      publicKey.point,
      diffC1, // g^r
      diffC2, // h^r
      proof.commitment, // A = g^k
      B, // h^k
    )

    // Check challenge matches
    if (proof.challenge !== expectedChallenge) {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}

/**
 * Create a reveal token for a masked card
 */
export function createRevealToken(
  elgamalParams: ElGamal.ElGamalParameters,
  secretKey: ElGamal.ElGamalSecretKey,
  publicKey: ElGamal.ElGamalPublicKey,
  maskedCard: MaskedCard,
): {
  token: Point
  proof: MaskingProof
} {
  // The reveal token is the secret key multiplied by the first component of the ciphertext
  const token = scalarMultiply(secretKey.scalar, maskedCard.c1)

  // Generate proof that token = sk * c1 (discrete log equality proof)
  const k = randScalar()
  const commitment1 = scalarMultiply(k, elgamalParams.generator) // g^k
  const commitment2 = scalarMultiply(k, maskedCard.c1) // c1^k

  const challenge = generateChallenge(
    elgamalParams.generator,
    publicKey.point,
    maskedCard.c1,
    token,
    commitment1,
    commitment2,
  )

  const response = moduloOrder(k + moduloOrder(challenge * secretKey.scalar))

  const proof: MaskingProof = {
    commitment: commitment1, // We store the first commitment
    challenge,
    response,
  }

  return { token, proof }
}

/**
 * Unmask a card using reveal tokens
 */
export function unmask(
  _elgamalParams: ElGamal.ElGamalParameters,
  revealTokens: Point[],
  maskedCard: MaskedCard,
): Card {
  if (revealTokens.length === 0) {
    throw new Error("At least one reveal token is required")
  }

  // Aggregate all reveal tokens
  let aggregatedToken = revealTokens[0]!
  for (let i = 1; i < revealTokens.length; i++) {
    aggregatedToken = addPoints(aggregatedToken, revealTokens[i]!)
  }

  // Compute the original card: c2 - aggregated_token
  const card = addPoints(maskedCard.c2, aggregatedToken.negate())

  return { point: card }
}

/**
 * Convert card to hex string
 */
export function cardToHex(card: Card): string {
  return pointToHex(card.point)
}

/**
 * Convert hex string to card
 */
export function hexToCard(hex: string): Card {
  return { point: hexToPoint(hex) }
}

/**
 * Convert masked card to hex string
 */
export function maskedCardToHex(maskedCard: MaskedCard): string {
  return JSON.stringify({
    c1: pointToHex(maskedCard.c1),
    c2: pointToHex(maskedCard.c2),
  })
}

/**
 * Convert hex string to masked card
 */
export function hexToMaskedCard(hex: string): MaskedCard {
  const obj = JSON.parse(hex)
  return {
    c1: hexToPoint(obj.c1),
    c2: hexToPoint(obj.c2),
  }
}

/**
 * Generate a random card
 */
export function randomCard(): Card {
  return { point: ProjectivePoint.fromPrivateKey(randScalar()) }
}

/**
 * Check if two cards are equal
 */
export function cardsEqual(card1: Card, card2: Card): boolean {
  return arePointsEqual(card1.point, card2.point)
}

/**
 * Check if two masked cards are equal
 */
export function maskedCardsEqual(
  masked1: MaskedCard,
  masked2: MaskedCard,
): boolean {
  return (
    arePointsEqual(masked1.c1, masked2.c1) &&
    arePointsEqual(masked1.c2, masked2.c2)
  )
}

/**
 * Convert scalar to hex string
 */
export function scalarToHex(scalar: Scalar): string {
  return bigIntToHex(scalar)
}

/**
 * Convert hex string to scalar
 */
export function hexToScalar(hex: string): Scalar {
  return hexToBigInt(hex)
}
