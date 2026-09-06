import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from './api.types';

/**
 * A failure from the API, normalised so every caller sees the same shape.
 *
 * The single job here is to guarantee `code` exists. A screen branches on it
 * (S4.12), so "the server returned something we did not expect" must still
 * produce a usable code rather than an undefined that every call site has to
 * guard. Network failures, gateway HTML, and 500s all arrive as errors with a
 * code, which is what lets the UI's error-presentation table be total.
 */
export class ApiError extends Error {
  constructor(
    /** The stable contract code. Branch on this, never on `message`. */
    readonly code: string,
    /** Server prose. For logs and support, never for control flow. */
    override readonly message: string,
    /** What a student quotes to support. */
    readonly requestId: string | null,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** No response reached us at all — offline, DNS, CORS, a dropped connection. */
export const NETWORK_ERROR_CODE = 'network_unavailable';
/** A response arrived but did not carry the contract's error envelope. */
export const UNEXPECTED_ERROR_CODE = 'unexpected_error';

function isErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ApiErrorBody).error?.code === 'string'
  );
}

/**
 * Turn anything Angular's HttpClient threw into an ApiError.
 *
 * `status === 0` means the request never completed — the browser reports no
 * status because there was no response. That is a different failure from a
 * server error and a student should be told so ("check your connection"), not
 * shown a generic server message.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new ApiError(
        NETWORK_ERROR_CODE,
        'The request did not reach the server.',
        null,
        0,
      );
    }

    if (isErrorBody(error.error)) {
      const body = error.error.error;
      return new ApiError(
        body.code,
        body.message,
        body.request_id ?? null,
        error.status,
        body.details as Record<string, unknown> | undefined,
      );
    }

    // A response without the envelope: a proxy error page, a gateway timeout,
    // an unhandled 500. Never surface its body — it can carry server detail a
    // student should not read, and on some infrastructure, internal hostnames.
    return new ApiError(
      UNEXPECTED_ERROR_CODE,
      `The server returned an unexpected ${error.status} response.`,
      null,
      error.status,
    );
  }

  return new ApiError(UNEXPECTED_ERROR_CODE, 'An unexpected error occurred.', null, 0);
}
