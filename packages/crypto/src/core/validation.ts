import { InvalidHexError } from "./errors"

/**
 * Validates and normalizes a hex string input.
 * @param h - The input to validate (should be a hex string)
 * @param maxLen - Maximum allowed length of hex characters (without 0x prefix)
 * @returns Normalized hex string with 0x prefix
 * @throws InvalidHexError for invalid inputs
 */
export function assertStringHex(h: unknown, maxLen: number): string {
  // Input validation
  if (h == null || h === undefined) {
    throw new InvalidHexError("Input cannot be null or undefined")
  }
  if (typeof h !== "string") {
    throw new InvalidHexError("Input must be a string")
  }
  if (h === "") {
    throw new InvalidHexError("Input cannot be an empty string")
  }

  // Normalize the hex string - add 0x prefix if missing
  const normalizedHex = h.startsWith("0x") ? h : `0x${h}`

  const hexPart = normalizedHex.slice(2)
  if (hexPart === "") {
    throw new InvalidHexError("Hex string cannot be just '0x'")
  }

  // Check for valid hex characters
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new InvalidHexError("Invalid hex characters")
  }

  // Check for reasonable length
  if (hexPart.length > maxLen) {
    throw new InvalidHexError(`Hex string too long: ${hexPart.length} > ${maxLen}`)
  }

  return normalizedHex
}

/**
 * Adds hex prefix if not present
 */
export const addHexPrefix = (h: string): string => (h.startsWith("0x") ? h : `0x${h}`)

/**
 * Removes hex prefix if present
 */
export const removeHexPrefix = (h: string): string => h.replace(/^0x/i, "")

/**
 * Converts buffer to hex string
 */
export const buf2hex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("") 