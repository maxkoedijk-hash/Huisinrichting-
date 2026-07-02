import type { Metadata } from "next";
import KasteelGalerij from "@/components/KasteelGalerij";

export const metadata: Metadata = {
  title: "3D Kunstgalerij – Mind of Maxi",
  description:
    "Loop door een kasteel in Super Mario 64-stijl en bekijk de kunstwerken van mindofmaxi.com in 3D.",
};

export default function GalerijPagina() {
  return <KasteelGalerij />;
}
