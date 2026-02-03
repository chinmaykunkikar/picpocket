import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import {
  ensureCategoryDirs,
  copyFile,
  copyFiles,
} from '../../src/files/copier.js'

describe('ensureCategoryDirs', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'picpocket-copier-test-'))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  it('should create output directory', async () => {
    const outputDir = path.join(tempDir, 'output')
    await ensureCategoryDirs(outputDir, ['People'], false)

    expect(await fs.pathExists(outputDir)).toBe(true)
  })

  it('should create category directories', async () => {
    const outputDir = path.join(tempDir, 'output')
    await ensureCategoryDirs(outputDir, ['People', 'Screenshots', 'Documents'], false)

    expect(await fs.pathExists(path.join(outputDir, 'People'))).toBe(true)
    expect(await fs.pathExists(path.join(outputDir, 'Screenshots'))).toBe(true)
    expect(await fs.pathExists(path.join(outputDir, 'Documents'))).toBe(true)
  })

  it('should create Review directory when includeReview is true', async () => {
    const outputDir = path.join(tempDir, 'output')
    await ensureCategoryDirs(outputDir, ['People'], true)

    expect(await fs.pathExists(path.join(outputDir, 'Review'))).toBe(true)
  })

  it('should not create Review directory when includeReview is false', async () => {
    const outputDir = path.join(tempDir, 'output')
    await ensureCategoryDirs(outputDir, ['People'], false)

    expect(await fs.pathExists(path.join(outputDir, 'Review'))).toBe(false)
  })

  it('should be idempotent', async () => {
    const outputDir = path.join(tempDir, 'output')
    await ensureCategoryDirs(outputDir, ['People'], true)
    await ensureCategoryDirs(outputDir, ['People'], true)

    expect(await fs.pathExists(path.join(outputDir, 'People'))).toBe(true)
  })
})

describe('copyFile', () => {
  let tempDir: string
  let sourceDir: string
  let outputDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'picpocket-copy-test-'))
    sourceDir = path.join(tempDir, 'source')
    outputDir = path.join(tempDir, 'output')
    await fs.ensureDir(sourceDir)
    await fs.ensureDir(path.join(outputDir, 'People'))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  it('should copy file to correct category', async () => {
    const source = path.join(sourceDir, 'photo.jpg')
    await fs.writeFile(source, 'test content')

    const result = await copyFile(source, outputDir, 'People')

    expect(result.skipped).toBe(false)
    expect(result.error).toBeUndefined()
    expect(await fs.pathExists(result.destination)).toBe(true)
    expect(await fs.pathExists(source)).toBe(true) // Original still exists
  })

  it('should move file when move option is true', async () => {
    const source = path.join(sourceDir, 'photo.jpg')
    await fs.writeFile(source, 'test content')

    const result = await copyFile(source, outputDir, 'People', { move: true })

    expect(result.skipped).toBe(false)
    expect(await fs.pathExists(result.destination)).toBe(true)
    expect(await fs.pathExists(source)).toBe(false) // Original removed
  })

  it('should rename duplicate files by default', async () => {
    const source1 = path.join(sourceDir, 'photo.jpg')
    const source2 = path.join(sourceDir, 'sub', 'photo.jpg')
    await fs.writeFile(source1, 'content1')
    await fs.ensureDir(path.dirname(source2))
    await fs.writeFile(source2, 'content2')

    const result1 = await copyFile(source1, outputDir, 'People')
    const result2 = await copyFile(source2, outputDir, 'People')

    expect(result1.destination).toContain('photo.jpg')
    expect(result2.destination).toContain('photo_1.jpg')
    expect(await fs.readFile(result1.destination, 'utf-8')).toBe('content1')
    expect(await fs.readFile(result2.destination, 'utf-8')).toBe('content2')
  })

  it('should skip duplicate when duplicateHandling is skip', async () => {
    const source1 = path.join(sourceDir, 'photo.jpg')
    const source2 = path.join(sourceDir, 'sub', 'photo.jpg')
    await fs.writeFile(source1, 'content1')
    await fs.ensureDir(path.dirname(source2))
    await fs.writeFile(source2, 'content2')

    await copyFile(source1, outputDir, 'People')
    const result2 = await copyFile(source2, outputDir, 'People', {
      duplicateHandling: 'skip',
    })

    expect(result2.skipped).toBe(true)
    // Content should still be from first file
    const content = await fs.readFile(result2.destination, 'utf-8')
    expect(content).toBe('content1')
  })

  it('should overwrite duplicate when duplicateHandling is overwrite', async () => {
    const source1 = path.join(sourceDir, 'photo.jpg')
    const source2 = path.join(sourceDir, 'sub', 'photo.jpg')
    await fs.writeFile(source1, 'content1')
    await fs.ensureDir(path.dirname(source2))
    await fs.writeFile(source2, 'content2')

    await copyFile(source1, outputDir, 'People')
    const result2 = await copyFile(source2, outputDir, 'People', {
      duplicateHandling: 'overwrite',
    })

    expect(result2.skipped).toBe(false)
    // Content should be from second file
    const content = await fs.readFile(result2.destination, 'utf-8')
    expect(content).toBe('content2')
  })

  it('should return error for non-existent source', async () => {
    const source = path.join(sourceDir, 'nonexistent.jpg')

    const result = await copyFile(source, outputDir, 'People')

    expect(result.error).toBeDefined()
  })

  it('should increment counter for multiple duplicates', async () => {
    const dest = path.join(outputDir, 'People', 'photo.jpg')
    const dest1 = path.join(outputDir, 'People', 'photo_1.jpg')
    const dest2 = path.join(outputDir, 'People', 'photo_2.jpg')
    await fs.writeFile(dest, 'original')
    await fs.writeFile(dest1, 'dup1')

    const source = path.join(sourceDir, 'photo.jpg')
    await fs.writeFile(source, 'new')

    const result = await copyFile(source, outputDir, 'People')

    expect(result.destination).toBe(dest2)
  })

  it('should preserve file content', async () => {
    const source = path.join(sourceDir, 'photo.jpg')
    const content = 'binary image data here'
    await fs.writeFile(source, content)

    const result = await copyFile(source, outputDir, 'People')

    const copied = await fs.readFile(result.destination, 'utf-8')
    expect(copied).toBe(content)
  })
})

describe('copyFiles', () => {
  let tempDir: string
  let sourceDir: string
  let outputDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'picpocket-batch-test-'))
    sourceDir = path.join(tempDir, 'source')
    outputDir = path.join(tempDir, 'output')
    await fs.ensureDir(sourceDir)
    await fs.ensureDir(path.join(outputDir, 'People'))
    await fs.ensureDir(path.join(outputDir, 'Screenshots'))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  it('should copy multiple files to their categories', async () => {
    const source1 = path.join(sourceDir, 'person.jpg')
    const source2 = path.join(sourceDir, 'screen.png')
    await fs.writeFile(source1, 'person content')
    await fs.writeFile(source2, 'screen content')

    const files = [
      { source: source1, category: 'People' },
      { source: source2, category: 'Screenshots' },
    ]

    const results = await copyFiles(files, outputDir)

    expect(results).toHaveLength(2)
    expect(results[0].destination).toContain('People')
    expect(results[1].destination).toContain('Screenshots')
  })

  it('should call progress callback', async () => {
    const source1 = path.join(sourceDir, 'photo1.jpg')
    const source2 = path.join(sourceDir, 'photo2.jpg')
    await fs.writeFile(source1, '')
    await fs.writeFile(source2, '')

    const files = [
      { source: source1, category: 'People' },
      { source: source2, category: 'People' },
    ]

    const progressCalls: Array<{ completed: number; total: number }> = []

    await copyFiles(files, outputDir, {
      onProgress: (completed, total) => {
        progressCalls.push({ completed, total })
      },
    })

    expect(progressCalls).toEqual([
      { completed: 1, total: 2 },
      { completed: 2, total: 2 },
    ])
  })

  it('should pass options to individual copy operations', async () => {
    const source1 = path.join(sourceDir, 'photo.jpg')
    const source2 = path.join(sourceDir, 'sub', 'photo.jpg')
    await fs.writeFile(source1, 'content1')
    await fs.ensureDir(path.dirname(source2))
    await fs.writeFile(source2, 'content2')

    const files = [
      { source: source1, category: 'People' },
      { source: source2, category: 'People' },
    ]

    const results = await copyFiles(files, outputDir, {
      duplicateHandling: 'skip',
    })

    expect(results[0].skipped).toBe(false)
    expect(results[1].skipped).toBe(true)
  })

  it('should handle empty file list', async () => {
    const results = await copyFiles([], outputDir)
    expect(results).toEqual([])
  })

  it('should handle move option', async () => {
    const source = path.join(sourceDir, 'photo.jpg')
    await fs.writeFile(source, 'content')

    const files = [{ source, category: 'People' }]

    await copyFiles(files, outputDir, { move: true })

    expect(await fs.pathExists(source)).toBe(false)
  })

  it('should continue on errors', async () => {
    const source1 = path.join(sourceDir, 'nonexistent.jpg')
    const source2 = path.join(sourceDir, 'exists.jpg')
    await fs.writeFile(source2, 'content')

    const files = [
      { source: source1, category: 'People' },
      { source: source2, category: 'People' },
    ]

    const results = await copyFiles(files, outputDir)

    expect(results[0].error).toBeDefined()
    expect(results[1].error).toBeUndefined()
    expect(await fs.pathExists(results[1].destination)).toBe(true)
  })
})
