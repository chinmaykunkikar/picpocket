import { describe, it, expect } from 'vitest'
import {
  RECOMMENDED_MODELS,
  DEFAULT_MODEL,
  getModelById,
  isRecommendedModel,
  getDefaultModel,
} from '../../src/config/models.js'

describe('RECOMMENDED_MODELS', () => {
  it('should have at least one model', () => {
    expect(RECOMMENDED_MODELS.length).toBeGreaterThan(0)
  })

  it('should have exactly one recommended model', () => {
    const recommended = RECOMMENDED_MODELS.filter(m => m.recommended)
    expect(recommended).toHaveLength(1)
  })

  it('should have all required fields for each model', () => {
    for (const model of RECOMMENDED_MODELS) {
      expect(model.id).toBeTruthy()
      expect(model.name).toBeTruthy()
      expect(model.size).toBeTruthy()
      expect(model.description).toBeTruthy()
    }
  })

  it('should have valid HuggingFace model IDs', () => {
    for (const model of RECOMMENDED_MODELS) {
      expect(model.id).toContain('/')
    }
  })

  it('should include common OpenAI CLIP models', () => {
    const ids = RECOMMENDED_MODELS.map(m => m.id)
    expect(ids).toContain('openai/clip-vit-base-patch32')
    expect(ids).toContain('openai/clip-vit-large-patch14')
  })
})

describe('DEFAULT_MODEL', () => {
  it('should be a valid model ID', () => {
    expect(DEFAULT_MODEL).toContain('/')
  })

  it('should be in RECOMMENDED_MODELS', () => {
    expect(isRecommendedModel(DEFAULT_MODEL)).toBe(true)
  })

  it('should be the recommended model', () => {
    const model = getModelById(DEFAULT_MODEL)
    expect(model?.recommended).toBe(true)
  })
})

describe('getModelById', () => {
  it('should return model for valid ID', () => {
    const model = getModelById('openai/clip-vit-base-patch32')
    expect(model).toBeDefined()
    expect(model?.name).toBe('ViT-B/32')
  })

  it('should return undefined for unknown ID', () => {
    const model = getModelById('unknown/model')
    expect(model).toBeUndefined()
  })

  it('should return undefined for empty string', () => {
    const model = getModelById('')
    expect(model).toBeUndefined()
  })

  it('should return correct model for each recommended model', () => {
    for (const expected of RECOMMENDED_MODELS) {
      const model = getModelById(expected.id)
      expect(model).toEqual(expected)
    }
  })
})

describe('isRecommendedModel', () => {
  it('should return true for recommended models', () => {
    expect(isRecommendedModel('openai/clip-vit-base-patch32')).toBe(true)
    expect(isRecommendedModel('openai/clip-vit-large-patch14')).toBe(true)
  })

  it('should return false for unknown models', () => {
    expect(isRecommendedModel('custom/my-model')).toBe(false)
    expect(isRecommendedModel('laion/CLIP-ViT-H-14-laion2B-s32B-b79K')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isRecommendedModel('')).toBe(false)
  })

  it('should be case-sensitive', () => {
    expect(isRecommendedModel('OPENAI/clip-vit-base-patch32')).toBe(false)
  })
})

describe('getDefaultModel', () => {
  it('should return a ModelInfo object', () => {
    const model = getDefaultModel()
    expect(model).toBeDefined()
    expect(model.id).toBeTruthy()
    expect(model.name).toBeTruthy()
  })

  it('should return the recommended model', () => {
    const model = getDefaultModel()
    expect(model.recommended).toBe(true)
  })

  it('should return the same model as DEFAULT_MODEL', () => {
    const model = getDefaultModel()
    expect(model.id).toBe(DEFAULT_MODEL)
  })
})
