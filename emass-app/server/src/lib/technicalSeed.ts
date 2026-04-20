// CRATER Technical Standard Library
// NIST 800-53 Rev 5 — Technical implementation statements
// References: Windows Registry, GPO paths, PowerShell, auditpol, netsh, BitLocker, STIG

export interface LibraryEntry {
  controlId: string
  controlTitle: string
  family: string
  implementationStatement: string
  implementationOrigin: string
  tailoringRequired: boolean
}

export const TECHNICAL_LIBRARY: LibraryEntry[] = [

  // ── AC – Access Control ───────────────────────────────────────────────────────

  {
    controlId: 'AC-1',
    controlTitle: 'Policy and Procedures',
    family: 'AC',
    implementationStatement: `<p>Access Control Policy is documented in SSP Appendix A, stored in the site-authenticated SharePoint library, and reviewed annually. Policy covers all account types, privilege levels, and remote access scenarios per NIST SP 800-53 Rev 5.</p><p><strong>Distribution:</strong> All users receive policy acknowledgment via onboarding workflow. Policy version is tracked in Git and synced to the Common Controls Repository (CCR).</p>`,
    implementationOrigin: 'Common',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-2',
    controlTitle: 'Account Management',
    family: 'AC',
    implementationStatement: `<p><strong>Technical Controls:</strong></p><ul>
<li><strong>Creation:</strong> <code>New-ADUser -SamAccountName $un -Enabled $true -ChangePasswordAtLogon $true -Department $dept -Manager (Get-ADUser $mgr)</code>; gMSA for services: <code>New-ADServiceAccount -Name "svc_$app" -PrincipalsAllowedToRetrieveManagedPassword $hostGroup</code></li>
<li><strong>35-Day Inactivity Disable:</strong> Scheduled Task (daily, SYSTEM): <code>Get-ADUser -Filter {(LastLogonDate -lt (Get-Date).AddDays(-35)) -and (Enabled -eq $true)} -Properties LastLogonDate | Disable-ADAccount</code></li>
<li><strong>Privilege Separation:</strong> Admin accounts use <code>adm_</code> prefix. GPO: <em>Computer Config → Windows Settings → Security Settings → Local Policies → User Rights Assignment → "Log on locally"</em> restricted to Administrators group. Registry: <code>HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\FilterAdministratorToken = 1 (DWORD)</code></li>
<li><strong>Termination:</strong> <code>Disable-ADAccount $upn; Move-ADObject $dn -TargetPath "OU=Terminated,OU=Users,DC=domain,DC=mil"</code> — executed within 1 hour of HR notification</li>
<li><strong>90-Day Privileged Review:</strong> <code>Get-ADGroupMember -Recursive "Domain Admins" | Get-ADUser -Properties LastLogonDate,Manager | Export-CSV privileged_review.csv</code> sent to ISSO</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-2(1)',
    controlTitle: 'Account Management | Automated System Account Management',
    family: 'AC',
    implementationStatement: `<p>Automated account management via Active Directory and Microsoft Entra ID. Automated workflows trigger on HR system integration events (ServiceNow → Graph API). Account creation, modification, and termination notifications are sent via Azure Logic Apps to the ISSO mailbox. Inactivity enforcement is automated via Scheduled Tasks on Domain Controllers.</p><p>PowerShell DSC enforces account policy state continuously: <code>Configuration ADAccountPolicy { Node $nodes { AccountPolicy Policy { ... } } }</code></p>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-3',
    controlTitle: 'Access Enforcement',
    family: 'AC',
    implementationStatement: `<p>Access enforcement implemented via Active Directory RBAC. File/resource permissions enforced through NTFS ACLs and GPO-driven security templates. SharePoint uses site-collection permissions tied to AD security groups.</p><ul>
<li><strong>NTFS:</strong> <code>icacls "D:\\data" /grant "DOMAIN\\AppUsers:(OI)(CI)RX" /remove Everyone</code></li>
<li><strong>Registry-based restrictions:</strong> <code>HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\RestrictRun</code></li>
<li><strong>GPO Software Restriction:</strong> <em>Computer Config → Windows Settings → Security Settings → Software Restriction Policies → Additional Rules</em></li>
<li><strong>AppLocker enforcement:</strong> <code>Set-AppLockerPolicy -PolicyObject $policy -Ldap "LDAP://OU=Servers,DC=domain,DC=mil"</code></li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-4',
    controlTitle: 'Information Flow Enforcement',
    family: 'AC',
    implementationStatement: `<p>Information flow control enforced via network segmentation, firewall rules, and VLAN isolation. Palo Alto firewall policy denies cross-zone traffic by default with explicit permit rules documented in the system's network diagram.</p><ul>
<li><strong>VLAN segmentation:</strong> Classified data on VLAN 10 (192.168.10.0/24), general on VLAN 20</li>
<li><strong>Windows Firewall GPO:</strong> <em>Computer Config → Windows Settings → Security Settings → Windows Defender Firewall with Advanced Security</em> — Inbound default: Block. Outbound default: Block for servers.</li>
<li><strong>netsh command:</strong> <code>netsh advfirewall set allprofiles firewallpolicy blockinbound,blockoutbound</code></li>
<li><strong>Inter-system connections:</strong> Governed by ISAs per NIST SP 800-47. Data flows documented in the SSP interconnection table.</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'AC-5',
    controlTitle: 'Separation of Duties',
    family: 'AC',
    implementationStatement: `<p>Separation of duties enforced through AD group membership restrictions. No single account belongs to both <code>Domain Admins</code> and <code>Backup Operators</code> simultaneously. Code deployments require both Developer and Release Manager approval via the CI/CD pipeline.</p><ul>
<li><strong>GPO enforcement:</strong> <em>User Rights Assignment → "Act as part of the operating system"</em> — assigned only to SYSTEM</li>
<li><strong>Audit separation:</strong> Log review role (<code>DOMAIN\\AuditReviewers</code>) has Read-Only access to SIEM; no write access to systems</li>
<li><strong>PowerShell check:</strong> <code>Get-ADUser -Filter * -Properties MemberOf | Where-Object { $_.MemberOf -match "Domain Admins" -and $_.MemberOf -match "Backup Operators" }</code> — should return empty</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-6',
    controlTitle: 'Least Privilege',
    family: 'AC',
    implementationStatement: `<p>Least privilege enforced via Active Directory tiered administration model (Microsoft Tier 0/1/2). Users have standard accounts only; privileged tasks require PAM-issued time-limited credentials.</p><ul>
<li><strong>Tier 0 (Domain Controllers):</strong> Only Tier 0 admin accounts (<code>t0_username</code>) permitted. Registry: <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\RunAsPPL = 1</code></li>
<li><strong>Privileged Access Workstations (PAW):</strong> Enforced via GPO Device Guard policies; Hyper-V VM for admin tasks</li>
<li><strong>UAC enforcement:</strong> <code>HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\EnableLUA = 1</code>, <code>ConsentPromptBehaviorAdmin = 2</code></li>
<li><strong>JIT access:</strong> Microsoft Entra PIM for Azure resources — eligible roles activated with approval and MFA for max 8 hours</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-7',
    controlTitle: 'Unsuccessful Logon Attempts',
    family: 'AC',
    implementationStatement: `<p>Account lockout enforced via GPO:</p><ul>
<li><strong>GPO Path:</strong> <em>Computer Configuration → Windows Settings → Security Settings → Account Policies → Account Lockout Policy</em></li>
<li><strong>Settings:</strong> Account lockout threshold: <strong>3 invalid attempts</strong>; Lockout duration: <strong>15 minutes</strong>; Reset counter after: <strong>15 minutes</strong></li>
<li><strong>secedit verification:</strong> <code>secedit /export /cfg C:\\audit\\security.cfg && findstr /i "LockoutBadCount" C:\\audit\\security.cfg</code></li>
<li><strong>Registry:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Services\\Netlogon\\Parameters\\MaximumPasswordAge</code></li>
<li><strong>STIG ID:</strong> WN10-AC-000015 (Windows 10), WN19-AC-000090 (Server 2019)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-8',
    controlTitle: 'System Use Notification',
    family: 'AC',
    implementationStatement: `<p>DoD-approved warning banner displayed at logon via GPO:</p><ul>
<li><strong>GPO Path:</strong> <em>Computer Configuration → Windows Settings → Security Settings → Local Policies → Security Options → Interactive logon: Message text for users attempting to log on</em></li>
<li><strong>Registry:</strong> <code>HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon\\LegalNoticeText</code> and <code>LegalNoticeCaption</code></li>
<li><strong>Banner text:</strong> "You are accessing a U.S. Government information system, which includes (1) this computer, (2) this computer network, (3) all computers connected to this network, and (4) all devices and storage media attached to this network or to a computer on this network..." [DoD Standard Banner]</li>
<li><strong>Web apps:</strong> Login page displays same banner; session cookie not set until user clicks "I Acknowledge"</li>
<li><strong>STIG ID:</strong> WN10-SO-000070, WN10-SO-000075</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-11',
    controlTitle: 'Device Lock',
    family: 'AC',
    implementationStatement: `<p>Screen lock after 15 minutes of inactivity enforced via GPO:</p><ul>
<li><strong>GPO Path:</strong> <em>User Configuration → Administrative Templates → Control Panel → Personalization → Enable screen saver: Enabled; Screen saver timeout: 900 seconds; Password protect the screen saver: Enabled</em></li>
<li><strong>Registry:</strong> <code>HKCU\\Control Panel\\Desktop\\ScreenSaverIsSecure = 1</code>; <code>ScreenSaveTimeOut = 900</code></li>
<li><strong>Pattern redaction:</strong> Blank screensaver enforced: <code>HKCU\\Control Panel\\Desktop\\SCRNSAVE.EXE = scrnsave.scr</code></li>
<li><strong>Mobile (Intune MDM):</strong> Device configuration profile → Device restrictions → Password → Maximum minutes of inactivity before screen locks: 5</li>
<li><strong>STIG ID:</strong> WN10-CC-000185</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-12',
    controlTitle: 'Session Termination',
    family: 'AC',
    implementationStatement: `<p>Idle sessions terminated after defined inactivity periods:</p><ul>
<li><strong>RDS/Terminal Server GPO:</strong> <em>Computer Config → Admin Templates → Windows Components → Remote Desktop Services → RD Session Host → Session Time Limits</em> — Set time limit for idle sessions: 15 minutes; Set time limit for disconnected sessions: 1 hour</li>
<li><strong>IIS Web Sessions:</strong> Web.config: <code>&lt;sessionState timeout="20" /&gt;</code>; FormsAuthentication slidingExpiration: false, timeout: 20 min</li>
<li><strong>SSH:</strong> <code>/etc/ssh/sshd_config</code> — <code>ClientAliveInterval 300</code>, <code>ClientAliveCountMax 0</code></li>
<li><strong>Windows Firewall:</strong> Stateful timeout for TCP: default 300 seconds</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'AC-14',
    controlTitle: 'Permitted Actions Without Identification or Authentication',
    family: 'AC',
    implementationStatement: `<p>No system functions are permitted without identification and authentication. Anonymous access is disabled at all tiers:</p><ul>
<li><strong>IIS:</strong> <code>Set-WebConfigurationProperty -Filter "system.webServer/security/authentication/anonymousAuthentication" -Name enabled -Value False</code></li>
<li><strong>Registry:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\RestrictAnonymous = 1</code>; <code>RestrictAnonymousSAM = 1</code></li>
<li><strong>GPO:</strong> <em>Security Options → Network access: Do not allow anonymous enumeration of SAM accounts: Enabled</em></li>
<li><strong>Public-facing content</strong> (static HTML only) is the sole exception, documented in SSP Section 10.2</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AC-17',
    controlTitle: 'Remote Access',
    family: 'AC',
    implementationStatement: `<p>Remote access is provided exclusively through DoD-approved VPN with MFA. Direct RDP to servers is prohibited from external networks.</p><ul>
<li><strong>VPN:</strong> Palo Alto GlobalProtect — GP gateway authenticates via RADIUS → AD + Duo MFA. Split tunneling: Disabled</li>
<li><strong>GPO — RDP:</strong> <em>Computer Config → Admin Templates → Windows Components → Remote Desktop Services → RD Session Host → Security → Require use of specific security layer for remote (RDP) connections: SSL</em>; NLA: Require Network Level Authentication: Enabled</li>
<li><strong>Registry NLA:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp\\UserAuthentication = 1</code></li>
<li><strong>Firewall:</strong> RDP (TCP 3389) blocked at perimeter; only permitted from PAM jump server subnet (10.0.50.0/24)</li>
<li><strong>STIG ID:</strong> WN19-CC-000380, WN19-CC-000390</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'AC-18',
    controlTitle: 'Wireless Access',
    family: 'AC',
    implementationStatement: `<p>Wireless access controlled via WPA3-Enterprise with 802.1X authentication (RADIUS → NPS → AD).</p><ul>
<li><strong>SSID configuration:</strong> All SSIDs use WPA3-Enterprise (AES-256); WEP/WPA/WPA2-PSK prohibited by GPO</li>
<li><strong>GPO:</strong> <em>Computer Config → Windows Settings → Security Settings → Wireless Network (IEEE 802.11) Policies</em> — auto-connect to approved SSIDs only; prohibited networks blocked</li>
<li><strong>NPS Policy:</strong> Connection Request Policy requires EAP-TLS with machine certificate; user certificate for BYOD</li>
<li><strong>Registry:</strong> <code>HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\Wireless\\GPTWirelessPolicy</code></li>
<li><strong>Rogue AP detection:</strong> Cisco WLC alarm threshold: 1 rogue AP detected → SIEM alert within 5 minutes</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'AC-20',
    controlTitle: 'Use of External Systems',
    family: 'AC',
    implementationStatement: `<p>External system connections governed by ISAs/MOUs. No government data processed on external systems without approval.</p><ul>
<li><strong>Approved external systems:</strong> Listed in SSP Appendix E (System Interconnection Table)</li>
<li><strong>GPO USB/removable media:</strong> <em>Computer Config → Admin Templates → System → Removable Storage Access → All Removable Storage classes: Deny all access: Enabled</em></li>
<li><strong>Registry:</strong> <code>HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\RemovableStorageDevices\\{53f56308-b6bf-11d0-94f2-00a0c91efb8b}\\Deny_All = 1 (DWORD)</code></li>
<li><strong>Cloud services:</strong> Conditional Access Policy blocks upload to personal OneDrive/Dropbox/Google Drive from managed devices</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },

  // ── AU – Audit and Accountability ─────────────────────────────────────────────

  {
    controlId: 'AU-1',
    controlTitle: 'Policy and Procedures',
    family: 'AU',
    implementationStatement: `<p>Audit and Accountability Policy documented in SSP Section 11. Policy mandates event logging, log retention, and SIEM integration. Reviewed annually per DISA STIG requirements.</p>`,
    implementationOrigin: 'Common',
    tailoringRequired: false,
  },
  {
    controlId: 'AU-2',
    controlTitle: 'Event Logging',
    family: 'AU',
    implementationStatement: `<p>Audit event categories configured via <code>auditpol</code> and GPO. All domain controllers and member servers log the following:</p><ul>
<li><strong>auditpol commands (applied via GPO Advanced Audit Policy):</strong></li>
<li><code>auditpol /set /subcategory:"Logon" /success:enable /failure:enable</code></li>
<li><code>auditpol /set /subcategory:"Account Logon" /success:enable /failure:enable</code></li>
<li><code>auditpol /set /subcategory:"Account Management" /success:enable /failure:enable</code></li>
<li><code>auditpol /set /subcategory:"Object Access" /success:enable /failure:enable</code></li>
<li><code>auditpol /set /subcategory:"Policy Change" /success:enable /failure:enable</code></li>
<li><code>auditpol /set /subcategory:"Privilege Use" /failure:enable</code></li>
<li><code>auditpol /set /subcategory:"System" /success:enable /failure:enable</code></li>
<li><code>auditpol /set /subcategory:"Process Creation" /success:enable</code></li>
<li><strong>GPO Path:</strong> <em>Computer Config → Windows Settings → Security Settings → Advanced Audit Policy Configuration</em></li>
<li><strong>STIG ID:</strong> WN19-AU-000010 through WN19-AU-000115</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AU-3',
    controlTitle: 'Content of Audit Records',
    family: 'AU',
    implementationStatement: `<p>Audit records contain: date/time (UTC), event type, user identity, source IP, target object, outcome (success/failure). Windows Event Log fields: TimeCreated, EventID, SubjectUserName, SubjectDomainName, IpAddress, ObjectName, KeywordsText.</p><p>Sysmon (System Monitor) deployed via GPO to all endpoints for enriched process creation, network, and registry event logging: <code>sysmon64.exe -accepteula -i sysmon-config.xml</code></p><p>Log forwarding via WEF (Windows Event Forwarding) to centralized collector: <code>wecutil cs collector-config.xml</code></p>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AU-4',
    controlTitle: 'Audit Log Storage Capacity',
    family: 'AU',
    implementationStatement: `<p>Audit log storage provisioned for 1-year online retention plus 2-year archive.</p><ul>
<li><strong>Windows Event Log sizes (GPO):</strong> Security log: 4,194,240 KB (4 GB); Application/System: 512,000 KB each</li>
<li><strong>GPO Path:</strong> <em>Computer Config → Admin Templates → Windows Components → Event Log Service → Security → Maximum Log Size: 4194240</em></li>
<li><strong>Registry:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Services\\EventLog\\Security\\MaxSize = 0x400000 (DWORD)</code></li>
<li><strong>SIEM storage:</strong> Splunk indexer retention: 365 days hot/warm, 730 days cold (S3 Glacier)</li>
<li><strong>Alert:</strong> Log volume > 80% capacity triggers SIEM alert to ISSO</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'AU-5',
    controlTitle: 'Response to Audit Logging Process Failures',
    family: 'AU',
    implementationStatement: `<p>System alerts when audit logging fails. Windows Security log "Audit Failure" event (Event ID 1102 — audit log cleared, Event ID 4612 — audit system failed) triggers SIEM alert.</p><ul>
<li><strong>GPO:</strong> <em>Security Options → Audit: Shut down system immediately if unable to log security audits: Enabled</em> (for high-security servers)</li>
<li><strong>Registry:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\CrashOnAuditFail = 1</code></li>
<li><strong>Splunk alert:</strong> <code>index=wineventlog EventCode=1102 OR EventCode=4612 | eval urgency="critical" | sendemail to="isso@domain.mil"</code></li>
<li><strong>Syslog failure:</strong> rsyslog template includes <code>ActionQueueFileName queue</code> with disk-assisted queue for 7-day failover buffer</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'AU-6',
    controlTitle: 'Audit Record Review, Analysis, and Reporting',
    family: 'AU',
    implementationStatement: `<p>Audit logs reviewed via Splunk SIEM with automated correlation rules. ISSO conducts weekly review; automated rules alert in real-time on critical events.</p><ul>
<li><strong>Splunk correlation rules:</strong> Failed logins >5 in 10 min, off-hours admin access, privilege escalation, lateral movement (mimikatz patterns)</li>
<li><strong>Review cadence:</strong> Real-time alerts → SIEM; weekly manual review → ISSO report; monthly → ISSM; annually → AO summary</li>
<li><strong>Report generation:</strong> <code>auditpol /report /v /type:user > audit_report.txt</code></li>
<li><strong>Log forwarding:</strong> All Windows hosts forward via WEF to Splunk Heavy Forwarder on port 9997 (TLS)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'AU-8',
    controlTitle: 'Time Stamps',
    family: 'AU',
    implementationStatement: `<p>All systems synchronized to authoritative NTP sources (USNO or DoD GPS-disciplined NTP servers). Time stored as UTC in all audit records.</p><ul>
<li><strong>W32tm configuration (Domain Members):</strong> <code>w32tm /config /syncfromflags:domhier /update</code></li>
<li><strong>Domain Controller NTP:</strong> <code>w32tm /config /manualpeerlist:"tick.usno.navy.mil ntps1.aoc.nrao.edu" /syncfromflags:manual /reliable:YES /update</code></li>
<li><strong>GPO:</strong> <em>Computer Config → Admin Templates → System → Windows Time Service → Configure Windows NTP Client: Enabled; NtpServer: [PDC FQDN],0x9</em></li>
<li><strong>Registry:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Services\\W32Time\\Config\\MaxPosPhaseCorrection = 3600</code></li>
<li><strong>Accuracy requirement:</strong> ±1 second of UTC; time skew > 300 seconds triggers Kerberos authentication failure</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AU-9',
    controlTitle: 'Protection of Audit Information',
    family: 'AU',
    implementationStatement: `<p>Audit logs protected from unauthorized access, modification, and deletion.</p><ul>
<li><strong>GPO:</strong> <em>Security Options → Manage auditing and security log</em> — restricted to Administrators and Audit Review group only</li>
<li><strong>NTFS ACL on log directory:</strong> <code>icacls "C:\\Windows\\System32\\winevt\\Logs" /grant "SYSTEM:(OI)(CI)F" /grant "Administrators:(OI)(CI)R" /remove Everyone</code></li>
<li><strong>Registry:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Services\\EventLog\\Security\\RestrictGuestAccess = 1</code></li>
<li><strong>SIEM log integrity:</strong> Splunk index signing enabled; hashed event pipeline with SHA-256. Log tampering triggers alert Event ID 4612</li>
<li><strong>Immutable archive:</strong> Logs shipped to S3 with Object Lock (Compliance Mode, 3-year retention)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'AU-11',
    controlTitle: 'Audit Record Retention',
    family: 'AU',
    implementationStatement: `<p>Audit records retained for 3 years (1 year online in SIEM, 2 years cold archive) per NARA GRS 5.2.</p><ul>
<li><strong>Online retention (Splunk):</strong> Hot/warm: 365 days; Cold: additional 365 days on local storage</li>
<li><strong>Archive:</strong> Year 2-3: AWS S3 Glacier Instant Retrieval with S3 Object Lock (Compliance, 1095 days)</li>
<li><strong>Verification:</strong> Monthly <code>splunk search "index=wineventlog earliest=-366d latest=-365d | stats count" </code> to verify archive integrity</li>
<li><strong>Windows Event Log backup:</strong> <code>wevtutil epl Security C:\\backup\\security_$date.evtx</code> — automated weekly via Task Scheduler</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'AU-12',
    controlTitle: 'Audit Record Generation',
    family: 'AU',
    implementationStatement: `<p>All auditable events defined in AU-2 are generated by the system components listed in the SSP Appendix D (Asset Inventory). Log generation verified via auditpol reports.</p><ul>
<li><strong>Verification command:</strong> <code>auditpol /get /category:* | Out-File C:\\audit\\policy_verification.txt</code></li>
<li><strong>Sysmon events generated:</strong> Event ID 1 (Process Create), 3 (Network Conn), 7 (Image Loaded), 10 (Process Access), 11 (File Create), 13 (Registry Value Set), 22 (DNS Query)</li>
<li><strong>Application logging:</strong> Custom application events forwarded to Application Event Log (Event Source: AppName, EventID range: 4000-4999)</li>
<li><strong>GPO enforcement:</strong> <em>Computer Config → Windows Settings → Security Settings → Advanced Audit Policy</em> — all subcategories as defined in AU-2</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },

  // ── CM – Configuration Management ─────────────────────────────────────────────

  {
    controlId: 'CM-1',
    controlTitle: 'Policy and Procedures',
    family: 'CM',
    implementationStatement: `<p>Configuration Management Policy is documented in the Configuration Management Plan (CMP) and SSP Section 12. Policy mandates STIG/CIS compliance, change control board (CCB) review, and baseline configuration management using SCCM/Intune.</p>`,
    implementationOrigin: 'Common',
    tailoringRequired: false,
  },
  {
    controlId: 'CM-2',
    controlTitle: 'Baseline Configuration',
    family: 'CM',
    implementationStatement: `<p>Baseline configurations maintained per DISA STIG and CIS Benchmark Level 2. Baseline enforced via GPO and PowerShell DSC. Configuration drift is detected automatically.</p><ul>
<li><strong>STIG baseline applied via:</strong> DISA STIG Viewer, SCAP Compliance Checker (SCC), and custom PowerShell DSC scripts</li>
<li><strong>GPO baseline import:</strong> <code>Import-GPO -BackupGpoName "STIG-Baseline-Server2019" -Path "C:\\GPO_Backups" -TargetName "STIG-Server2019"</code></li>
<li><strong>Baseline snapshot:</strong> <code>secedit /export /cfg C:\\baseline\\current_security.cfg /log C:\\baseline\\export.log</code></li>
<li><strong>DSC baseline check:</strong> <code>Test-DscConfiguration -Detailed | Where-Object { $_.ResourcesNotInDesiredState }</code></li>
<li><strong>SCAP scan schedule:</strong> Weekly SCAP scans via SCC; results uploaded to eMASS within 72 hours</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'CM-6',
    controlTitle: 'Configuration Settings',
    family: 'CM',
    implementationStatement: `<p>Configuration settings enforce DISA STIG requirements across all system components. Critical settings include:</p><ul>
<li><strong>Windows Defender:</strong> <code>Set-MpPreference -DisableRealtimeMonitoring $false; Set-MpPreference -SignatureUpdateInterval 4</code></li>
<li><strong>PowerShell execution policy:</strong> <code>Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine</code> (GPO: <em>Admin Templates → Windows Components → Windows PowerShell → Turn on Script Execution</em>)</li>
<li><strong>SMB v1 disabled:</strong> <code>Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force</code></li>
<li><strong>LLMNR disabled:</strong> <code>HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient\\EnableMulticast = 0</code></li>
<li><strong>NTLM restrictions:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\LmCompatibilityLevel = 5</code> (NTLMv2 only)</li>
<li><strong>AutoRun disabled:</strong> <code>HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\NoDriveTypeAutoRun = 0xFF</code></li>
<li><strong>STIG ID examples:</strong> WN19-CC-000030 (SMB v1), WN19-CC-000060 (LLMNR), WN19-SO-000010 (LmCompatibility)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'CM-7',
    controlTitle: 'Least Functionality',
    family: 'CM',
    implementationStatement: `<p>Unnecessary services, ports, protocols disabled. AppLocker enforces allowlisting.</p><ul>
<li><strong>Services disabled via PowerShell:</strong> <code>Stop-Service Fax,TapiSrv,Telnet,SSDPSRV,upnphost -Force; Set-Service Fax,TapiSrv -StartupType Disabled</code></li>
<li><strong>AppLocker (Executable Rules):</strong> <em>Computer Config → Windows Settings → Security Settings → Application Control Policies → AppLocker</em> — Allow: <code>%PROGRAMFILES%\\*</code>, <code>%WINDIR%\\*</code>; Block: everything else. Enforcement via <code>Set-AppLockerPolicy -PolicyObject $policy -Merge</code></li>
<li><strong>Ports blocked (netsh):</strong> <code>netsh advfirewall firewall add rule name="Block Telnet" protocol=TCP dir=in localport=23 action=block</code></li>
<li><strong>Windows Features removed:</strong> <code>Get-WindowsFeature | Where-Object { $_.Installed -and $_.Name -in @("TFTP-Client","Telnet-Client","SMB1Protocol") } | Remove-WindowsFeature</code></li>
<li><strong>STIG ID:</strong> WN19-00-000390 (Telnet client), WN19-00-000400 (TFTP)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'CM-8',
    controlTitle: 'System Component Inventory',
    family: 'CM',
    implementationStatement: `<p>Hardware and software inventory maintained in SCORVA Asset Management (PostgreSQL <code>workstations</code> table) and Microsoft SCCM for managed endpoints.</p><ul>
<li><strong>SCCM discovery:</strong> Active Directory System Discovery runs every 24 hours; Heartbeat Discovery every 7 days</li>
<li><strong>PowerShell inventory export:</strong> <code>Get-ADComputer -Filter * -Properties OperatingSystem,LastLogonDate,IPv4Address | Export-CSV inventory.csv</code></li>
<li><strong>Software inventory (SCCM):</strong> Software metering and AI scanning enabled; reports to SCORVA via API sync every 24 hours</li>
<li><strong>Hardware changes:</strong> BIOS asset tag configured: <code>wmic bios get serialnumber</code> → linked to SCORVA assetTag field</li>
<li><strong>Review cadence:</strong> Monthly reconciliation between SCCM inventory and SCORVA; discrepancies reported to ISSO within 72 hours</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },

  // ── IA – Identification and Authentication ─────────────────────────────────────

  {
    controlId: 'IA-1',
    controlTitle: 'Policy and Procedures',
    family: 'IA',
    implementationStatement: `<p>Identification and Authentication Policy documented in SSP Section 13 and enforced via Active Directory password policies, PIV enforcement GPOs, and MFA Conditional Access Policies. Policy reviewed annually.</p>`,
    implementationOrigin: 'Common',
    tailoringRequired: false,
  },
  {
    controlId: 'IA-2',
    controlTitle: 'Identification and Authentication (Organizational Users)',
    family: 'IA',
    implementationStatement: `<p>All organizational users authenticate with MFA. PIV/CAC required for privileged access; FIDO2 YubiKey for workstations without CAC readers.</p><ul>
<li><strong>Smart Card GPO:</strong> <em>Computer Config → Windows Settings → Security Settings → Local Policies → Security Options → Interactive logon: Require smart card: Enabled</em></li>
<li><strong>Registry (Smart Card):</strong> <code>HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\ScForceOption = 1 (DWORD)</code></li>
<li><strong>Entra ID MFA (Conditional Access):</strong> Policy requires MFA for all apps from all locations. PowerShell: <code>New-MgIdentityConditionalAccessPolicy -BodyParameter @{displayName="Require MFA"; state="enabled"; ...}</code></li>
<li><strong>RADIUS/NPS:</strong> NPS Extension for Duo/Azure MFA on VPN authentication chain</li>
<li><strong>PKINIT (Kerberos + PKI):</strong> CA issues Smart Card Logon certificates; KDC validates against AD CS</li>
<li><strong>STIG ID:</strong> WN19-SO-000380, WN10-SO-000215</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'IA-3',
    controlTitle: 'Device Identification and Authentication',
    family: 'IA',
    implementationStatement: `<p>Devices authenticate to the network using machine certificates (802.1X / EAP-TLS) before user authentication. Unmanaged devices cannot join network segments with sensitive data.</p><ul>
<li><strong>802.1X machine auth:</strong> NPS Connection Request Policy: authentication method = EAP (Smart Card or other certificate); machine certificate from AD CS auto-enrollment</li>
<li><strong>GPO auto-enrollment:</strong> <em>Computer Config → Windows Settings → Security Settings → Public Key Policies → Certificate Services Client - Auto-Enrollment: Enabled, Update expired, Renew expired</em></li>
<li><strong>Network Access Protection:</strong> NAP enforcement via DHCP / VPN for health checks: <code>netsh nap client show config</code></li>
<li><strong>IoT/OT devices:</strong> Static MAC reservation in DHCP + port security on switches (Cisco: <code>switchport port-security maximum 1; switchport port-security violation restrict</code>)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'IA-4',
    controlTitle: 'Identifier Management',
    family: 'IA',
    implementationStatement: `<p>User identifiers managed via Active Directory. Identifier uniqueness enforced by AD schema; SAMAccountName must be unique within domain.</p><ul>
<li><strong>Identifier format:</strong> Standard users: <code>first.last</code>; Admins: <code>adm.first.last</code>; Service: <code>svc.appname</code></li>
<li><strong>Identifier reuse prevention:</strong> AD DS prevents SAMAccountName reuse even after account deletion (SID history). PowerShell check: <code>Get-ADUser -Filter {SamAccountName -eq $username} -IncludeDeletedObjects</code></li>
<li><strong>Identifier review:</strong> Quarterly report of all identifiers: <code>Get-ADUser -Filter * -Properties DistinguishedName,Created,LastLogonDate | Export-CSV identifiers.csv</code></li>
<li><strong>External identifiers (non-org users):</strong> Provisioned in dedicated OU (OU=External,OU=Users,DC=domain,DC=mil) with expiration dates enforced by Account Expires attribute</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'IA-5',
    controlTitle: 'Authenticator Management',
    family: 'IA',
    implementationStatement: `<p>Password and authenticator management enforced via GPO Fine-Grained Password Policies (FGPP) and YubiKey/PIV lifecycle management.</p><ul>
<li><strong>Password policy (FGPP for all users):</strong> MinPasswordLength: 15; PasswordHistoryCount: 24; MaxPasswordAge: 60 days; ComplexityEnabled: True</li>
<li><strong>FGPP PowerShell:</strong> <code>New-ADFineGrainedPasswordPolicy -Name "HighSecurity" -Precedence 1 -MinPasswordLength 15 -PasswordHistoryCount 24 -MaxPasswordAge "60.00:00:00" -ComplexityEnabled $true</code></li>
<li><strong>YubiKey lifecycle:</strong> SCORVA YubiKey table tracks serial, issued date, keyExpiry, assigned username. Expired keys auto-flagged in SCORVA dashboard.</li>
<li><strong>PIV PIN management:</strong> PIV PIN reset requires in-person identity verification. Pin complexity: 8-digit numeric min.</li>
<li><strong>Initial provisioning:</strong> Passwords communicated out-of-band (secure email or phone); force change at first logon enforced</li>
<li><strong>STIG ID:</strong> WN19-AC-000030 (min length), WN19-AC-000060 (history), WN19-AC-000070 (max age)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'IA-6',
    controlTitle: 'Authentication Feedback',
    family: 'IA',
    implementationStatement: `<p>Authentication feedback is obscured during the logon process. Passwords are masked; error messages do not distinguish between invalid username and invalid password.</p><ul>
<li><strong>Generic error message:</strong> Windows displays "The user name or password is incorrect" for all failed logon attempts</li>
<li><strong>GPO:</strong> <em>Security Options → Interactive logon: Do not display last user name: Enabled</em></li>
<li><strong>Registry:</strong> <code>HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\DontDisplayLastUserName = 1</code></li>
<li><strong>Web applications:</strong> HTTP 401 returned without specific field identification; OWASP Authentication Cheat Sheet implemented in app code</li>
<li><strong>STIG ID:</strong> WN10-SO-000050</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'IA-7',
    controlTitle: 'Cryptographic Module Authentication',
    family: 'IA',
    implementationStatement: `<p>Cryptographic modules validated to FIPS 140-3 (or 140-2 where 140-3 not yet available) for all authentication mechanisms.</p><ul>
<li><strong>FIPS mode GPO:</strong> <em>Computer Config → Windows Settings → Security Settings → Local Policies → Security Options → System cryptography: Use FIPS compliant algorithms for encryption, hashing, and signing: Enabled</em></li>
<li><strong>Registry:</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\FIPSAlgorithmPolicy\\Enabled = 1 (DWORD)</code></li>
<li><strong>.NET FIPS enforcement:</strong> <code>runtime → enforceFIPSPolicy = true</code> in machine.config</li>
<li><strong>Validated modules:</strong> Windows CNG (Certificate #4825), BitLocker (#4827), RDP TLS (#4828) — all FIPS 140-2 Level 1</li>
<li><strong>PIV/CAC smartcards:</strong> Use NSS3/PKCS#11 validated modules for cryptographic operations</li>
<li><strong>STIG ID:</strong> WN19-SO-000230</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'IA-8',
    controlTitle: 'Identification and Authentication (Non-Organizational Users)',
    family: 'IA',
    implementationStatement: `<p>Non-organizational users (contractors, partners) authenticate via federated identity (SAML 2.0 / AD FS) or guest accounts with MFA. No shared accounts permitted.</p><ul>
<li><strong>AD FS federation:</strong> Relying Party Trust configured for partner IdP; claims rules map external identity to local role</li>
<li><strong>Guest accounts:</strong> Provisioned in <code>OU=External,DC=domain,DC=mil</code> with AccountExpires set. MFA required via NPS/Duo</li>
<li><strong>Conditional Access (Entra ID):</strong> External user policy: Require MFA + Compliant Device for all cloud app access</li>
<li><strong>ICAM federation:</strong> PIV-I credentials accepted via FPKI trust anchor chain for cross-agency authentication</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },

  // ── SC – System and Communications Protection ─────────────────────────────────

  {
    controlId: 'SC-1',
    controlTitle: 'Policy and Procedures',
    family: 'SC',
    implementationStatement: `<p>System and Communications Protection Policy documented in SSP Section 15. Policy mandates TLS 1.2+ for all data in transit, FIPS-approved ciphers, boundary protection, and encryption at rest for sensitive data. Reviewed annually.</p>`,
    implementationOrigin: 'Common',
    tailoringRequired: false,
  },
  {
    controlId: 'SC-5',
    controlTitle: 'Denial of Service Protection',
    family: 'SC',
    implementationStatement: `<p>DoS protection implemented at network perimeter and application layer.</p><ul>
<li><strong>Windows firewall rate-limiting:</strong> <code>netsh advfirewall firewall add rule name="Block DoS SYN" protocol=TCP dir=in localport=80,443 action=block</code> (supplemented by perimeter firewall rate-limit rules)</li>
<li><strong>TCP/IP stack hardening (Registry):</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\SynAttackProtect = 1</code>; <code>TcpMaxSynRetransmissions = 2</code>; <code>EnableDeadGWDetect = 0</code></li>
<li><strong>IIS Request Limits:</strong> <code>Set-WebConfigurationProperty -Filter "system.webServer/security/requestFiltering/requestLimits" -Name maxAllowedContentLength -Value 4194304</code></li>
<li><strong>Perimeter:</strong> Palo Alto Threat Prevention profile with DoS protection policy and zone-based rate limits</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'SC-7',
    controlTitle: 'Boundary Protection',
    family: 'SC',
    implementationStatement: `<p>Network boundary enforced via defense-in-depth perimeter architecture: Palo Alto NGFW + IDS/IPS + Web Application Firewall (WAF) + host-based Windows Defender Firewall.</p><ul>
<li><strong>Windows Firewall GPO profile (Domain):</strong> Inbound: Block; Outbound: Block with explicit allow rules for required traffic</li>
<li><strong>Perimeter DMZ:</strong> Publicly accessible services placed in DMZ (VLAN 100); internal application servers on App VLAN (VLAN 200); DB on Data VLAN (VLAN 300)</li>
<li><strong>Registry (ICMPv4 disable):</strong> Configured via GPO; <code>netsh advfirewall firewall add rule name="Block ICMP" protocol=icmpv4:8,any dir=in action=block</code> (except from monitoring subnet)</li>
<li><strong>Egress filtering:</strong> Only approved outbound traffic (ports 80, 443, 53, 123) permitted; all else blocked and logged</li>
<li><strong>STIG ID:</strong> WN19-FW-000020, WN19-FW-000025</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'SC-8',
    controlTitle: 'Transmission Confidentiality and Integrity',
    family: 'SC',
    implementationStatement: `<p>All data in transit encrypted using TLS 1.2 or TLS 1.3. Weak protocols (SSL 3.0, TLS 1.0, TLS 1.1) disabled system-wide.</p><ul>
<li><strong>IIS TLS enforcement:</strong> <code>Set-WebConfigurationProperty -Filter "system.webServer/security/access" -Name sslFlags -Value "Ssl,SslNegotiateCert,SslRequireCert,Ssl128"</code></li>
<li><strong>Registry (disable TLS 1.0):</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.0\\Server\\Enabled = 0</code>; <code>TLS 1.0\\Client\\Enabled = 0</code></li>
<li><strong>Registry (enable TLS 1.3):</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols\\TLS 1.3\\Server\\Enabled = 1</code></li>
<li><strong>Cipher suite GPO:</strong> <em>Computer Config → Admin Templates → Network → SSL Configuration Settings → SSL Cipher Suite Order</em> — only FIPS-approved suites: TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384, TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256</li>
<li><strong>STIG ID:</strong> WN19-CC-000500 (TLS 1.0 disabled), WN19-CC-000510 (TLS 1.1 disabled)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'SC-12',
    controlTitle: 'Cryptographic Key Establishment and Management',
    family: 'SC',
    implementationStatement: `<p>Cryptographic keys managed via Microsoft AD Certificate Services (AD CS) PKI and DoD PKI (DISA/NSS). Key lifecycle: generation → issuance → storage → rotation → revocation.</p><ul>
<li><strong>Key generation:</strong> RSA-4096 for CA certificates; RSA-2048 or ECDSA P-256 for end-entity certs</li>
<li><strong>CA hierarchy:</strong> Two-tier: Offline Root CA (air-gapped) → Issuing CA (online, AD-integrated)</li>
<li><strong>Certificate enrollment:</strong> Auto-enrollment via GPO: <em>Computer Config → Windows Settings → Security Settings → Public Key Policies → Certificate Services Client - Auto-Enrollment</em></li>
<li><strong>CRL/OCSP:</strong> CRL published every 24 hours; OCSP responder with 1-hour cache. Verified: <code>certutil -verify -urlfetch certificate.cer</code></li>
<li><strong>Key storage:</strong> Private keys stored in TPM 2.0 (HKLM key attestation); CA private keys in HSM (nCipher nShield)</li>
<li><strong>Rotation:</strong> TLS certificates renewed 30 days before expiry via automated Let's Encrypt (internal) / ACME workflow</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'SC-13',
    controlTitle: 'Cryptographic Protection',
    family: 'SC',
    implementationStatement: `<p>FIPS 140-3 validated cryptographic modules used for all cryptographic operations. Non-FIPS algorithms prohibited.</p><ul>
<li><strong>FIPS mode enabled (Registry):</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa\\FIPSAlgorithmPolicy\\Enabled = 1</code></li>
<li><strong>GPO enforcement:</strong> <em>Security Options → System cryptography: Use FIPS compliant algorithms: Enabled</em></li>
<li><strong>Approved algorithms:</strong> AES-256-GCM (symmetric), SHA-256/384/512 (hash), RSA-3072+/ECDSA P-384 (asymmetric), ECDH P-384 (key agreement)</li>
<li><strong>Prohibited:</strong> DES, 3DES, RC4, MD5, SHA-1, RSA < 2048-bit — blocked by FIPS mode and cipher suite restrictions</li>
<li><strong>BitLocker:</strong> AES-256-XTS validated under FIPS 140-2 Certificate #4827</li>
<li><strong>STIG ID:</strong> WN19-SO-000230 (FIPS), WN19-CC-000460 (cipher suites)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: false,
  },
  {
    controlId: 'SC-28',
    controlTitle: 'Protection of Information at Rest',
    family: 'SC',
    implementationStatement: `<p>Data at rest encrypted using BitLocker (AES-256-XTS) on all Windows endpoints and servers. Database encryption via SQL Server Transparent Data Encryption (TDE).</p><ul>
<li><strong>BitLocker enablement (PowerShell):</strong> <code>Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -RecoveryPasswordProtector -SkipHardwareTest</code></li>
<li><strong>BitLocker GPO:</strong> <em>Computer Config → Admin Templates → Windows Components → BitLocker Drive Encryption → Operating System Drives → Require additional authentication at startup: Enabled; Configure TPM startup PIN: Require startup PIN with TPM</em></li>
<li><strong>Recovery key backup:</strong> <code>Backup-BitLockerKeyProtector -MountPoint "C:" -KeyProtectorId $keyId | Invoke-Command { BackupToAAD-BitLockerKeyProtector }</code> — stored in Entra ID</li>
<li><strong>SQL TDE:</strong> <code>ALTER DATABASE [AppDB] SET ENCRYPTION ON; CREATE DATABASE ENCRYPTION KEY WITH ALGORITHM = AES_256</code></li>
<li><strong>PostgreSQL:</strong> Full disk encryption on underlying volume via OS BitLocker/dm-crypt; pg_crypto extension for column-level encryption of PII</li>
<li><strong>STIG ID:</strong> WN10-00-000005 (BitLocker), WN19-00-000005</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },

  // ── SI – System and Information Integrity ─────────────────────────────────────

  {
    controlId: 'SI-1',
    controlTitle: 'Policy and Procedures',
    family: 'SI',
    implementationStatement: `<p>System and Information Integrity Policy documented in SSP Section 16. Policy mandates patch management (WSUS/SCCM), malware protection (Windows Defender + EDR), and system monitoring (SIEM). Reviewed annually.</p>`,
    implementationOrigin: 'Common',
    tailoringRequired: false,
  },
  {
    controlId: 'SI-2',
    controlTitle: 'Flaw Remediation',
    family: 'SI',
    implementationStatement: `<p>Vulnerability remediation managed via WSUS/SCCM patch management with defined SLAs: Critical/High — 30 days; Medium — 90 days; Low — 180 days.</p><ul>
<li><strong>WSUS approval automation (PowerShell):</strong> <code>Get-WsusUpdate -Classification Critical -Approval Unapproved | Approve-WsusUpdate -Action Install -TargetGroupName "Production Servers"</code></li>
<li><strong>SCCM deployment:</strong> Software Update deployment type: Required; Deadline: 30 days for Critical; Maintenance window: Sundays 02:00-06:00 UTC</li>
<li><strong>Verification:</strong> <code>Get-HotFix | Sort-Object -Property InstalledOn -Descending | Select-Object -First 20</code></li>
<li><strong>Third-party patching:</strong> Ivanti Patch Management (or Chocolatey for open-source) handles non-Microsoft patches</li>
<li><strong>Vulnerability scanning:</strong> Tenable.sc scans weekly; findings imported to eMASS POAM within 72 hours of scan completion</li>
<li><strong>Registry (WU policy):</strong> <code>HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU\\NoAutoUpdate = 0</code>; <code>AUOptions = 4</code> (auto-download, notify before install)</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'SI-3',
    controlTitle: 'Malicious Code Protection',
    family: 'SI',
    implementationStatement: `<p>Multi-layered malware protection: Windows Defender Antivirus + Microsoft Defender for Endpoint (EDR) on all endpoints and servers. CrowdStrike Falcon deployed as secondary EDR.</p><ul>
<li><strong>Defender real-time protection (PowerShell):</strong> <code>Set-MpPreference -DisableRealtimeMonitoring $false; Set-MpPreference -SignatureUpdateInterval 4; Set-MpPreference -CloudBlockLevel High; Set-MpPreference -MAPSReporting Advanced</code></li>
<li><strong>GPO settings:</strong> <em>Computer Config → Admin Templates → Windows Components → Microsoft Defender Antivirus → Real-time Protection</em> — all protections enabled; <em>Scan → Specify the scan type to use: Full Scan</em> weekly</li>
<li><strong>Registry:</strong> <code>HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection\\DisableRealtimeMonitoring = 0</code></li>
<li><strong>Definition updates:</strong> WSUS distributes Defender definitions within 4 hours of Microsoft release</li>
<li><strong>EDR alerts:</strong> Defender for Endpoint alerts forwarded to SIEM via Microsoft Sentinel connector; Critical alerts page on-call security analyst within 15 minutes</li>
<li><strong>STIG ID:</strong> WN10-00-000095 (Defender enabled), WN19-00-000100</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'SI-4',
    controlTitle: 'System Monitoring',
    family: 'SI',
    implementationStatement: `<p>Continuous system monitoring via Splunk SIEM ingesting Windows Event Logs (via WEF), Sysmon, firewall logs, and application logs. Automated alerts for anomalous behavior.</p><ul>
<li><strong>WEF Subscription:</strong> Collector-initiated; subscriptions for Security, System, Application, Sysmon channels from all domain-joined endpoints</li>
<li><strong>Sysmon deployment:</strong> <code>sysmon64.exe -accepteula -i sysmon-config.xml</code> via GPO computer startup script</li>
<li><strong>SIEM alert rules (examples):</strong> Lateral movement (pass-the-hash, EventID 4624 Type 3 + 4648), Privilege escalation (EventID 4672), Scheduled task creation (EventID 4698), LSASS access (Sysmon EventID 10)</li>
<li><strong>Network monitoring:</strong> Zeek/Bro IDS on network tap; alerts forwarded to Splunk via syslog UDP 514</li>
<li><strong>Endpoint detection:</strong> Microsoft Defender for Endpoint behavioral analytics; CrowdStrike Falcon for additional coverage</li>
<li><strong>Monitoring coverage:</strong> 100% of production systems covered; confirmed via WEF subscription status report weekly</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'SI-5',
    controlTitle: 'Security Alerts, Advisories, and Directives',
    family: 'SI',
    implementationStatement: `<p>Security alerts received from CISA (US-CERT), NSA, DISA, and Microsoft Security Response Center. Processed per the Incident Response Plan.</p><ul>
<li><strong>Alert sources:</strong> CISA alerts.cisa.gov RSS feed (auto-imported to SIEM); Microsoft MSRC Security Update Guide; DISA STIG/IAVM notifications</li>
<li><strong>IAVM compliance:</strong> IAVM notices tracked in eMASS; patches applied within IAVM SLA (CAT I: 21 days, CAT II: 30 days, CAT III: 180 days)</li>
<li><strong>Dissemination:</strong> ISSO receives daily digest; critical alerts (CISA Known Exploited Vulnerabilities catalog additions) trigger immediate notification to ISSO/ISSM via email and Teams</li>
<li><strong>PowerShell alert check:</strong> <code>Invoke-RestMethod -Uri "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" | Where-Object { $_.cveID -in $systemCVEs }</code></li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
  {
    controlId: 'SI-7',
    controlTitle: 'Software, Firmware, and Information Integrity',
    family: 'SI',
    implementationStatement: `<p>Software and firmware integrity verified via Windows Defender Application Control (WDAC) and Secure Boot. Code signing enforced for all deployed software.</p><ul>
<li><strong>WDAC policy:</strong> <code>New-CIPolicy -Level Publisher -Fallback Hash -FilePath WDACPolicy.xml; ConvertFrom-CIPolicy WDACPolicy.xml WDACPolicy.bin; Copy-Item WDACPolicy.bin "$env:SystemRoot\\System32\\CodeIntegrity\\SIPolicy.p7b"</code></li>
<li><strong>Secure Boot:</strong> UEFI Secure Boot enabled (GPO enforced via BitLocker pre-boot authentication). Verified: <code>Confirm-SecureBootUEFI</code> returns True</li>
<li><strong>Registry (WDAC):</strong> <code>HKLM\\SYSTEM\\CurrentControlSet\\Control\\CodeIntegrity\\SkipInvalidContracts = 0</code></li>
<li><strong>File integrity monitoring:</strong> Tripwire/AIDE or Windows FIM (Defender for Endpoint) monitors System32, Program Files; alerts on unauthorized changes</li>
<li><strong>Code signing requirement:</strong> PowerShell: <em>ExecutionPolicy RemoteSigned</em> + all internal scripts signed with internal CA code-signing certificate</li>
<li><strong>STIG ID:</strong> WN10-00-000020 (Secure Boot), WN19-CC-000530</li></ul>`,
    implementationOrigin: 'System Specific',
    tailoringRequired: true,
  },
]
