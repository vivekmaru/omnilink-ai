import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import sanitizeHtml from 'sanitize-html';

// Clean sanitization helper for RSS content and user notes
export function sanitizeText(raw: string | undefined | null): string {
  if (!raw) return '';
  return sanitizeHtml(raw, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'code', 'pre', 'ul', 'li', 'ol', 'blockquote', 'h1', 'h2', 'h3', 'h4'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      code: ['class'],
    },
  }).trim();
}

// Schemas

export const CreateLinkSchema = z.object({
  url: z.string().url('A valid HTTP/HTTPS URL is required.'),
  title: z.string().max(500).optional(),
  notes: z.string().max(10000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  autoAiExtract: z.boolean().optional(),
  source: z.string().max(100).optional(),
});

export const UpdateLinkSchema = z.object({
  url: z.string().url().optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  author: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(10000).optional(),
  readStatus: z.enum(['unread', 'reading', 'read']).optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  readingTimeMinutes: z.number().int().min(1).max(300).optional(),
  aiScore: z.number().int().min(0).max(100).optional(),
});

export const BatchActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one link ID is required.'),
  action: z.enum(['delete', 'archive', 'unarchive', 'markRead', 'markUnread', 'setCategory', 'addTag']),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const MergeLinkSchema = z.object({
  title: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  notes: z.string().max(10000).optional(),
  mode: z.enum(['smart', 'overwrite']).optional().default('smart'),
  autoAiExtract: z.boolean().optional(),
});

export const AskRepoSchema = z.object({
  question: z.string().min(1, 'Question text cannot be empty.').max(2000),
  preferredModel: z.string().optional(),
});

export const HybridSearchSchema = z.object({
  query: z.string().max(1000).optional(),
  category: z.string().optional(),
  platform: z.string().optional(),
  readStatus: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(15),
  minScore: z.coerce.number().min(0).max(1).optional(),
});

export const CheckDuplicateSchema = z.object({
  url: z.string().min(1, 'URL parameter is required.'),
});

export const AddRssFeedSchema = z.object({
  url: z.string().url('A valid RSS/Atom feed URL is required.'),
  title: z.string().max(300).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
});

// Middleware factory for body validation
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: result.error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// Middleware factory for query validation
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation Error',
        details: result.error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    req.query = result.data as any;
    next();
  };
}
