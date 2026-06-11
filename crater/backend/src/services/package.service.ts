import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import { Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import { SspService } from './ssp.service'

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads')

export interface PackageResult {
  buffer: Buffer
  filename: string
}

export class PackageService {
  private readonly ssp = new SspService()

  async generate(projectId: string, userId: string, userRole: Role): Promise<PackageResult> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
        artifacts: { orderBy: [{ type: 'asc' }, { createdAt: 'asc' }] },
        diagrams: { orderBy: [{ type: 'asc' }, { createdAt: 'asc' }] },
        inventoryItems: { orderBy: [{ itemType: 'asc' }, { item: 'asc' }] },
        ppsmEntries: { orderBy: [{ protocol: 'asc' }, { port: 'asc' }, { serviceApplication: 'asc' }] },
        poamItems: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] },
      },
    })

    if (!project) throw new AppError('Project not found', 404)
    if (userRole !== Role.ADMIN && project.ownerId !== userId && !project.members.some((member) => member.userId === userId)) {
      throw new AppError('You do not have access to this project', 403)
    }

    const ssp = await this.ssp.generate(projectId, userId, userRole, { includeDiagrams: true })
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    archive.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    const done = new Promise<Buffer>((resolve, reject) => {
      archive.on('error', reject)
      archive.on('end', () => resolve(Buffer.concat(chunks)))
    })

    archive.append(ssp.buffer, { name: `01-SSP/${ssp.filename}` })
    archive.append(buildManifest(project), { name: '00-Manifest/manifest.json' })
    archive.append(buildReadme(project), { name: '00-Manifest/README.txt' })

    for (const diagram of project.diagrams) {
      const file = resolveUploadPath(diagram.fileUrl)
      if (file && fs.existsSync(file)) {
        archive.file(file, { name: `02-Diagrams/${safeFolder(diagram.type)}/${safeName(diagram.fileName)}` })
      }
    }

    for (const artifact of project.artifacts) {
      const file = resolveUploadPath(artifact.fileUrl)
      if (file && fs.existsSync(file)) {
        const stepFolder = artifact.stepId ? 'Linked-Step' : 'General'
        archive.file(file, { name: `03-Artifacts/${safeFolder(artifact.type)}/${stepFolder}/${safeName(artifact.fileName)}` })
      }
    }

    const hardware = project.inventoryItems.filter((item) => item.itemType === 'HARDWARE')
    const software = project.inventoryItems.filter((item) => item.itemType === 'SOFTWARE')
    archive.append(buildInventoryCsv(hardware), { name: '04-Inventory/hardware-inventory.csv' })
    archive.append(buildInventoryCsv(software), { name: '04-Inventory/software-inventory.csv' })
    archive.append(buildPpsmCsv(project.ppsmEntries), { name: '05-PPSM/ppsm-summary.csv' })
    archive.append(buildPoamCsv(project.poamItems), { name: '06-POAM/poam-summary.csv' })
    await archive.finalize()

    return {
      buffer: await done,
      filename: `CRATER-${safeFolder(project.name)}-RMF-Package-${new Date().toISOString().slice(0, 10)}.zip`,
    }
  }
}

function resolveUploadPath(fileUrl: string) {
  const relative = fileUrl.replace(/^\/uploads\/?/, '')
  const absolute = path.resolve(UPLOAD_DIR, relative)
  return absolute.startsWith(UPLOAD_DIR) ? absolute : null
}

function safeFolder(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 90) || 'artifact'
}

function safeName(value: string) {
  return path.basename(value).replace(/[^a-zA-Z0-9_. -]/g, '_').slice(0, 140) || 'file'
}

function buildManifest(project: Awaited<ReturnType<typeof prisma.project.findUnique>> & { artifacts: unknown[]; diagrams: unknown[]; inventoryItems: unknown[]; ppsmEntries: unknown[]; poamItems: unknown[] }) {
  return JSON.stringify({
    projectId: project?.id,
    projectName: project?.name,
    generatedAt: new Date().toISOString(),
    folders: {
      '01-SSP': 'Generated System Security Plan',
      '02-Diagrams': 'Uploaded architecture and boundary diagrams',
      '03-Artifacts': 'Evidence library files grouped by artifact type',
      '04-Inventory': 'Dedicated hardware and software inventory attachment exports',
      '05-PPSM': 'Ports, protocols, and services management export',
      '06-POAM': 'POA&M summary export',
    },
    counts: {
      artifacts: project?.artifacts.length ?? 0,
      diagrams: project?.diagrams.length ?? 0,
      inventoryItems: project?.inventoryItems.length ?? 0,
      ppsmEntries: project?.ppsmEntries.length ?? 0,
      poamItems: project?.poamItems.length ?? 0,
    },
  }, null, 2)
}

function buildReadme(project: { name: string }) {
  return [
    `Crater RMF Package: ${project.name}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'This package includes the generated SSP, uploaded diagrams, project artifacts/evidence, hardware/software inventory exports, a PPSM export, and a POA&M summary.',
    'Artifacts are grouped by type to support auditor review and ATO package assembly.',
  ].join('\n')
}

function buildInventoryCsv(items: Array<{
  item: string
  itemType: string
  modelVersion: string | null
  location: string | null
  classification: string | null
  approvalStatus: string
  notes: string | null
}>) {
  const rows = [['Item', 'Type', 'Model / Version', 'Location', 'Classification', 'Approval Status', 'Notes']]
  for (const item of items) {
    rows.push([
      item.item,
      item.itemType,
      item.modelVersion ?? '',
      item.location ?? '',
      item.classification ?? '',
      item.approvalStatus,
      item.notes ?? '',
    ])
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

function buildPpsmCsv(items: Array<{
  port: string
  protocol: string
  direction: string
  serviceApplication: string
  justification: string | null
  approvalStatus: string
}>) {
  const rows = [['Port', 'Protocol', 'Direction', 'Service / Application', 'Approval Status', 'Justification']]
  for (const item of items) {
    rows.push([
      item.port,
      item.protocol,
      item.direction,
      item.serviceApplication,
      item.approvalStatus,
      item.justification ?? '',
    ])
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

function buildPoamCsv(items: Array<{ controlId: string | null; severity: string; status: string; weakness: string; scheduledCompletion: Date | null }>) {
  const rows = [['Control ID', 'Severity', 'Status', 'Scheduled Completion', 'Weakness']]
  for (const item of items) {
    rows.push([
      item.controlId ?? '',
      item.severity,
      item.status,
      item.scheduledCompletion ? item.scheduledCompletion.toISOString().slice(0, 10) : '',
      item.weakness,
    ])
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}
