const VARIANTS = {
  // ConMon compliance
  Compliant:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'POA&M':         'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Overdue:         'bg-red-600/10 text-red-400 border-red-600/20',
  // Status
  Active:          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Inactive:        'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Pending:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Open:            'bg-red-500/10 text-red-400 border-red-500/20',
  Closed:          'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Completed:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Scheduled:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'In Progress':   'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Authorized:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Denied:          'bg-red-500/10 text-red-400 border-red-500/20',
  Expired:         'bg-orange-500/10 text-orange-400 border-orange-500/20',
  // Severity
  Critical:        'bg-red-600/10 text-red-400 border-red-600/20',
  High:            'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Medium:          'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Low:             'bg-blue-500/10 text-blue-400 border-blue-500/20',
  // Implemented
  Implemented:     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Partially Implemented': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Not Implemented':'bg-red-500/10 text-red-400 border-red-500/20',
  // Document categories
  Memorandum:          'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Appointment Letter':'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Agreement:           'bg-blue-500/10 text-blue-400 border-blue-500/20',
  // Classification
  Unclassified:         'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Secret:               'bg-red-500/10 text-red-400 border-red-500/20',
  'Top Secret':         'bg-orange-500/10 text-orange-400 border-orange-500/20',
  // Device status
  Available:            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Checked Out':        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Awaiting Destruction':'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Lost:                 'bg-red-600/10 text-red-400 border-red-600/20',
  Maintenance:          'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Decommissioned:       'bg-slate-500/10 text-slate-400 border-slate-500/20',
  // Generic
  info:            'bg-blue-500/10 text-blue-400 border-blue-500/20',
  warning:         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  error:           'bg-red-500/10 text-red-400 border-red-500/20',
  success:         'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function Badge({ label, variant }) {
  const cls = VARIANTS[label] || VARIANTS[variant] ||
    'bg-scorva-border/50 text-scorva-muted border-scorva-border';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}
