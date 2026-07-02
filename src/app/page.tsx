"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-white">
        <span className="text-xl font-bold tracking-tight">
          Huis<span style={{ color: "var(--accent)" }}>AI</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/galerij"
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--accent)" }}
          >
            🏰 3D Kunstgalerij
          </Link>
          <Link href="/project">
            <button className="btn-primary text-sm py-2 px-4">
              Probeer gratis
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-6"
          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        >
          <span>✨</span>
          <span>AI-gestuurde inrichtingsanalyse</span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-6 max-w-2xl leading-tight">
          Zie de potentie van elke woning in{" "}
          <span style={{ color: "var(--accent)" }}>jouw stijl</span>
        </h1>

        <p className="text-xl text-[var(--muted)] mb-10 max-w-lg leading-relaxed">
          Upload een foto van een kamer, koppel je Pinterest board en ontdek
          direct hoe de ruimte er uit kan zien op basis van{" "}
          <strong className="text-[var(--foreground)]">jouw smaak</strong>.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <Link href="/project">
            <button className="btn-primary text-base px-8 py-3">
              Begin met analyseren →
            </button>
          </Link>
          <span className="text-sm text-[var(--muted)]">Geen account nodig</span>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 bg-white border-t border-[var(--border)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Hoe werkt het?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "📸",
                title: "Upload een kamerfoto",
                desc: "Maak een foto van de kamer of woning. Leeg of gemeubileerd – beide werken prima.",
              },
              {
                icon: "📌",
                title: "Plak je Pinterest board URL",
                desc: "Geen inloggen nodig. Kopieer de URL van je favoriete Pinterest board en plak hem in het veld.",
              },
              {
                icon: "🎨",
                title: "Bekijk het resultaat",
                desc: "AI analyseert jouw stijl en geeft concrete inrichtingsadvies afgestemd op de kamer.",
              },
            ].map((item) => (
              <div key={item.icon} className="flex flex-col items-center text-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: "var(--accent-light)" }}
                >
                  {item.icon}
                </div>
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <p className="text-[var(--muted)] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section
        className="px-6 py-16 text-center"
        style={{ background: "var(--accent)", color: "white" }}
      >
        <h2 className="text-3xl font-bold mb-4">Klaar om de potentie te ontdekken?</h2>
        <p className="text-white/80 mb-8 text-lg">
          Analyseer in minder dan een minuut elke woning op jouw stijl.
        </p>
        <Link href="/project">
          <button className="bg-white text-[var(--accent)] px-8 py-3 rounded-xl font-bold text-base hover:bg-gray-100 transition-colors">
            Begin nu →
          </button>
        </Link>
      </section>

      <footer className="px-6 py-6 text-center text-sm text-[var(--muted)] border-t border-[var(--border)] bg-white">
        <p>© 2026 HuisAI – Powered by Claude AI</p>
      </footer>
    </main>
  );
}
