#!/usr/bin/env python3
"""Download, extract, and chunk RMF policy documents for Crater RAG.

The generated files are intentionally compatible with
backend/src/services/document-chunk.service.ts:

  backend/prisma/seed/knowledge-chunks/<docId>.json

For interchange/debugging, the script also writes a flat JSON array:

  backend/prisma/seed/source-documents/rmf-policy-chunks.array.json
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.request import Request, urlopen

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - operator guidance
    print("Missing dependency: pypdf. Install with: python3 -m pip install --user pypdf", file=sys.stderr)
    raise


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "backend/prisma/seed/source-documents"
CHUNK_DIR = ROOT / "backend/prisma/seed/knowledge-chunks"
TARGET_CHARS = 3600
OVERLAP_CHARS = 700
MIN_CHARS = 240


@dataclass(frozen=True)
class SourceDocument:
    doc_id: str
    doc_title: str
    doc_type: str
    file_name: str
    source_url: str
    default_applicability: tuple[str, ...]


DOCUMENTS: tuple[SourceDocument, ...] = (
    SourceDocument(
        doc_id="dod-8500-01",
        doc_title="DoDI 8500.01 Cybersecurity",
        doc_type="DOD_POLICY",
        file_name="dod-8500-01.pdf",
        source_url="https://nsarchive.gwu.edu/sites/default/files/documents/2692131/Document-23.pdf",
        default_applicability=("DOD",),
    ),
    SourceDocument(
        doc_id="dod-8510-01",
        doc_title="DoDI 8510.01 Risk Management Framework for DoD Systems",
        doc_type="DOD_POLICY",
        file_name="dod-8510-01.pdf",
        source_url="https://rmf.org/wp-content/uploads/2022/07/851001p-1.pdf",
        default_applicability=("DOD", "RMF"),
    ),
    SourceDocument(
        doc_id="jsig-2016",
        doc_title="Joint Special Access Program (SAP) Implementation Guide (JSIG), 11 April 2016",
        doc_type="JSIG",
        file_name="jsig-2016.pdf",
        source_url="https://www.dcsa.mil/Portals/69/documents/io/rmf/JSIG_2016April11_Final_%2853Rev4%29.pdf",
        default_applicability=("DOD", "SAP", "JSIG", "HIGH"),
    ),
    SourceDocument(
        doc_id="dcsa-daapm-v2-2",
        doc_title="DCSA Assessment and Authorization Process Manual Version 2.2",
        doc_type="DAAG",
        file_name="dcsa-daapm-v2.2.pdf",
        source_url="https://www.dcsa.mil/Portals/128/Documents/IS/DCSA%20Assessment%20and%20Authorization%20Process%20Manual%20Version%202.2.pdf",
        default_applicability=("DCSA", "NISP", "DOD"),
    ),
)


STOPWORDS = {
    "about", "above", "after", "again", "against", "also", "and", "any", "are", "because",
    "been", "before", "being", "both", "can", "could", "did", "does", "during", "each",
    "from", "had", "has", "have", "into", "its", "may", "more", "must", "not", "other",
    "our", "shall", "should", "such", "system", "systems", "than", "that", "the", "their",
    "then", "there", "these", "this", "those", "through", "under", "upon", "was", "when",
    "where", "which", "will", "with", "within", "would", "security", "information", "control",
    "controls", "organization", "organizational",
}

CONTROL_RE = re.compile(r"\b([A-Z]{2,3}-\d+(?:\(\d+\))?)\b")
SENTENCE_RE = re.compile(r"[.!?]\s+(?=[A-Z(\"•])")


def download_sources() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/pdf,text/html,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.dcsa.mil/Industrial-Security/NISP-Cybersecurity-Office-NCSO/",
    }

    for doc in DOCUMENTS:
        out = SOURCE_DIR / doc.file_name
        if out.exists() and out.stat().st_size > 10_000:
            print(f"[skip] {doc.file_name} already exists")
            continue
        print(f"[download] {doc.doc_title}")
        with urlopen(Request(doc.source_url, headers=headers), timeout=90) as response:
            out.write_bytes(response.read())


def extract_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    pages: list[str] = []
    for idx, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = normalize_text(text)
        if text:
            pages.append(f"\n\n[Page {idx}]\n{text}")
    return "\n".join(pages)


def normalize_text(text: str) -> str:
    text = text.replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"(?<=\w)-\n(?=\w)", "", text)
    text = re.sub(r"(?<![.!?:;\n])\n(?=[a-z])", " ", text)
    return text.strip()


def parse_sections(text: str) -> list[dict]:
    lines = text.splitlines()
    headings: list[dict] = []
    offset = 0

    for line in lines:
        stripped = line.strip()
        heading = detect_heading(stripped)
        if heading:
            key, title, level = heading
            headings.append({"index": offset, "key": key, "title": title, "level": level})
        offset += len(line) + 1

    if not headings:
        return [{"key": "0", "title": "Document", "level": 1, "content": text}]

    sections: list[dict] = []
    stack: list[dict] = []
    for idx, heading in enumerate(headings):
        next_index = headings[idx + 1]["index"] if idx + 1 < len(headings) else len(text)
        line_end = text.find("\n", heading["index"])
        content = text[line_end + 1 : next_index].strip() if line_end >= 0 else ""

        while stack and stack[-1]["level"] >= heading["level"]:
            stack.pop()
        parent = stack[-1] if stack else None

        if len(content) >= MIN_CHARS:
            sections.append(
                {
                    "key": heading["key"],
                    "title": heading["title"],
                    "level": heading["level"],
                    "parentKey": parent["key"] if parent else None,
                    "parentTitle": parent["title"] if parent else None,
                    "content": content,
                }
            )

        stack.append(heading)

    return sections


def detect_heading(line: str) -> tuple[str, str, int] | None:
    if not line or line.startswith("[Page "):
        return None
    if re.match(r"^\d{1,2}\s+[A-Z][a-z]+\s+\d{4}$", line):
        return None
    if re.match(r"^Page\s+\|?\s*\d+$", line, flags=re.IGNORECASE):
        return None

    markdown = re.match(r"^(#{1,4})\s+(.{3,120})$", line)
    if markdown:
        return f"H{len(markdown.group(1))}", markdown.group(2).strip(), min(len(markdown.group(1)), 4)

    numbered = re.match(r"^(\d+(?:\.\d+){0,4})\s+([A-Z][A-Z0-9 /&,\-()]{3,120}|[A-Z][A-Za-z0-9 /&,\-()]{6,120})$", line)
    if numbered:
        key = numbered.group(1)
        return key, numbered.group(2).strip(" ."), min(key.count(".") + 1, 5)

    control = re.match(r"^([A-Z]{2,3}-\d+(?:\s*\(\d+\))?)\s+([A-Z][A-Z0-9 /&,\-|()]{3,120})$", line)
    if control:
        key = re.sub(r"\s+", "", control.group(1))
        return key, control.group(2).strip(" ."), 3

    return None


def split_section(text: str) -> list[str]:
    text = text.strip()
    if len(text) <= TARGET_CHARS:
        return [text]

    chunks: list[str] = []
    current = ""
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    for para in paragraphs:
        candidate = f"{current}\n\n{para}".strip() if current else para
        if len(candidate) <= TARGET_CHARS:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(para) > TARGET_CHARS:
            parts = split_long_paragraph(para)
            chunks.extend(parts[:-1])
            current = parts[-1] if parts else ""
        else:
            current = para
    if current:
        chunks.append(current)
    return [chunk for chunk in chunks if len(chunk) >= MIN_CHARS]


def split_long_paragraph(text: str) -> list[str]:
    chunks: list[str] = []
    remaining = text.strip()
    while len(remaining) > TARGET_CHARS:
        window = remaining[: TARGET_CHARS + 250]
        split_at = -1
        for match in SENTENCE_RE.finditer(window):
            if match.start() <= TARGET_CHARS:
                split_at = match.start() + 1
        if split_at <= 0:
            split_at = TARGET_CHARS
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


def chunk_document(doc: SourceDocument, text: str) -> list[dict]:
    sections = parse_sections(text)
    chunks: list[dict] = []

    for section in sections:
        section_chunks = split_section(section["content"])
        control_refs = extract_control_refs(section["content"])
        families = sorted({ref.split("-")[0] for ref in control_refs})
        applicability = sorted(set(doc.default_applicability) | set(detect_applicability(section["content"])))
        keywords = extract_keywords(f'{section["title"]} {section["content"]}')

        for chunk_index, content in enumerate(section_chunks):
            chunks.append(
                {
                    "id": f'{doc.doc_id}:{section["key"]}:{chunk_index}',
                    "content": content,
                    "metadata": {
                        "docId": doc.doc_id,
                        "docTitle": doc.doc_title,
                        "docType": doc.doc_type,
                        "section": section["key"],
                        "sectionTitle": section["title"],
                        "parentSection": section.get("parentKey"),
                        "parentTitle": section.get("parentTitle"),
                        "controlRefs": control_refs,
                        "families": families,
                        "chunkIndex": chunk_index,
                        "chunkTotal": len(section_chunks),
                        "applicability": applicability,
                        "keywords": keywords,
                    },
                }
            )

    apply_overlap(chunks)
    return chunks


def apply_overlap(chunks: list[dict]) -> None:
    for idx, chunk in enumerate(chunks):
        previous = chunks[idx - 1] if idx > 0 else None
        following = chunks[idx + 1] if idx + 1 < len(chunks) else None
        section = chunk["metadata"]["section"]
        if previous and previous["metadata"]["section"] == section:
            chunk["overlapBefore"] = trim_overlap(previous["content"][-OVERLAP_CHARS:], before=True)
        if following and following["metadata"]["section"] == section:
            chunk["overlapAfter"] = trim_overlap(following["content"][:OVERLAP_CHARS], before=False)


def trim_overlap(text: str, before: bool) -> str:
    text = text.strip()
    matches = list(SENTENCE_RE.finditer(text))
    if not matches:
        return text
    if before:
        midpoint = len(text) * 0.35
        for match in matches:
            if match.start() >= midpoint:
                return text[match.start() + 1 :].strip()
    else:
        midpoint = len(text) * 0.65
        for match in reversed(matches):
            if match.start() <= midpoint:
                return text[: match.start() + 1].strip()
    return text


def extract_control_refs(text: str) -> list[str]:
    return sorted(set(CONTROL_RE.findall(text)))


def detect_applicability(text: str) -> list[str]:
    lower = text.lower()
    tags: list[str] = []
    checks = [
        ("SAP", r"\b(sap|special access program)\b"),
        ("SCI", r"\b(sci|sensitive compartmented information|scif)\b"),
        ("CUI", r"\b(cui|controlled unclassified information)\b"),
        ("HIGH", r"\bhigh[- ]impact\b"),
        ("MODERATE", r"\bmoderate[- ]impact\b"),
        ("LOW", r"\blow[- ]impact\b"),
        ("JSIG", r"\bjsig\b"),
        ("DOD", r"\b(dod|department of defense)\b"),
        ("NISP", r"\b(nisp|nispom|cleared contractor)\b"),
        ("DCSA", r"\bdcsa\b"),
    ]
    for tag, pattern in checks:
        if re.search(pattern, lower):
            tags.append(tag)
    return tags


def extract_keywords(text: str) -> list[str]:
    words = re.split(r"[^a-z0-9-]+", text.lower())
    seen: set[str] = set()
    result: list[str] = []
    for word in words:
        if len(word) <= 3 or word in STOPWORDS or word in seen:
            continue
        seen.add(word)
        result.append(word)
        if len(result) >= 60:
            break
    return result


def write_outputs() -> None:
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    all_chunks: list[dict] = []
    manifest: list[dict] = []

    for doc in DOCUMENTS:
        pdf = SOURCE_DIR / doc.file_name
        if not pdf.exists():
            raise FileNotFoundError(f"Missing source PDF: {pdf}")
        print(f"[extract] {doc.file_name}")
        text = extract_pdf_text(pdf)
        txt_path = SOURCE_DIR / f"{doc.doc_id}.txt"
        txt_path.write_text(text, encoding="utf-8")

        chunks = chunk_document(doc, text)
        out = {
            "docId": doc.doc_id,
            "docTitle": doc.doc_title,
            "docType": doc.doc_type,
            "source": doc.source_url,
            "chunks": chunks,
        }
        (CHUNK_DIR / f"{doc.doc_id}.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
        all_chunks.extend(chunks)
        manifest.append(
            {
                "docId": doc.doc_id,
                "docTitle": doc.doc_title,
                "docType": doc.doc_type,
                "source": doc.source_url,
                "sourceFile": str(pdf.relative_to(ROOT)),
                "textFile": str(txt_path.relative_to(ROOT)),
                "chunkFile": str((CHUNK_DIR / f"{doc.doc_id}.json").relative_to(ROOT)),
                "chunkCount": len(chunks),
            }
        )
        print(f"[chunk] {doc.doc_id}: {len(chunks)} chunks")

    (SOURCE_DIR / "rmf-policy-chunks.array.json").write_text(json.dumps(all_chunks, indent=2), encoding="utf-8")
    (SOURCE_DIR / "rmf-policy-sources.manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[done] {len(all_chunks)} total chunks")


def main(argv: Iterable[str]) -> int:
    args = set(argv)
    if "--skip-download" not in args:
        download_sources()
    write_outputs()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
