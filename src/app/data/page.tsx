import type { Metadata } from "next";
import { DataView } from "@/views/data";

export const metadata: Metadata = { title: "Data & method" };

export default function Page() {
  return <DataView />;
}
