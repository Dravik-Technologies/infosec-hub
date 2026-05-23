'use strict';
const { db } = require('../../../packages/db/src/index');

const TEMPLATE = {
  name: 'DCSA Self-Inspection Handbook for NISP Contractors',
  source: 'DCSA',
  version: '2024',
  description: 'Official DCSA self-inspection checklist based on 32 CFR Part 117 (NISPOM). Use to assess facility compliance before a formal DCSA review.',
};

const SECTIONS = [
  {
    sectionCode: '1', title: 'Procedures', sortOrder: 1,
    items: [
      { itemCode: '1-100', nispomRef: '32 CFR 117.4',     riskCategory: 'Significant', evidenceRequired: true,  controlRef: 'PL-1', sortOrder: 1,
        questionText: 'Has the facility established written security procedures that implement all applicable NISPOM requirements?' },
      { itemCode: '1-101', nispomRef: '32 CFR 117.4(b)',   riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 2,
        questionText: 'Have the written security procedures been reviewed and updated within the past 12 months?' },
      { itemCode: '1-102', nispomRef: '32 CFR 117.4(c)',   riskCategory: 'Minor',       sortOrder: 3,
        questionText: 'Are security procedures readily available to cleared employees?' },
      { itemCode: '1-200', nispomRef: '32 CFR 117.4(d)',   riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 4,
        questionText: 'Does the facility maintain security files and records as required, including clearance documentation and visit records?' },
      { itemCode: '1-201', nispomRef: '32 CFR 117.4(d)',   riskCategory: 'Minor',       sortOrder: 5,
        questionText: 'Are security records retained for the required periods per NISPOM retention schedules?' },
    ],
  },
  {
    sectionCode: '2', title: 'Reporting Requirements', sortOrder: 2,
    items: [
      { itemCode: '2-100', nispomRef: '32 CFR 117.5(a)',   riskCategory: 'Critical',    evidenceRequired: true,  controlRef: 'IR-6', sortOrder: 1,
        questionText: 'Does the facility have established procedures to report adverse information about cleared employees to DCSA within the required timeframe?' },
      { itemCode: '2-101', nispomRef: '32 CFR 117.5(b)',   riskCategory: 'Critical',    sortOrder: 2,
        questionText: 'Are employees briefed on their obligation to report adverse information about themselves and coworkers?' },
      { itemCode: '2-102', nispomRef: '32 CFR 117.5(c)',   riskCategory: 'Critical',    sortOrder: 3,
        questionText: 'Does the facility report actual or suspected unauthorized disclosure of classified information to DCSA and the GCA immediately upon discovery?' },
      { itemCode: '2-103', nispomRef: '32 CFR 117.5(d)',   riskCategory: 'Significant', sortOrder: 4,
        questionText: 'Are suspicious contacts by cleared employees reported to the FSO and, as appropriate, to DCSA?' },
      { itemCode: '2-104', nispomRef: '32 CFR 117.5(e)',   riskCategory: 'Significant', sortOrder: 5,
        questionText: 'Does the facility report changes in ownership, control, or key management personnel to DCSA?' },
    ],
  },
  {
    sectionCode: '3', title: 'Entity Eligibility', sortOrder: 3,
    items: [
      { itemCode: '3-100', nispomRef: '32 CFR 117.7(a)',   riskCategory: 'Critical',    evidenceRequired: true,  sortOrder: 1,
        questionText: "Is the facility's Facility Security Clearance (FCL) current and at the appropriate level for the classified work being performed?" },
      { itemCode: '3-101', nispomRef: '32 CFR 117.7(b)',   riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 2,
        questionText: 'Is an executed DD Form 441 (DoD Security Agreement) on file with DCSA?' },
      { itemCode: '3-102', nispomRef: '32 CFR 117.7(c)',   riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 3,
        questionText: 'Are all Key Management Personnel (KMP) identified and their clearances current?' },
      { itemCode: '3-103', nispomRef: '32 CFR 117.7(d)',   riskCategory: 'Minor',       sortOrder: 4,
        questionText: 'Is the Facility Security Officer (FSO) properly appointed and trained as required by NISPOM?' },
    ],
  },
  {
    sectionCode: '4', title: 'Personnel Eligibility', sortOrder: 4,
    items: [
      { itemCode: '4-100', nispomRef: '32 CFR 117.8(a)',   riskCategory: 'Critical',    sortOrder: 1,
        questionText: 'Does the facility verify that cleared employees have a current and favorable personnel security determination before granting access to classified information?' },
      { itemCode: '4-101', nispomRef: '32 CFR 117.8(b)',   riskCategory: 'Critical',    sortOrder: 2,
        questionText: 'Are need-to-know determinations made before granting access to classified information?' },
      { itemCode: '4-102', nispomRef: '32 CFR 117.8(c)',   riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 3,
        questionText: 'Are personnel clearance records maintained and kept current, including level of clearance and date granted?' },
      { itemCode: '4-103', nispomRef: '32 CFR 117.9',      riskCategory: 'Significant', sortOrder: 4,
        questionText: 'Are employees with expired clearances promptly debriefed and denied further access to classified information?' },
      { itemCode: '4-104', nispomRef: '32 CFR 117.9(b)',   riskCategory: 'Minor',       evidenceRequired: true,  sortOrder: 5,
        questionText: 'Are debriefing records maintained as required?' },
    ],
  },
  {
    sectionCode: '5', title: 'Foreign Ownership, Control, or Influence (FOCI)', sortOrder: 5,
    items: [
      { itemCode: '5-100', nispomRef: '32 CFR 117.10(a)',  riskCategory: 'Critical',    evidenceRequired: true,  sortOrder: 1,
        questionText: 'Has the facility accurately reported all foreign interests as required, including foreign ownership, control, and influence?' },
      { itemCode: '5-101', nispomRef: '32 CFR 117.10(b)',  riskCategory: 'Critical',    evidenceRequired: true,  sortOrder: 2,
        questionText: 'If subject to FOCI, is an approved FOCI mitigation or negation measure (e.g., SSA, PSPA, BoD resolution, proxy agreement) in place?' },
      { itemCode: '5-102', nispomRef: '32 CFR 117.11',     riskCategory: 'Significant', sortOrder: 3,
        questionText: 'Are changes in foreign ownership, financing, or control reported to DCSA within the required timeframe?' },
    ],
  },
  {
    sectionCode: '6', title: 'Security Training and Briefings', sortOrder: 6,
    items: [
      { itemCode: '6-100', nispomRef: '32 CFR 117.12(a)',  riskCategory: 'Critical',    evidenceRequired: true,  controlRef: 'AT-2', sortOrder: 1,
        questionText: 'Are all cleared employees given an initial security briefing before being granted access to classified information?' },
      { itemCode: '6-101', nispomRef: '32 CFR 117.12(b)',  riskCategory: 'Significant', evidenceRequired: true,  controlRef: 'AT-2', sortOrder: 2,
        questionText: 'Do cleared employees receive annual refresher security training?' },
      { itemCode: '6-102', nispomRef: '32 CFR 117.12(c)',  riskCategory: 'Critical',    evidenceRequired: true,  controlRef: 'PM-12', sortOrder: 3,
        questionText: 'Does the facility have an established Insider Threat Program with a designated Insider Threat Program Senior Official (ITPSO)?' },
      { itemCode: '6-103', nispomRef: '32 CFR 117.12(d)',  riskCategory: 'Significant', sortOrder: 4,
        questionText: 'Are employees briefed on insider threat awareness indicators as part of the annual training?' },
      { itemCode: '6-104', nispomRef: '32 CFR 117.12(e)',  riskCategory: 'Minor',       evidenceRequired: true,  sortOrder: 5,
        questionText: 'Are training completion records maintained for all cleared employees?' },
    ],
  },
  {
    sectionCode: '7', title: 'Classification Management', sortOrder: 7,
    items: [
      { itemCode: '7-100', nispomRef: '32 CFR 117.13',     riskCategory: 'Critical',    sortOrder: 1,
        questionText: 'Do employees who derivatively classify information have access to and use approved classification guidance (e.g., classification guides, SCG)?' },
      { itemCode: '7-101', nispomRef: '32 CFR 117.14',     riskCategory: 'Significant', sortOrder: 2,
        questionText: 'Are classified documents properly marked with the applicable classification level, portion markings, and required warnings?' },
      { itemCode: '7-102', nispomRef: '32 CFR 117.15',     riskCategory: 'Significant', sortOrder: 3,
        questionText: 'Are classification decisions reviewed periodically for continued need, with declassification or downgrading applied as appropriate?' },
      { itemCode: '7-103', nispomRef: '32 CFR 117.16',     riskCategory: 'Critical',    sortOrder: 4,
        questionText: 'Are unmarked classified documents or materials promptly identified and correctly marked?' },
    ],
  },
  {
    sectionCode: '8', title: 'Visits and Meetings', sortOrder: 8,
    items: [
      { itemCode: '8-100', nispomRef: '32 CFR 117.17(a)',  riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 1,
        questionText: 'Does the facility have written procedures for controlling and documenting classified visits?' },
      { itemCode: '8-101', nispomRef: '32 CFR 117.17(b)',  riskCategory: 'Critical',    sortOrder: 2,
        questionText: 'Are visitor clearances verified before granting access to classified information during visits?' },
      { itemCode: '8-102', nispomRef: '32 CFR 117.17(c)',  riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 3,
        questionText: 'Are visitor access records maintained as required, including date, purpose, and clearance verification?' },
      { itemCode: '8-103', nispomRef: '32 CFR 117.17(d)',  riskCategory: 'Significant', sortOrder: 4,
        questionText: 'For classified meetings held at the facility, are security requirements (attendee clearances, room approval, controlled access) met?' },
    ],
  },
  {
    sectionCode: '9', title: 'Subcontracting', sortOrder: 9,
    items: [
      { itemCode: '9-100', nispomRef: '32 CFR 117.18(a)',  riskCategory: 'Critical',    evidenceRequired: true,  sortOrder: 1,
        questionText: 'Is a DD Form 254 (Contract Security Classification Specification) issued to subcontractors when classified work is involved?' },
      { itemCode: '9-101', nispomRef: '32 CFR 117.18(b)',  riskCategory: 'Significant', sortOrder: 2,
        questionText: 'Does the facility verify that subcontractors hold an appropriate FCL before releasing classified information?' },
      { itemCode: '9-102', nispomRef: '32 CFR 117.18(c)',  riskCategory: 'Minor',       sortOrder: 3,
        questionText: 'Are DD Forms 254 reviewed and updated when the classification requirements of the subcontract change?' },
    ],
  },
  {
    sectionCode: '10', title: 'Information Systems', sortOrder: 10,
    items: [
      { itemCode: '10-100', nispomRef: '32 CFR 117.19(a)', riskCategory: 'Critical',    evidenceRequired: true,  controlRef: 'CA-6', sortOrder: 1,
        questionText: 'Are all information systems (IS) that process classified information accredited/authorized before use?' },
      { itemCode: '10-101', nispomRef: '32 CFR 117.19(b)', riskCategory: 'Critical',    sortOrder: 2,
        questionText: 'Is an ISSM/ISSO designated for each authorized IS processing classified information?' },
      { itemCode: '10-102', nispomRef: '32 CFR 117.19(c)', riskCategory: 'Significant', evidenceRequired: true,  controlRef: 'PL-4', sortOrder: 3,
        questionText: 'Do users of IS processing classified information complete a user agreement prior to access?' },
      { itemCode: '10-103', nispomRef: '32 CFR 117.19(d)', riskCategory: 'Significant', controlRef: 'SI-3', sortOrder: 4,
        questionText: 'Are technical security controls (e.g., anti-virus, access controls, audit logging) implemented and maintained on authorized IS?' },
      { itemCode: '10-104', nispomRef: '32 CFR 117.19(e)', riskCategory: 'Significant', evidenceRequired: true,  controlRef: 'MP-7', sortOrder: 5,
        questionText: 'Is removable media (e.g., USB drives, optical media) used on classified IS controlled, scanned, and documented per policy?' },
    ],
  },
  {
    sectionCode: '11', title: 'Safeguarding Classified Information', sortOrder: 11,
    items: [
      { itemCode: '11-100', nispomRef: '32 CFR 117.20(a)', riskCategory: 'Critical',    evidenceRequired: true,  sortOrder: 1,
        questionText: 'Are approved storage containers (e.g., GSA-approved safes) used for storing classified information overnight or when unattended?' },
      { itemCode: '11-101', nispomRef: '32 CFR 117.20(b)', riskCategory: 'Critical',    sortOrder: 2,
        questionText: 'Are classified areas (closed areas, restricted areas) constructed, secured, and controlled per NISPOM standards?' },
      { itemCode: '11-102', nispomRef: '32 CFR 117.20(c)', riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 3,
        questionText: 'Are end-of-day security checks performed and documented in classified areas?' },
      { itemCode: '11-103', nispomRef: '32 CFR 117.21',    riskCategory: 'Critical',    sortOrder: 4,
        questionText: 'Is classified information maintained under continuous control or stored appropriately at all times?' },
      { itemCode: '11-104', nispomRef: '32 CFR 117.23',    riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 5,
        questionText: 'For TOP SECRET information: is an inventory performed annually and are receipt/dispatch records maintained?' },
    ],
  },
  {
    sectionCode: '12', title: 'Transmission of Classified Information', sortOrder: 12,
    items: [
      { itemCode: '12-100', nispomRef: '32 CFR 117.24(a)', riskCategory: 'Critical',    sortOrder: 1,
        questionText: 'Is classified information transmitted only through authorized means (e.g., cleared courier, approved classified networks, USPS registered mail for SECRET and below)?' },
      { itemCode: '12-101', nispomRef: '32 CFR 117.24(b)', riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 2,
        questionText: 'Are hand-carry authorizations obtained and documented when employees transport classified information outside the facility?' },
      { itemCode: '12-102', nispomRef: '32 CFR 117.24(c)', riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 3,
        questionText: 'Are transmission records (wrapping, receipt) maintained for classified documents sent outside the facility?' },
    ],
  },
  {
    sectionCode: '13', title: 'Destruction of Classified Information', sortOrder: 13,
    items: [
      { itemCode: '13-100', nispomRef: '32 CFR 117.25(a)', riskCategory: 'Critical',    sortOrder: 1,
        questionText: 'Is classified information destroyed using approved methods (e.g., NSA/CSS-approved shredders, burning, pulping) that prevent reconstruction?' },
      { itemCode: '13-101', nispomRef: '32 CFR 117.25(b)', riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 2,
        questionText: 'Are destruction records maintained for TOP SECRET and other accountable classified information?' },
      { itemCode: '13-102', nispomRef: '32 CFR 117.25(c)', riskCategory: 'Significant', evidenceRequired: true,  sortOrder: 3,
        questionText: 'Are destruction witnesses used for TOP SECRET information as required, with witness signatures on destruction records?' },
      { itemCode: '13-103', nispomRef: '32 CFR 117.25(d)', riskCategory: 'Minor',       sortOrder: 4,
        questionText: 'Is destruction equipment inspected and maintained in proper working condition?' },
    ],
  },
];

async function seed() {
  const existing = await db.checklistTemplate.findFirst({ where: { source: 'DCSA' } });
  if (existing) { console.log('[SEED] DCSA template already exists — skipping'); return; }
  const template = await db.checklistTemplate.create({ data: { ...TEMPLATE } });
  for (const sec of SECTIONS) {
    const { items, ...secData } = sec;
    const section = await db.checklistSection.create({ data: { ...secData, templateId: template.id } });
    for (const item of items) {
      await db.checklistItem.create({ data: { ...item, sectionId: section.id } });
    }
    console.log(`[SEED]   ${sec.sectionCode} · ${sec.title} (${items.length} items)`);
  }
  const total = SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  console.log(`[SEED] Done — ${total} items across ${SECTIONS.length} sections`);
}

seed().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
