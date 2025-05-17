import { TypedData, Call, DeployAccountSignerDetails, Signature } from 'starknet';
import { Hex } from '@noble/curves/abstract/utils';
import { CustomError } from 'ts-custom-error';
import * as bip39 from '@scure/bip39';
export { wordlist } from '@scure/bip39/wordlists/english';

type StarknetDerivationArgs = {
    accountIndex: number;
    addressIndex: number;
};
type StarknetKeyPair = {
    spendingKeyPair: {
        privateSpendingKey: string;
        publicSpendingKey: string;
    };
    viewingKeyPair: {
        privateViewingKey: string;
        publicViewingKey: string;
    };
};
declare enum StarknetKeyConst {
    /**
     * Constant value used for defining the purpose in a BIP44 path
     */
    PURPOSE = 44,
    /**
     * COIN_TYPE value for Starknet
     */
    STARKNET_COIN_TYPE = 9004
}
type StarknetGroupedCredentials = {
    "@context": ["https://w3id.org/wallet/v1"];
    id: string;
    type: "Starknet";
    controller: string;
    name: string;
    description: string;
    addressIndex: number;
    accountIndex: number;
    spendingKey: {
        publicSpendingKey: string;
        encryptedPrivateKeyBytes: Uint8Array;
    };
    viewingKey: {
        publicViewingKey: string;
        encryptedPrivateKeyBytes: Uint8Array;
    };
};
type SignablePayload = string | Uint8Array | TypedData | Call[] | DeployAccountSignerDetails;
type SignatureResult = Signature;

/**
 * Grinds a private key to a valid Starknet private key.
 *
 * Starknet requires private keys to be < curve order, so we "grind"
 * the raw 256-bit key space down to the valid range. The scure/starknet
 * library handles that with `grindKey`.
 *
 * @param privateKey - A 0x‐prefixed hex string (or hex without prefix).
 * @returns A 0x‐prefixed hex string suitable for Starknet usage.
 */
declare function grindKey(privateKey: Hex): string;
/**
 * Creates a canonical integer from a name by hashing and truncating.
 * (Example utility that might be used to customize derivation paths, etc.)
 *
 * @param name - Some string (e.g. "myaccount", "myviewkey", etc.)
 * @returns A 31-bit number derived from the SHA-256 of `name`.
 */
declare function pathHash(name: string): number;
/**
 * Derive a Starknet "spend" private key from BIP-39 mnemonic, using
 * an HD derivation path.  This effectively gives you the primary
 * private key you can use for transactions/ownership (like `x`).
 *
 * @param args - Contains accountIndex, addressIndex, etc.
 * @param mnemonic - BIP-39 phrase ("word word word ...")
 * @returns A 0x‐prefixed hex string of the ground (spend) private key.
 */
declare function deriveStarknetPrivateKey(args: StarknetDerivationArgs, mnemonic: string): string;
/**
 * Derive a Starknet public key from the private key.
 *
 * @param privateKey - a valid, ground Starknet private key (0x‐prefixed).
 * @returns A 0x‐prefixed hex public key on Starknet (typically 251 bits).
 */
declare function getStarknetPublicKeyFromPrivate(privateKey: string, compressed?: boolean): string;
/**
 * Derive a "spend" key pair from a mnemonic phrase.
 */
declare function deriveStarknetSpendKeyPair(args: StarknetDerivationArgs, mnemonic: string, compressed?: boolean): {
    privateSpendKey: string;
    publicSpendKey: string;
};
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
declare function deriveStarknetViewKeyPair(spendPrivateKey: string, compressed?: boolean): {
    privateViewKey: string;
    publicViewKey: string;
};
/**
 * Create spend and view key pairs from a mnemonic phrase.
 */
declare function deriveStarknetKeyPairs(args: StarknetDerivationArgs, mnemonic: string, compressed?: boolean): StarknetKeyPair;

declare const formatErrorMessage: (reason: string, detail?: string) => string;
/**
 * Strips the stack trace of all errors and their inner errors recursively.
 *
 * @param error The error to be stripped of its stack trace.
 */
declare const stripStackTrace: (error: unknown) => void;
declare class ComposableError<InnerError = unknown> extends CustomError {
    innerError?: InnerError | undefined;
    private static stackDelimiter;
    constructor(message: string, innerError?: InnerError | undefined);
}
declare class InvalidStringError<InnerError = unknown> extends ComposableError<InnerError> {
    constructor(expectation: string, innerError?: InnerError);
}
/**
 * Represents an error that is thrown when a function is called with an invalid argument.
 */
declare class InvalidArgumentError extends CustomError {
    /**
     * Initializes a new instance of the InvalidArgumentError class.
     *
     * @param argName The invalid argument name.
     * @param message The error message.
     */
    constructor(argName: string, message: string);
}
/**
 * The error that is thrown when a method call is invalid for the object's current state.
 *
 * This error can be used in cases when the failure to invoke a method is caused by reasons
 * other than invalid arguments.
 */
declare class InvalidStateError extends CustomError {
    /**
     * Initializes a new instance of the InvalidStateError class.
     *
     * @param message The error message.
     */
    constructor(message: string);
}
declare class AuthenticationError<InnerError = unknown> extends ComposableError<InnerError> {
    constructor(detail?: string, innerError?: InnerError);
}

declare class InvalidMnemonicError extends CustomError {
    constructor();
}

declare function getRealErrorMsg(err: unknown): string | undefined;

type PayloadTypes = "transaction" | "message" | "fields";
interface Result<T> {
    success: boolean;
    data?: T;
    error?: string;
}
type EncryptedKeyPropertyName = "encryptedSeedBytes";
declare enum KeyAgentType {
    InMemory = "InMemory",
    Session = "Sesssion",
    Ledger = "Ledger"
}
interface SerializableInMemoryKeyAgentData {
    __typename: KeyAgentType.InMemory;
    encryptedSeedBytes: Uint8Array;
    type: string[];
    id: string;
    issuer: string;
    issuanceDate: string;
    credentialSubject: {
        id: string;
        contents: GroupedCredentials[];
    };
}
type SerializableKeyAgentData = SerializableInMemoryKeyAgentData;
type SerializableSessionKeyAgentData = {
    __typename: KeyAgentType.Session;
    type: string[];
    id: string;
    issuer: string;
    issuanceDate: string;
    credentialSubject: {
        id: string;
        contents: GroupedCredentials[];
    };
};
type GroupedCredentials = StarknetGroupedCredentials;
type CredentialMatcher<T extends ChainDerivationArgs> = (credential: GroupedCredentials, args: T) => boolean;
interface KeyPairDerivationOperations<T> {
    derivePublicKey: (privateKey: Uint8Array) => Promise<string>;
    derivePrivateKey: (decryptedSeedBytes: Uint8Array, args: T) => Promise<Uint8Array>;
}
type ChainAddress = string;
/**
 * @returns passphrase used to decrypt private keys
 */
type GetPassphrase = (noCache?: boolean) => Uint8Array;
interface AccountKeyDerivationPath {
    account_ix: number;
}
interface AddressKeyDerivationPath {
    address_ix: number;
}
type RecipientPublicKeys = {
    recipientPubSpendKey: string;
    recipientPubViewKey: string;
};
type StealthAddress = {
    ephemeralPublicKey: string;
    stealthAddress: string;
};
interface KeyAgent {
    get serializableData(): SerializableKeyAgentData;
    get knownCredentials(): GroupedCredentials[];
    set knownCredentials(credentials: GroupedCredentials[]);
    /**
     * generic sign
     */
    sign<T extends GroupedCredentials>(payload: T, signable: ChainSignablePayload, args: ChainOperationArgs, getPassphrase: GetPassphrase): Promise<ChainSignatureResult>;
    deriveKeyPair(args: ChainDerivationArgs, passphrase: Uint8Array): Promise<ChainKeyPair>;
    deriveCredentials(args: ChainDerivationArgs, getPassphrase: GetPassphrase, pure?: boolean): Promise<GroupedCredentials>;
    deriveStealthAddress(recipientPublicKeys: RecipientPublicKeys): StealthAddress;
    stealthOwnershipCheck(ephemeralPublicKey: string, stealthAddress: string, groupedCredential: GroupedCredentials): Promise<boolean>;
    exportRootPrivateKey(getPassphrase: GetPassphrase): Promise<Uint8Array>;
    decryptSeed(getPassphrase: GetPassphrase): Promise<Uint8Array>;
}
type ChainDerivationArgs = StarknetDerivationArgs;
/**
 * Arguments indicating which operation we want to perform, plus any
 * special fields needed. For example, `sign_message` needs an
 * `accountAddress`; `sign_transaction` needs invocation details, etc.
 */
type ChainOperationArgs = {
    operation: "sign_message" | "sign_transaction" | "sign_deploy_account" | "sign_declare" | "sign_raw";
    /**
     * The Starknet account address used by `signMessage()`.
     * Not always needed for other operations, so it's optional.
     */
    accountAddress?: string;
    /**
     * Additional details for transaction signing, declare, etc.
     * For example, if you want to call `signTransaction(...)`,
     * you can store an object of type `InvocationsSignerDetails` here.
     */
    transactionDetails?: any;
};
interface ChainSpecificPayload {
    network: any;
    derivePublicKey(privateKey: ChainPrivateKey, args: ChainDerivationArgs): Promise<ChainPublicKey>;
    derivePrivateKey(decryptedSeedBytes: Uint8Array, args: ChainDerivationArgs): Promise<ChainPrivateKey>;
}
type ChainPublicKey = string;
type ChainSignatureResult = SignatureResult;
type ChainPrivateKey = Uint8Array;
type ChainKeyPair = {
    spendingKeyPair: {
        publicSpendingKey: string;
        encryptedPrivateKeyBytes: Uint8Array;
    };
    viewingKeyPair: {
        publicViewingKey: string;
        encryptedPrivateKeyBytes: Uint8Array;
    };
};
type ChainSigningFunction = (args: ChainOperationArgs, // TODO: chain
privateKey: ChainPrivateKey) => Promise<ChainSignatureResult>;
type ChainSignablePayload = SignablePayload;
declare enum PathLevelIndexes {
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
    INDEX = 4
}

declare abstract class KeyAgentBase implements KeyAgent {
    #private;
    readonly serializableData: SerializableKeyAgentData;
    private keyDecryptor;
    private mnemonic;
    get knownCredentials(): GroupedCredentials[];
    set knownCredentials(credentials: GroupedCredentials[]);
    constructor(serializableData: SerializableKeyAgentData, getPassphrase: GetPassphrase, mnemonic: string);
    decryptSeed(): Promise<Uint8Array>;
    exportRootPrivateKey(): Promise<Uint8Array>;
    deriveCredentials(args: ChainDerivationArgs, getPassphrase: GetPassphrase, pure?: boolean): Promise<GroupedCredentials>;
    deriveKeyPair(args: ChainDerivationArgs, passphrase: Uint8Array): Promise<ChainKeyPair>;
    deriveStealthAddress(recipientPublicKeys: RecipientPublicKeys): StealthAddress;
    stealthOwnershipCheck(ephemeralPublicKey: string, stealthAddress: string, groupedCredential: GroupedCredentials): Promise<boolean>;
    sign<T extends GroupedCredentials>(payload: T, signable: SignablePayload, args: ChainOperationArgs): Promise<ChainSignatureResult>;
}

interface InMemoryKeyAgentProps extends Omit<SerializableInMemoryKeyAgentData, "__typename"> {
    getPassphrase: GetPassphrase;
    mnemonic: string;
}
interface FromBip39MnemonicWordsProps {
    mnemonicWords: string[];
    mnemonic2ndFactorPassphrase?: string;
    getPassphrase: GetPassphrase;
}
declare class InMemoryKeyAgent extends KeyAgentBase implements KeyAgent {
    static fromMnemonicWords({ getPassphrase, mnemonicWords, mnemonic2ndFactorPassphrase, }: FromBip39MnemonicWordsProps): Promise<InMemoryKeyAgent>;
    constructor({ getPassphrase, mnemonic, ...serializableData }: InMemoryKeyAgentProps);
    restoreKeyAgent(args: ChainDerivationArgs, getPassphrase: GetPassphrase): Promise<InMemoryKeyAgent>;
    getSeralizableData(): SerializableInMemoryKeyAgentData;
}

declare class KeyDecryptor {
    #private;
    constructor(getPassphrase: GetPassphrase);
    decryptChildPrivateKey(encryptedPrivateKeyBytes: Uint8Array, noCache?: true): Promise<Uint8Array>;
    decryptSeedBytes(serializableData: SerializableKeyAgentData, noCache?: true): Promise<Uint8Array>;
    private decryptSeed;
}

/**
 * A wrapper around the bip39 package function, with default strength applied to produce 24 words
 */
declare const mnemonicToWords: (mnemonic: string) => string[];
declare const generateMnemonicWords: (strength?: number) => string[];
declare const joinMnemonicWords: (mnenomic: string[]) => string;
declare const entropyToMnemonicWords: (entropy: Uint8Array) => string[];
declare const mnemonicWordsToEntropy: (mnenonic: string[]) => Uint8Array;
declare const mnemonicToSeed: (mnemonic: string[], passphrase?: string) => Uint8Array;
declare const mnemonicToSeedSync: (mnemonic: string, passphrase?: string) => Uint8Array;
/**
 * A wrapper around the bip39 package function
 */
declare const validateMnemonic: typeof bip39.validateMnemonic;
/**
 *  A wrapper to produce a root from entropy
 */
declare const entropyToSeed: (entropy: Uint8Array, passphrase?: string) => Uint8Array;
/**
 * A wrapper to produce an encrypted seed
 */
declare const mnemonicWordsToEncryptedSeed: (mnemonicWords: string[], passphrase: Uint8Array, mnemonic2ndFactorPassphrase: string) => Promise<Uint8Array>;

export { type AccountKeyDerivationPath, type AddressKeyDerivationPath, AuthenticationError, type ChainAddress, type ChainDerivationArgs, type ChainKeyPair, type ChainOperationArgs, type ChainPrivateKey, type ChainPublicKey, type ChainSignablePayload, type ChainSignatureResult, type ChainSigningFunction, type ChainSpecificPayload, ComposableError, type CredentialMatcher, type EncryptedKeyPropertyName, type FromBip39MnemonicWordsProps, type GetPassphrase, type GroupedCredentials, InMemoryKeyAgent, type InMemoryKeyAgentProps, InvalidArgumentError, InvalidMnemonicError, InvalidStateError, InvalidStringError, type KeyAgent, KeyAgentBase, KeyAgentType, KeyDecryptor, type KeyPairDerivationOperations, PathLevelIndexes, type PayloadTypes, type RecipientPublicKeys, type Result, type SerializableInMemoryKeyAgentData, type SerializableKeyAgentData, type SerializableSessionKeyAgentData, type SignablePayload, type SignatureResult, type StarknetDerivationArgs, type StarknetGroupedCredentials, StarknetKeyConst, type StarknetKeyPair, type StealthAddress, deriveStarknetKeyPairs, deriveStarknetPrivateKey, deriveStarknetSpendKeyPair, deriveStarknetViewKeyPair, entropyToMnemonicWords, entropyToSeed, formatErrorMessage, generateMnemonicWords, getRealErrorMsg, getStarknetPublicKeyFromPrivate, grindKey, joinMnemonicWords, mnemonicToSeed, mnemonicToSeedSync, mnemonicToWords, mnemonicWordsToEncryptedSeed, mnemonicWordsToEntropy, pathHash, stripStackTrace, validateMnemonic };
