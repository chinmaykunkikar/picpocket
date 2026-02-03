export interface ClassifyRequest {
  command: 'classify'
  config: {
    model: string
    threshold: number
    topK: number
    categories: Record<string, string[]>
  }
  images: string[]
}

export interface CheckRequest {
  command: 'check'
}

export type PythonRequest = ClassifyRequest | CheckRequest

export interface ClassifyResult {
  path: string
  category: string
  confidence: number
  scores: Record<string, number>
}

export interface ClassifyError {
  path: string
  error: string
}

export interface ClassifyResponse {
  status: 'success' | 'error'
  device?: string
  results?: ClassifyResult[]
  errors?: ClassifyError[]
  error?: string
}

export interface ProgressMessage {
  type: 'progress'
  current: number
  total: number
}

export interface StatusMessage {
  type: 'status'
  message: string
}

export interface CheckResponse {
  status: 'success' | 'error'
  checks?: {
    torch: boolean
    transformers: boolean
    pillow: boolean
    device: string
    torch_version?: string
    transformers_version?: string
    pillow_version?: string
  }
  error?: string
}

export type PythonMessage = ClassifyResponse | CheckResponse | ProgressMessage | StatusMessage

export type ProgressCallback = (current: number, total: number) => void
export type StatusCallback = (message: string) => void
