import type { Metadata } from "next";
import { MentorApply } from "@/components/site/MentorApply";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Become a mentor — Cheatcode",
  description:
    "A curated, invitation-only network of people who are genuinely good at what they do. Thirty-minute conversations, your price or free, and nothing else on your plate.",
  path: "/become-a-mentor",
});

export default function BecomeAMentorPage() {
  return <MentorApply />;
}
