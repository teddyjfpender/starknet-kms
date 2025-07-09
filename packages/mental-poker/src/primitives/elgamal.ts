import {
  type Point,
  type Scalar,
  G,
  addPoints,
  scalarMultiply,
  pointToHex,
  hexToPoint,
  randScalar,
  bigIntToHex,
  hexToBigInt,
  arePointsEqual,
  ProjectivePoint,
  generateChallenge,
  moduloOrder
} from '@starkms/crypto'

// ElGamal parameter interfaces
export interface ElGamalParameters {
  generator: Point
}

export interface ElGamalPublicKey {
  point: Point
}

export interface ElGamalSecretKey {
  scalar: Scalar
}

export interface ElGamalPlaintext {
  point: Point
}

export interface ElGamalCiphertext {
  c1: Point // g^r
  c2: Point // m * h^r
}

export interface ChaumPedersenProof {
  commitment: Point  // A = g^k (first commitment)
  challenge: Scalar
  response: Scalar
}



/**
 * Setup ElGamal parameters
 */
export function setup(): ElGamalParameters {
  return {
    generator: G,
  }
}

/**
 * Generate ElGamal key pair
 */
export function keygen(params: ElGamalParameters): {
  publicKey: ElGamalPublicKey
  secretKey: ElGamalSecretKey
} {
  const secretKey = randScalar()
  const publicKey = scalarMultiply(secretKey, params.generator)
  
  return {
    publicKey: { point: publicKey },
    secretKey: { scalar: secretKey },
  }
}

/**
 * Encrypt a plaintext using ElGamal encryption with Chaum-Pedersen proof
 */
export function encrypt(
  params: ElGamalParameters,
  publicKey: ElGamalPublicKey,
  plaintext: ElGamalPlaintext,
  randomness?: Scalar
): {
  ciphertext: ElGamalCiphertext
  proof: ChaumPedersenProof
} {
  const r = randomness || randScalar()
  
  // ElGamal encryption: (g^r, m * h^r)
  const c1 = scalarMultiply(r, params.generator)
  const hr = scalarMultiply(r, publicKey.point)
  const c2 = addPoints(plaintext.point, hr)
  
  const ciphertext: ElGamalCiphertext = { c1, c2 }
  
  // Generate Chaum-Pedersen proof that c1 = g^r and c2/m = h^r
  const proof = proveEncryption(params, publicKey, plaintext, ciphertext, r)
  
  return { ciphertext, proof }
}

/**
 * Decrypt an ElGamal ciphertext
 */
export function decrypt(
  _params: ElGamalParameters,
  secretKey: ElGamalSecretKey,
  ciphertext: ElGamalCiphertext
): ElGamalPlaintext {
  // Compute s * c1 = s * g^r = h^r (since h = g^s)
  const hr = scalarMultiply(secretKey.scalar, ciphertext.c1)
  
  // Compute m = c2 - h^r = m * h^r - h^r = m
  const negHr = hr.negate()
  const plaintext = addPoints(ciphertext.c2, negHr)
  
  return { point: plaintext }
}

/**
 * Prove that an ElGamal encryption is correct using Chaum-Pedersen proof
 */
export function proveEncryption(
  params: ElGamalParameters,
  publicKey: ElGamalPublicKey,
  plaintext: ElGamalPlaintext,
  ciphertext: ElGamalCiphertext,
  randomness: Scalar
): ChaumPedersenProof {
  // Prove knowledge of r such that c1 = g^r and c2/m = h^r
  const k = randScalar()
  
  // Commitments: A = g^k, B = h^k
  const A = scalarMultiply(k, params.generator)
  const B = scalarMultiply(k, publicKey.point)
  
  // Challenge - using same format as Rust implementation
  const challenge = generateChallenge(
    params.generator,
    publicKey.point,
    plaintext.point,
    ciphertext.c1,
    ciphertext.c2,
    A,
    B,
  )
  
  // Response: z = k + c * r (mod curve_order)
  const cr = moduloOrder(challenge * randomness)
  const response = moduloOrder(k + cr)
  
  return {
    commitment: A,
    challenge,
    response,
  }
}

/**
 * Verify an ElGamal encryption proof
 */
export function verifyEncryption(
  params: ElGamalParameters,
  publicKey: ElGamalPublicKey,
  plaintext: ElGamalPlaintext,
  ciphertext: ElGamalCiphertext,
  proof: ChaumPedersenProof
): boolean {
  try {
    // Verify: g^z = A + c1^c  (first verification equation)
    const gz = scalarMultiply(proof.response, params.generator)
    const c1c = scalarMultiply(proof.challenge, ciphertext.c1)
    const left1 = addPoints(proof.commitment, c1c)
    
    if (!arePointsEqual(gz, left1)) {
      return false
    }
    
    // Verify: h^z = B + (c2-m)^c  (second verification equation)
    // We need to derive B from the verification equation: B = h^z - (c2-m)^c
    const hz = scalarMultiply(proof.response, publicKey.point)
    const c2MinusM = addPoints(ciphertext.c2, plaintext.point.negate()) // c2 - m = h^r
    const c2MinusMc = scalarMultiply(proof.challenge, c2MinusM)
    const B = addPoints(hz, c2MinusMc.negate()) // B = h^z - (c2-m)^c
    
    // Verify challenge was computed correctly (Fiat-Shamir)
    const expectedChallenge = generateChallenge(
      params.generator,
      publicKey.point,
      plaintext.point,
      ciphertext.c1,
      ciphertext.c2,
      proof.commitment,
      B,
    )
    
    // Check challenge matches
    if (proof.challenge !== expectedChallenge) {
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

/**
 * Add two ElGamal ciphertexts (homomorphic addition)
 */
export function addCiphertexts(
  c1: ElGamalCiphertext,
  c2: ElGamalCiphertext
): ElGamalCiphertext {
  return {
    c1: addPoints(c1.c1, c2.c1),
    c2: addPoints(c1.c2, c2.c2),
  }
}

/**
 * Scalar multiply an ElGamal ciphertext
 */
export function scalarMultiplyCiphertext(
  scalar: Scalar,
  ciphertext: ElGamalCiphertext
): ElGamalCiphertext {
  return {
    c1: scalarMultiply(scalar, ciphertext.c1),
    c2: scalarMultiply(scalar, ciphertext.c2),
  }
}

/**
 * Convert scalar to hex string
 */
export function scalarToHex(scalar: Scalar): string {
  return bigIntToHex(scalar)
}

/**
 * Convert hex string to scalar
 */
export function hexToScalar(hex: string): Scalar {
  return hexToBigInt(hex)
}

/**
 * Generate a random plaintext (point)
 */
export function randomPlaintext(): ElGamalPlaintext {
  return { point: ProjectivePoint.fromPrivateKey(randScalar()) }
}

/**
 * Check if two points are equal
 */
export function pointsEqual(p1: Point, p2: Point): boolean {
  return arePointsEqual(p1, p2)
}

/**
 * Check if two ciphertexts are equal
 */
export function ciphertextsEqual(c1: ElGamalCiphertext, c2: ElGamalCiphertext): boolean {
  return arePointsEqual(c1.c1, c2.c1) && arePointsEqual(c1.c2, c2.c2)
}

/**
 * Convert a point to hex string
 */
export { pointToHex }

/**
 * Convert hex string to point
 */
export { hexToPoint }
