export interface ChainlistRpcObject {
  url?: string;
  tracking?: string;
}

export interface ChainlistChain {
  chainId?: number;
  name?: string;
  rpc?: Array<string | ChainlistRpcObject>;
}

export interface JsonRpcRequest {
  method: string;
  params: unknown[];
}

export interface JsonRpcTransportResponse {
  status: number;
  body: unknown;
}

export type JsonRpcTransport = (
  url: string,
  request: JsonRpcRequest
) => Promise<JsonRpcTransportResponse>;

export class RpcRequestError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, retryable: boolean, status?: number) {
    super(message);
    this.name = "RpcRequestError";
    this.retryable = retryable;
    this.status = status;
  }
}

const PLACEHOLDER = /\$\{[^}]+\}/;
const EMBEDDED_API_KEY = /\/v\d+\/[A-Za-z0-9_-]{16,}(?:\/|$|\?)|\/[a-fA-F0-9]{24,}(?:\/|$|\?)|[?&](?:api[_-]?key|apikey|key)=/i;

export const BEST_RPC_LIMIT = 10;

export function looksLikeEmbeddedApiKey(url: string): boolean {
  return EMBEDDED_API_KEY.test(url);
}

export function parseRpcList(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function usableHttpsRpcs(chain: ChainlistChain): string[] {
  const urls: string[] = [];
  for (const entry of chain.rpc ?? []) {
    const raw = typeof entry === "string" ? entry : entry?.url;
    if (typeof raw !== "string") continue;
    const url = raw.trim();
    if (!url.toLowerCase().startsWith("https://")) continue;
    if (PLACEHOLDER.test(url)) continue;
    urls.push(url);
  }
  return urls;
}

/** First `limit` public HTTPS endpoints, skipping placeholders and URLs that embed an API key. */
export function bestHttpsRpcs(chain: ChainlistChain, limit = BEST_RPC_LIMIT): string[] {
  const urls: string[] = [];
  for (const url of usableHttpsRpcs(chain)) {
    if (looksLikeEmbeddedApiKey(url)) continue;
    if (urls.includes(url)) continue;
    urls.push(url);
    if (urls.length >= limit) break;
  }
  return urls;
}

function errorDetails(body: unknown): { message: string; code?: number } {
  if (typeof body === "string") return { message: body };
  if (!body || typeof body !== "object") return { message: "" };
  const error = (body as { error?: unknown }).error;
  if (typeof error === "string") return { message: error };
  if (!error || typeof error !== "object") return { message: "" };
  const record = error as { message?: unknown; code?: unknown; data?: unknown };
  let message = typeof record.message === "string" ? record.message : "";
  if (!message && typeof record.data === "string") message = record.data;
  if (!message && record.data && typeof record.data === "object" && "message" in record.data) {
    const nested = (record.data as { message?: unknown }).message;
    if (typeof nested === "string") message = nested;
  }
  const code = typeof record.code === "number" ? record.code : undefined;
  return { message, code };
}

export function isRateLimitMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("rate-limit") ||
    normalized.includes("ratelimit") ||
    normalized.includes("too many request") ||
    normalized.includes("throttl") ||
    normalized.includes("request limit") ||
    normalized.includes("call rate") ||
    normalized.includes("usage limit") ||
    normalized.includes("current plan") ||
    /\b429\b/.test(normalized)
  );
}

/** Errors that mean this endpoint rejected the call, so the next URL should be tried. */
export function isRetryableEndpointFailure(status: number, message: string, code?: number): boolean {
  if (status === 401 || status === 403 || status === 429) return true;
  if (code === -32051 || code === 401 || code === 403) return true;
  const normalized = message.toLowerCase();
  return (
    isRateLimitMessage(message) ||
    normalized.includes("api key") ||
    normalized.includes("unknown token") ||
    normalized.includes("invalid token") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("-32051") ||
    normalized.includes("rest code: 403") ||
    normalized.includes("rest code 403")
  );
}

export function classifyRpcResponse(
  status: number,
  body: unknown
): { ok: true; result: unknown } | { ok: false; error: RpcRequestError } {
  const { message, code } = errorDetails(body);
  if (isRetryableEndpointFailure(status, message, code)) {
    return {
      ok: false,
      error: new RpcRequestError(message || `HTTP ${status}`, true, status),
    };
  }
  if (status === 0 || status === 408 || status >= 500) {
    return {
      ok: false,
      error: new RpcRequestError(message || `HTTP ${status}`, true, status),
    };
  }
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (error !== undefined && error !== null) {
      // A body with no usable message was surfacing as "JSON-RPC error". Try the next URL.
      // Code 3 is an EVM revert and stays on this endpoint.
      const retryable = !message && code !== 3;
      return {
        ok: false,
        error: new RpcRequestError(message || "JSON-RPC error", retryable, status),
      };
    }
  }
  if (status >= 400) {
    return {
      ok: false,
      error: new RpcRequestError(message || `HTTP ${status}`, false, status),
    };
  }
  if (body && typeof body === "object" && "result" in body) {
    return { ok: true, result: (body as { result: unknown }).result };
  }
  return {
    ok: false,
    error: new RpcRequestError(message || "Invalid JSON-RPC response", true, status),
  };
}

let rpcRequestId = 1;

export async function httpJsonRpcTransport(
  url: string,
  request: JsonRpcRequest
): Promise<JsonRpcTransportResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: rpcRequestId++,
      method: request.method,
      params: request.params,
    }),
  });
  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } else {
    body = null;
  }
  return { status: response.status, body };
}

export interface RpcRotator {
  readonly endpoints: readonly string[];
  call(method: string, params?: unknown[]): Promise<unknown>;
}

export function createRpcRotator(
  endpoints: readonly string[],
  transport: JsonRpcTransport = httpJsonRpcTransport
): RpcRotator {
  if (endpoints.length === 0) {
    throw new Error("No RPC endpoints configured");
  }
  const urls = [...endpoints];
  let cursor = 0;

  return {
    endpoints: urls,
    async call(method: string, params: unknown[] = []): Promise<unknown> {
      const start = cursor;
      cursor = (cursor + 1) % urls.length;
      let lastError: Error = new Error("RPC call failed");
      for (let attempt = 0; attempt < urls.length; attempt++) {
        const url = urls[(start + attempt) % urls.length];
        let response: JsonRpcTransportResponse;
        try {
          response = await transport(url, { method, params });
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          continue;
        }
        const classified = classifyRpcResponse(response.status, response.body);
        if (classified.ok) return classified.result;
        lastError = classified.error;
        if (!classified.error.retryable) throw classified.error;
      }
      throw lastError;
    },
  };
}

export function openRpcPool(rpcInput: string, transport?: JsonRpcTransport): RpcRotator {
  return createRpcRotator(parseRpcList(rpcInput), transport);
}
