import { NextRequest, NextResponse } from "next/server";
import { parseBoardUrl, fetchBoardPins } from "@/lib/pinterest";

export async function POST(req: NextRequest) {
  try {
    const { boardUrl } = await req.json();

    if (!boardUrl) {
      return NextResponse.json(
        { error: "Board URL is verplicht" },
        { status: 400 }
      );
    }

    const parsed = parseBoardUrl(boardUrl);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Ongeldige Pinterest board URL. Gebruik het formaat: https://www.pinterest.com/gebruikersnaam/board-naam",
        },
        { status: 400 }
      );
    }

    const accessToken = process.env.PINTEREST_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: "Pinterest API niet geconfigureerd" },
        { status: 503 }
      );
    }

    const pins = await fetchBoardPins(
      parsed.username,
      parsed.boardSlug,
      accessToken,
      12
    );

    return NextResponse.json({
      success: true,
      boardInfo: {
        username: parsed.username,
        boardSlug: parsed.boardSlug,
        boardNaam: parsed.boardSlug.replace(/-/g, " "),
      },
      pins: pins.map((p) => ({ id: p.id, imageUrl: p.imageUrl, description: p.description })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
