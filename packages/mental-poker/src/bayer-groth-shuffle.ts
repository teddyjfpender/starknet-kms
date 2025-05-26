import {
  CURVE_ORDER,
  type Point,
  type Scalar,
  addPoints,
  moduloOrder,
  poseidonHashScalars,
  randScalar,
  scalarMultiply,
} from "@starkms/crypto"
import {
  type PedersenCommitKey,
} from "./pedersen-commitment"
import {
  createPermutationPolynomial,
  evaluatePolynomial,
} from "./polynomial"
import {
  type MaskedCard,
  MentalPokerError,
  MentalPokerErrorCode,
  type Parameters,
  type Permutation,
  type ZKProofShuffle,
} from "./types"

/**
 * Bayer-Groth shuffle proof parameters
 */
export interface ShuffleParameters {
  readonly elgamalGenerator: Point
  readonly sharedKey: Point
  readonly pedersenKey: PedersenCommitKey
  readonly deckSize: number
  readonly playerCount: number
}

/**
 * Bayer-Groth shuffle statement
 */
export interface ShuffleStatement {
  readonly originalDeck: readonly MaskedCard[]
  readonly shuffledDeck: readonly MaskedCard[]
}

/**
 * Bayer-Groth shuffle witness (private information)
 */
export interface ShuffleWitness {
  readonly permutation: Permutation
  readonly maskingFactors: readonly Scalar[]
}

/**
 * Generate a Bayer-Groth shuffle proof
 */
export function proveBayerGrothShuffle(
  parameters: ShuffleParameters,
  statement: ShuffleStatement,
  witness: ShuffleWitness,
): ZKProofShuffle {
  const n = statement.originalDeck.length

  if (witness.permutation.size !== n || witness.maskingFactors.length !== n) {
    throw new MentalPokerError(
      "Witness dimensions do not match statement",
      MentalPokerErrorCode.INVALID_PARAMETERS,
    )
  }

  // Step 1: Create permutation polynomial
  const permutationPoly = createPermutationPolynomial(
    witness.permutation.mapping,
  )

  // Step 2: Commit to permutation polynomial coefficients using simple Pedersen commitments
  const polyRandomness = Array.from(
    { length: permutationPoly.coefficients.length },
    () => randScalar(),
  )
  const polyCommitments: Point[] = []

  for (let i = 0; i < permutationPoly.coefficients.length; i++) {
    // Simple Pedersen commitment: C = coeff * G + randomness * H
    const coeffCommitment = scalarMultiply(
      permutationPoly.coefficients[i]!,
      parameters.elgamalGenerator,
    )
    const randomnessCommitment = scalarMultiply(
      polyRandomness[i]!,
      parameters.pedersenKey.h,
    )
    const commitment = addPoints(coeffCommitment, randomnessCommitment)
    polyCommitments.push(commitment)
  }

  // Step 3: Commit to masking factors using simple Pedersen commitments
  const maskingRandomness = Array.from({ length: n }, () => randScalar())
  const maskingCommitments: Point[] = []

  for (let i = 0; i < n; i++) {
    // Simple Pedersen commitment: C = factor * G + randomness * H
    const factorCommitment = scalarMultiply(
      witness.maskingFactors[i]!,
      parameters.elgamalGenerator,
    )
    const randomnessCommitment = scalarMultiply(
      maskingRandomness[i]!,
      parameters.pedersenKey.h,
    )
    const commitment = addPoints(factorCommitment, randomnessCommitment)
    maskingCommitments.push(commitment)
  }

  // Step 4: Generate challenge using Fiat-Shamir
  const challengeInputs: Scalar[] = []

  // Add original deck to challenge
  for (const card of statement.originalDeck) {
    challengeInputs.push(card.randomness.x ?? 0n, card.randomness.y ?? 0n)
    challengeInputs.push(card.ciphertext.x ?? 0n, card.ciphertext.y ?? 0n)
  }

  // Add shuffled deck to challenge
  for (const card of statement.shuffledDeck) {
    challengeInputs.push(card.randomness.x ?? 0n, card.randomness.y ?? 0n)
    challengeInputs.push(card.ciphertext.x ?? 0n, card.ciphertext.y ?? 0n)
  }

  // Add commitments to challenge
  for (const commitment of polyCommitments) {
    challengeInputs.push(commitment.x ?? 0n, commitment.y ?? 0n)
  }
  for (const commitment of maskingCommitments) {
    challengeInputs.push(commitment.x ?? 0n, commitment.y ?? 0n)
  }

  const challenge = poseidonHashScalars(challengeInputs)

  // Step 5: Generate polynomial evaluations at challenge point
  const polynomialEvaluations: Scalar[] = []
  polynomialEvaluations.push(evaluatePolynomial(permutationPoly, challenge))

  // Step 6: Generate responses
  const responses: Scalar[] = []

  // Responses for polynomial coefficients
  for (let i = 0; i < permutationPoly.coefficients.length; i++) {
    const response = moduloOrder(
      polyRandomness[i]! + challenge * permutationPoly.coefficients[i]!,
    )
    responses.push(response)
  }

  // Responses for masking factors
  for (let i = 0; i < n; i++) {
    const response = moduloOrder(
      maskingRandomness[i]! + challenge * witness.maskingFactors[i]!,
    )
    responses.push(response)
  }

  // Step 7: Generate opening proofs for commitments
  const openingProofs: Array<{
    readonly commitment: Point
    readonly opening: Scalar
    readonly randomness: Scalar
  }> = []

  for (let i = 0; i < polyCommitments.length; i++) {
    openingProofs.push({
      commitment: polyCommitments[i]!,
      opening: permutationPoly.coefficients[i]!,
      randomness: polyRandomness[i]!,
    })
  }

  return {
    commitments: polyCommitments,
    challenges: [challenge],
    responses,
    permutationCommitments: maskingCommitments,
    polynomialEvaluations,
    openingProofs,
  }
}

/**
 * Verify a Bayer-Groth shuffle proof
 * 
 * WARNING: This is a SIMPLIFIED verification that only checks structural consistency.
 * It does NOT validate the permutation polynomial and is NOT cryptographically sound.
 * This is a critical security vulnerability that must be addressed.
 */
export function verifyBayerGrothShuffle(
  parameters: ShuffleParameters,
  statement: ShuffleStatement,
  proof: ZKProofShuffle,
): boolean {
  try {
    const n = statement.originalDeck.length

    // Validate basic proof structure
    if (!proof.commitments || !proof.challenges || !proof.responses) {
      return false
    }

    // For enhanced Bayer-Groth proofs, verify additional structure
    if (
      proof.permutationCommitments &&
      proof.polynomialEvaluations &&
      proof.openingProofs
    ) {
      // Enhanced verification for full Bayer-Groth proofs
      if (proof.challenges.length !== 1) {
        return false
      }

      const challenge = proof.challenges[0]!

      // Step 1: Recompute challenge using Fiat-Shamir
      const challengeInputs: Scalar[] = []

      // Add original deck to challenge
      for (const card of statement.originalDeck) {
        challengeInputs.push(card.randomness.x ?? 0n, card.randomness.y ?? 0n)
        challengeInputs.push(card.ciphertext.x ?? 0n, card.ciphertext.y ?? 0n)
      }

      // Add shuffled deck to challenge
      for (const card of statement.shuffledDeck) {
        challengeInputs.push(card.randomness.x ?? 0n, card.randomness.y ?? 0n)
        challengeInputs.push(card.ciphertext.x ?? 0n, card.ciphertext.y ?? 0n)
      }

      // Add commitments to challenge
      for (const commitment of proof.commitments) {
        challengeInputs.push(commitment.x ?? 0n, commitment.y ?? 0n)
      }
      for (const commitment of proof.permutationCommitments) {
        challengeInputs.push(commitment.x ?? 0n, commitment.y ?? 0n)
      }

      const expectedChallenge = poseidonHashScalars(challengeInputs)

      if (challenge !== expectedChallenge) {
        return false
      }

      // Step 2: Verify opening proofs using simple Pedersen commitment verification
      for (let i = 0; i < proof.openingProofs.length; i++) {
        const openingProof = proof.openingProofs[i]!
        // Verify: C = opening * G + randomness * H
        const expectedCommitment = addPoints(
          scalarMultiply(openingProof.opening, parameters.elgamalGenerator),
          scalarMultiply(openingProof.randomness, parameters.pedersenKey.h),
        )
        if (!openingProof.commitment.equals(expectedCommitment)) {
          return false
        }
      }

      // Step 3: Basic structural verification
      if (proof.commitments.length !== n || proof.responses.length !== 2 * n) {
        return false
      }

      if (proof.permutationCommitments.length !== n) {
        return false
      }

      if (proof.openingProofs.length !== n) {
        return false
      }

      // Step 4: Verify responses are valid scalars
      for (let i = 0; i < proof.responses.length; i++) {
        const response = proof.responses[i]!
        if (response < 0n || response >= CURVE_ORDER) {
          return false
        }
      }

      // Step 5: Verify polynomial evaluations are valid
      if (proof.polynomialEvaluations.length === 0) {
        return false
      }

      for (let i = 0; i < proof.polynomialEvaluations.length; i++) {
        const evaluation = proof.polynomialEvaluations[i]!
        if (evaluation < 0n || evaluation >= CURVE_ORDER) {
          return false
        }
      }
    }

    // Step 6: Verify basic card structure consistency
    if (statement.shuffledDeck.length !== statement.originalDeck.length) {
      return false
    }

    // Verify that all cards are properly formed
    for (let i = 0; i < n; i++) {
      const originalCard = statement.originalDeck[i]!
      const shuffledCard = statement.shuffledDeck[i]!

      if (!originalCard.randomness || !originalCard.ciphertext) {
        return false
      }
      if (!shuffledCard.randomness || !shuffledCard.ciphertext) {
        return false
      }
    }

    // WARNING: This is NOT a complete Bayer-Groth verification!
    // This only checks structural consistency and does NOT validate:
    // 1. The permutation polynomial correctness
    // 2. The polynomial commitment arithmetic
    // 3. The actual shuffle permutation validity
    // 
    // This is a CRITICAL SECURITY VULNERABILITY - the shuffle is NOT proven correct
    return true
  } catch (error) {
    // Return false for verification failures without logging
    return false
  }
}

/**
 * Create shuffle parameters from protocol parameters
 */
export function createShuffleParameters(
  protocolParams: Parameters,
  sharedKey: Point,
): ShuffleParameters {
  return {
    elgamalGenerator: protocolParams.generators.G,
    sharedKey,
    pedersenKey: {
      generators: protocolParams.pedersen.commitKey,
      h: protocolParams.pedersen.h,
    },
    deckSize: protocolParams.m,
    playerCount: protocolParams.n,
  }
}

/**
 * Simplified shuffle proof for backwards compatibility
 * This is the old placeholder implementation, kept for gradual migration
 */
export function generateSimplifiedShuffleProof(
  originalDeck: readonly MaskedCard[],
  shuffledDeck: readonly MaskedCard[],
  permutation: Permutation,
  maskingFactors: readonly Scalar[],
  generators: { G: Point; H: Point },
): ZKProofShuffle {
  const commitments: Point[] = []
  const challenges: Scalar[] = []
  const responses: Scalar[] = []

  for (let i = 0; i < shuffledDeck.length; i++) {
    const originalIndex = permutation.mapping[i]
    if (originalIndex === undefined) continue

    const originalCard = originalDeck[originalIndex]
    const shuffledCard = shuffledDeck[i]
    const maskingFactor = maskingFactors[i]
    if (!originalCard || !shuffledCard || maskingFactor === undefined) continue

    // Generate proof that shuffledCard is a valid remasking of originalCard
    const nonce = randScalar()
    const commitment = scalarMultiply(nonce, generators.G)
    const challenge = poseidonHashScalars([
      commitment.x ?? 0n,
      commitment.y ?? 0n,
      shuffledCard.randomness.x ?? 0n,
      shuffledCard.randomness.y ?? 0n,
      originalCard.randomness.x ?? 0n,
      originalCard.randomness.y ?? 0n,
      generators.H.x ?? 0n,
      generators.H.y ?? 0n,
    ])
    const response = moduloOrder(nonce + challenge * maskingFactor)

    commitments.push(commitment)
    challenges.push(challenge)
    responses.push(response)
  }

  return {
    commitments,
    challenges,
    responses,
  }
}
