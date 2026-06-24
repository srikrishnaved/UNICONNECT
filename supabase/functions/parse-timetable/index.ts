import * as XLSX from "npm:xlsx";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_CLASSES = [
  "1BcomIBA", "1BcomF&A", "1BcomIAF",
  "3BcomIBA", "3BcomF&A(A)", "3BcomF&A(B)", "3BcomIAF",
  "5BcomF&A(A)", "5BcomF&A(B)", "5BcomIAF",
  "7BcomF&A",
];

const SYSTEM_PROMPT = `You are a professional university timetable assistant. Your role is to help build or parse class timetables.

CONSTRAINTS:
- Valid class names: ${VALID_CLASSES.join(", ")}
- Valid period names: M1, M2, P1, P2, P3, P4
- Valid days: MON, TUE, WED, THU, FRI, SAT
- TUE P2 is reserved for HED (Higher Education Department) for 1st and 3rd semester classes (1Bcom* and 3Bcom* prefixes). Flag any conflicts with this constraint.

SLOT SCHEMA — each slot must have:
{ "class_name": "string", "day": "string", "period_name": "string", "course_name": "string", "faculty_name": "string" }

RESPONSE FORMAT:
Respond ONLY with a single valid JSON object. No text outside the JSON, no markdown, no code fences.

{
  "message": "Your response to the user",
  "state": "chatting",
  "slots": [],
  "ambiguities": []
}

- state "chatting": Still gathering or clarifying information. slots may be empty or partial.
- state "ready": All information is confirmed. slots contains the complete final array.

MODES:

Upload mode: You will receive extracted CSV/text from an Excel timetable file. Parse it to identify class_name, day, period_name, course_name, faculty_name for each slot. Map column headers and row labels to valid values. Flag ambiguities (unrecognized class names, period formats, faculty names, HED conflicts). Ask the user to clarify each ambiguity before setting state to "ready".

Build from scratch mode: Ask structured questions one at a time to gather: (1) class names, (2) subjects per class, (3) faculty per subject, (4) which periods and days each subject is scheduled. Maintain a running internal state of confirmed slots. When you have a complete picture, summarize it and set state to "ready" with the full slots array.

Be professional, concise, and direct. No casual language.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { mode, messages, file_base64, file_name } = await req.json() as {
      mode: string;
      messages: Array<{ role: string; content: string }>;
      file_base64?: string;
      file_name?: string;
    };

    // ── Debug: confirm file receipt
    const debugInfo: Record<string, unknown> = {
      file_base64_received: !!file_base64,
      file_base64_length: file_base64?.length ?? 0,
      file_name,
      mode,
      incoming_message_count: messages.length,
      last_message_role: messages[messages.length - 1]?.role ?? "none",
    };
    console.log("[parse-timetable] debug:", JSON.stringify(debugInfo));

    // Parse Excel file if provided
    let extractedText = "";
    if (file_base64) {
      try {
        const workbook = XLSX.read(file_base64, { type: "base64" });
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          extractedText += `Sheet: ${sheetName}\n`;
          extractedText += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
        }
        debugInfo.xlsx_sheets = workbook.SheetNames;
        debugInfo.extracted_text_length = extractedText.length;
        debugInfo.extracted_text_preview = extractedText.slice(0, 500);
        console.log("[parse-timetable] xlsx extracted, preview:", extractedText.slice(0, 500));
      } catch (xlsxErr) {
        console.error("[parse-timetable] xlsx parse error:", xlsxErr);
        debugInfo.xlsx_error = String(xlsxErr);
        extractedText = "(Could not parse the file. It may not be a valid Excel file.)";
      }
    }

    // Sanitize messages: Anthropic API only accepts { role, content } — strip any extra
    // client-side fields (type, session, etc.) that come from preview messages.
    const sanitized: Array<{ role: string; content: string }> = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    // Inject extracted text — always append as a new user message so it's never skipped
    // regardless of what role the last message in history has.
    const claudeMessages: Array<{ role: string; content: string }> = [];
    if (extractedText) {
      // Remove any trailing assistant-only "Analyzing..." placeholder the client appended.
      const filtered = sanitized.filter(
        (m) => !(m.role === "assistant" && m.content.startsWith("Analyzing your timetable file"))
      );
      filtered.push({
        role: "user",
        content: `File: ${file_name || "timetable.xlsx"}\n\nExtracted content:\n${extractedText}\n\nPlease analyze this timetable data, identify all slots, flag any ambiguities, and ask for clarification if needed.`,
      });
      claudeMessages.push(...filtered);
      debugInfo.injected_into_messages = true;
      console.log("[parse-timetable] injected file content into messages as new user turn");
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
        system: SYSTEM_PROMPT,
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

    // Extract the JSON object robustly: find outermost { ... } so preambles,
    // code fences, or trailing text don't cause JSON.parse to fail.
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    const cleaned = firstBrace !== -1 && lastBrace > firstBrace
      ? rawText.slice(firstBrace, lastBrace + 1)
      : rawText.trim();

    let parsed: { message: string; state: string; slots: unknown[]; ambiguities: unknown[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[parse-timetable] JSON.parse failed, rawText preview:", rawText.slice(0, 300));
      parsed = {
        message: "I encountered an error processing the response. Please try again.",
        state: "chatting",
        slots: [],
        ambiguities: [],
      };
    }

    // ── Session storage for ready state ──────────────────────────────────────
    // When Claude has a complete timetable ready, store the full slots array
    // server-side and return only a session_id + summary to the client.
    // This avoids sending 400+ slot objects over the wire and holding them in
    // React state — the client fetches them only when the user clicks Apply.
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

      // Best-effort cleanup of sessions older than 24 hours (fire and forget).
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      supabase.from("timetable_assistant_sessions").delete().lt("created_at", cutoff).then(() => {});

      debugInfo.session_id = session_id;
      debugInfo.slot_count = slot_count;
      debugInfo.class_names = class_names;

      return new Response(
        JSON.stringify({
          message: parsed.message,
          state: "ready",
          session_id,
          slot_count,
          class_names,
          ambiguities: parsed.ambiguities || [],
          _debug: debugInfo,
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Chatting state — return message and any partial slots (no session needed).
    return new Response(
      JSON.stringify({
        message: parsed.message,
        state: parsed.state,
        slots: parsed.slots || [],
        ambiguities: parsed.ambiguities || [],
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
        ambiguities: [],
        _error: message,
      }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
