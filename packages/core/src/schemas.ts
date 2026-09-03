import { z } from "zod";

export const ArtifactTypeSchema = z.enum(["html", "markdown"]);

export const PutOptsSchema = z.object({
  key: z.string().min(1).optional(),
  id: z.string().optional(),
  name: z.string().min(1).optional(),
  type: ArtifactTypeSchema.optional(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  agent: z.string().optional(),
  model: z.string().optional(),
  force: z.boolean().default(false),
  baseVersion: z.number().int().positive().optional(),
  projectRoot: z.string().optional(),
});

export const GetOptsSchema = z.object({
  id: z.string(),
  version: z.number().int().positive().optional(),
  full: z.boolean().default(false),
});

export const ListOptsSchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
});

export const DiffOptsSchema = z.object({
  id: z.string(),
  from: z.number().int().positive(),
  to: z.number().int().positive(),
});

export const RestoreOptsSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  baseVersion: z.number().int().positive().optional(),
});

export const ImportOptsSchema = z.object({
  content: z.string(),
  name: z.string().optional(),
  key: z.string().optional(),
  source: z.string().optional(),
  projectRoot: z.string().optional(),
  type: ArtifactTypeSchema.optional(),
});

export const RecipeV0Schema = z
  .object({
    $schema: z.string().optional(),
    schemaVersion: z.literal(0),
    title: z.string().min(1),
    format: ArtifactTypeSchema,
    tokens: z.enum(["default"]).optional(),
    quality: z.enum(["strict", "off"]).optional(),
  })
  .strict();
export type RecipeV0 = z.infer<typeof RecipeV0Schema>;

export type PutOpts = z.infer<typeof PutOptsSchema>;
export type GetOpts = z.infer<typeof GetOptsSchema>;
export type ListOpts = z.infer<typeof ListOptsSchema>;
export type DiffOpts = z.infer<typeof DiffOptsSchema>;
export type RestoreOpts = z.infer<typeof RestoreOptsSchema>;
export type ImportOpts = z.infer<typeof ImportOptsSchema>;
