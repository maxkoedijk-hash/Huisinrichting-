import { NextRequest, NextResponse } from "next/server";
import { isToegestaneAfbeeldingsUrl } from "@/lib/kunstwerken";

export const maxDuration = 60;

// Proxy voor kunstwerk-afbeeldingen: WebGL-textures vereisen CORS-headers
// die de bronsite niet stuurt, dus we serveren ze via onze eigen origin.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !isToegestaneAfbeeldingsUrl(url)) {
    return NextResponse.json({ error: "Ongeldige afbeeldings-URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Referer: new URL(url).origin,
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Bron gaf ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Bron is geen afbeelding" }, { status: 502 });
    }

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
