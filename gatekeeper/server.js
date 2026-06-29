const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const tar = require('tar');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
const PORT = Number(process.env.PORT || 8095);
const ROOT = __dirname;
const RUNTIME_DIR = path.join(ROOT, 'runtime');
const TEMP_DIR = path.join(RUNTIME_DIR, 'tmp');
const JOBS_DIR = path.join(RUNTIME_DIR, 'jobs');
const MAX_FILE_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 4096);
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const WARN_DIRECT_FILE_COUNT = Number(process.env.WARN_DIRECT_FILE_COUNT || 2000);
const MAX_DIRECT_FILE_COUNT = Number(process.env.MAX_DIRECT_FILE_COUNT || 5000);
const POLLABLE_STATUSES = new Set(['queued', 'running']);
const DEFAULT_SCAN_EXCLUDED_SEGMENTS = [
  'scan-reports',
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  'runtime',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.cache',
  '.scannerwork',
  '.terraform',
  'target',
  'out',
];
const SCAN_EXCLUDED_SEGMENTS = new Set(
  [
    ...DEFAULT_SCAN_EXCLUDED_SEGMENTS,
    ...String(process.env.SCAN_EXCLUDE_DIRS || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean),
  ].map(item => item.replace(/^\/+|\/+$/g, '')),
);

const appState = {
  jobs: new Map(),
};

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: MAX_FILE_SIZE, files: 10000 },
});

const ECOSYSTEM_RULES = [
  { id: 'node', label: 'Node.js', manifests: ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'], osv: 'npm' },
  { id: 'python', label: 'Python', manifests: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'poetry.lock'], osv: 'PyPI' },
  { id: 'powershell', label: 'PowerShell', manifests: ['*.ps1', '*.psm1', '*.psd1'] },
  { id: 'ruby', label: 'Ruby', manifests: ['Gemfile', 'Gemfile.lock'], osv: 'RubyGems' },
  { id: 'go', label: 'Go', manifests: ['go.mod', 'go.sum'], osv: 'Go' },
  { id: 'java', label: 'Java', manifests: ['pom.xml', 'build.gradle', 'build.gradle.kts'], osv: 'Maven' },
  { id: 'dotnet', label: '.NET', manifests: ['*.csproj', '*.fsproj', 'packages.config'], osv: 'NuGet' },
  { id: 'php', label: 'PHP', manifests: ['composer.json', 'composer.lock'], osv: 'Packagist' },
  { id: 'rust', label: 'Rust', manifests: ['Cargo.toml', 'Cargo.lock'] },
];

const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.sys', '.msi', '.cab',
  '.so', '.a', '.o',
  '.dylib', '.framework',
  '.jar', '.whl', '.egg',
  '.bin', '.out',
]);

const SIGNED_BINARY_RISK = [
  { ext: '.exe', title: 'Executable binary detected', risk: 'high', detail: 'Verify code signature and publisher' },
  { ext: '.dll', title: 'Dynamic library detected', risk: 'high', detail: 'Check load dependencies and signature' },
  { ext: '.so', title: 'Shared object detected', risk: 'high', detail: 'Verify compilation flags and symbols' },
  { ext: '.dylib', title: 'macOS library detected', risk: 'high', detail: 'Validate notarization and entitlements' },
  { ext: '.jar', title: 'Java archive detected', risk: 'medium', detail: 'Scan contained classes and verify signatures' },
  { ext: '.whl', title: 'Python wheel detected', risk: 'medium', detail: 'Inspect contained .so files and extensions' },
];

const TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cfg', '.conf', '.cpp', '.cs', '.css', '.env', '.erb', '.fs', '.go', '.gradle',
  '.groovy', '.h', '.hpp', '.html', '.ini', '.java', '.js', '.json', '.jsx', '.kts', '.md',
  '.php', '.pl', '.properties', '.ps1', '.psd1', '.psm1', '.py', '.rb', '.rs', '.scala', '.sh',
  '.sql', '.swift', '.tf', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml'
]);

const SECRET_PATTERNS = [
  { severity: 'critical', title: 'Private key material detected', scanner: 'secret-scan', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { severity: 'high', title: 'AWS access key pattern detected', scanner: 'secret-scan', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { severity: 'high', title: 'GitHub token pattern detected', scanner: 'secret-scan', regex: /\bghp_[A-Za-z0-9]{36}\b/ },
  { severity: 'medium', title: 'Hardcoded password indicator detected', scanner: 'secret-scan', regex: /\b(password|passwd|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/i },
  { severity: 'medium', title: 'Azure connection string indicator detected', scanner: 'secret-scan', regex: /\bDefaultEndpointsProtocol=https;AccountName=/i },
  { severity: 'medium', title: 'JWT secret indicator detected', scanner: 'secret-scan', regex: /\b(jwt_secret|jwtsecret|secret_key)\s*[:=]\s*['"][^'"]{8,}['"]/i },
];

const STALE_FILE_PATTERNS = [
  { match: file => /\.(bak|old|orig|tmp)$/i.test(file), title: 'Stale backup or temp file', severity: 'low' },
  { match: file => /(^|\/)(__pycache__|node_modules|dist|build|coverage|tmp)\//i.test(file), title: 'Bundled generated artifact directory detected', severity: 'info' },
  { match: file => /\.(pyc|pyo|class|o|obj)$/i.test(file), title: 'Compiled artifact committed to source tree', severity: 'low' },
];

const AI_MODEL_EXTENSIONS = new Set([
  '.bin', '.ckpt', '.ggml', '.gguf', '.onnx', '.pickle', '.pkl', '.pt', '.pth', '.safetensors'
]);

const AI_UNSAFE_MODEL_EXTENSIONS = new Set([
  '.bin', '.ckpt', '.pickle', '.pkl', '.pt', '.pth'
]);

const AI_MANIFEST_FILENAMES = new Set([
  'Modelfile',
  'adapter_config.json',
  'config.json',
  'generation_config.json',
  'model_index.json',
  'tokenizer_config.json',
]);

const AI_DEPENDENCY_HINTS = [
  { match: 'accelerate', label: 'Hugging Face Accelerate' },
  { match: 'anthropic', label: 'Anthropic SDK' },
  { match: 'autogen', label: 'AutoGen' },
  { match: 'crewai', label: 'CrewAI' },
  { match: 'diffusers', label: 'Diffusers' },
  { match: 'fastapi', label: 'FastAPI' },
  { match: 'gradio', label: 'Gradio' },
  { match: 'langchain', label: 'LangChain' },
  { match: 'llama-cpp', label: 'llama.cpp' },
  { match: 'llama-index', label: 'LlamaIndex' },
  { match: 'ollama', label: 'Ollama' },
  { match: 'openai', label: 'OpenAI SDK' },
  { match: 'sentence-transformers', label: 'Sentence Transformers' },
  { match: 'streamlit', label: 'Streamlit' },
  { match: 'tensorflow', label: 'TensorFlow' },
  { match: 'text-generation-webui', label: 'Text Generation WebUI' },
  { match: 'torch', label: 'PyTorch' },
  { match: 'transformers', label: 'Transformers' },
  { match: 'vllm', label: 'vLLM' },
];

const AI_PLUGIN_SURFACE_PATTERNS = [
  /(^|\/)(adapters?|agents?|extensions?|functions?|loras?|plugins?|prompts?|skills?|tools?)\//i,
  /(^|\/)(custom_nodes|toolkits)\//i,
];

function nowIso() {
  return new Date().toISOString();
}

function safeSlug(input) {
  return String(input || 'submission')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'submission';
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeRelativePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

function pathSegments(value) {
  return normalizeRelativePath(value)
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);
}

function isExcludedRelativePath(value) {
  const segments = pathSegments(value);
  if (!segments.length) return false;
  return segments.some(segment => SCAN_EXCLUDED_SEGMENTS.has(segment));
}

function normalizeFindingFile(file, sourceDir) {
  if (!file) return '';
  const raw = String(file).trim();
  if (!raw) return '';

  if (sourceDir && path.isAbsolute(raw)) {
    const relative = path.relative(sourceDir, raw).replace(/\\/g, '/');
    if (!relative.startsWith('..')) return normalizeRelativePath(relative);
  }

  return normalizeRelativePath(raw);
}

function buildRepeatedArgs(flag, values) {
  const args = [];
  for (const value of values || []) {
    args.push(flag, value);
  }
  return args;
}

function json(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function createJobRecord(name) {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const steps = [
    { key: 'verify', label: 'Verifying contents', status: 'pending', message: '' },
    { key: 'detect', label: 'Detecting ecosystems', status: 'pending', message: '' },
    { key: 'inventory', label: 'Building dependency inventory', status: 'pending', message: '' },
    { key: 'secrets', label: 'Scanning for secrets and risky patterns', status: 'pending', message: '' },
    { key: 'vulns', label: 'Scanning dependencies for vulnerabilities', status: 'pending', message: '' },
    { key: 'quality', label: 'Scanning for stale and dead-code indicators', status: 'pending', message: '' },
    { key: 'binaries', label: 'Analyzing binary artifacts for supply chain', status: 'pending', message: '' },
    { key: 'report', label: 'Generating downloadable reports', status: 'pending', message: '' },
  ];
  const job = {
    id,
    name,
    status: 'queued',
    createdAt,
    updatedAt: createdAt,
    progress: 0,
    steps,
    summary: null,
    report: null,
    downloads: null,
    error: null,
  };
  appState.jobs.set(id, job);
  return job;
}

function updateJob(job, patch) {
  Object.assign(job, patch, { updatedAt: nowIso() });
}

function updateStep(job, key, patch) {
  const step = job.steps.find(item => item.key === key);
  if (!step) return;
  Object.assign(step, patch);
  job.updatedAt = nowIso();
  const completed = job.steps.filter(item => item.status === 'completed').length;
  job.progress = Math.round((completed / job.steps.length) * 100);
}

async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true });
}

function safeJoin(baseDir, relativePath) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(baseDir, normalized);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error(`Unsafe path rejected: ${relativePath}`);
  }
  return resolved;
}

async function writeUploadedFolder(files, relativePaths, sourceDir) {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const relativePath = relativePaths[index] || file.originalname;
    const destination = safeJoin(sourceDir, relativePath);
    await ensureDir(path.dirname(destination));
    await fsp.copyFile(file.path, destination);
  }
}

async function extractArchive(archivePath, archiveName, sourceDir) {
  const lower = archiveName.toLowerCase();
  if (lower.endsWith('.zip')) {
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(sourceDir, true);
    return;
  }

  if (lower.endsWith('.tar') || lower.endsWith('.tgz') || lower.endsWith('.tar.gz')) {
    await tar.extract({ file: archivePath, cwd: sourceDir, strict: true });
    return;
  }

  throw new Error('Unsupported archive type. Upload a folder, .zip, .tar, or .tar.gz file.');
}

async function removeTempFiles(files) {
  await Promise.all(
    (files || []).map(file => fsp.rm(file.path, { force: true }).catch(() => {})),
  );
}

async function walkFiles(rootDir) {
  const files = [];
  const excludedDirectories = [];

  async function visit(currentDir) {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (isExcludedRelativePath(relativePath)) {
          excludedDirectories.push(normalizeRelativePath(relativePath));
          continue;
        }
        await visit(absolutePath);
      } else if (entry.isFile()) {
        if (isExcludedRelativePath(relativePath)) continue;
        files.push({ absolutePath, relativePath: normalizeRelativePath(relativePath), ext: path.extname(entry.name).toLowerCase(), name: entry.name });
      }
    }
  }

  await visit(rootDir);
  return { files, excludedDirectories: Array.from(new Set(excludedDirectories)).sort() };
}

async function fileExists(target) {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

function addFinding(report, finding) {
  const normalizedFile = normalizeFindingFile(finding.file, report.sourceDir);
  if (normalizedFile && isExcludedRelativePath(normalizedFile)) {
    report.filteredFindings = (report.filteredFindings || 0) + 1;
    return;
  }
  report.findings.push({
    ...finding,
    file: normalizedFile || finding.file || '',
  });
}

function addToolNote(report, note) {
  report.toolNotes.push(note);
}

function calculateFileHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return null;
  }
}

async function analyzeBinaries(sourceDir, files, report) {
  const binaries = [];
  const binaryFindings = [];

  for (const file of files) {
    if (!BINARY_EXTENSIONS.has(file.ext)) continue;

    const fullPath = path.join(sourceDir, file.relativePath);
    const stats = fs.statSync(fullPath);
    const hash = calculateFileHash(fullPath);

    const binaryInfo = {
      file: file.relativePath,
      extension: file.ext,
      size: stats.size,
      hash,
      modified: stats.mtime.toISOString(),
    };

    binaries.push(binaryInfo);

    const riskProfile = SIGNED_BINARY_RISK.find(r => r.ext === file.ext);
    if (riskProfile) {
      binaryFindings.push({
        scanner: 'binary-scan',
        category: 'binary-artifact',
        severity: riskProfile.risk === 'high' ? 'high' : 'medium',
        title: riskProfile.title,
        file: file.relativePath,
        detail: `Binary artifact found. ${riskProfile.detail} SHA256: ${hash}`,
        recommendation: 'Verify binary provenance, code signatures, and build reproducibility. Consider documenting build process and security scanning results.',
        hash,
        fileSize: stats.size,
      });
    }
  }

  if (binaries.length > 0) {
    report.binaries = binaries;
    for (const finding of binaryFindings) {
      addFinding(report, finding);
    }
  }

  if (binaryFindings.length > 0) {
    addToolNote(report, {
      tool: 'binary-scan',
      status: 'completed',
      detail: `Detected ${binaries.length} binary artifacts. Review hashes for supply chain verification.`,
    });
  }
}

async function detectEcosystems(files, sourceDir) {
  const matchSet = new Map();
  for (const rule of ECOSYSTEM_RULES) {
    matchSet.set(rule.id, []);
  }

  for (const file of files) {
    for (const rule of ECOSYSTEM_RULES) {
      for (const pattern of rule.manifests) {
        if (pattern.startsWith('*.')) {
          if (file.ext === pattern.slice(1)) {
            matchSet.get(rule.id).push(file.relativePath);
          }
          continue;
        }
        if (path.basename(file.relativePath) === pattern) {
          matchSet.get(rule.id).push(file.relativePath);
        }
      }
    }
  }

  const ecosystems = [];
  for (const rule of ECOSYSTEM_RULES) {
    const manifests = Array.from(new Set(matchSet.get(rule.id)));
    if (!manifests.length) continue;
    ecosystems.push({
      id: rule.id,
      label: rule.label,
      manifests,
      osv: rule.osv || null,
      rootHints: Array.from(new Set(manifests.map(item => path.dirname(item) === '.' ? '' : path.dirname(item)))),
    });
  }

  const rootFiles = [];
  for (const candidate of ['Dockerfile', '.gitlab-ci.yml', '.github/workflows', 'docker-compose.yml', 'compose.yaml']) {
    const exists = await fileExists(path.join(sourceDir, candidate));
    if (exists) rootFiles.push(candidate);
  }

  return { ecosystems, rootFiles };
}

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function sanitizeRelative(target, sourceDir) {
  return path.relative(sourceDir, target).replace(/\\/g, '/');
}

async function analyzeAiIntake(sourceDir, files, dependencies, report) {
  const frameworks = uniqueStrings(
    (dependencies || []).flatMap(dep => {
      const name = String(dep.name || '').toLowerCase();
      return AI_DEPENDENCY_HINTS
        .filter(hint => name.includes(hint.match))
        .map(hint => hint.label);
    }),
  );

  const manifests = [];
  const modelArtifacts = [];
  const pluginSurfaces = [];
  const runtimeExposureHints = [];

  for (const file of files) {
    const baseName = path.basename(file.relativePath);
    if (AI_MANIFEST_FILENAMES.has(baseName)) {
      manifests.push(file.relativePath);
    }

    if (AI_MODEL_EXTENSIONS.has(file.ext)) {
      modelArtifacts.push({
        file: file.relativePath,
        extension: file.ext,
        safeFormat: !AI_UNSAFE_MODEL_EXTENSIONS.has(file.ext),
      });
    }

    if (AI_PLUGIN_SURFACE_PATTERNS.some(pattern => pattern.test(file.relativePath))) {
      pluginSurfaces.push(file.relativePath);
    }

    if (!TEXT_EXTENSIONS.has(file.ext) && baseName !== 'Modelfile') {
      continue;
    }

    const raw = await readText(file.absolutePath, 1024 * 512);
    if (!raw) continue;

    if (
      /\bgradio\b/i.test(raw)
      && (/share\s*=\s*True/i.test(raw) || /server_name\s*=\s*["']0\.0\.0\.0["']/i.test(raw))
    ) {
      runtimeExposureHints.push({
        file: file.relativePath,
        title: 'Gradio service exposed beyond localhost',
        detail: 'The code appears to launch a Gradio interface with external sharing or a 0.0.0.0 bind.',
      });
    }

    if (
      /\b(streamlit|uvicorn|fastapi)\b/i.test(raw)
      && (/0\.0\.0\.0/.test(raw) || /allow_origins\s*=\s*\[\s*["']\*["']\s*\]/i.test(raw))
    ) {
      runtimeExposureHints.push({
        file: file.relativePath,
        title: 'AI application runtime appears internet-bindable',
        detail: 'The code appears to bind a web runtime publicly or enable permissive CORS.',
      });
    }

    if (/trust_remote_code\s*=\s*True/i.test(raw)) {
      runtimeExposureHints.push({
        file: file.relativePath,
        title: 'Remote model code execution is enabled',
        detail: 'Model loading appears to enable remote custom code execution during artifact fetch/load.',
      });
    }
  }

  for (const artifact of modelArtifacts.filter(item => !item.safeFormat)) {
    addFinding(report, {
      scanner: 'ai-intake',
      category: 'model-supply-chain',
      severity: 'high',
      title: 'Pickle-style or executable model artifact detected',
      file: artifact.file,
      detail: `The submission contains ${artifact.extension} model weights, which can embed executable payloads or unsafe serialization behavior.`,
      recommendation: 'Require provenance review, hash validation, and prefer safer interchange formats such as safetensors, GGUF, or ONNX where possible.',
    });
  }

  for (const surface of uniqueStrings(pluginSurfaces)) {
    addFinding(report, {
      scanner: 'ai-intake',
      category: 'prompt-plugin-surface',
      severity: 'medium',
      title: 'Prompt, agent, or plugin extension surface detected',
      file: surface,
      detail: 'The repository contains a folder commonly used for prompt packs, extensions, custom tools, or agent wiring.',
      recommendation: 'Review prompt injection controls, tool allowlists, and any untrusted plugin execution boundaries before approval.',
    });
  }

  for (const hint of runtimeExposureHints) {
    addFinding(report, {
      scanner: 'ai-intake',
      category: 'runtime-exposure',
      severity: 'medium',
      title: hint.title,
      file: hint.file,
      detail: hint.detail,
      recommendation: 'Constrain network binding, restrict origins, and require authenticated access paths before deployment.',
    });
  }

  const ai = {
    detected: frameworks.length > 0 || manifests.length > 0 || modelArtifacts.length > 0 || pluginSurfaces.length > 0,
    frameworks,
    manifests: uniqueStrings(manifests),
    modelArtifacts,
    pluginSurfaces: uniqueStrings(pluginSurfaces).slice(0, 40),
    runtimeExposureHints,
  };

  addToolNote(report, {
    tool: 'ai-intake',
    status: ai.detected ? 'completed' : 'skipped',
    detail: ai.detected
      ? `Detected ${ai.frameworks.length} AI framework hints, ${ai.modelArtifacts.length} model artifacts, ${ai.manifests.length} model manifests, and ${ai.runtimeExposureHints.length} runtime exposure hints.`
      : 'No obvious AI/LLM model artifacts, manifests, or framework dependencies were detected.',
  });

  return ai;
}

async function readText(target, limit = 1024 * 1024) {
  const stat = await fsp.stat(target);
  if (stat.size > limit) return null;
  const buffer = await fsp.readFile(target);
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
}

async function extractDependencies(sourceDir, files) {
  const inventory = [];

  async function addFromPackageJson(relativePath) {
    const raw = await readText(path.join(sourceDir, relativePath));
    const parsed = safeJsonParse(raw, {});
    for (const [scope, deps] of Object.entries({
      production: parsed.dependencies || {},
      development: parsed.devDependencies || {},
      peer: parsed.peerDependencies || {},
      optional: parsed.optionalDependencies || {},
    })) {
      for (const [name, version] of Object.entries(deps)) {
        inventory.push({ ecosystem: 'npm', manager: 'package.json', scope, name, version: String(version), source: relativePath });
      }
    }
  }

  async function addFromRequirements(relativePath) {
    const raw = await readText(path.join(sourceDir, relativePath));
    if (!raw) return;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*([=><!~]{1,2})?\s*([A-Za-z0-9_.+-]+)?/);
      if (!match) continue;
      inventory.push({
        ecosystem: 'PyPI',
        manager: 'requirements.txt',
        scope: 'default',
        name: match[1],
        version: match[3] || '',
        specifier: match[2] || '',
        source: relativePath,
      });
    }
  }

  async function addFromGemfile(relativePath) {
    const raw = await readText(path.join(sourceDir, relativePath));
    if (!raw) return;
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/);
      if (!match) continue;
      inventory.push({ ecosystem: 'RubyGems', manager: 'Gemfile', scope: 'default', name: match[1], version: match[2] || '', source: relativePath });
    }
  }

  async function addFromGoMod(relativePath) {
    const raw = await readText(path.join(sourceDir, relativePath));
    if (!raw) return;
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9./_-]+)\s+v([A-Za-z0-9.+-]+)/);
      if (!match) continue;
      inventory.push({ ecosystem: 'Go', manager: 'go.mod', scope: 'default', name: match[1], version: `v${match[2]}`, source: relativePath });
    }
  }

  async function addFromComposer(relativePath) {
    const raw = await readText(path.join(sourceDir, relativePath));
    const parsed = safeJsonParse(raw, {});
    for (const [scope, deps] of Object.entries({
      production: parsed.require || {},
      development: parsed['require-dev'] || {},
    })) {
      for (const [name, version] of Object.entries(deps)) {
        inventory.push({ ecosystem: 'Packagist', manager: 'composer.json', scope, name, version: String(version), source: relativePath });
      }
    }
  }

  async function addFromCsProj(relativePath) {
    const raw = await readText(path.join(sourceDir, relativePath));
    if (!raw) return;
    const regex = /<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"/g;
    let match;
    while ((match = regex.exec(raw))) {
      inventory.push({ ecosystem: 'NuGet', manager: 'csproj', scope: 'default', name: match[1], version: match[2], source: relativePath });
    }
  }

  async function addFromPom(relativePath) {
    const raw = await readText(path.join(sourceDir, relativePath));
    if (!raw) return;
    const regex = /<dependency>[\s\S]*?<groupId>([^<]+)<\/groupId>[\s\S]*?<artifactId>([^<]+)<\/artifactId>[\s\S]*?(?:<version>([^<]+)<\/version>)?/g;
    let match;
    while ((match = regex.exec(raw))) {
      inventory.push({ ecosystem: 'Maven', manager: 'pom.xml', scope: 'default', name: `${match[1]}:${match[2]}`, version: match[3] || '', source: relativePath });
    }
  }

  for (const file of files) {
    const base = path.basename(file.relativePath);
    if (base === 'package.json') await addFromPackageJson(file.relativePath);
    if (base === 'requirements.txt') await addFromRequirements(file.relativePath);
    if (base === 'Gemfile') await addFromGemfile(file.relativePath);
    if (base === 'go.mod') await addFromGoMod(file.relativePath);
    if (base === 'composer.json') await addFromComposer(file.relativePath);
    if (/\.csproj$/i.test(base)) await addFromCsProj(file.relativePath);
    if (base === 'pom.xml') await addFromPom(file.relativePath);
  }

  return inventory;
}

function cleanVersion(version) {
  if (!version) return '';
  return String(version)
    .replace(/^[\^~<>=\s]+/, '')
    .replace(/[,|].*$/, '')
    .trim();
}

async function queryOsvDependency(dep) {
  const version = cleanVersion(dep.version);
  if (!dep.ecosystem || !version) return null;

  const response = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      package: { ecosystem: dep.ecosystem, name: dep.name },
      version,
    }),
  });

  if (!response.ok) {
    throw new Error(`OSV responded ${response.status}`);
  }

  return response.json();
}

function mapSeverity(raw) {
  const normalized = String(raw || '').toLowerCase();
  if (normalized.includes('critical')) return 'critical';
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('moderate') || normalized.includes('medium')) return 'medium';
  if (normalized.includes('low')) return 'low';
  return 'medium';
}

async function scanDependenciesWithOsv(report, inventory) {
  const unique = [];
  const seen = new Set();
  for (const dep of inventory) {
    const ecosystem = dep.ecosystem;
    const version = cleanVersion(dep.version);
    if (!ecosystem || !version) continue;
    const key = `${ecosystem}:${dep.name}:${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(dep);
  }

  const batch = unique.slice(0, 120);
  if (!batch.length) {
    addToolNote(report, { tool: 'osv.dev', status: 'skipped', detail: 'No exact-version dependencies were available for vulnerability lookup.' });
    return;
  }

  let matches = 0;
  for (const dep of batch) {
    try {
      const body = await queryOsvDependency(dep);
      const vulns = body.vulns || [];
      for (const vuln of vulns) {
        matches += 1;
        addFinding(report, {
          scanner: 'osv.dev',
          category: 'dependency-vulnerability',
          severity: mapSeverity(vuln.database_specific?.severity || vuln.severity?.[0]?.type || 'medium'),
          title: `${dep.name} ${cleanVersion(dep.version)} has known vulnerability ${vuln.id}`,
          file: dep.source,
          detail: vuln.summary || vuln.details || 'Known vulnerable dependency version detected.',
          recommendation: 'Upgrade to a fixed dependency version and validate transitive consumers.',
          dependency: dep.name,
          ecosystem: dep.ecosystem,
          vulnerabilityId: vuln.id,
        });
      }
    } catch (error) {
      addToolNote(report, { tool: 'osv.dev', status: 'warning', detail: `Lookup failed for ${dep.name}: ${error.message}` });
    }
  }

  addToolNote(report, { tool: 'osv.dev', status: 'completed', detail: `Queried ${batch.length} exact-version dependencies, found ${matches} vulnerability matches.` });
}

async function commandExists(command) {
  return new Promise(resolve => {
    const child = spawn('bash', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
    child.on('exit', code => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', error => resolve({ code: 1, stdout, stderr: error.message }));
  });
}

async function runOptionalTools(report, sourceDir) {
  const packageJsonRoots = new Set();
  const requirementsFiles = [];
  const gemLockFiles = [];
  const pyFiles = [];
  const dockerfiles = [];
  const shellFiles = [];
  const goFiles = [];
  const checkovEligibleFiles = [];
  const excludedDirectories = report.summaryContext.excludedDirectories || [];

  for (const ecosystem of report.summaryContext.ecosystems || []) {
    if (ecosystem.id === 'node') {
      for (const hint of ecosystem.rootHints || []) {
        packageJsonRoots.add(path.join(sourceDir, hint || '.'));
      }
    }
    if (ecosystem.id === 'python') {
      for (const manifest of ecosystem.manifests || []) {
        if (path.basename(manifest) === 'requirements.txt') {
          requirementsFiles.push(path.join(sourceDir, manifest));
        }
      }
    }
    if (ecosystem.id === 'ruby') {
      for (const manifest of ecosystem.manifests || []) {
        if (path.basename(manifest) === 'Gemfile.lock') {
          gemLockFiles.push(path.join(sourceDir, manifest));
        }
      }
    }
  }

  for (const file of report.summaryContext.files || []) {
    if (file.ext === '.py') pyFiles.push(file.relativePath);
    if (file.ext === '.go') goFiles.push(file.relativePath);
    if (['.sh', '.bash', '.zsh', '.ksh'].includes(file.ext)) shellFiles.push(file.relativePath);
    if (['.tf', '.yaml', '.yml', '.json'].includes(file.ext) || /^Dockerfile(\.|$)/i.test(file.name)) {
      checkovEligibleFiles.push(file.relativePath);
    }
    if (
      file.name === 'Dockerfile'
      || /^Dockerfile\./i.test(file.name)
      || /\.(dockerfile|containerfile)$/i.test(file.name)
    ) {
      dockerfiles.push(file.relativePath);
    }
  }

  const tools = [
    {
      name: 'trufflehog',
      args: ['filesystem', '--json', '.'],
      allowNonZero: true,
      shouldRun: () => true,
      parse(result) {
        const lines = result.stdout.split(/\r?\n/).filter(Boolean);
        let count = 0;
        for (const line of lines) {
          const item = safeJsonParse(line, null);
          if (!item) continue;
          const file =
            item.SourceMetadata?.Data?.Filesystem?.file
            || item.SourceMetadata?.Data?.Filesystem?.path
            || item.SourceMetadata?.Data?.Git?.file
            || '';
          count += 1;
          addFinding(report, {
            scanner: 'trufflehog',
            category: 'secret-exposure',
            severity: item.Verified ? 'critical' : 'high',
            title: item.DetectorName || item.DetectorType || 'Credential material detected',
            file,
            detail: item.Raw || item.Redacted || 'TruffleHog detected secret-like material in the repository.',
            recommendation: 'Remove the secret from source control, rotate the exposed credential, and move it into managed secret storage.',
          });
        }
        addToolNote(report, { tool: 'trufflehog', status: 'completed', detail: `TruffleHog executed successfully and reported ${count} findings.` });
      },
    },
    {
      name: 'trivy',
      args: ['fs', '--format', 'json', '--scanners', 'vuln,secret,misconfig', ...buildRepeatedArgs('--skip-dirs', excludedDirectories), '.'],
      allowNonZero: true,
      shouldRun: () => true,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const results = body.Results || [];
        let count = 0;
        for (const entry of results) {
          for (const vuln of entry.Vulnerabilities || []) {
            count += 1;
            addFinding(report, {
              scanner: 'trivy',
              category: 'dependency-vulnerability',
              severity: mapSeverity(vuln.Severity || 'medium'),
              title: `${vuln.PkgName || 'Dependency'} ${vuln.InstalledVersion || ''} has known vulnerability ${vuln.VulnerabilityID || ''}`.trim(),
              file: entry.Target || '',
              detail: vuln.Title || vuln.Description || 'Trivy detected a vulnerable dependency.',
              recommendation: vuln.FixedVersion
                ? `Upgrade to fixed version ${vuln.FixedVersion}.`
                : 'Upgrade the affected package or lockfile to a fixed version.',
            });
          }
          for (const finding of entry.Misconfigurations || []) {
            count += 1;
            addFinding(report, {
              scanner: 'trivy',
              category: 'misconfiguration',
              severity: mapSeverity(finding.Severity || 'medium'),
              title: finding.Title || finding.ID || 'Misconfiguration detected',
              file: entry.Target || '',
              detail: finding.Description || finding.Message || 'Trivy detected a configuration issue.',
              recommendation: finding.Resolution || 'Apply the recommended secure configuration change.',
            });
          }
          for (const secret of entry.Secrets || []) {
            count += 1;
            addFinding(report, {
              scanner: 'trivy',
              category: 'secret-exposure',
              severity: mapSeverity(secret.Severity || 'high'),
              title: secret.Title || secret.RuleID || 'Secret detected',
              file: entry.Target || '',
              detail: secret.Match || secret.Category || 'Trivy detected embedded secret material.',
              recommendation: 'Remove the secret from source, rotate the credential, and move it to managed secret storage.',
            });
          }
        }
        addToolNote(report, { tool: 'trivy', status: 'completed', detail: `Trivy executed successfully and reported ${count} findings.` });
      },
    },
    {
      name: 'grype',
      args: ['dir:.', '-o', 'json'],
      allowNonZero: true,
      shouldRun: () => true,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const matches = body.matches || [];
        for (const match of matches.slice(0, 500)) {
          const artifact = match.artifact || {};
          const vuln = match.vulnerability || {};
          const fix = (match.fix && match.fix.versions && match.fix.versions[0]) || '';
          addFinding(report, {
            scanner: 'grype',
            category: 'dependency-vulnerability',
            severity: mapSeverity(vuln.severity || 'medium'),
            title: `${artifact.name || 'Dependency'} ${artifact.version || ''} has known vulnerability ${vuln.id || ''}`.trim(),
            file: (artifact.locations && artifact.locations[0] && artifact.locations[0].path) || '',
            detail: vuln.description || vuln.dataSource || 'Grype detected a vulnerable artifact.',
            recommendation: fix
              ? `Upgrade to fixed version ${fix}.`
              : 'Upgrade or replace the affected dependency.',
          });
        }
        addToolNote(report, { tool: 'grype', status: 'completed', detail: `Grype executed successfully and reported ${matches.length} findings.` });
      },
    },
    {
      name: 'semgrep',
      args: ['scan', '--config', 'auto', '--json', ...buildRepeatedArgs('--exclude', excludedDirectories), '.'],
      allowNonZero: true,
      shouldRun: () => true,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const results = body.results || [];
        for (const issue of results.slice(0, 50)) {
          addFinding(report, {
            scanner: 'semgrep',
            category: 'static-analysis',
            severity: mapSeverity(issue.extra?.severity || 'medium'),
            title: issue.check_id || 'Semgrep finding',
            file: issue.path,
            detail: issue.extra?.message || 'Semgrep rule matched.',
            recommendation: issue.extra?.metadata?.remediation || 'Review the matched rule and remediate the code path.',
          });
        }
        addToolNote(report, { tool: 'semgrep', status: 'completed', detail: `Semgrep executed successfully and reported ${results.length} findings.` });
      },
    },
    {
      name: 'bandit',
      argsFactory: () => ['-r', '.', '-f', 'json', ...(excludedDirectories.length ? ['-x', excludedDirectories.join(',')] : [])],
      allowNonZero: true,
      shouldRun: () => pyFiles.length > 0,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const results = body.results || [];
        for (const issue of results.slice(0, 200)) {
          addFinding(report, {
            scanner: 'bandit',
            category: 'python-static-analysis',
            severity: mapSeverity(issue.issue_severity || 'medium'),
            title: issue.test_name || issue.test_id || 'Bandit finding',
            file: issue.filename || '',
            detail: issue.issue_text || 'Bandit rule matched.',
            recommendation: 'Review the affected Python code path and apply the recommended secure coding control.',
          });
        }
        addToolNote(report, { tool: 'bandit', status: 'completed', detail: `Bandit executed successfully and reported ${results.length} findings.` });
      },
    },
    {
      name: 'pip-audit',
      argsFactory: () => {
        const req = requirementsFiles[0];
        return req ? ['-r', req, '-f', 'json'] : [];
      },
      allowNonZero: true,
      shouldRun: () => requirementsFiles.length > 0,
      parse(result) {
        const body = safeJsonParse(result.stdout, []);
        const entries = Array.isArray(body) ? body : body.dependencies || [];
        let count = 0;
        for (const dep of entries) {
          for (const vuln of dep.vulns || []) {
            count += 1;
            addFinding(report, {
              scanner: 'pip-audit',
              category: 'dependency-vulnerability',
              severity: mapSeverity(vuln.severity || vuln.id || 'medium'),
              title: `${dep.name} ${dep.version || ''} has known vulnerability ${vuln.id}`,
              file: path.relative(sourceDir, requirementsFiles[0]).replace(/\\/g, '/'),
              detail: vuln.description || vuln.id || 'Known Python dependency vulnerability detected.',
              recommendation: (vuln.fix_versions && vuln.fix_versions.length)
                ? `Upgrade to ${vuln.fix_versions.join(', ')} or later.`
                : 'Upgrade to a fixed dependency version.',
            });
          }
        }
        addToolNote(report, { tool: 'pip-audit', status: 'completed', detail: `pip-audit executed successfully and reported ${count} findings.` });
      },
    },
    {
      name: 'osv-scanner',
      args: ['--recursive', '--format', 'json', '.'],
      allowNonZero: true,
      shouldRun: () => true,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const results = body.results || [];
        let count = 0;
        for (const entry of results) {
          for (const pkg of entry.packages || []) {
            for (const vuln of pkg.vulnerabilities || []) {
              count += 1;
              addFinding(report, {
                scanner: 'osv-scanner',
                category: 'dependency-vulnerability',
                severity: mapSeverity(vuln.severity?.[0]?.type || 'medium'),
                title: `${pkg.package?.name || 'Dependency'} has known vulnerability ${vuln.id}`,
                file: entry.source || pkg.package?.path || '',
                detail: vuln.summary || vuln.details || 'Known vulnerable dependency detected.',
                recommendation: 'Update the dependency or lockfile to a fixed version.',
              });
            }
          }
        }
        addToolNote(report, { tool: 'osv-scanner', status: 'completed', detail: `OSV-Scanner executed successfully and reported ${count} findings.` });
      },
    },
    {
      name: 'retire',
      args: ['--path', '.', '--outputformat', 'json'],
      allowNonZero: true,
      shouldRun: () => packageJsonRoots.size > 0,
      parse(result) {
        const body = safeJsonParse(result.stdout, []);
        const entries = Array.isArray(body) ? body : [];
        let count = 0;
        for (const entry of entries) {
          for (const component of entry.results || []) {
            for (const vuln of component.vulnerabilities || []) {
              count += 1;
              addFinding(report, {
                scanner: 'retire',
                category: 'dependency-vulnerability',
                severity: mapSeverity(vuln.severity || 'medium'),
                title: `${component.component || 'JavaScript dependency'} has known vulnerability`,
                file: entry.file || '',
                detail: vuln.identifiers?.summary || vuln.info?.[0] || 'Retire detected a vulnerable JavaScript package.',
                recommendation: 'Upgrade the affected JavaScript package and re-run the intake scan.',
              });
            }
          }
        }
        addToolNote(report, { tool: 'retire', status: 'completed', detail: `Retire.js executed successfully and reported ${count} findings.` });
      },
    },
    {
      name: 'npm',
      argsFactory: async () => {
        for (const root of packageJsonRoots) {
          if (await fileExists(path.join(root, 'package-lock.json'))) {
            return ['audit', '--json', '--omit=dev', '--package-lock-only'];
          }
        }
        return [];
      },
      cwdFactory: async () => {
        for (const root of packageJsonRoots) {
          if (await fileExists(path.join(root, 'package-lock.json'))) return root;
        }
        return sourceDir;
      },
      shouldRun: async () => {
        for (const root of packageJsonRoots) {
          if (await fileExists(path.join(root, 'package-lock.json'))) return true;
        }
        return false;
      },
      allowNonZero: true,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const vulnerabilities = body.vulnerabilities || {};
        let count = 0;
        for (const [name, item] of Object.entries(vulnerabilities)) {
          const viaList = Array.isArray(item.via) ? item.via : [];
          for (const via of viaList) {
            if (typeof via === 'string') continue;
            count += 1;
            addFinding(report, {
              scanner: 'npm-audit',
              category: 'dependency-vulnerability',
              severity: mapSeverity(via.severity || item.severity || 'medium'),
              title: `${name} has known vulnerability ${via.source || via.name || ''}`.trim(),
              file: 'package-lock.json',
              detail: via.title || via.url || 'npm audit detected a vulnerable package.',
              recommendation: (item.fixAvailable && item.fixAvailable.name)
                ? `Upgrade to the fix version recommended by npm audit for ${item.fixAvailable.name}.`
                : 'Upgrade the affected package or regenerate the lockfile against a fixed version.',
            });
          }
        }
        addToolNote(report, { tool: 'npm-audit', status: 'completed', detail: `npm audit executed successfully and reported ${count} findings.` });
      },
    },
    {
      name: 'bundle-audit',
      args: ['check', '--format', 'json'],
      allowNonZero: true,
      shouldRun: () => gemLockFiles.length > 0,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const vulnerabilities = body.vulnerabilities || body.advisories || [];
        let count = 0;
        for (const vuln of vulnerabilities) {
          count += 1;
          addFinding(report, {
            scanner: 'bundle-audit',
            category: 'dependency-vulnerability',
            severity: mapSeverity(vuln.criticality || vuln.severity || 'medium'),
            title: `${vuln.gem || vuln.name || 'Ruby dependency'} has known vulnerability ${vuln.id || ''}`.trim(),
            file: path.relative(sourceDir, gemLockFiles[0]).replace(/\\/g, '/'),
            detail: vuln.title || vuln.description || vuln.advisory || 'bundle-audit detected a vulnerable gem.',
            recommendation: vuln.solution || vuln.url || 'Upgrade the vulnerable gem to a fixed version.',
          });
        }
        addToolNote(report, { tool: 'bundle-audit', status: 'completed', detail: `bundle-audit executed successfully and reported ${count} findings.` });
      },
    },
    {
      name: 'checkov',
      args: ['-d', '.', '-o', 'json', ...buildRepeatedArgs('--skip-path', excludedDirectories)],
      allowNonZero: true,
      shouldRun: () => checkovEligibleFiles.length > 0,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const failedChecks = Array.isArray(body?.results?.failed_checks)
          ? body.results.failed_checks
          : [];
        for (const issue of failedChecks.slice(0, 500)) {
          const issueFile = issue.file_abs_path
            ? sanitizeRelative(issue.file_abs_path, sourceDir)
            : issue.file_path
              ? sanitizeRelative(path.join(sourceDir, issue.file_path), sourceDir)
              : (issue.resource || '');
          addFinding(report, {
            scanner: 'checkov',
            category: 'iac-misconfiguration',
            severity: mapSeverity(issue.severity || 'medium'),
            title: issue.check_name || issue.check_id || 'Infrastructure finding',
            file: issueFile,
            detail: issue.guideline || issue.check_result?.result_description || 'Checkov detected an infrastructure misconfiguration.',
            recommendation: issue.remediation || issue.guideline || 'Review the flagged infrastructure definition and apply the prescribed secure configuration.',
          });
        }
        addToolNote(report, { tool: 'checkov', status: 'completed', detail: `Checkov executed successfully and reported ${failedChecks.length} findings.` });
      },
    },
    {
      name: 'hadolint',
      argsFactory: () => ['-f', 'json', ...dockerfiles],
      allowNonZero: true,
      shouldRun: () => dockerfiles.length > 0,
      parse(result) {
        const body = safeJsonParse(result.stdout, []);
        const issues = Array.isArray(body) ? body : [];
        for (const issue of issues.slice(0, 300)) {
          addFinding(report, {
            scanner: 'hadolint',
            category: 'dockerfile-lint',
            severity: mapSeverity(issue.level || 'medium'),
            title: issue.code || 'Dockerfile issue',
            file: issue.file || dockerfiles[0] || '',
            detail: issue.message || 'Hadolint detected a Dockerfile issue.',
            recommendation: 'Review the Dockerfile instruction and align it to secure container build guidance.',
          });
        }
        addToolNote(report, { tool: 'hadolint', status: 'completed', detail: `Hadolint executed successfully and reported ${issues.length} findings.` });
      },
    },
    {
      name: 'shellcheck',
      argsFactory: () => ['-f', 'json1', ...shellFiles.slice(0, 200)],
      allowNonZero: true,
      shouldRun: () => shellFiles.length > 0,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const comments = body.comments || [];
        for (const issue of comments.slice(0, 500)) {
          addFinding(report, {
            scanner: 'shellcheck',
            category: 'shell-lint',
            severity: mapSeverity(issue.level || 'medium'),
            title: issue.code ? `SC${issue.code}` : 'Shellcheck issue',
            file: issue.file || '',
            detail: issue.message || 'Shellcheck detected a shell scripting issue.',
            recommendation: 'Review the shell script and apply the Shellcheck recommendation.',
          });
        }
        addToolNote(report, { tool: 'shellcheck', status: 'completed', detail: `Shellcheck executed successfully and reported ${comments.length} findings.` });
      },
    },
    {
      name: 'gosec',
      args: ['./...', '-fmt', 'json'],
      allowNonZero: true,
      shouldRun: () => goFiles.length > 0,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const issues = body.Issues || [];
        for (const issue of issues.slice(0, 500)) {
          addFinding(report, {
            scanner: 'gosec',
            category: 'go-static-analysis',
            severity: mapSeverity(issue.severity || 'medium'),
            title: issue.rule_id || issue.rule || 'Gosec finding',
            file: issue.file || '',
            detail: issue.details || 'Gosec detected a Go security issue.',
            recommendation: 'Review the affected Go code path and apply the secure coding remediation.',
          });
        }
        addToolNote(report, { tool: 'gosec', status: 'completed', detail: `Gosec executed successfully and reported ${issues.length} findings.` });
      },
    },
    {
      name: 'syft',
      args: ['dir:.', '-o', 'json'],
      shouldRun: () => true,
      parse(result) {
        const body = safeJsonParse(result.stdout, {});
        const artifacts = (body.artifacts || body.packages || []);
        addToolNote(report, { tool: 'syft', status: 'completed', detail: `Syft generated an SBOM inventory with ${artifacts.length} package entries.` });
      },
    },
  ];

  for (const tool of tools) {
    const shouldRun = typeof tool.shouldRun === 'function' ? await tool.shouldRun() : true;
    if (!shouldRun) {
      addToolNote(report, { tool: tool.name, status: 'skipped', detail: `${tool.name} was skipped because the matching ecosystem was not detected.` });
      continue;
    }

    const available = await commandExists(tool.name);
    if (!available) {
      addToolNote(report, { tool: tool.name, status: 'unavailable', detail: `${tool.name} is not installed in the runtime image.` });
      continue;
    }

    const args = tool.argsFactory ? await tool.argsFactory() : tool.args;
    if (!args || !args.length) {
      addToolNote(report, { tool: tool.name, status: 'skipped', detail: `${tool.name} did not have a compatible manifest or lockfile to scan.` });
      continue;
    }

    const cwd = tool.cwdFactory ? await tool.cwdFactory() : sourceDir;
    const result = await runCommand(tool.name, args, cwd);
    if (result.code !== 0 && !tool.allowNonZero) {
      addToolNote(report, { tool: tool.name, status: 'warning', detail: `${tool.name} exited with code ${result.code}: ${result.stderr || result.stdout}` });
      continue;
    }

    if (tool.allowNonZero && !result.stdout && !result.stderr) {
      addToolNote(report, { tool: tool.name === 'npm' ? 'npm-audit' : tool.name, status: 'warning', detail: `${tool.name} completed without parseable output.` });
      continue;
    }

    if (tool.name === 'npm' && !result.stdout) {
      addToolNote(report, { tool: 'npm-audit', status: 'warning', detail: `npm audit exited with code ${result.code}: ${result.stderr || 'No output returned.'}` });
      continue;
    }

    try {
      tool.parse(result);
    } catch (error) {
      addToolNote(report, { tool: tool.name, status: 'warning', detail: `${tool.name} output could not be parsed: ${error.message}` });
    }
  }
}

async function scanTextFiles(report, files) {
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(file.ext) && !file.name.includes('.env')) continue;
    const raw = await readText(file.absolutePath, 1024 * 250);
    if (!raw) continue;

    for (const pattern of SECRET_PATTERNS) {
      if (!pattern.regex.test(raw)) continue;
      addFinding(report, {
        scanner: pattern.scanner,
        category: 'secret-exposure',
        severity: pattern.severity,
        title: pattern.title,
        file: file.relativePath,
        detail: 'A high-risk string pattern was detected in the file contents.',
        recommendation: 'Move secrets to a vault or environment variable and rotate the exposed value.',
      });
    }

    if (/\b(eval|exec|Invoke-Expression|subprocess\.Popen|Start-Process)\b/.test(raw)) {
      addFinding(report, {
        scanner: 'heuristic-code-scan',
        category: 'risky-code-pattern',
        severity: 'medium',
        title: 'Potential command execution pattern detected',
        file: file.relativePath,
        detail: 'The file contains a dynamic execution primitive that often warrants manual review.',
        recommendation: 'Validate whether user-controlled input can reach this code path.',
      });
    }
  }
}

function scanStaleFiles(report, files) {
  for (const file of files) {
    for (const rule of STALE_FILE_PATTERNS) {
      if (!rule.match(file.relativePath)) continue;
      addFinding(report, {
        scanner: 'stale-file-scan',
        category: 'maintenance-risk',
        severity: rule.severity,
        title: rule.title,
        file: file.relativePath,
        detail: 'The repository contains artifacts that often indicate dead code, old builds, or accidental commits.',
        recommendation: 'Remove generated artifacts and verify whether the file should remain in source control.',
      });
    }
  }
}

function summarizeFindings(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) {
    if (counts[finding.severity] != null) counts[finding.severity] += 1;
  }
  return counts;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReportHtml(job) {
  const counts = job.report.counts || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const scanners = Array.from(new Set(job.report.findings.map(item => item.scanner).filter(Boolean))).sort();
  const totalFindings = Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const summary = job.summary || {};
  const ai = summary.ai || {};
  const excludedDirectories = summary.excludedDirectories || [];
  const exclusionPolicy = summary.exclusionPolicy || Array.from(SCAN_EXCLUDED_SEGMENTS).sort();
  const filteredFindings = Number(job.report.filteredFindings || 0);
  const findingsPayload = (job.report.findings || []).map((item, index) => ({
    index,
    severity: item.severity || 'info',
    scanner: item.scanner || 'scanner',
    title: item.title || 'Finding',
    file: item.file || '—',
    category: item.category || 'review',
    detail: item.detail || '',
    recommendation: item.recommendation || 'No recommendation supplied.',
  }));
  const reportPayload = JSON.stringify({
    findings: findingsPayload,
    scanners,
  }).replace(/</g, '\\u003c');

  const ecosystems = (summary.ecosystems || []).map(item => `
    <li><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.manifests.join(', '))}</span></li>
  `).join('');

  const dependencyRows = (summary.dependencies || []).slice(0, 150).map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.version || 'unversioned')}</td>
      <td>${escapeHtml(item.ecosystem)}</td>
      <td>${escapeHtml(item.source)}</td>
    </tr>
  `).join('');

  const toolRows = (job.report.toolNotes || []).map(item => `
    <tr>
      <td>${escapeHtml(item.tool)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.detail)}</td>
    </tr>
  `).join('');

  const aiFrameworks = (ai.frameworks || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const aiManifestRows = (ai.manifests || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const aiArtifactRows = (ai.modelArtifacts || []).map(item => `
    <tr>
      <td>${escapeHtml(item.file)}</td>
      <td>${escapeHtml(item.extension)}</td>
      <td>${item.safeFormat ? 'Safer interchange format' : 'Review required'}</td>
    </tr>
  `).join('');
  const aiSurfaceRows = (ai.pluginSurfaces || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const aiRuntimeRows = (ai.runtimeExposureHints || []).map(item => `
    <tr>
      <td>${escapeHtml(item.file)}</td>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.detail)}</td>
    </tr>
  `).join('');

  const binaries = job.report.binaries || [];
  const binaryRows = binaries.map(item => `
    <tr>
      <td><code style="font-size: 0.82rem; color: var(--muted);">${escapeHtml(item.file)}</code></td>
      <td>${escapeHtml(item.extension)}</td>
      <td>${(item.size / 1024 / 1024).toFixed(2)} MB</td>
      <td><code style="font-size: 0.75rem; word-break: break-all; color: var(--muted);">${escapeHtml((item.hash || 'N/A').substring(0, 16))}...</code></td>
    </tr>
  `).join('');

  const percentage = value => {
    if (!totalFindings) return 0;
    return ((Number(value) || 0) / totalFindings) * 100;
  };

  const donutStops = [
    { key: 'critical', color: 'var(--critical)', value: counts.critical },
    { key: 'high', color: 'var(--high)', value: counts.high },
    { key: 'medium', color: 'var(--medium)', value: counts.medium },
    { key: 'low', color: 'var(--low)', value: counts.low },
    { key: 'info', color: 'var(--info)', value: counts.info },
  ];
  let runningPercent = 0;
  const donutGradient = donutStops.map(segment => {
    const start = runningPercent;
    runningPercent += percentage(segment.value);
    return `${segment.color} ${start}% ${runningPercent}%`;
  }).join(', ');

  const severityLegend = donutStops.map(segment => `
    <div class="legend-row">
      <span class="legend-key"><span class="legend-dot legend-${segment.key}"></span>${escapeHtml(segment.key)}</span>
      <strong>${escapeHtml(segment.value)}</strong>
    </div>
  `).join('');

  const severityBar = donutStops.map(segment => `
    <div class="stack-segment stack-${segment.key}" style="width:${percentage(segment.value)}%"></div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gatekeeper Scan Report — ${escapeHtml(job.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --font-ui: 'Chakra Petch', Inter, ui-sans-serif, system-ui, sans-serif;
      --font-display: 'Chakra Petch', Inter, ui-sans-serif, system-ui, sans-serif;
      --font-mono: 'Share Tech Mono', 'JetBrains Mono', ui-monospace, monospace;
      --bg: #040914;
      --panel: rgba(9, 17, 30, 0.9);
      --panel-strong: rgba(10, 20, 36, 0.98);
      --line: rgba(125, 211, 252, 0.14);
      --line-strong: rgba(110, 231, 216, 0.28);
      --text: #edf6ff;
      --muted: #7f93b5;
      --accent: #6ee7d8;
      --accent-strong: #7dd3fc;
      --critical: #ef4444;
      --high: #f97316;
      --medium: #facc15;
      --low: #38bdf8;
      --info: #94a3b8;
      --shadow: 0 24px 80px rgba(2, 6, 23, 0.4);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font-ui);
      background:
        linear-gradient(rgba(110, 231, 216, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(110, 231, 216, 0.03) 1px, transparent 1px),
        radial-gradient(circle at top right, rgba(110, 231, 216, 0.16), transparent 20rem),
        radial-gradient(circle at top left, rgba(96, 165, 250, 0.12), transparent 17rem),
        radial-gradient(circle at bottom center, rgba(245, 158, 11, 0.06), transparent 24rem),
        linear-gradient(180deg, rgba(8, 14, 24, 0.985), rgba(4, 9, 20, 1)),
        var(--bg);
      background-size: 28px 28px, 28px 28px, auto, auto, auto, auto;
      color: var(--text);
      padding: 1.5rem;
      letter-spacing: 0.015em;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 12%, transparent 88%, rgba(255, 255, 255, 0.02)),
        repeating-linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.018) 0,
          rgba(255, 255, 255, 0.018) 1px,
          transparent 1px,
          transparent 4px
        );
      opacity: 0.35;
    }
    body::after {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 20% 12%, rgba(110, 231, 216, 0.08), transparent 18rem),
        radial-gradient(circle at 82% 20%, rgba(96, 165, 250, 0.08), transparent 16rem),
        radial-gradient(circle at 50% 100%, rgba(245, 158, 11, 0.05), transparent 20rem);
      mix-blend-mode: screen;
      opacity: 0.65;
    }
    h1, h2, h3, h4 { margin: 0; }
    .shell { max-width: 1280px; margin: 0 auto; display: grid; gap: 1.5rem; position: relative; z-index: 1; }
    .panel {
      border: 1px solid var(--line);
      border-radius: 1rem;
      background: var(--panel);
      backdrop-filter: blur(20px);
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
      padding: 1.5rem;
    }
    .panel::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      background:
        linear-gradient(135deg, rgba(125, 211, 252, 0.09), transparent 26%),
        linear-gradient(315deg, rgba(89, 225, 211, 0.07), transparent 22%);
    }
    .panel::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .hero {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 1.2rem;
      align-items: start;
      position: relative;
      z-index: 2;
    }
    .hero-title {
      display: grid;
      gap: 0.8rem;
    }
    .eyebrow {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.26em;
      font-size: 0.7rem;
      font-weight: 700;
      font-family: var(--font-mono);
    }
    .title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .title-row h1 {
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 0.92;
      font-family: var(--font-display);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-shadow: 0 0 24px rgba(89, 225, 211, 0.08);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem 0.9rem;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }
    .ghost-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 9rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0.7rem 0.95rem;
      color: var(--text);
      text-decoration: none;
      background: rgba(18, 33, 54, 0.72);
      font-weight: 600;
    }
    .risk-summary {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 1.2rem;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 1rem;
      background: var(--panel-strong);
      padding: 1.2rem;
      position: relative;
      z-index: 2;
    }
    .risk-donut {
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background: ${donutGradient || 'conic-gradient(rgba(148, 163, 184, 0.25) 0 100%)'};
      display: grid;
      place-items: center;
      position: relative;
      margin: 0 auto;
      border: 1px solid var(--line-strong);
    }
    .risk-donut::after {
      content: '';
      position: absolute;
      inset: 24px;
      border-radius: 50%;
      background: var(--panel-strong);
      border: 1px solid var(--line);
    }
    .donut-center {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      text-align: center;
      gap: 0.2rem;
    }
    .donut-center strong {
      font-size: 1.6rem;
      line-height: 1;
      font-family: var(--font-display);
    }
    .donut-center span {
      font-size: 0.7rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
      font-family: var(--font-mono);
    }
    .risk-summary-body {
      display: grid;
      gap: 0.9rem;
    }
    .stack-bar {
      display: flex;
      overflow: hidden;
      height: 0.85rem;
      border-radius: 999px;
      background: rgba(12, 24, 40, 0.75);
      border: 1px solid var(--line);
    }
    .stack-segment { min-width: 0; }
    .stack-critical { background: var(--critical); }
    .stack-high { background: var(--high); }
    .stack-medium { background: var(--medium); }
    .stack-low { background: var(--low); }
    .stack-info { background: var(--info); }
    .legend-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.6rem 1.2rem;
    }
    .legend-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .legend-row strong {
      color: var(--text);
      font-family: var(--font-display);
    }
    .legend-key {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.75rem;
      font-family: var(--font-mono);
    }
    .legend-dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 999px;
      display: inline-block;
    }
    .legend-critical { background: var(--critical); }
    .legend-high { background: var(--high); }
    .legend-medium { background: var(--medium); }
    .legend-low { background: var(--low); }
    .legend-info { background: var(--info); }
    .quick-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.7rem;
    }
    .stat-tile {
      border: 1px solid var(--line);
      border-radius: 0.95rem;
      padding: 0.85rem 0.95rem;
      background: var(--panel-strong);
    }
    .stat-tile span {
      display: block;
      color: var(--muted);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      margin-bottom: 0.35rem;
      font-family: var(--font-mono);
    }
    .stat-tile strong {
      font-size: 1.35rem;
      font-family: var(--font-display);
    }
    .section {
      overflow: hidden;
      position: relative;
      z-index: 2;
    }
    .section summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem;
      transition: background 120ms ease;
    }
    .section summary:hover {
      background: rgba(89, 225, 211, 0.04);
    }
    .section summary::-webkit-details-marker { display: none; }
    .section-title {
      display: flex;
      align-items: baseline;
      gap: 0.8rem;
      flex-wrap: wrap;
    }
    .section-title h2 {
      font-size: 1.1rem;
      font-family: var(--font-display);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .section-badge {
      color: var(--muted);
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-family: var(--font-mono);
    }
    .chevron {
      color: var(--muted);
      transition: transform 180ms ease;
      font-size: 1.2rem;
    }
    details[open] .chevron {
      transform: rotate(90deg);
    }
    .section-body {
      margin-top: 0.9rem;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.7rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.14em; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 0.25rem 0.6rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; font-family: var(--font-mono); }
    .badge-critical { background: rgba(239, 68, 68, 0.18); color: #fecaca; border: 1px solid rgba(239, 68, 68, 0.26); }
    .badge-high { background: rgba(249, 115, 22, 0.18); color: #fed7aa; border: 1px solid rgba(249, 115, 22, 0.26); }
    .badge-medium { background: rgba(250, 204, 21, 0.18); color: #fef08a; border: 1px solid rgba(250, 204, 21, 0.26); }
    .badge-low { background: rgba(56, 189, 248, 0.18); color: #bae6fd; border: 1px solid rgba(56, 189, 248, 0.26); }
    .badge-info { background: rgba(148, 163, 184, 0.18); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.26); }
    .scanner-badge {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      color: var(--accent);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      background: rgba(89, 225, 211, 0.08);
      font-family: var(--font-mono);
    }
    ul { margin: 0; padding-left: 1.1rem; }
    li + li { margin-top: 0.45rem; }
    li span { color: var(--muted); display: block; margin-top: 0.2rem; }
    .toolbar {
      display: grid;
      grid-template-columns: 1.6fr repeat(4, minmax(0, 0.75fr));
      gap: 0.65rem;
      margin: 0.95rem 0;
    }
    .toolbar input,
    .toolbar select {
      width: 100%;
      border: 1px solid rgba(129, 148, 178, 0.2);
      border-radius: 0.9rem;
      background: rgba(5, 12, 22, 0.92);
      color: var(--text);
      padding: 0.85rem 0.95rem;
      font: inherit;
      font-family: var(--font-ui);
    }
    .toolbar input:focus,
    .toolbar select:focus {
      outline: none;
      border-color: rgba(89, 225, 211, 0.45);
      box-shadow: 0 0 0 3px rgba(89, 225, 211, 0.08);
    }
    .toolbar-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      color: var(--muted);
      font-size: 0.86rem;
    }
    .findings-grid {
      display: grid;
      gap: 0.65rem;
    }
    .findings-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      color: var(--muted);
      font-size: 0.86rem;
    }
    .finding-row {
      border: 1px solid var(--line);
      border-radius: 0.95rem;
      background: var(--panel-strong);
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .finding-row:hover {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(89, 225, 211, 0.12);
    }
    .finding-row summary {
      list-style: none;
      cursor: pointer;
      display: grid;
      grid-template-columns: auto auto 1.1fr minmax(180px, 0.8fr) auto;
      gap: 0.8rem;
      align-items: center;
      padding: 0.9rem 1rem;
    }
    .finding-row summary::-webkit-details-marker { display: none; }
    .finding-title {
      font-size: 0.95rem;
      font-weight: 700;
      font-family: var(--font-display);
    }
    .finding-file {
      color: var(--muted);
      font-size: 0.82rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .finding-category {
      color: var(--muted);
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .finding-body {
      padding: 0 0.9rem 0.9rem;
      border-top: 1px solid var(--line);
      display: grid;
      gap: 0.8rem;
    }
    .finding-body-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }
    .finding-block {
      border: 1px solid var(--line);
      border-radius: 0.85rem;
      background: rgba(10, 18, 31, 0.55);
      padding: 0.8rem;
    }
    .finding-block strong {
      display: block;
      margin-bottom: 0.4rem;
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .finding-block p {
      margin: 0;
      line-height: 1.55;
      font-size: 0.92rem;
    }
    .finding-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      flex-wrap: wrap;
    }
    .finding-card h3 {
      margin: 0;
      font-size: 1rem;
    }
    .page-controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .pager-button {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(18, 33, 54, 0.7);
      color: var(--text);
      padding: 0.55rem 0.85rem;
      cursor: pointer;
      font: inherit;
    }
    .pager-button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .empty-state {
      border: 1px dashed var(--line);
      border-radius: 0.95rem;
      background: rgba(20, 34, 56, 0.45);
      padding: 1rem;
      color: var(--muted);
      text-align: center;
    }
    .hint-text {
      color: var(--muted);
      font-size: 0.82rem;
    }
    .table-shell {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 0.95rem;
    }
    @media (max-width: 980px) {
      body { padding: 1rem; }
      .hero { grid-template-columns: 1fr; }
      .risk-summary { grid-template-columns: 1fr; }
      .quick-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .legend-grid { grid-template-columns: 1fr; }
      .toolbar { grid-template-columns: 1fr; }
      .finding-row summary { grid-template-columns: 1fr; }
      .finding-body-grid { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: #fff; color: #111827; padding: 0; }
      .panel { box-shadow: none; border-color: #d1d5db; background: #fff; }
      .badge { border: 1px solid #d1d5db; color: #111827 !important; background: transparent !important; }
      .toolbar { display: none; }
      .page-controls { display: none; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="panel hero">
      <div class="hero-title">
        <div class="eyebrow">Gatekeeper DevSecOps Report</div>
        <div class="title-row">
          <h1>${escapeHtml(job.name)}</h1>
          <div class="hero-actions">
            <a class="ghost-link" href="#" onclick="window.print(); return false;">Print report</a>
          </div>
        </div>
        <div class="meta">
          <span><strong>Job ID:</strong> ${escapeHtml(job.id)}</span>
          <span><strong>Completed:</strong> ${escapeHtml(job.updatedAt)}</span>
          <span><strong>Files scanned:</strong> ${escapeHtml(summary.fileCount || 0)}</span>
          <span><strong>Dependencies:</strong> ${escapeHtml((summary.dependencies || []).length)}</span>
          <span><strong>Excluded dirs:</strong> ${escapeHtml(excludedDirectories.length)}</span>
        </div>
        <div class="quick-stats">
          <div class="stat-tile"><span>Ecosystems</span><strong>${escapeHtml((summary.ecosystems || []).length)}</strong></div>
          <div class="stat-tile"><span>Scanners</span><strong>${escapeHtml(scanners.length)}</strong></div>
          <div class="stat-tile"><span>AI Signals</span><strong>${escapeHtml(ai.detected ? 'Detected' : 'None')}</strong></div>
          <div class="stat-tile"><span>Total Findings</span><strong>${escapeHtml(totalFindings)}</strong></div>
        </div>
        <div class="hint-text">Default exclusions applied: ${escapeHtml(exclusionPolicy.join(', ') || 'none')} ${filteredFindings ? `• ${escapeHtml(filteredFindings)} findings suppressed from excluded paths` : ''}</div>
      </div>
      <div class="risk-summary">
        <div class="risk-donut">
          <div class="donut-center">
            <strong>${escapeHtml(totalFindings)}</strong>
            <span>findings</span>
          </div>
        </div>
        <div class="risk-summary-body">
          <div>
            <div class="eyebrow">Risk Summary</div>
            <div class="stack-bar">${severityBar || '<div class="stack-segment stack-info" style="width:100%"></div>'}</div>
          </div>
          <div class="legend-grid">${severityLegend}</div>
        </div>
      </div>
    </section>

    <details class="panel section">
      <summary>
        <div class="section-title">
          <h2>Findings Console</h2>
          <span class="section-badge">${escapeHtml(totalFindings)} total findings</span>
        </div>
        <span class="chevron">▶</span>
      </summary>
      <div class="section-body">
        <div class="toolbar">
          <input id="findingSearch" type="search" placeholder="Search findings, files, categories..." />
          <select id="severityFilter">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>
          <select id="scannerFilter">
            <option value="all">All scanners</option>
            ${scanners.map(scanner => `<option value="${escapeHtml(scanner)}">${escapeHtml(scanner)}</option>`).join('')}
          </select>
          <select id="sortFindings">
            <option value="severity-desc">Severity</option>
            <option value="severity-asc">Severity asc</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
            <option value="scanner-asc">Scanner</option>
          </select>
          <select id="pageSize">
            <option value="10">10 / page</option>
            <option value="25" selected>25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>
        <div class="toolbar-bar">
          <span id="findingsCount">0 findings visible</span>
          <span class="hint-text">Compact mode: findings stay collapsed until you open one.</span>
        </div>
        <div id="findingsGrid" class="findings-grid"></div>
        <div class="page-controls">
          <button id="prevPage" class="pager-button" type="button">Previous</button>
          <span id="pageMeta" class="hint-text">Page 1 of 1</span>
          <button id="nextPage" class="pager-button" type="button">Next</button>
        </div>
      </div>
    </details>

    <details class="panel section">
      <summary>
        <div class="section-title">
          <h2>Detected Ecosystems</h2>
          <span class="section-badge">${escapeHtml((summary.ecosystems || []).length)} discovered</span>
        </div>
        <span class="chevron">▶</span>
      </summary>
      <div class="section-body">
        <ul>${ecosystems || '<li>No build ecosystem manifests were detected.</li>'}</ul>
      </div>
    </details>

    <details class="panel section">
      <summary>
        <div class="section-title">
          <h2>Binary Artifacts & Supply Chain</h2>
          <span class="section-badge">${escapeHtml(binaries.length)} artifacts</span>
        </div>
        <span class="chevron">▶</span>
      </summary>
      <div class="section-body">
        ${binaries.length > 0 ? `
          <div class="hint-text" style="margin-bottom:0.85rem">
            Compiled binaries detected. Verify signatures, hashes, and build reproducibility. Use <code>sha256sum</code> or similar tools to validate artifacts.
          </div>
          <div class="table-shell">
            <table>
              <thead><tr><th>File</th><th>Type</th><th>Size</th><th>SHA256 (Truncated)</th></tr></thead>
              <tbody>${binaryRows || '<tr><td colspan="4">No binaries recorded.</td></tr>'}</tbody>
            </table>
          </div>
        ` : '<div class="empty-state">No compiled binary artifacts detected in this submission.</div>'}
      </div>
    </details>

    <details class="panel section">
      <summary>
        <div class="section-title">
          <h2>AI / LLM Intake Summary</h2>
          <span class="section-badge">${escapeHtml(ai.detected ? 'signals detected' : 'no ai signals')}</span>
        </div>
        <span class="chevron">▶</span>
      </summary>
      <div class="section-body">
        ${ai.detected ? `
          <div class="quick-stats" style="margin-bottom:0.85rem">
            <div class="stat-tile"><span>Framework hints</span><strong>${escapeHtml(ai.frameworks?.length || 0)}</strong></div>
            <div class="stat-tile"><span>Model artifacts</span><strong>${escapeHtml(ai.modelArtifacts?.length || 0)}</strong></div>
            <div class="stat-tile"><span>Plugin surfaces</span><strong>${escapeHtml(ai.pluginSurfaces?.length || 0)}</strong></div>
            <div class="stat-tile"><span>Runtime hints</span><strong>${escapeHtml(ai.runtimeExposureHints?.length || 0)}</strong></div>
          </div>
          <details class="section" open>
            <summary><div class="section-title"><h3>Framework / SDK Hints</h3></div><span class="chevron">▶</span></summary>
            <div class="section-body"><ul>${aiFrameworks || '<li>No framework hints recorded.</li>'}</ul></div>
          </details>
          <details class="section">
            <summary><div class="section-title"><h3>Model Manifests</h3></div><span class="chevron">▶</span></summary>
            <div class="section-body"><ul>${aiManifestRows || '<li>No model manifests recorded.</li>'}</ul></div>
          </details>
          <details class="section">
            <summary><div class="section-title"><h3>Model Artifacts</h3></div><span class="chevron">▶</span></summary>
            <div class="section-body"><div class="table-shell"><table><thead><tr><th>File</th><th>Type</th><th>Handling</th></tr></thead><tbody>${aiArtifactRows || '<tr><td colspan="3">No model artifacts recorded.</td></tr>'}</tbody></table></div></div>
          </details>
          <details class="section">
            <summary><div class="section-title"><h3>Prompt / Plugin Surfaces</h3></div><span class="chevron">▶</span></summary>
            <div class="section-body"><ul>${aiSurfaceRows || '<li>No prompt or plugin surfaces recorded.</li>'}</ul></div>
          </details>
          <details class="section">
            <summary><div class="section-title"><h3>Runtime Exposure Hints</h3></div><span class="chevron">▶</span></summary>
            <div class="section-body"><div class="table-shell"><table><thead><tr><th>File</th><th>Signal</th><th>Detail</th></tr></thead><tbody>${aiRuntimeRows || '<tr><td colspan="3">No runtime exposure hints recorded.</td></tr>'}</tbody></table></div></div>
          </details>
        ` : '<div class="empty-state">No obvious AI/LLM model artifacts, manifests, or framework dependencies were detected.</div>'}
      </div>
    </details>

    <details class="panel section">
      <summary>
        <div class="section-title">
          <h2>Tool Execution Notes</h2>
          <span class="section-badge">${escapeHtml((job.report.toolNotes || []).length)} notes</span>
        </div>
        <span class="chevron">▶</span>
      </summary>
      <div class="section-body">
        <div class="table-shell">
          <table>
            <thead><tr><th>Tool</th><th>Status</th><th>Detail</th></tr></thead>
            <tbody>${toolRows || '<tr><td colspan="3">No tool notes recorded.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </details>

    <details class="panel section">
      <summary>
        <div class="section-title">
          <h2>Dependency Inventory</h2>
          <span class="section-badge">${escapeHtml((summary.dependencies || []).length)} discovered</span>
        </div>
        <span class="chevron">▶</span>
      </summary>
      <div class="section-body">
        <div class="hint-text" style="margin-bottom:0.75rem">Showing the first ${escapeHtml(Math.min((summary.dependencies || []).length, 150))} dependencies in the HTML report. Use the JSON export for the full inventory.</div>
        <div class="table-shell">
          <table>
            <thead><tr><th>Name</th><th>Version</th><th>Ecosystem</th><th>Source</th></tr></thead>
            <tbody>${dependencyRows || '<tr><td colspan="4">No parseable dependency manifests were found.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </details>
  </div>
  <script>
    (function () {
      const reportData = ${reportPayload};
      const grid = document.getElementById('findingsGrid');
      const searchInput = document.getElementById('findingSearch');
      const severityFilter = document.getElementById('severityFilter');
      const scannerFilter = document.getElementById('scannerFilter');
      const sortSelect = document.getElementById('sortFindings');
      const pageSizeSelect = document.getElementById('pageSize');
      const findingsCount = document.getElementById('findingsCount');
      const pageMeta = document.getElementById('pageMeta');
      const prevPage = document.getElementById('prevPage');
      const nextPage = document.getElementById('nextPage');
      const severityRank = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
      const state = { page: 1 };

      function esc(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function matches(finding) {
        const search = (searchInput.value || '').trim().toLowerCase();
        const severity = severityFilter.value;
        const scanner = scannerFilter.value;
        const haystack = [
          finding.title || '',
          finding.file || '',
          finding.category || '',
          finding.detail || '',
          finding.recommendation || '',
        ].join(' ').toLowerCase();

        if (severity !== 'all' && finding.severity !== severity) return false;
        if (scanner !== 'all' && finding.scanner !== scanner) return false;
        if (search && !haystack.includes(search)) return false;
        return true;
      }

      function sortFindings(findings) {
        const mode = sortSelect.value;
        findings.sort((a, b) => {
          if (mode === 'severity-desc') {
            return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
          }
          if (mode === 'severity-asc') {
            return (severityRank[a.severity] || 0) - (severityRank[b.severity] || 0);
          }
          if (mode === 'title-desc') {
            return (b.title || '').localeCompare(a.title || '');
          }
          if (mode === 'scanner-asc') {
            return (a.scanner || '').localeCompare(b.scanner || '') || (a.title || '').localeCompare(b.title || '');
          }
          return (a.title || '').localeCompare(b.title || '');
        });
      }

      function renderFinding(finding) {
        return [
          '<details class="finding-row">',
          '  <summary>',
          '    <span class="badge badge-' + esc(finding.severity) + '">' + esc(finding.severity) + '</span>',
          '    <span class="scanner-badge">' + esc(finding.scanner) + '</span>',
          '    <span class="finding-title">' + esc(finding.title) + '</span>',
          '    <span class="finding-file">' + esc(finding.file) + '</span>',
          '    <span class="finding-category">' + esc(finding.category) + '</span>',
          '  </summary>',
          '  <div class="finding-body">',
          '    <div class="finding-body-grid">',
          '      <div class="finding-block">',
          '        <strong>Detail</strong>',
          '        <p>' + esc(finding.detail) + '</p>',
          '      </div>',
          '      <div class="finding-block">',
          '        <strong>Recommendation</strong>',
          '        <p>' + esc(finding.recommendation) + '</p>',
          '      </div>',
          '    </div>',
          '  </div>',
          '</details>',
        ].join('');
      }

      function render() {
        const filtered = reportData.findings.filter(matches);
        sortFindings(filtered);

        const pageSize = Number(pageSizeSelect.value || 25);
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (state.page > totalPages) state.page = totalPages;
        if (state.page < 1) state.page = 1;

        const start = (state.page - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = filtered.slice(start, end);

        if (!pageItems.length) {
          grid.innerHTML = '<div class="empty-state">No findings match the current filters.</div>';
        } else {
          grid.innerHTML = pageItems.map(renderFinding).join('');
        }

        findingsCount.textContent = filtered.length + ' finding' + (filtered.length === 1 ? '' : 's') + ' visible';
        pageMeta.textContent = 'Page ' + state.page + ' of ' + totalPages;
        prevPage.disabled = state.page <= 1;
        nextPage.disabled = state.page >= totalPages;
      }

      [searchInput, severityFilter, scannerFilter, sortSelect, pageSizeSelect].forEach(control => {
        control.addEventListener('input', function () {
          state.page = 1;
          render();
        });
        control.addEventListener('change', function () {
          state.page = 1;
          render();
        });
      });

      prevPage.addEventListener('click', function () {
        state.page -= 1;
        render();
      });

      nextPage.addEventListener('click', function () {
        state.page += 1;
        render();
      });

      render();
    }());
  </script>
</body>
</html>`;
}

async function processJob(jobId, sourceDir, jobDir) {
  const job = appState.jobs.get(jobId);
  if (!job) return;

  const report = {
    findings: [],
    toolNotes: [],
    counts: null,
  };

  try {
    updateJob(job, { status: 'running', error: null });
    updateStep(job, 'verify', { status: 'running', message: 'Checking uploaded contents.' });

    report.sourceDir = sourceDir;
    const { files, excludedDirectories } = await walkFiles(sourceDir);
    if (!files.length) {
      throw new Error('No files were found in the uploaded submission.');
    }

    updateStep(job, 'verify', { status: 'completed', message: `Verified ${files.length} files${excludedDirectories.length ? ` (excluded ${excludedDirectories.length} generated directories)` : ''}.` });
    updateStep(job, 'detect', { status: 'running', message: 'Looking for language and build manifests.' });

    const { ecosystems, rootFiles } = await detectEcosystems(files, sourceDir);
    updateStep(job, 'detect', { status: 'completed', message: ecosystems.length ? `Detected ${ecosystems.length} ecosystems.` : 'No known build ecosystem detected.' });

    updateStep(job, 'inventory', { status: 'running', message: 'Parsing dependency manifests.' });
    const dependencies = await extractDependencies(sourceDir, files);
    updateStep(job, 'inventory', { status: 'completed', message: `Parsed ${dependencies.length} dependencies from manifests.` });

    const ai = await analyzeAiIntake(sourceDir, files, dependencies, report);

    updateStep(job, 'secrets', { status: 'running', message: 'Scanning text files for exposed secrets.' });
    await scanTextFiles(report, files);
    updateStep(job, 'secrets', { status: 'completed', message: 'Secret and risky-pattern scan complete.' });

    updateStep(job, 'vulns', { status: 'running', message: 'Scanning dependency inventory for known vulnerabilities.' });
    await scanDependenciesWithOsv(report, dependencies);
    report.summaryContext = { ecosystems, files, excludedDirectories };
    await runOptionalTools(report, sourceDir);
    delete report.summaryContext;
    updateStep(job, 'vulns', { status: 'completed', message: 'Dependency vulnerability scan complete.' });

    updateStep(job, 'quality', { status: 'running', message: 'Looking for stale files and dead-code indicators.' });
    scanStaleFiles(report, files);
    updateStep(job, 'quality', { status: 'completed', message: 'Code hygiene scan complete.' });

    updateStep(job, 'binaries', { status: 'running', message: 'Analyzing binary artifacts for supply chain verification.' });
    await analyzeBinaries(sourceDir, files, report);
    updateStep(job, 'binaries', { status: 'completed', message: 'Binary artifact analysis complete.' });

    updateStep(job, 'report', { status: 'running', message: 'Rendering HTML and JSON report artifacts.' });
    const summary = {
      fileCount: files.length,
      excludedDirectories,
      exclusionPolicy: Array.from(SCAN_EXCLUDED_SEGMENTS).sort(),
      ecosystems,
      rootFiles,
      dependencies,
      ai,
      directoryCount: new Set(files.map(file => path.dirname(file.relativePath))).size,
    };
    delete report.sourceDir;
    report.counts = summarizeFindings(report.findings);

    const reportJson = {
      metadata: {
        jobId: job.id,
        submissionName: job.name,
        generatedAt: nowIso(),
      },
      summary,
      report,
    };

    const jsonPath = path.join(jobDir, 'report.json');
    const htmlPath = path.join(jobDir, 'report.html');
    await fsp.writeFile(jsonPath, JSON.stringify(reportJson, null, 2), 'utf8');
    await fsp.writeFile(htmlPath, buildReportHtml({ ...job, summary, report }), 'utf8');

    updateStep(job, 'report', { status: 'completed', message: 'Reports generated successfully.' });
    updateJob(job, {
      status: 'completed',
      progress: 100,
      summary,
      report,
      downloads: {
        json: `/api/jobs/${job.id}/download/json`,
        html: `/api/jobs/${job.id}/download/html`,
      },
    });
  } catch (error) {
    const activeStep = [...job.steps].reverse().find(item => item.status === 'running');
    if (activeStep) {
      updateStep(job, activeStep.key, { status: 'failed', message: error.message });
    }
    updateJob(job, { status: 'failed', error: error.message });
  }
}

async function bootstrap() {
  await ensureDir(RUNTIME_DIR);
  await ensureDir(TEMP_DIR);
  await ensureDir(JOBS_DIR);
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(ROOT, 'public')));

app.get('/api/health', (_req, res) => {
  json(res, 200, { ok: true, service: 'gatekeeper', time: nowIso() });
});

app.get('/api/config', (_req, res) => {
  json(res, 200, {
    ok: true,
    upload: {
      maxFileSizeBytes: MAX_FILE_SIZE,
      maxFileSizeMb: MAX_FILE_SIZE_MB,
      warnDirectFileCount: WARN_DIRECT_FILE_COUNT,
      maxDirectFileCount: MAX_DIRECT_FILE_COUNT,
      recommendedMode: 'archive',
    },
  });
});

app.get('/api/jobs', (_req, res) => {
  const jobs = Array.from(appState.jobs.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25);
  json(res, 200, { jobs });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = appState.jobs.get(req.params.id);
  if (!job) return json(res, 404, { error: 'Job not found' });
  json(res, 200, job);
});

app.get('/api/jobs/:id/download/:format', async (req, res) => {
  const job = appState.jobs.get(req.params.id);
  if (!job) return json(res, 404, { error: 'Job not found' });
  if (job.status !== 'completed') return json(res, 409, { error: 'Reports are not ready yet' });

  const format = req.params.format;
  const filename = format === 'json' ? 'report.json' : format === 'html' ? 'report.html' : null;
  if (!filename) return json(res, 400, { error: 'Unsupported download format' });

  const target = path.join(JOBS_DIR, job.id, filename);
  res.download(target, `${safeSlug(job.name)}-${filename}`);
});

app.post('/api/jobs/upload', upload.any(), async (req, res) => {
  let files = req.files || [];
  try {
    const mode = req.body.mode === 'archive' ? 'archive' : 'folder';
    const submissionName = safeSlug(req.body.submissionName || (mode === 'archive' ? files[0]?.originalname : req.body.folderName || 'submission'));
    if (!files.length) {
      return json(res, 400, { error: 'Upload at least one file or archive.' });
    }

    const job = createJobRecord(submissionName);
    const jobDir = path.join(JOBS_DIR, job.id);
    const sourceDir = path.join(jobDir, 'source');
    await ensureDir(sourceDir);

    if (mode === 'archive') {
      await extractArchive(files[0].path, files[0].originalname, sourceDir);
    } else {
      const relativePaths = normalizeArray(req.body.relativePaths);
      await writeUploadedFolder(files, relativePaths, sourceDir);
    }

    await removeTempFiles(files);
    json(res, 202, { ok: true, jobId: job.id });
    queueMicrotask(() => processJob(job.id, sourceDir, jobDir));
  } catch (error) {
    await removeTempFiles(files);
    json(res, 400, { error: error.message });
  }
});

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_COUNT') {
      json(res, 400, {
        error: 'Too many files for direct browser folder upload. Compress the project as a .zip or .tar.gz and use Archive mode instead.',
        code: error.code,
      });
      return;
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      json(res, 400, {
        error: `One of the uploaded files exceeded the per-file size limit of ${formatBytes(MAX_FILE_SIZE)}.`,
        code: error.code,
        maxFileSizeBytes: MAX_FILE_SIZE,
      });
      return;
    }

    json(res, 400, {
      error: error.message || 'Upload validation failed.',
      code: error.code,
    });
    return;
  }

  console.error('[GATEKEEPER] Request failed:', error);
  json(res, 500, { error: error.message || 'Internal server error.' });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return json(res, 404, { error: 'Not found' });
  }
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

bootstrap()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Gatekeeper running at http://localhost:${PORT}`);
    });
  })
  .catch(error => {
    console.error('[GATEKEEPER] Startup failed:', error);
    process.exit(1);
  });
