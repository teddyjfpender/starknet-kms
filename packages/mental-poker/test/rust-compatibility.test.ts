import { beforeAll, describe, expect, it } from "bun:test"
import { G, addPoints, randScalar, scalarMultiply } from "@starkms/crypto"
import {
  type AggregatePublicKey,
  type Card,
  DLCards,
  type MaskedCard,
  type Parameters,
  type PlayerPublicKey,
  type PlayerSecretKey,
  type RevealToken,
  type ZKProofKeyOwnership,
  type ZKProofReveal,
  createDeckSize,
  createPermutation,
  createPlayerId,
} from "../src"

/**
 * Test suite that exactly matches the Rust implementation tests
 * to ensure 1:1 API compatibility and identical behavior
 */
describe("Rust Compatibility Tests", () => {
  let protocol: DLCards
  let parameters: Parameters

  beforeAll(async () => {
    protocol = DLCards.getInstance()
    // Match Rust test parameters: m = 4, n = 13
    parameters = await protocol.setup(createDeckSize(4), createPlayerId(13))
  })

  /**
   * Setup players exactly like the Rust implementation
   */
  async function setupPlayers(numOfPlayers: number): Promise<{
    players: Array<[PlayerPublicKey, PlayerSecretKey, Uint8Array]>
    expectedSharedKey: AggregatePublicKey
  }> {
    const players: Array<[PlayerPublicKey, PlayerSecretKey, Uint8Array]> = []
    let expectedSharedKey = { point: G } // Start with identity (will be overwritten)

    for (let i = 0; i < numOfPlayers; i++) {
      const [pk, sk] = await protocol.playerKeygen(parameters)
      const playerInfo = new TextEncoder().encode(`Player${i}`)
      players.push([pk, sk, playerInfo])

      if (i === 0) {
        expectedSharedKey = pk
      } else {
        // Add public keys to compute aggregate
        expectedSharedKey = {
          point: addPoints(expectedSharedKey.point, pk.point),
        }
      }
    }

    return { players, expectedSharedKey }
  }

  it("should generate and verify key (matches Rust test)", async () => {
    const [pk, sk] = await protocol.playerKeygen(parameters)
    const playerName = new TextEncoder().encode("Alice")

    // Prove key ownership
    const keyProof = await protocol.proveKeyOwnership(
      parameters,
      pk,
      sk,
      playerName,
    )

    // Verify proof
    const isValid = await protocol.verifyKeyOwnership(
      parameters,
      pk,
      playerName,
      keyProof,
    )
    expect(isValid).toBe(true)

    // Test with wrong secret key (should fail)
    const wrongSk = { scalar: randScalar() }
    const wrongProof = await protocol.proveKeyOwnership(
      parameters,
      pk,
      wrongSk,
      playerName,
    )
    const isWrongValid = await protocol.verifyKeyOwnership(
      parameters,
      pk,
      playerName,
      wrongProof,
    )
    expect(isWrongValid).toBe(false)
  })

  it("should aggregate keys (matches Rust test)", async () => {
    const numOfPlayers = 10
    const { players, expectedSharedKey } = await setupPlayers(numOfPlayers)

    // Generate proofs for all players
    const proofs: ZKProofKeyOwnership[] = []
    for (const [pk, sk, playerInfo] of players) {
      const proof = await protocol.proveKeyOwnership(
        parameters,
        pk,
        sk,
        playerInfo,
      )
      proofs.push(proof)
    }

    // Create key proof info array
    const keyProofInfo = players.map(([pk, _sk, playerInfo], i) => {
      const proof = proofs[i]
      if (!proof) throw new Error(`Missing proof for player ${i}`)
      return [pk, proof, playerInfo] as const
    })

    // Compute aggregate key
    const testAggregate = await protocol.computeAggregateKey(
      parameters,
      keyProofInfo,
    )

    // Should match expected aggregate
    expect(testAggregate.point.x).toBe(expectedSharedKey.point.x)
    expect(testAggregate.point.y).toBe(expectedSharedKey.point.y)

    // Test with bad key (should fail)
    const badKeyProofInfo = [...keyProofInfo]
    const firstProof = proofs[0]
    const firstPlayer = players[0]
    if (!firstProof || !firstPlayer)
      throw new Error("Missing first proof or player")
    badKeyProofInfo[0] = [{ point: G }, firstProof, firstPlayer[2]] // Wrong public key

    await expect(
      protocol.computeAggregateKey(parameters, badKeyProofInfo),
    ).rejects.toThrow()
  })

  it("should test unmask (matches Rust test)", async () => {
    const numOfPlayers = 10
    const { players, expectedSharedKey } = await setupPlayers(numOfPlayers)

    // Create a random card (matches Rust Card::rand(rng))
    const randomScalar = randScalar()
    const card: Card = {
      point: scalarMultiply(randomScalar, G),
      index: 0 as any, // CardIndex type
    }

    // Mask the card
    const alpha = randScalar()
    const [masked, _maskProof] = await protocol.mask(
      parameters,
      expectedSharedKey,
      card,
      alpha,
    )

    // Each player computes reveal token
    const decryptionKey: Array<[RevealToken, ZKProofReveal, PlayerPublicKey]> =
      []
    for (const [pk, sk] of players) {
      const [token, proof] = await protocol.computeRevealToken(
        parameters,
        sk,
        pk,
        masked,
      )
      decryptionKey.push([token, proof, pk])
    }

    // Unmask the card
    const unmasked = await protocol.unmask(parameters, decryptionKey, masked)

    // Should recover original card
    expect(unmasked.point.x).toBe(card.point.x)
    expect(unmasked.point.y).toBe(card.point.y)

    // Test with bad reveal token (should fail)
    const badDecryptionKey = [...decryptionKey]
    const badToken: RevealToken = {
      token: scalarMultiply(randScalar(), G),
    }
    const firstDecryption = decryptionKey[0]
    if (!firstDecryption) throw new Error("Missing first decryption key")
    badDecryptionKey[0] = [badToken, firstDecryption[1], firstDecryption[2]]

    await expect(
      protocol.unmask(parameters, badDecryptionKey, masked),
    ).rejects.toThrow()
  })

  it("should test shuffle (matches Rust test)", async () => {
    const numOfPlayers = 10
    const { players: _players, expectedSharedKey } =
      await setupPlayers(numOfPlayers)

    // Create deck of random masked cards (matches Rust sample_vector)
    const deckSize = 4 * 13 // m * n
    const deck: MaskedCard[] = []

    for (let i = 0; i < deckSize; i++) {
      const randomness = scalarMultiply(randScalar(), G)
      const ciphertext = scalarMultiply(randScalar(), G)
      deck.push({
        randomness,
        ciphertext,
      })
    }

    // Create permutation and masking factors
    const permutationArray = Array.from({ length: deckSize }, (_, i) => i)
    // Simple shuffle: reverse the array
    permutationArray.reverse()
    const permutation = createPermutation(permutationArray)

    const maskingFactors = Array.from({ length: deckSize }, () => randScalar())

    // Shuffle and remask
    const [shuffledDeck, shuffleProof] = await protocol.shuffleAndRemask(
      parameters,
      expectedSharedKey,
      deck,
      maskingFactors,
      permutation,
    )

    // Verify shuffle
    const isValid = await protocol.verifyShuffle(
      parameters,
      expectedSharedKey,
      deck,
      shuffledDeck,
      shuffleProof,
    )
    expect(isValid).toBe(true)

    // Test with wrong output - NOTE: The current implementation has incomplete
    // verification that only checks structural consistency, not cryptographic correctness.
    const wrongOutput: MaskedCard[] = []
    for (let i = 0; i < deckSize; i++) {
      const randomness = scalarMultiply(randScalar(), G)
      const ciphertext = scalarMultiply(randScalar(), G)
      wrongOutput.push({
        randomness,
        ciphertext,
      })
    }

    const isWrongValid = await protocol.verifyShuffle(
      parameters,
      expectedSharedKey,
      deck,
      wrongOutput,
      shuffleProof,
    )
    // The current simplified verification may reject some invalid shuffles
    // but does NOT provide cryptographic security guarantees
    expect(isWrongValid).toBe(false)
  })

  it("should maintain exact same parameter structure as Rust", () => {
    // Verify parameter structure matches Rust Parameters<C>
    expect(parameters).toHaveProperty("m")
    expect(parameters).toHaveProperty("n")
    expect(parameters).toHaveProperty("generators")
    expect(parameters.m).toBe(createDeckSize(4))
    expect(parameters.n).toBe(createPlayerId(13))
    expect(parameters.generators).toHaveProperty("G")
    expect(parameters.generators).toHaveProperty("H")
  })

  it("should handle the same error cases as Rust", async () => {
    // Test invalid setup parameters - these should throw during parameter creation
    expect(() => createDeckSize(0)).toThrow()
    expect(() => createPlayerId(0)).toThrow()

    // Test invalid key verification
    const [pk, sk] = await protocol.playerKeygen(parameters)
    const playerInfo = new TextEncoder().encode("Test")
    const proof = await protocol.proveKeyOwnership(
      parameters,
      pk,
      sk,
      playerInfo,
    )

    // Wrong player info should fail
    const wrongInfo = new TextEncoder().encode("Wrong")
    const isValid = await protocol.verifyKeyOwnership(
      parameters,
      pk,
      wrongInfo,
      proof,
    )
    expect(isValid).toBe(false)
  })
})
