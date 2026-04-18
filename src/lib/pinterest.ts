export interface PinterestPin {
  id: string;
  imageUrl: string;
  description: string;
  link: string;
}

export interface BoardInfo {
  id: string;
  name: string;
  description: string;
  owner: string;
  pinCount: number;
}

export function parseBoardUrl(url: string): { username: string; boardSlug: string } | null {
  try {
    const cleaned = url.trim().replace(/\/$/, "");
    // Match: https://www.pinterest.com/username/board-name
    // or: https://nl.pinterest.com/username/board-name
    const match = cleaned.match(/pinterest\.[a-z.]+\/([^/]+)\/([^/]+)/i);
    if (!match) return null;
    return { username: match[1], boardSlug: match[2] };
  } catch {
    return null;
  }
}

export async function fetchBoardPins(
  username: string,
  boardSlug: string,
  accessToken: string,
  limit = 12
): Promise<PinterestPin[]> {
  // Pinterest API v5: get board by username/slug, then get pins
  const boardRes = await fetch(
    `https://api.pinterest.com/v5/boards/${username}/${boardSlug}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!boardRes.ok) {
    throw new Error(`Pinterest board niet gevonden: ${boardRes.status}`);
  }

  const board = await boardRes.json();
  const boardId: string = board.id;

  const pinsRes = await fetch(
    `https://api.pinterest.com/v5/boards/${boardId}/pins?page_size=${limit}&fields=id,media,description,link`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!pinsRes.ok) {
    throw new Error(`Pins ophalen mislukt: ${pinsRes.status}`);
  }

  const pinsData = await pinsRes.json();

  return (pinsData.items ?? [])
    .filter((pin: Record<string, unknown>) => {
      const media = pin.media as Record<string, unknown> | undefined;
      return media?.images;
    })
    .slice(0, limit)
    .map((pin: Record<string, unknown>) => {
      const media = pin.media as Record<string, Record<string, unknown>>;
      const images = media.images as Record<string, { url: string }>;
      const imageUrl =
        images?.["1200x"]?.url ||
        images?.["600x"]?.url ||
        images?.["400x300"]?.url ||
        "";
      return {
        id: String(pin.id),
        imageUrl,
        description: String(pin.description ?? ""),
        link: String(pin.link ?? ""),
      };
    })
    .filter((pin: PinterestPin) => pin.imageUrl);
}
