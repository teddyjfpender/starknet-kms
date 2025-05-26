import { CURVE_ORDER, type Scalar, moduloOrder } from "@starkms/crypto"
import { MentalPokerError, MentalPokerErrorCode } from "./types"

/**
 * Represents a polynomial over the scalar field
 */
export interface Polynomial {
  readonly coefficients: readonly Scalar[] // coefficients[i] is coefficient of x^i
}

/**
 * Create a polynomial from coefficients
 */
export function createPolynomial(coefficients: readonly Scalar[]): Polynomial {
  if (coefficients.length === 0) {
    throw new MentalPokerError(
      "Polynomial must have at least one coefficient",
      MentalPokerErrorCode.INVALID_PARAMETERS,
    )
  }
  return { coefficients }
}

/**
 * Evaluate polynomial at a given point
 * Uses Horner's method for efficient evaluation
 */
export function evaluatePolynomial(poly: Polynomial, x: Scalar): Scalar {
  if (poly.coefficients.length === 0) {
    return 0n
  }

  // Horner's method: p(x) = a_0 + x(a_1 + x(a_2 + ... + x*a_n))
  let result = poly.coefficients[poly.coefficients.length - 1]!

  for (let i = poly.coefficients.length - 2; i >= 0; i--) {
    result = moduloOrder(poly.coefficients[i]! + x * result)
  }

  return result
}

/**
 * Add two polynomials
 */
export function addPolynomials(p1: Polynomial, p2: Polynomial): Polynomial {
  const maxLength = Math.max(p1.coefficients.length, p2.coefficients.length)
  const coefficients: Scalar[] = []

  for (let i = 0; i < maxLength; i++) {
    const c1 = i < p1.coefficients.length ? p1.coefficients[i]! : 0n
    const c2 = i < p2.coefficients.length ? p2.coefficients[i]! : 0n
    coefficients.push(moduloOrder(c1 + c2))
  }

  return { coefficients }
}

/**
 * Multiply polynomial by a scalar
 */
export function scalarMultiplyPolynomial(
  scalar: Scalar,
  poly: Polynomial,
): Polynomial {
  const coefficients = poly.coefficients.map((c) => moduloOrder(scalar * c))
  return { coefficients }
}

/**
 * Multiply two polynomials
 */
export function multiplyPolynomials(
  p1: Polynomial,
  p2: Polynomial,
): Polynomial {
  if (p1.coefficients.length === 0 || p2.coefficients.length === 0) {
    return { coefficients: [0n] }
  }

  const resultLength = p1.coefficients.length + p2.coefficients.length - 1
  const coefficients: Scalar[] = new Array(resultLength).fill(0n)

  for (let i = 0; i < p1.coefficients.length; i++) {
    for (let j = 0; j < p2.coefficients.length; j++) {
      const product = moduloOrder(p1.coefficients[i]! * p2.coefficients[j]!)
      coefficients[i + j] = moduloOrder(coefficients[i + j]! + product)
    }
  }

  return { coefficients }
}

/**
 * Create the permutation polynomial for a given permutation
 * This is used in the Bayer-Groth shuffle proof
 */
export function createPermutationPolynomial(
  permutation: readonly number[],
): Polynomial {
  const n = permutation.length

  // Create polynomial that encodes the permutation
  // p(i) = permutation[i] for i = 0, 1, ..., n-1

  // Use Lagrange interpolation to construct the polynomial
  const coefficients: Scalar[] = new Array(n).fill(0n)

  for (let i = 0; i < n; i++) {
    // Lagrange basis polynomial L_i(x) = product((x - j) / (i - j)) for j != i
    let basisPoly: Polynomial = { coefficients: [1n] } // Start with polynomial 1

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        // Multiply by (x - j) / (i - j)
        const denominator = moduloOrder(BigInt(i) - BigInt(j))
        const denominatorInv = modularInverse(denominator)

        // (x - j) polynomial
        const linearPoly: Polynomial = {
          coefficients: [moduloOrder(-BigInt(j)), 1n],
        }

        basisPoly = multiplyPolynomials(basisPoly, linearPoly)
        basisPoly = scalarMultiplyPolynomial(denominatorInv, basisPoly)
      }
    }

    // Add permutation[i] * L_i(x) to the result
    const scaledBasis = scalarMultiplyPolynomial(
      BigInt(permutation[i]!),
      basisPoly,
    )
    const resultPoly = addPolynomials({ coefficients }, scaledBasis)
    coefficients.splice(0, coefficients.length, ...resultPoly.coefficients)
  }

  return { coefficients }
}

/**
 * Compute modular inverse using extended Euclidean algorithm
 */
function modularInverse(a: Scalar): Scalar {
  const mod = CURVE_ORDER

  // Extended Euclidean Algorithm
  let [oldR, r] = [a, mod]
  let [oldS, s] = [1n, 0n]

  while (r !== 0n) {
    const quotient = oldR / r
    ;[oldR, r] = [r, oldR - quotient * r]
    ;[oldS, s] = [s, oldS - quotient * s]
  }

  if (oldR > 1n) {
    throw new MentalPokerError(
      `No modular inverse exists for ${a}`,
      MentalPokerErrorCode.CRYPTOGRAPHIC_ERROR,
    )
  }

  return moduloOrder(oldS)
}

/**
 * Generate random polynomial of given degree
 */
export function randomPolynomial(degree: number): Polynomial {
  if (degree < 0) {
    throw new MentalPokerError(
      `Invalid polynomial degree: ${degree}`,
      MentalPokerErrorCode.INVALID_PARAMETERS,
    )
  }

  const coefficients: Scalar[] = []
  for (let i = 0; i <= degree; i++) {
    // Generate random coefficient
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    let coeff = 0n
    for (let j = 0; j < 32; j++) {
      coeff = (coeff << 8n) + BigInt(randomBytes[j]!)
    }
    coefficients.push(moduloOrder(coeff))
  }

  return { coefficients }
}
