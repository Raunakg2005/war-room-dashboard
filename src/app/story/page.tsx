import type { Metadata } from "next";
import { StoryView } from "@/views/story";

export const metadata: Metadata = { title: "Story mode" };

export default function Page() {
  return <StoryView />;
}
