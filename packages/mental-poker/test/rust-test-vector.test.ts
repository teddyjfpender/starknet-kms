import { beforeAll, describe, expect, it } from "bun:test"
import { G } from "@starkms/crypto"
import { DLCards } from "../src/discrete-log-cards"
import {
  type AggregatePublicKey,
  type Card,
  type MaskedCard,
  type Parameters,
  type PlayerPublicKey,
  type PlayerSecretKey,
  createDeckSize,
  createPlayerId,
} from "../src/types"
import { createChaCha20Rng } from "./chacha20-rng"
import testVector from "./test_vector.json"
import {
  extractMaskingFactors,
  extractShuffleSequences,
  getCardMappings,
  getFinalResults,
  getPlayerNames,
  getShuffleSequence,
  hexToScalar,
  validateTestVector,
  vectorPlayerToKeys,
} from "./vector-helpers"

describe("Rust Test Vector Compatibility", () => {
  let dlCards: DLCards
  let parameters: Parameters
  let playerKeys: Map<string, [PlayerPublicKey, PlayerSecretKey]>
  let aggregateKey: AggregatePublicKey
  let cardMappings: ReturnType<typeof getCardMappings>
  let rng: ReturnType<typeof createChaCha20Rng>

  beforeAll(async () => {
    validateTestVector(testVector)
    dlCards = DLCards.getInstance()

    parameters = await dlCards.setup(
      createDeckSize(testVector.parameters.m),
      createPlayerId(testVector.parameters.n),
    )

    playerKeys = new Map()
    const playerNames = getPlayerNames(testVector)
    for (const playerName of playerNames) {
      const [pk, sk] = vectorPlayerToKeys(
        (testVector.players as any)[playerName],
      )
      playerKeys.set(playerName, [pk, sk])
    }

    // Compute aggregate key using vector player keys with proper proofs
    const playerKeysProofInfo = []
    for (const [playerName, [pk, sk]] of playerKeys) {
      const playerInfo = new TextEncoder().encode(playerName)
      // Generate proper key ownership proof
      const proof = await dlCards.proveKeyOwnership(
        parameters,
        pk,
        sk,
        playerInfo,
      )
      playerKeysProofInfo.push([pk, proof, playerInfo] as const)
    }

    aggregateKey = await dlCards.computeAggregateKey(
      parameters,
      playerKeysProofInfo,
    )
    cardMappings = getCardMappings(testVector)
    rng = createChaCha20Rng()
  })

  describe("Vector Data Validation", () => {
    it("should have correct test vector structure", () => {
      expect(testVector.seed).toHaveLength(32)
      expect(testVector.parameters.m).toBe(2)
      expect(testVector.parameters.n).toBe(26)
      expect(testVector.parameters.num_of_cards).toBe(52)

      const playerNames = getPlayerNames(testVector)
      expect(playerNames).toEqual(["andrija", "kobi", "nico", "tom"])

      expect(cardMappings).toHaveLength(52)

      const shuffleSequence = getShuffleSequence(testVector)
      expect(shuffleSequence).toHaveLength(4)

      const finalResults = getFinalResults(testVector)
      expect(finalResults.andrija).toBe("4♥")
      expect(finalResults.kobi).toBe("6♠")
      expect(finalResults.nico).toBe("9♣")
      expect(finalResults.tom).toBe("3♣")
    })

    it("should derive consistent public keys from vector secret keys", () => {
      const playerNames = getPlayerNames(testVector)

      for (const playerName of playerNames) {
        const [pk, sk] = playerKeys.get(playerName)!
        const expectedSk = hexToScalar(
          (testVector.players as any)[playerName].secret_key_hex,
        )
        // Verify that the public key is correctly derived from the secret key
        const expectedPk = G.multiply(sk.scalar)

        expect(sk.scalar).toBe(expectedSk)
        expect(pk.point.x).toBe(expectedPk.x)
        expect(pk.point.y).toBe(expectedPk.y)
      }
    })

    it("should have valid card mappings from vector", () => {
      const playingCards = cardMappings.map((c) => c.playingCard)
      const suits = ["♣", "♦", "♥", "♠"]
      const values = [
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "J",
        "Q",
        "K",
        "A",
      ]

      for (const suit of suits) {
        for (const value of values) {
          const expectedCard = `${value}${suit}`
          expect(playingCards).toContain(expectedCard)
        }
      }
    })

    it("should have valid permutations from vector", () => {
      const shuffleSequence = getShuffleSequence(testVector)

      for (const { player, permutation } of shuffleSequence) {
        expect(["andrija", "kobi", "nico", "tom"]).toContain(player)
        expect(permutation.mapping).toHaveLength(52)
        expect(permutation.size).toBe(52)

        const sortedMapping = [...permutation.mapping].sort((a, b) => a - b)
        expect(sortedMapping).toEqual(Array.from({ length: 52 }, (_, i) => i))
      }
    })
  })

  describe("Protocol Reproduction with Vector Data", () => {
    it("should reproduce key generation using vector keys", async () => {
      const playerNames = getPlayerNames(testVector)

      for (const playerName of playerNames) {
        const [pk, sk] = playerKeys.get(playerName)!
        const playerInfo = new TextEncoder().encode(playerName)

        const proof = await dlCards.proveKeyOwnership(
          parameters,
          pk,
          sk,
          playerInfo,
        )
        const isValid = await dlCards.verifyKeyOwnership(
          parameters,
          pk,
          playerInfo,
          proof,
        )

        expect(isValid).toBe(true)
      }
    })

    it("should reproduce card masking with vector cards", async () => {
      const testCards = cardMappings.slice(0, 4)

      for (const { card } of testCards) {
        const alpha = rng.nextScalar()

        const [maskedCard, maskProof] = await dlCards.mask(
          parameters,
          aggregateKey,
          card,
          alpha,
        )
        const isValid = await dlCards.verifyMask(
          parameters,
          aggregateKey,
          card,
          maskedCard,
          maskProof,
        )

        expect(isValid).toBe(true)
        expect(maskedCard.ciphertext).toBeDefined()
        expect(maskedCard.randomness).toBeDefined()
      }
    })

    it("should reproduce shuffle operations with vector permutations", async () => {
      const initialDeck: MaskedCard[] = []

      // Use all 52 cards for complete reproduction
      for (let i = 0; i < 52; i++) {
        const card = cardMappings[i]!.card
        const alpha = rng.nextScalar()
        const [maskedCard] = await dlCards.mask(
          parameters,
          aggregateKey,
          card,
          alpha,
        )
        initialDeck.push(maskedCard)
      }

      let currentDeck = initialDeck
      const shuffleSequence = getShuffleSequence(testVector)
      const shuffleSequences = extractShuffleSequences(testVector)
      const vectorMaskingFactors = extractMaskingFactors(testVector)

      for (
        let shuffleIndex = 0;
        shuffleIndex <
        Math.min(shuffleSequence.length, shuffleSequences.length);
        shuffleIndex++
      ) {
        // Use actual vector permutation for complete reproduction
        const vectorPermutation = shuffleSequences[shuffleIndex]
        if (!vectorPermutation) {
          throw new Error(`No permutation found for shuffle ${shuffleIndex}`)
        }

        const testPermutation = {
          mapping: vectorPermutation, // Use full 52-card permutation
          size: 52,
        }

        // Use actual vector masking factors for all 52 cards
        const vectorFactors = vectorMaskingFactors[shuffleIndex]
        const newMaskingFactors =
          vectorFactors || Array.from({ length: 52 }, () => rng.nextScalar())

        const [shuffledDeck, shuffleProof] = await dlCards.shuffleAndRemask(
          parameters,
          aggregateKey,
          currentDeck,
          newMaskingFactors,
          testPermutation,
        )

        const isValid = await dlCards.verifyShuffle(
          parameters,
          aggregateKey,
          currentDeck,
          shuffledDeck,
          shuffleProof,
        )

        expect(isValid).toBe(true)
        expect(shuffledDeck).toHaveLength(52)

        currentDeck = [...shuffledDeck]
      }
    })

    it("should reproduce reveal operations with vector data", async () => {
      const testCard = cardMappings[0]!.card
      const alpha = rng.nextScalar()

      const [maskedCard] = await dlCards.mask(
        parameters,
        aggregateKey,
        testCard,
        alpha,
      )

      const revealTokens: Array<[any, any, PlayerPublicKey]> = []

      for (const [_, [pk, sk]] of playerKeys) {
        const [token, proof] = await dlCards.computeRevealToken(
          parameters,
          sk,
          pk,
          maskedCard,
        )

        const isValid = await dlCards.verifyReveal(
          parameters,
          pk,
          token,
          maskedCard,
          proof,
        )
        expect(isValid).toBe(true)

        revealTokens.push([token, proof, pk])
      }

      const unmaskedCard = await dlCards.unmask(
        parameters,
        revealTokens,
        maskedCard,
      )

      expect(unmaskedCard.point.x).toBe(testCard.point.x)
      expect(unmaskedCard.point.y).toBe(testCard.point.y)
    })
  })

  describe("Complete Protocol Integration", () => {
    it("should execute complete protocol with vector inputs", async () => {
      // Use vector parameters
      expect(parameters.m).toBe(createDeckSize(testVector.parameters.m))
      expect(parameters.n).toBe(createPlayerId(testVector.parameters.n))

      // Use vector player keys
      expect(playerKeys.size).toBe(4)

      // Create initial deck from all vector cards
      const initialCards = cardMappings // Use all 52 cards for complete reproduction
      const maskedDeck: MaskedCard[] = []

      for (const { card } of initialCards) {
        const alpha = rng.nextScalar()
        const [maskedCard] = await dlCards.mask(
          parameters,
          aggregateKey,
          card,
          alpha,
        )
        maskedDeck.push(maskedCard)
      }

      // Apply vector shuffle sequence using actual vector data
      let currentDeck = maskedDeck
      const shuffleSequence = getShuffleSequence(testVector)
      const shuffleSequences = extractShuffleSequences(testVector)
      const vectorMaskingFactors = extractMaskingFactors(testVector)

      for (
        let shuffleIndex = 0;
        shuffleIndex <
        Math.min(shuffleSequence.length, shuffleSequences.length);
        shuffleIndex++
      ) {
        // Use actual vector permutation for complete reproduction
        const vectorPermutation = shuffleSequences[shuffleIndex]
        if (!vectorPermutation) {
          throw new Error(`No permutation found for shuffle ${shuffleIndex}`)
        }

        const testPermutation = {
          mapping: vectorPermutation, // Use full 52-card permutation
          size: 52,
        }

        // Use actual vector masking factors for all 52 cards
        const vectorFactors = vectorMaskingFactors[shuffleIndex]
        const newMaskingFactors =
          vectorFactors || Array.from({ length: 52 }, () => rng.nextScalar())

        const [shuffledDeck] = await dlCards.shuffleAndRemask(
          parameters,
          aggregateKey,
          currentDeck,
          newMaskingFactors,
          testPermutation,
        )

        currentDeck = [...shuffledDeck]
      }

      // Reveal final cards
      const finalCards: Card[] = []

      for (const maskedCard of currentDeck) {
        const revealTokens: Array<[any, any, PlayerPublicKey]> = []

        for (const [_, [pk, sk]] of playerKeys) {
          const [token, proof] = await dlCards.computeRevealToken(
            parameters,
            sk,
            pk,
            maskedCard,
          )
          revealTokens.push([token, proof, pk])
        }

        const unmaskedCard = await dlCards.unmask(
          parameters,
          revealTokens,
          maskedCard,
        )
        finalCards.push(unmaskedCard)
      }

      // Verify protocol completed successfully
      expect(finalCards).toHaveLength(52)

      // Each final card should correspond to one of our initial cards
      for (const finalCard of finalCards) {
        const matchingInitialCard = initialCards.find(
          ({ card }) =>
            card.point.x === finalCard.point.x &&
            card.point.y === finalCard.point.y,
        )
        expect(matchingInitialCard).toBeDefined()
      }
    })
  })

  describe("Deterministic RNG Compatibility", () => {
    it("should produce consistent results with ChaCha20Rng", () => {
      const rng1 = createChaCha20Rng()
      const rng2 = createChaCha20Rng()

      for (let i = 0; i < 10; i++) {
        const scalar1 = rng1.nextScalar()
        const scalar2 = rng2.nextScalar()
        expect(scalar1).toBe(scalar2)
      }
    })

    it("should generate valid scalars in correct range", () => {
      const testRng = createChaCha20Rng()

      for (let i = 0; i < 100; i++) {
        const scalar = testRng.nextScalar()
        expect(scalar).toBeGreaterThan(0n)
        expect(scalar).toBeLessThan(
          BigInt(
            "0x800000000000011000000000000000000000000000000000000000000000001",
          ),
        )
      }
    })
  })
})
