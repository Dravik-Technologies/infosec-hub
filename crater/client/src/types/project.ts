export type ImpactLevel = 'LOW' | 'MODERATE' | 'HIGH'
export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'PENDING_ATO' | 'AUTHORIZED' | 'DENIED' | 'EXPIRED'
export type RmfStepStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETE'

export interface RmfStep {
  id: string
  stepNumber: number
  status: RmfStepStatus
}

export interface ProjectCounts {
  controlInstances?: number
  poamItems?: number
  diagrams?: number
  artifacts?: number
  inventoryItems?: number
  ppsmEntries?: number
}

export interface Project {
  id: string
  name: string
  description?: string | null
  authBoundary?: string | null
  impactLevel: ImpactLevel
  status: ProjectStatus
  atoExpiry?: string | null
  createdAt?: string
  updatedAt?: string
  rmfSteps?: RmfStep[]
  _count?: ProjectCounts
}

export interface CreateProjectInput {
  name: string
  description?: string
  impactLevel: ImpactLevel
  authBoundary?: string
}
