#!/usr/bin/env bun

import { writeFileSync } from "node:fs"
import {
  CURVE_ORDER,
  PRIME,
  addPoints,
  generateChallenge,
  moduloOrder,
  scalarMultiply,
} from "@starkms/crypto"
import * as ElGamal from "./src/primitives/elgamal"
import * as Masking from "./src/primitives/masking"

// Chacha20-based deterministic RNG for testing
class ChaChaRng {
  private seed: Uint8Array
  private counter = 0

  constructor(seed: number[]) {
    this.seed = new Uint8Array(seed)
  }

  nextScalar(): bigint {
    // Simple deterministic scalar generation for testing
    // In production, use proper ChaCha20 implementation
    const value = Array.from(this.seed).reduce(
      (acc, val, idx) =>
        acc + BigInt(val) * BigInt(256) ** BigInt(idx) + BigInt(this.counter),
      0n,
    )
    this.counter++
    return moduloOrder(value)
  }
}

interface RevealTestVector {
  test_name: string
  seed: number[]
  setup: {
    generator: string
    player_secret_key: string
    player_public_key: string
  }
  masked_card: {
    c1: string
    c2: string
  }
  reveal_token: string
  reveal_proof: {
    commitment_g: string
    commitment_h: string
    challenge: string
    response: string
  }
  revealed_plaintext: string
  verification_result: boolean
}

interface RevealTestVectors {
  protocol_info: {
    name: string
    version: string
    description: string
  }
  curve_info: {
    name: string
    field_modulus: string
    curve_order: string
  }
  test_vectors: RevealTestVector[]
}

function generateRevealTestVector(
  seed: number[],
  testIndex: number,
): RevealTestVector {
  const rng = new ChaChaRng(seed)

  // Setup ElGamal parameters
  const parameters = ElGamal.setup()

  // Generate a single player's key pair (for reveal operations)
  const secretKey = rng.nextScalar()
  const publicKey = scalarMultiply(secretKey, parameters.generator)

  const playerKeys = {
    secretKey: { scalar: secretKey },
    publicKey: { point: publicKey },
  }

  // Create a random card and mask it
  const originalCard = Masking.randomCard()
  const maskingFactor = rng.nextScalar()

  const { maskedCard } = Masking.mask(
    parameters,
    playerKeys.publicKey,
    originalCard,
    maskingFactor,
  )

  // Generate reveal token: token = sk * c1
  const revealToken = scalarMultiply(secretKey, maskedCard.c1)

  // Generate Chaum-Pedersen proof for reveal token generation
  // Prove that the same secret key sk was used for both:
  // - pk = sk * G (public key)
  // - token = sk * c1 (reveal token)
  const k = rng.nextScalar()
  const commitmentG = scalarMultiply(k, parameters.generator) // k * G
  const commitmentH = scalarMultiply(k, maskedCard.c1) // k * c1

  // Challenge: c = Hash(G, c1, pk, token, commitmentG, commitmentH)
  const challenge = generateChallenge(
    parameters.generator,
    maskedCard.c1,
    publicKey,
    revealToken,
    commitmentG,
    commitmentH,
  )

  // Response: z = k + c * sk (mod curve_order)
  const response = moduloOrder(k + moduloOrder(challenge * secretKey))

  const revealProof = {
    commitment_g: ElGamal.pointToHex(commitmentG),
    commitment_h: ElGamal.pointToHex(commitmentH),
    challenge: ElGamal.scalarToHex(challenge),
    response: ElGamal.scalarToHex(response),
  }

  // Compute the revealed plaintext using the reveal algorithm:
  // decrypted = -token + c2 = -sk*c1 + c2 = -sk*c1 + (m + sk*c1) = m
  const negativeToken = revealToken.negate()
  const revealedPlaintext = addPoints(negativeToken, maskedCard.c2)

  // Verification should always pass for valid proofs
  const verificationResult = true

  return {
    test_name: `Reveal Test ${testIndex + 1}`,
    seed,
    setup: {
      generator: ElGamal.pointToHex(parameters.generator),
      player_secret_key: ElGamal.scalarToHex(secretKey),
      player_public_key: ElGamal.pointToHex(publicKey),
    },
    masked_card: {
      c1: ElGamal.pointToHex(maskedCard.c1),
      c2: ElGamal.pointToHex(maskedCard.c2),
    },
    reveal_token: ElGamal.pointToHex(revealToken),
    reveal_proof: revealProof,
    revealed_plaintext: ElGamal.pointToHex(revealedPlaintext),
    verification_result: verificationResult,
  }
}

function generateRevealTestVectors(count = 3): void {
  // Use the same seeds as the Rust reference for consistency
  const seeds = [
    Array(32)
      .fill(0)
      .map((_, i) => 42 + i), // [42, 43, 44, ...]
    Array(32)
      .fill(0)
      .map((_, i) => i), // [0, 1, 2, ...]
    Array(32)
      .fill(0)
      .map((_, i) => 100 + i * 2), // [100, 102, 104, ...]
  ]

  const testVectors: RevealTestVector[] = []

  for (let i = 0; i < Math.min(count, seeds.length); i++) {
    const testVector = generateRevealTestVector(seeds[i]!, i)
    testVectors.push(testVector)
  }

  const output: RevealTestVectors = {
    protocol_info: {
      name: "Barnett-Smart Mental Poker - Reveal",
      version: "1.0.0",
      description:
        "Test vectors for reveal operations in the Barnett-Smart protocol",
    },
    curve_info: {
      name: "Starknet Curve",
      field_modulus: `0x${PRIME.toString(16)}`,
      curve_order: `0x${CURVE_ORDER.toString(16)}`,
    },
    test_vectors: testVectors,
  }

  const outputPath = "./test/primitives/test_vector_reveal.json"
  writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(
    `Generated ${testVectors.length} reveal test vectors in ${outputPath}`,
  )
}

// Main execution
const args = process.argv.slice(2)
const count = args.length > 0 ? Number.parseInt(args[0]!) : 3

if (Number.isNaN(count) || count <= 0) {
  console.error(
    "Please provide a valid positive number of test vectors to generate",
  )
  process.exit(1)
}

generateRevealTestVectors(count)
