import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Edit3, RotateCcw, CheckCircle, AlertCircle, Info } from 'lucide-react'
import TipTapEditor from '@/components/editor/TipTapEditor'
import { cn } from '@/lib/cn'

interface DeltaEditorProps {
  controlId: string
  standardText: string        // From DEFAULT_IMPLEMENTATIONS or DB
  tailoredText: string        // Current site-specific override
  onChange: (text: string) => void
  readOnly?: boolean
  className?: string
}

function isTextCustomized(standard: string, tailored: string): boolean {
  const strip = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return strip(tailored) !== strip(standard) && strip(tailored).length > 0
}

function hasContent(text: string): boolean {
  return text.replace(/<[^>]*>/g, '').trim().length > 0
}

export default function DeltaEditor({
  controlId,
  standardText,
  tailoredText,
  onChange,
  readOnly = false,
  className,
}: DeltaEditorProps) {
  const [copied, setCopied] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const isCustomized = isTextCustomized(standardText, tailoredText)
  const tailoredHasContent = hasContent(tailoredText)
  const needsInput = !tailoredHasContent || (!isCustomized && hasContent(standardText))

  function handleCopyStandard() {
    onChange(standardText)
    setResetKey((k) => k + 1)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    onChange(standardText)
    setResetKey((k) => k + 1)
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Status bar */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-mono font-semibold">{controlId}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">Delta Editor</span>
        </div>
        <AnimatePresence mode="wait">
          {isCustomized ? (
            <motion.div
              key="custom"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-1 text-teal-400"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Site-specific tailoring applied</span>
            </motion.div>
          ) : needsInput ? (
            <motion.div
              key="needs"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-1 text-magma-400"
              style={{ color: '#FF6B1A' }}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Site-specific input required</span>
            </motion.div>
          ) : (
            <motion.div
              key="standard"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex items-center gap-1 text-slate-500"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Using standard policy</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-2 gap-3 min-h-[320px]">
        {/* Left: Standard Policy */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">
              Standard Policy
            </span>
            {!readOnly && hasContent(standardText) && (
              <button
                onClick={handleCopyStandard}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-cyan-400 transition-colors px-2 py-0.5 rounded border border-transparent hover:border-cyan-800"
              >
                {copied ? (
                  <CheckCircle className="w-3 h-3 text-teal-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied ? 'Copied' : 'Copy to right'}
              </button>
            )}
          </div>
          <div className="delta-pane delta-pane-standard rounded-xl p-4 flex-1">
            {hasContent(standardText) ? (
              <div
                className="tiptap text-sm text-slate-400 leading-relaxed pointer-events-none"
                dangerouslySetInnerHTML={{ __html: standardText }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
                <Info className="w-5 h-5" />
                <p className="text-xs text-center">No standard policy defined for this control.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Site-Specific Tailoring */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">
              Site-Specific Tailoring
            </span>
            {!readOnly && isCustomized && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-magma-400 transition-colors px-2 py-0.5 rounded border border-transparent hover:border-red-900"
                style={{ ['--hover-color' as string]: '#FF5500' }}
              >
                <RotateCcw className="w-3 h-3" />
                Reset to standard
              </button>
            )}
          </div>
          <div
            className={cn(
              'delta-pane delta-pane-tailored rounded-xl flex-1 overflow-hidden',
              needsInput && !readOnly ? 'needs-input' : '',
            )}
          >
            {readOnly ? (
              <div className="p-4">
                {hasContent(tailoredText) ? (
                  <div
                    className="tiptap text-sm text-slate-200 leading-relaxed pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: tailoredText }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600 min-h-[200px]">
                    <Edit3 className="w-5 h-5" />
                    <p className="text-xs text-center">No implementation statement yet.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 h-full">
                <TipTapEditor
                  key={`delta-${controlId}-${resetKey}`}
                  value={tailoredText || standardText}
                  onChange={onChange}
                  placeholder="Override with your site-specific implementation details…"
                  minHeight="260px"
                />
              </div>
            )}
          </div>

          {/* Indicator chip */}
          {!readOnly && needsInput && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] self-start"
              style={{
                background: 'rgba(255, 85, 0, 0.08)',
                border: '1px solid rgba(255, 85, 0, 0.3)',
                color: '#FF6B1A',
              }}
            >
              <AlertCircle className="w-3 h-3 shrink-0" />
              Tailor this control to your site environment before SSP generation
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
