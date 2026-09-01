import * as dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, interceptors, type Dispatcher } from 'undici';
import ipaddr from 'ipaddr.js';

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUEST_TIMEOUT_MS = 2_147_483_647;

export type OutboundMediaType = 'json' | 'html' | 'xml' | 'text';

export interface OutboundRequestMetrics {
  requestsStarted: number;
  responsesReceived: number;
  redirectsFollowed: number;
  blockedRequests: number;
  dnsFailures: number;
  networkFailures: number;
  timedOutRequests: number;
  rejectedMediaTypes: number;
  oversizedResponses: number;
}

// Deliberately aggregate-only: never add URL, query, header, or body dimensions.
const outboundRequestMetrics: OutboundRequestMetrics = {
  requestsStarted: 0,
  responsesReceived: 0,
  redirectsFollowed: 0,
  blockedRequests: 0,
  dnsFailures: 0,
  networkFailures: 0,
  timedOutRequests: 0,
  rejectedMediaTypes: 0,
  oversizedResponses: 0,
};

const responseSignals = new WeakMap<Response, AbortSignal>();
const countedTimeoutSignals = new WeakSet<AbortSignal>();

export function getOutboundRequestMetrics(): Readonly<OutboundRequestMetrics> {
  return Object.freeze({ ...outboundRequestMetrics });
}

/** Intended for metrics collection intervals and isolated tests. */
export function resetOutboundRequestMetrics(): void {
  for (const key of Object.keys(outboundRequestMetrics) as Array<keyof OutboundRequestMetrics>) {
    outboundRequestMetrics[key] = 0;
  }
}

export class OutboundUrlPolicyError extends Error {
  code: 'invalid-url' | 'blocked-host' | 'dns-failure' | 'redirect-limit' | 'response-too-large' | 'unsupported-media-type' | 'request-timeout';

  constructor(code: OutboundUrlPolicyError['code'], message: string) {
    super(message);
    this.name = 'OutboundUrlPolicyError';
    this.code = code;
  }
}

function timeoutError(signal?: AbortSignal): OutboundUrlPolicyError {
  if (!signal || !countedTimeoutSignals.has(signal)) {
    outboundRequestMetrics.timedOutRequests += 1;
    if (signal) countedTimeoutSignals.add(signal);
  }
  return new OutboundUrlPolicyError('request-timeout', 'Outbound request exceeded the configured timeout.');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError') throw timeoutError(signal);
  throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function networkErrorCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === 'string') return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}

async function cancelResponseBody(response: Response, reason?: unknown): Promise<void> {
  try {
    await response.body?.cancel(reason);
  } catch {
    // Cancellation is cleanup and must not mask the policy error being raised.
  }
}

async function awaitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const removeListener = () => signal.removeEventListener('abort', rejectOnAbort);
    const rejectOnAbort = () => {
      removeListener();
      try {
        throwIfAborted(signal);
      } catch (error) {
        reject(error);
      }
    };
    signal.addEventListener('abort', rejectOnAbort, { once: true });
    promise.then((value) => {
      removeListener();
      resolve(value);
    }, (error) => {
      removeListener();
      reject(error);
    });
  });
}

function isBlockedIp(value: string): boolean {
  const normalized = value.replace(/^\[|\]$/g, '');
  if (net.isIP(normalized) === 0) return false;
  try {
    const parsed = ipaddr.parse(normalized);
    if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
      return parsed.toIPv4Address().range() !== 'unicast';
    }
    // An allowlist is safer than enumerating private/reserved ranges. Modern
    // ipaddr.js classifies site-local, discard-only, documentation, transition,
    // benchmarking, multicast, and other special-use blocks separately.
    return parsed.range() !== 'unicast';
  } catch {
    return true;
  }
}

type DnsLookup = typeof dns.lookup;
type DnsInterceptorLookup = NonNullable<Parameters<typeof interceptors.dns>[0]>['lookup'];

/**
 * Validate DNS inside Undici's dispatch path. The interceptor substitutes the
 * selected IP into the actual connection while retaining the original Host
 * header and TLS server name, removing the validate-then-resolve-again race.
 */
export function createSafeConnectionLookup(lookup: DnsLookup = dns.lookup): DnsInterceptorLookup {
  return (origin, _options, callback) => {
    lookup(origin.hostname, { all: true, verbatim: true }).then((addresses) => {
      const normalized = addresses as Array<{ address: string; family: number }>;
      if (normalized.length === 0 || normalized.some(({ address }) => isBlockedIp(address))) {
        callback(Object.assign(new Error('Outbound hostname resolves to a private or reserved network.'), { code: 'EACCES' }), []);
        return;
      }
      callback(null, normalized.map(({ address, family }) => ({
        address,
        family: family === 6 ? 6 : 4,
        ttl: 1_000,
      })));
    }).catch(() => {
      callback(Object.assign(new Error('Outbound hostname could not be resolved.'), { code: 'ENOTFOUND' }), []);
    });
  };
}

const safeOutboundDispatcher: Dispatcher = new Agent().compose(interceptors.dns({
  lookup: createSafeConnectionLookup(),
  maxTTL: 1_000,
  maxItems: 1_000,
}));

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.replace(/\.$/, '').toLowerCase();
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === 'metadata.google.internal'
    || normalized === 'metadata'
    || normalized.endsWith('.local');
}

function parseUrl(input: string | URL): URL {
  let parsed: URL;
  try {
    parsed = input instanceof URL ? new URL(input.toString()) : new URL(input);
  } catch {
    throw new OutboundUrlPolicyError('invalid-url', 'Outbound URL is invalid.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OutboundUrlPolicyError('invalid-url', 'Only HTTP and HTTPS outbound URLs are allowed.');
  }
  if (parsed.username || parsed.password) {
    throw new OutboundUrlPolicyError('invalid-url', 'Outbound URLs must not contain credentials.');
  }
  return parsed;
}

/** Resolve and validate a URL before making a server-side request. */
export async function assertSafeOutboundUrl(
  input: string | URL,
  signal?: AbortSignal,
  lookup: typeof dns.lookup = dns.lookup,
): Promise<URL> {
  const parsed = parseUrl(input);
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) throw new OutboundUrlPolicyError('invalid-url', 'Outbound URL has no hostname.');

  if (isBlockedHostname(hostname) || isBlockedIp(hostname)) {
    throw new OutboundUrlPolicyError('blocked-host', 'Outbound URL targets a private or reserved network.');
  }

  if (net.isIP(hostname) === 0) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await awaitWithSignal(
        lookup(hostname, { all: true, verbatim: true }) as Promise<Array<{ address: string }>>,
        signal,
      );
    } catch {
      throwIfAborted(signal);
      throw new OutboundUrlPolicyError('dns-failure', 'Outbound hostname could not be resolved.');
    }
    if (addresses.length === 0 || addresses.some(({ address }) => isBlockedIp(address))) {
      throw new OutboundUrlPolicyError('blocked-host', 'Outbound hostname resolves to a private or reserved network.');
    }
  }
  return parsed;
}

/**
 * Fetch with manual redirect handling. Every hop is DNS-validated, credentials
 * are rejected, redirects are bounded, and HTTPS-to-HTTP downgrade is denied.
 */
export async function safeFetch(input: string | URL, options: RequestInit & {
  maxRedirects?: number;
  timeoutMs?: number;
  /** Test/integration seam; production uses node DNS resolution. */
  lookup?: typeof dns.lookup;
} = {}): Promise<Response> {
  const {
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    lookup = dns.lookup,
    ...requestOptions
  } = options;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_REQUEST_TIMEOUT_MS) {
    throw new OutboundUrlPolicyError('invalid-url', 'Outbound request timeout must be a positive number.');
  }
  outboundRequestMetrics.requestsStarted += 1;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = requestOptions.signal
    ? AbortSignal.any([requestOptions.signal, timeoutSignal])
    : timeoutSignal;
  let current: URL;
  try {
    current = await assertSafeOutboundUrl(input, requestSignal, lookup);
  } catch (error) {
    if (error instanceof OutboundUrlPolicyError && error.code === 'blocked-host') outboundRequestMetrics.blockedRequests += 1;
    if (error instanceof OutboundUrlPolicyError && error.code === 'dns-failure') outboundRequestMetrics.dnsFailures += 1;
    throwIfAborted(requestSignal);
    throw error;
  }
  let headers = new Headers(requestOptions.headers || {});
  let method = requestOptions.method;
  let body = requestOptions.body;

  for (let hop = 0; ; hop += 1) {
    throwIfAborted(requestSignal);
    let response: Response;
    try {
      response = await fetch(current, {
        ...requestOptions,
        signal: requestSignal,
        method,
        body,
        headers,
        redirect: 'manual',
        // Node's fetch accepts Undici dispatchers; keep this property last so a
        // caller cannot replace the connection-time DNS policy.
        dispatcher: safeOutboundDispatcher,
      } as RequestInit);
    } catch (error) {
      if (requestSignal.aborted) throwIfAborted(requestSignal);
      const code = networkErrorCode(error);
      if (code === 'EACCES') outboundRequestMetrics.blockedRequests += 1;
      else if (code === 'ENOTFOUND') outboundRequestMetrics.dnsFailures += 1;
      else outboundRequestMetrics.networkFailures += 1;
      throw error;
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      outboundRequestMetrics.responsesReceived += 1;
      responseSignals.set(response, requestSignal);
      return response;
    }
    const location = response.headers.get('location');
    if (!location) {
      outboundRequestMetrics.responsesReceived += 1;
      responseSignals.set(response, requestSignal);
      return response;
    }
    if (hop >= maxRedirects) {
      await cancelResponseBody(response);
      throw new OutboundUrlPolicyError('redirect-limit', 'Outbound redirect limit exceeded.');
    }
    let next: URL;
    // Resolve and validate every destination before applying transport policy;
    // redirects to private hosts must never reach the network layer.
    try {
      next = parseUrl(new URL(location, current));
      await assertSafeOutboundUrl(next, requestSignal, lookup);
    } catch (error) {
      await cancelResponseBody(response, error);
      if (error instanceof OutboundUrlPolicyError && error.code === 'blocked-host') outboundRequestMetrics.blockedRequests += 1;
      if (error instanceof OutboundUrlPolicyError && error.code === 'dns-failure') outboundRequestMetrics.dnsFailures += 1;
      throwIfAborted(requestSignal);
      throw error;
    }
    if (current.protocol === 'https:' && next.protocol === 'http:') {
      await cancelResponseBody(response);
      throw new OutboundUrlPolicyError('invalid-url', 'HTTPS outbound requests may not downgrade to HTTP.');
    }
    await cancelResponseBody(response);
    // Never forward caller credentials across an origin change.
    if (next.origin !== current.origin) {
      headers = new Headers(headers);
      headers.delete('authorization');
      headers.delete('cookie');
    }
    if (response.status === 303) {
      method = 'GET';
      body = undefined;
    }
    outboundRequestMetrics.redirectsFollowed += 1;
    current = next;
  }
}

const MEDIA_TYPE_PATTERNS: Record<OutboundMediaType, (mime: string) => boolean> = {
  json: (mime) => mime === 'application/json' || mime.endsWith('+json'),
  html: (mime) => mime === 'text/html' || mime === 'application/xhtml+xml',
  xml: (mime) => mime === 'application/xml' || mime === 'text/xml' || mime.endsWith('+xml'),
  text: (mime) => mime.startsWith('text/'),
};

/** Reject a response before handing attacker-controlled bytes to a parser. */
export function assertResponseMediaType(response: Response, allowed: readonly OutboundMediaType[]): string {
  const raw = response.headers.get('content-type');
  const mime = raw?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!mime || !allowed.some((kind) => MEDIA_TYPE_PATTERNS[kind](mime))) {
    outboundRequestMetrics.rejectedMediaTypes += 1;
    void response.body?.cancel().catch(() => undefined);
    throw new OutboundUrlPolicyError('unsupported-media-type', 'Outbound response has an unsupported media type.');
  }
  return mime;
}

/** Read a response body with a decompressed byte limit. */
export async function readResponseText(response: Response, maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES): Promise<string> {
  const signal = responseSignals.get(response);
  throwIfAborted(signal);
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) {
    outboundRequestMetrics.oversizedResponses += 1;
    await cancelResponseBody(response);
    throw new OutboundUrlPolicyError('response-too-large', 'Outbound response exceeds the configured size limit.');
  }
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      throwIfAborted(signal);
      const read = reader.read();
      const { done, value } = signal
        ? await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
          const removeListener = () => signal.removeEventListener('abort', rejectOnAbort);
          const rejectOnAbort = () => {
            let error: unknown;
            try {
              throwIfAborted(signal);
            } catch (cause) {
              error = cause;
            }
            removeListener();
            reject(error);
            void reader.cancel(error).catch(() => undefined);
          };
          signal.addEventListener('abort', rejectOnAbort, { once: true });
          read.then((result) => {
            removeListener();
            resolve(result);
          }, (error) => {
            removeListener();
            reject(error);
          });
        })
        : await read;
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        outboundRequestMetrics.oversizedResponses += 1;
        await reader.cancel();
        throw new OutboundUrlPolicyError('response-too-large', 'Outbound response exceeds the configured size limit.');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof OutboundUrlPolicyError && error.code === 'request-timeout') throw error;
    throwIfAborted(signal);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readResponseJson<T = unknown>(response: Response, maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES): Promise<T> {
  assertResponseMediaType(response, ['json']);
  return JSON.parse(await readResponseText(response, maxBytes)) as T;
}

export async function readResponseHtml(response: Response, maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES): Promise<string> {
  assertResponseMediaType(response, ['html']);
  return readResponseText(response, maxBytes);
}

export async function readResponseXml(response: Response, maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES): Promise<string> {
  assertResponseMediaType(response, ['xml']);
  return readResponseText(response, maxBytes);
}
