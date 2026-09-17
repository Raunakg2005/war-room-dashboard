import type { Metadata } from "next";
import { DeepDivesView } from "@/views/deep-dives";

export const metadata: Metadata = { title: "Deep dives" };

export default function Page() {
  return <DeepDivesView />;
}
