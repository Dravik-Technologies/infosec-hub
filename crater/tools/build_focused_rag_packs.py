#!/usr/bin/env python3
"""Build focused, high-signal RMF/JSIG RAG packs from existing full chunks.

The full policy documents are already chunked under:
  backend/prisma/seed/knowledge-chunks/

This script creates smaller expert packs for high-frequency AI tasks. The packs
reuse source text from official/public PDFs but rewrite docId/chunk IDs and
enrich metadata so DocumentChunkService can retrieve them more accurately.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parents[1]
CHUNK_DIR = ROOT / "backend/prisma/seed/knowledge-chunks"


def load_chunks(file_name: str) -> list[dict]:
    return json.loads((CHUNK_DIR / file_name).read_text(encoding="utf-8"))["chunks"]


def save_pack(
    file_name: str,
    doc_id: str,
    doc_title: str,
    doc_type: str,
    source: str,
    chunks: list[dict],
    extra_applicability: list[str],
    extra_keywords: list[str],
) -> None:
    normalized: list[dict] = []
    for index, chunk in enumerate(chunks):
      c = copy.deepcopy(chunk)
      metadata = c["metadata"]
      original_doc_id = metadata.get("docId")
      original_section = metadata.get("section")

      c["id"] = f"{doc_id}:{index:03d}"
      metadata["docId"] = doc_id
      metadata["docTitle"] = doc_title
      metadata["docType"] = doc_type
      metadata["chunkIndex"] = index
      metadata["chunkTotal"] = len(chunks)
      metadata["sourceDocId"] = original_doc_id
      metadata["sourceSection"] = original_section
      metadata["applicability"] = sorted(set(metadata.get("applicability", [])) | set(extra_applicability))
      metadata["keywords"] = unique(metadata.get("keywords", []) + extra_keywords + [str(original_doc_id or ""), str(original_section or "")])

      normalized.append(c)

    payload = {
        "docId": doc_id,
        "docTitle": doc_title,
        "docType": doc_type,
        "source": source,
        "chunks": normalized,
    }
    (CHUNK_DIR / file_name).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[pack] {file_name}: {len(normalized)} chunks")


def unique(values: list[str], limit: int = 80) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        v = str(value).strip().lower()
        if not v or v in seen:
            continue
        seen.add(v)
        out.append(v)
        if len(out) >= limit:
            break
    return out


def section_starts(prefixes: list[str]) -> Callable[[dict], bool]:
    return lambda c: any(str(c["metadata"]["section"]).startswith(prefix) for prefix in prefixes)


def text_contains(terms: list[str]) -> Callable[[dict], bool]:
    lowered = [term.lower() for term in terms]
    return lambda c: any(term in f"{c['metadata']['sectionTitle']} {c['content']}".lower() for term in lowered)


def pick(chunks: list[dict], predicate: Callable[[dict], bool], limit: int | None = None) -> list[dict]:
    selected = [chunk for chunk in chunks if predicate(chunk)]
    return selected[:limit] if limit else selected


def main() -> int:
    jsig = load_chunks("jsig-2016.json")
    daapm = load_chunks("dcsa-daapm-v2-2.json")
    dod8500 = load_chunks("dod-8500-01.json")
    dod8510 = load_chunks("dod-8510-01.json")

    save_pack(
        file_name="jsig-focused-access-privileged.json",
        doc_id="jsig-focused-access-privileged",
        doc_title="JSIG Focus Pack — Access Control and Privileged Access",
        doc_type="JSIG",
        source="backend/prisma/seed/knowledge-chunks/jsig-2016.json",
        chunks=pick(
            jsig,
            lambda c: section_starts([
                "1.5.13", "1.5.14", "1.5.15", "1.5.16",
                "AC-1", "AC-2", "AC-3", "AC-5", "AC-6", "AC-7", "AC-8",
                "AC-10", "AC-11", "AC-12", "AC-14", "AC-17", "AC-18",
                "AC-19", "AC-20", "AC-24", "AC-25", "PS-6",
            ])(c)
            or text_contains(["privileged user", "need-to-know", "program access request", "access roster"])(c),
        ),
        extra_applicability=["SAP", "SCI", "HIGH", "JSIG", "DOD"],
        extra_keywords=[
            "access-control", "account-management", "privileged-access", "least-privilege",
            "need-to-know", "par", "access-roster", "isso", "issm", "pso",
        ],
    )

    save_pack(
        file_name="jsig-focused-ia-au-boundary.json",
        doc_id="jsig-focused-ia-au-boundary",
        doc_title="JSIG Focus Pack — Identification, Audit, Boundary Protection",
        doc_type="JSIG",
        source="backend/prisma/seed/knowledge-chunks/jsig-2016.json",
        chunks=pick(
            jsig,
            lambda c: section_starts([
                "IA-1", "IA-2", "IA-3", "IA-4", "IA-5", "IA-6", "IA-7", "IA-8", "IA-9", "IA-10", "IA-11",
                "AU-1", "AU-2", "AU-3", "AU-4", "AU-5", "AU-6", "AU-7", "AU-8", "AU-9", "AU-10", "AU-11", "AU-12", "AU-13", "AU-14", "AU-16",
                "SC-3", "SC-4", "SC-5", "SC-7", "SC-8", "SC-12", "SC-13", "SC-28", "SC-39", "SC-40", "SC-41",
                "SI-4",
            ])(c),
        ),
        extra_applicability=["SAP", "SCI", "HIGH", "JSIG", "DOD"],
        extra_keywords=[
            "identification", "authentication", "mfa", "cac", "piv", "audit",
            "non-repudiation", "boundary-protection", "cross-domain", "encryption",
            "monitoring", "siem", "scif",
        ],
    )

    save_pack(
        file_name="dcsa-daapm-rmf-core.json",
        doc_id="dcsa-daapm-rmf-core",
        doc_title="DCSA DAAPM Focus Pack — Assessment, Authorization, Monitoring, POA&M",
        doc_type="DAAG",
        source="backend/prisma/seed/knowledge-chunks/dcsa-daapm-v2-2.json",
        chunks=pick(
            daapm,
            lambda c: section_starts(["3.1", "3.2", "3.6", "3.7", "5", "6", "6.2", "7", "7.5", "7.6", "7.7", "12"])(c)
            or text_contains(["poa&m", "plan of action", "milestones", "assessment", "authorization", "continuous monitoring", "emass"])(c),
        ),
        extra_applicability=["DCSA", "NISP", "DOD", "RMF"],
        extra_keywords=[
            "daapm", "daag", "dcsa", "emass", "assessment", "authorization",
            "monitoring", "poam", "poa&m", "issm", "isso", "sca", "ao",
        ],
    )

    save_pack(
        file_name="dod-8500-8510-rmf-policy.json",
        doc_id="dod-8500-8510-rmf-policy",
        doc_title="DoD 8500/8510 Focus Pack — Cybersecurity Policy and RMF Application",
        doc_type="DOD_POLICY",
        source="backend/prisma/seed/knowledge-chunks/dod-8500-01.json; backend/prisma/seed/knowledge-chunks/dod-8510-01.json",
        chunks=(
            pick(
                dod8500,
                text_contains([
                    "cybersecurity risk management", "risk management", "continuous monitoring",
                    "cyberspace defense", "identity assurance", "information technology",
                    "authorization decisions", "security authorization", "security posture",
                    "information system security managers", "authorizing officials",
                ]),
            )
            + pick(
                dod8510,
                text_contains([
                    "dod and nist rmf implementation", "rmf process applies", "categorize",
                    "select", "implement", "assess", "authorize", "monitor", "security authorization",
                    "cybersecurity risk governance", "rmf ks", "continuous monitoring",
                ]),
            )
        ),
        extra_applicability=["DOD", "RMF"],
        extra_keywords=[
            "dodi-8500", "dodi-8510", "cybersecurity", "rmf", "authorization",
            "continuous-monitoring", "risk-governance", "ato", "ao", "ciso",
        ],
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
