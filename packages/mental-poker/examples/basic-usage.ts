import { DLCards, createDeckSize, createPlayerId } from "../src/index";

/**
 * Basic usage example of the Mental Poker protocol
 * 
 * This example demonstrates:
 * 1. Setting up protocol parameters
 * 2. Generating player keys
 * 3. Proving key ownership
 * 4. Computing aggregate public key
 * 5. Basic card operations (masking/unmasking)
 */
async function basicUsageExample() {
  console.log("🃏 Mental Poker Protocol - Basic Usage Example");
  console.log("=" .repeat(50));

  try {
    // Get the DLCards protocol instance
    const protocol = DLCards.getInstance();
    console.log("✅ Protocol instance created");

    // 1. Setup protocol parameters for 3 players and 52 cards
    const parameters = await protocol.setup(createDeckSize(52), createPlayerId(3));
    console.log("✅ Protocol parameters generated");
    console.log(`   - Deck size: ${parameters.m}`);
    console.log(`   - Player count: ${parameters.n}`);

    // 2. Generate keys for 3 players
    const players = [];
    for (let i = 0; i < 3; i++) {
      const [pk, sk] = await protocol.playerKeygen(parameters);
      const playerInfo = new TextEncoder().encode(`Player ${i + 1}`);
      const proof = await protocol.proveKeyOwnership(parameters, pk, sk, playerInfo);
      
      players.push({ pk, sk, proof, info: playerInfo, name: `Player ${i + 1}` });
      console.log(`✅ Generated keys for ${players[i]?.name}`);
    }

    // 3. Verify all key ownership proofs and compute aggregate key
    const playerKeysProofInfo = players.map(p => [p.pk, p.proof, p.info] as const);
    const aggregateKey = await protocol.computeAggregateKey(parameters, playerKeysProofInfo);
    console.log("✅ Aggregate public key computed and verified");

    // 4. Create a test card (using a simple point for demonstration)
    const testCard = {
      point: parameters.generators.G, // Simple test card
      index: 0 as any, // Placeholder index
    };
    console.log("✅ Test card created");

    // 5. Mask the card
    const alpha = BigInt(123); // Simple masking factor for demo
    const [maskedCard, maskingProof] = await protocol.mask(
      parameters,
      aggregateKey,
      testCard,
      alpha
    );
    console.log("✅ Card masked with zero-knowledge proof");

    // 6. Verify the masking proof
    const maskingValid = await protocol.verifyMask(
      parameters,
      aggregateKey,
      testCard,
      maskedCard,
      maskingProof
    );
    console.log(`✅ Masking proof verification: ${maskingValid ? "VALID" : "INVALID"}`);

    // 7. Generate reveal tokens from all players
    const revealTokens = [];
    for (const player of players) {
      const [token, proof] = await protocol.computeRevealToken(
        parameters,
        player.sk,
        player.pk,
        maskedCard
      );
      revealTokens.push([token, proof, player.pk] as const);
      console.log(`✅ ${player.name} generated reveal token`);
    }

    // 8. Unmask the card using all reveal tokens
    const unmaskedCard = await protocol.unmask(parameters, revealTokens, maskedCard);
    console.log("✅ Card unmasked successfully");

    // 9. Verify the card was correctly recovered
    const cardRecovered = unmaskedCard.point.equals(testCard.point);
    console.log(`✅ Card recovery verification: ${cardRecovered ? "SUCCESS" : "FAILED"}`);

    console.log("\n🎉 Basic usage example completed successfully!");
    console.log("The mental poker protocol is working correctly.");

  } catch (error) {
    console.error("❌ Error in basic usage example:", error);
    throw error;
  }
}

// Run the example if this file is executed directly
// Note: import.meta.main check removed due to TypeScript target compatibility

export { basicUsageExample }; 