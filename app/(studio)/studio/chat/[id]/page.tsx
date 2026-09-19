import { StudioPlaceholder } from "@/components/studio/Placeholder";

/**
 * A past conversation, opened from the sidebar.
 *
 * The route exists before the screen does because the sidebar already links
 * here — the recent list is real data, and every one of those rows would
 * otherwise land on a 404.
 */
export default function Page() {
  return (
    <StudioPlaceholder
      title="This conversation"
      detail="The transcript for this chat is not rendered here yet. The messages exist — this screen is what reads them."
    />
  );
}
