# A Very Experimental Key Management Package

This package is a work in progress and is not yet ready for use.

## Usage

```ts
import { KeyAgentBase } from "@starkms/key-management"
```

```ts
const keyAgent = new KeyAgentBase(serializableData, getPassphrase, mnemonic)
```

```ts
const credentials = await keyAgent.deriveCredentials(args)
```

```ts
const stealthAddress = keyAgent.deriveStealthAddress(recipientPublicKeys)
```

```ts
const signature = await keyAgent.checkStealthOwnership(ephemeralPublicKey, stealthAddress, credentials)
```

## Note
Signing is not yet implemented.



