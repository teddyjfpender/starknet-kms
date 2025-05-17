import { describe, expect, it } from "bun:test"
import { utf8ToBytes } from "@noble/hashes/utils"
import { starkCurve } from "@noble/curves/stark"
import { G, H, POINT_AT_INFINITY } from "../../src/elliptic-curve/chaum-pedersen/generators"

// Ensure the exported H matches a fresh hashToCurve computation
const expectedH = starkCurve.ProjectivePoint.hashToCurve(
  utf8ToBytes("ChaumPedersen.H"),
)

describe("Chaum-Pedersen generators", () => {
  it("derives H deterministically via hashToCurve", () => {
    expect(H.equals(expectedH)).toBe(true)
  })

  it("H is a valid generator distinct from G and infinity", () => {
    expect(H.equals(POINT_AT_INFINITY)).toBe(false)
    expect(H.equals(G)).toBe(false)
  })
})
