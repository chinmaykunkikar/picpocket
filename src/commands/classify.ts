import chalk from 'chalk'
import ora from 'ora'
import * as path from 'path'
import * as fs from 'fs-extra'
import { loadConfig, categoriesToMap } from '../config/loader.js'
import { scanForImages } from '../files/scanner.js'
import { ensureCategoryDirs, copyFiles, type CopyResult } from '../files/copier.js'
import { classifyImages } from '../classifier/bridge.js'
import type { ClassifyResult, ClassifyResponse } from '../classifier/types.js'

export interface ClassifyOptions {
  config?: string
  move?: boolean
  threshold?: number
  dryRun?: boolean
  json?: boolean
  limit?: number
  verbose?: boolean
  quiet?: boolean
}

interface ClassificationSummary {
  totalImages: number
  processed: number
  categoryCounts: Record<string, number>
  reviewCount: number
  failedCount: number
  skippedCount: number
  errors: Array<{ path: string; error: string }>
}

function formatSummary(summary: ClassificationSummary, outputDir: string): string {
  const lines: string[] = [
    '',
    chalk.bold('═'.repeat(60)),
    chalk.bold('CLASSIFICATION SUMMARY'),
    chalk.bold('═'.repeat(60)),
    '',
    `Total images found: ${summary.totalImages}`,
    `Images processed:   ${summary.processed}`,
    `Failed to process:  ${summary.failedCount}`,
    `Skipped (duplicate): ${summary.skippedCount}`,
    '',
    `Output directory: ${outputDir}`,
    '',
    chalk.bold('Category breakdown:'),
    chalk.dim('─'.repeat(40)),
  ]

  const sortedCategories = Object.entries(summary.categoryCounts)
    .sort(([, a], [, b]) => b - a)

  for (const [category, count] of sortedCategories) {
    const pct = summary.processed > 0 ? ((count / summary.processed) * 100).toFixed(1) : '0.0'
    lines.push(`  ${category.padEnd(15)} : ${count.toString().padStart(6)} (${pct.padStart(5)}%)`)
  }

  if (summary.reviewCount > 0) {
    const pct = summary.processed > 0 ? ((summary.reviewCount / summary.processed) * 100).toFixed(1) : '0.0'
    lines.push(`  ${'Review'.padEnd(15)} : ${summary.reviewCount.toString().padStart(6)} (${pct.padStart(5)}%)`)
  }

  lines.push(chalk.dim('─'.repeat(40)))
  const total = Object.values(summary.categoryCounts).reduce((a, b) => a + b, 0) + summary.reviewCount
  lines.push(`  ${'TOTAL'.padEnd(15)} : ${total.toString().padStart(6)}`)
  lines.push('')

  if (summary.errors.length > 0) {
    lines.push(chalk.yellow(`\nFailed images (${summary.errors.length}):`))
    const displayed = summary.errors.slice(0, 10)
    for (const { path: p, error } of displayed) {
      lines.push(chalk.dim(`  - ${path.basename(p)}: ${error}`))
    }
    if (summary.errors.length > 10) {
      lines.push(chalk.dim(`  ... and ${summary.errors.length - 10} more`))
    }
  }

  return lines.join('\n')
}

export async function classifyCommand(
  inputDir: string,
  outputDir: string | undefined,
  options: ClassifyOptions
): Promise<void> {
  const {
    config: configPath,
    move = false,
    threshold,
    dryRun = false,
    json = false,
    limit,
    verbose = false,
    quiet = false,
  } = options

  const log = quiet ? () => {} : (msg: string) => process.stdout.write(msg + '\n')
  const spinner = quiet ? null : ora()

  if (!await fs.pathExists(inputDir)) {
    throw new Error(`Input directory does not exist: ${inputDir}`)
  }

  if (spinner) spinner.start('Loading configuration...')
  const config = await loadConfig(configPath)
  if (spinner) spinner.succeed('Configuration loaded')

  const effectiveThreshold = threshold ?? config.classification.threshold
  const effectiveMode = move ? 'move' : config.output.mode

  const resolvedOutputDir = outputDir || path.join(inputDir, 'classified')

  if (!json && !quiet) {
    log('')
    log(chalk.bold('picpocket'))
    log(chalk.dim('═'.repeat(60)))
    log(`Input:     ${inputDir}`)
    log(`Output:    ${resolvedOutputDir}`)
    log(`Mode:      ${effectiveMode}`)
    log(`Model:     ${config.classification.model}`)
    if (effectiveThreshold > 0) {
      log(`Threshold: ${effectiveThreshold}`)
    }
    if (limit) {
      log(`Limit:     ${limit} images`)
    }
    if (dryRun) {
      log(chalk.yellow('DRY RUN - no files will be copied'))
    }
    log(chalk.dim('═'.repeat(60)))
    log('')
  }

  if (spinner) spinner.start('Scanning for images...')
  const images = await scanForImages(inputDir, {
    includeSubdirs: true,
    limit,
  })
  if (spinner) spinner.succeed(`Found ${images.length} images`)

  if (images.length === 0) {
    log('')
    log(chalk.yellow('No images found in the input directory.'))
    log('')
    log(chalk.dim('Supported formats: jpg, jpeg, png, gif, webp, bmp, heic'))
    log(chalk.dim('Subdirectories are included by default.'))
    log('')
    log(chalk.dim(`Searched in: ${inputDir}`))
    return
  }

  const categories = config.categories.map((c) => c.name)
  const categoryMap = categoriesToMap(config.categories)

  if (!dryRun) {
    if (spinner) spinner.start('Creating output directories...')
    await ensureCategoryDirs(resolvedOutputDir, categories, effectiveThreshold > 0)
    if (spinner) spinner.succeed('Output directories created')
  }

  if (spinner) spinner.start('Classifying images...')

  const classifyResponse = await classifyImages(
    images,
    {
      model: config.classification.model,
      threshold: effectiveThreshold,
      topK: config.classification.topK,
      categories: categoryMap,
    },
    {
      onProgress: (current, total) => {
        if (spinner) {
          spinner.text = `Classifying images... ${current}/${total}`
        }
      },
      onStatus: (message) => {
        if (spinner) {
          spinner.text = message
        }
      },
    }
  )

  if (classifyResponse.status === 'error') {
    if (spinner) spinner.fail('Classification failed')
    throw new Error(classifyResponse.error || 'Unknown classification error')
  }

  if (spinner) spinner.succeed('Classification complete')

  const results = classifyResponse.results || []
  const classifyErrors = classifyResponse.errors || []

  const filesToCopy = results.map((r) => ({
    source: r.path,
    category: effectiveThreshold > 0 && r.confidence < effectiveThreshold ? 'Review' : r.category,
  }))

  let copyResults: CopyResult[] = []

  if (!dryRun && filesToCopy.length > 0) {
    if (spinner) spinner.start('Copying files...')

    copyResults = await copyFiles(filesToCopy, resolvedOutputDir, {
      move: effectiveMode === 'move',
      duplicateHandling: config.output.duplicateHandling,
      onProgress: (completed, total) => {
        if (spinner) {
          spinner.text = `${effectiveMode === 'move' ? 'Moving' : 'Copying'} files... ${completed}/${total}`
        }
      },
    })

    if (spinner) spinner.succeed('Files copied')
  }

  const summary = buildSummary(results, copyResults, classifyErrors, effectiveThreshold, images.length)

  if (json) {
    const jsonOutput = {
      summary,
      results: verbose ? results.map((r) => ({
        ...r,
        finalCategory: effectiveThreshold > 0 && r.confidence < effectiveThreshold ? 'Review' : r.category,
      })) : undefined,
      dryRun,
    }
    process.stdout.write(JSON.stringify(jsonOutput, null, 2) + '\n')
  } else {
    log(formatSummary(summary, resolvedOutputDir))

    if (verbose && results.length > 0) {
      log('')
      log(chalk.bold('Per-image results:'))
      log(chalk.dim('─'.repeat(60)))
      for (const r of results.slice(0, 50)) {
        const finalCat = effectiveThreshold > 0 && r.confidence < effectiveThreshold ? 'Review' : r.category
        log(`  ${path.basename(r.path).padEnd(30)} → ${finalCat} (${(r.confidence * 100).toFixed(1)}%)`)
      }
      if (results.length > 50) {
        log(chalk.dim(`  ... and ${results.length - 50} more`))
      }
    }
  }
}

function buildSummary(
  results: ClassifyResult[],
  copyResults: CopyResult[],
  classifyErrors: Array<{ path: string; error: string }>,
  threshold: number,
  totalImages: number
): ClassificationSummary {
  const categoryCounts: Record<string, number> = {}
  let reviewCount = 0

  for (const r of results) {
    if (threshold > 0 && r.confidence < threshold) {
      reviewCount++
    } else {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1
    }
  }

  const copyErrors = copyResults
    .filter((r) => r.error)
    .map((r) => ({ path: r.source, error: r.error! }))

  const skippedCount = copyResults.filter((r) => r.skipped).length

  return {
    totalImages,
    processed: results.length,
    categoryCounts,
    reviewCount,
    failedCount: classifyErrors.length + copyErrors.length,
    skippedCount,
    errors: [...classifyErrors, ...copyErrors],
  }
}
