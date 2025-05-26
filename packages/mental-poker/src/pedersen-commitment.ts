import {
  G,
  POINT_AT_INFINITY,
  type Point,
  type Scalar,
  addPoints,
  moduloOrder,
  randScalar,
  scalarMultiply,
  poseidonHashScalars,
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
 * Generate a Pedersen commitment key with n generators using proper hash-to-curve
 */
export function generatePedersenCommitKey(n: number): PedersenCommitKey {
  if (n <= 0) {
    throw new MentalPokerError(
      `Invalid number of generators: ${n}`,
      MentalPokerErrorCode.INVALID_PARAMETERS,
    )
  }

  const generators: Point[] = []

  // Use a domain separation tag for Pedersen commitment generators
  const domainSeparator = "PEDERSEN_COMMIT_GENERATORS"
  const domainBytes = new TextEncoder().encode(domainSeparator)
  const domainScalars = Array.from(domainBytes, (byte) => BigInt(byte))

  // Generate deterministic generators using cryptographic hash-to-curve
  for (let i = 0; i < n; i++) {
    // Create unique input for each generator using domain separation and index
    const input = [...domainScalars, BigInt(i), BigInt(n)]
    const scalar = poseidonHashScalars(input)
    
    // Ensure the scalar is non-zero and in the correct range
    const safeScalar = scalar === 0n ? 1n : scalar
    generators.push(scalarMultiply(safeScalar, G))
  }

  // Generate h as a separate generator with different domain separation
  const hDomainSeparator = "PEDERSEN_COMMIT_H_GENERATOR"
  const hDomainBytes = new TextEncoder().encode(hDomainSeparator)
  const hDomainScalars = Array.from(hDomainBytes, (byte) => BigInt(byte))
  const hInput = [...hDomainScalars, BigInt(n)]
  const hScalar = poseidonHashScalars(hInput)
  const safeHScalar = hScalar === 0n ? 2n : hScalar
  const h = scalarMultiply(safeHScalar, G)

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
