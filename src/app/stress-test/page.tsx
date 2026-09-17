import type { Metadata } from "next";
import { StressView } from "@/views/stress";

export const metadata: Metadata = { title: "Stress test" };

export default function Page() {
  return <StressView />;
}
