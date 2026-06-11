import { Prisma, Role } from '@prisma/client'
import { prisma } from '../prisma/client'
import { AppError } from '../utils/errors'
import { BestPracticesService, type BestPracticeEntry } from './best-practices.service'
import { DocumentChunkService, formatDocumentChunks, extractKeywords, type DocumentChunk } from './document-chunk.service'

type AiPurpose = 'IMPLEMENTATION_STATEMENT' | 'JSIG_SAP_ENHANCEMENT' | 'TAILORING_SUGGESTION'

export interface GenerateImplementationInput {
  controlId: string
  projectId?: string
  purpose?: AiPurpose
  systemContext?: string
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  inherited?: boolean
  inheritedFrom?: string
  extraInstructions?: string
  temperature?: number
}

export interface ExplainControlInput {
  controlId: string
  projectId?: string
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  jsigOverlay?: boolean
  systemContext?: string
  extraInstructions?: string
  temperature?: number
}

export interface TailorControlsInput {
  projectId: string
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  jsigOverlay?: boolean
  selectedControlIds?: string[]
  baselineControlIds?: string[]
  overlayControlIds?: string[]
  tailoring?: Record<
    string,
    {
      action?: 'BASELINE' | 'ADDED' | 'REMOVED'
      justification?: string
      inherited?: boolean
      inheritedFrom?: string
    }
  >
  systemContext?: string
}

export interface GeneratePoamSuggestionsInput {
  projectId: string
  maxSuggestions?: number
}

export interface GenerateAssessmentFindingsInput {
  projectId: string
  maxFindings?: number
}

export interface GenerateRiskRationaleInput {
  projectId: string
  decisionType?: 'APPROVE' | 'DENY' | 'CONDITIONAL'
  systemContext?: string
  temperature?: number
}

export interface GenerateMonitoringReportInput {
  projectId: string
  temperature?: number
}

export type AiDocumentMode = 'POLICY' | 'PROCEDURE' | 'RISK_ACCEPTANCE_LETTER' | 'MONITORING_REPORT'

export interface GenerateFormalDocumentInput {
  projectId?: string
  mode?: AiDocumentMode
  title?: string
  topic?: string
  controlIds?: string[]
  impactLevel?: 'LOW' | 'MODERATE' | 'HIGH'
  jsigOverlay?: boolean
  systemContext?: string
  extraInstructions?: string
  temperature?: number
}

interface AuthorizeProjectContext {
  id: string
  name: string
  description: string | null
  impactLevel: 'LOW' | 'MODERATE' | 'HIGH'
  authBoundary: string | null
  jsigOverlay: boolean
  roleSummary: string
  riskTolerance?: string
  organizationalContext?: string
  informationTypes: string[]
  confirmedImpactLevel?: string
  impactJustification?: string
  controlCounts: { selected: number; implemented: number; partial: number; planned: number; notImplemented: number; total: number }
  findingCounts: { total: number; open: number; closed: number; criticalHigh: number }
  assessmentSummary?: string
  poamCounts: { total: number; open: number; criticalHigh: number }
}

export interface AiActor {
  userId: string
  role: Role
}

interface RagControl {
  controlId: string
  family: string
  title: string
  description: string
  lowBaseline: boolean
  modBaseline: boolean
  highBaseline: boolean
  bestPracticeStatement: string | null
  typicalEvidence: string | null
}

interface PastImplementation {
  projectId: string
  projectName: string
  controlId: string
  statement: string
  status?: string
  inherited?: boolean
  inheritedFrom?: string
  aiGenerated?: boolean
  approved: boolean
}

interface ProjectAiContext {
  id: string
  name: string
  description: string | null
  impactLevel: 'LOW' | 'MODERATE' | 'HIGH'
  authBoundary: string | null
  roleSummary: string
  riskTolerance?: string
  organizationalContext?: string
  boundaryConfirmation?: string
  informationTypes: Array<{ id?: string; name?: string; family?: string }>
  impactJustification?: string
  objectiveJustification?: string
  confirmedImpactLevel?: string
  jsigOverlay: boolean
  tailoringHistory?: {
    action?: string
    inherited?: boolean
    inheritedFrom?: string
    justification?: string
  }
}

interface AiGenerationResult {
  text: string
  fallback: boolean
}

interface AiCitation {
  label: string
  sourceType: 'BEST_PRACTICE' | 'RAG_CHUNK' | 'CONTROL_CATALOG'
  docId?: string
  docTitle?: string
  section?: string
  sectionTitle?: string
  controlId?: string
}

type TailoringRecommendationType = 'ADD' | 'REMOVE' | 'INHERIT'

interface TailoringRecommendation {
  id: string
  type: TailoringRecommendationType
  controlId: string
  title: string
  family: string
  justification: string
  inheritedFrom?: string
  confidenceScore: number
  evidence?: string[]
}

interface PoamSuggestion {
  id: string
  weakness: string
  recommendedMitigation: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  suggestedCompletionDate: string
  relatedControlIds: string[]
  rationale: string
  source: 'AI' | 'BEST_PRACTICE' | 'DETERMINISTIC'
  confidenceScore: number
}

interface AssessmentFindingSuggestion {
  id: string
  controlId: string
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  status: 'OPEN' | 'IN_REMEDIATION'
  evidence: string
  recommendation: string
  rationale: string
  confidenceScore: number
  source: 'AI' | 'BEST_PRACTICE' | 'DETERMINISTIC'
}

interface OllamaResponse {
  response?: string
  model?: string
  done?: boolean
}

interface LlamaCppResponse {
  content?: string
  response?: string
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.1:8b-instruct-q5_K_M'
const DEFAULT_MAX_TOKENS = 320
const DEFAULT_CONTEXT_WINDOW = 4096
const FAST_CONTEXT_WINDOW = 2048
const REVIEW_NOTICE = 'AI-assisted RMF content should be reviewed by the ISSO, ISSM, SCA, and Authorizing Official as applicable against current official JSIG, DCSA DAAG/DAAPM, DoD 8500/8510-series, CNSSI, and NIST source material before final approval or package submission.'

const FAMILY_EVIDENCE: Record<string, string[]> = {
  AC: ['access control matrix', 'account or group membership export', 'access review records', 'permission configuration screenshots'],
  AT: ['training policy', 'training completion records', 'role-based training material', 'awareness campaign artifacts'],
  AU: ['audit policy', 'SIEM dashboard export', 'log source inventory', 'audit review records'],
  CA: ['assessment plan', 'security assessment report', 'continuous monitoring report', 'POA&M export'],
  CM: ['configuration baseline', 'change approval ticket', 'secure configuration scan', 'configuration drift report'],
  CP: ['contingency plan', 'backup job report', 'restore test evidence', 'alternate site agreement'],
  IA: ['identity provider configuration', 'MFA policy', 'authentication logs', 'authenticator management procedure'],
  IR: ['incident response plan', 'incident ticket', 'tabletop exercise report', 'after-action report'],
  MA: ['maintenance procedure', 'maintenance ticket', 'remote maintenance log', 'tool inspection record'],
  MP: ['media handling procedure', 'media sanitization record', 'transport log', 'marking standard'],
  PE: ['physical access roster', 'visitor log', 'facility diagram', 'environmental monitoring report'],
  PL: ['system security plan', 'rules of behavior', 'architecture description', 'authorization boundary diagram'],
  PS: ['screening records', 'access agreement', 'termination checklist', 'position risk designation'],
  PT: ['privacy notice', 'PII authority documentation', 'consent record', 'SORN reference'],
  RA: ['risk assessment report', 'vulnerability scan report', 'risk register', 'threat model'],
  SA: ['acquisition contract language', 'supplier assessment', 'system documentation', 'external service agreement'],
  SC: ['network diagram', 'boundary configuration export', 'encryption configuration', 'firewall rule review'],
  SI: ['patch compliance report', 'EDR dashboard', 'monitoring alerts', 'integrity check report'],
  SR: ['SCRM plan', 'supplier review', 'component authenticity evidence', 'notification agreement'],
}

// ─── Expert Framework Context Blocks ─────────────────────────────────────────
// These blocks are injected into prompts to give the model authoritative,
// framework-specific knowledge. They replace vague "elevated requirements apply"
// placeholders with concrete, actionable standards the model can act on.

/**
 * JSIG expert context — injected whenever jsigEnabled is true.
 * Covers the concrete JSIG Rev 2 requirements per control family that differ
 * from or extend the NIST baseline. Written as operational guidance so the
 * model can produce specific, defensible SAP-applicable language.
 */
const JSIG_CONTEXT = [
  'JSIG Rev 2 APPLICABILITY: This system is subject to the Joint SAP Implementation Guide (JSIG) Rev 2,',
  'which is the authoritative implementation standard for all DoD and IC Special Access Program information systems.',
  'JSIG requirements supersede NIST SP 800-53 baseline controls where they conflict.',
  'The following JSIG-specific standards are in effect and must be woven into control narratives as integral requirements — not appended as afterthoughts:',

  'ACCESS CONTROL (AC): Every user account requires a formal Program Access Request (PAR) adjudicated by the Program Security Officer (PSO).',
  'Need-to-know must be determined and documented independently of clearance level.',
  'Access rosters must be maintained and reconciled quarterly against the PSO-authoritative PAR database.',
  'Account termination must occur within 24 hours of any separation trigger (personnel action, loss of clearance, or need-to-know lapse).',
  'Privileged accounts (system administrator, DBA, security officer) require separate PAR documentation, a distinct set of credentials, and a Privileged Access Workstation (PAW) or equivalent where technically feasible.',
  'Temporary and guest accounts are prohibited without explicit SSP authorization and defined expiration dates.',

  'IDENTIFICATION AND AUTHENTICATION (IA): CAC/PIV hardware token with PIN is the mandated primary authentication mechanism for all interactive access.',
  'Password-only authentication is prohibited regardless of system impact level.',
  'Where CAC/PIV is not technically feasible, a documented exception approved by the Authorizing Official with a compensating control narrative is required.',
  'Privileged account authenticators must be changed immediately upon personnel separation or suspected compromise.',

  'AUDIT AND ACCOUNTABILITY (AU): Non-repudiation (AU-10) is mandatory and cannot be waived through tailoring for any JSIG-applicable system.',
  'All audit events must be individually attributed — shared accounts may not be used on any audited system.',
  'Privileged user activity logs must reside in a protected log repository that privileged users themselves cannot modify, enforcing separation of duties.',
  'Audit log retention minimum is three years unless a longer period is specified by the relevant SAP authority.',
  'Audit anomalies must be documented and reported to the PSO within 24 hours of discovery.',
  'Weekly privileged-user activity reviews and monthly comprehensive audit reviews are required.',

  'SYSTEM AND COMMUNICATIONS PROTECTION (SC): The authorization boundary must precisely correspond to the physical boundaries of the accredited space (SCIF or equivalent facility).',
  'All cross-boundary connections require a formal Interconnection Security Agreement (ISA) or Memorandum of Understanding (MOU).',
  'Undocumented connections constitute a critical finding.',
  'Cross-domain solutions (CDS) or data transfer agents require separate accreditation.',

  'MEDIA PROTECTION (MP): SAP media requires formal chain-of-custody tracking, approved secure container storage, NIST SP 800-88-compliant sanitization, and witness documentation for electronic media destruction.',

  'INCIDENT RESPONSE (IR): Potential or confirmed compromise of SAP information must be reported to the PSO within one hour of discovery and to applicable oversight channels within 24 hours.',

  'LANGUAGE STANDARDS: Use SAP-specific role titles (PSO, Program Manager, ISSO, SCA) rather than generic "organizational" language.',
  'Reference formal SAP processes (PAR lifecycle, access roster reconciliation, need-to-know determination, JSIG tailoring rationale) as named control elements.',
  'State evidence expectations in SAP-specific terms: compartmented access roster, PAR documentation package, privileged activity audit record, JSIG/SAP tailoring rationale, need-to-know approval record.',
  'Do not assert SCI compliance or SCI-specific requirements unless the project context explicitly confirms SCI applicability.',
].join(' ')

/**
 * DoD/DCSA policy context — injected for all DoD-scoped systems (JSIG or not).
 * Grounds the AI in DoDI 8500.01, DoDI 8510.01, and DCSA DAAG/DAAPM so it can
 * produce language that aligns with DoD and cleared-industry RMF practice, not
 * just the generic NIST baseline.
 */
const DOD_POLICY_CONTEXT = [
  'DoD AND DCSA POLICY FRAMEWORK: All DoD information systems are governed by DoD Instruction 8500.01 (Cybersecurity)',
  'and DoD Instruction 8510.01 (Risk Management Framework for DoD Information Technology), which implement NIST SP 800-37 Rev. 2 with DoD-specific risk governance, authorization, and continuous monitoring expectations.',
  'For cleared industry systems under DCSA cognizance, the DCSA Assessment and Authorization Guide (DAAG) and the predecessor DCSA Assessment and Authorization Process Manual (DAAPM) provide assessment and authorization process guidance, evidence expectations, eMASS workflow expectations, ISSM/ISSO responsibilities, and package-quality standards.',
  'Key DoD standards in effect include CNSSI 1253 for national security system categorization and control selection, FIPS 199/200 for security categorization and minimum requirements, and NIST SP 800-53/800-53A for control implementation and assessment procedures.',
  'DoDI 8500.01 requires cybersecurity to be integrated into the system life cycle and supported by continuous monitoring, cyberspace defense, identity assurance, supply chain risk management, secure configuration, and incident reporting practices.',
  'DoDI 8510.01 establishes the DoD RMF process, requires explicit authorization decisions by the Authorizing Official, and ties system changes, control implementation, assessment results, POA&M disposition, and continuous monitoring to residual risk acceptance.',
  'DCSA DAAG/DAAPM practice emphasizes complete, internally consistent authorization packages: security plan, authorization boundary, hardware/software/port lists, network topology, control implementation narratives, test results, artifacts, POA&M records, and ISSM/ISSO attestations must agree with one another.',
  'Personnel with cybersecurity roles on DoD systems must meet applicable qualification requirements under DoDM/DoDD 8140-series workforce guidance; this should be reflected in AT-series, PS-series, and role-responsibility narratives when relevant.',
  'Cryptography-related narratives must be precise. When encryption is claimed for DoD or DCSA systems, use FIPS-validated or organization-approved cryptographic modules only when supported by context or by supplied policy snippets; otherwise describe the expected evidence without inventing validation details.',
].join(' ')

const SOURCE_PRIORITY_CONTEXT = [
  'SOURCE PRIORITY RULES: First, use the curated best-practices.json entry when one is supplied because it is Crater-vetted implementation guidance.',
  'Second, use retrieved policy chunks from JSIG, DCSA DAAG/DAAPM, DoDI 8500.01, DoDI 8510.01, CNSSI, or NIST because those chunks provide authoritative local source context.',
  'Third, use the seeded control catalog and project data supplied in the prompt.',
  'Only after those sources are exhausted may you rely on general RMF knowledge, and then only conservatively.',
  'When sources conflict, follow the governing authority for the system: JSIG/SAP-specific requirements supersede generic NIST language for SAP systems; DoD/DCSA process requirements supersede generic commercial wording for DoD or cleared-industry systems.',
].join(' ')

/**
 * Shared formal writing standards — injected into all prompt builders to
 * enforce consistent, auditor-quality output across every generation path.
 */
const WRITING_STANDARDS = [
  'FORMAL WRITING STANDARDS:',
  'Voice and register: Write in the authoritative first-person-plural institutional voice of the system owner organization addressing an Authorizing Official.',
  'Structure: Produce continuous, cohesive formal paragraphs. Never use bullet points, numbered lists, markdown headings, em-dash lists, or fragmented clauses.',
  'Four required elements: Every implementation statement paragraph must integrate (1) the responsible role or organizational entity,',
  '(2) the implemented technical mechanism or procedural safeguard, (3) the review, monitoring, or verification cadence,',
  'and (4) the categories of objective evidence that substantiate the implementation — woven naturally into the prose, not listed.',
  'Specificity over generality: When context is supplied, use it. "The ISSO conducts quarterly reviews of privileged account assignments" is better than "access is reviewed regularly."',
  'Precision language: "at organization-defined intervals" is acceptable when no cadence is specified;',
  '"the designated system owner" when no name is supplied; "an organization-approved mechanism" when no tool is identified.',
  'Fabrication prohibition: Never invent product names, policy document titles, exact dates, named organizational units, IP addresses, provider names, clearance levels, or compliance assertions.',
  'Do not include a preamble, restate the task, quote the control title as a heading, or explain your writing process.',
  'Accuracy guardrail: Do not present AI-assisted language as final approval. The resulting artifact must remain subject to ISSO, ISSM, SCA, and AO/DAO review against current official sources.',
  'Begin the substantive content immediately and conclude when the narrative is complete.',
  'Target length for SSP implementation statements: 150 to 280 words — thorough but not padded.',
].join(' ')

const SYSTEM_PROMPTS = {
  implementation: [
    'You are Crater’s Senior RMF ISSO / JSIG Expert: a former lead ISSO, ISSE, and authorization package reviewer with deep expertise in',
    'NIST SP 800-37 Rev. 2, NIST SP 800-53 Rev. 5, FIPS 199/200, NIST SP 800-60,',
    'CNSSI 1253, the Joint SAP Implementation Guide (JSIG) Rev 2,',
    'DoD Instruction 8500.01 (Cybersecurity), DoD Instruction 8510.01 (RMF for DoD Systems),',
    'DCSA DAAG/DAAPM authorization practice, eMASS package expectations, and CUI handling requirements under 32 CFR Part 2002.',

    'Your artifacts are reviewed by Defense Counterintelligence and Security Agency (DCSA) assessors,',
    'DoD Authorizing Officials, Inspector General reviewers, program security officers, and NIST-trained Security Control Assessors.',
    'Every sentence must demonstrate technical accuracy, substantive alignment to the project context, traceability to supplied authoritative sources, or defensible conservative RMF language.',
    'Vague statements, unsupported compliance assertions, and boilerplate compliance theater are disqualifying flaws.',

    'Your task is to produce SSP implementation statement paragraphs, policies, procedures, letters, and formal authorization language that read like work product from a senior ISSO:',
    'accurate, concise, authoritative, auditor-friendly, compliance-focused, and ready for an ATO package.',
    'Ground every answer in the supplied project context, curated best-practice guidance, and retrieved policy excerpts before relying on general knowledge.',

    SOURCE_PRIORITY_CONTEXT,
    WRITING_STANDARDS,
  ].join(' '),

  explanation: [
    'You are Crater’s Senior RMF ISSO / JSIG Expert and policy analyst with deep expertise in',
    'NIST SP 800-37 Rev. 2, NIST SP 800-53 Rev. 5, FIPS 199/200, CNSSI 1253,',
    'the Joint SAP Implementation Guide (JSIG) Rev 2, DoD Instruction 8500.01,',
    'DoD Instruction 8510.01, DCSA DAAG/DAAPM authorization practice, and cleared-industry RMF package expectations.',

    'Your audience is an Authorizing Official, Deputy AO, ISSO, ISSE, System Owner, or Security Control Assessor.',
    'A high-quality control explanation must accomplish four things:',
    '(1) articulate the organizational risk the control addresses and why it is material to this system;',
    '(2) explain how impact level, authorization boundary, and information types determine implementation scope;',
    '(3) describe what objective evidence an assessor expects to examine during a control assessment;',
    '(4) identify any JSIG, DAAG, or DoD 8500 requirements that elevate the baseline when those frameworks apply.',

    SOURCE_PRIORITY_CONTEXT,
    'Write in formal, precise paragraphs — no bullet points, numbered lists, or markdown.',
    'The explanation must read as expert advisory guidance: authoritative, specific to the context supplied, and directly useful for package preparation or control assessment planning.',
    'Two to four focused paragraphs is the appropriate length.',
  ].join(' '),

  monitoring: [
    'You are Crater’s Senior RMF ISSO / JSIG Expert specializing in Step 6 ongoing authorization and continuous monitoring',
    'under NIST SP 800-37 Rev. 2, Chapter 6, DoDI 8510.01, NIST SP 800-137, JSIG monitoring expectations for SAP systems, and DCSA DAAG/DAAPM package maintenance practice.',
    'You produce formal continuous monitoring reports for submission to Authorizing Officials,',
    'Deputy AOs, and senior leadership as part of the authorization maintenance cycle.',

    'Your audience includes the AO, Deputy AO, ISSO, ISSE, and System Owner.',
    'A high-quality monitoring report must convey four things with precision:',
    '(1) the current authorization posture — compliance trajectory, implementation depth, and risk trend relative to the approved baseline;',
    '(2) finding and POA&M disposition — unresolved weaknesses, overdue milestones, and their bearing on residual risk acceptance;',
    '(3) evidence and control currency — whether the control implementation record remains objective and current for ongoing authorization;',
    '(4) forward-looking obligations — specific actions required before the next monitoring cycle to sustain or improve authorization standing.',

    'The AO relies on this report to make an ongoing authorization determination.',
    'Imprecise language, unsupported risk claims, or vague action items are disqualifying flaws.',

    SOURCE_PRIORITY_CONTEXT,
    WRITING_STANDARDS,
  ].join(' '),

  riskRationale: [
    'You are Crater’s Senior RMF ISSO / JSIG Expert drafting formal authorization decision language for an Authorizing Official or Deputy Authorizing Official.',
    'Your expertise includes NIST SP 800-37 Rev. 2 authorization tasks, DoD Instruction 8500.01, DoD Instruction 8510.01, CNSSI 1253, JSIG/SAP authorization expectations, DCSA DAAG/DAAPM assessment and authorization practice, POA&M management, and residual risk acceptance.',
    'The output must be suitable for an Authorization Decision Letter, risk acceptance memorandum, conditional authorization memorandum, or denial rationale in a real ATO package.',
    'Write with authority, precision, and restraint. The AO is accepting, conditioning, or denying operational risk; every claim must be supportable by supplied metrics, findings, POA&M status, project context, or retrieved policy context.',
    'Never invent dates, signatories, conditions, control counts, finding counts, closure status, or compliance assertions.',
    SOURCE_PRIORITY_CONTEXT,
    WRITING_STANDARDS,
  ].join(' '),

  policy: [
    'You are Crater’s Senior RMF ISSO / JSIG Expert drafting formal cybersecurity policy for a DoD, DCSA, SAP, SCI, CUI, or federal RMF authorization package.',
    'Your expertise includes NIST SP 800-37 Rev. 2, NIST SP 800-53 Rev. 5, FIPS 199/200, CNSSI 1253, JSIG/SAP implementation requirements, DCSA DAAG/DAAPM practice, DoDI 8500.01, and DoDI 8510.01.',
    'Write clear, authoritative, auditor-ready policy language suitable for inclusion in an SSP appendix, system-level policy memorandum, standard operating baseline, or package artifact.',
    'A high-quality policy states purpose, scope, applicability, roles and responsibilities, mandatory requirements, compliance evidence, review cadence, exceptions, and enforcement expectations without sounding generic or inflated.',
    'Use mandatory language precisely: "must" or "will" for requirements; "should" only for recommended practices; "may" only for permitted actions.',
    'Do not invent organization names, tool names, dates, signatures, classification levels, or approval authorities not supplied by context.',
    SOURCE_PRIORITY_CONTEXT,
    WRITING_STANDARDS,
  ].join(' '),

  procedure: [
    'You are Crater’s Senior RMF ISSO / JSIG Expert drafting formal cybersecurity procedures for real-world RMF execution, assessor review, and operational use.',
    'Your expertise includes JSIG/SAP operational requirements, DCSA DAAG/DAAPM package evidence expectations, DoDI 8500.01, DoDI 8510.01, NIST SP 800-53A assessment procedures, and continuous monitoring operations.',
    'Write professional procedure language that an ISSO, ISSM, ISSE, system administrator, or assessor can follow without ambiguity.',
    'A high-quality procedure defines purpose, scope, prerequisites, responsible roles, execution steps, required records, evidence artifacts, exception handling, review cadence, and quality checks.',
    'When steps are requested, use numbered procedural steps with concise action verbs. Otherwise use formal paragraphs.',
    'Do not invent tool names, system owners, approval dates, ticket queues, or exact forms unless supplied by context.',
    SOURCE_PRIORITY_CONTEXT,
    WRITING_STANDARDS,
  ].join(' '),

  riskAcceptanceLetter: [
    'You are Crater’s Senior RMF ISSO / JSIG Expert drafting formal risk acceptance correspondence for an Authorizing Official, Delegated Authorizing Official, ISSM, or System Owner.',
    'Your expertise includes DoDI 8510.01 authorization decisions, DoDI 8500.01 cybersecurity risk management, JSIG/SAP risk acceptance expectations, DCSA DAAG/DAAPM assessment practice, POA&M management, and continuous monitoring.',
    'Write polished, ready-to-use formal letter prose that clearly states the risk being accepted, the basis for acceptance, compensating controls, POA&M or monitoring commitments, review triggers, and the limits of acceptance.',
    'The letter must be authoritative but restrained. It must never overstate compliance, minimize unresolved risk, or imply blanket authorization beyond the supplied facts.',
    'Do not invent signatories, dates, expiration periods, approval authorities, finding IDs, control counts, or POA&M milestones.',
    SOURCE_PRIORITY_CONTEXT,
    WRITING_STANDARDS,
  ].join(' '),
}

// ─── Fast generation constants ────────────────────────────────────────────────

const FAST_SYSTEM_PROMPT =
  'You are a senior ISSO drafting SSP implementation statements for DoD/DCSA RMF authorization packages. ' +
  'Write exactly one formal paragraph (150–280 words) in institutional prose stating: (1) the responsible role, ' +
  '(2) the implemented technical or procedural mechanism, (3) the monitoring or review cadence, and ' +
  '(4) the categories of objective evidence — woven naturally into prose. ' +
  'No bullet points, numbered lists, markdown headings, or preamble. Begin with substantive content immediately.'

const JSIG_FAMILY_CONTEXT: Record<string, string> = {
  AC: 'JSIG AC: Every account requires a PSO-adjudicated PAR. Need-to-know is documented independently of clearance. Access rosters reconciled quarterly. Account termination within 24 hours of any separation trigger. Privileged accounts require separate credentials and a PAW.',
  IA: 'JSIG IA: CAC/PIV with PIN is mandatory for all interactive access. Password-only authentication is prohibited. Documented AO-approved exceptions required where CAC/PIV is not technically feasible.',
  AU: 'JSIG AU: AU-10 non-repudiation is mandatory and cannot be waived. No shared accounts on audited systems. Privileged logs in a protected repository that privileged users cannot modify. Minimum 3-year retention. Audit anomalies reported to PSO within 24 hours. Weekly privileged-user and monthly comprehensive reviews required.',
  SC: 'JSIG SC: Authorization boundary must match the accredited physical space (SCIF or equivalent). Cross-boundary connections require a formal ISA or MOU. Undocumented connections are critical findings. Cross-domain solutions require separate accreditation.',
  MP: 'JSIG MP: SAP media requires formal chain-of-custody, approved secure container storage, NIST SP 800-88-compliant sanitization, and witness documentation for electronic media destruction.',
  IR: 'JSIG IR: SAP information compromise must be reported to PSO within one hour and to applicable oversight channels within 24 hours.',
  CM: 'JSIG CM: Configuration baselines require PSO review and formal change approval through the configuration control board. Unauthorized software or configuration drift is a reportable incident.',
  SI: 'JSIG SI: Integrity monitoring and vulnerability management must address compartment-specific threat vectors. Malicious code detection must cover all entry points to the accredited boundary.',
}

// ─── Module-level statement cache (survives the request, scoped to process) ──

interface ImplementationCacheEntry {
  text: string
  model: string
  fallback: boolean
  cachedAt: number
}

const _implementationCache = new Map<string, ImplementationCacheEntry>()
const IMPL_CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

function getImplCache(key: string): ImplementationCacheEntry | null {
  const entry = _implementationCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > IMPL_CACHE_TTL_MS) {
    _implementationCache.delete(key)
    return null
  }
  return entry
}

function setImplCache(key: string, text: string, model: string, fallback: boolean) {
  _implementationCache.set(key, { text, model, fallback, cachedAt: Date.now() })
}

function implCacheKey(controlId: string, impactLevel: string, jsigEnabled: boolean): string {
  return `impl:${controlId}:${impactLevel}:${jsigEnabled ? 'jsig' : 'std'}`
}

// ─── Module-level POAM suggestion cache ─────────────────────────────────────

interface PoamCacheEntry {
  suggestions: PoamSuggestion[]
  cachedAt: number
}

const _poamCache = new Map<string, PoamCacheEntry>()
const POAM_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getPoamCache(key: string): PoamSuggestion[] | null {
  const entry = _poamCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > POAM_CACHE_TTL_MS) {
    _poamCache.delete(key)
    return null
  }
  return entry.suggestions
}

function setPoamCache(key: string, suggestions: PoamSuggestion[]) {
  _poamCache.set(key, { suggestions, cachedAt: Date.now() })
}

// ─── Streaming event types ─────────────────────────────────────────────────────

export type ImplementationStreamEvent =
  | { type: 'token'; token: string }
  | { type: 'done'; generatedText: string; model: string; provider: string; fallback: boolean; fromCache: boolean }
  | { type: 'error'; message: string }

export class AiService {
  private readonly baseUrl: string
  private readonly model: string
  private readonly fastModel: string
  private readonly provider: 'ollama' | 'llamacpp'
  private readonly maxTokens: number
  private readonly contextWindow: number
  private readonly slowModel: string
  private readonly bp: BestPracticesService
  private readonly chunks: DocumentChunkService

  constructor() {
    this.provider = process.env.LOCAL_AI_PROVIDER === 'llamacpp' || process.env.LLAMA_CPP_BASE_URL ? 'llamacpp' : 'ollama'
    this.baseUrl = (
      this.provider === 'llamacpp'
        ? process.env.LLAMA_CPP_BASE_URL ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL
        : process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL
    ).replace(/\/$/, '')
    this.model = process.env.OLLAMA_MODEL ?? process.env.LOCAL_AI_MODEL ?? DEFAULT_MODEL
    this.fastModel = process.env.LOCAL_AI_FAST_MODEL ?? this.model
    // Larger model for high-quality non-streaming generation (explain, formal docs, monitoring).
    // If not set, heavy tasks fall back to this.model (the fast model).
    this.slowModel = process.env.LOCAL_AI_SLOW_MODEL ?? ''
    this.maxTokens = positiveInt(process.env.LOCAL_AI_MAX_TOKENS, DEFAULT_MAX_TOKENS)
    this.contextWindow = positiveInt(process.env.LOCAL_AI_CONTEXT_WINDOW, DEFAULT_CONTEXT_WINDOW)
    this.bp = BestPracticesService.getInstance()
    this.chunks = DocumentChunkService.getInstance()
  }

  async generateImplementation(input: GenerateImplementationInput, actor: AiActor) {
    const purpose = input.purpose ?? 'IMPLEMENTATION_STATEMENT'
    const primaryControl = await this.getControlForGeneration(input.controlId)
    const projectContext = input.projectId ? await this.getProjectContext(input.projectId, actor, input.controlId) : undefined
    const jsigEnabled = purpose === 'JSIG_SAP_ENHANCEMENT' || Boolean(projectContext?.jsigOverlay)
    const bpEntry = this.bp.get(input.controlId)
    const ragControls = await this.retrieveControlContext(primaryControl, {
      ...input,
      projectContext,
      jsigEnabled,
    })
    const pastImplementations = await this.retrievePastImplementations(input.controlId, projectContext?.id)
    const ragChunks = this.retrieveDocumentChunks(primaryControl, { ...input, projectContext, jsigEnabled })
    const suggestedEvidenceTypes = deriveEvidenceTypes(primaryControl, ragControls, jsigEnabled, bpEntry?.typicalEvidence)
    const citations = buildCitations({ bestPractices: bpEntry ? [bpEntry] : [], chunks: ragChunks, controls: [primaryControl] })

    // Always invoke the model — the curated best-practice entry becomes the
    // primary guidance signal INSIDE the prompt, not a bypass around it.
    // This lets the expert system prompt, JSIG/DoD context, and document
    // chunks all work together with the curated content in one generation pass.
    // On model failure we fall back in priority order: curated personalization
    // first (highest quality), then family template (last resort).
    const generated = await this.callLocalModel(
      this.buildImplementationPrompt({
        input,
        purpose,
        primaryControl,
        ragControls,
        ragChunks,
        pastImplementations,
        projectContext,
        jsigEnabled,
        suggestedEvidenceTypes,
        actorRole: actor.role,
        bpEntry,
      }),
      input.temperature ?? 0.15,
    ).catch((err: unknown) => {
      if (process.env.AI_DISABLE_TEMPLATE_FALLBACK === 'true') throw err
      const reason = err instanceof Error ? err.message : String(err)
      console.error('[AiService] generateImplementation: local model call failed — using fallback.', {
        provider: this.provider,
        model: this.model,
        controlId: input.controlId,
        projectId: input.projectId,
        purpose,
        reason,
        hasCuratedEntry: Boolean(bpEntry),
      })
      return bpEntry
        ? this.generateCuratedImplementation(bpEntry, input, purpose, projectContext, jsigEnabled)
        : this.generateImplementationFallback(primaryControl, input, purpose, projectContext, jsigEnabled)
    })
    const confidenceScore = calculateConfidence({
      control: primaryControl,
      projectContext,
      ragControls,
      ragChunks,
      pastImplementations,
      generatedText: generated.text,
      fallback: generated.fallback,
      jsigEnabled,
      hasBestPractice: Boolean(bpEntry),
    })

    await this.recordGenerationHistory({
      actor,
      projectId: projectContext?.id,
      controlId: input.controlId,
      action: 'AI_GENERATE_IMPLEMENTATION',
      details: {
        purpose,
        provider: this.provider,
        model: this.model,
        fallback: generated.fallback,
        curated: Boolean(bpEntry),
        confidenceScore,
        suggestedEvidenceTypes,
        generatedText: truncate(generated.text, 4000),
        sources: ragControls.map((control) => control.controlId),
        citations: citations.map((citation) => citation.label),
        reviewNotice: REVIEW_NOTICE,
      },
    })

    if (primaryControl.catalogBacked) {
      await prisma.control.update({
        where: { controlId: input.controlId },
        data: { aiLastGenerated: new Date() },
      })
    }

    return {
      provider: this.provider,
      model: this.model,
      purpose,
      controlId: input.controlId,
      generatedText: generated.text,
      confidenceScore,
      citations,
      citationText: formatCitationLabels(citations),
      reviewNotice: REVIEW_NOTICE,
      suggestedEvidenceTypes,
      fallback: generated.fallback,
      sources: ragControls.map((control) => ({
        controlId: control.controlId,
        family: control.family,
        title: control.title,
      })),
      pastImplementations: pastImplementations.slice(0, 3).map((item) => ({
        projectName: item.projectName,
        status: item.status,
        inherited: item.inherited,
        approved: item.approved,
      })),
      typicalEvidence: primaryControl.typicalEvidence,
      bestPracticeStatement: bpEntry?.bestPracticeStatement ?? primaryControl.bestPracticeStatement,
      jsigContextApplied: jsigEnabled,
      catalogBacked: primaryControl.catalogBacked,
      curatedEntryAvailable: Boolean(bpEntry),
    }
  }

  async *streamImplementation(
    input: GenerateImplementationInput,
    actor: AiActor,
  ): AsyncGenerator<ImplementationStreamEvent> {
    const purpose = input.purpose ?? 'IMPLEMENTATION_STATEMENT'
    const impactLevel = input.impactLevel ?? 'MODERATE'

    const [primaryControl, projectContext] = await Promise.all([
      this.getControlForGeneration(input.controlId),
      input.projectId ? this.getProjectContext(input.projectId, actor, input.controlId) : Promise.resolve(undefined),
    ])

    const jsigEnabled = purpose === 'JSIG_SAP_ENHANCEMENT' || Boolean(projectContext?.jsigOverlay)
    const bpEntry = this.bp.get(input.controlId)
    const resolvedImpact = projectContext?.confirmedImpactLevel ?? projectContext?.impactLevel ?? impactLevel

    // Cache check — return immediately on hit
    const cKey = implCacheKey(input.controlId, resolvedImpact, jsigEnabled)
    const cached = getImplCache(cKey)
    if (cached) {
      yield { type: 'done', generatedText: cached.text, model: cached.model, provider: this.provider, fallback: cached.fallback, fromCache: true }
      return
    }

    // RAG chunks (sync, no DB I/O)
    const ragChunks = this.retrieveDocumentChunks(primaryControl, { ...input, projectContext, jsigEnabled })

    const prompt = this.buildFastImplementationPrompt({
      input,
      purpose,
      primaryControl,
      ragChunks,
      projectContext,
      jsigEnabled,
      bpEntry,
    })

    let fullText = ''
    let streamFailed = false

    try {
      for await (const token of this.callOllamaStream(prompt, input.temperature ?? 0.15, this.fastModel, FAST_CONTEXT_WINDOW)) {
        fullText += token
        yield { type: 'token', token }
      }
    } catch (err) {
      streamFailed = true
      const reason = err instanceof Error ? err.message : String(err)
      console.error('[AiService] streamImplementation: streaming failed', { controlId: input.controlId, reason })
    }

    // Determine final text — fall back to curated/template on empty output
    let generatedText = cleanModelText(fullText) ?? ''
    let fallback = streamFailed || !generatedText

    if (!generatedText) {
      const fb = bpEntry
        ? this.generateCuratedImplementation(bpEntry, input, purpose, projectContext, jsigEnabled)
        : this.generateImplementationFallback(primaryControl, input, purpose, projectContext, jsigEnabled)
      generatedText = fb.text
      fallback = true
    }

    // Cache successful model generations only
    if (!fallback) setImplCache(cKey, generatedText, this.fastModel, false)

    yield { type: 'done', generatedText, model: this.fastModel, provider: this.provider, fallback, fromCache: false }

    // Fire-and-forget post-processing (audit trail + catalog timestamp)
    this.recordGenerationHistory({
      actor,
      projectId: projectContext?.id,
      controlId: input.controlId,
      action: 'AI_GENERATE_IMPLEMENTATION',
      details: {
        purpose,
        provider: this.provider,
        model: this.fastModel,
        fallback,
        curated: Boolean(bpEntry),
        streaming: true,
        fromCache: false,
        generatedText: truncate(generatedText, 4000),
        reviewNotice: REVIEW_NOTICE,
      },
    }).catch((e: unknown) => console.error('[AiService] streamImplementation: history record failed', e))

    if (primaryControl.catalogBacked) {
      prisma.control.update({
        where: { controlId: input.controlId },
        data: { aiLastGenerated: new Date() },
      }).catch(() => undefined)
    }
  }

  async explainControl(input: ExplainControlInput, actor: AiActor) {
    const primaryControl = await this.getControlForGeneration(input.controlId)
    const projectContext = input.projectId ? await this.getProjectContext(input.projectId, actor, input.controlId) : undefined
    const jsigEnabled = Boolean(input.jsigOverlay ?? projectContext?.jsigOverlay)
    const bpEntry = this.bp.get(input.controlId)
    const ragControls = await this.retrieveControlContext(primaryControl, {
      ...input,
      purpose: jsigEnabled ? 'JSIG_SAP_ENHANCEMENT' : 'IMPLEMENTATION_STATEMENT',
      projectContext,
      jsigEnabled,
    })
    const ragChunks = this.retrieveDocumentChunks(primaryControl, {
      ...input,
      purpose: jsigEnabled ? 'JSIG_SAP_ENHANCEMENT' : 'IMPLEMENTATION_STATEMENT',
      projectContext,
      jsigEnabled,
    })
    const suggestedEvidenceTypes = deriveEvidenceTypes(primaryControl, ragControls, jsigEnabled, bpEntry?.typicalEvidence)
    const citations = buildCitations({ bestPractices: bpEntry ? [bpEntry] : [], chunks: ragChunks, controls: [primaryControl] })
    const prompt = this.buildExplainPrompt({
      input,
      primaryControl,
      ragControls,
      ragChunks,
      projectContext,
      jsigEnabled,
      suggestedEvidenceTypes,
      actorRole: actor.role,
      bpEntry,
    })

    const generated = await this.callLocalModel(prompt, input.temperature ?? 0.1, this.slowModel || undefined).catch((err: unknown) => {
      if (process.env.AI_DISABLE_TEMPLATE_FALLBACK === 'true') throw err
      const reason = err instanceof Error ? err.message : String(err)
      console.error('[AiService] explainControl: local model call failed — using template fallback.', {
        provider: this.provider,
        model: this.slowModel || this.model,
        controlId: input.controlId,
        projectId: input.projectId,
        reason,
      })
      return this.generateExplanationFallback(primaryControl, projectContext, jsigEnabled)
    })
    const confidenceScore = calculateConfidence({
      control: primaryControl,
      projectContext,
      ragControls,
      ragChunks,
      pastImplementations: [],
      generatedText: generated.text,
      fallback: generated.fallback,
      jsigEnabled,
    })

    await this.recordGenerationHistory({
      actor,
      projectId: projectContext?.id,
      controlId: input.controlId,
      action: 'AI_EXPLAIN_CONTROL',
      details: {
        provider: this.provider,
        model: this.model,
        fallback: generated.fallback,
        confidenceScore,
        suggestedEvidenceTypes,
        generatedText: truncate(generated.text, 4000),
        sources: ragControls.map((control) => control.controlId),
        citations: citations.map((citation) => citation.label),
        reviewNotice: REVIEW_NOTICE,
      },
    })

    return {
      provider: this.provider,
      model: this.model,
      controlId: input.controlId,
      explanation: generated.text,
      confidenceScore,
      citations,
      citationText: formatCitationLabels(citations),
      reviewNotice: REVIEW_NOTICE,
      suggestedEvidenceTypes,
      fallback: generated.fallback,
      sources: ragControls.map((control) => ({
        controlId: control.controlId,
        family: control.family,
        title: control.title,
      })),
      jsigContextApplied: jsigEnabled,
      catalogBacked: primaryControl.catalogBacked,
    }
  }

  async tailorControls(input: TailorControlsInput, actor: AiActor) {
    const projectContext = await this.getProjectContext(input.projectId, actor)
    if (!projectContext) throw new AppError('Project not found', 404)

    const impactLevel = input.impactLevel ?? projectContext.confirmedImpactLevel ?? projectContext.impactLevel
    const jsigEnabled = Boolean(input.jsigOverlay ?? projectContext.jsigOverlay)
    const selected = new Set(input.selectedControlIds ?? [])
    const baseline = new Set(input.baselineControlIds ?? [])
    const tailoring = input.tailoring ?? {}
    const controls = await prisma.control.findMany({
      where: { controlId: { contains: '-' } },
      select: controlSelect,
      orderBy: [{ family: 'asc' }, { controlId: 'asc' }],
    })
    const controlMap = new Map(controls.map((control) => [control.controlId, control]))
    const recommendations: TailoringRecommendation[] = []
    const tailoringChunks = this.retrieveFormalDocumentChunks(
      {
        projectId: input.projectId,
        mode: 'POLICY',
        topic: 'Step 2 control tailoring baseline selection inheritance removal justification',
        controlIds: input.selectedControlIds?.slice(0, 12),
        impactLevel: impactLevel as 'LOW' | 'MODERATE' | 'HIGH',
        jsigOverlay: jsigEnabled,
        systemContext: input.systemContext,
      },
      projectContext,
      [],
      jsigEnabled,
    )

    const addRecommendation = (
      type: TailoringRecommendationType,
      controlId: string,
      justification: string,
      options?: { inheritedFrom?: string; confidenceScore?: number },
    ) => {
      if (recommendations.some((item) => item.type === type && item.controlId === controlId)) return
      const control = controlMap.get(controlId) ?? syntheticControl(controlId)
      recommendations.push({
        id: `${type}:${controlId}`,
        type,
        controlId,
        title: control.title,
        family: control.family,
        justification,
        inheritedFrom: options?.inheritedFrom,
        confidenceScore: options?.confidenceScore ?? recommendationConfidence(type, control, projectContext, jsigEnabled),
        evidence: deriveEvidenceTypes(control, [control], jsigEnabled).slice(0, 5),
      })
    }

    const highValueAdds = [
      ['RA-5', 'Vulnerability monitoring is strongly recommended because the system boundary includes operational components and continuous monitoring evidence is expected for authorization.'],
      ['SI-4', 'System monitoring strengthens detection and response for the selected control baseline and supports continuous monitoring activities.'],
      ['CA-7', 'Continuous monitoring should be selected to keep control assessment, vulnerability, and POA&M data current after authorization.'],
      ['SC-7', 'Boundary protection is important because the authorization boundary and external interfaces must be explicitly controlled and reviewed.'],
      ['IR-4', 'Incident handling should be selected when the system processes mission or organizational information and must support response escalation.'],
      ['CM-6', 'Secure configuration settings should be selected to document baseline hardening and drift management expectations.'],
    ] as const

    for (const [controlId, justification] of highValueAdds) {
      if (!selected.has(controlId)) addRecommendation('ADD', controlId, justification)
    }

    const infoTypes = projectContext.informationTypes.map((type) => `${type.name ?? ''} ${type.family ?? ''}`.toLowerCase()).join(' ')
    const description = `${projectContext.description ?? ''} ${input.systemContext ?? ''}`.toLowerCase()
    if (/cui|controlled unclassified|privacy|pii|phi|health|medical/.test(`${infoTypes} ${description}`)) {
      for (const controlId of ['PT-2', 'PT-3', 'PT-5', 'SC-28', 'MP-5']) {
        if (!selected.has(controlId)) {
          addRecommendation(
            'ADD',
            controlId,
            'Selected information types or system description indicate sensitive, privacy, CUI, or regulated data handling. This control improves defensibility of safeguarding and evidence expectations.',
            { confidenceScore: 82 },
          )
        }
      }
    }

    if (impactLevel === 'HIGH') {
      for (const controlId of ['RA-10', 'CA-8', 'SI-4(24)', 'CP-9(8)', 'SC-8(1)']) {
        if (!selected.has(controlId)) {
          addRecommendation(
            'ADD',
            controlId,
            'High-impact categorization supports selecting stronger monitoring, testing, cryptographic protection, and resilience controls unless the AO approves an alternate risk treatment.',
            { confidenceScore: 84 },
          )
        }
      }
    }

    if (jsigEnabled) {
      for (const controlId of ['AC-4(17)', 'AC-4(21)', 'AU-10', 'AU-10(3)', 'IA-2(3)', 'PS-3(2)', 'SC-3', 'SC-7(21)']) {
        if (!selected.has(controlId)) {
          addRecommendation(
            'ADD',
            controlId,
            'JSIG/SAP context favors enhanced need-to-know, compartmentation, domain separation, strong authentication, and non-repudiation controls.',
            { confidenceScore: 88 },
          )
        }
      }
    }

    for (const controlId of input.selectedControlIds ?? []) {
      const decision = tailoring[controlId]
      if (decision?.inherited) continue
      if (['AC-2', 'IA-2', 'SC-7', 'AU-6', 'CA-7', 'RA-5', 'SI-4', 'SA-9'].includes(controlId)) {
        addRecommendation(
          'INHERIT',
          controlId,
          'This control is commonly inherited in part from enterprise identity, network boundary, logging, vulnerability management, cloud platform, or shared security service providers. Mark inherited portions to clarify shared responsibility and assessor evidence.',
          { inheritedFrom: suggestedProvider(controlId), confidenceScore: 78 },
        )
      }
    }

    for (const controlId of input.selectedControlIds ?? []) {
      const control = controlMap.get(controlId)
      if (!control) continue
      const selectedBecauseAdded = !baseline.has(controlId)
      const isProgramOrPrivacy = ['PM', 'PT'].includes(control.family)
      const hasNoSensitiveDriver = !/cui|privacy|pii|phi|health|classified|sap|sci/.test(`${infoTypes} ${description}`)
      const protectedByJsig = jsigEnabled && /^AC-4|^AU-10|^SC-|^IA-2|^PS-3/.test(controlId)

      if (selectedBecauseAdded && isProgramOrPrivacy && hasNoSensitiveDriver && !protectedByJsig) {
        addRecommendation(
          'REMOVE',
          controlId,
          'This appears to be an added privacy/program overlay control without a clear information-type or mission driver in the current project context. Remove only if the ISSO confirms it is outside the authorization boundary and the AO accepts the rationale.',
          { confidenceScore: 64 },
        )
      }
    }

    const result = {
      provider: this.provider,
      model: this.model,
      projectId: input.projectId,
      impactLevel,
      jsigContextApplied: jsigEnabled,
      confidenceScore: scoreGenerationReliability({
        bestPracticeCount: 0,
        chunkCount: tailoringChunks.length,
        jsigRelevant: jsigEnabled && tailoringChunks.some((chunk) => chunk.metadata.docType === 'JSIG'),
        text: recommendations.map((item) => item.justification).join(' '),
        fallback: false,
        base: Math.round(average(recommendations.map((item) => item.confidenceScore)) || 72),
      }),
      citations: buildCitations({ chunks: tailoringChunks }),
      citationText: formatCitationLabels(buildCitations({ chunks: tailoringChunks })),
      reviewNotice: REVIEW_NOTICE,
      summary: {
        add: recommendations.filter((item) => item.type === 'ADD').length,
        remove: recommendations.filter((item) => item.type === 'REMOVE').length,
        inherit: recommendations.filter((item) => item.type === 'INHERIT').length,
      },
      recommendations,
    }

    await this.recordGenerationHistory({
      actor,
      projectId: input.projectId,
      controlId: 'STEP-2',
      action: 'AI_TAILOR_CONTROLS',
      details: {
        impactLevel,
        jsigEnabled,
        summary: result.summary,
        recommendations: recommendations.map((item) => ({
          type: item.type,
          controlId: item.controlId,
          confidenceScore: item.confidenceScore,
        })),
      },
    })

    return result
  }

  async generatePOAMSuggestions(input: GeneratePoamSuggestionsInput, actor: AiActor) {
    const projectContext = await this.getProjectContext(input.projectId, actor)
    if (!projectContext) throw new AppError('Project not found', 404)

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        rmfSteps: {
          where: { stepNumber: { in: [2, 3] } },
          select: { stepNumber: true, data: true },
        },
        poamItems: { select: { controlId: true, weakness: true, status: true } },
      },
    })
    if (!project) throw new AppError('Project not found', 404)

    const step2 = getStepData(project.rmfSteps, 2)
    const step3 = getStepData(project.rmfSteps, 3)
    const selectedControlIds = uniqueStrings([
      ...asArray(step2.selectedControlIds).map(String),
      ...asArray(step2.selectedControls).map((item) => asString(getRecord(item).controlId) ?? ''),
    ])
    const implementationMap = getRecord(step3.implementations)
    const existingOpen = new Set(
      project.poamItems
        .filter((item) => item.status === 'OPEN' || item.status === 'IN_REMEDIATION')
        .map((item) => item.controlId)
        .filter(Boolean) as string[],
    )
    const weakControls = selectedControlIds
      .map((controlId) => ({ controlId, record: getRecord(implementationMap[controlId]) }))
      .filter(({ controlId, record }) => {
        if (existingOpen.has(controlId)) return false
        const status = asString(record.status) || 'NOT_IMPLEMENTED'
        return status === 'NOT_IMPLEMENTED' || status === 'PARTIALLY_IMPLEMENTED' || status === 'PLANNED'
      })

    const controls = weakControls.length
      ? await prisma.control.findMany({
          where: { controlId: { in: weakControls.map((item) => item.controlId) } },
          select: controlSelect,
        })
      : []
    const controlMap = new Map(controls.map((control) => [control.controlId, control]))
    const jsigEnabled = Boolean(projectContext.jsigOverlay)
    const maxSuggestions = input.maxSuggestions ?? 10
    const deterministic = weakControls.slice(0, maxSuggestions).map(({ controlId, record }) => {
      const control = controlMap.get(controlId) ?? syntheticControl(controlId)
      const bestPractice = this.bp.get(controlId)
      const status = asString(record.status) || 'NOT_IMPLEMENTED'
      return buildPoamSuggestion({
        control,
        bestPractice,
        status,
        projectContext,
        jsigEnabled,
      })
    })
    const relatedControls = weakControls.slice(0, maxSuggestions).map(({ controlId }) => controlMap.get(controlId) ?? syntheticControl(controlId))
    const bestPractices = relatedControls
      .map((control) => this.bp.get(control.controlId))
      .filter((entry): entry is BestPracticeEntry => Boolean(entry))
    const poamChunks = this.retrieveFormalDocumentChunks(
      {
        projectId: input.projectId,
        mode: 'PROCEDURE',
        topic: 'POA&M weakness mitigation remediation milestones evidence closure',
        controlIds: relatedControls.map((control) => control.controlId),
        jsigOverlay: jsigEnabled,
      },
      projectContext,
      relatedControls,
      jsigEnabled,
    )

    let suggestions = deterministic
    const poamKey = `poam:${input.projectId}:${jsigEnabled ? 'jsig' : 'std'}`
    const cachedPoam = getPoamCache(poamKey)
    if (cachedPoam) {
      suggestions = cachedPoam.slice(0, maxSuggestions)
    } else if (deterministic.length > 0) {
      try {
        const generated = await this.callLocalModel(this.buildPoamPrompt(projectContext, deterministic), 0.12, this.fastModel)
        const parsed = parsePoamJson(generated.text)
        if (parsed.length > 0) {
          suggestions = mergePoamSuggestions(deterministic, parsed).slice(0, maxSuggestions)
          setPoamCache(poamKey, suggestions)
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.warn('[AiService] POA&M AI refinement failed — using deterministic suggestions.', { reason })
      }
    }

    await this.recordGenerationHistory({
      actor,
      projectId: input.projectId,
      controlId: 'POAM',
      action: 'AI_TAILOR_CONTROLS',
      details: {
        generated: suggestions.length,
        weakControls: weakControls.length,
        jsigEnabled,
      },
    })

    return {
      provider: this.provider,
      model: this.model,
      projectId: input.projectId,
      generatedAt: new Date().toISOString(),
      jsigContextApplied: jsigEnabled,
      analyzedControls: weakControls.length,
      confidenceScore: scoreGenerationReliability({
        bestPracticeCount: bestPractices.length,
        chunkCount: poamChunks.length,
        jsigRelevant: jsigEnabled && poamChunks.some((chunk) => chunk.metadata.docType === 'JSIG'),
        text: suggestions.map((item) => `${item.weakness} ${item.recommendedMitigation} ${item.rationale}`).join(' '),
        fallback: suggestions.every((item) => item.source !== 'AI'),
        base: Math.round(average(suggestions.map((item) => item.confidenceScore)) || 70),
      }),
      citations: buildCitations({ bestPractices, chunks: poamChunks, controls: relatedControls }),
      citationText: formatCitationLabels(buildCitations({ bestPractices, chunks: poamChunks, controls: relatedControls })),
      reviewNotice: REVIEW_NOTICE,
      suggestions,
    }
  }

  async generateAssessmentFindings(input: GenerateAssessmentFindingsInput, actor: AiActor) {
    const projectContext = await this.getProjectContext(input.projectId, actor)
    if (!projectContext) throw new AppError('Project not found', 404)

    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: {
        rmfSteps: {
          where: { stepNumber: { in: [2, 3] } },
          select: { stepNumber: true, data: true },
        },
      },
    })
    if (!project) throw new AppError('Project not found', 404)

    const step2 = getStepData(project.rmfSteps, 2)
    const step3 = getStepData(project.rmfSteps, 3)
    const selectedControlIds = uniqueStrings([
      ...asArray(step2.selectedControlIds).map(String),
      ...asArray(step2.selectedControls).map((item) => asString(getRecord(item).controlId) ?? ''),
    ])
    const implementationMap = getRecord(step3.implementations)
    const candidates = selectedControlIds
      .map((controlId) => ({ controlId, record: getRecord(implementationMap[controlId]) }))
      .filter(({ record }) => {
        const status = asString(record.status) || 'NOT_IMPLEMENTED'
        return status === 'NOT_IMPLEMENTED' || status === 'PARTIALLY_IMPLEMENTED' || status === 'PLANNED'
      })
      .slice(0, input.maxFindings ?? 12)

    const controls = candidates.length
      ? await prisma.control.findMany({ where: { controlId: { in: candidates.map((item) => item.controlId) } }, select: controlSelect })
      : []
    const controlMap = new Map(controls.map((control) => [control.controlId, control]))
    const jsigEnabled = Boolean(projectContext.jsigOverlay)
    const relatedControls = candidates.map(({ controlId }) => controlMap.get(controlId) ?? syntheticControl(controlId))
    const bestPractices = relatedControls
      .map((control) => this.bp.get(control.controlId))
      .filter((entry): entry is BestPracticeEntry => Boolean(entry))
    const assessmentChunks = this.retrieveFormalDocumentChunks(
      {
        projectId: input.projectId,
        mode: 'PROCEDURE',
        topic: 'assessment findings test results evidence Security Assessment Report POA&M',
        controlIds: relatedControls.map((control) => control.controlId),
        jsigOverlay: jsigEnabled,
      },
      projectContext,
      relatedControls,
      jsigEnabled,
    )
    const deterministic = candidates.map(({ controlId, record }) => {
      const control = controlMap.get(controlId) ?? syntheticControl(controlId)
      const bestPractice = this.bp.get(controlId)
      const status = asString(record.status) || 'NOT_IMPLEMENTED'
      const statement = asString(record.statement) || asString(record.implementationStatement)
      return buildAssessmentFinding({ control, bestPractice, status, statement, projectContext, jsigEnabled })
    })

    let findings = deterministic
    if (deterministic.length > 0) {
      try {
        const generated = await this.callLocalModel(this.buildAssessmentFindingsPrompt(projectContext, deterministic), 0.12, this.fastModel)
        const parsed = parseAssessmentFindingsJson(generated.text)
        if (parsed.length > 0) findings = mergeAssessmentFindings(deterministic, parsed)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        console.warn('[AiService] Assessment findings AI refinement failed — using deterministic findings.', { reason })
      }
    }

    await this.recordGenerationHistory({
      actor,
      projectId: input.projectId,
      controlId: 'STEP-4',
      action: 'AI_GENERATE_ASSESSMENT_FINDINGS',
      details: { generated: findings.length, candidates: candidates.length, jsigEnabled },
    })

    return {
      provider: this.provider,
      model: this.model,
      projectId: input.projectId,
      generatedAt: new Date().toISOString(),
      jsigContextApplied: jsigEnabled,
      analyzedControls: candidates.length,
      confidenceScore: scoreGenerationReliability({
        bestPracticeCount: bestPractices.length,
        chunkCount: assessmentChunks.length,
        jsigRelevant: jsigEnabled && assessmentChunks.some((chunk) => chunk.metadata.docType === 'JSIG'),
        text: findings.map((item) => `${item.description} ${item.evidence} ${item.recommendation} ${item.rationale}`).join(' '),
        fallback: findings.every((item) => item.source !== 'AI'),
        base: Math.round(average(findings.map((item) => item.confidenceScore)) || 70),
      }),
      citations: buildCitations({ bestPractices, chunks: assessmentChunks, controls: relatedControls }),
      citationText: formatCitationLabels(buildCitations({ bestPractices, chunks: assessmentChunks, controls: relatedControls })),
      reviewNotice: REVIEW_NOTICE,
      findings,
    }
  }

  async generateRiskRationale(input: GenerateRiskRationaleInput, actor: AiActor) {
    const ctx = await this.getAuthorizeProjectContext(input.projectId, actor)
    const jsigEnabled = ctx.jsigOverlay
    const riskChunks = this.retrieveFormalDocumentChunks(
      {
        projectId: input.projectId,
        mode: 'RISK_ACCEPTANCE_LETTER',
        topic: 'authorization decision residual risk POA&M findings risk acceptance',
        jsigOverlay: jsigEnabled,
        systemContext: input.systemContext,
      },
      authorizeToProjectContext(ctx),
      [],
      jsigEnabled,
    )

    const prompt = this.buildRiskRationalePrompt(ctx, input)
    const generated = await this.callLocalModel(prompt, input.temperature ?? 0.15, this.fastModel)
      .catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err)
        console.warn('[AiService] generateRiskRationale: local model call failed — using template fallback.', { reason })
        return this.generateRiskRationaleFallback(ctx, input)
      })
    const confidenceScore = scoreGenerationReliability({
      bestPracticeCount: 0,
      chunkCount: riskChunks.length,
      jsigRelevant: jsigEnabled && riskChunks.some((chunk) => chunk.metadata.docType === 'JSIG'),
      text: generated.text,
      fallback: generated.fallback,
      base: 72,
    })
    const citations = buildCitations({ chunks: riskChunks })

    await this.recordGenerationHistory({
      actor,
      projectId: input.projectId,
      controlId: 'STEP-5',
      action: 'AI_GENERATE_RISK_RATIONALE',
      details: {
        decisionType: input.decisionType,
        fallback: generated.fallback,
        jsigEnabled,
        confidenceScore,
        citations: citations.map((citation) => citation.label),
      },
    })

    return {
      provider: this.provider,
      model: this.model,
      projectId: input.projectId,
      generatedAt: new Date().toISOString(),
      decisionType: input.decisionType ?? 'APPROVE',
      generatedText: generated.text,
      confidenceScore,
      citations,
      citationText: formatCitationLabels(citations),
      reviewNotice: REVIEW_NOTICE,
      jsigContextApplied: jsigEnabled,
      fallback: generated.fallback,
    }
  }

  async generatePolicy(input: GenerateFormalDocumentInput, actor: AiActor) {
    return this.generateFormalDocument({ ...input, mode: 'POLICY' }, actor)
  }

  async generateProcedure(input: GenerateFormalDocumentInput, actor: AiActor) {
    return this.generateFormalDocument({ ...input, mode: 'PROCEDURE' }, actor)
  }

  async generateRiskAcceptanceLetter(input: GenerateFormalDocumentInput, actor: AiActor) {
    return this.generateFormalDocument({ ...input, mode: 'RISK_ACCEPTANCE_LETTER' }, actor)
  }

  async generateFormalDocument(input: GenerateFormalDocumentInput, actor: AiActor) {
    const mode = input.mode ?? 'POLICY'
    if (mode === 'MONITORING_REPORT') {
      if (!input.projectId) throw new AppError('projectId is required for monitoring reports', 400)
      return this.generateMonitoringReport({ projectId: input.projectId, temperature: input.temperature }, actor)
    }

    const projectContext = input.projectId ? await this.getProjectContext(input.projectId, actor) : undefined
    const jsigEnabled = Boolean(input.jsigOverlay ?? projectContext?.jsigOverlay)
    const controls = input.controlIds?.length
      ? await prisma.control.findMany({
          where: { controlId: { in: uniqueStrings(input.controlIds).slice(0, 25) } },
          select: controlSelect,
          orderBy: [{ family: 'asc' }, { controlId: 'asc' }],
        })
      : []
    const syntheticControls = uniqueStrings(input.controlIds ?? [])
      .filter((controlId) => !controls.some((control) => control.controlId === controlId))
      .map((controlId) => syntheticControl(controlId))
    const allControls = [...controls, ...syntheticControls]
    const bestPractices = allControls
      .map((control) => this.bp.get(control.controlId))
      .filter((entry): entry is BestPracticeEntry => Boolean(entry))
    const chunks = this.retrieveFormalDocumentChunks(input, projectContext, allControls, jsigEnabled)
    const suggestedEvidence = uniqueStrings(
      allControls.flatMap((control) => deriveEvidenceTypes(control, [control], jsigEnabled)),
    ).slice(0, 15)

    const prompt = this.buildFormalDocumentPrompt({
      input: { ...input, mode },
      projectContext,
      controls: allControls,
      bestPractices,
      chunks,
      suggestedEvidence,
      jsigEnabled,
      actorRole: actor.role,
    })

    const generated = await this.callLocalModel(prompt, input.temperature ?? 0.12, this.slowModel || undefined).catch((err: unknown) => {
      if (process.env.AI_DISABLE_TEMPLATE_FALLBACK === 'true') throw err
      const reason = err instanceof Error ? err.message : String(err)
      console.warn('[AiService] generateFormalDocument: local model call failed — using template fallback.', {
        mode,
        projectId: input.projectId,
        reason,
      })
      return this.generateFormalDocumentFallback({ ...input, mode }, projectContext, allControls, bestPractices, jsigEnabled)
    })

    const confidenceScore = scoreGenerationReliability({
      bestPracticeCount: bestPractices.length,
      chunkCount: chunks.length,
      jsigRelevant: jsigEnabled && chunks.some((chunk) => chunk.metadata.docType === 'JSIG'),
      text: generated.text,
      fallback: generated.fallback,
      base: 62 + (projectContext ? 7 : 0) + (allControls.length ? 3 : 0),
    })
    const citations = buildCitations({ bestPractices, chunks, controls: allControls })
    const revision = await this.nextDocumentRevision(projectContext?.id, mode)

    await this.recordGenerationHistory({
      actor,
      projectId: projectContext?.id,
      controlId: mode,
      action: 'AI_GENERATE_FORMAL_DOCUMENT',
      details: {
        mode,
        provider: this.provider,
        model: this.model,
        fallback: generated.fallback,
        confidenceScore,
        title: input.title,
        topic: input.topic,
        controlIds: allControls.map((control) => control.controlId),
        bestPracticeCount: bestPractices.length,
        chunkCount: chunks.length,
        citations: citations.map((citation) => citation.label),
        revision,
        reviewNotice: REVIEW_NOTICE,
      },
    })

    return {
      provider: this.provider,
      model: this.model,
      mode,
      projectId: projectContext?.id,
      generatedAt: new Date().toISOString(),
      title: input.title ?? defaultFormalDocumentTitle(mode, input.topic),
      generatedText: generated.text,
      confidenceScore,
      citations,
      citationText: formatCitationLabels(citations),
      revision,
      reviewNotice: REVIEW_NOTICE,
      fallback: generated.fallback,
      jsigContextApplied: jsigEnabled,
      sources: {
        controls: allControls.map((control) => ({
          controlId: control.controlId,
          family: control.family,
          title: control.title,
        })),
        bestPractices: bestPractices.map((entry) => entry.controlId),
        chunks: chunks.map((chunk) => ({
          docId: chunk.metadata.docId,
          section: chunk.metadata.section,
          sectionTitle: chunk.metadata.sectionTitle,
        })),
      },
      suggestedEvidenceTypes: suggestedEvidence,
    }
  }

  async generateMonitoringReport(input: GenerateMonitoringReportInput, actor: AiActor) {
    const ctx = await this.getAuthorizeProjectContext(input.projectId, actor)
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        atoExpiry: true,
        rmfSteps: {
          where: { stepNumber: { in: [4, 6] } },
          select: { stepNumber: true, data: true, status: true },
        },
        diagrams: { select: { id: true, title: true, type: true, createdAt: true } },
        poamItems: {
          select: {
            id: true,
            controlId: true,
            weakness: true,
            severity: true,
            status: true,
            scheduledCompletion: true,
          },
          orderBy: [{ severity: 'asc' }, { scheduledCompletion: 'asc' }],
        },
      },
    })

    if (!project) throw new AppError('Project not found', 404)

    const step6 = getStepData(project.rmfSteps, 6)
    const now = new Date()
    const openPoams = project.poamItems.filter((item) => item.status === 'OPEN' || item.status === 'IN_REMEDIATION')
    const overduePoams = openPoams.filter((item) => item.scheduledCompletion && new Date(item.scheduledCompletion) < now)
    const implementationPercent = ctx.controlCounts.total
      ? Math.round((ctx.controlCounts.implemented / ctx.controlCounts.total) * 100)
      : 0
    const criticalHighItems = ctx.findingCounts.criticalHigh + ctx.poamCounts.criticalHigh
    const complianceScore = computeMonitoringComplianceScore({
      implementationPercent,
      openPoams: openPoams.length,
      overduePoams: overduePoams.length,
      openFindings: ctx.findingCounts.open,
      criticalHighItems,
      jsigOverlay: ctx.jsigOverlay,
    })
    const riskTrend =
      overduePoams.length > 0 || criticalHighItems > 0 || ctx.findingCounts.open > 5
        ? 'DEGRADING'
        : openPoams.length === 0 && ctx.findingCounts.open === 0 && implementationPercent >= 90
          ? 'IMPROVING'
          : 'STABLE'
    const recommendedActions = buildMonitoringActions({
      ctx,
      openPoams: openPoams.length,
      overduePoams: overduePoams.length,
      implementationPercent,
      riskTrend,
      nextReviewDate: asString(step6.nextReviewDate),
    })
    const monitoringChunks = this.retrieveFormalDocumentChunks(
      {
        projectId: input.projectId,
        mode: 'MONITORING_REPORT',
        topic: 'continuous monitoring ongoing authorization POA&M findings evidence refresh',
        jsigOverlay: ctx.jsigOverlay,
      },
      authorizeToProjectContext(ctx),
      [],
      ctx.jsigOverlay,
    )
    const fallbackText = buildMonitoringFallbackReport({
      ctx,
      implementationPercent,
      complianceScore,
      riskTrend,
      openPoams: openPoams.length,
      overduePoams: overduePoams.length,
      evidenceItems: project.diagrams.length,
      recommendedActions,
    })

    const generated = await this.callLocalModel(
      this.buildMonitoringReportPrompt({
        ctx,
        implementationPercent,
        complianceScore,
        riskTrend,
        openPoams: openPoams.length,
        overduePoams: overduePoams.length,
        evidenceItems: project.diagrams.length,
        recommendedActions,
        currentNotes: asString(step6.notes),
      }),
      input.temperature ?? 0.15,
      this.slowModel || undefined,
    ).catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn('[AiService] generateMonitoringReport: local model call failed — using template fallback.', { reason })
      return { text: fallbackText, fallback: true }
    })
    const confidenceScore = scoreGenerationReliability({
      bestPracticeCount: 0,
      chunkCount: monitoringChunks.length,
      jsigRelevant: ctx.jsigOverlay && monitoringChunks.some((chunk) => chunk.metadata.docType === 'JSIG'),
      text: generated.text,
      fallback: generated.fallback,
      base: 70 + (ctx.controlCounts.total ? 5 : 0) + (ctx.findingCounts.total || ctx.poamCounts.total ? 5 : 0),
    })
    const citations = buildCitations({ chunks: monitoringChunks })

    await this.recordGenerationHistory({
      actor,
      projectId: input.projectId,
      controlId: 'STEP-6',
      action: 'AI_GENERATE_MONITORING_REPORT',
      details: {
        fallback: generated.fallback,
        complianceScore,
        riskTrend,
        openPoams: openPoams.length,
        overduePoams: overduePoams.length,
        confidenceScore,
        citations: citations.map((citation) => citation.label),
      },
    })

    return {
      provider: this.provider,
      model: this.model,
      projectId: input.projectId,
      generatedAt: new Date().toISOString(),
      report: generated.text,
      confidenceScore,
      citations,
      citationText: formatCitationLabels(citations),
      reviewNotice: REVIEW_NOTICE,
      recommendedActions,
      complianceScore,
      riskTrend,
      jsigContextApplied: ctx.jsigOverlay,
      metrics: {
        implementationPercent,
        openPoams: openPoams.length,
        overduePoams: overduePoams.length,
        openFindings: ctx.findingCounts.open,
        criticalHighItems,
        evidenceItems: project.diagrams.length,
      },
      fallback: generated.fallback,
    }
  }

  private async getAuthorizeProjectContext(projectId: string, actor: AiActor): Promise<AuthorizeProjectContext> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true, name: true, description: true, impactLevel: true, authBoundary: true,
        owner: { select: { firstName: true, lastName: true, email: true, role: true } },
        members: { select: { userId: true, role: true, user: { select: { firstName: true, lastName: true, email: true, role: true } } } },
        rmfSteps: { select: { stepNumber: true, data: true, status: true }, orderBy: { stepNumber: 'asc' } },
      },
    })

    if (!project) throw new AppError('Project not found', 404)
    if (actor.role !== Role.ADMIN && !project.members.some(m => m.userId === actor.userId)) {
      throw new AppError('You do not have access to this project', 403)
    }

    const step0 = getStepData(project.rmfSteps, 0)
    const step1 = getStepData(project.rmfSteps, 1)
    const step2 = getStepData(project.rmfSteps, 2)
    const step3 = getStepData(project.rmfSteps, 3)
    const step4 = getStepData(project.rmfSteps, 4)

    const selectedControlIds = asArray(step2.selectedControlIds)
    const implementations = getRecord(step3.implementations)
    const implValues = Object.values(implementations).map(getRecord)
    const implemented = implValues.filter(i => asString(i.status) === 'IMPLEMENTED').length
    const partial = implValues.filter(i => asString(i.status) === 'PARTIALLY_IMPLEMENTED').length
    const planned = implValues.filter(i => asString(i.status) === 'PLANNED').length
    const notImplemented = implValues.filter(i => asString(i.status) === 'NOT_IMPLEMENTED').length
    const total = implValues.length || selectedControlIds.length

    const findings = asArray(step4.findings).map(getRecord)
    const openFindings = findings.filter(f => asString(f.status) === 'OPEN' || asString(f.status) === 'IN_REMEDIATION').length
    const closedFindings = findings.filter(f => asString(f.status) === 'CLOSED' || asString(f.status) === 'RISK_ACCEPTED').length
    const critHighFindings = findings.filter(f => asString(f.severity) === 'CRITICAL' || asString(f.severity) === 'HIGH').length

    // Load POA&M counts separately to avoid relying on a specific Prisma relation name
    let poamTotal = 0, poamOpen = 0, poamCritHigh = 0
    try {
      const poamItems = await (prisma as unknown as { pOAMItem: { findMany: (args: object) => Promise<Array<{ severity: string; status: string }>> } })
        .pOAMItem.findMany({ where: { projectId }, select: { severity: true, status: true } })
      poamTotal = poamItems.length
      poamOpen = poamItems.filter(p => p.status === 'OPEN' || p.status === 'IN_REMEDIATION').length
      poamCritHigh = poamItems.filter(p => p.severity === 'CRITICAL' || p.severity === 'HIGH').length
    } catch {
      // POA&M table unavailable; proceed without counts
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      impactLevel: project.impactLevel,
      authBoundary: project.authBoundary,
      jsigOverlay: Boolean(step2.jsigOverlay),
      roleSummary: buildRoleSummary(project.owner, project.members, step0.roles),
      riskTolerance: asString(step0.riskTolerance),
      organizationalContext: asString(step0.organizationalContext),
      informationTypes: asArray(step1.selectedInformationTypes)
        .map(i => asString(getRecord(i).name))
        .filter((n): n is string => Boolean(n)),
      confirmedImpactLevel: asString(step1.confirmedImpactLevel),
      impactJustification: asString(step1.impactJustification),
      controlCounts: { selected: selectedControlIds.length, implemented, partial, planned, notImplemented, total },
      findingCounts: { total: findings.length, open: openFindings, closed: closedFindings, criticalHigh: critHighFindings },
      assessmentSummary: asString(step4.assessmentSummary),
      poamCounts: { total: poamTotal, open: poamOpen, criticalHigh: poamCritHigh },
    }
  }

  private buildRiskRationalePrompt(ctx: AuthorizeProjectContext, input: GenerateRiskRationaleInput): string {
    const decision = input.decisionType ?? 'APPROVE'
    const decisionLabel =
      decision === 'APPROVE' ? 'Authorization to Operate (ATO)'
      : decision === 'DENY' ? 'Denial of Authorization to Operate'
      : 'Conditional Authorization to Operate (CATO)'
    const impact = ctx.confirmedImpactLevel ?? ctx.impactLevel
    const implPct = ctx.controlCounts.total
      ? Math.round((ctx.controlCounts.implemented / ctx.controlCounts.total) * 100)
      : 0

    const decisionTone =
      decision === 'APPROVE'
        ? 'The tone is formal and deliberate: the AO is accepting residual risk with full awareness of open POA&M items and continuous monitoring obligations. The language must convey that the AO has personally reviewed the risk posture and accepts accountability per DoDI 8510.01.'
        : decision === 'DENY'
        ? 'The tone is direct and specific: the AO is citing identified, unresolved risks that exceed organizational tolerance. The language must reference the specific risk indicators (findings counts, implementation gaps, POA&M posture) that drove the denial, and direct the system owner to specific remediation requirements before resubmission.'
        : 'The tone is conditional and precise: the AO is granting limited authority contingent on specific, time-bound remediation commitments. The language must state the exact conditions, milestone expectations, and reporting obligations, and note that failure to meet them may result in revocation.'

    return [
      SYSTEM_PROMPTS.riskRationale,
      ctx.jsigOverlay ? JSIG_CONTEXT : DOD_POLICY_CONTEXT,
      '',
      `Task: Draft a ${decisionLabel} risk decision rationale.`,
      `Decision type: ${decision}`,
      decisionTone,
      ctx.jsigOverlay
        ? 'JSIG context: This system operates under JSIG/SAP applicability. Reference JSIG compliance posture, need-to-know enforcement status, compartmentation controls, and enhanced audit requirements only where the supplied evidence and metrics support those assertions.'
        : 'DoD/DCSA context: Tie the rationale to DoDI 8500.01/8510.01 residual risk acceptance, continuous monitoring obligations, POA&M disposition, and DCSA DAAG/DAAPM package defensibility.',
      '',
      'System profile:',
      `Name: ${ctx.name}`,
      ctx.description ? `Description: ${ctx.description}` : undefined,
      `Impact level: ${impact}`,
      ctx.authBoundary ? `Authorization boundary: ${ctx.authBoundary}` : undefined,
      ctx.riskTolerance ? `Organizational risk tolerance: ${ctx.riskTolerance}` : undefined,
      ctx.organizationalContext ? `Organizational context: ${ctx.organizationalContext}` : undefined,
      ctx.informationTypes.length ? `Information types: ${ctx.informationTypes.join(', ')}` : undefined,
      '',
      'Control implementation status:',
      `Total controls selected: ${ctx.controlCounts.selected || ctx.controlCounts.total}`,
      `Implemented: ${ctx.controlCounts.implemented} (${implPct}%)`,
      `Partially implemented: ${ctx.controlCounts.partial}`,
      `Planned: ${ctx.controlCounts.planned}`,
      `Not implemented: ${ctx.controlCounts.notImplemented}`,
      '',
      'Assessment findings:',
      `Total findings: ${ctx.findingCounts.total}`,
      `Open / in remediation: ${ctx.findingCounts.open}`,
      `Critical / High severity: ${ctx.findingCounts.criticalHigh}`,
      `Closed / risk accepted: ${ctx.findingCounts.closed}`,
      ctx.assessmentSummary ? `Assessment summary: ${truncate(ctx.assessmentSummary, 500)}` : undefined,
      '',
      `POA&M posture: ${ctx.poamCounts.total} total items, ${ctx.poamCounts.open} open, ${ctx.poamCounts.criticalHigh} Critical/High`,
      input.systemContext ? `Additional context from system owner: ${input.systemContext}` : undefined,
      '',
      'OUTPUT REQUIREMENTS:',
      '- Write 3 to 5 paragraphs of continuous, formal prose — no bullet points, numbered lists, section headings, or markdown.',
      '- Begin with authorization decision language. No preamble, no restatement of the task.',
      '- Paragraph 1: System identity, mission context, and the authorization decision being issued.',
      '- Paragraph 2: The evidentiary basis — implementation percentage, assessment findings posture, POA&M disposition.',
      '- Paragraph 3: Residual risk acceptance rationale — why the AO accepts remaining risk (or why risk is unacceptable for DENY).',
      `- Paragraph 4 (CATO/DENY only): Specific conditions, milestone dates, reporting obligations, or resubmission requirements.`,
      '- Final paragraph: Standard authorization record language appropriate for signature and filing.',
      '- Integrate all provided metrics naturally. Do not use tables or lists within the prose.',
      '- Use only the exact metrics provided. Fabricating control counts, finding totals, dates, or compliance assertions is a disqualifying error.',
      '- Conclude with language suitable for an Authorization Decision Letter.',
      '',
      'Risk decision rationale:',
    ].filter(Boolean).join('\n')
  }

  private buildMonitoringReportPrompt(input: {
    ctx: AuthorizeProjectContext
    implementationPercent: number
    complianceScore: number
    riskTrend: string
    openPoams: number
    overduePoams: number
    evidenceItems: number
    recommendedActions: string[]
    currentNotes?: string
  }): string {
    const impact = input.ctx.confirmedImpactLevel ?? input.ctx.impactLevel
    return [
      SYSTEM_PROMPTS.monitoring,
      input.ctx.jsigOverlay ? JSIG_CONTEXT : DOD_POLICY_CONTEXT,
      '',
      'System profile:',
      `Name: ${input.ctx.name}`,
      `Impact level: ${impact}`,
      input.ctx.description ? `Description: ${input.ctx.description}` : undefined,
      input.ctx.authBoundary ? `Authorization boundary: ${input.ctx.authBoundary}` : undefined,
      input.ctx.riskTolerance ? `Risk tolerance: ${input.ctx.riskTolerance}` : undefined,
      input.ctx.organizationalContext ? `Organizational context: ${input.ctx.organizationalContext}` : undefined,
      input.ctx.informationTypes.length ? `Information types: ${input.ctx.informationTypes.join(', ')}` : undefined,
      '',
      'Current monitoring metrics:',
      `Compliance score: ${input.complianceScore}%`,
      `Risk trend: ${input.riskTrend}`,
      `Control implementation: ${input.ctx.controlCounts.implemented}/${input.ctx.controlCounts.selected || input.ctx.controlCounts.total} (${input.implementationPercent}%)`,
      `Partially implemented: ${input.ctx.controlCounts.partial}`,
      `Planned: ${input.ctx.controlCounts.planned}`,
      `Not implemented: ${input.ctx.controlCounts.notImplemented}`,
      `Assessment findings open/in remediation: ${input.ctx.findingCounts.open}`,
      `Critical/High findings: ${input.ctx.findingCounts.criticalHigh}`,
      `Open POA&M items: ${input.openPoams}`,
      `Overdue POA&M items: ${input.overduePoams}`,
      `Evidence artifacts available: ${input.evidenceItems}`,
      input.currentNotes ? `Current monitoring notes: ${input.currentNotes}` : undefined,
      '',
      `Recommended actions: ${input.recommendedActions.join('; ')}`,
      '',
      'OUTPUT REQUIREMENTS:',
      '- Produce exactly three to four formal paragraphs of continuous prose. No bullet points, no section headers, no markdown.',
      '- Paragraph 1: Current authorization posture — compliance score, implementation percentage, and risk trend in context of the impact level.',
      '- Paragraph 2: Finding and POA&M disposition — open findings (critical/high count), overdue POA&M items, and their bearing on residual risk.',
      '- Paragraph 3: Evidence and control currency — artifact availability, controls requiring evidence refresh, and any gaps threatening ongoing authorization.',
      `- Paragraph 4: Forward-looking monitoring actions — specific next steps derived from the recommended actions list, framed as obligations to the AO.${input.ctx.jsigOverlay ? ' Address SAP-specific monitoring obligations including PSO reporting cadence and access-roster currency.' : ''}`,
      '- Cite exact counts and percentages from the metrics supplied. Do not round, estimate, or invent figures.',
      '- Do not invent findings, POA&M items, control deficiencies, or actions beyond what is supplied.',
      '- Use the institutional voice of the system owner organization writing to their AO.',
      '- Begin substantive content immediately — no preamble, no restatement of the task.',
      '',
      'Continuous monitoring report:',
    ].filter(Boolean).join('\n')
  }

  private generateRiskRationaleFallback(ctx: AuthorizeProjectContext, input: GenerateRiskRationaleInput): AiGenerationResult {
    const impact = ctx.confirmedImpactLevel ?? ctx.impactLevel
    const decision = input.decisionType ?? 'APPROVE'
    const implPct = ctx.controlCounts.total ? Math.round((ctx.controlCounts.implemented / ctx.controlCounts.total) * 100) : 0
    const poamOpen = ctx.poamCounts.open
    const findingsOpen = ctx.findingCounts.open

    if (decision === 'DENY') {
      return {
        text:
          `The authorization review of ${ctx.name}, operating at the ${impact} impact level, has identified unresolved security weaknesses that collectively represent a risk posture incompatible with authorization to operate at this time. ` +
          `Assessment activities documented ${ctx.findingCounts.total} total findings, of which ${findingsOpen} remain open or in remediation and ${ctx.findingCounts.criticalHigh} are rated Critical or High severity — a posture that exceeds the organizational risk tolerance. ` +
          `Control implementation stands at approximately ${implPct} percent of the selected baseline, with ${ctx.controlCounts.notImplemented} controls not yet implemented and ${ctx.controlCounts.partial} partially implemented, indicating the system has not achieved the implementation depth required for a supportable authorization. ` +
          `The Authorizing Official has determined that the identified risk indicators — including open high-severity findings, unresolved POA&M items (${poamOpen} open), and incomplete control implementation — prevent issuance of an Authorization to Operate at this time. ` +
          `The system owner is directed to remediate the identified deficiencies, update POA&M milestones with defensible completion dates, and resubmit the authorization package for reconsideration once the residual risk posture has been reduced to an acceptable level.`,
        fallback: true,
      }
    }

    if (decision === 'CONDITIONAL') {
      return {
        text:
          `Following a thorough review of the ${ctx.name} authorization package, the Authorizing Official has determined to issue a Conditional Authorization to Operate for the system operating at the ${impact} impact level, subject to the conditions and milestones identified in this authorization record. ` +
          `The authorization package reflects ${ctx.controlCounts.implemented} of ${ctx.controlCounts.selected || ctx.controlCounts.total} selected controls in an implemented or accepted state (approximately ${implPct} percent), with ${ctx.controlCounts.partial} controls partially implemented and ${findingsOpen} assessment findings open or in remediation at the time of decision. ` +
          `The Authorizing Official acknowledges that the residual risk associated with ${poamOpen} open POA&M items — including ${ctx.findingCounts.criticalHigh} Critical or High severity findings — has been reviewed and is accepted for a defined period contingent on documented remediation progress against approved POA&M milestones. ` +
          `This Conditional Authorization to Operate is granted with the express requirement that the system owner resolve all open Critical and High findings within the timeframes documented in the approved POA&M, provide quarterly progress reports to the ISSO and Authorizing Official, and notify the Authorizing Official immediately of any significant change, new critical vulnerability, or security incident affecting the authorization boundary. Failure to meet the documented POA&M milestones or the occurrence of a significant security event may result in immediate suspension or revocation of this conditional authorization.`,
        fallback: true,
      }
    }

    return {
      text:
        `Following a comprehensive review of the ${ctx.name} authorization package — including the System Security Plan, Security Assessment Report, Plan of Action and Milestones, and supporting evidence artifacts — the Authorizing Official has determined that the system operating at the ${impact} impact level presents a risk posture acceptable for the issuance of an Authorization to Operate. ` +
        `The authorization package reflects ${ctx.controlCounts.implemented} of ${ctx.controlCounts.selected || ctx.controlCounts.total} selected controls in an implemented or accepted state (approximately ${implPct} percent), with remaining controls subject to active remediation tracking through the approved POA&M. ` +
        `Assessment activities documented ${ctx.findingCounts.total} findings, of which ${ctx.findingCounts.closed} have been closed or risk accepted and ${findingsOpen} remain in remediation per documented POA&M milestones. ` +
        `The Authorizing Official accepts the residual risk represented by the ${poamOpen} open POA&M item${poamOpen === 1 ? '' : 's'} on the basis that documented remediation milestones, continuous monitoring activities, and ISSO oversight provide reasonable assurance that identified weaknesses will be addressed within the prescribed timeframes and that the system will maintain an acceptable risk posture throughout the authorization period. ` +
        (ctx.jsigOverlay ? `Given the JSIG/SAP overlay applicability, the Authorizing Official additionally confirms that compartmentation controls, need-to-know enforcement, and enhanced audit requirements have been reviewed and are assessed as implemented at a level appropriate to the classification environment. ` : '') +
        `This Authorization to Operate is granted subject to continued compliance with all conditions in the authorization package, ongoing POA&M milestone adherence, and timely notification of any significant change affecting the authorization boundary or security posture.`,
      fallback: true,
    }
  }

  private async getControlForGeneration(controlId: string) {
    const control = await prisma.control.findUnique({
      where: { controlId },
      select: controlSelect,
    })

    if (control) return { ...control, catalogBacked: true }

    const family = controlId.includes('-') ? controlId.split('-')[0]?.toUpperCase() || 'UNKNOWN' : 'UNKNOWN'
    return {
      controlId,
      family,
      title: controlId,
      description:
        `No active catalog record was found for ${controlId}. Generate conservative implementation language from project context and related ${family} controls only.`,
      lowBaseline: false,
      modBaseline: false,
      highBaseline: false,
      bestPracticeStatement: null,
      typicalEvidence: null,
      catalogBacked: false,
    }
  }

  private async retrieveControlContext(
    primaryControl: RagControl,
    input: {
      controlId: string
      purpose?: AiPurpose
      systemContext?: string
      extraInstructions?: string
      projectContext?: ProjectAiContext
      jsigEnabled?: boolean
    },
  ) {
    const query = [
      input.controlId,
      primaryControl.family,
      primaryControl.title,
      primaryControl.description,
      input.systemContext,
      input.extraInstructions,
      input.purpose,
      input.projectContext?.riskTolerance,
      input.projectContext?.organizationalContext,
      input.projectContext?.impactJustification,
      input.projectContext?.objectiveJustification,
      input.projectContext?.tailoringHistory?.justification,
      input.projectContext?.informationTypes.map((type) => `${type.name} ${type.family}`).join(' '),
      input.jsigEnabled ? JSIG_CONTEXT : undefined,
    ]
      .filter(Boolean)
      .join(' ')

    const firstTitleTerm = primaryControl.title.split(/\s+/).find((term) => term.length > 4) ?? primaryControl.family
    const relatedFilters: Prisma.ControlWhereInput[] = [
      { family: primaryControl.family },
      { title: { contains: firstTitleTerm, mode: 'insensitive' } },
      { description: { contains: firstTitleTerm, mode: 'insensitive' } },
      { bestPracticeStatement: { contains: primaryControl.family, mode: 'insensitive' } },
    ]

    if (input.jsigEnabled) {
      relatedFilters.push(
        { controlId: { startsWith: 'AC-4' } },
        { controlId: { startsWith: 'AU-10' } },
        { controlId: { startsWith: 'SC-7' } },
      )
    }

    const candidates = await prisma.control.findMany({
      where: {
        controlId: { contains: '-' },
        OR: relatedFilters,
      },
      select: controlSelect,
      take: 180,
    })

    const scored = candidates
      .map((control) => ({ control, score: scoreControl(control, query, primaryControl.controlId, Boolean(input.jsigEnabled)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((entry) => entry.control)

    if (!scored.some((control) => control.controlId === primaryControl.controlId)) {
      scored.unshift(primaryControl)
    }

    return scored
  }

  /**
   * Retrieves the most relevant document chunks from the knowledge-chunks index.
   * Synchronous — runs against the in-memory DocumentChunkService index so it
   * adds no I/O latency to the AI call path.
   *
   * Returns up to 4 chunks ranked by: exact control ref match, family overlap,
   * JSIG applicability when enabled, impact level, and keyword co-occurrence.
   */
  private retrieveDocumentChunks(
    primaryControl: RagControl,
    input: {
      controlId: string
      purpose?: AiPurpose
      systemContext?: string
      projectContext?: ProjectAiContext
      jsigEnabled?: boolean
    },
  ): DocumentChunk[] {
    if (this.chunks.size === 0) return []

    const queryText = [
      input.controlId,
      primaryControl.title,
      primaryControl.description?.slice(0, 400),
      input.systemContext,
      input.projectContext?.riskTolerance,
      input.projectContext?.organizationalContext,
      input.projectContext?.informationTypes.map((t) => `${t.name ?? ''} ${t.family ?? ''}`).join(' '),
    ]
      .filter(Boolean)
      .join(' ')

    // Build a de-duplicated keyword set from the query for better term matching
    const enrichedQuery = [
      queryText,
      ...extractKeywords(primaryControl.description ?? ''),
    ].join(' ')

    return this.chunks.search({
      controlId: input.controlId,
      family: primaryControl.family,
      jsigEnabled: Boolean(input.jsigEnabled),
      impactLevel: input.projectContext?.confirmedImpactLevel as 'LOW' | 'MODERATE' | 'HIGH' | undefined
        ?? input.projectContext?.impactLevel,
      query: enrichedQuery,
      maxResults: 3,
    })
  }

  private async retrievePastImplementations(controlId: string, currentProjectId?: string): Promise<PastImplementation[]> {
    const [instances, steps] = await Promise.all([
      prisma.controlInstance.findMany({
        where: {
          control: { controlId },
          implementationNotes: { not: null },
        },
        include: {
          project: { select: { id: true, name: true, status: true } },
          control: { select: { controlId: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.rMFStep.findMany({
        where: {
          stepNumber: 3,
          projectId: currentProjectId ? { not: currentProjectId } : undefined,
          data: { not: Prisma.JsonNull },
        },
        include: { project: { select: { id: true, name: true, status: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 60,
      }),
    ])

    const fromInstances = instances
      .filter((instance) => instance.implementationNotes?.trim())
      .map((instance) => ({
        projectId: instance.project.id,
        projectName: instance.project.name,
        controlId,
        statement: instance.implementationNotes ?? '',
        status: instance.status,
        inherited: instance.inherited,
        approved: instance.status === 'IMPLEMENTED' || instance.project.status === 'AUTHORIZED',
      }))

    const fromSteps: PastImplementation[] = []
    for (const step of steps) {
      const data = step.data as { implementations?: Record<string, Record<string, unknown>> } | null
      const record = data?.implementations?.[controlId]
      if (!record) continue

      const statement = asString(record.statement) || asString(record.implementationStatement)
      if (!statement) continue

      fromSteps.push({
        projectId: step.project.id,
        projectName: step.project.name,
        controlId,
        statement,
        status: asString(record.status),
        inherited: Boolean(record.inherited),
        inheritedFrom: asString(record.inheritedFrom),
        aiGenerated: Boolean(record.aiGenerated),
        approved: step.status === 'COMPLETE' || step.project.status === 'AUTHORIZED',
      })
    }

    return [...fromInstances, ...fromSteps]
      .filter((item, index, all) => all.findIndex((other) => other.statement === item.statement) === index)
      .sort((a, b) => Number(b.approved) - Number(a.approved))
      .slice(0, 8)
  }

  private async getProjectContext(projectId: string, actor: AiActor, controlId?: string): Promise<ProjectAiContext | undefined> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        impactLevel: true,
        authBoundary: true,
        owner: { select: { firstName: true, lastName: true, email: true, role: true } },
        members: {
          select: {
            userId: true,
            role: true,
            user: { select: { firstName: true, lastName: true, email: true, role: true } },
          },
        },
        rmfSteps: {
          where: { stepNumber: { in: [0, 1, 2, 3] } },
          select: { stepNumber: true, data: true, status: true },
          orderBy: { stepNumber: 'asc' },
        },
      },
    })

    if (!project) return undefined
    if (actor.role !== Role.ADMIN && !project.members.some((member) => member.userId === actor.userId)) {
      throw new AppError('You do not have access to this project', 403)
    }

    const step0 = getStepData(project.rmfSteps, 0)
    const step1 = getStepData(project.rmfSteps, 1)
    const step2 = getStepData(project.rmfSteps, 2)
    const tailoring = controlId ? getRecord(step2.tailoring)?.[controlId] : undefined
    const selectedControl = controlId
      ? asArray(step2.selectedControls).find((item) => getRecord(item).controlId === controlId)
      : undefined

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      impactLevel: project.impactLevel,
      authBoundary: project.authBoundary,
      roleSummary: buildRoleSummary(project.owner, project.members, step0.roles),
      riskTolerance: asString(step0.riskTolerance),
      organizationalContext: asString(step0.organizationalContext),
      boundaryConfirmation: asString(step0.boundaryConfirmation),
      informationTypes: asArray(step1.selectedInformationTypes).map((item) => {
        const record = getRecord(item)
        return {
          id: asString(record.id),
          name: asString(record.name),
          family: asString(record.family),
        }
      }),
      impactJustification: asString(step1.impactJustification),
      objectiveJustification: asString(step1.objectiveJustification),
      confirmedImpactLevel: asString(step1.confirmedImpactLevel),
      jsigOverlay: Boolean(step2.jsigOverlay),
      tailoringHistory: {
        action: asString(getRecord(selectedControl).action ?? getRecord(tailoring).action),
        inherited: Boolean(getRecord(selectedControl).inherited ?? getRecord(tailoring).inherited),
        inheritedFrom: asString(getRecord(selectedControl).inheritedFrom ?? getRecord(tailoring).inheritedFrom),
        justification: asString(getRecord(selectedControl).justification ?? getRecord(tailoring).justification),
      },
    }
  }

  private buildImplementationPrompt(input: {
    input: GenerateImplementationInput
    purpose: AiPurpose
    primaryControl: RagControl
    ragControls: RagControl[]
    ragChunks?: DocumentChunk[]
    pastImplementations: PastImplementation[]
    projectContext?: ProjectAiContext
    jsigEnabled: boolean
    suggestedEvidenceTypes: string[]
    actorRole: Role
    bpEntry?: BestPracticeEntry
  }) {
    const task =
      input.purpose === 'TAILORING_SUGGESTION'
        ? 'Generate a formal, paragraph-form risk-based tailoring recommendation for this control. State the recommended disposition (include, exclude, or inherit) and articulate the justification in professional prose appropriate for an SSP tailoring decision record.'
        : 'Generate a single, auditor-ready SSP implementation statement for this control written as formal, professional paragraph prose.'

    // Source priority ladder — curated implementation guidance and retrieved
    // local policy chunks lead the model. The authority hierarchy only resolves
    // conflicts after those concrete sources have been considered.
    const frameworkAuthority = [
      input.jsigEnabled
        ? 'Active framework hierarchy: JSIG Rev 2 (highest authority) > DoD 8500.01/8510.01 > CNSSI 1253 > NIST SP 800-53 Rev. 5 baseline.'
        : 'Active framework hierarchy: DoD 8500.01/8510.01 > CNSSI 1253 > NIST SP 800-53 Rev. 5 baseline.',
      'Source priority for drafting: curated best-practice statement first; retrieved policy chunks second; seeded NIST catalog context third; past examples fourth; general model knowledge last.',
      'Where the curated best-practice statement conflicts with JSIG, DCSA DAAG/DAAPM, or DoD policy requirements shown above, the governing policy requirement takes precedence.',
      input.bpEntry
        ? 'The curated best-practice statement below is the primary SSP writing source: adapt it to the project context, improve its professional polish, and blend in applicable JSIG/DCSA/DoD requirements; do not reproduce it verbatim.'
        : 'No curated statement is available; generate from retrieved policy document excerpts, NIST catalog context, and project context supplied below.',
    ].join(' ')

    const chunkBlock = input.ragChunks?.length
      ? [
          'Policy and regulatory document context — retrieved sections from JSIG, DCSA DAAG/DAAPM, DoD 8500/8510 series, CNSSI, or supplemental guidance.',
          'These excerpts are authoritative local source material and outrank general model knowledge. Reflect their specific requirements in the narrative without quoting them directly.',
          formatDocumentChunks(input.ragChunks),
        ].join('\n')
      : undefined

    return [
      SYSTEM_PROMPTS.implementation,
      '',
      // Inject JSIG and DoD policy context together so the model gets the full
      // regulatory picture before it sees any task-specific content.
      input.jsigEnabled ? JSIG_CONTEXT : DOD_POLICY_CONTEXT,
      SOURCE_PRIORITY_CONTEXT,
      '',
      `Task: ${task}`,
      `Requesting role: ${input.actorRole}`,
      frameworkAuthority,
      '',
      `Primary control: ${formatControl(input.primaryControl)}`,
      `Impact level: ${input.input.impactLevel ?? input.projectContext?.confirmedImpactLevel ?? input.projectContext?.impactLevel ?? 'Not specified'}`,
      `JSIG/SAP overlay: ${input.jsigEnabled ? 'enabled — JSIG requirements supersede NIST baseline' : 'not enabled'}`,
      `Inherited: ${input.input.inherited ? `yes, from ${input.input.inheritedFrom || 'common control provider'}` : 'no'}`,
      input.projectContext ? `Project context:\n${formatProjectContext(input.projectContext)}` : undefined,
      input.input.systemContext ? `Additional system context:\n${input.input.systemContext}` : undefined,
      input.input.extraInstructions ? `Additional instructions:\n${input.input.extraInstructions}` : undefined,
      '',
      'Tailoring history:',
      formatTailoring(input.projectContext),
      '',
      // Curated entry — always present in the prompt when available, whether or
      // not the model was previously bypassed. The model uses it as primary text.
      input.bpEntry
        ? [
            '--- CURATED BEST-PRACTICE STATEMENT (primary template — adapt, do not copy verbatim) ---',
            input.bpEntry.bestPracticeStatement,
            input.bpEntry.commonImplementation ? `Typical implementation approach: ${input.bpEntry.commonImplementation}` : undefined,
            input.bpEntry.jsigNote && input.jsigEnabled
              ? `JSIG/SAP-specific note (integrate into the narrative): ${input.bpEntry.jsigNote}`
              : undefined,
            '--- END CURATED STATEMENT ---',
          ]
            .filter(Boolean)
            .join('\n')
        : undefined,
      '',
      // Document chunks provide section-level regulatory context with overlap.
      chunkBlock,
      '',
      'Relevant NIST catalog control context:',
      input.ragControls.map(formatControl).join('\n\n'),
      '',
      'Past approved or saved implementation examples (reference for tone and depth — do not copy text):',
      input.pastImplementations.length
        ? input.pastImplementations.map(formatPastImplementation).join('\n\n')
        : 'No prior approved implementations on record.',
      '',
      `Suggested evidence types for this control: ${input.suggestedEvidenceTypes.join('; ')}`,
      '',
      'OUTPUT REQUIREMENTS:',
      '- One continuous formal paragraph, 150–280 words. Two to five well-constructed sentences.',
      '- No bullet points, numbered lists, markdown, or internal line breaks.',
      '- Start with the substantive content. No preamble, no restatement of the control ID or title.',
      '- Weave in: responsible role, implemented mechanism, review/monitoring cadence, evidence categories.',
      '- Reflect JSIG, DCSA DAAG/DAAPM, and DoD 8500/8510 policy requirements from the framework context above when applicable to this control.',
      '- Use the exact system name, impact level, and boundary details from project context when supplied.',
      '- Calibrated generic language when specifics are absent: "organization-defined intervals", "the designated system owner."',
      '- Do not fabricate product names, document titles, dates, providers, or compliance assertions.',
      '',
      'Implementation statement:',
    ]
      .filter(Boolean)
      .join('\n')
  }

  private buildFastImplementationPrompt(input: {
    input: GenerateImplementationInput
    purpose: AiPurpose
    primaryControl: RagControl
    ragChunks?: DocumentChunk[]
    projectContext?: ProjectAiContext
    jsigEnabled: boolean
    bpEntry?: BestPracticeEntry
  }): string {
    const { primaryControl, projectContext, jsigEnabled, bpEntry } = input

    const controlBlock = [
      `Control: ${primaryControl.controlId} — ${primaryControl.title}`,
      `Family: ${primaryControl.family} | Baseline: ${baselineLabel(primaryControl)}`,
      `Description: ${truncate(primaryControl.description, 220)}`,
    ].join('\n')

    const contextBlock = [
      projectContext ? `System: ${projectContext.name}` : undefined,
      `Impact: ${projectContext?.confirmedImpactLevel ?? input.input.impactLevel ?? projectContext?.impactLevel ?? 'MODERATE'}`,
      `JSIG/SAP: ${jsigEnabled ? 'enabled' : 'disabled'}`,
      `Inherited: ${input.input.inherited ? `yes, from ${input.input.inheritedFrom ?? 'common control provider'}` : 'no'}`,
      projectContext?.description ? `Desc: ${truncate(projectContext.description, 80)}` : undefined,
      projectContext?.authBoundary ? `Boundary: ${truncate(projectContext.authBoundary, 80)}` : undefined,
      projectContext?.roleSummary ? `Roles: ${truncate(projectContext.roleSummary, 60)}` : undefined,
    ].filter(Boolean).join('\n')

    const jsigBlock = jsigEnabled
      ? `Applicable JSIG requirements:\n${JSIG_FAMILY_CONTEXT[primaryControl.family] ?? 'JSIG Rev 2 applies. Use SAP-specific roles (PSO, ISSO, SCA) and formal SAP processes (PAR, need-to-know determination, access roster) in the narrative.'}`
      : undefined

    const curatedBlock = bpEntry
      ? [
          'Curated guidance (adapt, do not copy verbatim):',
          truncate(bpEntry.bestPracticeStatement, 280),
          bpEntry.jsigNote && jsigEnabled ? `JSIG note: ${truncate(bpEntry.jsigNote, 120)}` : undefined,
        ].filter(Boolean).join('\n')
      : undefined

    // Compact chunk formatter for fast path: 380 chars per chunk to keep prompt short.
    // Full formatDocumentChunks (default 1200 chars) is used in non-streaming paths where quality > speed.
    const chunkBlock = input.ragChunks?.length
      ? `Policy context:\n${input.ragChunks.map((c) => {
          const m = c.metadata
          return `[${m.docTitle} §${m.section}]\n${truncate(c.content, 380)}`
        }).join('\n---\n')}`
      : undefined

    return [
      FAST_SYSTEM_PROMPT,
      '',
      controlBlock,
      '',
      contextBlock,
      '',
      jsigBlock,
      '',
      curatedBlock,
      '',
      chunkBlock,
      '',
      'Implementation statement:',
    ].filter((block) => block !== undefined && block !== '').join('\n')
  }

  private buildExplainPrompt(input: {
    input: ExplainControlInput
    primaryControl: RagControl
    ragControls: RagControl[]
    ragChunks?: DocumentChunk[]
    projectContext?: ProjectAiContext
    jsigEnabled: boolean
    suggestedEvidenceTypes: string[]
    actorRole: Role
    bpEntry?: BestPracticeEntry
  }) {
    const chunkBlock = input.ragChunks?.length
      ? [
          'Policy and regulatory document context — authoritative source sections from JSIG, DCSA DAAG/DAAPM, DoD 8500/8510 series, CNSSI, or supplemental guidance. Use these excerpts before general model knowledge:',
          formatDocumentChunks(input.ragChunks),
        ].join('\n')
      : undefined

    return [
      SYSTEM_PROMPTS.explanation,
      '',
      input.jsigEnabled ? JSIG_CONTEXT : DOD_POLICY_CONTEXT,
      SOURCE_PRIORITY_CONTEXT,
      '',
      `Requesting role: ${input.actorRole}`,
      `Control to explain: ${formatControl(input.primaryControl)}`,
      `Impact level: ${input.input.impactLevel ?? input.projectContext?.confirmedImpactLevel ?? input.projectContext?.impactLevel ?? 'Not specified'}`,
      `JSIG/SAP overlay: ${input.jsigEnabled ? 'enabled — JSIG and DoD 8500 requirements apply' : 'not enabled — DoD 8500.01/8510.01 baseline applies'}`,
      input.projectContext ? `Project context:\n${formatProjectContext(input.projectContext)}` : undefined,
      input.input.systemContext ? `Additional system context:\n${input.input.systemContext}` : undefined,
      input.input.extraInstructions ? `Additional instructions:\n${input.input.extraInstructions}` : undefined,
      input.bpEntry?.commonImplementation
        ? `Curated implementation approach for this control (primary explanatory source): ${input.bpEntry.commonImplementation}`
        : undefined,
      input.bpEntry?.jsigNote && input.jsigEnabled
        ? `JSIG/SAP-specific applicability: ${input.bpEntry.jsigNote}`
        : undefined,
      '',
      // Regulatory document chunks positioned before catalog context — regulatory specifics take precedence.
      chunkBlock,
      '',
      'Related NIST catalog control context:',
      input.ragControls.map(formatControl).join('\n\n'),
      '',
      `Evidence types typically expected by assessors: ${input.suggestedEvidenceTypes.join('; ')}`,
      '',
      'OUTPUT REQUIREMENTS:',
      '- Two to four formal paragraphs. No bullet points, numbered lists, or markdown.',
      '- Paragraph 1: why this control is material to the system — what organizational risk it addresses.',
      '- Paragraph 2: how impact level, boundary, information types, and tailoring determine implementation scope.',
      '- Paragraph 3: what objective evidence an assessor will examine during a control assessment.',
      '- Paragraph 4 (when JSIG/DoD policy context supplies additional requirements): explain how those requirements',
      '  elevate or modify the NIST baseline and what that means for the system owner practically.',
      '- Reference the system name, information types, and boundary details from project context when supplied.',
      '- Do not fabricate, speculate, or assert compliance not supported by the supplied context.',
      '',
      'Control explanation:',
    ]
      .filter(Boolean)
      .join('\n')
  }

  private buildPoamPrompt(projectContext: ProjectAiContext, deterministic: PoamSuggestion[]) {
    const ctxLine = [
      `System: ${projectContext.name}`,
      `Impact: ${projectContext.confirmedImpactLevel ?? projectContext.impactLevel}`,
      `JSIG: ${projectContext.jsigOverlay ? 'yes' : 'no'}`,
      projectContext.authBoundary ? `Boundary: ${truncate(projectContext.authBoundary, 120)}` : undefined,
      projectContext.informationTypes.length
        ? `Info types: ${projectContext.informationTypes.map((t) => t.name ?? t.id).slice(0, 5).join(', ')}`
        : undefined,
    ].filter(Boolean).join(' | ')

    return [
      'You are a senior RMF practitioner. Refine these POA&M entries for a DoD authorization package.',
      'Return ONLY valid JSON: {"suggestions":[...]}. Preserve all IDs.',
      'Each object: id, weakness, recommendedMitigation, severity (CRITICAL/HIGH/MODERATE/LOW), suggestedCompletionDate (YYYY-MM-DD), relatedControlIds, rationale, confidenceScore.',
      'Dates: CRITICAL≤30d, HIGH≤60d, MODERATE≤90d, LOW≤180d from today.',
      projectContext.jsigOverlay
        ? 'JSIG/SAP: Name PSO/ISSO roles, reference PAR and access-roster processes where relevant.'
        : 'Reference NIST 800-53 control language and DCSA evidence expectations.',
      '',
      ctxLine,
      '',
      'Suggestions to refine:',
      JSON.stringify({ suggestions: deterministic }),
    ].filter(Boolean).join('\n')
  }

  private buildAssessmentFindingsPrompt(projectContext: ProjectAiContext, deterministic: AssessmentFindingSuggestion[]) {
    return [
      'You are a senior Security Control Assessor (SCA) with deep expertise in NIST SP 800-53A Rev. 5, DoD Instruction 8510.01, and JSIG assessment requirements for SAP systems.',
      'Your task is to refine the supplied deterministic assessment findings into professionally written, assessor-quality findings suitable for a Security Assessment Report (SAR).',
      'Each finding must demonstrate: objective evidence of the gap, specific control language from 800-53, and a recommendation grounded in authoritative implementation guidance.',
      'Preserve all control IDs. Return only valid JSON with a top-level "findings" array.',
      'Each finding must include: id, controlId, description, severity, status, evidence, recommendation, rationale, confidenceScore.',
      'Severity: CRITICAL (immediate exploitable risk), HIGH (significant risk requiring urgent remediation), MODERATE (notable gap), LOW (minor deviation).',
      'Status: OPEN (not addressed), IN_REMEDIATION (actively being fixed).',
      projectContext.jsigOverlay
        ? 'JSIG context: For SAP system findings, reference JSIG-specific requirements (PAR documentation, access roster currency, audit log integrity, PSO involvement) where applicable. Non-repudiation (AU-10) findings in SAP environments are automatically HIGH or CRITICAL.'
        : undefined,
      'Do not invent tool names, specific dates, or evidence artifacts not referenced in the project context.',
      '',
      `Project context:\n${formatProjectContext(projectContext)}`,
      `JSIG/SAP overlay: ${projectContext.jsigOverlay ? 'enabled' : 'disabled'}`,
      '',
      'Deterministic findings to refine:',
      JSON.stringify({ findings: deterministic }, null, 2),
    ].filter(Boolean).join('\n')
  }

  private retrieveFormalDocumentChunks(
    input: GenerateFormalDocumentInput,
    projectContext: ProjectAiContext | undefined,
    controls: RagControl[],
    jsigEnabled: boolean,
  ): DocumentChunk[] {
    if (this.chunks.size === 0) return []

    const query = [
      input.mode,
      input.title,
      input.topic,
      input.systemContext,
      input.extraInstructions,
      projectContext?.name,
      projectContext?.description,
      projectContext?.authBoundary,
      projectContext?.riskTolerance,
      projectContext?.organizationalContext,
      projectContext?.informationTypes.map((type) => `${type.name ?? ''} ${type.family ?? ''}`).join(' '),
      controls.map((control) => `${control.controlId} ${control.title} ${control.description}`).join(' '),
      jsigEnabled ? 'JSIG SAP SCI privileged access audit boundary authorization' : 'DoD 8500 8510 DAAPM RMF authorization monitoring assessment',
    ].filter(Boolean).join(' ')

    const candidates: DocumentChunk[] = []
    const seen = new Set<string>()
    const add = (chunks: DocumentChunk[]) => {
      for (const chunk of chunks) {
        if (seen.has(chunk.id)) continue
        seen.add(chunk.id)
        candidates.push(chunk)
      }
    }

    for (const control of controls.slice(0, 8)) {
      add(this.chunks.search({
        controlId: control.controlId,
        family: control.family,
        jsigEnabled,
        impactLevel: input.impactLevel ?? projectContext?.confirmedImpactLevel as 'LOW' | 'MODERATE' | 'HIGH' | undefined ?? projectContext?.impactLevel,
        query,
        maxResults: 3,
      }))
    }

    add(this.chunks.search({
      family: controls[0]?.family,
      jsigEnabled,
      impactLevel: input.impactLevel ?? projectContext?.confirmedImpactLevel as 'LOW' | 'MODERATE' | 'HIGH' | undefined ?? projectContext?.impactLevel,
      query,
      maxResults: 8,
    }))

    return candidates.slice(0, 10)
  }

  private buildFormalDocumentPrompt(input: {
    input: GenerateFormalDocumentInput & { mode: AiDocumentMode }
    projectContext?: ProjectAiContext
    controls: RagControl[]
    bestPractices: BestPracticeEntry[]
    chunks: DocumentChunk[]
    suggestedEvidence: string[]
    jsigEnabled: boolean
    actorRole: Role
  }): string {
    const modePrompt = input.input.mode === 'POLICY'
      ? SYSTEM_PROMPTS.policy
      : input.input.mode === 'PROCEDURE'
        ? SYSTEM_PROMPTS.procedure
        : SYSTEM_PROMPTS.riskAcceptanceLetter
    const modeName = formatDocumentMode(input.input.mode)
    const outputRules =
      input.input.mode === 'POLICY'
        ? [
            'Produce a complete formal policy with these sections: Purpose; Scope and Applicability; Policy Requirements; Roles and Responsibilities; Evidence and Records; Exceptions; Review and Maintenance; Compliance.',
            'Use concise section headings and formal paragraphs. Requirements must use precise mandatory language.',
            'Do not include signature blocks unless explicitly requested.',
          ]
        : input.input.mode === 'PROCEDURE'
          ? [
              'Produce a complete formal procedure with these sections: Purpose; Scope; Prerequisites; Roles; Procedure; Required Evidence; Exceptions and Escalation; Review Cadence.',
              'Use numbered procedural steps in the Procedure section. Each step must identify the actor and the action.',
              'Make the procedure operationally usable without inventing tool names or local ticketing processes.',
            ]
          : [
              'Produce a formal risk acceptance letter with these sections: Subject; Background; Risk Statement; Basis for Acceptance; Compensating Controls and Monitoring Commitments; Limitations and Review Triggers; Closing Statement.',
              'Write in polished letter prose suitable for an AO, DAO, ISSM, or System Owner. Do not invent a signer or date.',
              'State residual risk carefully and avoid implying broader authorization than the facts support.',
            ]

    const bestPracticeBlock = input.bestPractices.length
      ? input.bestPractices.map((entry) => [
          `Control ${entry.controlId}: ${entry.title}`,
          `Best practice: ${entry.bestPracticeStatement}`,
          entry.commonImplementation ? `Common implementation: ${entry.commonImplementation}` : undefined,
          entry.typicalEvidence ? `Typical evidence: ${entry.typicalEvidence}` : undefined,
          input.jsigEnabled && entry.jsigNote ? `JSIG note: ${entry.jsigNote}` : undefined,
        ].filter(Boolean).join('\n')).join('\n\n')
      : 'No curated best-practice entries were supplied for the requested controls. Use retrieved chunks and project context first.'

    return [
      modePrompt,
      '',
      input.jsigEnabled ? JSIG_CONTEXT : DOD_POLICY_CONTEXT,
      SOURCE_PRIORITY_CONTEXT,
      '',
      `Task: Generate a ${modeName}.`,
      `Requesting role: ${input.actorRole}`,
      `Title: ${input.input.title ?? defaultFormalDocumentTitle(input.input.mode, input.input.topic)}`,
      input.input.topic ? `Topic: ${input.input.topic}` : undefined,
      `Impact level: ${input.input.impactLevel ?? input.projectContext?.confirmedImpactLevel ?? input.projectContext?.impactLevel ?? 'Not specified'}`,
      `JSIG/SAP overlay: ${input.jsigEnabled ? 'enabled — JSIG/SAP language and evidence expectations must be reflected where relevant' : 'not enabled'}`,
      input.projectContext ? `Project context:\n${formatProjectContext(input.projectContext)}` : undefined,
      input.input.systemContext ? `Additional context:\n${input.input.systemContext}` : undefined,
      input.input.extraInstructions ? `Specific user instructions:\n${input.input.extraInstructions}` : undefined,
      '',
      'Requested controls and catalog context:',
      input.controls.length ? input.controls.map(formatControl).join('\n\n') : 'No specific controls supplied.',
      '',
      'Curated best-practice guidance — primary drafting source when present:',
      bestPracticeBlock,
      '',
      'Retrieved authoritative policy chunks — use before general model knowledge:',
      input.chunks.length ? formatDocumentChunks(input.chunks) : 'No retrieved policy chunks were available for this request.',
      '',
      input.suggestedEvidence.length ? `Evidence categories to address where relevant: ${input.suggestedEvidence.join('; ')}` : undefined,
      '',
      'OUTPUT REQUIREMENTS:',
      ...outputRules.map((rule) => `- ${rule}`),
      '- Use clear, authoritative, auditor-ready formal English suitable for an RMF package artifact.',
      '- Reference JSIG, DCSA DAAG/DAAPM, DoDI 8500.01, DoDI 8510.01, CNSSI 1253, and NIST RMF concepts only when relevant to supplied context.',
      '- Prioritize curated best practices and retrieved policy chunks; do not rely on generic cybersecurity boilerplate when source-specific guidance is available.',
      '- Do not fabricate product names, organization names, approval authorities, dates, counts, signatories, or compliance assertions.',
      '- Begin with the document content immediately. Do not explain your process.',
      '',
      `${modeName}:`,
    ].filter(Boolean).join('\n')
  }

  private generateFormalDocumentFallback(
    input: GenerateFormalDocumentInput & { mode: AiDocumentMode },
    projectContext: ProjectAiContext | undefined,
    controls: RagControl[],
    bestPractices: BestPracticeEntry[],
    jsigEnabled: boolean,
  ): AiGenerationResult {
    const title = input.title ?? defaultFormalDocumentTitle(input.mode, input.topic)
    const systemName = projectContext?.name ?? 'the system'
    const framework = jsigEnabled
      ? 'JSIG, DoD 8500/8510-series, CNSSI 1253, NIST RMF, and DCSA DAAG/DAAPM expectations'
      : 'DoD 8500/8510-series, CNSSI 1253, NIST RMF, and DCSA DAAG/DAAPM expectations'
    const controlsText = controls.length
      ? controls.map((control) => `${control.controlId} (${control.title})`).join(', ')
      : 'the applicable security controls'
    const bpText = bestPractices.length
      ? ` The document should be implemented using the curated best-practice guidance available for ${bestPractices.map((entry) => entry.controlId).join(', ')}.`
      : ''

    if (input.mode === 'PROCEDURE') {
      return {
        text:
          `${title}\n\nPurpose\nThis procedure establishes the required process for ${input.topic ?? 'executing the requested RMF activity'} for ${systemName} in alignment with ${framework}.\n\nScope\nThis procedure applies to ${controlsText} within the authorization boundary and to personnel assigned responsibility for implementation, review, evidence maintenance, and assessor response.${bpText}\n\nProcedure\n1. The designated ISSO or responsible control owner reviews the applicable control requirements, project authorization boundary, impact level, and tailoring decisions before execution.\n2. The responsible technical or process owner implements the required safeguard using approved organizational mechanisms and documents the implementation in the security plan or supporting artifact.\n3. The ISSO collects objective evidence, validates that the evidence aligns with the implementation statement, and records any gaps as findings or POA&M items when remediation is required.\n4. The ISSM or designated reviewer verifies the procedure outcome at organization-defined intervals and escalates unresolved risk to the Authorizing Official or Delegated Authorizing Official when residual risk exceeds tolerance.\n\nRequired Evidence\nEvidence should include implementation records, configuration or process artifacts, review records, approval records, and POA&M entries where deficiencies remain.\n\nReview Cadence\nThis procedure must be reviewed at organization-defined intervals and whenever the authorization boundary, control baseline, system architecture, or applicable policy changes.`,
        fallback: true,
      }
    }

    if (input.mode === 'RISK_ACCEPTANCE_LETTER') {
      return {
        text:
          `${title}\n\nSubject\nRisk Acceptance for ${systemName}\n\nBackground\nThis memorandum documents the acceptance of residual cybersecurity risk associated with ${controlsText} for ${systemName}. The risk acceptance is based on the available project context, implementation status, applicable RMF requirements, and ${framework}.\n\nRisk Statement\nThe accepted risk concerns the possibility that one or more safeguards may not fully reduce risk to the desired level within the current authorization boundary. This acceptance does not waive the requirement to maintain accurate security documentation, objective evidence, continuous monitoring, or POA&M tracking.\n\nBasis for Acceptance\nThe risk is accepted only to the extent supported by documented implementation activity, compensating controls, assessor-reviewed evidence, and management oversight. ${bpText.trim()}\n\nMonitoring Commitments\nThe ISSO and responsible system personnel will monitor the accepted risk at organization-defined intervals, maintain evidence of compensating controls, update POA&M milestones as required, and notify the AO or DAO of any material change affecting residual risk.\n\nClosing Statement\nThis risk acceptance is limited to the facts and scope described above and must be revisited when the system boundary, threat environment, implementation status, or applicable RMF/JSIG/DCSA requirement changes.`,
        fallback: true,
      }
    }

    return {
      text:
        `${title}\n\nPurpose\nThis policy establishes mandatory cybersecurity and RMF requirements for ${systemName} in alignment with ${framework}.\n\nScope and Applicability\nThis policy applies to ${controlsText} and to all personnel responsible for implementing, operating, assessing, or maintaining safeguards within the authorization boundary.${bpText}\n\nPolicy Requirements\nThe organization will implement the applicable safeguards using documented mechanisms, maintain implementation statements that accurately reflect the operational environment, and retain objective evidence sufficient for assessor review. Control implementation, inheritance, tailoring, and exceptions must be documented in the authorization package and reviewed at organization-defined intervals.\n\nRoles and Responsibilities\nThe System Owner is accountable for ensuring the system operates within the approved boundary. The ISSM and ISSO are responsible for maintaining RMF artifacts, coordinating evidence collection, and escalating unresolved risk. Technical control owners are responsible for implementing assigned safeguards and providing evidence of operating effectiveness.\n\nEvidence and Records\nRequired records include policy acknowledgments, implementation artifacts, configuration records, access or audit review evidence, assessment results, and POA&M entries where deficiencies remain.\n\nReview and Compliance\nThis policy will be reviewed at organization-defined intervals and following significant system, boundary, mission, or policy changes. Noncompliance must be documented, assessed for risk impact, and remediated or formally accepted through the appropriate authorization process.`,
      fallback: true,
    }
  }

  private async callLocalModel(prompt: string, temperature = 0.15, model?: string): Promise<AiGenerationResult> {
    const attempt = () =>
      this.provider === 'llamacpp' ? this.callLlamaCpp(prompt, temperature) : this.callOllama(prompt, temperature, model)

    try {
      return await attempt()
    } catch (firstErr) {
      // AppError means the endpoint responded but with an error or empty body — definitive, don't retry.
      if (firstErr instanceof AppError) throw firstErr
      // Network-level failure (ECONNREFUSED, load spike, model still loading). Retry once after a short pause.
      const reason = firstErr instanceof Error ? firstErr.message : String(firstErr)
      console.warn(`[AiService] Transient network error — retrying once in 1 s. reason=${reason}`)
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))
      return await attempt()
    }
  }

  private async callOllama(prompt: string, temperature: number, model = this.model): Promise<AiGenerationResult> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          keep_alive: '30m',
          options: {
            temperature,
            top_p: 0.85,
            repeat_penalty: 1.08,
            seed: Number(process.env.LOCAL_AI_SEED ?? 37),
            num_ctx: this.contextWindow,
            num_predict: this.maxTokens,
          },
        }),
      })
    } catch (fetchErr) {
      const reason = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`[AiService] Ollama fetch failed — request did not complete.`, {
        url: `${this.baseUrl}/api/generate`,
        model,
        reason,
        hint: 'If /api/tags works, this usually means the model generation exceeded Ollama/client limits. Lower LOCAL_AI_MODEL, LOCAL_AI_MAX_TOKENS, or RAG prompt size.',
      })
      throw fetchErr
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(`[AiService] Ollama HTTP error.`, {
        status: response.status,
        statusText: response.statusText,
        model,
        url: `${this.baseUrl}/api/generate`,
        responseBody: body.slice(0, 500),
      })
      throw new AppError(`Local AI endpoint failed: ${response.status} ${response.statusText}`, 502)
    }

    const data = (await response.json()) as OllamaResponse
    const text = cleanModelText(data.response)
    if (!text) {
      console.error(`[AiService] Ollama returned an empty or unreadable response.`, {
        model,
        done: data.done,
        rawResponsePreview: String(data.response ?? '').slice(0, 300),
      })
      throw new AppError('Local AI endpoint returned an empty response', 502)
    }

    return { text, fallback: false }
  }

  private async callLlamaCpp(prompt: string, temperature: number): Promise<AiGenerationResult> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          temperature,
          top_p: 0.85,
          seed: Number(process.env.LOCAL_AI_SEED ?? 37),
          n_predict: this.maxTokens,
          cache_prompt: true,
        }),
      })
    } catch (fetchErr) {
      const reason = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`[AiService] llama.cpp fetch failed — endpoint unreachable.`, { url: `${this.baseUrl}/completion`, model: this.model, reason })
      throw fetchErr
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(`[AiService] llama.cpp HTTP error.`, {
        status: response.status,
        statusText: response.statusText,
        model: this.model,
        url: `${this.baseUrl}/completion`,
        responseBody: body.slice(0, 500),
      })
      throw new AppError(`llama.cpp endpoint failed: ${response.status} ${response.statusText}`, 502)
    }

    const data = (await response.json()) as LlamaCppResponse
    const text = cleanModelText(data.content ?? data.response)
    if (!text) {
      console.error(`[AiService] llama.cpp returned an empty or unreadable response.`, {
        model: this.model,
        rawContentPreview: String(data.content ?? data.response ?? '').slice(0, 300),
      })
      throw new AppError('llama.cpp endpoint returned an empty response', 502)
    }

    return { text, fallback: false }
  }

  private async *callOllamaStream(
    prompt: string,
    temperature: number,
    model: string,
    numCtx?: number,
  ): AsyncGenerator<string> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
          keep_alive: '30m',
          options: {
            temperature,
            top_p: 0.85,
            repeat_penalty: 1.08,
            seed: Number(process.env.LOCAL_AI_SEED ?? 37),
            num_ctx: numCtx ?? this.contextWindow,
            num_predict: this.maxTokens,
          },
        }),
      })
    } catch (fetchErr) {
      const reason = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error('[AiService] callOllamaStream: fetch failed', { model, reason })
      throw fetchErr
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error('[AiService] callOllamaStream: HTTP error', { status: response.status, model, body: body.slice(0, 300) })
      throw new AppError(`Ollama stream failed: ${response.status} ${response.statusText}`, 502)
    }

    if (!response.body) {
      throw new AppError('Ollama returned no stream body', 502)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const data = JSON.parse(trimmed) as OllamaResponse
            if (data.response) yield data.response
            if (data.done) return
          } catch {
            // skip non-JSON lines
          }
        }
      }

      // Drain any remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim()) as OllamaResponse
          if (data.response) yield data.response
        } catch {
          // ignore
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private generateCuratedImplementation(
    entry: BestPracticeEntry,
    input: GenerateImplementationInput,
    purpose: AiPurpose,
    projectContext?: ProjectAiContext,
    jsigEnabled = false,
  ): AiGenerationResult {
    const impactLabel = projectContext?.confirmedImpactLevel ?? input.impactLevel ?? projectContext?.impactLevel
    const tailoringParts = [
      projectContext?.tailoringHistory?.action ? `Current tailoring disposition is ${projectContext.tailoringHistory.action}.` : undefined,
      projectContext?.tailoringHistory?.justification ? `Tailoring rationale: ${projectContext.tailoringHistory.justification}` : undefined,
      purpose === 'TAILORING_SUGGESTION'
        ? 'Any modification to this control must remain traceable to mission need, authorization boundary analysis, compensating controls, and Authorizing Official risk acceptance.'
        : undefined,
    ].filter(Boolean)

    return {
      text: this.bp.personalize(entry, {
        systemName: projectContext?.name,
        impactLevel: impactLabel,
        jsigEnabled,
        tailoringNote: tailoringParts.length ? tailoringParts.join(' ') : undefined,
        roleSummary: summarizePrimaryRoles(projectContext?.roleSummary),
        authorizationBoundary: projectContext?.authBoundary,
        organizationalContext: projectContext?.organizationalContext,
        inherited: Boolean(input.inherited || projectContext?.tailoringHistory?.inherited),
        inheritedFrom: input.inheritedFrom || projectContext?.tailoringHistory?.inheritedFrom,
      }),
      fallback: false,
    }
  }

  private generateImplementationFallback(
    control: RagControl,
    input: GenerateImplementationInput,
    purpose: AiPurpose,
    projectContext?: ProjectAiContext,
    jsigEnabled = false,
    bpEntry?: BestPracticeEntry,
  ): AiGenerationResult {
    const impactLabel = projectContext?.confirmedImpactLevel ?? projectContext?.impactLevel ?? baselineLabel(control)

    const tailoringNote =
      purpose === 'TAILORING_SUGGESTION'
        ? ' Any tailoring decision affecting this control must be supported by a documented mission need or boundary analysis, identification of compensating controls where applicable, and formal acceptance by the Authorizing Official or designated representative prior to inclusion in the final baseline.'
        : ''

    // ── Tier 1: curated JSON entry available ──────────────────────────────────
    // The personalize() method anchors generic language to the specific system
    // name, appends the JSIG note when the overlay is active, and appends any
    // tailoring note. This produces the highest-quality offline output.
    if (bpEntry) {
      const text = this.bp.personalize(bpEntry, {
        systemName: projectContext?.name,
        impactLevel: impactLabel,
        jsigEnabled,
        tailoringNote: tailoringNote.trim() || undefined,
      })
      return { text, fallback: true }
    }

    // ── Tier 2: family-specific template ──────────────────────────────────────
    const owner = projectContext?.roleSummary
      ? (projectContext.roleSummary.split(';')[0]?.trim() ?? 'the designated system owner')
      : 'the system owner, ISSO, and assigned technical personnel'
    const systemRef = projectContext?.name ? `the ${projectContext.name} system` : 'the system'
    const evidence = deriveEvidenceTypes(control, [control], jsigEnabled).join(', ')

    const core = buildFallbackCore(control, systemRef, owner, impactLabel, Boolean(input.inherited), input.inheritedFrom, evidence)

    const jsigNote = jsigEnabled
      ? ' For JSIG/SAP applicability, the implementation must further address need-to-know enforcement, privileged activity auditing, formal approval chain documentation, and compartment-aware evidence handling appropriate to the classification environment and compartment boundaries in effect.'
      : ''

    return {
      text: `${core}${tailoringNote}${jsigNote}`.replace(/\s+/g, ' ').trim(),
      fallback: true,
    }
  }

  private generateExplanationFallback(control: RagControl, projectContext?: ProjectAiContext, jsigEnabled = false): AiGenerationResult {
    const impact = projectContext?.confirmedImpactLevel ?? projectContext?.impactLevel ?? baselineLabel(control)
    const evidence = deriveEvidenceTypes(control, [control], jsigEnabled).join(', ')
    const systemRef = projectContext?.name ? `the ${projectContext.name} system` : `systems operating at the ${impact} impact level`

    return {
      text:
        `${control.controlId} (${control.title}) establishes foundational risk management requirements within the ${control.family} control family and is applicable to ${systemRef}. ` +
        `This control is significant to the authorization package because it creates traceable, assessable expectations spanning from organizational policy and system design through operational execution and recorded evidence — providing the Authorizing Official with confidence that the associated risk area is actively managed and subject to continuous monitoring. ` +
        `The appropriate implementation scope, inheritance posture, and evidence requirements for this control should be determined by the system's authorization boundary, confirmed information types, organizational risk tolerance, and any tailoring decisions already recorded in the control selection baseline. ` +
        `Security Control Assessors will typically look for ${evidence} as objective evidence that the control has been implemented and is operating as intended throughout the authorization period.` +
        (jsigEnabled
          ? ` With JSIG/SAP context applied, the assessment should additionally confirm that need-to-know enforcement, compartmentation procedures, enhanced auditability measures, and formal approval records are present, current, and sufficient for the classification environment in which the system operates.`
          : ''),
      fallback: true,
    }
  }

  private async nextDocumentRevision(projectId: string | undefined, mode: AiDocumentMode) {
    if (!projectId) {
      return {
        revision: 1,
        previousRevisions: 0,
        generatedAt: new Date().toISOString(),
      }
    }

    const previousRevisions = await prisma.auditLog.count({
      where: {
        projectId,
        action: 'AI_GENERATE_FORMAL_DOCUMENT',
        entityType: 'control',
        entityId: mode,
      },
    }).catch(() => 0)

    return {
      revision: previousRevisions + 1,
      previousRevisions,
      generatedAt: new Date().toISOString(),
    }
  }

  private async recordGenerationHistory(input: {
    actor: AiActor
    projectId?: string
    controlId: string
    action: 'AI_GENERATE_IMPLEMENTATION' | 'AI_EXPLAIN_CONTROL' | 'AI_TAILOR_CONTROLS' | 'AI_GENERATE_ASSESSMENT_FINDINGS' | 'AI_GENERATE_RISK_RATIONALE' | 'AI_GENERATE_MONITORING_REPORT' | 'AI_GENERATE_FORMAL_DOCUMENT'
    details: Record<string, unknown>
  }) {
    await prisma.auditLog.create({
      data: {
        userId: input.actor.userId,
        projectId: input.projectId,
        action: input.action,
        entityType: 'control',
        entityId: input.controlId,
        details: input.details as Prisma.InputJsonObject,
      },
    }).catch(() => undefined)
  }
}

function computeMonitoringComplianceScore(input: {
  implementationPercent: number
  openPoams: number
  overduePoams: number
  openFindings: number
  criticalHighItems: number
  jsigOverlay: boolean
}) {
  const penalty =
    input.openPoams * 2 +
    input.overduePoams * 6 +
    input.openFindings * 3 +
    input.criticalHighItems * 5 +
    (input.jsigOverlay && input.criticalHighItems > 0 ? 5 : 0)

  return Math.max(0, Math.min(100, Math.round(input.implementationPercent - penalty)))
}

function buildMonitoringActions(input: {
  ctx: AuthorizeProjectContext
  openPoams: number
  overduePoams: number
  implementationPercent: number
  riskTrend: string
  nextReviewDate?: string
}) {
  const actions: string[] = []

  if (input.overduePoams > 0) {
    actions.push(`Escalate ${input.overduePoams} overdue POA&M item${input.overduePoams === 1 ? '' : 's'} and update milestone dates with accountable owners.`)
  }
  if (input.openPoams > 0) {
    actions.push(`Review ${input.openPoams} open POA&M item${input.openPoams === 1 ? '' : 's'} during the next continuous monitoring meeting.`)
  }
  if (input.ctx.findingCounts.open > 0) {
    actions.push(`Validate remediation evidence for ${input.ctx.findingCounts.open} open or in-remediation assessment finding${input.ctx.findingCounts.open === 1 ? '' : 's'}.`)
  }
  if (input.implementationPercent < 90) {
    actions.push(`Prioritize implementation statements and evidence for remaining controls to raise implementation coverage above 90 percent.`)
  }
  if (input.ctx.jsigOverlay) {
    actions.push('Confirm JSIG/SAP monitoring artifacts include access roster reviews, compartment boundary validation, privileged activity review, and media/accountability evidence.')
  }
  if (!input.nextReviewDate) {
    actions.push('Set the next recurring monitoring review date and assign owners for recurring evidence refresh tasks.')
  }
  if (actions.length === 0) {
    actions.push('Maintain the current monitoring cadence, refresh evidence on schedule, and continue validating POA&M closure evidence before each review.')
  }

  return actions
}

function buildMonitoringFallbackReport(input: {
  ctx: AuthorizeProjectContext
  implementationPercent: number
  complianceScore: number
  riskTrend: string
  openPoams: number
  overduePoams: number
  evidenceItems: number
  recommendedActions: string[]
}) {
  const impact = input.ctx.confirmedImpactLevel ?? input.ctx.impactLevel
  return (
    `The continuous monitoring review for ${input.ctx.name}, operating at the ${impact} impact level, reflects a current compliance score of ${input.complianceScore}% with a ${input.riskTrend.toLowerCase()} risk trend. ` +
    `Control implementation coverage is ${input.implementationPercent}% (${input.ctx.controlCounts.implemented} implemented out of ${input.ctx.controlCounts.selected || input.ctx.controlCounts.total} selected controls), with ${input.ctx.controlCounts.partial} partially implemented, ${input.ctx.controlCounts.planned} planned, and ${input.ctx.controlCounts.notImplemented} not implemented controls remaining. ` +
    `The monitoring posture includes ${input.ctx.findingCounts.open} open or in-remediation assessment findings, ${input.openPoams} open POA&M items, ${input.overduePoams} overdue POA&M milestones, and ${input.evidenceItems} evidence artifacts available for review. ` +
    (input.ctx.jsigOverlay
      ? `Because JSIG/SAP applicability is enabled, ongoing monitoring should continue to emphasize need-to-know enforcement, compartment boundary validation, access roster currency, privileged activity review, and media/accountability evidence. `
      : '') +
    `Recommended next actions are: ${input.recommendedActions.join(' ')}`
  )
}

const controlSelect = {
  controlId: true,
  family: true,
  title: true,
  description: true,
  lowBaseline: true,
  modBaseline: true,
  highBaseline: true,
  bestPracticeStatement: true,
  typicalEvidence: true,
} as const

function getStepData(steps: Array<{ stepNumber: number; data: Prisma.JsonValue | null }>, stepNumber: number) {
  return getRecord(steps.find((step) => step.stepNumber === stepNumber)?.data)
}

function buildRoleSummary(
  owner: { firstName: string; lastName: string; email: string; role: Role },
  members: Array<{ role: Role; user: { firstName: string; lastName: string; email: string; role: Role } }>,
  savedRoles: unknown,
) {
  const people = [
    `System Owner: ${owner.firstName} ${owner.lastName} (${owner.email})`,
    ...members.map((member) => `${member.role}: ${member.user.firstName} ${member.user.lastName} (${member.user.email})`),
  ]
  const roles = getRecord(savedRoles)
  const saved = Object.entries(roles)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => `${key}: ${value}`)

  return [...people, ...saved].join('; ')
}

function summarizePrimaryRoles(roleSummary?: string) {
  if (!roleSummary) return undefined
  return roleSummary
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('; ')
}

function formatProjectContext(context: ProjectAiContext) {
  return [
    `Name: ${context.name}`,
    context.description ? `Description: ${context.description}` : undefined,
    `Impact: ${context.confirmedImpactLevel ?? context.impactLevel}`,
    context.authBoundary ? `Authorization boundary: ${context.authBoundary}` : undefined,
    context.boundaryConfirmation ? `Boundary confirmation: ${context.boundaryConfirmation}` : undefined,
    context.roleSummary ? `Roles: ${context.roleSummary}` : undefined,
    context.riskTolerance ? `Risk tolerance: ${context.riskTolerance}` : undefined,
    context.organizationalContext ? `Organizational context: ${context.organizationalContext}` : undefined,
    context.impactJustification ? `Impact justification: ${context.impactJustification}` : undefined,
    context.objectiveJustification ? `CIA notes: ${context.objectiveJustification}` : undefined,
    context.informationTypes.length ? `Information types: ${context.informationTypes.map((type) => type.name ?? type.id).join(', ')}` : undefined,
  ]
    .filter(Boolean)
    .join('\n')
}

function formatTailoring(context?: ProjectAiContext) {
  if (!context?.tailoringHistory) return 'No tailoring history was found for this control.'
  const tailoring = context.tailoringHistory
  return [
    tailoring.action ? `Action: ${tailoring.action}` : undefined,
    tailoring.inherited ? `Inherited: yes${tailoring.inheritedFrom ? ` from ${tailoring.inheritedFrom}` : ''}` : 'Inherited: no',
    tailoring.justification ? `Justification: ${tailoring.justification}` : undefined,
    context.jsigOverlay ? 'JSIG overlay: enabled' : 'JSIG overlay: disabled',
  ]
    .filter(Boolean)
    .join('\n')
}

function formatControl(control: RagControl) {
  return [
    `${control.controlId} - ${control.title}`,
    `Family: ${control.family}`,
    `Baseline: ${baselineLabel(control)}`,
    `Statement: ${truncate(control.description, 900)}`,
    control.bestPracticeStatement ? `Best practice: ${truncate(control.bestPracticeStatement, 700)}` : undefined,
    control.typicalEvidence ? `Typical evidence: ${truncate(control.typicalEvidence, 500)}` : undefined,
  ]
    .filter(Boolean)
    .join('\n')
}

function formatPastImplementation(item: PastImplementation) {
  return [
    `Project: ${item.projectName}`,
    `Status: ${item.status ?? 'unknown'}${item.approved ? ' (approved/complete context)' : ''}`,
    item.inherited ? `Inherited from: ${item.inheritedFrom ?? 'common control provider'}` : undefined,
    `Statement: ${truncate(item.statement, 700)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function baselineLabel(control: Pick<RagControl, 'lowBaseline' | 'modBaseline' | 'highBaseline'>) {
  const labels = [
    control.lowBaseline ? 'LOW' : undefined,
    control.modBaseline ? 'MODERATE' : undefined,
    control.highBaseline ? 'HIGH' : undefined,
  ].filter(Boolean)

  return labels.length ? labels.join('/') : 'tailorable / overlay'
}

function deriveEvidenceTypes(
  primaryControl: RagControl,
  ragControls: RagControl[],
  jsigEnabled: boolean,
  // Curated evidence from best-practices.json takes priority and is inserted first.
  curatedEvidence?: string[],
) {
  const evidence = new Set<string>()

  // Curated JSON evidence first — highest quality, most specific.
  for (const item of curatedEvidence ?? []) {
    const trimmed = item.trim()
    if (trimmed) evidence.add(trimmed)
  }

  // DB control's typicalEvidence field next.
  for (const item of primaryControl.typicalEvidence?.split(/[;,]/) ?? []) {
    const trimmed = item.trim()
    if (trimmed) evidence.add(trimmed)
  }

  // Family-level defaults fill remaining slots.
  for (const item of FAMILY_EVIDENCE[primaryControl.family] ?? []) evidence.add(item)
  for (const control of ragControls.slice(0, 5)) {
    for (const item of FAMILY_EVIDENCE[control.family] ?? []) evidence.add(item)
  }

  if (jsigEnabled) {
    evidence.add('need-to-know approval record')
    evidence.add('privileged activity audit record')
    evidence.add('compartmented access roster')
    evidence.add('JSIG/SAP tailoring rationale')
  }

  return Array.from(evidence).slice(0, 10)
}

function calculateConfidence(input: {
  control: RagControl
  projectContext?: ProjectAiContext
  ragControls: RagControl[]
  ragChunks?: DocumentChunk[]
  pastImplementations: PastImplementation[]
  generatedText: string
  fallback: boolean
  jsigEnabled: boolean
  hasBestPractice?: boolean
}) {
  let score = 45
  if (input.control.description.length > 80) score += 10
  // Curated JSON entry is worth more than a DB bestPracticeStatement because
  // it was written specifically for SSP use and carries structured evidence.
  if (input.hasBestPractice) score += 15
  else if (input.control.bestPracticeStatement) score += 8
  if (input.control.typicalEvidence) score += 5
  if (input.projectContext?.riskTolerance || input.projectContext?.organizationalContext) score += 8
  if (input.projectContext?.informationTypes.length) score += 5
  if (input.projectContext?.tailoringHistory?.action || input.projectContext?.tailoringHistory?.justification) score += 5
  if (input.ragControls.length >= 4) score += 5
  if (input.pastImplementations.some((item) => item.approved)) score += 8
  score += Math.round(scoreOutputQuality(input.generatedText) * 0.35)
  if (input.jsigEnabled && input.generatedText.toLowerCase().includes('need-to-know')) score += 3
  // Document chunks retrieved from the knowledge base indicate richer policy
  // grounding. JSIG-typed chunks are worth more because they carry concrete
  // SAP-specific requirements that elevate output precision.
  const chunkCount = input.ragChunks?.length ?? 0
  if (chunkCount >= 1) score += 4
  if (chunkCount >= 3) score += 4
  if (input.ragChunks?.some((c) => c.metadata.docType === 'JSIG')) score += 5
  if (input.ragChunks?.some((c) => /DAAPM|DAAG|8500|8510|DOD/i.test(`${c.metadata.docTitle} ${c.metadata.docId}`))) score += 3
  // Fallback penalty applies only when the model was bypassed entirely (pure
  // template output). With curated+model path, fallback=false even for curated
  // entries, so no penalty is incurred. Only penalize pure template output.
  if (input.fallback && !input.hasBestPractice) score -= 15

  return Math.max(0, Math.min(100, score))
}

function scoreControl(control: RagControl, query: string, primaryControlId: string, jsigEnabled: boolean) {
  if (control.controlId === primaryControlId) return 1000

  const haystack = [
    control.controlId,
    control.family,
    control.title,
    control.description,
    control.bestPracticeStatement,
    control.typicalEvidence,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const terms = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9()-]+/)
      .filter((term) => term.length > 2),
  )

  let score = control.family === primaryControlId.split('-')[0] ? 20 : 0
  for (const term of terms) {
    if (haystack.includes(term)) score += term.includes('-') ? 22 : 2
  }

  if (control.bestPracticeStatement) score += 8
  if (control.typicalEvidence) score += 5
  if (jsigEnabled && /^(AC-4|AU-10|SC-3|SC-7|IA-2|PS-3)/.test(control.controlId)) score += 18

  return score
}

function syntheticControl(controlId: string): RagControl {
  const family = controlId.includes('-') ? controlId.split('-')[0]?.toUpperCase() || 'UNKNOWN' : 'UNKNOWN'
  return {
    controlId,
    family,
    title: controlId,
    description: `Tailored control recommendation for ${controlId}. Verify catalog details before accepting into the baseline.`,
    lowBaseline: false,
    modBaseline: false,
    highBaseline: false,
    bestPracticeStatement: null,
    typicalEvidence: null,
  }
}

function suggestedProvider(controlId: string) {
  if (/^AC|^IA/.test(controlId)) return 'Enterprise Identity / SSO Provider'
  if (/^SC/.test(controlId)) return 'Enterprise Network Boundary Provider'
  if (/^AU|^SI-4/.test(controlId)) return 'Enterprise SOC / SIEM Provider'
  if (/^RA-5|^CA-7/.test(controlId)) return 'Continuous Monitoring Program'
  if (/^SA-9/.test(controlId)) return 'External Service Provider'
  return 'Common Control Provider'
}

function recommendationConfidence(
  type: TailoringRecommendationType,
  control: RagControl,
  projectContext: ProjectAiContext,
  jsigEnabled: boolean,
) {
  let score = type === 'REMOVE' ? 62 : 72
  if (control.bestPracticeStatement) score += 5
  if (control.typicalEvidence) score += 5
  if (projectContext.riskTolerance || projectContext.organizationalContext) score += 5
  if (projectContext.informationTypes.length) score += 5
  if (jsigEnabled && /^(AC-4|AU-10|IA-2|PS-3|SC)/.test(control.controlId)) score += 8
  return Math.max(0, Math.min(100, score))
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildPoamSuggestion(input: {
  control: RagControl
  bestPractice?: BestPracticeEntry
  status: string
  projectContext: ProjectAiContext
  jsigEnabled: boolean
}): PoamSuggestion {
  const { control, bestPractice, status, projectContext, jsigEnabled } = input
  const severity = poamSeverity(control, status, projectContext.impactLevel, jsigEnabled)
  const days = severity === 'CRITICAL' ? 30 : severity === 'HIGH' ? 60 : severity === 'MODERATE' ? 90 : 180
  const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const guidance = bestPractice?.bestPracticeStatement ?? control.bestPracticeStatement ?? control.description
  const evidence = bestPractice?.typicalEvidence?.length
    ? bestPractice.typicalEvidence.slice(0, 4).join(', ')
    : deriveEvidenceTypes(control, [control], jsigEnabled).slice(0, 4).join(', ')

  return {
    id: `POAM:${control.controlId}`,
    weakness: `${control.controlId} (${control.title}) is ${formatPoamStatus(status)} and requires corrective action before the control can be assessed as fully implemented.`,
    recommendedMitigation:
      `Document and execute a remediation plan for ${control.controlId} that aligns the implementation with the selected baseline, authorization boundary, and ${projectContext.impactLevel} impact level. ` +
      `The plan should address the control intent using the curated implementation guidance: ${truncate(guidance, 700)} ` +
      `Expected closure evidence should include ${evidence}.`,
    severity,
    suggestedCompletionDate: due,
    relatedControlIds: [control.controlId],
    rationale:
      `${control.controlId} is part of the selected control set but is currently ${formatPoamStatus(status)}. ` +
      `${jsigEnabled ? 'Because JSIG/SAP overlay context is enabled, unresolved implementation gaps should be tracked with heightened visibility and defensible completion evidence. ' : ''}` +
      'Tracking this gap in the POA&M provides a formal remediation owner, target date, mitigation narrative, and closure evidence trail for assessor review.',
    source: bestPractice ? 'BEST_PRACTICE' : 'DETERMINISTIC',
    confidenceScore: Math.max(60, Math.min(94, 72 + (bestPractice ? 10 : 0) + (jsigEnabled ? 5 : 0))),
  }
}

function poamSeverity(control: RagControl, status: string, impactLevel: string, jsigEnabled: boolean): PoamSuggestion['severity'] {
  if (status === 'NOT_IMPLEMENTED' && (impactLevel === 'HIGH' || jsigEnabled)) return 'HIGH'
  if (status === 'NOT_IMPLEMENTED') return 'MODERATE'
  if (status === 'PARTIALLY_IMPLEMENTED' && /^(AC|IA|SC|AU|SI|IR|RA)/.test(control.family)) return impactLevel === 'LOW' ? 'MODERATE' : 'HIGH'
  if (status === 'PARTIALLY_IMPLEMENTED') return 'MODERATE'
  return 'LOW'
}

function formatPoamStatus(status: string) {
  return status.toLowerCase().replace(/_/g, ' ')
}

function parsePoamJson(text: string): PoamSuggestion[] {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return []

  try {
    const parsed = JSON.parse(jsonText) as { suggestions?: unknown[] }
    return asArray(parsed.suggestions)
      .map((item) => getRecord(item))
      .map((item) => ({
        id: asString(item.id) ?? `POAM:${asArray(item.relatedControlIds)[0] ?? 'UNKNOWN'}`,
        weakness: asString(item.weakness) ?? '',
        recommendedMitigation: asString(item.recommendedMitigation) ?? '',
        severity: normalizeSeverity(asString(item.severity)),
        suggestedCompletionDate: asString(item.suggestedCompletionDate) ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        relatedControlIds: asArray(item.relatedControlIds).map(String).filter(Boolean),
        rationale: asString(item.rationale) ?? '',
        source: 'AI' as const,
        confidenceScore: Number(item.confidenceScore) || 76,
      }))
      .filter((item) => item.weakness && item.recommendedMitigation && item.relatedControlIds.length)
  } catch {
    return []
  }
}

function normalizeSeverity(value?: string): PoamSuggestion['severity'] {
  if (value === 'CRITICAL' || value === 'HIGH' || value === 'MODERATE' || value === 'LOW') return value
  if (value === 'MEDIUM') return 'MODERATE'
  return 'MODERATE'
}

function mergePoamSuggestions(base: PoamSuggestion[], refined: PoamSuggestion[]) {
  const refinedByControl = new Map(refined.map((item) => [item.relatedControlIds[0], item]))
  return base.map((item) => {
    const update = refinedByControl.get(item.relatedControlIds[0])
    return update
      ? {
          ...item,
          ...update,
          id: item.id,
          relatedControlIds: update.relatedControlIds.length ? update.relatedControlIds : item.relatedControlIds,
          source: 'AI' as const,
          confidenceScore: Math.max(item.confidenceScore, Math.min(95, update.confidenceScore || item.confidenceScore)),
        }
      : item
  })
}

function buildAssessmentFinding(input: {
  control: RagControl
  bestPractice?: BestPracticeEntry
  status: string
  statement?: string
  projectContext: ProjectAiContext
  jsigEnabled: boolean
}): AssessmentFindingSuggestion {
  const { control, bestPractice, status, statement, projectContext, jsigEnabled } = input
  const severity = poamSeverity(control, status, projectContext.impactLevel, jsigEnabled)
  const guidance = bestPractice?.bestPracticeStatement ?? control.bestPracticeStatement ?? control.description
  const evidence = deriveEvidenceTypes(control, [control], jsigEnabled, bestPractice?.typicalEvidence).slice(0, 4).join(', ')

  return {
    id: `FINDING:${control.controlId}`,
    controlId: control.controlId,
    description:
      `${control.controlId} (${control.title}) is assessed as ${formatPoamStatus(status)} based on Step 3 implementation data. ` +
      `${statement ? `The saved implementation statement indicates: ${truncate(statement, 500)} ` : 'No complete implementation statement or operating evidence has been recorded for assessor validation. '}` +
      `This creates an assessment finding because the selected control objective is not yet fully supported by documented implementation and evidence.`,
    severity,
    status: status === 'PLANNED' ? 'IN_REMEDIATION' : 'OPEN',
    evidence: `Expected assessor evidence includes ${evidence}. Current evidence should be uploaded or linked in Step 4 before closure.`,
    recommendation:
      `Remediate ${control.controlId} by completing the implementation, collecting objective evidence, and updating the assessment record. ` +
      `Use the curated best-practice baseline as implementation guidance: ${truncate(guidance, 650)}`,
    rationale:
      `${control.controlId} remains a candidate finding because Step 3 status is ${formatPoamStatus(status)} for a selected control. ` +
      `${jsigEnabled ? 'JSIG/SAP context increases the need for explicit evidence, need-to-know validation, and defensible closure rationale. ' : ''}` +
      'This should be reviewed by the SCA and tracked through POA&M if residual weakness remains.',
    confidenceScore: Math.max(62, Math.min(94, 74 + (bestPractice ? 10 : 0) + (jsigEnabled ? 5 : 0))),
    source: bestPractice ? 'BEST_PRACTICE' : 'DETERMINISTIC',
  }
}

function parseAssessmentFindingsJson(text: string): AssessmentFindingSuggestion[] {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return []

  try {
    const parsed = JSON.parse(jsonText) as { findings?: unknown[] }
    return asArray(parsed.findings)
      .map((item) => getRecord(item))
      .map((item) => ({
        id: asString(item.id) ?? `FINDING:${asString(item.controlId) ?? 'UNKNOWN'}`,
        controlId: asString(item.controlId) ?? '',
        description: asString(item.description) ?? '',
        severity: normalizeSeverity(asString(item.severity)),
        status: asString(item.status) === 'IN_REMEDIATION' ? 'IN_REMEDIATION' as const : 'OPEN' as const,
        evidence: asString(item.evidence) ?? '',
        recommendation: asString(item.recommendation) ?? '',
        rationale: asString(item.rationale) ?? '',
        confidenceScore: Number(item.confidenceScore) || 76,
        source: 'AI' as const,
      }))
      .filter((item) => item.controlId && item.description)
  } catch {
    return []
  }
}

function mergeAssessmentFindings(base: AssessmentFindingSuggestion[], refined: AssessmentFindingSuggestion[]) {
  const refinedByControl = new Map(refined.map((item) => [item.controlId, item]))
  return base.map((item) => {
    const update = refinedByControl.get(item.controlId)
    return update
      ? {
          ...item,
          ...update,
          id: item.id,
          controlId: item.controlId,
          source: 'AI' as const,
          confidenceScore: Math.max(item.confidenceScore, Math.min(95, update.confidenceScore || item.confidenceScore)),
        }
      : item
  })
}

function buildCitations(input: {
  bestPractices?: BestPracticeEntry[]
  chunks?: DocumentChunk[]
  controls?: RagControl[]
}): AiCitation[] {
  const citations: AiCitation[] = []
  const seen = new Set<string>()
  const add = (citation: AiCitation) => {
    const key = `${citation.sourceType}:${citation.label}:${citation.controlId ?? ''}:${citation.docId ?? ''}:${citation.section ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    citations.push(citation)
  }

  for (const entry of input.bestPractices ?? []) {
    add({
      label: `[Best Practice ${entry.controlId}]`,
      sourceType: 'BEST_PRACTICE',
      controlId: entry.controlId,
      sectionTitle: entry.title,
    })
  }

  for (const chunk of input.chunks ?? []) {
    const label = formatChunkCitation(chunk)
    add({
      label,
      sourceType: 'RAG_CHUNK',
      docId: chunk.metadata.docId,
      docTitle: chunk.metadata.docTitle,
      section: chunk.metadata.section,
      sectionTitle: chunk.metadata.sectionTitle,
    })
  }

  for (const control of input.controls ?? []) {
    add({
      label: `[Control ${control.controlId}]`,
      sourceType: 'CONTROL_CATALOG',
      controlId: control.controlId,
      sectionTitle: control.title,
    })
  }

  return citations.slice(0, 12)
}

function formatChunkCitation(chunk: DocumentChunk): string {
  const docTitle = chunk.metadata.docTitle || chunk.metadata.docId
  const section = chunk.metadata.section
  const normalizedDoc =
    /jsig/i.test(docTitle) ? 'JSIG'
    : /8500/.test(docTitle) ? 'DoDI 8500.01'
    : /8510/.test(docTitle) ? 'DoDI 8510.01'
    : /daapm|daag|dcsa/i.test(docTitle) ? 'DCSA DAAG/DAAPM'
    : docTitle
  return section ? `[${normalizedDoc} §${section}]` : `[${normalizedDoc}]`
}

function formatCitationLabels(citations: AiCitation[]) {
  return citations.map((citation) => citation.label).join(' ')
}

function scoreOutputQuality(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return 0

  let score = 0
  const wordCount = normalized.split(/\s+/).length
  if (wordCount >= 80) score += 8
  if (wordCount >= 150) score += 6
  if (/[.!?]$/.test(normalized)) score += 4
  if (/\b(responsib|evidence|review|monitor|authorization|risk|implementation|control|boundary)\b/i.test(normalized)) score += 8
  if (/\b(shall|must|will|is responsible for|are responsible for)\b/i.test(normalized)) score += 5
  if (!/\b(lorem ipsum|as an ai|i cannot|i'm unable|placeholder|tbd)\b/i.test(normalized)) score += 8
  if (!/```|<[^>]+>/.test(normalized)) score += 4
  if (normalized.length > 9000) score -= 5
  return Math.max(0, Math.min(40, score))
}

function scoreGenerationReliability(input: {
  bestPracticeCount: number
  chunkCount: number
  jsigRelevant: boolean
  text: string
  fallback: boolean
  base?: number
}) {
  let score = input.base ?? 58
  if (input.bestPracticeCount > 0) score += Math.min(18, 8 + input.bestPracticeCount * 3)
  if (input.chunkCount > 0) score += Math.min(16, 6 + input.chunkCount * 2)
  if (input.jsigRelevant) score += 6
  score += Math.round(scoreOutputQuality(input.text) * 0.45)
  if (input.fallback) score -= input.bestPracticeCount || input.chunkCount ? 8 : 18
  if (!input.text || input.text.length < 250) score -= 12
  return Math.max(0, Math.min(100, Math.round(score)))
}

function authorizeToProjectContext(ctx: AuthorizeProjectContext): ProjectAiContext {
  return {
    id: ctx.id,
    name: ctx.name,
    description: ctx.description,
    impactLevel: ctx.impactLevel,
    authBoundary: ctx.authBoundary,
    roleSummary: ctx.roleSummary,
    riskTolerance: ctx.riskTolerance,
    organizationalContext: ctx.organizationalContext,
    informationTypes: ctx.informationTypes.map((name) => ({ name })),
    impactJustification: ctx.impactJustification,
    confirmedImpactLevel: ctx.confirmedImpactLevel,
    jsigOverlay: ctx.jsigOverlay,
  }
}

function formatDocumentMode(mode: AiDocumentMode) {
  switch (mode) {
    case 'POLICY':
      return 'policy'
    case 'PROCEDURE':
      return 'procedure'
    case 'RISK_ACCEPTANCE_LETTER':
      return 'risk acceptance letter'
    case 'MONITORING_REPORT':
      return 'monitoring report'
  }
}

function defaultFormalDocumentTitle(mode: AiDocumentMode, topic?: string) {
  const subject = topic?.trim()
  switch (mode) {
    case 'POLICY':
      return subject ? `${subject} Policy` : 'RMF Security Policy'
    case 'PROCEDURE':
      return subject ? `${subject} Procedure` : 'RMF Security Procedure'
    case 'RISK_ACCEPTANCE_LETTER':
      return subject ? `${subject} Risk Acceptance Letter` : 'Risk Acceptance Letter'
    case 'MONITORING_REPORT':
      return subject ? `${subject} Monitoring Report` : 'Continuous Monitoring Report'
  }
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())))
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function cleanModelText(value?: string) {
  return value
    ?.replace(/^["'`\s]+|["'`\s]+$/g, '')
    .replace(/^(final response|implementation statement|control explanation):\s*/i, '')
    .trim()
}

function truncate(value: string, maxLength = 2000) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

function buildFallbackCore(
  control: RagControl,
  systemRef: string,
  owner: string,
  impactLabel: string,
  inherited: boolean,
  inheritedFrom: string | undefined,
  evidence: string,
): string {
  if (inherited && inheritedFrom) {
    return (
      `${systemRef} satisfies ${control.controlId} (${control.title}) through a documented inheritance relationship with ${inheritedFrom}, which serves as the designated common control provider for this capability. ` +
      `${owner} is responsible for verifying that the inherited control continues to satisfy the stated intent, maintaining the inheritance agreement within the System Security Plan, and reviewing provider-supplied evidence artifacts on an organization-defined schedule during each continuous monitoring cycle. ` +
      `Evidence supporting this inheritance arrangement includes a current provider attestation or control summary, the formal inheritance agreement or memorandum of understanding, and periodic validation records demonstrating ongoing provider compliance with applicable requirements.`
    )
  }

  const bp = control.bestPracticeStatement ? ` ${control.bestPracticeStatement}` : ''

  switch (control.family) {
    case 'AC':
      return (
        `${systemRef} enforces ${control.controlId} (${control.title}) through documented access control policies, role-based account provisioning procedures, and periodic access reviews conducted by ${owner} at organization-defined intervals consistent with the ${impactLabel} impact baseline.${bp} ` +
        `Account rights are established on the basis of least privilege and verified through recurring access reviews to ensure that individuals retain only the permissions required by their current duties, with access revoked upon role change or separation. ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'AT':
      return (
        `${systemRef} implements ${control.controlId} (${control.title}) through a structured security awareness and training program administered by ${owner} that provides role-based instruction commensurate with each user's responsibilities and system access level within the ${impactLabel} impact environment.${bp} ` +
        `Training content is reviewed and updated at organization-defined intervals to reflect changes in threats, system functionality, and applicable policy, and completion is tracked and documented for all individuals requiring system access. ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'AU':
      return (
        `${systemRef} implements ${control.controlId} (${control.title}) by generating, protecting, and reviewing audit records across all components within the defined authorization boundary in accordance with the ${impactLabel} impact requirements. ` +
        `${owner} is responsible for configuring audit log sources, maintaining log integrity and retention consistent with organizational policy, and conducting reviews at organization-defined intervals to identify anomalous activity warranting further investigation.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'CA':
      return (
        `${systemRef} satisfies ${control.controlId} (${control.title}) through a structured assessment and authorization program managed by ${owner} in coordination with the designated Security Control Assessor. ` +
        `Assessment activities are executed using organization-defined procedures to evaluate control effectiveness, with findings documented in a Security Assessment Report and unresolved deficiencies tracked through the Plan of Action and Milestones process.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'CM':
      return (
        `${systemRef} addresses ${control.controlId} (${control.title}) through a configuration management program under the authority of ${owner} that establishes and maintains approved baseline configurations, governs the change approval process, and monitors for unauthorized configuration drift within the ${impactLabel} impact environment. ` +
        `All configuration changes are subject to an organization-defined review and approval workflow prior to implementation, and compliance with the established baseline is verified through periodic configuration scans and reconciliation activities.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'CP':
      return (
        `${systemRef} implements ${control.controlId} (${control.title}) through an established contingency planning program that defines recovery time and recovery point objectives, backup procedures, and alternate processing capabilities commensurate with the ${impactLabel} impact classification. ` +
        `${owner} is responsible for maintaining the contingency plan, executing backup operations on an organization-defined schedule, and conducting periodic recovery tests to validate that the system can be restored within required timeframes and that backup media remains accessible and current.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'IA':
      return (
        `${systemRef} enforces ${control.controlId} (${control.title}) through documented identification and authentication policies, organization-approved authenticator management procedures, and technical controls that prevent access by unauthenticated or unauthorized entities in accordance with the ${impactLabel} impact baseline. ` +
        `${owner} is responsible for managing the full authenticator lifecycle — including issuance, strength enforcement, revocation, and periodic reassessment — and for reviewing authentication configurations at organization-defined intervals to confirm continued alignment with policy.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'IR':
      return (
        `${systemRef} implements ${control.controlId} (${control.title}) through a documented incident response capability that establishes roles, responsibilities, detection procedures, escalation paths, and reporting obligations appropriate to the ${impactLabel} impact environment. ` +
        `${owner} is responsible for maintaining the incident response plan, conducting organization-defined training and exercise activities, and ensuring that incident reporting to oversight and oversight authorities is completed within required timeframes.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'MA':
      return (
        `${systemRef} addresses ${control.controlId} (${control.title}) through documented maintenance policies and procedures that govern the scheduling and approval of maintenance activities, authorization of maintenance personnel, and control of remote maintenance sessions within the authorization boundary. ` +
        `${owner} is responsible for authorizing maintenance requests, maintaining maintenance records, and ensuring that maintenance tools and removable media are inspected and controlled in accordance with organizational security policy before and after use.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'MP':
      return (
        `${systemRef} implements ${control.controlId} (${control.title}) through documented media protection procedures that govern the marking, handling, storage, transport, and sanitization of system media containing information classified at the ${impactLabel} impact level. ` +
        `${owner} is responsible for ensuring that media protection controls are applied throughout the media lifecycle — from initial marking through final sanitization or destruction — using NIST-approved methods and maintaining chain-of-custody records where required.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'PE':
      return (
        `${systemRef} satisfies ${control.controlId} (${control.title}) through physical and environmental protection controls that govern authorized entry to facilities housing system components, visitor management, and environmental monitoring sufficient for the ${impactLabel} impact level. ` +
        `${owner} is responsible for maintaining physical access authorization lists, reviewing and revalidating access at organization-defined intervals, and ensuring that environmental controls — including temperature, humidity, and power — meet the operational requirements of the system.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'PL':
      return (
        `${systemRef} addresses ${control.controlId} (${control.title}) through formally documented security and privacy planning artifacts — including the System Security Plan and Rules of Behavior — maintained by ${owner} and reviewed at organization-defined intervals to reflect changes in system functionality, boundary, or operating environment.${bp} ` +
        `These documents describe the authorization boundary, information types processed, implemented controls, and the responsibilities of all personnel with system access, providing the Authorizing Official with a current and accurate representation of the system's security posture. ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'PS':
      return (
        `${systemRef} implements ${control.controlId} (${control.title}) through personnel security procedures that establish position risk designations, screening requirements, access agreement obligations, and formal termination or transfer processes for individuals within the authorization boundary. ` +
        `${owner} is responsible for coordinating with human resources and security management to ensure that individuals are appropriately screened prior to being granted system access, that access agreements are executed and maintained on file, and that access is promptly revoked upon separation or reassignment.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'PT':
      return (
        `${systemRef} addresses ${control.controlId} (${control.title}) through documented privacy program activities that ensure personally identifiable information is collected, processed, and maintained in accordance with applicable legal authority and organizational privacy policy. ` +
        `${owner} is responsible for maintaining privacy notices, documenting the authority and purpose for PII collection, and ensuring that privacy risk assessments are conducted and documented where the system processes information subject to privacy requirements.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'RA':
      return (
        `${systemRef} satisfies ${control.controlId} (${control.title}) through a structured risk assessment program managed by ${owner} that identifies and evaluates threats, vulnerabilities, and likelihood of exploitation relevant to the ${impactLabel} impact system. ` +
        `Risk assessments are conducted at organization-defined intervals and following significant changes to the system environment, with findings documented in the organizational risk register and used to inform control selection, baseline tailoring, and residual risk acceptance decisions presented to the Authorizing Official.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'SA':
      return (
        `${systemRef} addresses ${control.controlId} (${control.title}) through system and services acquisition controls that incorporate security and privacy requirements into procurement processes, developer and supplier oversight activities, and external service agreements applicable to the authorization boundary. ` +
        `${owner} is responsible for ensuring that contract and acquisition documentation includes applicable security requirements, that external providers are assessed for compliance with organizational standards, and that supply chain risk considerations are documented prior to component integration.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'SC':
      return (
        `${systemRef} enforces ${control.controlId} (${control.title}) through technical system and communications protection controls governing boundary protection, data-in-transit encryption, and logical segmentation of system components in accordance with the ${impactLabel} impact baseline. ` +
        `${owner} is responsible for maintaining network boundary configurations and firewall rule sets, reviewing access control lists at organization-defined intervals, and ensuring that cryptographic mechanisms meet applicable strength and algorithm requirements.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'SI':
      return (
        `${systemRef} implements ${control.controlId} (${control.title}) through system and information integrity controls governing flaw remediation, malicious code protection, security alerting, and information accuracy within the authorization boundary commensurate with the ${impactLabel} impact baseline. ` +
        `${owner} is responsible for managing patch deployment within organization-defined timeframes, maintaining malicious code detection capabilities with current signatures, and reviewing system alerts at defined intervals to detect, analyze, and respond to integrity violations.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    case 'SR':
      return (
        `${systemRef} addresses ${control.controlId} (${control.title}) through a supply chain risk management program that establishes procedures for assessing, selecting, and monitoring suppliers and system components integrated within the authorization boundary. ` +
        `${owner} is responsible for maintaining supply chain risk documentation, conducting supplier assessments at organization-defined intervals, and verifying the provenance and authenticity of critical components prior to deployment or integration into the production environment.${bp} ` +
        `Evidence supporting this control includes ${evidence}.`
      )
    default:
      return (
        `${systemRef} implements ${control.controlId} (${control.title}) through documented organizational procedures, approved technical configurations, and clearly assigned operational responsibilities consistent with the ${impactLabel} impact baseline. ` +
        `${owner} is responsible for establishing, maintaining, and periodically reviewing implementation activities within the defined authorization boundary to ensure ongoing alignment with the intent of this control and the organization's risk tolerance.${bp} ` +
        `Evidence supporting implementation includes ${evidence}.`
      )
  }
}
