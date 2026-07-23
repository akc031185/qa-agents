# QA Agent Toolkit

**A field guide to 38 single-purpose software-QA agents — and the reusable toolkit they grew out of.**

📖 **Live catalog:** https://akc031185.github.io/qa-agents/

Each agent automates one repetitive part of QA — bug triage, test-case generation, cross-browser runs, data verification against the source of record, LLM-output grading — behind a typed input/output contract. Most are deterministic automation over the Azure DevOps REST API, Playwright, or SQL; a few wrap an LLM only where judgment is unavoidable.

This repo hosts the catalog site (via GitHub Pages). The code lives in eight category repos:

## Category repos

| Stage | Repo | Agents |
|---|---|---|
| Section 01 · Finding & reporting problems | [qa-agents-finding](https://github.com/akc031185/qa-agents-finding) | 4 |
| Section 02 · Deciding what to test | [qa-agents-planning](https://github.com/akc031185/qa-agents-planning) | 6 |
| Section 03 · Keeping the project tracker up to date | [qa-agents-tracker](https://github.com/akc031185/qa-agents-tracker) | 6 |
| Section 04 · Checking the screens look right | [qa-agents-screens](https://github.com/akc031185/qa-agents-screens) | 3 |
| Section 05 · Grading the AI assistant's answers | [qa-agents-llm-eval](https://github.com/akc031185/qa-agents-llm-eval) | 5 |
| Section 06 · Investigating the app's data & behavior | [qa-agents-data](https://github.com/akc031185/qa-agents-data) | 7 |
| Section 07 · Turning results into reports people read | [qa-agents-reporting](https://github.com/akc031185/qa-agents-reporting) | 2 |
| Section 08 · The reusable toolkit — works on any project | [qa-agents-toolkit](https://github.com/akc031185/qa-agents-toolkit) | 5 |

## The reusable toolkit

Four jobs recurred on every project, so they're extracted into typed, dependency-checked modules that drop into any repo — **with or without Azure**. They run with no credentials against offline fixtures. See **[qa-agents-toolkit](https://github.com/akc031185/qa-agents-toolkit)**.

## What's here

```
index.html          the catalog landing (every agent, code + details links)
agents/<slug>.html  the rich page per agent (flowchart, code modals, runbook)
toolkit.html        the reusable-toolkit landing
guides.html         guides: Git & GitHub, build-your-own-agent, MCP workflows, résumé agent
deck.html           the slide talk
build-catalog.ts    the generator (content/*.json → the site)
```

## License

MIT — see [LICENSE](LICENSE).
