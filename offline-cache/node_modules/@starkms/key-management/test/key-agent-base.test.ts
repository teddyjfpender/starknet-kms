import { beforeEach, describe, expect, it } from "bun:test"
import { utf8ToBytes } from "@noble/hashes/utils"
import * as bip32 from "@scure/bip32"
import { mnemonic } from "@starkms/common"
import { KeyAgentBase } from "../src/KeyAgentBase"
import * as bip39 from "../src/util/bip39"

import { type BigNumberish, ec, hash } from "starknet"
import type {
  SignablePayload,
  StarknetDerivationArgs,
} from "../src/chains/starknet"
import { emip3encrypt } from "../src/emip3"
import {
  type ChainOperationArgs,
  type GroupedCredentials,
  KeyAgentType,
  type SerializableKeyAgentData,
} from "../src/types"
import * as util from "../src/util/bip39"

// Provide the passphrase for testing purposes
const params = {
  passphrase: "passphrase",
  incorrectPassphrase: "not correct passphrase",
}
const getPassphrase = () => utf8ToBytes(params.passphrase)

//const getWrongPassphrase = () => utf8ToBytes(params.incorrectPassphrase)

describe("KeyAgentBase (Starknet Functionality)", () => {
  class KeyAgentBaseInstance extends KeyAgentBase {}

  let instance: KeyAgentBaseInstance
  let serializableData: SerializableKeyAgentData
  let passphrase: Uint8Array
  let rootKeyBytes: Uint8Array
  let encryptedSeedBytes: Uint8Array
  let seed: Uint8Array

  beforeEach(async () => {
    // Generate a mnemonic (24 words)
    //const strength = 128 // increase to 256 for a 24-word mnemonic
    seed = util.mnemonicToSeed(mnemonic)
    // Create root node from seed
    const root = bip32.HDKey.fromMasterSeed(seed)
    // unencrypted root key bytes
    rootKeyBytes = root.privateKey ? root.privateKey : new Uint8Array([])

    // passphrase
    passphrase = getPassphrase()
    // Works with seed
    encryptedSeedBytes = await emip3encrypt(seed, passphrase)
  })

  describe("Starknet KeyAgent", () => {
    beforeEach(() => {
      // Define your own appropriate initial data, network, accountKeyDerivationPath, and accountAddressDerivationPath
      serializableData = {
        __typename: KeyAgentType.InMemory,
        encryptedSeedBytes: encryptedSeedBytes,
        id: "http://example.gov/wallet/3732",
        type: ["VerifiableCredential", "EncryptedWallet"],
        issuer: "did:example:123",
        issuanceDate: "2020-05-22T17:38:21.910Z",
        credentialSubject: {
          id: "did:example:123",
          contents: [],
        },
      }
      instance = new KeyAgentBaseInstance(
        serializableData,
        getPassphrase,
        bip39.joinMnemonicWords(mnemonic),
      )
    })
    it("should return the correct empty knownAddresses", () => {
      expect(instance.knownCredentials).toStrictEqual(
        serializableData.credentialSubject.contents,
      )
    })

    it("should return the correct empty serializableData", () => {
      expect(instance.serializableData).toStrictEqual(serializableData)
    })

    it("should derive correct key pair", async () => {
      // Define a mocked publicKey, which should be expected from the derivation
      const expectedPublicSpendingKey =
        "0x040426212993d56613e1886a4cbc5b58810570023581c2aab0b423277776b79d2e042168e85622280f636c3a93e92f6d9daff6e49304b1e5676203feba109944d1"
      const expectedPublicViewingKey =
        "0x04061cf81ed18d4d9466b86a4e7f44a4e9b5562362e60ed1d073bf10b84763fd2100bf6f13998b2477c65e55377f326dd2da1f133a1b517e7b9f6b0bba00e347e5"

      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }

      const groupedCredential = await instance.deriveCredentials(
        args,
        getPassphrase,
        true,
      )

      expect(groupedCredential.spendingKey.publicSpendingKey).toStrictEqual(
        expectedPublicSpendingKey,
      )
      expect(groupedCredential.viewingKey.publicViewingKey).toStrictEqual(
        expectedPublicViewingKey,
      )
    })

    it("should derive correct address for account index other than 0", async () => {
      // Define a mocked publicKey, which should be expected from the derivation
      const expectedPublicSpendingKey =
        "0x0407873b5322cbee02f90349e3dea6af8daa6e26dec9b13940b7ab7358617f32bd036fa073772acf24db34409b0eb625722b049d2b6e0349d3f9c5c69a4eb27724"
      const expectedPublicViewingKey =
        "0x040566f30010576c85473d131a1eddc8630ade6755d4d9dec2b72152eb48063cee06c1a07e9af70d9fd4b45108aee7ccfefe183211aad7fb40beeb7b69f6f4230b"

      const args: StarknetDerivationArgs = {
        accountIndex: 1,
        addressIndex: 0,
      }

      const groupedCredential = await instance.deriveCredentials(
        args,
        getPassphrase,
        true,
      )

      expect(groupedCredential.spendingKey.publicSpendingKey).toStrictEqual(
        expectedPublicSpendingKey,
      )
      expect(groupedCredential.viewingKey.publicViewingKey).toStrictEqual(
        expectedPublicViewingKey,
      )
    })

    it("should derive multiple unique key pairs for each account index and store credentials properly", async () => {
      const expectedPublicKeys = [
        "0x040426212993d56613e1886a4cbc5b58810570023581c2aab0b423277776b79d2e042168e85622280f636c3a93e92f6d9daff6e49304b1e5676203feba109944d1",
        "0x0407873b5322cbee02f90349e3dea6af8daa6e26dec9b13940b7ab7358617f32bd036fa073772acf24db34409b0eb625722b049d2b6e0349d3f9c5c69a4eb27724",
      ]

      const resultArray: GroupedCredentials[] = []

      for (let i = 0; i < expectedPublicKeys.length; i++) {
        const args: StarknetDerivationArgs = {
          accountIndex: i,
          addressIndex: 0,
        }
        // when pure is false it will store the credentials
        const result = await instance.deriveCredentials(
          args,
          getPassphrase,
          false,
        )
        resultArray.push(result)
      }
      // check if there are two credentials in the knownCredentials
      expect(instance.knownCredentials.length).toStrictEqual(2)
      // Check if the credentials were stored properly.
      expect(
        instance.knownCredentials[0]?.spendingKey.publicSpendingKey,
      ).toStrictEqual(expectedPublicKeys[0] as string)
      expect(
        instance.knownCredentials[1]?.spendingKey.publicSpendingKey,
      ).toStrictEqual(expectedPublicKeys[1] as string)
    })

    it.skip("should export root key successfully", async () => {
      const decryptedRootKey = await instance.exportRootPrivateKey()
      expect(decryptedRootKey).toStrictEqual(rootKeyBytes)
    })
    it.skip("should use the generic sign<T> function for signing a transaction", async () => {
      // broken, oof.
      const expectedSpendingKey =
        "0x040426212993d56613e1886a4cbc5b58810570023581c2aab0b423277776b79d2e042168e85622280f636c3a93e92f6d9daff6e49304b1e5676203feba109944d1"
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }
      const groupedCredential = await instance.deriveCredentials(
        args,
        getPassphrase,
        true,
      )

      expect(groupedCredential.spendingKey.publicSpendingKey).toStrictEqual(
        expectedSpendingKey,
      )

      const rawMessage: string = "gmgm!"

      const signArgs: ChainOperationArgs = { operation: "sign_raw" }

      const signature = await instance.sign(
        groupedCredential,
        rawMessage as unknown as SignablePayload,
        signArgs,
      )

      const msgHash1 = hash.computeHashOnElements(
        rawMessage as unknown as BigNumberish[],
      )
      const result1 = ec.starkCurve.verify(
        signature.toString(),
        msgHash1,
        expectedSpendingKey,
      )
      expect(result1).toBe(true)
    })
    it("should derive stealth address for itself and then confirm the stealth address is owned by itself", async () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }
      const groupedCredential = await instance.deriveCredentials(
        args,
        getPassphrase,
        true,
      )
      // create a stealth address for yourself
      const recipientPublicKeys = {
        recipientPubSpendKey: groupedCredential.spendingKey.publicSpendingKey,
        recipientPubViewKey: groupedCredential.viewingKey.publicViewingKey,
      }
      const stealthAddress = instance.deriveStealthAddress(recipientPublicKeys)
      console.log("stealthAddress", stealthAddress)
      expect(stealthAddress).toHaveProperty("ephemeralPublicKey")
      expect(stealthAddress).toHaveProperty("stealthAddress")

      // check if the stealth address is owned by yourself
      const isOwned = await instance.stealthOwnershipCheck(
        stealthAddress.ephemeralPublicKey,
        stealthAddress.stealthAddress,
        groupedCredential,
      )
      expect(isOwned).toBe(true)
    })
  })
})
