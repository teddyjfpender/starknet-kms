# Starknet Stealth Addresses (`starknet-stealth.ts`)

This module implements a stealth address protocol for Starknet, allowing users to receive assets at unique, one-time addresses that cannot be publicly linked back to the recipient's main identity or to each other. This enhances receiver privacy.

The implementation uses the core elliptic curve primitives defined in `core/curve.ts`.

## Concept

A standard stealth address scheme typically involves:

1.  **Recipient Setup:** The recipient (Alice) has two key pairs:
    *   **Spend Key Pair:** `(x, X)` where `X = x * G`. Used for ultimately controlling funds sent to stealth addresses.
    *   **View Key Pair:** `(y, Y)` where `Y = y * G`. Used for detecting incoming stealth payments.
    *(Note: In some schemes, `y` might be derived from `x`, e.g., `y = Hash(x)`)*

2.  **Sender Action:** The sender (Bob) wants to send funds to Alice:
    *   Bob generates a temporary, one-time **ephemeral key pair** `(r, R)` where `R = r * G`.
    *   Bob computes a shared secret using his ephemeral private key `r` and Alice's public view key `Y`: `S = r * Y`.
    *   Bob derives a scalar `k` from this shared secret, typically `k = Hash(S)`.
    *   Bob calculates the **stealth address** (a public key) `P = X + k*G`.
    *   Bob sends the funds to address `P` and also publishes the ephemeral public key `R` (e.g., in transaction metadata).

3.  **Recipient Detection:** Alice scans incoming transactions:
    *   For each transaction, she takes the published ephemeral public key `R`.
    *   She computes a candidate shared secret using her private view key `y`: `S' = y * R`.
    *   She derives a candidate scalar `k' = Hash(S')`.
    *   She computes a candidate stealth address `P' = X + k'*G`.
    *   If `P'` matches the transaction's destination address `P`, Alice knows this payment is for her.
    *   *Mathematical Check:* Since `S' = y*R = y*(r*G) = r*(y*G) = r*Y = S`, it follows that `k' = k` and thus `P' = P`.

4.  **Recipient Spending:** To spend the funds at stealth address `P`, Alice needs the corresponding private key `p`:
    *   She uses the `k'` she calculated during detection.
    *   She calculates the **stealth private key** `p = x + k'` (modulo `n`).
    *   *Mathematical Check:* `p * G = (x + k') * G = x*G + k'*G = X + k'*G = P'`, which we know equals `P`. So, `p` is indeed the private key for `P`.

## API (`starknet-stealth.ts`)

This module provides functions implementing the logic described above, operating on hex strings for convenience.

### `createStealthAddressStarknet(recipientPubSpendKeyHex: string, recipientPubViewKeyHex: string)`

Implements the **Sender Action**.

*   **Parameters:**
    *   `recipientPubSpendKeyHex`: Alice's public spend key `X` (hex).
    *   `recipientPubViewKeyHex`: Alice's public view key `Y` (hex).
*   **Returns:** An object `{ ephemeralScalarHex, ephemeralPublicKeyHex, stealthAddressHex }` containing:
    *   `ephemeralScalarHex`: Bob's one-time private scalar `r` (hex). *(Note: Usually not returned in production, but useful for testing)*.
    *   `ephemeralPublicKeyHex`: Bob's one-time public key `R = r*G` (hex). This needs to be published.
    *   `stealthAddressHex`: The calculated stealth address `P = X + Hash(r*Y)*G` (hex). This is the destination address.

### `checkStealthAddressOwnershipStarknet(recipientPrivateViewKeyHex: string, recipientPubSpendKeyHex: string, ephemeralPublicKeyHex: string, stealthAddressHex: string): boolean`

Implements the **Recipient Detection** check.

*   **Parameters:**
    *   `recipientPrivateViewKeyHex`: Alice's private view key `y` (hex).
    *   `recipientPubSpendKeyHex`: Alice's public spend key `X` (hex).
    *   `ephemeralPublicKeyHex`: The ephemeral public key `R` published by the sender (hex).
    *   `stealthAddressHex`: The destination address `P` being checked (hex).
*   **Returns:** `true` if the address `P` corresponds to Alice's keys and the given `R`, `false` otherwise.

### `deriveStealthPrivateKeyStarknet(recipientPrivateSpendKeyHex: string, recipientPrivateViewKeyHex: string, ephemeralPublicKeyHex: string): string`

Implements the **Recipient Spending** key derivation.

*   **Parameters:**
    *   `recipientPrivateSpendKeyHex`: Alice's private spend key `x` (hex).
    *   `recipientPrivateViewKeyHex`: Alice's private view key `y` (hex).
    *   `ephemeralPublicKeyHex`: The ephemeral public key `R` published by the sender (hex).
*   **Returns:** The derived stealth private key `p = x + Hash(y*R)` as a hex string. 