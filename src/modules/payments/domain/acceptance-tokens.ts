/** A document the buyer accepts before paying, identified by a single-use signed token. */
export interface AcceptanceToken {
  readonly token: string;
  /** Public URL of the document (PDF), shown as "Leer documento". */
  readonly permalink: string;
}

/**
 * Both acceptances the provider requires to pay. Each token can be used in one transaction
 * only (SPIKE-01), so a new pair is requested for every payment attempt.
 */
export interface AcceptanceTokens {
  readonly endUserPolicy: AcceptanceToken;
  readonly personalDataAuth: AcceptanceToken;
}
