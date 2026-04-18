import { NextRequest, NextResponse } from "next/server";
import { analyseKamerDrieOpties } from "@/lib/claude";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kamerImageBase64, kamerMimeType, inspiratieAfbeeldingen } = body;

    if (!kamerImageBase64 || !kamerMimeType) {
      return NextResponse.json({ error: "Kamerfoto is verplicht" }, { status: 400 });
    }

    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!validMimes.includes(kamerMimeType)) {
      return NextResponse.json({ error: "Alleen JPEG, PNG of WebP" }, { status: 400 });
    }

    const resultaat = await analyseKamerDrieOpties(
      kamerImageBase64,
      kamerMimeType,
      inspiratieAfbeeldingen ?? []
    );

    return NextResponse.json({ success: true, resultaat });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
