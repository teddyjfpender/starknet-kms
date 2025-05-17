import { beforeEach, describe, expect, it } from "bun:test"
import { hexToBytes, utf8ToBytes } from "@noble/hashes/utils"
import * as bip32 from "@scure/bip32"
import { mnemonic } from "@starkms/common"
import { getStarkKey } from "micro-starknet"
import {
  type BigNumberish,
  Signer,
  type WeierstrassSignatureType,
  ec,
  encode,
  hash,
  num,
} from "starknet"
import {
  type FromBip39MnemonicWordsProps,
  InMemoryKeyAgent,
} from "../../src/InMemoryKeyAgent"
import {
  type StarknetDerivationArgs,
  StarknetKeyConst,
  deriveStarknetKeyPairs,
  deriveStarknetPrivateKey,
  deriveStarknetViewKeyPair,
  grindKey,
} from "../../src/chains/starknet"
import {
  checkStealthOwnership,
  createStealthOutput,
} from "../../src/chains/starknet/stealth-derivation"
import * as bip39 from "../../src/util/bip39"

// Provide the passphrase for testing purposes
const params = {
  passphrase: "passphrase",
}

const getPassphrase = () => utf8ToBytes(params.passphrase)

/**
 * Mock function: generate a random private key on the Starknet curve.
 * For real usage, you'd call something like:
 *   const aliceSpendKey = deriveStarknetPrivateKey(...);
 */
function generateRandomStarknetPrivKey(): string {
  const raw = new Uint8Array(32)
  crypto.getRandomValues(raw)
  const bn =
    BigInt(`0x${Buffer.from(raw).toString("hex")}`) % ec.starkCurve.CURVE.n
  return encode.addHexPrefix(bn.toString(16))
}

/**
 * From a private key, get the full uncompressed public key.
 * (You could use getStarkKey(...) if you only want the x-coordinate.)
 */
function getFullUncompressedPubkey(starkPrivKey: string): string {
  const pubBytes = ec.starkCurve.getPublicKey(starkPrivKey, false)
  return encode.addHexPrefix(encode.buf2hex(pubBytes))
}

describe("Starknet InMemoryKeyAgent", () => {
  let agent: InMemoryKeyAgent
  let rootKeyBytes: Uint8Array
  let seed: Uint8Array
  let root: bip32.HDKey

  beforeEach(async () => {
    // Create keys for testing purposes
    //bip39.generateMnemonicWords(strength)
    seed = bip39.mnemonicToSeed(mnemonic, "")
    // Create root node from seed
    root = bip32.HDKey.fromMasterSeed(seed)
    // unencrypted root key bytes
    rootKeyBytes = root.privateKey ? root.privateKey : new Uint8Array([])
    // define the agent properties
    //encryptedSeedBytes = await emip3encrypt(seed, passphrase)
    const agentArgs: FromBip39MnemonicWordsProps = {
      getPassphrase: getPassphrase,
      mnemonicWords: mnemonic,
      mnemonic2ndFactorPassphrase: "",
    }
    agent = await InMemoryKeyAgent.fromMnemonicWords(agentArgs)
    // network type
    //networkType = "testnet"
  })

  it("should create an agent with given properties", () => {
    expect(agent).toBeInstanceOf(InMemoryKeyAgent)
  })
  it("should create an agent with given properties and return the getSeralizableData", () => {
    expect(agent).toBeInstanceOf(InMemoryKeyAgent)
    expect(agent.getSeralizableData()).not.toBe(undefined)
  })
  it("should export root private key", async () => {
    const result = await agent.exportRootPrivateKey()
    expect(result).toStrictEqual(rootKeyBytes)
  })
  describe("Derive Keys From Mnemonic", () => {
    it("check test case from private key to expected public key", async () => {
      // defined here https://github.com/starknet-io/starknet.js/blob/0fce61e40535a4f1b3b05fdd9da60f9218250c99/www/versioned_docs/version-5.14.1/guides/connect_account.md?plain=1#L40
      const privateKey = "0xe3e70682c2094cac629f6fbed82c07cd"
      const expectedPublicKey =
        "0x7e52885445756b313ea16849145363ccb73fb4ab0440dbac333cf9d13de82b9"

      const publicKey = ec.starkCurve.getStarkKey(privateKey)
      expect(publicKey).toBe(expectedPublicKey)

      const signer = new Signer(privateKey)
      const signerPublicKey = await signer.getPubKey()
      expect(signerPublicKey).toBe(expectedPublicKey)
    })
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
    it("should derive a private key & viewing key from mnemonic", async () => {
      const args: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }
      const keypairs = deriveStarknetKeyPairs(
        args,
        bip39.joinMnemonicWords(mnemonic),
      )
      expect(keypairs).not.toBe(undefined)
      console.log(keypairs)
    })
    /**
     * This test sets up:
     * - Alice's spend key pair (x, X)
     * - Alice's view key pair  (y, Y)
     * - Bob uses ephemeral scalar r to create stealth output
     * - Alice checks ownership
     */
    it("should let Bob create a stealth address for Alice, which Alice can detect", () => {
      // === 1) Derive/Mock keys for Alice ===

      // Suppose these are generated or derived via your HD logic:
      const aliceSpendPrivKey = generateRandomStarknetPrivKey()
      const aliceSpendPubKey = getFullUncompressedPubkey(aliceSpendPrivKey)

      // In real usage, you'd do something like:
      // const { privateViewKey: aliceViewPrivKey, publicViewKey: aliceViewPubKey }
      //   = deriveStarknetViewKeyPair(aliceSpendPrivKey);
      //
      // But let's mock it for demonstration:
      const aliceViewPrivKey = generateRandomStarknetPrivKey()
      const aliceViewPubKey = getFullUncompressedPubkey(aliceViewPrivKey)

      // === 2) Bob wants to send to Alice. He uses createStealthOutput(...) ===
      const { ephemeralPrivateScalar, ephemeralPublicKey, stealthAddress } =
        createStealthOutput(aliceSpendPubKey, aliceViewPubKey)

      // We confirm Bob got some ephemeral key
      expect(ephemeralPrivateScalar).toMatch(/^0x[0-9a-fA-F]+$/)
      expect(ephemeralPublicKey).toMatch(/^0x04[0-9a-fA-F]+$/) // uncompressed form, 0x04...
      expect(stealthAddress).toMatch(/^0x04[0-9a-fA-F]+$/)

      // === 3) Alice checks ownership ===
      const isOwnedByAlice = checkStealthOwnership(
        aliceViewPrivKey,
        aliceSpendPubKey,
        ephemeralPublicKey,
        stealthAddress,
      )

      expect(isOwnedByAlice).toBe(true)

      // === 4) Negative test: does Bob's view key claim ownership? Should fail ===
      const bobViewKey = generateRandomStarknetPrivKey()
      //const bobViewPubKey = getFullUncompressedPubkey(bobViewKey)

      const isOwnedByBob = checkStealthOwnership(
        bobViewKey,
        aliceSpendPubKey, // intentionally mismatched
        ephemeralPublicKey,
        stealthAddress,
      )
      expect(isOwnedByBob).toBe(false)

      // Logging just for clarity:
      console.log("Alice's spend key (x)    =", aliceSpendPrivKey)
      console.log("Alice's spend pubkey (X) =", aliceSpendPubKey)
      console.log("Alice's view key (y)     =", aliceViewPrivKey)
      console.log("Alice's view pubkey (Y)  =", aliceViewPubKey)
      console.log("Bob ephemeral r          =", ephemeralPrivateScalar)
      console.log("R = r*G                  =", ephemeralPublicKey)
      console.log("Stealth address (P)      =", stealthAddress)
      console.log("Did Alice detect it?     =", isOwnedByAlice)
      console.log("Can Bob claim it?        =", isOwnedByBob)
    })
    it("should correctly create and verify stealth addresses using deterministically derived keys", () => {
      // 1. Derive Alice's spend private key
      const mnemonicPhrase = bip39.joinMnemonicWords(mnemonic) // mnemonic is from beforeEach
      const derivationArgs: StarknetDerivationArgs = {
        accountIndex: 0,
        addressIndex: 0,
      }
      const aliceSpendPrivKey = deriveStarknetPrivateKey(
        derivationArgs,
        mnemonicPhrase,
      )
      const aliceSpendPubKey = getFullUncompressedPubkey(aliceSpendPrivKey)

      // 2. Derive Alice's view key pair from her spend private key
      const {
        privateViewKey: aliceViewPrivKey,
        publicViewKey: _aliceViewPubKeyRaw,
      } = deriveStarknetViewKeyPair(aliceSpendPrivKey)
      // Ensure the public view key is uncompressed for createStealthOutput
      const aliceViewPubKey = getFullUncompressedPubkey(aliceViewPrivKey)

      // 3. Bob (or anyone) creates a stealth output for Alice
      const { ephemeralPublicKey, stealthAddress } = createStealthOutput(
        aliceSpendPubKey,
        aliceViewPubKey,
      )

      expect(ephemeralPublicKey).toMatch(/^0x04[0-9a-fA-F]+$/)
      expect(stealthAddress).toMatch(/^0x04[0-9a-fA-F]+$/)

      // 4. Alice checks ownership using her derived keys
      const isOwnedByAlice = checkStealthOwnership(
        aliceViewPrivKey,
        aliceSpendPubKey,
        ephemeralPublicKey,
        stealthAddress,
      )
      expect(isOwnedByAlice).toBe(true)

      // 5. Negative test: A different derived view key should not claim ownership
      const otherDerivationArgs: StarknetDerivationArgs = {
        accountIndex: 1, // Different account
        addressIndex: 0,
      }
      const otherSpendPrivKey = deriveStarknetPrivateKey(
        otherDerivationArgs,
        mnemonicPhrase,
      )
      const { privateViewKey: otherViewPrivKey } =
        deriveStarknetViewKeyPair(otherSpendPrivKey)

      const isOwnedByOther = checkStealthOwnership(
        otherViewPrivKey, // Different view key
        aliceSpendPubKey, // Alice's spend public key
        ephemeralPublicKey,
        stealthAddress,
      )
      expect(isOwnedByOther).toBe(false)

      // 6. Negative test: A different public spend key should not lead to ownership
      const anotherSpendPrivKey = deriveStarknetPrivateKey(
        { accountIndex: 2, addressIndex: 0 },
        mnemonicPhrase,
      )
      const anotherSpendPubKey = getFullUncompressedPubkey(anotherSpendPrivKey)
      const isOwnedWithWrongSpendPub = checkStealthOwnership(
        aliceViewPrivKey, // Alice's view key
        anotherSpendPubKey, // But someone else's spend public key
        ephemeralPublicKey,
        stealthAddress,
      )
      expect(isOwnedWithWrongSpendPub).toBe(false)
    })
    it("should let Bob create a credential containing his encrypted spending & viewing keys", () => {})
    it("should replicate argent test", async () => {
      //const expectedArgentPublicKey = "6r48ScP828RSUNaJMCrwGJJRErNrD456ouqosfoTMZ1"
      //const expectedArgentPrivateKey = "0x058b04965df26c28c2cc3ed4228ce76ed503f098ee6a773792b623f3a457a164"
      const secret =
        "0xe6904d63affe7a13cd30345b000c9b1ffc087832332d7303cf237ffda8a177d0"
      const hex = encode.removeHexPrefix(num.toHex(secret))
      // Bytes must be a multiple of 2 and defalut is multiple of 8
      // sanitzeHex should not be used because of leading 0x
      const sanitzed = encode.sanitizeBytes(hex, 2)
      const masterNode = bip32.HDKey.fromMasterSeed(hexToBytes(sanitzed))
      const addressIndex = 5
      const path = `m/${StarknetKeyConst.PURPOSE}'/${StarknetKeyConst.STARKNET_COIN_TYPE}'/0'/0/${addressIndex}`
      const childNode = masterNode.derive(path)
      if (!childNode.privateKey) {
        throw "childNode.privateKey is undefined"
      }

      const groundKey = grindKey(childNode.privateKey)
      const pk = encode.sanitizeHex(groundKey)

      const starkKey = encode.sanitizeHex(getStarkKey(pk))
      expect(starkKey).toBe(
        "0x05c7c65bfda7a85af0681c85c9c440f0aa6825feef6f9c96e55fb2ce08c8d4bc",
      )
    })
  })
})
