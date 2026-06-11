import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Minimal 800-53 Rev 5 seed — expand with full JSON import in Sprint 4
const controls = [
  { controlId: 'AC-1',  family: 'AC', title: 'Policy and Procedures',              lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Develop, document, and disseminate access control policy and procedures.' },
  { controlId: 'AC-2',  family: 'AC', title: 'Account Management',                  lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Manage information system accounts.' },
  { controlId: 'AC-3',  family: 'AC', title: 'Access Enforcement',                  lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Enforce approved authorizations for logical access.' },
  { controlId: 'AC-4',  family: 'AC', title: 'Information Flow Enforcement',         lowBaseline: false, modBaseline: true,  highBaseline: true,  description: 'Enforce approved authorizations for controlling information flows.' },
  { controlId: 'AC-17', family: 'AC', title: 'Remote Access',                        lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Establish and document usage restrictions for remote access.' },
  { controlId: 'AU-2',  family: 'AU', title: 'Event Logging',                        lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Identify the types of events that the system is capable of logging.' },
  { controlId: 'AU-3',  family: 'AU', title: 'Content of Audit Records',             lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Ensure audit records contain sufficient information.' },
  { controlId: 'CA-2',  family: 'CA', title: 'Control Assessments',                  lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Conduct assessments of security and privacy controls.' },
  { controlId: 'CA-5',  family: 'CA', title: 'Plan of Action and Milestones',        lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Develop a POA&M for the system.' },
  { controlId: 'CA-6',  family: 'CA', title: 'Authorization',                        lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Assign a senior official as AO for the system.' },
  { controlId: 'CM-2',  family: 'CM', title: 'Baseline Configuration',               lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Develop and maintain a current baseline configuration.' },
  { controlId: 'IA-2',  family: 'IA', title: 'Identification and Authentication',    lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Uniquely identify and authenticate organizational users.' },
  { controlId: 'IA-5',  family: 'IA', title: 'Authenticator Management',             lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Manage information system authenticators.' },
  { controlId: 'IR-4',  family: 'IR', title: 'Incident Handling',                    lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Implement an incident handling capability.' },
  { controlId: 'PL-2',  family: 'PL', title: 'System Security and Privacy Plans',    lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Develop, document, and distribute a system security plan.' },
  { controlId: 'RA-3',  family: 'RA', title: 'Risk Assessment',                      lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Conduct a risk assessment.' },
  { controlId: 'RA-5',  family: 'RA', title: 'Vulnerability Monitoring and Scanning', lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Monitor and scan for vulnerabilities.' },
  { controlId: 'SC-7',  family: 'SC', title: 'Boundary Protection',                  lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Monitor and control communications at the external boundary.' },
  { controlId: 'SC-28', family: 'SC', title: 'Protection of Information at Rest',    lowBaseline: false, modBaseline: true,  highBaseline: true,  description: 'Protect the confidentiality and integrity of information at rest.' },
  { controlId: 'SI-2',  family: 'SI', title: 'Flaw Remediation',                     lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Identify, report, and correct system flaws.' },
  { controlId: 'SI-3',  family: 'SI', title: 'Malicious Code Protection',            lowBaseline: true,  modBaseline: true,  highBaseline: true,  description: 'Implement malicious code protection mechanisms.' },
]

async function main() {
  console.log('[SEED] Seeding 800-53 control library...')
  for (const control of controls) {
    await prisma.control.upsert({
      where: { controlId: control.controlId },
      update: control,
      create: control,
    })
  }
  console.log(`[SEED] ${controls.length} controls seeded.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
