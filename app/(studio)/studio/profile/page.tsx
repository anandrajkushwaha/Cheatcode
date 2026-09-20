import { getProfile, getPrimaryResume } from "@/lib/app/account";
import { ProfileForm } from "@/components/app/ProfileForm";

export const dynamic = "force-dynamic";

/**
 * Preferences.
 *
 * The same ProfileForm /app uses, not a second one. It already talks to the
 * right endpoint and knows every field's rules; a studio copy would be two
 * forms to keep in step, and the one nobody is looking at would be the one
 * that silently stops saving a field.
 *
 * Only the wrapper is studio's: a card, and a heading at the studio's size.
 */
export default async function StudioProfilePage() {
  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  if (!profile) {
    return (
      <div className="space-y-5">
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Preferences</h1>
        <div className="rounded-2xl border border-ink-30 bg-paper p-6">
          <p className="text-[0.9rem] font-medium">Your profile row is missing</p>
          <p className="mt-2 max-w-[64ch] text-[0.85rem] leading-relaxed text-ink-50">
            A profile is created automatically when an account is made, so this
            means the sign-up trigger did not run. Re-run{" "}
            <code className="font-mono text-ink">supabase/schemas/20_app_accounts.sql</code>{" "}
            in your Supabase project, then sign out and back in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Preferences</h1>
        <p className="mt-1.5 max-w-[64ch] text-[0.86rem] leading-relaxed text-ink-50">
          What your resume cannot say: where you would actually work, what you
          want next, and what you expect to be paid. Job matching and the mock
          interviews both read this.
        </p>
      </div>

      <div className="max-w-[720px] rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
        <ProfileForm
          profile={profile}
          resumeHint={
            resume?.parsed
              ? {
                  title: resume.latest_title,
                  company: resume.latest_company,
                  years: resume.years_experience,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
