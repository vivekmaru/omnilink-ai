import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const RAW_FETCH_ALLOWLIST: Record<string, number> = {
  // The configured OIDC token endpoint must support loopback development.
  // It is HTTPS-only otherwise, redirect-disabled, timed out, byte-bounded,
  // and JSON-MIME checked before parsing.
  'server/auth/http.ts': 1,
  // OIDC discovery uses an injected fetch so tests and loopback providers use
  // the same bounded JSON-only path.
  'server/auth/oidc.ts': 1,
  // The guarded transport is the only general-purpose network implementation.
  'server/outboundUrlPolicy.ts': 1,
};

const NETWORK_SDK_ALLOWLIST: Record<string, number> = {
  'server.ts': 1,
  'server/mcpServer.ts': 1,
};

function typescriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(target);
    return entry.isFile() && entry.name.endsWith('.ts') ? [target] : [];
  });
}

describe('server outbound network inventory', () => {
  it('keeps raw fetch calls on the reviewed allowlist', () => {
    const root = process.cwd();
    const files = [path.join(root, 'server.ts'), ...typescriptFiles(path.join(root, 'server'))];
    const counts: Record<string, number> = {};

    for (const file of files) {
      const count = [...fs.readFileSync(file, 'utf8').matchAll(/\bfetch(?:Impl)?\s*\(/g)].length;
      if (count > 0) counts[path.relative(root, file)] = count;
    }

    expect(counts).toEqual(RAW_FETCH_ALLOWLIST);
  });

  it('keeps provider SDK clients on the reviewed allowlist', () => {
    const root = process.cwd();
    const files = [path.join(root, 'server.ts'), ...typescriptFiles(path.join(root, 'server'))];
    const counts: Record<string, number> = {};

    for (const file of files) {
      const count = [...fs.readFileSync(file, 'utf8').matchAll(/\bnew\s+GoogleGenAI\s*\(/g)].length;
      if (count > 0) counts[path.relative(root, file)] = count;
    }

    expect(counts).toEqual(NETWORK_SDK_ALLOWLIST);
  });
});
