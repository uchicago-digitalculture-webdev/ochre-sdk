/**
 * Flatten an intersection so editors show one object instead of `A & B`
 *
 * Deliberately not re-exported from the package root: it is a TypeScript
 * presentation detail, not part of the OCHRE model.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};
