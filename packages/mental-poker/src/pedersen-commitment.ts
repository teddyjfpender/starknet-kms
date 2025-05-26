import {
  G,
  POINT_AT_INFINITY,
  type Point,
  type Scalar,
  addPoints,
  moduloOrder,
  randScalar,
  scalarMultiply,
} from "@starkms/crypto"
import { MentalPokerError, MentalPokerErrorCode } from "./types"

/**
 * Pedersen commitment scheme for vectors
 * Commit(m, r) = sum(m_i * g_i) + r * h
 * where g_i are generators and h is a separate generator
 */
export interface PedersenCommitment {
  readonly commitment: Point
  readonly randomness: Scalar
}

/**
 * Pedersen commitment key containing generators
 */
export interface PedersenCommitKey {
  readonly generators: readonly Point[] // g_1, g_2, ..., g_n
  readonly h: Point // Blinding generator
}

/**
 * Generate a Pedersen commitment key with n generators
 */
export function generatePedersenCommitKey(n: number): PedersenCommitKey {
  if (n <= 0) {
    throw new MentalPokerError(
      `Invalid number of generators: ${n}`,
      MentalPokerErrorCode.INVALID_PARAMETERS,
    )
  }

  const generators: Point[] = []

  // Generate deterministic generators using hash-to-curve
  // In practice, these should be generated using a proper hash-to-curve method
  // For now, we'll use a simple deterministic method based on scalar multiplication
  for (let i = 0; i < n; i++) {
    // Use a deterministic scalar based on index
    // In production, this should use proper hash-to-curve
    const scalar = moduloOrder(
      BigInt(i + 1) * BigInt(2 ** 32) + BigInt(0x12345678),
    )
    generators.push(scalarMultiply(scalar, G))
  }

  // Generate h as a separate generator
  const hScalar = moduloOrder(
    BigInt(n + 1) * BigInt(2 ** 32) + BigInt(0x87654321),
  )
  const h = scalarMultiply(hScalar, G)

  return {
    generators,
    h,
  }
}

/**
 * Commit to a vector of scalars using Pedersen commitment
 */
export function pedersenCommit(
  commitKey: PedersenCommitKey,
  message: readonly Scalar[],
  randomness?: Scalar,
): PedersenCommitment {
  if (message.length !== commitKey.generators.length) {
    throw new MentalPokerError(
      `Message length ${message.length} does not match number of generators ${commitKey.generators.length}`,
      MentalPokerErrorCode.INVALID_PARAMETERS,
    )
  }

  const r = randomness ?? randScalar()

  // Compute sum(m_i * g_i)
  let commitment = POINT_AT_INFINITY
  for (let i = 0; i < message.length; i++) {
    const term = scalarMultiply(message[i]!, commitKey.generators[i]!)
    commitment = addPoints(commitment, term)
  }

  // Add blinding term r * h
  const blindingTerm = scalarMultiply(r, commitKey.h)
  commitment = addPoints(commitment, blindingTerm)

  return {
    commitment,
    randomness: r,
  }
}

/**
 * Verify a Pedersen commitment opening
 */
export function verifyPedersenCommitment(
  commitKey: PedersenCommitKey,
  commitment: Point,
  message: readonly Scalar[],
  randomness: Scalar,
): boolean {
  try {
    const recomputed = pedersenCommit(commitKey, message, randomness)
    return commitment.equals(recomputed.commitment)
  } catch {
    return false
  }
}

/**
 * Homomorphic addition of Pedersen commitments
 * Com(m1, r1) + Com(m2, r2) = Com(m1 + m2, r1 + r2)
 */
export function addPedersenCommitments(
  comm1: PedersenCommitment,
  comm2: PedersenCommitment,
): PedersenCommitment {
  return {
    commitment: addPoints(comm1.commitment, comm2.commitment),
    randomness: moduloOrder(comm1.randomness + comm2.randomness),
  }
}

/**
 * Scalar multiplication of Pedersen commitment
 * s * Com(m, r) = Com(s * m, s * r)
 */
export function scalarMultiplyPedersenCommitment(
  scalar: Scalar,
  comm: PedersenCommitment,
): PedersenCommitment {
  return {
    commitment: scalarMultiply(scalar, comm.commitment),
    randomness: moduloOrder(scalar * comm.randomness),
  }
}
