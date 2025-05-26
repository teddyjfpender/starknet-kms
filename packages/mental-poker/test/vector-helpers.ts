import { Point, Scalar, hexToPoint as cryptoHexToPoint, G, CURVE_ORDER } from "@starkms/crypto";
import {
  type Parameters,
  type PlayerPublicKey,
  type PlayerSecretKey,
  type AggregatePublicKey,
  type Card,
  type MaskedCard,
  type RevealToken,
  type Permutation,
  createCardIndex,
  createDeckSize,
  createPlayerId,
  createPermutation,
} from "../src/types";

/**
 * Convert hex string to bigint safely
 */
export function hexToBigInt(hex: string): bigint {
  if (!hex.match(/^[0-9a-f]+$/i)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
  return BigInt('0x' + hex);
}

/**
 * Convert 32-byte hex string (field element) to Point by treating it as a scalar and multiplying by G
 * This is needed because the test vector provides field elements, not full point coordinates
 */
export function hexToPoint(hex: string): Point {
  // If it's already a full point format (compressed or uncompressed), use the crypto function
  if (hex.length === 66 || hex.length === 130) {
    return cryptoHexToPoint(hex);
  }
  
  // If it's a 32-byte hex string (64 characters), treat it as a scalar and multiply by G
  if (hex.length === 64) {
    const scalar = hexToBigInt(hex);
    // Reduce modulo curve order to ensure it's in valid range
    const reducedScalar = scalar % CURVE_ORDER;
    // Ensure it's not zero
    const finalScalar = reducedScalar === 0n ? 1n : reducedScalar;
    return G.multiply(finalScalar);
  }
  
  throw new Error(`Invalid hex string length: ${hex.length}. Expected 64 (field element), 66 (compressed point), or 130 (uncompressed point) characters.`);
}

/**
 * Convert hex string to Scalar
 */
export function hexToScalar(hex: string): Scalar {
  const scalar = hexToBigInt(hex);
  // Reduce modulo curve order to ensure it's in valid range
  const reducedScalar = scalar % CURVE_ORDER;
  // Ensure it's not zero
  return reducedScalar === 0n ? 1n : reducedScalar;
}

/**
 * Convert test vector player data to protocol types
 */
export function vectorPlayerToKeys(playerData: any): [PlayerPublicKey, PlayerSecretKey] {
  const sk: PlayerSecretKey = {
    scalar: hexToScalar(playerData.secret_key_hex)
  };
  
  // Derive the public key from the secret key to ensure consistency
  // since we're reducing the secret key modulo curve order
  const pk: PlayerPublicKey = {
    point: G.multiply(sk.scalar)
  };
  
  return [pk, sk];
}

/**
 * Convert test vector card data to Card
 */
export function vectorCardToCard(cardData: any, index: number): Card {
  return {
    point: hexToPoint(cardData.card_hex),
    index: createCardIndex(index)
  };
}

/**
 * Convert test vector masked card data to MaskedCard
 */
export function vectorMaskedCardToMaskedCard(maskedCardData: any): MaskedCard {
  return {
    ciphertext: hexToPoint(maskedCardData.masked_card_hex),
    randomness: hexToPoint(maskedCardData.masking_proof_hex) // This may need adjustment
  };
}

/**
 * Convert test vector reveal token data to RevealToken
 */
export function vectorTokenToRevealToken(tokenData: any): RevealToken {
  return {
    token: hexToPoint(tokenData.token_hex)
  };
}

/**
 * Convert test vector permutation to Permutation
 */
export function vectorPermutationToPermutation(permutationArray: number[]): Permutation {
  return createPermutation(permutationArray);
}

/**
 * Create Parameters from test vector
 */
export function vectorToParameters(testVector: any): Parameters {
  const m = createDeckSize(testVector.parameters.m);
  const n = createPlayerId(testVector.parameters.n);
  
  // Note: The test vector doesn't contain the full parameters object
  // This is a placeholder that would need to be filled with actual generator points
  return {
    m,
    n,
    generators: {
      G: hexToPoint("0000000000000000000000000000000000000000000000000000000000000001"), // Placeholder
      H: hexToPoint("0000000000000000000000000000000000000000000000000000000000000002"), // Placeholder
    },
    elgamal: {
      generator: hexToPoint("0000000000000000000000000000000000000000000000000000000000000001"), // Placeholder
    },
    pedersen: {
      commitKey: [hexToPoint("0000000000000000000000000000000000000000000000000000000000000001")], // Placeholder
      h: hexToPoint("0000000000000000000000000000000000000000000000000000000000000002"), // Placeholder
    }
  };
}

/**
 * Extract all player names from test vector
 */
export function getPlayerNames(testVector: any): string[] {
  return Object.keys(testVector.players);
}

/**
 * Extract all card mappings from test vector
 */
export function getCardMappings(testVector: any): Array<{
  index: number;
  playingCard: string;
  cardHex: string;
  card: Card;
}> {
  return Object.keys(testVector.card_mapping)
    .filter(key => key.startsWith('card_'))
    .map((key, index) => {
      const cardData = testVector.card_mapping[key];
      return {
        index,
        playingCard: cardData.playing_card,
        cardHex: cardData.card_hex,
        card: vectorCardToCard(cardData, index)
      };
    });
}

/**
 * Extract shuffle sequence from test vector
 */
export function getShuffleSequence(testVector: any): Array<{
  player: string;
  permutation: Permutation;
}> {
  const playerNames = getPlayerNames(testVector);
  return playerNames.map(player => ({
    player,
    permutation: vectorPermutationToPermutation(testVector.shuffles[player].permutation)
  }));
}

/**
 * Extract final results from test vector
 */
export function getFinalResults(testVector: any): Record<string, string> {
  return testVector.final_results;
}

/**
 * Validate that test vector has expected structure
 */
export function validateTestVector(testVector: any): void {
  if (!testVector.seed) {
    throw new Error("Test vector missing seed");
  }
  
  if (!testVector.parameters) {
    throw new Error("Test vector missing parameters");
  }
  
  if (!testVector.players) {
    throw new Error("Test vector missing players");
  }
  
  if (!testVector.card_mapping) {
    throw new Error("Test vector missing card_mapping");
  }
  
  if (!testVector.shuffles) {
    throw new Error("Test vector missing shuffles");
  }
  
  if (!testVector.final_results) {
    throw new Error("Test vector missing final_results");
  }
  
  // Validate we have 4 players
  const playerNames = getPlayerNames(testVector);
  if (playerNames.length !== 4) {
    throw new Error(`Expected 4 players, got ${playerNames.length}`);
  }
  
  // Validate we have 52 cards
  const cardCount = Object.keys(testVector.card_mapping).filter(k => k.startsWith('card_')).length;
  if (cardCount !== 52) {
    throw new Error(`Expected 52 cards, got ${cardCount}`);
  }
} 