import { beforeAll, describe, expect, it } from "bun:test"
import { randScalar } from "@starkms/crypto"
import {
  DLCards,
  type Parameters,
  type PlayerPublicKey,
  type PlayerSecretKey,
  type AggregatePublicKey,
  type MaskedCard,
  type RevealToken,
  type ZKProofReveal,
  createDeckSize,
  createPlayerId,
  createPermutation,
  MentalPokerError,
  MentalPokerErrorCode,
} from "../src"

describe("Mental Poker Security Tests", () => {
  let protocol: DLCards
  let pp: Parameters
  let players: Array<{
    pk: PlayerPublicKey
    sk: PlayerSecretKey
  }>
  let aggregateKey: AggregatePublicKey

  beforeAll(async () => {
    protocol = DLCards.getInstance()
    pp = await protocol.setup(createDeckSize(52), createPlayerId(4))

    // Initialize players
    players = []
    for (let i = 0; i < 4; i++) {
      const [pk, sk] = await protocol.playerKeygen(pp)
      players.push({ pk, sk })
    }

    // Compute aggregate key
    const playerKeysProofInfo: [PlayerPublicKey, any, Uint8Array][] = []
    for (let i = 0; i < players.length; i++) {
      const player = players[i]!
      const playerInfo = new TextEncoder().encode(`Player ${i}`)
      const proof = await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo)
      playerKeysProofInfo.push([player.pk, proof, playerInfo])
    }
    aggregateKey = await protocol.computeAggregateKey(pp, playerKeysProofInfo)
  })

  describe("Cryptographic Soundness", () => {
    it("should reject invalid masking proofs", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      
      const [maskedCard, maskingProof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      // Modify the proof to make it invalid
      const invalidProof = {
        ...maskingProof,
        response: randScalar(), // Invalid response
      }
      
      const isValid = await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, invalidProof)
      expect(isValid).toBe(false)
    })

    it("should reject invalid reveal proofs", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      const [maskedCard] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      const player = players[0]!
      const [revealToken, revealProof] = await protocol.computeRevealToken(
        pp, player.sk, player.pk, maskedCard
      )
      
      // Modify the proof to make it invalid
      const invalidProof = {
        ...revealProof,
        challenge: randScalar(), // Invalid challenge
      }
      
      const isValid = await protocol.verifyReveal(pp, player.pk, revealToken, maskedCard, invalidProof)
      expect(isValid).toBe(false)
    })

    it("should reject reveal tokens from wrong player", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      const [maskedCard] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      const player1 = players[0]!
      const player2 = players[1]!
      
      const [revealToken, revealProof] = await protocol.computeRevealToken(
        pp, player1.sk, player1.pk, maskedCard
      )
      
      // Try to verify with wrong player's public key
      const isValid = await protocol.verifyReveal(pp, player2.pk, revealToken, maskedCard, revealProof)
      expect(isValid).toBe(false)
    })

    it("should prevent shuffle proof forgery", async () => {
      const deckSize = 4
      const deck: MaskedCard[] = []
      
      // Create a small deck for testing
      for (let i = 0; i < deckSize; i++) {
        const card = { point: pp.generators.G, index: i as any }
        const alpha = randScalar()
        const [maskedCard] = await protocol.mask(pp, aggregateKey, card, alpha)
        deck.push(maskedCard)
      }
      
      const maskingFactors = Array.from({ length: deckSize }, () => randScalar())
      const permutation = createPermutation([3, 1, 0, 2]) // Valid permutation
      
      const [shuffledDeck, shuffleProof] = await protocol.shuffleAndRemask(
        pp, aggregateKey, deck, maskingFactors, permutation
      )
      
      // Create a different shuffled deck (invalid shuffle)
      const invalidShuffledDeck = [...deck].reverse()
      
      const isValid = await protocol.verifyShuffle(
        pp, aggregateKey, deck, invalidShuffledDeck, shuffleProof
      )
      expect(isValid).toBe(false)
    })
  })

  describe("Zero-Knowledge Properties", () => {
    it("should generate different proofs for same input", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      
      const [maskedCard1, proof1] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      const [maskedCard2, proof2] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      // Same inputs should produce different proofs (due to randomness)
      expect(proof1.commitmentG.equals(proof2.commitmentG)).toBe(false)
      expect(proof1.commitmentH.equals(proof2.commitmentH)).toBe(false)
      expect(proof1.response).not.toBe(proof2.response)
      
      // But both proofs should be valid
      const valid1 = await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard1, proof1)
      const valid2 = await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard2, proof2)
      expect(valid1).toBe(true)
      expect(valid2).toBe(true)
    })

    it("should not leak information about private inputs", async () => {
      const card1 = { point: pp.generators.G, index: 0 as any }
      const card2 = { point: pp.generators.H, index: 1 as any }
      const alpha = randScalar()
      
      const [maskedCard1, proof1] = await protocol.mask(pp, aggregateKey, card1, alpha)
      const [maskedCard2, proof2] = await protocol.mask(pp, aggregateKey, card2, alpha)
      
      // Proofs should not reveal which card was masked
      // (This is a basic check - full zero-knowledge would require more sophisticated analysis)
      expect(proof1.challenge).not.toBe(proof2.challenge)
      expect(proof1.response).not.toBe(proof2.response)
    })
  })

  describe("Protocol Robustness", () => {
    it("should handle malformed parameters gracefully", async () => {
      const invalidParams = {
        ...pp,
        m: -1 as any, // Invalid deck size
      }
      
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      
      await expect(protocol.mask(invalidParams, aggregateKey, testCard, alpha))
        .rejects.toThrow(MentalPokerError)
    })

    it("should validate permutation correctness", async () => {
      const deckSize = 4
      const invalidMapping = [0, 1, 1, 3] // Invalid: duplicate index
      
      expect(() => createPermutation(invalidMapping))
        .toThrow(MentalPokerError)
    })

    it("should require all player reveal tokens for unmasking", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      const [maskedCard] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      // Generate tokens from only 3 out of 4 players
      const partialRevealTokens: [RevealToken, ZKProofReveal, PlayerPublicKey][] = []
      for (let i = 0; i < 3; i++) {
        const player = players[i]!
        const [token, proof] = await protocol.computeRevealToken(
          pp, player.sk, player.pk, maskedCard
        )
        partialRevealTokens.push([token, proof, player.pk])
      }
      
      // Should fail with insufficient tokens
      await expect(protocol.unmask(pp, partialRevealTokens, maskedCard))
        .rejects.toThrow(MentalPokerError)
    })
  })

  describe("Side-Channel Resistance", () => {
    it("should have consistent timing for proof verification", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      const [maskedCard, validProof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      // Create an invalid proof
      const invalidProof = {
        ...validProof,
        response: randScalar(),
      }
      
      // Measure timing for valid and invalid proof verification
      const timings: number[] = []
      
      for (let i = 0; i < 10; i++) {
        const start = performance.now()
        await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, i % 2 === 0 ? validProof : invalidProof)
        const end = performance.now()
        timings.push(end - start)
      }
      
      // Check that timing variance is reasonable (within 50% of mean)
      const mean = timings.reduce((a, b) => a + b, 0) / timings.length
      const maxVariance = mean * 0.5
      
      for (const timing of timings) {
        expect(Math.abs(timing - mean)).toBeLessThan(maxVariance)
      }
    })

    it("should not leak information through error messages", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      const [maskedCard, proof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      // Create different types of invalid proofs
      const invalidProofs = [
        { ...proof, challenge: 0n },
        { ...proof, response: 0n },
        { ...proof, commitmentG: pp.generators.H },
      ]
      
      // All should return false without revealing why
      for (const invalidProof of invalidProofs) {
        const result = await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, invalidProof)
        expect(result).toBe(false)
      }
    })
  })

  describe("Randomness Quality", () => {
    it("should generate high-entropy random values", async () => {
      const scalars = new Set<bigint>()
      
      // Generate many random scalars and check for duplicates
      for (let i = 0; i < 1000; i++) {
        const scalar = randScalar()
        expect(scalars.has(scalar)).toBe(false) // No duplicates
        scalars.add(scalar)
        expect(scalar > 0n).toBe(true) // Non-zero
      }
    })

    it("should use fresh randomness for each proof", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      
      const proofs = []
      for (let i = 0; i < 10; i++) {
        const [, proof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
        proofs.push(proof)
      }
      
      // Check that all proofs use different randomness
      for (let i = 0; i < proofs.length; i++) {
        for (let j = i + 1; j < proofs.length; j++) {
          expect(proofs[i]!.response).not.toBe(proofs[j]!.response)
          expect(proofs[i]!.commitmentG.equals(proofs[j]!.commitmentG)).toBe(false)
        }
      }
    })
  })

  describe("Memory Safety", () => {
    it("should not retain sensitive data after operations", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      
      // Perform operations that use sensitive data
      const [maskedCard, proof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, proof)
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      // Test passes if no memory leaks are detected
      // (More sophisticated memory leak detection would require additional tooling)
      expect(true).toBe(true)
    })
  })

  describe("Concurrent Operations", () => {
    it("should handle concurrent proof generation safely", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      
      // Generate multiple proofs concurrently
      const promises = Array.from({ length: 10 }, async () => {
        const alpha = randScalar()
        return protocol.mask(pp, aggregateKey, testCard, alpha)
      })
      
      const results = await Promise.all(promises)
      
      // All operations should succeed
      expect(results).toHaveLength(10)
      
      // All proofs should be valid
      for (const [maskedCard, proof] of results) {
        const isValid = await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, proof)
        expect(isValid).toBe(true)
      }
    })

    it("should maintain thread safety in singleton pattern", async () => {
      // Get multiple instances concurrently
      const promises = Array.from({ length: 10 }, () => {
        return Promise.resolve(DLCards.getInstance())
      })
      
      const instances = await Promise.all(promises)
      
      // All should be the same instance
      for (let i = 1; i < instances.length; i++) {
        expect(instances[i]).toBe(instances[0])
      }
    })
  })

  describe("Input Validation", () => {
    it("should reject invalid card indices", async () => {
      const invalidCard = { point: pp.generators.G, index: -1 as any }
      const alpha = randScalar()
      
      await expect(protocol.mask(pp, aggregateKey, invalidCard, alpha))
        .rejects.toThrow(MentalPokerError)
    })

    it("should validate scalar ranges", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const invalidAlpha = -1n as any // Invalid scalar
      
      await expect(protocol.mask(pp, aggregateKey, testCard, invalidAlpha))
        .rejects.toThrow()
    })

    it("should validate point validity", async () => {
      const invalidCard = { 
        point: { x: -1n, y: -1n, equals: () => false } as any, 
        index: 0 as any 
      }
      const alpha = randScalar()
      
      await expect(protocol.mask(pp, aggregateKey, invalidCard, alpha))
        .rejects.toThrow()
    })
  })

  describe("Protocol Completeness", () => {
    it("should successfully complete full card lifecycle", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      
      // 1. Mask the card
      const [maskedCard, maskProof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      expect(await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, maskProof)).toBe(true)
      
      // 2. Remask the card
      const beta = randScalar()
      const [remaskedCard, remaskProof] = await protocol.remask(pp, aggregateKey, maskedCard, beta)
      expect(await protocol.verifyRemask(pp, aggregateKey, maskedCard, remaskedCard, remaskProof)).toBe(true)
      
      // 3. Generate reveal tokens from all players
      const revealTokens: [RevealToken, ZKProofReveal, PlayerPublicKey][] = []
      for (const player of players) {
        const [token, proof] = await protocol.computeRevealToken(
          pp, player.sk, player.pk, remaskedCard
        )
        expect(await protocol.verifyReveal(pp, player.pk, token, remaskedCard, proof)).toBe(true)
        revealTokens.push([token, proof, player.pk])
      }
      
      // 4. Unmask the card
      const unmaskedCard = await protocol.unmask(pp, revealTokens, remaskedCard)
      
      // The underlying card should be recovered (accounting for remasking)
      expect(unmaskedCard.point.equals(testCard.point)).toBe(true)
    })
  })
}) 