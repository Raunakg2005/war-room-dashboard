import type { Metadata } from "next";
import { RoutesView } from "@/views/routes";

export const metadata: Metadata = { title: "Route economics" };

export default function Page() {
  return <RoutesView />;
}
