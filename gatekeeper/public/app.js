const state = {
  mode: 'folder',
  currentJobId: null,
  pollTimer: null,
};

const WARN_DIRECT_FILE_COUNT = 2000;
const MAX_DIRECT_FILE_COUNT = 5000;
const MAX_ARCHIVE_SIZE_BYTES = 1024 * 1024 * 1024;

const uploadForm = document.getElementById('upload-form');
const folderInput = document.getElementById('folderInput');
const archiveInput = document.getElementById('archiveInput');
const folderPicker = document.getElementById('folder-picker');
const archivePicker = document.getElementById('archive-picker');
const folderSummary = document.getElementById('folderSummary');
const archiveSummary = document.getElementById('archiveSummary');
const submitButton = document.getElementById('submitButton');
const uploadError = document.getElementById('uploadError');
const jobStatusBadge = document.getElementById('jobStatusBadge');
const jobMeta = document.getElementById('jobMeta');
const progressPercent = document.getElementById('progressPercent');
const progressNarrative = document.getElementById('progressNarrative');
const progressBarFill = document.getElementById('progressBarFill');
const progressPhases = document.getElementById('progressPhases');
const stepList = document.getElementById('stepList');
const reportSummary = document.getElementById('reportSummary');

function formatCount(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function setMode(mode) {
  state.mode = mode;
  folderPicker.classList.toggle('is-active', mode === 'folder');
  archivePicker.classList.toggle('is-active', mode === 'archive');
  uploadError.hidden = true;
}

function setError(message) {
  if (!message) {
    uploadError.hidden = true;
    uploadError.textContent = '';
    uploadError.classList.remove('is-warning');
    return;
  }
  uploadError.hidden = false;
  uploadError.textContent = message;
  uploadError.classList.remove('is-warning');
}

function setWarning(message) {
  if (!message) {
    setError(null);
    return;
  }
  uploadError.hidden = false;
  uploadError.textContent = message;
  uploadError.classList.add('is-warning');
}

function buildJobMeta(job) {
  const summary = job.summary ? `${formatCount(job.summary.fileCount)} files scanned` : 'Scan in progress';
  return `${job.name} • ${job.id} • ${summary} • Updated ${formatDate(job.updatedAt)}`;
}

function buildProgress(job) {
  const percent = Number(job.progress || 0);
  progressPercent.textContent = `${percent}%`;
  progressBarFill.style.width = `${percent}%`;

  const activeStep = job.steps.find(step => step.status === 'running');
  const failedStep = job.steps.find(step => step.status === 'failed');
  const completedSteps = job.steps.filter(step => step.status === 'completed').length;

  if (failedStep) {
    progressNarrative.textContent = failedStep.message || `${failedStep.label} failed.`;
  } else if (activeStep) {
    progressNarrative.textContent = activeStep.message || `${activeStep.label} is running.`;
  } else if (job.status === 'completed') {
    progressNarrative.textContent = 'Scan complete. Reports are ready for review.';
  } else if (job.status === 'queued') {
    progressNarrative.textContent = 'Upload accepted. Waiting for scan workers to begin.';
  } else {
    progressNarrative.textContent = `${completedSteps}/${job.steps.length} stages completed.`;
  }

  progressPhases.innerHTML = '';
  for (const step of job.steps) {
    const pill = document.createElement('div');
    pill.className = `phase-pill phase-${step.status}`;
    pill.innerHTML = `
      <span class="phase-dot"></span>
      <span>${step.label}</span>
    `;
    progressPhases.appendChild(pill);
  }
}

function renderSteps(job) {
  stepList.innerHTML = '';
  const verboseSteps = job.steps.filter(step => step.status === 'running' || step.status === 'failed' || step.status === 'completed');
  for (const step of verboseSteps) {
    const row = document.createElement('article');
    row.className = `step-card step-${step.status}`;
    row.innerHTML = `
      <div class="step-head">
        <strong>${step.label}</strong>
        <span>${step.status}</span>
      </div>
      <p>${step.message || (step.status === 'completed' ? 'Completed.' : 'Waiting to start.')}</p>
    `;
    stepList.appendChild(row);
  }

  if (!verboseSteps.length) {
    const idle = document.createElement('article');
    idle.className = 'step-card step-pending';
    idle.innerHTML = `
      <div class="step-head">
        <strong>Awaiting intake</strong>
        <span>pending</span>
      </div>
      <p>Select a project package to begin the scan pipeline.</p>
    `;
    stepList.appendChild(idle);
  }
}

function renderReport(job) {
  if (job.status !== 'completed' || !job.report) {
    reportSummary.hidden = true;
    reportSummary.innerHTML = '';
    return;
  }

  const counts = job.report.counts || {};
  const findings = job.report.findings || [];
  const totalFindings = Object.values(counts).reduce((sum, v) => sum + (Number(v) || 0), 0);

  reportSummary.hidden = false;

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const severityColors = {
    critical: '#ef4444', high: '#f97316', medium: '#facc15',
    low: '#38bdf8', info: '#94a3b8'
  };
  const severityNames = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };

  const grouped = {};
  const scanners = new Set();
  for (const finding of findings) {
    const severity = finding.severity || 'info';
    if (!grouped[severity]) grouped[severity] = [];
    grouped[severity].push(finding);
    if (finding.scanner) scanners.add(finding.scanner);
  }

  const severities = Object.keys(grouped).sort((a, b) => severityOrder[a] - severityOrder[b]);
  const scannerList = Array.from(scanners).sort();

  let donutGradient = 'conic-gradient(';
  let cumulativePercent = 0;
  for (const severity of Object.keys(severityOrder)) {
    const count = counts[severity] || 0;
    const percent = totalFindings ? (count / totalFindings) * 100 : 0;
    const start = cumulativePercent;
    cumulativePercent += percent;
    donutGradient += `${severityColors[severity]} ${start}% ${cumulativePercent}%, `;
  }
  donutGradient += 'rgba(148,163,184,0.15) 0 100%)';

  let filtersHtml = '<div class="report-filters">';
  filtersHtml += '<div class="filter-group"><div class="filter-title">Severity</div>';
  for (const severity of severities) {
    const count = counts[severity] || 0;
    filtersHtml += `<label class="filter-checkbox" data-severity="${severity}"><input type="checkbox" checked><span style="color:${severityColors[severity]}">${severityNames[severity]}</span><span class="filter-count">${count}</span></label>`;
  }
  filtersHtml += '</div>';
  if (scannerList.length > 1) {
    filtersHtml += '<div class="filter-group"><div class="filter-title">Scanner</div>';
    for (const scanner of scannerList) {
      filtersHtml += `<label class="filter-checkbox" data-scanner="${scanner}"><input type="checkbox" checked><span>${scanner}</span></label>`;
    }
    filtersHtml += '</div>';
  }
  filtersHtml += '</div>';

  let findingsHtml = '<div class="findings-container">';
  for (const severity of severities) {
    for (const finding of grouped[severity]) {
      const scannerBadge = finding.scanner ? `<span class="finding-scanner">${finding.scanner}</span>` : '';
      findingsHtml += `
        <div class="finding-card" data-severity="${severity}" data-scanner="${finding.scanner || ''}">
          <div class="finding-header">
            <div class="finding-severity" style="background:${severityColors[severity]}"></div>
            <div class="finding-content">
              <div class="finding-title">${finding.title || 'Finding'}</div>
              <div class="finding-meta">
                ${finding.file ? `<span class="finding-file">${finding.file}</span>` : ''}
                ${scannerBadge}
                ${finding.category ? `<span class="finding-category">${finding.category}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="finding-body">
            <p>${finding.detail || 'No details available.'}</p>
            ${finding.recommendation ? `<div class="finding-rec"><strong>Recommendation:</strong> ${finding.recommendation}</div>` : ''}
          </div>
        </div>
      `;
    }
  }
  findingsHtml += '</div>';

  reportSummary.innerHTML = `
    <div class="report-header">
      <div class="report-title">
        <div class="eyebrow">Scan Results</div>
        <h2>Security Report</h2>
      </div>
      <div class="severity-summary">
        <div class="severity-donut" style="${donutGradient}">
          <div class="donut-inner">
            <strong>${totalFindings}</strong>
            <span>Findings</span>
          </div>
        </div>
        <div class="severity-legend">
          ${severities.map(s => `<div class="legend-row"><span class="legend-dot" style="background:${severityColors[s]}"></span>${severityNames[s]} <strong>${counts[s] || 0}</strong></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="report-body">
      ${filtersHtml}
      <div class="report-main">
        <div class="findings-toolbar">
          <span id="findingsCount" class="findings-count">${totalFindings} findings</span>
        </div>
        ${findingsHtml}
      </div>
    </div>
    <div class="report-footer">
      <div class="downloads">
        <a class="primary" href="${job.downloads.html}" target="_blank" rel="noreferrer">Open HTML report</a>
        <a class="secondary" href="${job.downloads.json}" target="_blank" rel="noreferrer">Download JSON</a>
      </div>
    </div>
  `;

  // Add filter event listeners
  setTimeout(() => {
    const severityCheckboxes = reportSummary.querySelectorAll('[data-severity] input');
    const scannerCheckboxes = reportSummary.querySelectorAll('[data-scanner] input');
    const cards = reportSummary.querySelectorAll('.finding-card');

    const updateVisibility = () => {
      const activeSeverities = new Set(Array.from(severityCheckboxes).filter(c => c.checked).map(c => c.parentElement.getAttribute('data-severity')));
      const activeScanners = new Set(Array.from(scannerCheckboxes).filter(c => c.checked).map(c => c.parentElement.getAttribute('data-scanner')));
      let visibleCount = 0;

      for (const card of cards) {
        const severity = card.getAttribute('data-severity');
        const scanner = card.getAttribute('data-scanner');
        const isVisible = activeSeverities.has(severity) && (activeScanners.size === 0 || activeScanners.has(scanner));
        card.hidden = !isVisible;
        if (isVisible) visibleCount++;
      }

      document.getElementById('findingsCount').textContent = `${visibleCount} findings`;
    };

    for (const checkbox of [...severityCheckboxes, ...scannerCheckboxes]) {
      checkbox.addEventListener('change', updateVisibility);
    }
  }, 0);
}

function renderJob(job) {
  const statusLabel = job.status[0].toUpperCase() + job.status.slice(1);
  jobStatusBadge.textContent = statusLabel;
  jobStatusBadge.className = `status-badge status-${job.status}`;
  jobMeta.textContent = buildJobMeta(job);
  buildProgress(job);
  renderSteps(job);
  renderReport(job);
}

async function loadJob(jobId) {
  const response = await fetch(`/api/jobs/${jobId}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Unable to load job');
  }

  renderJob(body);

  if (body.status && ['queued', 'running'].includes(body.status)) {
    return true;
  }

  return false;
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function startPolling(jobId) {
  stopPolling();
  state.currentJobId = jobId;
  state.pollTimer = setInterval(async () => {
    try {
      const shouldContinue = await loadJob(jobId);
      if (!shouldContinue) stopPolling();
    } catch (error) {
      stopPolling();
      setError(error.message);
    }
  }, 2000);
}

function getSelectedMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || 'folder';
}

async function parseApiResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    if (/<!doctype html/i.test(text)) {
      return { error: `Request failed (${response.status}). The server returned an unexpected HTML error page.` };
    }
    return { error: text };
  }
}

function buildFolderFormData() {
  const files = Array.from(folderInput.files || []);
  if (!files.length) {
    throw new Error('Select a source folder before starting the scan.');
  }
  if (files.length > MAX_DIRECT_FILE_COUNT) {
    throw new Error(`This folder has ${formatCount(files.length)} files. Direct browser upload is capped at ${formatCount(MAX_DIRECT_FILE_COUNT)} files for performance. Compress it as a .zip or .tar.gz and use Archive mode instead.`);
  }

  const formData = new FormData();
  formData.append('mode', 'folder');
  formData.append('submissionName', document.getElementById('submissionName').value.trim());
  formData.append('folderName', files[0].webkitRelativePath.split('/')[0]);
  for (const file of files) {
    formData.append('files', file, file.name);
    formData.append('relativePaths', file.webkitRelativePath || file.name);
  }
  return formData;
}

function buildArchiveFormData() {
  const file = archiveInput.files?.[0];
  if (!file) {
    throw new Error('Select an archive before starting the scan.');
  }
  if (file.size > MAX_ARCHIVE_SIZE_BYTES) {
    throw new Error(`This archive is ${formatBytes(file.size)}. Gatekeeper currently accepts archives up to ${formatBytes(MAX_ARCHIVE_SIZE_BYTES)}.`);
  }

  const formData = new FormData();
  formData.append('mode', 'archive');
  formData.append('submissionName', document.getElementById('submissionName').value.trim() || file.name);
  formData.append('files', file, file.name);
  return formData;
}

async function submitUpload(event) {
  event.preventDefault();
  setError(null);
  submitButton.disabled = true;
  submitButton.textContent = 'Uploading…';

  try {
    const mode = getSelectedMode();
    const formData = mode === 'folder' ? buildFolderFormData() : buildArchiveFormData();
    const response = await fetch('/api/jobs/upload', { method: 'POST', body: formData });
    const body = await parseApiResponse(response);
    if (!response.ok) {
      throw new Error(body.error || 'Upload failed');
    }

    await loadJob(body.jobId);
    startPolling(body.jobId);
  } catch (error) {
    setError(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Start scan';
  }
}

document.querySelectorAll('input[name="mode"]').forEach(input => {
  input.addEventListener('change', () => setMode(input.value));
});

folderInput.addEventListener('change', () => {
  const files = Array.from(folderInput.files || []);
  if (!files.length) {
    folderSummary.textContent = 'No folder selected yet.';
    setError(null);
    return;
  }
  const root = files[0].webkitRelativePath.split('/')[0];
  folderSummary.textContent = `${root} • ${formatCount(files.length)} files queued for upload`;

  if (files.length > MAX_DIRECT_FILE_COUNT) {
    setWarning(`Large project detected: ${formatCount(files.length)} files. Use Archive mode with a .zip or .tar.gz for a much faster and more reliable intake.`);
    return;
  }

  if (files.length > WARN_DIRECT_FILE_COUNT) {
    setWarning(`Large project detected: ${formatCount(files.length)} files. Direct folder upload may feel slow in the browser. Archive mode is recommended for better performance.`);
    return;
  }

  setError(null);
});

archiveInput.addEventListener('change', () => {
  const file = archiveInput.files?.[0];
  archiveSummary.textContent = file ? `${file.name} • ${formatCount(file.size)} bytes` : 'No archive selected yet.';
  if (!file) {
    setError(null);
    return;
  }
  if (file.size > MAX_ARCHIVE_SIZE_BYTES) {
    setWarning(`Archive is ${formatBytes(file.size)}. The current intake limit is ${formatBytes(MAX_ARCHIVE_SIZE_BYTES)}.`);
    return;
  }
  setError(null);
});

uploadForm.addEventListener('submit', submitUpload);
setMode('folder');
