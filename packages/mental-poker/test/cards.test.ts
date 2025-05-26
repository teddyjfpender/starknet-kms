import { describe, it, expect, beforeAll } from "bun:test";
import { 
  DLCards, 
  createDeckSize, 
  createPlayerId, 
  createPermutation,
  Suite,
  Value,
  createClassicCard,
  formatCard,
  createStandardDeck,
  encodeStandardDeck,
  getCardByIndex,
  getCardIndex,
  getCardPoint,
  getPlayingCard,
  validateEncoding,
  type ClassicPlayingCard,
  type CardEncoding,
  type Parameters,
  type PlayerPublicKey,
  type PlayerSecretKey,
  type AggregatePublicKey,
  type Card,
  type MaskedCard,
  type RevealToken,
  type ZKProofReveal,
} from "../src";
import { randScalar } from "@starkms/crypto";

/**
 * Test player class for simulating poker game scenarios
 */
class TestPlayer {
  public name: string;
  public pk: PlayerPublicKey | null = null;
  public sk: PlayerSecretKey | null = null;
  public cards: MaskedCard[] = [];
  public revealedCards: ClassicPlayingCard[] = [];

  constructor(name: string) {
    this.name = name;
  }

  async initialize(protocol: DLCards, pp: Parameters): Promise<void> {
    const [pk, sk] = await protocol.playerKeygen(pp);
    this.pk = pk;
    this.sk = sk;
  }

  receiveCard(card: MaskedCard): void {
    this.cards.push(card);
  }

  async computeRevealToken(
    protocol: DLCards,
    pp: Parameters,
    maskedCard: MaskedCard
  ): Promise<[RevealToken, ZKProofReveal]> {
    if (!this.sk || !this.pk) {
      throw new Error("Player not initialized");
    }
    return protocol.computeRevealToken(pp, this.sk, this.pk, maskedCard);
  }

  async revealCard(
    protocol: DLCards,
    pp: Parameters,
    maskedCard: MaskedCard,
    allRevealTokens: [RevealToken, ZKProofReveal, PlayerPublicKey][],
    cardEncoding: CardEncoding
  ): Promise<ClassicPlayingCard> {
    const unmaskedCard = await protocol.unmask(pp, allRevealTokens, maskedCard, cardEncoding);
    const playingCard = getPlayingCard(cardEncoding, unmaskedCard.point);
    if (!playingCard) {
      throw new Error("Could not decode card");
    }
    this.revealedCards.push(playingCard);
    return playingCard;
  }
}

describe("Mental Poker Protocol - Card Encoding", () => {
  let cardEncoding: CardEncoding;

  beforeAll(() => {
    cardEncoding = encodeStandardDeck();
  });

  it("should create a standard 52-card deck", () => {
    const deck = createStandardDeck();
    expect(deck).toHaveLength(52);
    
    // Check all suites are present
    const suites = new Set(deck.map(card => card.suite));
    expect(suites.size).toBe(4);
    expect(suites.has(Suite.Club)).toBe(true);
    expect(suites.has(Suite.Diamond)).toBe(true);
    expect(suites.has(Suite.Heart)).toBe(true);
    expect(suites.has(Suite.Spade)).toBe(true);
    
    // Check all values are present
    const values = new Set(deck.map(card => card.value));
    expect(values.size).toBe(13);
    expect(values.has(Value.Ace)).toBe(true);
    expect(values.has(Value.King)).toBe(true);
    expect(values.has(Value.Queen)).toBe(true);
    expect(values.has(Value.Jack)).toBe(true);
  });

  it("should create valid card encoding", () => {
    expect(validateEncoding(cardEncoding)).toBe(true);
    expect(cardEncoding.cardToPoint.size).toBe(52);
    expect(cardEncoding.pointToCard.size).toBe(52);
    expect(cardEncoding.indexToCard.size).toBe(52);
    expect(cardEncoding.cardToIndex.size).toBe(52);
  });

  it("should format cards correctly", () => {
    const aceOfSpades = createClassicCard(Value.Ace, Suite.Spade);
    expect(formatCard(aceOfSpades)).toBe("A♠");
    
    const kingOfHearts = createClassicCard(Value.King, Suite.Heart);
    expect(formatCard(kingOfHearts)).toBe("K♥");
  });

  it("should map cards to indices correctly", () => {
    const aceOfSpades = createClassicCard(Value.Ace, Suite.Spade);
    const cardIndex = getCardIndex(cardEncoding, aceOfSpades);
    expect(cardIndex).toBeDefined();
    
    if (cardIndex !== undefined) {
      const retrievedCard = getCardByIndex(cardEncoding, cardIndex);
      expect(retrievedCard).toBeDefined();
      if (retrievedCard) {
        expect(retrievedCard).toEqual(aceOfSpades);
      }
    }
  });

  it("should map cards to curve points correctly", () => {
    const aceOfSpades = createClassicCard(Value.Ace, Suite.Spade);
    const cardPoint = getCardPoint(cardEncoding, aceOfSpades);
    expect(cardPoint).toBeDefined();
    
    if (cardPoint) {
      const retrievedCard = getPlayingCard(cardEncoding, cardPoint.point);
      expect(retrievedCard).toBeDefined();
      if (retrievedCard) {
        expect(retrievedCard).toEqual(aceOfSpades);
      }
    }
  });
});

describe("Mental Poker Protocol - Player Management", () => {
  let protocol: DLCards;
  let pp: Parameters;
  let players: TestPlayer[];

  beforeAll(async () => {
    protocol = DLCards.getInstance();
    pp = await protocol.setup(createDeckSize(2), createPlayerId(4));
    
    players = [
      new TestPlayer("Alice"),
      new TestPlayer("Bob"), 
      new TestPlayer("Charlie"),
      new TestPlayer("David")
    ];
    
    for (const player of players) {
      await player.initialize(protocol, pp);
    }
  });

  it("should generate unique key pairs for each player", () => {
    for (let i = 0; i < players.length; i++) {
      const playerI = players[i];
      if (!playerI) continue;
      expect(playerI.pk).toBeDefined();
      expect(playerI.sk).toBeDefined();
      
      // Check uniqueness
      for (let j = i + 1; j < players.length; j++) {
        const playerJ = players[j];
        if (!playerJ) continue;
        expect(playerI.pk).not.toEqual(playerJ.pk);
        expect(playerI.sk).not.toEqual(playerJ.sk);
      }
    }
  });

  it("should prove and verify key ownership", async () => {
    for (const player of players) {
      if (!player.pk || !player.sk) continue;
      
      const playerInfo = new TextEncoder().encode(player.name);
      const proof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo);
      const isValid = await protocol.verifyKeyOwnership(pp, player.pk, playerInfo, proof);
      expect(isValid).toBe(true);
    }
  });

  it("should compute aggregate public key", async () => {
    const keyProofInfo = await Promise.all(
      players.map(async (player) => {
        if (!player.pk || !player.sk) throw new Error("Player not initialized");
        const playerInfo = new TextEncoder().encode(player.name);
        const proof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo);
        return [player.pk, proof, playerInfo] as const;
      })
    );
    
    const aggregateKey = await protocol.computeAggregateKey(pp, keyProofInfo);
    expect(aggregateKey).toBeDefined();
    expect(aggregateKey.point).toBeDefined();
  });
});

describe("Mental Poker Protocol - Card Masking", () => {
  let protocol: DLCards;
  let pp: Parameters;
  let sharedKey: AggregatePublicKey;
  let cardEncoding: CardEncoding;
  let testCard: Card;

  beforeAll(async () => {
    protocol = DLCards.getInstance();
    pp = await protocol.setup(createDeckSize(2), createPlayerId(4));
    cardEncoding = encodeStandardDeck();
    
    // Create test players and aggregate key
    const players = [
      new TestPlayer("Alice"),
      new TestPlayer("Bob")
    ];
    
    for (const player of players) {
      await player.initialize(protocol, pp);
    }
    
    const keyProofInfo = await Promise.all(
      players.map(async (player) => {
        if (!player.pk || !player.sk) throw new Error("Player not initialized");
        const playerInfo = new TextEncoder().encode(player.name);
        const proof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo);
        return [player.pk, proof, playerInfo] as const;
      })
    );
    
    sharedKey = await protocol.computeAggregateKey(pp, keyProofInfo);
    
    // Get a test card
    const aceOfSpades = createClassicCard(Value.Ace, Suite.Spade);
    const cardPoint = getCardPoint(cardEncoding, aceOfSpades);
    if (!cardPoint) throw new Error("Could not get card point");
    testCard = cardPoint;
  });

  it("should mask and verify card masking", async () => {
    const maskingFactor = randScalar();
    const [maskedCard, proof] = await protocol.mask(pp, sharedKey, testCard, maskingFactor);
    
    expect(maskedCard).toBeDefined();
    expect(proof).toBeDefined();
    
    const isValid = await protocol.verifyMask(pp, sharedKey, testCard, maskedCard, proof);
    expect(isValid).toBe(true);
  });

  it("should remask and verify card remasking", async () => {
    const maskingFactor = randScalar();
    const [maskedCard] = await protocol.mask(pp, sharedKey, testCard, maskingFactor);
    
    const remaskingFactor = randScalar();
    const [remaskedCard, proof] = await protocol.remask(pp, sharedKey, maskedCard, remaskingFactor);
    
    expect(remaskedCard).toBeDefined();
    expect(proof).toBeDefined();
    
    const isValid = await protocol.verifyRemask(pp, sharedKey, maskedCard, remaskedCard, proof);
    expect(isValid).toBe(true);
  });

  it("should compute and verify reveal tokens", async () => {
    const player = new TestPlayer("Alice");
    await player.initialize(protocol, pp);
    
    const maskingFactor = randScalar();
    const [maskedCard] = await protocol.mask(pp, sharedKey, testCard, maskingFactor);
    
    if (!player.sk || !player.pk) throw new Error("Player not initialized");
    const [revealToken, proof] = await protocol.computeRevealToken(pp, player.sk, player.pk, maskedCard);
    
    expect(revealToken).toBeDefined();
    expect(proof).toBeDefined();
    
    const isValid = await protocol.verifyReveal(pp, player.pk, revealToken, maskedCard, proof);
    expect(isValid).toBe(true);
  });
});

describe("Mental Poker Protocol - Card Shuffling", () => {
  let protocol: DLCards;
  let pp: Parameters;
  let sharedKey: AggregatePublicKey;
  let cardEncoding: CardEncoding;
  let maskedDeck: MaskedCard[];

  beforeAll(async () => {
    protocol = DLCards.getInstance();
    pp = await protocol.setup(createDeckSize(2), createPlayerId(4));
    cardEncoding = encodeStandardDeck();
    
    // Create test players and aggregate key
    const players = [
      new TestPlayer("Alice"),
      new TestPlayer("Bob")
    ];
    
    for (const player of players) {
      await player.initialize(protocol, pp);
    }
    
    const keyProofInfo = await Promise.all(
      players.map(async (player) => {
        if (!player.pk || !player.sk) throw new Error("Player not initialized");
        const playerInfo = new TextEncoder().encode(player.name);
        const proof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo);
        return [player.pk, proof, playerInfo] as const;
      })
    );
    
    sharedKey = await protocol.computeAggregateKey(pp, keyProofInfo);
    
    // Create a small test deck
    const testCards = [
      createClassicCard(Value.Ace, Suite.Spade),
      createClassicCard(Value.King, Suite.Heart),
      createClassicCard(Value.Queen, Suite.Diamond),
      createClassicCard(Value.Jack, Suite.Club)
    ];
    
    maskedDeck = [];
    for (const card of testCards) {
      const cardPoint = getCardPoint(cardEncoding, card);
      if (!cardPoint) throw new Error("Could not get card point");
      
      const maskingFactor = randScalar();
      const [maskedCard] = await protocol.mask(pp, sharedKey, cardPoint, maskingFactor);
      maskedDeck.push(maskedCard);
    }
  });

  it("should shuffle and verify deck", async () => {
    const permutation = createPermutation([2, 0, 3, 1]); // Shuffle order
    const maskingFactors = Array.from({ length: maskedDeck.length }, () => randScalar());
    
    const [shuffledDeck, proof] = await protocol.shuffleAndRemask(
      pp,
      sharedKey,
      maskedDeck,
      maskingFactors,
      permutation
    );
    
    expect(shuffledDeck).toHaveLength(maskedDeck.length);
    expect(proof).toBeDefined();
    
    const isValid = await protocol.verifyShuffle(pp, sharedKey, maskedDeck, shuffledDeck, proof);
    expect(isValid).toBe(true);
  });

  it("should maintain deck size after shuffle", async () => {
    const permutation = createPermutation([1, 3, 0, 2]);
    const maskingFactors = Array.from({ length: maskedDeck.length }, () => randScalar());
    
    const [shuffledDeck] = await protocol.shuffleAndRemask(
      pp,
      sharedKey,
      maskedDeck,
      maskingFactors,
      permutation
    );
    
    expect(shuffledDeck).toHaveLength(maskedDeck.length);
  });

  it("should reject invalid permutations", async () => {
    const invalidPermutation = createPermutation([0, 1]); // Wrong size
    const maskingFactors = Array.from({ length: maskedDeck.length }, () => randScalar());
    
    await expect(
      protocol.shuffleAndRemask(pp, sharedKey, maskedDeck, maskingFactors, invalidPermutation)
    ).rejects.toThrow();
  });
});

describe("Mental Poker Protocol - Card Revealing", () => {
  let protocol: DLCards;
  let pp: Parameters;
  let players: TestPlayer[];
  let sharedKey: AggregatePublicKey;
  let cardEncoding: CardEncoding;

  beforeAll(async () => {
    protocol = DLCards.getInstance();
    pp = await protocol.setup(createDeckSize(2), createPlayerId(3));
    cardEncoding = encodeStandardDeck();
    
    players = [
      new TestPlayer("Alice"),
      new TestPlayer("Bob"),
      new TestPlayer("Charlie")
    ];
    
    for (const player of players) {
      await player.initialize(protocol, pp);
    }
    
    const keyProofInfo = await Promise.all(
      players.map(async (player) => {
        if (!player.pk || !player.sk) throw new Error("Player not initialized");
        const playerInfo = new TextEncoder().encode(player.name);
        const proof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo);
        return [player.pk, proof, playerInfo] as const;
      })
    );
    
    sharedKey = await protocol.computeAggregateKey(pp, keyProofInfo);
  });

  it("should reveal cards correctly with all player tokens", async () => {
    const aceOfSpades = createClassicCard(Value.Ace, Suite.Spade);
    const cardPoint = getCardPoint(cardEncoding, aceOfSpades);
    if (!cardPoint) throw new Error("Could not get card point");
    
    // Mask the card
    const maskingFactor = randScalar();
    const [maskedCard] = await protocol.mask(pp, sharedKey, cardPoint, maskingFactor);
    
    // All players compute reveal tokens
    const revealTokens: [RevealToken, ZKProofReveal, PlayerPublicKey][] = [];
    for (const player of players) {
      if (!player.sk || !player.pk) continue;
      const [token, proof] = await protocol.computeRevealToken(pp, player.sk, player.pk, maskedCard);
      revealTokens.push([token, proof, player.pk]);
    }
    
    // Unmask the card
    const unmaskedCard = await protocol.unmask(pp, revealTokens, maskedCard, cardEncoding);
    const revealedCard = getPlayingCard(cardEncoding, unmaskedCard.point);
    
    expect(revealedCard).toEqual(aceOfSpades);
  });

  it("should fail to reveal with insufficient tokens", async () => {
    const aceOfSpades = createClassicCard(Value.Ace, Suite.Spade);
    const cardPoint = getCardPoint(cardEncoding, aceOfSpades);
    if (!cardPoint) throw new Error("Could not get card point");
    
    const maskingFactor = randScalar();
    const [maskedCard] = await protocol.mask(pp, sharedKey, cardPoint, maskingFactor);
    
    // Get all reveal tokens for proper unmasking
    const allRevealTokens: [RevealToken, ZKProofReveal, PlayerPublicKey][] = [];
    for (const player of players) {
      if (player.sk && player.pk) {
        const [token, proof] = await protocol.computeRevealToken(pp, player.sk, player.pk, maskedCard);
        allRevealTokens.push([token, proof, player.pk]);
      }
    }
    
    // Verify that with all tokens, we can unmask correctly
    const correctCard = await protocol.unmask(pp, allRevealTokens, maskedCard, cardEncoding);
    expect(correctCard.point.x).toBe(cardPoint.point.x);
    expect(correctCard.point.y).toBe(cardPoint.point.y);
    
    // With only one player's token (insufficient), unmask succeeds but produces wrong result
    // This matches Rust behavior - partial reveals are allowed but produce incorrect cards
    const firstToken = allRevealTokens[0];
    if (!firstToken) throw new Error("No reveal tokens available");
    
    const partialRevealTokens = [firstToken];
    const partialCard = await protocol.unmask(pp, partialRevealTokens, maskedCard, cardEncoding);
    
    // The partially unmasked card should NOT match the original card
    expect(partialCard.point.x).not.toBe(cardPoint.point.x);
  });
});

describe("Mental Poker Protocol - Full Game Simulation", () => {
  let protocol: DLCards;
  let pp: Parameters;
  let players: TestPlayer[];
  let sharedKey: AggregatePublicKey;
  let cardEncoding: CardEncoding;

  beforeAll(async () => {
    protocol = DLCards.getInstance();
    pp = await protocol.setup(createDeckSize(2), createPlayerId(4));
    cardEncoding = encodeStandardDeck();
    
    players = [
      new TestPlayer("Alice"),
      new TestPlayer("Bob"),
      new TestPlayer("Charlie"),
      new TestPlayer("David")
    ];
    
    for (const player of players) {
      await player.initialize(protocol, pp);
    }
    
    const keyProofInfo = await Promise.all(
      players.map(async (player) => {
        if (!player.pk || !player.sk) throw new Error("Player not initialized");
        const playerInfo = new TextEncoder().encode(player.name);
        const proof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo);
        return [player.pk, proof, playerInfo] as const;
      })
    );
    
    sharedKey = await protocol.computeAggregateKey(pp, keyProofInfo);
  });

  it("should simulate a complete poker round", async () => {
    // Create initial deck with 4 cards
    const initialCards = [
      createClassicCard(Value.Ace, Suite.Spade),
      createClassicCard(Value.King, Suite.Heart),
      createClassicCard(Value.Queen, Suite.Diamond),
      createClassicCard(Value.Jack, Suite.Club)
    ];
    
    // Mask all cards
    let deck: MaskedCard[] = [];
    for (const card of initialCards) {
      const cardPoint = getCardPoint(cardEncoding, card);
      if (!cardPoint) throw new Error("Could not get card point");
      
      const maskingFactor = randScalar();
      const [maskedCard] = await protocol.mask(pp, sharedKey, cardPoint, maskingFactor);
      deck.push(maskedCard);
    }
    
    // Each player shuffles the deck
    for (let i = 0; i < players.length; i++) {
      const permutation = createPermutation([3, 1, 0, 2]); // Example shuffle
      const maskingFactors = Array.from({ length: deck.length }, () => randScalar());
      
      const [shuffledDeck, proof] = await protocol.shuffleAndRemask(
        pp,
        sharedKey,
        deck,
        maskingFactors,
        permutation
      );
      
      // Verify shuffle
      const isValid = await protocol.verifyShuffle(pp, sharedKey, deck, shuffledDeck, proof);
      expect(isValid).toBe(true);
      
      deck = Array.from(shuffledDeck);
    }
    
    // Deal cards to players
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const card = deck[i];
      if (!player || !card) continue;
      player.receiveCard(card);
    }
    
    // Players reveal their cards
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerCard = deck[i];
      if (!player || !playerCard) continue;
      
      // All players compute reveal tokens for this card
      const revealTokens: [RevealToken, ZKProofReveal, PlayerPublicKey][] = [];
      for (const p of players) {
        if (!p.sk || !p.pk) continue;
        const [token, proof] = await protocol.computeRevealToken(pp, p.sk, p.pk, playerCard);
        revealTokens.push([token, proof, p.pk]);
      }
      
      // Reveal the card
      const revealedCard = await player.revealCard(protocol, pp, playerCard, revealTokens, cardEncoding);
      expect(revealedCard).toBeDefined();
      expect(initialCards.some(card => 
        card.value === revealedCard.value && card.suite === revealedCard.suite
      )).toBe(true);
    }
    
    // Verify all players have revealed cards
    for (const player of players) {
      expect(player.revealedCards).toHaveLength(1);
    }
  });
});

describe("Mental Poker Protocol - Security Properties", () => {
  let protocol: DLCards;
  let pp: Parameters;
  let cardEncoding: CardEncoding;

  beforeAll(async () => {
    protocol = DLCards.getInstance();
    pp = await protocol.setup(createDeckSize(2), createPlayerId(4));
    cardEncoding = encodeStandardDeck();
  });

  it("should maintain card privacy until revealed", async () => {
    const players = [new TestPlayer("Alice"), new TestPlayer("Bob")];
    for (const player of players) {
      await player.initialize(protocol, pp);
    }
    
    const keyProofInfo = await Promise.all(
      players.map(async (player) => {
        if (!player.pk || !player.sk) throw new Error("Player not initialized");
        const playerInfo = new TextEncoder().encode(player.name);
        const proof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo);
        return [player.pk, proof, playerInfo] as const;
      })
    );
    
    const sharedKey = await protocol.computeAggregateKey(pp, keyProofInfo);
    
    const aceOfSpades = createClassicCard(Value.Ace, Suite.Spade);
    const cardPoint = getCardPoint(cardEncoding, aceOfSpades);
    if (!cardPoint) throw new Error("Could not get card point");
    
    // Mask the card
    const maskingFactor = randScalar();
    const [maskedCard] = await protocol.mask(pp, sharedKey, cardPoint, maskingFactor);
    
    // Masked card should not reveal the original card
    expect(maskedCard.ciphertext).not.toEqual(cardPoint.point);
    expect(maskedCard.randomness).not.toEqual(cardPoint.point);
    
    // Without reveal tokens, card cannot be unmasked
    await expect(
      protocol.unmask(pp, [], maskedCard, cardEncoding)
    ).rejects.toThrow();
  });

  it("should verify zero-knowledge proofs correctly", async () => {
    const player = new TestPlayer("Alice");
    await player.initialize(protocol, pp);
    
    if (!player.pk || !player.sk) throw new Error("Player not initialized");
    
    // Test key ownership proof
    const playerInfo = new TextEncoder().encode(player.name);
    const keyProof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo);
    const keyValid = await protocol.verifyKeyOwnership(pp, player.pk, playerInfo, keyProof);
    expect(keyValid).toBe(true);
    
    // Test with wrong player info
    const wrongInfo = new TextEncoder().encode("Wrong Name");
    const wrongKeyValid = await protocol.verifyKeyOwnership(pp, player.pk, wrongInfo, keyProof);
    expect(wrongKeyValid).toBe(false);
  });

  it("should validate permutations correctly", () => {
    // Valid permutation
    const validPerm = createPermutation([2, 0, 1, 3]);
    expect(validPerm.size).toBe(4);
    expect(validPerm.mapping).toEqual([2, 0, 1, 3]);
    
    // Invalid permutation (duplicate)
    expect(() => createPermutation([0, 1, 1, 3])).toThrow();
    
    // Invalid permutation (out of range)
    expect(() => createPermutation([0, 1, 2, 4])).toThrow();
  });
});

describe("Mental Poker Protocol - Error Handling", () => {
  let protocol: DLCards;

  beforeAll(() => {
    protocol = DLCards.getInstance();
  });

  it("should handle invalid setup parameters", async () => {
    // Test invalid deck size
    expect(() => createDeckSize(0)).toThrow();
    expect(() => createDeckSize(-1)).toThrow();
    
    // Test invalid player count
    expect(() => createPlayerId(0)).toThrow();
    expect(() => createPlayerId(-1)).toThrow();
  });

  it("should handle cryptographic errors gracefully", async () => {
    const pp = await protocol.setup(createDeckSize(2), createPlayerId(4));
    
    // Test with completely invalid parameters structure
    const invalidPp = { ...pp, generators: null as any };
    
    await expect(
      protocol.playerKeygen(invalidPp)
    ).rejects.toThrow();
  });
}); 