import type {
  StarknetDerivationArgs,
  StarknetGroupedCredentials,
} from "./types"

export function deriveCredential(
  args: StarknetDerivationArgs,
  spendingPublicKey: string,
  spendingKeyEncryptedPrivateKeyBytes: Uint8Array,
  viewingPublicKey: string,
  viewingKeyEncryptedPrivateKeyBytes: Uint8Array,
): StarknetGroupedCredentials {
  return {
    "@context": ["https://w3id.org/wallet/v1"],
    id: `did:strk:${spendingPublicKey}`,
    type: "Starknet",
    controller: `did:strk:${spendingPublicKey}`,
    name: "Starknet Key Pair",
    description: "My Starknet Keys.",
    addressIndex: args.addressIndex,
    accountIndex: args.accountIndex,
    spendingKey: {
      publicSpendingKey: spendingPublicKey,
      encryptedPrivateKeyBytes: spendingKeyEncryptedPrivateKeyBytes,
    },
    viewingKey: {
      publicViewingKey: viewingPublicKey,
      encryptedPrivateKeyBytes: viewingKeyEncryptedPrivateKeyBytes,
    },
  }
}
