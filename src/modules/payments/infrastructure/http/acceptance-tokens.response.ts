import type { AcceptanceToken, AcceptanceTokens } from '../../domain/acceptance-tokens';

export interface AcceptanceTokenResponse {
  readonly acceptanceToken: string;
  readonly permalink: string;
}

export interface AcceptanceTokensResponse {
  readonly endUserPolicy: AcceptanceTokenResponse;
  readonly personalDataAuth: AcceptanceTokenResponse;
}

const toTokenResponse = ({ token, permalink }: AcceptanceToken): AcceptanceTokenResponse => ({
  acceptanceToken: token,
  permalink,
});

export const toAcceptanceTokensResponse = (tokens: AcceptanceTokens): AcceptanceTokensResponse => ({
  endUserPolicy: toTokenResponse(tokens.endUserPolicy),
  personalDataAuth: toTokenResponse(tokens.personalDataAuth),
});
