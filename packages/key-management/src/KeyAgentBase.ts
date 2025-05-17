import { HDKey } from "@scure/bip32"

import { bytesToUtf8 } from "@noble/ciphers/utils"
import { utf8ToBytes } from "@noble/hashes/utils"
import { KeyDecryptor } from "./KeyDecryptor"
import {
  type SignablePayload,
  type StarknetKeyPair,
  deriveStarknetKeyPairs,
} from "./chains/starknet"
import { deriveCredential } from "./chains/starknet/credential-derivation"
import { SigningOperations } from "./chains/starknet/signing-operations"
import {
  checkStealthOwnership,
  createStealthOutput,
} from "./chains/starknet/stealth-derivation"
import { emip3encrypt } from "./emip3"
import * as errors from "./errors"
import type {
  ChainDerivationArgs,
  ChainKeyPair,
  ChainOperationArgs,
  ChainSignatureResult,
  GetPassphrase,
} from "./types"
import type {
  GroupedCredentials,
  KeyAgent,
  RecipientPublicKeys,
  SerializableKeyAgentData,
  StealthAddress,
} from "./types"

export abstract class KeyAgentBase implements KeyAgent {
  readonly serializableData: SerializableKeyAgentData
  private keyDecryptor: KeyDecryptor
  private mnemonic: string

  get knownCredentials(): GroupedCredentials[] {
    return this.serializableData.credentialSubject.contents
  }
  set knownCredentials(credentials: GroupedCredentials[]) {
    this.serializableData.credentialSubject.contents = credentials
  }

  constructor(
    serializableData: SerializableKeyAgentData,
    getPassphrase: GetPassphrase,
    mnemonic: string,
  ) {
    this.serializableData = serializableData
    this.mnemonic = mnemonic
    this.keyDecryptor = new KeyDecryptor(getPassphrase)
  }

  async decryptSeed(): Promise<Uint8Array> {
    // TODO: add passphrase as an argument?
    try {
      return await this.keyDecryptor.decryptSeedBytes(this.serializableData)
    } catch (error) {
      throw new Error(`Failed to decrypt root private key: ${error}`)
    }
  }

  async exportRootPrivateKey(): Promise<Uint8Array> {
    // TODO: add passphrase as an argument?
    try {
      const decryptedSeedBytes = await this.decryptSeed()
      const rootKey = HDKey.fromMasterSeed(decryptedSeedBytes)
      return rootKey.privateKey ? rootKey.privateKey : new Uint8Array([])
    } catch (error) {
      throw new errors.AuthenticationError(
        "Failed to export root private key",
        error,
      )
    }
  }

  async deriveCredentials(
    args: ChainDerivationArgs,
    getPassphrase: GetPassphrase,
    pure?: boolean,
  ): Promise<GroupedCredentials> {
    const passphrase = getPassphrase()

    // check if the credential is already in the known credentials in the serializable data
    const knownCredential =
      this.serializableData.credentialSubject.contents.find(
        (cred) => cred.accountIndex === args.accountIndex,
      )
    if (knownCredential) {
      console.log("found a known credential", knownCredential)
      return knownCredential
    }

    const derivedKeyPairs = await this.deriveKeyPair(args, passphrase)

    try {
      const groupedCredential = deriveCredential(
        args,
        derivedKeyPairs.spendingKeyPair.publicSpendingKey,
        derivedKeyPairs.spendingKeyPair.encryptedPrivateKeyBytes,
        derivedKeyPairs.viewingKeyPair.publicViewingKey,
        derivedKeyPairs.viewingKeyPair.encryptedPrivateKeyBytes,
      )

      if (!pure) {
        this.serializableData.credentialSubject.contents = [
          ...this.serializableData.credentialSubject.contents,
          groupedCredential,
        ]
      }
      return groupedCredential
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  /**
   * Restore credentials for the given derivation path and persist them.
   *
   * This is a convenience wrapper around {@link deriveCredentials} that
   * stores the derived credentials on the agent before returning.
   */
  async restoreKeyAgent(
    args: ChainDerivationArgs,
    getPassphrase: GetPassphrase,
  ): Promise<GroupedCredentials> {
    return this.deriveCredentials(args, getPassphrase, false)
  }

  async deriveKeyPair(
    args: ChainDerivationArgs,
    passphrase: Uint8Array,
  ): Promise<ChainKeyPair> {
    // Generate the private key
    let keypairs: StarknetKeyPair | Uint8Array | null
    keypairs = this.#generateKeyPairsFromSeed(args)
    // check if keypairs is StarknetKeyPair if not throw error
    // Use something more specific:
    if (
      !keypairs ||
      typeof keypairs !== "object" ||
      !("spendingKeyPair" in keypairs) ||
      !("viewingKeyPair" in keypairs)
    ) {
      throw new Error("Failed to generate key pairs")
    }
    const encoder = new TextEncoder()
    const encryptedSpendingKeyPrivateKeyBytes = await emip3encrypt(
      encoder.encode(keypairs.spendingKeyPair.privateSpendingKey),
      passphrase,
    )
    const encryptedViewingKeyPrivateKeyBytes = await emip3encrypt(
      encoder.encode(keypairs.viewingKeyPair.privateViewingKey),
      passphrase,
    )

    try {
      const keyPairs = {
        spendingKeyPair: {
          publicSpendingKey: keypairs.spendingKeyPair.publicSpendingKey,
          encryptedPrivateKeyBytes: encryptedSpendingKeyPrivateKeyBytes,
        },
        viewingKeyPair: {
          publicViewingKey: keypairs.viewingKeyPair.publicViewingKey,
          encryptedPrivateKeyBytes: encryptedViewingKeyPrivateKeyBytes,
        },
      }
      // Overwrite and nullify the privateKey
      keypairs = utf8ToBytes("0".repeat(50))
      keypairs = null

      return keyPairs
    } catch (error) {
      // Overwrite and nullify the privateKey
      if (keypairs) {
        keypairs = utf8ToBytes("0".repeat(50))
        keypairs = null
      }
      console.error(error)
      throw error
    }
  }

  deriveStealthAddress(
    recipientPublicKeys: RecipientPublicKeys,
  ): StealthAddress {
    return createStealthOutput(
      recipientPublicKeys.recipientPubSpendKey,
      recipientPublicKeys.recipientPubViewKey,
    )
  }

  async stealthOwnershipCheck(
    ephemeralPublicKey: string,
    stealthAddress: string,
    groupedCredential: GroupedCredentials,
  ): Promise<boolean> {
    // Decrypt the private view key (which was encrypted)
    const viewingKeyBytes = new Uint8Array(
      groupedCredential.viewingKey.encryptedPrivateKeyBytes,
    )
    const decryptedPrivateViewKeyBytes =
      await this.keyDecryptor.decryptChildPrivateKey(viewingKeyBytes)
    // Decode to a string (the originally encrypted hex string)
    const privateViewKey = bytesToUtf8(decryptedPrivateViewKeyBytes)

    // Use the public spending key directly (it was stored in plain text)
    const publicSpendKey = groupedCredential.spendingKey.publicSpendingKey

    // Ensure both keys have the proper "0x" prefix
    const formattedPrivateViewKey = privateViewKey.startsWith("0x")
      ? privateViewKey
      : `0x${privateViewKey}`
    const formattedPublicSpendKey = publicSpendKey.startsWith("0x")
      ? publicSpendKey
      : `0x${publicSpendKey}`

    return checkStealthOwnership(
      formattedPrivateViewKey, // recipientPrivateViewKey (hex)
      formattedPublicSpendKey, // recipientPublicSpendKey (hex)
      ephemeralPublicKey, // ephemeralPublicKey (hex)
      stealthAddress, // stealthAddress (hex)
    )
  }

  async sign<T extends GroupedCredentials>(
    payload: T,
    signable: SignablePayload,
    args: ChainOperationArgs,
  ): Promise<ChainSignatureResult> {
    const decryptedKeyBytes = await this.keyDecryptor.decryptChildPrivateKey(
      new Uint8Array(
        Object.values(payload.spendingKey.encryptedPrivateKeyBytes),
      ),
    )

    const privateKey: string | null = bytesToUtf8(decryptedKeyBytes)
    let result

    try {
      result = SigningOperations(args, privateKey, signable as SignablePayload)
    } catch (error) {
      console.error(error)
      throw error
    }

    return result
  }

  #generateKeyPairsFromSeed<T extends ChainDerivationArgs>(
    args: T,
  ): StarknetKeyPair {
    return deriveStarknetKeyPairs(args, this.mnemonic, false)
  }
}
