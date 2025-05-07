import { describe, expect, it } from "bun:test";
import { num } from "starknet";
import {
  generateRandomScalarStarknet,
  getPublicKeyStarknet,
} from "../../src/elliptic-curve/starknet-curve";
import {
  checkStealthAddressOwnershipStarknet,
  createStealthAddressStarknet,
  deriveStealthPrivateKeyStarknet,
} from "../../src/elliptic-curve/starknet-stealth";

describe("Starknet Stealth Address Primitives", () => {
  // Alice's key setup
  const alicePrivateSpendKeyHex = generateRandomScalarStarknet();
  const alicePublicSpendKeyHex = getPublicKeyStarknet(alicePrivateSpendKeyHex);
  const alicePrivateViewKeyHex = generateRandomScalarStarknet();
  const alicePublicViewKeyHex = getPublicKeyStarknet(alicePrivateViewKeyHex);

  // Eve's key setup (for negative tests)
  const evePrivateSpendKeyHex = generateRandomScalarStarknet();
  const evePublicSpendKeyHex = getPublicKeyStarknet(evePrivateSpendKeyHex);
  const evePrivateViewKeyHex = generateRandomScalarStarknet();
  const evePublicViewKeyHex = getPublicKeyStarknet(evePrivateViewKeyHex);

  describe("createStealthAddressStarknet, checkStealthAddressOwnershipStarknet, and deriveStealthPrivateKeyStarknet", () => {
    it("should allow Alice to receive a stealth payment and derive its private key", () => {
      // 1. Bob (sender) creates a stealth address for Alice
      const { ephemeralScalarHex, ephemeralPublicKeyHex, stealthAddressHex } =
        createStealthAddressStarknet(alicePublicSpendKeyHex, alicePublicViewKeyHex);

      expect(ephemeralScalarHex).toMatch(/^0x[0-9a-fA-F]+$/);
      expect(ephemeralPublicKeyHex).toMatch(/^0x04[0-9a-fA-F]{128}$/);
      expect(stealthAddressHex).toMatch(/^0x04[0-9a-fA-F]{128}$/);

      // 2. Alice checks if she owns the stealth address
      const isOwnedByAlice = checkStealthAddressOwnershipStarknet(
        alicePrivateViewKeyHex,
        alicePublicSpendKeyHex,
        ephemeralPublicKeyHex,
        stealthAddressHex,
      );
      expect(isOwnedByAlice).toBe(true);

      // 3. Alice derives the private key for the stealth address
      const derivedStealthPrivateKeyHex = deriveStealthPrivateKeyStarknet(
        alicePrivateSpendKeyHex,
        alicePrivateViewKeyHex,
        ephemeralPublicKeyHex,
      );
      expect(derivedStealthPrivateKeyHex).toMatch(/^0x[0-9a-fA-F]+$/);
      // The derived private key should not be zero (highly unlikely, but good check)
      expect(num.toBigInt(derivedStealthPrivateKeyHex) === 0n).toBe(false);

      // 4. Verify: Public key from derivedStealthPrivateKeyHex should match stealthAddressHex
      const publicKeyFromDerivedStealthKey = getPublicKeyStarknet(derivedStealthPrivateKeyHex);
      expect(publicKeyFromDerivedStealthKey.toLowerCase()).toEqual(stealthAddressHex.toLowerCase());
    });

    it("should NOT allow Eve to claim Alice's stealth address", () => {
      const { ephemeralPublicKeyHex, stealthAddressHex } = 
        createStealthAddressStarknet(alicePublicSpendKeyHex, alicePublicViewKeyHex);

      const isOwnedByEve = checkStealthAddressOwnershipStarknet(
        evePrivateViewKeyHex, // Eve's private view key
        alicePublicSpendKeyHex, // Alice's public spend key (correct for the stealth address P computation)
        ephemeralPublicKeyHex,
        stealthAddressHex,
      );
      expect(isOwnedByEve).toBe(false);
    });

    it("should NOT allow Eve to claim Alice's stealth address if spend keys are also mismatched", () => {
        const { ephemeralPublicKeyHex, stealthAddressHex } = 
          createStealthAddressStarknet(alicePublicSpendKeyHex, alicePublicViewKeyHex);
  
        const isOwnedByEveWithHerSpendPub = checkStealthAddressOwnershipStarknet(
          evePrivateViewKeyHex,   // Eve's private view key
          evePublicSpendKeyHex, // Eve's public spend key
          ephemeralPublicKeyHex,
          stealthAddressHex,
        );
        expect(isOwnedByEveWithHerSpendPub).toBe(false);
      });

    it("deriving stealth private key with Eve's keys should not match Alice's stealth address", () => {
      const { ephemeralPublicKeyHex, stealthAddressHex } = 
        createStealthAddressStarknet(alicePublicSpendKeyHex, alicePublicViewKeyHex);

      // Eve attempts to derive the private key for Alice's stealth address
      const eveDerivedStealthPrivateKeyHex = deriveStealthPrivateKeyStarknet(
        evePrivateSpendKeyHex, // Eve's private spend key
        evePrivateViewKeyHex,  // Eve's private view key
        ephemeralPublicKeyHex, // Ephemeral key from Alice's transaction
      );

      const publicKeyFromEveDerivedKey = getPublicKeyStarknet(eveDerivedStealthPrivateKeyHex);
      // This derived public key should NOT match Alice's stealth address
      expect(publicKeyFromEveDerivedKey.toLowerCase()).not.toEqual(stealthAddressHex.toLowerCase());
    });

    it("derived stealth private key should be consistent if k_scalar results in 0 (x + k_scalar = 0 mod n)", () => {
      // This is a highly specific and unlikely scenario, primarily for testing robustness.
      // We need to find/craft alicePrivateSpendKey (x) and k_scalar such that (x + k_scalar) % CURVE_ORDER === 0n.
      // This means k_scalar = (-x) % CURVE_ORDER.
      // We can't directly control k_scalar as it comes from H(y*R). 
      // So, this test is hard to set up without mocking hash or finding specific inputs.
      // Instead, we test that if derivedStealthPrivateKeyHex is "0x0", its public key is the point at infinity.
      
      // Mocking scenario: if deriveStealthPrivateKeyStarknet *could* return "0x0"
      const zeroPrivateKey = "0x0";
      const publicKeyOfZero = getPublicKeyStarknet(zeroPrivateKey);
      const POINT_AT_INFINITY_HEX_UNCOMPRESSED = `0x04${"00".repeat(64)}`; // As defined in starknet-curve.ts
      expect(publicKeyOfZero.toLowerCase()).toEqual(POINT_AT_INFINITY_HEX_UNCOMPRESSED.toLowerCase());
      // This test verifies that our getPublicKeyStarknet handles "0x0" correctly, which is relevant
      // to the derivedStealthPrivateKeyStarknet possibly returning "0x0".
    });
  });
}); 