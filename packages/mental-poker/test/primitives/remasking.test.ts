import { beforeAll, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { arePointsEqual, hexToPoint } from "@starkms/crypto"
import * as Masking from "../../src/primitives/masking"
import * as Remasking from "../../src/primitives/remasking"

// Test vector interfaces
interface RemaskingTestVector {
  test_name: string
  seed: number[]
  setup: {
    generator: string
    num_players: number
    player_secret_keys: string[]
    aggregate_public_key: string
  }
  original_masked_card: {
    c1: string
    c2: string
  }
  remasking_factor: string
  expected_remasked_card: {
    c1: string
    c2: string
  }
  remasking_proof: {
    commitment_g: string
    commitment_h: string
    challenge: string
    response: string
  }
  verification_result: boolean
}

interface RemaskingTestVectors {
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
  test_vectors: RemaskingTestVector[]
}

let testVectors: RemaskingTestVectors

beforeAll(() => {
  try {
    const testVectorPath = join(__dirname, "test_vector_remasking.json")
    const testVectorData = readFileSync(testVectorPath, "utf-8")
    testVectors = JSON.parse(testVectorData)
  } catch (error) {
    throw new Error(`Failed to load remasking test vectors: ${error}`)
  }
})

describe("Remasking Implementation with Test Vectors", () => {
  describe("Test Vector Validation", () => {
    test("should load test vectors successfully", () => {
      expect(testVectors).toBeDefined()
      expect(testVectors.test_vectors).toBeDefined()
      expect(testVectors.test_vectors.length).toBeGreaterThan(0)
    })

    test("should have proper test vector structure", () => {
      const testVector = testVectors.test_vectors[0]!

      expect(testVector.test_name).toBeDefined()
      expect(testVector.setup.generator).toBeDefined()
      expect(testVector.setup.aggregate_public_key).toBeDefined()
      expect(testVector.original_masked_card.c1).toBeDefined()
      expect(testVector.original_masked_card.c2).toBeDefined()
      expect(testVector.remasking_factor).toBeDefined()
      expect(testVector.expected_remasked_card.c1).toBeDefined()
      expect(testVector.expected_remasked_card.c2).toBeDefined()
      expect(testVector.remasking_proof.commitment_g).toBeDefined()
      expect(testVector.remasking_proof.commitment_h).toBeDefined()
      expect(testVector.remasking_proof.challenge).toBeDefined()
      expect(testVector.remasking_proof.response).toBeDefined()
    })
  })

  describe("Core Remasking Operations", () => {
    test("should remask cards to match test vectors", () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup parameters
        const generator = hexToPoint(testVector.setup.generator)
        const pp: Remasking.ElGamalParameters = { generator }

        const aggregatePublicKey = hexToPoint(
          testVector.setup.aggregate_public_key,
        )
        const sharedKey: Remasking.ElGamalPublicKey = {
          point: aggregatePublicKey,
        }

        // Original masked card
        const originalMasked: Remasking.MaskedCard = {
          c1: hexToPoint(testVector.original_masked_card.c1),
          c2: hexToPoint(testVector.original_masked_card.c2),
        }

        // Remasking factor
        const alpha = BigInt(testVector.remasking_factor)

        // Expected result
        const expectedRemasked: Remasking.MaskedCard = {
          c1: hexToPoint(testVector.expected_remasked_card.c1),
          c2: hexToPoint(testVector.expected_remasked_card.c2),
        }

        // Perform remasking
        const actualRemasked = Remasking.remask(
          pp,
          sharedKey,
          originalMasked,
          alpha,
        )

        // Verify the result matches expected
        expect(arePointsEqual(actualRemasked.c1, expectedRemasked.c1)).toBe(
          true,
        )
        expect(arePointsEqual(actualRemasked.c2, expectedRemasked.c2)).toBe(
          true,
        )
      }
    })

    test("should generate valid remasking proofs", () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup parameters
        const generator = hexToPoint(testVector.setup.generator)
        const pp: Remasking.ElGamalParameters = { generator }

        const aggregatePublicKey = hexToPoint(
          testVector.setup.aggregate_public_key,
        )
        const sharedKey: Remasking.ElGamalPublicKey = {
          point: aggregatePublicKey,
        }

        // Original and remasked cards
        const originalMasked: Remasking.MaskedCard = {
          c1: hexToPoint(testVector.original_masked_card.c1),
          c2: hexToPoint(testVector.original_masked_card.c2),
        }

        const remaskedCard: Remasking.MaskedCard = {
          c1: hexToPoint(testVector.expected_remasked_card.c1),
          c2: hexToPoint(testVector.expected_remasked_card.c2),
        }

        const alpha = BigInt(testVector.remasking_factor)

        // Generate proof
        const proof = Remasking.proveRemasking(
          pp,
          sharedKey,
          originalMasked,
          remaskedCard,
          alpha,
        )

        // Verify the proof
        const isValid = Remasking.verifyRemasking(
          pp,
          sharedKey,
          originalMasked,
          remaskedCard,
          proof,
        )
        expect(isValid).toBe(true)
      }
    })

    test("should verify proofs from test vectors", () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup parameters
        const generator = hexToPoint(testVector.setup.generator)
        const pp: Remasking.ElGamalParameters = { generator }

        const aggregatePublicKey = hexToPoint(
          testVector.setup.aggregate_public_key,
        )
        const sharedKey: Remasking.ElGamalPublicKey = {
          point: aggregatePublicKey,
        }

        // Cards
        const originalMasked: Remasking.MaskedCard = {
          c1: hexToPoint(testVector.original_masked_card.c1),
          c2: hexToPoint(testVector.original_masked_card.c2),
        }

        const remaskedCard: Remasking.MaskedCard = {
          c1: hexToPoint(testVector.expected_remasked_card.c1),
          c2: hexToPoint(testVector.expected_remasked_card.c2),
        }

        // Proof from test vector
        const proof: Remasking.RemaskingProof = {
          commitmentG: hexToPoint(testVector.remasking_proof.commitment_g),
          commitmentH: hexToPoint(testVector.remasking_proof.commitment_h),
          challenge: BigInt(testVector.remasking_proof.challenge),
          response: BigInt(testVector.remasking_proof.response),
        }

        // Verify the proof
        const isValid = Remasking.verifyRemasking(
          pp,
          sharedKey,
          originalMasked,
          remaskedCard,
          proof,
        )
        expect(isValid).toBe(testVector.verification_result)
      }
    })
  })

  describe("Combined Operations", () => {
    test("should perform remasking with proof generation", () => {
      for (const testVector of testVectors.test_vectors) {
        // Setup parameters
        const generator = hexToPoint(testVector.setup.generator)
        const pp: Remasking.ElGamalParameters = { generator }

        const aggregatePublicKey = hexToPoint(
          testVector.setup.aggregate_public_key,
        )
        const sharedKey: Remasking.ElGamalPublicKey = {
          point: aggregatePublicKey,
        }

        // Original masked card
        const originalMasked: Remasking.MaskedCard = {
          c1: hexToPoint(testVector.original_masked_card.c1),
          c2: hexToPoint(testVector.original_masked_card.c2),
        }

        const alpha = BigInt(testVector.remasking_factor)

        // Perform combined operation
        const { remaskedCard, proof } = Remasking.remaskWithProof(
          pp,
          sharedKey,
          originalMasked,
          alpha,
        )

        // Verify the result
        const isValid = Remasking.verifyRemasking(
          pp,
          sharedKey,
          originalMasked,
          remaskedCard,
          proof,
        )
        expect(isValid).toBe(true)

        // Verify remasking matches expected
        const expectedRemasked: Remasking.MaskedCard = {
          c1: hexToPoint(testVector.expected_remasked_card.c1),
          c2: hexToPoint(testVector.expected_remasked_card.c2),
        }

        expect(arePointsEqual(remaskedCard.c1, expectedRemasked.c1)).toBe(true)
        expect(arePointsEqual(remaskedCard.c2, expectedRemasked.c2)).toBe(true)
      }
    })
  })

  describe("Homomorphic Properties", () => {
    test("should maintain homomorphic properties", () => {
      const testVector = testVectors.test_vectors[0]!

      // Setup
      const generator = hexToPoint(testVector.setup.generator)
      const pp: Remasking.ElGamalParameters = { generator }

      const aggregatePublicKey = hexToPoint(
        testVector.setup.aggregate_public_key,
      )
      const sharedKey: Remasking.ElGamalPublicKey = {
        point: aggregatePublicKey,
      }

      const originalMasked: Remasking.MaskedCard = {
        c1: hexToPoint(testVector.original_masked_card.c1),
        c2: hexToPoint(testVector.original_masked_card.c2),
      }

      const alpha1 = BigInt(testVector.remasking_factor)
      const alpha2 = BigInt("0x123456789abcdef")

      // Apply remasking twice
      const remasked1 = Remasking.remask(pp, sharedKey, originalMasked, alpha1)
      const remasked2 = Remasking.remask(pp, sharedKey, remasked1, alpha2)

      // Apply combined remasking factor
      const alphaCombined = alpha1 + alpha2
      const remaskedCombined = Remasking.remask(
        pp,
        sharedKey,
        originalMasked,
        alphaCombined,
      )

      // Results should be equal (modulo curve order for scalars)
      expect(arePointsEqual(remasked2.c1, remaskedCombined.c1)).toBe(true)
      expect(arePointsEqual(remasked2.c2, remaskedCombined.c2)).toBe(true)
    })
  })

  describe("Edge Cases and Error Handling", () => {
    test("should handle zero remasking factor", () => {
      const testVector = testVectors.test_vectors[0]!

      // Setup
      const generator = hexToPoint(testVector.setup.generator)
      const pp: Remasking.ElGamalParameters = { generator }

      const aggregatePublicKey = hexToPoint(
        testVector.setup.aggregate_public_key,
      )
      const sharedKey: Remasking.ElGamalPublicKey = {
        point: aggregatePublicKey,
      }

      const originalMasked: Remasking.MaskedCard = {
        c1: hexToPoint(testVector.original_masked_card.c1),
        c2: hexToPoint(testVector.original_masked_card.c2),
      }

      // Remask with zero factor (should leave card unchanged)
      const remasked = Remasking.remask(pp, sharedKey, originalMasked, 0n)

      // Should be equal to original
      expect(arePointsEqual(remasked.c1, originalMasked.c1)).toBe(true)
      expect(arePointsEqual(remasked.c2, originalMasked.c2)).toBe(true)
    })

    test("should reject invalid proofs", () => {
      const testVector = testVectors.test_vectors[0]!

      // Setup
      const generator = hexToPoint(testVector.setup.generator)
      const pp: Remasking.ElGamalParameters = { generator }

      const aggregatePublicKey = hexToPoint(
        testVector.setup.aggregate_public_key,
      )
      const sharedKey: Remasking.ElGamalPublicKey = {
        point: aggregatePublicKey,
      }

      const originalMasked: Remasking.MaskedCard = {
        c1: hexToPoint(testVector.original_masked_card.c1),
        c2: hexToPoint(testVector.original_masked_card.c2),
      }

      const remaskedCard: Remasking.MaskedCard = {
        c1: hexToPoint(testVector.expected_remasked_card.c1),
        c2: hexToPoint(testVector.expected_remasked_card.c2),
      }

      // Create invalid proof (modify response)
      const invalidProof: Remasking.RemaskingProof = {
        commitmentG: hexToPoint(testVector.remasking_proof.commitment_g),
        commitmentH: hexToPoint(testVector.remasking_proof.commitment_h),
        challenge: BigInt(testVector.remasking_proof.challenge),
        response: BigInt(testVector.remasking_proof.response) + 1n, // Invalid
      }

      // Should reject invalid proof
      const isValid = Remasking.verifyRemasking(
        pp,
        sharedKey,
        originalMasked,
        remaskedCard,
        invalidProof,
      )
      expect(isValid).toBe(false)
    })
  })

  describe("Serialization Functions", () => {
    test("should serialize and deserialize masked cards", () => {
      const testVector = testVectors.test_vectors[0]!

      const originalMasked: Remasking.MaskedCard = {
        c1: hexToPoint(testVector.original_masked_card.c1),
        c2: hexToPoint(testVector.original_masked_card.c2),
      }

      // Serialize and deserialize
      const serialized = Remasking.maskedCardToHex(originalMasked)
      const deserialized = Remasking.hexToMaskedCard(serialized)

      // Should be equal
      expect(Remasking.maskedCardsEqual(originalMasked, deserialized)).toBe(
        true,
      )
    })

    test("should serialize and deserialize remasking proofs", () => {
      const testVector = testVectors.test_vectors[0]!

      const proof: Remasking.RemaskingProof = {
        commitmentG: hexToPoint(testVector.remasking_proof.commitment_g),
        commitmentH: hexToPoint(testVector.remasking_proof.commitment_h),
        challenge: BigInt(testVector.remasking_proof.challenge),
        response: BigInt(testVector.remasking_proof.response),
      }

      // Serialize and deserialize
      const serialized = Remasking.remaskingProofToHex(proof)
      const deserialized = Remasking.hexToRemaskingProof(serialized)

      // Should be equal
      expect(Remasking.remaskingProofsEqual(proof, deserialized)).toBe(true)
    })
  })

  describe("Compatibility with Masking Module", () => {
    test("should be compatible with existing masking operations", () => {
      const testVector = testVectors.test_vectors[0]!

      // Setup using existing masking module
      const generator = hexToPoint(testVector.setup.generator)
      const pp: Remasking.ElGamalParameters = { generator }

      const aggregatePublicKey = hexToPoint(
        testVector.setup.aggregate_public_key,
      )
      const sharedKey: Remasking.ElGamalPublicKey = {
        point: aggregatePublicKey,
      }

      // Create a card using masking module
      const card = Masking.randomCard()
      const maskingAlpha = BigInt("0x1234567890abcdef")

      // Convert interfaces for masking module
      const elgamalParams = { generator }
      const elgamalKey = { point: aggregatePublicKey }

      const { maskedCard } = Masking.mask(
        elgamalParams,
        elgamalKey,
        card,
        maskingAlpha,
      )

      // Convert to remasking interface
      const remaskingMaskedCard: Remasking.MaskedCard = {
        c1: maskedCard.c1,
        c2: maskedCard.c2,
      }

      // Apply remasking
      const remaskingAlpha = BigInt("0xfedcba0987654321")
      const remasked = Remasking.remask(
        pp,
        sharedKey,
        remaskingMaskedCard,
        remaskingAlpha,
      )

      // Generate and verify proof
      const proof = Remasking.proveRemasking(
        pp,
        sharedKey,
        remaskingMaskedCard,
        remasked,
        remaskingAlpha,
      )
      const isValid = Remasking.verifyRemasking(
        pp,
        sharedKey,
        remaskingMaskedCard,
        remasked,
        proof,
      )

      expect(isValid).toBe(true)
    })
  })
})
