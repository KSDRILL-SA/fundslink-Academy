import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, throwError } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { toApiError } from './api-error';

/** Path parameters substituted into a contract path template. */
export type PathParamMap = Readonly<Record<string, string | number>>;
/** Query parameters. `undefined` and `null` values are omitted, not sent empty. */
export type QueryParamMap = Readonly<Record<string, string | number | boolean | null | undefined>>;

export interface RequestOptions {
  readonly path?: PathParamMap;
  readonly query?: QueryParamMap;
}

/**
 * The typed HTTP layer over the generated contract.
 *
 * Built on Angular's `HttpClient` rather than `fetch` for one decisive
 * reason: the auth interceptor from Stage 02 — access token in memory plus
 * 401-refresh deduplication — is an `HttpClient` interceptor. A `fetch`-based
 * client would silently bypass it, and every feature would end up
 * re-implementing token attachment and refresh, badly and inconsistently.
 *
 * Generic on purpose. Per-domain services arrive with the screens that need
 * them (L2); this is the layer they will all sit on, and it is where the two
 * cross-cutting contract rules live: every failure becomes an `ApiError` with
 * a stable `code`, and URL templates are filled from typed parameters rather
 * than assembled by hand at call sites.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('PUT', path, body, options);
  }

  delete<T>(path: string, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  private request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions,
  ): Observable<T> {
    const url = `${this.baseUrl}${fillPath(path, options.path)}`;
    return this.http
      .request<T>(method, url, {
        body,
        params: toHttpParams(options.query),
        // The refresh token is an HttpOnly cookie the browser holds and this
        // code never sees (S3.14); it only travels if credentials are sent.
        withCredentials: true,
      })
      .pipe(catchError((error: unknown) => throwError(() => toApiError(error))));
  }
}

/**
 * Substitute `{id}` style parameters from the contract's path templates.
 *
 * Values are URL-encoded. A path parameter is user-controlled — an application
 * id from a link, a token from an email — and interpolating it raw is how a
 * value containing `/` or `?` silently becomes a different request.
 */
export function fillPath(template: string, params?: PathParamMap): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{([^}]+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter "${name}" for "${template}"`);
    }
    return encodeURIComponent(String(value));
  });
}

/**
 * Build query parameters, dropping absent ones.
 *
 * An omitted filter and a filter explicitly set to empty are different
 * requests; sending `?status=` for "no status filter" makes the server
 * disambiguate something the client already knew.
 */
export function toHttpParams(query?: QueryParamMap): HttpParams {
  let params = new HttpParams();
  if (!query) {
    return params;
  }
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params = params.set(key, String(value));
    }
  }
  return params;
}
