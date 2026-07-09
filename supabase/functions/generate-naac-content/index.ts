// Supabase Edge Function — generate-naac-content
// Calls Anthropic API to generate NAAC SSR content for a given metric.
// Requires ANTHROPIC_API_KEY set as a Supabase secret:
//   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Deploy: npx supabase functions deploy generate-naac-content

import { checkRateLimit, getClientIp, rateLimitResponse } from "../_shared/rateLimit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Higher limit than the default 10 — NAAC work is iterative and needs headroom.
const NAAC_LIMIT = 20;

const SYSTEM_PROMPT =
  `You are a NAAC accreditation documentation expert for an Indian autonomous university. ` +
  `Your task is to generate concise, formal content for the National Assessment and Accreditation ` +
  `Council (NAAC) Self-Study Report (SSR). Always write in formal, third-person institutional voice. ` +
  `Be specific, factual, and use language appropriate for academic accreditation documents. ` +
  `Return only the requested paragraph text — no headings, no markdown, no preamble.`;

interface RequestBody {
  // accept both field names for forward/backward compat
  metric_id?: string;
  metric?: string;
  metric_title?: string;
  // structured or flat notes
  input_data?: Record<string, unknown>;
  notes?: string;
  metric_type?: "yearly_table" | "narrative" | "simple_numbers" | "teacher_list" | string;
  // optional context — ignored by prompt but accepted without error
  university_id?: string;
  criterion?: number;
}

function buildPrompt(
  metricId: string,
  metricTitle: string,
  notes: string,
  inputData: Record<string, unknown>,
  metricType: string,
): string {
  // Use structured inputData if it has more than just notes, otherwise fall back to the notes string.
  const hasStructuredData = Object.keys(inputData).some((k) => k !== "notes");
  const dataBlock = hasStructuredData
    ? JSON.stringify(inputData, null, 2)
    : notes || "(No data provided — generate a general placeholder paragraph.)";

  const header = `Metric ${metricId} — ${metricTitle}`;

  switch (metricType) {
    case "yearly_table":
      return `Generate formal NAAC SSR content for: ${header}

Year-wise data:
${dataBlock}

Write a concise data-driven paragraph (150–250 words) that presents the year-wise trend, highlights key figures, and contextualises the data in terms of institutional performance. Include specific numbers from the data. Third-person institutional voice.`;

    case "simple_numbers":
      return `Generate formal NAAC SSR content for: ${header}

Numeric data:
${dataBlock}

First compute any relevant ratio or percentage. Then write a concise paragraph (80–120 words) presenting the figure(s) and contextualising their significance for the institution's NAAC assessment. Be precise and factual.`;

    case "teacher_list":
      return `Generate formal NAAC SSR content for: ${header}

Faculty data:
${dataBlock}

Write a formal paragraph (150–200 words) summarising the faculty profile — qualifications, experience, and any notable strengths visible in the data. Highlight doctoral qualification counts or percentages if present. Third-person institutional voice.`;

    case "narrative":
    default:
      return `Generate formal NAAC SSR content for: ${header}

Notes and descriptions:
${dataBlock}

Write a formal, well-structured paragraph (150–250 words) based on the above. The paragraph should read as a polished SSR narrative entry — factual, specific, and suitable for submission to NAAC evaluators. Third-person institutional voice.`;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip, NAAC_LIMIT).allowed) return rateLimitResponse(CORS);

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured in Supabase secrets" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json() as RequestBody;

    // Accept either field name for the metric identifier.
    const metricId = body.metric_id ?? body.metric ?? "";
    const metricTitle = body.metric_title ?? "";

    if (!metricId || !metricTitle) {
      return new Response(
        JSON.stringify({ error: "metric_id (or metric) and metric_title are required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Flatten notes: prefer input_data.notes, fall back to top-level notes field.
    const inputData: Record<string, unknown> = body.input_data ?? {};
    const notes =
      (typeof inputData.notes === "string" ? inputData.notes : "") ||
      (typeof body.notes === "string" ? body.notes : "");

    const metricType = body.metric_type ?? "narrative";

    const userPrompt = buildPrompt(metricId, metricTitle, notes, inputData, metricType);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
    }

    const anthropicData = await resp.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const content = anthropicData.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    return new Response(JSON.stringify({ content }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
