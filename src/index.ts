#!/usr/bin/env node

import { program } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import * as fs from 'fs-extra'
import { classifyCommand } from './commands/classify.js'
import {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  getDefaultConfigPath,
  generateDefaultConfigYaml,
} from './config/loader.js'
import { checkPythonInstallation } from './classifier/bridge.js'
import {
  setupEnvironment,
  cleanupEnvironment,
  getEnvironmentInfo,
  isDependenciesInstalled,
  isUvInstalled,
  formatBytes,
} from './environment/manager.js'
import { getAppPaths, getPathsDescription } from './environment/paths.js'
import { RECOMMENDED_MODELS, DEFAULT_MODEL, isRecommendedModel, getModelById } from './config/models.js'
import { runSetupWizard, applyWizardResult, printConfigSummary } from './commands/wizard.js'
import {
  handleClassifyError,
  handleSetupError,
  handleNoEnvironmentError,
  handleNoUvError,
  showQuickHelp,
} from './utils/errors.js'

const VERSION = '1.0.0'

function showWelcome(): void {
  console.log('')
  console.log(chalk.bold('picpocket') + chalk.dim(' — classify images using CLIP'))
  console.log('')
  console.log(chalk.bold('Usage:'))
  console.log(`  ${chalk.cyan('picpocket <input-dir>')}         Classify images in a directory`)
  console.log(`  ${chalk.cyan('picpocket <input> <output>')}    Specify output directory`)
  console.log('')
  console.log(chalk.bold('Examples:'))
  console.log(chalk.dim('  picpocket ~/Downloads/Photos'))
  console.log(chalk.dim('  picpocket ~/Photos ~/Sorted --dry-run'))
  console.log(chalk.dim('  picpocket ./images --verbose --limit 50'))
  console.log('')
  console.log(chalk.bold('Get started:'))
  console.log(`  ${chalk.cyan('picpocket setup')}      Set up Python environment (first time)`)
  console.log(`  ${chalk.cyan('picpocket check')}      Verify everything is ready`)
  console.log(`  ${chalk.cyan('picpocket --help')}     See all options`)
  console.log('')
}

async function ensureEnvironment(options: { quiet?: boolean; json?: boolean } = {}): Promise<boolean> {
  const { quiet = false, json = false } = options

  if (await isDependenciesInstalled()) {
    return true
  }

  if (!await isUvInstalled()) {
    if (!quiet && !json) {
      handleNoUvError()
    }
    return false
  }

  // Environment not set up - prompt user to run setup
  if (!quiet && !json) {
    handleNoEnvironmentError()
  }
  return false
}

// Check if running with no arguments (just "picpocket")
const args = process.argv.slice(2)
const hasCommand = args.length > 0 && !args[0].startsWith('-')
const hasHelpFlag = args.includes('-h') || args.includes('--help')
const hasVersionFlag = args.includes('-V') || args.includes('--version')

if (args.length === 0) {
  showWelcome()
  process.exit(0)
}

program
  .name('picpocket')
  .description('Classify images using CLIP')
  .version(VERSION)
  .exitOverride((err) => {
    // Let version and help exit cleanly
    if (err.code === 'commander.version' || err.code === 'commander.helpDisplayed') {
      process.exit(0)
    }
    // Show friendly welcome for missing arguments
    if (err.code === 'commander.missingArgument') {
      showWelcome()
      process.exit(0)
    }
    throw err
  })

program
  .argument('<input-dir>', 'Directory containing images to classify')
  .argument('[output-dir]', 'Output directory for classified images')
  .option('-c, --config <path>', 'Custom config file path')
  .option('-m, --move', 'Move files instead of copying')
  .option('-t, --threshold <number>', 'Confidence threshold (0-1)', parseFloat)
  .option('-n, --dry-run', 'Preview without copying files')
  .option('-j, --json', 'Output results as JSON')
  .option('-l, --limit <number>', 'Process only first N images', parseInt)
  .option('-v, --verbose', 'Show per-image classification scores')
  .option('-q, --quiet', 'Suppress progress output')
  .option('--no-auto-setup', 'Disable automatic environment setup')
  .action(async (inputDir: string, outputDir: string | undefined, options) => {
    try {
      // Check environment first
      if (options.autoSetup !== false) {
        const ready = await ensureEnvironment({ quiet: options.quiet, json: options.json })
        if (!ready) {
          process.exit(1)
        }
      }

      await classifyCommand(inputDir, outputDir, options)
    } catch (error) {
      if (options.json) {
        console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
      } else if (!options.quiet) {
        handleClassifyError(error instanceof Error ? error : new Error(String(error)), inputDir)
        showQuickHelp()
      }
      process.exit(1)
    }
  })

program
  .command('setup')
  .description('Set up Python environment and configure settings')
  .option('-f, --force', 'Force reinstall Python environment')
  .option('-m, --model <model>', 'CLIP model (skip wizard for this setting)')
  .option('-y, --yes', 'Skip wizard, use defaults or existing config')
  .action(async (options) => {
    const spinner = ora()
    const paths = getAppPaths()
    const envInfo = await getEnvironmentInfo()

    // Run wizard unless --yes or --model is provided
    let wizardResult = null
    if (!options.yes && !options.model) {
      wizardResult = await runSetupWizard({
        reconfigure: envInfo.dependenciesInstalled,
      })

      if (wizardResult.cancelled) {
        console.log('')
        console.log(chalk.yellow('Setup cancelled.'))
        process.exit(0)
      }

      printConfigSummary(wizardResult)

      // Confirm
      const prompts = (await import('prompts')).default
      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Apply these settings?',
        initial: true,
      })

      if (!confirm) {
        console.log(chalk.yellow('Setup cancelled.'))
        process.exit(0)
      }
    }

    console.log('')

    // Set up Python environment
    try {
      spinner.start('Setting up Python environment...')

      await setupEnvironment({
        force: options.force,
        onStatus: (msg) => {
          spinner.text = msg
        },
      })

      spinner.succeed('Python environment ready')
    } catch (error) {
      spinner.fail('Python setup failed')
      handleSetupError(error instanceof Error ? error : new Error(String(error)))
      process.exit(1)
    }

    // Apply configuration
    if (wizardResult) {
      await applyWizardResult(wizardResult)
      console.log(chalk.dim(`Config saved to: ${paths.configFile}`))
    } else if (options.model) {
      // Just update the model
      const config = await loadConfig()
      const updatedConfig = {
        ...config,
        classification: {
          ...config.classification,
          model: options.model,
        },
      }
      await saveConfig(updatedConfig)
      console.log(chalk.dim(`Model set to: ${options.model}`))
    }

    console.log('')
    console.log(chalk.bold('Paths:'))
    console.log(chalk.dim(`  Venv:   ${paths.venv}`))
    console.log(chalk.dim(`  Config: ${paths.configFile}`))
    console.log('')
    console.log(chalk.green('Ready! Run: picpocket <input-dir>'))
  })

program
  .command('configure')
  .alias('config-wizard')
  .description('Reconfigure settings (interactive wizard)')
  .action(async () => {
    const paths = getAppPaths()

    const wizardResult = await runSetupWizard({ reconfigure: true })

    if (wizardResult.cancelled) {
      console.log('')
      console.log(chalk.yellow('Configuration cancelled.'))
      process.exit(0)
    }

    printConfigSummary(wizardResult)

    // Confirm
    const prompts = (await import('prompts')).default
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Save these settings?',
      initial: true,
    })

    if (!confirm) {
      console.log(chalk.yellow('Configuration cancelled.'))
      process.exit(0)
    }

    await applyWizardResult(wizardResult)
    console.log('')
    console.log(chalk.green(`Settings saved to: ${paths.configFile}`))
  })

program
  .command('cleanup')
  .description('Remove picpocket data to free disk space')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('--venv', 'Remove only the virtual environment (~2GB)')
  .option('--config', 'Remove only the config file')
  .option('--cache', 'Remove only the cache directory')
  .option('--all', 'Remove everything (venv, config, cache)')
  .action(async (options) => {
    const envInfo = await getEnvironmentInfo()
    const paths = envInfo.paths

    // Determine what will be removed
    const removeVenv = options.all || options.venv || (!options.config && !options.cache)
    const removeConfig = options.all || options.config
    const removeCache = options.all || options.cache

    // Check if there's anything to remove
    const hasVenv = envInfo.venvExists
    const hasConfig = await fs.pathExists(paths.configFile)
    const hasCache = await fs.pathExists(paths.cache)

    if (!hasVenv && !hasConfig && !hasCache) {
      console.log(chalk.yellow('Nothing to clean up.'))
      return
    }

    // Show what will be removed
    console.log('')
    console.log(chalk.bold('The following will be removed:'))
    console.log('')

    let totalSize = 0

    if (removeVenv && hasVenv) {
      const size = envInfo.venvSize || 0
      totalSize += size
      console.log(`  ${chalk.red('×')} Virtual environment: ${paths.venv}`)
      console.log(chalk.dim(`    Size: ${formatBytes(size)}`))
    }

    if (removeConfig && hasConfig) {
      const stat = await fs.stat(paths.configFile)
      totalSize += stat.size
      console.log(`  ${chalk.red('×')} Config file: ${paths.configFile}`)
    }

    if (removeCache && hasCache) {
      const size = envInfo.cacheSize || 0
      totalSize += size
      console.log(`  ${chalk.red('×')} Cache: ${paths.cache}`)
      if (size > 0) {
        console.log(chalk.dim(`    Size: ${formatBytes(size)}`))
      }
    }

    console.log('')
    console.log(chalk.bold(`Total space to free: ${formatBytes(totalSize)}`))
    console.log('')

    if (!options.yes) {
      console.log('Run with --yes to confirm:')
      console.log(chalk.dim(`  picpocket cleanup --yes${options.all ? ' --all' : ''}${options.venv ? ' --venv' : ''}${options.config ? ' --config' : ''}${options.cache ? ' --cache' : ''}`))
      return
    }

    const spinner = ora()

    try {
      const result = await cleanupEnvironment({
        venv: options.venv,
        config: options.config,
        cache: options.cache,
        all: options.all,
        onStatus: (msg) => {
          spinner.text = msg
          if (!spinner.isSpinning) spinner.start()
        },
      })

      spinner.succeed('Cleanup complete')
      console.log('')

      const removed: string[] = []
      if (result.venvRemoved) removed.push('virtual environment')
      if (result.configRemoved) removed.push('config')
      if (result.cacheRemoved) removed.push('cache')

      if (removed.length > 0) {
        console.log(`Removed: ${removed.join(', ')}`)
        console.log(`Freed: ${formatBytes(result.bytesFreed)}`)
      }
    } catch (error) {
      spinner.fail('Cleanup failed')
      console.error(chalk.red(error instanceof Error ? error.message : String(error)))
      process.exit(1)
    }
  })

program
  .command('init')
  .description('Create a default config file')
  .option('-f, --force', 'Overwrite existing config file')
  .option('-o, --output <path>', 'Custom output path for config file')
  .action(async (options) => {
    const configPath = options.output || getDefaultConfigPath()
    const spinner = ora()

    try {
      if (await fs.pathExists(configPath) && !options.force) {
        console.error(chalk.yellow(`Config file already exists at ${configPath}`))
        console.error(chalk.dim('Use --force to overwrite'))
        process.exit(1)
      }

      spinner.start('Creating config file...')
      const config = getDefaultConfig()
      await saveConfig(config, configPath)
      spinner.succeed(`Config file created at ${configPath}`)

      console.log('')
      console.log(chalk.dim('Edit this file to customize categories and settings.'))
    } catch (error) {
      spinner.fail('Failed to create config file')
      console.error(chalk.red(error instanceof Error ? error.message : String(error)))
      process.exit(1)
    }
  })

program
  .command('check')
  .description('Show environment status and verify installation')
  .action(async () => {
    console.log('')
    console.log(chalk.bold('picpocket environment'))
    console.log('')

    const envInfo = await getEnvironmentInfo()

    // Package manager
    console.log(chalk.bold('Package Manager:'))
    if (envInfo.uvInstalled) {
      console.log(`  uv: ${chalk.green('installed')} ${chalk.dim(envInfo.uvVersion || '')}`)
    } else {
      console.log(`  uv: ${chalk.red('not installed')}`)
      console.log(chalk.dim('      Install: curl -LsSf https://astral.sh/uv/install.sh | sh'))
    }
    console.log('')

    // Paths
    console.log(chalk.bold('Paths:'))
    console.log(`  Config: ${chalk.dim(envInfo.paths.configFile)}`)
    console.log(`  Data:   ${chalk.dim(envInfo.paths.data)}`)
    console.log(`  Cache:  ${chalk.dim(envInfo.paths.cache)}`)
    console.log('')

    // Virtual environment
    console.log(chalk.bold('Virtual Environment:'))
    if (envInfo.venvExists) {
      console.log(`  Status: ${chalk.green('configured')}`)
      console.log(`  Path:   ${chalk.dim(envInfo.paths.venv)}`)
      console.log(`  Python: ${chalk.dim(envInfo.paths.python)}`)
      if (envInfo.venvSize) {
        console.log(`  Size:   ${chalk.dim(formatBytes(envInfo.venvSize))}`)
      }
    } else {
      console.log(`  Status: ${chalk.yellow('not set up')}`)
      console.log(chalk.dim('          Run: picpocket setup'))
    }
    console.log('')

    // Legacy paths warning
    if (envInfo.legacyPathsExist) {
      console.log(chalk.yellow('⚠ Legacy paths detected (~/.picpocket)'))
      console.log(chalk.dim('  Run "picpocket setup" to migrate to standard paths'))
      console.log('')
    }

    // Python dependencies
    if (envInfo.dependenciesInstalled) {
      const spinner = ora('Checking Python dependencies...').start()

      try {
        const response = await checkPythonInstallation()

        if (response.status === 'success' && response.checks) {
          spinner.succeed('Python dependencies OK')
          console.log('')
          console.log(chalk.bold('Dependencies:'))
          console.log(`  PyTorch:       ${response.checks.torch ? chalk.green('OK') : chalk.red('Missing')} ${response.checks.torch_version ? chalk.dim(`(${response.checks.torch_version})`) : ''}`)
          console.log(`  Transformers:  ${response.checks.transformers ? chalk.green('OK') : chalk.red('Missing')} ${response.checks.transformers_version ? chalk.dim(`(${response.checks.transformers_version})`) : ''}`)
          console.log(`  Pillow:        ${response.checks.pillow ? chalk.green('OK') : chalk.red('Missing')} ${response.checks.pillow_version ? chalk.dim(`(${response.checks.pillow_version})`) : ''}`)
          console.log('')
          console.log(chalk.bold('Device:'))
          const deviceLabel = response.checks.device === 'mps'
            ? 'Apple Silicon (MPS)'
            : response.checks.device === 'cuda'
              ? 'NVIDIA GPU (CUDA)'
              : 'CPU'
          console.log(`  ${response.checks.device === 'cpu' ? chalk.yellow(deviceLabel) : chalk.green(deviceLabel)}`)
        } else {
          spinner.fail('Python check failed')
          console.error(chalk.red(response.error || 'Unknown error'))
        }
      } catch (error) {
        spinner.fail('Python check failed')
        console.error(chalk.red(error instanceof Error ? error.message : String(error)))
      }
    } else {
      console.log(chalk.bold('Dependencies:'))
      console.log(chalk.yellow('  Not installed'))
      console.log(chalk.dim('  Run: picpocket setup'))
    }

    console.log('')

    // Overall status
    if (envInfo.uvInstalled && envInfo.dependenciesInstalled) {
      console.log(chalk.green('✓ Ready to classify images'))
    } else if (envInfo.uvInstalled) {
      console.log(chalk.yellow('Run "picpocket setup" to install dependencies'))
    } else {
      console.log(chalk.red('Install uv first, then run "picpocket setup"'))
    }
  })

program
  .command('paths')
  .description('Show where picpocket stores its files')
  .action(() => {
    const paths = getAppPaths()

    console.log('')
    console.log(chalk.bold('picpocket file locations'))
    console.log('')
    console.log(chalk.bold('Config:'))
    console.log(`  ${paths.configFile}`)
    console.log('')
    console.log(chalk.bold('Data (virtual environment):'))
    console.log(`  ${paths.venv}`)
    console.log('')
    console.log(chalk.bold('Cache:'))
    console.log(`  ${paths.cache}`)
    console.log('')

    // Platform-specific notes
    if (process.platform === 'linux') {
      console.log(chalk.dim('Following XDG Base Directory Specification'))
      console.log(chalk.dim('Override with XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_CACHE_HOME'))
    } else if (process.platform === 'darwin') {
      console.log(chalk.dim('Using macOS standard directories'))
      console.log(chalk.dim('Config uses ~/.config for CLI tool compatibility'))
    } else if (process.platform === 'win32') {
      console.log(chalk.dim('Using Windows AppData directories'))
    }
  })

program
  .command('categories')
  .description('List current classification categories')
  .option('-c, --config <path>', 'Custom config file path')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config)

      console.log('')
      console.log(chalk.bold('Classification Categories:'))
      console.log('')

      for (const category of config.categories) {
        console.log(chalk.cyan(`${category.name}`))
        for (const prompt of category.prompts) {
          console.log(chalk.dim(`  - ${prompt}`))
        }
        console.log('')
      }

      console.log(chalk.dim(`Total: ${config.categories.length} categories`))
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)))
      process.exit(1)
    }
  })

program
  .command('config')
  .description('Show default config file contents')
  .action(() => {
    console.log(generateDefaultConfigYaml())
  })

program
  .command('models')
  .description('List recommended CLIP models')
  .action(async () => {
    const config = await loadConfig()
    const currentModel = config.classification.model
    const isCurrentKnown = isRecommendedModel(currentModel)

    console.log('')
    console.log(chalk.bold('Recommended CLIP Models'))
    console.log('')

    for (const model of RECOMMENDED_MODELS) {
      const isCurrent = model.id === currentModel
      const isRecommended = model.recommended

      let prefix = '  '
      if (isCurrent) {
        prefix = chalk.green('► ')
      }

      let suffix = ''
      if (isRecommended) {
        suffix = chalk.yellow(' (recommended)')
      }
      if (isCurrent) {
        suffix += chalk.green(' (current)')
      }

      console.log(`${prefix}${chalk.cyan(model.name)}${suffix}`)
      console.log(`    ${chalk.dim(model.id)}`)
      console.log(`    ${chalk.dim(`Size: ${model.size}`)}`)
      console.log(`    ${model.description}`)
      console.log('')
    }

    // Show current model if it's custom
    if (!isCurrentKnown) {
      console.log(chalk.green(`► Custom model (current)`))
      console.log(`    ${chalk.dim(currentModel)}`)
      console.log('')
    }

    console.log(chalk.bold('Using a different model'))
    console.log('')
    console.log('  Any CLIP model from Hugging Face can be used:')
    console.log(chalk.dim('    picpocket setup --model <huggingface-model-id>'))
    console.log('')
    console.log(chalk.dim('  Examples:'))
    console.log(chalk.dim('    picpocket setup --model openai/clip-vit-base-patch32'))
    console.log(chalk.dim('    picpocket setup --model laion/CLIP-ViT-H-14-laion2B-s32B-b79K'))
  })

program.parse()
