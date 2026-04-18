import Anthropic from "@anthropic-ai/sdk";
import type { TextBlockParam, ImageBlockParam } from "@anthropic-ai/sdk/resources/messages";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface DesignOptie {
  naam: string;
  stijlLabel: string;
  beschrijving: string;
  kleurenpalet: string[];
  meubeladvies: { item: string; advies: string }[];
  sfeer: string;
  budget: string;
}

export interface AnalyseResultaat {
  kamerObservatie: string;
  stijlSamenvatting: string;
  opties: [DesignOptie, DesignOptie, DesignOptie];
}

type Block = TextBlockParam | ImageBlockParam;

export async function analyseKamerDrieOpties(
  kamerImageBase64: string,
  kamerMimeType: "image/jpeg" | "image/png" | "image/webp",
  inspiratieBase64s: { data: string; mimeType: "image/jpeg" | "image/png" | "image/webp" }[]
): Promise<AnalyseResultaat> {
  const blocks: Block[] = [];

  blocks.push({ type: "text", text: "Hier is de kamerfoto die ingericht moet worden:" });
  blocks.push({
    type: "image",
    source: { type: "base64", media_type: kamerMimeType, data: kamerImageBase64 },
  });

  const slice = inspiratieBase64s.slice(0, 8);
  if (slice.length > 0) {
    blocks.push({
      type: "text",
      text: `Hier zijn ${slice.length} inspiratiefoto's die de stijlvoorkeur van de gebruiker laten zien:`,
    });
    for (const img of slice) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.data },
      });
    }
  }

  blocks.push({
    type: "text",
    text: `Analyseer de kamer grondig: afmetingen, lichtinval, bestaande elementen, architectuur.
${slice.length > 0 ? "Analyseer ook de inspiratiefoto's om de stijlvoorkeur te begrijpen." : ""}

Geef 3 VERSCHILLENDE inrichtingsmogelijkheden terug. Elke optie is een eigen interpretatie:
- Optie 1: de meest directe vertaling van de herkende stijl
- Optie 2: een warmere/gezelliger variant
- Optie 3: een gedurfdere of meer contrasterende variant

Antwoord ALLEEN in dit exacte JSON-formaat:
{
  "kamerObservatie": "Korte beschrijving van de kamer: ruimte, licht, architectuur (2 zinnen)",
  "stijlSamenvatting": "De herkende stijlvoorkeur uit de inspiratiefoto's (1-2 zinnen)",
  "opties": [
    {
      "naam": "Pakkende naam voor deze optie",
      "stijlLabel": "bijv. Japandi, Industrieel, Mediterraan, Boho, Klassiek modern",
      "beschrijving": "Wat maakt deze optie uniek en waarom past het bij de kamer én de stijl (2-3 zinnen)",
      "kleurenpalet": ["kleur1", "kleur2", "kleur3", "kleur4"],
      "meubeladvies": [
        { "item": "Meubelnaam", "advies": "Concreet advies" },
        { "item": "Meubelnaam", "advies": "Concreet advies" },
        { "item": "Meubelnaam", "advies": "Concreet advies" },
        { "item": "Meubelnaam", "advies": "Concreet advies" }
      ],
      "sfeer": "Hoe voelt deze ruimte aan als het klaar is (1-2 zinnen)",
      "budget": "bijv. €2.500 - €5.000"
    },
    {},
    {}
  ]
}`,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system:
      "Je bent een professionele interieurontwerper. Je geeft concrete, inspirerende inrichtingsadviezen in het Nederlands. Antwoord altijd met alleen de gevraagde JSON.",
    messages: [{ role: "user", content: blocks }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Geen geldig antwoord ontvangen van AI");

  return JSON.parse(jsonMatch[0]) as AnalyseResultaat;
}
