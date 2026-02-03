import { z } from 'zod'

export const CategorySchema = z.object({
  name: z.string().min(1),
  prompts: z.array(z.string().min(1)).min(1),
})

export const ClassificationConfigSchema = z.object({
  model: z.string().default('openai/clip-vit-large-patch14'),
  threshold: z.number().min(0).max(1).default(0.0),
  topK: z.number().int().min(1).max(10).default(3),
})

export const OutputConfigSchema = z.object({
  mode: z.enum(['copy', 'move']).default('copy'),
  duplicateHandling: z.enum(['rename', 'skip', 'overwrite']).default('rename'),
})

export const ConfigSchema = z.object({
  version: z.number().int().default(1),
  categories: z.array(CategorySchema).min(1),
  classification: ClassificationConfigSchema.default({}),
  output: OutputConfigSchema.default({}),
})

export type Category = z.infer<typeof CategorySchema>
export type ClassificationConfig = z.infer<typeof ClassificationConfigSchema>
export type OutputConfig = z.infer<typeof OutputConfigSchema>
export type Config = z.infer<typeof ConfigSchema>
