import { bytesToHex }                    from "@noble/hashes/utils";
import {
  CURVE,
  ProjectivePoint,                      // <- real class name
  utils as starkUtils,
  poseidonHashMany
} from "@scure/starknet";

/* ---------- local helpers (tiny, zero-dep) -------------------------------- */
const addHexPrefix    = (h: string) => (h.startsWith("0x") ? h : `0x${h}`);
const removeHexPrefix = (h: string) => h.replace(/^0x/i, "");
const buf2hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/* -------------------------- public re-exports ------------------------------ */
export type Scalar = bigint;
export type Point  = ProjectivePoint;          // keep old name available

export const CURVE_ORDER              = CURVE.n;
export const PRIME                    = CURVE.p;
export const G: Point                 = ProjectivePoint.BASE;
export const POINT_AT_INFINITY: Point = ProjectivePoint.ZERO;

/* --------------------------- scalar helpers -------------------------------- */
export const moduloOrder = (x: Scalar): Scalar =>
  ((x % CURVE_ORDER) + CURVE_ORDER) % CURVE_ORDER;

export function randScalar(): Scalar {
  let k: Scalar;
  do {
    k = BigInt("0x" + bytesToHex(starkUtils.randomPrivateKey())) % CURVE_ORDER;
  } while (k === 0n);
  return k;
}

/* --------------------------- point helpers --------------------------------- */
export const getPublicKey = (priv: Scalar): Point =>
  priv === 0n ? POINT_AT_INFINITY : G.multiply(moduloOrder(priv));

export const scalarMultiply = (k: Scalar, P: Point): Point => {
  const kMod = moduloOrder(k);                 // 0 ≤ kMod < n
  if (kMod === 0n || P.equals(POINT_AT_INFINITY))
    return POINT_AT_INFINITY;                  // cover k = 0 or n
  return P.multiply(kMod);
};

export const addPoints = (P: Point, Q: Point): Point =>
  P.equals(POINT_AT_INFINITY) ? Q :
  Q.equals(POINT_AT_INFINITY) ? P : P.add(Q);

export const negatePoint = (P: Point): Point =>
  P.equals(POINT_AT_INFINITY) ? POINT_AT_INFINITY : P.negate();

export const arePointsEqual = (P: Point, Q: Point) => P.equals(Q);

export const assertPointValidity = (P: Point) => P.assertValidity?.();

/* --------------------------- conversions ----------------------------------- */
export const bigIntToHex = (x: Scalar) => addHexPrefix(x.toString(16));
export const hexToBigInt = (h: string): Scalar => BigInt(addHexPrefix(removeHexPrefix(h)));
export function pointToHex(P: Point, compressed = false): string {
  if (P.equals(POINT_AT_INFINITY))
    return compressed ? "0x00" : `0x04${"00".repeat(64)}`;
  return addHexPrefix(buf2hex(P.toRawBytes(compressed)));
}

export const hexToPoint = (h: string): Point =>
  h === "0x00" || h === `0x04${"00".repeat(64)}`
    ? POINT_AT_INFINITY
    : ProjectivePoint.fromHex(removeHexPrefix(h));

/* --------------------------- Poseidon wrapper ------------------------------ */
export const poseidonHashScalars = (xs: Scalar[]): Scalar =>
  poseidonHashMany(xs.map(moduloOrder)) % CURVE_ORDER;
