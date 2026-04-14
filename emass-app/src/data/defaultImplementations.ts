import type { ControlStatus, ImplementationOrigin } from '@/types'

interface DefaultImpl {
  implementationStatement: string
  status: ControlStatus
  implementationOrigin: ImplementationOrigin
}

export const DEFAULT_IMPLEMENTATIONS: Record<string, DefaultImpl> = {

  // ── AC – Access Control ────────────────────────────────────────────────────

  'AC-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates an access control policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance. The access control policy is reviewed and updated at a minimum annually or when significant changes occur. Procedures are in place to facilitate the implementation of the access control policy and associated controls.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'AC-2': {
    implementationStatement: `<p>The organization manages system accounts, including establishing, activating, modifying, reviewing, disabling, and removing accounts. Account management is performed through an enterprise directory service and follows a formal request and approval process. The following account types are managed under this control:</p><ul><li><strong>User accounts:</strong> Standard accounts provisioned for authorized personnel upon completion of onboarding procedures</li><li><strong>Privileged accounts:</strong> Administrative accounts provisioned based on least-privilege principles with enhanced monitoring</li><li><strong>Service accounts:</strong> Non-interactive accounts used by applications and automated processes, reviewed quarterly</li><li><strong>Shared/group accounts:</strong> Prohibited except where technically necessary and documented with compensating controls</li></ul><p>Account reviews are conducted at minimum every 90 days for privileged accounts and annually for standard user accounts.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-2(1)': {
    implementationStatement: `<p>The system employs automated mechanisms to support the management of system accounts. The enterprise directory service and identity management platform provide automated workflows for account creation, modification, and termination requests. Automated notifications are sent to account managers and system owners when account actions are pending review or when accounts have not been used within a defined inactivity threshold.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-2(2)': {
    implementationStatement: `<p>The system automatically removes or disables temporary and emergency accounts after a defined time period not to exceed 72 hours unless explicitly extended by the system owner. Temporary account creation is logged and tracked through the access management system, which generates alerts when accounts approach or exceed their authorized duration.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-2(3)': {
    implementationStatement: `<p>The system automatically disables accounts after a defined period of inactivity, set at no more than 35 days for standard accounts and 30 days for privileged accounts. The enterprise directory service enforces inactivity thresholds and triggers automated account lockout. Disabled accounts are reviewed by the account manager prior to re-enablement.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-2(4)': {
    implementationStatement: `<p>The system automatically audits account creation, modification, enabling, disabling, and removal actions. All account management events are captured in the system audit logs and forwarded to the centralized Security Information and Event Management (SIEM) platform. Alerts are configured to notify security personnel of anomalous or unauthorized account management activities.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-3': {
    implementationStatement: `<p>The system enforces approved authorizations for logical access to the system and its resources in accordance with applicable access control policies. Access enforcement is implemented through role-based access control (RBAC) integrated with the enterprise directory service. Users are granted access only to resources required for their assigned roles, and all access requests are subject to formal approval by data owners and system administrators.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-4': {
    implementationStatement: `<p>The system enforces approved authorizations for controlling the flow of information within the system and between interconnected systems in accordance with applicable information flow control policies. Network segmentation, firewall rules, and data transfer controls are implemented to prevent unauthorized information flows. All inter-system connections are governed by Interconnection Security Agreements (ISAs) or Memoranda of Understanding (MOUs).</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-4(17)': {
    implementationStatement: `<p>The system enforces domain authentication requirements for information flows that cross security domain boundaries. Domain type enforcement is implemented through network access controls and security labels applied to data in transit. Flows between domains of differing sensitivity are mediated by validated guard solutions or data diodes as appropriate to the classification boundary.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-5': {
    implementationStatement: `<p>The organization separates duties of individuals to reduce the risk of malevolent activity without collusion. Separation of duties is enforced through role-based access controls that prevent any single individual from possessing the ability to perform all critical security functions. The following duty separations are enforced:</p><ul><li>System administration and security administration roles are assigned to separate individuals</li><li>Audit log review responsibilities are segregated from system administration functions</li><li>Code development and production deployment responsibilities are assigned to separate personnel</li></ul>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-6': {
    implementationStatement: `<p>The organization employs the principle of least privilege, allowing only authorized accesses for users and processes acting on behalf of users that are necessary to accomplish assigned tasks. All privileged functions are restricted to designated administrators with validated need-to-know. User accounts are provisioned with the minimum permissions required for their job functions, and access rights are reviewed upon role changes or departures.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-6(1)': {
    implementationStatement: `<p>The organization explicitly authorizes access to security functions and security-relevant information for designated individuals. Access to security configuration settings, audit log management, and cryptographic key management is restricted to a named set of privileged roles documented in the system security plan. Authorization records are maintained and reviewed annually or when personnel changes occur.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-6(2)': {
    implementationStatement: `<p>The organization requires that users of system accounts, or roles with access to security functions or security-relevant information, use non-privileged accounts when accessing non-security functions. Privileged users are provisioned with separate standard user accounts for daily activities such as email and web browsing. Technical controls prevent the use of privileged credentials for non-administrative tasks.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-6(5)': {
    implementationStatement: `<p>The organization restricts privileged accounts on the system to a defined set of authorized personnel. Privileged account assignments are documented and approved by the system owner and ISSO. The list of privileged account holders is reviewed at minimum quarterly, and accounts are revoked immediately upon change in role or departure from the organization.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-6(9)': {
    implementationStatement: `<p>The system audits the execution of privileged functions. All actions performed using privileged accounts are captured in system audit logs, which are forwarded to the centralized SIEM platform. Privileged function execution logs are reviewed on a regular basis to detect unauthorized or anomalous use of elevated privileges.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-6(10)': {
    implementationStatement: `<p>The system prevents non-privileged users from executing privileged functions and captures the execution of such functions in audit logs. Access control enforcement mechanisms ensure that privilege escalation is not permitted outside of approved administrative workflows. Any attempt to execute privileged functions using a non-privileged account generates an audit log entry and alert.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-7': {
    implementationStatement: `<p>The system enforces a limit of five consecutive invalid logon attempts within a 15-minute period, after which the account is locked for a minimum of 15 minutes or until released by an administrator. This control applies to all interactive logon interfaces including web, console, and remote access. Lockout events are logged and monitored by the security operations team.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-8': {
    implementationStatement: `<p>The system displays an approved system use notification banner before granting access, informing users that the system is a U.S. Government information system subject to monitoring and that use constitutes consent to monitoring. The banner remains on screen until the user acknowledges it by taking an explicit action. Banner content has been reviewed and approved by the organization's legal counsel and information security office.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-11': {
    implementationStatement: `<p>The system prevents further access to the system by initiating a session lock after a period of inactivity not to exceed 15 minutes. The session lock renders the display inaccessible and requires the user to re-authenticate before resuming access. Session lock is enforced at the operating system and application layer across all access modalities.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-12': {
    implementationStatement: `<p>The system automatically terminates a user session after defined conditions or time periods. Sessions are terminated after a maximum idle period of 30 minutes and upon logout or browser closure. For web-based applications, session tokens are invalidated server-side upon termination to prevent session replay attacks.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-14': {
    implementationStatement: `<p>The organization identifies user actions that can be performed on the system without identification and authentication consistent with organizational missions and business functions. Permitted unauthenticated actions are limited to accessing publicly available, non-sensitive information pages. All such exceptions are documented in the system security plan and reviewed annually.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-17': {
    implementationStatement: `<p>The organization establishes and documents usage restrictions, configuration and connection requirements, and implementation guidance for each type of remote access allowed. Remote access is provided through an approved Virtual Private Network (VPN) solution requiring multi-factor authentication. All remote sessions are encrypted, logged, and subject to the same access control policies as on-site access.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-17(1)': {
    implementationStatement: `<p>The system employs automated mechanisms to monitor and control remote access methods. The enterprise remote access solution provides centralized logging and monitoring of all remote sessions. Security personnel receive automated alerts for anomalous remote access activity, and session recordings are retained in accordance with the audit log retention policy.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-17(2)': {
    implementationStatement: `<p>The system implements cryptographic mechanisms to protect the confidentiality and integrity of remote access sessions. All remote access sessions are encrypted using approved cryptographic protocols and key lengths in accordance with NIST-approved algorithms. Encryption is enforced at the network transport layer and cannot be disabled by end users.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-18': {
    implementationStatement: `<p>The organization establishes usage restrictions, configuration requirements, connection requirements, and implementation guidance for wireless access. Wireless network access is segregated from the wired internal network and requires enterprise authentication credentials. Wireless access points are inventoried, configured to organizational security standards, and subject to periodic review.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-18(1)': {
    implementationStatement: `<p>The system implements authentication and encryption for wireless access. Wireless connections require enterprise authentication and utilize approved encryption protocols. Unauthorized or rogue wireless access points are detected through the wireless intrusion detection capability and reported to security personnel for immediate remediation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-19': {
    implementationStatement: `<p>The organization establishes usage restrictions, configuration requirements, connection requirements, and implementation guidance for mobile devices. Mobile device access to organizational systems is controlled through a Mobile Device Management (MDM) solution that enforces encryption, screen lock, and remote wipe capabilities. Only organization-approved and enrolled devices are permitted to connect to organizational resources.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-20': {
    implementationStatement: `<p>The organization establishes terms and conditions for authorized individuals to access the system from external systems. Use of external systems to access organizational information is governed by the acceptable use policy. Personally-owned devices must be enrolled in the MDM solution or access must be limited to web-based portals that do not permit data downloads to the external device.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AC-22': {
    implementationStatement: `<p>The organization designates individuals authorized to post information onto publicly accessible systems, trains those individuals, and reviews posted content for nonpublic information prior to public release. A content review and approval workflow is in place for all publicly facing web content. Designated content reviewers verify that sensitive or nonpublic information is not inadvertently disclosed through publicly accessible interfaces.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },

  // ── AT – Awareness and Training ───────────────────────────────────────────

  'AT-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a security awareness and training policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance. The policy is reviewed and updated annually and upon significant organizational or system changes. Supporting procedures are maintained to facilitate consistent implementation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'AT-2': {
    implementationStatement: `<p>The organization provides basic security awareness training to system users as part of initial onboarding and annually thereafter. Training covers the organization's security policies, procedures, and acceptable use requirements, as well as common threat vectors including phishing and social engineering. Completion records are maintained and reviewed by security management to ensure compliance.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'AT-2(2)': {
    implementationStatement: `<p>The organization includes insider threat awareness as part of the security awareness training curriculum. Training content addresses indicators of potential insider threat activity, reporting procedures, and the consequences of unauthorized disclosure or misuse of organizational information. Insider threat awareness content is updated annually to reflect current threat intelligence.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'AT-3': {
    implementationStatement: `<p>The organization provides role-based security training to personnel with assigned security roles and responsibilities before authorizing system access, when required by system changes, and annually thereafter. Role-based training covers the specific security responsibilities, tools, and procedures associated with each designated role. Training records are maintained and verified during access recertification reviews.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'AT-4': {
    implementationStatement: `<p>The organization documents and monitors security awareness training activities. Training completion records are maintained in the enterprise learning management system and are available for review by security management and auditors. Non-compliance with training requirements is reported to supervisors and may result in suspension of system access until training is completed.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },

  // ── AU – Audit and Accountability ─────────────────────────────────────────

  'AU-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates an audit and accountability policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated at minimum annually or following significant system changes. Corresponding procedures are maintained to ensure consistent audit practices across the organization.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'AU-2': {
    implementationStatement: `<p>The organization determines that the system is capable of auditing the defined list of auditable events. Auditable events have been identified through coordination between the security team, system administrators, and the ISSO. The following event categories are audited:</p><ul><li>Successful and failed logon and logoff events</li><li>Account management actions (create, modify, disable, delete)</li><li>Privileged function execution</li><li>Object access to sensitive data</li><li>Policy and configuration changes</li><li>System startup and shutdown events</li></ul>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-3': {
    implementationStatement: `<p>The system generates audit records containing information that establishes what type of event occurred, when the event occurred, where the event occurred, the source of the event, the outcome of the event, and the identity of individuals or subjects associated with the event. All audit records include timestamps synchronized to an authoritative time source, user or process identifier, event type, and success or failure indicator.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-3(1)': {
    implementationStatement: `<p>The system generates audit records containing additional information as defined by the organization, including the full-text of privileged commands executed. Enhanced audit record content provides sufficient detail to support incident investigation and forensic analysis. Additional fields such as session identifiers, source IP addresses, and affected resources are captured for security-relevant events.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-4': {
    implementationStatement: `<p>The organization allocates audit log storage capacity in accordance with audit log retention requirements. Audit log storage is provisioned with sufficient capacity to retain logs for a minimum of 90 days online and one year in archive storage. Automated alerts notify administrators when log storage utilization exceeds defined thresholds to prevent log overflow conditions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-5': {
    implementationStatement: `<p>The system alerts designated personnel in the event of an audit processing failure and takes defined actions including shutdown of the system or overwriting of oldest audit records. Audit subsystem failures generate immediate alerts to the security operations team via the SIEM platform. Audit processing failures are treated as security incidents and escalated according to the incident response procedures.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-6': {
    implementationStatement: `<p>The organization reviews and analyzes system audit records on a defined frequency to identify inappropriate or unusual activity. Audit log review is performed by designated security personnel using the centralized SIEM platform. Findings from audit log reviews are documented, reported to the ISSO, and escalated as security incidents when warranted.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-6(1)': {
    implementationStatement: `<p>The organization employs automated mechanisms to integrate audit review, analysis, and reporting processes. The centralized SIEM platform aggregates and correlates audit records from all system components, enabling automated detection of anomalous activity patterns. Automated dashboards and reports are generated to support continuous audit review activities without requiring manual log file inspection.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-7': {
    implementationStatement: `<p>The system provides an audit record reduction and report generation capability that supports on-demand audit review, analysis, and reporting requirements. The SIEM platform provides query, filtering, and reporting capabilities that allow security personnel to extract relevant audit data for investigation, compliance reporting, and trend analysis. Audit reduction processes do not alter the original audit records.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-8': {
    implementationStatement: `<p>The system uses internal system clocks to generate timestamps for audit records. All system components synchronize their clocks to an authoritative Network Time Protocol (NTP) source to ensure consistent and accurate timestamps across the enterprise. Timestamp accuracy is maintained within an acceptable tolerance to support log correlation and forensic investigations.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-8(1)': {
    implementationStatement: `<p>The system synchronizes internal system clocks to a designated authoritative time source. All system components are configured to synchronize with the organization's designated NTP hierarchy, which is traceable to an authoritative time source such as a government-operated time standard. Time synchronization failures are logged and generate alerts to system administrators.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-9': {
    implementationStatement: `<p>The system protects audit information and audit tools from unauthorized access, modification, and deletion. Audit logs are stored in a write-once or append-only configuration accessible only to authorized audit administrators. Access to audit management tools is restricted to designated security personnel, and all access to audit data is itself subject to audit logging.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-9(2)': {
    implementationStatement: `<p>The system backs up audit records to a physically separate system or media that is different from the system being audited. Audit logs are forwarded in near-real time to the centralized SIEM platform, which is hosted on infrastructure separate from the audited system. Backup copies of audit logs are retained in accordance with the organization's records retention schedule.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-9(4)': {
    implementationStatement: `<p>The organization authorizes access to management of audit logging capability to only a defined subset of privileged users. Audit log management access is restricted to designated audit administrators and security personnel. Privileged access to audit systems is subject to enhanced monitoring, and all administrative actions on audit infrastructure are logged and reviewed.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-11': {
    implementationStatement: `<p>The organization retains audit records for a defined period to provide support for after-the-fact investigations of security incidents. Audit records are retained online for a minimum of 90 days and archived for a minimum of one year in accordance with organizational policy and applicable legal or regulatory requirements. Archived audit records are protected from unauthorized modification or deletion.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-12': {
    implementationStatement: `<p>The system provides audit record generation capability for the auditable events defined in AU-2 for all system components. Audit record generation is enabled on all servers, network devices, and application components within the system boundary. System components are configured to capture all defined auditable events and forward records to the centralized log management infrastructure.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'AU-12(1)': {
    implementationStatement: `<p>The system compiles audit records from multiple system components into a system-wide audit trail that is time-correlated to within an organization-defined level of tolerance. The centralized SIEM platform ingests and correlates audit records from all system components, providing a unified chronological view of system activity. Time correlation accuracy is enforced through enterprise NTP synchronization.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },

  // ── CA – Assessment, Authorization, and Monitoring ────────────────────────

  'CA-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates an assessment, authorization, and monitoring policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Procedures are maintained to support consistent implementation of assessment and authorization activities.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'CA-2': {
    implementationStatement: `<p>The organization develops a security assessment plan, assesses security controls in accordance with the plan, produces a security assessment report, and provides the results to the authorizing official. Security assessments are conducted at minimum annually and prior to authorization decisions. Assessments address the effectiveness of controls as implemented in the operational environment.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CA-2(1)': {
    implementationStatement: `<p>The organization employs independent assessors or assessment teams to conduct security control assessments. Independent assessors are selected based on demonstrated technical competence and the absence of conflicts of interest. Independence requirements ensure that assessment findings are objective and provide an unbiased view of the security posture of the system.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CA-3': {
    implementationStatement: `<p>The organization authorizes connections to external systems through the establishment of Interconnection Security Agreements (ISAs). All external system connections are documented, approved by the authorizing official, and governed by a formal agreement addressing security requirements, data flows, and responsibilities. The inventory of external connections is reviewed annually and updated when connections change.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CA-5': {
    implementationStatement: `<p>The organization develops a plan of action and milestones (POA&M) documenting planned remedial actions to correct weaknesses or deficiencies in security controls and to reduce or eliminate known vulnerabilities. POA&M entries are updated at minimum monthly to reflect current status of remediation activities. The POA&M is reviewed by the ISSO and provided to the authorizing official as part of the ongoing authorization process.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CA-6': {
    implementationStatement: `<p>The organization assigns a senior organizational official as the authorizing official for the system, ensures the system is authorized prior to operation, and updates the authorization on a defined frequency or when significant changes occur. Authorization decisions are documented in an Authorization to Operate (ATO) letter and are based on a thorough review of the security assessment report, POA&M, and system security plan.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CA-7': {
    implementationStatement: `<p>The organization develops and implements a continuous monitoring strategy that includes establishing metrics, monitoring frequencies, and assessment procedures. Continuous monitoring activities include automated vulnerability scanning, configuration compliance checks, and log analysis. Results are reported to the ISSO and authorizing official on a defined schedule to support ongoing authorization decisions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CA-7(1)': {
    implementationStatement: `<p>The organization employs independent assessors or assessment teams to monitor the security controls in the system on an ongoing basis. Independent monitoring activities supplement automated continuous monitoring to provide an objective assessment of control effectiveness. Findings from independent monitoring are documented and tracked through the POA&M process.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CA-8': {
    implementationStatement: `<p>The organization conducts penetration testing on the system at a defined frequency and when significant changes occur. Penetration tests are performed by qualified and independent testers using methodologies aligned with industry standards. Findings are documented in a penetration test report and tracked through the POA&M for remediation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CA-9': {
    implementationStatement: `<p>The organization authorizes and documents the connection of system components within the system boundary. Internal connections are evaluated for security implications prior to establishment, and connection authorizations are maintained as part of the system security plan. Unauthorized internal connections are detected through network monitoring and remediated in accordance with configuration management procedures.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },

  // ── CM – Configuration Management ─────────────────────────────────────────

  'CM-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a configuration management policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant organizational or system changes occur. Supporting procedures are maintained to ensure consistent implementation of configuration management practices.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'CM-2': {
    implementationStatement: `<p>The organization develops, documents, and maintains a current baseline configuration of the system under configuration control. Baseline configurations are established for all system components including operating systems, middleware, databases, and applications. Baselines are reviewed and updated at minimum annually, when significant changes occur, and as part of system upgrades or patches.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-2(2)': {
    implementationStatement: `<p>The organization maintains the currency, completeness, accuracy, and availability of baseline configurations using automated mechanisms. Configuration management tools automatically track deviations from approved baselines and generate alerts when unauthorized changes are detected. Automated configuration baselines are integrated with the change management workflow to update baselines following approved changes.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-3': {
    implementationStatement: `<p>The organization determines the types of changes that are configuration-controlled, reviews and approves all proposed changes, documents configuration change decisions, implements approved changes, and audits activities associated with configuration changes. A formal Change Control Board (CCB) or equivalent process governs all configuration changes. Emergency changes are documented after the fact and reviewed at the next scheduled CCB meeting.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-4': {
    implementationStatement: `<p>The organization analyzes changes to the system to determine potential security impacts prior to change implementation. Security impact analysis is performed as part of the change request process, with security personnel reviewing all proposed changes that may affect security controls or the attack surface of the system. Changes with significant security impact require ISSO review and approval before implementation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-5': {
    implementationStatement: `<p>The organization defines, documents, approves, and enforces physical and logical access restrictions associated with changes to the system. Only authorized administrators are permitted to make changes to production system configurations. Access to production change capabilities is restricted through role-based access controls, and all production changes are logged and subject to post-implementation review.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-6': {
    implementationStatement: `<p>The organization establishes and documents configuration settings for technology products employed within the system that reflect the most restrictive mode consistent with operational requirements. Configuration settings are based on industry security benchmarks and government-mandated security technical implementation guides (STIGs) or equivalent hardening standards. Compliance with configuration settings is verified through automated scanning and periodic manual review.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-7': {
    implementationStatement: `<p>The organization configures the system to provide only essential capabilities by prohibiting or restricting the use of functions, ports, protocols, and services not required for its mission. A ports, protocols, and services management (PPSM) review is conducted as part of system authorization and updated with each significant configuration change. Unnecessary services and ports are disabled on all system components.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-7(1)': {
    implementationStatement: `<p>The organization reviews the system periodically to identify and eliminate unnecessary functions, ports, protocols, and services. Periodic reviews of enabled services and open ports are conducted using automated scanning tools and compared against the approved PPSM list. Unauthorized or unnecessary capabilities identified during reviews are disabled through the configuration management change process.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-7(2)': {
    implementationStatement: `<p>The system prevents program execution in accordance with an approved software execution policy. Application whitelisting or allowlisting controls are implemented to prevent the execution of unauthorized software on system components. Attempts to execute unauthorized software are blocked and generate alerts for security personnel review.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-8': {
    implementationStatement: `<p>The organization develops, documents, and maintains a current inventory of system components that accurately reflects the system, includes all components within the authorization boundary, and is available for review. The system inventory is maintained in an enterprise asset management tool and updated in conjunction with configuration management activities. The inventory is reviewed and reconciled against the actual system at minimum annually.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-8(1)': {
    implementationStatement: `<p>The organization updates the inventory of system components as an integral part of component installations, removals, and system updates. Automated discovery tools are used to identify new components on the network and reconcile them against the approved inventory. Unmanaged or unauthorized components detected through automated discovery are flagged for review and disposition.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-10': {
    implementationStatement: `<p>The organization tracks the use of software and associated documentation protected by quantity licenses to control copying and distribution, and controls the use of peer-to-peer file sharing technology. Software license management is maintained through the enterprise asset management system, which tracks license entitlements and installations. Unauthorized software installation is prevented through endpoint management controls and application allowlisting.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CM-11': {
    implementationStatement: `<p>The organization establishes policies governing the installation of software by users, enforces installation restrictions, and monitors for policy compliance. Users are prohibited from installing unauthorized software on organizational systems. Endpoint management tools enforce software restriction policies and alert security personnel when installation attempts are made outside approved processes.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },

  // ── CP – Contingency Planning ──────────────────────────────────────────────

  'CP-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a contingency planning policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant organizational or system changes occur. Supporting procedures are maintained to ensure consistent implementation of contingency planning activities.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'CP-2': {
    implementationStatement: `<p>The organization develops a contingency plan for the system that identifies essential missions and business functions, provides recovery objectives, and identifies roles and responsibilities. The contingency plan is reviewed and updated annually and following system changes or contingency plan activations. Plan distribution is controlled, and personnel with contingency responsibilities receive copies of the relevant plan sections.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CP-2(1)': {
    implementationStatement: `<p>The organization coordinates contingency plan development with organizational elements responsible for related plans. Contingency plan development is coordinated with the organizational business continuity plan, disaster recovery plan, and incident response plan to ensure consistency. Dependencies and interdependencies between plans are documented and validated through tabletop exercises.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CP-3': {
    implementationStatement: `<p>The organization provides contingency training to system users consistent with assigned roles and responsibilities within a defined time of assuming contingency responsibilities and annually thereafter. Contingency training covers roles and responsibilities during activation, notification procedures, and recovery operations. Training records are maintained and verified by security management.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'CP-4': {
    implementationStatement: `<p>The organization tests the contingency plan for the system at a defined frequency using defined tests to determine the plan's effectiveness and the organization's readiness to execute the plan. Contingency plan tests include tabletop exercises and functional tests of backup and recovery capabilities. Test results are documented, and identified deficiencies are incorporated into the POA&M and addressed through plan updates.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CP-4(1)': {
    implementationStatement: `<p>The organization coordinates contingency plan testing with organizational elements responsible for related plans. Contingency tests are coordinated with business continuity and disaster recovery exercises to validate interoperability and shared recovery dependencies. Lessons learned from coordinated exercises are shared across planning teams and incorporated into plan updates.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CP-6': {
    implementationStatement: `<p>The organization establishes an alternate storage site including necessary agreements to permit the storage and retrieval of information system backup information. The alternate storage site is geographically separated from the primary site to reduce the risk of common-cause disruption. Backup media stored at the alternate site is protected with the same security controls as the primary site.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CP-7': {
    implementationStatement: `<p>The organization establishes an alternate processing site including necessary agreements to permit the transfer of essential missions and business functions in the event the primary processing site is unavailable. The alternate processing site is equipped with hardware, software, and telecommunications connectivity equivalent to the primary site. Procedures for transitioning operations to the alternate site are documented and tested periodically.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'CP-9': {
    implementationStatement: `<p>The organization conducts backups of user-level and system-level information, including system documentation and security-related documentation, in accordance with the defined backup frequency. Backups are performed daily for critical data and weekly for full system images. Backup media is stored securely at an offsite location, and the integrity of backup data is verified periodically through restoration testing.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CP-9(1)': {
    implementationStatement: `<p>The organization tests backup information to verify media reliability and information integrity at a defined frequency. Restoration tests are conducted quarterly to verify that backup data is complete, uncorrupted, and can be successfully restored within recovery time objectives. Test results are documented and reviewed by system administrators and the ISSO.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'CP-10': {
    implementationStatement: `<p>The organization provides for the recovery and reconstitution of the system to a known state within organization-defined time periods following a system disruption, compromise, or failure. Recovery procedures are documented in the contingency plan and include steps for restoring systems from trusted backups, verifying system integrity, and validating security controls prior to return to operations. Recovery time objectives are defined and tested through contingency exercises.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },

  // ── IA – Identification and Authentication ─────────────────────────────────

  'IA-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates an identification and authentication policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Supporting procedures are maintained to ensure consistent implementation of identification and authentication controls across the enterprise.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'IA-2': {
    implementationStatement: `<p>The system uniquely identifies and authenticates organizational users and processes acting on behalf of organizational users. All users are assigned unique accounts that cannot be shared. Authentication is enforced through the enterprise directory service prior to granting access to any system resources. Multi-factor authentication is required for all privileged access and remote access sessions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-2(1)': {
    implementationStatement: `<p>The system implements multi-factor authentication for access to privileged accounts. Privileged account access requires a combination of something you know (password) and something you have (hardware or software token, smart card, or push notification). Multi-factor authentication is enforced at the authentication gateway and cannot be bypassed for privileged account logon.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-2(2)': {
    implementationStatement: `<p>The system implements multi-factor authentication for access to non-privileged accounts. All organizational users are required to authenticate with at least two factors when accessing the system, including standard user accounts. The enterprise identity provider enforces multi-factor authentication policies and provides the second factor through approved authentication mechanisms.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-2(6)': {
    implementationStatement: `<p>The system implements multi-factor authentication for local access to privileged accounts. Local console access requiring privileged credentials is subject to multi-factor authentication requirements equivalent to those enforced for network access. Physical access controls complement authentication mechanisms to protect local access points.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-2(8)': {
    implementationStatement: `<p>The system implements replay-resistant authentication mechanisms for access to privileged accounts. Authentication protocols employ cryptographic nonces, time stamps, or other mechanisms that prevent previously captured authentication credentials from being reused. Approved protocols such as Kerberos and FIDO2 are used to enforce replay resistance.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-2(12)': {
    implementationStatement: `<p>The system accepts and electronically verifies Personal Identity Verification (PIV) credentials where applicable. PIV credential acceptance is implemented through integration with the enterprise PKI infrastructure and certificate validation services. PIV-based authentication meets the requirements of HSPD-12 and FIPS 201 for federal identity, credential, and access management.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-3': {
    implementationStatement: `<p>The system uniquely identifies and authenticates devices before establishing connections. Network access control mechanisms require device certificates or other approved device authentication credentials prior to granting network access. Devices that cannot be authenticated are placed in a restricted network segment pending investigation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-4': {
    implementationStatement: `<p>The organization manages system identifiers by receiving authorization from a designated organizational official before issuing identifiers, preventing reuse of identifiers for a defined period, and disabling identifiers after a defined period of inactivity. Identifier management is performed through the enterprise identity management system. Identifiers are assigned uniquely to individuals and are not shared among multiple users.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-5': {
    implementationStatement: `<p>The organization manages system authenticators by verifying identity of individuals prior to issuing authenticators, establishing initial authenticator content, ensuring authenticators meet defined strength requirements, and implementing administrative procedures for lost or compromised authenticators. Password complexity and length requirements are enforced through directory service group policies. Authenticator management procedures address initial issuance, distribution, and revocation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-5(1)': {
    implementationStatement: `<p>The system enforces password-based authentication controls including minimum password complexity, minimum and maximum password lifetime, password reuse restrictions, and temporary password requirements. Passwords must meet a minimum length of 15 characters and include a mix of character types. Passwords are stored using approved hashing algorithms and are never stored or transmitted in plaintext.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-6': {
    implementationStatement: `<p>The system obscures feedback of authentication information during the authentication process to protect against exploitation or observation by unauthorized individuals. Password fields on all login interfaces display masking characters rather than the actual input. This applies to all access modalities including web-based, desktop, and command-line interfaces.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-7': {
    implementationStatement: `<p>The system implements mechanisms for authentication to cryptographic modules that meet the requirements of applicable federal laws, executive orders, directives, policies, regulations, and standards. Cryptographic module authentication is implemented in accordance with FIPS 140-2/140-3 requirements. Only FIPS-validated cryptographic modules are used for authentication-related cryptographic operations.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-8': {
    implementationStatement: `<p>The system uniquely identifies and authenticates non-organizational users, including contractors, business partners, and members of the public. Non-organizational user accounts are provisioned through a separate onboarding process with appropriate identity proofing commensurate with the sensitivity of accessible information. Non-organizational user accounts are subject to the same authentication strength requirements as organizational users.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IA-11': {
    implementationStatement: `<p>The system requires users to re-authenticate when defined circumstances or situations require re-establishment of identity. Re-authentication is triggered by session inactivity, privilege escalation requests, access to particularly sensitive functions, and changes in network location. Re-authentication requirements are enforced at the application and session management layer.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },

  // ── IR – Incident Response ─────────────────────────────────────────────────

  'IR-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates an incident response policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or following significant organizational changes or incident response lessons learned. Supporting procedures cover the complete incident response lifecycle from detection through post-incident analysis.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'IR-2': {
    implementationStatement: `<p>The organization provides incident response training to system users consistent with assigned roles and responsibilities within a defined time of assuming an incident response role and annually thereafter. Training covers recognition of potential security incidents, reporting procedures, escalation paths, and roles during incident response activities. Training records are maintained and available for review.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'IR-3': {
    implementationStatement: `<p>The organization tests the incident response capability for the system at a defined frequency using tabletop exercises and simulated incidents. Tests evaluate the effectiveness of incident detection, reporting, escalation, containment, eradication, and recovery procedures. Lessons learned from exercises are documented and incorporated into updates to the incident response plan and training materials.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'IR-4': {
    implementationStatement: `<p>The organization implements an incident handling capability for security incidents that includes preparation, detection and analysis, containment, eradication, and recovery. The incident response team follows documented procedures for each phase of the incident response lifecycle. Incidents are tracked in an incident management system, and significant incidents are reported to appropriate organizational officials and external entities as required.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'IR-4(1)': {
    implementationStatement: `<p>The organization employs automated mechanisms to support the incident handling process. The SIEM platform provides automated detection and alerting capabilities that trigger incident response workflows. Automated incident ticketing integrates with detection tools to ensure consistent tracking and escalation of security events from initial detection through resolution.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'IR-5': {
    implementationStatement: `<p>The organization tracks and documents system security incidents. All security incidents are documented in the incident management system with details including detection date and time, affected systems, nature of the incident, actions taken, and resolution. Incident records are retained in accordance with the organization's records management policy and are available for post-incident analysis and reporting.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'IR-6': {
    implementationStatement: `<p>The organization requires personnel to report suspected security incidents to the organizational incident response capability within a defined time period. Reporting requirements include notification to the ISSO, ISSM, and organizational security operations center. External reporting obligations to oversight bodies, law enforcement, or US-CERT are addressed in the incident response procedures.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'IR-7': {
    implementationStatement: `<p>The organization provides an incident response support resource that offers advice and assistance to users of the system for the handling and reporting of security incidents. The security operations center serves as the primary point of contact for incident reporting and response support. Contact information for the incident response team is documented in the incident response plan and accessible to all system users.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'IR-8': {
    implementationStatement: `<p>The organization develops an incident response plan, distributes it to designated personnel, reviews and updates it annually, and protects the plan from unauthorized disclosure. The incident response plan addresses organizational structure, roles and responsibilities, resource requirements, communications procedures, and relationships with external organizations. Plan updates incorporate lessons learned from incident response activities and exercises.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },

  // ── MA – Maintenance ───────────────────────────────────────────────────────

  'MA-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a system maintenance policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Supporting procedures address both scheduled and unscheduled maintenance activities for system hardware and software components.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'MA-2': {
    implementationStatement: `<p>The organization schedules, performs, documents, and reviews records of maintenance and repairs on system components. Maintenance activities are tracked through the enterprise service management system, which records maintenance windows, actions performed, and personnel involved. Emergency maintenance procedures are in place for time-sensitive repairs, with post-maintenance review to verify system integrity.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'MA-3': {
    implementationStatement: `<p>The organization approves, controls, and monitors the use of maintenance tools. Maintenance tools used on the system are reviewed and approved by the ISSO prior to use. Unauthorized maintenance tools are prohibited from being introduced to the system, and all approved tools are subject to malware scanning before use on production systems.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'MA-4': {
    implementationStatement: `<p>The organization approves and monitors nonlocal maintenance and diagnostic activities and requires multi-factor authentication for remote maintenance sessions. All remote maintenance sessions are encrypted, logged, and terminated upon completion. Remote maintenance access is limited to specifically authorized vendors or personnel and is enabled only for the duration of the maintenance activity.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'MA-5': {
    implementationStatement: `<p>The organization establishes a process for maintenance personnel authorization, maintains a list of authorized maintenance organizations or personnel, and ensures that personnel performing maintenance have required access authorizations. Personnel without required authorizations are escorted and supervised during maintenance activities. Background check requirements for maintenance personnel are commensurate with the sensitivity of information they may encounter.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'MA-6': {
    implementationStatement: `<p>The organization obtains maintenance support and spare parts for defined system components within a defined time period of failure. Critical spare components are inventoried and stored to minimize recovery time following hardware failures. Maintenance support agreements with vendors include defined response time commitments for critical system components.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },

  // ── MP – Media Protection ──────────────────────────────────────────────────

  'MP-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a media protection policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Supporting procedures address the handling, storage, transport, and disposal of all forms of digital and non-digital media containing organizational information.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'MP-2': {
    implementationStatement: `<p>The organization restricts access to digital and non-digital media containing organizational information to authorized individuals. Media access is controlled through physical security measures for tangible media and access control mechanisms for digital media. Media access authorizations are documented and reviewed annually to ensure only personnel with a valid need retain access.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'MP-3': {
    implementationStatement: `<p>The organization marks system media with necessary distribution limitations, handling caveats, and applicable security markings. All removable media and hardcopy output containing sensitive information is marked with appropriate classification and handling markings before distribution. Marking requirements are communicated to all users as part of security awareness training.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'MP-4': {
    implementationStatement: `<p>The organization physically controls and securely stores digital and non-digital media within controlled areas. Removable media containing sensitive information is stored in locked containers when not in use. Access to media storage areas is restricted to authorized personnel, and access records are maintained for sensitive media storage locations.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'MP-5': {
    implementationStatement: `<p>The organization protects and controls digital media containing organizational information during transport outside of controlled areas using cryptographic mechanisms or other protective measures. All removable media containing sensitive information is encrypted prior to transport. Chain of custody documentation accompanies sensitive media during transport, and transport methods are selected to minimize exposure to unauthorized access.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'MP-6': {
    implementationStatement: `<p>The organization sanitizes system media prior to disposal, release out of organizational control, or reuse using defined sanitization techniques and procedures. Media sanitization is performed using NIST SP 800-88 compliant methods appropriate to the sensitivity of the data and the type of media. Sanitization activities are documented and records are retained in accordance with the organization's records management policy.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'MP-7': {
    implementationStatement: `<p>The organization restricts or prohibits the use of portable storage devices on organizational systems without an identifiable owner. The use of removable media is controlled through endpoint management policies that restrict connection of unauthorized devices. Exceptions to removable media restrictions are documented and approved by the ISSO, with compensating controls applied as appropriate.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },

  // ── PE – Physical and Environmental Protection ────────────────────────────

  'PE-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a physical and environmental protection policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Supporting procedures address physical access control, monitoring, visitor management, and environmental controls.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-2': {
    implementationStatement: `<p>The organization develops, approves, and maintains a list of individuals with authorized access to the facility containing the system and issues authorization credentials for facility access. The access list is reviewed and updated at minimum quarterly to remove individuals who no longer require physical access. Physical access authorizations are coordinated with logical access authorizations to maintain consistency.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-3': {
    implementationStatement: `<p>The organization enforces physical access authorizations at entry and exit points to the facility using electronic access controls, security guards, or other physical access mechanisms. Physical access attempts are logged and monitored by the facility security team. Visitors are required to sign in, are escorted by authorized personnel, and are tracked throughout their visit to controlled areas.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-6': {
    implementationStatement: `<p>The organization monitors physical access to the facility where the system resides to detect and respond to physical security incidents. Physical access control systems log entry and exit events, and security cameras provide coverage of critical areas. Physical access logs are reviewed periodically, and anomalous access events are investigated by the facility security team.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-8': {
    implementationStatement: `<p>The organization maintains visitor access records to the facility where the system resides for a defined period and reviews visitor access records upon a defined frequency. Visitor logs include the visitor's name, organization, contact to be visited, purpose of visit, and entry and exit times. Access records are retained in accordance with the organization's records management policy.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-12': {
    implementationStatement: `<p>The organization employs and maintains automatic emergency lighting for the system that activates in the event of a power outage or disruption. Emergency lighting covers all areas of the facility critical to system operations including data center floors, egress routes, and security monitoring stations. Emergency lighting systems are tested periodically and maintained in accordance with manufacturer recommendations.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-13': {
    implementationStatement: `<p>The organization employs and maintains fire suppression and detection devices and systems for the facility housing the system. The data center is equipped with early warning smoke and heat detection systems connected to the facility alarm system and monitored around the clock. Fire suppression systems are appropriate for the computing environment and are inspected and tested in accordance with applicable codes and standards.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-14': {
    implementationStatement: `<p>The organization maintains temperature and humidity levels within the facility housing the system within acceptable ranges defined by equipment manufacturers. Environmental monitoring systems continuously measure temperature and humidity in the data center and generate alerts when levels approach or exceed defined thresholds. Redundant environmental controls are in place to maintain acceptable conditions during equipment failures.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-15': {
    implementationStatement: `<p>The organization protects the system from damage resulting from water leakage by providing master shutoff or isolation valves that are accessible, operational, and known to key personnel. Water detection sensors are installed beneath raised floors and at other water exposure risk points in the data center. Personnel with responsibility for emergency response are trained on the location and operation of water shutoff mechanisms.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PE-16': {
    implementationStatement: `<p>The organization protects and controls system components during removal from organizational facilities by authorizing and monitoring the removal and return of components. Removal of equipment from the data center requires documented authorization from the system owner. All removals and returns are logged, and media sanitization requirements are enforced for any storage media leaving the facility.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },

  // ── PL – Planning ──────────────────────────────────────────────────────────

  'PL-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a security planning policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant organizational or system changes occur. Supporting procedures ensure consistent development, review, and maintenance of system security plans across the organization.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PL-2': {
    implementationStatement: `<p>The organization develops a system security plan for the system that provides an overview of security requirements, describes the security controls in place or planned, and is reviewed and approved by the authorizing official. The system security plan is reviewed and updated annually and when significant changes to the system occur. Distribution of the plan is controlled, and the plan is protected from unauthorized disclosure.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'PL-4': {
    implementationStatement: `<p>The organization establishes and makes readily available to individuals requiring access to the system the rules of behavior that describe their responsibilities and expected behavior with regard to information and system usage. Users are required to acknowledge receipt and understanding of the rules of behavior before being granted system access and annually thereafter. Rules of behavior acknowledgments are retained on file.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PL-8': {
    implementationStatement: `<p>The organization develops a security and privacy architecture for the system that describes the overall philosophy, requirements, and approach to be taken with regard to protecting the confidentiality, integrity, and availability of organizational information. The security architecture is documented as part of the system security plan and is updated when significant changes to the system or threat environment occur. Architecture decisions are reviewed by the ISSO and authorizing official.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },

  // ── PM – Program Management ────────────────────────────────────────────────

  'PM-1': {
    implementationStatement: `<p>The organization develops and disseminates an organization-wide information security program plan that provides an overview of the requirements for the security program and a description of the security program management controls and common controls in place or planned. The program plan is reviewed and updated annually to reflect the current state of the security program and changes in the threat environment.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PM-2': {
    implementationStatement: `<p>The organization appoints a senior agency information security officer with the mission and resources to coordinate, develop, implement, and maintain an organization-wide information security program. The designated official has sufficient authority, resources, and organizational standing to ensure the security program is implemented consistently across the enterprise. Roles, responsibilities, and reporting relationships are documented and communicated throughout the organization.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PM-4': {
    implementationStatement: `<p>The organization implements a process for ensuring that plans of action and milestones for the security program and associated organizational systems are maintained and document the remedial information security actions to adequately respond to risk. The POA&M process is managed at both the system and program level, with executive visibility into aggregate risk posture across the portfolio.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'PM-5': {
    implementationStatement: `<p>The organization develops and maintains an inventory of its information systems. The enterprise system inventory documents all major applications, general support systems, and minor applications within the organization's authorization boundary. The inventory is updated annually and when new systems are authorized or existing systems are decommissioned, and is used to support portfolio-level risk management decisions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },

  // ── PS – Personnel Security ────────────────────────────────────────────────

  'PS-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a personnel security policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes to the organization's structure or personnel practices occur. Supporting procedures address position categorization, screening, onboarding, and separation activities.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PS-2': {
    implementationStatement: `<p>The organization assigns risk designations to all organizational positions, establishes screening criteria for individuals filling those positions, and reviews and revises position risk designations when necessary. Position risk designations are based on the sensitivity of information accessible and the potential impact of actions taken in the position. Screening requirements are commensurate with the risk designation of each position.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PS-3': {
    implementationStatement: `<p>The organization screens individuals prior to authorizing access to the system and rescreens individuals according to defined conditions. Personnel screening is conducted in accordance with applicable federal regulations and organizational policy, including criminal background checks, employment verification, and suitability determinations. Rescreening is required when individuals change roles or when derogatory information is identified.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PS-4': {
    implementationStatement: `<p>The organization terminates system access and conducts exit interviews upon personnel separation, retrieves all organizational property, and ensures that separated personnel are debriefed on any applicable confidentiality obligations. Termination procedures include immediate revocation of logical and physical access upon separation. HR coordinates with the security team to ensure timely completion of all separation security actions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PS-5': {
    implementationStatement: `<p>The organization reviews logical and physical access authorizations to the system when individuals are reassigned or transferred to other positions within the organization. Access rights are modified to reflect the new position's requirements, and access from the previous role is revoked. Transfer procedures are coordinated between HR, the gaining supervisor, the losing supervisor, and the security team.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PS-6': {
    implementationStatement: `<p>The organization establishes and documents access agreements for individuals requiring access to organizational information and systems, ensures that individuals sign and acknowledge access agreements before access is granted, and reviews and updates access agreements when required. Access agreements include acceptable use policies, non-disclosure agreements, and rules of behavior acknowledgments.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PS-7': {
    implementationStatement: `<p>The organization establishes personnel security requirements for third-party providers and monitors provider compliance with these requirements. Third-party personnel security requirements are incorporated into contracts and service agreements. The organization verifies that third-party providers have established adequate personnel security controls for individuals with access to organizational systems or facilities.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'PS-8': {
    implementationStatement: `<p>The organization employs a formal sanctions process for individuals failing to comply with established information security policies and procedures. The sanctions process is documented in the acceptable use policy and communicated to all users during onboarding. Sanctions are applied consistently and may range from verbal counseling to termination depending on the severity and frequency of violations.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },

  // ── RA – Risk Assessment ───────────────────────────────────────────────────

  'RA-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a risk assessment policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Supporting procedures define the risk assessment methodology, roles, and schedule for the organization's risk assessment program.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'RA-2': {
    implementationStatement: `<p>The organization categorizes the system and information processed, stored, and transmitted by the system in accordance with applicable federal laws, directives, and standards, including FIPS 199 and NIST SP 800-60. The security categorization is documented in the system security plan and reviewed by the authorizing official. Categorization decisions are reviewed and updated when significant changes to the system or the information it handles occur.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'RA-3': {
    implementationStatement: `<p>The organization conducts a risk assessment to identify threats and vulnerabilities to the system, determines the likelihood and impact of threat exploitation, and identifies risk mitigations. Risk assessments are conducted prior to initial authorization, at minimum every three years, and when significant changes occur. Risk assessment results are documented and used to inform security control selection and resource allocation decisions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'RA-5': {
    implementationStatement: `<p>The organization scans for vulnerabilities in the system and hosted applications at a defined frequency, when new vulnerabilities are identified, and when significant changes occur. Vulnerability scans are performed using authenticated scanning where technically feasible and cover all system components within the authorization boundary. Scan results are analyzed, prioritized, and tracked through the POA&M process for remediation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'RA-5(2)': {
    implementationStatement: `<p>The organization updates the system vulnerabilities scanned by updating the vulnerability scanning tool prior to scanning. Vulnerability scanning tools are configured to automatically download updated vulnerability definitions before each scan cycle. The currency of vulnerability definitions is verified as part of the scan configuration review process.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'RA-5(5)': {
    implementationStatement: `<p>The organization implements privileged access authorization to operating systems, applications, and databases for vulnerability scanning. Authenticated scanning credentials are managed securely and rotated in accordance with the credential management policy. Scan accounts are provisioned with the minimum privileges required to perform scanning functions and are not used for any other purpose.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'RA-7': {
    implementationStatement: `<p>The organization remediates vulnerabilities identified during vulnerability assessments in accordance with an organizational risk-based remediation plan. Remediation timelines are based on vulnerability severity, with critical and high findings receiving priority attention. Remediation actions are tracked through the POA&M, and the effectiveness of remediation is verified through follow-up scanning.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },

  // ── SA – System and Services Acquisition ───────────────────────────────────

  'SA-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a system and services acquisition policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Supporting procedures address security requirements in the acquisition lifecycle and the management of external service providers.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'SA-2': {
    implementationStatement: `<p>The organization determines information security requirements for the system in mission and business planning activities and establishes a discrete line item for information security in organizational programming and budgeting documentation. Security funding requirements are identified during the system development lifecycle and documented in the system security plan. Funding adequacy is reviewed annually as part of the security program review.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SA-3': {
    implementationStatement: `<p>The organization manages the system using a system development life cycle (SDLC) methodology that incorporates information security considerations throughout the lifecycle. Security requirements are defined during the initiation phase, security controls are designed and implemented during development, and security authorization is completed before system deployment. Security activities are tracked and documented at each SDLC phase.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SA-4': {
    implementationStatement: `<p>The organization includes security functional requirements, security strength requirements, security assurance requirements, and security-related documentation requirements in system acquisition contracts. Acquisition documents reference applicable security standards and require vendors to demonstrate compliance with security requirements. Contract language includes provisions for security assessment and the right to audit vendor security practices.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SA-5': {
    implementationStatement: `<p>The organization obtains administrator, user, and other relevant documentation for the system, system component, or system service and makes documentation available to authorized personnel. System documentation is maintained in the document management system and includes installation guides, configuration guides, user manuals, and administrator reference materials. Documentation is reviewed for completeness during system acceptance testing.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SA-8': {
    implementationStatement: `<p>The organization applies security engineering principles in the specification, design, development, implementation, and modification of the system. Security engineering principles including least privilege, defense-in-depth, fail-safe defaults, and separation of duties are applied throughout the development lifecycle. Architecture and design reviews include security engineering considerations prior to implementation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SA-9': {
    implementationStatement: `<p>The organization requires that providers of external system services comply with organizational information security requirements, defines and documents government oversight and user roles with regard to external services, and employs processes and methods to monitor security control compliance by external service providers. External service providers are subject to security assessment requirements, and their compliance with security controls is monitored through periodic reviews and audits.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SA-10': {
    implementationStatement: `<p>The organization requires the developer of the system to create and implement a configuration management plan for the system, manage and control changes to the system using an approved configuration management process, and track security flaws and flaw resolution. Developer configuration management requirements are incorporated into contracts and verified through development reviews and acceptance testing.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SA-11': {
    implementationStatement: `<p>The organization requires the developer of the system to create and implement a security assessment plan, perform testing and evaluation, produce evidence of the execution of the security assessment plan, and implement a verifiable flaw remediation process. Security testing requirements are specified in contracts and include static analysis, dynamic testing, and penetration testing as appropriate to the system's risk level.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },

  // ── SC – System and Communications Protection ──────────────────────────────

  'SC-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a system and communications protection policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Supporting procedures address network architecture, cryptographic controls, and protection of information in transit and at rest.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'SC-2': {
    implementationStatement: `<p>The system separates user functionality from system management functionality. Administrative interfaces are distinct from user-facing interfaces and are accessible only to authorized administrators. Network segmentation and access controls ensure that system management functions cannot be accessed through standard user sessions or from the user-accessible network tier.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-3': {
    implementationStatement: `<p>The system isolates security functions from non-security functions. Security-relevant components, including authentication modules, audit subsystems, and access enforcement mechanisms, are implemented in a manner that limits exposure to non-security code. Security function isolation is achieved through operating system kernel protections, memory isolation, and application architecture controls.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-4': {
    implementationStatement: `<p>The system prevents unauthorized and unintended information transfer via shared system resources. Shared memory, file system objects, and inter-process communication resources are managed to prevent information leakage between processes of differing security levels. Operating system controls ensure that shared resources are cleared or purged before being reused by processes with different access rights.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-5': {
    implementationStatement: `<p>The system protects against or limits the effects of denial-of-service attacks including both bandwidth and resource exhaustion attacks. Network-based denial-of-service protections are implemented at the perimeter, including rate limiting, traffic scrubbing, and load balancing capabilities. System resources are monitored for exhaustion conditions, and automated responses are configured to mitigate service degradation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-7': {
    implementationStatement: `<p>The system monitors and controls communications at the external boundary and key internal boundaries. Boundary protection is implemented through enterprise firewalls, intrusion detection and prevention systems, and network access control mechanisms. All inbound and outbound traffic is filtered against defined rule sets, and traffic anomalies are logged and alerted for security review.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-7(3)': {
    implementationStatement: `<p>The organization limits the number of external network connections to the system. All external connections are inventoried and approved through the ISA/MOU process, and unauthorized connections are prohibited by firewall rules. The number of external access points is minimized consistent with operational requirements to reduce the attack surface.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-7(4)': {
    implementationStatement: `<p>The organization implements managed interfaces to external networks or information systems using telecommunications managed network services. Managed interface implementations include enterprise firewalls, application layer gateways, and intrusion prevention systems configured in accordance with approved rulesets. All changes to managed interface configurations are subject to the change management process.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-7(5)': {
    implementationStatement: `<p>The system denies network communications traffic by default and allows network communications traffic by exception at managed interfaces. Firewall policies are configured with a default-deny posture, and only explicitly permitted traffic is allowed. Firewall rule reviews are conducted periodically to validate that all permitted traffic remains necessary and appropriate.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-7(7)': {
    implementationStatement: `<p>The system prevents split tunneling for remote devices unless the split tunnel is authorized in the security plan. VPN configurations enforce full tunnel routing for all traffic from connected remote devices. Exceptions to full tunnel requirements are documented and compensating controls are implemented to provide equivalent protection for allowed split tunnel scenarios.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-7(8)': {
    implementationStatement: `<p>The system routes internal communications traffic to defined external networks through authenticated proxy servers. All outbound internet-destined traffic is routed through a centrally managed proxy that enforces content filtering, SSL inspection, and logging policies. Proxy bypass is not permitted without documented authorization and compensating controls.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-8': {
    implementationStatement: `<p>The system implements cryptographic mechanisms to prevent unauthorized disclosure of information during transmission unless otherwise protected by alternative physical safeguards. All sensitive data in transit between system components and to external parties is protected using approved encryption protocols. Unencrypted transmission of sensitive information over public networks is prohibited.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-8(1)': {
    implementationStatement: `<p>The system implements cryptographic mechanisms to prevent unauthorized disclosure and detect changes to information during transmission. Encryption in transit is implemented using NIST-approved protocols and cipher suites, including TLS 1.2 or higher for network communications. Certificate management procedures ensure that transport layer security certificates are valid, properly configured, and renewed before expiration.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-10': {
    implementationStatement: `<p>The system terminates the network connection associated with a communications session at the end of the session or after a defined period of inactivity. Network session timeouts are configured at the network infrastructure, application, and operating system layers. Session termination applies to both user sessions and service-to-service connections to prevent session hijacking and resource exhaustion.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-12': {
    implementationStatement: `<p>The organization establishes and manages cryptographic keys when cryptography is employed within the system. Cryptographic key management is performed in accordance with a documented key management plan that addresses key generation, distribution, storage, access, retirement, and destruction. Key management procedures comply with NIST SP 800-57 guidance and use hardware security modules or equivalent key protection mechanisms where appropriate.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-13': {
    implementationStatement: `<p>The system implements NIST-approved cryptography in accordance with applicable federal laws, directives, and standards. Only FIPS 140-2 or FIPS 140-3 validated cryptographic modules are used for cryptographic operations. The use of unapproved or deprecated cryptographic algorithms is prohibited, and cryptographic implementations are reviewed periodically against current NIST guidance.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-15': {
    implementationStatement: `<p>The system prohibits remote activation of collaborative computing devices and mechanisms and provides an explicit indication of use to present and remote users. Collaborative computing features such as cameras and microphones on organizational systems are disabled by default when not in active authorized use. Visual and audio indicators notify users when collaborative computing devices are active.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-17': {
    implementationStatement: `<p>The organization issues public key infrastructure (PKI) certificates under an appropriate certificate policy or obtains PKI certificates from an approved service provider. Certificates used for authentication and encryption are issued by a trusted certificate authority in accordance with applicable federal PKI policies. Certificate lifecycle management procedures address issuance, renewal, revocation, and audit of certificates.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-20': {
    implementationStatement: `<p>The system provides additional data origin authentication and integrity verification artifacts along with authoritative name resolution data returned in response to external name or address resolution queries. DNS Security Extensions (DNSSEC) is implemented for DNS zones operated by the system to provide cryptographic origin authentication for DNS responses. DNSSEC configuration is maintained and tested to ensure continued validity.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-21': {
    implementationStatement: `<p>The system requests and performs data origin authentication and data integrity verification on the name or address resolution responses received from authoritative sources. DNS resolvers are configured to validate DNSSEC signatures for external domain lookups. Validation failures cause the resolver to return a failure response rather than an unvalidated result, protecting users from DNS spoofing attacks.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-22': {
    implementationStatement: `<p>The system provides a name and address resolution service that is fault-tolerant and implements role separation. DNS infrastructure is deployed with redundant authoritative and recursive resolvers to ensure availability. Separate DNS infrastructure is maintained for internal and external resolution to prevent information disclosure and to support role separation between resolution functions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-23': {
    implementationStatement: `<p>The system protects the authenticity of communications sessions. Session authentication mechanisms including secure session tokens, certificate-based mutual authentication, and secure cookies are employed to bind sessions to authenticated identities. Session token generation uses cryptographically secure random number generators, and tokens are invalidated upon logout or session expiration.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-28': {
    implementationStatement: `<p>The system protects the confidentiality and integrity of information at rest. Data at rest encryption is implemented for all storage media containing sensitive information, including database encryption, file system encryption, and full-disk encryption for portable devices. Encryption key management for data at rest follows the organization's key management policy and uses FIPS-validated cryptographic modules.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-28(1)': {
    implementationStatement: `<p>The system implements cryptographic mechanisms to prevent unauthorized disclosure and modification of information at rest. Approved cryptographic algorithms are used for data at rest encryption, with key lengths meeting or exceeding current NIST recommendations. Cryptographic protections apply to all storage containing sensitive information, including primary storage, backup media, and archived data.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SC-39': {
    implementationStatement: `<p>The system maintains a separate execution domain for each executing process. Process isolation is enforced through operating system memory protection mechanisms and process sandboxing technologies. Each process operates within its own protected address space, and mechanisms that permit process-to-process memory access are controlled and audited to prevent unauthorized information disclosure or process manipulation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },

  // ── SI – System and Information Integrity ──────────────────────────────────

  'SI-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a system and information integrity policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes occur. Supporting procedures address malware protection, security alerting, software patching, and information integrity verification.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'SI-2': {
    implementationStatement: `<p>The organization identifies, reports, and corrects system flaws, tests software and firmware updates before installation, and installs security-relevant software updates within a defined time period. Patch management is performed through an enterprise patch management solution that automates deployment of approved patches. Critical and high severity patches are deployed within 30 days of availability; moderate findings within 90 days.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-2(2)': {
    implementationStatement: `<p>The organization employs automated mechanisms to determine the state of system components with regard to flaw remediation. Automated vulnerability scanning and patch compliance reporting tools continuously assess patch status across all system components. Compliance reports are reviewed by system administrators and the ISSO to track patching progress and identify systems requiring attention.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-3': {
    implementationStatement: `<p>The organization employs malicious code protection mechanisms at system entry and exit points and at workstations, servers, and mobile computing devices to detect and eradicate malicious code. Enterprise endpoint protection software provides real-time malware scanning, behavioral detection, and automated remediation capabilities. Malware signatures are updated automatically, and detection events generate alerts to the security operations team.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-3(1)': {
    implementationStatement: `<p>The organization centrally manages malicious code protection mechanisms. Endpoint protection software is managed through a centralized management console that provides enterprise-wide visibility into protection status, signature currency, and detection events. Policy enforcement ensures consistent protection configuration across all endpoints, and deviations from the approved configuration generate alerts.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-3(2)': {
    implementationStatement: `<p>The malicious code protection mechanism automatically updates malicious code protection mechanisms, including signature definitions. Endpoint protection clients are configured to receive signature updates from the central management infrastructure and apply them automatically. The currency of malware signatures is monitored, and endpoints with outdated signatures are flagged for administrative action.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-4': {
    implementationStatement: `<p>The organization monitors the system to detect attacks and indicators of potential attacks, unauthorized connections, and unauthorized use of the system. Network and host-based intrusion detection capabilities are deployed throughout the system boundary. Security events are correlated in the SIEM platform, and analysts review alerts to identify and respond to potential security incidents in a timely manner.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-4(2)': {
    implementationStatement: `<p>The organization employs automated tools to support near-real-time analysis of events. The SIEM platform ingests security events from all system components and applies correlation rules to detect anomalous activity in near-real time. Automated alerting notifies security operations personnel of high-priority events requiring immediate investigation, reducing the time from detection to response.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-4(4)': {
    implementationStatement: `<p>The system monitors inbound and outbound communications traffic to detect unusual or unauthorized activities or conditions. Network traffic analysis tools examine communication flows for anomalies including unusual volumes, unexpected connection patterns, and known malicious indicators. Deep packet inspection and network behavioral analytics complement signature-based detection for comprehensive traffic monitoring.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-4(5)': {
    implementationStatement: `<p>The system alerts designated personnel when indications of compromise or potential compromise occur. Automated alerting rules in the SIEM platform generate notifications to the security operations center and ISSO when predefined indicators of compromise are detected. Alert thresholds and escalation procedures are documented and reviewed periodically to maintain effectiveness.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-5': {
    implementationStatement: `<p>The organization receives information system security alerts, advisories, and directives from external organizations, generates internal alerts and advisories as necessary, and disseminates information to appropriate personnel. The organization subscribes to threat intelligence feeds, government security bulletins, and vendor security advisories. Security advisories are evaluated for applicability and tracked through the vulnerability management process.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SI-6': {
    implementationStatement: `<p>The system verifies the correct operation of security functions, notifies designated personnel when anomalies are discovered, and takes defined actions when anomalies are discovered. Security function verification is performed at system startup, periodically during operation, and upon demand by authorized administrators. Failures of security functions are treated as security incidents and escalated accordingly.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-7': {
    implementationStatement: `<p>The organization employs integrity verification tools to detect unauthorized changes to software, firmware, and information. File integrity monitoring is implemented on all critical system files, executables, and configuration files. Unauthorized modifications detected by integrity monitoring generate immediate alerts to security personnel for investigation and remediation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-7(1)': {
    implementationStatement: `<p>The system performs an integrity check of defined software, firmware, and information at startup, at defined transitional states, or at a defined frequency. Automated integrity verification runs at system boot to validate the integrity of critical system components before operation commences. Integrity check failures prevent system operation and trigger an incident response notification.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-8': {
    implementationStatement: `<p>The organization employs spam protection mechanisms at system entry and exit points to detect and take action on unsolicited messages. Enterprise email filtering provides multi-layer spam and phishing protection including reputation-based filtering, content analysis, and attachment sandboxing. Spam protection mechanisms are updated automatically, and filtering policy effectiveness is reviewed periodically.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-10': {
    implementationStatement: `<p>The system checks the validity of defined information inputs. Input validation controls are implemented at the application layer to verify that user-supplied data conforms to expected formats, lengths, and value ranges. Invalid inputs are rejected, logged, and result in an appropriate error response without disclosing sensitive system information. Input validation controls are verified through application security testing.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },
  'SI-12': {
    implementationStatement: `<p>The organization manages and retains information within the system and information output from the system in accordance with applicable federal laws, directives, policies, regulations, standards, and operational requirements. Information retention schedules are defined in the organization's records management policy and enforced through technical controls and periodic review. Sensitive output is handled, marked, and disposed of in accordance with applicable handling requirements.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SI-16': {
    implementationStatement: `<p>The system implements non-executable memory protection to prevent execution of code in data regions. Data Execution Prevention (DEP) or equivalent hardware and operating system memory protection features are enabled on all system components. Address Space Layout Randomization (ASLR) is enabled to complement DEP protections and increase the difficulty of memory-based exploitation. These protections are verified through system configuration compliance scanning.</p>`,
    status: 'Implemented',
    implementationOrigin: 'System Specific',
  },

  // ── SR – Supply Chain Risk Management ─────────────────────────────────────

  'SR-1': {
    implementationStatement: `<p>The organization develops, documents, and disseminates a supply chain risk management policy addressing purpose, scope, roles, responsibilities, management commitment, coordination, and compliance. The policy is reviewed and updated annually or when significant changes to the supply chain environment occur. Supporting procedures address supplier evaluation, acquisition requirements, and ongoing monitoring of supply chain risks.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Common',
  },
  'SR-2': {
    implementationStatement: `<p>The organization develops a supply chain risk management plan, reviews and updates the plan annually, and protects the plan from unauthorized disclosure. The supply chain risk management plan identifies critical system components and services, key suppliers, potential supply chain threats, and risk mitigation strategies. The plan is coordinated with the organization's risk management framework and informs acquisition decisions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SR-3': {
    implementationStatement: `<p>The organization employs supply chain controls and processes to protect against supply chain risks throughout the system development lifecycle. Acquisition procedures require vendors to disclose supply chain information for critical components and to implement supply chain security practices. Counterfeit component risks are addressed through procurement from authorized distributors and component verification procedures.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SR-5': {
    implementationStatement: `<p>The organization employs acquisition strategies, contract tools, and procurement methods to protect against, identify, and mitigate supply chain risks. Contracts with suppliers of critical system components include security requirements addressing supply chain transparency, component integrity, and incident notification. Procurement processes validate supplier security practices prior to contract award for high-risk acquisitions.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SR-6': {
    implementationStatement: `<p>The organization requires that developers of the system employ processes and implement controls to identify, verify, and protect against potentially malicious content in designated system components. Developer supply chain requirements include software composition analysis, secure development environment controls, and build process integrity verification. Developers are required to provide a software bill of materials (SBOM) for critical components.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SR-8': {
    implementationStatement: `<p>The organization establishes notification agreements with entities involved in the supply chain for the system, system component, or system service regarding compromise of the supply chain and the insertion of counterfeit or malicious components. Supplier contracts include requirements for timely notification of supply chain security incidents affecting components delivered to the organization. Notification procedures align with the organization's incident response plan.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
  'SR-11': {
    implementationStatement: `<p>The organization employs analysis and testing procedures for validating that system components identified as requiring higher levels of protection are not counterfeit. Component verification procedures include visual inspection, electronic verification, and testing against manufacturer specifications for critical hardware and software components. Verified components are tracked through the configuration management system from receipt through installation.</p>`,
    status: 'Implemented',
    implementationOrigin: 'Hybrid',
  },
}
