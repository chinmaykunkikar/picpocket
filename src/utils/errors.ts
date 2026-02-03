import chalk from 'chalk'

export interface ErrorContext {
  error: Error | string
  command?: string
  suggestions?: string[]
  quickFixes?: Array<{ label: string; command: string }>
  showUsage?: boolean
}

export function formatError(ctx: ErrorContext): string {
  const lines: string[] = []
  const errorMessage = ctx.error instanceof Error ? ctx.error.message : ctx.error

  lines.push('')
  lines.push(chalk.red('✖ Error: ') + errorMessage)
  lines.push('')

  if (ctx.suggestions && ctx.suggestions.length > 0) {
    lines.push(chalk.bold('What went wrong:'))
    for (const suggestion of ctx.suggestions) {
      lines.push(chalk.dim(`  • ${suggestion}`))
    }
    lines.push('')
  }

  if (ctx.quickFixes && ctx.quickFixes.length > 0) {
    lines.push(chalk.bold('Try this:'))
    for (const fix of ctx.quickFixes) {
      lines.push(`  ${chalk.cyan(fix.command)}`)
      lines.push(chalk.dim(`    ${fix.label}`))
    }
    lines.push('')
  }

  if (ctx.showUsage && ctx.command) {
    lines.push(chalk.bold('Usage:'))
    lines.push(chalk.dim(`  picpocket ${ctx.command} --help`))
    lines.push('')
  }

  return lines.join('\n')
}

export function printError(ctx: ErrorContext): void {
  console.error(formatError(ctx))
}

// Common error scenarios with helpful suggestions

export function handleSetupError(error: Error): void {
  const message = error.message.toLowerCase()

  if (message.includes('uv') || message.includes('not installed')) {
    printError({
      error,
      suggestions: [
        'uv (Python package manager) is required but not installed',
      ],
      quickFixes: [
        { label: 'Install uv', command: 'curl -LsSf https://astral.sh/uv/install.sh | sh' },
        { label: 'Then run setup again', command: 'picpocket setup' },
      ],
    })
  } else if (message.includes('python')) {
    printError({
      error,
      suggestions: [
        'Python environment setup failed',
        'This might be a network issue or disk space problem',
      ],
      quickFixes: [
        { label: 'Check your setup', command: 'picpocket check' },
        { label: 'Force reinstall', command: 'picpocket setup --force' },
        { label: 'Clean up and retry', command: 'picpocket cleanup --yes && picpocket setup' },
      ],
    })
  } else {
    printError({
      error,
      quickFixes: [
        { label: 'Check environment status', command: 'picpocket check' },
        { label: 'Get help', command: 'picpocket --help' },
      ],
    })
  }
}

export function handleClassifyError(error: Error, inputDir?: string): void {
  const message = error.message.toLowerCase()

  if (message.includes('does not exist') || message.includes('no such file')) {
    printError({
      error,
      suggestions: [
        `The directory "${inputDir}" doesn't exist or can't be accessed`,
      ],
      quickFixes: [
        { label: 'Check the path and try again', command: `picpocket "${inputDir || '<input-dir>'}"` },
        { label: 'See usage examples', command: 'picpocket --help' },
      ],
    })
  } else if (message.includes('no images')) {
    printError({
      error,
      suggestions: [
        'No supported images found in the directory',
        'Supported formats: jpg, jpeg, png, gif, webp, bmp, heic',
      ],
      quickFixes: [
        { label: 'Check a different directory', command: 'picpocket <other-directory>' },
        { label: 'Try with subdirectories', command: `ls -la "${inputDir || '.'}"` },
      ],
    })
  } else if (message.includes('python') || message.includes('dependencies')) {
    printError({
      error,
      suggestions: [
        'Python environment may not be set up correctly',
      ],
      quickFixes: [
        { label: 'Check environment', command: 'picpocket check' },
        { label: 'Run setup again', command: 'picpocket setup' },
        { label: 'Force reinstall', command: 'picpocket setup --force' },
      ],
    })
  } else if (message.includes('model') || message.includes('hugging')) {
    printError({
      error,
      suggestions: [
        'Failed to load the CLIP model',
        'This might be a network issue or invalid model name',
      ],
      quickFixes: [
        { label: 'Check current model', command: 'picpocket models' },
        { label: 'Change to a different model', command: 'picpocket configure' },
        { label: 'Use default model', command: 'picpocket setup --model openai/clip-vit-large-patch14' },
      ],
    })
  } else if (message.includes('memory') || message.includes('oom')) {
    printError({
      error,
      suggestions: [
        'Ran out of memory during classification',
        'Try processing fewer images at a time',
      ],
      quickFixes: [
        { label: 'Process in smaller batches', command: `picpocket "${inputDir || '<input>'}" --limit 50` },
        { label: 'Use a smaller model', command: 'picpocket setup --model openai/clip-vit-base-patch32' },
      ],
    })
  } else {
    printError({
      error,
      suggestions: [
        'An unexpected error occurred during classification',
      ],
      quickFixes: [
        { label: 'Check environment', command: 'picpocket check' },
        { label: 'Try with fewer images', command: `picpocket "${inputDir || '<input>'}" --limit 10 --dry-run` },
        { label: 'Reconfigure', command: 'picpocket configure' },
        { label: 'Get help', command: 'picpocket --help' },
      ],
    })
  }
}

export function handleNoEnvironmentError(): void {
  printError({
    error: 'Python environment not set up',
    suggestions: [
      'picpocket needs Python with CLIP to classify images',
      'This is a one-time setup that takes a few minutes',
    ],
    quickFixes: [
      { label: 'Run the setup wizard', command: 'picpocket setup' },
      { label: 'Quick setup with defaults', command: 'picpocket setup --yes' },
    ],
  })
}

export function handleNoUvError(): void {
  printError({
    error: 'uv is not installed',
    suggestions: [
      'picpocket uses uv to manage Python dependencies',
      'uv is a fast Python package manager from Astral',
    ],
    quickFixes: [
      { label: 'Install uv (macOS/Linux)', command: 'curl -LsSf https://astral.sh/uv/install.sh | sh' },
      { label: 'Install uv (Windows)', command: 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"' },
      { label: 'Learn more', command: 'open https://github.com/astral-sh/uv' },
    ],
  })
}

export function showQuickHelp(): void {
  console.log('')
  console.log(chalk.bold('Quick Reference'))
  console.log(chalk.dim('─'.repeat(50)))
  console.log('')
  console.log(chalk.bold('Get started:'))
  console.log(`  ${chalk.cyan('picpocket setup')}         Run setup wizard`)
  console.log(`  ${chalk.cyan('picpocket check')}         Check if everything is ready`)
  console.log('')
  console.log(chalk.bold('Classify images:'))
  console.log(`  ${chalk.cyan('picpocket <dir>')}         Classify images in directory`)
  console.log(`  ${chalk.cyan('picpocket <dir> --dry-run')}  Preview without copying`)
  console.log('')
  console.log(chalk.bold('Configuration:'))
  console.log(`  ${chalk.cyan('picpocket configure')}     Change settings`)
  console.log(`  ${chalk.cyan('picpocket models')}        List available models`)
  console.log(`  ${chalk.cyan('picpocket categories')}    Show classification categories`)
  console.log('')
  console.log(chalk.bold('Maintenance:'))
  console.log(`  ${chalk.cyan('picpocket cleanup')}       Free up disk space`)
  console.log(`  ${chalk.cyan('picpocket paths')}         Show where files are stored`)
  console.log('')
}
