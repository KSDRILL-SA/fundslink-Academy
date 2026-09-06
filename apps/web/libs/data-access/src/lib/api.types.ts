import type { components, operations, paths } from './generated/api-types';

/**
 * Type helpers over the generated contract.
 *
 * Everything here DERIVES from `generated/api-types.ts`. Nothing restates a
 * shape. If a schema changes in `packages/contracts/openapi.yaml`, the change
 * arrives here through regeneration and breaks the call sites that no longer
 * match — which is the entire point of contract-first (S2.7). A hand-written
 * mirror would have silently kept compiling.
 */

export type { components, operations, paths };

/** Every schema in the contract, by name: `Schema<'Application'>`. */
export type Schema<K extends keyof components['schemas']> = components['schemas'][K];

/** Every operation id in the contract. 32 of them. */
export type OperationId = keyof operations;

type JsonContent<T> = T extends { content: { 'application/json': infer B } } ? B : never;

/** The JSON request body of an operation, or `never` if it takes none. */
export type RequestBody<Id extends OperationId> = operations[Id] extends {
  requestBody?: infer R;
}
  ? JsonContent<NonNullable<R>>
  : never;

/**
 * The success response body of an operation.
 *
 * Only 2xx responses are included: an error is not a value a caller receives,
 * it is thrown, and typing it as a possible return would push every call site
 * into narrowing a union that never actually arrives on the success path.
 */
export type ResponseBody<Id extends OperationId> = operations[Id] extends {
  responses: infer R;
}
  ? R extends Record<number, unknown>
    ? JsonContent<R[Extract<keyof R, 200 | 201 | 202>]>
    : never
  : never;

/** Path parameters of an operation, or `never` if it takes none. */
export type PathParams<Id extends OperationId> = operations[Id] extends {
  parameters: { path?: infer P };
}
  ? P extends undefined | never
    ? never
    : NonNullable<P>
  : never;

/** Query parameters of an operation, or `never` if it takes none. */
export type QueryParams<Id extends OperationId> = operations[Id] extends {
  parameters: { query?: infer Q };
}
  ? Q extends undefined | never
    ? never
    : NonNullable<Q>
  : never;

/**
 * The error envelope every failure carries (contract `Error` schema).
 *
 * **`code` is the contract; `message` is not.** UI branches on `code` and never
 * on `message` (S4.12, handoff §4.3) — the message is prose that may be
 * reworded, translated, or made vaguer for security, and a screen that reads
 * it is a screen that breaks on a copy edit. `request_id` is what a student
 * quotes to support, so it must survive as far as the error surface.
 */
export type ApiErrorBody = Schema<'Error'>;

/** A page of results. Cursor-based everywhere — never offset (handoff §4.4). */
export interface Page<T> {
  readonly items: readonly T[];
  readonly meta: { readonly next_cursor?: string | null };
}

/**
 * Money is a decimal STRING and must stay one.
 *
 * `parseFloat` on a currency amount is how R1 234.56 quietly becomes
 * 1234.5599999999999. Render it, compare it as a string, send it back
 * unchanged — never compute with it in the browser (handoff §4.4). The alias
 * exists so the intent is visible at every call site.
 */
export type DecimalString = string;
