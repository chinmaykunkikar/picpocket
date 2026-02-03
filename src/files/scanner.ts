import fg from 'fast-glob'
import * as path from 'path'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic']

export interface ScanOptions {
  includeSubdirs?: boolean
  limit?: number
}

export async function scanForImages(
  inputDir: string,
  options: ScanOptions = {}
): Promise<string[]> {
  const { includeSubdirs = true, limit } = options

  const patterns = IMAGE_EXTENSIONS.flatMap((ext) => [
    `**/*.${ext}`,
    `**/*.${ext.toUpperCase()}`,
  ])

  const globOptions = {
    cwd: inputDir,
    absolute: true,
    onlyFiles: true,
    deep: includeSubdirs ? undefined : 1,
    ignore: ['**/._*'],
  }

  const files = await fg(patterns, globOptions)

  const sorted = files.sort((a, b) => {
    const nameA = path.basename(a).toLowerCase()
    const nameB = path.basename(b).toLowerCase()
    return nameA.localeCompare(nameB)
  })

  if (limit && limit > 0) {
    return sorted.slice(0, limit)
  }

  return sorted
}

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().slice(1)
  return IMAGE_EXTENSIONS.includes(ext)
}

export function getImageExtensions(): string[] {
  return [...IMAGE_EXTENSIONS]
}
