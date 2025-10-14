#!/usr/bin/env bun

/**
 * Extract ABI from contract class JSON and write to separate file
 */

import { readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const CONTRACT_CLASS_PATH = join(
  __dirname,
  "../../../cairo/account/target/dev/account_KageAccount.contract_class.json"
)

const ABI_OUTPUT_PATH = join(
  __dirname,
  "../src/artifacts/account_KageAccount.abi.json"
)

function extractABI() {
  try {
    console.log("📖 Reading contract class from:", CONTRACT_CLASS_PATH)

    const contractClassData = JSON.parse(readFileSync(CONTRACT_CLASS_PATH, "utf8"))

    if (!contractClassData.abi) {
      throw new Error("ABI not found in contract class JSON")
    }

    console.log("✂️  Extracting ABI...")
    const abi = contractClassData.abi

    console.log("💾 Writing ABI to:", ABI_OUTPUT_PATH)
    writeFileSync(
      ABI_OUTPUT_PATH,
      JSON.stringify(abi, null, 2),
      "utf8"
    )

    console.log(`✅ Successfully extracted ABI (${abi.length} items)`)
  } catch (error) {
    console.error("❌ Failed to extract ABI:", error)
    process.exit(1)
  }
}

extractABI()
