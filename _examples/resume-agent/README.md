# Résumé-builder agent (example)

A small, **non-QA** example of the "build your own agent" pattern — a Claude Code
project that keeps a résumé in Markdown, tailors it to a job description, scores it
for ATS, and renders a polished Word document. Everything here is a **generic
placeholder** — swap in your own content.

Companion guide: `docs/site/guide-resume-agent.html` ("A résumé-builder agent").

## What's in here
| File | What it is |
|------|-----------|
| `resume.md` | The résumé, in Markdown — your version-controlled source of truth. |
| `.claude/CLAUDE.md` | The agent's rules: format + an ATS scoring rubric. Claude reads this. |
| `generate-docx.js` | Renders a styled `.docx` (via the `docx` library). Edit the `RESUME` object or wire it to `resume.md`. |
| `package.json` | Declares the one dependency (`docx`). |

## Use it
```bash
npm install            # installs the docx library
node generate-docx.js  # writes ./resume.docx
```

## The workflow (with Claude Code)
1. **Tailor** — open this folder in Claude Code and paste a job description:
   *"Tailor resume.md to this JD, keep it truthful, then score it against the ATS rubric."*
2. **Score** — Claude scores ATS readiness against the rubric in `.claude/CLAUDE.md` and lists concrete gaps.
3. **Render** — `node generate-docx.js` → a styled `.docx`.

## Make it your own
Replace the placeholders in `resume.md`, `generate-docx.js` (the `RESUME` object),
and `.claude/CLAUDE.md` (owner + work-history + your format). The rubric and the
render script stay the same. Never fabricate experience — tailoring is emphasis and
wording, not invention.
