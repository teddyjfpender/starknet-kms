import { randScalar, scalarMultiply, G, type Point } from "@starkms/crypto";
import type { Card, CardIndex } from "./types";
import { createCardIndex } from "./types";

/**
 * Standard playing card suites
 */
export enum Suite {
  Club = "♣",
  Diamond = "♦", 
  Heart = "♥",
  Spade = "♠",
}

/**
 * Standard playing card values
 */
export enum Value {
  Two = "2",
  Three = "3", 
  Four = "4",
  Five = "5",
  Six = "6",
  Seven = "7",
  Eight = "8",
  Nine = "9",
  Ten = "10",
  Jack = "J",
  Queen = "Q", 
  King = "K",
  Ace = "A",
}

/**
 * Classic playing card representation
 */
export interface ClassicPlayingCard {
  readonly value: Value;
  readonly suite: Suite;
}

/**
 * Card encoding mapping between curve points and playing cards
 */
export interface CardEncoding {
  readonly cardToPoint: Map<string, Card>;
  readonly pointToCard: Map<string, ClassicPlayingCard>;
  readonly indexToCard: Map<number, ClassicPlayingCard>;
  readonly cardToIndex: Map<string, CardIndex>;
}

/**
 * Create a classic playing card
 */
export function createClassicCard(value: Value, suite: Suite): ClassicPlayingCard {
  return { value, suite };
}

/**
 * Format a card for display
 */
export function formatCard(card: ClassicPlayingCard): string {
  return `${card.value}${card.suite}`;
}

/**
 * Get card key for maps
 */
export function getCardKey(card: ClassicPlayingCard): string {
  return `${card.value}_${card.suite}`;
}

/**
 * Get point key for maps
 */
export function getPointKey(point: Point): string {
  return `${point.x}_${point.y}`;
}

/**
 * Create a standard 52-card deck
 */
export function createStandardDeck(): ClassicPlayingCard[] {
  const deck: ClassicPlayingCard[] = [];
  const suites = [Suite.Club, Suite.Diamond, Suite.Heart, Suite.Spade];
  const values = [
    Value.Two, Value.Three, Value.Four, Value.Five, Value.Six, Value.Seven,
    Value.Eight, Value.Nine, Value.Ten, Value.Jack, Value.Queen, Value.King, Value.Ace
  ];

  for (const suite of suites) {
    for (const value of values) {
      deck.push(createClassicCard(value, suite));
    }
  }

  return deck;
}

/**
 * Encode a standard 52-card deck to curve points
 * This creates a bijective mapping between playing cards and curve points
 */
export function encodeStandardDeck(): CardEncoding {
  const standardDeck = createStandardDeck();
  const numCards = standardDeck.length;
  
  // Generate random curve points for each card
  const cardPoints: Card[] = [];
  for (let i = 0; i < numCards; i++) {
    // Generate a random scalar and multiply by G to get a random point
    const randomScalar = randScalar();
    const point = scalarMultiply(randomScalar, G);
    cardPoints.push({
      point,
      index: createCardIndex(i),
    });
  }

  // Create bidirectional mappings
  const cardToPoint = new Map<string, Card>();
  const pointToCard = new Map<string, ClassicPlayingCard>();
  const indexToCard = new Map<number, ClassicPlayingCard>();
  const cardToIndex = new Map<string, CardIndex>();

  for (let i = 0; i < numCards; i++) {
    const card = standardDeck[i];
    const cardPoint = cardPoints[i];
    if (!card || !cardPoint) {
      throw new Error(`Missing card or point at index ${i}`);
    }
    
    const cardKey = getCardKey(card);
    const pointKey = getPointKey(cardPoint.point);

    cardToPoint.set(cardKey, cardPoint);
    pointToCard.set(pointKey, card);
    indexToCard.set(i, card);
    cardToIndex.set(cardKey, createCardIndex(i));
  }

  return {
    cardToPoint,
    pointToCard,
    indexToCard,
    cardToIndex,
  };
}

/**
 * Get a card by its index
 */
export function getCardByIndex(encoding: CardEncoding, index: number): ClassicPlayingCard | undefined {
  return encoding.indexToCard.get(index);
}

/**
 * Get a card's index
 */
export function getCardIndex(encoding: CardEncoding, card: ClassicPlayingCard): CardIndex | undefined {
  const cardKey = getCardKey(card);
  return encoding.cardToIndex.get(cardKey);
}

/**
 * Get the curve point for a playing card
 */
export function getCardPoint(encoding: CardEncoding, card: ClassicPlayingCard): Card | undefined {
  const cardKey = getCardKey(card);
  return encoding.cardToPoint.get(cardKey);
}

/**
 * Get the playing card for a curve point
 */
export function getPlayingCard(encoding: CardEncoding, point: Point): ClassicPlayingCard | undefined {
  const pointKey = getPointKey(point);
  return encoding.pointToCard.get(pointKey);
}

/**
 * Validate that the encoding is bijective
 */
export function validateEncoding(encoding: CardEncoding): boolean {
  const standardDeck = createStandardDeck();
  
  // Check that all cards have points
  for (const card of standardDeck) {
    const point = getCardPoint(encoding, card);
    if (!point) return false;
    
    // Check reverse mapping
    const recoveredCard = getPlayingCard(encoding, point.point);
    if (!recoveredCard || getCardKey(recoveredCard) !== getCardKey(card)) {
      return false;
    }
  }
  
  // Check that all indices are mapped
  for (let i = 0; i < standardDeck.length; i++) {
    const card = getCardByIndex(encoding, i);
    if (!card) return false;
    
    const index = getCardIndex(encoding, card);
    if (index !== i) return false;
  }
  
  return true;
} 