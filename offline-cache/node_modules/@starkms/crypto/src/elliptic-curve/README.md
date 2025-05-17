# Starknet Elliptic Curve Primitives

This module provides a set of utility functions for performing common elliptic curve cryptography (ECC) operations on the Starknet curve (`stark_curve`). It leverages the `starknet.js` library for the underlying computations.

These primitives are designed to be used by higher-level cryptographic protocols or for direct ECC operations within the Starknet ecosystem.

## Features

- Generate cryptographically secure random scalars (private keys).
- Derive public keys (compressed or uncompressed) from private keys.
- Perform scalar multiplication (`k * P`).
- Perform point addition (`P1 + P2`).
- Retrieve the Starknet curve's generator point (`G`).

## API

All functions accept and return values primarily as 0x-prefixed hexadecimal strings. Points are typically handled in their uncompressed form (`0x04` prefix followed by x and y coordinates) unless specified otherwise (e.g., for compressed public keys or base point retrieval).

### `generateRandomScalarStarknet(): string`

Generates a cryptographically secure random scalar suitable for use as a private key on the Starknet elliptic curve.

- **Returns**: `string` - A random scalar as a 0x-prefixed hex string (e.g., `"0x..."`). The scalar is guaranteed to be `> 0` and `< CURVE_ORDER`.

**Example:**
```typescript
import { generateRandomScalarStarknet } from './starknet-curve';

const privateKey = generateRandomScalarStarknet();
console.log("Private Key:", privateKey);
// Output: Private Key: 0x... (a long hex string)
```

### `getPublicKeyStarknet(privateKeyHex: string, compressed: boolean = false): string`

Derives the public key from a private key on the Starknet elliptic curve.

- **Parameters**:
  - `privateKeyHex: string` - The private key as a 0x-prefixed hex string.
  - `compressed: boolean` (optional, default: `false`) - Whether to return the compressed public key. 
    - `false` (default): Uncompressed format `"0x04" + x_coord + y_coord`.
    - `true`: Compressed format `"0x02" or "0x03" + x_coord`.
- **Returns**: `string` - The public key as a 0x-prefixed hex string.

**Example:**
```typescript
import { getPublicKeyStarknet, generateRandomScalarStarknet } from './starknet-curve';

const privateKey = generateRandomScalarStarknet();
const publicKeyUncompressed = getPublicKeyStarknet(privateKey);
const publicKeyCompressed = getPublicKeyStarknet(privateKey, true);

console.log("Uncompressed Public Key:", publicKeyUncompressed);
console.log("Compressed Public Key:", publicKeyCompressed);
```

### `getBasePointStarknet(compressed: boolean = false): string`

Retrieves the generator point (base point `G`) of the Starknet elliptic curve.

- **Parameters**:
  - `compressed: boolean` (optional, default: `false`) - Whether to return the compressed base point.
- **Returns**: `string` - The base point `G` as a 0x-prefixed hex string.

**Example:**
```typescript
import { getBasePointStarknet } from './starknet-curve';

const G_uncompressed = getBasePointStarknet();
const G_compressed = getBasePointStarknet(true);

console.log("G (Uncompressed):", G_uncompressed);
console.log("G (Compressed):", G_compressed);
```

### `scalarMultiplyStarknet(scalarHex: string, pointHex: string): string`

Performs scalar multiplication (`k * P`) on the Starknet elliptic curve.

- **Parameters**:
  - `scalarHex: string` - The scalar `k` as a 0x-prefixed hex string.
  - `pointHex: string` - The elliptic curve point `P` as a 0x-prefixed hex string (can be uncompressed or compressed).
- **Returns**: `string` - The resulting point (`k * P`) as an uncompressed 0x-prefixed hex string (`"0x04" + x + y`).

**Example:**
```typescript
import { scalarMultiplyStarknet, getBasePointStarknet, generateRandomScalarStarknet } from './starknet-curve';

const privateKey = generateRandomScalarStarknet(); // This is our scalar k
const G = getBasePointStarknet(); // This is our point P

// This is equivalent to deriving the public key
const publicKey = scalarMultiplyStarknet(privateKey, G);
console.log("k * G:", publicKey);
```

### `addPointsStarknet(point1Hex: string, point2Hex: string): string`

Adds two elliptic curve points (`P1 + P2`) on the Starknet elliptic curve.

- **Parameters**:
  - `point1Hex: string` - The first point `P1` as a 0x-prefixed hex string (uncompressed or compressed).
  - `point2Hex: string` - The second point `P2` as a 0x-prefixed hex string (uncompressed or compressed).
- **Returns**: `string` - The resulting point (`P1 + P2`) as an uncompressed 0x-prefixed hex string (`"0x04" + x + y`).

**Example:**
```typescript
import { addPointsStarknet, getPublicKeyStarknet, generateRandomScalarStarknet } from './starknet-curve';

const priv1 = generateRandomScalarStarknet();
const pub1 = getPublicKeyStarknet(priv1);

const priv2 = generateRandomScalarStarknet();
const pub2 = getPublicKeyStarknet(priv2);

const sumOfPubs = addPointsStarknet(pub1, pub2);
console.log("Public Key 1 + Public Key 2:", sumOfPubs);
```

## Notes

- The functions rely on `starknet.js` for actual elliptic curve calculations. Ensure `starknet` is a dependency in your project.
- Input hex strings for keys and points must be 0x-prefixed.
- Points provided as input (e.g., to `scalarMultiplyStarknet`, `addPointsStarknet`) can typically be in compressed or uncompressed hex format. The output points from these functions are generally uncompressed.
- Error handling for invalid inputs (e.g., points not on the curve, scalars out of range) is largely delegated to the underlying `starknet.js` library, which may throw errors. 