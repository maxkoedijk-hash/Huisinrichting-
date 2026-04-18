"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import ResultatenView from "@/components/ResultatenView";
import type { DesignSuggestion } from "@/lib/claude";

type Stap = "foto" | "pinterest" | "analyseren" | "resultaat";

interface PinterestData {
  boardNaam: string;
  username: string;
  pins: { id: string; imageUrl: string; description: string }[];
}

export default function AnalysePage() {
  const [stap, setStap] = useState<Stap>("foto");
  const [kamerFoto, setKamerFoto] = useState<File | null>(null);
  const [kamerPreview, setKamerPreview] = useState<string | null>(null);
  const [boardUrl, setBoardUrl] = useState("");
  const [pinterestData, setPinterestData] = useState<PinterestData | null>(null);
  const [pinterestFout, setPinterestFout] = useState("");
  const [pinterestLaden, setPinterestLaden] = useState(false);
  const [analyseLaden, setAnalyseLaden] = useState(false);
  const [analyseFout, setAnalyseFout] = useState("");
  const [resultaat, setResultaat] = useState<DesignSuggestion | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const verwerkFoto = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setKamerFoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setKamerPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) verwerkFoto(file);
    },
    [verwerkFoto]
  );

  const haalPinterestOp = async () => {
    if (!boardUrl.trim()) return;
    setPinterestLaden(true);
    setPinterestFout("");
    setPinterestData(null);

    try {
      const res = await fetch("/api/pinterest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPinterestData({
        boardNaam: data.boardInfo.boardNaam,
        username: data.boardInfo.username,
        pins: data.pins,
      });
    } catch (err) {
      setPinterestFout(
        err instanceof Error ? err.message : "Fout bij ophalen Pinterest board"
      );
    } finally {
      setPinterestLaden(false);
    }
  };

  const startAnalyse = async () => {
    if (!kamerFoto) return;
    setAnalyseLaden(true);
    setAnalyseFout("");
    setStap("analyseren");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(kamerFoto);
      });

      const mimeType = kamerFoto.type as "image/jpeg" | "image/png" | "image/webp";
      const pinterestImageUrls =
        pinterestData?.pins.map((p) => p.imageUrl).filter(Boolean) ?? [];

      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kamerImageBase64: base64,
          kamerMimeType: mimeType,
          pinterestImageUrls,
          boardNaam: pinterestData?.boardNaam,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResultaat(data.suggestion);
      setStap("resultaat");
    } catch (err) {
      setAnalyseFout(
        err instanceof Error ? err.message : "Fout tijdens analyse"
      );
      setStap("pinterest");
    } finally {
      setAnalyseLaden(false);
    }
  };

  const opnieuw = () => {
    setStap("foto");
    setKamerFoto(null);
    setKamerPreview(null);
    setBoardUrl("");
    setPinterestData(null);
    setPinterestFout("");
    setResultaat(null);
    setAnalyseFout("");
  };

  const stappen: { id: Stap; label: string }[] = [
    { id: "foto", label: "Foto" },
    { id: "pinterest", label: "Pinterest" },
    { id: "resultaat", label: "Resultaat" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-white">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Huis<span style={{ color: "var(--accent)" }}>AI</span>
        </Link>
        {/* Stap-indicator */}
        {stap !== "analyseren" && stap !== "resultaat" && (
          <div className="flex items-center gap-2">
            {stappen.slice(0, 2).map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className="flex items-center gap-1.5 text-sm font-medium"
                  style={{
                    color: s.id === stap ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background:
                        s.id === stap ? "var(--accent)" : "var(--border)",
                      color: s.id === stap ? "white" : "var(--muted)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < 1 && (
                  <div
                    className="w-8 h-0.5"
                    style={{
                      background:
                        stap === "pinterest" ? "var(--accent)" : "var(--border)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </nav>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {/* Stap 1: Foto uploaden */}
          {stap === "foto" && (
            <div className="fade-in">
              <h1 className="text-3xl font-bold mb-2">
                Upload een kamerfoto
              </h1>
              <p className="text-[var(--muted)] mb-8">
                Maak een foto van de kamer die je wilt inrichten, of upload
                er een van je apparaat.
              </p>

              {!kamerPreview ? (
                <>
                  <div
                    className={`upload-zone ${dragOver ? "drag-over" : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={onDrop}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                  >
                    <div className="text-4xl mb-3">📸</div>
                    <p className="font-semibold text-lg mb-1">
                      Sleep een foto hierheen
                    </p>
                    <p className="text-[var(--muted)] text-sm">
                      of klik om een foto te selecteren
                    </p>
                    <p className="text-[var(--muted)] text-xs mt-2">
                      JPEG, PNG of WebP • Max 10MB
                    </p>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📁 Bestand kiezen
                    </button>
                    <button
                      className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      📷 Camera gebruiken
                    </button>
                  </div>
                </>
              ) : (
                <div className="fade-in">
                  <div className="relative rounded-2xl overflow-hidden mb-4 border border-[var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={kamerPreview}
                      alt="Kamerfoto preview"
                      className="w-full object-cover max-h-80"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors"
                      onClick={() => {
                        setKamerFoto(null);
                        setKamerPreview(null);
                      }}
                    >
                      Andere foto kiezen
                    </button>
                    <button
                      className="btn-primary flex-1"
                      onClick={() => setStap("pinterest")}
                    >
                      Volgende →
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) verwerkFoto(f);
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) verwerkFoto(f);
                }}
              />
            </div>
          )}

          {/* Stap 2: Pinterest board */}
          {stap === "pinterest" && (
            <div className="fade-in">
              <h1 className="text-3xl font-bold mb-2">
                Koppel je Pinterest board
              </h1>
              <p className="text-[var(--muted)] mb-8">
                Plak de URL van je Pinterest board. We analyseren de stijl
                van je pins om het perfecte inrichtingsadvies te geven.
              </p>

              <div className="card p-6 mb-6">
                <label className="block text-sm font-semibold mb-2">
                  Pinterest board URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={boardUrl}
                    onChange={(e) => {
                      setBoardUrl(e.target.value);
                      setPinterestFout("");
                      setPinterestData(null);
                    }}
                    placeholder="https://www.pinterest.com/gebruiker/board-naam"
                    className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <button
                    className="btn-primary whitespace-nowrap"
                    onClick={haalPinterestOp}
                    disabled={!boardUrl.trim() || pinterestLaden}
                  >
                    {pinterestLaden ? (
                      <span className="spinner" />
                    ) : (
                      "Ophalen"
                    )}
                  </button>
                </div>

                {pinterestFout && (
                  <p className="text-red-500 text-sm mt-2">⚠️ {pinterestFout}</p>
                )}

                <p className="text-xs text-[var(--muted)] mt-3">
                  Voorbeeld:{" "}
                  <code className="bg-gray-100 px-1 rounded">
                    https://www.pinterest.com/jouwgebruikersnaam/woonkamer-inspiratie
                  </code>
                </p>
              </div>

              {pinterestData && (
                <div className="fade-in card p-5 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-green-500 text-lg">✓</span>
                    <div>
                      <p className="font-semibold capitalize">{pinterestData.boardNaam}</p>
                      <p className="text-xs text-[var(--muted)]">
                        @{pinterestData.username} • {pinterestData.pins.length} pins geladen
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {pinterestData.pins.slice(0, 8).map((pin) => (
                      <div
                        key={pin.id}
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pin.imageUrl}
                          alt={pin.description || "Pinterest pin"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skip optie */}
              <div className="card p-4 mb-6 bg-[var(--accent-light)] border-[var(--accent)]/20">
                <p className="text-sm text-[var(--muted)]">
                  <span className="font-medium text-[var(--foreground)]">
                    Geen Pinterest board?
                  </span>{" "}
                  Je kunt ook direct doorgaan zonder board-koppeling. De AI
                  analyseert dan alleen de kamerfoto en geeft algemeen advies.
                </p>
              </div>

              {analyseFout && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-red-600 text-sm">⚠️ {analyseFout}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors"
                  onClick={() => setStap("foto")}
                >
                  ← Terug
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={startAnalyse}
                  disabled={!kamerFoto || analyseLaden}
                >
                  {pinterestData ? "Analyseer met mijn stijl →" : "Analyseer zonder board →"}
                </button>
              </div>
            </div>
          )}

          {/* Stap 3: Laden */}
          {stap === "analyseren" && (
            <div className="fade-in text-center py-20">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6"
                style={{ background: "var(--accent-light)" }}
              >
                🤖
              </div>
              <h2 className="text-2xl font-bold mb-3">Aan het analyseren...</h2>
              <p className="text-[var(--muted)] mb-8 max-w-sm mx-auto">
                We combineren jouw kamerfoto
                {pinterestData ? " met de stijl van je Pinterest board" : ""} om
                het perfecte inrichtingsadvies te maken.
              </p>
              <div className="flex flex-col gap-3 items-center">
                {[
                  "Kamerfoto analyseren",
                  pinterestData ? "Pinterest stijl begrijpen" : null,
                  "Inrichtingsadvies genereren",
                ]
                  .filter(Boolean)
                  .map((label, i) => (
                    <div
                      key={i}
                      className="skeleton h-5 rounded"
                      style={{ width: `${180 + i * 30}px` }}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Resultaat */}
          {stap === "resultaat" && resultaat && (
            <ResultatenView
              resultaat={resultaat}
              kamerPreview={kamerPreview}
              boardNaam={pinterestData?.boardNaam}
              onOpnieuw={opnieuw}
            />
          )}
        </div>
      </main>
    </div>
  );
}
