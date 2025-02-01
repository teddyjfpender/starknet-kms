import type {
  Call,
  DeployAccountSignerDetails,
  Signature,
  TypedData,
} from "starknet"

export type StarknetDerivationArgs = {
  accountIndex: number
  addressIndex: number
}

export type StarknetKeyPair = {
  spendingKeyPair: { privateSpendingKey: string; publicSpendingKey: string }
  viewingKeyPair: { privateViewingKey: string; publicViewingKey: string }
}

export enum StarknetKeyConst {
  /**
   * Constant value used for defining the purpose in a BIP44 path
   */
  PURPOSE = 44,

  /**
   * COIN_TYPE value for Starknet
   */
  STARKNET_COIN_TYPE = 9004,
}

export type StarknetGroupedCredentials = {
  "@context": ["https://w3id.org/wallet/v1"]
  id: string
  type: "Starknet"
  controller: string
  name: string
  description: string
  addressIndex: number
  accountIndex: number
  spendingKey: {
    publicSpendingKey: string
    encryptedPrivateKeyBytes: Uint8Array
  }
  viewingKey: {
    publicViewingKey: string
    encryptedPrivateKeyBytes: Uint8Array
  }
}

export type SignablePayload =
  | string
  | Uint8Array
  | TypedData
  | Call[]
  | DeployAccountSignerDetails

export type SignatureResult = Signature
