import { describe, it, expect, beforeAll } from "bun:test"
import { Account, RpcProvider, constants } from "starknet"
import { mnemonic } from "@starkms/common"
import { Account as TongoAccount } from "@fatsolutions/tongo-sdk";
// Note: For testing, we'll use the OpenZeppelin account contract
// import { KAGE_ACCOUNT_ABI } from "@starkms/contracts"
import {
  deriveStarknetKeyPairs,
  deriveAccountAddress,
  deriveAndDeployAccount,
  isAccountDeployed,
  type StarknetDerivationArgs,
  type AccountDerivationConfig,
  StarknetKeyPair,
  DerivedAccountInfo,
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

const SEPOLIA_CONFIG = {
  nodeUrl: process.env.STARKNET_RPC_URL || "https://starknet-sepolia.public.blastapi.io/rpc/v0_9",
  chainId: constants.StarknetChainId.SN_SEPOLIA,
}

// This is the class hash for the devnet account contract
const OZ_ACCOUNT_CLASS_HASH = "0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564" // Replace with actual class hash from your devnet

/**
 * Set to true to run these tests against devnet
 * Set to false to skip (useful in CI where devnet may not be running)
 */
const RUN_SEPOLIA_TESTS = true

describe.skipIf(!RUN_SEPOLIA_TESTS)("Account Derivation and Deployment on Devnet", async () => {
  let provider: RpcProvider
  let mnemonicPhrase: string
  let args: StarknetDerivationArgs
  let accountContractKeyPairs: StarknetKeyPair
  let accountContractDerivationConfig: AccountDerivationConfig
  let derivedAccountContractInfo: DerivedAccountInfo
  let tongoKeyPairs: StarknetKeyPair
  let tongoContractAddress: string
  let signer: Account

  beforeAll(async () => {
    tongoContractAddress = "0x028798470f0939d26aab8a3dcb144b9045fb113867ae205ad59b1b47ec904f00"
    const TONGO_COIN_TYPE = 5454

    // Initialize provider
    provider = new RpcProvider({
      nodeUrl: SEPOLIA_CONFIG.nodeUrl,
    })

    // Join mnemonic words
    mnemonicPhrase = bip39.joinMnemonicWords(mnemonic)

    // helpers -- derive regular account contract keys
    args = {
        accountIndex: 0,
        addressIndex: 0,
    }

    accountContractKeyPairs = deriveStarknetKeyPairs(args, mnemonicPhrase, true)
    const publicKey = accountContractKeyPairs.spendingKeyPair.publicSpendingKey

    accountContractDerivationConfig = {
        classHash: OZ_ACCOUNT_CLASS_HASH,
        salt: "0x0",
        }
    derivedAccountContractInfo = deriveAccountAddress(publicKey, accountContractDerivationConfig)
    const deployed = await isAccountDeployed(derivedAccountContractInfo.address, provider)

    // helpers -- derive Tongo keys
    tongoKeyPairs = deriveStarknetKeyPairs(
        { ...args, coinType: TONGO_COIN_TYPE },
        mnemonicPhrase,
        false,
    )

    // Signer account from which the user submits transactions from
    signer = new Account({
        provider: provider,
        address: derivedAccountContractInfo.address,
        signer: accountContractKeyPairs.spendingKeyPair.privateSpendingKey,
        transactionVersion: "0x3"
    });

    console.log("\n🔧 Devnet Test Configuration:")
    console.log("   Node URL:", SEPOLIA_CONFIG.nodeUrl)
    console.log("   OZ Account Class Hash:", OZ_ACCOUNT_CLASS_HASH)
    console.log("   Mnemonic:", mnemonic.slice(0, 3).join(" ") + "...")
  })

  describe("Deposit STRK into Tongo", () => {
    it("should 'fund' a Tongo Account", async () => {
    // WIP
    const tongoAccount = new TongoAccount(tongoKeyPairs.spendingKeyPair.privateSpendingKey, tongoContractAddress, provider);
    
    const tongoAddress = TongoAccount.tongoAddress(tongoKeyPairs.spendingKeyPair.privateSpendingKey);
    const rawState = await tongoAccount.state();
    console.log(rawState);

    const fundOp = await tongoAccount.fund({ amount: 5000n });
    await fundOp.populateApprove();

    // estimate fee
    console.log('here')
    const feeEstimate = await signer.estimateInvokeFee([
        fundOp.approve!,
        fundOp.toCalldata()
    ])
    console.log('here2')

    console.log('feeEstimate', feeEstimate)

    const transactions = [
        fundOp.approve!,
        fundOp.toCalldata()
    ]
    const transactionsDetail = {
        resourceBounds: feeEstimate.resourceBounds
    }

    const fundTx = await signer.execute(transactions, transactionsDetail);

    console.log("Fund TX:", fundTx.transaction_hash);
    await provider.waitForTransaction(fundTx.transaction_hash);

    const state1 = await tongoAccount.state();
    console.log("Account balance:", state1.balance); // 5000n

    })
  })
})