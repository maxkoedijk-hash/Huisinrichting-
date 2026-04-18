import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface DesignSuggestion {
  stijlomschrijving: string;
  kleurenpalet: string[];
  meubeladvies: { item: string; advies: string; voorbeeldLink?: string }[];
  inrichtingstips: string[];
  sfeeradvies: string;
  budgetinschatting: string;
}

export async function analyseKamerMetStijl(
  kamerImageBase64: string,
  kamerMimeType: "image/jpeg" | "image/png" | "image/webp",
  pinterestImageUrls: string[],
  boardNaam?: string
): Promise<DesignSuggestion> {
  const pinterestImageContent = pinterestImageUrls
    .slice(0, 6)
    .map((url) => ({
      type: "image" as const,
      source: { type: "url" as const, url },
    }));

  const systemPrompt = `Je bent een professionele interieurontwerper die gespecialiseerd is in het herkennen van stijlpatronen en het vertalen naar concrete inrichtingsadviezen.
Je analyseert kamerfoto's en Pinterest-inspiratiefoto's om gepersonaliseerd, praktisch inrichtingsadvies te geven.
Antwoord altijd in het Nederlands. Wees concreet en enthousiast.`;

  const userContent: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: `Ik heb een foto van een kamer die ik wil inrichten${boardNaam ? ` gebaseerd op mijn Pinterest board "${boardNaam}"` : ""}.

Hier is de kamerfoto:`,
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: kamerMimeType,
        data: kamerImageBase64,
      },
    },
    ...(pinterestImageUrls.length > 0
      ? [
          {
            type: "text" as const,
            text: `\nEn hier zijn ${pinterestImageUrls.slice(0, 6).length} inspiratiefoto's van mijn Pinterest board die mijn stijlvoorkeur weergeven:`,
          },
          ...pinterestImageContent,
        ]
      : []),
    {
      type: "text",
      text: `
Analyseer de kamer grondig (afmetingen, lichtinval, bestaande elementen, stijl) en analyseer de Pinterest-inspiratiefoto's om mijn stijlvoorkeur te begrijpen.

Geef je advies in het volgende JSON-formaat:
{
  "stijlomschrijving": "Een beschrijving van de herkende stijl uit de Pinterest foto's en hoe die past bij de kamer (2-3 zinnen)",
  "kleurenpalet": ["kleur1", "kleur2", "kleur3", "kleur4"],
  "meubeladvies": [
    { "item": "Naam van het meubel/element", "advies": "Specifiek advies voor dit item" },
    ... (5-7 items)
  ],
  "inrichtingstips": [
    "Tip 1 over indeling of gebruik van de ruimte",
    "Tip 2 over accessoires of details",
    "Tip 3 over lichtplan",
    "Tip 4 over textiel of zachte elementen"
  ],
  "sfeeradvies": "Overkoepelend advies over hoe de sfeer te creëren die overeenkomt met jouw Pinterest stijl in deze specifieke ruimte (3-4 zinnen)",
  "budgetinschatting": "Globale budgetinschatting voor de inrichting (bijv. €2.000 - €5.000 voor een complete make-over)"
}

Antwoord ALLEEN met de JSON, geen extra tekst.`,
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Geen geldig JSON-antwoord ontvangen van AI");
  }

  return JSON.parse(jsonMatch[0]) as DesignSuggestion;
}
