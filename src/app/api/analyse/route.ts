import { NextRequest, NextResponse } from "next/server";
import { analyseKamerMetStijl } from "@/lib/claude";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kamerImageBase64, kamerMimeType, pinterestImageUrls, boardNaam } = body;

    if (!kamerImageBase64 || !kamerMimeType) {
      return NextResponse.json(
        { error: "Kamerfoto is verplicht" },
        { status: 400 }
      );
    }

    const validMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validMimeTypes.includes(kamerMimeType)) {
      return NextResponse.json(
        { error: "Alleen JPEG, PNG en WebP zijn toegestaan" },
        { status: 400 }
      );
    }

    const suggestion = await analyseKamerMetStijl(
      kamerImageBase64,
      kamerMimeType,
      pinterestImageUrls ?? [],
      boardNaam
    );

    return NextResponse.json({ success: true, suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
