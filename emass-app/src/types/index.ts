// ─── Common ──────────────────────────────────────────────────────────────────

export type ImpactLevel = 'Low' | 'Moderate' | 'High' | 'Not Applicable'
export type BaselineProfile = 'LOW' | 'MODERATE' | 'HIGH'
export type Severity = 'Critical' | 'High' | 'Moderate' | 'Low' | 'Informational'

export interface AuditFields {
  createdAt: string
  updatedAt: string
}

export interface EvidenceLink {
  id: string
  label: string
  url: string
  addedAt: string
}

// ─── System ──────────────────────────────────────────────────────────────────

export type SystemType = 'Major Application' | 'General Support System' | 'Minor Application'

export type ATOStatus =
  | 'Pre-ATO'
  | 'In Assessment'
  | 'ATO Active'
  | 'ATO Expired'
  | 'IATT'
  | 'Denied'

export interface CIAAnswers {
  confidentiality: ImpactLevel
  integrity: ImpactLevel
  availability: ImpactLevel
  confidentialityRationale: string
  integrityRationale: string
  availabilityRationale: string
}

export interface InfoSystem extends AuditFields {
  id: string
  name: string
  abbreviation: string
  systemType: SystemType
  organization: string
  description: string
  classificationMarking?: string
  ciaAnswers: CIAAnswers
  recommendedBaseline: BaselineProfile
  selectedBaseline: BaselineProfile
  atoStatus: ATOStatus
  atoExpirationDate: string | null
  systemOwner: string
  isso: string
  issm: string
}

// ─── Control Catalog ─────────────────────────────────────────────────────────

export type ControlFamily =
  | 'AC' | 'AT' | 'AU' | 'CA' | 'CM' | 'CP'
  | 'IA' | 'IR' | 'MA' | 'MP' | 'PE' | 'PL'
  | 'PM' | 'PS' | 'RA' | 'SA' | 'SC' | 'SI' | 'SR'

export interface ControlFamilyMeta {
  id: ControlFamily
  name: string
  icon?: string
}

export interface ControlEnhancement {
  id: string
  title: string
  description: string
  lowBaseline: boolean
  moderateBaseline: boolean
  highBaseline: boolean
}

export interface Control {
  id: string
  family: ControlFamily
  title: string
  description: string
  supplementalGuidance?: string
  relatedControls: string[]
  lowBaseline: boolean
  moderateBaseline: boolean
  highBaseline: boolean
  enhancements: ControlEnhancement[]
  sortOrder: number
}

// ─── SCTM ─────────────────────────────────────────────────────────────────────

export type ControlStatus =
  | 'Implemented'
  | 'Partially Implemented'
  | 'Planned'
  | 'Not Implemented'
  | 'Not Applicable'
  | 'Inherited'
  | 'Under Review'

export type ImplementationOrigin = 'System Specific' | 'Inherited' | 'Hybrid' | 'Common'

export interface SCTMEntry extends AuditFields {
  id: string
  systemId: string
  controlId: string
  status: ControlStatus
  implementationOrigin: ImplementationOrigin
  responsibleRole: string
  implementationStatement: string
  assessorNotes: string
  evidenceLinks: EvidenceLink[]
  inheritedFrom: string | null
  targetCompletionDate: string | null
}

// ─── POAM ─────────────────────────────────────────────────────────────────────

export type POAMStatus =
  | 'Open'
  | 'In Progress'
  | 'Completed'
  | 'Risk Accepted'
  | 'False Positive'
  | 'Vendor Dependency'

export type FindingSource =
  | 'SAR'
  | 'Vulnerability Scan'
  | 'Penetration Test'
  | 'Audit'
  | 'Self-Assessment'
  | 'Continuous Monitoring'

export interface POAMMilestone extends AuditFields {
  id: string
  description: string
  scheduledDate: string
  completedDate: string | null
  status: 'Pending' | 'Complete' | 'Delayed'
}

export interface POAMItem extends AuditFields {
  id: string
  systemId: string
  poamId: string
  weakness: string
  description: string
  findingSource: FindingSource
  severity: Severity
  relatedControls: string[]
  responsibleOffice: string
  scheduledCompletionDate: string
  milestones: POAMMilestone[]
  mitigationDescription: string
  status: POAMStatus
  discoveryDate: string
  closedDate: string | null
  vulnerabilityId: string | null
  cveId: string | null
  resourcesRequired: string
  estimatedCost: number | null
}

// ─── Diagrams ─────────────────────────────────────────────────────────────────

export type DiagramType =
  | 'Authorization Boundary'
  | 'Network'
  | 'Data Flow'
  | 'Hardware'
  | 'Software'
  | 'Other'

export interface Diagram extends AuditFields {
  id: string
  systemId: string
  name: string
  diagramType: DiagramType
  description: string
  filename: string
  originalName: string
  mimeType: string
  size: number
}

// ─── Vulnerability ────────────────────────────────────────────────────────────

export type ScanSource =
  | 'ACAS/Nessus'
  | 'OpenVAS'
  | 'Qualys'
  | 'Manual'
  | 'STIG/SRG'
  | 'Penetration Test'
  | 'Other'

export type VulnStatus = 'Open' | 'Mitigated' | 'False Positive' | 'Risk Accepted' | 'POAM Created'

export interface Vulnerability extends AuditFields {
  id: string
  systemId: string
  title: string
  description: string
  severity: Severity
  cvssScore: number | null
  cveId: string | null
  pluginId: string | null
  source: ScanSource
  affectedAssets: string[]
  relatedControls: string[]
  status: VulnStatus
  discoveryDate: string
  mitigationNotes: string
  poamId: string | null
  scanDate: string | null
}
