import { poseidonHashMany } from "@scure/starknet"
import { type Scalar, moduloOrder, CURVE_ORDER } from "./scalar"

/**
 * Poseidon hash wrapper for scalars
 * Ensures all inputs are properly reduced modulo the curve order
 * and the result is also reduced modulo the curve order
 */
export const poseidonHashScalars = (xs: Scalar[]): Scalar =>
  poseidonHashMany(xs.map(moduloOrder)) % CURVE_ORDER 