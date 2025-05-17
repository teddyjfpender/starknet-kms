import {
  G,
  type Point,
  ProjectivePoint,
  type Scalar,
  moduloOrder,
  randScalar,
} from "../core/curve"
import { H } from "./generators"
import { generateChallenge } from "./transcript"

/* ------------------------  Public types  ------------------------ */

/** Statement proved in the Chaum‑Pedersen protocol. */
export interface Statement {
  /** U = x⋅G */
  U: Point
  /** V = x⋅H */
  V: Point
}

/** Commitment values for the first round of the interactive protocol. */
export interface InteractiveCommit {
  /** P = r⋅G */
  P: Point
  /** Q = r⋅H */
  Q: Point
}

/** Non‑interactive Chaum‑Pedersen proof. */
export interface Proof extends InteractiveCommit {
  /** Fiat‑Shamir challenge */
  c: Scalar
  /** Response: e = r + c⋅x mod n */
  e: Scalar
}

/* ------------------------  Algorithms  -------------------------- */

/**
 * Prover - interactive step 1: commit.
 * Generates a commitment (P, Q) based on a random nonce r.
 * @param r Optional pre-generated random nonce scalar. If not provided, one will be generated.
 * @returns An object containing the commitment {P, Q} and the nonce r used.
 */
/**
 * Generate an interactive commitment.
 * @param r optional nonce; a random scalar will be generated if omitted
 * @returns commitment points and the nonce used
 */
export function commit(r: Scalar = randScalar()): {
  commit: InteractiveCommit
  nonce: Scalar
} {
  return {
    commit: {
      P: G.multiply(r),
      Q: H.multiply(r),
    },
    nonce: r,
  }
}

/**
 * Prover - interactive step 2: respond (given challenge c).
 * Calculates the response e = r + c*x mod n.
 * @param x The secret scalar x.
 * @param r The nonce scalar used in the commit phase.
 * @param c The challenge scalar provided by the verifier.
 * @returns The response scalar e.
 */
/**
 * Compute the prover response for a given challenge.
 * @param x secret witness
 * @param r nonce used during {@link commit}
 * @param c verifier challenge
 */
export function respond(x: Scalar, r: Scalar, c: Scalar): Scalar {
  const cx = c * x // c*x
  const r_plus_cx = r + cx // r + c*x
  return moduloOrder(r_plus_cx) // Use new moduloOrder
}

/**
 * Full Fiat-Shamir proof generation.
 * @param x The secret scalar x.
 * @returns An object containing the statement {U, V} and the non-interactive proof {P, Q, c, e}.
 */
/**
 * Create a non‑interactive (Fiat‑Shamir) proof for secret {@code x}.
 */
export function proveFS(x: Scalar): { stmt: Statement; proof: Proof } {
  const U = G.multiply(x)
  const V = H.multiply(x)

  const { commit: interactiveCommit, nonce: r } = commit() // Call commit without x, r is generated inside

  // Challenge c = Hash(P, Q, U, V)
  const c = generateChallenge(interactiveCommit.P, interactiveCommit.Q, U, V)

  const e = respond(x, r, c)

  return {
    stmt: { U, V },
    proof: { ...interactiveCommit, c, e },
  }
}

/**
 * Verifier - checks the proof.
 * Verifies if e*G == P + c*U and e*H == Q + c*V.
 * @param stmt The statement {U, V}.
 * @param proof The proof {P, Q, c, e}.
 * @returns True if the proof is valid, false otherwise.
 */
/**
 * Verify a Chaum‑Pedersen proof.
 */
export function verify(stmt: Statement, proof: Proof): boolean {
  const { U, V } = stmt
  const { P, Q, c, e } = proof

  // Input validation as per audit recommendation
  // This assumes Point instances have an assertValidity method (e.g., from starknet.js >= 7.14)
  try {
    U.assertValidity()
    V.assertValidity()
    P.assertValidity()
    Q.assertValidity()
  } catch (error) {
    // console.error("Point validation failed:", error); // Optional: log the error
    return false // If any point is invalid, verification fails
  }

  // Left-hand side of equations:
  // eG = G * e
  const eG = G.multiply(e)
  const eH = H.multiply(e)

  // Right-hand side of equations:
  // P_plus_cU = P + (U * c)
  // Q_plus_cV = Q + (V * c)
  const cU = U.multiply(c)
  const P_plus_cU = P.add(cU)

  const cV = V.multiply(c)
  const Q_plus_cV = Q.add(cV)

  // Check equalities
  // Points are ProjectivePoints from starknet.js, they have an .equals() method.
  return eG.equals(P_plus_cU) && eH.equals(Q_plus_cV)
}

/**
 * Serialise a proof to a fixed width byte representation (6×32 bytes).
 */
export function encodeProof({ P, Q, c, e }: Proof): Uint8Array {
  const be = (n: bigint) =>
    new Uint8Array(32)
      .fill(0)
      .map((_, i) => Number((n >> (8n * BigInt(31 - i))) & 0xffn))
  return new Uint8Array([
    ...be(P.x),
    ...be(P.y),
    ...be(Q.x),
    ...be(Q.y),
    ...be(c),
    ...be(e),
  ])
}

/**
 * Parse a proof previously encoded with {@link encodeProof}.
 */
export function decodeProof(bytes: Uint8Array): Proof {
  const read = (off: number) =>
    bytes.slice(off, off + 32).reduce((acc, v) => (acc << 8n) | BigInt(v), 0n)

  const P = ProjectivePoint.fromAffine({
    x: read(0),
    y: read(32),
  }) as Point
  const Q = ProjectivePoint.fromAffine({
    x: read(64),
    y: read(96),
  }) as Point
  const c = read(128)
  const e = read(160)
  return { P, Q, c, e }
}
