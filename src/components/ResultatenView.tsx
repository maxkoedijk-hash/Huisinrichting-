"use client";

import type { DesignSuggestion } from "@/lib/claude";

interface Props {
  resultaat: DesignSuggestion;
  kamerPreview: string | null;
  boardNaam?: string;
  onOpnieuw: () => void;
}

const KLEUR_MAP: Record<string, string> = {
  wit: "#ffffff",
  crème: "#f5f0e8",
  beige: "#d4b896",
  zand: "#c9b08a",
  taupe: "#b5a090",
  grijs: "#9e9e9e",
  lichtgrijs: "#d4d4d4",
  donkergrijs: "#424242",
  antraciet: "#3d3d3d",
  zwart: "#1a1a1a",
  bruin: "#795548",
  terracotta: "#c05b3a",
  okergeel: "#e8a630",
  mosterd: "#d4a017",
  geel: "#f9d43b",
  olijfgroen: "#6b7c45",
  groen: "#4caf50",
  saliegroen: "#8aa87c",
  petrol: "#1a6b6b",
  blauw: "#2196f3",
  marineblauw: "#1a3a5c",
  lichtblauw: "#90caf9",
  roze: "#e91e8c",
  oudroze: "#c4889e",
  lavendel: "#9c88c4",
  paars: "#7b1fa2",
  koper: "#b87333",
  goud: "#d4af37",
  zilver: "#c0c0c0",
};

function kleurNaarHex(naam: string): string {
  const lower = naam.toLowerCase().replace(/\s+/g, "");
  for (const [key, val] of Object.entries(KLEUR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "#cccccc";
}

export default function ResultatenView({ resultaat, kamerPreview, boardNaam, onOpnieuw }: Props) {
  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="text-center mb-2">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-3"
          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        >
          ✨ Analyse compleet
        </div>
        <h1 className="text-3xl font-bold mb-2">Jouw inrichtingsadvies</h1>
        {boardNaam && (
          <p className="text-[var(--muted)] text-sm">
            Gebaseerd op je Pinterest board:{" "}
            <span className="font-medium capitalize text-[var(--foreground)]">
              {boardNaam}
            </span>
          </p>
        )}
      </div>

      {/* Foto + stijlomschrijving */}
      <div className="card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {kamerPreview && (
            <div className="rounded-xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={kamerPreview}
                alt="Jouw kamer"
                className="w-full h-48 object-cover"
              />
              <p className="text-xs text-[var(--muted)] mt-1 text-center">
                Jouw kamerfoto
              </p>
            </div>
          )}
          <div className="flex flex-col justify-center">
            <h2 className="font-semibold text-lg mb-2">Herkende stijl</h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              {resultaat.stijlomschrijving}
            </p>
          </div>
        </div>
      </div>

      {/* Kleurenpalet */}
      {resultaat.kleurenpalet && resultaat.kleurenpalet.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-lg mb-4">🎨 Kleurenpalet</h2>
          <div className="flex flex-wrap gap-3">
            {resultaat.kleurenpalet.map((kleur, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-xl border border-[var(--border)] shadow-sm flex-shrink-0"
                  style={{ background: kleurNaarHex(kleur) }}
                />
                <span className="text-sm font-medium capitalize">{kleur}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meubeladvies */}
      {resultaat.meubeladvies && resultaat.meubeladvies.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-lg mb-4">🛋️ Meubilair & elementen</h2>
          <div className="space-y-3">
            {resultaat.meubeladvies.map((item, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-xl"
                style={{ background: "var(--background)" }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: "var(--accent-light)",
                    color: "var(--accent)",
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <p className="font-semibold text-sm">{item.item}</p>
                  <p className="text-sm text-[var(--muted)] mt-0.5">{item.advies}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inrichtingstips */}
      {resultaat.inrichtingstips && resultaat.inrichtingstips.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-lg mb-4">💡 Inrichtingstips</h2>
          <ul className="space-y-2">
            {resultaat.inrichtingstips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span style={{ color: "var(--accent)" }}>→</span>
                <span className="text-[var(--muted)]">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sfeeradvies */}
      {resultaat.sfeeradvies && (
        <div
          className="card p-5"
          style={{ borderColor: "var(--accent)", borderWidth: "1.5px" }}
        >
          <h2 className="font-semibold text-lg mb-2">✨ Sfeeradvies</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            {resultaat.sfeeradvies}
          </p>
        </div>
      )}

      {/* Budget */}
      {resultaat.budgetinschatting && (
        <div className="card p-5">
          <h2 className="font-semibold text-lg mb-2">💰 Budgetinschatting</h2>
          <p className="text-sm text-[var(--muted)]">{resultaat.budgetinschatting}</p>
        </div>
      )}

      {/* CTA */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onOpnieuw}
          className="flex-1 py-3 rounded-xl border-2 border-[var(--border)] font-medium hover:border-[var(--accent)] transition-colors"
        >
          Nieuwe analyse
        </button>
        <button
          onClick={() => window.print()}
          className="btn-primary flex-1"
        >
          Afdrukken / Opslaan
        </button>
      </div>
    </div>
  );
}
