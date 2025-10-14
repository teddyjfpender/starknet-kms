import { hash, RpcProvider, Account, CallData, type Abi, encode } from "starknet"

/**
 * Account derivation utilities for deploying Starknet accounts
 */

/**
 * Extract the x-coordinate from an uncompressed public key.
 * If the key is already compressed (just x-coordinate), return it as-is.
 *
 * @param publicKey - Public key (compressed or uncompressed)
 * @returns Compressed public key (x-coordinate only)
 * @example
 * ```ts
 * const uncompressed = "0x04...130chars..."
 * const compressed = ensureCompressedPublicKey(uncompressed) // "0x...64chars..."
 * ```
 */
export function ensureCompressedPublicKey(publicKey: string): string {
  // Remove 0x prefix for processing
  const keyHex = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey

  // Uncompressed keys start with 04 and are 130 hex chars (65 bytes)
  // Compressed keys are 64 hex chars (32 bytes)
  if (keyHex.startsWith("04") && keyHex.length === 130) {
    // Extract x-coordinate (skip the '04' prefix, take next 64 chars)
    const xCoordinate = keyHex.slice(2, 66)
    return encode.addHexPrefix(xCoordinate)
  }

  // Already compressed or invalid format, return as-is
  return publicKey
}

export interface AccountDerivationConfig {
  /**
   * The class hash of the account contract (e.g., OpenZeppelin account)
   */
  classHash: string

  /**
   * Optional contract ABI (required for deployment)
   */
  abi?: Abi

  /**
   * Salt for address derivation (default: 0)
   */
  salt?: string

  /**
   * Enable verbose logging (default: true)
   */
  verbose?: boolean
}

export interface DerivedAccountInfo {
  /**
   * The public key used to derive this account
   */
  publicKey: string

  /**
   * The precalculated contract address
   */
  address: string

  /**
   * The class hash used
   */
  classHash: string

  /**
   * The salt used
   */
  salt: string

  /**
   * Constructor calldata
   */
  constructorCalldata: string[]
}

/**
 * Calculate the account contract address from a public key.
 *
 * This follows the standard OpenZeppelin account pattern where the
 * constructor takes a single `public_key` parameter.
 *
 * @param publicKey - The Stark public key (0x-prefixed hex)
 * @param config - Account derivation configuration
 * @returns DerivedAccountInfo with address and metadata
 */
export function deriveAccountAddress(
  publicKey: string,
  config: AccountDerivationConfig,
): DerivedAccountInfo {
  const salt = config.salt ?? "0x0"

  // Ensure we're using compressed public key (x-coordinate only)
  const compressedPublicKey = ensureCompressedPublicKey(publicKey)

  // For OpenZeppelin accounts, constructor takes [public_key]
  const constructorCalldata = CallData.compile({ public_key: compressedPublicKey })

  // Calculate the contract address
  const address = hash.calculateContractAddressFromHash(
    salt,
    config.classHash,
    constructorCalldata,
    0, // deployer address (0 for counterfactual deployment)
  )

  return {
    publicKey: compressedPublicKey,
    address,
    classHash: config.classHash,
    salt,
    constructorCalldata,
  }
}

/**
 * Deploy an account contract to Starknet.
 *
 * Prerequisites:
 * - The derived address must be funded with STRK tokens
 * - The account contract class must be declared on the network
 *
 * @param derivedAccount - Account info from deriveAccountAddress
 * @param privateKey - The private key corresponding to the public key
 * @param provider - RpcProvider instance
 * @param config - Account configuration with ABI
 * @returns Deployed Account instance
 */
export async function deployAccount(
  derivedAccount: DerivedAccountInfo,
  privateKey: string,
  provider: RpcProvider,
  config: AccountDerivationConfig & { abi: Abi },
): Promise<Account> {
  if (!config.abi) {
    throw new Error("ABI is required for account deployment")
  }

  const verbose = config.verbose !== false

  // Create an Account instance with the precalculated address
  const account = new Account({
    provider,
    address: derivedAccount.address,
    signer: privateKey,
  })

  // Deploy the account
  const deployAccountPayload = {
    classHash: derivedAccount.classHash,
    constructorCalldata: derivedAccount.constructorCalldata,
    addressSalt: derivedAccount.salt,
  }

  const { transaction_hash, contract_address } =
    await account.deployAccount(deployAccountPayload)

  if (verbose) {
    console.log("✅ Account deployed!")
    console.log("   Transaction hash:", transaction_hash)
    console.log("   Contract address:", contract_address)
  }

  // Wait for the transaction to be accepted
  const receipt = await provider.waitForTransaction(transaction_hash)

  // Verify deployment was successful
  // Note: In starknet.js v8, receipt types vary. We use type assertions to handle different receipt structures
  const receiptAny = receipt as any

  const isSuccess =
    receipt &&
    (typeof receiptAny.isSuccess === "function"
      ? receiptAny.isSuccess()
      : receiptAny.execution_status !== "REVERTED")

  if (!isSuccess) {
    const reason = receiptAny.revert_reason || "Unknown error"
    throw new Error(`Account deployment failed: ${reason}`)
  }

  if (verbose) {
    const status = receiptAny.execution_status || "SUCCEEDED"
    console.log(`   Status: ${status}`)
  }

  return account
}

/**
 * Check if an account is already deployed at the given address.
 *
 * @param address - The contract address to check
 * @param provider - RpcProvider instance
 * @returns true if deployed, false otherwise
 */
export async function isAccountDeployed(
  address: string,
  provider: RpcProvider,
): Promise<boolean> {
  try {
    const classHash = await provider.getClassHashAt(address)
    return classHash !== "0x0"
  } catch (error) {
    return false
  }
}

/**
 * Get the balance of an account address.
 *
 * @param address - The account address
 * @param provider - RpcProvider instance
 * @param tokenAddress - The token contract address (default: ETH on mainnet)
 * @returns Balance as a bigint
 */
export async function getAccountBalance(
  address: string,
  provider: RpcProvider,
  tokenAddress?: string,
): Promise<bigint> {
  try {
    // Default to ETH token address on Starknet
    const ethTokenAddress =
      tokenAddress ?? "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"

    const result = await provider.callContract({
      contractAddress: ethTokenAddress,
      entrypoint: "balanceOf",
      calldata: [address],
    })

    return BigInt(result[0] ?? 0)
  } catch (error) {
    console.error("Failed to get account balance:", error)
    return 0n
  }
}

/**
 * Wait for an account address to be funded.
 *
 * @param address - The account address to monitor
 * @param provider - RpcProvider instance
 * @param minBalance - Minimum balance required (default: 0)
 * @param timeoutMs - Timeout in milliseconds (default: 60000)
 * @returns true if funded, false if timeout
 */
export async function waitForFunding(
  address: string,
  provider: RpcProvider,
  minBalance = 0n,
  timeoutMs = 60000,
  tokenAddress = undefined
): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const balance = await getAccountBalance(address, provider, tokenAddress)

    if (balance > minBalance) {
      console.log(`✅ Account funded! Balance: ${balance}`)
      return true
    }

    console.log(`⏳ Waiting for funding... Current balance: ${balance}`)
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return false
}

/**
 * Complete workflow: derive, fund check, and deploy an account.
 *
 * @param publicKey - The Stark public key
 * @param privateKey - The corresponding private key
 * @param provider - RpcProvider instance
 * @param config - Account configuration
 * @param waitForFund - Whether to wait for funding (default: false)
 * @returns Deployed Account instance
 */
export async function deriveAndDeployAccount(
  publicKey: string,
  privateKey: string,
  provider: RpcProvider,
  config: AccountDerivationConfig & { abi: Abi },
  waitForFund = false,
  tokenAddress = undefined,
): Promise<{ account: Account; derivedInfo: DerivedAccountInfo }> {
  const verbose = config.verbose !== false

  // Step 1: Derive the account address
  if (verbose) console.log("📍 Deriving account address...")
  const derivedInfo = deriveAccountAddress(publicKey, config)
  if (verbose) console.log("   Derived address:", derivedInfo.address)

  // Step 2: Check if already deployed
  const deployed = await isAccountDeployed(derivedInfo.address, provider)
  if (deployed) {
    if (verbose) console.log("ℹ️  Account already deployed")
    const account = new Account({
      provider,
      address: derivedInfo.address,
      signer: privateKey,
    })
    return { account, derivedInfo }
  }

  // Step 3: Check balance
  const balance = await getAccountBalance(derivedInfo.address, provider, tokenAddress)
  if (verbose) console.log(`💰 Account balance: ${balance}`)

  if (balance === 0n && waitForFund) {
    if (verbose) console.log("⏳ Waiting for account to be funded...")
    const funded = await waitForFunding(derivedInfo.address, provider, 0n, 60000, tokenAddress)
    if (!funded) {
      throw new Error("Account funding timeout")
    }
  } else if (balance === 0n) {
    throw new Error(
      `Account not funded. Please send tokens to ${derivedInfo.address}`,
    )
  }

  // Step 4: Deploy
  if (verbose) console.log("🚀 Deploying account...")
  const account = await deployAccount(derivedInfo, privateKey, provider, config)

  return { account, derivedInfo }
}
