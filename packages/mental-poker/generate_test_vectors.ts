#!/usr/bin/env bun

import { writeFileSync } from "node:fs"
import {
  CURVE_ORDER,
  PRIME,
  type Point,
  addPoints,
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

interface TestVector {
  test_name: string
  seed: number[]
  elgamal_test: {
    generator: string
    secret_key: string
    public_key: string
    plaintext: string
    randomness: string
    ciphertext: {
      c1: string
      c2: string
    }
    encryption_proof: {
      commitment: string
      challenge: string
      response: string
    }
  }
  masking_test: {
    original_card: string
    masked_card: {
      c1: string
      c2: string
    }
    masking_factor: string
    masking_proof: {
      commitment: string
      challenge: string
      response: string
    }
    verification_result: boolean
  }
  remasking_test: {
    original_masked: {
      c1: string
      c2: string
    }
    additional_masking_factor: string
    remasked_card: {
      c1: string
      c2: string
    }
    remasking_proof: {
      commitment: string
      challenge: string
      response: string
    }
    verification_result: boolean
  }
  reveal_test: {
    masked_card: {
      c1: string
      c2: string
    }
    player_secret_keys: string[]
    reveal_tokens: string[]
    reveal_proofs: Array<{
      commitment: string
      challenge: string
      response: string
    }>
    unmasked_card: string
  }
}

function generateSingleTestVector(
  seed: number[],
  testIndex: number,
): TestVector {
  const rng = new ChaChaRng(seed)

  // Setup parameters
  const parameters = ElGamal.setup()

  // Generate keys for multiple players (3 players like in Rust)
  const numPlayers = 3
  const playerKeys: Array<{
    publicKey: ElGamal.ElGamalPublicKey
    secretKey: ElGamal.ElGamalSecretKey
  }> = []

  let aggregatePublicKey = playerKeys[0]?.publicKey.point

  for (let i = 0; i < numPlayers; i++) {
    const secretKey = rng.nextScalar()
    const keys = {
      publicKey: { point: scalarMultiply(secretKey, parameters.generator) },
      secretKey: { scalar: secretKey },
    }
    playerKeys.push(keys)

    if (i === 0) {
      aggregatePublicKey = keys.publicKey.point
    } else {
      aggregatePublicKey = addPoints(aggregatePublicKey!, keys.publicKey.point)
    }
  }

  const aggregateKey: ElGamal.ElGamalPublicKey = { point: aggregatePublicKey! }

  // Generate a random card (plaintext)
  const card = Masking.randomCard()

  // For ElGamal test case, use single player key (first player) for consistency
  const singlePlayerKey = playerKeys[0]!

  // ElGamal test case with single player key
  const elgamalRandomness = rng.nextScalar()
  const { ciphertext: elgamalCiphertext, proof: elgamalProof } =
    ElGamal.encrypt(
      parameters,
      singlePlayerKey.publicKey,
      { point: card.point },
      elgamalRandomness,
    )

  const elgamalTest = {
    generator: ElGamal.pointToHex(parameters.generator),
    secret_key: ElGamal.scalarToHex(singlePlayerKey.secretKey.scalar),
    public_key: ElGamal.pointToHex(singlePlayerKey.publicKey.point),
    plaintext: Masking.cardToHex(card),
    randomness: ElGamal.scalarToHex(elgamalRandomness),
    ciphertext: {
      c1: ElGamal.pointToHex(elgamalCiphertext.c1),
      c2: ElGamal.pointToHex(elgamalCiphertext.c2),
    },
    encryption_proof: {
      commitment: ElGamal.pointToHex(elgamalProof.commitment),
      challenge: ElGamal.scalarToHex(elgamalProof.challenge),
      response: ElGamal.scalarToHex(elgamalProof.response),
    },
  }

  // Masking test case with aggregate key (multi-player scenario)
  const maskingRandomness = rng.nextScalar()
  const { maskedCard, proof: maskingProof } = Masking.mask(
    parameters,
    aggregateKey,
    card,
    maskingRandomness,
  )

  const maskingVerification = Masking.verifyMask(
    parameters,
    aggregateKey,
    card,
    maskedCard,
    maskingProof,
  )

  const maskingTest = {
    original_card: Masking.cardToHex(card),
    masked_card: {
      c1: ElGamal.pointToHex(maskedCard.c1),
      c2: ElGamal.pointToHex(maskedCard.c2),
    },
    masking_factor: ElGamal.scalarToHex(maskingRandomness),
    masking_proof: {
      commitment: ElGamal.pointToHex(maskingProof.commitment),
      challenge: ElGamal.scalarToHex(maskingProof.challenge),
      response: ElGamal.scalarToHex(maskingProof.response),
    },
    verification_result: maskingVerification,
  }

  // Remasking test case
  const additionalRandomness = rng.nextScalar()
  const { remaskedCard, proof: remaskingProof } = Masking.remask(
    parameters,
    aggregateKey,
    maskedCard,
    additionalRandomness,
  )

  const remaskingVerification = Masking.verifyRemask(
    parameters,
    aggregateKey,
    maskedCard,
    remaskedCard,
    remaskingProof,
  )

  const remaskingTest = {
    original_masked: {
      c1: ElGamal.pointToHex(maskedCard.c1),
      c2: ElGamal.pointToHex(maskedCard.c2),
    },
    additional_masking_factor: ElGamal.scalarToHex(additionalRandomness),
    remasked_card: {
      c1: ElGamal.pointToHex(remaskedCard.c1),
      c2: ElGamal.pointToHex(remaskedCard.c2),
    },
    remasking_proof: {
      commitment: ElGamal.pointToHex(remaskingProof.commitment),
      challenge: ElGamal.scalarToHex(remaskingProof.challenge),
      response: ElGamal.scalarToHex(remaskingProof.response),
    },
    verification_result: remaskingVerification,
  }

  // Reveal test case with aggregate key and multi-player tokens
  const revealTokens: string[] = []
  const revealProofs: Array<{
    commitment: string
    challenge: string
    response: string
  }> = []
  const decryptionTokens: Point[] = []

  for (const playerKey of playerKeys) {
    const { token, proof } = Masking.createRevealToken(
      parameters,
      playerKey.secretKey,
      playerKey.publicKey,
      maskedCard,
    )

    revealTokens.push(ElGamal.pointToHex(token))
    revealProofs.push({
      commitment: ElGamal.pointToHex(proof.commitment),
      challenge: ElGamal.scalarToHex(proof.challenge),
      response: ElGamal.scalarToHex(proof.response),
    })
    decryptionTokens.push(token)
  }

  const unmaskedCard = Masking.unmask(parameters, decryptionTokens, maskedCard)

  const revealTest = {
    masked_card: {
      c1: ElGamal.pointToHex(maskedCard.c1),
      c2: ElGamal.pointToHex(maskedCard.c2),
    },
    player_secret_keys: playerKeys.map((k) =>
      ElGamal.scalarToHex(k.secretKey.scalar),
    ),
    reveal_tokens: revealTokens,
    reveal_proofs: revealProofs,
    unmasked_card: Masking.cardToHex(unmaskedCard),
  }

  return {
    test_name: `primitive_test_${testIndex}`,
    seed,
    elgamal_test: elgamalTest,
    masking_test: maskingTest,
    remasking_test: remaskingTest,
    reveal_test: revealTest,
  }
}

function generateTestVectors(count = 2): void {
  const testVectors: TestVector[] = []

  // Fixed seeds for deterministic testing (like in Rust)
  const seeds = [
    Array(32).fill(42), // [42u8; 32]
    [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
    ],
    Array(32).fill(255), // [255u8; 32]
    [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
    ],
    [
      123, 45, 67, 89, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56, 78,
      90, 12, 34, 56, 78, 90, 12, 34, 56, 78, 90, 12, 34, 56,
    ],
  ]

  for (let i = 0; i < Math.min(count, seeds.length); i++) {
    const testVector = generateSingleTestVector(seeds[i]!, i)
    testVectors.push(testVector)
  }

  const output = {
    metadata: {
      version: "1.0.0",
      description:
        "Test vectors for ElGamal and masking primitives in mental poker",
      total_vectors: testVectors.length,
      generation_timestamp: new Date().toISOString(),
    },
    curve_info: {
      name: "Starknet Curve",
      field_modulus: `0x${PRIME.toString(16)}`,
      curve_order: `0x${CURVE_ORDER.toString(16)}`,
    },
    test_vectors: testVectors,
  }

  const outputPath = "./test/primitives/test_vector_primitives.json"
  writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`Generated ${testVectors.length} test vectors in ${outputPath}`)
}

// Parse command line arguments
const args = process.argv.slice(2)
const count = args[0] ? Number.parseInt(args[0]) : 2

generateTestVectors(count)
