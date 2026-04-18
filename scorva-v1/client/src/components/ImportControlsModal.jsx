import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, Star } from 'lucide-react';
import ExcelJS from 'exceljs';
import { api } from '../api';

/* ══════════════════════════════════════════════════════
   PARSERS
══════════════════════════════════════════════════════ */

/** OSCAL JSON — NIST SP 800-53 Rev 5 catalog */
function parseOSCALJSON(text) {
  const root = JSON.parse(text);
  const groups = root?.catalog?.groups ?? [];
  if (!groups.length) throw new Error('No groups found. Confirm this is a valid OSCAL catalog JSON (catalog.groups expected).');

  const controls = [];

  function walk(ctrl, family) {
    const labelProp = ctrl.props?.find(p => p.name === 'label');
    const id    = labelProp?.value ?? ctrl.id?.toUpperCase() ?? '';
    const title = ctrl.title ?? '';
    if (id && title) controls.push({ id, title, family, status: 'Not Implemented', baseline: '', findings: 0, notes: '' });
    for (const child of ctrl.controls ?? []) walk(child, family);
  }

  for (const group of groups) {
    const family = group.title ?? '';
    for (const ctrl of group.controls ?? []) walk(ctrl, family);
  }

  if (!controls.length) throw new Error('No controls extracted. Make sure this is the SP 800-53 OSCAL catalog file.');
  return controls;
}

/** OSCAL XML — NIST SP 800-53 Rev 5 catalog */
function parseOSCALXML(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/xml');
  const parseErr = doc.querySelector('parsererror');
  if (parseErr) throw new Error('Invalid XML: ' + parseErr.textContent.slice(0, 120));

  const controls = [];

  function walkEl(el, family) {
    const props     = Array.from(el.children).filter(c => c.tagName === 'prop');
    const labelProp = props.find(p => p.getAttribute('name') === 'label');
    const id    = labelProp?.getAttribute('value') ?? el.getAttribute('id')?.toUpperCase() ?? '';
    const title = Array.from(el.children).find(c => c.tagName === 'title')?.textContent?.trim() ?? '';
    if (id && title) controls.push({ id, title, family, status: 'Not Implemented', baseline: '', findings: 0, notes: '' });
    for (const child of Array.from(el.children).filter(c => c.tagName === 'control')) walkEl(child, family);
  }

  for (const group of Array.from(doc.getElementsByTagName('group'))) {
    const family = Array.from(group.children).find(c => c.tagName === 'title')?.textContent?.trim() ?? '';
    for (const ctrl of Array.from(group.children).filter(c => c.tagName === 'control')) walkEl(ctrl, family);
  }

  if (!controls.length) throw new Error('No controls extracted. Make sure this is the SP 800-53 OSCAL catalog XML file.');
  return controls;
}

/** NIST CSV — any spreadsheet with ID + Title columns */
function parseNISTCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  const findCol = (...candidates) => {
    for (const c of candidates) {
      const i = headers.findIndex(h => h.includes(c));
      if (i >= 0) return i;
    }
    return -1;
  };

  const idCol       = findCol('control identifier', 'control id', 'identifier', ' id');
  const titleCol    = findCol('control name', 'enhancement name', 'title', 'name');
  const familyCol   = findCol('control family', 'family');
  const baselineCol = findCol('baseline', 'priority', 'impact');

  if (idCol < 0)    throw new Error('No ID column found. Expected "Control Identifier" or "ID".');
  if (titleCol < 0) throw new Error('No Title column found. Expected "Control (or Control Enhancement) Name" or "Title".');

  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const id = vals[idCol]?.trim();
      if (!id || id.toLowerCase() === 'id') return null;
      return {
        id,
        title:    titleCol    >= 0 ? (vals[titleCol]    || '') : '',
        family:   familyCol   >= 0 ? (vals[familyCol]   || '') : '',
        baseline: baselineCol >= 0 ? (vals[baselineCol] || '') : '',
        status: 'Not Implemented', findings: 0, notes: '',
      };
    })
    .filter(Boolean);
}

/** Excel (.xlsx / .xls) — DCSA/custom spreadsheet with Control Acronym, Title, Info columns */
const FAMILY_MAP = {
  AC: 'Access Control', AT: 'Awareness and Training', AU: 'Audit and Accountability',
  CA: 'Assessment, Authorization, and Monitoring', CM: 'Configuration Management',
  CP: 'Contingency Planning', IA: 'Identification and Authentication', IR: 'Incident Response',
  MA: 'Maintenance', MP: 'Media Protection', PE: 'Physical and Environmental Protection',
  PL: 'Planning', PM: 'Program Management', PS: 'Personnel Security',
  PT: 'Personally Identifiable Information Processing and Transparency',
  RA: 'Risk Assessment', SA: 'System and Services Acquisition',
  SC: 'System and Communications Protection', SI: 'System and Information Integrity',
  SR: 'Supply Chain Risk Management',
};

function normalizeCell(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text.trim();
    if (value.result != null) return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text || '').join('').trim();
  }
  return String(value).trim();
}

async function parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Spreadsheet is empty.');

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const vals = row.values.slice(1).map(normalizeCell);
    if (vals.some(v => String(v || '').trim())) rows.push(vals);
  });

  if (rows.length < 2) throw new Error('Spreadsheet must have a header row and at least one data row.');

  const headers = rows[0].map(h => String(h).trim().toLowerCase());

  const findCol = (...terms) => {
    for (const t of terms) {
      const i = headers.findIndex(h => h.includes(t));
      if (i >= 0) return i;
    }
    return -1;
  };

  const idCol   = findCol('acronym', 'identifier', 'control id', ' id', 'id');
  const titleCol = findCol('title', 'name');
  const infoCol  = findCol('information', 'description', 'notes', 'text');

  if (idCol < 0)    throw new Error('No ID column found. Expected "Control Acronym" or "Control Identifier".');
  if (titleCol < 0) throw new Error('No Title column found. Expected "Control Title" or "Title".');

  return rows.slice(1)
    .filter(row => String(row[idCol] ?? '').trim())
    .map(row => {
      const id     = String(row[idCol]    ?? '').trim();
      const prefix = id.split('-')[0]?.toUpperCase() ?? '';
      return {
        id,
        title:       String(row[titleCol]  ?? '').trim(),
        family:      FAMILY_MAP[prefix] ?? '',
        description: infoCol >= 0 ? String(row[infoCol] ?? '').trim() : '',
        status:      'Not Implemented',
        baseline:    '',
        findings:    0,
        notes:       '',
        implementation_guidance: '',
      };
    })
    .filter(c => c.id && c.title);
}

/** SCORVA JSON — re-import from a previous SCORVA export */
function parseSCORVAJSON(text) {
  const raw = JSON.parse(text);
  const arr = Array.isArray(raw) ? raw : raw.controls ?? [];
  if (!arr.length) throw new Error('No controls found. Expected a JSON array or { controls: [...] }.');
  return arr.map(c => ({
    id:                      c.id || c._id || '',
    title:                   c.title ?? '',
    family:                  c.family ?? '',
    status:                  c.status ?? 'Not Implemented',
    baseline:                c.baseline ?? '',
    last_review:             c.last_review ?? '',
    findings:                c.findings ?? 0,
    notes:                   c.notes ?? '',
    description:             c.description ?? '',
    implementation_guidance: c.implementation_guidance ?? '',
  })).filter(c => c.id && c.title);
}

/* ══════════════════════════════════════════════════════
   TAB DEFINITIONS
══════════════════════════════════════════════════════ */
const TABS = [
  {
    id: 'oscal-json',
    label: 'OSCAL JSON',
    sub: 'Recommended',
    recommended: true,
    accept: '.json',
    btnLabel: 'Choose OSCAL JSON File',
    headline: 'OSCAL JSON — Complete NIST SP 800-53 Rev 5 Catalog',
    desc: 'OSCAL (Open Security Controls Assessment Language) is the authoritative machine-readable format published directly by NIST. A single file gives you every control and enhancement — full text, discussion, and family groupings — for all 20 control families.',
    instructions: [
      { pre: 'Go to:', code: 'github.com/usnistgov/oscal-content' },
      { pre: 'Navigate to:', code: 'nist.gov / SP800-53 / rev5 / json /' },
      { pre: 'Click', bold: 'NIST_SP-800-53_rev5_catalog.json' },
      { pre: 'Click', bold: 'Download raw file', suf: '(the ↓ button, top-right)' },
      { pre: 'Upload the downloaded', code: '.json', suf: 'file below' },
    ],
    warning: 'The file is ~7MB — do not open it in a text editor. Just upload it directly.',
    stats: [
      { value: '1,000+', label: 'Controls & Enhancements' },
      { value: '20',     label: 'Control Families' },
      { value: 'Rev 5',  label: 'NIST Standard' },
    ],
    parse: parseOSCALJSON,
  },
  {
    id: 'oscal-xml',
    label: 'OSCAL XML',
    sub: 'Official NIST',
    accept: '.xml',
    btnLabel: 'Choose OSCAL XML File',
    headline: 'OSCAL XML — Official NIST Catalog',
    desc: 'The XML version of the OSCAL catalog contains the same controls as the JSON version in an XML structure. Use this if you have the XML file from the NIST OSCAL content repository.',
    instructions: [
      { pre: 'Go to:', code: 'github.com/usnistgov/oscal-content' },
      { pre: 'Navigate to:', code: 'nist.gov / SP800-53 / rev5 / xml /' },
      { pre: 'Click', bold: 'NIST_SP-800-53_rev5_catalog.xml' },
      { pre: 'Click', bold: 'Download raw file', suf: '(the ↓ button, top-right)' },
      { pre: 'Upload the downloaded', code: '.xml', suf: 'file below' },
    ],
    warning: 'The file is ~10MB — do not open it in a text editor. Just upload it directly.',
    stats: [
      { value: '1,000+', label: 'Controls & Enhancements' },
      { value: '20',     label: 'Control Families' },
      { value: 'XML',    label: 'Format' },
    ],
    parse: parseOSCALXML,
  },
  {
    id: 'nist-csv',
    label: 'NIST CSV',
    sub: 'Spreadsheet',
    accept: '.csv,.txt',
    btnLabel: 'Choose CSV File',
    headline: 'NIST CSV — Spreadsheet Format',
    desc: 'Import controls from any CSV file. Supports the NIST SP 800-53 Rev 5 spreadsheet download and custom CSVs. Required columns: a Control ID column and a Title/Name column.',
    instructions: [
      { pre: 'Go to:', code: 'csrc.nist.gov/publications/detail/sp/800-53/rev-5/final' },
      { pre: 'Download the SP 800-53 Rev 5 spreadsheet' },
      { pre: 'If .xlsx, open in Excel or Google Sheets and export as CSV' },
      { pre: 'Upload the', code: '.csv', suf: 'file below' },
    ],
    warning: 'Required columns: "Control Identifier" (or "ID") and "Control (or Control Enhancement) Name" (or "Title").',
    stats: [
      { value: 'CSV',  label: 'Format' },
      { value: 'Any',  label: 'Framework' },
      { value: 'Flex', label: 'Column Names' },
    ],
    parse: parseNISTCSV,
  },
  {
    id: 'excel',
    label: 'Excel',
    sub: 'Spreadsheet',
    accept: '.xlsx,.xls',
    binary: true,
    btnLabel: 'Choose Excel File',
    headline: 'Excel (.xlsx) — DCSA / Custom Spreadsheet',
    desc: 'Import controls from an Excel spreadsheet. Expected columns: Control Acronym (Column A), Control Title (Column B), Control Information (Column C). The control family is auto-detected from the acronym prefix (e.g. AC-1 → Access Control). Control Information is imported as the Description.',
    instructions: [
      { pre: 'Open your Excel spreadsheet in Excel or Google Sheets' },
      { pre: 'Ensure Column A is', bold: 'Control Acronym', suf: '(e.g. AC-1)' },
      { pre: 'Ensure Column B is', bold: 'Control Title' },
      { pre: 'Column C is', bold: 'Control Information', suf: '(optional — imported as Description)' },
      { pre: 'Upload the', code: '.xlsx', suf: 'file directly (no need to convert to CSV)' },
    ],
    warning: 'The first row must be a header row. Data starts on row 2.',
    stats: [
      { value: '.xlsx', label: 'Format' },
      { value: 'Auto',  label: 'Family Detect' },
      { value: 'Any',   label: 'Framework' },
    ],
    parse: parseExcel,
  },
  {
    id: 'scorva-json',
    label: 'SCORVA JSON',
    sub: 'Re-import',
    accept: '.json',
    btnLabel: 'Choose SCORVA JSON Export',
    headline: 'SCORVA JSON — Re-import from Export',
    desc: 'Re-import a controls library previously exported from SCORVA. This preserves all status, baseline, findings, and notes. Use this to restore or migrate your library between environments.',
    instructions: [
      { pre: 'Open the Controls Library page in SCORVA' },
      { pre: 'Click', bold: 'Export JSON', suf: 'to download your current library' },
      { pre: 'Upload the exported', code: '.json', suf: 'file below' },
    ],
    warning: null,
    stats: [
      { value: 'JSON',   label: 'Format' },
      { value: 'Full',   label: 'Status Preserved' },
      { value: 'SCORVA', label: 'Export Source' },
    ],
    parse: parseSCORVAJSON,
  },
];

/* ══════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════ */
const CHUNK_SIZE = 50;

export default function ImportControlsModal({ onClose, onImported, currentCount = 0 }) {
  const [tabId, setTabId]         = useState('oscal-json');
  const [file, setFile]           = useState(null);
  const [parsed, setParsed]       = useState(null);   // { controls[], error } | null
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress]   = useState(null);   // { done, total } | null
  const [result, setResult]       = useState(null);
  const fileRef = useRef(null);

  const tab = TABS.find(t => t.id === tabId);

  function switchTab(id) {
    setTabId(id);
    setFile(null);
    setParsed(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setParsed(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const controls = await Promise.resolve(tab.parse(e.target.result));
        setParsed({ controls, error: null });
      } catch (err) {
        setParsed({ controls: [], error: err.message });
      }
    };
    if (tab.binary) {
      reader.readAsArrayBuffer(f);
    } else {
      reader.readAsText(f);
    }
  }

  async function doImport() {
    if (!parsed?.controls?.length) return;
    setImporting(true);
    setProgress(null);

    const all    = parsed.controls;
    const total  = all.length;
    let inserted = 0, overwritten = 0, skipped = 0;
    const errors = [];

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        setProgress({ done: i, total });
        const chunk = all.slice(i, i + CHUNK_SIZE);
        const r = await api.controls.bulk({ controls: chunk, overwrite });
        inserted   += r.inserted   ?? 0;
        overwritten += r.overwritten ?? 0;
        skipped    += r.skipped    ?? 0;
        if (r.errors?.length) errors.push(...r.errors);
      }
      setProgress({ done: total, total });
      setResult({ inserted, overwritten, skipped, errors, success: true });
      onImported();
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error ?? err.message });
    } finally {
      setImporting(false);
    }
  }

  const families      = parsed?.controls ? [...new Set(parsed.controls.map(c => c.family).filter(Boolean))].length : 0;
  const importedCount = result ? (result.inserted || result.overwritten || 0) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-scorva-card border border-scorva-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-scorva-border shrink-0">
          <h2 className="text-sm font-semibold text-scorva-text">Import NIST SP 800-53 Controls</h2>
          <button onClick={onClose} className="p-1 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex shrink-0 border-b border-scorva-border px-2 pt-2 gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex flex-col items-center px-3.5 py-1.5 rounded-t-lg text-[11px] font-mono whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tabId === t.id
                  ? 'border-scorva-accent text-scorva-accent bg-scorva-accent/8'
                  : 'border-transparent text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover'
              }`}
            >
              <span className="font-semibold flex items-center gap-1">
                {t.recommended && <Star size={10} className="fill-yellow-400 text-yellow-400" />}
                {t.label}
              </span>
              <span className="text-[9px] text-scorva-muted mt-0.5">{t.sub}</span>
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-scorva-text flex items-center gap-1.5 mb-1.5">
              {tab.recommended && <Star size={13} className="fill-yellow-400 text-yellow-400 shrink-0" />}
              {tab.headline}
            </h3>
            <p className="text-xs text-scorva-muted leading-relaxed">{tab.desc}</p>
          </div>

          {/* Instructions */}
          <div className="bg-scorva-hover/50 rounded-lg p-3.5">
            <p className="text-[11px] font-semibold text-scorva-text mb-2.5">
              🗂 How to get the file{tab.id !== 'scorva-json' ? ' (takes ~30 seconds)' : ''}:
            </p>
            <ol className="space-y-1.5">
              {tab.instructions.map((ins, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-scorva-muted">
                  <span className="font-mono font-bold text-scorva-accent shrink-0 w-4">{i + 1}.</span>
                  <span className="leading-relaxed">
                    {ins.pre}{' '}
                    {ins.code && (
                      <code className="bg-scorva-border/80 text-scorva-cyan px-1.5 py-0.5 rounded text-[10px] font-mono mx-0.5">
                        {ins.code}
                      </code>
                    )}
                    {ins.bold && <strong className="text-scorva-text font-semibold"> {ins.bold}</strong>}
                    {ins.suf && ` ${ins.suf}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Warning */}
          {tab.warning && (
            <div className="flex items-start gap-2 text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{tab.warning}</span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {tab.stats.map((s, i) => (
              <div key={i} className="card p-3 text-center">
                <div className="text-base font-bold font-mono text-scorva-accent">{s.value}</div>
                <div className="text-[10px] text-scorva-muted mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* File picker */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept={tab.accept}
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="btn-primary flex items-center gap-2 shrink-0"
              >
                <Upload size={14} />
                {tab.btnLabel}
              </button>
              <span className="text-xs text-scorva-muted font-mono truncate">
                {file ? file.name : 'No file chosen'}
              </span>
            </div>
          </div>

          {/* Parse result / preview */}
          {parsed && (
            <div className={`rounded-lg border p-4 ${parsed.error ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
              {parsed.error ? (
                <div className="flex items-start gap-2 text-xs text-red-400">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">Parse Error</p>
                    <p className="text-red-400/80 leading-relaxed">{parsed.error}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-400">
                      Parsed {parsed.controls.length.toLocaleString()} controls across {families} {families === 1 ? 'family' : 'families'}
                    </span>
                  </div>

                  {/* Sample preview */}
                  <div className="bg-scorva-bg/60 rounded-md p-2 max-h-28 overflow-y-auto">
                    {parsed.controls.slice(0, 10).map((c, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-[10px] font-mono py-0.5">
                        <span className="text-scorva-accent w-16 shrink-0">{c.id}</span>
                        <span className="text-scorva-muted truncate">{c.title}</span>
                      </div>
                    ))}
                    {parsed.controls.length > 10 && (
                      <div className="text-[10px] font-mono text-scorva-muted/50 pt-1">
                        … and {(parsed.controls.length - 10).toLocaleString()} more
                      </div>
                    )}
                  </div>

                  {/* Overwrite option */}
                  <label className="flex items-center gap-2 text-xs text-scorva-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={e => setOverwrite(e.target.checked)}
                      className="rounded border-scorva-border accent-scorva-accent"
                    />
                    Overwrite existing controls that share the same ID
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {importing && progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-scorva-muted">
                <span>Importing…</span>
                <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
              </div>
              <div className="h-1.5 rounded-full bg-scorva-border overflow-hidden">
                <div
                  className="h-full bg-scorva-accent transition-all duration-300"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className={`rounded-lg border p-4 ${result.success ? 'border-blue-500/30 bg-blue-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
              {!result.success ? (
                <div className="flex items-start gap-2 text-xs text-red-400">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  Import failed: {result.error}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-blue-400 flex items-center gap-2">
                    <CheckCircle size={13} /> Import complete
                  </p>
                  <div className="flex flex-wrap gap-4 text-[11px] font-mono">
                    <span className="text-emerald-400">
                      <strong>{importedCount.toLocaleString()}</strong> {overwrite ? 'upserted' : 'added'}
                    </span>
                    {result.skipped > 0 && (
                      <span className="text-scorva-muted">
                        <strong>{result.skipped.toLocaleString()}</strong> skipped (already exist)
                      </span>
                    )}
                    {result.errors?.length > 0 && (
                      <span className="text-red-400">
                        <strong>{result.errors.length}</strong> errors
                      </span>
                    )}
                  </div>
                  {result.errors?.length > 0 && (
                    <div className="text-[10px] text-red-400/80 font-mono space-y-0.5">
                      {result.errors.slice(0, 5).map((e, i) => (
                        <div key={i}>{e.id}: {e.reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-scorva-border shrink-0 flex items-center justify-between gap-3">
          <span className="text-[10px] font-mono text-scorva-muted">
            Library: {currentCount} control{currentCount !== 1 ? 's' : ''}
          </span>
          {result?.success ? (
            <button onClick={onClose} className="btn-primary">Done</button>
          ) : parsed?.controls?.length > 0 && !parsed.error ? (
            <button onClick={doImport} disabled={importing} className="btn-primary">
              {importing
                ? progress
                  ? `Batch ${Math.ceil(progress.done / CHUNK_SIZE) + 1} of ${Math.ceil(parsed.controls.length / CHUNK_SIZE)}…`
                  : 'Importing…'
                : `Import ${parsed.controls.length.toLocaleString()} Controls`}
            </button>
          ) : null}
        </div>

      </div>
    </div>
  );
}
