import { NextResponse } from "next/server";
import { haalKunstwerkenOp } from "@/lib/kunstwerken";

export const maxDuration = 60;

export async function GET() {
  try {
    const werken = await haalKunstwerkenOp();
    return NextResponse.json({ werken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message, werken: [] }, { status: 500 });
  }
}
