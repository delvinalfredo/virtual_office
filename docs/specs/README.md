# Application Specifications

**Optional — use this folder only when the project actually has specs.**

A new or small project having none is normal. When none exist, agents proceed on
the request and the code; they must not ask for a spec that was never written.

When specs do exist, put them here:

- BRD (business requirements), PRD, user stories
- FSD (functional spec) and TSD (technical spec), per module if the vendor splits them
- API specs (OpenAPI YAML/JSON, or the vendor's PDF)
- Business flows, integration specs, data mapping, UAT scenarios and change requests

Claude Code reads Markdown, text, OpenAPI files and PDFs directly. A Word or Excel
document (`.docx`, `.xlsx`) is not read as-is: export it to PDF (or Markdown/CSV)
and keep that copy here, next to the original if you want both.

## Conventions

- Use descriptive file names with the document type first: `brd-loan-origination.pdf`, `fsd-loan-approval.pdf`, `tsd-core-banking-integration.pdf`, `api-openapi.yaml`, `uat-loan-approval.pdf`
- Avoid vague names: `final-v2-revised.pdf`, `spec.pdf`
- Keep specs together here rather than scattered across the repository. If the
  project already has its own location (`specs/`, `docs/`, `PRD.md`), keep using
  that one instead — agents read specs wherever they live.
- If an API spec becomes stable, keep a machine-readable version (OpenAPI YAML/JSON) alongside the PDF.

## Maintenance rule

Specs are living documents equal in authority to the code. When a task changes
the behavior a spec describes, update that spec in the same task — a spec that
contradicts the shipped code misleads every later agent. If you find a spec that
already contradicts the code, report the conflict and ask which one is correct
before implementing.

