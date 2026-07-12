import * as XLSX from "npm:xlsx";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── System prompt template ──────────────────────────────────────────────────
// Template variables ({{…}}) are replaced with the calling university's config
// at request time. See docs/timetable-ai-system-prompt.md for the full spec.

const SYSTEM_PROMPT_TEMPLATE = `You are a professional university timetable assistant for {{university_name}}.
Your job is to parse **one class at a time** from an uploaded Excel timetable
and return a structured JSON object for that single class.

The caller will invoke you once per sheet / class detected in the workbook.
Each call gives you the CSV text of a single sheet and the target class name.

CONSTRAINTS:
- Valid class names: {{enabled_classes}}
- Valid period names: {{periods}}
- Valid working days: {{working_days}}
- Scheduling constraints:
  {{constraints}}
  If a slot in the parsed data conflicts with a constraint, include it in
  the "questions" array so the user can confirm or override — do NOT silently
  drop or overwrite the slot.

SLOT SCHEMA — each slot must have:
{ "class_name": "string", "day": "string", "period_name": "string", "course_name": "string", "faculty_name": "string" }

RESPONSE FORMAT:
Respond ONLY with a single valid JSON object. No text outside the JSON, no markdown, no code fences.

{
  "class_name": "the class this response is for",
  "message": "Your response to the user",
  "state": "chatting",
  "slots": [],
  "questions": []
}

- state "chatting": Still gathering or clarifying information. slots may be empty or partial.
  questions lists ambiguities or constraint violations needing user input.
- state "ready": All information for this class is confirmed. slots contains
  the final array for this single class.

MODES:

Upload mode: You receive extracted CSV text from a single Excel sheet. Parse it to
identify day, period_name, course_name, and faculty_name for each slot belonging to
{{class_name}}. Map column headers and row labels to the valid values listed above.
Flag ambiguities (unrecognised names, period formats, constraint violations) in the
questions array. Ask the user to clarify before setting state to "ready".

Build from scratch mode: Ask structured questions one at a time to gather:
(1) subjects for this class, (2) faculty per subject, (3) which periods and
days each subject is scheduled. Maintain a running internal state of confirmed
slots. When complete, set state to "ready" with the full slots array for this class.

Be professional, concise, and direct. No casual language.`;

// ── Helpers ─────────────────────────────────────────────────────────────────

interface UniversityConfig {
  universityName: string;
  enabledClasses: string[];
  periods: string[];
  workingDays: string[];
  constraints: Array<{ day: string; periodName: string; appliesTo: string[]; reason: string }>;
}

async function loadUniversityConfig(): Promise<UniversityConfig> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Try to load from university_setup_progress (latest completed setup)
  const { data: progress } = await supabase
    .from("university_setup_progress")
    .select("university_id, university_name, enabled_classes, working_days, constraints")
    .eq("is_setup_complete", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  const row = progress?.[0];

  let periods: string[] = [];
  if (row?.university_id) {
    const { data: periodRows } = await supabase
      .from("university_periods")
      .select("label")
      .eq("university_id", row.university_id)
      .order("period_order");
    if (periodRows?.length) {
      periods = periodRows.map((p: { label: string }) => p.label);
    }
  }

  // If no periods found in university_periods, fall back to timetable_periods
  if (!periods.length) {
    const { data: tpRows } = await supabase
      .from("timetable_periods")
      .select("name")
      .order("sort_order");
    if (tpRows?.length) {
      periods = [...new Set(tpRows.map((p: { name: string }) => p.name))];
    }
  }

  // Fallback defaults
  if (!periods.length) periods = ["M1", "M2", "P1", "P2", "P3", "P4"];

  return {
    universityName: row?.university_name || "your university",
    enabledClasses: row?.enabled_classes || [],
    periods,
    workingDays: row?.working_days || ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    constraints: row?.constraints || [],
  };
}

function buildSystemPrompt(config: UniversityConfig, className: string): string {
  const constraintsJson = config.constraints.length
    ? JSON.stringify(config.constraints, null, 2)
    : "(none)";

  return SYSTEM_PROMPT_TEMPLATE
    .replaceAll("{{university_name}}", config.universityName)
    .replaceAll("{{class_name}}", className)
    .replaceAll("{{enabled_classes}}", config.enabledClasses.join(", ") || "(not configured)")
    .replaceAll("{{periods}}", config.periods.join(", "))
    .replaceAll("{{working_days}}", config.workingDays.join(", "))
    .replaceAll("{{constraints}}", constraintsJson);
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { mode, messages, file_base64, file_name, class_name, sheet_csv } = await req.json() as {
      mode: string;
      messages: Array<{ role: string; content: string }>;
      file_base64?: string;
      file_name?: string;
      class_name?: string;   // Phase 1: per-class invocation
      sheet_csv?: string;    // Phase 1: pre-extracted CSV for one sheet
    };

    // ── Load university config ──────────────────────────────────────────
    const config = await loadUniversityConfig();

    // ── Debug: confirm inputs ───────────────────────────────────────────
    const debugInfo: Record<string, unknown> = {
      file_base64_received: !!file_base64,
      file_base64_length: file_base64?.length ?? 0,
      file_name,
      mode,
      class_name: class_name || "(all)",
      sheet_csv_length: sheet_csv?.length ?? 0,
      incoming_message_count: messages.length,
      last_message_role: messages[messages.length - 1]?.role ?? "none",
      university_name: config.universityName,
      enabled_classes_count: config.enabledClasses.length,
    };
    console.log("[parse-timetable] debug:", JSON.stringify(debugInfo));

    // ── Parse Excel file if provided (legacy path: full file) ───────────
    let extractedText = "";
    if (sheet_csv) {
      // Phase 1 path: client already split by sheet and sends CSV per class
      extractedText = sheet_csv;
    } else if (file_base64) {
      try {
        const workbook = XLSX.read(file_base64, { type: "base64" });
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          extractedText += `Sheet: ${sheetName}\n`;
          extractedText += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
        }
        debugInfo.xlsx_sheets = workbook.SheetNames;
        debugInfo.extracted_text_length = extractedText.length;
        console.log("[parse-timetable] xlsx extracted, sheets:", workbook.SheetNames);
      } catch (xlsxErr) {
        console.error("[parse-timetable] xlsx parse error:", xlsxErr);
        debugInfo.xlsx_error = String(xlsxErr);
        extractedText = "(Could not parse the file. It may not be a valid Excel file.)";
      }
    }

    // Build the system prompt with injected config
    const targetClass = class_name || "(detect from sheet)";
    const systemPrompt = buildSystemPrompt(config, targetClass);

    // Sanitize messages
    const sanitized: Array<{ role: string; content: string }> = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    // Inject extracted text
    const claudeMessages: Array<{ role: string; content: string }> = [];
    if (extractedText) {
      const filtered = sanitized.filter(
        (m) => !(m.role === "assistant" && m.content.startsWith("Analyzing your timetable file"))
      );
      const classHint = class_name ? `\nTarget class: ${class_name}` : "";
      filtered.push({
        role: "user",
        content: `File: ${file_name || "timetable.xlsx"}${classHint}\n\nExtracted content:\n${extractedText}\n\nPlease analyze this timetable data for ${class_name || "all classes"}, identify all slots, flag any ambiguities or constraint violations, and ask for clarification if needed.`,
      });
      claudeMessages.push(...filtered);
      debugInfo.injected_into_messages = true;
      console.log("[parse-timetable] injected file content for class:", class_name || "all");
    } else {
      claudeMessages.push(...sanitized);
      debugInfo.injected_into_messages = false;
    }
    debugInfo.claude_message_count = claudeMessages.length;

    // Call Claude
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${errText}`);
    }

    const anthropicData = await anthropicRes.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const rawText = anthropicData.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    // Extract JSON robustly
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    const cleaned = firstBrace !== -1 && lastBrace > firstBrace
      ? rawText.slice(firstBrace, lastBrace + 1)
      : rawText.trim();

    let parsed: {
      class_name?: string;
      message: string;
      state: string;
      slots: unknown[];
      questions?: unknown[];
      ambiguities?: unknown[];
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[parse-timetable] JSON.parse failed, rawText preview:", rawText.slice(0, 300));
      parsed = {
        class_name: class_name || undefined,
        message: "I encountered an error processing the response. Please try again.",
        state: "chatting",
        slots: [],
        questions: [],
      };
    }

    // ── Session storage for ready state ──────────────────────────────────
    if (parsed.state === "ready" && Array.isArray(parsed.slots) && parsed.slots.length > 0) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      const session_id = crypto.randomUUID();
      const class_names = [
        ...new Set((parsed.slots as Array<{ class_name: string }>).map((s) => s.class_name)),
      ].sort();
      const slot_count = parsed.slots.length;

      const { error: insertErr } = await supabase
        .from("timetable_assistant_sessions")
        .insert({ session_id, slots: parsed.slots, class_names, slot_count });

      if (insertErr) {
        console.error("[parse-timetable] session insert error:", insertErr.message);
        throw new Error(`Session storage failed: ${insertErr.message}`);
      }

      // Best-effort cleanup of old sessions
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      supabase.from("timetable_assistant_sessions").delete().lt("created_at", cutoff).then(() => {});

      debugInfo.session_id = session_id;
      debugInfo.slot_count = slot_count;
      debugInfo.class_names = class_names;

      return new Response(
        JSON.stringify({
          class_name: parsed.class_name || class_name,
          message: parsed.message,
          state: "ready",
          session_id,
          slot_count,
          class_names,
          questions: parsed.questions || parsed.ambiguities || [],
          _debug: debugInfo,
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Chatting state
    return new Response(
      JSON.stringify({
        class_name: parsed.class_name || class_name,
        message: parsed.message,
        state: parsed.state,
        slots: parsed.slots || [],
        questions: parsed.questions || parsed.ambiguities || [],
        _debug: debugInfo,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        message: "Something went wrong. Please try again.",
        state: "chatting",
        slots: [],
        questions: [],
        _error: message,
      }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
