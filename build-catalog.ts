#!/usr/bin/env ts-node
/**
 * build-catalog.ts — static generator for the "Field Guide to a Workforce of
 * Software Agents" catalog. Reads structured, plain-English content (one JSON
 * per agent in ./content) + a category map (./categories.json) and renders:
 *   - index.html                (the contents: hero, primer, category rosters)
 *   - agents/<slug>.html         (one rich "specimen plate" per agent)
 *   - deck.html                  (a scroll/keyboard slide deck of the whole story)
 * All pages link ./assets/site.css relatively → self-contained offline folder.
 *
 * Audience: technical practitioners (SWE/QA/SDET/PM/TPM/SRE/DevOps) who know AI
 * at a concept level and want the practical, implementation-level reality.
 */
import * as fs from 'fs';
import * as path from 'path';

const SITE = __dirname;
const CONTENT_DIR = path.join(SITE, 'content');
const OUT_AGENTS = path.join(SITE, 'agents');

// ── Content schema (the fan-out fills these) ──────────────────────────────
interface Example { caption: string; input: string; output: string; }
/** v2 flow step: a plain step mapped to the real function that implements it. */
interface FlowStep { step: string; fn?: string; explain?: string; code?: string; }
/** v2 under-the-hood slide: one embedded mini-deck slide per idea. */
interface HoodSlide { heading: string; whenRuns: string; input: string; output: string; }
/** Optional final carousel slide: shows the agent's output turned into an HTML page. */
interface OutputSample { heading: string; whenRuns: string; input: string; output: string; img: string; imgAlt?: string; caption?: string; }
interface AgentContent {
  slug: string;
  plate: number;                // stable plate number (assigned in categories.json order)
  name: string;                 // friendly name (NOT the filename)
  techName: string;             // original file, shown small
  category: string;             // must match a categories.json id
  oneLiner: string;             // what it does for you, one sentence
  lead: string;                 // 2-3 sentence plain-English summary
  chore: string;                // the tedious human task it removes
  instead: string;              // what you get instead
  whyItMatters?: string;        // the stakes, in human terms
  howItWorks: (string | FlowStep)[];   // v1 strings OR v2 flow steps (with code)
  examples: Example[];          // one or more worked examples
  underHood?: string | HoodSlide[];    // v1 string OR v2 slideable mini-deck
  runbook?: Runbook;            // v3: "Run it & wire it in"
  video?: VideoSlot;            // v3: embed slot + recording script
  outputSample?: OutputSample;  // v4: optional "output → HTML page" carousel slide
  status: 'reference' | 'toolkit';
}
/** v3 runbook — beginner-verbose "how to actually run it". */
interface RunStep { label: string; cmd?: string; why: string; firstRun?: string; rerun?: string; }
interface NamedThing { name: string; desc: string; }
interface Runbook {
  runnable: boolean;            // true = you can really run it; false = needs its target system
  prerequisites: string[];     // what you need before step 1
  steps: RunStep[];            // node install → deps → config → run, each with WHY
  inputs: NamedThing[];        // what you give it
  outputs: NamedThing[];       // what comes back
  rerun: string;               // what's different the second time
  integrate: string;           // how to plug it into an existing system
}
interface VideoSlot { url?: string; caption?: string; script?: string[]; }
const asStep = (s: string | FlowStep): FlowStep => (typeof s === 'string' ? { step: s } : s);
interface Category { id: string; no: string; name: string; desc: string; }

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
/** minimal inline markup: `code` and **bold** */
function rich(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Link known Microsoft terms to their public docs — first occurrence of each. */
function docLinkify(html: string): string {
  const map: [RegExp, string][] = [
    [/(?<![\w>])Azure DevOps REST API\b/, 'https://learn.microsoft.com/en-us/rest/api/azure/devops/'],
    [/(?<![\w>])Azure DevOps\b/, 'https://learn.microsoft.com/en-us/azure/devops/boards/get-started/what-is-azure-boards'],
    [/(?<![\w>])personal access token\b/i, 'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate'],
  ];
  for (const [re, url] of map) {
    html = html.replace(re, m => `<a class="doclink" href="${url}" target="_blank" rel="noopener">${m}</a>`);
  }
  return html;
}

/** Safe-embed JSON in a <script> tag (escape < so </script> can't break out). */
function jsonScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** The flowchart: clickable nodes (open a code preview) joined by arrows. */
function flowchartHtml(steps: FlowStep[]): string {
  const hasCode = steps.some(s => s.code);
  const nodes = steps.map((s, i) => {
    const clickable = Boolean(s.code || s.explain);
    const tag = clickable ? 'button' : 'div';
    const attrs = clickable ? `class="fc-node fc-node--live" data-fc="${i}" type="button"` : 'class="fc-node"';
    return `<${tag} ${attrs}>
        <span class="fc-node__n">${String(i + 1).padStart(2, '0')}</span>
        <span class="fc-node__body">
          <span class="fc-node__t">${rich(s.step)}</span>
          ${s.fn ? `<span class="fc-node__fn">${esc(s.fn)}</span>` : ''}
        </span>
        ${clickable ? '<span class="fc-node__peek">view code →</span>' : ''}
      </${tag}>`;
  }).join('\n      <div class="fc-arrow" aria-hidden="true">↓</div>\n      ');

  const data = steps.map(s => ({ fn: s.fn || '', explain: s.explain || '', code: s.code || '' }));
  const modal = hasCode ? `
    <div class="code-modal" id="codeModal" hidden>
      <div class="code-modal__backdrop" data-close></div>
      <div class="code-modal__panel" role="dialog" aria-modal="true" aria-labelledby="cmFn">
        <button class="code-modal__x" data-close aria-label="Close">✕</button>
        <div class="code-modal__grid">
          <div class="code-modal__codecol">
            <div class="code-modal__cap"><code id="cmFn"></code></div>
            <pre class="code-modal__code"><code id="cmCode"></code></pre>
          </div>
          <aside class="code-modal__explain">
            <h4>What this step does</h4>
            <p id="cmExplain"></p>
          </aside>
        </div>
      </div>
    </div>
    <script type="application/json" id="fcData">${jsonScript(data)}</script>` : '';

  return `<p class="flow-lead">${hasCode ? 'Follow the flow — <strong>click any step to see the exact code behind it.</strong>' : 'Follow the flow from top to bottom.'}</p>
    <div class="flowchart">
      ${nodes}
    </div>${modal}`;
}

/** "Run it & wire it in" — the engineer-facing runbook + a video slot. */
function runbookHtml(rb: Runbook | undefined, video: VideoSlot | undefined): string {
  if (!rb && !video) return '';
  const rbInner = rb ? `
    <div class="rb__banner rb__banner--${rb.runnable ? 'live' : 'ref'}">
      ${rb.runnable
        ? 'You can run this yourself, end to end — every command below is real.'
        : 'This was an internal tool: the steps are real, but running it needs access to the system it targets (your tracker, the app’s API, the designs). Treat it as a faithful how-it-ran guide.'}
    </div>
    <h3 class="display">Before you start</h3>
    <ul class="rb__prereqs">${rb.prerequisites.map(p => `<li>${rich(p)}</li>`).join('')}</ul>

    <h3 class="display">Step by step</h3>
    <ol class="rb__steps">
      ${rb.steps.map(s => `<li class="rb__step">
        <div class="rb__label">${rich(s.label)}</div>
        ${s.cmd ? `<pre class="rb__cmd"><code>${esc(s.cmd)}</code></pre>` : ''}
        <div class="rb__why"><span>Why</span> ${rich(s.why)}</div>
        ${s.firstRun ? `<div class="rb__run rb__run--first"><span>First run</span> ${rich(s.firstRun)}</div>` : ''}
        ${s.rerun ? `<div class="rb__run rb__run--again"><span>Re-run</span> ${rich(s.rerun)}</div>` : ''}
      </li>`).join('\n      ')}
    </ol>

    <div class="rb__io grid cols-2">
      <div><h3 class="display">What you give it</h3><dl class="rb__list">${rb.inputs.map(i => `<dt>${esc(i.name)}</dt><dd>${rich(i.desc)}</dd>`).join('')}</dl></div>
      <div><h3 class="display">What comes back</h3><dl class="rb__list">${rb.outputs.map(o => `<dt>${esc(o.name)}</dt><dd>${rich(o.desc)}</dd>`).join('')}</dl></div>
    </div>

    <div class="rb__note"><strong>Running it again.</strong> ${rich(rb.rerun)}</div>
    <div class="rb__note rb__note--wire"><strong>Plug it into your stack.</strong> ${rich(rb.integrate)}</div>` : '';

  const vid = video ? `
    <h3 class="display">Watch it run</h3>
    <figure class="rb__video">
      ${video.url
        ? `<video controls preload="metadata" src="${esc(video.url)}"></video>`
        : `<div class="rb__video-empty"><span>▶</span><p>Walkthrough video coming.${video.script ? ' Recording script is written and ready.' : ''}</p></div>`}
      ${video.caption ? `<figcaption>${rich(video.caption)}</figcaption>` : ''}
    </figure>
    ${video.script ? `<p class="rb__script-moved">The shot-by-shot recording script is kept internally (in <code>_internal/recording-scripts.md</code>), not on this page.</p>` : ''}` : '';

  return docLinkify(`<h2 class="display">Run it &amp; wire it in</h2>
    <section class="runbook">${rbInner}${vid}</section>`);
}

/** Under the hood: an embedded, slideable mini-deck (one slide per idea). */
function hoodHtml(hood: AgentContent['underHood'], sample?: OutputSample, rel = '../'): string {
  if (!hood && !sample) return '';
  if (typeof hood === 'string' && !sample) {
    return `<h2 class="display">Under the hood</h2>
    <details class="underhood"><summary>For the curious</summary><div class="underhood__body">${rich(hood)}</div></details>`;
  }
  const base: HoodSlide[] = Array.isArray(hood) ? hood : [];
  const total = base.length + (sample ? 1 : 0);
  const slides = base.map((s, i) => `
      <article class="uh-slide" data-uh="${i}">
        <div class="uh-slide__no">${i + 1} / ${total}</div>
        <h3 class="display">${esc(s.heading)}</h3>
        <dl class="uh-io">
          <dt>When it runs</dt><dd>${rich(s.whenRuns)}</dd>
          <dt>Takes in</dt><dd>${rich(s.input)}</dd>
          <dt>Shows out</dt><dd>${rich(s.output)}</dd>
        </dl>
      </article>`).join('');
  const sampleSlide = sample ? `
      <article class="uh-slide" data-uh="${base.length}">
        <div class="uh-slide__no">${total} / ${total}</div>
        <h3 class="display">${esc(sample.heading)}</h3>
        <div class="uh-sample">
          <div class="uh-sample__text"><dl class="uh-io">
            <dt>When it runs</dt><dd>${rich(sample.whenRuns)}</dd>
            <dt>Takes in</dt><dd>${rich(sample.input)}</dd>
            <dt>Shows out</dt><dd>${rich(sample.output)}</dd>
          </dl></div>
          <figure class="uh-sample__shot">
            <img alt="${esc(sample.imgAlt || 'Sample output rendered as an HTML page')}" src="${rel}${esc(sample.img)}">
            ${sample.caption ? `<figcaption>${esc(sample.caption)}</figcaption>` : ''}
          </figure>
        </div>
      </article>` : '';
  const dots = Array.from({ length: total }, (_, i) => `<button class="uh-dot${i === 0 ? ' is-on' : ''}" data-uh-dot="${i}" aria-label="Slide ${i + 1}"></button>`).join('');
  return `<h2 class="display">Under the hood — for the curious</h2>
    <p class="flow-lead">A slide for each moving part. Slide back and forth.</p>
    <section class="uh-deck" data-uh-deck>
      <div class="uh-viewport"><div class="uh-track">${slides}${sampleSlide}</div></div>
      <div class="uh-nav">
        <button class="uh-btn" data-uh-prev aria-label="Previous">‹ Back</button>
        <span class="uh-dots">${dots}</span>
        <button class="uh-btn" data-uh-next aria-label="Next">Next ›</button>
      </div>
    </section>`;
}

const PLATE_JS = `<script>
(function(){
  // --- code preview modal (flowchart) ---
  var modal = document.getElementById('codeModal');
  var dataEl = document.getElementById('fcData');
  if (modal && dataEl) {
    var data = JSON.parse(dataEl.textContent);
    var cmFn = document.getElementById('cmFn'), cmCode = document.getElementById('cmCode'), cmExplain = document.getElementById('cmExplain');
    function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function open(i){ var d = data[i]; if(!d) return; cmFn.textContent = d.fn || 'code'; cmCode.textContent = d.code || ''; cmExplain.innerHTML = esc(d.explain || '').replace(/\`([^\`]+)\`/g, '<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>'); modal.hidden = false; document.body.style.overflow='hidden'; }
    function close(){ modal.hidden = true; document.body.style.overflow=''; }
    document.querySelectorAll('.fc-node--live').forEach(function(n){ n.addEventListener('click', function(){ open(+n.getAttribute('data-fc')); }); });
    modal.querySelectorAll('[data-close]').forEach(function(b){ b.addEventListener('click', close); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !modal.hidden) close(); });
  }
  // --- under-the-hood carousel ---
  var deck = document.querySelector('[data-uh-deck]');
  if (deck) {
    var track = deck.querySelector('.uh-track');
    var slides = deck.querySelectorAll('.uh-slide');
    var dots = deck.querySelectorAll('.uh-dot');
    var i = 0;
    function go(n){ i = Math.max(0, Math.min(slides.length-1, n)); track.style.transform = 'translateX(' + (-i*100) + '%)'; dots.forEach(function(d,j){ d.classList.toggle('is-on', j===i); }); }
    deck.querySelector('[data-uh-prev]').addEventListener('click', function(){ go(i-1); });
    deck.querySelector('[data-uh-next]').addEventListener('click', function(){ go(i+1); });
    dots.forEach(function(d,j){ d.addEventListener('click', function(){ go(j); }); });
  }
})();
</script>`;

const HEAD = (title: string, rel: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${rel}assets/site.css">
</head>`;

const MAST = (rel: string) => `
<header class="masthead"><div class="wrap masthead__inner">
  <div class="masthead__title"><b>◑</b> Field Guide to Software QA Agents</div>
  <nav class="masthead__nav">
    <a href="${rel}index.html">Contents</a>
    <a href="${rel}toolkit.html">Toolkit</a>
    <a href="${rel}guides.html">Guides</a>
    <a href="${rel}deck.html">Slides</a>
  </nav>
</div></header>`;

// ── Load content + categories ─────────────────────────────────────────────
function load(): { agents: AgentContent[]; cats: Category[] } {
  const cats: Category[] = JSON.parse(fs.readFileSync(path.join(SITE, 'categories.json'), 'utf8'));
  const agents: AgentContent[] = [];
  if (fs.existsSync(CONTENT_DIR)) {
    for (const f of fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json')).sort()) {
      agents.push(JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8')));
    }
  }
  agents.sort((a, b) => a.plate - b.plate);
  return { agents, cats };
}

// ── Render one plate ───────────────────────────────────────────────────────
function plateHtml(a: AgentContent, cats: Category[], prev?: AgentContent, next?: AgentContent): string {
  const cat = cats.find(c => c.id === a.category);
  const catName = cat ? cat.name : a.category;
  const examples = a.examples.map(ex => `
    <figure class="specimen">
      <figcaption class="specimen__cap">${esc(ex.caption)}</figcaption>
      <div class="specimen__body">
        <div class="specimen__io"><h4>What goes in</h4><pre>${esc(ex.input)}</pre></div>
        <div class="specimen__io"><h4>What comes out</h4><pre>${esc(ex.output)}</pre></div>
      </div>
    </figure>`).join('\n');

  const sN = cats.findIndex(c => c.id === a.category) + 1;
  return `${HEAD(`${a.name} — Agent ${String(a.plate).padStart(2, '0')}`, '../')}
<body class="plate-shell s${sN}">
${MAST('../')}
<main class="wrap wrap--article">
  <article class="plate">
    <div class="plate__top">
      <div class="plate__no">${String(a.plate).padStart(2, '0')}<small>Agent</small></div>
      <div class="plate__title">
        <div class="plate__cat"><span class="chip ${a.status === 'toolkit' ? 'chip--toolkit' : ''}">${esc(catName)}</span></div>
        <h1>${esc(a.name)}</h1>
        <p class="lead">${rich(a.oneLiner)}</p>
        <p class="kicker">Source file: ${esc(a.techName)}</p>
      </div>
    </div>

    <p>${rich(a.lead)}</p>

    <h2 class="display">Why this exists</h2>
    <div class="beforeafter">
      <div class="ba ba--before"><div class="ba__label">The chore it removes</div><p>${rich(a.chore)}</p></div>
      <div class="ba__arrow">→</div>
      <div class="ba ba--after"><div class="ba__label">What you get instead</div><p>${rich(a.instead)}</p></div>
    </div>
    ${a.whyItMatters ? `<p>${rich(a.whyItMatters)}</p>` : ''}

    <h2 class="display">How it works</h2>
    ${flowchartHtml(a.howItWorks.map(asStep))}

    <h2 class="display">See it in action</h2>
    ${examples}

    ${runbookHtml(a.runbook, a.video)}

    ${hoodHtml(a.underHood, a.outputSample)}

    <nav class="platenav">
      <a href="${prev ? `${prev.slug}.html` : '../index.html'}">← ${prev ? esc(prev.name) : 'Contents'}</a>
      <a href="${next ? `${next.slug}.html` : '../index.html'}">${next ? esc(next.name) : 'Contents'} →</a>
    </nav>
  </article>
</main>
${PLATE_JS}
</body></html>`;
}

// ── GitHub publish wiring ──────────────────────────────────────────────────
// The catalog site (this hub) links each agent block to its source file, which
// lives in that agent's CATEGORY repo. One hub repo (qa-agents) hosts this site
// via Pages; eight category repos hold the code.
const GH_OWNER = 'akc031185';
const CAT_REPO: Record<string, string> = {
  find:    'qa-agents-finding',
  plan:    'qa-agents-planning',
  tracker: 'qa-agents-tracker',
  screens: 'qa-agents-screens',
  grade:   'qa-agents-llm-eval',
  probe:   'qa-agents-data',
  report:  'qa-agents-reporting',
  toolkit: 'qa-agents-toolkit',
};
/** GitHub blob URL for the source file backing an agent, in its category repo. */
function codeUrl(a: AgentContent): string {
  const repo = CAT_REPO[a.category] ?? 'qa-agents-toolkit';
  // Toolkit agents point at the REAL module (techName = src/core/*.ts);
  // reference agents point at their generated <slug>.ts at the repo root.
  const filePath = a.status === 'toolkit' ? a.techName : `${a.slug}.ts`;
  return `https://github.com/${GH_OWNER}/${repo}/blob/main/${filePath}`;
}

// ── Render index (contents) ────────────────────────────────────────────────
function indexHtml(agents: AgentContent[], cats: Category[]): string {
  const total = agents.length;
  const toolkit = agents.filter(a => a.status === 'toolkit').length;
  const sections = cats.map(c => {
    const members = agents.filter(a => a.category === c.id);
    if (!members.length) return '';
    const sN = cats.indexOf(c) + 1;
    const cards = members.map(a => `
      <div class="rcard ${a.status === 'toolkit' ? 'rcard--toolkit' : ''}">
        <div class="rcard__no">Agent ${String(a.plate).padStart(2, '0')}</div>
        <div class="rcard__name">${esc(a.name)}</div>
        <div class="rcard__one">${rich(a.oneLiner)}</div>
        <div class="rcard__actions">
          <a class="rcard__code" href="${codeUrl(a)}" target="_blank" rel="noopener" title="View the source on GitHub">&#8249;&#47;&#8250; View code</a>
          <a class="rcard__tag" href="agents/${a.slug}.html">Details &rarr;</a>
        </div>
      </div>`).join('\n');
    return `
    <section class="section s${sN}" id="${esc(c.id)}">
      <div class="wrap">
        <div class="section__head"><span class="section__no">${esc(c.no)}</span><h2 class="display">${esc(c.name)}</h2></div>
        <p class="section__desc">${rich(c.desc)}</p>
        <div class="roster">${cards}</div>
      </div>
    </section>`;
  }).join('\n');

  return `${HEAD('Field Guide to Software QA Agents', '')}
<body>
${MAST('')}
<section class="hero">
  <div class="hero__blobs" aria-hidden="true">
    <svg style="top:-60px;right:-120px;width:460px" viewBox="0 0 460 460"><path fill="#FFE9C7" d="M230 20c95 0 210 60 210 175S345 420 230 420 20 330 20 215 135 20 230 20Z" opacity=".8"/></svg>
    <svg style="bottom:-90px;left:-140px;width:380px" viewBox="0 0 380 380"><path fill="#DDF6EF" d="M190 10c80 10 180 70 170 180S270 375 175 365 5 280 15 175 110 0 190 10Z" opacity=".8"/></svg>
    <svg style="top:120px;left:52%;width:120px" viewBox="0 0 120 120"><circle cx="60" cy="60" r="58" fill="#E9ECFF" opacity=".9"/></svg>
  </div>
  <div class="wrap">
  <div class="eyebrow hero__eyebrow">A QA automation catalog</div>
  <h1 class="display">${total} single-purpose agents for the repetitive parts of QA.</h1>
  <p class="lead">Automate the QA work you still do by hand — bug triage, test-case generation, cross-browser runs, data verification against the source of record, LLM-output grading. ${total} agents, one task each, every one with a typed input/output contract. Built on the ADO REST API, Playwright, and SQL; an LLM in the loop only where judgment is unavoidable. Each entry gives you the contract, the internals, and how to drop it into CI.</p>
  <div class="hero__crew" aria-hidden="true">
    <svg viewBox="0 0 560 84">
      <rect x="6" y="18" width="52" height="52" rx="16" fill="#FF6B6B"/><circle cx="24" cy="40" r="3.4" fill="#3B3532"/><circle cx="40" cy="40" r="3.4" fill="#3B3532"/><path d="M24 52c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>
      <circle cx="103" cy="44" r="27" fill="#FFB020"/><circle cx="95" cy="40" r="3.4" fill="#3B3532"/><circle cx="111" cy="40" r="3.4" fill="#3B3532"/><path d="M95 51c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>
      <path d="M146 70V46c0-15 12-27 27-27s27 12 27 27v24Z" fill="#6C7BFF"/><circle cx="165" cy="44" r="3.4" fill="#FFF8EE"/><circle cx="181" cy="44" r="3.4" fill="#FFF8EE"/><path d="M165 55c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#FFF8EE" stroke-width="3" stroke-linecap="round"/>
      <rect x="216" y="18" width="52" height="52" rx="26" fill="#2EC4A0"/><circle cx="234" cy="40" r="3.4" fill="#3B3532"/><circle cx="250" cy="40" r="3.4" fill="#3B3532"/><path d="M234 52c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>
      <rect x="286" y="18" width="52" height="52" rx="16" fill="#FF7BAC"/><circle cx="304" cy="40" r="3.4" fill="#3B3532"/><circle cx="320" cy="40" r="3.4" fill="#3B3532"/><path d="M304 52c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>
      <circle cx="383" cy="44" r="27" fill="#3FB4E8"/><circle cx="375" cy="40" r="3.4" fill="#3B3532"/><circle cx="391" cy="40" r="3.4" fill="#3B3532"/><path d="M375 51c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>
      <path d="M426 70V46c0-15 12-27 27-27s27 12 27 27v24Z" fill="#FF8A3D"/><circle cx="445" cy="44" r="3.4" fill="#3B3532"/><circle cx="461" cy="44" r="3.4" fill="#3B3532"/><path d="M445 55c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#3B3532" stroke-width="3" stroke-linecap="round"/>
      <rect x="496" y="18" width="52" height="52" rx="26" fill="#9B6BF2"/><circle cx="514" cy="40" r="3.4" fill="#FFF8EE"/><circle cx="530" cy="40" r="3.4" fill="#FFF8EE"/><path d="M514 52c2.8 3 5.6 4.5 8 4.5s5.2-1.5 8-4.5" fill="none" stroke="#FFF8EE" stroke-width="3" stroke-linecap="round"/>
    </svg>
  </div>
  <div class="hero__meta">
    <div class="stat stat--a"><div class="num">${total}</div><div class="lbl">Single-purpose agents</div></div>
    <div class="stat stat--b"><div class="num">${cats.filter(c => agents.some(a => a.category === c.id)).length}</div><div class="lbl">Stages of the QA workflow</div></div>
    <div class="stat stat--c"><div class="num">${toolkit}</div><div class="lbl">Drop-in reusable modules</div></div>
  </div>
  </div>
</section>

<section class="primer"><div class="wrap"><div class="primer__grid">
  <div>
    <div class="eyebrow">What "agent" means here</div>
    <h2 class="display">Scoped automation, not a chat assistant.</h2>
    <p>Each agent is a single-purpose CLI: typed inputs, typed outputs, one QA task. Most are deterministic automation over the ADO REST API, Playwright, or SQL. A few wrap an LLM (Gemini/Claude) only where judgment is unavoidable — parsing a transcript, grading an answer, drafting a repro from a bug. No agent framework, no chat loop, no shared state: it runs, writes its artifact, and exits 0 / non-zero — from a shell or a CI step.</p>
  </div>
  <div class="primer__figure">"One job, one contract — composable, scriptable, and boring by design."</div>
</div></div></section>

${sections}

<footer class="footer"><div class="wrap">Field Guide to Software QA Agents · a QA automation catalog · what each agent does, how it works, and how to run it.</div></footer>
</body></html>`;
}

// ── Render deck ────────────────────────────────────────────────────────────
function deckHtml(agents: AgentContent[], cats: Category[]): string {
  const slides: string[] = [];
  const S = (inner: string, extra = '') => slides.push(`<section class="slide" ${extra}><span class="slide__no">${String(slides.length + 1).padStart(2, '0')}</span><div class="slide__inner">${inner}</div><span class="slide__brand">FIELD GUIDE · SOFTWARE AGENTS</span></section>`);

  // Title
  S(`<div class="eyebrow">QA automation</div>
     <h1 class="display">${agents.length} single-purpose QA agents</h1>
     <p class="lead">One task each, a typed contract each — automating the repetitive parts of testing on the ADO REST API, Playwright, SQL, and an LLM where judgment is needed.</p>`);
  // The one idea
  S(`<div class="eyebrow">The model</div>
     <h2 class="display">Scoped automation, not a chat assistant.</h2>
     <p class="lead">Each agent is a single-purpose CLI: typed inputs, typed outputs, one QA task. No agent framework, no chat loop — it runs, writes its artifact, and exits.</p>`);

  for (const c of cats) {
    const members = agents.filter(a => a.category === c.id);
    if (!members.length) continue;
    // Category divider
    S(`<div class="eyebrow">${esc(c.no)} · QA workflow stage</div><h2 class="display">${esc(c.name)}</h2><p class="lead">${rich(c.desc)}</p>`);
    for (const a of members) {
      const ex = a.examples[0];
      S(`<div class="eyebrow">Agent ${String(a.plate).padStart(2, '0')} · ${esc(c.name)}</div>
         <h2 class="display">${esc(a.name)}</h2>
         <p class="lead">${rich(a.oneLiner)}</p>
         ${ex ? `<div class="beforeafter"><div class="ba ba--before"><div class="ba__label">Before</div><p>${rich(a.chore)}</p></div><div class="ba__arrow">→</div><div class="ba ba--after"><div class="ba__label">After</div><p>${rich(a.instead)}</p></div></div>` : ''}`);
    }
  }
  // Close
  S(`<div class="eyebrow">In one line</div><h2 class="display">${agents.length} QA tasks, each automated behind a typed contract — reproducible in CI, not re-done by hand every sprint.</h2>`);

  return `${HEAD('Slides — Field Guide to Software QA Agents', '')}
<body class="deck">
${slides.join('\n')}
<div class="hint">↓ / → to advance · press F for fullscreen</div>
<script>
  document.addEventListener('keydown', e => {
    const slides = [...document.querySelectorAll('.slide')];
    const h = window.innerHeight;
    const i = Math.round(window.scrollY / h);
    if (['ArrowDown','ArrowRight',' ','PageDown'].includes(e.key)) { e.preventDefault(); slides[Math.min(i+1, slides.length-1)]?.scrollIntoView(); }
    if (['ArrowUp','ArrowLeft','PageUp'].includes(e.key)) { e.preventDefault(); slides[Math.max(i-1,0)]?.scrollIntoView(); }
    if (e.key.toLowerCase() === 'f') { document.documentElement.requestFullscreen?.(); }
  });
</script>
</body></html>`;
}

// ── Build ──────────────────────────────────────────────────────────────────
function main(): void {
  const { agents, cats } = load();
  if (!agents.length) { console.log('No content yet in ./content — nothing to build.'); return; }
  fs.mkdirSync(OUT_AGENTS, { recursive: true });
  fs.writeFileSync(path.join(SITE, 'index.html'), indexHtml(agents, cats));
  fs.writeFileSync(path.join(SITE, 'deck.html'), deckHtml(agents, cats));
  for (let i = 0; i < agents.length; i++) {
    fs.writeFileSync(path.join(OUT_AGENTS, `${agents[i].slug}.html`), plateHtml(agents[i], cats, agents[i - 1], agents[i + 1]));
  }

  // Recording scripts are kept INTERNAL (off the public pages) — export them here.
  const withScripts = agents.filter(a => a.video && a.video.script && a.video.script.length);
  const scriptsMd = [
    '# Recording scripts — INTERNAL (not shown on the public agent pages)',
    '',
    'Shot-by-shot scripts for whoever films each agent\'s walkthrough video. Kept out of the shareable catalog pages on purpose; this file (regenerated by build-catalog.ts) is the internal home.',
    '',
    ...withScripts.map(a => {
      const cap = a.video!.caption ? `\n${a.video!.caption}\n` : '';
      const steps = a.video!.script!.map((l, i) => `${i + 1}. ${l}`).join('\n');
      return `---\n\n## ${a.name} — Agent ${String(a.plate).padStart(2, '0')}\n*Source: \`${a.techName}\` · page: \`agents/${a.slug}.html\`*\n${cap}\n${steps}\n`;
    }),
  ].join('\n');
  const internalDir = path.join(SITE, '_internal');
  fs.mkdirSync(internalDir, { recursive: true });
  fs.writeFileSync(path.join(internalDir, 'recording-scripts.md'), scriptsMd);

  console.log(`Built: index.html, deck.html, ${agents.length} agent page(s), _internal/recording-scripts.md (${withScripts.length} scripts)`);
  console.log(`Categories with members: ${cats.filter(c => agents.some(a => a.category === c.id)).map(c => c.id).join(', ')}`);
}
main();
