// Supabase Edge Function — generate-docx
// Builds an NFA or Activity Report .docx from a DB row and returns it as base64.
// Deploy: npx supabase functions deploy generate-docx

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "npm:docx@8";

// ── CORS ─────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Christ logo (embedded as base64 so it survives Supabase bundling) ────────

const CHRIST_LOGO_B64 =
  "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";

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Shared border styles ──────────────────────────────────────────────────────

const BORDERS: TableBorders = {
  top:              { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom:           { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left:             { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right:            { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};

const NO_BORDERS: TableBorders = {
  top:              { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom:           { style: BorderStyle.NONE, size: 0, color: "auto" },
  left:             { style: BorderStyle.NONE, size: 0, color: "auto" },
  right:            { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideVertical:   { style: BorderStyle.NONE, size: 0, color: "auto" },
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function p(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    align?: typeof AlignmentType[keyof typeof AlignmentType];
    spaceAfter?: number;
    italic?: boolean;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: opts.spaceAfter != null ? { after: opts.spaceAfter } : { after: 80 },
    children: [
      new TextRun({
        text,
        bold: opts.bold ?? false,
        italics: opts.italic ?? false,
        size: opts.size ?? 24,
        font: "Times New Roman",
      }),
    ],
  });
}

function blank(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "" })] });
}

function bullet(text: string, bold = false): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: "•  " + text, bold, size: 24, font: "Times New Roman" })],
    indent: { left: 360 },
  });
}

function labelRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        children: [new Paragraph({ spacing: { after: 60, before: 60 }, children: [new TextRun({ text: label, bold: true, size: 24, font: "Times New Roman" })] })],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        children: [new Paragraph({ spacing: { after: 60, before: 60 }, children: [new TextRun({ text: value || "", size: 24, font: "Times New Roman" })] })],
      }),
    ],
  });
}

function multilineLabelRow(label: string, value: string): TableRow {
  const lines = (value || "").split("\n").filter(Boolean);
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        children: [new Paragraph({ spacing: { after: 60, before: 60 }, children: [new TextRun({ text: label, bold: true, size: 24, font: "Times New Roman" })] })],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        children: lines.length > 0
          ? lines.map((line, i) => new Paragraph({ spacing: { after: i < lines.length - 1 ? 60 : 60, before: i === 0 ? 60 : 0 }, children: [new TextRun({ text: line, size: 24, font: "Times New Roman" })] }))
          : [new Paragraph({ spacing: { after: 60, before: 60 }, children: [new TextRun({ text: "", size: 24 })] })],
      }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return p(text, { bold: true, size: 28, spaceAfter: 100 });
}

function table2col(rows: [string, string][], multiline = false): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDERS,
    rows: rows.map(([label, value]) =>
      multiline ? multilineLabelRow(label, value) : labelRow(label, value)
    ),
  });
}

function toBase64(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer ?? buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ── Activity Report ───────────────────────────────────────────────────────────

function buildActivityReport(d: Record<string, string>): Document {
  const children = [
    p("CHRIST (Deemed to be University), Bangalore", { bold: true, size: 28, align: AlignmentType.CENTER }),
    p("Department of Professional Studies", { bold: true, size: 28, align: AlignmentType.CENTER }),
    blank(),
    p("Activity Report", { bold: true, size: 36, align: AlignmentType.CENTER, spaceAfter: 160 }),

    sectionHeading("General Information"),
    table2col([
      ["Type of Activity",       d.type_of_activity || ""],
      ["Title of the Activity",  d.title_of_activity || ""],
      ["Date/s",                 d.activity_date || ""],
      ["Time",                   d.activity_time || ""],
      ["Venue",                  d.venue || ""],
    ]),
    blank(),

    sectionHeading("Speaker/Guest/Presenter Details"),
    table2col([
      ["Name",                  d.speaker_names || ""],
      ["Title/Position",        d.speaker_titles || ""],
      ["Organization",          d.speaker_org || ""],
      ["Title of Presentation", d.presentation_title || ""],
    ]),
    blank(),

    sectionHeading("Participant's profile"),
    table2col([
      ["Type of Participants", d.participant_type || ""],
      ["No. of Participants",  d.participant_count || ""],
    ]),
    blank(),

    sectionHeading("Synopsis of the Activity (Description)"),
    table2col([
      ["Highlights of the Activity", d.highlights || ""],
      ["Key Takeaways",              d.key_takeaways || ""],
      ["Summary of the Activity",    d.summary || ""],
    ], true),
    blank(),

    p("Report prepared by:", { bold: false, size: 24 }),
    table2col([
      ["Name of the Organiser",        d.organiser_name || ""],
      ["Designation/Title",            d.organiser_designation || ""],
      ["Event Coordinators Signature", ""],
    ]),
    blank(),

    p("Annexure:", { bold: true, size: 24 }),
    p("Photos of the activity", { size: 24, spaceAfter: 200 }),
    blank(),

    p("ATR (Action Taken Report)", { bold: true, size: 24 }),
    p(d.atr || "", { size: 24, spaceAfter: 200 }),
    blank(),

    p("HOD Signature Seal.", { size: 24 }),
  ];

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
}

// ── NFA (legacy plain text, kept for type:'nfa') ──────────────────────────────

function buildNFA(d: Record<string, unknown>): Document {
  const parseList = (v: unknown): string[] =>
    typeof v === "string" ? v.split("\n").filter(Boolean) : [];

  const objectives = parseList(d.objectives);
  const outcomes   = parseList(d.expected_outcomes);
  const takeaways  = parseList(d.key_takeaways);

  interface BudgetItem { particular: string; amount: string | number; }
  const budgetItems: BudgetItem[] = Array.isArray(d.budget_items) ? d.budget_items as BudgetItem[] : [];
  const total = budgetItems.reduce((sum, b) => sum + (parseFloat(String(b.amount)) || 0), 0);

  const budgetRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "S.No", bold: true, size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Particulars", bold: true, size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Amount(Rs)", bold: true, size: 24, font: "Times New Roman" })] })] }),
      ],
    }),
    ...budgetItems.map((item, idx) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.particular || "", size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(item.amount || ""), size: 24, font: "Times New Roman" })] })] }),
      ],
    })),
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 24 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL AMOUNT", bold: true, size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(total), size: 24, font: "Times New Roman" })] })] }),
      ],
    }),
  ];

  const clubName = String(d.club_name || d.organised_by || "");

  const children = [
    p("School of Commerce, Finance and Accountancy", { bold: true, size: 28, align: AlignmentType.CENTER }),
    p("Bangalore Yeshwanthpur Campus", { bold: true, size: 28, align: AlignmentType.CENTER }),
    blank(),
    p("Note for Approval", { bold: true, size: 32, align: AlignmentType.CENTER, spaceAfter: 160 }),
    p("Ref. No. _______________                    Date: _______________", { bold: true, size: 24 }),
    blank(),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "ABSTRACT: ", bold: true, size: 24, font: "Times New Roman" }), new TextRun({ text: String(d.abstract || ""), bold: true, size: 24, font: "Times New Roman" })] }),
    blank(),
    p("Programme/Event/Activity Objective", { bold: true, size: 24, spaceAfter: 60 }),
    ...objectives.map(o => bullet(o)),
    blank(),
    p("Expected Programme/Event/Activity Outcomes", { bold: true, size: 24, spaceAfter: 60 }),
    ...outcomes.map(o => bullet(o)),
    blank(),
    p("Program is mapped with (kindly tick whichever is applicable)", { bold: true, size: 24 }),
    blank(),
    p("Strategic Action Plan:", { bold: true, size: 24, spaceAfter: 40 }),
    p("☐  Focus area 1  Transformational Teaching-learning for Global Competence:", { size: 24 }),
    p("☐  Focus area 2  Impactful Research, Innovation and Enterprise:", { size: 24 }),
    p("☐  Focus area 3  Positive Organizational Culture for Gainful Campus Life:", { size: 24 }),
    p("☐  Focus area 4  Meaningful Societal Engagement:", { size: 24, spaceAfter: 120 }),
    p("NAAC Criteria:", { bold: true, size: 24, spaceAfter: 40 }),
    p("☐  a) Curriculum Design and Development:", { size: 24 }),
    p("☐  b) Teaching-Learning:", { size: 24 }),
    p("☐  c) Research and Innovation:", { size: 24 }),
    p("☐  d) Consultancy, Extension and Collaboration:", { size: 24 }),
    p("☐  e) Student Support and Progression:", { size: 24 }),
    p("☐  f) Quality Initiatives:", { size: 24, spaceAfter: 160 }),
    p("DETAILS:", { bold: true, size: 24, spaceAfter: 80 }),
    p("Title of the Session: " + String(d.title_of_session || ""), { bold: true, size: 24 }),
    p("Resource Person: " + String(d.resource_person || "NIL"), { bold: true, size: 24 }),
    p("Target audience: " + String(d.target_audience || "NIL"), { bold: true, size: 24 }),
    p("Stakeholders Count: " + String(d.stakeholders_count || "NIL"), { bold: true, size: 24 }),
    p("Date : " + String(d.event_date || "NIL"), { bold: true, size: 24 }),
    p("Time : " + String(d.event_time || "NIL"), { bold: true, size: 24 }),
    p("Mode : " + String(d.mode || "Offline"), { bold: true, size: 24 }),
    p("Link : " + String(d.link || "NA"), { bold: true, size: 24 }),
    p("Venue : " + String(d.venue || "NIL"), { bold: true, size: 24 }),
    p("Organised by : " + String(d.organised_by || clubName || "NIL"), { bold: true, size: 24, spaceAfter: 80 }),
    p("Key Takeaways for participants:", { bold: true, size: 24, spaceAfter: 60 }),
    ...takeaways.map(t => bullet(t)),
    blank(),
    p("Tentative Budget", { bold: true, size: 24, spaceAfter: 80 }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDERS, rows: budgetRows }),
    blank(),
    p("Submitted for kind approval", { bold: true, size: 24, spaceAfter: 320 }),
    p("Event Coordinator                         HOD & Associate Dean                    Dean", { size: 22 }),
    blank(),
    blank(),
    p("Campus Administrator                                                     Campus Director", { size: 22 }),
  ];

  return new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });
}

// ── NFA with logo + full Emersio template (type: 'nfa_docx') ─────────────────

async function buildNFADocx(d: Record<string, unknown>): Promise<Document> {
  // Logo — embedded at build time so Supabase bundling can't drop it
  let logoData: Uint8Array | null = null;
  try {
    logoData = b64ToBytes(CHRIST_LOGO_B64);
    console.log(`[generate-docx] logo loaded, bytes: ${logoData.length}`);
  } catch (e) {
    console.error("[generate-docx] logo decode failed:", e);
  }

  const parseList = (v: unknown): string[] =>
    typeof v === "string" ? v.split("\n").filter(Boolean) : [];

  const objectives = parseList(d.objectives);
  const outcomes   = parseList(d.expected_outcomes);
  const takeaways  = parseList(d.key_takeaways);

  interface BudgetItem { particular: string; amount: string | number; }
  const budgetItems: BudgetItem[] = Array.isArray(d.budget_items) ? d.budget_items as BudgetItem[] : [];
  const total = budgetItems.reduce((sum, b) => sum + (parseFloat(String(b.amount)) || 0), 0);

  const clubName = String(d.club_name || d.organised_by || "");

  // ── No-border cell helper for layout tables ──────────────────────────────
  function noBorderCell(widthPct: number, children: Paragraph[]): TableCell {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      borders: {
        top:    { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left:   { style: BorderStyle.NONE, size: 0, color: "auto" },
        right:  { style: BorderStyle.NONE, size: 0, color: "auto" },
      },
      children,
    });
  }

  // ── Header: logo (left) + institution name (right) ──────────────────────
  const logoChildren: Paragraph[] = logoData
    ? [new Paragraph({ spacing: { after: 0 }, children: [new ImageRun({ data: logoData, transformation: { width: 80, height: 80 }, type: "png" })] })]
    : [new Paragraph({ children: [] })];

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [
        noBorderCell(15, logoChildren),
        noBorderCell(85, [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 40 },
            children: [new TextRun({ text: "School of Commerce, Finance and Accountancy", bold: true, size: 26, font: "Times New Roman" })],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 0 },
            children: [new TextRun({ text: "Bangalore Yeshwanthpur Campus", bold: true, size: 24, font: "Times New Roman" })],
          }),
        ]),
      ],
    })],
  });

  // ── Horizontal divider ───────────────────────────────────────────────────
  const divider = new Paragraph({
    spacing: { before: 140, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" } },
    children: [],
  });

  // ── Underlined title ─────────────────────────────────────────────────────
  const titlePara = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({
      text: "Note for Approval",
      bold: true,
      underline: { type: UnderlineType.SINGLE },
      size: 32,
      font: "Times New Roman",
    })],
  });

  // ── Budget table ─────────────────────────────────────────────────────────
  const budgetRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "S.No", bold: true, size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Particulars", bold: true, size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: "Amount (Rs)", bold: true, size: 24, font: "Times New Roman" })] })] }),
      ],
    }),
    ...budgetItems.map((item, idx) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item.particular || "", size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(item.amount || ""), size: 24, font: "Times New Roman" })] })] }),
      ],
    })),
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 24 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TOTAL AMOUNT", bold: true, size: 24, font: "Times New Roman" })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: total > 0 ? String(total) : "", size: 24, font: "Times New Roman" })] })] }),
      ],
    }),
  ];

  // ── Signature cell helpers ────────────────────────────────────────────────
  // Top border acts as the signature line; blank name row + bold title below
  function sigCell(roleTitle: string, widthPct: number): TableCell {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        bottom: { style: BorderStyle.NONE,   size: 0, color: "auto"   },
        left:   { style: BorderStyle.NONE,   size: 0, color: "auto"   },
        right:  { style: BorderStyle.NONE,   size: 0, color: "auto"   },
      },
      children: [
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "", size: 24 })] }),
        new Paragraph({ spacing: { after: 0  }, children: [new TextRun({ text: roleTitle, bold: true, size: 22, font: "Times New Roman" })] }),
      ],
    });
  }

  function gapCell(widthPct: number): TableCell {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: {
        top:    { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left:   { style: BorderStyle.NONE, size: 0, color: "auto" },
        right:  { style: BorderStyle.NONE, size: 0, color: "auto" },
      },
      children: [new Paragraph({ children: [] })],
    });
  }

  // Row 1: Event Coordinator | HOD & Associate Dean | Dean
  const sigTable1 = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [
        sigCell("Event Coordinator", 30),
        gapCell(5),
        sigCell("HOD & Associate Dean", 30),
        gapCell(5),
        sigCell("Dean", 30),
      ],
    })],
  });

  // Row 2: Campus Administrator | Campus Director
  const sigTable2 = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [new TableRow({
      children: [
        sigCell("Campus Administrator", 44),
        gapCell(12),
        sigCell("Campus Director", 44),
      ],
    })],
  });

  // ── Assemble document ────────────────────────────────────────────────────
  const children = [
    headerTable,
    divider,
    titlePara,

    p("Ref. No. _______________                    Date: _______________", { bold: true, size: 24 }),
    blank(),

    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "ABSTRACT: ", bold: true, size: 24, font: "Times New Roman" }),
        new TextRun({ text: String(d.abstract || ""), bold: true, size: 24, font: "Times New Roman" }),
      ],
    }),
    blank(),

    p("Programme/Event/Activity Objective", { bold: true, size: 24, spaceAfter: 60 }),
    ...(objectives.length ? objectives.map(o => bullet(o)) : [bullet("")]),
    blank(),

    p("Expected Programme/Event/Activity Outcomes", { bold: true, size: 24, spaceAfter: 60 }),
    ...(outcomes.length ? outcomes.map(o => bullet(o)) : [bullet("")]),
    blank(),

    p("Program is mapped with (kindly tick whichever is applicable)", { bold: true, size: 24 }),
    blank(),
    p("Strategic Action Plan:", { bold: true, size: 24, spaceAfter: 40 }),
    p("☐  Focus area 1  Transformational Teaching-learning for Global Competence:", { size: 24 }),
    p("☐  Focus area 2  Impactful Research, Innovation and Enterprise:", { size: 24 }),
    p("☐  Focus area 3  Positive Organizational Culture for Gainful Campus Life:", { size: 24 }),
    p("☐  Focus area 4  Meaningful Societal Engagement:", { size: 24, spaceAfter: 120 }),

    p("NAAC Criteria:", { bold: true, size: 24, spaceAfter: 40 }),
    p("☐  a) Curriculum Design and Development:", { size: 24 }),
    p("☐  b) Teaching-Learning:", { size: 24 }),
    p("☐  c) Research and Innovation:", { size: 24 }),
    p("☐  d) Consultancy, Extension and Collaboration:", { size: 24 }),
    p("☐  e) Student Support and Progression:", { size: 24 }),
    p("☐  f) Quality Initiatives:", { size: 24, spaceAfter: 160 }),

    p("DETAILS:", { bold: true, size: 24, spaceAfter: 80 }),
    table2col([
      ["Title of the Session",  String(d.title_of_session  || "")],
      ["Resource Person",       String(d.resource_person   || "NIL")],
      ["Target Audience",       String(d.target_audience   || "NIL")],
      ["Stakeholders Count",    String(d.stakeholders_count|| "NIL")],
      ["Date",                  String(d.event_date        || "NIL")],
      ["Time",                  String(d.event_time        || "NIL")],
      ["Mode",                  String(d.mode              || "Offline")],
      ["Link",                  String(d.link              || "NA")],
      ["Venue",                 String(d.venue             || "NIL")],
      ["Organised By",          String(d.organised_by || clubName || "NIL")],
    ]),
    blank(),

    p("Key Takeaways for participants:", { bold: true, size: 24, spaceAfter: 60 }),
    ...(takeaways.length ? takeaways.map(t => bullet(t)) : [bullet("")]),
    blank(),

    p("Tentative Budget", { bold: true, size: 24, spaceAfter: 80 }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDERS, rows: budgetRows }),
    blank(),

    p("Submitted for kind approval", { bold: true, size: 24, spaceAfter: 600 }),

    sigTable1,
    new Paragraph({ spacing: { before: 400, after: 400 }, children: [] }),
    sigTable2,
  ];

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { type, id } = await req.json() as { type: string; id: string };

    if (!type || !id) {
      return new Response(JSON.stringify({ error: "type and id are required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let doc: Document;
    let filename: string;

    if (type === "nfa") {
      // Legacy plain-text NFA (kept for backward compat)
      const { data, error } = await supabase.from("nfa_requests").select("*").eq("id", id).single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "NFA not found" }), {
          status: 404, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      doc = buildNFA(data as Record<string, unknown>);
      const title = String(data.title_of_session || "NFA").replace(/[^a-zA-Z0-9_\-]/g, "_");
      filename = `NFA_${title}.docx`;

    } else if (type === "nfa_docx") {
      // Full Emersio template with logo, table layout, signature block
      const { data, error } = await supabase.from("nfa_requests").select("*").eq("id", id).single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "NFA not found" }), {
          status: 404, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      doc = await buildNFADocx(data as Record<string, unknown>);
      const title = String(data.title_of_session || "NFA").replace(/[^a-zA-Z0-9_\-]/g, "_");
      const date  = String(data.event_date || "").replace(/[^a-zA-Z0-9_\-]/g, "_") ||
                    new Date().toISOString().slice(0, 10);
      filename = `NFA_${title}_${date}.docx`;

    } else if (type === "activity_report") {
      const { data, error } = await supabase.from("activity_reports").select("*").eq("id", id).single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Activity report not found" }), {
          status: 404, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      doc = buildActivityReport(data as Record<string, string>);
      const title = String(data.title_of_activity || "Activity_Report").replace(/[^a-zA-Z0-9_\-]/g, "_");
      filename = `ActivityReport_${title}.docx`;

    } else {
      return new Response(JSON.stringify({ error: "Unknown type. Use 'nfa_docx', 'nfa', or 'activity_report'" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const buffer = await Packer.toBuffer(doc);
    const base64 = toBase64(buffer);

    return new Response(
      JSON.stringify({ base64, filename }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
