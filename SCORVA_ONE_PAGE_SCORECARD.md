# SCORVA One-Page Scorecard

Date: April 22, 2026

## Current Score

Estimated overall completion against the current SCORVA requirements baseline: **68%**

- Done: **4 / 27**
- Partially done: **22 / 27**
- Not done yet: **1 / 27**

This score reflects the current codebase and database work completed in this repo, including recent SCORVA feature additions. It does not depend on older Azure Container App revisions that may still be serving a previous frontend bundle until the newest image revision is active.

## What Was Added

Recent work materially improved SCORVA in four areas:

- **Security Events module**
  Added event tracking, severity/status handling, CRUD flows, and basic correlation logic that auto-generates notifications when repeated events arrive from the same source within a 24-hour window.

- **Corporate Admin Program View**
  Added a cross-site aggregated view for Corporate Admin users, with totals and per-site comparisons for controls, POA&Ms, ATOs, and security events.

- **POA&M risk-response data**
  Added `riskDecision` and `riskRationale` support so risk-response documentation can now be stored directly with POA&M records.

- **POA&M aging notifications**
  Added scheduled notification logic for upcoming and overdue POA&Ms, improving remediation visibility.

## What Is Fully Met

- **Security control monitoring**
  SCORVA provides a working control library, implementation status tracking, ConMon metadata, baseline-aware fields, and related workflows.

- **POA&M and remediation tracking**
  SCORVA supports POA&M CRUD, task linkage, milestone handling, status sync, and aging notifications.

- **Auditability**
  CRUD and auth activity are broadly audit-logged with user, action, timestamp, detail, and site scope.

- **Usability for ISSO/ISSM users**
  The application is organized into clear mission modules with role-aware access and practical workflows.

## What Is Still Missing or Partial

The biggest gaps are not in core CRUD anymore. They are in maturity, automation, and enterprise depth:

- **Automation**
  No automated asset discovery, no scanner-driven ingestion, and no true baseline drift detection.

- **Advanced analytics**
  Program view exists, but there are no long-term trend analytics, heatmaps, or configurable risk scoring formulas.

- **Formal risk workflow**
  Risk response data exists, but there is no formal mitigate/accept/transfer/avoid workflow with approvals and lifecycle states.

- **Compliance packaging**
  Excel exports exist, but there is no one-click evidence package or ATO-ready compliance bundle generation.

- **External integrations**
  NVD integration exists, but deeper integrations with SIEM, ticketing, CMDB, scanner platforms, and eMASS are still missing.

- **Retention policies**
  No configurable data retention or purge policy management is implemented yet.

## Leadership Assessment

SCORVA is now a strong operational prototype and a credible internal ISCM platform for:

- control monitoring
- POA&M management
- auditability
- asset and authorization visibility
- cross-site executive oversight

It is **not yet a fully mature enterprise ISCM platform** because it still lacks deeper automation, formalized risk governance workflows, advanced reporting packages, retention controls, and external system integration.

## Next 5 Highest-Impact Priorities

1. **Force the newest Azure Container App revision live**
   The new Security Events and Program View work only becomes visible once the updated SCORVA image revision is active in Azure Container Apps.

2. **Add formal risk workflow states**
   Expand POA&M risk handling into a governed workflow with decision types, approvals, reviewers, and audit-friendly transitions.

3. **Add trend analytics and executive heatmaps**
   Build 30/60/90-day trending for controls, POA&Ms, ATO expirations, and security events to strengthen ISSM decision support.

4. **Implement real evidence/compliance packaging**
   Add one-click evidence exports for audits, ATO renewals, and recurring compliance reviews.

5. **Add automated discovery and integrations**
   Prioritize scanner/SIEM/CMDB ingestion so SCORVA becomes less manual and more operationally authoritative.

## Bottom Line

SCORVA is past the “concept demo” stage and is meaningfully useful today. The platform now has enough breadth to support day-to-day cyber program operations, but it still needs another round of maturity work to fully satisfy the broader enterprise ISCM vision in the requirements set.
