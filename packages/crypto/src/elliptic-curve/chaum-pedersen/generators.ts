import { utf8ToBytes } from "@noble/hashes/utils"
import { starkCurve } from "@noble/curves/stark"
import {
  G,
  POINT_AT_INFINITY,
  type Point,
} from "../core/curve"

/**
 * Deterministically derives the secondary generator `H` using the
 * `hashToCurve` helper from `@noble/curves/stark`. This avoids exposing a
 * known discrete-log relationship between `G` and `H`.
 */
const hashedPoint = starkCurve.ProjectivePoint.hashToCurve(
  utf8ToBytes("ChaumPedersen.H"),
)
export const H: Point = hashedPoint

// Sanity checks for the derived generator
if (H.equals(POINT_AT_INFINITY)) {
  throw new Error("Derived generator H is the point at infinity")
}
if (H.equals(G)) {
  console.warn(
    "Derived generator H unexpectedly equals G. Consider adjusting the domain string.",
  )
}
