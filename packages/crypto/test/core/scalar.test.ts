import { describe, expect, it } from "bun:test"
import { InvalidHexError } from "../../src/core/errors"
import {
  CURVE_ORDER,
  bigIntToHex,
  hexToBigInt,
  moduloOrder,
  randScalar,
} from "../../src/core/scalar"

describe("Scalar operations", () => {
  describe("moduloOrder", () => {
    it("keeps values in [0, n)", () => {
      expect(moduloOrder(CURVE_ORDER)).toBe(0n)
      expect(moduloOrder(-1n)).toBe(CURVE_ORDER - 1n)
      expect(moduloOrder(CURVE_ORDER + 1n)).toBe(1n)
      expect(moduloOrder(-CURVE_ORDER)).toBe(0n)
    })

    it("handles boundary cases", () => {
      expect(moduloOrder(0n)).toBe(0n)
      expect(moduloOrder(CURVE_ORDER - 1n)).toBe(CURVE_ORDER - 1n)
      expect(moduloOrder(CURVE_ORDER * 2n + 5n)).toBe(5n)
    })

    it("handles positive and negative values", () => {
      const positiveValue = 123456789n
      const negativeValue = -123456789n

      expect(moduloOrder(positiveValue)).toBe(positiveValue % CURVE_ORDER)
      expect(moduloOrder(negativeValue)).toBe(
        ((negativeValue % CURVE_ORDER) + CURVE_ORDER) % CURVE_ORDER,
      )
    })
  })

  describe("randScalar", () => {
    it("never returns zero", () => {
      for (let i = 0; i < 1000; i++) {
        const scalar = randScalar()
        expect(scalar).not.toBe(0n)
        expect(scalar).toBeGreaterThan(0n)
        expect(scalar).toBeLessThan(CURVE_ORDER)
      }
    })

    it("generates different values", () => {
      const values = new Set<bigint>()
      for (let i = 0; i < 100; i++) {
        values.add(randScalar())
      }
      // Should have generated many different values (allowing for some collision probability)
      expect(values.size).toBeGreaterThan(90)
    })

    it("stays within valid range", () => {
      for (let i = 0; i < 100; i++) {
        const scalar = randScalar()
        expect(scalar).toBeGreaterThanOrEqual(1n)
        expect(scalar).toBeLessThan(CURVE_ORDER)
      }
    })
  })

  describe("bigIntToHex & hexToBigInt round-trip", () => {
    it("round-trips successfully for valid values", () => {
      const testValues = [
        0n,
        1n,
        255n,
        256n,
        BigInt("0x1234abcd"),
        BigInt("0xdeadbeef"),
        CURVE_ORDER - 1n,
      ]

      for (const value of testValues) {
        const hex = bigIntToHex(value)
        const recovered = hexToBigInt(hex)
        expect(recovered).toBe(value)
      }
    })

    it("handles random values in valid range", () => {
      for (let i = 0; i < 100; i++) {
        const original = randScalar()
        const hex = bigIntToHex(original)
        const recovered = hexToBigInt(hex)
        expect(recovered).toBe(original)
      }
    })
  })

  describe("hexToBigInt validation", () => {
    it("rejects null and undefined", () => {
      expect(() => hexToBigInt(null as any)).toThrow(InvalidHexError)
      expect(() => hexToBigInt(undefined as any)).toThrow(InvalidHexError)
    })

    it("rejects non-string inputs", () => {
      expect(() => hexToBigInt(123 as any)).toThrow(InvalidHexError)
      expect(() => hexToBigInt({} as any)).toThrow(InvalidHexError)
      expect(() => hexToBigInt([] as any)).toThrow(InvalidHexError)
    })

    it("rejects empty strings", () => {
      expect(() => hexToBigInt("")).toThrow(InvalidHexError)
      expect(() => hexToBigInt("0x")).toThrow(InvalidHexError)
    })

    it("rejects invalid hex characters", () => {
      expect(() => hexToBigInt("0xGG")).toThrow(InvalidHexError)
      expect(() => hexToBigInt("0xZZ")).toThrow(InvalidHexError)
      expect(() => hexToBigInt("0x12G4")).toThrow(InvalidHexError)
    })

    it("rejects overly long hex strings", () => {
      const longHex = `0x${"1".repeat(65)}` // 65 chars > 64 limit
      expect(() => hexToBigInt(longHex)).toThrow(InvalidHexError)
    })

    it("accepts valid hex strings with and without 0x prefix", () => {
      expect(hexToBigInt("1234")).toBe(BigInt("0x1234"))
      expect(hexToBigInt("0x1234")).toBe(BigInt("0x1234"))
      expect(hexToBigInt("abcdef")).toBe(BigInt("0xabcdef"))
      expect(hexToBigInt("ABCDEF")).toBe(BigInt("0xABCDEF"))
    })
  })

  describe("bigIntToHex formatting", () => {
    it("always includes 0x prefix", () => {
      expect(bigIntToHex(0n)).toMatch(/^0x/)
      expect(bigIntToHex(255n)).toMatch(/^0x/)
      expect(bigIntToHex(BigInt("0x1234"))).toMatch(/^0x/)
    })

    it("produces valid hex strings", () => {
      const testValues = [0n, 1n, 15n, 16n, 255n, 256n, BigInt("0xdeadbeef")]

      for (const value of testValues) {
        const hex = bigIntToHex(value)
        expect(hex).toMatch(/^0x[0-9a-f]+$/i)
        expect(BigInt(hex)).toBe(value)
      }
    })
  })
})
