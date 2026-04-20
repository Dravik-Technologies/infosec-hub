import { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { api } from '../api';

/* ── Excel parser ──
   Expected columns (case-insensitive, partial match):
   Control ID | Control Title | Family | DAAG/JSIG Frequency |
   Baseline Applicability | ConMon Group | Notes/Dependencies
*/
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

async function parseExcelBuffer(buf) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Spreadsheet is empty.');

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const vals = row.values.slice(1).map(normalizeCell);
    if (vals.some(v => String(v || '').trim())) rows.push(vals);
  });
  if (rows.length < 2) throw new Error('Spreadsheet must have a header row and at least one data row.');

  const headers = rows[0].map(h => String(h).trim().toLowerCase());

  const col = (...terms) => {
    for (const t of terms) {
      const i = headers.findIndex(h => h.includes(t.toLowerCase()));
      if (i >= 0) return i;
    }
    return -1;
  };

  const controlIdCol   = col('control id', 'control_id');
  const titleCol       = col('control title', 'title');
  const familyCol      = col('family');
  const freqCol        = col('daag', 'jsig', 'isig', 'frequency', 'freq');
  const baselineCol    = col('baseline', 'applicability');
  const conmonGroupCol = col('conmon group', 'conmon_group', 'group');
  const notesCol       = col('notes', 'dependencies');

  if (controlIdCol < 0) throw new Error('No "Control ID" column found. The first header must include "Control ID".');

  const controls = rows.slice(1)
    .filter(r => String(r[controlIdCol] ?? '').trim())
    .map(r => ({
      control_id:             String(r[controlIdCol]   ?? '').trim(),
      control_title:          titleCol       >= 0 ? String(r[titleCol]       ?? '').trim() : '',
      family:                 familyCol      >= 0 ? String(r[familyCol]      ?? '').trim() : '',
      daag_jsig_frequency:    freqCol        >= 0 ? String(r[freqCol]        ?? '').trim() : '',
      baseline_applicability: baselineCol    >= 0 ? String(r[baselineCol]    ?? '').trim() : '',
      conmon_group:           conmonGroupCol >= 0 ? String(r[conmonGroupCol] ?? '').trim() : '',
      notes:                  notesCol       >= 0 ? String(r[notesCol]       ?? '').trim() : '',
    }))
    .filter(c => c.control_id);

  if (!controls.length) throw new Error('No control rows found after the header row.');
  return controls;
}

export default function ImportConMonModal({ onClose, onImported }) {
  const [file,      setFile]      = useState(null);
  const [parsed,    setParsed]    = useState(null);
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);
  const fileRef = useRef(null);

  function handleFile(f) {
    if (!f) return;
    setFile(f); setParsed(null); setResult(null);
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const controls = await parseExcelBuffer(e.target.result);
        setParsed({ controls, error: null });
      } catch (err) {
        setParsed({ controls: [], error: err.message });
      }
    };
    reader.readAsArrayBuffer(f);
  }

  async function doImport() {
    if (!parsed?.controls?.length || !file) return;
    setImporting(true);
    try {
      let r;
      try {
        r = await api.conmon.importExcel({ file });
      } catch (err) {
        // Fallback path when server upload dependencies are unavailable.
        if (err.response?.status !== 503) throw err;
        r = await api.conmon.bulk({ controls: parsed.controls, overwrite });
      }
      setResult({ ...r, success: true });
      onImported();
    } catch (err) {
      setResult({ success: false, error: err.response?.data?.error ?? err.message });
    } finally {
      setImporting(false);
    }
  }

  const hasData = parsed && !parsed.error && parsed.controls.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-scorva-card border border-scorva-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-scorva-border shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-scorva-accent" />
            <h2 className="text-sm font-semibold text-scorva-text">Import ConMon Controls from Excel</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-scorva-muted hover:text-scorva-text hover:bg-scorva-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Column guide */}
          <div className="rounded-lg bg-scorva-surface border border-scorva-border p-3">
            <p className="text-xs text-scorva-muted mb-2 font-medium uppercase tracking-wider">Expected Columns</p>
            <div className="flex flex-wrap gap-1.5">
              {['Control ID', 'Control Title', 'Family', 'DAAG/JSIG Frequency', 'Baseline Applicability', 'ConMon Group', 'Notes/Dependencies'].map(col => (
                <span key={col} className="px-2 py-0.5 rounded text-[10px] font-mono bg-scorva-bg border border-scorva-border text-scorva-muted">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* File picker */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            <div className="flex items-center gap-3">
              <button onClick={() => fileRef.current?.click()} className="btn-primary flex items-center gap-2 shrink-0">
                <Upload size={14} /> Choose Excel File
              </button>
              <span className="text-xs text-scorva-muted font-mono truncate">
                {file ? file.name : 'No file chosen'}
              </span>
            </div>
          </div>

          {/* Parse result */}
          {parsed && (
            <div className={`rounded-lg border p-4 ${parsed.error ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
              {parsed.error ? (
                <div className="flex items-start gap-2 text-xs text-red-400">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-0.5">Parse Error</p>
                    <p className="text-red-400/80">{parsed.error}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-400">
                      {parsed.controls.length} controls ready to import
                    </span>
                  </div>
                  <div className="bg-scorva-bg/60 rounded-md p-2 max-h-40 overflow-y-auto">
                    {parsed.controls.slice(0, 12).map((c, i) => (
                      <div key={i} className="flex gap-2 text-[10px] font-mono py-0.5">
                        <span className="text-scorva-accent w-20 shrink-0 truncate">{c.control_id}</span>
                        <span className="text-scorva-muted flex-1 truncate">{c.control_title || c.family || '—'}</span>
                        {c.daag_jsig_frequency && (
                          <span className="text-scorva-muted/60 shrink-0">{c.daag_jsig_frequency}</span>
                        )}
                      </div>
                    ))}
                    {parsed.controls.length > 12 && (
                      <p className="text-[10px] font-mono text-scorva-muted/50 pt-1">
                        … and {parsed.controls.length - 12} more
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-scorva-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={e => setOverwrite(e.target.checked)}
                      className="rounded border-scorva-border accent-scorva-accent"
                    />
                    Overwrite existing controls with matching Control IDs
                  </label>
                </div>
              )}
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
                    <span className="text-emerald-400"><strong>{result.inserted ?? result.added ?? 0}</strong> inserted</span>
                    <span className="text-blue-400"><strong>{result.updated ?? 0}</strong> updated</span>
                    {(result.skipped ?? 0) > 0 && (
                      <span className="text-scorva-muted"><strong>{result.skipped}</strong> skipped</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-scorva-border shrink-0 flex items-center justify-end gap-3">
          {result?.success ? (
            <button onClick={onClose} className="btn-primary">Done</button>
          ) : hasData ? (
            <button onClick={doImport} disabled={importing} className="btn-primary">
              {importing ? 'Importing…' : `Import ${parsed.controls.length} Controls`}
            </button>
          ) : null}
          {!result?.success && (
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          )}
        </div>

      </div>
    </div>
  );
}
