import { describe, it, expect, beforeAll } from "bun:test"
import { Account, RpcProvider, constants, Contract, num } from "starknet"
import { mnemonic } from "@starkms/common"
// Use local vendored Tongo SDK for investigation to avoid drift
import { Account as TongoAccount } from "@fatsolutions/tongo-sdk";
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


const SEPOLIA_CONFIG = {
  nodeUrl: process.env.STARKNET_RPC_URL || "https://starknet-sepolia.public.blastapi.io/",
  chainId: constants.StarknetChainId.SN_SEPOLIA,
}

// This is the class hash for the devnet account contract
const OZ_ACCOUNT_CLASS_HASH = "0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564" // Replace with actual class hash from your devnet

/**
 * Set to true to run these tests against devnet
 * Set to false to skip (useful in CI where devnet may not be running)
 */
const RUN_SEPOLIA_TESTS = true

const TONGO_CONTRACT_ADDRESS = "0x00b4cca30f0f641e01140c1c388f55641f1c3fe5515484e622b6cb91d8cee585"

describe.skipIf(!RUN_SEPOLIA_TESTS)("Account Derivation and Deployment on Devnet", async () => {
  let provider: RpcProvider
  let mnemonicPhrase: string
  let args: StarknetDerivationArgs
  let accountContractKeyPairs: StarknetKeyPair
  let accountContractDerivationConfig: AccountDerivationConfig
  let derivedAccountContractInfo: DerivedAccountInfo
  let tongoKeyPairs: StarknetKeyPair
  let tongoKeyPairsSecond: StarknetKeyPair
  let tongoContractAddress: string
  let signer: Account

  beforeAll(async () => {
    tongoContractAddress = TONGO_CONTRACT_ADDRESS
    const TONGO_COIN_TYPE = 5454

    // Initialize provider
    provider = new RpcProvider({
      nodeUrl: SEPOLIA_CONFIG.nodeUrl,
      specVersion: "0.9.0"
    })

    // Join mnemonic words
    mnemonicPhrase = bip39.joinMnemonicWords(mnemonic)

    // Derive regular Starknet account keys (coin type 9004) - this account should already be deployed
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

    // Derive Tongo keys (coin type 5454) - these are for the Tongo virtual account
    const tongoArgs = {
        accountIndex: 0,
        addressIndex: 0,
        coinType: TONGO_COIN_TYPE,
    }

    tongoKeyPairs = deriveStarknetKeyPairs(tongoArgs, mnemonicPhrase, false)
    tongoKeyPairsSecond = deriveStarknetKeyPairs({...tongoArgs, addressIndex: 1}, mnemonicPhrase, false)

    // Ensure address is properly padded with leading zeros
    const paddedAddress = derivedAccountContractInfo.address.startsWith('0x')
      ? '0x' + derivedAccountContractInfo.address.slice(2).padStart(64, '0')
      : '0x' + derivedAccountContractInfo.address.padStart(64, '0')

    // Signer account - use the already-deployed OZ account
    signer = new Account({
        provider: provider,
        address: paddedAddress,
        signer: accountContractKeyPairs.spendingKeyPair.privateSpendingKey,
        cairoVersion: "1",
        transactionVersion: "0x3"
    });

    console.log("\n🔧 Sepolia Test Configuration:")
    console.log("   Node URL:", SEPOLIA_CONFIG.nodeUrl)
    console.log("   OZ Account Address:", paddedAddress)
    console.log("   OZ Account Deployed:", deployed)
    console.log("   Tongo Contract:", tongoContractAddress)
    console.log("   Tongo Private Key:", tongoKeyPairs.spendingKeyPair.privateSpendingKey.substring(0, 10) + "...")
    console.log("   Tongo Public Key (x):", tongoKeyPairs.spendingKeyPair.publicSpendingKey.substring(0, 66))
    console.log("   Mnemonic:", mnemonic.slice(0, 3).join(" ") + "...")
  })

  describe("Deposit STRK into Tongo", () => {
    it("should 'fund' a Tongo Account", async () => {
        // Convert hex string private key to BigInt for Tongo SDK
        const tongoPrivateKey = tongoKeyPairs.spendingKeyPair.privateSpendingKey;

        // Pass signer (Account) not provider to TongoAccount constructor
        const tongoAccount = new TongoAccount(tongoPrivateKey, tongoContractAddress, signer);

        const tongoAddress = TongoAccount.tongoAddress(tongoPrivateKey);
        const decryptedState = await tongoAccount.state();
        const balance = decryptedState.balance
        console.log("Tongo Account State:", decryptedState);
        console.log("Tongo Address:", tongoAddress);
        console.log("Signer Address:", signer.address);

        // Deposit 1 STRK
        const fundOp = await tongoAccount.fund({ amount: 1n });
        // SDK already populates approve internally; calling explicitly for clarity/idempotency
        await fundOp.populateApprove();

        const fundTx = await signer.execute([
            fundOp.approve!,
            fundOp.toCalldata()
        ]);

        console.log("Fund TX:", fundTx.transaction_hash);
        await provider.waitForTransaction(fundTx.transaction_hash);

        const state1 = await tongoAccount.state();
        console.log("Account balance:", state1.balance);
        // Expect new balance to increase by 1
        expect(state1.balance).toBe(balance + 1n);
      }, 120000)
      it("should 'transfer' confidential balance from user's first account to user's second Tongo Account", async () => {
        // Convert hex string private key to BigInt for Tongo SDK
        const tongoPrivateKey = tongoKeyPairs.spendingKeyPair.privateSpendingKey;
        const tongoPrivateKeySecond = tongoKeyPairsSecond.spendingKeyPair.privateSpendingKey;

        // Pass signer (Account) not provider to TongoAccount constructor
        const tongoAccount = new TongoAccount(tongoPrivateKey, tongoContractAddress, signer);
        const tongoAccountSecond = new TongoAccount(tongoPrivateKeySecond, tongoContractAddress, signer);

        const tongoAddressSecond = TongoAccount.tongoAddress(tongoPrivateKeySecond);
        const decryptedState = await tongoAccount.state();
        const decryptedStateSecond = await tongoAccountSecond.state();
        const balance = decryptedState.balance
        const balanceSecond = decryptedStateSecond.pending
        console.log("Tongo Account State:", decryptedStateSecond);
        console.log("Tongo Address:", tongoAddressSecond);
        console.log("Signer Address:", signer.address);

        // Transfer 1 STRK
        const transferOp = await tongoAccount.transfer({
            to: tongoAccountSecond.publicKey,
            amount: 1n  
        });

        const transferTx = await signer.execute(transferOp.toCalldata());
        console.log("Transfer TX:", transferTx.transaction_hash);
        await provider.waitForTransaction(transferTx.transaction_hash);

        const state1 = await tongoAccount.state();
        const state2 = await tongoAccountSecond.state();
        console.log("Account balance (1st):", state1.balance);
        console.log("Account balance (2nd):", state2.pending);
        // Expect first account to decrease by 1 and second to increase by 1
        // balance changes for the second account will be pending
        expect(state1.balance).toBe(balance - 1n);
        expect(state2.pending).toBe(balanceSecond + 1n);
      }, 120000)

    it("should 'rollover' confidential balance from user's second account pending balance into user's second account sepdnable balance", async () => {
        // Convert hex string private key to BigInt for Tongo SDK
        const tongoPrivateKeySecond = tongoKeyPairsSecond.spendingKeyPair.privateSpendingKey;

        // Pass signer (Account) not provider to TongoAccount constructor
        const tongoAccountSecond = new TongoAccount(tongoPrivateKeySecond, tongoContractAddress, signer);

        const tongoAddressSecond = TongoAccount.tongoAddress(tongoPrivateKeySecond);
        const decryptedStateSecond = await tongoAccountSecond.state();
        const stateSecond = decryptedStateSecond
        console.log("Tongo Account State:", decryptedStateSecond);
        console.log("Tongo Address:", tongoAddressSecond);
        console.log("Signer Address:", signer.address);

        // Transfer 1 STRK
        const rolloverOp = await tongoAccountSecond.rollover();

        const rolloverTx = await signer.execute(rolloverOp.toCalldata());
        console.log("Rollover TX:", rolloverTx.transaction_hash);
        await provider.waitForTransaction(rolloverTx.transaction_hash);

        const state2 = await tongoAccountSecond.state();
        // Expect account pending to be 0n
        expect(state2.pending).toBe(0n);
        // Expect account spendable to increase by original pending amount
        expect(state2.balance).toBe(stateSecond.balance + stateSecond.pending)
      }, 120000)
    })
})
