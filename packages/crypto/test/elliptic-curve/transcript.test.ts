import { describe, expect, it } from "bun:test"
import { generateChallenge, serializePointForTranscript } from "../../src/elliptic-curve/chaum-pedersen/transcript"
import { G, H } from "../../src/elliptic-curve/chaum-pedersen"


// Deterministic challenge for fixed inputs
const P = G.multiply(1n)
const Q = H.multiply(1n)
const U = G.multiply(2n)
const V = H.multiply(2n)
const expected = generateChallenge(P, Q, U, V)

describe("Chaum-Pedersen transcript", () => {
  it("serializePointForTranscript returns x and y parity", () => {
    const [x, parity] = serializePointForTranscript(P)
    expect(x).toBe(P.toAffine().x)
    expect(parity === 0n || parity === 1n).toBe(true)
  })

  it("generateChallenge is deterministic", () => {
    const c1 = generateChallenge(P, Q, U, V)
    const c2 = generateChallenge(P, Q, U, V)
    expect(c1).toBe(c2)
    expect(typeof c1).toBe("bigint")
  })

  it("challenge changes when inputs change", () => {
    const alt = generateChallenge(P, Q, G.multiply(3n), V)
    expect(alt).not.toBe(expected)
  })
})
