import {
  ProjectivePoint, utils as starkUtils, pedersen, computeHashOnElements
} from "@scure/starknet";
import {
  CURVE_ORDER, encrypt, g, h, view,
  cipher_balance, prove_range, verify_range, decipher_balance,
  type InputsFund, type ProofOfFund, type InputsWithdraw, type ProofOfWithdraw,
  type InputsWithdrawAll, type ProofOfWithdrawAll, type InputsTransfer, type ProofOfTransfer,
  type InputsExPost, type ProofExPost, type ProofOfBit
} from "she-js";

/**
 * RandomSource interface for generating cryptographically secure random scalars.
 * Used throughout the prover for generating blinding factors and challenges.
 */
export interface RandomSource { (): bigint; }

/**
 * Default random source implementation using Starknet's secure random utilities.
 * Generates scalars normalized to the curve order for use in cryptographic operations.
 */
export const defaultRandom: RandomSource = () =>
  starkUtils.normPrivateKeyToScalar(starkUtils.randomPrivateKey());

/**
 * CurveOps interface abstracts elliptic curve operations for the prover.
 * Allows for dependency injection and testability while maintaining performance.
 */
export interface CurveOps {
  readonly G: ProjectivePoint;
  readonly H: ProjectivePoint;
  multiplyUnsafe(p: ProjectivePoint, k: bigint): ProjectivePoint;
  add(p: ProjectivePoint, q: ProjectivePoint): ProjectivePoint;
}

/**
 * Starknet curve operations implementation using the standard generators.
 * G and H are carefully chosen generators with no known discrete log relationship.
 */
export const starkCurve: CurveOps = {
  G: g, H: h,
  multiplyUnsafe: (p, k) => p.multiplyUnsafe(k),
  add:           (p, q) => p.add(q)
};

/**
 * Pedersen-based hash function for reducing arrays of field elements.
 * Used for challenge generation in Fiat-Shamir transformation.
 */
function ped2(data: bigint[], fn = pedersen): bigint {
  return data.reduce((x, y) => BigInt(fn(x, y)));
}

/**
 * Generates a Fiat-Shamir challenge from a prefix and commitment points.
 * Uses a secure hash-to-scalar technique to ensure uniform distribution.
 * 
 * @param prefix - Domain separator for the challenge
 * @param commits - Array of elliptic curve points to include in challenge
 * @param curveOrder - Order of the elliptic curve group
 * @returns A scalar challenge in the range [0, curveOrder)
 */
export function challenge(
  prefix: bigint,
  commits: ProjectivePoint[],
  curveOrder = CURVE_ORDER
): bigint {
  const data: bigint[] = [prefix];
  for (const c of commits) {
    const { x, y } = c.toAffine();
    data.push(x, y);
  }
  const base = ped2(data);
  let salt = 1n, c = curveOrder + 1n;
  while (c >= curveOrder) {
    c = ped2([base, salt++]);
  }
  return c;
}

/**
 * Abstract base class for sigma protocol implementations.
 * Provides common functionality for proof-of-exponent protocols.
 * Uses the template method pattern to allow specialization.
 */
export abstract class SigmaProver {
  protected constructor(
    protected readonly rnd: RandomSource,
    protected readonly curve: CurveOps
  ) {}

  /**
   * Proof of Exponent (POE) for single base.
   * Proves knowledge of x such that y = base^x without revealing x.
   * 
   * Protocol:
   * 1. Prover picks random k, computes A = base^k
   * 2. Challenge c = H(prefix, A)
   * 3. Response s = k + x*c
   * 4. Verifier checks: base^s = A * y^c
   */
  protected provePOE(
    x: bigint,
    base: ProjectivePoint,
    prefix: bigint
  ): { y: ProjectivePoint; A: ProjectivePoint; s: bigint } {
    const k = this.rnd();
    const y = base.multiply(x);
    const A = base.multiplyUnsafe(k);
    const c = challenge(prefix, [A]);
    const s = (k + x * c) % CURVE_ORDER;
    return { y, A, s };
  }

  /**
   * Proof of Exponent for two bases (POE2).
   * Proves knowledge of x1, x2 such that y = g1^x1 * g2^x2.
   * 
   * Protocol:
   * 1. Prover picks random k1, k2, computes A = g1^k1 * g2^k2
   * 2. Challenge c = H(prefix, A)
   * 3. Responses s1 = k1 + x1*c, s2 = k2 + x2*c
   * 4. Verifier checks: g1^s1 * g2^s2 = A * y^c
   */
  protected provePOE2(
    x1: bigint, x2: bigint,
    g1: ProjectivePoint, g2: ProjectivePoint,
    prefix: bigint
  ) {
    const k1 = this.rnd();
    const k2 = this.rnd();
    const y = g1.multiply(x1).add(g2.multiply(x2));
    const A = g1.multiplyUnsafe(k1).add(g2.multiplyUnsafe(k2));
    const c = challenge(prefix, [A]);
    const s1 = (k1 + x1 * c) % CURVE_ORDER;
    const s2 = (k2 + x2 * c) % CURVE_ORDER;
    return { y, A, s1, s2 };
  }

  /**
   * Creates a cipher balance (L, R) for amount with randomness.
   * L = G^amount * y^r, R = G^r where y is recipient's public key.
   */
  protected cipherBalance(
    y: ProjectivePoint,
    amount: bigint,
    random: bigint
  ): { L: ProjectivePoint; R: ProjectivePoint } {
    return cipher_balance(y, amount, random);
  }

  /**
   * Generates a range proof for a value within [0, 2^bits).
   * Uses bit decomposition and proves each bit is 0 or 1.
   */
  protected rangeProve(
    value: bigint,
    bits: number
  ): { r: bigint; proof: ProofOfBit[] } {
    return prove_range(value, bits);
  }
}

/**
 * Strategy context provides access to crypto primitives for proof strategies.
 * Allows strategies to access randomness, curve operations, and sigma protocols.
 */
export interface StrategyContext {
  readonly rnd: RandomSource;
  readonly curve: CurveOps;
  readonly sigma: SigmaProver;
}

/**
 * ProofStrategy interface defines the contract for domain-specific proof implementations.
 * Each strategy encapsulates the logic for a specific confidential operation.
 */
export interface ProofStrategy<I, O> {
  prefix(data: I): bigint;              // Domain separator computation
  commitPoints(data: I): ProjectivePoint[]; // Points for Fiat-Shamir
  prove(inner: StrategyContext, data: I): Promise<O>;
}

/**
 * FundStrategy implements the proof required for funding operations.
 * Proves knowledge of secret key x for public key y = G^x.
 */
export class FundStrategy implements ProofStrategy<
  { x: bigint; nonce: bigint },
  { inputs: InputsFund; proof: ProofOfFund }
>{
  /**
   * Computes the domain separator for fund operations.
   * Includes the fund selector and encrypted user key.
   */
  prefix(d: { x: bigint; nonce: bigint }): bigint {
    const sel = 1718972004n;
    const { x, y } = encrypt(d.x);
    return ped2([0n, sel, x, y, d.nonce]);
  }

  commitPoints(): ProjectivePoint[] { return []; }

  /**
   * Generates a proof of fund by proving knowledge of the secret key.
   */
  async prove(ctx: StrategyContext, { x, nonce }: { x: bigint; nonce: bigint }) {
    const k = ctx.rnd();
    const y = ctx.curve.G.multiply(x);
    const A = ctx.curve.G.multiplyUnsafe(k);
    const c = challenge(this.prefix({ x, nonce }), [A]);
    const s = (k + x * c) % CURVE_ORDER;
    
    const inputs: InputsFund = { y, nonce };
    const proof: ProofOfFund = { Ax: A, sx: s };
    return { inputs, proof };
  }
}

/**
 * WithdrawAllStrategy implements the proof for withdrawing entire balance.
 * Proves knowledge of secret key and that the cipher balance equals the amount.
 */
export class WithdrawAllStrategy implements ProofStrategy<
  { x: bigint; CL: ProjectivePoint; CR: ProjectivePoint; nonce: bigint; to: bigint; amount: bigint },
  { inputs: InputsWithdrawAll; proof: ProofOfWithdrawAll }
>{
  prefix(d: { x: bigint; CL: ProjectivePoint; CR: ProjectivePoint; nonce: bigint; to: bigint; amount: bigint }): bigint {
    const sel = 36956203100010950502698282092n;
    const y = this.getPublicKey(d.x);
    return ped2([0n, sel, y.x, y.y, d.to, d.nonce]);
  }

  commitPoints(): ProjectivePoint[] { return []; }

  private getPublicKey(x: bigint): { x: bigint; y: bigint } {
    return g.multiply(x).toAffine();
  }

  /**
   * Generates a proof for withdrawing all balance.
   * Proves L/G^amount = R^x, demonstrating correct balance.
   */
  async prove(ctx: StrategyContext, { x, CL, CR, nonce, to, amount }) {
    const y = ctx.curve.G.multiply(x);
    const inputs: InputsWithdrawAll = {
      y, nonce, to, amount, L: CL, R: CR
    };
    
    const prefix = this.prefix({ x, CL, CR, nonce, to, amount });
    const k = ctx.rnd();
    const A_x = ctx.curve.G.multiplyUnsafe(k);
    const A_cr = CR.multiplyUnsafe(k);
    
    const c = challenge(prefix, [A_x, A_cr]);
    const s_x = (k + x * c) % CURVE_ORDER;
    
    const proof: ProofOfWithdrawAll = { A_x, A_cr, s_x };
    return { inputs, proof };
  }
}

/**
 * WithdrawStrategy implements partial withdrawal proofs.
 * Proves knowledge of secret key and range proof for remaining balance.
 */
export class WithdrawStrategy implements ProofStrategy<
  { x: bigint; initialBalance: bigint; amount: bigint; CL: ProjectivePoint; CR: ProjectivePoint; to: bigint; nonce: bigint },
  { inputs: InputsWithdraw; proof: ProofOfWithdraw }
>{
  prefix(d: { x: bigint; to: bigint; nonce: bigint }): bigint {
    const sel = 8604536554778681719n;
    const y = g.multiply(d.x).toAffine();
    return ped2([0n, sel, y.x, y.y, d.to, d.nonce]);
  }

  commitPoints(): ProjectivePoint[] { return []; }

  /**
   * Generates a proof for partial withdrawal.
   * Includes range proof to show remaining balance is non-negative.
   */
  async prove(ctx: StrategyContext, { x, initialBalance, amount, CL, CR, to, nonce }) {
    const y = ctx.curve.G.multiply(x);
    const inputs: InputsWithdraw = {
      y, nonce, L: CL, R: CR, to, amount
    };
    
    const prefix = this.prefix({ x, to, nonce });
    const remainingBalance = initialBalance - amount;
    const { r, proof: range } = prove_range(remainingBalance, 32);
    
    const kb = ctx.rnd();
    const kx = ctx.rnd();
    const kr = ctx.rnd();
    
    const A_x = ctx.curve.G.multiplyUnsafe(kx);
    const A = ctx.curve.G.multiplyUnsafe(kb).add(CR.multiplyUnsafe(kx));
    const A_v = ctx.curve.G.multiplyUnsafe(kb).add(ctx.curve.H.multiplyUnsafe(kr));
    
    const c = challenge(prefix, [A_x, A, A_v]);
    
    const sb = (kb + remainingBalance * c) % CURVE_ORDER;
    const sx = (kx + x * c) % CURVE_ORDER;
    const sr = (kr + r * c) % CURVE_ORDER;
    
    const proof: ProofOfWithdraw = {
      A_x, A, A_v, sx, sb, sr, range
    };
    return { inputs, proof };
  }
}

/**
 * TransferStrategy implements confidential transfer proofs.
 * Proves correct transfer amount and range proofs for both sent and remaining amounts.
 */
export class TransferStrategy implements ProofStrategy<
  { x: bigint; yBar: ProjectivePoint; initialBalance: bigint; amount: bigint; CL: ProjectivePoint; CR: ProjectivePoint; nonce: bigint },
  { inputs: InputsTransfer; proof: ProofOfTransfer }
>{
  prefix(d: { x: bigint; yBar: ProjectivePoint; L: ProjectivePoint; R: ProjectivePoint; nonce: bigint }): bigint {
    const sel = 8390876182755042674n;
    const y = g.multiply(d.x).toAffine();
    const yBar = d.yBar.toAffine();
    const L = d.L.toAffine();
    const R = d.R.toAffine();
    return ped2([0n, sel, y.x, y.y, yBar.x, yBar.y, L.x, L.y, R.x, R.y, d.nonce]);
  }

  commitPoints(): ProjectivePoint[] { return []; }

  /**
   * Generates a proof for confidential transfer.
   * Proves correct encryption to recipient and audit key, plus range proofs.
   */
  async prove(ctx: StrategyContext, { x, yBar, initialBalance, amount, CL, CR, nonce }) {
    const y = ctx.curve.G.multiply(x);
    
    const { r, proof: range } = prove_range(amount, 32);
    const { L, R } = cipher_balance(y, amount, r);
    const L_bar = cipher_balance(yBar, amount, r).L;
    const L_audit = cipher_balance(view, amount, r).L;
    
    const inputs: InputsTransfer = {
      y, y_bar: yBar, CL, CR, nonce, L, R, L_bar, L_audit
    };
    
    const prefix = this.prefix({ x, yBar, L, R, nonce });
    const remainingBalance = initialBalance - amount;
    const { r: r2, proof: range2 } = prove_range(remainingBalance, 32);
    const G = CR.subtract(R);
    
    const kx = ctx.rnd();
    const kb = ctx.rnd();
    const kr = ctx.rnd();
    const kb2 = ctx.rnd();
    const kr2 = ctx.rnd();
    
    const A_x = ctx.curve.G.multiplyUnsafe(kx);
    const A_r = ctx.curve.G.multiplyUnsafe(kr);
    const A_b = ctx.curve.G.multiplyUnsafe(kb).add(y.multiplyUnsafe(kr));
    const A_bar = ctx.curve.G.multiplyUnsafe(kb).add(yBar.multiplyUnsafe(kr));
    const A_audit = ctx.curve.G.multiplyUnsafe(kb).add(view.multiplyUnsafe(kr));
    const A_v = ctx.curve.G.multiplyUnsafe(kb).add(ctx.curve.H.multiplyUnsafe(kr));
    const A_b2 = ctx.curve.G.multiplyUnsafe(kb2).add(G.multiplyUnsafe(kx));
    const A_v2 = ctx.curve.G.multiplyUnsafe(kb2).add(ctx.curve.H.multiplyUnsafe(kr2));
    
    const c = challenge(prefix, [A_x, A_r, A_b, A_b2, A_v, A_v2, A_bar, A_audit]);
    
    const s_x = (kx + x * c) % CURVE_ORDER;
    const s_b = (kb + amount * c) % CURVE_ORDER;
    const s_r = (kr + r * c) % CURVE_ORDER;
    const s_b2 = (kb2 + remainingBalance * c) % CURVE_ORDER;
    const s_r2 = (kr2 + r2 * c) % CURVE_ORDER;
    
    const proof: ProofOfTransfer = {
      A_x, A_r, A_b, A_b2, A_v, A_v2, A_bar, A_audit,
      s_x, s_r, s_b, s_b2, s_r2, range, range2
    };
    return { inputs, proof };
  }
}

/**
 * ExPostStrategy implements audit proofs for post-transaction verification.
 * Proves that a transaction was correctly formed after the fact.
 */
export class ExPostStrategy implements ProofStrategy<
  { x: bigint; yBar: ProjectivePoint; TL: ProjectivePoint; TR: ProjectivePoint },
  { inputs: InputsExPost; proof: ProofExPost }
>{
  prefix(): bigint {
    return 0n; // Ex-post audits use 0 prefix
  }

  commitPoints(): ProjectivePoint[] { return []; }

  /**
   * Generates a proof for ex-post audit.
   * Proves that the transaction was correctly formed with proper encryptions.
   */
  async prove(ctx: StrategyContext, { x, yBar, TL, TR }) {
    const y = ctx.curve.G.multiply(x);
    
    // Decrypt the transaction amount using the she-js function
    const amount = decipher_balance(x, TL, TR);
    
    const r = ctx.rnd();
    const { L, R } = cipher_balance(y, amount, r);
    const L_bar = cipher_balance(yBar, amount, r).L;
    
    const inputs: InputsExPost = {
      y, y_bar: yBar, L, L_bar, R, TL, TR
    };
    
    const kx = ctx.rnd();
    const kr = ctx.rnd();
    const kb = ctx.rnd();
    
    const Ax = ctx.curve.G.multiplyUnsafe(kx);
    const Ar = ctx.curve.G.multiplyUnsafe(kr);
    const A = ctx.curve.G.multiplyUnsafe(kb).add(y.multiplyUnsafe(kr));
    const A_bar = ctx.curve.G.multiplyUnsafe(kb).add(yBar.multiplyUnsafe(kr));
    const G = TR.subtract(R);
    const At = G.multiplyUnsafe(kx);
    
    const c = challenge(0n, [Ax, Ar, At, A, A_bar]);
    
    const sx = (kx + x * c) % CURVE_ORDER;
    const sr = (kr + r * c) % CURVE_ORDER;
    const sb = (kb + amount * c) % CURVE_ORDER;
    
    const proof: ProofExPost = {
      Ax, Ar, At, A, A_bar, sx, sb, sr
    };
    return { inputs, proof };
  }
}