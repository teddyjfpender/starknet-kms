import { beforeEach, describe, expect, it } from "bun:test"
import * as fc from "fast-check" // Import fast-check
import {
  CURVE_ORDER,
  G,
  H,
  Point,
  type Proof,
  type Scalar,
  type Statement,
  commit as cpCommit,
  generateChallenge as cpGenerateChallenge,
  respond as cpRespond,
  proveFS,
  randScalar,
  toFr,
  verify,
} from "../../src/elliptic-curve/chaum-pedersen"

// Helper to generate a valid scalar for fast-check (1 <= x < CURVE_ORDER)
const fcScalar = fc.bigInt(1n, CURVE_ORDER - 1n)

describe("Chaum-Pedersen ZKP (Fiat-Shamir)", () => {
  it("should succeed for a valid proof (round-trip)", () => {
    const x: Scalar = randScalar()
    const { stmt, proof } = proveFS(x)
    expect(verify(stmt, proof)).toBe(true)
  })

  describe("Property-Based Tests", () => {
    it("should verify for any valid secret x", () => {
      fc.assert(
        fc.property(fcScalar, (x) => {
          const { stmt, proof } = proveFS(x)
          return verify(stmt, proof) === true
        }),
        { numRuns: 50 }, // Adjust numRuns as needed
      )
    })
  })

  describe("Tampering Tests", () => {
    let originalX: Scalar
    let originalStmt: Statement
    let originalProof: Proof

    beforeEach(() => {
      originalX = randScalar()
      const { stmt, proof } = proveFS(originalX)
      originalStmt = stmt
      originalProof = proof
    })

    it("should fail if the response 'e' is a different valid scalar", () => {
      let tampered_e = randScalar()
      while (tampered_e === originalProof.e) {
        // Ensure it's different
        tampered_e = randScalar()
      }
      const tamperedProof = { ...originalProof, e: tampered_e }
      expect(verify(originalStmt, tamperedProof)).toBe(false)
    })

    it("should fail if the challenge 'c' is a different valid scalar", () => {
      let tampered_c = randScalar()
      while (tampered_c === originalProof.c) {
        // Ensure it's different
        tampered_c = randScalar()
      }
      const tamperedProof = { ...originalProof, c: tampered_c }
      expect(verify(originalStmt, tamperedProof)).toBe(false)
    })

    it("should fail if commitment P is a different valid point", () => {
      const r_prime = randScalar()
      const tampered_P = G.multiply(r_prime)
      // Ensure tampered_P is actually different from originalProof.P if r_prime happens to match original r.
      // This is unlikely but good for robustness.
      if (tampered_P.equals(originalProof.P)) {
        // This case should ideally not happen often with random scalars.
        // If it does, the test might need a loop like for e and c, or accept this rare pass.
        // For now, we assume randScalar() gives enough variety.
      }
      const tamperedProof = { ...originalProof, P: tampered_P }
      expect(verify(originalStmt, tamperedProof)).toBe(false)
    })

    it("should fail if commitment Q is a different valid point (not H*r_prime_for_P)", () => {
      // Tamper Q to be H * r_double_prime, where r_double_prime is different from the r used for P in original proof
      const r_double_prime = randScalar()
      const tampered_Q = H.multiply(r_double_prime)
      if (tampered_Q.equals(originalProof.Q)) {
        /* similar to P tampering */
      }
      const tamperedProof = { ...originalProof, Q: tampered_Q }
      expect(verify(originalStmt, tamperedProof)).toBe(false)
    })

    it("should fail if statement U is a different valid point", () => {
      const x_prime = randScalar()
      const tampered_U = G.multiply(x_prime)
      if (tampered_U.equals(originalStmt.U)) {
        /* similar to P tampering */
      }
      const tamperedStmt = { ...originalStmt, U: tampered_U }
      expect(verify(tamperedStmt, originalProof)).toBe(false)
    })

    it("should fail if statement V is a different valid point (not H*x_prime_for_U)", () => {
      const x_double_prime = randScalar()
      const tampered_V = H.multiply(x_double_prime)
      if (tampered_V.equals(originalStmt.V)) {
        /* similar to P tampering */
      }
      const tamperedStmt = { ...originalStmt, V: tampered_V }
      expect(verify(tamperedStmt, originalProof)).toBe(false)
    })
  })

  it("interactive protocol steps should combine correctly", () => {
    const x = randScalar()
    const r_prover = randScalar()

    // Prover commits using their chosen nonce r_prover
    const { commit: commitment_object, nonce: returned_nonce } =
      cpCommit(r_prover)
    expect(returned_nonce).toBe(r_prover)

    // Verifier (or transcript) generates challenge
    // For simulation, let's make U and V to generate a realistic challenge based on x
    const U = G.multiply(x)
    const V = H.multiply(x)
    const c_verifier = cpGenerateChallenge(
      commitment_object.P,
      commitment_object.Q,
      U,
      V,
    )

    // Prover responds using the original secret x, their chosen nonce r_prover, and verifier's challenge c_verifier
    const e_prover = cpRespond(x, r_prover, c_verifier)

    // Verifier verifies
    const statementForVerify = { U, V }
    const proofForVerify = { ...commitment_object, c: c_verifier, e: e_prover }
    expect(verify(statementForVerify, proofForVerify)).toBe(true)
  })
})
