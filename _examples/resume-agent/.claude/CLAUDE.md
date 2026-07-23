# Résumé project — agent context

This file tells Claude Code how to work on the résumé in this folder. Edit the
owner block and rules to fit you, then use the workflow in the guide: **tailor →
score → render**.

## Owner
- Name: Your Name
- Email: you@example.com
- Location: City, ST
- Current title: Your Professional Title

## Format rules
- Source of truth: `resume.md` (Markdown, version-controlled). Render to DOCX with `node generate-docx.js`.
- Length: 2–3 pages max.
- Sections, in order: Summary, Selected Highlights (5 bullets), Core Skills (table), Professional Experience, Education & Certifications.
- Experience bullets: start with a strong action verb; quantify impact where possible; 1–2 lines each.
- No objective statement, no references section.
- Skills-table categories: Languages/Frameworks, Tools, APIs & Services, DevOps/CI-CD, Cloud/Platforms.

## Versioning
- Keep variants as `resume_<VARIANT>_<DATE>.md` (e.g. `resume_backend_2026-03.md`).
- The base résumé (richest content) is the one you tailor from.

## Work-history reference
- Company (20XX–present): Role — one-line scope.
- Company (20XX–20XX): Role — one-line scope.
- (List real roles here so tailoring stays truthful — never invent experience.)

## ATS scoring rubric
When asked to score ATS readiness, evaluate against these weights and report a number per dimension plus concrete gaps:
1. **Keyword match — 40%**: the job description's keywords appear in the résumé.
2. **Format compliance — 15%**: no tables/images/odd headers an ATS can't parse (Markdown is clean).
3. **Section headers — 10%**: standard headers (Summary, Experience, Skills, Education).
4. **Quantified achievements — 15%**: measurable results with numbers/percentages.
5. **Relevance — 20%**: experience bullets align with the JD's requirements.

## Guardrails
- Never fabricate experience, titles, dates, or metrics. Tailoring = emphasis and wording, not invention.
- Keep the owner's real contact details out of anything shared publicly.
