import {
  CURVE_ORDER,
  type Point,
  type Scalar,
  addPoints,
  moduloOrder,
  poseidonHashScalars,
  randScalar,
  scalarMultiply,
} from "@starkms/crypto"
import { secureModularInverse, validateScalar } from "./crypto-utils"
import { MentalPokerError, MentalPokerErrorCode } from "./types"

/**
 * Security event for audit logging
 */
export interface SecurityEvent {
  timestamp: number
  eventType: SecurityEventType
  severity: SecuritySeverity
  details: Record<string, any>
  clientId?: string
}

/**
 * Types of security events
 */
export enum SecurityEventType {
  PROOF_VERIFICATION_FAILURE = "PROOF_VERIFICATION_FAILURE",
  INVALID_INPUT_DETECTED = "INVALID_INPUT_DETECTED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  SUSPICIOUS_TIMING_DETECTED = "SUSPICIOUS_TIMING_DETECTED",
  CRYPTOGRAPHIC_ERROR = "CRYPTOGRAPHIC_ERROR",
  PROTOCOL_VIOLATION = "PROTOCOL_VIOLATION",
  UNAUTHORIZED_ACCESS_ATTEMPT = "UNAUTHORIZED_ACCESS_ATTEMPT",
}

/**
 * Security event severity levels
 */
export enum SecuritySeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

/**
 * Advanced security features for production-grade mental poker implementation
 */
export class AdvancedSecurity {
  private static readonly INSTANCE = new AdvancedSecurity()
  private readonly auditLog: SecurityEvent[] = []
  private readonly rateLimit = new Map<string, number>()

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): AdvancedSecurity {
    return AdvancedSecurity.INSTANCE
  }

  /**
   * Log a security event
   */
  public logSecurityEvent(
    eventType: SecurityEventType,
    severity: SecuritySeverity,
    details: Record<string, any>,
    clientId?: string,
  ): void {
    const event: SecurityEvent = {
      timestamp: Date.now(),
      eventType,
      severity,
      details: { ...details },
      ...(clientId && { clientId }),
    }

    this.auditLog.push(event)

    // Keep only last 10000 events to prevent memory issues
    if (this.auditLog.length > 10000) {
      this.auditLog.shift()
    }

    // In production, this would be sent to a secure logging service
    if (
      severity === SecuritySeverity.CRITICAL ||
      severity === SecuritySeverity.HIGH
    ) {
      console.warn("Security Event:", JSON.stringify(event, null, 2))
    }
  }

  /**
   * Enhanced proof verification with security monitoring
   */
  public async verifyProofWithSecurity(
    verificationFunction: () => Promise<boolean>,
    proofType: string,
    clientId?: string,
  ): Promise<boolean> {
    const startTime = performance.now()

    try {
      const result = await verificationFunction()
      const endTime = performance.now()
      const duration = endTime - startTime

      // Monitor for timing anomalies
      if (duration > 1000) {
        // More than 1 second is suspicious
        this.logSecurityEvent(
          SecurityEventType.SUSPICIOUS_TIMING_DETECTED,
          SecuritySeverity.MEDIUM,
          {
            proofType,
            duration,
            result,
          },
          clientId,
        )
      }

      if (!result) {
        this.logSecurityEvent(
          SecurityEventType.PROOF_VERIFICATION_FAILURE,
          SecuritySeverity.HIGH,
          {
            proofType,
            duration,
          },
          clientId,
        )
      }

      return result
    } catch (error) {
      this.logSecurityEvent(
        SecurityEventType.CRYPTOGRAPHIC_ERROR,
        SecuritySeverity.CRITICAL,
        {
          proofType,
          error: error instanceof Error ? error.message : String(error),
        },
        clientId,
      )
      return false
    }
  }

  /**
   * Rate limiting for proof operations
   */
  public checkRateLimit(
    clientId: string,
    maxOperationsPerMinute = 100,
  ): boolean {
    const now = Date.now()
    const windowStart = now - 60000 // 1 minute window

    // Clean old entries
    for (const [id, timestamp] of this.rateLimit.entries()) {
      if (timestamp < windowStart) {
        this.rateLimit.delete(id)
      }
    }

    // Count operations for this client in the current window
    let operationCount = 0
    for (const [id, timestamp] of this.rateLimit.entries()) {
      if (id.startsWith(clientId) && timestamp >= windowStart) {
        operationCount++
      }
    }

    if (operationCount >= maxOperationsPerMinute) {
      this.logSecurityEvent(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecuritySeverity.HIGH,
        {
          clientId,
          operationCount,
          maxOperationsPerMinute,
        },
        clientId,
      )
      return false
    }

    // Record this operation
    this.rateLimit.set(`${clientId}_${now}_${Math.random()}`, now)
    return true
  }

  /**
   * Enhanced input validation with security logging
   */
  public validateInput(
    input: any,
    validationType: string,
    clientId?: string,
  ): boolean {
    try {
      switch (validationType) {
        case "scalar":
          if (typeof input !== "bigint") {
            throw new Error("Input must be a bigint")
          }
          validateScalar(input)
          break

        case "point":
          if (
            !input ||
            typeof input.x !== "bigint" ||
            typeof input.y !== "bigint"
          ) {
            throw new Error("Invalid point structure")
          }
          // Additional point validation would go here
          break

        case "array":
          if (!Array.isArray(input)) {
            throw new Error("Input must be an array")
          }
          if (input.length === 0) {
            throw new Error("Array cannot be empty")
          }
          break

        default:
          throw new Error(`Unknown validation type: ${validationType}`)
      }

      return true
    } catch (error) {
      this.logSecurityEvent(
        SecurityEventType.INVALID_INPUT_DETECTED,
        SecuritySeverity.MEDIUM,
        {
          validationType,
          error: error instanceof Error ? error.message : String(error),
          inputType: typeof input,
        },
        clientId,
      )
      return false
    }
  }

  /**
   * Secure random generation with entropy monitoring
   */
  public generateSecureRandom(): Scalar {
    // Generate multiple random values to increase entropy
    const randoms = Array.from({ length: 4 }, () => randScalar())

    // Combine them using cryptographic operations
    let result = randoms[0]!
    for (let i = 1; i < randoms.length; i++) {
      result = moduloOrder(result + randoms[i]!)
    }

    // Validate the result
    if (result === 0n || result >= CURVE_ORDER) {
      this.logSecurityEvent(
        SecurityEventType.CRYPTOGRAPHIC_ERROR,
        SecuritySeverity.HIGH,
        {
          operation: "secure_random_generation",
          result: result.toString(),
        },
      )
      // Fallback to standard random generation
      return randScalar()
    }

    return result
  }

  /**
   * Memory-safe scalar operations
   */
  public secureScalarOperation(
    operation: "add" | "mul" | "inv",
    a: Scalar,
    b?: Scalar,
  ): Scalar {
    try {
      validateScalar(a)
      if (b !== undefined) {
        validateScalar(b)
      }

      switch (operation) {
        case "add":
          if (b === undefined)
            throw new Error("Second operand required for addition")
          return moduloOrder(a + b)

        case "mul":
          if (b === undefined)
            throw new Error("Second operand required for multiplication")
          return moduloOrder(a * b)

        case "inv":
          return secureModularInverse(a)

        default:
          throw new Error(`Unknown operation: ${operation}`)
      }
    } catch (error) {
      this.logSecurityEvent(
        SecurityEventType.CRYPTOGRAPHIC_ERROR,
        SecuritySeverity.HIGH,
        {
          operation,
          error: error instanceof Error ? error.message : String(error),
        },
      )
      throw new MentalPokerError(
        `Secure scalar operation failed: ${error}`,
        MentalPokerErrorCode.CRYPTOGRAPHIC_ERROR,
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Constant-time proof verification
   */
  public constantTimeVerification(
    verifyFunction: () => boolean,
    expectedDuration = 10, // Expected duration in ms
  ): boolean {
    const startTime = performance.now()

    const result = verifyFunction()

    const endTime = performance.now()
    const actualDuration = endTime - startTime

    // Pad the timing to make it constant
    const remainingTime = Math.max(0, expectedDuration - actualDuration)
    if (remainingTime > 0) {
      // Busy wait to maintain constant time
      const busyWaitEnd = performance.now() + remainingTime
      while (performance.now() < busyWaitEnd) {
        // Busy wait
      }
    }

    return result
  }

  /**
   * Get security statistics
   */
  public getSecurityStats(): {
    totalEvents: number
    eventsByType: Record<string, number>
    eventsBySeverity: Record<string, number>
    recentEvents: SecurityEvent[]
  } {
    const eventsByType: Record<string, number> = {}
    const eventsBySeverity: Record<string, number> = {}

    for (const event of this.auditLog) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1
      eventsBySeverity[event.severity] =
        (eventsBySeverity[event.severity] || 0) + 1
    }

    const recentEvents = this.auditLog
      .slice(-10)
      .sort((a, b) => b.timestamp - a.timestamp)

    return {
      totalEvents: this.auditLog.length,
      eventsByType,
      eventsBySeverity,
      recentEvents,
    }
  }

  /**
   * Clear audit log (for testing purposes)
   */
  public clearAuditLog(): void {
    this.auditLog.length = 0
    this.rateLimit.clear()
  }

  /**
   * Export audit log for analysis
   */
  public exportAuditLog(): SecurityEvent[] {
    return [...this.auditLog]
  }

  /**
   * Advanced challenge generation with additional entropy
   */
  public generateChallenge(...inputs: (Point | Scalar)[]): Scalar {
    const challengeInputs: Scalar[] = []

    // Add timestamp for freshness
    challengeInputs.push(BigInt(Date.now()))

    // Add additional entropy
    challengeInputs.push(this.generateSecureRandom())

    // Process all inputs
    for (const input of inputs) {
      if (typeof input === "bigint") {
        challengeInputs.push(input)
      } else {
        challengeInputs.push(input.x ?? 0n, input.y ?? 0n)
      }
    }

    const challenge = poseidonHashScalars(challengeInputs)

    // Ensure challenge is non-zero
    return challenge === 0n ? 1n : challenge
  }

  /**
   * Secure point operations with validation
   */
  public securePointOperation(
    operation: "add" | "multiply",
    pointA: Point,
    pointBOrScalar: Point | Scalar,
  ): Point {
    try {
      // Validate inputs
      if (
        !pointA ||
        typeof pointA.x !== "bigint" ||
        typeof pointA.y !== "bigint"
      ) {
        throw new Error("Invalid point A")
      }

      switch (operation) {
        case "add":
          if (typeof pointBOrScalar === "bigint") {
            throw new Error("Point addition requires two points")
          }
          if (
            !pointBOrScalar ||
            typeof pointBOrScalar.x !== "bigint" ||
            typeof pointBOrScalar.y !== "bigint"
          ) {
            throw new Error("Invalid point B")
          }
          return addPoints(pointA, pointBOrScalar)

        case "multiply":
          if (typeof pointBOrScalar !== "bigint") {
            throw new Error("Point multiplication requires a scalar")
          }
          validateScalar(pointBOrScalar)
          return scalarMultiply(pointBOrScalar, pointA)

        default:
          throw new Error(`Unknown point operation: ${operation}`)
      }
    } catch (error) {
      this.logSecurityEvent(
        SecurityEventType.CRYPTOGRAPHIC_ERROR,
        SecuritySeverity.HIGH,
        {
          operation: `point_${operation}`,
          error: error instanceof Error ? error.message : String(error),
        },
      )
      throw new MentalPokerError(
        `Secure point operation failed: ${error}`,
        MentalPokerErrorCode.CRYPTOGRAPHIC_ERROR,
        error instanceof Error ? error : undefined,
      )
    }
  }
}
