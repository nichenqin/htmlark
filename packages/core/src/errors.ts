export type HtmlarkCode = "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "DIRTY" | "INTERNAL" | "REGISTRY";

export class HtmlarkError extends Error {
  readonly code: HtmlarkCode;
  readonly detail: Record<string, unknown>;
  readonly httpStatus: number;
  readonly exitCode: number;

  constructor(code: HtmlarkCode, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "HtmlarkError";
    this.code = code;
    this.detail = detail;
    const map: Record<HtmlarkCode, { http: number; exit: number }> = {
      VALIDATION: { http: 400, exit: 2 },
      NOT_FOUND: { http: 404, exit: 3 },
      CONFLICT: { http: 409, exit: 4 },
      DIRTY: { http: 409, exit: 5 },
      REGISTRY: { http: 500, exit: 1 },
      INTERNAL: { http: 500, exit: 1 },
    };
    this.httpStatus = map[code].http;
    this.exitCode = map[code].exit;
  }

  toJSON() {
    return { ok: false as const, error: this.message, code: this.code, detail: this.detail };
  }
}
