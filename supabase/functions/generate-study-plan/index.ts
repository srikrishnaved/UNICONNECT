import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIp, rateLimitResponse } from "../_shared/rateLimit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip).allowed) return rateLimitResponse(CORS);

  try {
    const { user_id } = await req.json() as { user_id: string };
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const today = new Date().toISOString().split("T")[0];

    const { data: exams, error: examsError } = await supabase
      .from("study_exams")
      .select("*, study_topics(*)")
      .eq("user_id", user_id)
      .gte("exam_date", today)
      .order("exam_date", { ascending: true });

    if (examsError) throw examsError;
    if (!exams || exams.length === 0) {
      return new Response(JSON.stringify({ error: "No upcoming exams found." }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data: avail } = await supabase
      .from("study_availability")
      .select("*")
      .eq("user_id", user_id);

    const availMap: Record<string, number> = {};
    for (const row of avail ?? []) {
      availMap[row.day_of_week] = row.hours_available;
    }

    const dayOrder = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const availStr = dayOrder
      .filter((d) => availMap[d])
      .map((d) => `${d}: ${availMap[d]}h`)
      .join(", ") || "No availability set — assume 2 hours per weekday";

    // Build Claude content array
    const pdfBlocks: unknown[] = [];
    let examSummary = "";

    for (const exam of exams) {
      const examMs = new Date(exam.exam_date).getTime();
      const todayMs = new Date(today).getTime();
      const daysLeft = Math.ceil((examMs - todayMs) / (1000 * 60 * 60 * 24));

      examSummary += `\nExam: "${exam.subject_name}" on ${exam.exam_date} (${daysLeft} day(s) away, exam_id: ${exam.id})\n`;

      const topics = exam.study_topics ?? [];
      const doneTopics = topics.filter((t: { status: string }) => t.status === 'done');
      const pendingTopics = topics.filter((t: { status: string }) => t.status !== 'done');

      if (topics.length > 0) {
        if (doneTopics.length > 0) {
          examSummary += `  Completed topics (DO NOT reschedule):\n`;
          for (const t of doneTopics) {
            examSummary += `  - ${t.topic_name} ✓\n`;
          }
        }
        if (pendingTopics.length > 0) {
          examSummary += `  Pending topics (reschedule these):\n`;
          for (const t of pendingTopics) {
            examSummary += `  - ${t.topic_name}${t.scheduled_date ? ` (currently: ${t.scheduled_date})` : " (unscheduled)"}\n`;
          }
        } else {
          examSummary += `  All topics completed — skip this exam.\n`;
        }
      } else if (exam.syllabus_text) {
        examSummary += `  Syllabus (extract topics from this):\n  ${exam.syllabus_text}\n`;
      } else if (exam.syllabus_file_url) {
        examSummary += `  Syllabus PDF provided below for this exam.\n`;
        try {
          const pdfRes = await fetch(exam.syllabus_file_url);
          if (pdfRes.ok) {
            const b64 = arrayBufferToBase64(await pdfRes.arrayBuffer());
            pdfBlocks.push({
              type: "text",
              text: `Syllabus PDF for "${exam.subject_name}" (exam_id: ${exam.id}):`,
            });
            pdfBlocks.push({
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: b64 },
            });
          }
        } catch {
          examSummary += `  (Could not fetch PDF)\n`;
        }
      } else {
        examSummary += `  No syllabus provided — generate sensible general topics for this subject.\n`;
      }
    }

    const systemPrompt = `You are a study planner AI. Analyse the student's exams and available study time, then return a study schedule.

Today is ${today}.

Return ONLY a raw JSON object — no explanation, no markdown, no code fences.

Schema:
{
  "topics": [
    {
      "topic_name": "string",
      "exam_id": "uuid string (must match one of the exam_ids above)",
      "scheduled_date": "YYYY-MM-DD",
      "estimated_weight": "light" | "medium" | "heavy"
    }
  ]
}

Rules:
- Schedule study sessions starting from tomorrow (not today, never on the exam date itself)
- Use only days the student has availability; if none set, use weekdays
- Spread topics evenly across available days between now and each exam
- Only schedule pending topics. Never include completed (✓) topics in your response
- Do not duplicate topics that already exist
- Extract topics from syllabus text or PDF where provided
- estimated_weight: light = quick review (~30 min), medium = 1–1.5 h, heavy = deep study 2+ h`;

    const userContent: unknown[] = [
      { type: "text", text: `Student availability: ${availStr}\n\nUpcoming exams:${examSummary}` },
      ...pdfBlocks,
    ];

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const txt = await anthropicRes.text();
      throw new Error(`Anthropic API error ${anthropicRes.status}: ${txt}`);
    }

    const anthropicData = await anthropicRes.json() as {
      content: Array<{ type: string; text?: string }>;
    };

    const rawText = anthropicData.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    const cleaned = rawText
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    let plan: { topics: Array<{ topic_name: string; exam_id: string; scheduled_date: string; estimated_weight: string }> };
    try {
      plan = JSON.parse(cleaned);
    } catch {
      throw new Error(`Could not parse Claude response as JSON: ${rawText.slice(0, 300)}`);
    }

    if (!Array.isArray(plan.topics)) {
      throw new Error("Claude response did not include a topics array.");
    }

    for (const topic of plan.topics) {
      if (!topic.topic_name || !topic.exam_id || !topic.scheduled_date) continue;

      const { data: existing } = await supabase
        .from("study_topics")
        .select("id, status")
        .eq("exam_id", topic.exam_id)
        .eq("topic_name", topic.topic_name)
        .maybeSingle();

      if (existing) {
        // Never overwrite a completed topic
        if (existing.status === "done") continue;
        await supabase
          .from("study_topics")
          .update({
            scheduled_date: topic.scheduled_date,
            estimated_weight: topic.estimated_weight ?? "medium",
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("study_topics").insert({
          exam_id: topic.exam_id,
          user_id,
          topic_name: topic.topic_name,
          status: "pending",
          scheduled_date: topic.scheduled_date,
          estimated_weight: topic.estimated_weight ?? "medium",
          sort_order: 0,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, topics_scheduled: plan.topics.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
