const state = {
  mode: 'archive',
  currentJobId: null,
  pollTimer: null,
  uploadConfig: {
    warnDirectFileCount: 2000,
    maxDirectFileCount: 5000,
    maxArchiveSizeBytes: 4 * 1024 * 1024 * 1024,
    recommendedMode: 'archive',
  },
};

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function findingRowMarkup(finding, severity, severityNames) {
  const title = escapeHtml(finding.title || 'Finding');
  const scanner = escapeHtml(finding.scanner || 'Unknown');
  const category = escapeHtml(finding.category || 'General');
  const file = escapeHtml(finding.file || 'No file path');
  const detail = escapeHtml(finding.detail || 'No details available.');
  const recommendation = escapeHtml(finding.recommendation || 'No recommendation provided.');

  return `
    <article class="finding-row" data-severity="${escapeHtml(severity)}" data-scanner="${escapeHtml(finding.scanner || '')}">
      <button type="button" class="finding-row-summary finding-row-toggle" aria-expanded="false">
        <span class="finding-pill finding-pill-${escapeHtml(severity)}">${escapeHtml(severityNames[severity] || severity)}</span>
        <span class="finding-row-title">${title}</span>
        <span class="finding-row-meta">${scanner}</span>
        <span class="finding-row-meta">${category}</span>
        <span class="finding-row-file">${file}</span>
      </button>
      <div class="finding-row-body" hidden>
        <div class="finding-row-block">
          <strong>Detail</strong>
          <p>${detail}</p>
        </div>
        <div class="finding-row-block">
          <strong>Recommendation</strong>
          <p>${recommendation}</p>
        </div>
      </div>
    </article>
  `;
}

function getWarnDirectFileCount() {
  return Number(state.uploadConfig.warnDirectFileCount || 2000);
}

function getMaxDirectFileCount() {
  return Number(state.uploadConfig.maxDirectFileCount || 5000);
}

function getMaxArchiveSizeBytes() {
  return Number(state.uploadConfig.maxArchiveSizeBytes || (4 * 1024 * 1024 * 1024));
}

function setMode(mode) {
  state.mode = mode;
  folderPicker.classList.toggle('is-active', mode === 'folder');
  archivePicker.classList.toggle('is-active', mode === 'archive');
  uploadError.hidden = true;
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const body = await parseApiResponse(response);
    if (!response.ok || !body?.upload) return;
    state.uploadConfig = {
      warnDirectFileCount: Number(body.upload.warnDirectFileCount || state.uploadConfig.warnDirectFileCount),
      maxDirectFileCount: Number(body.upload.maxDirectFileCount || state.uploadConfig.maxDirectFileCount),
      maxArchiveSizeBytes: Number(body.upload.maxFileSizeBytes || state.uploadConfig.maxArchiveSizeBytes),
      recommendedMode: body.upload.recommendedMode || 'archive',
    };
  } catch (_error) {
    // Keep local defaults when config bootstrap is unavailable.
  }
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

  reportSummary.innerHTML = '';

  const reportHeader = createNode('div', 'report-header');
  const reportTitle = createNode('div', 'report-title');
  reportTitle.appendChild(createNode('div', 'eyebrow', 'Scan Results'));
  reportTitle.appendChild(createNode('h2', '', 'Security Report'));
  reportHeader.appendChild(reportTitle);

  const severitySummary = createNode('div', 'severity-summary');
  const severityDonut = createNode('div', 'severity-donut');
  severityDonut.style.background = donutGradient;
  const donutInner = createNode('div', 'donut-inner');
  donutInner.appendChild(createNode('strong', '', String(totalFindings)));
  donutInner.appendChild(createNode('span', '', 'Findings'));
  severityDonut.appendChild(donutInner);
  severitySummary.appendChild(severityDonut);

  const severityLegend = createNode('div', 'severity-legend');
  for (const severity of severities) {
    const row = createNode('div', 'legend-row');
    const dot = createNode('span', 'legend-dot');
    dot.style.background = severityColors[severity];
    row.appendChild(dot);
    row.appendChild(document.createTextNode(`${severityNames[severity]} `));
    row.appendChild(createNode('strong', '', String(counts[severity] || 0)));
    severityLegend.appendChild(row);
  }
  severitySummary.appendChild(severityLegend);
  reportHeader.appendChild(severitySummary);

  const reportBody = createNode('div', 'report-body');
  const reportFilters = createNode('div', 'report-filters');

  const severityFilterGroup = createNode('div', 'filter-group');
  severityFilterGroup.appendChild(createNode('div', 'filter-title', 'Severity'));
  for (const severity of severities) {
    const label = createNode('label', 'filter-checkbox');
    label.dataset.severity = severity;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    const labelText = createNode('span', '', severityNames[severity]);
    labelText.style.color = severityColors[severity];
    const countNode = createNode('span', 'filter-count', String(counts[severity] || 0));
    label.appendChild(checkbox);
    label.appendChild(labelText);
    label.appendChild(countNode);
    severityFilterGroup.appendChild(label);
  }
  reportFilters.appendChild(severityFilterGroup);

  if (scannerList.length > 1) {
    const scannerFilterGroup = createNode('div', 'filter-group');
    scannerFilterGroup.appendChild(createNode('div', 'filter-title', 'Scanner'));
    for (const scanner of scannerList) {
      const label = createNode('label', 'filter-checkbox');
      label.dataset.scanner = scanner;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      label.appendChild(checkbox);
      label.appendChild(createNode('span', '', scanner));
      scannerFilterGroup.appendChild(label);
    }
    reportFilters.appendChild(scannerFilterGroup);
  }
  reportBody.appendChild(reportFilters);

  const reportMain = createNode('div', 'report-main');
  const findingsToolbar = createNode('div', 'findings-toolbar');
  const findingsCount = createNode('span', 'findings-count', `${totalFindings} findings`);
  findingsCount.id = 'findingsCount';
  findingsToolbar.appendChild(findingsCount);
  reportMain.appendChild(findingsToolbar);

  const findingsContainer = createNode('div', 'findings-container findings-list');
  findingsContainer.innerHTML = severities
    .flatMap((severity) => grouped[severity].map((finding) => findingRowMarkup(finding, severity, severityNames)))
    .join('');
  reportMain.appendChild(findingsContainer);
  reportBody.appendChild(reportMain);

  const reportFooter = createNode('div', 'report-footer');
  const downloads = createNode('div', 'downloads');
  const htmlLink = createNode('a', 'primary', 'Open HTML report');
  htmlLink.href = job.downloads.html;
  htmlLink.target = '_blank';
  htmlLink.rel = 'noreferrer';
  const jsonLink = createNode('a', 'secondary', 'Download JSON');
  jsonLink.href = job.downloads.json;
  jsonLink.target = '_blank';
  jsonLink.rel = 'noreferrer';
  downloads.appendChild(htmlLink);
  downloads.appendChild(jsonLink);
  reportFooter.appendChild(downloads);

  reportSummary.appendChild(reportHeader);
  reportSummary.appendChild(reportBody);
  reportSummary.appendChild(reportFooter);

  const severityCheckboxes = reportSummary.querySelectorAll('[data-severity] input');
  const scannerCheckboxes = reportSummary.querySelectorAll('[data-scanner] input');
  const cards = reportSummary.querySelectorAll('.finding-row');
  const toggles = reportSummary.querySelectorAll('.finding-row-toggle');

  for (const toggle of toggles) {
    toggle.addEventListener('click', () => {
      const row = toggle.closest('.finding-row');
      const body = row?.querySelector('.finding-row-body');
      if (!row || !body) return;
      const open = row.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.hidden = !open;
    });
  }

  const updateVisibility = () => {
    const activeSeverities = new Set(Array.from(severityCheckboxes).filter(c => c.checked).map(c => c.parentElement.getAttribute('data-severity')));
    const activeScanners = new Set(Array.from(scannerCheckboxes).filter(c => c.checked).map(c => c.parentElement.getAttribute('data-scanner')));
    let visibleCount = 0;

    for (const card of cards) {
      const severity = card.getAttribute('data-severity');
      const scanner = card.getAttribute('data-scanner');
      const isVisible = activeSeverities.has(severity) && (activeScanners.size === 0 || activeScanners.has(scanner));
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    }

    findingsCount.textContent = `${visibleCount} findings`;
  };

  for (const checkbox of [...severityCheckboxes, ...scannerCheckboxes]) {
    checkbox.addEventListener('change', updateVisibility);
  }

  updateVisibility();

  // Add binary artifacts section if present
  if (job.report.binaries && job.report.binaries.length > 0) {
    const binariesSection = document.createElement('div');
    binariesSection.className = 'binaries-section';

    const header = document.createElement('div');
    header.className = 'binaries-header';
    const title = document.createElement('h3');
    title.textContent = 'Binary Artifacts';
    const count = document.createElement('span');
    count.className = 'binary-count';
    count.textContent = `${job.report.binaries.length} detected`;
    header.appendChild(title);
    header.appendChild(count);
    binariesSection.appendChild(header);

    const list = document.createElement('div');
    list.className = 'binaries-list';
    for (const binary of job.report.binaries) {
      const artifact = document.createElement('div');
      artifact.className = 'binary-artifact';
      artifact.innerHTML = `
        <div class="binary-file">${binary.file}</div>
        <div class="binary-meta">
          <span class="binary-ext">${binary.extension}</span>
          <span class="binary-size">${(binary.size / 1024 / 1024).toFixed(2)} MB</span>
          <span class="binary-hash" title="${binary.hash || 'N/A'}">${binary.hash ? binary.hash.substring(0, 16) + '...' : 'N/A'}</span>
        </div>
      `;
      list.appendChild(artifact);
    }
    binariesSection.appendChild(list);
    reportSummary.appendChild(binariesSection);
  }
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
  if (files.length > getMaxDirectFileCount()) {
    throw new Error(`This folder has ${formatCount(files.length)} files. Direct browser upload is capped at ${formatCount(getMaxDirectFileCount())} files for performance. Compress it as a .zip or .tar.gz and use Archive mode instead.`);
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
  if (file.size > getMaxArchiveSizeBytes()) {
    throw new Error(`This archive is ${formatBytes(file.size)}. Gatekeeper currently accepts archives up to ${formatBytes(getMaxArchiveSizeBytes())}.`);
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

  if (files.length > getMaxDirectFileCount()) {
    setWarning(`Large project detected: ${formatCount(files.length)} files. Use Archive mode with a .zip or .tar.gz for a much faster and more reliable intake.`);
    return;
  }

  if (files.length > getWarnDirectFileCount()) {
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
  if (file.size > getMaxArchiveSizeBytes()) {
    setWarning(`Archive is ${formatBytes(file.size)}. The current intake limit is ${formatBytes(getMaxArchiveSizeBytes())}.`);
    return;
  }
  setError(null);
});

uploadForm.addEventListener('submit', submitUpload);

async function bootstrap() {
  await loadConfig();
  setMode(state.uploadConfig.recommendedMode || 'archive');
  const preferredModeInput = document.querySelector(`input[name="mode"][value="${state.mode}"]`);
  if (preferredModeInput) preferredModeInput.checked = true;
}

bootstrap();
