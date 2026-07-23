/**
 * generate-docx.js — render a résumé into a styled Word document.
 *
 * This is a generic, reusable example (see the "A résumé-builder agent" guide).
 * Edit the RESUME object below (or wire it up to read your resume.md), then run:
 *
 *   npm install
 *   node generate-docx.js      ->  writes ./resume.docx
 *
 * No personal data ships here — everything below is a placeholder.
 */
const docx = require("docx");
const fs = require("fs");

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel, ExternalHyperlink,
} = docx;

// ─── Theme ───────────────────────────────────────────────────────────────
const ACCENT = "007B7F";       // section headings + name (swap for your brand)
const DARK = "1a1a1a";
const GRAY = "555555";
const LINK = "0563C1";
const HEADER_BG = ACCENT;
const ALT_BG = "F2F9F9";

// ─── Your content (PLACEHOLDERS — replace with your own) ─────────────────
const RESUME = {
  name: "Your Name",
  title: "Your Professional Title",
  contact: {
    email: "you@example.com",
    phone: "000-000-0000",
    location: "City, ST",
    linkedin: "https://www.linkedin.com/in/your-handle/",
  },
  summary:
    "One tight paragraph: who you are, years of experience, the kind of work you do, " +
    "and 2–3 signature strengths. Mirror the language of the roles you target. Keep it truthful.",
  highlights: [
    "Led **a flagship initiative** that delivered a measurable outcome (state the number).",
    "Built **a system or process** that reduced cost/time/risk by **X%**.",
    "Introduced **a practice or tool** adopted across a team of **N** people.",
    "Owned **an end-to-end deliverable** from design through production.",
    "Mentored **N engineers** / drove **a cross-functional result**.",
  ],
  skills: [
    ["Category", "Technologies"],
    ["Languages / Frameworks", "List your primary languages and frameworks"],
    ["Tools", "The tools you use day to day"],
    ["APIs & Services", "REST, GraphQL, the platforms you integrate with"],
    ["DevOps / CI-CD", "Your pipelines, containers, version control"],
    ["Cloud / Platforms", "The clouds and platforms you work on"],
  ],
  experience: [
    {
      company: "Most Recent Company — Location",
      role: "Your Role",
      dates: "20XX – Present",
      bullets: [
        "Start each bullet with a strong action verb and quantify the impact.",
        "Emphasize the work most relevant to the role you are targeting.",
        "Keep each bullet to 1–2 lines.",
      ],
    },
    {
      company: "Previous Company — Location",
      role: "Your Role",
      dates: "20XX – 20XX",
      bullets: [
        "Another measurable achievement, framed as outcome → impact.",
        "A scope or scale detail (team size, throughput, users, revenue).",
      ],
    },
  ],
  education: [
    "Degree, Field — University (Year)",
    "Relevant Certification — Issuer (Year)",
  ],
};

// ─── Rendering helpers ───────────────────────────────────────────────────
const thin = (color = "CCCCCC") => ({ style: BorderStyle.SINGLE, size: 1, color });
const tableBorders = {
  top: thin(), bottom: thin(), left: thin(), right: thin(),
  insideHorizontal: thin(), insideVertical: thin(),
};

const run = (text, opts = {}) => new TextRun({ text, font: "Calibri", size: 21, color: DARK, ...opts });
const boldRun = (text, opts = {}) => run(text, { bold: true, ...opts });

function heading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: ACCENT } },
    children: [new TextRun({ text, bold: true, color: ACCENT, size: 26, font: "Calibri" })],
  });
}

// split "plain **bold** plain" into styled runs
function segments(text) {
  const parts = String(text).split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 0 ? (p ? run(p) : null) : boldRun(p))).filter(Boolean);
}

const bullet = (text) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: segments(text) });

function skillsTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: rows.map((row, idx) => new TableRow({
      children: row.map((cell, c) => new TableCell({
        width: { size: c === 0 ? 28 : 72, type: WidthType.PERCENTAGE },
        shading: { fill: idx === 0 ? HEADER_BG : idx % 2 === 0 ? ALT_BG : "FFFFFF" },
        children: [new Paragraph({
          spacing: { before: 40, after: 40 }, indent: { left: 80 },
          children: [run(cell, { bold: c === 0, color: idx === 0 ? "FFFFFF" : DARK, size: 20 })],
        })],
      })),
    })),
  });
}

// ─── Build the document ──────────────────────────────────────────────────
const children = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [new TextRun({ text: RESUME.name, bold: true, color: ACCENT, size: 36, font: "Calibri" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [run(RESUME.title, { size: 24, color: GRAY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
    run(RESUME.contact.email, { size: 20 }), run("  |  ", { size: 20, color: GRAY }),
    run(RESUME.contact.phone, { size: 20 }), run("  |  ", { size: 20, color: GRAY }),
    run(RESUME.contact.location, { size: 20 }), run("  |  ", { size: 20, color: GRAY }),
    new ExternalHyperlink({ link: RESUME.contact.linkedin,
      children: [run("LinkedIn", { size: 20, color: LINK, underline: { type: "single" } })] }),
  ] }),

  heading("SUMMARY"),
  new Paragraph({ spacing: { after: 120 }, children: [run(RESUME.summary)] }),

  heading("SELECTED HIGHLIGHTS"),
  ...RESUME.highlights.map(bullet),

  heading("CORE SKILLS"),
  skillsTable(RESUME.skills),
  new Paragraph({ spacing: { after: 120 }, children: [] }),

  heading("PROFESSIONAL EXPERIENCE"),
  ...RESUME.experience.flatMap((job) => [
    new Paragraph({ spacing: { before: 120, after: 20 }, children: [boldRun(job.company, { size: 24, color: ACCENT })] }),
    new Paragraph({ spacing: { after: 20 }, children: [
      boldRun(job.role, { size: 22 }), run("   " + job.dates, { size: 20, color: GRAY }),
    ] }),
    ...job.bullets.map(bullet),
  ]),

  heading("EDUCATION & CERTIFICATIONS"),
  ...RESUME.education.map(bullet),
];

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 22, color: DARK } } } },
  sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children }],
});

Packer.toBuffer(doc).then((buffer) => {
  const out = "./resume.docx";
  fs.writeFileSync(out, buffer);
  console.log("Wrote " + out + " (" + buffer.length + " bytes)");
});
