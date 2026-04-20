import { useState, useRef } from 'react'
import { Sparkles, X, Check, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'

interface AISuggestProps {
  systemId: string
  controlId: string
  controlTitle: string
  controlStatement: string
  supplementalGuidance?: string
  currentStatement?: string
  onAccept: (html: string) => void
}

type Status = 'idle' | 'loading' | 'streaming' | 'done' | 'error'

export default function AISuggest({
  systemId,
  controlId,
  controlTitle,
  controlStatement,
  supplementalGuidance,
  currentStatement,
  onAccept,
}: AISuggestProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const token = useAuthStore((s) => s.token)

  async function generate() {
    setStatus('loading')
    setText('')
    setError('')
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          systemId,
          controlId,
          controlTitle,
          controlStatement,
          supplementalGuidance,
          currentStatement,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to reach AI service')
      }

      setStatus('streaming')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.token) setText((prev) => prev + data.token)
              if (data.done) setStatus('done')
            } catch {
              // skip malformed chunk
            }
          } else if (line.startsWith('event: error')) {
            // error data comes on next line — handled above via data: parse
          }
        }
      }

      setStatus((s) => (s === 'streaming' ? 'done' : s))
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message ?? 'Unknown error')
      setStatus('error')
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setStatus('idle')
    setText('')
  }

  function accept() {
    // Convert plain text to HTML paragraphs for TipTap
    const html = text
      .split(/\n{2,}/)
      .filter((p) => p.trim())
      .map((p) => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
      .join('')
    onAccept(html)
    setStatus('idle')
    setText('')
  }

  const isActive = status !== 'idle' && status !== 'error'

  return (
    <div className="mb-3">
      {status === 'idle' && (
        <button
          onClick={generate}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Suggest Implementation
        </button>
      )}

      {isActive && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-purple-300">AI Suggestion</span>
              {status === 'loading' && (
                <span className="text-[10px] text-slate-500 animate-pulse">connecting to Ollama...</span>
              )}
              {status === 'streaming' && (
                <span className="text-[10px] text-slate-500 animate-pulse">generating...</span>
              )}
              {status === 'done' && (
                <span className="text-[10px] text-teal-500">done — review and accept or discard</span>
              )}
            </div>
            <button
              onClick={cancel}
              className="text-slate-600 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-3 py-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap min-h-[80px] max-h-[320px] overflow-y-auto font-sans">
            {status === 'loading' && (
              <span className="text-slate-500 text-xs">Waiting for model response...</span>
            )}
            {text}
            {status === 'streaming' && (
              <span className="inline-block w-1.5 h-3.5 bg-purple-400 animate-pulse ml-0.5 align-middle" />
            )}
          </div>

          {/* Actions */}
          {status === 'done' && (
            <div
              className="flex items-center gap-2 px-3 py-2 border-t"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <Button
                variant="primary"
                size="sm"
                icon={<Check className="w-3.5 h-3.5" />}
                onClick={accept}
              >
                Use This
              </Button>
              <Button variant="secondary" size="sm" onClick={cancel}>
                Discard
              </Button>
              <Button variant="ghost" size="sm" onClick={generate}>
                Regenerate
              </Button>
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-300">{error}</p>
            {(error.includes('Ollama') || error.includes('fetch')) && (
              <p className="text-[11px] text-slate-500 mt-1">
                Start Ollama first:{' '}
                <code className="font-mono bg-navy-800 px-1 rounded">ollama serve</code>
                {' '}then pull a model:{' '}
                <code className="font-mono bg-navy-800 px-1 rounded">ollama pull llama3.2</code>
              </p>
            )}
          </div>
          <button
            onClick={() => setStatus('idle')}
            className="text-slate-600 hover:text-slate-300 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
