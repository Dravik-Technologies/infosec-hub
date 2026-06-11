import path from 'path'
import { DiagramType, Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'

// Roles that can upload project artifacts. SCA may upload assessment evidence
// during Step 4; AO and DAO remain read-only.
const WRITE_ROLES: Role[] = [Role.SYSTEM_OWNER, Role.ISSO, Role.ISSM, Role.ISSE, Role.SCA]

// Maps frontend display strings and raw enum values → DiagramType enum
// Frontend sends: 'Network' | 'Boundary' | 'Data Flow' | 'Rack' | 'Architecture'
const DIAGRAM_TYPE_MAP: Record<string, DiagramType> = {
  Network:      DiagramType.NETWORK,
  Boundary:     DiagramType.BOUNDARY,
  'Data Flow':  DiagramType.DATA_FLOW,
  Rack:         DiagramType.RACK,
  Architecture: DiagramType.ARCHITECTURE,
  // Accept raw enum values too in case the frontend sends them directly
  NETWORK:      DiagramType.NETWORK,
  BOUNDARY:     DiagramType.BOUNDARY,
  DATA_FLOW:    DiagramType.DATA_FLOW,
  RACK:         DiagramType.RACK,
  ARCHITECTURE: DiagramType.ARCHITECTURE,
}

export class DiagramService {
  /**
   * Persist uploaded diagram files as Diagram records.
   *
   * @param projectId   Target project
   * @param files       Multer-processed files (already written to disk)
   * @param typeName    Display string or enum value from the request body
   * @param stepNumber  Optional RMF step to link (0–6). Defaults to step 0 in wizard context.
   * @param userId      Calling user's ID
   * @param userRole    Calling user's system role
   */
  async upload(
    projectId: string,
    files: Express.Multer.File[],
    typeName: string,
    stepNumber: number | undefined,
    userId: string,
    userRole: Role,
  ) {
    if (!files.length) {
      throw new AppError('No files were uploaded', 400)
    }

    // ── 1. Validate diagram type ──────────────────────────────────────────────
    const diagramType = DIAGRAM_TYPE_MAP[typeName]
    if (!diagramType) {
      throw new AppError(
        `Invalid diagram type '${typeName}'. Accepted: ${Object.keys(DIAGRAM_TYPE_MAP)
          .filter(k => k === k.toUpperCase() || k.includes(' ') || /^[A-Z]/.test(k))
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ')}`,
        400,
      )
    }

    // ── 2. Verify project + membership ────────────────────────────────────────
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })

    if (!project) throw new AppError('Project not found', 404)

    if (userRole !== Role.ADMIN) {
      const member = project.members.find(m => m.userId === userId)
      if (!member) throw new AppError('You do not have access to this project', 403)
      if (!WRITE_ROLES.includes(member.role)) {
        throw new AppError('Insufficient permissions to upload diagrams to this project', 403)
      }
    }

    // ── 3. Resolve optional step link ─────────────────────────────────────────
    let stepId: string | undefined
    if (stepNumber !== undefined) {
      const step = await prisma.rMFStep.findUnique({
        where: { projectId_stepNumber: { projectId, stepNumber } },
        select: { id: true },
      })
      if (!step) throw new AppError(`Step ${stepNumber} not found for this project`, 404)
      stepId = step.id
    }

    // ── 4. Build DB records ───────────────────────────────────────────────────
    // fileUrl is a server-relative path that express.static serves under /uploads.
    // The client constructs the full URL as: `${apiBase.replace('/api', '')}${fileUrl}`
    const records = files.map(file => {
      const relPath = path
        .join('projects', projectId, 'diagrams', file.filename)
        .replace(/\\/g, '/')

      return {
        projectId,
        stepId,
        uploadedById: userId,
        title: path.basename(file.originalname, path.extname(file.originalname)),
        type: diagramType,
        fileUrl: `/uploads/${relPath}`,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      }
    })

    // ── 5. Persist in a single transaction ───────────────────────────────────
    const diagrams = await prisma.$transaction(
      records.map(data => prisma.diagram.create({ data })),
    )

    return diagrams
  }

  async listForProject(projectId: string, userId: string, userRole: Role) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })

    if (!project) throw new AppError('Project not found', 404)

    if (userRole !== Role.ADMIN) {
      const isMember = project.members.some(m => m.userId === userId)
      if (!isMember) throw new AppError('You do not have access to this project', 403)
    }

    return prisma.diagram.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
