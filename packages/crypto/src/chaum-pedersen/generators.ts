import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils"
import { G, POINT_AT_INFINITY, type Point, moduloOrder } from "../core/curve"

// The secondary generator H is derived from a domain separation tag using SHA-256.
// This ensures that the discrete logarithm log_G(H) is unknown.
// H = h * G, where h = SHA256("starkex.chaum-pedersen.H.v1") % CURVE_ORDER.

const domainTag = "starkex.chaum-pedersen.H.v1"
const hashedDomainTag = sha256(utf8ToBytes(domainTag)) // Output is Uint8Array
const h_scalar_bigint = BigInt(`0x${bytesToHex(hashedDomainTag)}`)

// Reduce h modulo CURVE_ORDER
const h = moduloOrder(h_scalar_bigint)

// Validate h
if (h === 0n) {
  // This is extremely unlikely for a cryptographic hash function and large curve order.
  // If this occurs, it indicates a problem with the hash function, domain tag, or curve order.
  // A production system might implement a strategy like appending a counter to the domain tag and re-hashing.
  throw new Error(
    "Scalar h for H generation is zero after hashing the domain tag. This should not happen.",
  )
}

// Compute H
export const H: Point = G.multiply(h)

// Validate H
if (H.equals(POINT_AT_INFINITY)) {
  // This is also extremely unlikely if h is not zero and G is a valid generator.
  throw new Error(
    "Generated H is the point at infinity. This should not happen with a valid h and G.",
  )
}

if (H.equals(G)) {
  // This implies h = 1 mod CURVE_ORDER.
  // While possible, it's highly improbable if h is derived from a cryptographic hash of a fixed string.
  // If this occurs, it might indicate a vulnerability or an issue with the chosen domain tag.
  throw new Error(
    "Generated H is equal to G. This is highly unlikely and may indicate an issue.",
  )
}
