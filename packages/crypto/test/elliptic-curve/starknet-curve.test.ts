import { describe, expect, it } from "bun:test"
import { ec, encode, num } from "starknet" // For STARKNET_CURVE, CURVE_ORDER, and some hex utils
import {
  POINT_AT_INFINITY_HEX_UNCOMPRESSED as EXPORTED_POINT_AT_INFINITY_HEX,
  addPointsStarknet,
  generateRandomScalarStarknet,
  getBasePointStarknet,
  getPublicKeyStarknet,
  scalarMultiplyStarknet,
} from "../../src/elliptic-curve/starknet-curve" // To be tested
import { CURVE_ORDER as CORE_CURVE_ORDER } from "../../src/elliptic-curve/core/curve" // For CURVE_ORDER constant

const STARKNET_CURVE = ec.starkCurve // Used for some direct comparisons or underlying objects
// Ensure CURVE_ORDER used in tests is the one from core/curve.ts, which starknet-curve.ts relies on.
const CURVE_ORDER = CORE_CURVE_ORDER

// Compressed point at infinity
const POINT_AT_INFINITY_HEX_COMPRESSED = "0x00"

describe("Starknet Elliptic Curve Primitives (starknet-curve.ts API Layer)", () => {
  describe("Constants", () => {
    it("EXPORTED_POINT_AT_INFINITY_HEX_UNCOMPRESSED should be correctly defined", () => {
      expect(EXPORTED_POINT_AT_INFINITY_HEX.toLowerCase()).toBe(
        ("0x04" + "00".repeat(64)).toLowerCase(),
      )
    })
  })

  describe("generateRandomScalarStarknet", () => {
    it("should generate a hex string scalar", () => {
      const scalar = generateRandomScalarStarknet()
      expect(scalar).toMatch(/^0x[0-9a-fA-F]+$/i)
    })

    it("should generate a scalar within the curve order", () => {
      const scalarHex = generateRandomScalarStarknet()
      const scalarBigInt = num.toBigInt(scalarHex)
      expect(scalarBigInt > 0n).toBe(true)
      expect(scalarBigInt < CURVE_ORDER).toBe(true)
    })

    it("should generate different scalars on subsequent calls", () => {
      const scalar1 = generateRandomScalarStarknet()
      const scalar2 = generateRandomScalarStarknet()
      expect(scalar1).not.toEqual(scalar2)
    })
  })

  describe("getBasePointStarknet", () => {
    // This function is already well-tested for valid cases.
    // `compressed` is boolean, so no specific invalid hex input tests apply directly to it.
    it("should return the uncompressed base point G by default", () => {
      const G_hex = getBasePointStarknet()
      expect(G_hex).toMatch(/^0x04[0-9a-fA-F]{128}$/i)
      const G_point = STARKNET_CURVE.ProjectivePoint.fromHex(
        encode.removeHexPrefix(G_hex),
      )
      expect(G_point.equals(STARKNET_CURVE.ProjectivePoint.BASE)).toBe(true)
    })

    it("should return the compressed base point G when specified", () => {
      const G_hex_compressed = getBasePointStarknet(true)
      expect(G_hex_compressed).toMatch(/^0x(02|03)[0-9a-fA-F]{64}$/i)
      const G_point_from_compressed = STARKNET_CURVE.ProjectivePoint.fromHex(
        encode.removeHexPrefix(G_hex_compressed),
      )
      expect(
        G_point_from_compressed.equals(STARKNET_CURVE.ProjectivePoint.BASE),
      ).toBe(true)
    })
  })

  describe("Input Validation and Error Handling", () => {
    const validScalarHex = generateRandomScalarStarknet()
    const validPointHexUncompressed = getBasePointStarknet(false)
    // const validPointHexCompressed = getBasePointStarknet(true); // For tests needing compressed

    const invalidHexInputs: [string | null | undefined, string][] = [
      [null, "null input"],
      [undefined, "undefined input"],
      ["", "empty string"],
      ["invalid-hex-string", "non-hex string"],
      ["0xINVALID", "hex with invalid characters"],
      ["12345", "hex without 0x prefix (starknet.js num/hexToBigInt might handle, but coreHexToBigInt expects 0x)"],
      ["0x" + "f".repeat(100), "hex too long for scalar/point x-coord"], // Too long for a scalar or point coordinate
    ]

    describe("getPublicKeyStarknet(privateKeyHex, compressed)", () => {
      it.each(invalidHexInputs)(
        "should throw for invalid privateKeyHex: %s (%s)",
        (input) => {
          expect(() => getPublicKeyStarknet(input as string)).toThrow(Error)
        },
      )
    })

    describe("scalarMultiplyStarknet(scalarHex, pointHex)", () => {
      it.each(invalidHexInputs)(
        "should throw for invalid scalarHex: %s (%s)",
        (input) => {
          expect(() =>
            scalarMultiplyStarknet(input as string, validPointHexUncompressed),
          ).toThrow(Error)
        },
      )
      it.each(invalidHexInputs)(
        "should throw for invalid pointHex: %s (%s)",
        (input) => {
          expect(() =>
            scalarMultiplyStarknet(validScalarHex, input as string),
          ).toThrow(Error)
        },
      )
    })

    describe("addPointsStarknet(point1Hex, point2Hex)", () => {
      it.each(invalidHexInputs)(
        "should throw for invalid point1Hex: %s (%s)",
        (input) => {
          expect(() =>
            addPointsStarknet(input as string, validPointHexUncompressed),
          ).toThrow(Error)
        },
      )
      it.each(invalidHexInputs)(
        "should throw for invalid point2Hex: %s (%s)",
        (input) => {
          expect(() =>
            addPointsStarknet(validPointHexUncompressed, input as string),
          ).toThrow(Error)
        },
      )
    })
  })

  describe("Hex API Edge Cases", () => {
    const validScalarHex = "0x123" // A generic valid scalar
    const validPointHex = getPublicKeyStarknet(validScalarHex, false)
    const curveOrderHex = num.toHex(CURVE_ORDER)

    describe("getPublicKeyStarknet", () => {
      it("should return POINT_AT_INFINITY_HEX_UNCOMPRESSED for privateKeyHex = '0x0'", () => {
        const pubKey = getPublicKeyStarknet("0x0", false)
        expect(pubKey.toLowerCase()).toBe(
          EXPORTED_POINT_AT_INFINITY_HEX.toLowerCase(),
        )
      })
      it("should return POINT_AT_INFINITY_HEX_COMPRESSED for privateKeyHex = '0x0' (compressed)", () => {
        const pubKey = getPublicKeyStarknet("0x0", true)
        expect(pubKey.toLowerCase()).toBe(
          POINT_AT_INFINITY_HEX_COMPRESSED.toLowerCase(),
        )
      })
    })

    describe("scalarMultiplyStarknet", () => {
      it("k * POINT_AT_INFINITY (uncompressed) should return POINT_AT_INFINITY (uncompressed)", () => {
        const res = scalarMultiplyStarknet(
          validScalarHex,
          EXPORTED_POINT_AT_INFINITY_HEX,
        )
        expect(res.toLowerCase()).toBe(
          EXPORTED_POINT_AT_INFINITY_HEX.toLowerCase(),
        )
      })
      it("k * POINT_AT_INFINITY (compressed) should return POINT_AT_INFINITY (uncompressed)", () => {
        const res = scalarMultiplyStarknet(
          validScalarHex,
          POINT_AT_INFINITY_HEX_COMPRESSED,
        )
        expect(res.toLowerCase()).toBe(
          EXPORTED_POINT_AT_INFINITY_HEX.toLowerCase(),
        )
      })
      it("0 * P should return POINT_AT_INFINITY (uncompressed)", () => {
        const res = scalarMultiplyStarknet("0x0", validPointHex)
        expect(res.toLowerCase()).toBe(
          EXPORTED_POINT_AT_INFINITY_HEX.toLowerCase(),
        )
      })
      it("CURVE_ORDER * P should return POINT_AT_INFINITY (uncompressed)", () => {
        const res = scalarMultiplyStarknet(curveOrderHex, validPointHex)
        expect(res.toLowerCase()).toBe(
          EXPORTED_POINT_AT_INFINITY_HEX.toLowerCase(),
        )
      })
    })

    describe("addPointsStarknet", () => {
      const p1HexUncompressed = getPublicKeyStarknet("0xabc123", false)

      it("P1 + POINT_AT_INFINITY (uncompressed) should return P1 (uncompressed)", () => {
        const res = addPointsStarknet(
          p1HexUncompressed,
          EXPORTED_POINT_AT_INFINITY_HEX,
        )
        expect(res.toLowerCase()).toBe(p1HexUncompressed.toLowerCase())
      })
      it("POINT_AT_INFINITY (uncompressed) + P1 should return P1 (uncompressed)", () => {
        const res = addPointsStarknet(
          EXPORTED_POINT_AT_INFINITY_HEX,
          p1HexUncompressed,
        )
        expect(res.toLowerCase()).toBe(p1HexUncompressed.toLowerCase())
      })
      it("P1 + POINT_AT_INFINITY (compressed) should return P1 (uncompressed)", () => {
        const res = addPointsStarknet(
          p1HexUncompressed,
          POINT_AT_INFINITY_HEX_COMPRESSED,
        )
        expect(res.toLowerCase()).toBe(p1HexUncompressed.toLowerCase())
      })
      it("POINT_AT_INFINITY (compressed) + P1 should return P1 (uncompressed)", () => {
        const res = addPointsStarknet(
          POINT_AT_INFINITY_HEX_COMPRESSED,
          p1HexUncompressed,
        )
        expect(res.toLowerCase()).toBe(p1HexUncompressed.toLowerCase())
      })
      it("POINT_AT_INFINITY (uncompressed) + POINT_AT_INFINITY (compressed) should return POINT_AT_INFINITY (uncompressed)", () => {
        const res = addPointsStarknet(
          EXPORTED_POINT_AT_INFINITY_HEX,
          POINT_AT_INFINITY_HEX_COMPRESSED,
        )
        expect(res.toLowerCase()).toBe(
          EXPORTED_POINT_AT_INFINITY_HEX.toLowerCase(),
        )
      })
    })
  })

  // Existing tests for valid operations (can be kept, but some might be redundant with new edge cases)
  // It's good to ensure the core happy paths are still explicitly tested.
  describe("Existing Valid Operation Tests (Review for Redundancy)", () => {
    describe("getPublicKeyStarknet (valid cases)", () => {
      const privateKeyHex = generateRandomScalarStarknet()
      it("should derive an uncompressed public key by default", () => {
        const publicKeyHex = getPublicKeyStarknet(privateKeyHex)
        expect(publicKeyHex).toMatch(/^0x04[0-9a-fA-F]{128}$/i)
      })
      it("derived public key should correspond to privateKey * G", () => {
        const publicKeyHex = getPublicKeyStarknet(privateKeyHex)
        const G_hex = getBasePointStarknet(false) // Uncompressed G
        const calculatedPublicKey = scalarMultiplyStarknet(privateKeyHex, G_hex)
        expect(publicKeyHex.toLowerCase()).toEqual(calculatedPublicKey.toLowerCase())
      })
    })

    describe("scalarMultiplyStarknet (valid cases)", () => {
      const P_hex = getPublicKeyStarknet(generateRandomScalarStarknet())
      const G_hex = getBasePointStarknet()
      it("1 * P should equal P", () => {
        const R = scalarMultiplyStarknet("0x1", P_hex)
        expect(R.toLowerCase()).toEqual(P_hex.toLowerCase())
      })
      it("k * G should equal getPublicKeyStarknet(k)", () => {
        const randomScalar = generateRandomScalarStarknet()
        const pubKey = scalarMultiplyStarknet(randomScalar, G_hex)
        const expectedPubKey = getPublicKeyStarknet(randomScalar)
        expect(pubKey.toLowerCase()).toEqual(expectedPubKey.toLowerCase())
      })
    })

    describe("addPointsStarknet (valid cases)", () => {
      const P1_priv = generateRandomScalarStarknet()
      const P1_hex = getPublicKeyStarknet(P1_priv)
      const P2_priv = generateRandomScalarStarknet()
      const P2_hex = getPublicKeyStarknet(P2_priv)

      it("P + (-P) = O (point at infinity)", () => {
        const P1_point = STARKNET_CURVE.ProjectivePoint.fromHex(encode.removeHexPrefix(P1_hex))
        const minusP1_point = P1_point.negate()
        // starknet-curve.ts functions expect hex inputs.
        // corePointToHex is not directly imported here, but we can use getPublicKeyStarknet for 0 to get O_hex
        // or use the imported EXPORTED_POINT_AT_INFINITY_HEX.
        // For minusP1_hex, we need a way to convert Point object to hex string.
        // starknet.js 'encode.addHexPrefix(encode.buf2hex(minusP1_point.toRawBytes(false)))' can be used.
        const minusP1_hex = encode.addHexPrefix(encode.buf2hex(minusP1_point.toRawBytes(false)))

        const R = addPointsStarknet(P1_hex, minusP1_hex)
        expect(R.toLowerCase()).toEqual(EXPORTED_POINT_AT_INFINITY_HEX.toLowerCase())
      })

      it("(k1*G) + (k2*G) should equal (k1+k2)*G", () => {
        const k1 = num.toBigInt(P1_priv)
        const k2 = num.toBigInt(P2_priv)
        // Sum of scalars must be modulo CURVE_ORDER for the addition to hold in the group
        const k_sum_BN = (k1 + k2) % CURVE_ORDER
        const k_sum_hex = num.toHex(k_sum_BN === 0n ? CURVE_ORDER : k_sum_BN) // Avoid 0x0 for getPublicKey if k_sum is 0

        const R1_sum_direct = getPublicKeyStarknet(k_sum_hex)

        const R2_sum_added = addPointsStarknet(P1_hex, P2_hex)
        // If k_sum_BN is 0, R1_sum_direct will be point at infinity.
        // R2_sum_added should also be point at infinity if (k1+k2) is a multiple of N.
        // The current P1_hex, P2_hex are k1G, k2G. (k1G + k2G) = (k1+k2)G.
        expect(R1_sum_direct.toLowerCase()).toEqual(R2_sum_added.toLowerCase())
      })
    })
  })
})
