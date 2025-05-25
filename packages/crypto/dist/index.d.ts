import { ProjectivePoint } from '@scure/starknet';
export { ProjectivePoint } from '@scure/starknet';

declare const POINT_AT_INFINITY_HEX_UNCOMPRESSED: string;
/**
 * Generates a cryptographically secure random scalar suitable for use as a private key
 * on the Starknet elliptic curve.
 * The scalar is returned as a 0x-prefixed hex string.
 */
declare function generateRandomScalarStarknet(): string;
/**
 * Derives the public key from a private key on the Starknet elliptic curve.
 * @param privateKeyHex - The private key as a 0x-prefixed hex string.
 * @param compressed - (Optional) Whether to return the compressed public key. Defaults to false (uncompressed).
 * @returns The public key as a 0x-prefixed hex string.
 */
declare function getPublicKeyStarknet(privateKeyHex: string, compressed?: boolean): string;
/**
 * Performs scalar multiplication (k * P) on the Starknet elliptic curve.
 * @param scalarHex - The scalar k as a 0x-prefixed hex string.
 * @param pointHex - The elliptic curve point P as a 0x-prefixed hex string (uncompressed or compressed).
 * @returns The resulting point (k * P) as an uncompressed 0x-prefixed hex string ("0x04" + x + y).
 */
declare function scalarMultiplyStarknet(scalarHex: string, pointHex: string): string;
/**
 * Adds two elliptic curve points (P1 + P2) on the Starknet elliptic curve.
 * @param point1Hex - The first point P1 as a 0x-prefixed hex string (uncompressed or compressed).
 * @param point2Hex - The second point P2 as a 0x-prefixed hex string (uncompressed or compressed).
 * @returns The resulting point (P1 + P2) as an uncompressed 0x-prefixed hex string ("0x04" + x + y).
 */
declare function addPointsStarknet(point1Hex: string, point2Hex: string): string;
/**
 * Retrieves the generator point (base point G) of the Starknet elliptic curve.
 * @param compressed - (Optional) Whether to return the compressed base point. Defaults to false (uncompressed).
 * @returns The base point G as a 0x-prefixed hex string.
 */
declare function getBasePointStarknet(compressed?: boolean): string;

/**
 * Creates a StarkNet stealth address for a recipient.
 *
 * This process involves the sender generating an ephemeral key pair (`r`, `R`)
 * and using the recipient's public view key (`Y`) and public spend key (`X`)
 * to compute the stealth address `P = X + H_s(rY)G`.
 * `H_s` is a hash function (starknetKeccak with domain separation).
 * `G` is the STARK curve generator point.
 *
 * @param recipientPubSpendKeyHex The recipient's public spend key (`X`) as a 0x-prefixed hex string.
 *                                This key is part of the final stealth address.
 * @param recipientPubViewKeyHex The recipient's public view key (`Y`) as a 0x-prefixed hex string.
 *                               This key is used by the sender to generate the shared secret.
 * @returns An object containing:
 *   - `ephemeralScalarHex`: The sender's ephemeral private scalar (`r`) as a 0x-prefixed hex string.
 *                           This MUST be kept secret by the sender if they need to reconstruct `k` later,
 *                           but is typically discarded after `R` is computed.
 *   - `ephemeralPublicKeyHex`: The sender's ephemeral public key (`R = rG`) as a 0x-prefixed hex string.
 *                              This is transmitted publicly (e.g., on-chain) alongside the stealth address.
 *   - `stealthAddressHex`: The generated stealth address (`P = X + kG`) as a 0x-prefixed hex string.
 *                          `k = H_s("starknet_stealth_k_v1" || rY_compressed)`.
 * @throws Error if any underlying cryptographic operation fails.
 */
declare function createStealthAddressStarknet(recipientPubSpendKeyHex: string, recipientPubViewKeyHex: string): {
    ephemeralScalarHex: string;
    ephemeralPublicKeyHex: string;
    stealthAddressHex: string;
};
/**
 * Checks if a given StarkNet stealth address belongs to the recipient.
 *
 * The recipient uses their private view key (`y`) and public spend key (`X`),
 * along with the sender's ephemeral public key (`R`), to reconstruct the
 * candidate stealth address `P' = X + H_s(yR)G`.
 * If `P'` matches the provided `stealthAddressHex`, the recipient owns it.
 *
 * @param recipientPrivateViewKeyHex The recipient's private view key (`y`) as a 0x-prefixed hex string.
 * @param recipientPubSpendKeyHex The recipient's public spend key (`X`) as a 0x-prefixed hex string.
 * @param ephemeralPublicKeyHex The sender's ephemeral public key (`R`) as a 0x-prefixed hex string,
 *                              retrieved publicly (e.g., from the transaction).
 * @param stealthAddressHex The stealth address (`P`) to check, as a 0x-prefixed hex string.
 * @returns `true` if the recipient owns the stealth address, `false` otherwise.
 * @throws Error if any underlying cryptographic operation fails.
 */
declare function checkStealthAddressOwnershipStarknet(recipientPrivateViewKeyHex: string, recipientPubSpendKeyHex: string, ephemeralPublicKeyHex: string, stealthAddressHex: string): boolean;
/**
 * Derives the private key corresponding to a StarkNet stealth address.
 *
 * The recipient uses their private spend key (`x`) and the scalar `k'`
 * (derived from their private view key `y` and the sender's ephemeral public key `R`
 * as `k' = H_s(yR_compressed)`) to compute the stealth private key:
 * `p_stealth = (x + k') mod n`, where `n` is the curve order.
 *
 * @param recipientPrivateSpendKeyHex The recipient's private spend key (`x`) as a 0x-prefixed hex string.
 * @param recipientPrivateViewKeyHex The recipient's private view key (`y`) as a 0x-prefixed hex string.
 * @param ephemeralPublicKeyHex The sender's ephemeral public key (`R`) as a 0x-prefixed hex string.
 * @returns The derived stealth private key (`p_stealth`) as a 0x-prefixed hex string.
 * @throws Error if the derived stealth private key is zero, which is an invalid private key.
 * @throws Error if any underlying cryptographic operation fails.
 */
declare function deriveStealthPrivateKeyStarknet(recipientPrivateSpendKeyHex: string, recipientPrivateViewKeyHex: string, ephemeralPublicKeyHex: string): string;

type Scalar = bigint;
type Point = ProjectivePoint;

declare const CURVE_ORDER: bigint;
declare const PRIME: bigint;
declare const G: Point;
declare const POINT_AT_INFINITY: Point;
declare const moduloOrder: (x: Scalar) => Scalar;
declare function randScalar(): Scalar;
declare const getPublicKey: (priv: Scalar) => Point;
declare const scalarMultiply: (k: Scalar, P: Point) => Point;
declare const addPoints: (P: Point, Q: Point) => Point;
declare const negatePoint: (P: Point) => Point;
declare const arePointsEqual: (P: Point, Q: Point) => boolean;
declare const assertPointValidity: (P: Point) => void;
declare const bigIntToHex: (x: Scalar) => string;
declare const hexToBigInt: (h: string) => Scalar;
declare function pointToHex(P: Point, compressed?: boolean): string;
declare const hexToPoint: (h: string) => Point;
declare const poseidonHashScalars: (xs: Scalar[]) => Scalar;

/**
 * Defines the public statement for which a Chaum-Pedersen proof is created.
 * It asserts knowledge of a secret scalar `x` such that `U = xG` and `V = xH`,
 * where `G` is the standard base point and `H` is a secondary generator point.
 * The discrete logarithm of `H` with respect to `G` must be unknown.
 */
interface Statement {
    /**
     * Point `U = xG`, where `x` is the secret scalar and `G` is the primary curve generator.
     */
    U: Point;
    /**
     * Point `V = xH`, where `x` is the secret scalar and `H` is the secondary curve generator.
     */
    V: Point;
}
/**
 * Represents the commitment part of an interactive Chaum-Pedersen proof,
 * or the commitment part of a non-interactive proof.
 * It consists of two points `P = rG` and `Q = rH`, where `r` is a random nonce.
 */
interface InteractiveCommit {
    /**
     * Commitment point `P = rG`, where `r` is the prover's random nonce.
     */
    P: Point;
    /**
     * Commitment point `Q = rH`, where `r` is the prover's random nonce.
     */
    Q: Point;
}
/**
 * Represents a full non-interactive Chaum-Pedersen proof.
 * This proof demonstrates that the same secret `x` forms the basis for the public points `U` and `V`
 * in the {@link Statement} (`U = xG`, `V = xH`).
 *
 * The proof consists of:
 * - Commitments `P = rG` and `Q = rH` made with a random nonce `r`.
 * - A challenge scalar `c`, typically derived via Fiat-Shamir from `(P, Q, U, V)`.
 * - A response scalar `e = (r + c*x) mod n`, where `n` is the curve order.
 *
 * Security relies on:
 * - The hardness of the discrete logarithm problem in the STARK curve group.
 * - `G` and `H` being suitable generators with an unknown discrete log relationship (`log_G(H)` unknown).
 * - The hash function used for `c` behaving as a random oracle.
 */
interface Proof extends InteractiveCommit {
    /**
     * The challenge scalar `c`, derived via Fiat-Shamir by hashing `(P, Q, U, V)`.
     * It must be a scalar modulo the curve order `n`.
     */
    c: Scalar;
    /**
     * The response scalar `e = (r + c*x) mod n`.
     * `x` is the secret, `r` is the nonce from the commitment phase, `c` is the challenge.
     * `n` is the order of the curve.
     */
    e: Scalar;
}
/**
 * Generates the prover's commitment in the first step of an interactive Chaum-Pedersen proof.
 *
 * The prover chooses a random scalar nonce `r` (secret) and computes commitment points:
 * `P = rG`
 * `Q = rH`
 *
 * These points `(P, Q)` are sent to the verifier. The nonce `r` must be kept secret
 * by the prover for the {@link respond} step.
 *
 * @param r Optional. A pre-generated random nonce scalar. If not provided, a secure random scalar
 *          `r` (where `0 < r < CURVE_ORDER`) will be generated using `randScalar()`.
 *          Reusing `r` values for different proofs with the same secret `x` can leak the secret.
 * @returns An object containing:
 *          - `commit`: The commitment points {@link InteractiveCommit} `{ P, Q }`.
 *          - `nonce`: The scalar nonce `r` used to generate the commitment. This must be used in the {@link respond} step.
 * @throws Error if `randScalar()` fails or if point operations encounter issues.
 */
declare function commit(r?: Scalar): {
    commit: InteractiveCommit;
    nonce: Scalar;
};
/**
 * Computes the prover's response `e` in the second step of an interactive Chaum-Pedersen proof,
 * or as part of generating a non-interactive {@link Proof}.
 *
 * The response is calculated as: `e = (r + c*x) mod n`
 * where:
 * - `x` is the secret scalar (witness).
 * - `r` is the random nonce used in the {@link commit} phase.
 * - `c` is the challenge scalar (either provided by a verifier in interactive mode, or
 *   derived via Fiat-Shamir in non-interactive mode).
 * - `n` is the order of the elliptic curve.
 *
 * @param x The secret scalar (witness) such that `U = xG` and `V = xH`.
 *          It is assumed `0 < x < CURVE_ORDER`.
 * @param r The random nonce scalar used during the {@link commit} phase.
 *          It is assumed `0 < r < CURVE_ORDER`.
 * @param c The challenge scalar. It is assumed `0 <= c < CURVE_ORDER`.
 * @returns The response scalar `e`, guaranteed to be in the range `[0, CURVE_ORDER - 1]`.
 * @throws Error if scalar arithmetic encounters issues.
 */
declare function respond(x: Scalar, r: Scalar, c: Scalar): Scalar;
/**
 * Creates a complete non-interactive Chaum-Pedersen proof using the Fiat-Shamir heuristic.
 *
 * This function proves knowledge of a secret scalar `x` such that `U = xG` and `V = xH`.
 *
 * The process involves:
 * 1. Computing the public statement values `U = xG` and `V = xH`.
 * 2. Generating a commitment: A random nonce `r` is chosen, and `P = rG`, `Q = rH` are computed.
 * 3. Deriving a challenge: The challenge `c` is computed by hashing `(P, Q, U, V)`
 *    using {@link generateChallenge}. This step makes the proof non-interactive.
 * 4. Computing the response: The response `e = (r + c*x) mod n` is calculated.
 *
 * The resulting proof is `(P, Q, c, e)` along with the statement `(U, V)`.
 *
 * @param x The secret scalar (witness) for which to generate the proof.
 *          It must be a valid scalar, ideally `0 < x < CURVE_ORDER`.
 * @returns An object containing:
 *          - `stmt`: The public statement {@link Statement} `{ U, V }`.
 *          - `proof`: The non-interactive {@link Proof} `{ P, Q, c, e }`.
 * @throws Error if any underlying cryptographic operation (scalar generation, point arithmetic, hashing) fails.
 */
declare function proveFS(x: Scalar): {
    stmt: Statement;
    proof: Proof;
};
/**
 * Verifies a non-interactive Chaum-Pedersen {@link Proof} against a public {@link Statement}.
 *
 * The verification involves checking two equations:
 * 1. `eG = P + cU`
 * 2. `eH = Q + cV`
 *
 * where:
 * - `(U, V)` are from the public statement.
 * - `(P, Q, c, e)` are from the proof.
 * - `G` is the primary curve generator.
 * - `H` is the secondary curve generator.
 *
 * Before performing calculations, this function validates that all input points (`U, V, P, Q`)
 * are valid points on the STARK curve using their `assertValidity()` method.
 *
 * @param stmt The public statement {@link Statement} `{ U, V }` being verified.
 * @param proof The non-interactive proof {@link Proof} `{ P, Q, c, e }` to verify.
 * @returns `true` if the proof is valid for the given statement, `false` otherwise.
 *          Returns `false` if any input point is invalid.
 * @throws Error if point operations or comparisons encounter issues, though typical errors
 *         during verification (e.g., failed equality checks) result in `false`.
 */
declare function verify(stmt: Statement, proof: Proof): boolean;
/**
 * Serializes a {@link Proof} into a `Uint8Array` of 192 bytes.
 * The format is the concatenation of six 32-byte big-endian representations of:
 * P.x, P.y (affine coordinates), Q.x, Q.y (affine coordinates), c, e.
 *
 * Note: Points P and Q are converted to affine coordinates for serialization.
 * If a point is the point at infinity, its affine coordinates (x, y) are (0, 0).
 * This serialization matches common practices for elliptic curve points and scalars.
 *
 * @param proof The {@link Proof} object `{ P, Q, c, e }` to serialize.
 * @returns A `Uint8Array` of 192 bytes representing the proof.
 * @throws Error if BigInt conversion to bytes fails (e.g., too large for 32 bytes).
 */
declare function encodeProof({ P, Q, c, e }: Proof): Uint8Array;
/**
 * Deserializes a {@link Proof} from a `Uint8Array` (expected 192 bytes).
 * This function is the inverse of {@link encodeProof}.
 *
 * It reads six 32-byte big-endian values for P.x, P.y, Q.x, Q.y, c, and e,
 * then reconstructs the points P and Q from their affine coordinates.
 *
 * @param bytes The `Uint8Array` (192 bytes) to deserialize.
 * @returns The deserialized {@link Proof} object `{ P, Q, c, e }`.
 * @throws Error if the byte array has an unexpected length or if point reconstruction fails.
 */
declare function decodeProof(bytes: Uint8Array): Proof;

declare const H: Point;

/**
 * Serializes an elliptic curve point for inclusion in a transcript hash.
 * This function converts a point `P` (potentially in projective coordinates)
 * into a standardized array of two bigints suitable for hashing.
 *
 * The serialization uses a form of compressed-y coordinates:
 * 1. The point `P` is converted to its affine representation `(x, y)`.
 * 2. The output is `[x, y_parity]`, where `x` is the affine x-coordinate
 *    and `y_parity` is the least significant bit of the affine y-coordinate (`y & 1n`).
 *
 * This format `[x, y_parity]` is common in cryptographic protocols on elliptic curves
 * as it uniquely represents the point (given the curve equation) while reducing data size.
 *
 * @param P The elliptic curve point (`Point` type, typically `ProjectivePoint` from `@scure/starknet`) to serialize.
 * @returns An array of two `bigint` values: `[affine_x_coordinate, y_parity]`.
 * @throws Error if the point conversion to affine coordinates fails (e.g., if `P` is the point at infinity,
 *         though `toAffine()` on `@scure/starknet` points typically handles this by returning specific values or throwing).
 *         The behavior for the point at infinity should be tested and handled consistently if it can be an input.
 *         (Note: Chaum-Pedersen points U,V,P,Q are typically not the point at infinity in valid proofs).
 */
declare function serializePointForTranscript(P: Point): bigint[];
/**
 * Generates a cryptographic challenge scalar `c` for the Fiat-Shamir transformation
 * by hashing a series of elliptic curve points.
 *
 * The process is as follows:
 * 1. Each input point is serialized using {@link serializePointForTranscript}
 *    to obtain an array `[affine_x, y_parity]`.
 * 2. All serialized point data (which are `bigint` arrays) are flattened into a single
 *    array of `bigint`s.
 * 3. This flat array of `bigint`s is then hashed using `poseidonHashScalars`
 *    (from `../core/curve.ts`), which employs the Poseidon hash function.
 *    Poseidon is the standard hash function in the Starknet ecosystem, chosen for its
 *    efficiency in ZK-STARK contexts.
 * 4. `poseidonHashScalars` ensures the final hash output is a valid scalar `c`
 *    modulo `CURVE_ORDER`, suitable for use in cryptographic computations within the STARK curve's field.
 *
 * This challenge scalar `c` is essential for making interactive ZKPs like Chaum-Pedersen
 * non-interactive, forming a core part of the Fiat-Shamir heuristic.
 *
 * @param points An array of `Point` objects to be included in the hash.
 *               These points typically form the context of the proof, e.g., `(P, Q, U, V)`
 *               in a Chaum-Pedersen proof.
 * @returns A `Scalar` (bigint) representing the challenge `c`, where `0 <= c < CURVE_ORDER`.
 * @throws Error if point serialization or hashing fails.
 */
declare function generateChallenge(...points: Point[]): Scalar;

export { CURVE_ORDER, G, H, type InteractiveCommit, POINT_AT_INFINITY, POINT_AT_INFINITY_HEX_UNCOMPRESSED, PRIME, type Point, type Proof, type Scalar, type Statement, addPoints, addPointsStarknet, arePointsEqual, assertPointValidity, bigIntToHex, checkStealthAddressOwnershipStarknet, commit, createStealthAddressStarknet, decodeProof, deriveStealthPrivateKeyStarknet, encodeProof, generateChallenge, generateRandomScalarStarknet, getBasePointStarknet, getPublicKey, getPublicKeyStarknet, hexToBigInt, hexToPoint, moduloOrder, negatePoint, pointToHex, poseidonHashScalars, proveFS, randScalar, respond, scalarMultiply, scalarMultiplyStarknet, serializePointForTranscript, moduloOrder as toFr, verify };
