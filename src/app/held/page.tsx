import type { Metadata } from "next";
import { HeldView } from "@/views/held";

export const metadata: Metadata = { title: "Held in Gulf" };

export default function Page() {
  return <HeldView />;
}
