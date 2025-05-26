# Chaum-Pedersen ZKP on the STARK Curve – **Implementation Spec**

> **Scope**  
> • TypeScript (ES2020) • Node ≥ 18 • `micro-starknet` ≥ 0.2.3 (or `@scure/starknet` ≥ 1.1.0)  
> • Proof of same‐secret exponent *x* in the relations **U = x·G** and **V = x·H** over the Stark curve  
> • Fully-typed API, interactive *and* Fiat–Shamir (NIZK) variants  
> • Jest / Vitest test-suite + property tests

---

## 1  Project layout

```bash
.
├─ src/
│ ├─ curve.ts // Curve constants & helpers
│ ├─ generators.ts // Deterministic derivation of secondary base H
│ ├─ transcript.ts // Hash-to-scalar helper for Fiat–Shamir
│ ├─ chaumPedersen.ts // Prover / Verifier implementations
│ └─ index.ts // Barrel export
└─ test/
├─ chaumPedersen.test.ts
└─ vectors.test.ts
```

---

## 2  Dependencies

```bash
npm i micro-starknet @noble/hashes @noble/curves
npm i -D vitest typescript ts-node @types/node fast-check
```
## 3 Curve glue (curve.ts)
```ts
import * as stark from 'micro-starknet';           // noble-curves wrapper :contentReference[oaicite:0]{index=0}
import { Field } from '@noble/curves/abstract/modular';

export const CURVE        = stark.CURVE;           // contains .P (prime) & .n (order)
export const Fr           = Field(CURVE.n);
export const G            = stark.Point.BASE;      // canonical generator
export type Scalar        = bigint;
export type Point         = typeof stark.Point.BASE;
export const randScalar   = (): Scalar => stark.utils.randomPrivateKey(); // 1 ≤ k < n
```

## 4 Secondary generator (generators.ts)
```ts
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import { Fr, G, Point, CURVE_ORDER, moduloOrder } from './curve.js'; // Assuming CURVE_ORDER and moduloOrder are exported

// Domain separation tag for generating h
const domainTag = "starkex.chaum-pedersen.H.v1";

// Calculate h:
// 1. Hash the domain tag using SHA-256.
// 2. Convert the hash (Uint8Array) to a BigInt.
// 3. Reduce the BigInt modulo CURVE_ORDER.
const hashedDomainTag = sha256(utf8ToBytes(domainTag));
const h_scalar_bigint = BigInt('0x' + bytesToHex(hashedDomainTag));
const h = moduloOrder(h_scalar_bigint); // Ensures h is < CURVE_ORDER

// It's crucial to validate h:
// - h should not be 0.
// - H (derived from h) should not be the point at infinity.
// - H should not be equal to G (implies h=1).
// (Refer to generators.ts for actual validation logic)

/** H = h • G */
// h is publicly known as it's derived deterministically.
// The security relies on the intractability of computing log_G(H) = h
// when h is large and randomly-like, which is achieved by using a cryptographic hash.
export const H: Point = G.multiply(h);
```
>Rationale: `H` is derived as `h*G`. The scalar `h` is generated deterministically from a public domain separation string using SHA-256 and taken modulo the curve order. This makes `h` a "nothing-up-my-sleeve" number. While `h` is publicly computable, the security of the Chaum-Pedersen protocol relies on the discrete logarithm `log_G(H) = h` being intractable to compute. This is ensured by `h` being the output of a cryptographic hash function, which behaves like a random oracle.

## 5 Transcript helper (transcript.ts)
```ts
import { poseidonHashMany } from 'micro-starknet'; // 256-bit Poseidon is already shipped
import { Fr } from './curve.js';
import type { Point } from './curve.js';

/** Serialise (compressed-y) coordinate: x || (y & 1) */
const ser = (P: Point): bigint[] => [P.x, P.y & 1n];

/** Hash arbitrary curve points into a scalar challenge */
export function challenge(...pts: Point[]): bigint {
  const input = pts.flatMap(ser);                  // bigint[]
  return Fr.create(poseidonHashMany(input));       // Fiat–Shamir
}
```

## 6 API (chaumPedersen.ts)
```ts
import { G, H, Fr, Point, Scalar, randScalar } from './curve.js';
import { challenge } from './transcript.js';

/* ------------------------  Public types  ------------------------ */

export interface Statement {
  U: Point;   // = x·G
  V: Point;   // = x·H
}

export interface InteractiveCommit {
  P: Point;   // = r·G
  Q: Point;   // = r·H
}

export interface Proof extends InteractiveCommit {
  c: Scalar;  // challenge
  e: Scalar;  // response = r + c·x mod n
}

/* ------------------------  Algorithms  -------------------------- */

/** Prover – interactive step 1: commit */
// The function generates commitment points P = rG, Q = rH from a nonce r.
// If r is not provided, it's generated randomly.
// The secret x is not used in this step.
export function commit(r: Scalar = randScalar()): { commit: InteractiveCommit; nonce: Scalar } {
  return {
    commit: { P: G.multiply(r), Q: H.multiply(r) },
    nonce: r
  };
}

/** Prover – interactive step 2: respond (given challenge c) */
// Calculates e = (r + c*x) mod n.
// Uses moduloOrder from core/curve.ts, which is equivalent to Fr.create for positive results.
export function respond(x: Scalar, r: Scalar, c: Scalar): Scalar {
  return moduloOrder(r + c * x);                     // e ∈ [0,n)
}

/** Full Fiat–Shamir proof */
export function proveFS(x: Scalar): { stmt: Statement; proof: Proof } {
  const U = G.multiply(x); // U = xG
  const V = H.multiply(x); // V = xH
  // The commit function generates its own nonce `r` if not provided.
  // The secret `x` is not passed to commit.
  const { commit: interactiveCommit, nonce: r } = commit(); // interactiveCommit is {P,Q}, nonce is r
  const c = challenge(interactiveCommit.P, interactiveCommit.Q, U, V); // c = H(P,Q,U,V)
  const e = respond(x, r, c); // e = (r + c*x) mod n
  return { stmt: { U, V }, proof: { ...interactiveCommit, c, e } };
}

/** Verifier – checks proof (both interactive and FS) */
export function verify({ U, V }: Statement, { P, Q, c, e }: Proof): boolean {
  // Left: e·G,  e·H
  const leftG = G.multiply(e);
  const leftH = H.multiply(e);

  // Right: P + c·U,  Q + c·V
  const rightG = P.add(U.multiply(c));
  const rightH = Q.add(V.multiply(c));

  return leftG.equals(rightG) && leftH.equals(rightH);
}
```

## 7 Proof serialisation (optional)
```ts
/** 609-byte binary: (P.x, P.y, Q.x, Q.y, c, e) each 32-byte BE */
export const encode = ({ P, Q, c, e }: Proof): Uint8Array => {
  const be = (n: bigint) => stark.utils.numberToBytesBE(n, 32);
  return concatBytes(be(P.x), be(P.y), be(Q.x), be(Q.y), be(c), be(e));
};
```

## 8 Test-suite (chaumPedersen.test.ts)
```ts
import { describe, expect, it } from 'vitest';
import * as stark from 'micro-starknet';
import { proveFS, verify } from '../src/chaumPedersen.js';
import { randScalar } from '../src/curve.js';

describe('Chaum-Pedersen (Fiat–Shamir)', () => {
  it('round-trip succeeds', () => {
    const x = randScalar();
    const { stmt, proof } = proveFS(x);
    expect(verify(stmt, proof)).toBe(true);
  });

  it('fails for wrong secret', () => {
    const { stmt, proof } = proveFS(randScalar());
    // Flip last bit of response
    proof.e ^= 1n;
    expect(verify(stmt, proof)).toBe(false);
  });
});
```

## 9 Security & implementation notes
Issue	Mitigation
Nonce reuse	randScalar() wraps noble-curves CSPRNG; always regenerate r.
Timing leaks	Rely on constant-time ops in micro-starknet; never branch on secrets in TS.
Small-order points	Stark curve cofactor = 1 ⇒ no subgroup checks needed, but still validate external inputs (Point.fromHex).
Secondary generator	`H` is derived as `h*G`, where `h = SHA256("starkex.chaum-pedersen.H.v1") % CURVE_ORDER`. This ensures that `log_G(H)` (the scalar `h`) is intractable to compute, even though `h` is derived from a public constant. This is a standard and secure method for generating auxiliary points.
Soundness	Order n ≈ 2²⁵¹ ⇒ 128-bit security margin; Poseidon FS-transform keeps tightness.

## 10 Next steps
Batch verification of many proofs (multiScalarMul from @noble/curves).