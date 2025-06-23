import { beforeAll, describe, expect, it } from "bun:test"
import { randScalar } from "@starkms/crypto"
import {
  DLCards,
  type Parameters,
  type PlayerPublicKey,
  type PlayerSecretKey,
  type AggregatePublicKey,
  type MaskedCard,
  createDeckSize,
  createPlayerId,
  createPermutation,
  encodeStandardDeck,
} from "../src"

describe("Mental Poker Performance Benchmarks", () => {
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

  describe("Setup Performance", () => {
    it("should setup protocol within reasonable time", async () => {
      const start = performance.now()
      await protocol.setup(createDeckSize(52), createPlayerId(6))
      const end = performance.now()
      
      const setupTime = end - start
      console.log(`Protocol setup time: ${setupTime.toFixed(2)}ms`)
      
      // Should complete within 1 second for reasonable parameters
      expect(setupTime).toBeLessThan(1000)
    })

    it("should scale reasonably with player count", async () => {
      const playerCounts = [2, 4, 6, 8]
      const times: number[] = []
      
      for (const playerCount of playerCounts) {
        const start = performance.now()
        await protocol.setup(createDeckSize(52), createPlayerId(playerCount))
        const end = performance.now()
        times.push(end - start)
      }
      
      console.log("Setup times by player count:", times.map((t, i) => 
        `${playerCounts[i]} players: ${t.toFixed(2)}ms`
      ).join(", "))
      
      // Should scale sub-quadratically
      expect(times[3]! / times[0]!).toBeLessThan(16) // Less than O(n^2)
    })
  })

  describe("Key Generation Performance", () => {
    it("should generate player keys quickly", async () => {
      const iterations = 100
      const start = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        await protocol.playerKeygen(pp)
      }
      
      const end = performance.now()
      const avgTime = (end - start) / iterations
      
      console.log(`Average key generation time: ${avgTime.toFixed(2)}ms`)
      
      // Should generate keys in under 10ms each
      expect(avgTime).toBeLessThan(10)
    })

    it("should prove key ownership efficiently", async () => {
      const player = players[0]!
      const playerInfo = new TextEncoder().encode("Test Player")
      const iterations = 50
      
      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        await protocol.proveKeyOwnership(pp, player.pk, player.sk, playerInfo)
      }
      const end = performance.now()
      
      const avgTime = (end - start) / iterations
      console.log(`Average key ownership proof time: ${avgTime.toFixed(2)}ms`)
      
      // Should prove ownership in under 50ms
      expect(avgTime).toBeLessThan(50)
    })
  })

  describe("Card Operations Performance", () => {
    it("should mask cards efficiently", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const iterations = 100
      
      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        const alpha = randScalar()
        await protocol.mask(pp, aggregateKey, testCard, alpha)
      }
      const end = performance.now()
      
      const avgTime = (end - start) / iterations
      console.log(`Average card masking time: ${avgTime.toFixed(2)}ms`)
      
      // Should mask cards in under 20ms each
      expect(avgTime).toBeLessThan(20)
    })

    it("should verify masking proofs quickly", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      const [maskedCard, proof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      const iterations = 100
      const start = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, proof)
      }
      
      const end = performance.now()
      const avgTime = (end - start) / iterations
      
      console.log(`Average masking proof verification time: ${avgTime.toFixed(2)}ms`)
      
      // Should verify proofs in under 15ms each
      expect(avgTime).toBeLessThan(15)
    })

    it("should handle reveal token generation efficiently", async () => {
      const testCard = { point: pp.generators.G, index: 0 as any }
      const alpha = randScalar()
      const [maskedCard] = await protocol.mask(pp, aggregateKey, testCard, alpha)
      
      const player = players[0]!
      const iterations = 50
      
      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        await protocol.computeRevealToken(pp, player.sk, player.pk, maskedCard)
      }
      const end = performance.now()
      
      const avgTime = (end - start) / iterations
      console.log(`Average reveal token generation time: ${avgTime.toFixed(2)}ms`)
      
      // Should generate reveal tokens in under 25ms each
      expect(avgTime).toBeLessThan(25)
    })
  })

  describe("Shuffle Performance", () => {
    it("should shuffle small decks quickly", async () => {
      const deckSize = 8
      const deck: MaskedCard[] = []
      
      // Create test deck
      for (let i = 0; i < deckSize; i++) {
        const card = { point: pp.generators.G, index: i as any }
        const alpha = randScalar()
        const [maskedCard] = await protocol.mask(pp, aggregateKey, card, alpha)
        deck.push(maskedCard)
      }
      
      const maskingFactors = Array.from({ length: deckSize }, () => randScalar())
      const permutation = createPermutation([7, 3, 1, 5, 0, 2, 6, 4])
      
      const start = performance.now()
      await protocol.shuffleAndRemask(pp, aggregateKey, deck, maskingFactors, permutation)
      const end = performance.now()
      
      const shuffleTime = end - start
      console.log(`8-card shuffle time: ${shuffleTime.toFixed(2)}ms`)
      
      // Should shuffle 8 cards in under 2 seconds
      expect(shuffleTime).toBeLessThan(2000)
    })

    it("should verify shuffle proofs in reasonable time", async () => {
      const deckSize = 4
      const deck: MaskedCard[] = []
      
      // Create smaller test deck for faster testing
      for (let i = 0; i < deckSize; i++) {
        const card = { point: pp.generators.G, index: i as any }
        const alpha = randScalar()
        const [maskedCard] = await protocol.mask(pp, aggregateKey, card, alpha)
        deck.push(maskedCard)
      }
      
      const maskingFactors = Array.from({ length: deckSize }, () => randScalar())
      const permutation = createPermutation([3, 1, 0, 2])
      
      const [shuffledDeck, proof] = await protocol.shuffleAndRemask(
        pp, aggregateKey, deck, maskingFactors, permutation
      )
      
      const start = performance.now()
      await protocol.verifyShuffle(pp, aggregateKey, deck, shuffledDeck, proof)
      const end = performance.now()
      
      const verifyTime = end - start
      console.log(`4-card shuffle verification time: ${verifyTime.toFixed(2)}ms`)
      
      // Should verify shuffle in under 1 second
      expect(verifyTime).toBeLessThan(1000)
    })
  })

  describe("Full Game Simulation Performance", () => {
    it("should complete a poker hand in reasonable time", async () => {
      const cardEncoding = encodeStandardDeck()
      const numCards = 7 // 2 hole cards + 5 community cards per player
      
      const start = performance.now()
      
      // 1. Create and mask initial deck
      const deck: MaskedCard[] = []
      for (let i = 0; i < numCards; i++) {
        const card = { point: pp.generators.G, index: i as any }
        const alpha = randScalar()
        const [maskedCard] = await protocol.mask(pp, aggregateKey, card, alpha)
        deck.push(maskedCard)
      }
      
      // 2. Shuffle the deck
      const maskingFactors = Array.from({ length: numCards }, () => randScalar())
      const shuffleMapping = Array.from({ length: numCards }, (_, i) => i)
      // Simple shuffle for testing
      for (let i = shuffleMapping.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffleMapping[i], shuffleMapping[j]] = [shuffleMapping[j]!, shuffleMapping[i]!]
      }
      const permutation = createPermutation(shuffleMapping)
      
      const [shuffledDeck] = await protocol.shuffleAndRemask(
        pp, aggregateKey, deck, maskingFactors, permutation
      )
      
      // 3. Deal cards to players (simulate dealing 2 cards to each player)
      const dealtCards = shuffledDeck.slice(0, players.length * 2)
      
      // 4. Reveal cards (simulate river reveal)
      const cardToReveal = dealtCards[0]!
      const revealTokens: any[] = []
      
      for (const player of players) {
        const [token, proof] = await protocol.computeRevealToken(
          pp, player.sk, player.pk, cardToReveal
        )
        revealTokens.push([token, proof, player.pk])
      }
      
      await protocol.unmask(pp, revealTokens, cardToReveal, cardEncoding)
      
      const end = performance.now()
      const totalTime = end - start
      
      console.log(`Complete poker hand simulation time: ${totalTime.toFixed(2)}ms`)
      
      // Should complete a simplified poker hand in under 10 seconds
      expect(totalTime).toBeLessThan(10000)
    })
  })

  describe("Memory Usage", () => {
    it("should have reasonable memory footprint", async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Perform many operations
      const operations = 100
      for (let i = 0; i < operations; i++) {
        const testCard = { point: pp.generators.G, index: i as any }
        const alpha = randScalar()
        const [maskedCard, proof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
        await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, proof)
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
        // Wait a bit for GC to complete
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      const memoryPerOp = memoryIncrease / operations
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      console.log(`Memory per operation: ${(memoryPerOp / 1024).toFixed(2)}KB`)
      
      // Should not leak significant memory (less than 10KB per operation)
      expect(memoryPerOp).toBeLessThan(10 * 1024)
    })
  })

  describe("Concurrent Performance", () => {
    it("should handle concurrent operations efficiently", async () => {
      const concurrency = 10
      const testCard = { point: pp.generators.G, index: 0 as any }
      
      const start = performance.now()
      
      const promises = Array.from({ length: concurrency }, async () => {
        const alpha = randScalar()
        const [maskedCard, proof] = await protocol.mask(pp, aggregateKey, testCard, alpha)
        await protocol.verifyMask(pp, aggregateKey, testCard, maskedCard, proof)
      })
      
      await Promise.all(promises)
      
      const end = performance.now()
      const totalTime = end - start
      const avgTime = totalTime / concurrency
      
      console.log(`Concurrent operations total time: ${totalTime.toFixed(2)}ms`)
      console.log(`Average time per concurrent operation: ${avgTime.toFixed(2)}ms`)
      
      // Concurrent operations should not be significantly slower than sequential
      // (within 2x due to contention and overhead)
      expect(avgTime).toBeLessThan(50)
    })
  })

  describe("Scalability Tests", () => {
    it("should scale with deck size", async () => {
      const deckSizes = [4, 8, 16, 32]
      const times: number[] = []
      
      for (const deckSize of deckSizes) {
        const testDeck: MaskedCard[] = []
        
        const start = performance.now()
        
        // Create deck
        for (let i = 0; i < deckSize; i++) {
          const card = { point: pp.generators.G, index: i as any }
          const alpha = randScalar()
          const [maskedCard] = await protocol.mask(pp, aggregateKey, card, alpha)
          testDeck.push(maskedCard)
        }
        
        const end = performance.now()
        times.push(end - start)
      }
      
      console.log("Deck creation times:", times.map((t, i) => 
        `${deckSizes[i]} cards: ${t.toFixed(2)}ms`
      ).join(", "))
      
      // Should scale linearly with deck size
      const scalingRatio = times[3]! / times[0]! / (deckSizes[3]! / deckSizes[0]!)
      expect(scalingRatio).toBeLessThan(2) // Should be close to linear
    })
  })
}) 