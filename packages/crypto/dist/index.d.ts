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
 * Creates a stealth address for a recipient.
 *
 * @param recipientPubSpendKeyHex The recipient's public spend key (X) as a 0x-prefixed hex string.
 * @param recipientPubViewKeyHex The recipient's public view key (Y) as a 0x-prefixed hex string.
 * @returns An object containing:
 *   - ephemeralScalarHex: The sender's ephemeral private scalar (r) as a 0x-prefixed hex string.
 *   - ephemeralPublicKeyHex: The sender's ephemeral public key (R = r*G) as a 0x-prefixed hex string.
 *   - stealthAddressHex: The generated stealth address (P = X + H(r*Y)*G) as a 0x-prefixed hex string.
 */
declare function createStealthAddressStarknet(recipientPubSpendKeyHex: string, recipientPubViewKeyHex: string): {
    ephemeralScalarHex: string;
    ephemeralPublicKeyHex: string;
    stealthAddressHex: string;
};
/**
 * Checks if a stealth address belongs to the recipient.
 *
 * @param recipientPrivateViewKeyHex The recipient's private view key (y) as a 0x-prefixed hex string.
 * @param recipientPubSpendKeyHex The recipient's public spend key (X) as a 0x-prefixed hex string.
 * @param ephemeralPublicKeyHex The sender's ephemeral public key (R) as a 0x-prefixed hex string.
 * @param stealthAddressHex The stealth address (P) to check, as a 0x-prefixed hex string.
 * @returns True if the recipient owns the stealth address, false otherwise.
 */
declare function checkStealthAddressOwnershipStarknet(recipientPrivateViewKeyHex: string, recipientPubSpendKeyHex: string, ephemeralPublicKeyHex: string, stealthAddressHex: string): boolean;
/**
 * Derives the private key for a given stealth address.
 *
 * @param recipientPrivateSpendKeyHex The recipient's private spend key (x) as a 0x-prefixed hex string.
 * @param recipientPrivateViewKeyHex The recipient's private view key (y) as a 0x-prefixed hex string.
 * @param ephemeralPublicKeyHex The sender's ephemeral public key (R) as a 0x-prefixed hex string.
 * @returns The derived stealth private key (p_stealth = x + H(y*R)) as a 0x-prefixed hex string.
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

/** Statement proved in the Chaum‑Pedersen protocol. */
interface Statement {
    /** U = x⋅G */
    U: Point;
    /** V = x⋅H */
    V: Point;
}
/** Commitment values for the first round of the interactive protocol. */
interface InteractiveCommit {
    /** P = r⋅G */
    P: Point;
    /** Q = r⋅H */
    Q: Point;
}
/** Non‑interactive Chaum‑Pedersen proof. */
interface Proof extends InteractiveCommit {
    /** Fiat‑Shamir challenge */
    c: Scalar;
    /** Response: e = r + c⋅x mod n */
    e: Scalar;
}
/**
 * Prover - interactive step 1: commit.
 * Generates a commitment (P, Q) based on a random nonce r.
 * @param r Optional pre-generated random nonce scalar. If not provided, one will be generated.
 * @returns An object containing the commitment {P, Q} and the nonce r used.
 */
/**
 * Generate an interactive commitment.
 * @param r optional nonce; a random scalar will be generated if omitted
 * @returns commitment points and the nonce used
 */
declare function commit(r?: Scalar): {
    commit: InteractiveCommit;
    nonce: Scalar;
};
/**
 * Prover - interactive step 2: respond (given challenge c).
 * Calculates the response e = r + c*x mod n.
 * @param x The secret scalar x.
 * @param r The nonce scalar used in the commit phase.
 * @param c The challenge scalar provided by the verifier.
 * @returns The response scalar e.
 */
/**
 * Compute the prover response for a given challenge.
 * @param x secret witness
 * @param r nonce used during {@link commit}
 * @param c verifier challenge
 */
declare function respond(x: Scalar, r: Scalar, c: Scalar): Scalar;
/**
 * Full Fiat-Shamir proof generation.
 * @param x The secret scalar x.
 * @returns An object containing the statement {U, V} and the non-interactive proof {P, Q, c, e}.
 */
/**
 * Create a non‑interactive (Fiat‑Shamir) proof for secret {@code x}.
 */
declare function proveFS(x: Scalar): {
    stmt: Statement;
    proof: Proof;
};
/**
 * Verifier - checks the proof.
 * Verifies if e*G == P + c*U and e*H == Q + c*V.
 * @param stmt The statement {U, V}.
 * @param proof The proof {P, Q, c, e}.
 * @returns True if the proof is valid, false otherwise.
 */
/**
 * Verify a Chaum‑Pedersen proof.
 */
declare function verify(stmt: Statement, proof: Proof): boolean;

declare const H: Point;

/**
 * Serializes an elliptic curve point for the transcript.
 * For a point P=(x,y), it returns [x, y & 1n] (y-parity).
 * Ensures the point is affine before serialization.
 * @param P The point to serialize.
 * @returns An array of two bigints: [x, y_parity].
 */
declare function serializePointForTranscript(P: Point): bigint[];
/**
 * Generates a challenge scalar by hashing a series of points using Poseidon.
 * The points are first serialized to [x, y_parity].
 * @param points An array of points to include in the hash.
 * @returns A challenge scalar (bigint < CURVE_ORDER).
 */
declare function generateChallenge(...points: Point[]): Scalar;

export { CURVE_ORDER, G, H, type InteractiveCommit, POINT_AT_INFINITY, POINT_AT_INFINITY_HEX_UNCOMPRESSED, PRIME, type Point, type Proof, type Scalar, type Statement, addPoints, addPointsStarknet, arePointsEqual, assertPointValidity, bigIntToHex, checkStealthAddressOwnershipStarknet, commit, createStealthAddressStarknet, deriveStealthPrivateKeyStarknet, generateChallenge, generateRandomScalarStarknet, getBasePointStarknet, getPublicKey, getPublicKeyStarknet, hexToBigInt, hexToPoint, moduloOrder, negatePoint, pointToHex, poseidonHashScalars, proveFS, randScalar, respond, scalarMultiply, scalarMultiplyStarknet, serializePointForTranscript, moduloOrder as toFr, verify };
