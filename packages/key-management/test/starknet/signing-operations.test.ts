import { describe, expect, it } from "bun:test"
import { mnemonic } from "@starkms/common"
import {
  constants,
  type BigNumberish,
  Signer,
  type TypedData,
  type WeierstrassSignatureType,
  ec,
  encode,
  hash,
  num,
  stark,
} from "starknet"
import {
  type StarknetDerivationArgs,
  deriveStarknetKeyPairs,
  deriveStarknetPrivateKey,
} from "../../src/chains/starknet"
import {
  type ChainOperationArgs,
  SigningOperations,
} from "../../src/chains/starknet/signing-operations"
import * as bip39 from "../../src/util/bip39"

describe("Derive Keys From Mnemonic", () => {
  it("should derive a private key from mnemonic and sign a message that can be verified", async () => {
    const args: StarknetDerivationArgs = {
      accountIndex: 0,
      addressIndex: 0,
    }
    const privateKey = deriveStarknetPrivateKey(
      args,
      bip39.joinMnemonicWords(mnemonic),
    )
    expect(privateKey).not.toBe(undefined)
    const fullPublicKey = encode.addHexPrefix(
      encode.buf2hex(ec.starkCurve.getPublicKey(privateKey, false)),
    )

    const message: BigNumberish[] = [1, 128, 18, 14]

    const msgHash = hash.computeHashOnElements(message)
    const signature: WeierstrassSignatureType = ec.starkCurve.sign(
      msgHash,
      privateKey,
    )
    const msgHash1 = hash.computeHashOnElements(message)
    const result1 = ec.starkCurve.verify(signature, msgHash1, fullPublicKey)
    expect(result1).toBe(true)
  })
  it("should derive the same public key as starknet-js", async () => {
    const args: StarknetDerivationArgs = {
      accountIndex: 0,
      addressIndex: 0,
    }
    const keypairs = deriveStarknetKeyPairs(
      args,
      bip39.joinMnemonicWords(mnemonic),
      true,
    )
    expect(keypairs).not.toBe(undefined)
    console.log(keypairs)

    const signer = new Signer(keypairs.spendingKeyPair.privateSpendingKey)
    const signerPublicKey = await signer.getPubKey()

    expect(signerPublicKey).toBe(keypairs.spendingKeyPair.publicSpendingKey)
  })
  it("should sign a message and verify it", async () => {
    const dummyKey = "0x123"

    const myTypedData: TypedData = {
      domain: {
        name: "Example DApp",
        chainId: constants.StarknetChainId.SN_SEPOLIA,
        version: "0.0.3",
      },
      types: {
        StarkNetDomain: [
          { name: "name", type: "string" },
          { name: "chainId", type: "felt" },
          { name: "version", type: "string" },
        ],
        Message: [{ name: "message", type: "felt" }],
      },
      primaryType: "Message",
      message: { message: "1234" },
    }

    const args: ChainOperationArgs = {
      operation: "sign_message",
      accountAddress:
        "0x5d08a4e9188429da4e993c9bf25aafe5cd491ee2b501505d4d059f0c938f82d",
    }
    const result = await SigningOperations(args, dummyKey, myTypedData)
    expect(result).not.toBe(undefined)
    expect(result).toHaveProperty("r")
    expect(result).toHaveProperty("s")
    expect(result).toHaveProperty("recovery")
    expect(result.r).toBe(
      684915484701699003335398790608214855489903651271362390249153620883122231253n,
    )
    expect(result.s).toBe(
      1399150959912500412309102776989465580949387575375484933432871778355496929189n,
    )
  })
})
