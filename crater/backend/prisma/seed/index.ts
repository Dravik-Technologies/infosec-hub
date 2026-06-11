import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') })

const prisma = new PrismaClient()

const OSCAL_BASE_URL =
  'https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json'

const CATALOG_URL = `${OSCAL_BASE_URL}/NIST_SP-800-53_rev5_catalog-min.json`
const BASELINE_URLS = {
  low: `${OSCAL_BASE_URL}/NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog-min.json`,
  mod: `${OSCAL_BASE_URL}/NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json`,
  high: `${OSCAL_BASE_URL}/NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog-min.json`,
} as const

type Baseline = keyof typeof BASELINE_URLS

interface OscalCatalog {
  catalog: OscalNode
}

interface OscalNode {
  groups?: OscalNode[]
  controls?: OscalControl[]
}

interface OscalControl extends OscalNode {
  id: string
  class?: string
  title: string
  props?: Array<{
    name: string
    value: string
    class?: string
  }>
  parts?: OscalPart[]
}

interface OscalPart {
  name?: string
  prose?: string
  parts?: OscalPart[]
}

interface SeedControl {
  controlId: string
  family: string
  title: string
  description: string
  low: boolean
  mod: boolean
  high: boolean
  bestPracticeStatement?: string
  typicalEvidence?: string
}

type InformationType = SeedControl

const commonControlGuidance: Record<string, Pick<SeedControl, 'bestPracticeStatement' | 'typicalEvidence'>> = {
  'AC-2': {
    bestPracticeStatement:
      'Define an account management workflow that covers request, approval, provisioning, periodic review, disabling, and removal for all user, privileged, service, temporary, and emergency accounts. Integrate the workflow with authoritative identity sources and retain auditable evidence of approvals and reviews.',
    typicalEvidence:
      'Account management policy; account request and approval tickets; identity provider exports; privileged account review records; disabled account reports; service account inventory.',
  },
  'AC-3': {
    bestPracticeStatement:
      'Enforce approved access authorizations through technical access controls such as role-based access control, groups, policy rules, and application permissions. Verify that enforcement points align with the system authorization boundary and documented user roles.',
    typicalEvidence:
      'Access control matrix; RBAC group exports; application permission screenshots; configuration baselines; access test results.',
  },
  'AC-6': {
    bestPracticeStatement:
      'Apply least privilege by granting users, services, and administrators only the access required for assigned duties. Separate administrative and non-administrative functions and review privileged access on a defined cadence.',
    typicalEvidence:
      'Least privilege procedure; privileged access inventory; admin group membership exports; access review records; separation-of-duties matrix.',
  },
  'AU-2': {
    bestPracticeStatement:
      'Identify auditable events based on mission risk, threat scenarios, and incident response needs. Configure system components to generate records for approved events and review the event set periodically.',
    typicalEvidence:
      'Audit event selection matrix; logging configuration; SIEM source onboarding records; audit policy; periodic event review minutes.',
  },
  'AU-6': {
    bestPracticeStatement:
      'Review and analyze audit records using manual procedures and automated tooling. Prioritize privileged activity, authentication events, configuration changes, anomalous behavior, and alerts tied to incident response playbooks.',
    typicalEvidence:
      'SIEM dashboards; audit review SOP; alert triage tickets; weekly or monthly review logs; incident correlation reports.',
  },
  'CA-7': {
    bestPracticeStatement:
      'Maintain continuous monitoring through recurring control assessments, vulnerability monitoring, configuration checks, POA&M updates, and risk reporting to the authorizing official.',
    typicalEvidence:
      'Continuous monitoring strategy; assessment schedule; vulnerability scan reports; POA&M exports; risk briefing slides; control assessment results.',
  },
  'CM-2': {
    bestPracticeStatement:
      'Establish and maintain approved baseline configurations for system components. Track versions, owners, approval dates, and deviations, and update baselines after authorized changes.',
    typicalEvidence:
      'Configuration baseline documents; golden image records; infrastructure-as-code repositories; change approval tickets; configuration drift reports.',
  },
  'CM-6': {
    bestPracticeStatement:
      'Define secure configuration settings using approved benchmarks and organizational standards. Monitor deployed settings for drift and remediate unauthorized deviations through change management.',
    typicalEvidence:
      'STIG or CIS checklist results; configuration management exports; endpoint compliance reports; exception register; remediation tickets.',
  },
  'CP-9': {
    bestPracticeStatement:
      'Perform system backups at an approved frequency, protect backup confidentiality and integrity, and periodically test restoration to verify recoverability within mission requirements.',
    typicalEvidence:
      'Backup policy; backup job logs; restore test results; encryption configuration; offsite or immutable storage records.',
  },
  'IA-2': {
    bestPracticeStatement:
      'Uniquely identify and authenticate organizational users before granting system access. Use phishing-resistant or multi-factor authentication for privileged and remote access where required by the baseline.',
    typicalEvidence:
      'Identity provider configuration; MFA policy screenshots; authentication logs; account inventory; privileged access reports.',
  },
  'IA-5': {
    bestPracticeStatement:
      'Manage authenticators throughout their lifecycle, including issuance, protection, reset, revocation, rotation, and compromise response. Enforce organizational password, token, certificate, or key requirements consistently.',
    typicalEvidence:
      'Authenticator management SOP; password policy; certificate inventory; MFA token issuance logs; reset tickets; revocation records.',
  },
  'IR-4': {
    bestPracticeStatement:
      'Implement an incident handling process that covers preparation, detection, analysis, containment, eradication, recovery, and lessons learned. Align escalation paths with mission impact and reporting requirements.',
    typicalEvidence:
      'Incident response plan; incident tickets; tabletop exercise results; containment playbooks; after-action reports; notification records.',
  },
  'PL-2': {
    bestPracticeStatement:
      'Maintain an SSP that accurately describes the system boundary, environment of operation, security categorization, implemented controls, inherited controls, and authorization status.',
    typicalEvidence:
      'Current SSP; architecture diagrams; authorization boundary description; control implementation statements; approval history.',
  },
  'RA-3': {
    bestPracticeStatement:
      'Conduct risk assessments that consider threats, vulnerabilities, likelihood, impact, mission context, inherited risk, and planned mitigations. Update the assessment when major changes or new threats emerge.',
    typicalEvidence:
      'Risk assessment report; threat model; risk register; likelihood and impact scoring; mitigation plans; AO risk acceptance records.',
  },
  'RA-5': {
    bestPracticeStatement:
      'Scan systems and applications for vulnerabilities at an approved frequency, prioritize findings by risk, track remediation, and report residual exposure through continuous monitoring and POA&M processes.',
    typicalEvidence:
      'Vulnerability scan reports; authenticated scan configuration; remediation tickets; false-positive approvals; POA&M entries; trend reports.',
  },
  'SA-9': {
    bestPracticeStatement:
      'Manage external system services through documented agreements that define security roles, responsibilities, controls, data handling, monitoring expectations, and incident reporting requirements.',
    typicalEvidence:
      'Service agreement; SLA or MOU; cloud shared responsibility matrix; provider assessment; FedRAMP package references; monitoring reports.',
  },
  'SC-7': {
    bestPracticeStatement:
      'Protect system boundaries with managed interfaces, deny-by-default traffic rules, segmentation, monitoring, and documented connections. Review boundary rules and connection authorizations on a defined cadence.',
    typicalEvidence:
      'Network diagrams; firewall rules; security group exports; interconnection agreements; boundary device configuration; rule review records.',
  },
  'SC-13': {
    bestPracticeStatement:
      'Use approved cryptographic mechanisms to protect confidentiality and integrity in accordance with federal and organizational requirements. Track cryptographic modules, protocols, certificates, and key management practices.',
    typicalEvidence:
      'TLS configuration scans; FIPS validation references; certificate inventory; key management procedure; encryption configuration screenshots.',
  },
  'SI-2': {
    bestPracticeStatement:
      'Identify, report, and remediate software and firmware flaws within organizational timelines based on severity and mission risk. Track exceptions and compensating controls when remediation cannot occur immediately.',
    typicalEvidence:
      'Patch management policy; vulnerability remediation tickets; patch compliance reports; exception approvals; maintenance windows.',
  },
  'SI-3': {
    bestPracticeStatement:
      'Deploy malicious code protection at relevant endpoints, servers, and gateways. Keep signatures and engines current, monitor detections, and integrate alerts into incident response workflows.',
    typicalEvidence:
      'Endpoint protection policy; console screenshots; signature update logs; detection alerts; quarantine reports; EDR coverage exports.',
  },
  'SI-4': {
    bestPracticeStatement:
      'Monitor systems and networks to detect attacks, indicators of compromise, unauthorized activity, and operational anomalies. Correlate monitoring sources and route alerts to defined response processes.',
    typicalEvidence:
      'SIEM architecture; sensor inventory; alert rules; monitoring dashboards; investigation tickets; incident escalation records.',
  },
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

function collectControls(node: OscalNode, controls: OscalControl[] = []) {
  for (const control of node.controls ?? []) {
    controls.push(control)
    collectControls(control, controls)
  }

  for (const group of node.groups ?? []) {
    collectControls(group, controls)
  }

  return controls
}

function isWithdrawn(control: OscalControl) {
  return control.props?.some((prop) => prop.name === 'status' && prop.value === 'withdrawn') ?? false
}

function getControlLabel(control: OscalControl) {
  const label = control.props?.find((prop) => prop.name === 'label' && prop.class === undefined)?.value
  return label ?? control.id.toUpperCase()
}

function getFamily(controlId: string) {
  return controlId.split('-')[0]?.toUpperCase() ?? 'UNKNOWN'
}

function collectPartText(parts: OscalPart[] | undefined, preferredName?: string): string {
  const chunks: string[] = []

  function visit(part: OscalPart) {
    if (!preferredName || part.name === preferredName) {
      if (part.prose) chunks.push(part.prose)
      for (const child of part.parts ?? []) visit(child)
      return
    }

    for (const child of part.parts ?? []) visit(child)
  }

  for (const part of parts ?? []) visit(part)

  return chunks
    .join(' ')
    .replace(/\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}/g, '[$1]')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value: string, maxLength = 2000) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

async function loadBaselineIds(): Promise<Record<Baseline, Set<string>>> {
  const entries = await Promise.all(
    Object.entries(BASELINE_URLS).map(async ([baseline, url]) => {
      const catalog = await fetchJson<OscalCatalog>(url)
      const ids = new Set(
        collectControls(catalog.catalog)
          .filter((control) => !isWithdrawn(control))
          .map(getControlLabel),
      )

      return [baseline, ids] as const
    }),
  )

  return Object.fromEntries(entries) as Record<Baseline, Set<string>>
}

async function loadNistControls(): Promise<SeedControl[]> {
  const [catalog, baselines] = await Promise.all([
    fetchJson<OscalCatalog>(CATALOG_URL),
    loadBaselineIds(),
  ])
  const controls = collectControls(catalog.catalog).filter((control) => !isWithdrawn(control))

  return controls.map((control) => {
    const controlId = getControlLabel(control)
    const statement = collectPartText(control.parts, 'statement')
    const guidance = collectPartText(control.parts, 'guidance')
    const description = truncate(statement || guidance || `${control.title} - NIST SP 800-53 Rev. 5, ${controlId}`)

    return {
      controlId,
      family: getFamily(controlId),
      title: control.title,
      description,
      low: baselines.low.has(controlId),
      mod: baselines.mod.has(controlId),
      high: baselines.high.has(controlId),
      ...commonControlGuidance[controlId],
    }
  })
}

const informationTypes: InformationType[] = [
  { controlId: 'c.2.1.1', family: 'Management and Support', title: 'Controls and Oversight', description: 'NIST SP 800-60 information type.', low: true, mod: true, high: false },
  { controlId: 'c.2.2.1', family: 'Management and Support', title: 'Regulatory Compliance', description: 'NIST SP 800-60 information type.', low: false, mod: true, high: true },
  { controlId: 'c.3.1.1', family: 'Financial Management', title: 'Budget Formulation and Execution', description: 'NIST SP 800-60 information type.', low: false, mod: true, high: true },
  { controlId: 'c.3.2.1', family: 'Human Resources', title: 'Personnel Management', description: 'NIST SP 800-60 information type.', low: false, mod: true, high: true },
  { controlId: 'hc.1.1', family: 'Healthcare', title: 'Patient Care Services', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'hc.1.2', family: 'Healthcare', title: 'Medical Records and EHR', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'hc.1.3', family: 'Healthcare', title: 'Pharmacy and Medication Management', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'hc.2.1', family: 'Healthcare', title: 'Protected Health Information (PHI)', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'hc.3.1', family: 'Healthcare', title: 'Veterans Health Administration Data', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'hc.4.1', family: 'Healthcare', title: 'Military Health System (MHS)', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'd.1.1', family: 'Defense and National Security', title: 'Strategic National and Theater Defense', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'd.1.2', family: 'Defense and National Security', title: 'Operational Defense', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'd.1.3', family: 'Defense and National Security', title: 'Tactical Defense', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'd.3.1', family: 'Intelligence Operations', title: 'Intelligence Planning', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'd.3.2', family: 'Intelligence Operations', title: 'Intelligence Collection', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'd.3.3', family: 'Intelligence Operations', title: 'Intelligence Analysis and Production', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'ns.1.1', family: 'Classified / CUI', title: 'Classified National Security Information', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'cui.1.1', family: 'Classified / CUI', title: 'Controlled Unclassified Information (CUI)', description: 'NIST SP 800-60 information type.', low: false, mod: true, high: true },
  { controlId: 'sap.1.1', family: 'SAP', title: 'Special Access Program Information', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'sci.1.1', family: 'SCI', title: 'Sensitive Compartmented Information (SCI)', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'ns.2.1', family: 'Defense', title: 'Weapons Systems Data', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
  { controlId: 'd.4.1', family: 'Defense', title: 'Homeland Security and Catastrophic Defense', description: 'NIST SP 800-60 information type.', low: false, mod: false, high: true },
]

async function upsertAll(label: string, items: SeedControl[]) {
  for (const item of items) {
    await prisma.control.upsert({
      where: { controlId: item.controlId },
      create: {
        controlId: item.controlId,
        family: item.family,
        title: item.title,
        description: item.description,
        lowBaseline: item.low,
        modBaseline: item.mod,
        highBaseline: item.high,
        bestPracticeStatement: item.bestPracticeStatement,
        typicalEvidence: item.typicalEvidence,
      },
      update: {
        family: item.family,
        title: item.title,
        description: item.description,
        lowBaseline: item.low,
        modBaseline: item.mod,
        highBaseline: item.high,
        bestPracticeStatement: item.bestPracticeStatement,
        typicalEvidence: item.typicalEvidence,
      },
    })
  }

  console.log(`[seed] ${items.length} ${label} upserted.`)
}

async function pruneStaleControls(activeControlIds: string[]) {
  const result = await prisma.control.deleteMany({
    where: {
      AND: [
        { controlId: { contains: '-' } },
        { controlId: { notIn: activeControlIds } },
      ],
      instances: { none: {} },
    },
  })

  console.log(`[seed] ${result.count} stale control records removed.`)
}

async function main() {
  console.log('[seed] Starting...')
  console.log('[seed] Downloading official NIST OSCAL catalog and baseline profiles...')

  const controls = await loadNistControls()

  await upsertAll('active NIST SP 800-53 Rev. 5 controls and enhancements', controls)
  await pruneStaleControls(controls.map((control) => control.controlId))
  await upsertAll('NIST SP 800-60 information types', informationTypes)

  const low = controls.filter((control) => control.low).length
  const moderate = controls.filter((control) => control.mod).length
  const high = controls.filter((control) => control.high).length

  console.log(`[seed] Baseline coverage: LOW=${low}, MODERATE=${moderate}, HIGH=${high}.`)
  console.log('[seed] Done.')
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
