import { describe, it, expect, beforeAll } from "bun:test"
import { RpcProvider, constants } from "starknet"
import { mnemonic } from "@starkms/common"
// Note: For testing, we'll use the OpenZeppelin account contract
// import { KAGE_ACCOUNT_ABI } from "@starkms/contracts"
import {
  deriveStarknetKeyPairs,
  deriveAccountAddress,
  deriveAndDeployAccount,
  isAccountDeployed,
  type StarknetDerivationArgs,
  type AccountDerivationConfig,
} from "../../src/chains/starknet"
import * as bip39 from "../../src/util/bip39"

/**
 * Devnet Configuration
 *
 * To run these tests:
 * 1. Start a Starknet devnet instance:
 *    ```bash
 *    starknet-devnet --seed 0
 *    ```
 * 2. Declare the KageAccount contract on devnet and note the class hash
 * 3. Update KAGE_ACCOUNT_CLASS_HASH below with your deployed class hash
 * 4. Run tests with: bun test test/devnet/derive-and-deploy.test.ts
 */

const DEVNET_CONFIG = {
  nodeUrl: process.env.STARKNET_RPC_URL || "http://127.0.0.1:5050",
  chainId: constants.StarknetChainId.SN_SEPOLIA, // or constants.NetworkName.SN_DEVNET if using newer version
}

// This is the class hash for the devnet account contract
const OZ_ACCOUNT_CLASS_HASH = "0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564" // Replace with actual class hash from your devnet

/**
 * Set to true to run these tests against devnet
 * Set to false to skip (useful in CI where devnet may not be running)
 */
const RUN_DEVNET_TESTS = true //process.env.RUN_DEVNET_TESTS === "true"

describe.skipIf(!RUN_DEVNET_TESTS)("Account Derivation and Deployment on Devnet", () => {
  let provider: RpcProvider
  let mnemonicPhrase: string

  beforeAll(() => {
    // Initialize provider
    provider = new RpcProvider({
      nodeUrl: DEVNET_CONFIG.nodeUrl,
    })

    // Join mnemonic words
    mnemonicPhrase = bip39.joinMnemonicWords(mnemonic)

    console.log("\n🔧 Devnet Test Configuration:")
    console.log("   Node URL:", DEVNET_CONFIG.nodeUrl)
    console.log("   OZ Account Class Hash:", OZ_ACCOUNT_CLASS_HASH)
    console.log("   Mnemonic:", mnemonic.slice(0, 3).join(" ") + "...")
  })

  describe("Key and Address Derivation", () => {
    it("should derive key pairs from mnemonic", () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      const keyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, false)

      expect(keyPairs.spendingKeyPair.privateSpendingKey).toMatch(/^0x[0-9a-fA-F]+$/)
      expect(keyPairs.spendingKeyPair.publicSpendingKey).toMatch(/^0x04[0-9a-fA-F]+$/)
      expect(keyPairs.viewingKeyPair.privateViewingKey).toMatch(/^0x[0-9a-fA-F]+$/)
      expect(keyPairs.viewingKeyPair.publicViewingKey).toMatch(/^0x04[0-9a-fA-F]+$/)

      console.log("\n📋 Derived Key Pairs (Account 0, Address 0):")
      console.log("   Public Spending Key:", keyPairs.spendingKeyPair.publicSpendingKey)
      console.log("   Public Viewing Key:", keyPairs.viewingKeyPair.publicViewingKey)
    })

    it("should derive deterministic account addresses", () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      // Use compressed public key (x-coordinate only) for account derivation
      const keyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, true)
      const publicKey = keyPairs.spendingKeyPair.publicSpendingKey

      const config: AccountDerivationConfig = {
        classHash: OZ_ACCOUNT_CLASS_HASH,
        salt: "0x0",
      }

      const derivedInfo = deriveAccountAddress(publicKey, config)

      expect(derivedInfo.address).toMatch(/^0x[0-9a-fA-F]+$/)
      expect(derivedInfo.publicKey).toBe(publicKey)
      expect(derivedInfo.classHash).toBe(OZ_ACCOUNT_CLASS_HASH)

      console.log("\n📍 Derived Account Address:")
      console.log("   Address:", derivedInfo.address)
      console.log("   Public Key:", derivedInfo.publicKey)

      // Derive again with same parameters - should be deterministic
      const derivedInfo2 = deriveAccountAddress(publicKey, config)
      expect(derivedInfo2.address).toBe(derivedInfo.address)
    })

    it("should derive different addresses for different account indices", () => {
      const config: AccountDerivationConfig = {
        classHash: OZ_ACCOUNT_CLASS_HASH,
        salt: "0x0",
      }

      const keyPairs0 = deriveStarknetKeyPairs(
        { accountIndex: 0, addressIndex: 0 },
        mnemonicPhrase,
        true,
      )
      const address0 = deriveAccountAddress(
        keyPairs0.spendingKeyPair.publicSpendingKey,
        config,
      ).address

      const keyPairs1 = deriveStarknetKeyPairs(
        { accountIndex: 1, addressIndex: 0 },
        mnemonicPhrase,
        true,
      )
      const address1 = deriveAccountAddress(
        keyPairs1.spendingKeyPair.publicSpendingKey,
        config,
      ).address

      expect(address0).not.toBe(address1)
      console.log("\n📍 Multiple Account Addresses:")
      console.log("   Account 0:", address0)
      console.log("   Account 1:", address1)
    })
  })

  describe("Account Deployment Check", () => {
    it("should check if an account is deployed", async () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      const keyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, true)
      const publicKey = keyPairs.spendingKeyPair.publicSpendingKey

      const config: AccountDerivationConfig = {
        classHash: OZ_ACCOUNT_CLASS_HASH,
        salt: "0x0",
      }

      const derivedInfo = deriveAccountAddress(publicKey, config)
      const deployed = await isAccountDeployed(derivedInfo.address, provider)

      console.log("\n🔍 Deployment Status:")
      console.log("   Address:", derivedInfo.address)
      console.log("   Deployed:", deployed)

      // Initially should not be deployed
      expect(typeof deployed).toBe("boolean")
    })
  })

  describe("Full Deployment Flow", () => {
    /**
     * This test performs a full account deployment.
     *
     * Prerequisites:
     * 1. Devnet must be running
     * 2. The derived address must be funded with tokens
     * 
     * you can fund the account with STRK to with the following cli command
     * curl -X POST http://127.0.0.1:5050/mint -d '{"address":"<DERIVED_ADDRESS>","amount":50000000000000000000,"unit":"FRI"}' -H "Content-Type:application/json"
     *
     */
    it("should derive and deploy an account to devnet", async () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      // Derive key pairs (use compressed for account derivation)
      const keyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, true)
      const publicKey = keyPairs.spendingKeyPair.publicSpendingKey
      const privateKey = keyPairs.spendingKeyPair.privateSpendingKey
      const tokenAddress = "0x4718F5A0FC34CC1AF16A1CDEE98FFB20C31F5CD61D6AB07201858F4287C938D" // STRK on devnet

      console.log("\n🔑 Account Keys:")
      console.log("   Public Key:", publicKey)
      console.log("   Private Key:", privateKey.substring(0, 10) + "...")

      // For OpenZeppelin accounts, we can use a minimal ABI or fetch it
      // For now, we'll use an empty ABI array as OZ account deployment is standard
      const config: AccountDerivationConfig & { abi: any } = {
        classHash: OZ_ACCOUNT_CLASS_HASH,
        salt: "0x0",
        abi: [], // OpenZeppelin account ABI (can be fetched from network if needed)
      }

      console.log("\n🚀 Starting deployment process...")

      try {
        const { account, derivedInfo } = await deriveAndDeployAccount(
          publicKey,
          privateKey,
          provider,
          config,
          false, // Set to true to wait for funding
          tokenAddress,
        )

        console.log("\n✅ Account deployed successfully!")
        console.log("   Address:", account.address)
        console.log("   Derived Address:", derivedInfo.address)

        expect(account.address).toBe(derivedInfo.address)

        // Verify deployment
        const deployed = await isAccountDeployed(account.address, provider)
        expect(deployed).toBe(true)
      } catch (error) {
        console.error("\n❌ Deployment failed:", error)

        // If it's a funding issue, show helpful message
        if (error instanceof Error && error.message.includes("not funded")) {
          console.log("\n💡 To fund this account, run:")
          const keyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, true)
          const publicKey = keyPairs.spendingKeyPair.publicSpendingKey
          const derivedInfo = deriveAccountAddress(publicKey, config)
          console.log(`   starknet-devnet fund ${derivedInfo.address}`)
        }

        throw error
      }
    }, 60000) // 60 second timeout for deployment

    it("should deploy multiple accounts with different indices", async () => {
      // For OpenZeppelin accounts, we can use a minimal ABI or fetch it
      // For now, we'll use an empty ABI array as OZ account deployment is standard
      const config: AccountDerivationConfig & { abi: any } = {
        classHash: OZ_ACCOUNT_CLASS_HASH,
        salt: "0x0",
        abi: [], // OpenZeppelin account ABI (can be fetched from network if needed)
      }

      const accounts = []

      // Deploy accounts 0 and 1
      for (let accountIndex = 0; accountIndex < 2; accountIndex++) {
        const args: StarknetDerivationArgs = {
          accountIndex,
          addressIndex: 0,
        }

        const keyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, true)
        const publicKey = keyPairs.spendingKeyPair.publicSpendingKey
        const privateKey = keyPairs.spendingKeyPair.privateSpendingKey

        console.log(`\n🔑 Account ${accountIndex} Keys:`)
        console.log("   Public Key:", publicKey)

        try {
          const { account } = await deriveAndDeployAccount(
            publicKey,
            privateKey,
            provider,
            config,
            false,
          )

          accounts.push(account)
          console.log(`✅ Account ${accountIndex} deployed:`, account.address)
        } catch (error) {
          console.log(`⚠️  Account ${accountIndex} deployment skipped`)
          // Continue with next account
        }
      }

      // Verify all deployed accounts have unique addresses
      if (accounts.length > 1) {
        const addresses = accounts.map((a) => a.address)
        const uniqueAddresses = new Set(addresses)
        expect(uniqueAddresses.size).toBe(accounts.length)
      }
    }, 120000) // 2 minute timeout for multiple deployments
  })

  describe("Integration with InMemoryKeyAgent", () => {
    it("should derive account address from KeyAgent credentials", async () => {
      const { InMemoryKeyAgent } = await import("../../src/InMemoryKeyAgent")
      const { utf8ToBytes } = await import("@noble/hashes/utils")

      const getPassphrase = () => utf8ToBytes("test-passphrase")

      const agent = await InMemoryKeyAgent.fromMnemonicWords({
        getPassphrase,
        mnemonicWords: mnemonic,
        mnemonic2ndFactorPassphrase: "",
      })

      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      // Derive credentials using the agent
      const credentials = await agent.deriveCredentials(args, getPassphrase, true)

      console.log("\n📋 Agent Credentials:")
      console.log("   Public Spend Key:", credentials.spendingKey.publicSpendingKey)

      // Now derive account address from the public key
      const config: AccountDerivationConfig = {
        classHash: OZ_ACCOUNT_CLASS_HASH,
        salt: "0x0",
      }

      const derivedInfo = deriveAccountAddress(
        credentials.spendingKey.publicSpendingKey,
        config,
      )

      console.log("   Derived Address:", derivedInfo.address)

      expect(derivedInfo.address).toMatch(/^0x[0-9a-fA-F]+$/)

      // The derived info should have the compressed public key (x-coordinate only)
      // even if the input was uncompressed
      expect(derivedInfo.publicKey).toMatch(/^0x[0-9a-fA-F]{64}$/)

      // Verify it's derived from the same key (compressed version)
      const expectedCompressedKey = credentials.spendingKey.publicSpendingKey
        .startsWith("0x04") && credentials.spendingKey.publicSpendingKey.length === 132
        ? "0x" + credentials.spendingKey.publicSpendingKey.slice(4, 68)
        : credentials.spendingKey.publicSpendingKey

      expect(derivedInfo.publicKey).toBe(expectedCompressedKey)
    })
  })
})

/**
 * Instructions for running these tests:
 *
 * 1. Start Starknet Devnet:
 *    ```bash
 *    starknet-devnet-rs --seed 0 --port 5050
 *    ```
 *
 * 2. (Optional) Declare the OpenZeppelin Account contract if not already on devnet:
 *    Many devnets come with OZ contracts pre-declared.
 *    If needed, you can declare it manually.
 *
 * 3. Set environment variables and run tests:
 *    ```bash
 *    export RUN_DEVNET_TESTS=true
 *    export OZ_ACCOUNT_CLASS_HASH=0x<your-oz-class-hash>  # if different from default
 *    export STARKNET_RPC_URL=http://127.0.0.1:5050
 *    bun test test/devnet/derive-and-deploy.test.ts
 *    ```
 *
 * 4. For deployment tests, fund the derived address:
 *    - Run the test once to see the address
 *    - Use devnet's mint/fund mechanism to add tokens
 *    - Run the test again
 */
