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
} from "starknet"
import {
  type StarknetDerivationArgs,
  deriveStarknetKeyPairs,
  deriveStarknetPrivateKey,
} from "../../src/chains/starknet"
import { SigningOperations } from "../../src/chains/starknet/signing-operations"
import type { ChainOperationArgs } from "../../src/types"
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
  it.skip("should sign a message and verify it", async () => {
    const dummyKey = "0x123"

    // Create a simpler typedData structure that follows the schema
    const myTypedData: TypedData = {
      types: {
        StarknetDomain: [
          { name: "name", type: "string" },
          { name: "version", type: "felt" },
          { name: "chainId", type: "felt" },
        ],
        Message: [{ name: "message", type: "felt" }],
      },
      primaryType: "Message",
      domain: {
        name: "Example DApp",
        version: "0.0.1",
        chainId: constants.StarknetChainId.SN_SEPOLIA,
      },
      message: {
        message: "1234",
      },
    }

    const args: ChainOperationArgs = {
      operation: "sign_message",
      accountAddress:
        "0x5d08a4e9188429da4e993c9bf25aafe5cd491ee2b501505d4d059f0c938f82d",
    }

    try {
      const result = await SigningOperations(args, dummyKey, myTypedData)
      expect(result).not.toBe(undefined)

      // The signature could be either ArraySignatureType or WeierstrassSignatureType
      // For our test, we know it should be an array
      if (Array.isArray(result)) {
        // Now TypeScript knows result is ArraySignatureType
        expect(result.length).toBeGreaterThanOrEqual(2)
      } else {
        // Handle the case where it's a WeierstrassSignatureType
        expect(result).toHaveProperty("r")
        expect(result).toHaveProperty("s")
        // TODO: check if this is correct
        console.log("Signature (r):", BigInt(result.r))
        console.log("Signature (s):", BigInt(result.s))
      }
    } catch (err) {
      // If the error is about the fake private key, that's acceptable
      // But we should fail on TypedData validation errors
      if (
        err instanceof Error &&
        !err.message.includes("Private key") &&
        !err.message.includes("dummy")
      ) {
        throw err
      }
      console.log("Expected error with dummy key:", err)
    }
  })
})
