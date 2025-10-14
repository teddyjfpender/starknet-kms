/**
 * KageAccount Contract ABI
 *
 * This module provides access to the KageAccount contract ABI.
 * The ABI is automatically extracted from the Cairo contract artifacts during build.
 */

import kageAccountAbi from "../artifacts/account_KageAccount.abi.json"
import type { Abi } from "starknet"

/**
 * KageAccount contract ABI
 */
export const KAGE_ACCOUNT_ABI = kageAccountAbi as Abi

/**
 * Load the KageAccount ABI
 *
 * @returns The KageAccount contract ABI
 */
export function getKageAccountAbi(): Abi {
  return KAGE_ACCOUNT_ABI
}

export default KAGE_ACCOUNT_ABI
