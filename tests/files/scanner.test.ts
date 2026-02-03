import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import {
  scanForImages,
  isImageFile,
  getImageExtensions,
} from '../../src/files/scanner.js'

describe('getImageExtensions', () => {
  it('should return supported extensions', () => {
    const extensions = getImageExtensions()
    expect(extensions).toContain('jpg')
    expect(extensions).toContain('jpeg')
    expect(extensions).toContain('png')
    expect(extensions).toContain('gif')
    expect(extensions).toContain('webp')
    expect(extensions).toContain('bmp')
    expect(extensions).toContain('heic')
  })

  it('should return a new array each time', () => {
    const ext1 = getImageExtensions()
    const ext2 = getImageExtensions()
    expect(ext1).not.toBe(ext2)
    expect(ext1).toEqual(ext2)
  })
})

describe('isImageFile', () => {
  it('should return true for supported extensions', () => {
    expect(isImageFile('photo.jpg')).toBe(true)
    expect(isImageFile('photo.jpeg')).toBe(true)
    expect(isImageFile('photo.png')).toBe(true)
    expect(isImageFile('photo.gif')).toBe(true)
    expect(isImageFile('photo.webp')).toBe(true)
    expect(isImageFile('photo.bmp')).toBe(true)
    expect(isImageFile('photo.heic')).toBe(true)
  })

  it('should return true for uppercase extensions', () => {
    expect(isImageFile('photo.JPG')).toBe(true)
    expect(isImageFile('photo.PNG')).toBe(true)
    expect(isImageFile('photo.HEIC')).toBe(true)
  })

  it('should return false for unsupported extensions', () => {
    expect(isImageFile('document.pdf')).toBe(false)
    expect(isImageFile('video.mp4')).toBe(false)
    expect(isImageFile('archive.zip')).toBe(false)
    expect(isImageFile('script.js')).toBe(false)
  })

  it('should return false for files without extension', () => {
    expect(isImageFile('noextension')).toBe(false)
    expect(isImageFile('.hidden')).toBe(false)
  })

  it('should handle paths with directories', () => {
    expect(isImageFile('/path/to/photo.jpg')).toBe(true)
    expect(isImageFile('/path/to/document.pdf')).toBe(false)
  })
})

describe('scanForImages', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'picpocket-scan-test-'))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  it('should find image files in directory', async () => {
    await fs.writeFile(path.join(tempDir, 'photo1.jpg'), '')
    await fs.writeFile(path.join(tempDir, 'photo2.png'), '')
    await fs.writeFile(path.join(tempDir, 'doc.pdf'), '')

    const images = await scanForImages(tempDir)

    expect(images).toHaveLength(2)
    expect(images.some(f => f.endsWith('photo1.jpg'))).toBe(true)
    expect(images.some(f => f.endsWith('photo2.png'))).toBe(true)
    expect(images.some(f => f.endsWith('doc.pdf'))).toBe(false)
  })

  it('should find images in subdirectories by default', async () => {
    await fs.ensureDir(path.join(tempDir, 'subdir'))
    await fs.writeFile(path.join(tempDir, 'root.jpg'), '')
    await fs.writeFile(path.join(tempDir, 'subdir', 'nested.png'), '')

    const images = await scanForImages(tempDir)

    expect(images).toHaveLength(2)
    expect(images.some(f => f.endsWith('root.jpg'))).toBe(true)
    expect(images.some(f => f.endsWith('nested.png'))).toBe(true)
  })

  it('should respect includeSubdirs option', async () => {
    await fs.ensureDir(path.join(tempDir, 'subdir'))
    await fs.writeFile(path.join(tempDir, 'root.jpg'), '')
    await fs.writeFile(path.join(tempDir, 'subdir', 'nested.png'), '')

    const images = await scanForImages(tempDir, { includeSubdirs: false })

    expect(images).toHaveLength(1)
    expect(images[0]).toContain('root.jpg')
  })

  it('should respect limit option', async () => {
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(path.join(tempDir, `photo${i}.jpg`), '')
    }

    const images = await scanForImages(tempDir, { limit: 5 })

    expect(images).toHaveLength(5)
  })

  it('should return sorted results', async () => {
    await fs.writeFile(path.join(tempDir, 'c.jpg'), '')
    await fs.writeFile(path.join(tempDir, 'a.jpg'), '')
    await fs.writeFile(path.join(tempDir, 'b.jpg'), '')

    const images = await scanForImages(tempDir)
    const filenames = images.map(f => path.basename(f))

    expect(filenames).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('should return absolute paths', async () => {
    await fs.writeFile(path.join(tempDir, 'photo.jpg'), '')

    const images = await scanForImages(tempDir)

    expect(path.isAbsolute(images[0])).toBe(true)
  })

  it('should handle uppercase extensions', async () => {
    await fs.writeFile(path.join(tempDir, 'photo1.JPG'), '')
    await fs.writeFile(path.join(tempDir, 'photo2.PNG'), '')

    const images = await scanForImages(tempDir)

    expect(images).toHaveLength(2)
  })

  it('should ignore macOS resource fork files', async () => {
    await fs.writeFile(path.join(tempDir, 'photo.jpg'), '')
    await fs.writeFile(path.join(tempDir, '._photo.jpg'), '')

    const images = await scanForImages(tempDir)

    expect(images).toHaveLength(1)
    expect(images[0]).not.toContain('._')
  })

  it('should return empty array for empty directory', async () => {
    const images = await scanForImages(tempDir)
    expect(images).toEqual([])
  })

  it('should return empty array for directory with no images', async () => {
    await fs.writeFile(path.join(tempDir, 'doc.pdf'), '')
    await fs.writeFile(path.join(tempDir, 'readme.txt'), '')

    const images = await scanForImages(tempDir)

    expect(images).toEqual([])
  })

  it('should handle deeply nested directories', async () => {
    const deepPath = path.join(tempDir, 'a', 'b', 'c', 'd')
    await fs.ensureDir(deepPath)
    await fs.writeFile(path.join(deepPath, 'deep.jpg'), '')

    const images = await scanForImages(tempDir)

    expect(images).toHaveLength(1)
    expect(images[0]).toContain('deep.jpg')
  })
})
