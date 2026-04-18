"use client";

import { useState } from "react";
import type { AnalyseResultaat, DesignOptie } from "@/lib/claude";

const KLEUR_MAP: Record<string, string> = {
  wit: "#ffffff", crème: "#f5f0e8", beige: "#d4b896", zand: "#c9b08a",
  taupe: "#b5a090", grijs: "#9e9e9e", lichtgrijs: "#d4d4d4", donkergrijs: "#424242",
  antraciet: "#3d3d3d", zwart: "#1a1a1a", bruin: "#795548", terracotta: "#c05b3a",
  okergeel: "#e8a630", mosterd: "#d4a017", geel: "#f9d43b", olijfgroen: "#6b7c45",
  groen: "#4caf50", saliegroen: "#8aa87c", petrol: "#1a6b6b", blauw: "#2196f3",
  marineblauw: "#1a3a5c", lichtblauw: "#90caf9", roze: "#e91e8c", oudroze: "#c4889e",
  lavendel: "#9c88c4", paars: "#7b1fa2", koper: "#b87333", goud: "#d4af37",
  zilver: "#c0c0c0", naturel: "#c8a97a", hout: "#a0785a", linnen: "#e8dcc8",
};

function kleurNaarHex(naam: string): string {
  const lower = naam.toLowerCase().replace(/\s+/g, "");
  for (const [key, val] of Object.entries(KLEUR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "#d0d0d0";
}

const OPTIE_ACCENTEN = [
  { bg: "#fff8f0", border: "#f97316", tekst: "#ea580c" },
  { bg: "#f0fdf4", border: "#22c55e", tekst: "#16a34a" },
  { bg: "#faf5ff", border: "#a855f7", tekst: "#9333ea" },
];

function OptieKaart({ optie, index, actief, onClick }: {
  optie: DesignOptie;
  index: number;
  actief: boolean;
  onClick: () => void;
}) {
  const accent = OPTIE_ACCENTEN[index];
  return (
    <button
      onClick={onClick}
      className="card text-left transition-all hover:shadow-md w-full"
      style={{
        borderColor: actief ? accent.border : undefined,
        borderWidth: actief ? "2px" : "1px",
        background: actief ? accent.bg : undefined,
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 inline-block"
              style={{ background: accent.bg, color: accent.tekst, border: `1px solid ${accent.border}` }}
            >
              {optie.stijlLabel}
            </span>
            <h3 className="font-bold text-lg leading-tight">{optie.naam}</h3>
          </div>
          <span className="text-2xl flex-shrink-0">
            {index === 0 ? "✦" : index === 1 ? "♦" : "◆"}
          </span>
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed">{optie.beschrijving}</p>

        {/* Kleurenpalet */}
        <div className="flex gap-1.5 mt-4">
          {optie.kleurenpalet.map((kleur, i) => (
            <div
              key={i}
              title={kleur}
              className="w-7 h-7 rounded-lg border border-black/10 flex-shrink-0"
              style={{ background: kleurNaarHex(kleur) }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-[var(--muted)]">💰 {optie.budget}</span>
          <span className="text-xs font-medium" style={{ color: accent.tekst }}>
            {actief ? "Geselecteerd ✓" : "Bekijk details →"}
          </span>
        </div>
      </div>
    </button>
  );
}

interface Props {
  resultaat: AnalyseResultaat;
  kamerPreview: string | null;
  onOpnieuw: () => void;
}

export default function DrieOpties({ resultaat, kamerPreview, onOpnieuw }: Props) {
  const [actief, setActief] = useState(0);
  const optie = resultaat.opties[actief];
  const accent = OPTIE_ACCENTEN[actief];

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3"
          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        >
          ✨ Analyse klaar
        </div>
        <h1 className="text-2xl font-bold mb-1">3 inrichtingsmogelijkheden</h1>
        <p className="text-sm text-[var(--muted)]">{resultaat.kamerObservatie}</p>
        {resultaat.stijlSamenvatting && (
          <p className="text-sm text-[var(--muted)] mt-1 italic">
            Stijl: {resultaat.stijlSamenvatting}
          </p>
        )}
      </div>

      {/* Drie kaarten */}
      <div className="grid grid-cols-1 gap-3">
        {resultaat.opties.map((opt, i) => (
          <OptieKaart
            key={i}
            optie={opt}
            index={i}
            actief={actief === i}
            onClick={() => setActief(i)}
          />
        ))}
      </div>

      {/* Detail view voor geselecteerde optie */}
      <div
        className="card p-5"
        style={{ borderColor: accent.border, borderWidth: "1.5px" }}
      >
        <h2 className="font-bold text-lg mb-4" style={{ color: accent.tekst }}>
          {optie.naam} — details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {kamerPreview && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase mb-2">Jouw kamer</p>
              <div className="rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={kamerPreview} alt="Jouw kamer" className="w-full h-40 object-cover" />
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-[var(--muted)] uppercase mb-2">Sfeer</p>
            <p className="text-sm text-[var(--muted)] leading-relaxed">{optie.sfeer}</p>

            <p className="text-xs font-semibold text-[var(--muted)] uppercase mt-4 mb-2">Kleurenpalet</p>
            <div className="flex flex-wrap gap-2">
              {optie.kleurenpalet.map((kleur, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded border border-black/10"
                    style={{ background: kleurNaarHex(kleur) }}
                  />
                  <span className="text-xs capitalize">{kleur}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase mb-3">Meubilair & elementen</p>
          <div className="space-y-2">
            {optie.meubeladvies.map((m, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: accent.bg, color: accent.tekst }}
                >
                  {i + 1}
                </span>
                <div>
                  <span className="font-semibold">{m.item}: </span>
                  <span className="text-[var(--muted)]">{m.advies}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Acties */}
      <div className="flex gap-3">
        <button
          onClick={onOpnieuw}
          className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors text-sm"
        >
          Nieuwe kamer analyseren
        </button>
        <button
          onClick={() => window.print()}
          className="btn-primary flex-1 text-sm"
        >
          Opslaan / Afdrukken
        </button>
      </div>
    </div>
  );
}
