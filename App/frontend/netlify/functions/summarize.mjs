/* eslint-env node */

// Netlify Function (ESM) — /.netlify/functions/summarize
import summarizerPkg from "node-summarizer";
const { SummarizerManager } = summarizerPkg;

/** División de oraciones robusta y sin lookbehind */
function splitSentencesES(txt) {
  if (!txt) return [];
  const cleaned = txt.replace(/\[\d+\]/g, " ").replace(/\s+/g, " ").trim();
  const marked = cleaned.replace(
    /([.?!…»”])\s+(?=[A-ZÁÉÍÓÚÑÜ¿¡0-9])/gu,
    "$1|"
  );
  return marked.split("|").map((s) => s.trim()).filter(Boolean);
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { text, sentences = 3 } = JSON.parse(event.body || "{}");

    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Envía 'text' (>= 50 caracteres). Opcional: 'sentences' (1..10).",
        }),
      };
    }

    const MAX_SENT_RATIO = 0.5;
    const MAX_CHAR_RATIO = 0.6;

    const sentsOrig = splitSentencesES(text);
    const origSentCount = Math.max(1, sentsOrig.length);

    const nSolic = Math.max(1, Math.min(10, Number(sentences) || 3));
    const nMaxPermitido = Math.max(1, Math.floor(origSentCount * MAX_SENT_RATIO));
    const n = Math.min(nSolic, nMaxPermitido);

    const pre = text.replace(/\[\d+\]/g, " ").trim();

    const sm = new SummarizerManager(pre, n);

    let out = await sm.getSummaryByRank();
    let summary = (out?.summary || "").trim();

    if (summary.length < 20) {
      const out2 = await sm.getSummaryByFrequency();
      summary = (out2?.summary || "").trim();
    }

    if (summary.length < 20) {
      const sents = splitSentencesES(pre);
      summary = sents.slice(0, n).join(" ");
    }

    const targetChars = Math.ceil(text.length * MAX_CHAR_RATIO);
    if (summary.length > targetChars) {
      let ss = splitSentencesES(summary);
      while (summary.length > targetChars && ss.length > 1) {
        ss.pop();
        summary = ss.join(" ");
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        meta: {
          requestedSentences: nSolic,
          usedSentences: n,
          originalSentences: origSentCount,
          compressionRatio: Number((summary.length / text.length).toFixed(2)),
          originalChars: text.length,
          summaryChars: summary.length,
        },
      }),
    };
  } catch (e) {
    console.error("Summarize error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: "No se pudo generar el resumen." }) };
  }
}
