import { describe, it, expect, beforeAll } from 'bun:test'
import * as ElGamal from '../../src/primitives/elgamal'
import { scalarMultiply, addPoints, arePointsEqual } from '@starkms/crypto'
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

describe('ElGamal Implementation with Test Vectors', () => {
  describe('Test Vector Validation', () => {
    it('should load test vectors successfully', () => {
      expect(testVectors).toBeDefined()
      expect(testVectors.test_vectors).toBeDefined()
      expect(testVectors.test_vectors.length).toBeGreaterThan(0)
    })

    it('should have proper test vector structure', () => {
      const vector = testVectors.test_vectors[0]
      expect(vector.elgamal_test).toBeDefined()
      expect(vector.elgamal_test.generator).toBeDefined()
      expect(vector.elgamal_test.secret_key).toBeDefined()
      expect(vector.elgamal_test.public_key).toBeDefined()
      expect(vector.elgamal_test.plaintext).toBeDefined()
      expect(vector.elgamal_test.randomness).toBeDefined()
      expect(vector.elgamal_test.ciphertext).toBeDefined()
      expect(vector.elgamal_test.encryption_proof).toBeDefined()
    })
  })

  describe('ElGamal Encryption/Decryption with Test Vectors', () => {
    it('should encrypt with known randomness to match test vectors', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.elgamal_test
        
        // Setup parameters from test vector
        const params: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(test.generator),
        }
        
        const publicKey: ElGamal.ElGamalPublicKey = {
          point: ElGamal.hexToPoint(test.public_key)
        }
        
        const plaintext: ElGamal.ElGamalPlaintext = {
          point: ElGamal.hexToPoint(test.plaintext)
        }
        
        const randomness = ElGamal.hexToScalar(test.randomness)
        
        // Encrypt with known randomness
        const { ciphertext, proof } = ElGamal.encrypt(params, publicKey, plaintext, randomness)
        
        // Verify ciphertext matches test vector
        expect(ElGamal.pointToHex(ciphertext.c1)).toBe(test.ciphertext.c1)
        expect(ElGamal.pointToHex(ciphertext.c2)).toBe(test.ciphertext.c2)
        
        // Verify proof structure exists
        expect(proof.commitment).toBeDefined()
        expect(proof.challenge).toBeDefined()
        expect(proof.response).toBeDefined()
      }
    })

    it('should decrypt test vector ciphertexts correctly', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.elgamal_test
        
        // Setup parameters from test vector
        const params: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(test.generator),
          fieldOrder: ElGamal.hexToScalar(test.randomness)
        }
        
        const secretKey: ElGamal.ElGamalSecretKey = {
          scalar: ElGamal.hexToScalar(test.secret_key)
        }
        
        const ciphertext: ElGamal.ElGamalCiphertext = {
          c1: ElGamal.hexToPoint(test.ciphertext.c1),
          c2: ElGamal.hexToPoint(test.ciphertext.c2)
        }
        
        // Decrypt
        const result = ElGamal.decrypt(params, secretKey, ciphertext)
        
        // Verify plaintext matches
        expect(ElGamal.pointToHex(result.point)).toBe(test.plaintext)
      }
    })
  })

  describe('ElGamal Proof Verification with Test Vectors', () => {
    it('should verify proofs from test vectors', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.elgamal_test
        
        // Setup parameters from test vector
        const params: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(test.generator),
          fieldOrder: ElGamal.hexToScalar(test.randomness)
        }
        
        const publicKey: ElGamal.ElGamalPublicKey = {
          point: ElGamal.hexToPoint(test.public_key)
        }
        
        const plaintext: ElGamal.ElGamalPlaintext = {
          point: ElGamal.hexToPoint(test.plaintext)
        }
        
        const ciphertext: ElGamal.ElGamalCiphertext = {
          c1: ElGamal.hexToPoint(test.ciphertext.c1),
          c2: ElGamal.hexToPoint(test.ciphertext.c2)
        }
        
        const proof: ElGamal.ChaumPedersenProof = {
          commitment: ElGamal.hexToPoint(test.encryption_proof.commitment),
          challenge: ElGamal.hexToScalar(test.encryption_proof.challenge),
          response: ElGamal.hexToScalar(test.encryption_proof.response)
        }
        
        // Verify the proof
        const isValid = ElGamal.verifyEncryption(params, publicKey, plaintext, ciphertext, proof)
        expect(isValid).toBe(true)
      }
    })

    it('should generate valid proofs for new encryptions', () => {
      const params = ElGamal.setup()
      const keys = ElGamal.keygen(params)
      const plaintext = ElGamal.randomPlaintext()
      
      const { ciphertext, proof } = ElGamal.encrypt(params, keys.publicKey, plaintext)
      const isValid = ElGamal.verifyEncryption(params, keys.publicKey, plaintext, ciphertext, proof)
      
      expect(isValid).toBe(true)
    })
  })

  describe('Key Generation Consistency', () => {
    it('should generate consistent public keys from secret keys', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.elgamal_test
        
        const params: ElGamal.ElGamalParameters = {
          generator: ElGamal.hexToPoint(test.generator),
          fieldOrder: ElGamal.hexToScalar(test.randomness)
        }
        
        const secretScalar = ElGamal.hexToScalar(test.secret_key)
        
        // Generate public key from secret key
        const derivedPublicKey = scalarMultiply(secretScalar, params.generator)
        
        // Should match the test vector public key
        expect(ElGamal.pointToHex(derivedPublicKey)).toBe(test.public_key)
      }
    })
  })

  describe('Homomorphic Properties', () => {
    it('should support ciphertext addition', () => {
      const params = ElGamal.setup()
      const keys = ElGamal.keygen(params)
      
      const plaintext1 = ElGamal.randomPlaintext()
      const plaintext2 = ElGamal.randomPlaintext()
      
      const { ciphertext: cipher1 } = ElGamal.encrypt(params, keys.publicKey, plaintext1)
      const { ciphertext: cipher2 } = ElGamal.encrypt(params, keys.publicKey, plaintext2)
      
      // Add ciphertexts
      const sumCipher = ElGamal.addCiphertexts(cipher1, cipher2)
      
      // Decrypt sum
      const decryptedSum = ElGamal.decrypt(params, keys.secretKey, sumCipher)
      
             // Should equal plaintext sum (though this might be point at infinity, which is expected)
       const expectedSum = addPoints(plaintext1.point, plaintext2.point)
       expect(arePointsEqual(decryptedSum.point, expectedSum)).toBe(true)
    })
  })

  describe('Utility Functions', () => {
    it('should convert points to hex and back correctly', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.elgamal_test
        
        const originalPoint = ElGamal.hexToPoint(test.plaintext)
        const hexString = ElGamal.pointToHex(originalPoint)
        const recoveredPoint = ElGamal.hexToPoint(hexString)
        
        expect(arePointsEqual(originalPoint, recoveredPoint)).toBe(true)
      }
    })

    it('should convert scalars to hex and back correctly', () => {
      for (const vector of testVectors.test_vectors) {
        const test = vector.elgamal_test
        
        const originalScalar = ElGamal.hexToScalar(test.secret_key)
        const hexString = ElGamal.scalarToHex(originalScalar)
        const recoveredScalar = ElGamal.hexToScalar(hexString)
        
        expect(recoveredScalar).toBe(originalScalar)
      }
    })
  })
})
