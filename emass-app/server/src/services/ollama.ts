import { existsSync } from 'fs'

// node-llama-cpp is ESM with top-level await — must be loaded via dynamic import
async function getLlamaCpp() {
  return import('node-llama-cpp') as Promise<typeof import('node-llama-cpp')>
}

let modelInstance: Awaited<ReturnType<Awaited<ReturnType<typeof getLlamaCpp>>['getLlama']>>['loadModel'] extends (...a: any[]) => Promise<infer T> ? T : never | null = null as any
let llamaInstance: any = null

export function getModelPath(): string {
  return process.env.MODEL_PATH ?? ''
}

export async function preloadModel(): Promise<void> {
  const modelPath = getModelPath()
  if (!modelPath || !existsSync(modelPath)) {
    console.warn(`[AI] MODEL_PATH not set or file not found — AI suggestions unavailable`)
    return
  }
  try {
    console.log(`[AI] Loading model: ${modelPath}`)
    const { getLlama } = await getLlamaCpp()
    if (!llamaInstance) llamaInstance = await getLlama()
    modelInstance = await llamaInstance.loadModel({ modelPath })
    console.log(`[AI] Model loaded successfully`)
  } catch (err: any) {
    console.error(`[AI] Failed to load model: ${err.message}`)
  }
}

async function ensureModel(): Promise<any> {
  if (modelInstance) return modelInstance

  const modelPath = getModelPath()
  if (!modelPath || !existsSync(modelPath)) {
    throw new Error(
      `Model file not found at: ${modelPath || '(MODEL_PATH not set in server/.env)'}. ` +
      `Download a GGUF model file and set MODEL_PATH=C:\\path\\to\\model.gguf in server/.env`
    )
  }

  const { getLlama } = await getLlamaCpp()
  if (!llamaInstance) llamaInstance = await getLlama()
  modelInstance = await llamaInstance.loadModel({ modelPath })
  return modelInstance
}

export async function isModelReady(): Promise<boolean> {
  const modelPath = getModelPath()
  return !!(modelPath && existsSync(modelPath))
}

export async function streamGenerate(
  prompt: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const { LlamaCompletion } = await getLlamaCpp()
  const model = await ensureModel()
  const context = await model.createContext()

  try {
    const completion = new LlamaCompletion({
      contextSequence: context.getSequence(),
    })
    await completion.generateCompletion(prompt, {
      onTextChunk: onToken,
      signal,
      maxTokens: 1024,
      temperature: 0.7,
      repeatPenalty: {
        lastTokens: 128,
        penalty: 1.15,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1,
      },
      dryRepeatPenalty: {
        strength: 0.8,
        base: 1.75,
        allowedLength: 2,
      },
    })
  } finally {
    await context.dispose()
  }
}
