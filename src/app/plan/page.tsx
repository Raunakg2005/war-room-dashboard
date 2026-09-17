import type { Metadata } from "next";
import { PlanView } from "@/views/plan";

export const metadata: Metadata = { title: "Action plan" };

export default function Page() {
  return <PlanView />;
}
