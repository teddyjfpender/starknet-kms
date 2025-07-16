export * from "./prover-operations";

import {
  ProjectivePoint, utils as starkUtils, pedersen
} from "@scure/starknet";
import { CURVE_ORDER } from "she-js";
import {
  RandomSource, defaultRandom, CurveOps, starkCurve, StrategyContext,
  ProofStrategy, FundStrategy, WithdrawAllStrategy, WithdrawStrategy,
  TransferStrategy, ExPostStrategy, SigmaProver
} from "./prover-operations";
import type {
  InputsFund, ProofOfFund, InputsWithdraw, ProofOfWithdraw,
  InputsWithdrawAll, ProofOfWithdrawAll, InputsTransfer, ProofOfTransfer,
  InputsExPost, ProofExPost
} from "she-js";


/**
 * Generic Prover class implementing a facade pattern for confidential transaction proofs.
 * Provides a clean, extensible API for generating zero-knowledge proofs for various
 * confidential operations while abstracting away the underlying sigma protocol complexity.
 * 
 * Key features:
 * - Strategy pattern for different proof types (fund, withdraw, transfer, etc.)
 * - Dependency injection for randomness and curve operations
 * - Type-safe proof generation with comprehensive error handling
 * - Extensible architecture for adding new proof types
 * 
 * Security considerations:
 * - User secret x is never exposed outside the class
 * - All randomness is cryptographically secure
 * - Proofs are zero-knowledge and do not reveal private information
 */
export class Prover extends SigmaProver {
  private readonly strategies = new Map<string, ProofStrategy<any, any>>();

  /**
   * Creates a new Prover instance with a user secret key.
   * 
   * @param x - User's secret scalar (must be kept secure)
   * @param rng - Random number generator (defaults to cryptographically secure)
   * @param curve - Elliptic curve operations (defaults to Starknet curve)
   */
  constructor(
    private readonly x: bigint,
    rng: RandomSource = defaultRandom,
    curve: CurveOps = starkCurve
  ) {
    super(rng, curve);
    
    // Register built-in proof strategies
    this.register("fund", new FundStrategy());
    this.register("withdraw_all", new WithdrawAllStrategy());
    this.register("withdraw", new WithdrawStrategy());
    this.register("transfer", new TransferStrategy());
    this.register("expost", new ExPostStrategy());
  }

  /**
   * Registers a new proof strategy for custom operations.
   * Allows wallets and dApps to extend the prover with domain-specific proofs.
   * 
   * @param name - Unique identifier for the proof type
   * @param strategy - Implementation of the proof strategy
   */
  register<T, R>(name: string, strategy: ProofStrategy<T, R>): void {
    this.strategies.set(name, strategy);
  }

  /**
   * Generates a proof for the specified operation type.
   * Uses dynamic dispatch to the appropriate strategy.
   * 
   * @param name - Type of proof to generate
   * @param data - Input data for the proof
   * @returns Promise resolving to the proof and public inputs
   */
  async prove<T, R>(name: string, data: T): Promise<R> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new Error(`Unknown proof type "${name}". Available types: ${Array.from(this.strategies.keys()).join(", ")}`);
    }
    
    const context: StrategyContext = {
      rnd: this.rnd,
      curve: this.curve,
      sigma: this
    };
    
    return strategy.prove(context, data);
  }

  // ============================================================================
  // Convenience methods for common operations
  // ============================================================================

  /**
   * Generates a funding proof demonstrating ownership of a secret key.
   * Used when depositing funds into a confidential account.
   * 
   * @param nonce - Unique nonce to prevent replay attacks
   * @returns Promise resolving to fund proof and inputs
   */
  async fund(nonce: bigint): Promise<{ inputs: InputsFund; proof: ProofOfFund }> {
    return this.prove<{ x: bigint; nonce: bigint }, { inputs: InputsFund; proof: ProofOfFund }>(
      "fund",
      { x: this.x, nonce }
    );
  }

  /**
   * Generates a proof for withdrawing the entire balance.
   * Proves that the cipher balance equals the claimed amount.
   * 
   * @param params - Withdrawal parameters including cipher balance and destination
   * @returns Promise resolving to withdrawal proof and inputs
   */
  async withdrawAll(params: {
    CL: ProjectivePoint;
    CR: ProjectivePoint;
    nonce: bigint;
    to: bigint;
    amount: bigint;
  }): Promise<{ inputs: InputsWithdrawAll; proof: ProofOfWithdrawAll }> {
    return this.prove<
      { x: bigint; CL: ProjectivePoint; CR: ProjectivePoint; nonce: bigint; to: bigint; amount: bigint },
      { inputs: InputsWithdrawAll; proof: ProofOfWithdrawAll }
    >(
      "withdraw_all",
      { x: this.x, ...params }
    );
  }

  /**
   * Generates a proof for partial withdrawal.
   * Includes range proof to demonstrate remaining balance is non-negative.
   * 
   * @param params - Withdrawal parameters including amounts and destination
   * @returns Promise resolving to withdrawal proof and inputs
   */
  async withdraw(params: {
    initialBalance: bigint;
    amount: bigint;
    CL: ProjectivePoint;
    CR: ProjectivePoint;
    to: bigint;
    nonce: bigint;
  }): Promise<{ inputs: InputsWithdraw; proof: ProofOfWithdraw }> {
    return this.prove<
      { x: bigint; initialBalance: bigint; amount: bigint; CL: ProjectivePoint; CR: ProjectivePoint; to: bigint; nonce: bigint },
      { inputs: InputsWithdraw; proof: ProofOfWithdraw }
    >(
      "withdraw",
      { x: this.x, ...params }
    );
  }

  /**
   * Generates a proof for confidential transfer between accounts.
   * Proves correct encryption to recipient and audit key, plus range proofs.
   * 
   * @param params - Transfer parameters including recipient and amounts
   * @returns Promise resolving to transfer proof and inputs
   */
  async transfer(params: {
    yBar: ProjectivePoint;
    initialBalance: bigint;
    amount: bigint;
    CL: ProjectivePoint;
    CR: ProjectivePoint;
    nonce: bigint;
  }): Promise<{ inputs: InputsTransfer; proof: ProofOfTransfer }> {
    return this.prove<
      { x: bigint; yBar: ProjectivePoint; initialBalance: bigint; amount: bigint; CL: ProjectivePoint; CR: ProjectivePoint; nonce: bigint },
      { inputs: InputsTransfer; proof: ProofOfTransfer }
    >(
      "transfer",
      { x: this.x, ...params }
    );
  }

  /**
   * Generates an ex-post audit proof for transaction verification.
   * Allows auditors to verify transactions were correctly formed after the fact.
   * 
   * @param params - Audit parameters including transaction data
   * @returns Promise resolving to audit proof and inputs
   */
  async auditExPost(params: {
    yBar: ProjectivePoint;
    TL: ProjectivePoint;
    TR: ProjectivePoint;
  }): Promise<{ inputs: InputsExPost; proof: ProofExPost }> {
    return this.prove<
      { x: bigint; yBar: ProjectivePoint; TL: ProjectivePoint; TR: ProjectivePoint },
      { inputs: InputsExPost; proof: ProofExPost }
    >(
      "expost",
      { x: this.x, ...params }
    );
  }

  // ============================================================================
  // Utility methods for wallet integration
  // ============================================================================

  /**
   * Returns the public key corresponding to the secret key.
   * Safe to expose as it doesn't reveal the secret.
   * 
   * @returns Public key as a projective point
   */
  getPublicKey(): ProjectivePoint {
    return this.curve.G.multiply(this.x);
  }

  /**
   * Returns the list of supported proof types.
   * Useful for capability discovery in wallets.
   * 
   * @returns Array of supported proof type names
   */
  getSupportedProofTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Checks if a specific proof type is supported.
   * 
   * @param proofType - Type of proof to check
   * @returns True if the proof type is supported
   */
  supportsProofType(proofType: string): boolean {
    return this.strategies.has(proofType);
  }

  /**
   * Creates a deterministic context for testing.
   * WARNING: Only use for testing - not cryptographically secure!
   * 
   * @param seed - Deterministic seed for testing
   * @returns Test context with predictable randomness
   */
  createTestContext(seed: bigint): StrategyContext {
    let counter = 0n;
    const deterministicRng: RandomSource = () => {
      counter += 1n;
      return (seed + counter) % CURVE_ORDER;
    };
    
    return {
      rnd: deterministicRng,
      curve: this.curve,
      sigma: this
    };
  }
}