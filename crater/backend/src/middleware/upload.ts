import path from 'path'
import fs from 'fs'
import multer, { MulterError } from 'multer'
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB per diagram
const MAX_ARTIFACT_FILE_SIZE = 50 * 1024 * 1024 // 50 MB per artifact
const MAX_STIG_FILE_SIZE = 25 * 1024 * 1024 // 25 MB per STIG / checklist import
const MAX_FILES = 10

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
])

// ─── Storage ─────────────────────────────────────────────────────────────────

const diagramStorage = multer.diskStorage({
  destination(req: Request, _file, cb) {
    const dir = path.resolve(UPLOAD_DIR, 'projects', req.params.id, 'diagrams')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(_req, file, cb) {
    // Sanitize: keep only safe characters, cap at 50 chars, prepend timestamp
    const ext = path.extname(file.originalname).toLowerCase()
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50)
    cb(null, `${Date.now()}-${base}${ext}`)
  },
})

const artifactStorage = multer.diskStorage({
  destination(req: Request, _file, cb) {
    const dir = path.resolve(UPLOAD_DIR, 'projects', req.params.id, 'artifacts')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase()
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80)
    cb(null, `${Date.now()}-${base}${ext}`)
  },
})

// ─── File filter ─────────────────────────────────────────────────────────────

function diagramFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      new AppError(
        `File type '${file.mimetype}' is not allowed. Accepted: images (JPEG, PNG, GIF, WebP, SVG) and PDF.`,
        400,
      ),
    )
  }
}

// ─── Multer instance ─────────────────────────────────────────────────────────

export const diagramUpload = multer({
  storage: diagramStorage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: diagramFileFilter,
})

export const artifactUpload = multer({
  storage: artifactStorage,
  limits: { fileSize: MAX_ARTIFACT_FILE_SIZE, files: MAX_FILES },
})

export const stigChecklistUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_STIG_FILE_SIZE, files: 1 },
})

// ─── Error handler ───────────────────────────────────────────────────────────
// Place this immediately after diagramUpload in the route chain to convert
// Multer-specific errors into AppErrors before they reach the global handler.

export function handleUploadError(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (err instanceof MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: `File too large. Maximum size is ${MAX_ARTIFACT_FILE_SIZE / 1024 / 1024} MB per file.`,
      LIMIT_FILE_COUNT: `Too many files. Maximum is ${MAX_FILES} files per upload.`,
      LIMIT_UNEXPECTED_FILE: 'Unexpected field name. Use "files" as the field name for uploads.',
    }
    next(new AppError(messages[err.code] ?? err.message, 400))
    return
  }
  next(err)
}
