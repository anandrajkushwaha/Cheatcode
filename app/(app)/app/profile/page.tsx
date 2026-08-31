import { getProfile, getPrimaryResume } from "@/lib/app/account";
import { ProfileForm } from "@/components/app/ProfileForm";

export default async function ProfilePage() {
  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  if (!profile) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Profile</h1>
        <div className="mt-8 rounded-2xl border border-ink-30 p-6">
          <p className="text-[0.9rem] font-medium">Your profile row is missing</p>
          <p className="mt-2 max-w-[64ch] text-[0.85rem] leading-relaxed text-ink-50">
            A profile is created automatically when an account is made, so this means the sign-up
            trigger did not run. Re-run{" "}
            <code className="font-mono text-ink">supabase/schemas/20_app_accounts.sql</code> in
            your Supabase project, then sign out and back in.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Profile</h1>
      <p className="mt-2.5 max-w-[68ch] text-[0.92rem] leading-relaxed text-ink-50">
        What your resume cannot say: where you would actually work, what you want next, and what
        you expect to be paid. Matching needs this as much as it needs the resume — and later the
        agent will fill most of it in by asking you.
      </p>

      <div className="mt-8 max-w-2xl">
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
    </>
  );
}
