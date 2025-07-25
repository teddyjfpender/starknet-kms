import { beforeEach, describe, expect, it } from "bun:test"
import * as fc from "fast-check"
import {
  CURVE_ORDER,
  G,
  POINT_AT_INFINITY,
  type Point,
  moduloOrder,
} from "../../src/core/curve"

import {
  H, // Ensured import from generators
} from "../../src/chaum-pedersen/generators"

import {
  type Proof,
  type Statement,
  commit as cpCommit,
  generateChallenge as cpGenerateChallenge,
  respond as cpRespond,
  decodeProof,
  encodeProof,
  proveFS,
  verify,
} from "../../src/chaum-pedersen" // Imports from main index
import type { Scalar } from "../../src/core/curve"

import { randScalar } from "../../src/core"

import {
  generateChallenge,
  serializePointForTranscript,
} from "../../src/chaum-pedersen/transcript"

// Helper to generate a valid scalar for fast-check (1 <= x < CURVE_ORDER)
const fcScalar = fc.bigInt(1n, CURVE_ORDER - 1n)
// Helper to generate a scalar that could be 0 or CURVE_ORDER for specific tests
//const fcInvalidScalar = fc.constantFrom(0n, CURVE_ORDER)

// Helper to generate a random point for tampering tests
const randPoint = (): Point => G.multiply(randScalar())

describe("Chaum-Pedersen ZKP Implementation", () => {
  describe("Generator H", () => {
    it("H should not be the point at infinity", () => {
      expect(H.equals(POINT_AT_INFINITY)).toBe(false)
    })

    it("H should not be equal to G", () => {
      expect(H.equals(G)).toBe(false)
    })

    it("H should be a valid point on the curve", () => {
      expect(() => H.assertValidity()).not.toThrow()
    })
  })

  describe("Input Validation", () => {
    describe("commit() validation", () => {
      it("should reject zero nonce", () => {
        expect(() => cpCommit(0n)).toThrow("nonce r must be in range [1")
      })

      it("should reject CURVE_ORDER nonce", () => {
        expect(() => cpCommit(CURVE_ORDER)).toThrow(
          "nonce r must be in range [1",
        )
      })

      it("should reject negative nonce", () => {
        expect(() => cpCommit(-1n)).toThrow("nonce r must be in range [1")
      })

      it("should reject non-bigint nonce", () => {
        expect(() => cpCommit(42 as any)).toThrow("nonce r must be a bigint")
      })
    })

    describe("respond() validation", () => {
      const validX = randScalar()
      const validR = randScalar()
      const validC = randScalar()

      it("should reject zero secret x", () => {
        expect(() => cpRespond(0n, validR, validC)).toThrow(
          "secret x must be in range [1",
        )
      })

      it("should reject zero nonce r", () => {
        expect(() => cpRespond(validX, 0n, validC)).toThrow(
          "nonce r must be in range [1",
        )
      })

      it("should accept zero challenge c", () => {
        expect(() => cpRespond(validX, validR, 0n)).not.toThrow()
      })

      it("should reject CURVE_ORDER challenge c", () => {
        expect(() => cpRespond(validX, validR, CURVE_ORDER)).toThrow(
          "challenge c must be in range [0",
        )
      })

      it("should reject non-bigint inputs", () => {
        expect(() => cpRespond("invalid" as any, validR, validC)).toThrow(
          "secret x must be a bigint",
        )
        expect(() => cpRespond(validX, "invalid" as any, validC)).toThrow(
          "nonce r must be a bigint",
        )
        expect(() => cpRespond(validX, validR, "invalid" as any)).toThrow(
          "challenge c must be a bigint",
        )
      })
    })

    describe("proveFS() validation", () => {
      it("should reject zero secret", () => {
        expect(() => proveFS(0n)).toThrow("secret x must be in range [1")
      })

      it("should reject CURVE_ORDER secret", () => {
        expect(() => proveFS(CURVE_ORDER)).toThrow(
          "secret x must be in range [1",
        )
      })

      it("should reject non-bigint secret", () => {
        expect(() => proveFS("invalid" as any)).toThrow(
          "secret x must be a bigint",
        )
      })
    })

    describe("verify() validation", () => {
      let validStmt: Statement
      let validProof: Proof

      beforeEach(() => {
        const { stmt, proof } = proveFS(randScalar())
        validStmt = stmt
        validProof = proof
      })

      it("should reject null/undefined statement", () => {
        expect(verify(null as any, validProof)).toBe(false)
        expect(verify(undefined as any, validProof)).toBe(false)
      })

      it("should reject null/undefined proof", () => {
        expect(verify(validStmt, null as any)).toBe(false)
        expect(verify(validStmt, undefined as any)).toBe(false)
      })

      it("should reject statement with point at infinity", () => {
        expect(verify({ ...validStmt, U: POINT_AT_INFINITY }, validProof)).toBe(
          false,
        )
        expect(verify({ ...validStmt, V: POINT_AT_INFINITY }, validProof)).toBe(
          false,
        )
      })

      it("should reject proof with point at infinity", () => {
        expect(verify(validStmt, { ...validProof, P: POINT_AT_INFINITY })).toBe(
          false,
        )
        expect(verify(validStmt, { ...validProof, Q: POINT_AT_INFINITY })).toBe(
          false,
        )
      })

      it("should reject proof with invalid scalars", () => {
        expect(verify(validStmt, { ...validProof, c: -1n })).toBe(false)
        expect(verify(validStmt, { ...validProof, c: CURVE_ORDER })).toBe(false)
        expect(verify(validStmt, { ...validProof, e: 0n })).toBe(false)
        expect(verify(validStmt, { ...validProof, e: CURVE_ORDER })).toBe(false)
      })
    })

    describe("encodeProof() validation", () => {
      it("should reject null/undefined proof", () => {
        expect(() => encodeProof(null as any)).toThrow(
          "Proof cannot be null or undefined",
        )
        expect(() => encodeProof(undefined as any)).toThrow(
          "Proof cannot be null or undefined",
        )
      })

      it("should reject proof with invalid points", () => {
        const validProof = proveFS(randScalar()).proof
        expect(() =>
          encodeProof({ ...validProof, P: POINT_AT_INFINITY }),
        ).toThrow("Proof.P cannot be the point at infinity")
      })
    })

    describe("decodeProof() validation", () => {
      it("should validate decoded proof", () => {
        // Create invalid encoded data with point at infinity coordinates
        const invalidEncoded = new Uint8Array(192)
        invalidEncoded.fill(0) // All zeros = point at infinity

        expect(() => decodeProof(invalidEncoded)).toThrow(
          "Failed to decode proof",
        )
      })
    })
  })

  describe("Transcript Validation", () => {
    describe("serializePointForTranscript() validation", () => {
      it("should reject null/undefined point", () => {
        expect(() => serializePointForTranscript(null as any)).toThrow(
          "Point cannot be null or undefined",
        )
        expect(() => serializePointForTranscript(undefined as any)).toThrow(
          "Point cannot be null or undefined",
        )
      })

      it("should reject point at infinity", () => {
        expect(() => serializePointForTranscript(POINT_AT_INFINITY)).toThrow(
          "Point at infinity cannot be serialized",
        )
      })

      it("should serialize valid points correctly", () => {
        const P = G.multiply(randScalar())
        const serialized = serializePointForTranscript(P)
        expect(serialized).toHaveLength(2)
        expect(typeof serialized[0]).toBe("bigint")
        expect(typeof serialized[1]).toBe("bigint")
        expect(serialized[1]).toBeGreaterThanOrEqual(0n)
        expect(serialized[1]).toBeLessThanOrEqual(1n) // y-parity is 0 or 1
      })
    })

    describe("generateChallenge() validation", () => {
      it("should reject empty point array", () => {
        expect(() => generateChallenge()).toThrow(
          "At least one point is required",
        )
      })

      it("should reject array with invalid points", () => {
        expect(() => generateChallenge(POINT_AT_INFINITY)).toThrow(
          "Failed to generate challenge",
        )
      })

      it("should generate consistent challenges", () => {
        const P = G.multiply(randScalar())
        const Q = H.multiply(randScalar())
        const c1 = generateChallenge(P, Q)
        const c2 = generateChallenge(P, Q)
        expect(c1).toEqual(c2)
      })
    })
  })

  describe("Core ZKP Protocol (Fiat-Shamir)", () => {
    it("should succeed for a valid proof (basic round-trip)", () => {
      const x: Scalar = randScalar()
      const { stmt, proof } = proveFS(x)
      expect(verify(stmt, proof)).toBe(true)
    })

    describe("Property-Based Tests for proveFS and verify", () => {
      it("should verify for any valid secret x", () => {
        fc.assert(
          fc.property(fcScalar, (x) => {
            const { stmt, proof } = proveFS(x)
            return verify(stmt, proof) === true
          }),
          { numRuns: 20 }, // Reduced for speed in CI, increase for thoroughness
        )
      })
    })
  })

  describe("Interactive Protocol Components", () => {
    it("interactive steps (commit, respond, generateChallenge) should combine correctly", () => {
      const x = randScalar()
      const r_prover = randScalar()

      const { commit: commitment_object, nonce: returned_nonce } =
        cpCommit(r_prover)
      expect(returned_nonce).toBe(r_prover)

      const U = G.multiply(x)
      const V = H.multiply(x)
      const c_verifier = cpGenerateChallenge(
        commitment_object.P,
        commitment_object.Q,
        U,
        V,
      )

      const e_prover = cpRespond(x, r_prover, c_verifier)

      const statementForVerify = { U, V }
      const proofForVerify = {
        ...commitment_object,
        c: c_verifier,
        e: e_prover,
      }
      expect(verify(statementForVerify, proofForVerify)).toBe(true)
    })

    describe("Property-Based Tests for Interactive Components", () => {
      it("respond(x, r, c) should be sensitive to changes in x, r, c", () => {
        fc.assert(
          fc.property(
            fcScalar,
            fcScalar,
            fcScalar,
            fcScalar,
            fcScalar,
            fcScalar,
            (x1, r1, c1, dx, dr, dc) => {
              // Ensure deltas are non-zero modulo CURVE_ORDER
              const delta_x = dx === 0n ? 1n : dx
              const delta_r = dr === 0n ? 1n : dr
              const delta_c = dc === 0n ? 1n : dc

              const e1 = cpRespond(x1, r1, c1)

              const x2 = moduloOrder(x1 + delta_x)
              if (x1 !== x2) {
                expect(cpRespond(x2, r1, c1)).not.toEqual(e1)
              }

              const r2 = moduloOrder(r1 + delta_r)
              if (r1 !== r2) {
                expect(cpRespond(x1, r2, c1)).not.toEqual(e1)
              }

              const c2 = moduloOrder(c1 + delta_c)
              if (c1 !== c2) {
                expect(cpRespond(x1, r1, c2)).not.toEqual(e1)
              }
            },
          ),
          { numRuns: 10 }, // Reduced for CI
        )
      })

      it("generateChallenge should be sensitive to changes in input points", () => {
        fc.assert(
          fc.property(
            fcScalar,
            fcScalar,
            fcScalar,
            fcScalar,
            fcScalar,
            (rP, rQ, rU, rV, rPerturb) => {
              const P1 = G.multiply(rP)
              const Q1 = H.multiply(rQ) // Using H for Q
              const U1 = G.multiply(rU)
              const V1 = H.multiply(rV) // Using H for V

              const c1 = cpGenerateChallenge(P1, Q1, U1, V1)

              // Perturb P1
              const P2 = P1.add(G.multiply(rPerturb)) // Add a random point
              if (!P1.equals(P2)) {
                expect(cpGenerateChallenge(P2, Q1, U1, V1)).not.toEqual(c1)
              }
              // Perturb Q1
              const Q2 = Q1.add(H.multiply(rPerturb))
              if (!Q1.equals(Q2)) {
                expect(cpGenerateChallenge(P1, Q2, U1, V1)).not.toEqual(c1)
              }
              // Perturb U1
              const U2 = U1.add(G.multiply(rPerturb))
              if (!U1.equals(U2)) {
                expect(cpGenerateChallenge(P1, Q1, U2, V1)).not.toEqual(c1)
              }
              // Perturb V1
              const V2 = V1.add(H.multiply(rPerturb))
              if (!V1.equals(V2)) {
                expect(cpGenerateChallenge(P1, Q1, U1, V2)).not.toEqual(c1)
              }
            },
          ),
          { numRuns: 5 }, // Reduced for CI, each run does multiple checks
        )
      })
    })
  })

  describe("Negative Tests (Tampering and Invalid Inputs)", () => {
    let originalX: Scalar
    let originalStmt: Statement
    let originalProof: Proof

    beforeEach(() => {
      originalX = randScalar()
      const { stmt, proof } = proveFS(originalX)
      originalStmt = stmt
      originalProof = proof
      expect(verify(originalStmt, originalProof)).toBe(true) // Sanity check
    })

    it("should fail if response 'e' is a different valid scalar", () => {
      let tampered_e = randScalar()
      while (tampered_e === originalProof.e) tampered_e = randScalar()
      expect(verify(originalStmt, { ...originalProof, e: tampered_e })).toBe(
        false,
      )
    })

    it("should fail if challenge 'c' is a different valid scalar", () => {
      let tampered_c = randScalar()
      while (tampered_c === originalProof.c) tampered_c = randScalar()
      expect(verify(originalStmt, { ...originalProof, c: tampered_c })).toBe(
        false,
      )
    })

    it("should fail if commitment P is a different valid point", () => {
      const tampered_P = G.multiply(randScalar())
      if (tampered_P.equals(originalProof.P)) return // Skip if unlucky
      expect(verify(originalStmt, { ...originalProof, P: tampered_P })).toBe(
        false,
      )
    })

    it("should fail if commitment Q is a different valid point", () => {
      const tampered_Q = H.multiply(randScalar())
      if (tampered_Q.equals(originalProof.Q)) return // Skip if unlucky
      expect(verify(originalStmt, { ...originalProof, Q: tampered_Q })).toBe(
        false,
      )
    })

    it("should fail if statement U is a different valid point", () => {
      const tampered_U = G.multiply(randScalar())
      if (tampered_U.equals(originalStmt.U)) return // Skip if unlucky
      expect(verify({ ...originalStmt, U: tampered_U }, originalProof)).toBe(
        false,
      )
    })

    it("should fail if statement V is a different valid point", () => {
      const tampered_V = H.multiply(randScalar())
      if (tampered_V.equals(originalStmt.V)) return // Skip if unlucky
      expect(verify({ ...originalStmt, V: tampered_V }, originalProof)).toBe(
        false,
      )
    })

    it("should fail if scalar e is 0n", () => {
      expect(verify(originalStmt, { ...originalProof, e: 0n })).toBe(false)
    })
    it("should fail if scalar e is CURVE_ORDER", () => {
      // Point multiplication by CURVE_ORDER is point at infinity for G,H
      // So eG = 0, eH = 0.  P + cU and Q + cV are unlikely to be 0.
      expect(verify(originalStmt, { ...originalProof, e: CURVE_ORDER })).toBe(
        false,
      )
    })

    it("should pass if scalar c is 0n (eG=P, eH=Q must hold)", () => {
      // If c=0, then eG=P and eH=Q. This is rG=P, rH=Q.
      // This means e=r.
      // This is a valid proof scenario IF the challenge calculation somehow yields 0.
      // The verifier must accept it.
      const r_nonce = randScalar() // This is 'r' from the original commit
      const { commit } = cpCommit(r_nonce) // P, Q

      // To make verify(stmt, proof) pass with c=0, we need e=r_nonce
      // stmt.U and stmt.V can be anything for this specific check, as cU and cV will be zero.
      const proofWithCToZero = {
        P: commit.P,
        Q: commit.Q,
        c: 0n,
        e: r_nonce,
      }
      // Use originalStmt for U,V. These are xG, xH.
      // Verification becomes: rG = P + 0*U  (true since P=rG)
      //                      rH = Q + 0*V  (true since Q=rH)
      expect(verify(originalStmt, proofWithCToZero)).toBe(true)
    })

    it("should reject if scalar c is CURVE_ORDER (invalid range)", () => {
      const r_nonce = randScalar()
      const { commit } = cpCommit(r_nonce)
      const proofWithCToCurveOrder = {
        P: commit.P,
        Q: commit.Q,
        c: CURVE_ORDER, // Invalid - outside valid range [0, CURVE_ORDER-1]
        e: r_nonce,
      }
      // With our improved validation, this should be rejected
      expect(verify(originalStmt, proofWithCToCurveOrder)).toBe(false)
    })

    it("should fail if P in proof is point at infinity", () => {
      const proofWithPAtInfinity = {
        ...originalProof,
        P: POINT_AT_INFINITY,
      }
      expect(verify(originalStmt, proofWithPAtInfinity)).toBe(false)
    })
    it("should fail if Q in proof is point at infinity", () => {
      const proofWithQAtInfinity = {
        ...originalProof,
        Q: POINT_AT_INFINITY,
      }
      expect(verify(originalStmt, proofWithQAtInfinity)).toBe(false)
    })
    it("should fail if U in statement is point at infinity", () => {
      const stmtWithUAtInfinity = { ...originalStmt, U: POINT_AT_INFINITY }
      expect(verify(stmtWithUAtInfinity, originalProof)).toBe(false)
    })
    it("should fail if V in statement is point at infinity", () => {
      const stmtWithVAtInfinity = { ...originalStmt, V: POINT_AT_INFINITY }
      expect(verify(stmtWithVAtInfinity, originalProof)).toBe(false)
    })

    it("should fail for a completely random proof against a valid statement", () => {
      const randomProof: Proof = {
        P: randPoint(),
        Q: randPoint(),
        c: randScalar(),
        e: randScalar(),
      }
      expect(verify(originalStmt, randomProof)).toBe(false)
    })

    it("should fail for a proof of x1 against a statement for x2", () => {
      const x1 = randScalar()
      let x2 = randScalar()
      while (x1 === x2) x2 = randScalar()

      const { proof: proof_x1 } = proveFS(x1)
      const { stmt: stmt_x2 } = proveFS(x2)

      expect(verify(stmt_x2, proof_x1)).toBe(false)
    })
  })

  describe("Edge Case Tests for Secret x", () => {
    it("should succeed for secret x = 1n", () => {
      const { stmt, proof } = proveFS(1n)
      expect(verify(stmt, proof)).toBe(true)
    })

    it("should succeed for secret x = CURVE_ORDER - 1n", () => {
      const { stmt, proof } = proveFS(CURVE_ORDER - 1n)
      expect(verify(stmt, proof)).toBe(true)
    })
  })

  describe("Serialization (encodeProof / decodeProof)", () => {
    it("should correctly round-trip a valid proof via encode/decode", () => {
      fc.assert(
        fc.property(fcScalar, (x) => {
          const { stmt, proof: originalProof } = proveFS(x)
          const encodedProof = encodeProof(originalProof)
          const decodedProof = decodeProof(encodedProof)

          // Check point equality using .equals() method
          expect(decodedProof.P.equals(originalProof.P)).toBe(true)
          expect(decodedProof.Q.equals(originalProof.Q)).toBe(true)
          // Check scalar equality
          expect(decodedProof.c).toEqual(originalProof.c)
          expect(decodedProof.e).toEqual(originalProof.e)

          return verify(stmt, decodedProof) === true
        }),
        { numRuns: 10 }, // Reduced for CI
      )
    })

    it("decodeProof should throw for byte array of incorrect length (too short)", () => {
      const originalProof = proveFS(randScalar()).proof
      const encodedProof = encodeProof(originalProof)
      const shortBytes = encodedProof.slice(0, 191)
      expect(() => decodeProof(shortBytes)).toThrow(
        "Invalid byte array length for proof decoding. Expected 192, got 191",
      )
    })

    it("decodeProof should throw for byte array of incorrect length (too long)", () => {
      const originalProof = proveFS(randScalar()).proof
      const encodedProof = encodeProof(originalProof)
      const longBytes = new Uint8Array([...encodedProof, 0x00]) // Add an extra byte
      expect(() => decodeProof(longBytes)).toThrow(
        "Invalid byte array length for proof decoding. Expected 192, got 193",
      )
    })

    it("should fail verification or decoding if encoded proof bytes are tampered", () => {
      fc.assert(
        fc.property(
          fcScalar,
          fc.integer({ min: 0, max: 191 }),
          (x, tamperIdx) => {
            const { stmt, proof } = proveFS(x)
            const encodedProof = encodeProof(proof)
            const tamperedBytes = new Uint8Array(encodedProof) // Create a mutable copy
            tamperedBytes[tamperIdx] = tamperedBytes[tamperIdx]! ^ 0xff // Flip all bits at tamperIdx

            try {
              const decodedTamperedProof = decodeProof(tamperedBytes)
              // If decoding succeeded, verification must fail
              expect(verify(stmt, decodedTamperedProof)).toBe(false)
            } catch (e) {
              // If decoding failed (e.g. point not on curve), this is also a pass
              expect(e).toBeInstanceOf(Error)
            }
          },
        ),
        { numRuns: 20 }, // Reduced for CI
      )
    })
  })
})
