import React, { useEffect, useMemo, useRef, useState } from "react";

/* ===== Config de API: usa proxy si existe (vite.config.js) ===== */
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
const SUMMARIZE_URL = API_BASE ? `${API_BASE}/api/summarize` : `/api/summarize`;

/* ================= Tema persistente ================= */
function useTheme() {
  const getInitial = () => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };
  const [theme, setTheme] = useState(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, toggle: () => setTheme(t => (t === "dark" ? "light" : "dark")) };
}

/* ================= Utils ================= */
const wordsCount = (s = "") =>
  (s.trim().match(/\b[\p{L}\p{N}’'-]+\b/gu) || []).length;

const readingTimeMin = (s = "", wpm = 200) =>
  Math.max(1, Math.round(wordsCount(s) / wpm));

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const shortText = (s = "", max = 120) =>
  s.length <= max ? s : s.slice(0, max).trimEnd() + "…";

/* Cuenta oraciones sin lookbehind */
const splitSentences = (txt = "") => {
  const cleaned = txt.replace(/\[\d+\]/g, " ").replace(/\s+/g, " ").trim();
  const marked = cleaned.replace(/([.?!…»”])\s+(?=[A-ZÁÉÍÓÚÑÜ¿¡0-9])/gu, "$1|");
  return marked.split("|").map(s => s.trim()).filter(Boolean);
};

/* ================= Historial (persistente) ================= */
const LS_KEY = "resum-ia.history.v1";
function useHistory() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }, [items]);

  const add = (entry) => setItems(prev => [entry, ...prev].slice(0, 50));
  const remove = (id) => setItems(prev => prev.filter(x => x.id !== id));
  const clear = () => setItems([]);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "historial-resumenes.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return { items, add, remove, clear, exportJson };
}

/* ================= Fondo interactivo (spotlight) ================= */
function Spotlight() {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      ref.current?.style.setProperty("--mx", `${e.clientX}px`);
      ref.current?.style.setProperty("--my", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(600px 300px at var(--mx) var(--my), rgba(99,102,241,.18), transparent 60%)",
        mixBlendMode: "screen",
      }}
    />
  );
}

/* ================= App ================= */
export default function App() {
  const { theme, toggle } = useTheme();
  const { items: history, add: addHistory, remove: removeHistory, clear: clearHistory, exportJson } = useHistory();

  const [text, setText] = useState("");
  const [sentences, setSentences] = useState(3);
  const [summarySize, setSummarySize] = useState(16); // px
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState("");
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [viewingId, setViewingId] = useState(null);

  const canSummarize = useMemo(
    () => text.trim().length >= 50 && !loading,
    [text, loading]
  );

  // recomendación de nº de oraciones (30% del total, min 1, max 5)
  const recommendedN = useMemo(() => {
    const n = splitSentences(text).length;
    return Math.min(5, Math.max(1, Math.floor(n * 0.3)));
  }, [text]);

  // progreso simulado
  useEffect(() => {
    if (!loading) { setProgress(0); return; }
    let p = 10;
    setProgress(p);
    const it = setInterval(() => { p = Math.min(95, p + Math.random() * 10); setProgress(p); }, 300);
    return () => clearInterval(it);
  }, [loading]);

  const summaryRef = useRef(null);

  async function onSummarize() {
    setLoading(true);
    setError("");
    setSummary("");
    setMeta(null);
    setViewingId(null);
    try {
      const res = await fetch(SUMMARIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sentences: Number(sentences) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error procesando el resumen");

      const sum = data.summary || "";
      const m = data.meta || null;
      setSummary(sum);
      setMeta(m);

      const id = crypto.randomUUID();
      addHistory({
        id,
        createdAt: new Date().toISOString(),
        sentences: m?.sentences ?? (Number(sentences) || 3),
        originalChars: m?.originalChars ?? text.length,
        summaryChars: m?.summaryChars ?? sum.length,
        originalWords: wordsCount(text),
        summaryWords: wordsCount(sum),
        readTimeMin: readingTimeMin(text),
        input: text,
        output: sum,
      });
      setViewingId(id);
      setProgress(100);
      setTimeout(() => setProgress(0), 400);

      requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      setError(e.message);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  }

  function onClear() {
    setText("");
    setSummary("");
    setMeta(null);
    setError("");
    setViewingId(null);
  }

  async function copySummary() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    alert("Resumen copiado ✅");
  }

  function downloadTxt() {
    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "resumen.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  const filteredHistory = useMemo(() => {
    if (!q.trim()) return history;
    const s = q.toLowerCase();
    return history.filter(h => h.input.toLowerCase().includes(s) || h.output.toLowerCase().includes(s));
  }, [history, q]);

  return (
    <div className="min-h-screen relative bg-app text-slate-900 dark:text-slate-100">
      {/* fondo dinámico */}
      <Spotlight />

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto px-5 pt-10 pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/90 grid place-items-center shadow-lg">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2">
                <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">GUARDIANES CUN - ALEJANDRO ACUÑA</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Proyecto final CUN 
              </p>
            </div>
          </div>

          <button
            onClick={toggle}
            className="btn btn-ghost rounded-full px-3 py-2"
            title={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12 4.5a1 1 0 0 1 1 1V7a1 1 0 1 1-2 0V5.5a1 1 0 0 1 1-1Zm0 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM4.5 13a1 1 0 1 1 0-2H6a1 1 0 1 1 0 2H4.5Z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Barra de progreso */}
      {(loading || progress > 0) && (
        <div className="relative z-10 h-1 w-full bg-black/10 dark:bg-white/10">
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-sky-400 transition-all duration-200"
               style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Contenido */}
      <main className="relative z-10 max-w-7xl mx-auto px-5 pb-16">
        {/* TOP: dos columnas */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formulario */}
          <section className="glass p-5 lg:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold mb-3">Texto a resumir</h2>
              <div className="hidden md:flex gap-2">
                <span className="chip chip-muted">{wordsCount(text)} palabras</span>
                <span className="chip chip-muted">{text.length} caracteres</span>
                <span className="chip chip-muted">~{readingTimeMin(text)} min</span>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-sm mb-3">
              Pega un artículo, guía o texto (mínimo 50 caracteres).
            </p>

            <textarea
              rows={12}
              className="input"
              placeholder="Pega aquí un artículo, guía o texto largo..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">
                  Nº de oraciones <span className="opacity-60">(recomendado: {recommendedN})</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={sentences}
                  onChange={(e) => setSentences(e.target.value)}
                  className="input w-28"
                />
              </div>

              <button onClick={onSummarize} disabled={!canSummarize} className="btn btn-primary">
                {loading ? "Resumiendo..." : "Generar resumen"}
              </button>
              <button onClick={onClear} disabled={loading} className="btn btn-ghost">Limpiar</button>
            </div>

            {error && <p className="mt-3 text-rose-500 dark:text-rose-300 font-medium">⚠ {error}</p>}

            <p className="mt-5 text-slate-600 dark:text-slate-400 text-sm">
              Tip: pega con <span className="kbd">Ctrl/Cmd + V</span> y ajusta el número de oraciones.
            </p>
          </section>

          {/* Resumen */}
          <section ref={summaryRef} className="glass p-5 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Resumen</h2>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">
                  {meta && (
                    <>Original: {meta.originalChars} · Resumen: {meta.summaryChars} · Oraciones: {meta.sentences}</>
                  )}
                </div>
                {/* tamaño de letra */}
                <div className="flex items-center gap-2">
                  <button className="chip chip-muted" onClick={() => setSummarySize(s => Math.max(14, s - 2))}>A-</button>
                  <button className="chip chip-muted" onClick={() => setSummarySize(s => Math.min(22, s + 2))}>A+</button>
                </div>
              </div>
            </div>

            {!summary && !loading && (
              <div className="text-slate-600 dark:text-slate-400 text-sm">
                <p className="mb-1">Aquí verás el resumen generado.</p>
                <p>Pega un texto y haz clic en <span className="font-semibold">Generar resumen</span>.</p>
              </div>
            )}

            {loading && (
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-5/6 bg-black/10 dark:bg-white/10 rounded"></div>
                <div className="h-4 w-4/6 bg-black/10 dark:bg-white/10 rounded"></div>
                <div className="h-4 w-3/6 bg-black/10 dark:bg-white/10 rounded"></div>
                <div className="h-4 w-4/6 bg-black/10 dark:bg-white/10 rounded"></div>
              </div>
            )}

            {summary && !loading && (
              <>
                <div
                  className="whitespace-pre-wrap input min-h-[220px]"
                  style={{ fontSize: `${summarySize}px`, lineHeight: 1.6 }}
                >
                  {summary}
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <button onClick={copySummary} className="btn btn-ghost">Copiar</button>
                  <button onClick={downloadTxt} className="btn btn-ghost">Descargar .txt</button>
                </div>
              </>
            )}
          </section>
        </div>

        {/* BOTTOM: Historial a lo ancho */}
        <section className="mt-6 glass p-5 lg:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Historial</h2>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={exportJson}>Exportar</button>
              <button className="btn btn-ghost" onClick={clearHistory} disabled={!history.length}>Limpiar</button>
            </div>
          </div>

          <input
            className="input mb-3"
            placeholder="Buscar en historial…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {!history.length ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Aún no hay resúmenes guardados. Cuando generes uno, se agregará aquí automáticamente.
            </p>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-auto pr-1">
              {filteredHistory.map((h) => {
                const active = viewingId === h.id;
                return (
                  <li
                    key={h.id}
                    className={`rounded-xl p-3 border ${
                      active
                        ? "bg-indigo-500/10 border-indigo-500/40"
                        : "bg-black/5 border-black/10 dark:bg-white/5 dark:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {fmtDateTime(h.createdAt)} · {h.originalWords} palabras · ~{h.readTimeMin} min
                      </span>
                      <div className="flex gap-2">
                        <button
                          className="chip chip-muted"
                          title="Ver resumen"
                          onClick={() => {
                            setSummary(h.output);
                            setMeta({
                              sentences: h.sentences,
                              originalChars: h.originalChars,
                              summaryChars: h.summaryChars,
                            });
                            setViewingId(h.id);
                            summaryRef.current?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Ver
                        </button>
                        <button
                          className="chip chip-muted"
                          title="Reusar texto original"
                          onClick={() => {
                            setText(h.input);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Reusar
                        </button>
                        <button
                          className="chip chip-muted"
                          title="Eliminar"
                          onClick={() => removeHistory(h.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    <p className="text-sm mt-2 line-clamp-3">{shortText(h.input, 180)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
