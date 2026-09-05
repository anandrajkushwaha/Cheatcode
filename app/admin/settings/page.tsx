import { FlagsForm } from "@/components/admin/FlagsForm";
import { FEATURES, FEATURE_LABELS, modelCatalogue } from "@/lib/app/ai-cost";
import { flagsNow } from "@/lib/app/flags";

export const dynamic = "force-dynamic";

/**
 * The switches, and only switches that switch something.
 *
 * There is one group here because there is one thing in the product that can
 * honestly be configured without a deploy: which provider and model each
 * agentic feature runs on. Everything else people usually put on a settings
 * page — "enable dark mode", "beta features" — would be a toggle wired to
 * nothing, and a settings page full of those is worse than no settings page,
 * because the next person believes them.
 *
 * More rows go here as the code that would obey them gets written. That is the
 * order: the behaviour first, then the switch.
 */
export default async function AdminSettings() {
  const flags = await flagsNow();
  const catalogue = modelCatalogue();

  /**
   * Which providers this deployment can actually reach.
   *
   * Read here on the server and passed down, because the browser must never be
   * told anything about a key beyond whether one exists. The screen uses it to
   * grey out models it would be pointless to select.
   */
  const configured = {
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    sarvam: Boolean(process.env.SARVAM_API_KEY?.trim()),
  };

  const none = !configured.openai && !configured.gemini && !configured.sarvam;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">Settings</h1>
      <p className="mt-1 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
        Which model answers each part of the agent. Saving writes to the database, not to the
        build, so it takes effect without a deploy — within about thirty seconds, which is how
        long each running server caches this for.
      </p>

      {none && (
        <p className="mt-4 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          No provider key is set on this deployment, so every choice below is unavailable. Add{" "}
          <code>OPENAI_API_KEY</code>, <code>GEMINI_API_KEY</code> or <code>SARVAM_API_KEY</code> in
          Vercel and redeploy.
        </p>
      )}

      <h2 className="mt-8 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
        Agent models
      </h2>
      <p className="mb-3 mt-2 max-w-[70ch] text-[0.8rem] leading-relaxed text-ink-30">
        The list is the price table in <code>lib/app/ai-cost.ts</code>: you can only pick a model
        we know how to cost, so nothing you choose here can turn up as unpriced spend on the
        dashboard. Rates shown are per million tokens.
      </p>

      <FlagsForm
        initial={flags}
        features={FEATURES.map((key) => ({ key, label: FEATURE_LABELS[key] }))}
        catalogue={catalogue}
        configured={configured}
      />

      <p className="mt-4 max-w-[70ch] text-[0.78rem] leading-relaxed text-ink-30">
        <b>Follow the environment</b> is the default and means the behaviour that existed before
        this screen: <code>LLM_PROVIDER</code>, the per-feature overrides, and whichever key is
        set. Choosing a model here overrides all of them. Switching a feature off makes it refuse
        rather than quietly run on something else.
      </p>
    </>
  );
}
