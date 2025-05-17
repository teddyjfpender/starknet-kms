export function getRealErrorMsg(err: unknown): string | undefined {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === "string") {
    return err
  }
  return String(err)
}
