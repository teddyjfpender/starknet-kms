import type { Scalar } from "@starkms/crypto";
import type {
  Parameters,
  PlayerPublicKey,
  PlayerSecretKey,
  AggregatePublicKey,
  Card,
  MaskedCard,
  RevealToken,
  ZKProofKeyOwnership,
  ZKProofMasking,
  ZKProofRemasking,
  ZKProofReveal,
  ZKProofShuffle,
  Permutation,
  DeckSize,
  PlayerId,
} from "./types";
import { MentalPokerError } from "./types";
import type { CardEncoding } from "./card-encoding";

/**
 * Mental Poker protocol based on the one described by Barnett and Smart (2003).
 * The protocol has been modified to make use of the argument of a correct shuffle presented
 * by Bayer and Groth (2014).
 * 
 * This interface provides a complete API for secure card games without a trusted dealer.
 * All operations are backed by zero-knowledge proofs to ensure correctness and privacy.
 */
export interface BarnettSmartProtocol {
  /* ------------------------  Setup and Key Management  ------------------------ */

  /**
   * Randomly produce the scheme parameters for a mental poker game.
   * 
   * @param m Number of cards in the deck
   * @param n Number of players
   * @returns Protocol parameters containing cryptographic setup
   * @throws {MentalPokerError} If parameters are invalid
   */
  setup(m: DeckSize, n: PlayerId): Promise<Parameters>;

  /**
   * Generate cryptographic keys for a player.
   * 
   * @param pp Protocol parameters
   * @returns Tuple of [public key, secret key]
   * @throws {MentalPokerError} If key generation fails
   */
  playerKeygen(pp: Parameters): Promise<[PlayerPublicKey, PlayerSecretKey]>;

  /**
   * Prove in zero knowledge that the owner of a public key knows the corresponding secret key.
   * 
   * @param pp Protocol parameters
   * @param pk Player's public key
   * @param sk Player's secret key
   * @param playerPublicInfo Additional public information about the player
   * @returns Zero-knowledge proof of key ownership
   * @throws {MentalPokerError} If proof generation fails
   */
  proveKeyOwnership(
    pp: Parameters,
    pk: PlayerPublicKey,
    sk: PlayerSecretKey,
    playerPublicInfo: Uint8Array
  ): Promise<ZKProofKeyOwnership>;

  /**
   * Verify a proof of key ownership.
   * 
   * @param pp Protocol parameters
   * @param pk Player's public key
   * @param playerPublicInfo Additional public information about the player
   * @param proof Zero-knowledge proof to verify
   * @returns True if proof is valid
   * @throws {MentalPokerError} If verification fails
   */
  verifyKeyOwnership(
    pp: Parameters,
    pk: PlayerPublicKey,
    playerPublicInfo: Uint8Array,
    proof: ZKProofKeyOwnership
  ): Promise<boolean>;

  /**
   * Use all the public keys and zk-proofs to compute a verified aggregate public key.
   * 
   * @param pp Protocol parameters
   * @param playerKeysProofInfo Array of [public key, proof, player info] tuples
   * @returns Aggregate public key for the game
   * @throws {MentalPokerError} If any proof is invalid or computation fails
   */
  computeAggregateKey(
    pp: Parameters,
    playerKeysProofInfo: readonly (readonly [PlayerPublicKey, ZKProofKeyOwnership, Uint8Array])[]
  ): Promise<AggregatePublicKey>;

  /* ------------------------  Card Operations  ------------------------ */

  /**
   * Use the shared public key and a random scalar to mask a card.
   * Returns a masked card and a zk-proof that the masking operation was applied correctly.
   * 
   * @param pp Protocol parameters
   * @param sharedKey Aggregate public key
   * @param originalCard Card to mask
   * @param alpha Random masking factor
   * @returns Tuple of [masked card, proof of correct masking]
   * @throws {MentalPokerError} If masking fails
   */
  mask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalCard: Card,
    alpha: Scalar
  ): Promise<[MaskedCard, ZKProofMasking]>;

  /**
   * Verify a proof of masking.
   * 
   * @param pp Protocol parameters
   * @param sharedKey Aggregate public key
   * @param card Original card
   * @param maskedCard Masked card
   * @param proof Proof to verify
   * @returns True if proof is valid
   * @throws {MentalPokerError} If verification fails
   */
  verifyMask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    card: Card,
    maskedCard: MaskedCard,
    proof: ZKProofMasking
  ): Promise<boolean>;

  /**
   * Use the shared public key and a random scalar to remask a masked card.
   * Returns a remasked card and a zk-proof that the remasking operation was applied correctly.
   * 
   * @param pp Protocol parameters
   * @param sharedKey Aggregate public key
   * @param originalMasked Original masked card
   * @param alpha Random remasking factor
   * @returns Tuple of [remasked card, proof of correct remasking]
   * @throws {MentalPokerError} If remasking fails
   */
  remask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalMasked: MaskedCard,
    alpha: Scalar
  ): Promise<[MaskedCard, ZKProofRemasking]>;

  /**
   * Verify a proof of remasking.
   * 
   * @param pp Protocol parameters
   * @param sharedKey Aggregate public key
   * @param originalMasked Original masked card
   * @param remasked Remasked card
   * @param proof Proof to verify
   * @returns True if proof is valid
   * @throws {MentalPokerError} If verification fails
   */
  verifyRemask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalMasked: MaskedCard,
    remasked: MaskedCard,
    proof: ZKProofRemasking
  ): Promise<boolean>;

  /* ------------------------  Reveal Operations  ------------------------ */

  /**
   * Players can use this function to compute their reveal token for a given masked card.
   * The token is accompanied by a proof that it is a valid reveal for the specified card issued
   * by the player who ran the computation.
   * 
   * @param pp Protocol parameters
   * @param sk Player's secret key
   * @param pk Player's public key
   * @param maskedCard Masked card to create reveal token for
   * @returns Tuple of [reveal token, proof of correct reveal]
   * @throws {MentalPokerError} If reveal token computation fails
   */
  computeRevealToken(
    pp: Parameters,
    sk: PlayerSecretKey,
    pk: PlayerPublicKey,
    maskedCard: MaskedCard
  ): Promise<[RevealToken, ZKProofReveal]>;

  /**
   * Verify a proof of correctly computed reveal token.
   * 
   * @param pp Protocol parameters
   * @param pk Player's public key
   * @param revealToken Reveal token to verify
   * @param maskedCard Masked card
   * @param proof Proof to verify
   * @returns True if proof is valid
   * @throws {MentalPokerError} If verification fails
   */
  verifyReveal(
    pp: Parameters,
    pk: PlayerPublicKey,
    revealToken: RevealToken,
    maskedCard: MaskedCard,
    proof: ZKProofReveal
  ): Promise<boolean>;

  /**
   * After collecting all the necessary reveal tokens and proofs that these are correctly issued,
   * players can unmask a masked card to recover the underlying card.
   * 
   * @param pp Protocol parameters
   * @param decryptionKey Array of [reveal token, proof, public key] tuples from all players
   * @param maskedCard Masked card to unmask
   * @param cardEncoding Optional card encoding for proper index resolution
   * @returns The original unmasked card
   * @throws {MentalPokerError} If unmasking fails or insufficient reveal tokens
   */
  unmask(
    pp: Parameters,
    decryptionKey: readonly (readonly [RevealToken, ZKProofReveal, PlayerPublicKey])[],
    maskedCard: MaskedCard,
    cardEncoding?: CardEncoding
  ): Promise<Card>;

  /* ------------------------  Shuffle Operations  ------------------------ */

  /**
   * Shuffle and remask a deck of masked cards using a player-chosen permutation and vector of
   * masking factors.
   * 
   * @param pp Protocol parameters
   * @param sharedKey Aggregate public key
   * @param deck Array of masked cards to shuffle
   * @param maskingFactors Random factors for remasking each card
   * @param permutation Permutation to apply to the deck
   * @returns Tuple of [shuffled deck, proof of correct shuffle]
   * @throws {MentalPokerError} If shuffle fails or parameters are invalid
   */
  shuffleAndRemask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    deck: readonly MaskedCard[],
    maskingFactors: readonly Scalar[],
    permutation: Permutation
  ): Promise<[readonly MaskedCard[], ZKProofShuffle]>;

  /**
   * Verify a proof of correct shuffle.
   * 
   * @param pp Protocol parameters
   * @param sharedKey Aggregate public key
   * @param originalDeck Original deck before shuffle
   * @param shuffledDeck Deck after shuffle
   * @param proof Proof to verify
   * @returns True if proof is valid
   * @throws {MentalPokerError} If verification fails
   */
  verifyShuffle(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalDeck: readonly MaskedCard[],
    shuffledDeck: readonly MaskedCard[],
    proof: ZKProofShuffle
  ): Promise<boolean>;
}

/**
 * Abstract base class providing common functionality for mental poker implementations.
 * Concrete implementations should extend this class and implement the abstract methods.
 */
export abstract class BaseBarnettSmartProtocol implements BarnettSmartProtocol {
  /* ------------------------  Abstract Methods  ------------------------ */

  abstract setup(m: DeckSize, n: PlayerId): Promise<Parameters>;
  abstract playerKeygen(pp: Parameters): Promise<[PlayerPublicKey, PlayerSecretKey]>;
  abstract proveKeyOwnership(
    pp: Parameters,
    pk: PlayerPublicKey,
    sk: PlayerSecretKey,
    playerPublicInfo: Uint8Array
  ): Promise<ZKProofKeyOwnership>;
  abstract verifyKeyOwnership(
    pp: Parameters,
    pk: PlayerPublicKey,
    playerPublicInfo: Uint8Array,
    proof: ZKProofKeyOwnership
  ): Promise<boolean>;
  abstract computeAggregateKey(
    pp: Parameters,
    playerKeysProofInfo: readonly (readonly [PlayerPublicKey, ZKProofKeyOwnership, Uint8Array])[]
  ): Promise<AggregatePublicKey>;
  abstract mask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalCard: Card,
    alpha: Scalar
  ): Promise<[MaskedCard, ZKProofMasking]>;
  abstract verifyMask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    card: Card,
    maskedCard: MaskedCard,
    proof: ZKProofMasking
  ): Promise<boolean>;
  abstract remask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalMasked: MaskedCard,
    alpha: Scalar
  ): Promise<[MaskedCard, ZKProofRemasking]>;
  abstract verifyRemask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalMasked: MaskedCard,
    remasked: MaskedCard,
    proof: ZKProofRemasking
  ): Promise<boolean>;
  abstract computeRevealToken(
    pp: Parameters,
    sk: PlayerSecretKey,
    pk: PlayerPublicKey,
    maskedCard: MaskedCard
  ): Promise<[RevealToken, ZKProofReveal]>;
  abstract verifyReveal(
    pp: Parameters,
    pk: PlayerPublicKey,
    revealToken: RevealToken,
    maskedCard: MaskedCard,
    proof: ZKProofReveal
  ): Promise<boolean>;
  abstract unmask(
    pp: Parameters,
    decryptionKey: readonly (readonly [RevealToken, ZKProofReveal, PlayerPublicKey])[],
    maskedCard: MaskedCard,
    cardEncoding?: CardEncoding
  ): Promise<Card>;
  abstract shuffleAndRemask(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    deck: readonly MaskedCard[],
    maskingFactors: readonly Scalar[],
    permutation: Permutation
  ): Promise<[readonly MaskedCard[], ZKProofShuffle]>;
  abstract verifyShuffle(
    pp: Parameters,
    sharedKey: AggregatePublicKey,
    originalDeck: readonly MaskedCard[],
    shuffledDeck: readonly MaskedCard[],
    proof: ZKProofShuffle
  ): Promise<boolean>;

  /* ------------------------  Common Utility Methods  ------------------------ */

  /**
   * Validates protocol parameters
   */
  protected validateParameters(pp: Parameters): void {
    if (pp.m <= 0) {
      throw new MentalPokerError(
        `Invalid deck size: ${pp.m}`,
        "INVALID_DECK_SIZE" as any
      );
    }
    if (pp.n <= 0) {
      throw new MentalPokerError(
        `Invalid player count: ${pp.n}`,
        "INVALID_PLAYER_COUNT" as any
      );
    }
  }

  /**
   * Validates that arrays have matching lengths
   */
  protected validateArrayLengths(
    arrays: readonly unknown[][],
    expectedLength: number,
    context: string
  ): void {
    for (const array of arrays) {
      if (array.length !== expectedLength) {
        throw new MentalPokerError(
          `${context}: expected length ${expectedLength}, got ${array.length}`,
          "INVALID_PARAMETERS" as any
        );
      }
    }
  }
} 