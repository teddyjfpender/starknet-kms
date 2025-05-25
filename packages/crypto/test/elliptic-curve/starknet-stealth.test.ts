import { describe, expect, it, vi, beforeAll } from "bun:test"
import * as fc from "fast-check"
import { hash, num } from "starknet" // For mocking parts of it, like hash.starknetKeccak
import {
  CURVE_ORDER,
  pointToHex,
  POINT_AT_INFINITY as CORE_POINT_AT_INFINITY, // Renamed to avoid clash
} from "../../src/elliptic-curve/core/curve"
import {
  generateRandomScalarStarknet,
  getPublicKeyStarknet,
  POINT_AT_INFINITY_HEX_UNCOMPRESSED, // Import from starknet-curve
} from "../../src/elliptic-curve/starknet-curve"
import {
  checkStealthAddressOwnershipStarknet,
  createStealthAddressStarknet,
  deriveStealthPrivateKeyStarknet,
} from "../../src/elliptic-curve/starknet-stealth"

// Helper for fast-check to generate valid StarkNet key pairs (hex strings)
const fcStarknetKeyPair = fc
  .bigInt(1n, CURVE_ORDER - 1n) // Valid private key scalar range
  .map((privScalar) => {
    const privateKeyHex = num.toHex(privScalar)
    const publicKeyHex = getPublicKeyStarknet(privateKeyHex, false) // Uncompressed
    return { privateKeyHex, publicKeyHex, privateKeyScalar: privScalar }
  })

// Helper for invalid hex strings
const fcInvalidHexString = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(""),
  fc.constant("not_hex"),
  fc.constant("0z123"),
  fc.constant("0x1"), // Too short for a key
  fc.constant("0x" + "0".repeat(65)), // Too long for some contexts
  fc.constant(POINT_AT_INFINITY_HEX_UNCOMPRESSED), // Point at infinity, often invalid as a key
)

describe("Starknet Stealth Address Implementation", () => {
  // Use fixed keys for basic tests for reproducibility, property tests for broader coverage.
  const alice = {
    privateSpendKeyHex:
      "0x03d9f2c1f1939c1f5689e8a5f6b9a0c4a8a4b7b0b1e8a0e6c2c8a1e8a0e6c2c8",
    publicSpendKeyHex:
      "0x04540ded0991f999903421515a588881290857341484540ded0991f999903421515a588881290857341484540ded0991f999903421515a588881290857341484", // Placeholder, will be derived
    privateViewKeyHex:
      "0x01e8a0e6c2c8a1e8a0e6c2c8a1e8a0e6c2c8a03d9f2c1f1939c1f5689e8a5f6b",
    publicViewKeyHex:
      "0x0484540ded0991f999903421515a588881290857341484540ded0991f999903421515a588881290857341484540ded0991f999903421515a5888812908573414", // Placeholder, will be derived
  }
  const eve = {
    privateSpendKeyHex: generateRandomScalarStarknet(), // Keep random for variety in some negative tests
    publicSpendKeyHex: "", // Will be derived
    privateViewKeyHex: generateRandomScalarStarknet(),
    publicViewKeyHex: "",
  }

  beforeAll(() => {
    // Derive public keys for the fixed private keys
    alice.publicSpendKeyHex = getPublicKeyStarknet(alice.privateSpendKeyHex)
    alice.publicViewKeyHex = getPublicKeyStarknet(alice.privateViewKeyHex)
    eve.publicSpendKeyHex = getPublicKeyStarknet(eve.privateSpendKeyHex)
    eve.publicViewKeyHex = getPublicKeyStarknet(eve.privateViewKeyHex)
  })

  // No top-level mock for hash.starknetKeccak anymore.
  // It will be spied upon and mocked/restored within specific tests if needed.

  describe("Core Functionality (Round Trip)", () => {
    it("should allow Alice to receive a stealth payment, check ownership, and derive its private key", () => {
      const { ephemeralScalarHex, ephemeralPublicKeyHex, stealthAddressHex } =
        createStealthAddressStarknet(
          alice.publicSpendKeyHex,
          alice.publicViewKeyHex,
        )

      // Check output formats
      expect(ephemeralScalarHex).toMatch(/^0x[0-9a-fA-F]+$/i)
      expect(num.toBigInt(ephemeralScalarHex)).toBeGreaterThan(0n)
      expect(ephemeralPublicKeyHex).toMatch(/^0x04[0-9a-fA-F]{128}$/i) // Uncompressed
      expect(stealthAddressHex).toMatch(/^0x04[0-9a-fA-F]{128}$/i) // Uncompressed

      const isOwnedByAlice = checkStealthAddressOwnershipStarknet(
        alice.privateViewKeyHex,
        alice.publicSpendKeyHex,
        ephemeralPublicKeyHex,
        stealthAddressHex,
      )
      expect(isOwnedByAlice).toBe(true)

      const derivedStealthPrivateKeyHex = deriveStealthPrivateKeyStarknet(
        alice.privateSpendKeyHex,
        alice.privateViewKeyHex,
        ephemeralPublicKeyHex,
      )
      expect(derivedStealthPrivateKeyHex).toMatch(/^0x[0-9a-fA-F]+$/i)
      expect(num.toBigInt(derivedStealthPrivateKeyHex)).toBeGreaterThan(0n)

      const publicKeyFromDerivedStealthKey = getPublicKeyStarknet(
        derivedStealthPrivateKeyHex,
        false, // Uncompressed
      )
      expect(publicKeyFromDerivedStealthKey.toLowerCase()).toEqual(
        stealthAddressHex.toLowerCase(),
      )
    })
  })

  describe("Negative Ownership Checks", () => {
    it("should NOT allow Eve to claim Alice's stealth address using Eve's private view key", () => {
      const { ephemeralPublicKeyHex, stealthAddressHex } =
        createStealthAddressStarknet(
          alice.publicSpendKeyHex,
          alice.publicViewKeyHex,
        )
      const isOwnedByEve = checkStealthAddressOwnershipStarknet(
        eve.privateViewKeyHex,
        alice.publicSpendKeyHex,
        ephemeralPublicKeyHex,
        stealthAddressHex,
      )
      expect(isOwnedByEve).toBe(false)
    })

    it("should NOT allow Eve to claim Alice's stealth address if Eve uses her public spend key for check", () => {
       const { ephemeralPublicKeyHex, stealthAddressHex } =
        createStealthAddressStarknet(
          alice.publicSpendKeyHex,
          alice.publicViewKeyHex,
        )
      const isOwnedByEve = checkStealthAddressOwnershipStarknet(
        eve.privateViewKeyHex,
        eve.publicSpendKeyHex, // Eve's public spend key
        ephemeralPublicKeyHex,
        stealthAddressHex,
      )
      expect(isOwnedByEve).toBe(false)
    })

    it("deriving stealth private key with Eve's keys should not grant access to Alice's stealth address funds", () => {
      const { ephemeralPublicKeyHex, stealthAddressHex } =
        createStealthAddressStarknet(
          alice.publicSpendKeyHex,
          alice.publicViewKeyHex,
        )
      const eveDerivedStealthPrivateKeyHex = deriveStealthPrivateKeyStarknet(
        eve.privateSpendKeyHex,
        eve.privateViewKeyHex,
        ephemeralPublicKeyHex,
      )
      const publicKeyFromEveDerivedKey = getPublicKeyStarknet(
        eveDerivedStealthPrivateKeyHex,
      )
      expect(publicKeyFromEveDerivedKey.toLowerCase()).not.toEqual(
        stealthAddressHex.toLowerCase(),
      )
    })
  })

  describe("Input Validation Tests", () => {
    const testKeys = {
      validPubSpend: alice.publicSpendKeyHex,
      validPubView: alice.publicViewKeyHex,
      validPrivView: alice.privateViewKeyHex,
      validPrivSpend: alice.privateSpendKeyHex,
      validEphemeralPub: getPublicKeyStarknet(generateRandomScalarStarknet()),
      validStealthAddr: getPublicKeyStarknet(generateRandomScalarStarknet()),
    }

    function runValidationTests(fn: Function, argNames: string[], validArgs: any[]) {
      argNames.forEach((argName, idx) => {
        fc.assert(
          fc.property(fcInvalidHexString, (invalidInput:any) => {
            const currentArgs = [...validArgs]
            currentArgs[idx] = invalidInput
            // starknet.js utils typically throw Error for bad hex or point formats
            expect(() => fn(...currentArgs)).toThrow(Error)
          }),
          { numRuns: 5, verbose: false }, // Test each invalid input type once per arg
        )
      })
    }
    
    describe("createStealthAddressStarknet input validation", () => {
      runValidationTests(
        createStealthAddressStarknet,
        ["recipientPubSpendKeyHex", "recipientPubViewKeyHex"],
        [testKeys.validPubSpend, testKeys.validPubView]
      );
    });

    describe("checkStealthAddressOwnershipStarknet input validation", () => {
       runValidationTests(
        checkStealthAddressOwnershipStarknet,
        ["recipientPrivateViewKeyHex", "recipientPubSpendKeyHex", "ephemeralPublicKeyHex", "stealthAddressHex"],
        [testKeys.validPrivView, testKeys.validPubSpend, testKeys.validEphemeralPub, testKeys.validStealthAddr]
      );
    });
    
    describe("deriveStealthPrivateKeyStarknet input validation", () => {
       runValidationTests(
        deriveStealthPrivateKeyStarknet,
        ["recipientPrivateSpendKeyHex", "recipientPrivateViewKeyHex", "ephemeralPublicKeyHex"],
        [testKeys.validPrivSpend, testKeys.validPrivView, testKeys.validEphemeralPub]
      );
    });
  })

  describe("Error for Zero Derived Private Key", () => {
    it("deriveStealthPrivateKeyStarknet should throw error if derived stealth private key is zero", () => {
      const recipientPrivateSpendScalar = num.toBigInt(alice.privateSpendKeyHex)
      // We want (recipientPrivateSpendScalar + k_prime_scalar) % CURVE_ORDER === 0n
      // So, k_prime_scalar = (CURVE_ORDER - (recipientPrivateSpendScalar % CURVE_ORDER)) % CURVE_ORDER
      const target_k_prime_scalar =
        (CURVE_ORDER - (recipientPrivateSpendScalar % CURVE_ORDER)) %
        CURVE_ORDER
      
      const target_k_prime_hex = num.toHex(target_k_prime_scalar)

      // Spy on hash.starknetKeccak and mock its implementation for this test
      const keccakSpy = vi.spyOn(hash, 'starknetKeccak').mockReturnValue(target_k_prime_hex);
      
      expect(() =>
        deriveStealthPrivateKeyStarknet(
          alice.privateSpendKeyHex,
          alice.privateViewKeyHex, 
          eve.publicViewKeyHex, // R, can be any valid key for this test's purpose
        ),
      ).toThrow(
        "Derived stealth private key is zero, which is invalid. This would lead to a known public key (point at infinity).",
      )
      
      keccakSpy.mockRestore(); // Restore the original implementation
    })
  })

  describe("Property-Based Tests", () => {
    it("full round trip: create -> check -> derive -> verify public key", () => {
      fc.assert(
        fc.property(
          fcStarknetKeyPair,
          fcStarknetKeyPair,
          (aliceSpendKeys, aliceViewKeys) => {
            const {
              ephemeralScalarHex,
              ephemeralPublicKeyHex,
              stealthAddressHex,
            } = createStealthAddressStarknet(
              aliceSpendKeys.publicKeyHex,
              aliceViewKeys.publicKeyHex,
            )

            // Check output formats
            expect(ephemeralScalarHex).toMatch(/^0x[0-9a-fA-F]+$/i)
            expect(num.toBigInt(ephemeralScalarHex)).toBeGreaterThan(0n)
            expect(ephemeralPublicKeyHex).toMatch(/^0x04[0-9a-fA-F]{128}$/i)
            expect(stealthAddressHex).toMatch(/^0x04[0-9a-fA-F]{128}$/i)


            const isOwned = checkStealthAddressOwnershipStarknet(
              aliceViewKeys.privateKeyHex,
              aliceSpendKeys.publicKeyHex,
              ephemeralPublicKeyHex,
              stealthAddressHex,
            )
            expect(isOwned).toBe(true)

            const derivedPrivKeyHex = deriveStealthPrivateKeyStarknet(
              aliceSpendKeys.privateKeyHex,
              aliceViewKeys.privateKeyHex,
              ephemeralPublicKeyHex,
            )
            expect(derivedPrivKeyHex).toMatch(/^0x[0-9a-fA-F]+$/i)
            expect(num.toBigInt(derivedPrivKeyHex)).toBeGreaterThan(0n) // Already checked by throw in func

            const derivedPubKeyHex = getPublicKeyStarknet(derivedPrivKeyHex, false)
            expect(derivedPubKeyHex.toLowerCase()).toEqual(stealthAddressHex.toLowerCase())
          },
        ),
        { numRuns: 10 }, // Reduced for CI speed
      )
    })

    it("checkStealthAddressOwnershipStarknet returns false for wrong private view key", () => {
      fc.assert(
        fc.property(
          fcStarknetKeyPair,
          fcStarknetKeyPair,
          fcStarknetKeyPair,
          (aliceSpend, aliceView, eveView) => {
            // Ensure Eve's key is different from Alice's view key
            fc.pre(aliceView.privateKeyHex !== eveView.privateKeyHex)

            const { ephemeralPublicKeyHex, stealthAddressHex } =
              createStealthAddressStarknet(
                aliceSpend.publicKeyHex,
                aliceView.publicKeyHex,
              )

            const isOwnedByEve = checkStealthAddressOwnershipStarknet(
              eveView.privateKeyHex, // Eve's incorrect private view key
              aliceSpend.publicKeyHex,
              ephemeralPublicKeyHex,
              stealthAddressHex,
            )
            expect(isOwnedByEve).toBe(false)
          },
        ),
        { numRuns: 10 },
      )
    })
  })

  // Test for POINT_AT_INFINITY_HEX_UNCOMPRESSED (refactor check)
  it("POINT_AT_INFINITY_HEX_UNCOMPRESSED should match core definition", () => {
    const corePaiUncompressed = pointToHex(CORE_POINT_AT_INFINITY, false)
    expect(POINT_AT_INFINITY_HEX_UNCOMPRESSED.toLowerCase()).toEqual(
      corePaiUncompressed.toLowerCase(),
    )
    // This also implicitly tests the old "derived stealth private key should be consistent if k_scalar results in 0"
    // because getPublicKeyStarknet("0x0") should return this point at infinity.
    expect(getPublicKeyStarknet("0x0").toLowerCase()).toEqual(
        POINT_AT_INFINITY_HEX_UNCOMPRESSED.toLowerCase(),
    )
  })
})
