import * as dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, interceptors, type Dispatcher } from 'undici';
import ipaddr from 'ipaddr.js';

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export class OutboundUrlPolicyError extends Error {
  code: 'invalid-url' | 'blocked-host' | 'dns-failure' | 'redirect-limit' | 'response-too-large';

  constructor(code: OutboundUrlPolicyError['code'], message: string) {
    super(message);
    this.name = 'OutboundUrlPolicyError';
    this.code = code;
  }
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
      addresses = await lookup(hostname, { all: true, verbatim: true }) as Array<{ address: string }>;
    } catch {
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
  /** Test/integration seam; production uses node DNS resolution. */
  lookup?: typeof dns.lookup;
} = {}): Promise<Response> {
  const { maxRedirects = DEFAULT_MAX_REDIRECTS, lookup = dns.lookup, ...requestOptions } = options;
  let current = await assertSafeOutboundUrl(input, requestOptions.signal, lookup);
  let headers = new Headers(requestOptions.headers || {});
  let method = requestOptions.method;
  let body = requestOptions.body;

  for (let hop = 0; ; hop += 1) {
    const response = await fetch(current, {
      ...requestOptions,
      method,
      body,
      headers,
      redirect: 'manual',
      // Node's fetch accepts Undici dispatchers; keep this property last so a
      // caller cannot replace the connection-time DNS policy.
      dispatcher: safeOutboundDispatcher,
    } as RequestInit);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    if (hop >= maxRedirects) {
      await response.body?.cancel();
      throw new OutboundUrlPolicyError('redirect-limit', 'Outbound redirect limit exceeded.');
    }
    const next = parseUrl(new URL(location, current));
    // Resolve and validate every destination before applying transport policy;
    // redirects to private hosts must never reach the network layer.
    await assertSafeOutboundUrl(next, requestOptions.signal, lookup);
    if (current.protocol === 'https:' && next.protocol === 'http:') {
      await response.body?.cancel();
      throw new OutboundUrlPolicyError('invalid-url', 'HTTPS outbound requests may not downgrade to HTTP.');
    }
    await response.body?.cancel();
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
    current = next;
  }
}

/** Read a response body with a decompressed byte limit. */
export async function readResponseText(response: Response, maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new OutboundUrlPolicyError('response-too-large', 'Outbound response exceeds the configured size limit.');
  }
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new OutboundUrlPolicyError('response-too-large', 'Outbound response exceeds the configured size limit.');
      }
      chunks.push(value);
    }
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
  return JSON.parse(await readResponseText(response, maxBytes)) as T;
}
