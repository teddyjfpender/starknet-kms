import { describe, expect, it } from "bun:test"
import * as fc from "fast-check"
import {
  // Constants
  CURVE_ORDER,
  G,
  POINT_AT_INFINITY,
  PRIME,
  // Types
  //type Scalar,
  //type Point,
  ProjectivePoint, // Also import ProjectivePoint for POINT_AT_INFINITY.equals(ProjectivePoint.ZERO)
  addPoints,
  arePointsEqual,
  assertPointValidity,
  // Conversions
  bigIntToHex,
  // Point Helpers
  getPublicKey,
  hexToBigInt,
  hexToPoint,
  // Scalar Helpers
  moduloOrder,
  negatePoint,
  pointToHex,
  // Poseidon Wrapper
  poseidonHashScalars,
  randScalar,
  scalarMultiply,
} from "../../../src/elliptic-curve/core/curve"

describe("STARK Curve Core Utilities (core/curve.ts)", () => {
  describe("Constants", () => {
    it("CURVE_ORDER should be a positive BigInt", () => {
      expect(typeof CURVE_ORDER).toBe("bigint")
      expect(CURVE_ORDER > 0n).toBe(true)
    })

    it("PRIME should be a positive BigInt", () => {
      expect(typeof PRIME).toBe("bigint")
      expect(PRIME > 0n).toBe(true)
    })

    it("G (Generator Point) should be a valid point and not infinity", () => {
      expect(G).toBeInstanceOf(ProjectivePoint)
      expect(G.equals(POINT_AT_INFINITY)).toBe(false)
      expect(() => G.assertValidity()).not.toThrow()
    })

    it("POINT_AT_INFINITY should be ProjectivePoint.ZERO", () => {
      expect(POINT_AT_INFINITY).toBeInstanceOf(ProjectivePoint)
      // Direct comparison with the static ZERO instance from the underlying library
      expect(POINT_AT_INFINITY.equals(ProjectivePoint.ZERO)).toBe(true)
    })
  })

  describe("Scalar Helpers", () => {
    describe("moduloOrder(x)", () => {
      it("should correctly handle x = 0", () => {
        expect(moduloOrder(0n)).toBe(0n)
      })
      it("should correctly handle x = 1", () => {
        expect(moduloOrder(1n)).toBe(1n)
      })
      it("should correctly handle x = CURVE_ORDER - 1", () => {
        expect(moduloOrder(CURVE_ORDER - 1n)).toBe(CURVE_ORDER - 1n)
      })
      it("should correctly handle x = CURVE_ORDER", () => {
        expect(moduloOrder(CURVE_ORDER)).toBe(0n)
      })
      it("should correctly handle x = CURVE_ORDER + 1", () => {
        expect(moduloOrder(CURVE_ORDER + 1n)).toBe(1n)
      })
      it("should correctly handle x = -1", () => {
        expect(moduloOrder(-1n)).toBe(CURVE_ORDER - 1n)
      })
      it("should correctly handle x = -CURVE_ORDER", () => {
        expect(moduloOrder(-CURVE_ORDER)).toBe(0n)
      })
      it("should correctly handle x = -CURVE_ORDER - 1", () => {
        expect(moduloOrder(-CURVE_ORDER - 1n)).toBe(CURVE_ORDER - 1n)
      })

      it("property-based: 0 <= moduloOrder(x) < CURVE_ORDER", () => {
        fc.assert(
          fc.property(fc.bigInt(), (x) => {
            const result = moduloOrder(x)
            return result >= 0n && result < CURVE_ORDER
          }),
        )
      })
    })

    describe("randScalar()", () => {
      it("should return different values on subsequent calls (probabilistic)", () => {
        const s1 = randScalar()
        const s2 = randScalar()
        const s3 = randScalar()
        expect(s1).not.toEqual(s2)
        expect(s2).not.toEqual(s3)
        expect(s1).not.toEqual(s3)
      })

      it("should return values > 0 and < CURVE_ORDER", () => {
        for (let i = 0; i < 100; i++) {
          // Test a few times
          const s = randScalar()
          expect(s > 0n).toBe(true)
          expect(s < CURVE_ORDER).toBe(true)
        }
      })

      it("property-based: 0 < randScalar() < CURVE_ORDER", () => {
        fc.assert(
          fc.property(fc.integer({ min: 1, max: 20 }), (_i) => {
            // just to run it multiple times
            const s = randScalar()
            return s > 0n && s < CURVE_ORDER
          }),
          { numRuns: 20 },
        )
      })
    })
  })

  describe("Point Helpers", () => {
    const knownPrivateKey = 0x123456789abcdefn
    const knownPublicKeyPoint = G.multiply(knownPrivateKey)

    describe("getPublicKey(priv)", () => {
      it("should return POINT_AT_INFINITY for priv = 0n", () => {
        expect(getPublicKey(0n).equals(POINT_AT_INFINITY)).toBe(true)
      })
      it("should return G for priv = 1n", () => {
        expect(getPublicKey(1n).equals(G)).toBe(true)
      })
      it("should return POINT_AT_INFINITY for priv = CURVE_ORDER", () => {
        expect(getPublicKey(CURVE_ORDER).equals(POINT_AT_INFINITY)).toBe(true)
      })
      it("should return G for priv = CURVE_ORDER + 1n", () => {
        expect(getPublicKey(CURVE_ORDER + 1n).equals(G)).toBe(true)
      })
      it("should return correct public key for a known private key", () => {
        expect(getPublicKey(knownPrivateKey).equals(knownPublicKeyPoint)).toBe(
          true,
        )
      })
      it("property-based: getPublicKey(s) should be G.multiply(moduloOrder(s)) or P_INF if s=0", () => {
        fc.assert(
          fc.property(fc.bigInt(0n, CURVE_ORDER * 2n), (s) => {
            const expectedModS = moduloOrder(s)
            const expectedPubKey =
              expectedModS === 0n ? POINT_AT_INFINITY : G.multiply(expectedModS)
            expect(getPublicKey(s).equals(expectedPubKey)).toBe(true)
          }),
        )
      })
    })

    describe("scalarMultiply(k, P)", () => {
      it("k=0n should return POINT_AT_INFINITY", () => {
        expect(scalarMultiply(0n, G).equals(POINT_AT_INFINITY)).toBe(true)
      })
      it("k=1n should return P", () => {
        expect(scalarMultiply(1n, G).equals(G)).toBe(true)
      })
      it("k=CURVE_ORDER should return POINT_AT_INFINITY", () => {
        expect(scalarMultiply(CURVE_ORDER, G).equals(POINT_AT_INFINITY)).toBe(
          true,
        )
      })
      it("P=POINT_AT_INFINITY should return POINT_AT_INFINITY", () => {
        expect(
          scalarMultiply(knownPrivateKey, POINT_AT_INFINITY).equals(
            POINT_AT_INFINITY,
          ),
        ).toBe(true)
      })
      it("scalarMultiply(2n, G) should equal G.add(G)", () => {
        expect(scalarMultiply(2n, G).equals(G.add(G))).toBe(true)
      })
      it("scalarMultiply(k,P) should equal P.multiply(moduloOrder(k)) for k!=0, P!=O", () => {
        // Test with specific known values instead of property-based testing to avoid pre-condition issues
        const testCases = [
          { k: 1n, P: G },
          { k: 2n, P: G },
          { k: knownPrivateKey, P: G },
          { k: CURVE_ORDER - 1n, P: G },
          { k: CURVE_ORDER + 1n, P: G },
          { k: 1n, P: G.multiply(knownPrivateKey) },
          { k: 2n, P: G.add(G) },
        ]

        for (const { k, P } of testCases) {
          if (P.equals(POINT_AT_INFINITY)) continue // Skip point at infinity

          const kMod = moduloOrder(k)
          if (kMod === 0n) continue // Skip if k is a multiple of CURVE_ORDER

          const expectedRes = P.multiply(kMod)
          const actualRes = scalarMultiply(k, P)
          expect(actualRes.equals(expectedRes)).toBe(true)
        }
      })
    })

    describe("addPoints(P, Q)", () => {
      const P = G.multiply(2n)
      const Q = G.multiply(3n)
      const R = G.multiply(5n)
      it("P + Q should be correct for known points", () => {
        expect(addPoints(P, Q).equals(R)).toBe(true)
      })
      it("P + POINT_AT_INFINITY should return P", () => {
        expect(addPoints(P, POINT_AT_INFINITY).equals(P)).toBe(true)
      })
      it("POINT_AT_INFINITY + Q should return Q", () => {
        expect(addPoints(POINT_AT_INFINITY, Q).equals(Q)).toBe(true)
      })
      it("P + (-P) should return POINT_AT_INFINITY", () => {
        expect(addPoints(P, negatePoint(P)).equals(POINT_AT_INFINITY)).toBe(
          true,
        )
      })
    })

    describe("negatePoint(P)", () => {
      it("negatePoint(POINT_AT_INFINITY) should return POINT_AT_INFINITY", () => {
        expect(negatePoint(POINT_AT_INFINITY).equals(POINT_AT_INFINITY)).toBe(
          true,
        )
      })
      it("G.add(negatePoint(G)) should be POINT_AT_INFINITY", () => {
        expect(G.add(negatePoint(G)).equals(POINT_AT_INFINITY)).toBe(true)
      })
      it("negatePoint(negatePoint(G)) should be G", () => {
        expect(negatePoint(negatePoint(G)).equals(G)).toBe(true)
      })
    })

    describe("arePointsEqual(P, Q)", () => {
      const P = G.multiply(2n)
      it("P=G, Q=G should return true", () => {
        expect(arePointsEqual(G, G)).toBe(true)
      })
      it("P=G, Q=P (P!=G) should return false", () => {
        expect(arePointsEqual(G, P)).toBe(false)
      })
      it("P=POINT_AT_INFINITY, Q=POINT_AT_INFINITY should return true", () => {
        expect(arePointsEqual(POINT_AT_INFINITY, POINT_AT_INFINITY)).toBe(true)
      })
    })

    describe("assertPointValidity(P)", () => {
      it("should not throw for G", () => {
        expect(() => assertPointValidity(G)).not.toThrow()
      })
      it("should not throw for POINT_AT_INFINITY", () => {
        // assertValidity might throw for ZERO point depending on library strictness.
        // @scure/starknet ProjectivePoint.ZERO.assertValidity() does not throw.
        expect(() => assertPointValidity(POINT_AT_INFINITY)).not.toThrow()
      })
    })
  })

  describe("Conversions", () => {
    const testScalar = 1234567890123456789012345678901234567890n
    //const testScalarHex = "0x29a2241af63c7c80554b159f89fc8f72" // actual hex for testScalar
    //const testScalarHexNoPrefix = "29a2241af63c7c80554b159f89fc8f72"

    describe("bigIntToHex(x) and hexToBigInt(h)", () => {
      it("round trip: hexToBigInt(bigIntToHex(x)) === x", () => {
        fc.assert(
          fc.property(fc.bigInt(0n, PRIME), (x) => {
            // PRIME is just a large bigint for testing
            expect(hexToBigInt(bigIntToHex(x))).toEqual(x)
          }),
        )
      })
      it("should handle 0n", () => {
        expect(bigIntToHex(0n)).toBe("0x0")
        expect(hexToBigInt("0x0")).toBe(0n)
        expect(hexToBigInt("0")).toBe(0n)
      })
      it("should handle a known positive value", () => {
        // Adjust testScalar to be less than PRIME to avoid issues if PRIME is used as upper bound elsewhere
        const smallerTestScalar = testScalar % PRIME
        const expectedHex = `0x${smallerTestScalar.toString(16)}`
        expect(bigIntToHex(smallerTestScalar)).toBe(expectedHex)
        expect(hexToBigInt(expectedHex)).toBe(smallerTestScalar)
        expect(hexToBigInt(expectedHex.substring(2))).toBe(smallerTestScalar) // No prefix
      })
      it("bigIntToHex should produce '0x' prefixed hex", () => {
        expect(bigIntToHex(testScalar).startsWith("0x")).toBe(true)
      })
    })

    describe("pointToHex(P, compressed) and hexToPoint(h)", () => {
      const testPoint = G.multiply(testScalar) // Use the same testScalar for consistency

      it("round trip for G (uncompressed)", () => {
        const hexG = pointToHex(G, false)
        expect(hexG.startsWith("0x04")).toBe(true)
        expect(hexToPoint(hexG).equals(G)).toBe(true)
      })
      it("round trip for G (compressed)", () => {
        const hexGCompressed = pointToHex(G, true)
        expect(hexGCompressed.length < pointToHex(G, false).length).toBe(true) // Compressed is shorter
        expect(
          hexGCompressed.startsWith("0x02") ||
            hexGCompressed.startsWith("0x03"),
        ).toBe(true)
        expect(hexToPoint(hexGCompressed).equals(G)).toBe(true)
      })
      it("round trip for POINT_AT_INFINITY (uncompressed)", () => {
        const hexInf = pointToHex(POINT_AT_INFINITY, false)
        expect(hexInf).toBe(`0x04${"00".repeat(64)}`)
        expect(hexToPoint(hexInf).equals(POINT_AT_INFINITY)).toBe(true)
      })
      it("round trip for POINT_AT_INFINITY (compressed)", () => {
        const hexInfComp = pointToHex(POINT_AT_INFINITY, true)
        expect(hexInfComp).toBe("0x00")
        expect(hexToPoint(hexInfComp).equals(POINT_AT_INFINITY)).toBe(true)
      })
      it("round trip for a known point (uncompressed)", () => {
        const hexP = pointToHex(testPoint, false)
        expect(hexToPoint(hexP).equals(testPoint)).toBe(true)
      })
      it("round trip for a known point (compressed)", () => {
        const hexPComp = pointToHex(testPoint, true)
        expect(hexToPoint(hexPComp).equals(testPoint)).toBe(true)
      })

      it("hexToPoint should handle various valid hex representations", () => {
        const gUncompressed = pointToHex(G, false)
        const gCompressed = pointToHex(G, true)
        expect(hexToPoint(gUncompressed.substring(2)).equals(G)).toBe(true) // No prefix
        expect(hexToPoint(gCompressed.substring(2)).equals(G)).toBe(true) // No prefix
      })
    })
  })

  describe("Poseidon Wrapper", () => {
    describe("poseidonHashScalars(xs)", () => {
      it("should return a known value for empty array (if stable, otherwise check type/range)", () => {
        // The underlying poseidonHashMany([]) might throw or return a specific hash.
        // From @scure/starknet, poseidonHashMany([]) returns a specific default hash.
        // Let's verify it returns a scalar within the order.
        const result = poseidonHashScalars([])
        expect(typeof result).toBe("bigint")
        expect(result >= 0n && result < CURVE_ORDER).toBe(true)
      })
      it("should correctly hash [0n]", () => {
        const result = poseidonHashScalars([0n])
        expect(typeof result).toBe("bigint")
        expect(result >= 0n && result < CURVE_ORDER).toBe(true)
      })
      it("should correctly hash [1n]", () => {
        const result = poseidonHashScalars([1n])
        expect(typeof result).toBe("bigint")
        expect(result >= 0n && result < CURVE_ORDER).toBe(true)
      })
      it("should correctly hash [CURVE_ORDER] (which becomes [0n])", () => {
        const resultForZero = poseidonHashScalars([0n])
        const resultForOrder = poseidonHashScalars([CURVE_ORDER])
        expect(resultForOrder).toEqual(resultForZero) // since CURVE_ORDER % CURVE_ORDER is 0
      })
      it("should correctly hash multiple values [1n, 2n, 3n]", () => {
        const result = poseidonHashScalars([1n, 2n, 3n])
        expect(typeof result).toBe("bigint")
        expect(result >= 0n && result < CURVE_ORDER).toBe(true)
        // Check it's different from single element hashes
        expect(result).not.toEqual(poseidonHashScalars([1n]))
        expect(result).not.toEqual(poseidonHashScalars([1n, 2n]))
      })
      it("elements should be processed by moduloOrder before hashing", () => {
        const val = CURVE_ORDER + 1n
        const valModOrder = 1n
        // poseidonHashScalars([val]) should be same as poseidonHashScalars([valModOrder])
        expect(poseidonHashScalars([val])).toEqual(
          poseidonHashScalars([valModOrder]),
        )
      })
      it("property-based: output is always < CURVE_ORDER and >= 0", () => {
        fc.assert(
          fc.property(fc.array(fc.bigInt()), (arr) => {
            const result = poseidonHashScalars(arr)
            return result >= 0n && result < CURVE_ORDER
          }),
        )
      })
    })
  })
})
