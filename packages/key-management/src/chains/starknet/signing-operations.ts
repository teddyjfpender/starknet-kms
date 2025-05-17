import {
  type DeclareSignerDetails,
  type DeployAccountSignerDetails,
  Signer,
  type TypedData,
} from "starknet"
import * as errors from "../../errors"
import type { ChainOperationArgs } from "../../types"
import type { SignablePayload, SignatureResult } from "./types"

/**
 * SigningOperations is a wrapper around the starknet-js `Signer` class.
 *
 * Based on the provided `args.operation`, it will call one of:
 * - signMessage(TypedData, accountAddress)
 * - signTransaction(Call[], InvocationsSignerDetails)
 * - signDeployAccountTransaction(DeployAccountSignerDetails)
 * - signDeclareTransaction(DeclareSignerDetails)
 * - signRaw(msgHash)
 *
 * @param args        - Contains which operation to perform, plus any needed fields
 * @param privateKey  - The Starknet private key (0x or hex string) used for signing
 * @param payload     - The data you want to sign (could be typed data, calls, etc.)
 * @returns           A Promise that resolves to the resulting signature (string[])
 */
export async function SigningOperations<T extends SignablePayload>(
  args: ChainOperationArgs,
  privateKey: string,
  payload: T,
): Promise<SignatureResult> {
  // Create the underlying starknet-js Signer
  const signer = new Signer(privateKey)

  try {
    let signature: SignatureResult

    switch (args.operation) {
      /**
       * sign_message => expects `payload` to be TypedData.
       * The starknet-js Signer also needs an `accountAddress`.
       */
      case "sign_message": {
        if (!args.accountAddress) {
          throw new Error(
            "Missing 'accountAddress' for 'sign_message' operation.",
          )
        }
        // If your payload can be raw strings or typed data,
        // you might want to check if it's actually typed data:
        // if (!isTypedData(payload)) { ... }

        signature = await signer.signMessage(
          payload as TypedData,
          args.accountAddress,
        )
        break
      }

      /**
       * sign_transaction => expects `payload` to be Call[]
       * (an array of calls) and `args.transactionDetails`
       * to be an object like `InvocationsSignerDetails`.
       */
      case "sign_transaction": {
        if (!Array.isArray(payload)) {
          throw new Error(
            "For 'sign_transaction', payload must be an array of Calls.",
          )
        }
        if (!args.transactionDetails) {
          throw new Error(
            "Missing 'transactionDetails' for 'sign_transaction' operation.",
          )
        }

        // We cast transactionDetails to the appropriate signer details interface
        // (InvocationsSignerDetails, V2InvocationsSignerDetails, etc.)
        signature = await signer.signTransaction(
          payload,
          args.transactionDetails,
        )
        break
      }

      /**
       * sign_deploy_account => expects `payload` to be DeployAccountSignerDetails
       */
      case "sign_deploy_account": {
        // We cast the payload to DeployAccountSignerDetails
        // If you want stronger type checks, you'd do a runtime validation here
        signature = await signer.signDeployAccountTransaction(
          payload as DeployAccountSignerDetails,
        )
        break
      }

      /**
       * sign_declare => expects `payload` to be DeclareSignerDetails
       */
      case "sign_declare": {
        // Similarly, cast the payload to DeclareSignerDetails
        signature = await signer.signDeclareTransaction(
          payload as unknown as DeclareSignerDetails,
        )
        break
      }

      /**
       * sign_raw => expects `payload` to be a string (the msgHash to sign)
       * this is a protected method in starknet-js, so we need to use a different approach
       */
      /*case "sign_raw": {
        if (typeof payload !== "string") {
          throw new Error("For 'sign_raw', payload must be a string msgHash.")
        }
        signature = await signer.signRaw(payload)
        // (signRaw is protected in source, but if you've exposed it or
        //  changed your local Signer to be public, you can call it.
        //  Otherwise you might replicate signRaw(...) logic manually.)
        break
      }*/

      default: {
        throw new Error(`Unsupported private key operation: ${args.operation}`)
      }
    }

    return signature
  } catch (err) {
    const errorMessage = errors.getRealErrorMsg(err) || "Signing action failed."
    throw new Error(errorMessage)
  }
}
