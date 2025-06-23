// Core types and interfaces
export type {
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
  PlayerId,
  CardIndex,
  DeckSize,
} from "./types"

// Error types
export {
  MentalPokerError,
  MentalPokerErrorCode,
  createPlayerId,
  createCardIndex,
  createDeckSize,
  createPermutation,
} from "./types"

// Protocol interface
export type { BarnettSmartProtocol } from "./protocol"
export { BaseBarnettSmartProtocol } from "./protocol"

// Discrete log cards implementation
export { DLCards } from "./discrete-log-cards"

// Card encoding system
export type { ClassicPlayingCard, CardEncoding } from "./card-encoding"
export {
  Suite,
  Value,
  createClassicCard,
  formatCard,
  getCardKey,
  getPointKey,
  createStandardDeck,
  encodeStandardDeck,
  getCardByIndex,
  getCardIndex,
  getCardPoint,
  getPlayingCard,
  validateEncoding,
} from "./card-encoding"

// Advanced security features
export type { SecurityEvent } from "./advanced-security"
export {
  AdvancedSecurity,
  SecurityEventType,
  SecuritySeverity,
} from "./advanced-security"

// Export all public APIs
export * from "./discrete-log-cards"
export * from "./types"
export * from "./card-encoding"
export * from "./advanced-security"

// Export new primitives
export * from "./primitives/elgamal"
export * from "./primitives/masking"

// Re-export the main protocol class for convenience
export { DLCards as MentalPoker } from "./discrete-log-cards"
