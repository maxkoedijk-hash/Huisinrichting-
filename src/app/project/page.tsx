"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  laadProject,
  slaProjectOp,
  nieuwProject,
  verwijderProject,
  comprimeerAfbeelding,
  type Project,
  type InspiratieAfbeelding,
} from "@/lib/project";

export default function ProjectPage() {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [projectNaam, setProjectNaam] = useState("");
  const [laden, setLaden] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const geladen = laadProject();
    if (!geladen) return;
    const t = setTimeout(() => setProject(geladen), 0);
    return () => clearTimeout(t);
  }, []);

  const verwerkBestanden = useCallback(
    async (bestanden: FileList | File[]) => {
      const lijst = Array.from(bestanden).filter((f) =>
        ["image/jpeg", "image/png", "image/webp"].includes(f.type)
      );
      if (!lijst.length) return;

      const huidig = project ?? nieuwProject(projectNaam || "Mijn project");
      const ruimte = 20 - huidig.inspiraties.length;
      if (ruimte <= 0) {
        setFout("Je hebt al 20 inspiratiefoto's. Verwijder er eerst een paar.");
        return;
      }

      setLaden(true);
      setFout("");

      const toVoegen = lijst.slice(0, ruimte);
      const bijgewerkt: Project = { ...huidig, inspiraties: [...huidig.inspiraties] };

      for (let i = 0; i < toVoegen.length; i++) {
        setBezig(`Foto ${i + 1} van ${toVoegen.length} verwerken...`);
        try {
          const gecomprimeerd = await comprimeerAfbeelding(toVoegen[i]);
          const inspiratie: InspiratieAfbeelding = {
            id: crypto.randomUUID(),
            ...gecomprimeerd,
          };
          bijgewerkt.inspiraties.push(inspiratie);
        } catch {
          // skip broken image
        }
      }

      slaProjectOp(bijgewerkt);
      setProject({ ...bijgewerkt });
      setLaden(false);
      setBezig(null);
    },
    [project, projectNaam]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) verwerkBestanden(e.dataTransfer.files);
    },
    [verwerkBestanden]
  );

  const verwijderInspiratie = (id: string) => {
    if (!project) return;
    const bijgewerkt = {
      ...project,
      inspiraties: project.inspiraties.filter((i) => i.id !== id),
    };
    slaProjectOp(bijgewerkt);
    setProject(bijgewerkt);
  };

  const maakNieuwProject = () => {
    verwijderProject();
    setProject(null);
    setProjectNaam("");
  };

  const startAnalyse = () => {
    if (!project || project.inspiraties.length < 3) {
      setFout("Voeg minimaal 3 inspiratiefoto's toe om door te gaan.");
      return;
    }
    router.push("/analyseer");
  };

  // Geen project nog → setup scherm
  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
              style={{ background: "var(--accent-light)" }}
            >
              🏠
            </div>
            <h1 className="text-3xl font-bold mb-2">Nieuw project starten</h1>
            <p className="text-[var(--muted)]">
              Upload 5–20 foto&apos;s die jouw stijl weergeven. Dit hoef je maar één
              keer te doen.
            </p>
          </div>

          <div className="card p-6 mb-4">
            <label className="block text-sm font-semibold mb-2">
              Projectnaam
            </label>
            <input
              type="text"
              value={projectNaam}
              onChange={(e) => setProjectNaam(e.target.value)}
              placeholder="bijv. Nieuw appartement Amsterdam"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors mb-4"
            />

            <label className="block text-sm font-semibold mb-2">
              Inspiratiefoto&apos;s{" "}
              <span className="font-normal text-[var(--muted)]">
                (5–20 foto&apos;s)
              </span>
            </label>

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
              <div className="text-3xl mb-2">🖼️</div>
              <p className="font-semibold mb-1">Sleep foto&apos;s hierheen</p>
              <p className="text-sm text-[var(--muted)]">
                of klik om te selecteren · JPEG, PNG, WebP
              </p>
            </div>
          </div>

          {fout && (
            <p className="text-red-500 text-sm mb-4">⚠️ {fout}</p>
          )}

          <button
            className="btn-primary w-full py-3"
            onClick={() => fileInputRef.current?.click()}
          >
            Foto&apos;s kiezen
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) verwerkBestanden(e.target.files);
          }}
        />
      </div>
    );
  }

  // Project bestaat → toon foto's
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-white">
        <span className="text-xl font-bold tracking-tight">
          Huis<span style={{ color: "var(--accent)" }}>AI</span>
        </span>
        <button
          onClick={maakNieuwProject}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Nieuw project
        </button>
      </nav>

      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{project.naam}</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              {project.inspiraties.length} / 20 inspiratiefoto&apos;s
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={startAnalyse}
            disabled={project.inspiraties.length < 3}
          >
            Kamer analyseren →
          </button>
        </div>

        {/* Upload zone */}
        {project.inspiraties.length < 20 && (
          <div
            className={`upload-zone mb-6 ${dragOver ? "drag-over" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
          >
            {laden ? (
              <div className="flex flex-col items-center gap-2">
                <div className="spinner" style={{ borderTopColor: "var(--accent)", borderColor: "var(--border)" }} />
                <p className="text-sm text-[var(--muted)]">{bezig}</p>
              </div>
            ) : (
              <>
                <p className="font-semibold text-sm">+ Meer foto&apos;s toevoegen</p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Nog {20 - project.inspiraties.length} plekken vrij
                </p>
              </>
            )}
          </div>
        )}

        {fout && <p className="text-red-500 text-sm mb-4">⚠️ {fout}</p>}

        {/* Foto grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {project.inspiraties.map((foto) => (
            <div
              key={foto.id}
              className="relative aspect-square rounded-xl overflow-hidden group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foto.thumbnail}
                alt="Inspiratie"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => verwijderInspiratie(foto.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}

          {/* Lege plekken */}
          {project.inspiraties.length < 5 &&
            Array.from({ length: 5 - project.inspiraties.length }).map((_, i) => (
              <div
                key={`leeg-${i}`}
                className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)] flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="text-xl text-[var(--border)]">+</span>
              </div>
            ))}
        </div>

        {project.inspiraties.length < 3 && (
          <p className="text-center text-sm text-[var(--muted)] mt-6">
            Voeg minimaal 3 inspiratiefoto&apos;s toe om te beginnen
          </p>
        )}

        {project.inspiraties.length >= 3 && (
          <div className="mt-8 text-center">
            <button className="btn-primary px-10 py-3 text-base" onClick={startAnalyse}>
              Begin met analyseren →
            </button>
            <p className="text-xs text-[var(--muted)] mt-2">
              Upload een foto van een kamer en krijg 3 inrichtingsopties
            </p>
          </div>
        )}
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) verwerkBestanden(e.target.files);
        }}
      />
    </div>
  );
}
