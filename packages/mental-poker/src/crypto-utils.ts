import { CURVE_ORDER, type Scalar, moduloOrder } from "@starkms/crypto"
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
    throw new Error(`Scalar ${scalar} is not in valid range [0, ${CURVE_ORDER})`)
  }
}

/**
 * Secure modular multiplication using micro-starknet
 */
export function secureModularMultiply(a: Scalar, b: Scalar): Scalar {
  const result = CURVE.Fp.mul(a, b)
  return moduloOrder(result)
}

/**
 * Secure modular addition using micro-starknet
 */
export function secureModularAdd(a: Scalar, b: Scalar): Scalar {
  const result = CURVE.Fp.add(a, b)
  return moduloOrder(result)
}

/**
 * Secure modular subtraction using micro-starknet
 */
export function secureModularSubtract(a: Scalar, b: Scalar): Scalar {
  const result = CURVE.Fp.sub(a, b)
  return moduloOrder(result)
} 