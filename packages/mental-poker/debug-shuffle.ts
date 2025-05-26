import { randScalar } from "@starkms/crypto"
import { DLCards } from "./src/discrete-log-cards"
import { createDeckSize, createPermutation, createPlayerId } from "./src/types"

async function debugShuffle() {
  const protocol = DLCards.getInstance()

  // Setup with small deck for debugging
  const pp = await protocol.setup(createDeckSize(2), createPlayerId(2))
  console.log("Parameters:", {
    m: pp.m,
    n: pp.n,
    hasElgamal: !!pp.elgamal,
    hasPedersen: !!pp.pedersen,
    pedersenKeyLength: pp.pedersen.commitKey.length,
  })

  // Generate keys
  const [pk1, sk1] = await protocol.playerKeygen(pp)
  const [pk2, sk2] = await protocol.playerKeygen(pp)

  // Compute aggregate key
  const playerInfo1 = new Uint8Array([1])
  const playerInfo2 = new Uint8Array([2])
  const proof1 = await protocol.proveKeyOwnership(pp, pk1, sk1, playerInfo1)
  const proof2 = await protocol.proveKeyOwnership(pp, pk2, sk2, playerInfo2)

  const sharedKey = await protocol.computeAggregateKey(pp, [
    [pk1, proof1, playerInfo1],
    [pk2, proof2, playerInfo2],
  ])

  // Create simple deck
  const deck = [
    { point: pp.generators.G, index: 0 as any },
    { point: pp.generators.H, index: 1 as any },
  ]

  // Mask cards
  const maskedDeck = []
  for (const card of deck) {
    const [maskedCard] = await protocol.mask(pp, sharedKey, card, randScalar())
    maskedDeck.push(maskedCard)
  }

  // Create permutation and masking factors
  const permutation = createPermutation([1, 0]) // Swap the two cards
  const maskingFactors = [randScalar(), randScalar()]

  console.log("About to shuffle...")

  try {
    const [shuffledDeck, proof] = await protocol.shuffleAndRemask(
      pp,
      sharedKey,
      maskedDeck,
      maskingFactors,
      permutation,
    )

    console.log("Shuffle successful!")
    console.log("Proof structure:", {
      commitments: proof.commitments?.length,
      challenges: proof.challenges?.length,
      responses: proof.responses?.length,
      permutationCommitments: proof.permutationCommitments?.length,
      polynomialEvaluations: proof.polynomialEvaluations?.length,
      openingProofs: proof.openingProofs?.length,
    })

    console.log("About to verify...")

    const isValid = await protocol.verifyShuffle(
      pp,
      sharedKey,
      maskedDeck,
      shuffledDeck,
      proof,
    )

    console.log("Verification result:", isValid)
  } catch (error) {
    console.error("Error during shuffle:", error)
  }
}

debugShuffle().catch(console.error)
