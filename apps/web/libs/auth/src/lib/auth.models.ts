/**
 * Auth DTOs — re-exported from the GENERATED contract client.
 *
 * These were hand-written in Stage 02 with a note saying a generated client
 * would replace them in Stage 04. Until now the shapes were "kept in lockstep
 * with the contract" by hand, which is precisely the drift S2.7 exists to
 * prevent: a rename in openapi.yaml would have left this file compiling and
 * wrong.
 *
 * They are aliases now, so a contract change breaks the call sites instead.
 */
import type { Schema } from 'data-access';

export type AuthTokens = Schema<'AuthTokens'>;
export type RegisterRequest = Schema<'RegisterRequest'>;
export type LoginRequest = Schema<'LoginRequest'>;

/**
 * The contract has no named `ConsentInput` schema — it inlines the object
 * inside `RegisterRequest.consents[]`. Stage 02 invented the name and wrote
 * the shape by hand, which is exactly the drift this change ends. Derived from
 * the array element so it cannot diverge again.
 */
export type ConsentInput = Schema<'RegisterRequest'>['consents'][number];
