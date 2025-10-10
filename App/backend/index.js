// backend/index.js
import express from "express";
import cors from "cors";
import summarizerPkg from "node-summarizer";
const { SummarizerManager } = summarizerPkg;

console.log("Booting API…"); // ← para verificar que el archivo sí se ejecuta

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "resum-ia-api", pid: process.pid, now: new Date().toISOString() });
});

// División de oraciones robusta y sin lookbehind
function splitSentencesES(txt) {
  if (!txt) return [];
  const cleaned = txt.replace(/\[\d+\]/g, " ").replace(/\s+/g, " ").trim();
  const marked = cleaned.replace(/([.?!…»”])\s+(?=[A-ZÁÉÍÓÚÑÜ¿¡0-9])/gu, "$1|");
  return marked.split("|").map((s) => s.trim()).filter(Boolean);
}

// Handler con compresión y fallbacks
app.post("/api/summarize", async (req, res) => {
  try {
    const { text, sentences = 3 } = req.body || {};
    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return res.status(400).json({
        error: "Envía 'text' (>= 50 caracteres). Opcional: 'sentences' (1..10).",
      });
    }

    const MAX_SENT_RATIO = 0.5;   // máximo 50% de las oraciones originales
    const MAX_CHAR_RATIO = 0.6;   // si el resumen >60% del original, recortamos

    const sentsOrig = splitSentencesES(text);
    const origSentCount = Math.max(1, sentsOrig.length);

    const nSolic = Math.max(1, Math.min(10, Number(sentences) || 3));
    const nMaxPermitido = Math.max(1, Math.floor(origSentCount * MAX_SENT_RATIO));
    const n = Math.min(nSolic, nMaxPermitido);

    const pre = text.replace(/\[\d+\]/g, " ").trim();

    // 1) principal: rank
    const sm = new SummarizerManager(pre, n);
    let out = await sm.getSummaryByRank();
    let summary = (out?.summary || "").trim();

    // 2) fallback: frecuencia
    if (summary.length < 20) {
      const out2 = await sm.getSummaryByFrequency();
      summary = (out2?.summary || "").trim();
    }

    // 3) plan C: primeras N oraciones
    if (summary.length < 20) {
      const sents = splitSentencesES(pre);
      summary = sents.slice(0, n).join(" ");
    }

    // 4) compresión adicional si quedó demasiado largo
    const targetChars = Math.ceil(text.length * MAX_CHAR_RATIO);
    if (summary.length > targetChars) {
      let ss = splitSentencesES(summary);
      while (summary.length > targetChars && ss.length > 1) {
        ss.pop();
        summary = ss.join(" ");
      }
    }

    return res.json({
      summary,
      meta: {
        requestedSentences: nSolic,
        usedSentences: n,
        originalSentences: origSentCount,
        compressionRatio: Number((summary.length / text.length).toFixed(2)),
        originalChars: text.length,
        summaryChars: summary.length,
      },
    });
  } catch (e) {
    console.error("Summarize error:", e);
    return res.status(500).json({ error: "No se pudo generar el resumen." });
  }
});

// 🔒 IMPORTANTE: esto mantiene el proceso vivo.
// Si faltaba esta línea, Node terminaba inmediatamente.
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ API lista en http://localhost:${PORT} (pid ${process.pid})`);
});

// Por si algún error no capturado mata el proceso, lo vemos en consola:
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
