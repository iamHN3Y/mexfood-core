export type CodigoError =
  | "NETWORK"
  | "SUPABASE"
  | "LLM_TIMEOUT"
  | "LLM_INVALID_RESPONSE"
  | "PARSER"
  | "UNKNOWN";

export class CoreError extends Error {
  readonly code: CodigoError;
  readonly recoverable: boolean;

  constructor(code: CodigoError, message: string, recoverable = false) {
    super(message);
    this.name = "CoreError";
    this.code = code;
    this.recoverable = recoverable;
  }
}
