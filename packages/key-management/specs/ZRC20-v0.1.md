---

## ERC‑XYZ: **Confidential‑Payments Wallet Provider Extension**

*Extending Starknet Wallet API Specs so wallets can natively create zero‑knowledge artefacts for elliptic‑curve–based confidential ERC‑20 protocols*

|  Section      |  Value                       |
| ------------- | ---------------------------- |
| **Author(s)** |  *Your Name*                 |
| **Status**    |  Draft                       |
| **Type**      |  Standards Track – Interface |
| **Category**  |  Wallet / Provider           |
| **Created**   |  2025‑07‑16                  |
| **Requires**  |  [Starknet Wallet Specs]     |

[Starknet Wallet Specs]: https://github.com/PhilippeR26/Starknet-WalletAccount/blob/main/doc/walletAPIspec.md

---

### 1   Abstract

This proposal introduces a small, **protocol‑agnostic** set of Starknet wallet specification provider methods that let a browser wallet perform client‑side elliptic‑curve cryptography (ECC) and prove‑of‑knowledge operations required by confidential ERC‑20–style protocols.
Native support gives retail users a one‑click UX comparable to today’s public ERC‑20 transfers while keeping all secret scalars in the wallet.  The API is based on generic primitives (Pedersen commitments, proofs of exponent(s), range proofs, cipher‑balance helpers, etc.) so it can serve any protocol that follows the “g<sup>b</sup> · y<sup>r</sup>” design pattern—**not only the example implementation in *she‑js***.

---

### 2   Motivation

| Current state                                                                                                                  | Problem                                                                |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| dApps embed a full crypto library and ask the user to paste their *view* / *spend* key.                                        | Bad DX; keys leak to the dApp; heavy bundles; slow mobile performance. |
| Wallets know the private key **x** already (they sign transactions) but expose no APIs to reuse it in zero‑knowledge circuits. | Redundant key management; secret material hops between scopes.         |
| No standard method names—every protocol invents JSON‑RPC calls (“pedersenHash”, “zkDeposit”, …).                               | Fragmentation; wallet vendors won’t implement N flavours.              |

**Goal:** expose *just enough* ECC/σ‑protocol machinery so the dApp can build a valid Stark‑ or BN‑curve proof **without ever touching the user’s secret scalar `x`.**

---

### 3   Specification

#### 3.1   Capability discovery

```ts
confidential = await provider.request({
  method: 'wallet_getConfidentialCapabilities',
});
```

Returns:

```ts
interface ConfidentialCapabilities {
  version: "1.0.0";
  curve:   "stark"  | "bn254" | "secp256k1" | string; // see important note below
  maxBits: number;      // range proof upper bound, e.g. 32
  methods: string[];    // list of supported ops below
}
```
> [!IMPORTANT]  
> We must be considerate of the curve here as there are mixed signer types wallet providers offer, namely `stark-curve` based signers (which are the most efficient on Starknet), and `secp256k1` Eth signers. Its also fair to assume that there could exist a similar on the `secp256r1` curve (assuming there's a design pattern/trick that allows passkey users to perform equivalent operations) and on other curves like `bn254` as well.

> A dApp MUST call this first and fall back gracefully if the wallet does not respond or returns an empty capability set.

#### 3.2   Primitives

All methods follow the typical EIP‑1193 pattern:

```ts
const result = await provider.request({
  method: 'wallet_<operation>',
  params: [ /* exactly one positional object for future proofing */ ]
});
```

##### 3.2.1 Functional Requirements (Major)

> [!NOTE]  
> The following wallet provider design patterns bias towards Fat Solution's Tongo protocol (docs can be found [here](https://docs.tongo.cash/)). Tongo is based on the [Zether](https://eprint.iacr.org/2019/191) paper by Bünz et al. and adapted for Starknet’s stark-curve's operations. The below operations are the operations required to interact with a protocol like Tongo. The goal should be to distill them into methods that a wallet can perform and be agnostic about the protocol while facilitating good user experience. 

The following could become lazy wallet provider methods that follow the semantics if `wallet_ConfidentialFund`, `wallet_ConfidentialTransfer`,  `wallet_ConfidentialRollOver`, `wallet_ConfidentialWithdraw`.

|                    | Purpose                                                                                         | Requirement to Invoke Contract Method                                                                                | Prover Params                                                            | Prover Return Type                                                                                                                                           |
|--------------------|-------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `fund`             | Allows a user to deposit an `amount` ERC20 `to` a Public Key in Tongo.                          | Application requests from the wallet a proof of fund ownership (i.e. proof of exponent) and provides a public nonce. | Private spending key and user's public key protocol address nonce.       | `{ inputs: InputsFund, proof: ProofOfFund }` Where: `ProofOfFund { Ax: ProjectivePoint, sx: bigint }` and `InputsFund { y: ProjectivePoint, nonce: bigint }` |
| `transfer`         | Allows a user to transfer an encrypted amount `from` a Public Key `to` a Public Key.            | Application requests from the wallet a proof of transfer for an `amount` and `to` a public key.                      | Private spending key, recipient address, cpyher balance, and nonce.      | `{ inputs: InputsTransfer, proof: ProofOfTransfer }`                                                                                                         |
| `rollover`         | Allows a user to merge pending transfers from their pending balance to their spendable balance. | Application requests from the wallet a proof of fund ownership (i.e. proof of exponent) and provides a public nonce. | Private spending key and user's public key protocol address nonce.       | `{ inputs: InputsFund, proof: ProofOfFund }` Where: `ProofOfFund { Ax: ProjectivePoint, sx: bigint }` and `InputsFund { y: ProjectivePoint, nonce: bigint }` |
| `withdraw_all`     | Allows a user to withdraw all of their spendable balance to a Starknet address.                 | Application requests from the wallet a proof of withdrawal for user's entire protocol balance.                       | Private spending key, cypher balance, amount, recipient address, nonce.  | `{ inputs: InputsWithdraw, proof: ProofOfWithdrawAll }`                                                                                                      |
| `withdraw_partial` | Allows a user to partially withdraw an amount of their spendable balance to a Starknet address. | Application requests from the wallet a proof of withdrawal for user's partial protocol balance.                      | Private spending key, cypher balance, amount, recipient address, nonce.  | `{ inputs: InputsWithdraw, proof: ProofOfWithdrawAll }`                                                                                                      |

##### 3.2.1 Functional Requirements Auxiliary 

TODO: expand on this.


| Method                            | Purpose                                                                     | `params` object                                                                                                            | Returns                 |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **`wallet_encryptScalar`**        | Compute the public point *y = g·x* (or another base) without revealing *x*. | `{ privateKey?: string; base?: ECPoint }`<br>• omit `privateKey` to use the wallet’s account key.<br>• default `base = g`. | `ECPoint y`             |
| **`wallet_poeProve`**             | Generate a *Proof‑of‑Exponent* for one scalar.                              | `{ exponent?: string; base?: ECPoint }`                                                                                    | `{ y, A, s }`           |
| **`wallet_poe2Prove`**            | Σ‑protocol for *y = g₁·x₁ + g₂·x₂*.                                         | `{ exponent1?: string; exponent2: string; base1?: ECPoint; base2: ECPoint }`                                               | `{ y, A, s1, s2 }`      |
| **`wallet_cipherBalance`**        | Create `(L, R)` = (g·b + y·r, g·r).                                         | `{ amount: bigint; randomness?: bigint; viewKey?: ECPoint }`                                                               | `{ L, R, randomness }`  |
| **`wallet_rangeProve`**           | Bullet/bit‑proof that `amount ∈ [0, 2^bits−1]`.                             | `{ amount: bigint; bits?: number }`                                                                                        | `{ proof, randomness }` |


All **`ECPoint`** values are hex strings (`0x04 || x || y`, uncompressed) unless the curve uses Stark‑friendly affine `{ x, y }` numbers.

##### 3.2.1 Functional Requirements - Distilled 

TODO 1: What we want to do is distill Tongo's design pattern down to a generic set of arguments that request the correct proofs which in turn can be used as inputs to the invoke transaction's call data.
TODO 2: Define auxiliary methods that improve the interaction design of a confidential protocol - this could include decrypting an array of values which can populate the UI and present the user's view of the confidential protocol.

#### 3.3   Error codes

Should follow existing errors, for example:

| Code       | Meaning                                                   |
| ---------- | --------------------------------------------------------- |
| **`4001`** | User rejected.                                            |
| **`4200`** | Method not supported.                                     |
| **`4400`** | Invalid params (malformed point, amount > maxBits, etc.). |
| **`4900`** | Wallet is locked or not ready.                            |

---

### 4   Rationale

* **Minimal surface:** Only seven new calls—wallets can implement primitives first and add high‑level helpers later.
* **Protocol neutrality:** No contract addresses or selector constants leak into the API.  Everything protocol‑specific (function selectors, Cairo vs. EVM encoding, etc.) lives in the dApp, which feeds information (e.g. `prefix`/`commits`) into the hash challenge itself.
* **Forward compatibility:** All calls accept an **options object** so future fields can be added without breaking positional argument order.
* **Security:**

  * Private scalars never leave the wallet process.
  * Randomness is generated in‑wallet; can be overridden (test vectors) if `allowExternalEntropy` capability is advertised.
  * The wallet MAY rate‑limit heavy range‑proof generation on mobile.

---

### 5   Usage examples of naive and lazy methods

#### 5.1   Check support

```ts
const caps = await provider.request({ method: 'wallet_getConfidentialCapabilities' });
if (!caps.methods.includes('wallet_confidentialDeposit')) {
  throw new Error('Confidential payments not available');
}
```

#### 5.2   Deposit (a.k.a. **fund**)

This is a naive and lazy method, what we want is something more generic.
```ts
const { inputs, proof } = await provider.request({
  method: 'wallet_confidentialDeposit',
  params: [{
    amount:   25n,      // 25 tokens
    nonce:    987654321n
  }]
});

// Build calldata for something like `confidentialErc20.fund(inputs, proof)` and send tx
```

#### 5.3   Transfer 10 tokens to Bob’s *public key*

This is a naive and lazy method, what we want is something more generic.
```ts
const { inputs, proof } = await provider.request({
  method: 'wallet_confidentialTransfer',
  params: [{
    amount:      10n,
    fromCipher:  { L: aliceL, R: aliceR },   // from chain, current balance cipher
    toPublicKey:   bobY,                     // Bob’s public key (hex)
    nonce:       111222333n
  }]
});

// Include { inputs, proof } in `confidentialErc20.transfer(...)`
```

#### 5.4   Get a raw Pedersen hash (low‑level)

```ts
const hash = await provider.request({
  method: 'wallet_computePedersen',
  params: [{ elements: [prefix, commit1.x, commit1.y] }]
});
```

---

### 7   Security considerations

* Wallet **must** sandbox big‑int arithmetic to avoid timing side‑channels.
* Range proofs are CPU‑heavy; the UI should warn if generation may freeze the tab.
* DApps **must** validate that returned points lie on the expected curve and inside the prime‑order subgroup before forwarding to a smart‑contract verifier.
* Mixing curves is forbidden—wallet advertises a single `curve` string; dApp must not assume `secp256k1`.

---

### 8   Backwards compatibility

No existing Starknet wallet specification methods are modified.  Unsupporting wallets can simply return `4200` (unsupported) or throw.

---

#### Appendix A – TypeScript helpers

```ts
/** Pedersen commitment helper for dApps that wish to pre‑compute outside the wallet. */
export interface CipherBalance {
  L: ProjectivePoint;
  R: ProjectivePoint;
  randomness: bigint;
}
```

---
