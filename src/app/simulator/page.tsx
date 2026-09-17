import type { Metadata } from "next";
import { SimulatorView } from "@/views/simulator";

export const metadata: Metadata = { title: "What-if simulator" };

export default function Page() {
  return <SimulatorView />;
}
