import {
  G,
  POINT_AT_INFINITY,
  PRIME,
  type Point,
  type Scalar,
  addPoints,
  moduloOrder,
  negatePoint,
  randScalar,
  scalarMultiply,
} from "@starkms/crypto"
import { H, generateChallenge } from "@starkms/crypto"
import {
  type ShuffleStatement,
  type ShuffleWitness,
  createShuffleParameters,
  proveBayerGrothShuffle,
  verifyBayerGrothShuffle,
} from "./bayer-groth-shuffle"
import { type CardEncoding, getPlayingCard, getCardIndex } from "./card-encoding"
import { generatePedersenCommitKey } from "./pedersen-commitment"
import { BaseBarnettSmartProtocol } from "./protocol"
import type {
  AggregatePublicKey,
  Card,
  CardIndex,
  DeckSize,
  MaskedCard,
  Parameters,
  Permutation,
  PlayerId,
  PlayerPublicKey,
  PlayerSecretKey,
  RevealToken,
  ZKProofKeyOwnership,
  ZKProofMasking,
  ZKProofRemasking,
  ZKProofReveal,
  ZKProofShuffle,
} from "./types"
import { MentalPokerError, MentalPokerErrorCode } from "./types"

// ElGamal-style interfaces removed as they're not used in the current implementation
// The protocol uses the MaskedCard type directly for ciphertext representation

/**
 * Custom Chaum-Pedersen proof for masking operations.
 * Proves that the same randomness r was used in both c1 = r*G and (c2 - card) = r*sharedKey
 */
function proveMasking(
  r: Scalar,
  G: Point,
  sharedKey: Point,
  c1: Point,
  c2MinusCard: Point,
): ZKProofMasking {
  // Generate random nonce
  const nonce = randScalar()

  // Commitments: P = nonce*G, Q = nonce*sharedKey
  const P = scalarMultiply(nonce, G)
  const Q = scalarMultiply(nonce, sharedKey)

  // Challenge: c = Hash(P, Q, c1, c2MinusCard)
  const challenge = generateChallenge(P, Q, c1, c2MinusCard)

  // Response: e = (nonce + challenge*r) mod order
  const response = moduloOrder(nonce + challenge * r)

  return {
    commitmentG: P,
    commitmentH: Q,
    challenge,
    response,
  }
}

/**
 * Verify masking proof
 */
function verifyMasking(
  proof: ZKProofMasking,
  G: Point,
  sharedKey: Point,
  c1: Point,
  c2MinusCard: Point,
): boolean {
  try {
    // Verify: e*G = P + c*c1
    const lhs1 = scalarMultiply(proof.response, G)
    const rhs1 = addPoints(
      proof.commitmentG,
      scalarMultiply(proof.challenge, c1),
    )

    // Verify: e*sharedKey = Q + c*(c2MinusCard)
    const lhs2 = scalarMultiply(proof.response, sharedKey)
    const rhs2 = addPoints(
      proof.commitmentH,
      scalarMultiply(proof.challenge, c2MinusCard),
    )

    return lhs1.equals(rhs1) && lhs2.equals(rhs2)
  } catch {
    return false
  }
}

/**
 * Custom Chaum-Pedersen proof for reveal operations.
 * Proves that the same secret key sk was used in both pk = sk*G and token = sk*c1
 */
function proveReveal(
  sk: Scalar,
  G: Point,
  c1: Point,
  pk: Point,
  token: Point,
): ZKProofReveal {
  // Generate random nonce
  const nonce = randScalar()

  // Commitments: P = nonce*G, Q = nonce*c1
  const P = scalarMultiply(nonce, G)
  const Q = scalarMultiply(nonce, c1)

  // Challenge: c = Hash(P, Q, pk, token)
  const challenge = generateChallenge(P, Q, pk, token)

  // Response: e = (nonce + challenge*sk) mod order
  const response = moduloOrder(nonce + challenge * sk)

  return {
    commitmentG: P,
    commitmentH: Q,
    challenge,
    response,
  }
}

/**
 * Verify reveal proof
 */
function verifyReveal(
  proof: ZKProofReveal,
  G: Point,
  c1: Point,
  pk: Point,
  token: Point,
): boolean {
  try {
    // Verify: e*G = P + c*pk
    const lhs1 = scalarMultiply(proof.response, G)
    const rhs1 = addPoints(
      proof.commitmentG,
      scalarMultiply(proof.challenge, pk),
    )

    // Verify: e*c1 = Q + c*token
    const lhs2 = scalarMultiply(proof.response, c1)
    const rhs2 = addPoints(
      proof.commitmentH,
      scalarMultiply(proof.challenge, token),
    )

    return lhs1.equals(rhs1) && lhs2.equals(rhs2)
  } catch {
    return false
  }
}

/**
 * Discrete Log Cards implementation of the Barnett-Smart protocol.
 *
 * This implementation uses ElGamal encryption over elliptic curves where:
 * - Cards are represented as points on the curve
 * - Masking is ElGamal encryption
 * - All operations are backed by zero-knowledge proofs
 */
export class DLCards extends BaseBarnettSmartProtocol {
  private static readonly INSTANCE = new DLCards()

  /**
   * Private constructor to enforce singleton pattern and controlled instantiation
   */
  private constructor() {
    super()
  }

  /**
   * Get the singleton instance of DLCards
   */
  public static getInstance(): DLCards {
    return DLCards.INSTANCE
  }

  /* ------------------------  Protocol Implementation  ------------------------ */

  async setup(m: DeckSize, n: PlayerId): Promise<Parameters> {
    this.validateSetupParameters(m, n)

    // Use standard generators G and H from the crypto package
    const generators = {
      G: G, // Primary generator
      H: H, // Secondary generator for Chaum-Pedersen proofs
    }

    // Generate Pedersen commitment key for Bayer-Groth shuffle proofs
    // We need enough generators for the maximum polynomial degree (deck size squared for matrix commitments)
    const maxGenerators = Math.max(m * m + m + 10, 64) // Ensure sufficient generators for all commitments
    const pedersenKey = generatePedersenCommitKey(maxGenerators)

    return {
      m,
      n,
      generators,
      elgamal: {
        generator: G, // ElGamal generator (same as primary generator)
      },
      pedersen: {
        commitKey: pedersenKey.generators,
        h: pedersenKey.h,
      },
    }
  }

  async playerKeygen(
    pp: Parameters,
  ): Promise<[PlayerPublicKey, PlayerSecretKey]> {
    this.validateParameters(pp)

    // Generate random secret key
    const sk: Scalar = randScalar()

    // Compute public key: pk = sk * G
    const pk: Point = scalarMultiply(sk, pp.generators.G)

    return [{ point: pk }, { scalar: sk }]
  }

  async proveKeyOwnership(
    pp: Parameters,
    pk: PlayerPublicKey,
    sk: PlayerSecretKey,
    playerPublicInfo: Uint8Array,
  ): Promise<ZKProofKeyOwnership> {
    this.validateParameters(pp)
    // Note: Key validation is done during verification, not during proof generation

    // Generate Schnorr proof: prove knowledge of sk such that pk = sk * G
    const nonce = randScalar()
    const commitment = scalarMultiply(nonce, pp.generators.G)

    // Challenge derived from commitment, public key, and player info (Fiat-Shamir)
    // Convert player info to a scalar for inclusion in challenge
    const playerInfoHash = BigInt(
      `0x${Array.from(playerPublicInfo)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`,
    )
    const playerInfoScalar = playerInfoHash % PRIME
    const playerInfoPoint = scalarMultiply(playerInfoScalar, pp.generators.H)
    const challenge = generateChallenge(
      commitment,
      pk.point,
      pp.generators.G,
      playerInfoPoint,
    )

    // Response: e = (nonce + challenge * sk) mod order
    const response = moduloOrder(nonce + challenge * sk.scalar)

    return {
      commitment,
      challenge,
      response,
    }
  }

  async verifyKeyOwnership(
    pp: Parameters,
    pk: PlayerPublicKey,
    playerPublicInfo: Uint8Array,
    proof: ZKProofKeyOwnership,
  ): Promise<boolean> {
    this.validateParameters(pp)

    try {
      // Recompute the challenge using the same method as in proof generation
      const playerInfoHash = BigInt(
        `0x${Array.from(playerPublicInfo)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`,
      )
      const playerInfoScalar = playerInfoHash % PRIME
      const playerInfoPoint = scalarMultiply(playerInfoScalar, pp.generators.H)
      const expectedChallenge = generateChallenge(
        proof.commitment,
        pk.point,
        pp.generators.G,
        playerInfoPoint,
      )

      // Verify the challenge matches
      if (proof.challenge !== expectedChallenge) {
        return false
      }

      // Verify the Schnorr proof: e*G = P + c*pk
      const lhs = scalarMultiply(proof.response, pp.generators.G)
      const rhs = addPoints(
        proof.commitment,
        scalarMultiply(proof.challenge, pk.point),
      )

      return lhs.equals(rhs)
    } catch (error) {
      return false
    }
  }

  async computeAggregateKey(
    pp: Parameters,
    playerKeysProofInfo: readonly (readonly [
      PlayerPublicKey,
      ZKProofKeyOwnership,
      Uint8Array,
    ])[],
  ): Promise<AggregatePublicKey> {
    this.validateParameters(pp)

    if (playerKeysProofInfo.length === 0) {
      throw new MentalPokerError(
        "No player keys provided",
        MentalPokerErrorCode.INVALID_PARAMETERS,
      )
    }

    // Verify all key ownership proofs
    for (const [pk, proof, playerInfo] of playerKeysProofInfo) {
      const isValid = await this.verifyKeyOwnership(pp, pk, playerInfo, proof)
      if (!isValid) {
        throw new MentalPokerError(
          "Invalid key ownership proof",
          MentalPokerErrorCode.PROOF_VERIFICATION_FAILED,
        )
      }
    }

    // Aggregate all public keys: aggregateKey = sum(pk_i)
    let aggregatePoint = POINT_AT_INFINITY
    for (const [pk] of playerKeysProofInfo) {
      aggregatePoint = addPoints(aggregatePoint, pk.point)
    }

    return { point: aggregatePoint }
  }

  async mask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalCard: Card,
    alpha: Scalar,
  ): Promise<[MaskedCard, ZKProofMasking]> {
    this.validateParameters(pp)

    // Validate inputs
    if (originalCard.index < 0) {
      throw new MentalPokerError(
        `Invalid card index: ${originalCard.index}`,
        MentalPokerErrorCode.INVALID_CARD_INDEX,
      )
    }

    if (alpha < 0n) {
      throw new MentalPokerError(
        `Invalid masking factor: ${alpha}`,
        MentalPokerErrorCode.CRYPTOGRAPHIC_ERROR,
      )
    }

    // ElGamal encryption: (c1, c2) = (alpha*G, card + alpha*sharedKey)
    const c1 = scalarMultiply(alpha, pp.generators.G)
    const c2 = addPoints(
      originalCard.point,
      scalarMultiply(alpha, sharedKey.point),
    )

    // Create masked card
    const maskedCard: MaskedCard = {
      randomness: c1,
      ciphertext: c2,
    }

    // Generate zero-knowledge proof of correct masking
    const c2MinusCard = addPoints(c2, negatePoint(originalCard.point))
    const proof = proveMasking(alpha, pp.generators.G, sharedKey.point, c1, c2MinusCard)

    return [maskedCard, proof]
  }

  async verifyMask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    card: Card,
    maskedCard: MaskedCard,
    proof: ZKProofMasking,
  ): Promise<boolean> {
    this.validateParameters(pp)

    const c2MinusCard = addPoints(
      maskedCard.ciphertext,
      negatePoint(card.point),
    )
    return verifyMasking(
      proof,
      pp.generators.G,
      sharedKey.point,
      maskedCard.randomness,
      c2MinusCard,
    )
  }

  async remask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalMasked: MaskedCard,
    alpha: Scalar,
  ): Promise<[MaskedCard, ZKProofRemasking]> {
    this.validateParameters(pp)

    // Homomorphic re-encryption: add fresh randomness
    const additionalC1 = scalarMultiply(alpha, pp.generators.G)
    const additionalC2 = scalarMultiply(alpha, sharedKey.point)

    const remaskedCard: MaskedCard = {
      ciphertext: addPoints(originalMasked.ciphertext, additionalC2),
      randomness: addPoints(originalMasked.randomness, additionalC1),
    }

    // Generate proof that remasking was done correctly
    const diffC1 = additionalC1
    const diffC2 = additionalC2
    const zkProof = proveMasking(
      alpha,
      pp.generators.G,
      sharedKey.point,
      diffC1,
      diffC2,
    )

    return [remaskedCard, zkProof]
  }

  async verifyRemask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalMasked: MaskedCard,
    remasked: MaskedCard,
    proof: ZKProofRemasking,
  ): Promise<boolean> {
    this.validateParameters(pp)

    try {
      // Verify that the difference between remasked and original is a valid ElGamal encryption of 0
      const diffC1 = addPoints(
        remasked.randomness,
        negatePoint(originalMasked.randomness),
      )
      const diffC2 = addPoints(
        remasked.ciphertext,
        negatePoint(originalMasked.ciphertext),
      )

      return verifyMasking(
        proof,
        pp.generators.G,
        sharedKey.point,
        diffC1,
        diffC2,
      )
    } catch (error) {
      return false
    }
  }

  async computeRevealToken(
    pp: Parameters,
    sk: PlayerSecretKey,
    pk: PlayerPublicKey,
    maskedCard: MaskedCard,
  ): Promise<[RevealToken, ZKProofReveal]> {
    this.validateParameters(pp)
    this.validateKeyPair(pp, pk, sk)

    // Compute reveal token: token = sk * c1 (partial decryption)
    const token = scalarMultiply(sk.scalar, maskedCard.randomness)

    // Generate custom Chaum-Pedersen proof for reveal
    const zkProof = proveReveal(
      sk.scalar,
      pp.generators.G,
      maskedCard.randomness,
      pk.point,
      token,
    )

    return [{ token }, zkProof]
  }

  async verifyReveal(
    pp: Parameters,
    pk: PlayerPublicKey,
    revealToken: RevealToken,
    maskedCard: MaskedCard,
    proof: ZKProofReveal,
  ): Promise<boolean> {
    this.validateParameters(pp)

    return verifyReveal(
      proof,
      pp.generators.G,
      maskedCard.randomness,
      pk.point,
      revealToken.token,
    )
  }

  async unmask(
    pp: Parameters,
    decryptionKey: readonly (readonly [
      RevealToken,
      ZKProofReveal,
      PlayerPublicKey,
    ])[],
    maskedCard: MaskedCard,
    cardEncoding?: CardEncoding,
  ): Promise<Card> {
    this.validateParameters(pp)

    // Validate that we have tokens from all players
    if (decryptionKey.length !== pp.n) {
      throw new MentalPokerError(
        `Insufficient reveal tokens: expected ${pp.n}, got ${decryptionKey.length}`,
        MentalPokerErrorCode.INSUFFICIENT_REVEAL_TOKENS,
      )
    }

    // Verify all reveal tokens and proofs
    for (const [token, proof, pk] of decryptionKey) {
      const isValid = await this.verifyReveal(pp, pk, token, maskedCard, proof)
      if (!isValid) {
        throw new MentalPokerError(
          "Invalid reveal token proof",
          MentalPokerErrorCode.PROOF_VERIFICATION_FAILED,
        )
      }
    }

    // Aggregate all reveal tokens: aggregateToken = sum(token_i)
    let aggregateToken = POINT_AT_INFINITY
    for (const [token] of decryptionKey) {
      aggregateToken = addPoints(aggregateToken, token.token)
    }

    // Decrypt: card = c2 - aggregateToken
    const cardPoint = addPoints(maskedCard.ciphertext, negatePoint(aggregateToken))

    // Try to find the card index if encoding is provided
    let cardIndex: CardIndex = 0 as CardIndex
    if (cardEncoding) {
      const playingCard = getPlayingCard(cardEncoding, cardPoint)
      if (playingCard) {
        const index = getCardIndex(cardEncoding, playingCard)
        if (index !== undefined) {
          cardIndex = index
        }
      }
    }

    return {
      point: cardPoint,
      index: cardIndex,
    }
  }

  async shuffleAndRemask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    deck: readonly MaskedCard[],
    maskingFactors: readonly Scalar[],
    permutation: Permutation,
  ): Promise<[readonly MaskedCard[], ZKProofShuffle]> {
    this.validateParameters(pp)
    this.validateArrayLengths(
      [Array.from(deck), Array.from(maskingFactors)],
      deck.length,
      "shuffle parameters",
    )

    if (permutation.size !== deck.length) {
      throw new MentalPokerError(
        `Permutation size ${permutation.size} does not match deck size ${deck.length}`,
        MentalPokerErrorCode.INVALID_PERMUTATION,
      )
    }

    // Apply permutation and remask each card
    const shuffledDeck: MaskedCard[] = []

    for (let i = 0; i < deck.length; i++) {
      const originalIndex = permutation.mapping[i]
      if (originalIndex === undefined) {
        throw new MentalPokerError(
          `Invalid permutation: missing mapping for index ${i}`,
          MentalPokerErrorCode.INVALID_PERMUTATION,
        )
      }

      const originalCard = deck[originalIndex]
      if (!originalCard) {
        throw new MentalPokerError(
          `Invalid deck: missing card at index ${originalIndex}`,
          MentalPokerErrorCode.INVALID_PARAMETERS,
        )
      }

      const maskingFactor = maskingFactors[i]
      if (maskingFactor === undefined) {
        throw new MentalPokerError(
          `Invalid masking factors: missing factor for index ${i}`,
          MentalPokerErrorCode.INVALID_PARAMETERS,
        )
      }

      // Remask the card
      const [remaskedCard] = await this.remask(
        pp,
        sharedKey,
        originalCard,
        maskingFactor,
      )
      shuffledDeck.push(remaskedCard)
    }

    // Generate cryptographically secure Bayer-Groth shuffle proof
    const shuffleParameters = createShuffleParameters(pp, sharedKey.point)
    const statement: ShuffleStatement = {
      originalDeck: deck,
      shuffledDeck,
    }
    const witness: ShuffleWitness = {
      permutation,
      maskingFactors,
    }

    const shuffleProof = proveBayerGrothShuffle(
      shuffleParameters,
      statement,
      witness,
    )

    return [shuffledDeck, shuffleProof]
  }

  async verifyShuffle(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalDeck: readonly MaskedCard[],
    shuffledDeck: readonly MaskedCard[],
    proof: ZKProofShuffle,
  ): Promise<boolean> {
    this.validateParameters(pp)

    if (originalDeck.length !== shuffledDeck.length) {
      return false
    }

    try {
      // Use cryptographically secure Bayer-Groth shuffle verification
      const shuffleParameters = createShuffleParameters(pp, sharedKey.point)
      const statement: ShuffleStatement = {
        originalDeck,
        shuffledDeck,
      }

      return verifyBayerGrothShuffle(shuffleParameters, statement, proof)
    } catch (error) {
      // Return false for verification failures
      // The error details are handled by the verification function
      return false
    }
  }

  /* ------------------------  Private Helper Methods  ------------------------ */

  private validateSetupParameters(m: DeckSize, n: PlayerId): void {
    if (m <= 0) {
      throw new MentalPokerError(
        `Invalid deck size: ${m}`,
        MentalPokerErrorCode.INVALID_DECK_SIZE,
      )
    }
    if (n <= 0) {
      throw new MentalPokerError(
        `Invalid player count: ${n}`,
        MentalPokerErrorCode.INVALID_PLAYER_COUNT,
      )
    }
  }

  private validateKeyPair(
    pp: Parameters,
    pk: PlayerPublicKey,
    sk: PlayerSecretKey,
  ): void {
    // Verify that pk = sk * G
    const expectedPk = scalarMultiply(sk.scalar, pp.generators.G)
    if (!expectedPk.equals(pk.point)) {
      throw new MentalPokerError(
        "Public key does not match secret key",
        MentalPokerErrorCode.CRYPTOGRAPHIC_ERROR,
      )
    }
  }
}
