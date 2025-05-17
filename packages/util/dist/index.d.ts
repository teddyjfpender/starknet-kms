import { CustomError } from 'ts-custom-error';

declare class InvalidStringError extends Error {
    constructor(expectation: string);
}

type OpaqueString<T extends string> = string & {
    /** This helps typescript distinguish different opaque string types. */
    __opaqueString: T;
};
type OpaqueNumber<T extends string> = number & {
    __opaqueNumber: T;
};

/**
 * Base interface to model a range
 */
interface Range<TBound> {
    /**
     * Inclusive
     */
    lowerBound?: TBound;
    /**
     * Inclusive
     */
    upperBound?: TBound;
}
declare class InvalidRangeError extends CustomError {
    constructor(message: string);
}
declare class OutsideRangeError<T, R> extends CustomError {
    constructor(value: T, { lowerBound, upperBound }: Range<R>, description: string);
}
declare const throwIfInvalidRange: <T>({ lowerBound, upperBound, }: Range<T>) => void;
declare const inRange: <T>(value: T, range: Range<T>) => boolean;
declare const throwIfOutsideRange: <T>(value: T, range: Range<T>, description: string) => void;

export { InvalidRangeError, InvalidStringError, type OpaqueNumber, type OpaqueString, OutsideRangeError, type Range, inRange, throwIfInvalidRange, throwIfOutsideRange };
