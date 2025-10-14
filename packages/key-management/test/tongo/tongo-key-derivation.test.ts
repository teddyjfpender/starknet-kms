import { describe, it, expect } from "bun:test"
import { mnemonic } from "@starkms/common"
import {
  deriveStarknetKeyPairs,
  deriveStarknetPrivateKey,
  type StarknetDerivationArgs,
} from "../../src/chains/starknet"
import * as bip39 from "../../src/util/bip39"

/**
 * Test suite for Tongo key derivation with custom coin type (5454)
 * vs standard Starknet key derivation (9004)
 */
describe("Tongo Key Derivation", () => {
  const mnemonicPhrase = bip39.joinMnemonicWords(mnemonic)
  const TONGO_COIN_TYPE = 5454
  const STARKNET_COIN_TYPE = 9004 // default

  describe("Key Derivation with Different Coin Types", () => {
    it("should derive different private keys for different coin types", () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      // Derive with default Starknet coin type (9004)
      const starknetPrivateKey = deriveStarknetPrivateKey(args, mnemonicPhrase)

      // Derive with Tongo coin type (5454)
      const tongoPrivateKey = deriveStarknetPrivateKey(
        { ...args, coinType: TONGO_COIN_TYPE },
        mnemonicPhrase,
      )

      // Keys should be different
      expect(starknetPrivateKey).not.toBe(tongoPrivateKey)
      expect(starknetPrivateKey).toMatch(/^0x[0-9a-fA-F]+$/)
      expect(tongoPrivateKey).toMatch(/^0x[0-9a-fA-F]+$/)

      console.log("\n=> Private Key Comparison:")
      console.log("   Starknet (9004):", starknetPrivateKey)
      console.log("   Tongo (5454):   ", tongoPrivateKey)
    })

    it("should derive different key pairs for different coin types", () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      // Derive with default Starknet coin type (9004)
      const starknetKeyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, false)

      // Derive with Tongo coin type (5454)
      const tongoKeyPairs = deriveStarknetKeyPairs(
        { ...args, coinType: TONGO_COIN_TYPE },
        mnemonicPhrase,
        false,
      )

      // Spending keys should be different
      expect(starknetKeyPairs.spendingKeyPair.privateSpendingKey).not.toBe(
        tongoKeyPairs.spendingKeyPair.privateSpendingKey,
      )
      expect(starknetKeyPairs.spendingKeyPair.publicSpendingKey).not.toBe(
        tongoKeyPairs.spendingKeyPair.publicSpendingKey,
      )

      // Viewing keys should be different (derived from different spending keys)
      expect(starknetKeyPairs.viewingKeyPair.privateViewingKey).not.toBe(
        tongoKeyPairs.viewingKeyPair.privateViewingKey,
      )
      expect(starknetKeyPairs.viewingKeyPair.publicViewingKey).not.toBe(
        tongoKeyPairs.viewingKeyPair.publicViewingKey,
      )

      console.log("\n=> Starknet Key Pairs (coin type 9004):")
      console.log("   Private Spending Key:", starknetKeyPairs.spendingKeyPair.privateSpendingKey)
      console.log("   Public Spending Key:", starknetKeyPairs.spendingKeyPair.publicSpendingKey)
      console.log("   Private Viewing Key:", starknetKeyPairs.viewingKeyPair.privateViewingKey)
      console.log("   Public Viewing Key:", starknetKeyPairs.viewingKeyPair.publicViewingKey)

      console.log("\n=> Tongo Key Pairs (coin type 5454):")
      console.log("   Private Spending Key:", tongoKeyPairs.spendingKeyPair.privateSpendingKey)
      console.log("   Public Spending Key:", tongoKeyPairs.spendingKeyPair.publicSpendingKey)
      console.log("   Private Viewing Key:", tongoKeyPairs.viewingKeyPair.privateViewingKey)
      console.log("   Public Viewing Key:", tongoKeyPairs.viewingKeyPair.publicViewingKey)
    })

    it("should derive different compressed key pairs for different coin types", () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      // Derive with default Starknet coin type (9004) - compressed
      const starknetKeyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, true)

      // Derive with Tongo coin type (5454) - compressed
      const tongoKeyPairs = deriveStarknetKeyPairs(
        { ...args, coinType: TONGO_COIN_TYPE },
        mnemonicPhrase,
        true,
      )

      // Compressed public keys should be <= 64 hex chars (32 bytes, may have leading zeros stripped)
      expect(starknetKeyPairs.spendingKeyPair.publicSpendingKey).toMatch(/^0x[0-9a-fA-F]{1,64}$/)
      expect(tongoKeyPairs.spendingKeyPair.publicSpendingKey).toMatch(/^0x[0-9a-fA-F]{1,64}$/)

      // Verify they're not uncompressed (which would be 130 hex chars)
      expect(starknetKeyPairs.spendingKeyPair.publicSpendingKey.length).toBeLessThanOrEqual(66) // 0x + 64 chars
      expect(tongoKeyPairs.spendingKeyPair.publicSpendingKey.length).toBeLessThanOrEqual(66)

      // Keys should be different
      expect(starknetKeyPairs.spendingKeyPair.publicSpendingKey).not.toBe(
        tongoKeyPairs.spendingKeyPair.publicSpendingKey,
      )
      expect(starknetKeyPairs.viewingKeyPair.publicViewingKey).not.toBe(
        tongoKeyPairs.viewingKeyPair.publicViewingKey,
      )

      console.log("\n=> Compressed Key Comparison:")
      console.log("   Starknet Public Spend (9004):", starknetKeyPairs.spendingKeyPair.publicSpendingKey)
      console.log("   Tongo Public Spend (5454):   ", tongoKeyPairs.spendingKeyPair.publicSpendingKey)
    })

    it("should derive consistent keys for the same coin type", () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
        coinType: TONGO_COIN_TYPE,
      }

      // Derive twice with same parameters
      const tongoKeyPairs1 = deriveStarknetKeyPairs(args, mnemonicPhrase, true)
      const tongoKeyPairs2 = deriveStarknetKeyPairs(args, mnemonicPhrase, true)

      // Should be deterministic - same keys
      expect(tongoKeyPairs1.spendingKeyPair.privateSpendingKey).toBe(
        tongoKeyPairs2.spendingKeyPair.privateSpendingKey,
      )
      expect(tongoKeyPairs1.spendingKeyPair.publicSpendingKey).toBe(
        tongoKeyPairs2.spendingKeyPair.publicSpendingKey,
      )
      expect(tongoKeyPairs1.viewingKeyPair.privateViewingKey).toBe(
        tongoKeyPairs2.viewingKeyPair.privateViewingKey,
      )
      expect(tongoKeyPairs1.viewingKeyPair.publicViewingKey).toBe(
        tongoKeyPairs2.viewingKeyPair.publicViewingKey,
      )
    })

    it("should derive different keys for different account indices with Tongo coin type", () => {
      const args0: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
        coinType: TONGO_COIN_TYPE,
      }

      const args1: StarknetDerivationArgs = {
        accountIndex: 1,
        addressIndex: 0,
        coinType: TONGO_COIN_TYPE,
      }

      const tongoKeyPairs0 = deriveStarknetKeyPairs(args0, mnemonicPhrase, true)
      const tongoKeyPairs1 = deriveStarknetKeyPairs(args1, mnemonicPhrase, true)

      // Different account indices should produce different keys
      expect(tongoKeyPairs0.spendingKeyPair.privateSpendingKey).not.toBe(
        tongoKeyPairs1.spendingKeyPair.privateSpendingKey,
      )
      expect(tongoKeyPairs0.spendingKeyPair.publicSpendingKey).not.toBe(
        tongoKeyPairs1.spendingKeyPair.publicSpendingKey,
      )

      console.log("\n=> Tongo Keys for Different Accounts:")
      console.log("   Account 0:", tongoKeyPairs0.spendingKeyPair.publicSpendingKey)
      console.log("   Account 1:", tongoKeyPairs1.spendingKeyPair.publicSpendingKey)
    })
  })

  describe("Default Coin Type Behavior", () => {
    it("should default to Starknet coin type (9004) when coinType is not specified", () => {
      const argsWithoutCoinType: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      const argsWithDefaultCoinType: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
        coinType: STARKNET_COIN_TYPE,
      }

      const keyPairs1 = deriveStarknetKeyPairs(argsWithoutCoinType, mnemonicPhrase, true)
      const keyPairs2 = deriveStarknetKeyPairs(argsWithDefaultCoinType, mnemonicPhrase, true)

      // Should produce identical keys
      expect(keyPairs1.spendingKeyPair.privateSpendingKey).toBe(
        keyPairs2.spendingKeyPair.privateSpendingKey,
      )
      expect(keyPairs1.spendingKeyPair.publicSpendingKey).toBe(
        keyPairs2.spendingKeyPair.publicSpendingKey,
      )
    })
  })

  describe("BIP-44 Path Verification", () => {
    it("should use correct derivation paths for different coin types", () => {
      // This test verifies the concept - the actual path is internal to deriveStarknetPrivateKey
      // Expected paths:
      // Starknet: m/44'/9004'/0'/0/0
      // Tongo: m/44'/5454'/0'/0/0

      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      const starknetKey = deriveStarknetPrivateKey(args, mnemonicPhrase)
      const tongoKey = deriveStarknetPrivateKey(
        { ...args, coinType: TONGO_COIN_TYPE },
        mnemonicPhrase,
      )

      // Verify they're both valid private keys but different
      expect(starknetKey).toMatch(/^0x[0-9a-fA-F]+$/)
      expect(tongoKey).toMatch(/^0x[0-9a-fA-F]+$/)
      expect(starknetKey).not.toBe(tongoKey)

      // Both should be valid Starknet curve private keys
      // (the grindKey function ensures they're < curve order)
      expect(BigInt(starknetKey)).toBeGreaterThan(0n)
      expect(BigInt(tongoKey)).toBeGreaterThan(0n)
    })
  })
})
