"use client";

export interface InspiratieAfbeelding {
  id: string;
  data: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  thumbnail: string;
}

export interface Project {
  id: string;
  naam: string;
  aangemaaktOp: string;
  inspiraties: InspiratieAfbeelding[];
}

const STORAGE_KEY = "huisai_project";

export function laadProject(): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

export function slaProjectOp(project: Project): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

export function verwijderProject(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function nieuwProject(naam: string): Project {
  return {
    id: crypto.randomUUID(),
    naam,
    aangemaaktOp: new Date().toISOString(),
    inspiraties: [],
  };
}

export async function comprimeerAfbeelding(
  file: File,
  maxBreedte = 800
): Promise<{ data: string; thumbnail: string; mimeType: "image/jpeg" | "image/png" | "image/webp" }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      const verhouding = img.width / img.height;
      const breedte = Math.min(img.width, maxBreedte);
      const hoogte = breedte / verhouding;

      const canvas = document.createElement("canvas");
      canvas.width = breedte;
      canvas.height = hoogte;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, breedte, hoogte);
      const data = canvas.toDataURL("image/jpeg", 0.82).split(",")[1];

      // Thumbnail
      const tW = 200;
      const tH = tW / verhouding;
      const tCanvas = document.createElement("canvas");
      tCanvas.width = tW;
      tCanvas.height = tH;
      tCanvas.getContext("2d")!.drawImage(img, 0, 0, tW, tH);
      const thumbnail = tCanvas.toDataURL("image/jpeg", 0.6);

      resolve({ data, thumbnail, mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}
