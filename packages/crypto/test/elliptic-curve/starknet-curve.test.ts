import { describe, expect, it } from "bun:test"
import { ec, encode, num, stark } from "starknet"
import {
  addPointsStarknet,
  generateRandomScalarStarknet,
  getBasePointStarknet,
  getPublicKeyStarknet,
  scalarMultiplyStarknet,
} from "../../src/elliptic-curve/starknet-curve"

const STARKNET_CURVE = ec.starkCurve
const CURVE_ORDER = STARKNET_CURVE.CURVE.n

// Uncompressed point at infinity (0x04 + 32 zero bytes for x + 32 zero bytes for y)
const POINT_AT_INFINITY_HEX_UNCOMPRESSED = `0x04${"00".repeat(64)}`

describe("Starknet Elliptic Curve Primitives", () => {
  describe("generateRandomScalarStarknet", () => {
    it("should generate a hex string scalar", () => {
      const scalar = generateRandomScalarStarknet()
      expect(scalar).toMatch(/^0x[0-9a-fA-F]+$/)
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
    it("should return the uncompressed base point G by default", () => {
      const G_hex = getBasePointStarknet()
      expect(G_hex).toMatch(/^0x04[0-9a-fA-F]{128}$/) // 0x04 + 64-byte x + 64-byte y
      const G_point = STARKNET_CURVE.ProjectivePoint.fromHex(
        encode.removeHexPrefix(G_hex),
      )
      expect(G_point.equals(STARKNET_CURVE.ProjectivePoint.BASE)).toBe(true)
    })

    it("should return the compressed base point G when specified", () => {
      const G_hex_compressed = getBasePointStarknet(true)
      expect(G_hex_compressed).toMatch(/^0x(02|03)[0-9a-fA-F]{64}$/) // 0x02/03 + 64-byte x
      // Check if it converts to the same point
      const G_point_from_compressed = STARKNET_CURVE.ProjectivePoint.fromHex(
        encode.removeHexPrefix(G_hex_compressed),
      )
      expect(
        G_point_from_compressed.equals(STARKNET_CURVE.ProjectivePoint.BASE),
      ).toBe(true)
    })
  })

  describe("getPublicKeyStarknet", () => {
    const privateKeyHex = generateRandomScalarStarknet()

    it("should derive an uncompressed public key by default", () => {
      const publicKeyHex = getPublicKeyStarknet(privateKeyHex)
      expect(publicKeyHex).toMatch(/^0x04[0-9a-fA-F]{128}$/)
    })

    it("should derive a compressed public key when specified", () => {
      const publicKeyHexCompressed = getPublicKeyStarknet(privateKeyHex, true)
      expect(publicKeyHexCompressed).toMatch(/^0x(02|03)[0-9a-fA-F]{64}$/)
    })

    it("derived public key should correspond to privateKey * G", () => {
      const publicKeyHex = getPublicKeyStarknet(privateKeyHex)
      const G_hex = getBasePointStarknet(false)
      const calculatedPublicKey = scalarMultiplyStarknet(privateKeyHex, G_hex)
      expect(publicKeyHex.toLowerCase()).toEqual(
        calculatedPublicKey.toLowerCase(),
      )
    })

    // Example from starknet.js tests (simplified)
    it("should derive a known public key from a known private key", () => {
      const knownPrivHex =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc"
      const expectedKnownPubHexUncompressed = STARKNET_CURVE.getPublicKey(
        knownPrivHex,
        false,
      )
      const derivedPubHexUncompressed = getPublicKeyStarknet(
        knownPrivHex,
        false,
      )
      expect(derivedPubHexUncompressed.toLowerCase()).toEqual(
        encode
          .addHexPrefix(encode.buf2hex(expectedKnownPubHexUncompressed))
          .toLowerCase(),
      )

      const expectedKnownPubHexCompressed = STARKNET_CURVE.getPublicKey(
        knownPrivHex,
        true,
      )
      const derivedPubHexCompressed = getPublicKeyStarknet(knownPrivHex, true)
      expect(derivedPubHexCompressed.toLowerCase()).toEqual(
        encode
          .addHexPrefix(encode.buf2hex(expectedKnownPubHexCompressed))
          .toLowerCase(),
      )
    })
  })

  describe("scalarMultiplyStarknet", () => {
    const P_hex = getPublicKeyStarknet(generateRandomScalarStarknet()) // A random point P
    const G_hex = getBasePointStarknet()
    const scalar1 = "0x1"
    const scalar2 = "0x2"
    const randomScalar = generateRandomScalarStarknet()

    it("1 * P should equal P", () => {
      const R = scalarMultiplyStarknet(scalar1, P_hex)
      expect(R.toLowerCase()).toEqual(P_hex.toLowerCase())
    })

    it("k * G should be a valid public key format", () => {
      const pubKey = scalarMultiplyStarknet(randomScalar, G_hex)
      expect(pubKey).toMatch(/^0x04[0-9a-fA-F]{128}$/)
      // also check if it is equal to getPublicKeyStarknet(randomScalar)
      const expectedPubKey = getPublicKeyStarknet(randomScalar)
      expect(pubKey.toLowerCase()).toEqual(expectedPubKey.toLowerCase())
    })

    it("should handle multiplication by curve order (n * P = O, point at infinity)", () => {
      // starknet.js .multiply by curve order or 0 returns point at infinity (raw all zeros)
      const resultPoint = scalarMultiplyStarknet(num.toHex(CURVE_ORDER), P_hex)
      expect(resultPoint.toLowerCase()).toEqual(
        POINT_AT_INFINITY_HEX_UNCOMPRESSED.toLowerCase(),
      )
    })

    it("should handle multiplication by 0 (0 * P = O, point at infinity)", () => {
      const scalarZero = "0x0"
      const resultPoint = scalarMultiplyStarknet(scalarZero, P_hex)
      expect(resultPoint.toLowerCase()).toEqual(
        POINT_AT_INFINITY_HEX_UNCOMPRESSED.toLowerCase(),
      )
    })
  })

  describe("addPointsStarknet", () => {
    const P1_priv = generateRandomScalarStarknet()
    const P1_hex = getPublicKeyStarknet(P1_priv)
    const P2_priv = generateRandomScalarStarknet()
    const P2_hex = getPublicKeyStarknet(P2_priv)
    const G_hex = getBasePointStarknet()

    it("P + G should be a valid public key format", () => {
      const R = addPointsStarknet(P1_hex, G_hex)
      expect(R).toMatch(/^0x04[0-9a-fA-F]{128}$/)
    })

    it("P + O = P (where O is point at infinity)", () => {
      const O_hex = POINT_AT_INFINITY_HEX_UNCOMPRESSED
      const R = addPointsStarknet(P1_hex, O_hex)
      expect(R.toLowerCase()).toEqual(P1_hex.toLowerCase())
    })

    it("P + (-P) = O (point at infinity)", () => {
      const P1_point = STARKNET_CURVE.ProjectivePoint.fromHex(
        encode.removeHexPrefix(P1_hex),
      )
      const minusP1_point = P1_point.negate()
      const minusP1_hex = encode.addHexPrefix(
        encode.buf2hex(minusP1_point.toRawBytes(false)),
      )

      const R = addPointsStarknet(P1_hex, minusP1_hex)
      const O_hex = POINT_AT_INFINITY_HEX_UNCOMPRESSED
      expect(R.toLowerCase()).toEqual(O_hex.toLowerCase())
    })

    it("(k1*G) + (k2*G) should equal (k1+k2)*G", () => {
      const k1 = num.toBigInt(P1_priv)
      const k2 = num.toBigInt(P2_priv)
      const k_sum_BN = (k1 + k2) % CURVE_ORDER // ensure it's within curve order
      const k_sum_hex = num.toHex(k_sum_BN)

      const R1_sum_direct = getPublicKeyStarknet(k_sum_hex) // (k1+k2)*G

      const R2_sum_added = addPointsStarknet(P1_hex, P2_hex) // (k1*G) + (k2*G)
      expect(R1_sum_direct.toLowerCase()).toEqual(R2_sum_added.toLowerCase())
    })
  })
})
