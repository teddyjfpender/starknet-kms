import {
  DLCards,
  createDeckSize,
  createPlayerId,
  createPermutation,
  Suite,
  Value,
  createClassicCard,
  formatCard,
  encodeStandardDeck,
  getCardPoint,
  getPlayingCard,
  type Parameters,
  type PlayerPublicKey,
  type PlayerSecretKey,
  type MaskedCard,
  type RevealToken,
  type ZKProofReveal,
} from "../src";
import { randScalar } from "@starkms/crypto";

/**
 * Example player for mental poker game
 */
class Player {
  public pk: PlayerPublicKey | null = null;
  public sk: PlayerSecretKey | null = null;
  public cards: MaskedCard[] = [];

  constructor(public readonly name: string) {}

  async initialize(protocol: DLCards, pp: Parameters): Promise<void> {
    const [pk, sk] = await protocol.playerKeygen(pp);
    this.pk = pk;
    this.sk = sk;
  }

  async proveKeyOwnership(protocol: DLCards, pp: Parameters) {
    if (!this.pk || !this.sk) throw new Error("Player not initialized");
    const playerInfo = new TextEncoder().encode(this.name);
    return protocol.proveKeyOwnership(pp, this.pk, this.sk, playerInfo);
  }

  receiveCard(card: MaskedCard): void {
    this.cards.push(card);
  }

  async computeRevealToken(protocol: DLCards, pp: Parameters, card: MaskedCard) {
    if (!this.pk || !this.sk) throw new Error("Player not initialized");
    return protocol.computeRevealToken(pp, this.sk, this.pk, card);
  }
}

/**
 * Demonstrates a complete mental poker game round
 */
async function demonstrateMentalPoker() {
  console.log("🃏 Mental Poker Protocol Demonstration");
  console.log("=====================================\n");

  // 1. Setup protocol parameters
  console.log("1. Setting up protocol parameters...");
  const protocol = DLCards.getInstance();
  const pp = await protocol.setup(createDeckSize(4), createPlayerId(3));
  console.log("✓ Protocol parameters created\n");

  // 2. Create card encoding
  console.log("2. Creating card encoding...");
  const cardEncoding = encodeStandardDeck();
  console.log("✓ Standard 52-card deck encoded to curve points\n");

  // 3. Initialize players
  console.log("3. Initializing players...");
  const players = [
    new Player("Alice"),
    new Player("Bob"),
    new Player("Charlie")
  ];

  for (const player of players) {
    await player.initialize(protocol, pp);
    console.log(`✓ ${player.name} initialized with key pair`);
  }
  console.log();

  // 4. Prove key ownership and compute aggregate key
  console.log("4. Proving key ownership and computing aggregate key...");
  const keyProofInfo = await Promise.all(
    players.map(async (player) => {
      const proof = await player.proveKeyOwnership(protocol, pp);
      const playerInfo = new TextEncoder().encode(player.name);
      return [player.pk!, proof, playerInfo] as const;
    })
  );

  const aggregateKey = await protocol.computeAggregateKey(pp, keyProofInfo);
  console.log("✓ All key ownership proofs verified");
  console.log("✓ Aggregate public key computed\n");

  // 5. Create and mask initial deck
  console.log("5. Creating and masking initial deck...");
  const initialCards = [
    createClassicCard(Value.Ace, Suite.Spade),
    createClassicCard(Value.King, Suite.Heart),
    createClassicCard(Value.Queen, Suite.Diamond),
    createClassicCard(Value.Jack, Suite.Club)
  ];

  let deck: MaskedCard[] = [];
  for (const card of initialCards) {
    const cardPoint = getCardPoint(cardEncoding, card);
    if (!cardPoint) throw new Error("Could not encode card");
    
    const maskingFactor = randScalar();
    const [maskedCard, proof] = await protocol.mask(pp, aggregateKey, cardPoint, maskingFactor);
    
    // Verify masking proof
    const isValid = await protocol.verifyMask(pp, aggregateKey, cardPoint, maskedCard, proof);
    if (!isValid) throw new Error("Invalid masking proof");
    
    deck.push(maskedCard);
    console.log(`✓ ${formatCard(card)} masked and verified`);
  }
  console.log();

  // 6. Shuffle the deck (each player shuffles)
  console.log("6. Shuffling deck...");
  for (let i = 0; i < players.length; i++) {
    const permutation = createPermutation([2, 0, 3, 1]); // Example shuffle
    const maskingFactors = Array.from({ length: deck.length }, () => randScalar());
    
    const [shuffledDeck, shuffleProof] = await protocol.shuffleAndRemask(
      pp,
      aggregateKey,
      deck,
      maskingFactors,
      permutation
    );
    
    // Verify shuffle
    const isValid = await protocol.verifyShuffle(pp, aggregateKey, deck, shuffledDeck, shuffleProof);
    if (!isValid) throw new Error("Invalid shuffle proof");
    
    deck = Array.from(shuffledDeck);
    console.log(`✓ ${players[i]?.name ?? "Unknown player"} shuffled and verified`);
  }
  console.log();

  // 7. Deal cards to players
  console.log("7. Dealing cards...");
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const card = deck[i];
    if (!player || !card) throw new Error(`Missing player or card at index ${i}`);
    
    player.receiveCard(card);
    console.log(`✓ ${player.name} received a card`);
  }
  console.log();

  // 8. Reveal cards
  console.log("8. Revealing cards...");
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const playerCard = deck[i];
    if (!player || !playerCard) throw new Error(`Missing player or card at index ${i}`);
    
    // All players compute reveal tokens for this card
    const revealTokens: [RevealToken, ZKProofReveal, PlayerPublicKey][] = [];
    for (const p of players) {
      const [token, proof] = await p.computeRevealToken(protocol, pp, playerCard);
      revealTokens.push([token, proof, p.pk!]);
    }
    
    // Verify all reveal token proofs
    for (const [token, proof, pk] of revealTokens) {
      const isValid = await protocol.verifyReveal(pp, pk, token, playerCard, proof);
      if (!isValid) throw new Error("Invalid reveal token proof");
    }
    
    // Unmask the card
    const unmaskedCard = await protocol.unmask(pp, revealTokens, playerCard, cardEncoding);
    const revealedCard = getPlayingCard(cardEncoding, unmaskedCard.point);
    
    if (!revealedCard) throw new Error("Could not decode revealed card");
    
    console.log(`✓ ${player.name}'s card: ${formatCard(revealedCard)}`);
  }
  console.log();

  console.log("🎉 Mental poker round completed successfully!");
  console.log("All cryptographic proofs verified ✓");
  console.log("Cards remained private until revealed ✓");
  console.log("No trusted dealer required ✓");
}

// Run the demonstration
demonstrateMentalPoker().catch(console.error); 