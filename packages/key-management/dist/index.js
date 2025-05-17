// src/chains/starknet/types.ts
var StarknetKeyConst = /* @__PURE__ */ ((StarknetKeyConst2) => {
  StarknetKeyConst2[StarknetKeyConst2["PURPOSE"] = 44] = "PURPOSE";
  StarknetKeyConst2[StarknetKeyConst2["STARKNET_COIN_TYPE"] = 9004] = "STARKNET_COIN_TYPE";
  return StarknetKeyConst2;
})(StarknetKeyConst || {});

// ../../node_modules/@noble/curves/esm/abstract/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes(item) {
  if (!isBytes(item))
    throw new Error("Uint8Array expected");
}
var hasHexBuiltin = (
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
);
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}

// src/chains/starknet/key-derivation.ts
import { sha256 } from "@noble/hashes/sha256";
import { getStarkKey, grindKey as microGrindKey } from "@scure/starknet";
import { ethers } from "ethers";
import { ec, encode, hash } from "starknet";
var { addHexPrefix } = encode;
function grindKey(privateKey) {
  return addHexPrefix(microGrindKey(privateKey));
}
function pathHash(name) {
  const bigHash = BigInt.asUintN(
    31,
    BigInt(addHexPrefix(bytesToHex(sha256(name))))
  );
  return Number(bigHash);
}
function deriveStarknetPrivateKey(args, mnemonic) {
  const { accountIndex, addressIndex } = args;
  const path = `m/${44 /* PURPOSE */}'/${9004 /* STARKNET_COIN_TYPE */}'/${accountIndex}'/0/${addressIndex}`;
  const derivedWallet = ethers.HDNodeWallet.fromPhrase(
    mnemonic,
    void 0,
    path
  );
  const groundKey = grindKey(derivedWallet.privateKey);
  return addHexPrefix(groundKey);
}
function getStarknetPublicKeyFromPrivate(privateKey, compressed = false) {
  if (compressed) {
    return getStarkKey(privateKey);
  }
  const pubKeyBytes = ec.starkCurve.getPublicKey(privateKey, false);
  return encode.addHexPrefix(encode.buf2hex(pubKeyBytes));
}
function deriveStarknetSpendKeyPair(args, mnemonic, compressed = false) {
  const privateKey = deriveStarknetPrivateKey(args, mnemonic);
  const publicKey = getStarknetPublicKeyFromPrivate(privateKey, compressed);
  return {
    privateSpendKey: privateKey,
    publicSpendKey: publicKey
  };
}
function deriveStarknetViewKeyPair(spendPrivateKey, compressed = false) {
  const spendKeyHexNo0x = spendPrivateKey.replace(/^0x/, "").toLowerCase();
  const hashed = hash.starknetKeccak(spendKeyHexNo0x);
  const curveOrder = ec.starkCurve.CURVE.n;
  const privViewBN = BigInt(hashed) % curveOrder;
  const privateViewHex = `0x${privViewBN.toString(16)}`;
  const pubViewBytes = ec.starkCurve.getPublicKey(privateViewHex, false);
  if (compressed) {
    return {
      privateViewKey: privateViewHex,
      publicViewKey: getStarkKey(privateViewHex)
    };
  }
  const publicViewHex = encode.addHexPrefix(encode.buf2hex(pubViewBytes));
  return {
    privateViewKey: privateViewHex,
    publicViewKey: publicViewHex
  };
}
function deriveStarknetKeyPairs(args, mnemonic, compressed = false) {
  const spendingKeyPair = deriveStarknetSpendKeyPair(args, mnemonic, compressed);
  const viewingKeyPair = deriveStarknetViewKeyPair(
    spendingKeyPair.privateSpendKey,
    compressed
  );
  return {
    spendingKeyPair: {
      privateSpendingKey: spendingKeyPair.privateSpendKey,
      publicSpendingKey: spendingKeyPair.publicSpendKey
    },
    viewingKeyPair: {
      privateViewingKey: viewingKeyPair.privateViewKey,
      publicViewingKey: viewingKeyPair.publicViewKey
    }
  };
}

// src/errors/AuthenticationError.ts
import { CustomError } from "ts-custom-error";
var formatMessage = (detail) => {
  const messageDetail = detail ? `: ${detail}` : "";
  return `Authentication failure${messageDetail}`;
};
var formatErrorMessage = (reason, detail) => reason + (detail ? ` (${detail})` : "");
var isWithInnerError = (error) => error !== null && typeof error === "object" && "innerError" in error;
var isErrorLike = (error) => {
  if (!error || typeof error !== "object" || !("message" in error && "stack" in error))
    return false;
  const { message, stack } = error;
  return typeof message === "string" && typeof stack === "string";
};
var stripStackTrace = (error) => {
  if (!error) return;
  if (isErrorLike(error)) {
    ;
    error.stack = "";
  }
  if (isWithInnerError(error)) {
    stripStackTrace(error.innerError);
  }
};
var ComposableError = class _ComposableError extends CustomError {
  constructor(message, innerError) {
    let firstLineOfInnerErrorStack = "";
    let innerErrorStack = [];
    if (isErrorLike(innerError) && innerError.stack) {
      const innerErrorStackPieces = innerError.stack.split(
        _ComposableError.stackDelimiter
      );
      firstLineOfInnerErrorStack = innerErrorStackPieces.shift() || "";
      innerErrorStack = innerErrorStackPieces;
      message = `${message} due to
 ${firstLineOfInnerErrorStack}`;
    }
    if (typeof innerError === "string")
      message = `${message} due to
 ${innerError}`;
    super(message);
    this.innerError = innerError;
    if (!this.stack || innerErrorStack.length === 0) return;
    const [firstLineOfStack] = this.stack.split(_ComposableError.stackDelimiter);
    Object.defineProperty(this, "stack", {
      configurable: true,
      value: `${firstLineOfStack}${innerErrorStack.join(
        _ComposableError.stackDelimiter
      )}`
    });
  }
  static stackDelimiter = "\n    at ";
};
var InvalidStringError = class extends ComposableError {
  constructor(expectation, innerError) {
    super(`Invalid string: "${expectation}"`, innerError);
  }
};
var InvalidArgumentError = class extends CustomError {
  /**
   * Initializes a new instance of the InvalidArgumentError class.
   *
   * @param argName The invalid argument name.
   * @param message The error message.
   */
  constructor(argName, message) {
    super(`Invalid argument '${argName}': ${message}`);
  }
};
var InvalidStateError = class extends CustomError {
  /**
   * Initializes a new instance of the InvalidStateError class.
   *
   * @param message The error message.
   */
  constructor(message) {
    super(`Invalid state': ${message}`);
  }
};
var AuthenticationError = class extends ComposableError {
  constructor(detail, innerError) {
    super(formatMessage(detail), innerError);
  }
};

// src/errors/InvalidMnemonicError.ts
import { CustomError as CustomError2 } from "ts-custom-error";
var InvalidMnemonicError = class extends CustomError2 {
  constructor() {
    super("Invalid Mnemonic");
  }
};

// src/errors/TxSigningError.ts
function getRealErrorMsg(err) {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return String(err);
}

// src/InMemoryKeyAgent.ts
import { wordlist as wordlist2 } from "@scure/bip39/wordlists/english";

// src/KeyAgentBase.ts
import { HDKey } from "@scure/bip32";
import { bytesToUtf8 } from "@noble/ciphers/utils";
import { utf8ToBytes } from "@noble/hashes/utils";

// src/emip3.ts
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/ciphers/webcrypto";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { sha512 } from "@noble/hashes/sha512";
import { concatBytes } from "@noble/hashes/utils";
var KEY_LENGTH = 32;
var NONCE_LENGTH = 12;
var PBKDF2_ITERATIONS = 21e4;
var SALT_LENGTH = 32;
var createPbkdf2Key = async (passphrase, salt) => {
  const saltAsUint8Array = new Uint8Array(salt);
  const derivedKey = await pbkdf2Async(sha512, passphrase, saltAsUint8Array, {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_LENGTH
  });
  return derivedKey;
};
var emip3encrypt = async (data, passphrase) => {
  const salt = randomBytes(SALT_LENGTH);
  const key = await createPbkdf2Key(passphrase, salt);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = chacha20poly1305(key, nonce);
  const encrypted = cipher.encrypt(data);
  return concatBytes(salt, nonce, encrypted);
};
var emip3decrypt = async (encrypted, passphrase) => {
  const salt = encrypted.slice(0, SALT_LENGTH);
  const nonce = encrypted.slice(SALT_LENGTH, SALT_LENGTH + NONCE_LENGTH);
  const data = encrypted.slice(SALT_LENGTH + NONCE_LENGTH);
  const key = await createPbkdf2Key(passphrase, salt);
  const decipher = chacha20poly1305(key, nonce);
  return decipher.decrypt(data);
};

// src/KeyDecryptor.ts
var KeyDecryptor = class {
  #getPassphrase;
  constructor(getPassphrase) {
    this.#getPassphrase = getPassphrase;
  }
  async decryptChildPrivateKey(encryptedPrivateKeyBytes, noCache) {
    const passphrase = this.#getPassphrase(noCache);
    let decryptedKeyBytes;
    try {
      decryptedKeyBytes = await emip3decrypt(
        encryptedPrivateKeyBytes,
        passphrase
      );
    } catch (error) {
      throw new AuthenticationError(
        "Failed to decrypt child private key",
        error
      );
    }
    return decryptedKeyBytes;
  }
  decryptSeedBytes(serializableData, noCache) {
    return this.decryptSeed(
      "encryptedSeedBytes",
      serializableData,
      "Failed to decrypt seed bytes",
      noCache
    );
  }
  async decryptSeed(keyPropertyName, serializableData, errorMessage, noCache) {
    const passphrase = this.#getPassphrase(noCache);
    let decryptedKeyBytes;
    try {
      decryptedKeyBytes = await emip3decrypt(
        new Uint8Array(serializableData[keyPropertyName]),
        passphrase
      );
    } catch (error) {
      throw new AuthenticationError(errorMessage, error);
    }
    return decryptedKeyBytes;
  }
};

// src/chains/starknet/credential-derivation.ts
function deriveCredential(args, spendingPublicKey, spendingKeyEncryptedPrivateKeyBytes, viewingPublicKey, viewingKeyEncryptedPrivateKeyBytes) {
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
      encryptedPrivateKeyBytes: spendingKeyEncryptedPrivateKeyBytes
    },
    viewingKey: {
      publicViewingKey: viewingPublicKey,
      encryptedPrivateKeyBytes: viewingKeyEncryptedPrivateKeyBytes
    }
  };
}

// src/chains/starknet/signing-operations.ts
import {
  Signer
} from "starknet";
async function SigningOperations(args, privateKey, payload) {
  const signer = new Signer(privateKey);
  try {
    let signature;
    switch (args.operation) {
      /**
       * sign_message => expects `payload` to be TypedData.
       * The starknet-js Signer also needs an `accountAddress`.
       */
      case "sign_message": {
        if (!args.accountAddress) {
          throw new Error(
            "Missing 'accountAddress' for 'sign_message' operation."
          );
        }
        signature = await signer.signMessage(
          payload,
          args.accountAddress
        );
        break;
      }
      /**
       * sign_transaction => expects `payload` to be Call[]
       * (an array of calls) and `args.transactionDetails`
       * to be an object like `InvocationsSignerDetails`.
       */
      case "sign_transaction": {
        if (!Array.isArray(payload)) {
          throw new Error(
            "For 'sign_transaction', payload must be an array of Calls."
          );
        }
        if (!args.transactionDetails) {
          throw new Error(
            "Missing 'transactionDetails' for 'sign_transaction' operation."
          );
        }
        signature = await signer.signTransaction(
          payload,
          args.transactionDetails
        );
        break;
      }
      /**
       * sign_deploy_account => expects `payload` to be DeployAccountSignerDetails
       */
      case "sign_deploy_account": {
        signature = await signer.signDeployAccountTransaction(
          payload
        );
        break;
      }
      /**
       * sign_declare => expects `payload` to be DeclareSignerDetails
       */
      case "sign_declare": {
        signature = await signer.signDeclareTransaction(
          payload
        );
        break;
      }
      /**
       * sign_raw => expects `payload` to be a string (the msgHash to sign)
       * this is a protected method in starknet-js, so we need to use a different approach
       */
      /*case "sign_raw": {
        if (typeof payload !== "string") {
          throw new Error("For 'sign_raw', payload must be a string msgHash.")
        }
        signature = await signer.signRaw(payload)
        // (signRaw is protected in source, but if you've exposed it or
        //  changed your local Signer to be public, you can call it.
        //  Otherwise you might replicate signRaw(...) logic manually.)
        break
      }*/
      default: {
        throw new Error(`Unsupported private key operation: ${args.operation}`);
      }
    }
    return signature;
  } catch (err) {
    const errorMessage = getRealErrorMsg(err) || "Signing action failed.";
    throw new Error(errorMessage);
  }
}

// src/chains/starknet/stealth-derivation.ts
import { randomBytes as randomBytes2 } from "node:crypto";
import { ec as ec2, encode as encode2, hash as hash2, num } from "starknet";
function generateEphemeralScalar() {
  const raw = randomBytes2(32);
  const curveOrder = ec2.starkCurve.CURVE.n;
  return BigInt(`0x${bytesToHex(Uint8Array.from(raw))}`) % curveOrder;
}
function createStealthOutput(recipientPubSpendKey, recipientPubViewKey) {
  const r = generateEphemeralScalar();
  const R = ec2.starkCurve.getPublicKey(num.toHex(r), false);
  const Rhex = encode2.buf2hex(R);
  const Ypoint = ec2.starkCurve.ProjectivePoint.fromHex(
    recipientPubViewKey.replace(/^0x/, "")
  );
  const rTimesY = Ypoint.multiply(r);
  const kBigInt = hash2.starknetKeccak(encode2.buf2hex(rTimesY.toRawBytes(true)));
  const kMod = BigInt(kBigInt) % ec2.starkCurve.CURVE.n;
  const Xpoint = ec2.starkCurve.ProjectivePoint.fromHex(
    recipientPubSpendKey.replace(/^0x/, "")
  );
  const stealthPoint = ec2.starkCurve.ProjectivePoint.BASE.multiply(kMod).add(Xpoint);
  const stealthHex = encode2.buf2hex(stealthPoint.toRawBytes(false));
  return {
    ephemeralPrivateScalar: `0x${r.toString(16)}`,
    ephemeralPublicKey: encode2.addHexPrefix(Rhex),
    stealthAddress: encode2.addHexPrefix(stealthHex)
  };
}
function checkStealthOwnership(recipientPrivateViewKey, recipientPublicSpendKey, ephemeralPublicKey, stealthAddress) {
  const Rpoint = ec2.starkCurve.ProjectivePoint.fromHex(
    ephemeralPublicKey.replace(/^0x/, "")
  );
  const yBN = BigInt(recipientPrivateViewKey);
  const yTimesR = Rpoint.multiply(yBN);
  const kPrimeBigInt = hash2.starknetKeccak(
    encode2.buf2hex(yTimesR.toRawBytes(true))
  );
  const kPrime = BigInt(kPrimeBigInt) % ec2.starkCurve.CURVE.n;
  const Xpoint = ec2.starkCurve.ProjectivePoint.fromHex(
    recipientPublicSpendKey.replace(/^0x/, "")
  );
  const computedStealthPoint = ec2.starkCurve.ProjectivePoint.BASE.multiply(kPrime).add(Xpoint);
  const computedStealthHex = encode2.buf2hex(
    computedStealthPoint.toRawBytes(false)
  );
  return stealthAddress.toLowerCase() === `0x${computedStealthHex}`.toLowerCase();
}

// src/KeyAgentBase.ts
var KeyAgentBase = class {
  serializableData;
  keyDecryptor;
  mnemonic;
  get knownCredentials() {
    return this.serializableData.credentialSubject.contents;
  }
  set knownCredentials(credentials) {
    this.serializableData.credentialSubject.contents = credentials;
  }
  constructor(serializableData, getPassphrase, mnemonic) {
    this.serializableData = serializableData;
    this.mnemonic = mnemonic;
    this.keyDecryptor = new KeyDecryptor(getPassphrase);
  }
  async decryptSeed() {
    try {
      return await this.keyDecryptor.decryptSeedBytes(this.serializableData);
    } catch (error) {
      throw new Error(`Failed to decrypt root private key: ${error}`);
    }
  }
  async exportRootPrivateKey() {
    try {
      const decryptedSeedBytes = await this.decryptSeed();
      const rootKey = HDKey.fromMasterSeed(decryptedSeedBytes);
      return rootKey.privateKey ? rootKey.privateKey : new Uint8Array([]);
    } catch (error) {
      throw new AuthenticationError(
        "Failed to export root private key",
        error
      );
    }
  }
  async deriveCredentials(args, getPassphrase, pure) {
    const passphrase = getPassphrase();
    const knownCredential = this.serializableData.credentialSubject.contents.find(
      (cred) => cred.accountIndex === args.accountIndex
    );
    if (knownCredential) {
      console.log("found a known credential", knownCredential);
      return knownCredential;
    }
    const derivedKeyPairs = await this.deriveKeyPair(args, passphrase);
    try {
      const groupedCredential = deriveCredential(
        args,
        derivedKeyPairs.spendingKeyPair.publicSpendingKey,
        derivedKeyPairs.spendingKeyPair.encryptedPrivateKeyBytes,
        derivedKeyPairs.viewingKeyPair.publicViewingKey,
        derivedKeyPairs.viewingKeyPair.encryptedPrivateKeyBytes
      );
      if (!pure) {
        this.serializableData.credentialSubject.contents = [
          ...this.serializableData.credentialSubject.contents,
          groupedCredential
        ];
      }
      return groupedCredential;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  async deriveKeyPair(args, passphrase) {
    let keypairs;
    keypairs = this.#generateKeyPairsFromSeed(args);
    if (!keypairs || typeof keypairs !== "object" || !("spendingKeyPair" in keypairs) || !("viewingKeyPair" in keypairs)) {
      throw new Error("Failed to generate key pairs");
    }
    const encoder = new TextEncoder();
    const encryptedSpendingKeyPrivateKeyBytes = await emip3encrypt(
      encoder.encode(keypairs.spendingKeyPair.privateSpendingKey),
      passphrase
    );
    const encryptedViewingKeyPrivateKeyBytes = await emip3encrypt(
      encoder.encode(keypairs.viewingKeyPair.privateViewingKey),
      passphrase
    );
    try {
      const keyPairs = {
        spendingKeyPair: {
          publicSpendingKey: keypairs.spendingKeyPair.publicSpendingKey,
          encryptedPrivateKeyBytes: encryptedSpendingKeyPrivateKeyBytes
        },
        viewingKeyPair: {
          publicViewingKey: keypairs.viewingKeyPair.publicViewingKey,
          encryptedPrivateKeyBytes: encryptedViewingKeyPrivateKeyBytes
        }
      };
      keypairs = utf8ToBytes("0".repeat(50));
      keypairs = null;
      return keyPairs;
    } catch (error) {
      if (keypairs) {
        keypairs = utf8ToBytes("0".repeat(50));
        keypairs = null;
      }
      console.error(error);
      throw error;
    }
  }
  deriveStealthAddress(recipientPublicKeys) {
    return createStealthOutput(
      recipientPublicKeys.recipientPubSpendKey,
      recipientPublicKeys.recipientPubViewKey
    );
  }
  async stealthOwnershipCheck(ephemeralPublicKey, stealthAddress, groupedCredential) {
    const viewingKeyBytes = new Uint8Array(
      groupedCredential.viewingKey.encryptedPrivateKeyBytes
    );
    const decryptedPrivateViewKeyBytes = await this.keyDecryptor.decryptChildPrivateKey(viewingKeyBytes);
    const privateViewKey = bytesToUtf8(decryptedPrivateViewKeyBytes);
    const publicSpendKey = groupedCredential.spendingKey.publicSpendingKey;
    const formattedPrivateViewKey = privateViewKey.startsWith("0x") ? privateViewKey : `0x${privateViewKey}`;
    const formattedPublicSpendKey = publicSpendKey.startsWith("0x") ? publicSpendKey : `0x${publicSpendKey}`;
    return checkStealthOwnership(
      formattedPrivateViewKey,
      // recipientPrivateViewKey (hex)
      formattedPublicSpendKey,
      // recipientPublicSpendKey (hex)
      ephemeralPublicKey,
      // ephemeralPublicKey (hex)
      stealthAddress
      // stealthAddress (hex)
    );
  }
  async sign(payload, signable, args) {
    const decryptedKeyBytes = await this.keyDecryptor.decryptChildPrivateKey(
      new Uint8Array(
        Object.values(payload.spendingKey.encryptedPrivateKeyBytes)
      )
    );
    const privateKey = bytesToUtf8(decryptedKeyBytes);
    let result;
    try {
      result = SigningOperations(args, privateKey, signable);
    } catch (error) {
      console.error(error);
      throw error;
    }
    return result;
  }
  #generateKeyPairsFromSeed(args) {
    return deriveStarknetKeyPairs(args, this.mnemonic, false);
  }
};

// src/types.ts
var KeyAgentType = /* @__PURE__ */ ((KeyAgentType2) => {
  KeyAgentType2["InMemory"] = "InMemory";
  KeyAgentType2["Session"] = "Sesssion";
  KeyAgentType2["Ledger"] = "Ledger";
  return KeyAgentType2;
})(KeyAgentType || {});
var PathLevelIndexes = /* @__PURE__ */ ((PathLevelIndexes2) => {
  PathLevelIndexes2[PathLevelIndexes2["PURPOSE"] = 0] = "PURPOSE";
  PathLevelIndexes2[PathLevelIndexes2["COIN_TYPE"] = 1] = "COIN_TYPE";
  PathLevelIndexes2[PathLevelIndexes2["ACCOUNT"] = 2] = "ACCOUNT";
  PathLevelIndexes2[PathLevelIndexes2["CHANGE"] = 3] = "CHANGE";
  PathLevelIndexes2[PathLevelIndexes2["INDEX"] = 4] = "INDEX";
  return PathLevelIndexes2;
})(PathLevelIndexes || {});

// src/util/bip39.ts
import * as bip39 from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
var mnemonicToWords = (mnemonic) => mnemonic.split(" ");
var generateMnemonicWords = (strength = 256) => mnemonicToWords(bip39.generateMnemonic(wordlist, strength));
var joinMnemonicWords = (mnenomic) => mnenomic.join(" ");
var entropyToMnemonicWords = (entropy) => mnemonicToWords(bip39.entropyToMnemonic(entropy, wordlist));
var mnemonicWordsToEntropy = (mnenonic) => bip39.mnemonicToEntropy(joinMnemonicWords(mnenonic), wordlist);
var mnemonicToSeed = (mnemonic, passphrase) => bip39.mnemonicToSeedSync(joinMnemonicWords(mnemonic), passphrase);
var mnemonicToSeedSync2 = (mnemonic, passphrase) => bip39.mnemonicToSeedSync(mnemonic, passphrase);
var validateMnemonic2 = bip39.validateMnemonic;
var entropyToSeed = (entropy, passphrase) => {
  const mnemonicWords = entropyToMnemonicWords(entropy);
  const seed = mnemonicToSeed(mnemonicWords, passphrase);
  return seed;
};
var mnemonicWordsToEncryptedSeed = async (mnemonicWords, passphrase, mnemonic2ndFactorPassphrase) => {
  const seed = mnemonicToSeed(mnemonicWords, mnemonic2ndFactorPassphrase);
  const encryptedSeed = await emip3encrypt(seed, passphrase);
  return encryptedSeed;
};

// src/InMemoryKeyAgent.ts
var InMemoryKeyAgent = class _InMemoryKeyAgent extends KeyAgentBase {
  static async fromMnemonicWords({
    getPassphrase,
    mnemonicWords,
    mnemonic2ndFactorPassphrase = ""
  }) {
    const mnemonic = joinMnemonicWords(mnemonicWords);
    const validMnemonic = validateMnemonic2(mnemonic, wordlist2);
    if (!validMnemonic) throw new InvalidMnemonicError();
    const passphrase = getPassphrase();
    const encryptedSeedBytes = await mnemonicWordsToEncryptedSeed(
      mnemonicWords,
      passphrase,
      mnemonic2ndFactorPassphrase
    );
    return new _InMemoryKeyAgent({
      encryptedSeedBytes,
      type: [],
      // to rename
      id: "",
      issuer: "",
      issuanceDate: "",
      credentialSubject: {
        id: "",
        contents: []
      },
      getPassphrase,
      mnemonic
    });
  }
  constructor({
    getPassphrase,
    mnemonic,
    ...serializableData
  }) {
    super(
      { ...serializableData, __typename: "InMemory" /* InMemory */ },
      getPassphrase,
      mnemonic
    );
  }
  async restoreKeyAgent(args, getPassphrase) {
    await this.deriveCredentials(args, getPassphrase, false);
    return this;
  }
  getSeralizableData() {
    return {
      ...this.serializableData
    };
  }
};
export {
  AuthenticationError,
  ComposableError,
  InMemoryKeyAgent,
  InvalidArgumentError,
  InvalidMnemonicError,
  InvalidStateError,
  InvalidStringError,
  KeyAgentBase,
  KeyAgentType,
  KeyDecryptor,
  PathLevelIndexes,
  StarknetKeyConst,
  deriveStarknetKeyPairs,
  deriveStarknetPrivateKey,
  deriveStarknetSpendKeyPair,
  deriveStarknetViewKeyPair,
  entropyToMnemonicWords,
  entropyToSeed,
  formatErrorMessage,
  generateMnemonicWords,
  getRealErrorMsg,
  getStarknetPublicKeyFromPrivate,
  grindKey,
  joinMnemonicWords,
  mnemonicToSeed,
  mnemonicToSeedSync2 as mnemonicToSeedSync,
  mnemonicToWords,
  mnemonicWordsToEncryptedSeed,
  mnemonicWordsToEntropy,
  pathHash,
  stripStackTrace,
  validateMnemonic2 as validateMnemonic,
  wordlist
};
/*! Bundled license information:

@noble/curves/esm/abstract/utils.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
//# sourceMappingURL=index.js.map