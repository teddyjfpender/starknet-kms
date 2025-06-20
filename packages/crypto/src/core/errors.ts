export class InvalidHexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidHexError"
  }
}

export class InvalidScalarError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidScalarError"
  }
}

export class InvalidPointError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidPointError"
  }
} 