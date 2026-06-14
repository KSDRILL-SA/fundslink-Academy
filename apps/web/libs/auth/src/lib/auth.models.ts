/** Auth DTOs — mirror packages/contracts/openapi.yaml (S2.7). A generated client replaces
 *  these hand-written types in Stage 04; the shapes are kept in lockstep with the contract. */

export interface AuthTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ConsentInput {
  purpose: string;
  wording_version: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  consents: ConsentInput[];
}

export interface LoginRequest {
  email: string;
  password: string;
  mfa_code?: string;
}
