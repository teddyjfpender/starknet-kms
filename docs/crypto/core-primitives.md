# Core Primitives API (`core/curve.ts`)

This module provides the foundational, low-level functions for elliptic curve operations on the Starknet curve. It works directly with `Scalar` (`bigint`) and `Point` (`ProjectivePoint` instance) types, providing the building blocks for higher-level protocols and APIs.

## Types

*   `Scalar = bigint`: Represents scalars (private keys, hash outputs, etc.).
*   `Point = InstanceType<typeof ec.starkCurve.ProjectivePoint>`: Represents points on the curve.

## Constants

*   `CURVE_ORDER: Scalar`: The order `n` of the curve's subgroup.
*   `PRIME: Scalar`: The prime `p` of the underlying field Fp.
*   `G: Point`: The standard generator point.
*   `POINT_AT_INFINITY: Point`: The point at infinity (identity element).

## Scalar Operations

### `randScalar(): Scalar`

Generates a cryptographically secure random scalar `k` such that `1 <= k < CURVE_ORDER`.
Uses `starknet.js`'s underlying CSPRNG.

*   **Returns:** A random `Scalar` (bigint).

### `moduloOrder(value: Scalar): Scalar`

Reduces a `Scalar` (bigint) modulo the `CURVE_ORDER`.
Ensures the result is in the range `[0, CURVE_ORDER - 1]`.

*   **Parameters:**
    *   `value: Scalar` - The scalar to reduce.
*   **Returns:** `value % CURVE_ORDER` as a non-negative `Scalar`.

## Point Operations

### `getPublicKey(privateKey: Scalar): Point`

Derives the public key `Point` corresponding to a given private key `Scalar`.
Calculates `privateKey * G`.
Handles invalid private keys (0 or >= `CURVE_ORDER`) by returning the `POINT_AT_INFINITY`.

*   **Parameters:**
    *   `privateKey: Scalar` - The private key.
*   **Returns:** The corresponding public key `Point`.

### `scalarMultiply(scalar: Scalar, point: Point): Point`

Performs scalar multiplication: `scalar * point`.
Handles `scalar = 0` or multiples of `CURVE_ORDER` (returns `POINT_AT_INFINITY`).
Handles `point = POINT_AT_INFINITY` (returns `POINT_AT_INFINITY`).

*   **Parameters:**
    *   `scalar: Scalar` - The scalar multiplier.
    *   `point: Point` - The point to multiply.
*   **Returns:** The resulting `Point`.

### `addPoints(point1: Point, point2: Point): Point`

Adds two curve points: `point1 + point2`.
Handles addition with `POINT_AT_INFINITY` correctly (`P + O = P`).

*   **Parameters:**
    *   `point1: Point` - The first point.
    *   `point2: Point` - The second point.
*   **Returns:** The resulting sum `Point`.

### `negatePoint(point: Point): Point`

Negates a curve point `P`, returning `-P`.
Handles negation of `POINT_AT_INFINITY` (`-O = O`).

*   **Parameters:**
    *   `point: Point` - The point to negate.
*   **Returns:** The negated `Point`.

### `arePointsEqual(point1: Point, point2: Point): boolean`

Checks if two points are identical.

*   **Parameters:**
    *   `point1: Point` - The first point.
    *   `point2: Point` - The second point.
*   **Returns:** `true` if equal, `false` otherwise.

### `assertPointValidity(point: Point): void`

*Experimental:* Attempts to assert that a point is valid on the Starknet curve (e.g., coordinates satisfy curve equation, not the point at infinity unless specifically handled).
Relies on the underlying `starknet.js` point object potentially having an `assertValidity` method (availability may depend on version).
*Currently includes a fallback if the method isn't present.* Throws an error if the point is found to be invalid by the underlying check.

*   **Parameters:**
    *   `point: Point` - The point to validate.
*   **Throws:** Error if the point is invalid.

## Conversion Utilities

### `bigIntToHex(value: Scalar): string`

Converts a `Scalar` (bigint) to its 0x-prefixed hex string representation.

*   **Parameters:**
    *   `value: Scalar` - The scalar to convert.
*   **Returns:** Hex string.

### `hexToBigInt(value: string): Scalar`

Converts a 0x-prefixed hex string to a `Scalar` (bigint).

*   **Parameters:**
    *   `value: string` - The hex string to convert.
*   **Returns:** `Scalar` (bigint).

### `pointToHex(point: Point, compressed: boolean = false): string`

Converts a `Point` to its 0x-prefixed hex string representation.
Handles `POINT_AT_INFINITY` appropriately.

*   **Parameters:**
    *   `point: Point` - The point to convert.
    *   `compressed: boolean` (optional, default: `false`) - Use compressed format (`0x02`/`0x03` prefix) or uncompressed (`0x04` prefix).
*   **Returns:** Hex string representation.

### `hexToPoint(hex: string): Point`

Converts a 0x-prefixed hex string to a `Point`.
Handles hex representations of `POINT_AT_INFINITY` (`0x00` or uncompressed zero point).
Uses `starknet.js`'s `ProjectivePoint.fromHex`, which includes curve validity checks.

*   **Parameters:**
    *   `hex: string` - The hex string to convert.
*   **Returns:** The corresponding `Point`.
*   **Throws:** Error if `hex` is invalid or not on the curve.

## Hashing Utilities

### `poseidonHashScalars(elements: Scalar[]): Scalar`

Computes the Poseidon hash of an array of `Scalar` values.

*   **Parameters:**
    *   `elements: Scalar[]` - Array of scalars to hash.
*   **Returns:** The resulting hash as a `Scalar`. 