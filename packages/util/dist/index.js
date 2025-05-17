// src/errors.ts
var InvalidStringError = class extends Error {
  constructor(expectation) {
    super(`Invalid string: "${expectation}"`);
  }
};

// src/Range.ts
import { CustomError } from "ts-custom-error";
var InvalidRangeError = class extends CustomError {
  constructor(message) {
    super();
    this.message = message;
  }
};
var OutsideRangeError = class extends CustomError {
  constructor(value, { lowerBound, upperBound }, description) {
    super();
    this.message = `${description} - ${value} must be between ${lowerBound} and ${upperBound}`;
  }
};
var throwIfInvalidRange = ({
  lowerBound,
  upperBound
}) => {
  if (!lowerBound && !upperBound) {
    throw new InvalidRangeError("Must provide at least one bound");
  }
  if (lowerBound === upperBound) {
    throw new InvalidRangeError(
      `Lower bound: ${lowerBound}, cannot equal upper bound ${upperBound}`
    );
  }
  if (lowerBound && lowerBound > upperBound) {
    throw new InvalidRangeError(
      `Lower bound: ${lowerBound}, cannot be larger than upper bound: ${upperBound}`
    );
  }
};
var inRange = (value, range) => {
  throwIfInvalidRange(range);
  const { lowerBound, upperBound } = range;
  if (!lowerBound && upperBound) {
    return value <= upperBound;
  }
  if (lowerBound && !upperBound) {
    return value >= lowerBound;
  }
  return value >= lowerBound && value <= upperBound;
};
var throwIfOutsideRange = (value, range, description) => {
  if (!inRange(value, range)) {
    throw new OutsideRangeError(value, range, description);
  }
};
export {
  InvalidRangeError,
  InvalidStringError,
  OutsideRangeError,
  inRange,
  throwIfInvalidRange,
  throwIfOutsideRange
};
//# sourceMappingURL=index.js.map