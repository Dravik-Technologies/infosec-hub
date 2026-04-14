import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  convertInchesToTwip,
} from 'docx'
import type { InfoSystem, SCTMEntry, POAMItem } from '@/types'
import { CONTROL_FAMILIES, CONTROL_CATALOG, getControlById } from '@/data/controls'
import { formatDate } from '@/lib/utils'

// ── HTML → docx Conversion ────────────────────────────────────────────────────

interface RunSpec {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
}

function extractRuns(node: Node, inherited: Omit<RunSpec, 'text'> = {}): RunSpec[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    return text ? [{ text, ...inherited }] : []
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const style = { ...inherited }
  if (tag === 'strong' || tag === 'b') style.bold = true
  if (tag === 'em' || tag === 'i') style.italic = true
  if (tag === 'u') style.underline = true
  if (tag === 's' || tag === 'del') style.strike = true
  return Array.from(el.childNodes).flatMap((c) => extractRuns(c, style))
}

function toTextRuns(specs: RunSpec[]): TextRun[] {
  return specs.map(
    (s) =>
      new TextRun({
        text: s.text,
        bold: s.bold,
        italics: s.italic,
        underline: s.underline ? { type: UnderlineType.SINGLE } : undefined,
        strike: s.strike,
      })
  )
}

const BULLET_REF = 'ssp-bullet'
const NUMBER_REF = 'ssp-number'

function parseBlock(node: Node): Paragraph[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').trim()
    return text ? [new Paragraph({ children: [new TextRun({ text })] })] : []
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const el = node as Element
  const tag = el.tagName.toLowerCase()

  switch (tag) {
    case 'p': {
      const specs = Array.from(el.childNodes).flatMap((c) => extractRuns(c))
      return [
        new Paragraph({
          children:
            specs.length && specs.some((s) => s.text.trim())
              ? toTextRuns(specs)
              : [new TextRun({ text: '' })],
        }),
      ]
    }
    case 'h1':
      return [new Paragraph({ heading: HeadingLevel.HEADING_1, text: el.textContent ?? '' })]
    case 'h2':
      return [new Paragraph({ heading: HeadingLevel.HEADING_2, text: el.textContent ?? '' })]
    case 'h3':
      return [new Paragraph({ heading: HeadingLevel.HEADING_3, text: el.textContent ?? '' })]
    case 'ul':
      return Array.from(el.children)
        .filter((c) => c.tagName.toLowerCase() === 'li')
        .map((li) => {
          const specs = Array.from(li.childNodes).flatMap((c) => extractRuns(c))
          return new Paragraph({
            numbering: { reference: BULLET_REF, level: 0 },
            children: specs.length ? toTextRuns(specs) : [new TextRun({ text: li.textContent ?? '' })],
          })
        })
    case 'ol':
      return Array.from(el.children)
        .filter((c) => c.tagName.toLowerCase() === 'li')
        .map((li) => {
          const specs = Array.from(li.childNodes).flatMap((c) => extractRuns(c))
          return new Paragraph({
            numbering: { reference: NUMBER_REF, level: 0 },
            children: specs.length ? toTextRuns(specs) : [new TextRun({ text: li.textContent ?? '' })],
          })
        })
    case 'br':
      return [new Paragraph({ text: '' })]
    default:
      return Array.from(el.childNodes).flatMap(parseBlock)
  }
}

function placeholder(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: '[Not yet documented.]', italics: true, color: '888888' }),
    ],
  })
}

const EMPTY_PATTERNS = new Set(['', '<p></p>', '<p><br></p>', '<p><br class="ProseMirror-trailingBreak"></p>'])

function htmlToDocx(html: string): Paragraph[] {
  if (!html || EMPTY_PATTERNS.has(html.trim())) return [placeholder()]
  const dom = new DOMParser().parseFromString(html, 'text/html')
  const blocks = Array.from(dom.body.childNodes).flatMap(parseBlock)
  return blocks.length ? blocks : [placeholder()]
}

// ── Layout Helpers ────────────────────────────────────────────────────────────

const spacer = () => new Paragraph({ text: '' })

const h1 = (text: string, pageBreak = false) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: pageBreak, text })

const h2 = (text: string, pageBreak = false) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: pageBreak, text })

const h3 = (text: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_3, text })

const boldLabel = (text: string) =>
  new Paragraph({
    spacing: { before: 80 },
    children: [new TextRun({ text, bold: true })],
  })

const body = (text: string) =>
  new Paragraph({ children: [new TextRun({ text })] })

// ── Table Helpers ─────────────────────────────────────────────────────────────

const BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'C0C0C0' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C0C0C0' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'C0C0C0' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'C0C0C0' },
}

const HEADER_SHADE = { fill: '1F3864', type: ShadingType.SOLID }
const ALT_SHADE = { fill: 'F0F4F8', type: ShadingType.SOLID }

function dataCell(
  content: string | Paragraph[],
  shade?: { fill: string; type: typeof ShadingType[keyof typeof ShadingType] }
): TableCell {
  const children: Paragraph[] =
    typeof content === 'string'
      ? [new Paragraph({ children: [new TextRun({ text: content })] })]
      : content
  return new TableCell({ borders: BORDERS, shading: shade, children })
}

function headerCell(text: string): TableCell {
  return new TableCell({
    borders: BORDERS,
    shading: HEADER_SHADE,
    children: [
      new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF' })] }),
    ],
  })
}

function twoColTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([key, value], i) =>
        new TableRow({
          children: [
            dataCell(
              [new Paragraph({ children: [new TextRun({ text: key, bold: true })] })],
              i % 2 === 0 ? ALT_SHADE : undefined
            ),
            dataCell(value || '—', i % 2 === 0 ? ALT_SHADE : undefined),
          ],
        })
    ),
  })
}

// ── Main Export ───────────────────────────────────────────────────────────────

export async function generateSSPDocument(
  system: InfoSystem,
  entries: SCTMEntry[],
  poamItems: POAMItem[]
): Promise<void> {
  const marking = system.classificationMarking?.trim() ?? ''
  const dateStr = formatDate(new Date().toISOString())

  const classificationPara = () =>
    marking
      ? new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: marking, bold: true, allCaps: true, size: 22 })],
        })
      : new Paragraph({ text: '' })

  // Build entry lookup map
  const entryMap = new Map<string, SCTMEntry>()
  for (const e of entries) entryMap.set(e.controlId, e)

  // Baseline key for control catalog lookup
  const baselineKey: 'lowBaseline' | 'moderateBaseline' | 'highBaseline' =
    system.selectedBaseline === 'LOW'
      ? 'lowBaseline'
      : system.selectedBaseline === 'MODERATE'
      ? 'moderateBaseline'
      : 'highBaseline'

  // ── Cover Page ──────────────────────────────────────────────────────────────
  const children: (Paragraph | Table)[] = [
    classificationPara(),
    spacer(), spacer(), spacer(), spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'SYSTEM SECURITY PLAN', bold: true, size: 52, color: '1F3864' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'AND POLICY & PROCEDURES', bold: true, size: 32, color: '1F3864' })],
    }),
    spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: system.name, bold: true, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `(${system.abbreviation})`, size: 28, color: '555555' })],
    }),
    spacer(), spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: system.organization, size: 24, color: '333333' })],
    }),
    spacer(), spacer(), spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Date Generated: ${dateStr}`, size: 20, color: '666666' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Baseline: NIST SP 800-53 Rev 5 — ${system.selectedBaseline}`,
          size: 20,
          color: '666666',
        }),
      ],
    }),
    spacer(), spacer(), spacer(), spacer(),
    classificationPara(),

    // ── Section 1: System Identification ───────────────────────────────────────
    h1('1. System Identification', true),
    spacer(),
    twoColTable([
      ['System Name', system.name],
      ['Abbreviation', system.abbreviation],
      ['System Type', system.systemType],
      ['Organization', system.organization],
      ['System Owner', system.systemOwner || ''],
      ['ISSO', system.isso || ''],
      ['ISSM', system.issm || ''],
      ['ATO Status', system.atoStatus],
      ['ATO Expiration Date', system.atoExpirationDate ? formatDate(system.atoExpirationDate) : 'N/A'],
      ['Classification / Handling', marking || 'Not specified'],
    ]),

    // ── Section 2: System Description ─────────────────────────────────────────
    h1('2. System Description', true),
    spacer(),
    body(system.description || 'No description provided.'),

    // ── Section 3: Security Categorization ────────────────────────────────────
    h1('3. Security Categorization (FIPS 199)', true),
    spacer(),
    body(
      'The following table documents the security categorization of this system per FIPS 199 and NIST SP 800-60. ' +
        'The overall system impact level is determined by the high-water mark across all three security objectives.'
    ),
    spacer(),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            headerCell('Security Objective'),
            headerCell('Impact Level'),
            headerCell('Rationale'),
          ],
        }),
        new TableRow({
          children: [
            dataCell(
              [new Paragraph({ children: [new TextRun({ text: 'Confidentiality', bold: true })] })],
              ALT_SHADE
            ),
            dataCell(system.ciaAnswers.confidentiality, ALT_SHADE),
            dataCell(system.ciaAnswers.confidentialityRationale || '—', ALT_SHADE),
          ],
        }),
        new TableRow({
          children: [
            dataCell([new Paragraph({ children: [new TextRun({ text: 'Integrity', bold: true })] })]),
            dataCell(system.ciaAnswers.integrity),
            dataCell(system.ciaAnswers.integrityRationale || '—'),
          ],
        }),
        new TableRow({
          children: [
            dataCell(
              [new Paragraph({ children: [new TextRun({ text: 'Availability', bold: true })] })],
              ALT_SHADE
            ),
            dataCell(system.ciaAnswers.availability, ALT_SHADE),
            dataCell(system.ciaAnswers.availabilityRationale || '—', ALT_SHADE),
          ],
        }),
      ],
    }),
    spacer(),
    new Paragraph({
      children: [
        new TextRun({ text: 'Selected Security Control Baseline: ', bold: true }),
        new TextRun({ text: system.selectedBaseline }),
        ...(system.selectedBaseline !== system.recommendedBaseline
          ? [new TextRun({ text: ` (FIPS 199 recommended: ${system.recommendedBaseline})`, color: '888888' })]
          : []),
      ],
    }),

    // ── Section 4: Security Control Implementations ────────────────────────────
    h1('4. Security Control Implementations', true),
    spacer(),
    body(
      `The following sections document the implementation status and approach for each NIST SP 800-53 Rev 5 security control ` +
        `in the ${system.selectedBaseline} baseline. Each control family begins with the applicable policy and procedures ` +
        `(the -1 control), which defines organizational policy and establishes the procedural framework for that family. ` +
        `These sections collectively serve as the system's standardized policy and procedures documentation.`
    ),
  ]

  // ── Per-family control sections ─────────────────────────────────────────────
  let famNum = 1
  for (const family of CONTROL_FAMILIES) {
    // Baseline controls for this family from the catalog
    const familyControls = CONTROL_CATALOG.filter(
      (c) => c.family === family.id && c[baselineKey]
    )

    // Any SCTM entries in this family not covered by the baseline (user additions)
    const baselineControlIds = new Set(familyControls.map((c) => c.id))
    const extraControls = entries
      .filter((e) => e.controlId.startsWith(family.id + '-') && !baselineControlIds.has(e.controlId))
      .map((e) => e.controlId)

    if (familyControls.length === 0 && extraControls.length === 0) continue

    // Family heading (page break before each family)
    children.push(h2(`4.${famNum} ${family.id} — ${family.name}`, true))

    // Policy & Procedures intro (from the -1 control)
    const policyControlId = `${family.id}-1`
    const policyEntry = entryMap.get(policyControlId)
    const policyHtml = policyEntry?.implementationStatement ?? ''

    children.push(h3('Policy and Procedures'))
    if (policyHtml && !EMPTY_PATTERNS.has(policyHtml.trim())) {
      children.push(...htmlToDocx(policyHtml))
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text:
                `[Policy and procedures for ${family.name} have not yet been documented. ` +
                `This section should address the organization's policy regarding ${family.name.toLowerCase()} ` +
                `and the procedures necessary to implement and enforce the applicable controls.]`,
              italics: true,
              color: '888888',
            }),
          ],
        })
      )
    }
    children.push(spacer())

    // All controls in this family (catalog order, then extras)
    const allControlIds = [...familyControls.map((c) => c.id), ...extraControls]

    for (const controlId of allControlIds) {
      const ctrl = getControlById(controlId)
      const entry = entryMap.get(controlId)

      children.push(h3(`${controlId}${ctrl ? ' — ' + ctrl.title : ''}`))

      // NIST control statement
      if (ctrl?.description) {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({ text: 'NIST Control Statement: ', bold: true }),
              new TextRun({ text: ctrl.description, italics: true, color: '555555' }),
            ],
          })
        )
      }

      // Status / origin / role table
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell('Implementation Status'),
                headerCell('Implementation Origin'),
                headerCell('Responsible Role'),
              ],
            }),
            new TableRow({
              children: [
                dataCell(entry?.status ?? 'Not Implemented'),
                dataCell(entry?.implementationOrigin ?? 'System Specific'),
                dataCell(entry?.responsibleRole || '—'),
              ],
            }),
          ],
        })
      )
      children.push(spacer())

      // Implementation statement
      children.push(boldLabel('Implementation Statement:'))
      children.push(...htmlToDocx(entry?.implementationStatement ?? ''))

      // Evidence references
      if (entry?.evidenceLinks?.length) {
        children.push(spacer())
        children.push(boldLabel('Evidence References:'))
        for (const ev of entry.evidenceLinks) {
          children.push(
            new Paragraph({
              numbering: { reference: BULLET_REF, level: 0 },
              children: [
                new TextRun({ text: ev.label }),
                ev.url ? new TextRun({ text: ` — ${ev.url}`, color: '2563EB' }) : new TextRun({ text: '' }),
              ],
            })
          )
        }
      }

      // Target completion date (if applicable)
      if (
        entry?.targetCompletionDate &&
        entry.status !== 'Implemented' &&
        entry.status !== 'Not Applicable' &&
        entry.status !== 'Inherited'
      ) {
        children.push(
          new Paragraph({
            spacing: { before: 60 },
            children: [
              new TextRun({ text: 'Target Completion Date: ', bold: true }),
              new TextRun({ text: formatDate(entry.targetCompletionDate) }),
            ],
          })
        )
      }

      // Inherited from
      if (entry?.inheritedFrom) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Inherited From: ', bold: true }),
              new TextRun({ text: entry.inheritedFrom }),
            ],
          })
        )
      }

      children.push(spacer())
    }

    famNum++
  }

  // ── Section 5: POAM Summary ─────────────────────────────────────────────────
  children.push(h1('5. Plan of Action & Milestones (POAM) Summary', true))
  children.push(spacer())

  children.push(
    twoColTable([
      ['Total POAM Items', String(poamItems.length)],
      ['Open', String(poamItems.filter((p) => p.status === 'Open').length)],
      ['In Progress', String(poamItems.filter((p) => p.status === 'In Progress').length)],
      ['Completed', String(poamItems.filter((p) => p.status === 'Completed').length)],
      ['Risk Accepted', String(poamItems.filter((p) => p.status === 'Risk Accepted').length)],
      ['False Positive', String(poamItems.filter((p) => p.status === 'False Positive').length)],
      ['Vendor Dependency', String(poamItems.filter((p) => p.status === 'Vendor Dependency').length)],
    ])
  )

  const openItems = poamItems.filter((p) => p.status === 'Open' || p.status === 'In Progress')

  if (openItems.length > 0) {
    children.push(spacer())
    children.push(h3('Open & In-Progress Items'))
    children.push(spacer())
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              headerCell('POAM ID'),
              headerCell('Weakness'),
              headerCell('Severity'),
              headerCell('Status'),
              headerCell('Responsible Office'),
              headerCell('Target Date'),
            ],
          }),
          ...openItems.map(
            (p, i) =>
              new TableRow({
                children: [
                  dataCell(p.poamId, i % 2 === 0 ? ALT_SHADE : undefined),
                  dataCell(p.weakness, i % 2 === 0 ? ALT_SHADE : undefined),
                  dataCell(p.severity, i % 2 === 0 ? ALT_SHADE : undefined),
                  dataCell(p.status, i % 2 === 0 ? ALT_SHADE : undefined),
                  dataCell(p.responsibleOffice || '—', i % 2 === 0 ? ALT_SHADE : undefined),
                  dataCell(formatDate(p.scheduledCompletionDate), i % 2 === 0 ? ALT_SHADE : undefined),
                ],
              })
          ),
        ],
      })
    )
  } else {
    children.push(spacer())
    children.push(body('No open or in-progress POAM items at the time of this report.'))
  }

  // ── Build Document ──────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                },
              },
            },
          ],
        },
        {
          reference: NUMBER_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
              right: convertInchesToTwip(1.25),
            },
          },
        },
        ...(marking
          ? {
              headers: {
                default: new Header({ children: [classificationPara()] }),
              },
              footers: {
                default: new Footer({ children: [classificationPara()] }),
              },
            }
          : {}),
        children,
      },
    ],
  })

  // ── Download ────────────────────────────────────────────────────────────────
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${system.abbreviation}-SSP-${new Date().toISOString().split('T')[0]}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
