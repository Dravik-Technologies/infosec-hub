import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import Badge from './ui/Badge';
import { Download, FileText, Trash2, Upload } from 'lucide-react';

const ARTIFACT_TYPES = ['Screenshot', 'Scan Report', 'Configuration Export', 'Plan', 'Memo', 'Other'];

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimestamp(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return value;
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EvidencePanel({ resourceType, resourceId }) {
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const [artifactType, setArtifactType] = useState('Screenshot');
  const [notes, setNotes] = useState('');

  const queryKey = useMemo(() => ['evidence', resourceType, resourceId], [resourceType, resourceId]);
  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.evidence.list({ resourceType, resourceId }),
    enabled: Boolean(resourceType && resourceId),
  });

  const upload = useMutation({
    mutationFn: () => api.evidence.upload({ resourceType, resourceId, file, artifactType, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setFile(null);
      setArtifactType('Screenshot');
      setNotes('');
    },
  });

  const remove = useMutation({
    mutationFn: api.evidence.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const download = useMutation({
    mutationFn: api.evidence.download,
    onSuccess: ({ blob, filename }) => triggerDownload(blob, filename),
  });

  const mutationError =
    upload.error?.response?.data?.error ||
    remove.error?.response?.data?.error ||
    download.error?.response?.data?.error ||
    upload.error?.message ||
    remove.error?.message ||
    download.error?.message;

  return (
    <div className="rounded-xl border border-scorva-border bg-scorva-panel/40 p-4 space-y-4">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-scorva-muted">Evidence Artifacts</div>
        <p className="mt-2 text-sm text-scorva-muted">
          Attach audit-ready artifacts for this record. Files stay in the shared PostgreSQL store and are included in the evidence trail.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-scorva-muted mb-1">Artifact Type</label>
          <select className="input-base" value={artifactType} onChange={e => setArtifactType(e.target.value)}>
            {ARTIFACT_TYPES.map(type => <option key={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-scorva-muted mb-1">File</label>
          <input
            type="file"
            className="input-base file:mr-3 file:rounded-md file:border-0 file:bg-scorva-surface file:px-3 file:py-1.5 file:text-xs file:text-scorva-text"
            onChange={e => setFile(e.target.files?.[0] || null)}
            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx,.txt,.json"
          />
          <div className="mt-1 text-xs text-scorva-muted">Recommended max size: 5 MB</div>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-scorva-muted mb-1">Notes</label>
          <textarea
            className="input-base resize-none"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What does this artifact prove or support?"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-secondary flex items-center gap-2"
          disabled={!file || upload.isPending}
          onClick={() => upload.mutate()}
        >
          <Upload size={14} />
          {upload.isPending ? 'Uploading…' : 'Upload Evidence'}
        </button>
      </div>

      {mutationError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {mutationError}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-scorva-muted">
          <FileText size={14} />
          Current Artifacts
        </div>
        {isLoading ? (
          <div className="text-sm text-scorva-muted">Loading evidence…</div>
        ) : data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-scorva-border px-4 py-5 text-sm text-scorva-muted">
            No evidence attached yet.
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(item => (
              <div key={item.id} className="rounded-lg border border-scorva-border bg-scorva-surface/50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-scorva-text break-all">{item.filename}</span>
                      {item.artifactType && <Badge label={item.artifactType} />}
                    </div>
                    <div className="mt-1 text-xs text-scorva-muted">
                      Uploaded by {item.uploadedBy || 'system'} on {formatTimestamp(item.createdAt)} · {formatBytes(item.size)}
                    </div>
                    {item.notes && (
                      <div className="mt-2 text-sm text-scorva-text whitespace-pre-wrap">{item.notes}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="p-2 rounded-md text-scorva-muted hover:text-scorva-accent hover:bg-scorva-hover"
                      onClick={() => download.mutate(item.id)}
                      title="Download evidence"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-md text-scorva-muted hover:text-red-400 hover:bg-scorva-hover"
                      onClick={() => remove.mutate(item.id)}
                      title="Delete evidence"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
