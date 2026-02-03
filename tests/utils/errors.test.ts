import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatError, type ErrorContext } from '../../src/utils/errors.js'

describe('formatError', () => {
  it('should format error message', () => {
    const ctx: ErrorContext = {
      error: 'Something went wrong',
    }
    const output = formatError(ctx)

    expect(output).toContain('Error:')
    expect(output).toContain('Something went wrong')
  })

  it('should accept Error objects', () => {
    const ctx: ErrorContext = {
      error: new Error('Error object message'),
    }
    const output = formatError(ctx)

    expect(output).toContain('Error object message')
  })

  it('should include suggestions when provided', () => {
    const ctx: ErrorContext = {
      error: 'Failed',
      suggestions: [
        'Check your connection',
        'Try again later',
      ],
    }
    const output = formatError(ctx)

    expect(output).toContain('What went wrong:')
    expect(output).toContain('Check your connection')
    expect(output).toContain('Try again later')
  })

  it('should include quick fixes when provided', () => {
    const ctx: ErrorContext = {
      error: 'Failed',
      quickFixes: [
        { label: 'Run setup', command: 'picpocket setup' },
        { label: 'Check status', command: 'picpocket check' },
      ],
    }
    const output = formatError(ctx)

    expect(output).toContain('Try this:')
    expect(output).toContain('picpocket setup')
    expect(output).toContain('Run setup')
    expect(output).toContain('picpocket check')
    expect(output).toContain('Check status')
  })

  it('should include usage hint when showUsage is true', () => {
    const ctx: ErrorContext = {
      error: 'Failed',
      command: 'classify',
      showUsage: true,
    }
    const output = formatError(ctx)

    expect(output).toContain('Usage:')
    expect(output).toContain('picpocket classify --help')
  })

  it('should not include usage when showUsage is false', () => {
    const ctx: ErrorContext = {
      error: 'Failed',
      command: 'classify',
      showUsage: false,
    }
    const output = formatError(ctx)

    expect(output).not.toContain('Usage:')
  })

  it('should handle empty suggestions array', () => {
    const ctx: ErrorContext = {
      error: 'Failed',
      suggestions: [],
    }
    const output = formatError(ctx)

    expect(output).not.toContain('What went wrong:')
  })

  it('should handle empty quickFixes array', () => {
    const ctx: ErrorContext = {
      error: 'Failed',
      quickFixes: [],
    }
    const output = formatError(ctx)

    expect(output).not.toContain('Try this:')
  })
})

describe('error handlers', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('handleSetupError should provide uv installation help', async () => {
    const { handleSetupError } = await import('../../src/utils/errors.js')

    handleSetupError(new Error('uv is not installed'))

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('uv')
    expect(output).toContain('astral.sh')
  })

  it('handleSetupError should provide Python help for Python errors', async () => {
    const { handleSetupError } = await import('../../src/utils/errors.js')

    handleSetupError(new Error('Python environment setup failed'))

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('picpocket check')
  })

  it('handleClassifyError should provide path help for missing directories', async () => {
    const { handleClassifyError } = await import('../../src/utils/errors.js')

    handleClassifyError(new Error('Directory does not exist'), '/path/to/dir')

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('/path/to/dir')
  })

  it('handleClassifyError should provide help for no images found', async () => {
    const { handleClassifyError } = await import('../../src/utils/errors.js')

    handleClassifyError(new Error('No images found'), '/photos')

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('jpg')
  })

  it('handleClassifyError should provide model help for model errors', async () => {
    const { handleClassifyError } = await import('../../src/utils/errors.js')

    handleClassifyError(new Error('Failed to load model from Hugging Face'))

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('model')
  })

  it('handleClassifyError should provide memory help for OOM errors', async () => {
    const { handleClassifyError } = await import('../../src/utils/errors.js')

    handleClassifyError(new Error('Out of memory'))

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('--limit')
  })

  it('handleNoEnvironmentError should suggest setup', async () => {
    const { handleNoEnvironmentError } = await import('../../src/utils/errors.js')

    handleNoEnvironmentError()

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('picpocket setup')
  })

  it('handleNoUvError should provide uv installation instructions', async () => {
    const { handleNoUvError } = await import('../../src/utils/errors.js')

    handleNoUvError()

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('uv')
    expect(output).toContain('astral.sh')
  })
})

describe('showQuickHelp', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('should show available commands', async () => {
    const { showQuickHelp } = await import('../../src/utils/errors.js')

    showQuickHelp()

    expect(consoleLogSpy).toHaveBeenCalled()
    const allOutput = consoleLogSpy.mock.calls.map(c => c[0]).join('\n')

    expect(allOutput).toContain('picpocket setup')
    expect(allOutput).toContain('picpocket check')
    expect(allOutput).toContain('picpocket configure')
    expect(allOutput).toContain('picpocket cleanup')
  })
})
