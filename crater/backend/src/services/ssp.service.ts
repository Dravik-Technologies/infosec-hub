/**
 * Professional System Security Plan generator.
 *
 * Produces an auditor-ready .docx SSP aligned to NIST SP 800-18 Rev. 1 and
 * modern RMF authorization packages. The document is generated entirely from
 * live Crater project data: RMF wizard steps, selected controls, diagrams,
 * project membership, and POA&M records.
 */

import fs from 'fs'
import path from 'path'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { ControlStatus, ImpactLevel, Prisma, Role, StepStatus } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import { BestPracticesService, type BestPracticeEntry } from './best-practices.service'

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads')
const DEFAULT_OLLAMA_URL = 'http://ollama:11434'
const DEFAULT_AI_MODEL = 'llama3.1:8b'

const COLOR_NAVY = '14335A'
const COLOR_CYAN = '00D4FF'
const COLOR_WHITE = 'FFFFFF'
const COLOR_GRAY = 'EEF2F6'
const COLOR_DARK = '1F2937'
const COLOR_RED = 'B91C1C'

const STEP_NAMES: Record<number, string> = {
  0: 'Prepare',
  1: 'Categorize',
  2: 'Select',
  3: 'Implement',
  4: 'Assess',
  5: 'Authorize',
  6: 'Monitor',
}

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_OWNER: 'System Owner',
  ISSO: 'Information System Security Officer (ISSO)',
  ISSM: 'Information System Security Manager (ISSM)',
  ISSE: 'Information System Security Engineer (ISSE)',
  SCA: 'Security Control Assessor (SCA)',
  AO: 'Authorizing Official (AO)',
  DAO: 'Delegated Authorizing Official (DAO)',
  ADMIN: 'Administrator',
}

const CONTROL_STATUS_LABELS: Record<ControlStatus, string> = {
  NOT_IMPLEMENTED: 'Not Implemented',
  PLANNED: 'Planned',
  PARTIALLY_IMPLEMENTED: 'Partially Implemented',
  IMPLEMENTED: 'Implemented',
  NOT_APPLICABLE: 'Not Applicable',
}

const EMBEDDABLE_MIMES: Record<string, 'png' | 'jpg' | 'gif' | 'bmp'> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
}

interface Step0Data {
  roles?: Record<string, string>
  riskTolerance?: string
  organizationalContext?: string
  boundaryConfirmation?: string
  diagrams?: unknown[]
}

interface Step1Data {
  confirmedImpactLevel?: ImpactLevel
  impactJustification?: string
  objectiveJustification?: string
  ciaNotes?: string
  calculatedImpact?: {
    confidentiality?: string
    integrity?: string
    availability?: string
    overall?: string
  }
  selectedInformationTypes?: Array<{
    id?: string
    name?: string
    title?: string
    family?: string
    description?: string
    confidentiality?: string
    integrity?: string
    availability?: string
  }>
}

type TailoringAction = 'BASELINE' | 'ADDED' | 'REMOVED'

interface Step2Data {
  impactLevel?: ImpactLevel
  jsigOverlay?: boolean
  selectedControlIds?: string[]
  baselineControlIds?: string[]
  overlayControlIds?: string[]
  tailoring?: Record<string, {
    action?: TailoringAction
    justification?: string
    inherited?: boolean
    inheritedFrom?: string
  }>
  selectedControls?: Array<{
    controlId: string
    action?: TailoringAction
    inherited?: boolean
    inheritedFrom?: string
    justification?: string
  }>
  removedControls?: Array<{
    controlId: string
    justification?: string
  }>
  summary?: {
    baseline?: number
    selected?: number
    added?: number
    removed?: number
    inherited?: number
    jsig?: number
  }
  notes?: string
}

interface Step3Data {
  implementations?: Record<string, Partial<Step3ImplementationRecord>>
  controls?: Record<string, Partial<Step3ImplementationRecord>>
  summary?: {
    total?: number
    implemented?: number
    partial?: number
    planned?: number
    inherited?: number
    documented?: number
    percent?: number
  }
  notes?: string
}

interface Step3ImplementationRecord {
  status?: ControlStatus | string
  implementationStatement?: string
  statement?: string
  inherited?: boolean
  inheritedFrom?: string
  evidenceNotes?: string
  aiGenerated?: boolean
  aiGeneratedAt?: string
}

interface SspOptions {
  includeDiagrams?: boolean
}

export interface SspResult {
  buffer: Buffer
  filename: string
}

type ProjectForSsp = NonNullable<Awaited<ReturnType<typeof loadProjectForSsp>>>

async function loadProjectForSsp(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
      rmfSteps: { orderBy: { stepNumber: 'asc' } },
      diagrams: { orderBy: [{ type: 'asc' }, { createdAt: 'asc' }] },
      artifacts: { orderBy: [{ type: 'asc' }, { createdAt: 'asc' }] },
      inventoryItems: { orderBy: [{ itemType: 'asc' }, { item: 'asc' }] },
      ppsmEntries: { orderBy: [{ protocol: 'asc' }, { port: 'asc' }, { serviceApplication: 'asc' }] },
      poamItems: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] },
      controlInstances: {
        include: { control: true },
        orderBy: [{ controlId: 'asc' }],
      },
      _count: { select: { controlInstances: true, diagrams: true, artifacts: true, inventoryItems: true, ppsmEntries: true, poamItems: true } },
    },
  })
}

export class SspService {
  private readonly bestPractices = BestPracticesService.getInstance()

  async generate(projectId: string, userId: string, userRole: Role, options: SspOptions = {}): Promise<SspResult> {
    const project = await loadProjectForSsp(projectId)
    if (!project) throw new AppError('Project not found', 404)

    if (userRole !== Role.ADMIN && project.ownerId !== userId && !project.members.some((member) => member.userId === userId)) {
      throw new AppError('You do not have access to this project', 403)
    }

    const includeDiagrams = options.includeDiagrams ?? true
    const step0 = getStepData<Step0Data>(project, 0)
    const step1 = getStepData<Step1Data>(project, 1)
    const step2 = getStepData<Step2Data>(project, 2)
    const step3 = getStepData<Step3Data>(project, 3)
    const impactLevel = step1.confirmedImpactLevel ?? step2.impactLevel ?? project.impactLevel
    const generatedAt = new Date()
    const generatedDate = isoDate(generatedAt)
    const ownerName = personName(project.owner)

    const selectedControlIds = unique([
      ...(step2.selectedControlIds ?? []),
      ...(step2.selectedControls?.map((control) => control.controlId) ?? []),
    ])
    const removedControlIds = new Set(step2.removedControls?.map((control) => control.controlId) ?? [])
    const allRelevantControlIds = unique([
      ...selectedControlIds,
      ...(step2.baselineControlIds ?? []),
      ...Array.from(removedControlIds),
    ])

    this.bestPractices.warmup()

    const controls = allRelevantControlIds.length
      ? await prisma.control.findMany({ where: { controlId: { in: allRelevantControlIds } } })
      : []
    const controlMap = new Map(controls.map((control) => [control.controlId, control]))
    const instanceMap = new Map(project.controlInstances.map((instance) => [instance.controlId, instance]))
    const step3Map = buildStep3Map(step3)
    const controlRows = buildControlRows(step2, step3, selectedControlIds, controlMap, instanceMap, step3Map, this.bestPractices)

    const baselineCount = step2.summary?.baseline ?? step2.baselineControlIds?.length ?? 0
    const selectedCount = step2.summary?.selected ?? selectedControlIds.length
    const addedCount = step2.summary?.added ?? controlRows.filter((row) => row.action === 'ADDED').length
    const removedCount = step2.summary?.removed ?? removedControlIds.size
    const inheritedCount = step2.summary?.inherited ?? controlRows.filter((row) => row.inherited).length
    const jsigCount = step2.summary?.jsig ?? step2.overlayControlIds?.length ?? 0
    const openPoams = project.poamItems.filter((item) => item.status === 'OPEN' || item.status === 'IN_REMEDIATION')
    const executiveSummary = await buildExecutiveSummary({
      project,
      step0,
      step1,
      step2,
      step3,
      impactLevel,
      baselineCount,
      selectedCount,
      addedCount,
      removedCount,
      inheritedCount,
      jsigCount,
      openPoamCount: openPoams.length,
      controlRows,
    })

    const children: Array<Paragraph | Table> = [
      ...coverPage(project, ownerName, impactLevel, generatedAt),
      pageBreak(),
      ...section1ExecutiveSummary(executiveSummary),
      pageBreak(),
      ...section2Metadata(project, ownerName, impactLevel, generatedAt),
      pageBreak(),
      ...section3Description(project, step0),
      pageBreak(),
      ...section4Roles(project, step0),
      pageBreak(),
      ...section5Categorization(project, step1, impactLevel),
      pageBreak(),
      ...section6InformationTypes(step1),
      pageBreak(),
      ...section7ControlSummary({
        step2,
        step3,
        controlRows,
        baselineCount,
        selectedCount,
        addedCount,
        removedCount,
        inheritedCount,
        jsigCount,
      }),
      pageBreak(),
      ...section8Diagrams(project, includeDiagrams),
      pageBreak(),
      ...section9Artifacts(project),
      pageBreak(),
      ...section10Inventory(project),
      pageBreak(),
      ...section11Ppsm(project),
      pageBreak(),
      ...section12RiskAndContext(step0),
      pageBreak(),
      ...section13PoamSummary(project, openPoams),
      pageBreak(),
      ...section14RmfStatus(project),
      pageBreak(),
      ...approvalPage(),
    ]

    const doc = new Document({
      creator: 'Crater RMF Tool',
      lastModifiedBy: ownerName,
      title: `System Security Plan - ${project.name}`,
      subject: 'System Security Plan',
      description: `Auditor-ready SSP generated for ${project.name} on ${fmtDate(generatedAt)}.`,
      keywords: 'SSP, RMF, NIST SP 800-18, NIST 800-53, FIPS 199, ATO',
      sections: [
        {
          headers: { default: documentHeader(project.name, generatedDate) },
          footers: { default: documentFooter() },
          children,
        },
      ],
    })

    return {
      buffer: await Packer.toBuffer(doc),
      filename: `CRATER-${sanitizeFilename(project.name)}-SSP-${generatedDate}.docx`,
    }
  }
}

function coverPage(project: ProjectForSsp, ownerName: string, impactLevel: ImpactLevel, generatedAt: Date) {
  return [
    new Paragraph({ spacing: { before: 2200 }, children: [] }),
    centered('SYSTEM SECURITY PLAN', 56, true, COLOR_NAVY),
    centered(project.name, 38, true, COLOR_DARK),
    new Paragraph({ spacing: { after: 280 }, children: [] }),
    simpleTable(
      [{ text: 'Field', width: 38 }, { text: 'Value', width: 62 }],
      [
        ['System Name', project.name],
        ['Document Version', '1.0'],
        ['Prepared By', 'Crater RMF Command Center'],
        ['System Owner', `${ownerName} (${project.owner.email})`],
        ['FIPS 199 Impact Level', fmtImpact(impactLevel)],
        ['Authorization Status', fmtEnum(project.status)],
        ['Generated', fmtDate(generatedAt)],
        ['Primary References', 'NIST SP 800-18 Rev. 1; NIST SP 800-37 Rev. 2; FIPS 199; NIST SP 800-53 Rev. 5'],
      ],
    ),
    new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: 'CONTROLLED UNCLASSIFIED INFORMATION (CUI) - FOR OFFICIAL USE ONLY', bold: true, color: COLOR_RED, size: 20 }),
    ] }),
  ]
}

function section1ExecutiveSummary(summary: string) {
  return [
    h1('1. Executive Summary'),
    aiAssistedNotice('This executive summary was generated by Crater using project RMF data, saved implementation statements, and curated best-practice guidance. It should be reviewed by the ISSO and System Owner before package submission.'),
    p(summary),
  ]
}

function section2Metadata(project: ProjectForSsp, ownerName: string, impactLevel: ImpactLevel, generatedAt: Date) {
  return [
    h1('2. System Identification & Metadata'),
    simpleTable(
      [{ text: 'Metadata Element', width: 35 }, { text: 'Value', width: 65 }],
      [
        ['System Name', project.name],
        ['System Identifier', project.id],
        ['System Owner', `${ownerName} (${project.owner.email})`],
        ['Project Status', fmtEnum(project.status)],
        ['Impact Level', fmtImpact(impactLevel)],
        ['ATO Expiration', project.atoExpiry ? fmtDate(project.atoExpiry) : 'Not yet authorized'],
        ['Created', fmtDate(project.createdAt)],
        ['Last Updated', fmtDate(project.updatedAt)],
        ['SSP Generated', fmtDate(generatedAt)],
        ['Control Count', String(project._count.controlInstances)],
        ['Diagram Count', String(project._count.diagrams)],
        ['Inventory Item Count', String(project._count.inventoryItems)],
        ['PPSM Entry Count', String(project._count.ppsmEntries)],
        ['POA&M Count', String(project._count.poamItems)],
      ],
    ),
  ]
}

function section3Description(project: ProjectForSsp, step0: Step0Data) {
  return [
    h1('3. System Description & Authorization Boundary'),
    h2('3.1 System Description'),
    p(project.description ?? 'No system description has been documented.'),
    h2('3.2 Authorization Boundary'),
    p(step0.boundaryConfirmation ?? project.authBoundary ?? 'Authorization boundary has not been confirmed.'),
    h2('3.3 Boundary Statement'),
    p('The authorization boundary defines the information system components, interfaces, users, interconnections, data flows, and inherited services that are included in the scope of this authorization package. Boundary artifacts should be validated against uploaded architecture, network, data flow, and rack diagrams.'),
  ]
}

function section4Roles(project: ProjectForSsp, step0: Step0Data) {
  const roles = step0.roles ?? {}
  const rows = [
    ['System Owner', resolveRoleValue(project, roles.systemOwner) || personName(project.owner)],
    ['ISSO', resolveRoleValue(project, roles.isso) || resolveRoleValue(project, roles.rmfPractitioner)],
    ['ISSM', resolveRoleValue(project, roles.issm)],
    ['ISSE', resolveRoleValue(project, roles.isse)],
    ['SCA / SCAR', resolveRoleValue(project, roles.sca) || resolveRoleValue(project, roles.scar)],
    ['Authorizing Official (AO)', resolveRoleValue(project, roles.ao) || resolveRoleValue(project, roles.authorizingOfficial)],
    ['Delegated Authorizing Official (DAO)', resolveRoleValue(project, roles.dao)],
  ]

  return [
    h1('4. Roles and Responsibilities'),
    p('The following personnel and organizational roles are responsible for preparing, reviewing, assessing, maintaining, and authorizing this information system. Names are sourced from RMF Step 0 where available.'),
    simpleTable([{ text: 'Role', width: 36 }, { text: 'Assigned Person / Contact', width: 64 }], rows.map(([role, name]) => [role, name || 'Not assigned'])),
    h2('4.1 Project Members'),
    simpleTable(
      [
        { text: 'Name', width: 30 },
        { text: 'Email', width: 45 },
        { text: 'Platform Role', width: 25 },
      ],
      project.members.map((member) => [personName(member.user), member.user.email, ROLE_LABELS[member.role] ?? member.role]),
    ),
  ]
}

function section5Categorization(project: ProjectForSsp, step1: Step1Data, impactLevel: ImpactLevel) {
  const calc = step1.calculatedImpact

  return [
    h1('5. FIPS 199 Categorization + CIA Justification'),
    simpleTable(
      [{ text: 'Objective', width: 34 }, { text: 'Impact', width: 22 }, { text: 'Justification Source', width: 44 }],
      [
        ['Confidentiality', calc?.confidentiality ?? fmtImpact(impactLevel), 'Step 1 categorization data'],
        ['Integrity', calc?.integrity ?? fmtImpact(impactLevel), 'Step 1 categorization data'],
        ['Availability', calc?.availability ?? fmtImpact(impactLevel), 'Step 1 categorization data'],
        ['Overall', calc?.overall ?? fmtImpact(step1.confirmedImpactLevel ?? project.impactLevel), 'FIPS 199 high water mark'],
      ],
    ),
    h2('5.1 Impact Justification'),
    p(step1.impactJustification ?? step1.objectiveJustification ?? 'Categorization justification has not been documented.'),
    h2('5.2 CIA Notes'),
    p(step1.ciaNotes ?? step1.objectiveJustification ?? 'CIA objective notes have not been documented.'),
  ]
}

function section6InformationTypes(step1: Step1Data) {
  const infoTypes = step1.selectedInformationTypes ?? []

  return [
    h1('6. Information Types'),
    p('Information types are selected in accordance with NIST SP 800-60 and support the system security categorization decision.'),
    ...(infoTypes.length
      ? [
          simpleTable(
            [
              { text: 'ID', width: 12 },
              { text: 'Information Type', width: 26 },
              { text: 'Family', width: 20 },
              { text: 'C', width: 10 },
              { text: 'I', width: 10 },
              { text: 'A', width: 10 },
              { text: 'Description', width: 12 },
            ],
            infoTypes.map((item) => [
              item.id ?? '—',
              item.name ?? item.title ?? 'Unnamed',
              item.family ?? '—',
              item.confidentiality ?? '—',
              item.integrity ?? '—',
              item.availability ?? '—',
              item.description ?? '—',
            ]),
          ),
        ]
      : [p('No information types have been selected.')]),
  ]
}

function section7ControlSummary(input: {
  step2: Step2Data
  step3: Step3Data
  controlRows: ControlRow[]
  baselineCount: number
  selectedCount: number
  addedCount: number
  removedCount: number
  inheritedCount: number
  jsigCount: number
}) {
  const { step2, step3, controlRows, baselineCount, selectedCount, addedCount, removedCount, inheritedCount, jsigCount } = input
  const aiGeneratedCount = controlRows.filter((row) => row.aiGenerated).length
  const bestPracticeCount = controlRows.filter((row) => row.bestPracticeStatement).length
  const implementationPercent = step3.summary?.percent ?? calculateImplementationPercent(controlRows)

  return [
    h1('7. Control Implementation Summary'),
    p('This section summarizes the selected NIST SP 800-53 Rev. 5 control baseline, tailoring decisions, inherited controls, implementation posture, curated best-practice guidance, and AI-assisted implementation content for the system.'),
    h2('7.1 Baseline, Tailoring, and Implementation Metrics'),
    simpleTable(
      [{ text: 'Metric', width: 55 }, { text: 'Value', width: 45 }],
      [
        ['Target Baseline', step2.impactLevel ?? 'Project impact level'],
        ['Baseline Controls', String(baselineCount)],
        ['Selected Controls', String(selectedCount)],
        ['Added Controls', String(addedCount)],
        ['Removed Controls', String(removedCount)],
        ['Inherited Controls', String(inheritedCount)],
        ['JSIG Overlay Applied', step2.jsigOverlay ? 'Yes' : 'No'],
        ['JSIG Overlay Controls', String(jsigCount)],
        ['Implementation Completion', `${implementationPercent}%`],
        ['Controls with Curated Best-Practice Guidance', String(bestPracticeCount)],
        ['AI-Generated Implementation Statements', String(aiGeneratedCount)],
      ],
    ),
    h2('7.2 Tailoring Summary'),
    p(step2.notes ?? 'No tailoring summary notes have been provided.'),
    h2('7.3 Implementation Summary Notes'),
    p(step3.notes ?? 'No Step 3 implementation summary notes have been provided.'),
    h2('7.4 Detailed Control Table'),
    ...(controlRows.length
      ? chunkedControlTables(controlRows)
      : [p('No Step 2 selected controls were found. Complete RMF Step 2 to populate this section.')]),
    ...(controlRows.length
      ? [
          h2('7.5 Control Implementation Narratives'),
          ...controlNarrativeBlocks(controlRows),
        ]
      : []),
  ]
}

function section8Diagrams(project: ProjectForSsp, includeDiagrams: boolean) {
  const rows = project.diagrams.map((diagram) => [
    diagram.title,
    fmtEnum(diagram.type),
    diagram.fileName,
    diagram.fileSize ? `${Math.round(diagram.fileSize / 1024)} KB` : '—',
    diagram.mimeType ?? '—',
    fmtDate(diagram.createdAt),
  ])

  const body: Array<Paragraph | Table> = [
    h1('8. System Diagrams'),
    p('System diagrams provide visual evidence of the authorization boundary, network architecture, data flows, component placement, and inherited services.'),
    ...(rows.length
      ? [simpleTable(
          [
            { text: 'Title', width: 22 },
            { text: 'Type', width: 16 },
            { text: 'File', width: 24 },
            { text: 'Size', width: 10 },
            { text: 'MIME', width: 16 },
            { text: 'Uploaded', width: 12 },
          ],
          rows,
        )]
      : [p('No diagrams have been uploaded.')]),
  ]

  if (!includeDiagrams || !project.diagrams.length) return body

  for (const diagram of project.diagrams) {
    const imageType = diagram.mimeType ? EMBEDDABLE_MIMES[diagram.mimeType] : undefined
    if (!imageType) {
      body.push(p(`${diagram.title}: ${diagram.fileName} is listed as supporting evidence but cannot be embedded in Word format.`, { italics: true }))
      continue
    }

    const data = tryLoadImage(diagram.fileUrl)
    if (!data) {
      body.push(p(`${diagram.title}: source file was not available on disk during SSP generation.`, { italics: true }))
      continue
    }

    body.push(h2(`${diagram.title} (${fmtEnum(diagram.type)})`))
    body.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new ImageRun({
          data,
          type: imageType,
          transformation: { width: 520, height: 340 },
        }),
      ],
    }))
  }

  return body
}

function section9Artifacts(project: ProjectForSsp) {
  return [
    h1('9. Artifact and Evidence Library'),
    p('The following project artifacts are maintained in the centralized Crater evidence library and are included in the final RMF package export. Artifacts may include appointment letters, user agreements, privileged user agreements, vulnerability scans, ISA/MOU documentation, training records, TEMPEST diagrams, and other supporting evidence.'),
    ...(project.artifacts.length
      ? [simpleTable(
          [
            { text: 'Title', width: 24 },
            { text: 'Type', width: 20 },
            { text: 'File', width: 26 },
            { text: 'Linked Control', width: 14 },
            { text: 'Uploaded', width: 16 },
          ],
          project.artifacts.map((artifact) => [
            artifact.title,
            fmtEnum(artifact.type),
            artifact.fileName,
            artifact.controlId ?? '—',
            fmtDate(artifact.createdAt),
          ]),
        )]
      : [p('No centralized project artifacts have been uploaded.')]),
  ]
}

function section10Inventory(project: ProjectForSsp) {
  return [
    h1('10. Hardware and Software Inventory'),
    p('The following inventory records support the dedicated hardware and software lists expected as SSP package attachments. Items should be reviewed for authorization boundary inclusion, classification handling, location accuracy, and approval status.'),
    ...(project.inventoryItems.length
      ? [
          simpleTable(
            [
              { text: 'Item', width: 24 },
              { text: 'Type', width: 12 },
              { text: 'Model / Version', width: 20 },
              { text: 'Location', width: 16 },
              { text: 'Classification', width: 14 },
              { text: 'Approval', width: 14 },
            ],
            project.inventoryItems.map((item) => [
              item.item,
              fmtEnum(item.itemType),
              item.modelVersion ?? '—',
              item.location ?? '—',
              item.classification ?? '—',
              fmtEnum(item.approvalStatus),
            ]),
          ),
        ]
      : [p('No hardware or software inventory items have been recorded.')]),
  ]
}

function section11Ppsm(project: ProjectForSsp) {
  return [
    h1('11. Ports, Protocols, and Services Management (PPSM)'),
    p('The following PPSM entries identify ports, protocols, traffic direction, service or application ownership, business justification, and approval status for communications within or across the system boundary.'),
    ...(project.ppsmEntries.length
      ? [
          simpleTable(
            [
              { text: 'Port', width: 12 },
              { text: 'Protocol', width: 12 },
              { text: 'Direction', width: 14 },
              { text: 'Service / Application', width: 24 },
              { text: 'Approval', width: 14 },
              { text: 'Justification', width: 24 },
            ],
            project.ppsmEntries.map((entry) => [
              entry.port,
              entry.protocol,
              fmtEnum(entry.direction),
              entry.serviceApplication,
              fmtEnum(entry.approvalStatus),
              entry.justification ?? '—',
            ]),
          ),
        ]
      : [p('No PPSM entries have been recorded for this system.')]),
  ]
}

function section12RiskAndContext(step0: Step0Data) {
  return [
    h1('12. Risk Tolerance & Organizational Context'),
    h2('12.1 Risk Tolerance'),
    p(step0.riskTolerance ?? 'Risk tolerance has not been documented.'),
    h2('12.2 Organizational Context'),
    p(step0.organizationalContext ?? 'Organizational context has not been documented.'),
  ]
}

function section13PoamSummary(project: ProjectForSsp, openPoams: ProjectForSsp['poamItems']) {
  return [
    h1('13. POA&M Summary'),
    simpleTable(
      [{ text: 'Metric', width: 50 }, { text: 'Value', width: 50 }],
      [
        ['Total POA&M Items', String(project.poamItems.length)],
        ['Open / In Remediation', String(openPoams.length)],
        ['Closed', String(project.poamItems.filter((item) => item.status === 'CLOSED').length)],
        ['Risk Accepted', String(project.poamItems.filter((item) => item.status === 'RISK_ACCEPTED').length)],
      ],
    ),
    ...(project.poamItems.length
      ? [
          h2('13.1 POA&M Detail'),
          simpleTable(
            [
              { text: 'Control', width: 12 },
              { text: 'Weakness', width: 28 },
              { text: 'Severity', width: 12 },
              { text: 'Status', width: 16 },
              { text: 'Scheduled Completion', width: 16 },
              { text: 'Milestones / Resources', width: 16 },
            ],
            project.poamItems.map((item) => [
              item.controlId ?? '—',
              item.weakness,
              item.severity,
              fmtEnum(item.status),
              item.scheduledCompletion ? fmtDate(item.scheduledCompletion) : 'TBD',
              item.milestonesWithDates ?? item.resources ?? '—',
            ]),
          ),
        ]
      : [p('No POA&M items have been recorded for this system.')]),
  ]
}

function section14RmfStatus(project: ProjectForSsp) {
  return [
    h1('14. RMF Workflow Status'),
    simpleTable(
      [
        { text: 'Step', width: 8 },
        { text: 'Name', width: 22 },
        { text: 'Status', width: 18 },
        { text: 'Completed', width: 18 },
        { text: 'Notes', width: 34 },
      ],
      project.rmfSteps.map((step) => [
        String(step.stepNumber),
        STEP_NAMES[step.stepNumber] ?? `Step ${step.stepNumber}`,
        fmtStepStatus(step.status),
        step.completedAt ? fmtDate(step.completedAt) : '—',
        step.notes ?? '—',
      ]),
    ),
  ]
}

function approvalPage() {
  return [
    h1('12. Approval and Signatures'),
    p('By signing below, the responsible officials acknowledge review of this System Security Plan and acceptance of their responsibilities within the Risk Management Framework authorization process.'),
    ...['System Owner', 'ISSO', 'Authorizing Official'].flatMap((role) => [
      new Paragraph({ spacing: { before: 260, after: 70 }, children: [new TextRun({ text: role, bold: true, size: 22 })] }),
      p('Name:        _______________________________________________     Date: ____________________'),
      p('Signature: _______________________________________________'),
      p('Title:         _______________________________________________'),
    ]),
  ]
}

interface ControlRow {
  controlId: string
  family: string
  title: string
  status: string
  rawStatus?: string
  action: TailoringAction
  inherited: boolean
  inheritedFrom: string
  justification: string
  description: string
  implementationStatement: string
  evidenceNotes: string
  aiGenerated: boolean
  aiGeneratedAt: string
  bestPracticeStatement: string
  bestPracticeEvidence: string[]
  commonImplementation: string
  jsigNote: string
}

function buildControlRows(
  step2: Step2Data,
  step3: Step3Data,
  selectedControlIds: string[],
  controlMap: Map<string, {
    controlId: string
    family: string
    title: string
    description: string
    bestPracticeStatement: string | null
    typicalEvidence: string | null
  }>,
  instanceMap: Map<string, { status: ControlStatus; inherited: boolean; tailoringJustification: string | null; implementationNotes: string | null }>,
  step3Map: Map<string, Step3ImplementationRecord>,
  bestPractices: BestPracticesService,
): ControlRow[] {
  const baselineSet = new Set(step2.baselineControlIds ?? [])
  const selectedControlMap = new Map(step2.selectedControls?.map((control) => [control.controlId, control]) ?? [])
  const rows: ControlRow[] = []

  for (const controlId of selectedControlIds) {
    const control = controlMap.get(controlId)
    const selected = selectedControlMap.get(controlId)
    const tailoring = step2.tailoring?.[controlId]
    const instance = instanceMap.get(controlId)
    const implementation = step3Map.get(controlId)
    const bestPractice = bestPractices.get(controlId)
    const action = selected?.action ?? tailoring?.action ?? (baselineSet.has(controlId) ? 'BASELINE' : 'ADDED')
    const inherited = Boolean(implementation?.inherited ?? selected?.inherited ?? tailoring?.inherited ?? instance?.inherited)
    const rawStatus = normalizeControlStatus(implementation?.status ?? instance?.status)
    const implementationStatement = implementation?.implementationStatement ?? implementation?.statement ?? instance?.implementationNotes ?? ''
    const inheritedFrom = implementation?.inheritedFrom ?? selected?.inheritedFrom ?? tailoring?.inheritedFrom ?? ''

    rows.push({
      controlId,
      family: control?.family ?? controlId.split('-')[0] ?? '—',
      title: control?.title ?? controlId,
      status: rawStatus ? formatControlStatus(rawStatus) : 'Selected - Not Implemented',
      rawStatus,
      action,
      inherited,
      inheritedFrom,
      justification: selected?.justification ?? tailoring?.justification ?? instance?.tailoringJustification ?? '',
      description: control?.description ?? '',
      implementationStatement,
      evidenceNotes: implementation?.evidenceNotes ?? '',
      aiGenerated: Boolean(implementation?.aiGenerated),
      aiGeneratedAt: implementation?.aiGeneratedAt ?? '',
      bestPracticeStatement: bestPractice?.bestPracticeStatement ?? control?.bestPracticeStatement ?? '',
      bestPracticeEvidence: parseEvidence(bestPractice, control?.typicalEvidence),
      commonImplementation: bestPractice?.commonImplementation ?? '',
      jsigNote: step2.jsigOverlay ? bestPractice?.jsigNote ?? '' : '',
    })
  }

  for (const removed of step2.removedControls ?? []) {
    const control = controlMap.get(removed.controlId)
    const bestPractice = bestPractices.get(removed.controlId)
    rows.push({
      controlId: removed.controlId,
      family: control?.family ?? removed.controlId.split('-')[0] ?? '—',
      title: control?.title ?? removed.controlId,
      status: 'Removed by Tailoring',
      rawStatus: 'NOT_APPLICABLE',
      action: 'REMOVED',
      inherited: false,
      inheritedFrom: '',
      justification: removed.justification ?? step2.tailoring?.[removed.controlId]?.justification ?? '',
      description: control?.description ?? '',
      implementationStatement: '',
      evidenceNotes: '',
      aiGenerated: false,
      aiGeneratedAt: '',
      bestPracticeStatement: bestPractice?.bestPracticeStatement ?? control?.bestPracticeStatement ?? '',
      bestPracticeEvidence: parseEvidence(bestPractice, control?.typicalEvidence),
      commonImplementation: bestPractice?.commonImplementation ?? '',
      jsigNote: step2.jsigOverlay ? bestPractice?.jsigNote ?? '' : '',
    })
  }

  return rows.sort((a, b) => a.controlId.localeCompare(b.controlId, undefined, { numeric: true }))
}

function chunkedControlTables(rows: ControlRow[]) {
  const output: Array<Paragraph | Table> = []
  const chunkSize = 25

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    if (index > 0) output.push(h2(`7.4 Continued Controls ${index + 1}-${index + chunk.length}`))
    output.push(simpleTable(
      [
        { text: 'Control', width: 8 },
        { text: 'Family', width: 7 },
        { text: 'Title', width: 19 },
        { text: 'Action', width: 9 },
        { text: 'Status', width: 12 },
        { text: 'Inherited / Provider', width: 14 },
        { text: 'Implementation Source', width: 14 },
        { text: 'Tailoring / Evidence Notes', width: 17 },
      ],
      chunk.map((row) => [
        row.controlId,
        row.family,
        row.title,
        row.action,
        row.status,
        row.inherited ? `Yes${row.inheritedFrom ? ` - ${row.inheritedFrom}` : ''}` : 'No',
        row.aiGenerated ? `[AI-Assisted] ${row.aiGeneratedAt ? fmtDate(new Date(row.aiGeneratedAt)) : ''}` : row.implementationStatement ? 'Human-entered' : row.bestPracticeStatement ? 'Curated best practice available' : 'Not documented',
        row.evidenceNotes || row.justification || row.bestPracticeEvidence.slice(0, 3).join('; ') || '—',
      ]),
    ))
  }

  return output
}

function controlNarrativeBlocks(rows: ControlRow[]) {
  const output: Array<Paragraph | Table> = []

  for (const row of rows) {
    output.push(h2(`${row.controlId} - ${row.title}`))
    output.push(simpleTable(
      [
        { text: 'Attribute', width: 28 },
        { text: 'Value', width: 72 },
      ],
      [
        ['Family', row.family],
        ['Disposition', `${row.action}; ${row.status}${row.inherited ? `; inherited from ${row.inheritedFrom || 'common control provider'}` : ''}`],
        ['Tailoring Decision', row.justification || 'No tailoring justification recorded.'],
        ['Evidence', row.evidenceNotes || row.bestPracticeEvidence.join('; ') || 'Evidence artifacts have not been identified.'],
      ],
    ))

    if (row.implementationStatement) {
      output.push(p(`${row.aiGenerated ? '[AI-Assisted] ' : ''}${row.implementationStatement}`))
    } else if (row.bestPracticeStatement) {
      output.push(aiAssistedNotice('No system-specific implementation statement was saved in Step 3. The following curated best-practice guidance is included as assessor context and should not be treated as an accepted implementation statement until reviewed.'))
      output.push(p(row.bestPracticeStatement))
    } else {
      output.push(p('No implementation statement has been documented for this control.'))
    }

    if (row.commonImplementation) {
      output.push(p(`Common implementation pattern: ${row.commonImplementation}`, { italics: true }))
    }

    if (row.jsigNote) {
      output.push(p(`JSIG/SAP overlay consideration: ${row.jsigNote}`, { italics: true }))
    }
  }

  return output
}

function buildStep3Map(step3: Step3Data) {
  const source = step3.implementations ?? step3.controls ?? {}
  return new Map(
    Object.entries(source).map(([controlId, record]) => [
      controlId,
      {
        ...record,
        implementationStatement: record.implementationStatement ?? record.statement ?? '',
      } as Step3ImplementationRecord,
    ]),
  )
}

function normalizeControlStatus(status?: ControlStatus | string) {
  return typeof status === 'string' && status.trim() ? status.trim().toUpperCase() : undefined
}

function formatControlStatus(status?: string) {
  if (!status) return 'Selected - Not Implemented'
  if (isControlStatus(status)) return CONTROL_STATUS_LABELS[status]
  return fmtEnum(status)
}

function isControlStatus(status: string): status is ControlStatus {
  return Object.prototype.hasOwnProperty.call(CONTROL_STATUS_LABELS, status)
}

function parseEvidence(bestPractice?: BestPracticeEntry, typicalEvidence?: string | null) {
  const evidence = [...(bestPractice?.typicalEvidence ?? [])]
  if (typicalEvidence) {
    try {
      const parsed = JSON.parse(typicalEvidence)
      if (Array.isArray(parsed)) evidence.push(...parsed.filter((item): item is string => typeof item === 'string'))
      else evidence.push(typicalEvidence)
    } catch {
      evidence.push(typicalEvidence)
    }
  }
  return unique(evidence.map((item) => item.trim()).filter(Boolean))
}

function calculateImplementationPercent(rows: ControlRow[]) {
  const applicable = rows.filter((row) => row.action !== 'REMOVED')
  if (!applicable.length) return 0
  const complete = applicable.filter((row) => row.rawStatus === 'IMPLEMENTED' || row.rawStatus === 'NOT_APPLICABLE').length
  return Math.round((complete / applicable.length) * 100)
}

async function buildExecutiveSummary(input: {
  project: ProjectForSsp
  step0: Step0Data
  step1: Step1Data
  step2: Step2Data
  step3: Step3Data
  impactLevel: ImpactLevel
  baselineCount: number
  selectedCount: number
  addedCount: number
  removedCount: number
  inheritedCount: number
  jsigCount: number
  openPoamCount: number
  controlRows: ControlRow[]
}) {
  const fallback = buildExecutiveSummaryFallback(input)
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL).replace(/\/$/, '')
  const model = process.env.OLLAMA_MODEL ?? process.env.LOCAL_AI_MODEL ?? DEFAULT_AI_MODEL
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        prompt: buildExecutiveSummaryPrompt(input, fallback),
        options: {
          temperature: 0.15,
          seed: Number(process.env.LOCAL_AI_SEED ?? 37),
          num_ctx: Number(process.env.LOCAL_AI_CONTEXT_WINDOW ?? 8192),
        },
      }),
    })

    if (!response.ok) throw new Error(`Ollama returned ${response.status}`)
    const data = (await response.json()) as { response?: string }
    const text = data.response?.trim()
    if (!text) return fallback
    const cleaned = stripMarkdown(text)
    return cleaned.startsWith('[AI-Assisted]') ? cleaned : `[AI-Assisted] ${cleaned}`
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.warn('[SspService] AI executive summary generation failed; using deterministic fallback.', { reason })
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

function buildExecutiveSummaryFallback(input: {
  project: ProjectForSsp
  step0: Step0Data
  step1: Step1Data
  step2: Step2Data
  step3: Step3Data
  impactLevel: ImpactLevel
  baselineCount: number
  selectedCount: number
  addedCount: number
  removedCount: number
  inheritedCount: number
  jsigCount: number
  openPoamCount: number
  controlRows: ControlRow[]
}) {
  const {
    project,
    step0,
    step1,
    step2,
    step3,
    impactLevel,
    baselineCount,
    selectedCount,
    addedCount,
    removedCount,
    inheritedCount,
    jsigCount,
    openPoamCount,
    controlRows,
  } = input
  const implementedPercent = step3.summary?.percent ?? calculateImplementationPercent(controlRows)
  const informationTypeCount = step1.selectedInformationTypes?.length ?? 0
  const aiGeneratedCount = controlRows.filter((row) => row.aiGenerated).length
  const curatedCount = controlRows.filter((row) => row.bestPracticeStatement).length
  const boundary = firstNonEmpty(step0.boundaryConfirmation, project.authBoundary, 'the authorization boundary documented in RMF Step 0')
  const riskContext = firstNonEmpty(step0.riskTolerance, step0.organizationalContext, 'the organization-defined risk posture')
  const categorization = firstNonEmpty(step1.impactJustification, step1.objectiveJustification, 'the Step 1 FIPS 199 categorization record')

  return [
    `[AI-Assisted] This System Security Plan documents ${project.name}, a ${fmtImpact(impactLevel)} impact information system currently in ${fmtEnum(project.status)} status. The authorization boundary is defined as ${boundary}, and the security categorization is supported by ${informationTypeCount} selected NIST SP 800-60 information type${informationTypeCount === 1 ? '' : 's'} and the documented categorization rationale: ${categorization}.`,
    `The selected control baseline contains ${baselineCount} baseline controls and ${selectedCount} selected controls after tailoring. The package records ${addedCount} added controls, ${removedCount} removed controls, ${inheritedCount} inherited controls, and ${step2.jsigOverlay ? `${jsigCount} JSIG/SAP overlay controls or enhancements` : 'no JSIG/SAP overlay selection'}. Step 3 implementation data indicates ${implementedPercent}% implementation completion, with ${aiGeneratedCount} AI-assisted implementation statement${aiGeneratedCount === 1 ? '' : 's'} and ${curatedCount} controls supported by curated Crater best-practice guidance.`,
    `The system risk narrative is anchored to ${riskContext}. Open POA&M exposure is currently ${openPoamCount} item${openPoamCount === 1 ? '' : 's'}, and the control implementation section should be used by assessors to verify inherited provider evidence, system-specific implementation statements, tailoring decisions, and supporting artifacts prior to authorization decision activities.`,
  ].join(' ')
}

function buildExecutiveSummaryPrompt(
  input: Parameters<typeof buildExecutiveSummaryFallback>[0],
  fallbackSummary: string,
) {
  const roleAssignments = Object.entries(input.step0.roles ?? {})
    .map(([role, value]) => `${role}: ${value}`)
    .join('; ')
  const implementedPercent = input.step3.summary?.percent ?? calculateImplementationPercent(input.controlRows)
  const aiGeneratedControls = input.controlRows.filter((row) => row.aiGenerated).map((row) => row.controlId).slice(0, 20)

  return [
    'You are Crater Local AI, an offline RMF assistant preparing an auditor-ready System Security Plan executive summary.',
    'Write exactly three professional paragraphs. Do not use markdown, bullets, headings, or numbered lists.',
    'Start directly with the summary narrative. Make it suitable for an Authorizing Official, ISSO, System Owner, and Security Control Assessor.',
    'Mark no unsupported claims. Do not invent product names, dates, organization names, or authorization decisions.',
    'Include the phrase [AI-Assisted] only if it is not already present.',
    '',
    'Current deterministic summary draft:',
    fallbackSummary,
    '',
    'Project context:',
    `System: ${input.project.name}`,
    `Description: ${input.project.description ?? 'Not provided'}`,
    `Impact level: ${fmtImpact(input.impactLevel)}`,
    `Status: ${fmtEnum(input.project.status)}`,
    `Authorization boundary: ${firstNonEmpty(input.step0.boundaryConfirmation, input.project.authBoundary, 'Not provided')}`,
    `Risk tolerance: ${input.step0.riskTolerance ?? 'Not provided'}`,
    `Organizational context: ${input.step0.organizationalContext ?? 'Not provided'}`,
    `Roles: ${roleAssignments || 'Not assigned'}`,
    `Information types: ${input.step1.selectedInformationTypes?.map((item) => item.name ?? item.title ?? item.id).filter(Boolean).join(', ') || 'Not selected'}`,
    `Categorization rationale: ${input.step1.impactJustification ?? input.step1.objectiveJustification ?? 'Not provided'}`,
    `Baseline controls: ${input.baselineCount}`,
    `Selected controls: ${input.selectedCount}`,
    `Added controls: ${input.addedCount}`,
    `Removed controls: ${input.removedCount}`,
    `Inherited controls: ${input.inheritedCount}`,
    `JSIG overlay: ${input.step2.jsigOverlay ? `Yes, ${input.jsigCount} overlay controls/enhancements` : 'No'}`,
    `Implementation completion: ${implementedPercent}%`,
    `AI-assisted implementation statements: ${aiGeneratedControls.length ? aiGeneratedControls.join(', ') : 'None recorded'}`,
    `Open POA&M items: ${input.openPoamCount}`,
  ].join('\n')
}

function stripMarkdown(text: string) {
  return text
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? ''
}

function getStepData<T>(project: ProjectForSsp, stepNumber: number): T {
  const data = project.rmfSteps.find((step) => step.stepNumber === stepNumber)?.data
  return (isObject(data) ? data : {}) as T
}

function isObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function documentHeader(systemName: string, generatedDate: string) {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `System Security Plan - ${systemName} | ${generatedDate}`, size: 18, color: '666666' })],
      }),
    ],
  })
}

function documentFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'CUI - FOR OFFICIAL USE ONLY | Page ', size: 18, color: '666666' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '666666' }),
        ],
      }),
    ],
  })
}

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, size: 28, color: COLOR_NAVY })],
  })
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 23, color: COLOR_NAVY })],
  })
}

function p(text: string, opts?: { bold?: boolean; italics?: boolean }) {
  return new Paragraph({
    spacing: { after: 110 },
    children: [new TextRun({ text: text || 'Not provided.', size: 21, bold: opts?.bold, italics: opts?.italics })],
  })
}

function aiAssistedNotice(text: string) {
  return new Paragraph({
    spacing: { before: 80, after: 140 },
    shading: { type: ShadingType.CLEAR, fill: 'E0F7FF' },
    border: {
      left: { style: BorderStyle.SINGLE, size: 8, color: COLOR_CYAN },
    },
    children: [
      new TextRun({ text: '[AI-Assisted] ', bold: true, color: COLOR_NAVY, size: 20 }),
      new TextRun({ text, color: COLOR_DARK, size: 20 }),
    ],
  })
}

function centered(text: string, size: number, bold = false, color = COLOR_DARK) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 140 },
    children: [new TextRun({ text, size, bold, color })],
  })
}

function pageBreak() {
  return new Paragraph({ pageBreakBefore: true, children: [] })
}

function simpleTable(headers: Array<{ text: string; width: number }>, rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header) => cell(header.text, header.width, true)),
      }),
      ...rows.map((row, rowIndex) =>
        new TableRow({
          children: row.map((value, index) => cell(value, headers[index]?.width ?? 20, false, rowIndex % 2 === 1)),
        }),
      ),
    ],
  })
}

function cell(text: string, width: number, header = false, shaded = false) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: header
      ? { type: ShadingType.CLEAR, fill: COLOR_NAVY }
      : shaded
        ? { type: ShadingType.CLEAR, fill: COLOR_GRAY }
        : undefined,
    children: [
      new Paragraph({
        alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: text || '—', bold: header, color: header ? COLOR_WHITE : COLOR_DARK, size: 19 })],
      }),
    ],
  })
}

function resolveRoleValue(project: ProjectForSsp, value?: string) {
  if (!value) return ''
  const member = project.members.find((item) => item.userId === value || item.user.email === value)
  if (member) return `${personName(member.user)} (${member.user.email})`
  if (project.owner.id === value || project.owner.email === value) return `${personName(project.owner)} (${project.owner.email})`
  return value
}

function personName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim()
}

function fmtDate(date?: Date | null) {
  if (!date) return 'N/A'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function isoDate(date: Date) {
  return date.toISOString().split('T')[0]!
}

function fmtImpact(level: ImpactLevel | string) {
  const value = String(level)
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function fmtEnum(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function fmtStepStatus(status: StepStatus) {
  return fmtEnum(status)
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function sanitizeFilename(name: string) {
  return name
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

function tryLoadImage(fileUrl: string): Buffer | null {
  try {
    const relativePath = fileUrl.replace(/^\/uploads\//, '')
    const fullPath = path.join(UPLOAD_DIR, relativePath)
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath) : null
  } catch {
    return null
  }
}
