"use client";

import { useRouter } from "next/navigation";
import { TemplateGallery } from "@/components/app/TemplateGallery";
import { EVENTS, track } from "@/lib/analytics/events";

/** The full gallery on /resume-templates: a tap opens the guest builder. */
export function TemplatePicker() {
  const router = useRouter();
  return (
    <TemplateGallery
      current={null}
      onPick={(template) => {
        track(EVENTS.BUILDER_STEP, { label: "template_click", template, where: "resume-templates" });
        router.push(`/resume-builder?template=${template}`);
      }}
    />
  );
}
