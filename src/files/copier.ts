import * as fs from 'fs-extra'
import * as path from 'path'

export type DuplicateHandling = 'rename' | 'skip' | 'overwrite'

export interface CopyResult {
  source: string
  destination: string
  skipped: boolean
  error?: string
}

export async function ensureCategoryDirs(
  outputDir: string,
  categories: string[],
  includeReview: boolean
): Promise<void> {
  await fs.ensureDir(outputDir)

  for (const category of categories) {
    await fs.ensureDir(path.join(outputDir, category))
  }

  if (includeReview) {
    await fs.ensureDir(path.join(outputDir, 'Review'))
  }
}

function getUniqueFilename(destDir: string, filename: string): string {
  const ext = path.extname(filename)
  const stem = path.basename(filename, ext)
  let destPath = path.join(destDir, filename)
  let counter = 1

  while (fs.existsSync(destPath)) {
    destPath = path.join(destDir, `${stem}_${counter}${ext}`)
    counter++
  }

  return destPath
}

export async function copyFile(
  source: string,
  outputDir: string,
  category: string,
  options: {
    move?: boolean
    duplicateHandling?: DuplicateHandling
  } = {}
): Promise<CopyResult> {
  const { move = false, duplicateHandling = 'rename' } = options
  const filename = path.basename(source)
  const destDir = path.join(outputDir, category)

  try {
    let destPath: string

    const initialDest = path.join(destDir, filename)

    if (await fs.pathExists(initialDest)) {
      switch (duplicateHandling) {
        case 'skip':
          return {
            source,
            destination: initialDest,
            skipped: true,
          }
        case 'overwrite':
          destPath = initialDest
          break
        case 'rename':
        default:
          destPath = getUniqueFilename(destDir, filename)
          break
      }
    } else {
      destPath = initialDest
    }

    if (move) {
      await fs.move(source, destPath, { overwrite: duplicateHandling === 'overwrite' })
    } else {
      await fs.copy(source, destPath, { overwrite: duplicateHandling === 'overwrite' })
    }

    return {
      source,
      destination: destPath,
      skipped: false,
    }
  } catch (error) {
    return {
      source,
      destination: '',
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export interface BatchCopyOptions {
  move?: boolean
  duplicateHandling?: DuplicateHandling
  onProgress?: (completed: number, total: number) => void
}

export async function copyFiles(
  files: Array<{ source: string; category: string }>,
  outputDir: string,
  options: BatchCopyOptions = {}
): Promise<CopyResult[]> {
  const { move = false, duplicateHandling = 'rename', onProgress } = options
  const results: CopyResult[] = []
  const total = files.length

  for (let i = 0; i < files.length; i++) {
    const { source, category } = files[i]
    const result = await copyFile(source, outputDir, category, {
      move,
      duplicateHandling,
    })
    results.push(result)

    if (onProgress) {
      onProgress(i + 1, total)
    }
  }

  return results
}
