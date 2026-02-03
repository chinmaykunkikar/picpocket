import prompts from 'prompts'
import chalk from 'chalk'
import { RECOMMENDED_MODELS, DEFAULT_MODEL, isRecommendedModel } from '../config/models.js'
import { loadConfig, saveConfig, getDefaultConfig } from '../config/loader.js'
import { getAppPaths } from '../environment/paths.js'
import type { Config } from '../config/schema.js'

export interface WizardResult {
  model: string
  outputMode: 'copy' | 'move'
  threshold: number
  topK: number
  duplicateHandling: 'rename' | 'skip' | 'overwrite'
  cancelled: boolean
}

export async function runSetupWizard(options: {
  reconfigure?: boolean
} = {}): Promise<WizardResult> {
  const { reconfigure = false } = options

  // Load existing config or defaults
  const existingConfig = await loadConfig()
  const paths = getAppPaths()

  console.log('')
  console.log(chalk.bold('┌─────────────────────────────────────────────┐'))
  console.log(chalk.bold('│         picpocket Setup Wizard            │'))
  console.log(chalk.bold('└─────────────────────────────────────────────┘'))
  console.log('')

  if (reconfigure) {
    console.log(chalk.dim('Current config: ' + paths.configFile))
    console.log(chalk.dim('Press Enter to keep current value, or enter a new one.'))
  } else {
    console.log(chalk.dim('Configure your image classification settings.'))
    console.log(chalk.dim('Press Ctrl+C to cancel at any time.'))
  }
  console.log('')

  // Build model choices
  const modelChoices = RECOMMENDED_MODELS.map(m => ({
    title: `${m.name}${m.recommended ? chalk.yellow(' (recommended)') : ''} - ${m.description}`,
    value: m.id,
  }))
  modelChoices.push({
    title: chalk.cyan('Custom model') + ' - Enter a Hugging Face model ID',
    value: '__custom__',
  })

  // Find initial model index
  let initialModelIndex = RECOMMENDED_MODELS.findIndex(m => m.id === existingConfig.classification.model)
  if (initialModelIndex === -1) {
    initialModelIndex = modelChoices.length - 1 // Custom
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'modelChoice',
      message: 'CLIP model',
      choices: modelChoices,
      initial: initialModelIndex,
    },
    {
      type: (prev) => prev === '__custom__' ? 'text' : null,
      name: 'customModel',
      message: 'Hugging Face model ID',
      initial: isRecommendedModel(existingConfig.classification.model)
        ? 'laion/CLIP-ViT-H-14-laion2B-s32B-b79K'
        : existingConfig.classification.model,
      validate: (value: string) => value.includes('/') ? true : 'Model ID should be in format: owner/model-name',
    },
    {
      type: 'select',
      name: 'outputMode',
      message: 'Default file operation',
      choices: [
        { title: 'Copy files ' + chalk.dim('(keep originals)'), value: 'copy' },
        { title: 'Move files ' + chalk.dim('(delete originals)'), value: 'move' },
      ],
      initial: existingConfig.output.mode === 'move' ? 1 : 0,
    },
    {
      type: 'select',
      name: 'threshold',
      message: 'Confidence threshold',
      choices: [
        { title: 'None ' + chalk.dim('(classify all images)'), value: 0 },
        { title: '50% ' + chalk.dim('(low confidence → Review/)'), value: 0.5 },
        { title: '70% ' + chalk.dim('(medium confidence → Review/)'), value: 0.7 },
        { title: '85% ' + chalk.dim('(high confidence → Review/)'), value: 0.85 },
        { title: 'Custom', value: -1 },
      ],
      initial: existingConfig.classification.threshold === 0 ? 0 :
               existingConfig.classification.threshold === 0.5 ? 1 :
               existingConfig.classification.threshold === 0.7 ? 2 :
               existingConfig.classification.threshold === 0.85 ? 3 : 4,
    },
    {
      type: (prev) => prev === -1 ? 'number' : null,
      name: 'customThreshold',
      message: 'Custom threshold (0.0 - 1.0)',
      initial: existingConfig.classification.threshold,
      min: 0,
      max: 1,
      float: true,
    },
    {
      type: 'select',
      name: 'duplicateHandling',
      message: 'Handle duplicate filenames',
      choices: [
        { title: 'Rename ' + chalk.dim('(add _1, _2, etc.)'), value: 'rename' },
        { title: 'Skip ' + chalk.dim('(keep existing)'), value: 'skip' },
        { title: 'Overwrite ' + chalk.dim('(replace existing)'), value: 'overwrite' },
      ],
      initial: existingConfig.output.duplicateHandling === 'skip' ? 1 :
               existingConfig.output.duplicateHandling === 'overwrite' ? 2 : 0,
    },
    {
      type: 'select',
      name: 'topK',
      message: 'Ensemble scoring (prompts per category)',
      choices: [
        { title: 'Top 1 ' + chalk.dim('(fastest)'), value: 1 },
        { title: 'Top 3 ' + chalk.dim('(recommended)'), value: 3 },
        { title: 'Top 5 ' + chalk.dim('(most accurate)'), value: 5 },
      ],
      initial: existingConfig.classification.topK === 1 ? 0 :
               existingConfig.classification.topK === 5 ? 2 : 1,
    },
  ], {
    onCancel: () => {
      return false
    }
  })

  // Check if cancelled
  if (response.modelChoice === undefined) {
    return {
      model: existingConfig.classification.model,
      outputMode: existingConfig.output.mode,
      threshold: existingConfig.classification.threshold,
      topK: existingConfig.classification.topK,
      duplicateHandling: existingConfig.output.duplicateHandling,
      cancelled: true,
    }
  }

  const model = response.modelChoice === '__custom__'
    ? response.customModel
    : response.modelChoice

  const threshold = response.threshold === -1
    ? response.customThreshold
    : response.threshold

  return {
    model,
    outputMode: response.outputMode,
    threshold,
    topK: response.topK,
    duplicateHandling: response.duplicateHandling,
    cancelled: false,
  }
}

export async function applyWizardResult(result: WizardResult): Promise<Config> {
  const config = await loadConfig()

  const updatedConfig: Config = {
    ...config,
    classification: {
      ...config.classification,
      model: result.model,
      threshold: result.threshold,
      topK: result.topK,
    },
    output: {
      ...config.output,
      mode: result.outputMode,
      duplicateHandling: result.duplicateHandling,
    },
  }

  await saveConfig(updatedConfig)
  return updatedConfig
}

export function printConfigSummary(result: WizardResult): void {
  const modelInfo = RECOMMENDED_MODELS.find(m => m.id === result.model)

  console.log('')
  console.log(chalk.bold('Configuration Summary'))
  console.log(chalk.dim('─'.repeat(40)))
  console.log(`  Model:       ${chalk.cyan(modelInfo?.name || result.model)}`)
  console.log(`  Output mode: ${result.outputMode}`)
  console.log(`  Threshold:   ${result.threshold === 0 ? 'None' : `${(result.threshold * 100).toFixed(0)}%`}`)
  console.log(`  Duplicates:  ${result.duplicateHandling}`)
  console.log(`  Top-K:       ${result.topK}`)
  console.log(chalk.dim('─'.repeat(40)))
}
