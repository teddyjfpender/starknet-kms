import type {
  SignablePayload,
  SignatureResult,
  StarknetDerivationArgs,
  StarknetGroupedCredentials,
} from "./chains/starknet"

export type PayloadTypes = "transaction" | "message" | "fields"

export interface Result<T> {
  success: boolean
  data?: T
  error?: string
}

export type EncryptedKeyPropertyName = "encryptedSeedBytes"

export enum KeyAgentType {
  InMemory = "InMemory",
  Session = "Sesssion",
  Ledger = "Ledger",
}

export interface SerializableInMemoryKeyAgentData {
  __typename: KeyAgentType.InMemory
  encryptedSeedBytes: Uint8Array
  type: string[]
  id: string
  issuer: string
  issuanceDate: string
  credentialSubject: {
    id: string
    contents: GroupedCredentials[]
  }
}

export type SerializableKeyAgentData = SerializableInMemoryKeyAgentData
export type SerializableSessionKeyAgentData = {
  __typename: KeyAgentType.Session
  type: string[]
  id: string
  issuer: string
  issuanceDate: string
  credentialSubject: {
    id: string
    contents: GroupedCredentials[]
  }
}
export type GroupedCredentials = StarknetGroupedCredentials

export type CredentialMatcher<T extends ChainDerivationArgs> = (
  credential: GroupedCredentials,
  args: T,
) => boolean

// other new ones that work
export interface KeyPairDerivationOperations<T> {
  derivePublicKey: (privateKey: Uint8Array) => Promise<string>
  derivePrivateKey: (
    decryptedSeedBytes: Uint8Array,
    args: T,
  ) => Promise<Uint8Array>
}

export type ChainAddress = string

/**
 * @returns passphrase used to decrypt private keys
 */
export type GetPassphrase = (noCache?: boolean) => Uint8Array

export interface AccountKeyDerivationPath {
  account_ix: number
}
export interface AddressKeyDerivationPath {
  address_ix: number
}

export type RecipientPublicKeys = {
  recipientPubSpendKey: string
  recipientPubViewKey: string
}

export type StealthAddress = {
  ephemeralPublicKey: string
  stealthAddress: string
}

export interface KeyAgent {
  get serializableData(): SerializableKeyAgentData
  get knownCredentials(): GroupedCredentials[]
  set knownCredentials(credentials: GroupedCredentials[])
  /**
   * generic sign
   */
  sign<T extends GroupedCredentials>(
    payload: T,
    signable: ChainSignablePayload,
    args: ChainOperationArgs,
  ): Promise<ChainSignatureResult>

  deriveKeyPair(
    args: ChainDerivationArgs,
    passphrase: Uint8Array,
  ): Promise<ChainKeyPair>

  deriveCredentials(
    args: ChainDerivationArgs,
    getPassphrase: GetPassphrase,
    pure?: boolean,
  ): Promise<GroupedCredentials>

  deriveStealthAddress(recipientPublicKeys: RecipientPublicKeys): StealthAddress

  stealthOwnershipCheck(
    ephemeralPublicKey: string,
    stealthAddress: string,
    groupedCredential: GroupedCredentials,
  ): Promise<boolean>

  exportRootPrivateKey(): Promise<Uint8Array>

  decryptSeed(): Promise<Uint8Array>
}

export type ChainDerivationArgs = StarknetDerivationArgs

/**
 * Arguments indicating which operation we want to perform, plus any
 * special fields needed. For example, `sign_message` needs an
 * `accountAddress`; `sign_transaction` needs invocation details, etc.
 */
export type ChainOperationArgs = {
  operation:
    | "sign_message"
    | "sign_transaction"
    | "sign_deploy_account"
    | "sign_declare"
    | "sign_raw"
  /**
   * The Starknet account address used by `signMessage()`.
   * Not always needed for other operations, so it's optional.
   */
  accountAddress?: string
  /**
   * Additional details for transaction signing, declare, etc.
   * For example, if you want to call `signTransaction(...)`,
   * you can store an object of type `InvocationsSignerDetails` here.
   */
  transactionDetails?: any
}

export interface ChainSpecificPayload {
  network: any
  derivePublicKey(
    privateKey: ChainPrivateKey,
    args: ChainDerivationArgs,
  ): Promise<ChainPublicKey>
  derivePrivateKey(
    decryptedSeedBytes: Uint8Array,
    args: ChainDerivationArgs,
  ): Promise<ChainPrivateKey>
}

export type ChainPublicKey = string

export type ChainSignatureResult = SignatureResult

export type ChainPrivateKey = Uint8Array

export type ChainKeyPair = {
  spendingKeyPair: {
    publicSpendingKey: string
    encryptedPrivateKeyBytes: Uint8Array
  }
  viewingKeyPair: {
    publicViewingKey: string
    encryptedPrivateKeyBytes: Uint8Array
  }
}

export type ChainSigningFunction = (
  args: ChainOperationArgs, // TODO: chain
  privateKey: ChainPrivateKey,
) => Promise<ChainSignatureResult>

export type ChainSignablePayload = SignablePayload

export enum PathLevelIndexes {
  /**
   * Index of the PURPOSE level in a BIP44 path
   */
  PURPOSE = 0,

  /**
   * Index of the COIN_TYPE level in a BIP44 path
   */
  COIN_TYPE = 1,

  /**
   * Index of the ACCOUNT level in a BIP44 path
   */
  ACCOUNT = 2,

  /**
   * Index of the CHANGE level in a BIP44 path
   */
  CHANGE = 3,

  /**
   * Index of the INDEX level in a BIP44 path
   */
  INDEX = 4,
}
