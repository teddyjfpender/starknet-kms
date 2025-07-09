import { describe, expect, test, beforeAll } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as Reveal from '../../src/primitives/reveal'
import * as Masking from '../../src/primitives/masking'
import { 
  hexToPoint, 
  pointToHex, 
  scalarMultiply, 
  addPoints, 
  arePointsEqual,
  type Point,
  type Scalar,
  G
} from '@starkms/crypto'

// Test vector interfaces
interface RevealTestVector {
  test_name: string
  seed: number[]
  setup: {
    generator: string
    player_secret_key: string
    player_public_key: string
  }
  masked_card: {
    c1: string
    c2: string
  }
  reveal_token: string
  reveal_proof: {
    commitment_g: string
    commitment_h: string
    challenge: string
    response: string
  }
  revealed_plaintext: string
  verification_result: boolean
}

interface RevealTestVectors {
  protocol_info: {
    name: string
    version: string
    description: string
  }
  curve_info: {
    name: string
    field_modulus: string
    curve_order: string
  }
  test_vectors: RevealTestVector[]
}

let testVectors: RevealTestVectors

beforeAll(() => {
  try {
    const testVectorPath = join(__dirname, 'test_vector_reveal.json')
    const testVectorData = readFileSync(testVectorPath, 'utf-8')
    testVectors = JSON.parse(testVectorData)
  } catch (error) {
    throw new Error(`Failed to load reveal test vectors: ${error}`)
  }
})

describe('Reveal Implementation with Test Vectors', () => {
  describe('Test Vector Validation', () => {
    test('should load test vectors successfully', () => {
      expect(testVectors).toBeDefined()
      expect(testVectors.test_vectors).toBeDefined()
      expect(testVectors.test_vectors.length).toBeGreaterThan(0)
    })

    test('should have proper test vector structure', () => {
      const testVector = testVectors.test_vectors[0]!
      
      expect(testVector.test_name).toBeDefined()
      expect(testVector.setup.generator).toBeDefined()
      expect(testVector.setup.player_secret_key).toBeDefined()
      expect(testVector.setup.player_public_key).toBeDefined()
      expect(testVector.masked_card.c1).toBeDefined()
      expect(testVector.masked_card.c2).toBeDefined()
      expect(testVector.reveal_token).toBeDefined()
      expect(testVector.reveal_proof.commitment_g).toBeDefined()
      expect(testVector.reveal_proof.commitment_h).toBeDefined()
      expect(testVector.reveal_proof.challenge).toBeDefined()
      expect(testVector.reveal_proof.response).toBeDefined()
      expect(testVector.revealed_plaintext).toBeDefined()
    })
  })

  describe('Core Reveal Operations', () => {
    test('should compute reveal tokens to match test vectors', () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup parameters
        const generator = hexToPoint(testVector.setup.generator)
        const pp: Reveal.ElGamalParameters = { generator }
        
        const secretKey: Reveal.ElGamalSecretKey = { 
          scalar: BigInt(testVector.setup.player_secret_key)
        }
        
        // Masked card
        const maskedCard: Reveal.MaskedCard = {
          c1: hexToPoint(testVector.masked_card.c1),
          c2: hexToPoint(testVector.masked_card.c2)
        }
        
        // Expected reveal token
        const expectedRevealToken = hexToPoint(testVector.reveal_token)
        
        // Compute reveal token
        const actualRevealToken = Reveal.computeRevealToken(pp, secretKey, maskedCard)
        
        // Verify the result matches expected
        expect(arePointsEqual(actualRevealToken.point, expectedRevealToken)).toBe(true)
      }
    })

    test('should reveal plaintexts to match test vectors', () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup
        const revealToken: Reveal.RevealToken = {
          point: hexToPoint(testVector.reveal_token)
        }
        
        const maskedCard: Reveal.MaskedCard = {
          c1: hexToPoint(testVector.masked_card.c1),
          c2: hexToPoint(testVector.masked_card.c2)
        }
        
        const expectedPlaintext = hexToPoint(testVector.revealed_plaintext)
        
        // Perform reveal
        const actualPlaintext = Reveal.reveal(revealToken, maskedCard)
        
        // Verify the result matches expected
        expect(arePointsEqual(actualPlaintext, expectedPlaintext)).toBe(true)
      }
    })

    test('should generate valid reveal proofs', () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup parameters
        const generator = hexToPoint(testVector.setup.generator)
        const pp: Reveal.ElGamalParameters = { generator }
        
        const secretKey: Reveal.ElGamalSecretKey = { 
          scalar: BigInt(testVector.setup.player_secret_key)
        }
        
        const publicKey: Reveal.ElGamalPublicKey = {
          point: hexToPoint(testVector.setup.player_public_key)
        }
        
        const maskedCard: Reveal.MaskedCard = {
          c1: hexToPoint(testVector.masked_card.c1),
          c2: hexToPoint(testVector.masked_card.c2)
        }
        
        const revealToken: Reveal.RevealToken = {
          point: hexToPoint(testVector.reveal_token)
        }
        
        // Generate proof
        const proof = Reveal.proveReveal(pp, secretKey, publicKey, maskedCard, revealToken)
        
        // Verify the proof
        const isValid = Reveal.verifyReveal(pp, publicKey, maskedCard, revealToken, proof)
        expect(isValid).toBe(true)
      }
    })

    test('should verify proofs from test vectors', () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup parameters
        const generator = hexToPoint(testVector.setup.generator)
        const pp: Reveal.ElGamalParameters = { generator }
        
        const publicKey: Reveal.ElGamalPublicKey = {
          point: hexToPoint(testVector.setup.player_public_key)
        }
        
        const maskedCard: Reveal.MaskedCard = {
          c1: hexToPoint(testVector.masked_card.c1),
          c2: hexToPoint(testVector.masked_card.c2)
        }
        
        const revealToken: Reveal.RevealToken = {
          point: hexToPoint(testVector.reveal_token)
        }
        
        // Proof from test vector
        const proof: Reveal.RevealProof = {
          commitmentG: hexToPoint(testVector.reveal_proof.commitment_g),
          commitmentH: hexToPoint(testVector.reveal_proof.commitment_h),
          challenge: BigInt(testVector.reveal_proof.challenge),
          response: BigInt(testVector.reveal_proof.response)
        }
        
        // Verify the proof
        const isValid = Reveal.verifyReveal(pp, publicKey, maskedCard, revealToken, proof)
        expect(isValid).toBe(testVector.verification_result)
      }
    })
  })

  describe('Combined Operations', () => {
    test('should perform reveal token computation with proof generation', () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup parameters
        const generator = hexToPoint(testVector.setup.generator)
        const pp: Reveal.ElGamalParameters = { generator }
        
        const secretKey: Reveal.ElGamalSecretKey = { 
          scalar: BigInt(testVector.setup.player_secret_key)
        }
        
        const publicKey: Reveal.ElGamalPublicKey = {
          point: hexToPoint(testVector.setup.player_public_key)
        }
        
        const maskedCard: Reveal.MaskedCard = {
          c1: hexToPoint(testVector.masked_card.c1),
          c2: hexToPoint(testVector.masked_card.c2)
        }
        
        // Perform combined operation
        const { revealToken, proof } = Reveal.computeRevealTokenWithProof(
          pp, secretKey, publicKey, maskedCard
        )
        
        // Verify the result
        const isValid = Reveal.verifyReveal(pp, publicKey, maskedCard, revealToken, proof)
        expect(isValid).toBe(true)
        
        // Verify reveal token matches expected
        const expectedRevealToken = hexToPoint(testVector.reveal_token)
        expect(arePointsEqual(revealToken.point, expectedRevealToken)).toBe(true)
      }
    })
  })

  describe('Multi-Party Reveal', () => {
    test('should support multi-party reveal operations', () => {
      const testVector = testVectors.test_vectors[0]!
      
      // Setup
      const maskedCard: Reveal.MaskedCard = {
        c1: hexToPoint(testVector.masked_card.c1),
        c2: hexToPoint(testVector.masked_card.c2)
      }
      
      // Create multiple reveal tokens (simulating multiple parties)
      // For this test, we'll use the same token multiple times to verify aggregation
      const baseToken = hexToPoint(testVector.reveal_token)
      const revealTokens: Reveal.RevealToken[] = [
        { point: baseToken },
      ]
      
      // Perform multi-party reveal with single token
      const revealedPlaintext = Reveal.multiPartyReveal(revealTokens, maskedCard)
      
      // Should match expected result
      const expectedPlaintext = hexToPoint(testVector.revealed_plaintext)
      expect(arePointsEqual(revealedPlaintext, expectedPlaintext)).toBe(true)
    })

    test('should handle empty reveal token array', () => {
      const testVector = testVectors.test_vectors[0]!
      
      const maskedCard: Reveal.MaskedCard = {
        c1: hexToPoint(testVector.masked_card.c1),
        c2: hexToPoint(testVector.masked_card.c2)
      }
      
      // Should throw error for empty array
      expect(() => {
        Reveal.multiPartyReveal([], maskedCard)
      }).toThrow('At least one reveal token is required')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should reject invalid proofs', () => {
      const testVector = testVectors.test_vectors[0]!
      
      // Setup
      const generator = hexToPoint(testVector.setup.generator)
      const pp: Reveal.ElGamalParameters = { generator }
      
      const publicKey: Reveal.ElGamalPublicKey = {
        point: hexToPoint(testVector.setup.player_public_key)
      }
      
      const maskedCard: Reveal.MaskedCard = {
        c1: hexToPoint(testVector.masked_card.c1),
        c2: hexToPoint(testVector.masked_card.c2)
      }
      
      const revealToken: Reveal.RevealToken = {
        point: hexToPoint(testVector.reveal_token)
      }
      
      // Create invalid proof (modify response)
      const invalidProof: Reveal.RevealProof = {
        commitmentG: hexToPoint(testVector.reveal_proof.commitment_g),
        commitmentH: hexToPoint(testVector.reveal_proof.commitment_h),
        challenge: BigInt(testVector.reveal_proof.challenge),
        response: BigInt(testVector.reveal_proof.response) + 1n // Invalid
      }
      
      // Should reject invalid proof
      const isValid = Reveal.verifyReveal(pp, publicKey, maskedCard, revealToken, invalidProof)
      expect(isValid).toBe(false)
    })

    test('should handle reveal correctness', () => {
      const testVector = testVectors.test_vectors[0]!
      
      // This test verifies the mathematical correctness of the reveal algorithm
      const secretKey = BigInt(testVector.setup.player_secret_key)
      const maskedCard: Reveal.MaskedCard = {
        c1: hexToPoint(testVector.masked_card.c1),
        c2: hexToPoint(testVector.masked_card.c2)
      }
      
      // Compute reveal token manually: token = sk * c1
      const manualRevealToken = scalarMultiply(secretKey, maskedCard.c1)
      
      // Apply reveal algorithm: plaintext = -token + c2
      const negativeToken = manualRevealToken.negate()
      const revealedPlaintext = addPoints(negativeToken, maskedCard.c2)
      
      // Should match expected plaintext
      const expectedPlaintext = hexToPoint(testVector.revealed_plaintext)
      expect(arePointsEqual(revealedPlaintext, expectedPlaintext)).toBe(true)
    })
  })

  describe('Serialization Functions', () => {
    test('should serialize and deserialize reveal tokens', () => {
      const testVector = testVectors.test_vectors[0]!
      
      const originalToken: Reveal.RevealToken = {
        point: hexToPoint(testVector.reveal_token)
      }
      
      // Serialize and deserialize
      const serialized = Reveal.revealTokenToHex(originalToken)
      const deserialized = Reveal.hexToRevealToken(serialized)
      
      // Should be equal
      expect(Reveal.revealTokensEqual(originalToken, deserialized)).toBe(true)
    })

    test('should serialize and deserialize masked cards', () => {
      const testVector = testVectors.test_vectors[0]!
      
      const originalMasked: Reveal.MaskedCard = {
        c1: hexToPoint(testVector.masked_card.c1),
        c2: hexToPoint(testVector.masked_card.c2)
      }
      
      // Serialize and deserialize
      const serialized = Reveal.maskedCardToHex(originalMasked)
      const deserialized = Reveal.hexToMaskedCard(serialized)
      
      // Should be equal
      expect(Reveal.maskedCardsEqual(originalMasked, deserialized)).toBe(true)
    })

    test('should serialize and deserialize reveal proofs', () => {
      const testVector = testVectors.test_vectors[0]!
      
      const proof: Reveal.RevealProof = {
        commitmentG: hexToPoint(testVector.reveal_proof.commitment_g),
        commitmentH: hexToPoint(testVector.reveal_proof.commitment_h),
        challenge: BigInt(testVector.reveal_proof.challenge),
        response: BigInt(testVector.reveal_proof.response)
      }
      
      // Serialize and deserialize
      const serialized = Reveal.revealProofToHex(proof)
      const deserialized = Reveal.hexToRevealProof(serialized)
      
      // Should be equal
      expect(Reveal.revealProofsEqual(proof, deserialized)).toBe(true)
    })
  })

  describe('Compatibility with Other Modules', () => {
    test('should be compatible with existing masking operations', () => {
      const testVector = testVectors.test_vectors[0]!
      
      // Setup using existing masking module
      const generator = hexToPoint(testVector.setup.generator)
      const secretKey = BigInt(testVector.setup.player_secret_key)
      const publicKey = hexToPoint(testVector.setup.player_public_key)
      
      // Create a card using masking module
      const card = Masking.randomCard()
      const maskingAlpha = BigInt("0x1234567890abcdef")
      
      // Convert interfaces
      const elgamalParams = { generator }
      const elgamalKey = { point: publicKey }
      
      const { maskedCard } = Masking.mask(elgamalParams, elgamalKey, card, maskingAlpha)
      
      // Convert to reveal interface
      const revealMaskedCard: Reveal.MaskedCard = {
        c1: maskedCard.c1,
        c2: maskedCard.c2
      }
      
      // Compute reveal token
      const revealSecretKey: Reveal.ElGamalSecretKey = { scalar: secretKey }
      const revealToken = Reveal.computeRevealToken(elgamalParams, revealSecretKey, revealMaskedCard)
      
      // Reveal the card
      const revealedPlaintext = Reveal.reveal(revealToken, revealMaskedCard)
      
      // Should equal the original card
      expect(arePointsEqual(revealedPlaintext, card.point)).toBe(true)
    })

    test('should demonstrate full masking/revealing cycle', () => {
      // Create a complete cycle: mask -> reveal -> verify
      const generator = G
      const secretScalar = BigInt("0xabcdef1234567890")
      const publicPoint = scalarMultiply(secretScalar, generator)
      
      // Setup
      const pp = { generator }
      const secretKey = { scalar: secretScalar }
      const publicKey = { point: publicPoint }
      
      // Original card
      const originalCard = Masking.randomCard()
      
      // Mask the card
      const { maskedCard } = Masking.mask(pp, publicKey, originalCard)
      
      // Convert to reveal format
      const revealMaskedCard: Reveal.MaskedCard = {
        c1: maskedCard.c1,
        c2: maskedCard.c2
      }
      
      // Compute reveal token with proof
      const { revealToken, proof } = Reveal.computeRevealTokenWithProof(
        pp, secretKey, publicKey, revealMaskedCard
      )
      
      // Verify the proof
      const isProofValid = Reveal.verifyReveal(pp, publicKey, revealMaskedCard, revealToken, proof)
      expect(isProofValid).toBe(true)
      
      // Reveal the card
      const revealedCard = Reveal.reveal(revealToken, revealMaskedCard)
      
      // Should match original
      expect(arePointsEqual(revealedCard, originalCard.point)).toBe(true)
    })
  })
}) 