import { xml2js } from 'xml-js'
import { AppError } from '../utils/errors'

type Severity = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
type FindingStatus = 'OPEN' | 'IN_REMEDIATION' | 'CLOSED' | 'RISK_ACCEPTED'

export interface ImportedStigFinding {
  id: string
  controlId: string
  description: string
  severity: Severity
  status: FindingStatus
  evidence?: string
  recommendation?: string
}

export interface StigImportResult {
  sourceType: 'CKL' | 'XCCDF'
  sourceName?: string
  findings: ImportedStigFinding[]
  parsedCount: number
  skippedCount: number
}

export class StigImportService {
  parse(buffer: Buffer, fileName: string): StigImportResult {
    const xml = buffer.toString('utf8').replace(/^\uFEFF/, '').trim()
    if (!xml) throw new AppError('Checklist file is empty', 400)

    let parsed: unknown
    try {
      parsed = xml2js(xml, { compact: false, trim: true, alwaysChildren: true })
    } catch {
      throw new AppError('Unable to parse checklist XML. Upload a valid .ckl or XCCDF XML file.', 400)
    }

    const rootName = firstElement(parsed)?.name?.toLowerCase() ?? ''
    if (rootName === 'checklist') return parseCkl(parsed, fileName)
    return parseXccdf(parsed, fileName)
  }
}

function parseCkl(parsed: unknown, fileName: string): StigImportResult {
  const vulns = findElements(parsed, 'VULN')
  const findings: ImportedStigFinding[] = []
  let skippedCount = 0

  for (const vuln of vulns) {
    const status = textOfFirstChild(vuln, 'STATUS').toUpperCase()
    if (!isFindingStatus(status)) {
      skippedCount += 1
      continue
    }

    const data = stigDataMap(vuln)
    const vulnId = data.Vuln_Num || data.Rule_ID || data.Rule_Ver || `ckl-${findings.length + 1}`
    const ruleTitle = data.Rule_Title || data.Group_Title || 'STIG finding'
    const severity = mapCklSeverity(data.Severity)
    const controlId = extractControlId([data.IA_Controls, data.CCI_REF, data.Vuln_Discuss, data.Check_Content, ruleTitle])
    const comments = textOfFirstChild(vuln, 'COMMENTS')
    const findingDetails = textOfFirstChild(vuln, 'FINDING_DETAILS')
    const evidenceParts = [
      `Checklist status: ${status}`,
      data.Rule_ID ? `Rule ID: ${data.Rule_ID}` : '',
      data.STIGRef ? `STIG: ${data.STIGRef}` : '',
      findingDetails ? `Finding details: ${findingDetails}` : '',
      comments ? `Assessor comments: ${comments}` : '',
    ].filter(Boolean)

    findings.push({
      id: stableFindingId('ckl', vulnId),
      controlId,
      description: `${ruleTitle}: ${data.Vuln_Discuss || data.Check_Content || 'Open STIG checklist item requires assessor review.'}`,
      severity,
      status: status === 'NOT_REVIEWED' ? 'IN_REMEDIATION' : 'OPEN',
      evidence: evidenceParts.join('\n'),
      recommendation: data.Fix_Text || data.Check_Content || undefined,
    })
  }

  return {
    sourceType: 'CKL',
    sourceName: fileName,
    findings,
    parsedCount: vulns.length,
    skippedCount,
  }
}

function parseXccdf(parsed: unknown, fileName: string): StigImportResult {
  const ruleResults = findElements(parsed, 'rule-result')
  const rules = new Map(findElements(parsed, 'Rule').map((rule) => [attr(rule, 'id'), rule]))
  const findings: ImportedStigFinding[] = []
  let skippedCount = 0

  for (const result of ruleResults) {
    const resultText = textOfFirstChild(result, 'result').toLowerCase()
    if (!['fail', 'error', 'unknown', 'notchecked'].includes(resultText)) {
      skippedCount += 1
      continue
    }

    const ruleId = attr(result, 'idref') || `xccdf-${findings.length + 1}`
    const rule = rules.get(ruleId)
    const title = rule ? textOfFirstChild(rule, 'title') : ruleId
    const description = cleanXmlText(rule ? textOfFirstChild(rule, 'description') : '')
    const fix = rule ? textOfFirstChild(rule, 'fixtext') : ''
    const check = rule ? textOfFirstChild(rule, 'check-content') : ''
    const severity = mapXccdfSeverity(attr(rule, 'severity') || attr(result, 'severity'))
    const controlId = extractControlId([ruleId, title, description, fix, check])

    findings.push({
      id: stableFindingId('xccdf', ruleId),
      controlId,
      description: `${title || ruleId}: ${description || 'Failed XCCDF rule requires assessor review.'}`,
      severity,
      status: resultText === 'fail' || resultText === 'error' ? 'OPEN' : 'IN_REMEDIATION',
      evidence: [`XCCDF result: ${resultText}`, `Rule ID: ${ruleId}`].join('\n'),
      recommendation: fix || check || undefined,
    })
  }

  return {
    sourceType: 'XCCDF',
    sourceName: fileName,
    findings,
    parsedCount: ruleResults.length,
    skippedCount,
  }
}

function isFindingStatus(status: string) {
  return status === 'OPEN' || status === 'NOT_REVIEWED'
}

function stigDataMap(vuln: XmlElement) {
  const map: Record<string, string> = {}
  for (const item of childrenNamed(vuln, 'STIG_DATA')) {
    const key = textOfFirstChild(item, 'VULN_ATTRIBUTE')
    const value = textOfFirstChild(item, 'ATTRIBUTE_DATA')
    if (key) map[key] = value
  }
  return map
}

function mapCklSeverity(value: string): Severity {
  const normalized = value.toLowerCase()
  if (normalized.includes('high') || normalized.includes('cat i')) return 'HIGH'
  if (normalized.includes('medium') || normalized.includes('cat ii')) return 'MODERATE'
  if (normalized.includes('low') || normalized.includes('cat iii')) return 'LOW'
  return 'MODERATE'
}

function mapXccdfSeverity(value: string): Severity {
  const normalized = value.toLowerCase()
  if (normalized === 'high') return 'HIGH'
  if (normalized === 'medium') return 'MODERATE'
  if (normalized === 'low') return 'LOW'
  return 'MODERATE'
}

function extractControlId(values: Array<string | undefined>) {
  const joined = values.filter(Boolean).join(' ')
  const match = joined.match(/\b[A-Z]{2,3}-\d+(?:\(\d+\))?\b/)
  return match?.[0] ?? 'RA-5'
}

function stableFindingId(prefix: string, value: string) {
  return `${prefix}-${value}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
}

function findElements(node: unknown, name: string): XmlElement[] {
  const results: XmlElement[] = []
  const visit = (current: unknown) => {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    if (!isElement(current)) return
    if (current.name === name) results.push(current)
    current.elements?.forEach(visit)
  }
  visit(node)
  return results
}

function firstElement(node: unknown): XmlElement | undefined {
  if (isElement(node)) return node
  if (isDocument(node)) return node.elements?.find(isElement)
  return undefined
}

function childrenNamed(node: XmlElement, name: string) {
  return (node.elements ?? []).filter((child): child is XmlElement => isElement(child) && child.name === name)
}

function textOfFirstChild(node: XmlElement | undefined, name: string) {
  if (!node) return ''
  const child = childrenNamed(node, name)[0]
  return textOf(child)
}

function textOf(node: XmlElement | undefined): string {
  if (!node) return ''
  return (node.elements ?? [])
    .map((child) => {
      if (isText(child)) return child.text
      if (isElement(child)) return textOf(child)
      return ''
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function attr(node: XmlElement | undefined, key: string) {
  const value = node?.attributes?.[key]
  return typeof value === 'string' ? value : ''
}

function cleanXmlText(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

interface XmlDocument {
  elements?: unknown[]
}

interface XmlElement {
  type: 'element'
  name: string
  attributes?: Record<string, unknown>
  elements?: unknown[]
}

interface XmlText {
  type: 'text' | 'cdata'
  text: string
}

function isDocument(value: unknown): value is XmlDocument {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as XmlDocument).elements))
}

function isElement(value: unknown): value is XmlElement {
  return Boolean(value && typeof value === 'object' && (value as XmlElement).type === 'element' && typeof (value as XmlElement).name === 'string')
}

function isText(value: unknown): value is XmlText {
  return Boolean(value && typeof value === 'object' && ((value as XmlText).type === 'text' || (value as XmlText).type === 'cdata') && typeof (value as XmlText).text === 'string')
}
