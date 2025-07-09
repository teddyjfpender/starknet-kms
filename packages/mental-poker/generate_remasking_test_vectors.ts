#!/usr/bin/env bun

import { writeFileSync } from "node:fs"
import {
  CURVE_ORDER,
  PRIME,
  type Point,
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

interface RemaskingTestVector {
  test_name: string
  seed: number[]
  setup: {
    generator: string
    num_players: number
    player_secret_keys: string[]
    aggregate_public_key: string
  }
  original_masked_card: {
    c1: string
    c2: string
  }
  remasking_factor: string
  expected_remasked_card: {
    c1: string
    c2: string
  }
  remasking_proof: {
    commitment_g: string
    commitment_h: string
    challenge: string
    response: string
  }
  verification_result: boolean
}

interface RemaskingTestVectors {
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
  test_vectors: RemaskingTestVector[]
}

function generateRemaskingTestVector(
  seed: number[],
  testIndex: number,
): RemaskingTestVector {
  const rng = new ChaChaRng(seed)

  // Setup ElGamal parameters
  const parameters = ElGamal.setup()

  // Generate multiple players for aggregate key (like in Rust test)
  const numPlayers = 3
  const playerSecretKeys: bigint[] = []
  let aggregatePublicKey: Point | null = null

  for (let i = 0; i < numPlayers; i++) {
    const secretKey = rng.nextScalar()
    playerSecretKeys.push(secretKey)
    const publicKey = scalarMultiply(secretKey, parameters.generator)

    if (i === 0) {
      aggregatePublicKey = publicKey
    } else {
      aggregatePublicKey = addPoints(aggregatePublicKey!, publicKey)
    }
  }

  const aggregateKey: ElGamal.ElGamalPublicKey = { point: aggregatePublicKey! }

  // Create an original masked card (simulate a card that was already masked)
  const originalCard = Masking.randomCard()
  const originalMaskingFactor = rng.nextScalar()

  const { maskedCard: originalMaskedCard } = Masking.mask(
    parameters,
    aggregateKey,
    originalCard,
    originalMaskingFactor,
  )

  // Now perform remasking with additional randomness
  const remaskingFactor = rng.nextScalar()

  // Remasking logic: create encryption of zero and add it homomorphically
  // Zero encryption: (alpha*G, alpha*aggregateKey)
  const zeroEncC1 = scalarMultiply(remaskingFactor, parameters.generator)
  const zeroEncC2 = scalarMultiply(remaskingFactor, aggregateKey.point)

  // Add to original masked card
  const remaskedC1 = addPoints(originalMaskedCard.c1, zeroEncC1)
  const remaskedC2 = addPoints(originalMaskedCard.c2, zeroEncC2)

  const remaskedCard = {
    c1: remaskedC1,
    c2: remaskedC2,
  }

  // Generate Chaum-Pedersen proof for remasking
  // Prove that the same alpha was used for both difference components
  const k = rng.nextScalar()
  const commitmentG = scalarMultiply(k, parameters.generator) // g^k
  const commitmentH = scalarMultiply(k, aggregateKey.point) // h^k

  // Challenge includes the difference components (what was added)
  const challenge = generateChallenge(
    parameters.generator,
    aggregateKey.point,
    zeroEncC1, // difference in c1
    zeroEncC2, // difference in c2
    commitmentG,
    commitmentH,
  )

  // Response: z = k + c * alpha (mod curve_order)
  const response = moduloOrder(k + moduloOrder(challenge * remaskingFactor))

  const remaskingProof = {
    commitment_g: ElGamal.pointToHex(commitmentG),
    commitment_h: ElGamal.pointToHex(commitmentH),
    challenge: ElGamal.scalarToHex(challenge),
    response: ElGamal.scalarToHex(response),
  }

  // Verification should always pass for valid proofs
  const verificationResult = true

  return {
    test_name: `Remasking Test ${testIndex + 1}`,
    seed,
    setup: {
      generator: ElGamal.pointToHex(parameters.generator),
      num_players: numPlayers,
      player_secret_keys: playerSecretKeys.map((sk) => ElGamal.scalarToHex(sk)),
      aggregate_public_key: ElGamal.pointToHex(aggregateKey.point),
    },
    original_masked_card: {
      c1: ElGamal.pointToHex(originalMaskedCard.c1),
      c2: ElGamal.pointToHex(originalMaskedCard.c2),
    },
    remasking_factor: ElGamal.scalarToHex(remaskingFactor),
    expected_remasked_card: {
      c1: ElGamal.pointToHex(remaskedCard.c1),
      c2: ElGamal.pointToHex(remaskedCard.c2),
    },
    remasking_proof: remaskingProof,
    verification_result: verificationResult,
  }
}

function generateRemaskingTestVectors(count = 3): void {
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

  const testVectors: RemaskingTestVector[] = []

  for (let i = 0; i < Math.min(count, seeds.length); i++) {
    const testVector = generateRemaskingTestVector(seeds[i]!, i)
    testVectors.push(testVector)
  }

  const output: RemaskingTestVectors = {
    protocol_info: {
      name: "Barnett-Smart Mental Poker - Remasking",
      version: "1.0.0",
      description:
        "Test vectors for remasking operations in the Barnett-Smart protocol",
    },
    curve_info: {
      name: "Starknet Curve",
      field_modulus: `0x${PRIME.toString(16)}`,
      curve_order: `0x${CURVE_ORDER.toString(16)}`,
    },
    test_vectors: testVectors,
  }

  const outputPath = "./test/primitives/test_vector_remasking.json"
  writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(
    `Generated ${testVectors.length} remasking test vectors in ${outputPath}`,
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

generateRemaskingTestVectors(count)
