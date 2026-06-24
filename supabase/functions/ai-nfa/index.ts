// Supabase Edge Function — ai-nfa
// Calls Anthropic API to generate NFA content from a poster image or text description.
// Requires ANTHROPIC_API_KEY set as a Supabase secret:
//   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Deploy: npx supabase functions deploy ai-nfa

import { checkRateLimit, getClientIp, rateLimitResponse } from "../_shared/rateLimit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT =
  `You are an assistant helping a university club coordinator write a formal Note for Approval (NFA) for an event at CHRIST (Deemed to be University), Bangalore. Based on the event information provided, generate the following in formal, professional, third-person institutional language:
1. Abstract (2-3 sentences)
2. Objectives (4-5 bullet points, each starting with an action verb)
3. Expected Outcomes (4-5 bullet points)
4. Key Takeaways (3-4 bullet points)
Respond ONLY with valid JSON, no preamble or markdown:
{"abstract": "...", "objectives": ["..."], "expected_outcomes": ["..."], "key_takeaways": ["..."]}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip).allowed) return rateLimitResponse(CORS);

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured in Supabase secrets" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const { description, imageBase64, imageMimeType } = await req.json() as {
      description?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    let userContent: unknown;

    if (imageBase64) {
      userContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: imageMimeType || "image/jpeg",
            data: imageBase64,
          },
        },
        {
          type: "text",
          text: description
            ? `Event description: ${description}`
            : "Generate NFA content based on this event poster.",
        },
      ];
    } else if (description) {
      userContent = `Event description: ${description}`;
    } else {
      return new Response(
        JSON.stringify({ error: "Provide either description or imageBase64" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

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
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
    }

    const anthropicData = await resp.json() as { content: { text: string }[] };
    const rawText = anthropicData.content?.[0]?.text || "";

    // Strip markdown fences if the model wrapped the JSON
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
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
