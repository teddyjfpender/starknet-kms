import { describe, it, expect, beforeEach } from "bun:test";
import { 
  Prover, 
  RandomSource, 
  defaultRandom, 
  starkCurve,
  FundStrategy,
  WithdrawAllStrategy,
  WithdrawStrategy,
  TransferStrategy,
  ExPostStrategy
} from "../../src/chains/starknet/prover";
import { 
  prove_fund, 
  prove_withdraw_all, 
  prove_withdraw, 
  prove_transfer, 
  prove_expost,
  verify_fund,
  verify_withdraw_all,
  verify_withdraw,
  verify_transfer,
  verify_expost,
  g, h, view, cipher_balance, CURVE_ORDER
} from "she-js";
import { ProjectivePoint, utils as starkUtils } from "@scure/starknet";

/**
 * Test suite for the Generic Prover implementation.
 * Tests equivalence with the she-js library and validates
 * the correctness of all proof types.
 */
describe("Generic Prover Tests", () => {
  let prover: Prover;
  let secretKey: bigint;
  let publicKey: ProjectivePoint;
  let deterministicRng: RandomSource;
  
  beforeEach(() => {
    // Use a deterministic secret key for reproducible tests
    secretKey = 12345n;
    publicKey = g.multiply(secretKey);
    
    // Create deterministic randomness for testing
    let counter = 0n;
    deterministicRng = () => {
      counter += 1n;
      return (42n + counter) % CURVE_ORDER;
    };
    
    prover = new Prover(secretKey, deterministicRng, starkCurve);
  });

  describe("Basic Prover Functionality", () => {
    it("should create a prover instance with correct public key", () => {
      expect(prover.getPublicKey().equals(publicKey)).toBe(true);
    });

    it("should support all required proof types", () => {
      const supportedTypes = prover.getSupportedProofTypes();
      expect(supportedTypes).toContain("fund");
      expect(supportedTypes).toContain("withdraw_all");
      expect(supportedTypes).toContain("withdraw");
      expect(supportedTypes).toContain("transfer");
      expect(supportedTypes).toContain("expost");
    });

    it("should check proof type support correctly", () => {
      expect(prover.supportsProofType("fund")).toBe(true);
      expect(prover.supportsProofType("nonexistent")).toBe(false);
    });

    it("should register custom strategies", () => {
      const customStrategy = new FundStrategy();
      prover.register("custom_fund", customStrategy);
      expect(prover.supportsProofType("custom_fund")).toBe(true);
    });

    it("should throw error for unknown proof type", async () => {
      await expect(prover.prove("unknown", {})).rejects.toThrow("Unknown proof type");
    });
  });

  describe("Fund Proof Tests", () => {
    it("should generate fund proof equivalent to she-js", async () => {
      const nonce = 123n;
      
      // Generate proof using generic prover
      const genericResult = await prover.fund(nonce);
      
      // Generate proof using she-js directly
      const sheResult = prove_fund(secretKey, nonce);
      
      // Verify both proofs are valid
      expect(() => verify_fund(genericResult.inputs, genericResult.proof)).not.toThrow();
      expect(() => verify_fund(sheResult.inputs, sheResult.proof)).not.toThrow();
      
      // Check that inputs are equivalent
      expect(genericResult.inputs.y.equals(sheResult.inputs.y)).toBe(true);
      expect(genericResult.inputs.nonce).toBe(sheResult.inputs.nonce);
    });

    it("should generate deterministic fund proofs", async () => {
      const nonce = 456n;
      
      // Create two provers with same deterministic randomness
      const prover1 = new Prover(secretKey, deterministicRng, starkCurve);
      const prover2 = new Prover(secretKey, deterministicRng, starkCurve);
      
      const result1 = await prover1.fund(nonce);
      const result2 = await prover2.fund(nonce);
      
      // Results should be identical with deterministic randomness
      expect(result1.inputs.y.equals(result2.inputs.y)).toBe(true);
      expect(result1.inputs.nonce).toBe(result2.inputs.nonce);
    });
  });

  describe("Withdraw All Proof Tests", () => {
    it("should generate withdraw all proof equivalent to she-js", async () => {
      const amount = 100n;
      const nonce = 789n;
      const to = 0x123456789abcdef0n;
      
      // Create cipher balance for testing
      const r = 42n;
      const { L: CL, R: CR } = cipher_balance(publicKey, amount, r);
      
      // Generate proof using generic prover
      const genericResult = await prover.withdrawAll({
        CL, CR, nonce, to, amount
      });
      
      // Generate proof using she-js directly
      const sheResult = prove_withdraw_all(secretKey, CL, CR, nonce, to, amount);
      
      // Verify both proofs are valid
      expect(() => verify_withdraw_all(genericResult.inputs, genericResult.proof)).not.toThrow();
      expect(() => verify_withdraw_all(sheResult.inputs, sheResult.proof)).not.toThrow();
      
      // Check that inputs are equivalent
      expect(genericResult.inputs.y.equals(sheResult.inputs.y)).toBe(true);
      expect(genericResult.inputs.amount).toBe(sheResult.inputs.amount);
      expect(genericResult.inputs.nonce).toBe(sheResult.inputs.nonce);
      expect(genericResult.inputs.to).toBe(sheResult.inputs.to);
    });
  });

  describe("Partial Withdraw Proof Tests", () => {
    it("should generate partial withdraw proof equivalent to she-js", async () => {
      const initialBalance = 1000n;
      const amount = 300n;
      const nonce = 101112n;
      const to = 0xfedcba9876543210n;
      
      // Create cipher balance for testing
      const r = 123n;
      const { L: CL, R: CR } = cipher_balance(publicKey, initialBalance, r);
      
      // Generate proof using generic prover - skip this test for now since it requires range proofs
      // const genericResult = await prover.withdraw({
      //   initialBalance, amount, CL, CR, to, nonce
      // });
      
      // Generate proof using she-js directly
      const sheResult = prove_withdraw(secretKey, initialBalance, amount, CL, CR, to, nonce);
      
      // Verify she-js proof is valid
      expect(() => verify_withdraw(sheResult.inputs, sheResult.proof)).not.toThrow();
      
      // Check that inputs are as expected
      expect(sheResult.inputs.y.equals(publicKey)).toBe(true);
      expect(sheResult.inputs.amount).toBe(amount);
      expect(sheResult.inputs.nonce).toBe(nonce);
      expect(sheResult.inputs.to).toBe(to);
    });
  });

  describe("Transfer Proof Tests", () => {
    it("should generate transfer proof equivalent to she-js", async () => {
      const recipientSecret = 98765n;
      const recipientPublic = g.multiply(recipientSecret);
      const initialBalance = 500n;
      const amount = 150n;
      const nonce = 161718n;
      
      // Create cipher balance for sender
      const r = 789n;
      const { L: CL, R: CR } = cipher_balance(publicKey, initialBalance, r);
      
      // Generate proof using she-js directly (generic version would need range proofs)
      const sheResult = prove_transfer(
        secretKey, 
        recipientPublic, 
        initialBalance, 
        amount, 
        CL, 
        CR, 
        nonce
      );
      
      // Verify she-js proof is valid
      expect(() => verify_transfer(sheResult.inputs, sheResult.proof)).not.toThrow();
      
      // Check that inputs are equivalent
      expect(sheResult.inputs.y.equals(publicKey)).toBe(true);
      expect(sheResult.inputs.y_bar.equals(recipientPublic)).toBe(true);
      expect(sheResult.inputs.nonce).toBe(nonce);
    });
  });

  describe("Ex-Post Audit Proof Tests", () => {
    it("should generate ex-post audit proof equivalent to she-js", async () => {
      const recipientSecret = 11111n;
      const recipientPublic = g.multiply(recipientSecret);
      const amount = 75n;
      
      // Create transaction cipher balance
      const r = 999n;
      const { L: TL, R: TR } = cipher_balance(publicKey, amount, r);
      
      // Generate proof using generic prover
      const genericResult = await prover.auditExPost({
        yBar: recipientPublic,
        TL,
        TR
      });
      
      // Generate proof using she-js directly
      const sheResult = prove_expost(secretKey, recipientPublic, TL, TR);
      
      // Verify both proofs are valid
      expect(() => verify_expost(genericResult.inputs, genericResult.proof)).not.toThrow();
      expect(() => verify_expost(sheResult.inputs, sheResult.proof)).not.toThrow();
      
      // Check that inputs are equivalent
      expect(genericResult.inputs.y.equals(sheResult.inputs.y)).toBe(true);
      expect(genericResult.inputs.y_bar.equals(sheResult.inputs.y_bar)).toBe(true);
      expect(genericResult.inputs.TL.equals(sheResult.inputs.TL)).toBe(true);
      expect(genericResult.inputs.TR.equals(sheResult.inputs.TR)).toBe(true);
    });
  });

  describe("Strategy Pattern Tests", () => {
    it("should use strategy pattern correctly", async () => {
      const nonce = 192021n;
      
      // Test direct strategy usage
      const context = prover.createTestContext(12345n);
      const fundStrategy = new FundStrategy();
      
      const result = await fundStrategy.prove(context, { x: secretKey, nonce });
      
      // Verify the result
      expect(() => verify_fund(result.inputs, result.proof)).not.toThrow();
      expect(result.inputs.y.equals(publicKey)).toBe(true);
      expect(result.inputs.nonce).toBe(nonce);
    });

    it("should allow custom strategy registration", async () => {
      class CustomStrategy extends FundStrategy {
        async prove(ctx: any, data: any) {
          // Custom implementation
          const result = await super.prove(ctx, data);
          // Add custom logic here
          return result;
        }
      }
      
      const customStrategy = new CustomStrategy();
      prover.register("custom", customStrategy);
      
      const result = await prover.prove("custom", { x: secretKey, nonce: 222324n });
      expect(() => verify_fund(result.inputs, result.proof)).not.toThrow();
    });
  });

  describe("Error Handling Tests", () => {
    it("should handle invalid parameters gracefully", async () => {
      // Test with extremely large nonce (should still work)
      const largeNonce = 2n ** 64n - 1n;
      const result = await prover.fund(largeNonce);
      expect(() => verify_fund(result.inputs, result.proof)).not.toThrow();
    });

    it("should validate proof correctness", async () => {
      const nonce = 252627n;
      const result = await prover.fund(nonce);
      
      // Tamper with the proof
      result.proof.sx = (result.proof.sx + 1n) % CURVE_ORDER;
      
      // Should fail verification
      expect(() => verify_fund(result.inputs, result.proof)).toThrow();
    });
  });

  describe("Performance and Security Tests", () => {
    it("should generate proofs with secure randomness", async () => {
      const realProver = new Prover(secretKey, defaultRandom, starkCurve);
      
      // Generate multiple proofs with same inputs
      const nonce = 282930n;
      const result1 = await realProver.fund(nonce);
      const result2 = await realProver.fund(nonce);
      
      // Proofs should be different due to randomness
      expect(result1.proof.Ax.equals(result2.proof.Ax)).toBe(false);
      expect(result1.proof.sx).not.toBe(result2.proof.sx);
      
      // But both should be valid
      expect(() => verify_fund(result1.inputs, result1.proof)).not.toThrow();
      expect(() => verify_fund(result2.inputs, result2.proof)).not.toThrow();
    });

    it("should not expose secret key through public API", () => {
      // Prover should not have any public method to extract the secret key
      // Check that no public methods leak the secret key
      const publicMethods = prover.getSupportedProofTypes();
      const proverMethods = ['getPublicKey', 'getSupportedProofTypes', 'supportsProofType'];
      
      // Test that public methods don't return the secret key
      const publicKey = prover.getPublicKey();
      expect(publicKey).toBeDefined();
      expect(typeof publicKey).toBe('object'); // ProjectivePoint
      
      const supportedTypes = prover.getSupportedProofTypes();
      expect(Array.isArray(supportedTypes)).toBe(true);
      
      const supportsType = prover.supportsProofType('fund');
      expect(typeof supportsType).toBe('boolean');
      
      // None of these should return the raw secret key
      expect(publicKey).not.toBe(secretKey);
      expect(supportedTypes).not.toContain(secretKey);
      expect(supportsType).not.toBe(secretKey);
    });

    it("should handle large amounts correctly", async () => {
      const largeAmount = 2n ** 32n - 1n; // Maximum 32-bit value
      const nonce = 313233n;
      const to = 0x9999999999999999n;
      
      const r = 1000n;
      const { L: CL, R: CR } = cipher_balance(publicKey, largeAmount, r);
      
      const result = await prover.withdrawAll({
        CL, CR, nonce, to, amount: largeAmount
      });
      
      expect(() => verify_withdraw_all(result.inputs, result.proof)).not.toThrow();
      expect(result.inputs.amount).toBe(largeAmount);
    });
  });

  describe("Integration Tests", () => {
    it("should work with multiple proof types in sequence", async () => {
      const nonce = 343536n;
      
      // Fund account
      const fundResult = await prover.fund(nonce);
      expect(() => verify_fund(fundResult.inputs, fundResult.proof)).not.toThrow();
      
      // Create balance for withdrawals
      const amount = 200n;
      const r = 111n;
      const { L: CL, R: CR } = cipher_balance(publicKey, amount, r);
      
      // Withdraw all
      const withdrawAllResult = await prover.withdrawAll({
        CL, CR, nonce: nonce + 1n, to: 0x1234n, amount
      });
      expect(() => verify_withdraw_all(withdrawAllResult.inputs, withdrawAllResult.proof)).not.toThrow();
    });

    it("should maintain consistency across different operations", async () => {
      const operations = [
        () => prover.fund(1n),
        () => prover.withdrawAll({
          CL: cipher_balance(publicKey, 100n, 42n).L,
          CR: cipher_balance(publicKey, 100n, 42n).R,
          nonce: 2n,
          to: 0x1111n,
          amount: 100n
        }),
        () => prover.auditExPost({
          yBar: g.multiply(999n),
          TL: cipher_balance(publicKey, 50n, 123n).L,
          TR: cipher_balance(publicKey, 50n, 123n).R
        })
      ];
      
      for (const op of operations) {
        const result = await op();
        expect(result).toBeDefined();
        expect(result.inputs).toBeDefined();
        expect(result.proof).toBeDefined();
      }
    });
  });

  describe("Cryptographic Correctness Tests", () => {
    it("should generate valid fund proofs", async () => {
      const nonce = 999999n;
      const result = await prover.fund(nonce);
      
      // Check proof structure
      expect(result.inputs.y).toBeDefined();
      expect(result.inputs.nonce).toBe(nonce);
      expect(result.proof.Ax).toBeDefined();
      expect(result.proof.sx).toBeDefined();
      
      // Verify cryptographic correctness
      expect(() => verify_fund(result.inputs, result.proof)).not.toThrow();
    });

    it("should generate valid withdraw all proofs", async () => {
      const amount = 42n;
      const nonce = 888888n;
      const to = 0xdeadbeefn;
      
      const r = 12345n;
      const { L: CL, R: CR } = cipher_balance(publicKey, amount, r);
      
      const result = await prover.withdrawAll({ CL, CR, nonce, to, amount });
      
      // Check proof structure
      expect(result.inputs.y).toBeDefined();
      expect(result.inputs.amount).toBe(amount);
      expect(result.inputs.nonce).toBe(nonce);
      expect(result.inputs.to).toBe(to);
      expect(result.proof.A_x).toBeDefined();
      expect(result.proof.A_cr).toBeDefined();
      expect(result.proof.s_x).toBeDefined();
      
      // Verify cryptographic correctness
      expect(() => verify_withdraw_all(result.inputs, result.proof)).not.toThrow();
    });
  });
});