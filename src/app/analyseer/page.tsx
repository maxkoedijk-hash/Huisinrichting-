"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { laadProject, comprimeerAfbeelding, type Project } from "@/lib/project";
import DrieOpties from "@/components/DrieOpties";
import type { AnalyseResultaat } from "@/lib/claude";

export default function AnalyseerPage() {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [kamerFoto, setKamerFoto] = useState<File | null>(null);
  const [kamerPreview, setKamerPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState("");
  const [resultaat, setResultaat] = useState<AnalyseResultaat | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = laadProject();
    if (!p || p.inspiraties.length < 3) {
      router.replace("/project");
      return;
    }
    // Deferred state update to avoid synchronous setState in effect
    const t = setTimeout(() => setProject(p), 0);
    return () => clearTimeout(t);
  }, [router]);

  const verwerkFoto = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setKamerFoto(file);
    setResultaat(null);
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

  const startAnalyse = async () => {
    if (!kamerFoto || !project) return;
    setLaden(true);
    setFout("");
    setResultaat(null);

    try {
      const gecomprimeerd = await comprimeerAfbeelding(kamerFoto, 1200);

      const inspiratieAfbeeldingen = project.inspiraties
        .sort(() => Math.random() - 0.5)
        .slice(0, 8)
        .map((i) => ({ data: i.data, mimeType: i.mimeType }));

      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kamerImageBase64: gecomprimeerd.data,
          kamerMimeType: gecomprimeerd.mimeType,
          inspiratieAfbeeldingen,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultaat(data.resultaat);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Er is iets misgegaan");
    } finally {
      setLaden(false);
    }
  };

  const opnieuw = () => {
    setKamerFoto(null);
    setKamerPreview(null);
    setResultaat(null);
    setFout("");
  };

  if (!project) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-white">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Huis<span style={{ color: "var(--accent)" }}>AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/project"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            📌 {project.inspiraties.length} inspiraties
          </Link>
        </div>
      </nav>

      <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
        {!resultaat ? (
          <div className="fade-in">
            <h1 className="text-2xl font-bold mb-1">Kamer analyseren</h1>
            <p className="text-sm text-[var(--muted)] mb-6">
              Upload een foto van een kamer of woning en krijg 3 inrichtings-
              mogelijkheden op basis van jouw stijl.
            </p>

            {!kamerPreview ? (
              <>
                <div
                  className={`upload-zone mb-4 ${dragOver ? "drag-over" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                >
                  <div className="text-4xl mb-3">📸</div>
                  <p className="font-semibold text-lg mb-1">Sleep een kamerfoto hierheen</p>
                  <p className="text-sm text-[var(--muted)]">of klik om te selecteren</p>
                </div>
                <div className="flex gap-3">
                  <button
                    className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors text-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📁 Bestand kiezen
                  </button>
                  <button
                    className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors text-sm"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    📷 Camera
                  </button>
                </div>
              </>
            ) : (
              <div className="fade-in">
                <div className="rounded-2xl overflow-hidden mb-4 border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={kamerPreview}
                    alt="Kamerfoto"
                    className="w-full object-cover max-h-80"
                  />
                </div>

                {fout && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                    <p className="text-red-600 text-sm">⚠️ {fout}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={opnieuw}
                    className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors text-sm"
                    disabled={laden}
                  >
                    Andere foto
                  </button>
                  <button
                    onClick={startAnalyse}
                    disabled={laden}
                    className="btn-primary flex-1"
                  >
                    {laden ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="spinner" />
                        Analyseren...
                      </span>
                    ) : (
                      "Geef 3 opties →"
                    )}
                  </button>
                </div>

                {laden && (
                  <p className="text-center text-xs text-[var(--muted)] mt-3">
                    AI analyseert jouw kamer en {project.inspiraties.length} inspiratiefoto&apos;s...
                    dit duurt 15–30 seconden
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <DrieOpties
            resultaat={resultaat}
            kamerPreview={kamerPreview}
            onOpnieuw={opnieuw}
          />
        )}
      </main>

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
  );
}
