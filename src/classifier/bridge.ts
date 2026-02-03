import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { getVenvPython, isDependenciesInstalled } from '../environment/manager.js'
import type {
  PythonRequest,
  ClassifyResponse,
  CheckResponse,
  PythonMessage,
  ProgressCallback,
  StatusCallback,
} from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getPythonScriptPath(): string {
  const distPath = path.join(__dirname, '..', '..', 'python', 'classifier.py')
  const srcPath = path.join(__dirname, '..', '..', '..', 'python', 'classifier.py')

  if (fs.existsSync(distPath)) {
    return distPath
  }
  return srcPath
}

export async function runPythonClassifier(
  request: PythonRequest,
  options: {
    onProgress?: ProgressCallback
    onStatus?: StatusCallback
    pythonCommand?: string
  } = {}
): Promise<ClassifyResponse | CheckResponse> {
  const { onProgress, onStatus } = options

  // Use venv Python if available, otherwise fall back to provided or system python
  let pythonCommand = options.pythonCommand
  if (!pythonCommand) {
    if (await isDependenciesInstalled()) {
      pythonCommand = getVenvPython()
    } else {
      pythonCommand = 'python3'
    }
  }

  const pythonScriptPath = getPythonScriptPath()

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCommand, [pythonScriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString()
      stdout += chunk

      const lines = stdout.split('\n')
      stdout = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const message: PythonMessage = JSON.parse(line)

          if ('type' in message) {
            if (message.type === 'progress' && onProgress) {
              onProgress(message.current, message.total)
            } else if (message.type === 'status' && onStatus) {
              onStatus(message.message)
            }
          } else if ('status' in message) {
            resolve(message as ClassifyResponse | CheckResponse)
          }
        } catch {
          // Ignore non-JSON output
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (stdout.trim()) {
        try {
          const message = JSON.parse(stdout.trim())
          if ('status' in message) {
            resolve(message as ClassifyResponse | CheckResponse)
            return
          }
        } catch {
          // Ignore
        }
      }

      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`))
    })

    proc.stdin.write(JSON.stringify(request))
    proc.stdin.end()
  })
}

export async function checkPythonInstallation(
  pythonCommand?: string
): Promise<CheckResponse> {
  const request = { command: 'check' as const }
  return runPythonClassifier(request, { pythonCommand }) as Promise<CheckResponse>
}

export async function classifyImages(
  images: string[],
  config: {
    model: string
    threshold: number
    topK: number
    categories: Record<string, string[]>
  },
  options: {
    onProgress?: ProgressCallback
    onStatus?: StatusCallback
    pythonCommand?: string
  } = {}
): Promise<ClassifyResponse> {
  const request = {
    command: 'classify' as const,
    config,
    images,
  }
  return runPythonClassifier(request, options) as Promise<ClassifyResponse>
}
