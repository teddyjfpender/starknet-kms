import { describe, expect, it } from "bun:test"
import { StarkCurve, getPublicKey } from "../../src/core/curve"
import { poseidonHashScalars } from "../../src/core/hash"
import {
  G,
  POINT_AT_INFINITY,
  arePointsEqual,
  scalarMultiply,
} from "../../src/core/point"
import { CURVE_ORDER, randScalar } from "../../src/core/scalar"

describe("Integration tests", () => {
  describe("getPublicKey", () => {
    it("generates public key for private key = 0", () => {
      const publicKey = getPublicKey(0n)
      expect(arePointsEqual(publicKey, POINT_AT_INFINITY)).toBe(true)
    })

    it("generates public key for private key = 1", () => {
      const publicKey = getPublicKey(1n)
      expect(arePointsEqual(publicKey, G)).toBe(true)
    })

    it("generates public key for private key = n-1", () => {
      const privateKey = CURVE_ORDER - 1n
      const publicKey = getPublicKey(privateKey)
      const expected = scalarMultiply(privateKey, G)
      expect(arePointsEqual(publicKey, expected)).toBe(true)
    })

    it("handles modular reduction correctly", () => {
      const privateKey = CURVE_ORDER + 5n // Should reduce to 5n
      const publicKey = getPublicKey(privateKey)
      const expected = scalarMultiply(5n, G)
      expect(arePointsEqual(publicKey, expected)).toBe(true)
    })

    it("works with random private keys", () => {
      for (let i = 0; i < 10; i++) {
        const privateKey = randScalar()
        const publicKey = getPublicKey(privateKey)
        const expected = scalarMultiply(privateKey, G)
        expect(arePointsEqual(publicKey, expected)).toBe(true)
      }
    })
  })

  describe("poseidonHashScalars", () => {
    it("produces deterministic results", () => {
      const inputs = [1n, 2n, 3n]
      const hash1 = poseidonHashScalars(inputs)
      const hash2 = poseidonHashScalars(inputs)
      expect(hash1).toBe(hash2)
    })

    it("produces different results for different inputs", () => {
      const hash1 = poseidonHashScalars([1n, 2n, 3n])
      const hash2 = poseidonHashScalars([3n, 2n, 1n])
      const hash3 = poseidonHashScalars([1n, 2n, 4n])

      expect(hash1).not.toBe(hash2)
      expect(hash1).not.toBe(hash3)
      expect(hash2).not.toBe(hash3)
    })

    it("returns value in valid range [0, n)", () => {
      const testCases = [
        [1n],
        [1n, 2n],
        [1n, 2n, 3n],
        [randScalar(), randScalar()],
        [CURVE_ORDER - 1n, CURVE_ORDER - 1n],
      ]

      for (const inputs of testCases) {
        const hash = poseidonHashScalars(inputs)
        expect(hash).toBeGreaterThanOrEqual(0n)
        expect(hash).toBeLessThan(CURVE_ORDER)
      }
    })

    it("handles large inputs by reducing them modulo n", () => {
      const largeInputs = [CURVE_ORDER + 1n, CURVE_ORDER * 2n + 5n]
      const hash = poseidonHashScalars(largeInputs)
      expect(hash).toBeGreaterThanOrEqual(0n)
      expect(hash).toBeLessThan(CURVE_ORDER)
    })

    it("handles empty input array", () => {
      const hash = poseidonHashScalars([])
      expect(hash).toBeGreaterThanOrEqual(0n)
      expect(hash).toBeLessThan(CURVE_ORDER)
    })
  })

  describe("StarkCurve interface", () => {
    it("has correct curve parameters", () => {
      expect(StarkCurve.order).toBe(CURVE_ORDER)
      expect(StarkCurve.base).toBe(G)
      expect(StarkCurve.zero).toBe(POINT_AT_INFINITY)
    })

    it("add operation works correctly", () => {
      const P = StarkCurve.multiply(randScalar(), StarkCurve.base)
      const Q = StarkCurve.multiply(randScalar(), StarkCurve.base)

      const sum1 = StarkCurve.add(P, Q)
      const sum2 = StarkCurve.add(Q, P) // Commutativity

      expect(StarkCurve.equals(sum1, sum2)).toBe(true)
    })

    it("multiply operation works correctly", () => {
      const k = randScalar()
      const result = StarkCurve.multiply(k, StarkCurve.base)
      const expected = scalarMultiply(k, G)

      expect(StarkCurve.equals(result, expected)).toBe(true)
    })

    it("negate operation works correctly", () => {
      const P = StarkCurve.multiply(randScalar(), StarkCurve.base)
      const negP = StarkCurve.negate(P)
      const sum = StarkCurve.add(P, negP)

      expect(StarkCurve.equals(sum, StarkCurve.zero)).toBe(true)
    })

    it("isValid works correctly", () => {
      const validPoints = [
        StarkCurve.base,
        StarkCurve.zero,
        StarkCurve.multiply(randScalar(), StarkCurve.base),
      ]

      for (const P of validPoints) {
        expect(StarkCurve.isValid(P)).toBe(true)
      }
    })

    it("conversion functions work correctly", () => {
      const scalar = randScalar()
      const point = StarkCurve.multiply(scalar, StarkCurve.base)

      // Test scalar conversions
      const scalarHex = StarkCurve.scalarToHex(scalar)
      const recoveredScalar = StarkCurve.hexToScalar(scalarHex)
      expect(recoveredScalar).toBe(scalar)

      // Test point conversions
      const pointHex = StarkCurve.pointToHex(point)
      const recoveredPoint = StarkCurve.hexToPoint(pointHex)
      expect(StarkCurve.equals(point, recoveredPoint)).toBe(true)
    })

    it("getPublicKey works correctly", () => {
      const privateKey = randScalar()
      const publicKey1 = StarkCurve.getPublicKey(privateKey)
      const publicKey2 = getPublicKey(privateKey)

      expect(StarkCurve.equals(publicKey1, publicKey2)).toBe(true)
    })

    it("randScalar generates valid scalars", () => {
      for (let i = 0; i < 10; i++) {
        const scalar = StarkCurve.randScalar()
        expect(scalar).toBeGreaterThan(0n)
        expect(scalar).toBeLessThan(StarkCurve.order)
      }
    })
  })

  describe("End-to-end cryptographic operations", () => {
    it("key generation and point operations", () => {
      // Generate two key pairs
      const priv1 = randScalar()
      const priv2 = randScalar()

      const pub1 = getPublicKey(priv1)
      const pub2 = getPublicKey(priv2)

      // Verify public keys are different (with very high probability)
      expect(arePointsEqual(pub1, pub2)).toBe(false)

      // Test that priv1 * pub2 = priv2 * pub1 (Diffie-Hellman property)
      const shared1 = scalarMultiply(priv1, pub2)
      const shared2 = scalarMultiply(priv2, pub1)

      expect(arePointsEqual(shared1, shared2)).toBe(true)
    })

    it("hash-to-scalar pipeline", () => {
      const message = [1n, 2n, 3n, 4n, 5n]
      const hash = poseidonHashScalars(message)

      // Use hash as a private key
      const publicKey = getPublicKey(hash)

      // Verify the public key is valid
      expect(arePointsEqual(publicKey, POINT_AT_INFINITY)).toBe(false) // Should not be infinity for random hash

      // Verify deterministic: same message produces same key pair
      const hash2 = poseidonHashScalars(message)
      const publicKey2 = getPublicKey(hash2)

      expect(hash).toBe(hash2)
      expect(arePointsEqual(publicKey, publicKey2)).toBe(true)
    })
  })
})
