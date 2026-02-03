import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MODEL,
  DEFAULT_THRESHOLD,
  DEFAULT_TOP_K,
} from '../../src/config/defaults.js'
import { CategorySchema } from '../../src/config/schema.js'

describe('DEFAULT_CATEGORIES', () => {
  it('should have exactly 5 categories', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(5)
  })

  it('should have expected category names', () => {
    const names = DEFAULT_CATEGORIES.map(c => c.name)
    expect(names).toContain('People')
    expect(names).toContain('Screenshots')
    expect(names).toContain('Documents')
    expect(names).toContain('Real_Photos')
    expect(names).toContain('Forwards')
  })

  it('should have valid prompts for each category', () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(() => CategorySchema.parse(category)).not.toThrow()
      expect(category.prompts.length).toBeGreaterThan(0)
    }
  })

  it('should have descriptive prompts', () => {
    for (const category of DEFAULT_CATEGORIES) {
      for (const prompt of category.prompts) {
        expect(prompt.length).toBeGreaterThan(5)
        expect(prompt).not.toBe(prompt.toUpperCase()) // Not all caps
      }
    }
  })

  it('People category should have face/person prompts', () => {
    const people = DEFAULT_CATEGORIES.find(c => c.name === 'People')
    expect(people).toBeDefined()
    const allPrompts = people!.prompts.join(' ')
    expect(allPrompts.toLowerCase()).toContain('person')
  })

  it('Screenshots category should have screen prompts', () => {
    const screenshots = DEFAULT_CATEGORIES.find(c => c.name === 'Screenshots')
    expect(screenshots).toBeDefined()
    const allPrompts = screenshots!.prompts.join(' ')
    expect(allPrompts.toLowerCase()).toContain('screenshot')
  })

  it('Documents category should have document prompts', () => {
    const docs = DEFAULT_CATEGORIES.find(c => c.name === 'Documents')
    expect(docs).toBeDefined()
    const allPrompts = docs!.prompts.join(' ')
    expect(allPrompts.toLowerCase()).toContain('document')
  })

  it('Real_Photos category should have photo prompts', () => {
    const photos = DEFAULT_CATEGORIES.find(c => c.name === 'Real_Photos')
    expect(photos).toBeDefined()
    const allPrompts = photos!.prompts.join(' ')
    expect(allPrompts.toLowerCase()).toContain('photograph')
  })

  it('Forwards category should have meme/viral prompts', () => {
    const forwards = DEFAULT_CATEGORIES.find(c => c.name === 'Forwards')
    expect(forwards).toBeDefined()
    const allPrompts = forwards!.prompts.join(' ')
    expect(allPrompts.toLowerCase()).toContain('meme')
  })

  it('should not have duplicate prompts within a category', () => {
    for (const category of DEFAULT_CATEGORIES) {
      const uniquePrompts = new Set(category.prompts)
      expect(uniquePrompts.size).toBe(category.prompts.length)
    }
  })
})

describe('DEFAULT_MODEL', () => {
  it('should be a valid HuggingFace model ID', () => {
    expect(DEFAULT_MODEL).toContain('/')
  })

  it('should be the recommended CLIP model', () => {
    expect(DEFAULT_MODEL).toBe('openai/clip-vit-large-patch14')
  })
})

describe('DEFAULT_THRESHOLD', () => {
  it('should be 0 (no threshold)', () => {
    expect(DEFAULT_THRESHOLD).toBe(0.0)
  })

  it('should be a valid threshold value', () => {
    expect(DEFAULT_THRESHOLD).toBeGreaterThanOrEqual(0)
    expect(DEFAULT_THRESHOLD).toBeLessThanOrEqual(1)
  })
})

describe('DEFAULT_TOP_K', () => {
  it('should be 3 (recommended)', () => {
    expect(DEFAULT_TOP_K).toBe(3)
  })

  it('should be a valid topK value', () => {
    expect(DEFAULT_TOP_K).toBeGreaterThanOrEqual(1)
    expect(DEFAULT_TOP_K).toBeLessThanOrEqual(10)
  })
})
