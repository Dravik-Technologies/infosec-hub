import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'

const { xml2js } = require('xml-js') as {
  xml2js: (xml: string, options?: Record<string, unknown>) => XmlDocument
}

type TargetBaseline = 'LOW' | 'MODERATE' | 'HIGH'
type BaselineField = 'lowBaseline' | 'modBaseline' | 'highBaseline'

interface ParsedControl {
  controlId: string
  family: string
  title: string
  description: string
}

interface JsonControl {
  id?: string
  title?: string
  props?: Array<{ name?: string; value?: string; class?: string }>
  parts?: JsonPart[]
  controls?: JsonControl[]
  groups?: JsonNode[]
}

interface JsonPart {
  name?: string
  prose?: string
  parts?: JsonPart[]
}

interface JsonNode {
  controls?: JsonControl[]
  groups?: JsonNode[]
  imports?: JsonImport[]
}

interface JsonImport {
  'include-controls'?: Array<{
    'with-ids'?: string[]
  }>
}

interface XmlDocument {
  elements?: XmlElement[]
}

interface XmlElement {
  type?: string
  name?: string
  text?: string
  attributes?: Record<string, string>
  elements?: XmlElement[]
}

const BASELINE_FIELDS: Record<TargetBaseline, BaselineField> = {
  LOW: 'lowBaseline',
  MODERATE: 'modBaseline',
  HIGH: 'highBaseline',
}

export async function importOscal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file
    if (!file) throw new AppError('OSCAL file is required. Upload it using the "file" field.', 400)

    const targetBaseline = parseTargetBaseline(req.body.baseline ?? req.body.targetBaseline)
    const parsedControls = parseOscalFile(file)
    const uniqueControls = dedupeControls(parsedControls)

    if (uniqueControls.length === 0) {
      throw new AppError('No controls found in the uploaded OSCAL catalog or profile.', 400)
    }

    const baselineField = BASELINE_FIELDS[targetBaseline]
    const controlIds = uniqueControls.map((control) => control.controlId)
    const existing = await prisma.control.findMany({
      where: { controlId: { in: controlIds } },
      select: { controlId: true },
    })
    const existingIds = new Set(existing.map((control) => control.controlId))

    await prisma.$transaction(async (tx) => {
      await tx.control.updateMany({
        where: { controlId: { contains: '-' } },
        data: { [baselineField]: false } as Prisma.ControlUpdateManyMutationInput,
      })

      for (const control of uniqueControls) {
        await tx.control.upsert({
          where: { controlId: control.controlId },
          create: {
            controlId: control.controlId,
            family: control.family,
            title: control.title,
            description: control.description,
            lowBaseline: targetBaseline === 'LOW',
            modBaseline: targetBaseline === 'MODERATE',
            highBaseline: targetBaseline === 'HIGH',
          },
          update: {
            family: control.family,
            title: control.title,
            description: control.description,
            [baselineField]: true,
          } as Prisma.ControlUpdateInput,
        })
      }
    })

    const controlsUpdated = uniqueControls.filter((control) => existingIds.has(control.controlId)).length
    const controlsAdded = uniqueControls.length - controlsUpdated

    res.json({
      baseline: targetBaseline,
      controlsUpdated,
      controlsAdded,
      totalControls: uniqueControls.length,
      importedControlIds: controlIds,
      message: `${controlsUpdated} controls updated, ${controlsAdded} new controls added`,
    })
  } catch (err) {
    next(err)
  }
}

function parseTargetBaseline(value: unknown): TargetBaseline {
  const baseline = String(value ?? '').toUpperCase()
  if (baseline === 'LOW' || baseline === 'MODERATE' || baseline === 'HIGH') return baseline
  throw new AppError('Target baseline must be LOW, MODERATE, or HIGH.', 400)
}

function parseOscalFile(file: Express.Multer.File): ParsedControl[] {
  const extension = file.originalname.split('.').pop()?.toLowerCase()
  const content = file.buffer.toString('utf8')

  if (extension === 'json' || file.mimetype === 'application/json') {
    return parseJsonOscal(content)
  }

  if (
    extension === 'xml' ||
    file.mimetype === 'application/xml' ||
    file.mimetype === 'text/xml' ||
    file.mimetype === 'application/octet-stream'
  ) {
    return parseXmlOscal(content)
  }

  throw new AppError('Unsupported OSCAL file type. Upload a .json or .xml file.', 400)
}

function parseJsonOscal(content: string): ParsedControl[] {
  let document: unknown
  try {
    document = JSON.parse(content)
  } catch {
    throw new AppError('Uploaded JSON is not valid.', 400)
  }

  const root = getJsonRoot(document)
  const controls = collectJsonControls(root).filter((control) => !isJsonWithdrawn(control))

  if (controls.length > 0) {
    return controls.map((control) => {
      const controlId = getJsonControlLabel(control)
      return {
        controlId,
        family: getFamily(controlId),
        title: control.title || controlId,
        description: getJsonDescription(control, controlId),
      }
    })
  }

  return collectJsonProfileControlIds(root).map((controlId) => ({
    controlId,
    family: getFamily(controlId),
    title: controlId,
    description: `Imported from OSCAL profile: ${controlId}`,
  }))
}

function parseXmlOscal(content: string): ParsedControl[] {
  let document: XmlDocument
  try {
    document = xml2js(content, { compact: false, trim: true })
  } catch {
    throw new AppError('Uploaded XML is not valid.', 400)
  }

  const root = document.elements?.find((element) => element.type === 'element')
  if (!root) throw new AppError('Uploaded XML does not contain an OSCAL document.', 400)

  const controls = collectXmlControls(root).filter((control) => !isXmlWithdrawn(control))

  if (controls.length > 0) {
    return controls.map((control) => {
      const controlId = getXmlControlLabel(control)
      return {
        controlId,
        family: getFamily(controlId),
        title: getChildText(control, 'title') || controlId,
        description: getXmlDescription(control, controlId),
      }
    })
  }

  return collectXmlProfileControlIds(root).map((controlId) => ({
    controlId,
    family: getFamily(controlId),
    title: controlId,
    description: `Imported from OSCAL profile: ${controlId}`,
  }))
}

function getJsonRoot(document: unknown): JsonNode {
  if (!document || typeof document !== 'object') throw new AppError('Uploaded file is not an OSCAL document.', 400)
  const record = document as Record<string, JsonNode>
  return record.catalog ?? record.profile ?? record['resolved-profile'] ?? (document as JsonNode)
}

function collectJsonControls(node: JsonNode | JsonControl | undefined, controls: JsonControl[] = []): JsonControl[] {
  for (const control of node?.controls ?? []) {
    controls.push(control)
    collectJsonControls(control, controls)
  }

  for (const group of node?.groups ?? []) collectJsonControls(group, controls)
  return controls
}

function collectJsonProfileControlIds(node: JsonNode): string[] {
  const ids = new Set<string>()

  for (const item of node.imports ?? []) {
    for (const include of item['include-controls'] ?? []) {
      for (const id of include['with-ids'] ?? []) ids.add(formatOscalId(id))
    }
  }

  return Array.from(ids)
}

function getJsonControlLabel(control: JsonControl) {
  const label = control.props?.find((prop) => prop.name === 'label' && prop.class === undefined)?.value
  return label ?? formatOscalId(control.id ?? '')
}

function isJsonWithdrawn(control: JsonControl) {
  return control.props?.some((prop) => prop.name === 'status' && prop.value === 'withdrawn') ?? false
}

function getJsonDescription(control: JsonControl, controlId: string) {
  const statement = collectJsonPartText(control.parts, 'statement')
  const guidance = collectJsonPartText(control.parts, 'guidance')
  return truncate(statement || guidance || `Imported from OSCAL: ${control.title ?? controlId}`)
}

function collectJsonPartText(parts: JsonPart[] | undefined, preferredName: string): string {
  const chunks: string[] = []

  function visit(part: JsonPart, collecting = false) {
    const shouldCollect = collecting || part.name === preferredName
    if (shouldCollect && part.prose) chunks.push(part.prose)
    for (const child of part.parts ?? []) visit(child, shouldCollect)
  }

  for (const part of parts ?? []) visit(part)
  return cleanText(chunks.join(' '))
}

function collectXmlControls(node: XmlElement, controls: XmlElement[] = []): XmlElement[] {
  for (const element of node.elements ?? []) {
    if (element.type !== 'element') continue
    if (element.name === 'control') controls.push(element)
    collectXmlControls(element, controls)
  }

  return controls
}

function collectXmlProfileControlIds(node: XmlElement): string[] {
  const ids = new Set<string>()

  function visit(element: XmlElement) {
    if (element.name === 'with-id') {
      const id = getElementText(element)
      if (id) ids.add(formatOscalId(id))
    }

    for (const child of element.elements ?? []) {
      if (child.type === 'element') visit(child)
    }
  }

  visit(node)
  return Array.from(ids)
}

function getXmlControlLabel(control: XmlElement) {
  const prop = control.elements?.find(
    (element) =>
      element.type === 'element' &&
      element.name === 'prop' &&
      element.attributes?.name === 'label' &&
      element.attributes.class === undefined,
  )

  return prop?.attributes?.value ?? formatOscalId(control.attributes?.id ?? '')
}

function isXmlWithdrawn(control: XmlElement) {
  return (
    control.elements?.some(
      (element) =>
        element.type === 'element' &&
        element.name === 'prop' &&
        element.attributes?.name === 'status' &&
        element.attributes.value === 'withdrawn',
    ) ?? false
  )
}

function getXmlDescription(control: XmlElement, controlId: string) {
  const statement = collectXmlPartText(control, 'statement')
  const guidance = collectXmlPartText(control, 'guidance')
  return truncate(statement || guidance || `Imported from OSCAL: ${getChildText(control, 'title') || controlId}`)
}

function collectXmlPartText(control: XmlElement, partName: string) {
  const chunks: string[] = []

  function visit(element: XmlElement) {
    if (element.type !== 'element') return
    if (element.name === 'part' && element.attributes?.name === partName) {
      chunks.push(getElementText(element))
      return
    }

    for (const child of element.elements ?? []) visit(child)
  }

  for (const child of control.elements ?? []) visit(child)
  return cleanText(chunks.join(' '))
}

function getChildText(element: XmlElement, childName: string) {
  const child = element.elements?.find((item) => item.type === 'element' && item.name === childName)
  return child ? getElementText(child) : ''
}

function getElementText(element: XmlElement): string {
  const chunks: string[] = []

  function visit(node: XmlElement) {
    if (node.type === 'text' && node.text) chunks.push(node.text)
    for (const child of node.elements ?? []) visit(child)
  }

  visit(element)
  return cleanText(chunks.join(' '))
}

function formatOscalId(id: string) {
  const normalized = id.trim().toLowerCase()
  const match = normalized.match(/^([a-z]{2})-(\d+)(?:\.(\d+))?$/)
  if (!match) return normalized.toUpperCase()

  const [, family, controlNumber, enhancement] = match
  const base = `${family.toUpperCase()}-${Number(controlNumber)}`
  return enhancement ? `${base}(${Number(enhancement)})` : base
}

function getFamily(controlId: string) {
  return controlId.split('-')[0]?.toUpperCase() ?? 'UNKNOWN'
}

function cleanText(value: string) {
  return value
    .replace(/\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}/g, '[$1]')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value: string, maxLength = 2000) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

function dedupeControls(controls: ParsedControl[]) {
  const byId = new Map<string, ParsedControl>()

  for (const control of controls) {
    if (!control.controlId) continue
    byId.set(control.controlId, control)
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.controlId.localeCompare(b.controlId, undefined, { numeric: true }),
  )
}
