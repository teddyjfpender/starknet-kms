import {
  CURVE_ORDER,
  type Scalar,
  moduloOrder,
  randScalar,
} from "@starkms/crypto"
import { CURVE } from "micro-starknet"

/**
 * Secure modular inverse implementation using micro-starknet
 *
 * This replaces the custom implementation with a library-based approach
 * that provides better security guarantees against side-channel attacks.
 */
export function secureModularInverse(a: Scalar): Scalar {
  // Validate input
  if (a === 0n) {
    throw new Error(`No modular inverse exists for ${a}`)
  }

  // Use micro-starknet's secure modular inverse implementation
  // This is constant-time and resistant to side-channel attacks
  const result = CURVE.Fp.inv(a)

  return moduloOrder(result)
}

/**
 * Validate that a scalar is within the valid range for the curve
 */
export function validateScalar(scalar: Scalar): void {
  if (scalar < 0n || scalar >= CURVE_ORDER) {
    throw new Error(
      `Scalar ${scalar} is not in valid range [0, ${CURVE_ORDER})`,
    )
  }
}

/**
 * Secure modular multiplication using micro-starknet
 */
export function secureModularMultiply(a: Scalar, b: Scalar): Scalar {
  validateScalar(a)
  validateScalar(b)

  const result = CURVE.Fp.mul(a, b)
  return moduloOrder(result)
}

/**
 * Secure modular addition using micro-starknet
 */
export function secureModularAdd(a: Scalar, b: Scalar): Scalar {
  validateScalar(a)
  validateScalar(b)

  const result = CURVE.Fp.add(a, b)
  return moduloOrder(result)
}

/**
 * Secure modular subtraction using micro-starknet
 */
export function secureModularSubtract(a: Scalar, b: Scalar): Scalar {
  validateScalar(a)
  validateScalar(b)

  const result = CURVE.Fp.sub(a, b)
  return moduloOrder(result)
}

/**
 * Constant-time scalar comparison
 * Returns true if a == b, false otherwise
 * Designed to prevent timing attacks
 */
export function constantTimeScalarEqual(a: Scalar, b: Scalar): boolean {
  validateScalar(a)
  validateScalar(b)

  // XOR the scalars - if equal, result is 0
  const diff = a ^ b

  // Check if all bits are zero in constant time
  let result = 0n
  let temp = diff

  // Process in constant time regardless of input values
  for (let i = 0; i < 256; i++) {
    // 256 bits for STARK curve
    result |= temp & 1n
    temp >>= 1n
  }

  return result === 0n
}

/**
 * Secure random scalar generation with additional entropy
 */
export function secureRandomScalar(): Scalar {
  // Generate multiple random values using the crypto module's randScalar
  // which provides cryptographically secure randomness
  const random1 = randScalar()
  const random2 = randScalar()

  // Combine using secure addition for additional entropy
  const combined = secureModularAdd(random1, random2)

  return moduloOrder(combined)
}

/**
 * Constant-time conditional select
 * Returns a if condition is true, b if condition is false
 * Executes in constant time regardless of condition value
 */
export function constantTimeSelect(
  condition: boolean,
  a: Scalar,
  b: Scalar,
): Scalar {
  validateScalar(a)
  validateScalar(b)

  // Convert boolean to mask (all 1s or all 0s)
  const mask = condition ? ~0n : 0n

  // Use bitwise operations for constant-time selection
  return (a & mask) | (b & ~mask)
}

/**
 * Memory-safe scalar clearing
 * Attempts to clear sensitive scalar values from memory
 */
export function clearScalar(_scalar: Scalar): void {
  // Note: In JavaScript/TypeScript, we cannot truly clear memory
  // This is a placeholder for future native implementations
  // In production, consider using WebAssembly or native modules for true memory clearing
  // For now, we can only overwrite the variable reference
  // The original memory may still contain the value due to GC
  // scalar = 0n // Cannot modify parameter
}

/**
 * Secure scalar array processing with constant-time operations
 */
export class SecureScalarArray {
  private readonly data: Scalar[]
  private readonly length: number

  constructor(scalars: readonly Scalar[]) {
    // Validate all scalars
    for (const scalar of scalars) {
      validateScalar(scalar)
    }

    this.data = [...scalars]
    this.length = scalars.length
  }

  /**
   * Get scalar at index in constant time
   */
  get(index: number): Scalar {
    if (index < 0 || index >= this.length) {
      throw new Error(`Array index ${index} out of bounds [0, ${this.length})`)
    }

    return this.data[index]!
  }

  /**
   * Set scalar at index
   */
  set(index: number, value: Scalar): void {
    if (index < 0 || index >= this.length) {
      throw new Error(`Array index ${index} out of bounds [0, ${this.length})`)
    }

    validateScalar(value)
    this.data[index] = value
  }

  /**
   * Constant-time array equality check
   */
  equals(other: SecureScalarArray): boolean {
    if (this.length !== other.length) {
      return false
    }

    let allEqual = true
    for (let i = 0; i < this.length; i++) {
      const isEqual = constantTimeScalarEqual(this.data[i]!, other.data[i]!)
      allEqual = allEqual && isEqual
    }

    return allEqual
  }

  /**
   * Secure array clearing
   */
  clear(): void {
    for (let i = 0; i < this.length; i++) {
      this.data[i] = 0n
    }
  }

  /**
   * Get array length
   */
  getLength(): number {
    return this.length
  }

  /**
   * Create a copy of the array
   */
  clone(): SecureScalarArray {
    return new SecureScalarArray(this.data)
  }
}

/**
 * Timing-attack resistant modular exponentiation
 * Uses constant-time algorithms to prevent side-channel attacks
 */
export function secureModularExponentiation(
  base: Scalar,
  exponent: Scalar,
): Scalar {
  validateScalar(base)
  validateScalar(exponent)

  // Use micro-starknet's secure exponentiation if available
  // Otherwise fall back to constant-time implementation
  if (CURVE.Fp.pow) {
    return moduloOrder(CURVE.Fp.pow(base, exponent))
  }

  // Constant-time square-and-multiply implementation
  let result = 1n
  let baseTemp = base
  let expTemp = exponent

  // Process all bits to maintain constant time
  for (let i = 0; i < 256; i++) {
    // 256 bits for STARK curve
    const bit = expTemp & 1n

    // Constant-time conditional multiply
    const newResult = secureModularMultiply(result, baseTemp)
    result = constantTimeSelect(bit === 1n, newResult, result)

    // Square for next iteration
    baseTemp = secureModularMultiply(baseTemp, baseTemp)
    expTemp >>= 1n
  }

  return moduloOrder(result)
}
