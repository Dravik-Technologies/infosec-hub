import fs from 'fs'
import path from 'path'

export interface BestPracticeEntry {
  controlId: string
  title: string
  bestPracticeStatement: string
  typicalEvidence: string[]
  jsigNote?: string | null
  commonImplementation?: string
}

type BestPracticesFile = Record<string, Record<string, BestPracticeEntry>>

/**
 * Loads best-practices.json once at first use and caches it in a flat Map.
 * Resilient to missing file — callers receive `undefined` and fall through
 * to RAG / buildFallbackCore as before.
 */
export class BestPracticesService {
  private static instance: BestPracticesService | undefined
  private readonly index = new Map<string, BestPracticeEntry>()
  private loaded = false
  private sourcePath: string | null = null

  private constructor() {
    this.ensureLoaded()
  }

  static getInstance(): BestPracticesService {
    BestPracticesService.instance ??= new BestPracticesService()
    return BestPracticesService.instance
  }

  warmup(): void {
    this.ensureLoaded()
  }

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true // set before the I/O attempt to prevent retry storms on error

    // Support both running from repo root and from the compiled dist/ directory.
    const candidates = [
      path.resolve(process.cwd(), 'prisma/seed/best-practices.json'),
      path.resolve(process.cwd(), 'backend/prisma/seed/best-practices.json'),
      path.resolve(__dirname, '../../prisma/seed/best-practices.json'),
      path.resolve(__dirname, '../../../prisma/seed/best-practices.json'),
      path.resolve(__dirname, '../../../../backend/prisma/seed/best-practices.json'),
    ]

    let raw: string | undefined
    for (const candidate of candidates) {
      try {
        raw = fs.readFileSync(candidate, 'utf8')
        this.sourcePath = candidate
        break
      } catch {
        // try next path
      }
    }

    if (!raw) {
      console.warn('[BestPracticesService] best-practices.json not found — curated data unavailable.')
      return
    }

    try {
      const data = JSON.parse(raw) as BestPracticesFile
      for (const familyMap of Object.values(data)) {
        for (const [id, rawEntry] of Object.entries(familyMap)) {
          const entry = this.normalizeEntry(id, rawEntry)
          if (entry) this.index.set(entry.controlId, entry)
        }
      }
      console.log(`[BestPracticesService] Loaded ${this.index.size} curated entries from ${this.sourcePath}.`)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.error(`[BestPracticesService] Failed to parse best-practices.json — ${reason}`)
    }
  }

  private normalizeEntry(id: string, entry: Partial<BestPracticeEntry>): BestPracticeEntry | null {
    if (!entry || typeof entry.bestPracticeStatement !== 'string' || !entry.bestPracticeStatement.trim()) {
      return null
    }

    return {
      controlId: entry.controlId || id,
      title: entry.title || entry.controlId || id,
      bestPracticeStatement: entry.bestPracticeStatement.trim(),
      typicalEvidence: Array.isArray(entry.typicalEvidence)
        ? entry.typicalEvidence.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [],
      jsigNote: typeof entry.jsigNote === 'string' && entry.jsigNote.trim() ? entry.jsigNote.trim() : null,
      commonImplementation:
        typeof entry.commonImplementation === 'string' && entry.commonImplementation.trim()
          ? entry.commonImplementation.trim()
          : undefined,
    }
  }

  get(controlId: string): BestPracticeEntry | undefined {
    this.ensureLoaded()
    return this.index.get(controlId)
  }

  has(controlId: string): boolean {
    this.ensureLoaded()
    return this.index.has(controlId)
  }

  get size(): number {
    this.ensureLoaded()
    return this.index.size
  }

  /**
   * Merges a curated best-practice statement with project-specific context to
   * produce a personalised, auditor-ready paragraph — without calling the LLM.
   *
   * The JSON statements are deliberately generic ("the organization", "the system
   * owner") so they work for any project. This method anchors the text to the
   * specific system name and appends JSIG / tailoring addenda where applicable.
   */
  personalize(
    entry: BestPracticeEntry,
    options: {
      systemName?: string
      impactLevel?: string
      jsigEnabled?: boolean
      tailoringNote?: string
      roleSummary?: string
      authorizationBoundary?: string | null
      organizationalContext?: string
      inherited?: boolean
      inheritedFrom?: string
    } = {},
  ): string {
    let text = entry.bestPracticeStatement

    // Anchor generic language to the specific system when a name is available.
    if (options.systemName) {
      const impactClause = options.impactLevel ? `, a ${options.impactLevel}-impact system,` : ''
      const boundaryClause = options.authorizationBoundary ? ` within the documented authorization boundary` : ''
      const anchor = `The ${options.systemName} system${impactClause} implements ${entry.controlId} (${entry.title})${boundaryClause}.`
      text = `${anchor} ${text}`
    }

    if (options.roleSummary) {
      text = `${text} Responsibility is coordinated through ${options.roleSummary}.`
    }

    if (options.organizationalContext) {
      text = `${text} The implementation is aligned to the documented organizational context and risk posture for this system.`
    }

    if (options.inherited) {
      text = `${text} Where applicable, inherited portions of this control are documented through ${options.inheritedFrom || 'the designated common control provider'}, with the system team retaining responsibility for validating provider evidence and residual system-specific implementation details.`
    }

    // Append the JSIG note inline when the SAP/JSIG overlay is active.
    if (options.jsigEnabled && entry.jsigNote) {
      text = `${text} ${entry.jsigNote}`
    }

    // Append any tailoring disposition statement from the caller.
    if (options.tailoringNote) {
      text = `${text} ${options.tailoringNote}`
    }

    return text.replace(/\s+/g, ' ').trim()
  }

  /**
   * Returns the evidence list from the curated entry, optionally merged with
   * additional items (e.g. from the NIST catalog or FAMILY_EVIDENCE).
   * The curated list comes first so the highest-quality items are preferred.
   */
  mergeEvidence(entry: BestPracticeEntry, additional: string[] = []): string[] {
    const seen = new Set<string>()
    const result: string[] = []
    for (const item of [...entry.typicalEvidence, ...additional]) {
      const normalised = item.trim().toLowerCase()
      if (normalised && !seen.has(normalised)) {
        seen.add(normalised)
        result.push(item.trim())
      }
    }
    return result
  }

  metadata() {
    this.ensureLoaded()
    return {
      loaded: this.loaded,
      size: this.index.size,
      sourcePath: this.sourcePath,
    }
  }
}
