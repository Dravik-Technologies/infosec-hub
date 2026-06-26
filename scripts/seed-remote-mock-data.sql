BEGIN;

-- Lightweight cross-app mock dataset for the shared Azure PostgreSQL instance.
-- Safe to rerun: deterministic IDs + ON CONFLICT upserts keep this idempotent.

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
),
tenant_upsert AS (
  INSERT INTO tenants (id, name, slug, control_model, created_at, updated_at)
  VALUES ('tenant-mtsi', 'MTSI', 'mtsi', 'hybrid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        control_model = EXCLUDED.control_model,
        updated_at = CURRENT_TIMESTAMP
  RETURNING id
)
UPDATE sites s
SET tenant_id = 'tenant-mtsi',
    updated_at = CURRENT_TIMESTAMP
FROM site_seed seed
WHERE s.id = seed.site_id;

INSERT INTO control_catalog (
  id, tenant_id, control_key, title, family, baseline, description, source,
  implementation_default, owner_type, owner_site_id, is_template, is_active, version,
  created_at, updated_at
)
VALUES
  (
    'mock-ctrl-ac-1',
    'tenant-mtsi',
    'AC-1',
    'Access Control Policy and Procedures',
    'Access Control',
    'Moderate',
    'Baseline HQ control template for access control governance.',
    'NIST SP 800-53 Rev 5',
    'Site implements local access control procedures and annual review cadence.',
    'enterprise',
    NULL,
    TRUE,
    TRUE,
    '1.0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'mock-ctrl-pe-3',
    'tenant-mtsi',
    'PE-3',
    'Physical Access Control',
    'Physical and Environmental Protection',
    'Moderate',
    'Baseline HQ control template for facility entry and escort management.',
    'NIST SP 800-53 Rev 5',
    'Site verifies badges, escorts, visitor logs, and alarm response procedures.',
    'enterprise',
    NULL,
    TRUE,
    TRUE,
    '1.0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT (id) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    title = EXCLUDED.title,
    family = EXCLUDED.family,
    baseline = EXCLUDED.baseline,
    description = EXCLUDED.description,
    source = EXCLUDED.source,
    implementation_default = EXCLUDED.implementation_default,
    owner_type = EXCLUDED.owner_type,
    owner_site_id = EXCLUDED.owner_site_id,
    is_template = EXCLUDED.is_template,
    is_active = EXCLUDED.is_active,
    version = EXCLUDED.version,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
),
control_seed(control_id, status, findings, conmon_group) AS (
  VALUES
    ('mock-ctrl-ac-1', 'Implemented', 0, 'Access Governance'),
    ('mock-ctrl-pe-3', 'Partially Implemented', 1, 'Physical Security')
)
INSERT INTO site_control_implementations (
  id, tenant_id, site_id, control_catalog_id, status, last_review, findings, notes,
  implementation_guidance, conmon_status, conmon_group, conmon_frequency, assigned_to,
  evidence_summary, created_at, updated_at
)
SELECT
  'mock-impl-' || lower(replace(control_seed.control_id, 'mock-ctrl-', '')) || '-' || lower(site_seed.site_id),
  'tenant-mtsi',
  site_seed.site_id,
  control_seed.control_id,
  control_seed.status,
  '2026-06-15',
  control_seed.findings,
  site_seed.site_short || ' implementation baseline seeded for demo use.',
  'Use local procedures and annual inspection evidence for this site.',
  CASE WHEN control_seed.status = 'Implemented' THEN 'Healthy' ELSE 'Watch' END,
  control_seed.conmon_group,
  'Monthly',
  'Security Team',
  'Badge roster, annual review memo, and local SOP references.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
CROSS JOIN control_seed
ON CONFLICT (id) DO UPDATE
SET status = EXCLUDED.status,
    last_review = EXCLUDED.last_review,
    findings = EXCLUDED.findings,
    notes = EXCLUDED.notes,
    implementation_guidance = EXCLUDED.implementation_guidance,
    conmon_status = EXCLUDED.conmon_status,
    conmon_group = EXCLUDED.conmon_group,
    conmon_frequency = EXCLUDED.conmon_frequency,
    assigned_to = EXCLUDED.assigned_to,
    evidence_summary = EXCLUDED.evidence_summary,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO ato_packages (
  id, system, category, status, issued, expires, ao, controls, open_findings, site_id, created_at, updated_at
)
SELECT
  'mock-ato-' || lower(site_id),
  site_short || ' Mission System',
  'Category Four',
  ato_status,
  '2026-01-15',
  CASE
    WHEN ato_status = 'Expired' THEN '2026-05-15'
    ELSE '2027-01-15'
  END,
  'AO-' || site_short,
  142,
  CASE WHEN ato_status IN ('Denied', 'Expired') THEN 5 ELSE 2 END,
  site_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET system = EXCLUDED.system,
    category = EXCLUDED.category,
    status = EXCLUDED.status,
    issued = EXCLUDED.issued,
    expires = EXCLUDED.expires,
    ao = EXCLUDED.ao,
    controls = EXCLUDED.controls,
    open_findings = EXCLUDED.open_findings,
    site_id = EXCLUDED.site_id,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO poams (
  id, title, control_id, weakness, severity, status, site_id, source_type, source_id, responsible_party,
  point_of_contact, resources, scheduled_completion, identified_date, ato_id, poam_type, comments,
  created_at, updated_at, risk_decision, risk_rationale, risk_workflow_state
)
SELECT
  'mock-poam-' || lower(site_id),
  site_short || ' Access Control Remediation',
  'PE-3',
  'Visitor escort log review requires formal monthly reconciliation.',
  poam_severity,
  'Open',
  site_id,
  'ATO',
  'mock-ato-' || lower(site_id),
  'Security Manager',
  'ISSO',
  'Local guard force and badge office',
  '2026-09-30',
  '2026-06-01',
  'mock-ato-' || lower(site_id),
  'Operational',
  'Seeded demo POA&M item for dashboard visibility.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'Mitigate',
  'Routine corrective action tracked for demo environment.',
  'Submitted'
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    control_id = EXCLUDED.control_id,
    weakness = EXCLUDED.weakness,
    severity = EXCLUDED.severity,
    status = EXCLUDED.status,
    site_id = EXCLUDED.site_id,
    source_type = EXCLUDED.source_type,
    source_id = EXCLUDED.source_id,
    responsible_party = EXCLUDED.responsible_party,
    point_of_contact = EXCLUDED.point_of_contact,
    resources = EXCLUDED.resources,
    scheduled_completion = EXCLUDED.scheduled_completion,
    identified_date = EXCLUDED.identified_date,
    ato_id = EXCLUDED.ato_id,
    poam_type = EXCLUDED.poam_type,
    comments = EXCLUDED.comments,
    risk_decision = EXCLUDED.risk_decision,
    risk_rationale = EXCLUDED.risk_rationale,
    risk_workflow_state = EXCLUDED.risk_workflow_state,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO tasks (
  id, title, site_id, type, status, priority, assignee, due_date, control,
  linked_controls, evidence, created, created_by, notes, source, source_id, created_at, updated_at
)
SELECT
  'mock-task-' || lower(site_id),
  site_short || ' Monthly Control Review',
  site_id,
  'ConMon',
  CASE WHEN ato_status IN ('Denied', 'Expired') THEN 'Open' ELSE 'In Progress' END,
  CASE WHEN poam_severity = 'High' THEN 'High' ELSE 'Medium' END,
  'ISSO',
  '2026-07-15',
  'PE-3',
  ARRAY['PE-3', 'AC-1'],
  'Checklist, review memo, and badge sample evidence.',
  '2026-06-20',
  'admin',
  'Seeded recurring task for monitoring dashboard.',
  'Controls',
  'mock-ctrl-pe-3',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    site_id = EXCLUDED.site_id,
    type = EXCLUDED.type,
    status = EXCLUDED.status,
    priority = EXCLUDED.priority,
    assignee = EXCLUDED.assignee,
    due_date = EXCLUDED.due_date,
    control = EXCLUDED.control,
    linked_controls = EXCLUDED.linked_controls,
    evidence = EXCLUDED.evidence,
    created = EXCLUDED.created,
    created_by = EXCLUDED.created_by,
    notes = EXCLUDED.notes,
    source = EXCLUDED.source,
    source_id = EXCLUDED.source_id,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO security_events (
  id, type, severity, source, asset_id, description, status, site_id, created_at, updated_at
)
SELECT
  'mock-event-' || lower(site_id),
  'IDS Alert',
  CASE WHEN ato_status IN ('Denied', 'Expired') THEN 'High' ELSE 'Medium' END,
  'SentinelOne',
  site_short || '-gateway',
  site_short || ' sensor generated seeded monitoring alert for analyst workflow.',
  CASE WHEN ato_status = 'Authorized' THEN 'Investigating' ELSE 'New' END,
  site_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET type = EXCLUDED.type,
    severity = EXCLUDED.severity,
    source = EXCLUDED.source,
    asset_id = EXCLUDED.asset_id,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    site_id = EXCLUDED.site_id,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO mash_facility_security (
  id, site_id, name, location, facility_type, fcl_level, fcl_status, fcl_expires,
  compliance_score, status, notes, created_by, updated_by, created_at, updated_at
)
SELECT
  'mock-facility-' || lower(site_id),
  site_id,
  site_short || ' Secure Facility',
  site_label,
  'SCIF',
  'Top Secret',
  'Active',
  '2027-03-01',
  CASE WHEN ato_status = 'Authorized' THEN 92 ELSE 78 END,
  'Active',
  'Seeded facility security profile for demo visibility.',
  'admin',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET site_id = EXCLUDED.site_id,
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    facility_type = EXCLUDED.facility_type,
    fcl_level = EXCLUDED.fcl_level,
    fcl_status = EXCLUDED.fcl_status,
    fcl_expires = EXCLUDED.fcl_expires,
    compliance_score = EXCLUDED.compliance_score,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO mash_personnel_security (
  id, site_id, username, name, position, org, clearance_level, clearance_status, clearance_grant_date,
  clearance_prd, indoc_date, cv_status, nbis_eapp_status, notes, created_by, updated_by, created_at, updated_at
)
SELECT
  'mock-personnel-' || lower(site_id),
  site_id,
  lower(replace(site_short, ' ', '.')) || '.security',
  site_short || ' Security Manager',
  'FSO',
  site_label,
  CASE WHEN site_id IN ('MTSI-VA', 'MTSI-LV') THEN 'TS/SCI' ELSE 'Secret' END,
  'Active',
  '2023-04-12',
  '2028-04-12',
  '2024-01-15',
  'Current',
  'Submitted',
  'Seeded personnel record for dashboard coverage.',
  'admin',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET site_id = EXCLUDED.site_id,
    username = EXCLUDED.username,
    name = EXCLUDED.name,
    position = EXCLUDED.position,
    org = EXCLUDED.org,
    clearance_level = EXCLUDED.clearance_level,
    clearance_status = EXCLUDED.clearance_status,
    clearance_grant_date = EXCLUDED.clearance_grant_date,
    clearance_prd = EXCLUDED.clearance_prd,
    indoc_date = EXCLUDED.indoc_date,
    cv_status = EXCLUDED.cv_status,
    nbis_eapp_status = EXCLUDED.nbis_eapp_status,
    notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO mash_activities_security (
  id, site_id, category, title, date, time, location, classification, status, owner,
  visitor_count, clearance_verified, briefing_required, notes, created_by, updated_by,
  due_date, program, description, created_at, updated_at
)
SELECT
  'mock-activity-' || lower(site_id),
  site_id,
  'classified-meeting',
  site_short || ' Security Review Board',
  '2026-07-10',
  '09:30',
  site_short || ' HQ',
  'CONFIDENTIAL',
  CASE WHEN ato_status = 'Expired' THEN 'Overdue' ELSE 'Scheduled' END,
  'FSO',
  5,
  TRUE,
  TRUE,
  'Seeded activity for mission board view.',
  'admin',
  'admin',
  '2026-07-10',
  'Security',
  'Monthly security review and incident sync.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET site_id = EXCLUDED.site_id,
    category = EXCLUDED.category,
    title = EXCLUDED.title,
    date = EXCLUDED.date,
    time = EXCLUDED.time,
    location = EXCLUDED.location,
    classification = EXCLUDED.classification,
    status = EXCLUDED.status,
    owner = EXCLUDED.owner,
    visitor_count = EXCLUDED.visitor_count,
    clearance_verified = EXCLUDED.clearance_verified,
    briefing_required = EXCLUDED.briefing_required,
    notes = EXCLUDED.notes,
    due_date = EXCLUDED.due_date,
    program = EXCLUDED.program,
    description = EXCLUDED.description,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO mash_document_control (
  id, site_id, doc_number, title, classification, program, category, copy_count, accountable,
  custodian, current_location, version, date, last_inventory, next_inventory, status, notes,
  created_by, updated_by, created_at, updated_at
)
SELECT
  'mock-document-' || lower(site_id),
  site_id,
  'DOC-' || replace(site_id, 'MTSI-', ''),
  site_short || ' SOP Binder',
  'CUI',
  'Security',
  'Procedure',
  2,
  TRUE,
  'Security Office',
  site_short || ' Vault',
  'v1.2',
  '2026-06-01',
  '2026-05-30',
  '2026-11-30',
  'Active',
  'Seeded controlled document.',
  'admin',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET site_id = EXCLUDED.site_id,
    doc_number = EXCLUDED.doc_number,
    title = EXCLUDED.title,
    classification = EXCLUDED.classification,
    program = EXCLUDED.program,
    category = EXCLUDED.category,
    copy_count = EXCLUDED.copy_count,
    accountable = EXCLUDED.accountable,
    custodian = EXCLUDED.custodian,
    current_location = EXCLUDED.current_location,
    version = EXCLUDED.version,
    date = EXCLUDED.date,
    last_inventory = EXCLUDED.last_inventory,
    next_inventory = EXCLUDED.next_inventory,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO mash_dd254_register (
  id, site_id, contract_number, program_name, customer, prime_or_sub, dd254_status, revision,
  effective_date, expiration_date, review_due_date, classification_level, has_sci, has_sap,
  cui_required, government_activity, owner, security_requirements_summary, notes, created_by,
  updated_by, created_at, updated_at
)
SELECT
  'mock-dd254-' || lower(site_id),
  site_id,
  'DD254-' || replace(site_id, 'MTSI-', ''),
  site_short || ' Mission Support',
  'DoD Customer',
  'Prime',
  dd254_status,
  'Rev B',
  '2026-01-01',
  '2027-01-01',
  '2026-10-01',
  'SECRET',
  site_id IN ('MTSI-VA', 'MTSI-LV'),
  FALSE,
  TRUE,
  'DCSA',
  'FSO',
  'Standard safeguarding and transmission requirements.',
  'Seeded DD254 register item.',
  'admin',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET site_id = EXCLUDED.site_id,
    contract_number = EXCLUDED.contract_number,
    program_name = EXCLUDED.program_name,
    customer = EXCLUDED.customer,
    prime_or_sub = EXCLUDED.prime_or_sub,
    dd254_status = EXCLUDED.dd254_status,
    revision = EXCLUDED.revision,
    effective_date = EXCLUDED.effective_date,
    expiration_date = EXCLUDED.expiration_date,
    review_due_date = EXCLUDED.review_due_date,
    classification_level = EXCLUDED.classification_level,
    has_sci = EXCLUDED.has_sci,
    has_sap = EXCLUDED.has_sap,
    cui_required = EXCLUDED.cui_required,
    government_activity = EXCLUDED.government_activity,
    owner = EXCLUDED.owner,
    security_requirements_summary = EXCLUDED.security_requirements_summary,
    notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO mash_media_control (
  id, site_id, media_id, type, label, classification, program, capacity_gb, make, model,
  serial_number, status, assigned_to, assigned_date, return_due, system, approved_by, notes,
  created_by, updated_by, current_location, created_at, updated_at
)
SELECT
  'mock-media-' || lower(site_id),
  site_id,
  'USB-' || replace(site_id, 'MTSI-', ''),
  'USB',
  site_short || ' Transfer Media',
  'SECRET',
  'Security',
  64,
  'Kingston',
  'DTMAX',
  'SN-' || replace(site_id, 'MTSI-', ''),
  CASE WHEN ato_status = 'Expired' THEN 'Assigned' ELSE 'Unassigned' END,
  CASE WHEN ato_status = 'Expired' THEN 'Security Office' ELSE NULL END,
  CASE WHEN ato_status = 'Expired' THEN '2026-06-10' ELSE NULL END,
  CASE WHEN ato_status = 'Expired' THEN '2026-06-20' ELSE NULL END,
  site_short || ' Mission System',
  'ISSO',
  'Seeded removable media item.',
  'admin',
  'admin',
  site_short || ' Vault',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET site_id = EXCLUDED.site_id,
    media_id = EXCLUDED.media_id,
    type = EXCLUDED.type,
    label = EXCLUDED.label,
    classification = EXCLUDED.classification,
    program = EXCLUDED.program,
    capacity_gb = EXCLUDED.capacity_gb,
    make = EXCLUDED.make,
    model = EXCLUDED.model,
    serial_number = EXCLUDED.serial_number,
    status = EXCLUDED.status,
    assigned_to = EXCLUDED.assigned_to,
    assigned_date = EXCLUDED.assigned_date,
    return_due = EXCLUDED.return_due,
    system = EXCLUDED.system,
    approved_by = EXCLUDED.approved_by,
    notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by,
    current_location = EXCLUDED.current_location,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO inspection_campaigns (
  id, site_id, template_name, name, status, start_date, target_date, owner_name, notes, created_by,
  created_at, updated_at, inspection_type, facility_area, standard, overall_rating, lead_inspector
)
SELECT
  'mock-inspection-' || lower(site_id),
  site_id,
  'Facility Security Template',
  site_short || ' Quarterly Self-Inspection',
  CASE WHEN ato_status = 'Expired' THEN 'In Progress' ELSE 'Draft' END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  'FSO',
  'Seeded inspection campaign for Sentinel.',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'Self',
  'Primary Vault',
  'DCSA',
  CASE WHEN ato_status = 'Authorized' THEN 'Compliant' ELSE 'Pending' END,
  'Lead Inspector'
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET site_id = EXCLUDED.site_id,
    template_name = EXCLUDED.template_name,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    start_date = EXCLUDED.start_date,
    target_date = EXCLUDED.target_date,
    owner_name = EXCLUDED.owner_name,
    notes = EXCLUDED.notes,
    inspection_type = EXCLUDED.inspection_type,
    facility_area = EXCLUDED.facility_area,
    standard = EXCLUDED.standard,
    overall_rating = EXCLUDED.overall_rating,
    lead_inspector = EXCLUDED.lead_inspector,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO lava_system_requests (
  id, system_name, system_owner, owner_email, owner_phone, classification, purpose,
  network_type, status, reviewed_by, review_notes, site_id, created_at, updated_at
)
SELECT
  'mock-lava-system-' || lower(site_id),
  site_short || ' Jump Host',
  site_short || ' System Owner',
  lower(replace(site_short, ' ', '.')) || '@mtsi.local',
  '555-0100',
  'UNCLASSIFIED',
  'Engineering workstation request for ' || site_short || ' site support.',
  'Business',
  CASE WHEN ato_status = 'Denied' THEN 'rejected' ELSE 'approved' END,
  'Network Security',
  'Seeded for LAVA dashboard coverage.',
  site_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET system_name = EXCLUDED.system_name,
    system_owner = EXCLUDED.system_owner,
    owner_email = EXCLUDED.owner_email,
    owner_phone = EXCLUDED.owner_phone,
    classification = EXCLUDED.classification,
    purpose = EXCLUDED.purpose,
    network_type = EXCLUDED.network_type,
    status = EXCLUDED.status,
    reviewed_by = EXCLUDED.reviewed_by,
    review_notes = EXCLUDED.review_notes,
    site_id = EXCLUDED.site_id,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO lava_assets (
  id, system_request_id, asset_tag, serial_number, make, model, asset_type, status,
  classification, assigned_user, location, notes, site_id, created_at, updated_at
)
SELECT
  'mock-lava-asset-' || lower(site_id),
  'mock-lava-system-' || lower(site_id),
  'LAP-' || replace(site_id, 'MTSI-', ''),
  'SER-' || replace(site_id, 'MTSI-', ''),
  'Dell',
  'Latitude 7440',
  'Laptop',
  'Assigned',
  'UNCLASSIFIED',
  site_short || ' Operator',
  site_label,
  'Seeded LAVA asset record.',
  site_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET system_request_id = EXCLUDED.system_request_id,
    asset_tag = EXCLUDED.asset_tag,
    serial_number = EXCLUDED.serial_number,
    make = EXCLUDED.make,
    model = EXCLUDED.model,
    asset_type = EXCLUDED.asset_type,
    status = EXCLUDED.status,
    classification = EXCLUDED.classification,
    assigned_user = EXCLUDED.assigned_user,
    location = EXCLUDED.location,
    notes = EXCLUDED.notes,
    site_id = EXCLUDED.site_id,
    updated_at = CURRENT_TIMESTAMP;

WITH site_seed(site_id, site_label, site_short, tz_label, ato_status, poam_severity, dd254_status) AS (
  VALUES
    ('MTSI-VA',  'MTSI Virginia',  'Virginia',  'Eastern',  'Authorized', 'High',   'Active'),
    ('MTSI-OH',  'MTSI Ohio',      'Ohio',      'Eastern',  'Pending',    'Medium', 'Draft'),
    ('MTSI-LV',  'MTSI Las Vegas', 'Las Vegas', 'Pacific',  'Denied',     'High',   'Review'),
    ('MTSI-CO',  'MTSI Colorado',  'Colorado',  'Mountain', 'Authorized', 'Low',    'Active'),
    ('MTSI-STL', 'MTSI St. Louis', 'St. Louis', 'Central',  'Expired',    'Medium', 'Expired'),
    ('MTSI-AL',  'MTSI Alabama',   'Alabama',   'Central',  'Pending',    'High',   'Draft'),
    ('MTSI-FL',  'MTSI Florida',   'Florida',   'Eastern',  'Authorized', 'Medium', 'Active')
)
INSERT INTO lava_saars (
  id, last_name, first_name, organization, email, supervisor_name, system_name, classification,
  purpose_of_access, access_type, status, agreement_signed, agreement_signed_at, submitted_by,
  site_id, created_at, updated_at
)
SELECT
  'mock-lava-saar-' || lower(site_id),
  'User',
  site_short,
  site_label,
  lower(replace(site_short, ' ', '.')) || '.requestor@mtsi.local',
  'Security Manager',
  site_short || ' Jump Host',
  'UNCLASSIFIED',
  'Routine access for support operations.',
  'standard',
  CASE WHEN ato_status = 'Denied' THEN 'rejected' ELSE 'approved' END,
  TRUE,
  CURRENT_TIMESTAMP,
  'admin',
  site_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM site_seed
ON CONFLICT (id) DO UPDATE
SET last_name = EXCLUDED.last_name,
    first_name = EXCLUDED.first_name,
    organization = EXCLUDED.organization,
    email = EXCLUDED.email,
    supervisor_name = EXCLUDED.supervisor_name,
    system_name = EXCLUDED.system_name,
    classification = EXCLUDED.classification,
    purpose_of_access = EXCLUDED.purpose_of_access,
    access_type = EXCLUDED.access_type,
    status = EXCLUDED.status,
    agreement_signed = EXCLUDED.agreement_signed,
    agreement_signed_at = EXCLUDED.agreement_signed_at,
    submitted_by = EXCLUDED.submitted_by,
    site_id = EXCLUDED.site_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO data_fabric_documents (name, data, created_at, updated_at)
VALUES (
  'program_management',
  jsonb_build_object(
    'portfolio', jsonb_build_object(
      'name', 'MTSI Secure Infrastructure',
      'fiscalYear', 'FY26',
      'budgetTotal', 12450000,
      'budgetObligated', 8120000,
      'budgetRemaining', 4330000,
      'kpis', jsonb_build_array(
        jsonb_build_object('id', 'budget-health', 'label', 'Budget Health', 'value', 65, 'suffix', '%', 'trend', 'On plan'),
        jsonb_build_object('id', 'construction-active', 'label', 'Construction', 'value', 4, 'suffix', '', 'trend', 'Active workstreams'),
        jsonb_build_object('id', 'open-risks', 'label', 'Open Risks', 'value', 3, 'suffix', '', 'trend', 'Requires review')
      )
    ),
    'construction', jsonb_build_array(
      jsonb_build_object('id', 'const-va', 'name', 'Virginia SCIF Refresh', 'type', 'Renovation', 'status', 'Execution', 'progress', 72, 'budget', 980000, 'schedule', 'On Track', 'accreditation', 'SCIF'),
      jsonb_build_object('id', 'const-co', 'name', 'Colorado SAPF Buildout', 'type', 'New Construction', 'status', 'Design Freeze', 'progress', 38, 'budget', 2240000, 'schedule', 'At Risk', 'accreditation', 'SAPF')
    ),
    'accreditations', jsonb_build_array(
      jsonb_build_object('id', 'acc-va', 'name', 'Virginia Zone 3', 'level', 'SCIF', 'status', 'Inspection Scheduled', 'targetDate', '2026-08-28'),
      jsonb_build_object('id', 'acc-lv', 'name', 'Las Vegas Open Storage', 'level', 'Secret', 'status', 'Package Assembly', 'targetDate', '2026-09-12')
    ),
    'realEstate', jsonb_build_array(
      jsonb_build_object('id', 're-va', 'site', 'Virginia', 'actionType', 'Lease Renewal', 'status', 'Negotiation', 'dueDate', '2026-09-15', 'owner', 'Facilities PMO'),
      jsonb_build_object('id', 're-fl', 'site', 'Florida', 'actionType', 'Expansion Option', 'status', 'Approved', 'dueDate', '2026-10-01', 'owner', 'Program Real Estate')
    ),
    'milestones', jsonb_build_array(
      jsonb_build_object('id', 'ms-1', 'title', 'Q3 Budget Rebaseline', 'targetDate', '2026-07-05', 'status', 'Upcoming'),
      jsonb_build_object('id', 'ms-2', 'title', 'Virginia SCIF Acceptance', 'targetDate', '2026-08-28', 'status', 'Critical')
    ),
    'risks', jsonb_build_array(
      jsonb_build_object('id', 'risk-1', 'title', 'Badge office staffing gap', 'severity', 'High', 'status', 'Open', 'owner', 'Security Ops', 'source', 'Sentinel', 'dueDate', '2026-07-20'),
      jsonb_build_object('id', 'risk-2', 'title', 'Colorado build permit drift', 'severity', 'Medium', 'status', 'Watch', 'owner', 'Facilities', 'source', 'Construction', 'dueDate', '2026-08-10')
    ),
    'executiveActions', jsonb_build_array(
      jsonb_build_object('id', 'action-1', 'title', 'Approve add-on guard coverage', 'priority', 'High', 'status', 'In Progress', 'owner', 'Corporate Security', 'linkedTo', 'Virginia', 'dueDate', '2026-07-01'),
      jsonb_build_object('id', 'action-2', 'title', 'Review DD254 renewal posture', 'priority', 'Medium', 'status', 'Pending', 'owner', 'Contracts', 'linkedTo', 'Florida', 'dueDate', '2026-07-18')
    )
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (name) DO UPDATE
SET data = EXCLUDED.data,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO data_fabric_documents (name, data, created_at, updated_at)
VALUES (
  'program_security',
  jsonb_build_object(
    'facilitySecurity', jsonb_build_object(
      'summary', jsonb_build_object('nominal', 4, 'guarded', 2, 'elevated', 1),
      'idsIssueCount', 1,
      'overdueFindings', 2,
      'openFindingsCount', 3
    ),
    'personnelSecurity', jsonb_build_object(
      'training', jsonb_build_object('overdue', 2),
      'visitAccessRequests', jsonb_build_object('open', 1)
    ),
    'documentControl', jsonb_build_object('inventoryOverdue', 1),
    'dd254', jsonb_build_object('actionable', 2, 'expiring30d', 1, 'reviewDue30d', 1),
    'mediaControl', jsonb_build_object('overdueReturns', 1, 'flagged', 1, 'pendingDestruction', 0),
    'selfInspections', jsonb_build_object('overdue', 1, 'openFindings', 2)
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (name) DO UPDATE
SET data = EXCLUDED.data,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO data_fabric_documents (name, data, created_at, updated_at)
VALUES (
  'nexus_settings',
  jsonb_build_object(
    'title', 'NEXUS Program Mission Command',
    'theme', 'command',
    'lastSeededAt', to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD\"T\"HH24:MI:SS')
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (name) DO UPDATE
SET data = EXCLUDED.data,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;
