import type { Point, Scalar } from "@starkms/crypto"

/* ------------------------  Branded Types for Type Safety  ------------------------ */

/**
 * Branded type for player indices to prevent mixing with other numeric values
 */
export type PlayerId = number & { readonly __brand: "PlayerId" }

/**
 * Branded type for card indices to prevent mixing with other numeric values
 */
export type CardIndex = number & { readonly __brand: "CardIndex" }

/**
 * Branded type for deck size to ensure valid deck operations
 */
export type DeckSize = number & { readonly __brand: "DeckSize" }

/* ------------------------  Core Protocol Types  ------------------------ */

/**
 * Protocol parameters containing cryptographic setup
 */
export interface Parameters {
  readonly m: DeckSize // Number of cards in deck
  readonly n: PlayerId // Number of players
  readonly generators: {
    readonly G: Point // Primary generator
    readonly H: Point // Secondary generator for Chaum-Pedersen
  }
  readonly elgamal: {
    readonly generator: Point // ElGamal generator
    readonly publicKey?: Point // Optional aggregate public key for ElGamal
  }
  readonly pedersen: {
    readonly commitKey: readonly Point[] // Pedersen commitment key (vector of generators)
    readonly h: Point // Additional generator for Pedersen commitments
  }
}

/**
 * Player's public key for the mental poker protocol
 */
export interface PlayerPublicKey {
  readonly point: Point
}

/**
 * Player's secret key for the mental poker protocol
 */
export interface PlayerSecretKey {
  readonly scalar: Scalar
}

/**
 * Aggregate public key computed from all players' public keys
 */
export interface AggregatePublicKey {
  readonly point: Point
}

/* ------------------------  Card Types  ------------------------ */

/**
 * Represents an unmasked card as a point on the elliptic curve
 */
export interface Card {
  readonly point: Point
  readonly index: CardIndex
}

/**
 * Represents a masked (encrypted) card
 */
export interface MaskedCard {
  readonly ciphertext: Point
  readonly randomness: Point // For homomorphic properties
}

/**
 * Token used to reveal a masked card
 */
export interface RevealToken {
  readonly token: Point
}

/* ------------------------  Zero-Knowledge Proof Types  ------------------------ */

/**
 * Proof that a player knows their secret key
 */
export interface ZKProofKeyOwnership {
  readonly commitment: Point
  readonly challenge: Scalar
  readonly response: Scalar
}

/**
 * Proof that a card was masked correctly
 */
export interface ZKProofMasking {
  readonly commitmentG: Point
  readonly commitmentH: Point
  readonly challenge: Scalar
  readonly response: Scalar
}

/**
 * Proof that a card was remasked correctly
 */
export interface ZKProofRemasking {
  readonly commitmentG: Point
  readonly commitmentH: Point
  readonly challenge: Scalar
  readonly response: Scalar
}

/**
 * Proof that a reveal token was computed correctly
 */
export interface ZKProofReveal {
  readonly commitmentG: Point
  readonly commitmentH: Point
  readonly challenge: Scalar
  readonly response: Scalar
}

/**
 * Proof that a shuffle was performed correctly using Bayer-Groth shuffle argument
 */
export interface ZKProofShuffle {
  // Pedersen commitments to the permutation polynomial coefficients
  readonly commitments: readonly Point[]
  // Challenges used in the proof (Fiat-Shamir)
  readonly challenges: readonly Scalar[]
  // Responses to the challenges
  readonly responses: readonly Scalar[]
  // Additional proof components for Bayer-Groth
  readonly permutationCommitments?: readonly Point[] // Commitments to permutation matrix
  readonly polynomialEvaluations?: readonly Scalar[] // Polynomial evaluations at challenge points
  readonly openingProofs?: readonly {
    readonly commitment: Point
    readonly opening: Scalar
    readonly randomness: Scalar
  }[] // Opening proofs for commitments
}

/* ------------------------  Permutation Type  ------------------------ */

/**
 * Represents a permutation for shuffling cards
 */
export interface Permutation {
  readonly mapping: readonly number[]
  readonly size: number
}

/* ------------------------  Error Types  ------------------------ */

/**
 * Errors that can occur during mental poker operations
 */
export class MentalPokerError extends Error {
  public readonly code: MentalPokerErrorCode
  public override readonly cause?: Error

  constructor(message: string, code: MentalPokerErrorCode, cause?: Error) {
    super(message)
    this.name = "MentalPokerError"
    this.code = code
    if (cause !== undefined) {
      this.cause = cause
    }
  }
}

export enum MentalPokerErrorCode {
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  INVALID_PLAYER_COUNT = "INVALID_PLAYER_COUNT",
  INVALID_DECK_SIZE = "INVALID_DECK_SIZE",
  INVALID_CARD_INDEX = "INVALID_CARD_INDEX",
  INVALID_PERMUTATION = "INVALID_PERMUTATION",
  PROOF_VERIFICATION_FAILED = "PROOF_VERIFICATION_FAILED",
  INSUFFICIENT_REVEAL_TOKENS = "INSUFFICIENT_REVEAL_TOKENS",
  CRYPTOGRAPHIC_ERROR = "CRYPTOGRAPHIC_ERROR",
}

/* ------------------------  Utility Functions for Branded Types  ------------------------ */

/**
 * Creates a PlayerId with validation
 */
export function createPlayerId(id: number): PlayerId {
  if (!Number.isInteger(id) || id <= 0) {
    throw new MentalPokerError(
      `Invalid player ID: ${id}. Must be a positive integer.`,
      MentalPokerErrorCode.INVALID_PLAYER_COUNT,
    )
  }
  return id as PlayerId
}

/**
 * Creates a CardIndex with validation
 */
export function createCardIndex(index: number): CardIndex {
  if (!Number.isInteger(index) || index < 0) {
    throw new MentalPokerError(
      `Invalid card index: ${index}. Must be a non-negative integer.`,
      MentalPokerErrorCode.INVALID_CARD_INDEX,
    )
  }
  return index as CardIndex
}

/**
 * Creates a DeckSize with validation
 */
export function createDeckSize(size: number): DeckSize {
  if (!Number.isInteger(size) || size <= 0) {
    throw new MentalPokerError(
      `Invalid deck size: ${size}. Must be a positive integer.`,
      MentalPokerErrorCode.INVALID_DECK_SIZE,
    )
  }
  return size as DeckSize
}

/**
 * Creates a Permutation with validation
 */
export function createPermutation(mapping: readonly number[]): Permutation {
  const size = mapping.length
  const seen = new Set<number>()

  for (const value of mapping) {
    if (!Number.isInteger(value) || value < 0 || value >= size) {
      throw new MentalPokerError(
        `Invalid permutation: value ${value} is out of range [0, ${size - 1}]`,
        MentalPokerErrorCode.INVALID_PERMUTATION,
      )
    }
    if (seen.has(value)) {
      throw new MentalPokerError(
        `Invalid permutation: duplicate value ${value}`,
        MentalPokerErrorCode.INVALID_PERMUTATION,
      )
    }
    seen.add(value)
  }

  return { mapping, size }
}
