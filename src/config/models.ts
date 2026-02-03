export interface ModelInfo {
  id: string
  name: string
  size: string
  description: string
  recommended?: boolean
}

/**
 * Curated list of well-tested CLIP models.
 * This is NOT a restriction - any Hugging Face CLIP model can be used.
 * These are just recommendations for users who don't know which to pick.
 */
export const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: 'openai/clip-vit-base-patch32',
    name: 'ViT-B/32',
    size: '~350MB',
    description: 'Fastest, lowest memory usage. Good for quick sorting.',
  },
  {
    id: 'openai/clip-vit-base-patch16',
    name: 'ViT-B/16',
    size: '~350MB',
    description: 'Balanced speed and accuracy for base models.',
  },
  {
    id: 'openai/clip-vit-large-patch14',
    name: 'ViT-L/14',
    size: '~900MB',
    description: 'Best balance of speed and accuracy. Recommended for most users.',
    recommended: true,
  },
  {
    id: 'openai/clip-vit-large-patch14-336',
    name: 'ViT-L/14@336px',
    size: '~900MB',
    description: 'Highest accuracy with 336px input. Best for detailed classification.',
  },
]

export const DEFAULT_MODEL = 'openai/clip-vit-large-patch14'

export function getModelById(id: string): ModelInfo | undefined {
  return RECOMMENDED_MODELS.find(m => m.id === id)
}

export function isRecommendedModel(id: string): boolean {
  return RECOMMENDED_MODELS.some(m => m.id === id)
}

export function getDefaultModel(): ModelInfo {
  return RECOMMENDED_MODELS.find(m => m.recommended) || RECOMMENDED_MODELS[0]
}
