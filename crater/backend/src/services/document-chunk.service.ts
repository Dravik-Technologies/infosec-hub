import fs from 'fs'
import path from 'path'

// ─── Public Types ─────────────────────────────────────────────────────────────

export type DocType = 'JSIG' | 'DOD_POLICY' | 'NIST_SUPPLEMENT' | 'DAAG' | 'CNSSI' | 'IC_POLICY' | 'CUSTOM'

/**
 * Metadata attached to every document chunk. Rich metadata is the key
 * enabler for precise retrieval — it lets the scoring function prefer
 * chunks whose section/family/applicability matches the query context
 * without scanning full content every time.
 */
export interface ChunkMetadata {
  docId: string            // 'jsig-rev2', 'dod-8500-01'
  docTitle: string         // 'Joint SAP Implementation Guide Rev 2'
  docType: DocType
  section: string          // '4.2.1' | 'H2'
  sectionTitle: string     // 'Access Control for SAP Environments'
  parentSection?: string   // '4.2'
  parentTitle?: string     // 'Access Control'
  controlRefs: string[]    // ['AC-2', 'AC-3', 'IA-5']
  families: string[]       // ['AC', 'IA']
  pageRange?: string       // '45-47'
  chunkIndex: number       // 0-based within section
  chunkTotal: number       // how many chunks the section was split into
  applicability: string[]  // ['HIGH', 'SAP', 'SCI', 'CUI', 'DOD']
  keywords: string[]       // extracted meaningful terms for scoring
}

export interface DocumentChunk {
  id: string              // 'jsig-rev2:4.2.1:0'
  content: string         // 600-900 word text body
  overlapBefore?: string  // trailing ~150 words of the preceding chunk (same section)
  overlapAfter?: string   // leading ~150 words of the following chunk (same section)
  metadata: ChunkMetadata
}

/** Shape of each JSON file under prisma/seed/knowledge-chunks/ */
export interface DocumentChunkFile {
  docId: string
  docTitle: string
  docType: DocType
  version?: string
  source?: string
  chunks: DocumentChunk[]
}

export interface ChunkSearchOptions {
  controlId?: string
  family?: string
  jsigEnabled?: boolean
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  query?: string
  maxResults?: number
}

export interface ChunkConfig {
  docId: string
  docTitle: string
  docType: DocType
  defaultApplicability?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_CHUNK_CHARS = 3500   // ~700-900 words — fits alongside other prompt signals
const OVERLAP_CHARS = 700         // ~150 words — ~20% of target, preserves cross-boundary context
const MIN_CHUNK_CHARS = 200

const CONTROL_REF_RE = /\b([A-Z]{2,3}-\d+(?:\(\d+\))?(?:\s*[a-z])?)\b/g

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'was',
  'one', 'our', 'had', 'his', 'has', 'its', 'may', 'who', 'did', 'been', 'with',
  'from', 'that', 'this', 'they', 'will', 'have', 'more', 'also', 'into', 'than',
  'then', 'when', 'where', 'shall', 'must', 'should', 'would', 'could', 'each',
  'both', 'which', 'their', 'there', 'these', 'those', 'such', 'other', 'upon',
  'under', 'over', 'after', 'before', 'about', 'above', 'between', 'through',
  'during', 'without', 'within', 'against', 'system', 'systems', 'control',
  'controls', 'security', 'information', 'organizational', 'organization',
])

// ─── DocumentChunkService ─────────────────────────────────────────────────────

/**
 * Singleton that loads pre-chunked JSON knowledge files from
 * prisma/seed/knowledge-chunks/ and exposes a scored search API.
 *
 * At query time the search is purely in-memory — no DB, no network — so
 * the added latency to any AI call is negligible (<1 ms for typical index sizes).
 *
 * To add a new document:
 *   1. Either hand-write a DocumentChunkFile JSON (best for structured docs)
 *   2. Or call DocumentChunkService.chunkDocument(rawText, config) to auto-split,
 *      then save the output to prisma/seed/knowledge-chunks/<docId>.json
 */
export class DocumentChunkService {
  private static instance: DocumentChunkService | undefined

  private readonly index = new Map<string, DocumentChunk>()        // id → chunk
  private readonly byDoc = new Map<string, DocumentChunk[]>()      // docId → chunks
  private readonly byFamily = new Map<string, DocumentChunk[]>()   // family → chunks
  private readonly byControl = new Map<string, DocumentChunk[]>()  // controlId → chunks

  private loaded = false
  private loadedDocs: string[] = []

  private constructor() {
    this.ensureLoaded()
  }

  static getInstance(): DocumentChunkService {
    DocumentChunkService.instance ??= new DocumentChunkService()
    return DocumentChunkService.instance
  }

  warmup(): void { this.ensureLoaded() }

  get size(): number { return this.index.size }

  metadata() {
    this.ensureLoaded()
    return {
      loaded: this.loaded,
      totalChunks: this.index.size,
      documents: this.loadedDocs,
      familyCoverage: Array.from(this.byFamily.keys()).sort(),
    }
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true

    const candidates = [
      path.resolve(process.cwd(), 'prisma/seed/knowledge-chunks'),
      path.resolve(process.cwd(), 'backend/prisma/seed/knowledge-chunks'),
      path.resolve(__dirname, '../../prisma/seed/knowledge-chunks'),
      path.resolve(__dirname, '../../../prisma/seed/knowledge-chunks'),
      path.resolve(__dirname, '../../../../backend/prisma/seed/knowledge-chunks'),
    ]

    let dir: string | undefined
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
          dir = candidate
          break
        }
      } catch { /* try next */ }
    }

    if (!dir) {
      console.warn('[DocumentChunkService] knowledge-chunks/ directory not found — document RAG unavailable.')
      return
    }

    let fileList: string[]
    try {
      fileList = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[DocumentChunkService] Cannot read knowledge-chunks/ directory — ${reason}`)
      return
    }

    for (const file of fileList) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf8')
        const doc = JSON.parse(raw) as DocumentChunkFile
        this.indexDocument(doc)
        this.loadedDocs.push(doc.docId)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.warn(`[DocumentChunkService] Failed to load ${file} — ${reason}`)
      }
    }

    console.log(
      `[DocumentChunkService] Loaded ${this.index.size} chunks from ${this.loadedDocs.length} document(s): [${this.loadedDocs.join(', ')}]`,
    )
  }

  private indexDocument(doc: DocumentChunkFile): void {
    const chunks = doc.chunks ?? []
    if (chunks.length === 0) return

    this.byDoc.set(doc.docId, chunks)

    for (const chunk of chunks) {
      // Backfill top-level doc metadata if omitted from individual chunks
      chunk.metadata.docId ||= doc.docId
      chunk.metadata.docTitle ||= doc.docTitle
      chunk.metadata.docType ||= doc.docType

      this.index.set(chunk.id, chunk)

      for (const family of chunk.metadata.families ?? []) {
        if (!this.byFamily.has(family)) this.byFamily.set(family, [])
        this.byFamily.get(family)!.push(chunk)
      }

      for (const controlId of chunk.metadata.controlRefs ?? []) {
        if (!this.byControl.has(controlId)) this.byControl.set(controlId, [])
        this.byControl.get(controlId)!.push(chunk)
      }
    }
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  /**
   * Returns the top-K document chunks ranked by relevance to the query context.
   * Scores are driven by: exact control ref match, family overlap, JSIG flag,
   * impact level applicability, and keyword co-occurrence in content + metadata.
   */
  search(opts: ChunkSearchOptions): DocumentChunk[] {
    this.ensureLoaded()
    if (this.index.size === 0) return []

    const maxResults = opts.maxResults ?? 5
    const queryTerms = extractKeywords(opts.query ?? '')
    const family = opts.family ?? (opts.controlId ? opts.controlId.split('-')[0] : undefined)

    const candidates = this.buildCandidateSet(opts.controlId, family, opts.jsigEnabled)

    return candidates
      .map((chunk) => ({ chunk, score: this.scoreChunk(chunk, opts, queryTerms, family) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((entry) => entry.chunk)
  }

  private buildCandidateSet(
    controlId: string | undefined,
    family: string | undefined,
    jsigEnabled: boolean | undefined,
  ): DocumentChunk[] {
    const seen = new Set<string>()
    const result: DocumentChunk[] = []

    const add = (chunks: DocumentChunk[]) => {
      for (const chunk of chunks) {
        if (!seen.has(chunk.id)) { seen.add(chunk.id); result.push(chunk) }
      }
    }

    // Highest priority: exact control match
    if (controlId) add(this.byControl.get(controlId) ?? [])

    // Family match
    if (family) add(this.byFamily.get(family) ?? [])

    // JSIG-enabled: include all JSIG/DOD docs as candidates
    if (jsigEnabled) {
      for (const [docId, chunks] of this.byDoc) {
        if (/^(jsig|dod|cnssi|ic-)/.test(docId)) add(chunks)
      }
    }

    // Fill remainder from full index so scoring can surface cross-family context
    if (result.length < 30) {
      for (const chunk of this.index.values()) {
        if (!seen.has(chunk.id)) { seen.add(chunk.id); result.push(chunk) }
        if (result.length >= 100) break
      }
    }

    return result
  }

  private scoreChunk(
    chunk: DocumentChunk,
    opts: ChunkSearchOptions,
    queryTerms: string[],
    family: string | undefined,
  ): number {
    let score = 0
    const m = chunk.metadata

    // Exact control ref match — strongest signal
    if (opts.controlId && m.controlRefs.includes(opts.controlId)) score += 100

    // Related control in same family
    if (opts.controlId) {
      const fam = opts.controlId.split('-')[0]
      if (m.controlRefs.some((ref) => ref.startsWith(fam + '-'))) score += 20
    }

    // Family match in metadata
    if (family && m.families.includes(family)) score += 30

    // JSIG document type when JSIG context is active
    if (opts.jsigEnabled && m.docType === 'JSIG') score += 40
    if (opts.jsigEnabled && m.applicability.some((a) => a === 'SAP' || a === 'SCI')) score += 25

    // Impact level applicability match
    if (opts.impactLevel && m.applicability.includes(opts.impactLevel)) score += 20

    // Query keyword matches (content + metadata fields)
    const contentLower = `${chunk.content} ${m.sectionTitle} ${m.keywords.join(' ')}`.toLowerCase()
    const chunkKeywordSet = new Set(m.keywords)

    for (const term of queryTerms) {
      if (chunkKeywordSet.has(term)) score += 8            // keyword index hit
      if (m.sectionTitle.toLowerCase().includes(term)) score += 10  // section title match
      if (contentLower.includes(term)) score += term.length > 6 ? 5 : 3  // content match
    }

    return score
  }

  // ─── Document Chunking (offline ingestion utility) ─────────────────────────

  /**
   * Splits raw document text into structured chunks with overlap and metadata.
   * Intended for offline pre-processing: call once, save the output JSON to
   * prisma/seed/knowledge-chunks/<docId>.json, and the service will load it.
   *
   * The chunker respects document hierarchy in this order of preference:
   *   1. Numbered sections  (e.g., "4.2.1 Access Control Requirements")
   *   2. Markdown headings  (e.g., "## Section Title")
   *   3. Paragraph breaks   (double newlines)
   *   4. Sentence boundaries (as last resort)
   */
  static chunkDocument(rawText: string, config: ChunkConfig): DocumentChunk[] {
    const sections = parseDocumentStructure(rawText)
    const allChunks: DocumentChunk[] = []

    for (const section of sections) {
      const body = section.content.trim()
      if (body.length < MIN_CHUNK_CHARS) continue

      const textChunks = splitSectionToChunks(body, TARGET_CHUNK_CHARS)
      const controlRefs = extractControlRefs(body)
      const families = Array.from(
        new Set(controlRefs.map((id) => id.split('-')[0]).filter(Boolean)),
      )
      const keywords = extractKeywords(body)
      const applicability = Array.from(
        new Set([...(config.defaultApplicability ?? []), ...detectApplicability(body)]),
      )

      textChunks.forEach((content, chunkIndex) => {
        allChunks.push({
          id: `${config.docId}:${section.key}:${chunkIndex}`,
          content,
          metadata: {
            docId: config.docId,
            docTitle: config.docTitle,
            docType: config.docType,
            section: section.key,
            sectionTitle: section.title,
            parentSection: section.parentKey,
            parentTitle: section.parentTitle,
            controlRefs,
            families,
            chunkIndex,
            chunkTotal: textChunks.length,
            applicability,
            keywords,
          },
        })
      })
    }

    applyOverlap(allChunks)
    return allChunks
  }
}

// ─── Document Structure Parser ────────────────────────────────────────────────

interface ParsedSection {
  key: string
  title: string
  parentKey?: string
  parentTitle?: string
  content: string
  level: number
}

/**
 * Detects section boundaries in RMF documents by scanning for:
 * - Numbered headings: "4.2.1 Title Text"  (most common in JSIG, NIST, DoD)
 * - Markdown headings: "## Title Text"
 *
 * Maintains a parent stack to track the hierarchy so each section knows
 * its immediate parent (enables breadcrumb display and cross-section context).
 */
function parseDocumentStructure(text: string): ParsedSection[] {
  interface Heading { index: number; key: string; title: string; level: number }
  const headings: Heading[] = []

  // Scan line-by-line to avoid regex backtracking on large docs
  const lines = text.split('\n')
  let pos = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { pos += line.length + 1; continue }

    // Numbered heading: "4.2.1 UPPERCASE OR Title Case text"
    const numMatch = trimmed.match(/^(\d+(?:\.\d+){0,3})\s+([A-Za-z].{3,79})$/)
    if (numMatch) {
      const num = numMatch[1]
      const dots = (num.match(/\./g) ?? []).length
      headings.push({ index: pos, key: num, title: numMatch[2].trim(), level: Math.min(dots + 1, 4) })
      pos += line.length + 1
      continue
    }

    // Markdown heading: "## Title"
    const mdMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (mdMatch) {
      headings.push({
        index: pos,
        key: `H${mdMatch[1].length}-${headings.length}`,
        title: mdMatch[2].trim(),
        level: Math.min(mdMatch[1].length, 4),
      })
      pos += line.length + 1
      continue
    }

    pos += line.length + 1
  }

  if (headings.length === 0) {
    // No headings found — treat entire text as one section
    return [{ key: '0', title: 'Document', content: text, level: 1 }]
  }

  const sections: ParsedSection[] = []
  const parentStack: Array<{ key: string; title: string; level: number }> = []

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    const nextStart = i + 1 < headings.length ? headings[i + 1].index : text.length
    const headingEnd = text.indexOf('\n', h.index)
    const content = (headingEnd >= 0 ? text.slice(headingEnd + 1, nextStart) : '').trim()

    // Pop stack until we find a shallower ancestor
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= h.level) {
      parentStack.pop()
    }

    const parent = parentStack[parentStack.length - 1]

    if (content.length >= MIN_CHUNK_CHARS) {
      sections.push({
        key: h.key,
        title: h.title,
        parentKey: parent?.key,
        parentTitle: parent?.title,
        content,
        level: h.level,
      })
    }

    parentStack.push({ key: h.key, title: h.title, level: h.level })
  }

  return sections
}

// ─── Chunk Size Management ────────────────────────────────────────────────────

function splitSectionToChunks(text: string, targetSize: number): string[] {
  if (text.length <= targetSize) return [text]

  // Phase 1: split at paragraph boundaries (blank lines)
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    const joined = current ? `${current}\n\n${para}` : para
    if (joined.length <= targetSize) {
      current = joined
    } else {
      if (current) chunks.push(current.trim())
      // Phase 2: if a single paragraph exceeds target, split at sentence boundaries
      if (para.length > targetSize) {
        const sentences = splitAtSentences(para, targetSize)
        for (const s of sentences.slice(0, -1)) chunks.push(s)
        current = sentences[sentences.length - 1] ?? ''
      } else {
        current = para
      }
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter((c) => c.length >= MIN_CHUNK_CHARS)
}

function splitAtSentences(text: string, targetSize: number): string[] {
  const chunks: string[] = []
  let remaining = text.trim()

  while (remaining.length > targetSize) {
    const window = remaining.slice(0, targetSize + 200) // slight overshoot to find boundary

    // Find the last sentence-ending punctuation before targetSize followed by space+uppercase
    let splitAt = -1
    const pattern = /[.!?]\s+(?=[A-Z("])/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(window)) !== null) {
      if (match.index <= targetSize) splitAt = match.index + 1
    }

    if (splitAt <= 0) {
      // No sentence boundary — hard split at target
      chunks.push(remaining.slice(0, targetSize).trim())
      remaining = remaining.slice(targetSize).trim()
    } else {
      chunks.push(remaining.slice(0, splitAt).trim())
      remaining = remaining.slice(splitAt).trim()
    }
  }

  if (remaining.trim()) chunks.push(remaining.trim())
  return chunks
}

// ─── Overlap ──────────────────────────────────────────────────────────────────

/**
 * Adds context overlap between adjacent chunks within the same section.
 * overlapBefore = trailing ~150 words of the previous chunk (gives the model
 *   the sentence that was cut off at the start of this chunk).
 * overlapAfter  = leading ~150 words of the next chunk (lets the model see
 *   what comes next without pulling in the full next chunk).
 *
 * Overlap is trimmed to the nearest sentence boundary where possible so the
 * model receives grammatically complete sentences, not mid-sentence fragments.
 */
function applyOverlap(chunks: DocumentChunk[]): void {
  for (let i = 0; i < chunks.length; i++) {
    const cur = chunks[i]
    const prev = chunks[i - 1]
    const next = chunks[i + 1]

    if (prev && prev.metadata.section === cur.metadata.section) {
      const raw = prev.content.slice(-OVERLAP_CHARS)
      const boundary = raw.search(/[.!?]\s+[A-Z("]/)
      cur.overlapBefore = boundary > OVERLAP_CHARS * 0.35
        ? raw.slice(boundary + 1).trim()
        : raw.trim()
    }

    if (next && next.metadata.section === cur.metadata.section) {
      const raw = next.content.slice(0, OVERLAP_CHARS)
      const boundary = raw.search(/[.!?]\s+[A-Z("]/)
      cur.overlapAfter = boundary > 0 && boundary < OVERLAP_CHARS * 0.65
        ? raw.slice(0, boundary + 1).trim()
        : raw.trim()
    }
  }
}

// ─── Extraction Helpers ───────────────────────────────────────────────────────

function extractControlRefs(text: string): string[] {
  const seen = new Set<string>()
  const re = new RegExp(CONTROL_REF_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) seen.add(match[1].trim())
  return Array.from(seen)
}

export function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9-]+/)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w))
        .slice(0, 60),
    ),
  )
}

function detectApplicability(text: string): string[] {
  const lower = text.toLowerCase()
  const tags: string[] = []
  if (/\b(sap|special access program|compartmented)\b/.test(lower)) tags.push('SAP')
  if (/\b(sci|sensitive compartmented information|scif)\b/.test(lower)) tags.push('SCI')
  if (/\b(cui|controlled unclassified information)\b/.test(lower)) tags.push('CUI')
  if (/\bhigh[- ]impact\b/.test(lower)) tags.push('HIGH')
  if (/\bmoderate[- ]impact\b/.test(lower)) tags.push('MODERATE')
  if (/\blow[- ]impact\b/.test(lower)) tags.push('LOW')
  if (/\bjsig\b/.test(lower)) tags.push('JSIG')
  if (/\b(dod|department of defense)\b/.test(lower)) tags.push('DOD')
  if (/\b(icpg|odni|intelligence community)\b/.test(lower)) tags.push('IC')
  return tags
}

// ─── Prompt Formatting (used by ai.service.ts) ────────────────────────────────

/**
 * Formats retrieved document chunks for injection into AI prompts.
 * Each chunk is prefixed with a bracketed citation header showing the
 * source document and section so the model can attribute policy language.
 * Overlap context is shown with an ellipsis marker to indicate continuity.
 */
export function formatDocumentChunks(chunks: DocumentChunk[]): string {
  if (!chunks.length) return ''

  const maxChunks = positiveInt(process.env.LOCAL_AI_MAX_RAG_CHUNKS, chunks.length)
  const maxChunkChars = positiveInt(process.env.LOCAL_AI_MAX_RAG_CHARS_PER_CHUNK, 1200)

  return chunks
    .slice(0, maxChunks)
    .map((chunk) => {
      const { metadata: m } = chunk
      const header = `[${m.docTitle} — §${m.section}: ${m.sectionTitle}]`
      const controlCite = m.controlRefs.length
        ? ` (controls: ${m.controlRefs.slice(0, 6).join(', ')})`
        : ''

      const beforeCtx = chunk.overlapBefore
        ? `[...prior context] ${chunk.overlapBefore}\n\n`
        : ''

      const afterCtx = chunk.overlapAfter
        ? `\n\n[...continues] ${chunk.overlapAfter}`
        : ''

      return `${header}${controlCite}\n${truncateAtSentence(`${beforeCtx}${chunk.content}${afterCtx}`, maxChunkChars)}`
    })
    .join('\n\n---\n\n')
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function truncateAtSentence(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  const clipped = value.slice(0, maxChars)
  const sentenceEnd = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '))
  if (sentenceEnd > Math.floor(maxChars * 0.55)) return `${clipped.slice(0, sentenceEnd + 1).trim()} [...]`
  return `${clipped.trimEnd()} [...]`
}
