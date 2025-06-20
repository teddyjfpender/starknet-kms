import { describe, expect, it } from "bun:test"
import { InvalidHexError } from "../../src/core/errors"
import {
  G,
  POINT_AT_INFINITY,
  addPoints,
  arePointsEqual,
  assertPointValidity,
  hexToPoint,
  negatePoint,
  pointToHex,
  scalarMultiply,
} from "../../src/core/point"
import { CURVE_ORDER, randScalar } from "../../src/core/scalar"

describe("Point operations", () => {
  describe("Group law verification", () => {
    describe("Identity element", () => {
      it("P + O = P for any point P", () => {
        const testPoints = [
          G,
          scalarMultiply(2n, G),
          scalarMultiply(randScalar(), G),
          POINT_AT_INFINITY,
        ]

        for (const P of testPoints) {
          expect(arePointsEqual(addPoints(P, POINT_AT_INFINITY), P)).toBe(true)
          expect(arePointsEqual(addPoints(POINT_AT_INFINITY, P), P)).toBe(true)
        }
      })
    })

    describe("Inverses", () => {
      it("P + (-P) = O for any point P", () => {
        const testPoints = [
          G,
          scalarMultiply(2n, G),
          scalarMultiply(randScalar(), G),
        ]

        for (const P of testPoints) {
          const negP = negatePoint(P)
          expect(arePointsEqual(addPoints(P, negP), POINT_AT_INFINITY)).toBe(
            true,
          )
        }
      })

      it("-O = O", () => {
        expect(
          arePointsEqual(negatePoint(POINT_AT_INFINITY), POINT_AT_INFINITY),
        ).toBe(true)
      })
    })

    describe("Commutativity", () => {
      it("P + Q = Q + P", () => {
        const P = scalarMultiply(randScalar(), G)
        const Q = scalarMultiply(randScalar(), G)

        expect(arePointsEqual(addPoints(P, Q), addPoints(Q, P))).toBe(true)
      })

      it("works with multiple random point pairs", () => {
        for (let i = 0; i < 10; i++) {
          const P = scalarMultiply(randScalar(), G)
          const Q = scalarMultiply(randScalar(), G)

          expect(arePointsEqual(addPoints(P, Q), addPoints(Q, P))).toBe(true)
        }
      })
    })

    describe("Associativity", () => {
      it("(P + Q) + R = P + (Q + R)", () => {
        const a = randScalar()
        const b = randScalar()
        const c = randScalar()

        const A = scalarMultiply(a, G)
        const B = scalarMultiply(b, G)
        const C = scalarMultiply(c, G)

        const left = addPoints(addPoints(A, B), C)
        const right = addPoints(A, addPoints(B, C))

        expect(arePointsEqual(left, right)).toBe(true)
      })

      it("works with multiple random triples", () => {
        for (let i = 0; i < 5; i++) {
          const A = scalarMultiply(randScalar(), G)
          const B = scalarMultiply(randScalar(), G)
          const C = scalarMultiply(randScalar(), G)

          const left = addPoints(addPoints(A, B), C)
          const right = addPoints(A, addPoints(B, C))

          expect(arePointsEqual(left, right)).toBe(true)
        }
      })
    })
  })

  describe("scalarMultiply edge cases", () => {
    it("0 * G = O", () => {
      expect(arePointsEqual(scalarMultiply(0n, G), POINT_AT_INFINITY)).toBe(
        true,
      )
    })

    it("n * G = O (where n is curve order)", () => {
      expect(
        arePointsEqual(scalarMultiply(CURVE_ORDER, G), POINT_AT_INFINITY),
      ).toBe(true)
    })

    it("1 * G = G", () => {
      expect(arePointsEqual(scalarMultiply(1n, G), G)).toBe(true)
    })

    it("k * O = O for any scalar k", () => {
      const testScalars = [0n, 1n, 2n, CURVE_ORDER - 1n, randScalar()]

      for (const k of testScalars) {
        expect(
          arePointsEqual(
            scalarMultiply(k, POINT_AT_INFINITY),
            POINT_AT_INFINITY,
          ),
        ).toBe(true)
      }
    })

    it("(n-1) * G = -G", () => {
      const result = scalarMultiply(CURVE_ORDER - 1n, G)
      const negG = negatePoint(G)
      expect(arePointsEqual(result, negG)).toBe(true)
    })
  })

  describe("Point serialization", () => {
    describe("pointToHex & hexToPoint round-trip", () => {
      it("round-trips successfully for compressed format", () => {
        const testPoints = [
          G,
          scalarMultiply(2n, G),
          scalarMultiply(randScalar(), G),
          POINT_AT_INFINITY,
        ]

        for (const P of testPoints) {
          const hex = pointToHex(P, true) // compressed
          const recovered = hexToPoint(hex)
          expect(arePointsEqual(P, recovered)).toBe(true)
        }
      })

      it("round-trips successfully for uncompressed format", () => {
        const testPoints = [
          G,
          scalarMultiply(2n, G),
          scalarMultiply(randScalar(), G),
          POINT_AT_INFINITY,
        ]

        for (const P of testPoints) {
          const hex = pointToHex(P, false) // uncompressed
          const recovered = hexToPoint(hex)
          expect(arePointsEqual(P, recovered)).toBe(true)
        }
      })

      it("works with random points", () => {
        for (let i = 0; i < 10; i++) {
          const P = scalarMultiply(randScalar(), G)

          // Test both compressed and uncompressed
          const compressedHex = pointToHex(P, true)
          const uncompressedHex = pointToHex(P, false)

          const recoveredCompressed = hexToPoint(compressedHex)
          const recoveredUncompressed = hexToPoint(uncompressedHex)

          expect(arePointsEqual(P, recoveredCompressed)).toBe(true)
          expect(arePointsEqual(P, recoveredUncompressed)).toBe(true)
        }
      })
    })

    describe("Infinity point special cases", () => {
      it("handles compressed infinity representation", () => {
        const hex = pointToHex(POINT_AT_INFINITY, true)
        expect(hex).toBe("0x00")
        expect(arePointsEqual(hexToPoint(hex), POINT_AT_INFINITY)).toBe(true)
      })

      it("handles uncompressed infinity representation", () => {
        const hex = pointToHex(POINT_AT_INFINITY, false)
        expect(hex).toBe(`0x04${"00".repeat(64)}`)
        expect(arePointsEqual(hexToPoint(hex), POINT_AT_INFINITY)).toBe(true)
      })
    })

    describe("hexToPoint validation", () => {
      it("rejects null and undefined", () => {
        expect(() => hexToPoint(null as any)).toThrow(InvalidHexError)
        expect(() => hexToPoint(undefined as any)).toThrow(InvalidHexError)
      })

      it("rejects non-string inputs", () => {
        expect(() => hexToPoint(123 as any)).toThrow(InvalidHexError)
        expect(() => hexToPoint({} as any)).toThrow(InvalidHexError)
      })

      it("rejects empty strings", () => {
        expect(() => hexToPoint("")).toThrow(InvalidHexError)
        expect(() => hexToPoint("0x")).toThrow(InvalidHexError)
      })

      it("rejects invalid hex characters", () => {
        expect(() => hexToPoint("0xGG")).toThrow(InvalidHexError)
        expect(() => hexToPoint("0x12G4")).toThrow(InvalidHexError)
      })

      it("rejects overly long hex strings", () => {
        const longHex = `0x${"1".repeat(131)}` // 131 chars > 130 limit
        expect(() => hexToPoint(longHex)).toThrow(InvalidHexError)
      })
    })
  })

  describe("Point validation", () => {
    it("validates points on the curve", () => {
      const validPoints = [
        G,
        scalarMultiply(2n, G),
        scalarMultiply(randScalar(), G),
        POINT_AT_INFINITY,
      ]

      for (const P of validPoints) {
        expect(() => assertPointValidity(P)).not.toThrow()
      }
    })

    it("point equality works correctly", () => {
      const P = scalarMultiply(randScalar(), G)
      const Q = scalarMultiply(randScalar(), G)

      expect(arePointsEqual(P, P)).toBe(true)
      expect(arePointsEqual(Q, Q)).toBe(true)
      expect(arePointsEqual(POINT_AT_INFINITY, POINT_AT_INFINITY)).toBe(true)

      // Different points should not be equal (with very high probability)
      expect(arePointsEqual(P, Q)).toBe(false)
    })
  })

  describe("Scalar-point relationships", () => {
    it("k * (m * G) = (k * m) * G", () => {
      const k = randScalar()
      const m = randScalar()

      const left = scalarMultiply(k, scalarMultiply(m, G))
      const right = scalarMultiply((k * m) % CURVE_ORDER, G)

      expect(arePointsEqual(left, right)).toBe(true)
    })

    it("(k + m) * G = k * G + m * G", () => {
      const k = randScalar()
      const m = randScalar()

      const left = scalarMultiply((k + m) % CURVE_ORDER, G)
      const right = addPoints(scalarMultiply(k, G), scalarMultiply(m, G))

      expect(arePointsEqual(left, right)).toBe(true)
    })
  })
})
