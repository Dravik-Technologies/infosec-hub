import { formatDistanceToNow, format, parseISO, differenceInDays } from 'date-fns'
import type { ControlStatus, Severity, POAMStatus, VulnStatus } from '@/types'

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy HH:mm')
  } catch {
    return dateStr
  }
}

export function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  try {
    return differenceInDays(parseISO(dateStr), new Date())
  } catch {
    return null
  }
}

export function daysSince(dateStr: string): number {
  try {
    return differenceInDays(new Date(), parseISO(dateStr))
  } catch {
    return 0
  }
}

export function today(): string {
  return new Date().toISOString()
}

export function todayDate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function getControlStatusColor(status: ControlStatus): string {
  switch (status) {
    case 'Implemented': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'Partially Implemented': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'Planned': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'Not Implemented': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'Not Applicable': return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
    case 'Inherited': return 'text-purple-400 bg-purple-400/10 border-purple-400/20'
    case 'Under Review': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}

export function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'Critical': return 'text-red-300 bg-red-500/20 border-red-500/30'
    case 'High': return 'text-orange-300 bg-orange-500/20 border-orange-500/30'
    case 'Moderate': return 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30'
    case 'Low': return 'text-blue-300 bg-blue-500/20 border-blue-500/30'
    case 'Informational': return 'text-slate-300 bg-slate-500/20 border-slate-500/30'
    default: return 'text-slate-300 bg-slate-500/20 border-slate-500/30'
  }
}

export function getPOAMStatusColor(status: POAMStatus): string {
  switch (status) {
    case 'Open': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'In Progress': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'Completed': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'Risk Accepted': return 'text-purple-400 bg-purple-400/10 border-purple-400/20'
    case 'False Positive': return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
    case 'Vendor Dependency': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}

export function getVulnStatusColor(status: VulnStatus): string {
  switch (status) {
    case 'Open': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'Mitigated': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'False Positive': return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
    case 'Risk Accepted': return 'text-purple-400 bg-purple-400/10 border-purple-400/20'
    case 'POAM Created': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}

export function getATOStatusColor(status: string): string {
  switch (status) {
    case 'ATO Active': return 'text-green-400 bg-green-400/10 border-green-400/20'
    case 'In Assessment': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
    case 'IATT': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    case 'ATO Expired': return 'text-red-400 bg-red-400/10 border-red-400/20'
    case 'Denied': return 'text-red-500 bg-red-500/10 border-red-500/20'
    case 'Pre-ATO': return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  }
}

export function computeComplianceScore(statusCounts: Record<ControlStatus, number>): number {
  const implemented = statusCounts['Implemented'] ?? 0
  const inherited = statusCounts['Inherited'] ?? 0
  const na = statusCounts['Not Applicable'] ?? 0
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  return Math.round(((implemented + inherited + na) / total) * 100)
}

export function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…'
}

export function exportCSV(headers: string[], rows: string[][]): void {
  const lines = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `crater-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
