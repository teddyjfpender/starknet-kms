import { describe, it, expect, beforeAll } from 'bun:test'
import * as ElGamal from '../../src/primitives/elgamal'
import * as Masking from '../../src/primitives/masking'
import { arePointsEqual, addPoints, scalarMultiply } from '@starkms/crypto'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load test vectors
let testVectors: any = null

beforeAll(() => {
  try {
    const testVectorPath = join(__dirname, 'test_vector_primitives.json')
    const testVectorData = readFileSync(testVectorPath, 'utf-8')
    testVectors = JSON.parse(testVectorData)
  } catch (error) {
    console.error('Failed to load test vectors:', error)
    throw error
  }
})

describe('Card Masking Implementation with Test Vectors', () => {
  describe('Test Vector Validation', () => {
    it('should load test vectors successfully', () => {
      expect(testVectors).toBeDefined()
      expect(testVectors.test_vectors).toBeDefined()
      expect(testVectors.test_vectors.length).toBeGreaterThan(0)
    })

    it('should have proper masking test structure', () => {
      const vector = testVectors.test_vectors[0]
      expect(vector.masking_test).toBeDefined()
      expect(vector.masking_test.original_card).toBeDefined()
      expect(vector.masking_test.masked_card).toBeDefined()
      expect(vector.masking_test.masking_factor).toBeDefined()
      expect(vector.masking_test.masking_proof).toBeDefined()
      expect(vector.masking_test.verification_result).toBeDefined()
    })

    it('should have proper remasking test structure', () => {
      const vector = testVectors.test_vectors[0]
      expect(vector.remasking_test).toBeDefined()
      expect(vector.remasking_test.original_masked).toBeDefined()
      expect(vector.remasking_test.additional_masking_factor).toBeDefined()
      expect(vector.remasking_test.remasked_card).toBeDefined()
      expect(vector.remasking_test.remasking_proof).toBeDefined()
      expect(vector.remasking_test.verification_result).toBeDefined()
    })

    it('should have proper reveal test structure', () => {
      const vector = testVectors.test_vectors[0]
      expect(vector.reveal_test).toBeDefined()
      expect(vector.reveal_test.masked_card).toBeDefined()
      expect(vector.reveal_test.player_secret_keys).toBeDefined()
      expect(vector.reveal_test.reveal_tokens).toBeDefined()
      expect(vector.reveal_test.reveal_proofs).toBeDefined()
      expect(vector.reveal_test.unmasked_card).toBeDefined()
    })
  })

  describe('Card Masking with Test Vectors', () => {
    it('should mask cards with known randomness to match test vectors', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.masking_test
        const elgamalTest = vector.elgamal_test
        const revealTest = vector.reveal_test
        
        // Setup parameters from test vector
        const elgamalParams: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(elgamalTest.generator),
        }
        
        // Note: Masking test uses aggregate public key (multi-player), not single ElGamal test key
        // We need to reconstruct the aggregate key from the reveal test player keys
        const playerSecretKeys = revealTest.player_secret_keys.map((sk: string) => ElGamal.hexToScalar(sk))
        let aggregatePublicKey = scalarMultiply(playerSecretKeys[0]!, elgamalParams.generator)
        for (let i = 1; i < playerSecretKeys.length; i++) {
          const playerPubKey = scalarMultiply(playerSecretKeys[i]!, elgamalParams.generator)
          aggregatePublicKey = addPoints(aggregatePublicKey, playerPubKey)
        }
        
        const publicKey: ElGamal.ElGamalPublicKey = {
          point: aggregatePublicKey
        }
        
        const card: Masking.Card = {
          point: ElGamal.hexToPoint(test.original_card)
        }
        
        const maskingFactor = ElGamal.hexToScalar(test.masking_factor)
        
        // Mask with known randomness
        const { maskedCard, proof } = Masking.mask(elgamalParams, publicKey, card, maskingFactor)
        
        // Verify masked card matches test vector
        expect(ElGamal.pointToHex(maskedCard.c1)).toBe(test.masked_card.c1)
        expect(ElGamal.pointToHex(maskedCard.c2)).toBe(test.masked_card.c2)
        
        // Verify proof structure exists
        expect(proof.commitment).toBeDefined()
        expect(proof.challenge).toBeDefined()
        expect(proof.response).toBeDefined()
      }
    })

    it('should verify masking proofs from test vectors', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.masking_test
        const elgamalTest = vector.elgamal_test
        const revealTest = vector.reveal_test
        
        // Setup parameters from test vector
        const elgamalParams: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(elgamalTest.generator),
        }
        
        // Note: Masking test uses aggregate public key (multi-player), not single ElGamal test key
        // We need to reconstruct the aggregate key from the reveal test player keys
        const playerSecretKeys = revealTest.player_secret_keys.map((sk: string) => ElGamal.hexToScalar(sk))
        let aggregatePublicKey = scalarMultiply(playerSecretKeys[0]!, elgamalParams.generator)
        for (let i = 1; i < playerSecretKeys.length; i++) {
          const playerPubKey = scalarMultiply(playerSecretKeys[i]!, elgamalParams.generator)
          aggregatePublicKey = addPoints(aggregatePublicKey, playerPubKey)
        }
        
        const publicKey: ElGamal.ElGamalPublicKey = {
          point: aggregatePublicKey
        }
        
        const card: Masking.Card = {
          point: ElGamal.hexToPoint(test.original_card)
        }
        
        const maskedCard: Masking.MaskedCard = {
          c1: ElGamal.hexToPoint(test.masked_card.c1),
          c2: ElGamal.hexToPoint(test.masked_card.c2)
        }
        
        const proof: Masking.MaskingProof = {
          commitment: ElGamal.hexToPoint(test.masking_proof.commitment),
          challenge: ElGamal.hexToScalar(test.masking_proof.challenge),
          response: ElGamal.hexToScalar(test.masking_proof.response)
        }
        
        // Verify the masking proof
        const isValid = Masking.verifyMask(elgamalParams, publicKey, card, maskedCard, proof)
        
        // Should match the verification result from test vector
        expect(isValid).toBe(test.verification_result)
      }
    })
  })

  describe('Card Remasking with Test Vectors', () => {
    it('should remask cards with known randomness to match test vectors', () => {
      for (const vector of testVectors.test_vectors) {
        const remaskingTest = vector.remasking_test
        const elgamalTest = vector.elgamal_test
        const revealTest = vector.reveal_test
        
        // Setup parameters from test vector
        const elgamalParams: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(elgamalTest.generator),
        }
        
        // Note: Remasking test uses aggregate public key (multi-player), not single ElGamal test key
        const playerSecretKeys = revealTest.player_secret_keys.map((sk: string) => ElGamal.hexToScalar(sk))
        let aggregatePublicKey = scalarMultiply(playerSecretKeys[0]!, elgamalParams.generator)
        for (let i = 1; i < playerSecretKeys.length; i++) {
          const playerPubKey = scalarMultiply(playerSecretKeys[i]!, elgamalParams.generator)
          aggregatePublicKey = addPoints(aggregatePublicKey, playerPubKey)
        }
        
        const publicKey: ElGamal.ElGamalPublicKey = {
          point: aggregatePublicKey
        }
        
        const originalMasked: Masking.MaskedCard = {
          c1: ElGamal.hexToPoint(remaskingTest.original_masked.c1),
          c2: ElGamal.hexToPoint(remaskingTest.original_masked.c2)
        }
        
        const additionalRandomness = ElGamal.hexToScalar(remaskingTest.additional_masking_factor)
        
        // Remask with known randomness
        const { remaskedCard, proof } = Masking.remask(elgamalParams, publicKey, originalMasked, additionalRandomness)
        
        // Verify remasked card matches test vector
        expect(ElGamal.pointToHex(remaskedCard.c1)).toBe(remaskingTest.remasked_card.c1)
        expect(ElGamal.pointToHex(remaskedCard.c2)).toBe(remaskingTest.remasked_card.c2)
        
        // Verify proof structure exists
        expect(proof.commitment).toBeDefined()
        expect(proof.challenge).toBeDefined()
        expect(proof.response).toBeDefined()
      }
    })

    it('should verify remasking proofs from test vectors', () => {
      for (const vector of testVectors.test_vectors) {
        const remaskingTest = vector.remasking_test
        const elgamalTest = vector.elgamal_test
        const revealTest = vector.reveal_test
        
        // Setup parameters from test vector
        const elgamalParams: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(elgamalTest.generator),
        }
        
        // Note: Remasking test uses aggregate public key (multi-player), not single ElGamal test key
        const playerSecretKeys = revealTest.player_secret_keys.map((sk: string) => ElGamal.hexToScalar(sk))
        let aggregatePublicKey = scalarMultiply(playerSecretKeys[0]!, elgamalParams.generator)
        for (let i = 1; i < playerSecretKeys.length; i++) {
          const playerPubKey = scalarMultiply(playerSecretKeys[i]!, elgamalParams.generator)
          aggregatePublicKey = addPoints(aggregatePublicKey, playerPubKey)
        }
        
        const publicKey: ElGamal.ElGamalPublicKey = {
          point: aggregatePublicKey
        }
        
        const originalMasked: Masking.MaskedCard = {
          c1: ElGamal.hexToPoint(remaskingTest.original_masked.c1),
          c2: ElGamal.hexToPoint(remaskingTest.original_masked.c2)
        }
        
        const remaskedCard: Masking.MaskedCard = {
          c1: ElGamal.hexToPoint(remaskingTest.remasked_card.c1),
          c2: ElGamal.hexToPoint(remaskingTest.remasked_card.c2)
        }
        
        const proof: Masking.MaskingProof = {
          commitment: ElGamal.hexToPoint(remaskingTest.remasking_proof.commitment),
          challenge: ElGamal.hexToScalar(remaskingTest.remasking_proof.challenge),
          response: ElGamal.hexToScalar(remaskingTest.remasking_proof.response)
        }
        
        // Verify the remasking proof
        const isValid = Masking.verifyRemask(elgamalParams, publicKey, originalMasked, remaskedCard, proof)
        
        // Should match the verification result from test vector
        expect(isValid).toBe(remaskingTest.verification_result)
      }
    })

    it('should remask cards correctly with random values', () => {
      const elgamalParams = ElGamal.setup()
      const keys = ElGamal.keygen(elgamalParams)
      const card = Masking.randomCard()
      
      // Initial masking
      const { maskedCard } = Masking.mask(elgamalParams, keys.publicKey, card)
      
      // Remask
      const { remaskedCard, proof } = Masking.remask(elgamalParams, keys.publicKey, maskedCard)
      
      expect(remaskedCard.c1).toBeDefined()
      expect(remaskedCard.c2).toBeDefined()
      expect(proof.commitment).toBeDefined()
      expect(proof.challenge).toBeDefined()
      expect(proof.response).toBeDefined()
      
      // Remasked card should be different from original
      expect(Masking.maskedCardsEqual(maskedCard, remaskedCard)).toBe(false)
      
      // Verify the remasking proof
      const isValid = Masking.verifyRemask(elgamalParams, keys.publicKey, maskedCard, remaskedCard, proof)
      expect(isValid).toBe(true)
    })
  })

  describe('Card Revealing with Test Vectors', () => {
    it('should create reveal tokens that match test vectors', () => {
      for (const vector of testVectors.test_vectors) {
        const revealTest = vector.reveal_test
        const elgamalTest = vector.elgamal_test
        
        // Setup parameters from test vector
        const elgamalParams: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(elgamalTest.generator),
        }
        
        const maskedCard: Masking.MaskedCard = {
          c1: ElGamal.hexToPoint(revealTest.masked_card.c1),
          c2: ElGamal.hexToPoint(revealTest.masked_card.c2)
        }
        
        // Test with first player's key
        const secretKey: ElGamal.ElGamalSecretKey = {
          scalar: ElGamal.hexToScalar(revealTest.player_secret_keys[0]!)
        }
        
        const publicKey: ElGamal.ElGamalPublicKey = {
          point: ElGamal.hexToPoint(elgamalTest.public_key)
        }
        
        // Create reveal token
        const { token, proof } = Masking.createRevealToken(
          elgamalParams,
          secretKey,
          publicKey,
          maskedCard
        )
        
        // Token should match test vector (first token)
        expect(ElGamal.pointToHex(token)).toBe(revealTest.reveal_tokens[0])
        
        // Proof structure should exist
        expect(proof.commitment).toBeDefined()
        expect(proof.challenge).toBeDefined()
        expect(proof.response).toBeDefined()
      }
    })

    it('should unmask cards using reveal tokens from test vectors', () => {
      for (const vector of testVectors.test_vectors) {
        const revealTest = vector.reveal_test
        const elgamalTest = vector.elgamal_test
        
        // Setup parameters from test vector
        const elgamalParams: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(elgamalTest.generator),
        }
        
        const maskedCard: Masking.MaskedCard = {
          c1: ElGamal.hexToPoint(revealTest.masked_card.c1),
          c2: ElGamal.hexToPoint(revealTest.masked_card.c2)
        }
        
        // Convert reveal tokens from hex
        const revealTokens = revealTest.reveal_tokens.map((token: string) => 
          ElGamal.hexToPoint(token)
        )
        
        // Unmask using all tokens
        const unmaskedCard = Masking.unmask(elgamalParams, revealTokens, maskedCard)
        
        // Should match expected unmasked card
        expect(Masking.cardToHex(unmaskedCard)).toBe(revealTest.unmasked_card)
      }
    })

    it('should create and verify reveal tokens with random values', () => {
      const elgamalParams = ElGamal.setup()
      const keys = ElGamal.keygen(elgamalParams)
      const card = Masking.randomCard()
      
      // Mask the card
      const { maskedCard } = Masking.mask(elgamalParams, keys.publicKey, card)
      
      // Create reveal token
      const { token, proof } = Masking.createRevealToken(
        elgamalParams,
        keys.secretKey,
        keys.publicKey,
        maskedCard
      )
      
      expect(token).toBeDefined()
      expect(proof.commitment).toBeDefined()
      expect(proof.challenge).toBeDefined()
      expect(proof.response).toBeDefined()
      
      // Test unmasking with single token
      const unmaskedCard = Masking.unmask(elgamalParams, [token], maskedCard)
      
      // Should recover original card
      expect(arePointsEqual(unmaskedCard.point, card.point)).toBe(true)
    })

    it('should support multi-party reveal tokens', () => {
      const elgamalParams = ElGamal.setup()
      const numPlayers = 3
      const players = []
      
      // Generate multiple players
      for (let i = 0; i < numPlayers; i++) {
        players.push(ElGamal.keygen(elgamalParams))
      }
      
      // Aggregate public key
      let aggregateKey = players[0]!.publicKey.point
      for (let i = 1; i < numPlayers; i++) {
        aggregateKey = addPoints(aggregateKey, players[i]!.publicKey.point)
      }
     
      const aggregatePubKey: ElGamal.ElGamalPublicKey = { point: aggregateKey }
      const card = Masking.randomCard()
      
      // Mask with aggregate key
      const { maskedCard } = Masking.mask(elgamalParams, aggregatePubKey, card)
      
      // Each player creates reveal token
      const revealTokens: any[] = []
      for (const player of players) {
        const { token } = Masking.createRevealToken(
          elgamalParams,
          player.secretKey,
          player.publicKey,
          maskedCard
        )
        revealTokens.push(token)
      }
     
      // Unmask with all tokens
      const unmaskedCard = Masking.unmask(elgamalParams, revealTokens, maskedCard)
      
      // Should recover original card
      expect(arePointsEqual(unmaskedCard.point, card.point)).toBe(true)
    })
  })

  describe('Serialization Functions', () => {
    it('should serialize and deserialize cards', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.masking_test
        
        const originalCard: Masking.Card = {
          point: ElGamal.hexToPoint(test.original_card)
        }
        
        const hex = Masking.cardToHex(originalCard)
        const recovered = Masking.hexToCard(hex)
        
        expect(Masking.cardsEqual(originalCard, recovered)).toBe(true)
      }
    })

    it('should serialize and deserialize masked cards', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.masking_test
        
        const maskedCard: Masking.MaskedCard = {
          c1: ElGamal.hexToPoint(test.masked_card.c1),
          c2: ElGamal.hexToPoint(test.masked_card.c2)
        }
        
        const hex = Masking.maskedCardToHex(maskedCard)
        const recovered = Masking.hexToMaskedCard(hex)
        
        expect(Masking.maskedCardsEqual(maskedCard, recovered)).toBe(true)
      }
    })

    it('should generate different random cards', () => {
      const card1 = Masking.randomCard()
      const card2 = Masking.randomCard()
      
      // Should be different (with very high probability)
      expect(Masking.cardsEqual(card1, card2)).toBe(false)
    })
  })

  describe('Compatibility with ElGamal', () => {
    it('should be compatible with ElGamal encryption/decryption', () => {
      const elgamalParams = ElGamal.setup()
      const keys = ElGamal.keygen(elgamalParams)
      const card = Masking.randomCard()
      
      // Mask card (which uses ElGamal encryption internally)
      const { maskedCard } = Masking.mask(elgamalParams, keys.publicKey, card)
      
      // Decrypt as ElGamal ciphertext
      const ciphertext: ElGamal.ElGamalCiphertext = {
        c1: maskedCard.c1,
        c2: maskedCard.c2
      }
      
      const decrypted = ElGamal.decrypt(elgamalParams, keys.secretKey, ciphertext)
      
      // Should recover original card
      expect(arePointsEqual(decrypted.point, card.point)).toBe(true)
    })
  })
})
