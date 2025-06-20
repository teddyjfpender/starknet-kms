# Chaum-Pedersen Proofs: Practical Examples 🚀

> *"The best way to learn is by doing. The second best way is by seeing how others do it."*

This guide provides hands-on examples of using Chaum-Pedersen proofs in real-world scenarios. From basic usage to advanced applications, we'll explore how this elegant cryptographic primitive solves practical problems.

## 🌱 Getting Started: Your First Proof

Let's start with the simplest possible example - creating and verifying a proof:

```typescript
import { proveFS, verify } from './chaum-pedersen'
import { randScalar } from '../core'

// 1. Start with a secret (in practice, this might be a private key)
const mySecret = randScalar()

// 2. Generate a proof that you know this secret
const { stmt, proof } = proveFS(mySecret)

// 3. Anyone can verify your proof
const isValid = verify(stmt, proof)

console.log('Secret value:', mySecret)
console.log('Statement U:', stmt.U)
console.log('Statement V:', stmt.V)  
console.log('Proof is valid:', isValid) // true

// 4. The beautiful part: the verifier learned nothing about mySecret!
```

**What just happened?**
- You proved you know a secret `x` such that `U = x·G` and `V = x·H`
- The verifier confirmed your proof without learning `x`
- The statement `(U, V)` is public, but your secret remains private

## 🔐 Example 1: Privacy-Preserving Authentication

Imagine you're building a system where users need to prove they have a valid private key without revealing it:

```typescript
import { proveFS, verify, type Statement, type Proof } from './chaum-pedersen'
import { getPublicKey } from '../core'

class PrivateAuthenticator {
  private privateKey: Scalar
  public publicKeyG: Point  // Traditional public key U = privateKey·G
  public publicKeyH: Point  // Alternative public key V = privateKey·H
  
  constructor() {
    this.privateKey = randScalar()
    this.publicKeyG = getPublicKey(this.privateKey) // This uses G as generator
    
    // For Chaum-Pedersen, we also need the same key with different generator H
    const { stmt } = proveFS(this.privateKey)
    this.publicKeyH = stmt.V // This is privateKey·H
  }
  
  // Prove you own this identity without revealing the private key
  proveIdentity(): { statement: Statement, proof: Proof } {
    const { stmt, proof } = proveFS(this.privateKey)
    return { statement: stmt, proof }
  }
  
  // Verify someone else's identity proof
  static verifyIdentity(publicKeyG: Point, publicKeyH: Point, proof: Proof): boolean {
    const statement: Statement = { U: publicKeyG, V: publicKeyH }
    return verify(statement, proof)
  }
}

// Usage example
const alice = new PrivateAuthenticator()
const { statement, proof } = alice.proveIdentity()

// Bob can verify Alice's identity without learning her private key
const isAlice = PrivateAuthenticator.verifyIdentity(
  alice.publicKeyG, 
  alice.publicKeyH, 
  proof
)

console.log('Alice proved her identity:', isAlice) // true
```

## 💰 Example 2: Confidential Transaction Amounts

Here's how you might use Chaum-Pedersen proofs in a privacy-preserving payment system:

```typescript
import { proveFS, verify } from './chaum-pedersen'
import { G, H } from './generators'

class ConfidentialTransaction {
  // Prove that two commitments hide the same amount
  static proveAmountConsistency(amount: Scalar): {
    commitment1: Point,  // amount·G (traditional Pedersen commitment)
    commitment2: Point,  // amount·H (alternative commitment)  
    proof: Proof
  } {
    const commitment1 = G.multiply(amount)  // Public commitment using G
    const commitment2 = H.multiply(amount)  // Public commitment using H
    
    const { stmt, proof } = proveFS(amount)
    
    return {
      commitment1: stmt.U,  // This equals amount·G
      commitment2: stmt.V,  // This equals amount·H
      proof
    }
  }
  
  static verifyAmountConsistency(
    commitment1: Point, 
    commitment2: Point, 
    proof: Proof
  ): boolean {
    const statement = { U: commitment1, V: commitment2 }
    return verify(statement, proof)
  }
}

// Alice wants to prove her payment amount is consistent across two systems
const paymentAmount = 1000n // In practice, this would be a private value

const transaction = ConfidentialTransaction.proveAmountConsistency(paymentAmount)

// Bob can verify the commitments hide the same amount
const isConsistent = ConfidentialTransaction.verifyAmountConsistency(
  transaction.commitment1,
  transaction.commitment2, 
  transaction.proof
)

console.log('Transaction amount is consistent:', isConsistent) // true
console.log('But Bob never learned the actual amount!') // Privacy preserved
```

## 🗳️ Example 3: Anonymous Voting System

Here's a simplified anonymous voting system using Chaum-Pedersen proofs:

```typescript
import { proveFS, verify } from './chaum-pedersen'

class AnonymousVoting {
  private voterCredential: Scalar
  public voterID_System1: Point  // Voter ID in registration system
  public voterID_System2: Point  // Voter ID in voting system
  
  constructor() {
    this.voterCredential = randScalar()
    
    // Generate public identities in both systems
    const { stmt } = proveFS(this.voterCredential)
    this.voterID_System1 = stmt.U
    this.voterID_System2 = stmt.V
  }
  
  // Prove you're the same person across both systems without revealing identity
  proveVoterEligibility(): { proof: Proof, voterIDs: Statement } {
    const { stmt, proof } = proveFS(this.voterCredential)
    return { 
      proof, 
      voterIDs: { U: this.voterID_System1, V: this.voterID_System2 }
    }
  }
  
  // Voting system verifies eligibility without learning voter identity
  static verifyEligibility(voterIDs: Statement, proof: Proof): boolean {
    return verify(voterIDs, proof)
  }
}

// Voting scenario
const voter = new AnonymousVoting()

// Voter proves eligibility
const eligibilityProof = voter.proveVoterEligibility()

// Voting system verifies without learning voter's identity
const isEligible = AnonymousVoting.verifyEligibility(
  eligibilityProof.voterIDs,
  eligibilityProof.proof
)

console.log('Voter is eligible:', isEligible) // true
console.log('Voter identity remains private!') // Privacy preserved
```

## 🔄 Example 4: Interactive Protocol (Step by Step)

Sometimes you need the interactive version of the protocol. Here's how to use the low-level APIs:

```typescript
import { commit, respond, generateChallenge, verify } from './chaum-pedersen'
import { G, H } from './generators'

// Simulate an interactive proof between Alice (prover) and Bob (verifier)
class InteractiveProof {
  static async demonstrateInteractiveProtocol() {
    console.log('🎭 Interactive Chaum-Pedersen Proof Demonstration\n')
    
    // === ALICE'S SECRET ===
    const aliceSecret = randScalar()
    const U = G.multiply(aliceSecret)  // Alice's public statement part 1
    const V = H.multiply(aliceSecret)  // Alice's public statement part 2
    
    console.log('📝 Public Statement:')
    console.log(`   U = ${aliceSecret}·G`)
    console.log(`   V = ${aliceSecret}·H`)
    console.log()
    
    // === STEP 1: ALICE'S COMMITMENT ===
    console.log('🎪 Step 1: Alice creates commitment')
    const { commit: commitment, nonce } = commit()
    console.log(`   Alice generated random nonce r`)
    console.log(`   P = r·G = ${commitment.P}`)
    console.log(`   Q = r·H = ${commitment.Q}`)
    console.log(`   Alice sends (P, Q) to Bob`)
    console.log()
    
    // === STEP 2: BOB'S CHALLENGE ===  
    console.log('🎯 Step 2: Bob creates challenge')
    const challenge = generateChallenge(commitment.P, commitment.Q, U, V)
    console.log(`   c = Hash(P, Q, U, V) = ${challenge}`)
    console.log(`   Bob sends c to Alice`)
    console.log()
    
    // === STEP 3: ALICE'S RESPONSE ===
    console.log('🎭 Step 3: Alice creates response')
    const response = respond(aliceSecret, nonce, challenge)
    console.log(`   e = (r + c·x) mod n = ${response}`)
    console.log(`   Alice sends e to Bob`)
    console.log()
    
    // === STEP 4: BOB'S VERIFICATION ===
    console.log('🔍 Step 4: Bob verifies the proof')
    const proof = { ...commitment, c: challenge, e: response }
    const statement = { U, V }
    const isValid = verify(statement, proof)
    
    console.log(`   Bob checks: e·G = P + c·U?`)
    console.log(`   Bob checks: e·H = Q + c·V?`)
    console.log(`   Both equations verified: ${isValid}`)
    console.log()
    
    if (isValid) {
      console.log('✅ Success! Bob is convinced Alice knows the secret x')
      console.log('🔐 But Bob never learned what x actually is!')
    }
    
    return isValid
  }
}

// Run the demonstration
InteractiveProof.demonstrateInteractiveProtocol()
```

## 📦 Example 5: Serialization for Network Transfer

When working with distributed systems, you'll need to serialize proofs:

```typescript
import { proveFS, verify, encodeProof, decodeProof } from './chaum-pedersen'

class NetworkProofSystem {
  // Client side: Create and serialize a proof
  static createProofMessage(secret: Scalar): string {
    const { stmt, proof } = proveFS(secret)
    
    // Serialize the proof to bytes
    const proofBytes = encodeProof(proof)
    
    // Create a message (in real app, you'd use proper serialization)
    const message = {
      statement: {
        U: stmt.U.toHex(),
        V: stmt.V.toHex()
      },
      proof: Array.from(proofBytes) // Convert to regular array for JSON
    }
    
    return JSON.stringify(message)
  }
  
  // Server side: Deserialize and verify a proof
  static verifyProofMessage(messageJson: string): boolean {
    try {
      const message = JSON.parse(messageJson)
      
      // Reconstruct the statement
      const statement = {
        U: Point.fromHex(message.statement.U),
        V: Point.fromHex(message.statement.V)
      }
      
      // Deserialize the proof
      const proofBytes = new Uint8Array(message.proof)
      const proof = decodeProof(proofBytes)
      
      // Verify the proof
      return verify(statement, proof)
      
    } catch (error) {
      console.error('Failed to verify proof message:', error)
      return false
    }
  }
}

// Example usage
const clientSecret = randScalar()

// Client creates and sends proof
const proofMessage = NetworkProofSystem.createProofMessage(clientSecret)
console.log('📤 Proof message size:', proofMessage.length, 'characters')

// Server receives and verifies proof  
const isValidMessage = NetworkProofSystem.verifyProofMessage(proofMessage)
console.log('📥 Server verified proof:', isValidMessage) // true
```

## 🚨 Example 6: Error Handling and Edge Cases

Robust applications need proper error handling:

```typescript
import { proveFS, verify } from './chaum-pedersen'

class RobustProofSystem {
  static safeProveFS(secret: Scalar): { stmt: Statement, proof: Proof } | null {
    try {
      return proveFS(secret)
    } catch (error) {
      console.error('Proof generation failed:', error.message)
      return null
    }
  }
  
  static safeVerify(stmt: Statement, proof: Proof): boolean {
    try {
      return verify(stmt, proof)
    } catch (error) {
      console.error('Proof verification failed:', error.message)
      return false
    }
  }
  
  static demonstrateErrorHandling() {
    console.log('🚨 Error Handling Demonstration\n')
    
    // Test invalid secret (zero)
    console.log('Testing invalid secret (zero):')
    const invalidProof = RobustProofSystem.safeProveFS(0n)
    console.log('Result:', invalidProof ? 'Success' : 'Failed as expected ✓')
    console.log()
    
    // Test invalid secret (too large)
    console.log('Testing invalid secret (CURVE_ORDER):')
    const tooBigSecret = CURVE_ORDER
    const invalidProof2 = RobustProofSystem.safeProveFS(tooBigSecret)
    console.log('Result:', invalidProof2 ? 'Success' : 'Failed as expected ✓')
    console.log()
    
    // Test verification with null inputs
    console.log('Testing verification with invalid inputs:')
    const validResult = RobustProofSystem.safeVerify(null as any, null as any)
    console.log('Result:', validResult ? 'Unexpected success' : 'Failed as expected ✓')
  }
}

RobustProofSystem.demonstrateErrorHandling()
```

## 🎯 Best Practices Summary

Based on these examples, here are the key best practices:

### 🔒 Security
- **Always validate inputs** before creating proofs
- **Never reuse nonces** across different proofs with the same secret
- **Use proper random number generation** for secrets and nonces
- **Validate all points and scalars** in received proofs

### 🚀 Performance  
- **Batch verify** multiple proofs when possible
- **Cache validated points** to avoid repeated validation
- **Use efficient serialization** for network transfer
- **Consider precomputed tables** for frequently used generators

### 🛡️ Robustness
- **Handle all error cases** gracefully
- **Log security-relevant events** without leaking information
- **Use proper error types** to distinguish different failure modes
- **Test edge cases** thoroughly

### 📝 Documentation
- **Document the meaning** of each statement being proven
- **Explain the security assumptions** to users
- **Provide clear examples** for common use cases
- **Keep proofs and statements together** in data structures

---

## 🎓 What's Next?

Now that you've seen practical examples, you might want to explore:

- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Technical implementation details
- **[SECURITY.md](./SECURITY.md)** - Security analysis and threat modeling  
- **[PROTOCOL.md](./PROTOCOL.md)** - Mathematical foundations and proofs

The examples in this guide should give you a solid foundation for building privacy-preserving applications with Chaum-Pedersen proofs. Remember: the goal isn't just to prove knowledge, but to do so in a way that preserves privacy and maintains security.

*Happy proving! 🎉* 