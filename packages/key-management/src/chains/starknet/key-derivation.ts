import { type Hex, bytesToHex } from "@noble/curves/abstract/utils"
import { sha256 } from "@noble/hashes/sha256"
import { HDKey } from "@scure/bip32"
import { getStarkKey, grindKey as microGrindKey } from "@scure/starknet"
import { ethers } from "ethers"
import { ec, encode, hash } from "starknet"
import {
  type StarknetDerivationArgs,
  StarknetKeyConst,
  type StarknetKeyPair,
} from "./types"

/**
 * Utility to add '0x' prefix if missing
 */
const { addHexPrefix } = encode

/**
 * Grinds a private key to a valid StarkNet private key.
 *
 * StarkNet requires private keys to be < curve order, so we "grind"
 * the raw 256-bit key space down to the valid range. The scure/starknet
 * library handles that with `grindKey`.
 *
 * @param privateKey - A 0x‐prefixed hex string (or hex without prefix).
 * @returns A 0x‐prefixed hex string suitable for StarkNet usage.
 */
export function grindKey(privateKey: Hex): string {
  return addHexPrefix(microGrindKey(privateKey))
}

/**
 * Creates a canonical integer from a name by hashing and truncating.
 * (Example utility that might be used to customize derivation paths, etc.)
 *
 * @param name - Some string (e.g. "myaccount", "myviewkey", etc.)
 * @returns A 31-bit number derived from the SHA-256 of `name`.
 */
export function pathHash(name: string): number {
  const bigHash = BigInt.asUintN(
    31,
    BigInt(addHexPrefix(bytesToHex(sha256(name)))),
  )
  return Number(bigHash)
}

/**
 * Derive a StarkNet "spend" private key from BIP-39 mnemonic, using
 * an HD derivation path.  This effectively gives you the primary
 * private key you can use for transactions/ownership (like `x`).
 *
 * @param args - Contains accountIndex, addressIndex, etc.
 * @param mnemonic - BIP-39 phrase ("word word word ...")
 * @returns A 0x‐prefixed hex string of the ground (spend) private key.
 */
export function deriveStarknetPrivateKey(
  args: StarknetDerivationArgs,
  mnemonic: string,
): string {
  const { accountIndex, addressIndex } = args

  // Example derivation path: m/44'/9004'/account'/0/address
  // (since Starknet uses coin_type=9004 typically)
  const path = `m/${StarknetKeyConst.PURPOSE}'/${StarknetKeyConst.STARKNET_COIN_TYPE}'/${accountIndex}'/0/${addressIndex}`

  // Using ethers.HDNodeWallet for the BIP-39 derivation:
  const derivedWallet = ethers.HDNodeWallet.fromPhrase(
    mnemonic,
    undefined,
    path,
  )

  // Now "grind" that private key for StarkNet usage:
  const groundKey = grindKey(derivedWallet.privateKey)

  // getStarkKey(...) from scure returns a **public** key by default.
  // If you only want the private key, just keep `groundKey`.
  // But if you do want a consistent representation that is a "private key"
  // for your usage, you can do:
  return addHexPrefix(groundKey)
}

/**
 * Derive a StarkNet public key from the private key.
 *
 * @param privateKey - a valid, ground StarkNet private key (0x‐prefixed).
 * @returns A 0x‐prefixed hex public key on StarkNet (typically 251 bits).
 */
export function getStarknetPublicKeyFromPrivate(
  privateKey: string,
  compressed = false,
): string {
  // scure/starknet's `getStarkKey()` returns a hex representation
  // of the point's x‐coordinate, but you may also do a full "point".
  if (compressed) {
    //return getStarkKey(privateKey); // for just the x-coordinate
    return getStarkKey(privateKey)
  }
  // Or, for the full public key:
  const pubKeyBytes = ec.starkCurve.getPublicKey(privateKey, false)
  return encode.addHexPrefix(encode.buf2hex(pubKeyBytes))
}

/**
 * Derive a "spend" key pair from a mnemonic phrase.
 */
export function deriveStarknetSpendKeyPair(
  args: StarknetDerivationArgs,
  mnemonic: string,
  compressed = false,
): {
  privateSpendKey: string
  publicSpendKey: string
} {
  const privateKey = deriveStarknetPrivateKey(args, mnemonic)
  const publicKey = getStarknetPublicKeyFromPrivate(privateKey, compressed)
  return {
    privateSpendKey: privateKey,
    publicSpendKey: publicKey,
  }
}

/**
 * Derive a “view” keypair from the spend private key (Monero‐style),
 * i.e. privateViewKey = H(spendKey) mod curve_order
 * and publicViewKey = privateViewKey * G.
 *
 * This ensures the two keys are linked but distinct.
 *
 * @param spendPrivateKey - The main/spend key you got from `deriveStarknetPrivateKey()`.
 * @returns { privateViewKey, publicViewKey } as 0x‐prefixed hex strings
 */
export function deriveStarknetViewKeyPair(
  spendPrivateKey: string,
  compressed = false,
): {
  privateViewKey: string
  publicViewKey: string
} {
  // 1. Compute a 256-bit hash of the spend key. Use starknetKeccak for consistency:
  const spendKeyBN = BigInt(spendPrivateKey) // interpret as BigInt
  // Convert to hex (without "0x" for the hashing step):
  const spendKeyHexNo0x = spendPrivateKey.replace(/^0x/, "").toLowerCase()

  // Hash the *raw hex* of spendKey:
  const hashed = hash.starknetKeccak(spendKeyHexNo0x)

  // 2. Take that BigInt mod Stark curve order:
  const curveOrder = ec.starkCurve.CURVE.n
  const privViewBN = BigInt(hashed) % curveOrder
  const privateViewHex = `0x${privViewBN.toString(16)}`

  // 3. Derive public view key:
  const pubViewBytes = ec.starkCurve.getPublicKey(privateViewHex, false)
  if (compressed) {
    return {
      privateViewKey: privateViewHex,
      publicViewKey: getStarkKey(privateViewHex),
    }
  }
  const publicViewHex = encode.addHexPrefix(encode.buf2hex(pubViewBytes))

  return {
    privateViewKey: privateViewHex,
    publicViewKey: publicViewHex,
  }
}

/**
 * Create spend and view key pairs from a mnemonic phrase.
 */
export function deriveStarknetKeyPairs(
  args: StarknetDerivationArgs,
  mnemonic: string,
  compressed = false,
): StarknetKeyPair {
  const spendingKeyPair = deriveStarknetSpendKeyPair(args, mnemonic, compressed)
  const viewingKeyPair = deriveStarknetViewKeyPair(
    spendingKeyPair.privateSpendKey,
    compressed,
  )
  return {
    spendingKeyPair: {
      privateSpendingKey: spendingKeyPair.privateSpendKey,
      publicSpendingKey: spendingKeyPair.publicSpendKey,
    },
    viewingKeyPair: {
      privateViewingKey: viewingKeyPair.privateViewKey,
      publicViewingKey: viewingKeyPair.publicViewKey,
    },
  }
}
