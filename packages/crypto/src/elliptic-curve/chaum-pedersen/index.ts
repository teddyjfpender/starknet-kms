export type {
  Statement,
  InteractiveCommit,
  Proof,
} from "./chaum-pedersen"
export {
  commit,
  respond,
  proveFS,
  verify,
} from "./chaum-pedersen"

// Re-exporting from the new core path
export type { Point, Scalar } from "../core/curve"
export {
  G,
  CURVE_ORDER,
  PRIME,
  randScalar,
  moduloOrder as toFr, // Optionally re-alias moduloOrder back to toFr if external API expects it
  // For now, let's use moduloOrder to be consistent with internal changes.
  moduloOrder,
} from "../core/curve"

export { H } from "./generators" // hashToScalarForGenerator was removed as H is now opaque
export { generateChallenge, serializePointForTranscript } from "./transcript"
