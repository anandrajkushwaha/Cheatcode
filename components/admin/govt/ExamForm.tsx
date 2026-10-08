"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  FEE_CATEGORIES,
  ORGANISATION_TYPES,
  QUALIFICATIONS,
  QUALIFICATION_LABEL,
  STATES,
} from "@/lib/govt/types";
import type { ExamDraft } from "@/lib/govt/admin";
import {
  Area,
  BUTTON,
  BUTTON_QUIET,
  Chips,
  Field,
  Group,
  Problem,
  Select,
  Text,
  usePost,
} from "@/components/admin/govt/fields";

/**
 * The recruitment page: one address, every stage of one exam.
 *
 * Long on purpose, and almost all of it optional. The form is in three parts
 * and only the first is required, because the first is all that is needed for
 * the page to exist and be correct — organisation, name, and what it is. The
 * numbers come later, usually from a PDF, often days later, and a form that
 * demanded them all up front would mean no page until somebody had an hour.
 *
 * The third group is different from anything else in this panel: those six
 * values decide whether a person applies on time, pays the right fee, or
 * thinks they are too old. The page will not show any of them unless this
 * form is told which notification they were read off. That is the one rule
 * here that is not about convenience.
 */
export function ExamForm({ exam }: { exam?: ExamDraft }) {
  const router = useRouter();
  const { busy, error, post } = usePost("/api/admin/govt/recruitment");

  const [organisation, setOrganisation] = useState(exam?.organisation ?? "");
  const [organisationType, setOrganisationType] = useState(exam?.organisationType ?? "central");
  const [name, setName] = useState(exam?.name ?? "");
  const [year, setYear] = useState(exam?.year ? String(exam.year) : "");
  const [about, setAbout] = useState(exam?.about ?? "");
  const [status, setStatus] = useState(exam?.status ?? "published");

  const [qualificationLevels, setQualificationLevels] = useState<string[]>(
    exam?.qualificationLevels ?? [],
  );
  const [qualificationText, setQualificationText] = useState(exam?.qualificationText ?? "");
  const [ageMin, setAgeMin] = useState(exam?.ageMin ? String(exam.ageMin) : "");
  const [ageMax, setAgeMax] = useState(exam?.ageMax ? String(exam.ageMax) : "");
  const [states, setStates] = useState<string[]>(exam?.states ?? []);
  const [isAllIndia, setIsAllIndia] = useState(Boolean(exam?.isAllIndia));

  const [applicationStart, setApplicationStart] = useState(exam?.applicationStart ?? "");
  const [applicationEnd, setApplicationEnd] = useState(exam?.applicationEnd ?? "");
  const [vacancies, setVacancies] = useState(exam?.vacancies ? String(exam.vacancies) : "");
  const [applyUrl, setApplyUrl] = useState(exam?.applyUrl ?? "");
  const [fee, setFee] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      FEE_CATEGORIES.map((c) => [c, exam?.feeByCategory?.[c] ? String(exam.feeByCategory[c]) : ""]),
    ),
  );
  const [examDateFrom, setExamDateFrom] = useState(exam?.examDateFrom ?? "");
  const [examDateTo, setExamDateTo] = useState(exam?.examDateTo ?? "");
  const [dateNote, setDateNote] = useState(exam?.dateNote ?? "");
  const [selectionProcess, setSelectionProcess] = useState((exam?.selectionProcess ?? []).join(", "));
  const [evidenceUrl, setEvidenceUrl] = useState(exam?.evidenceUrl ?? "");

  /** Whether anything in the gated group is filled — so the hint can say so. */
  const gatedFilled =
    Boolean(applicationStart || applicationEnd || vacancies || ageMin || ageMax) ||
    Object.values(fee).some(Boolean);

  async function save() {
    const done = await post<{ id: string; slug: string }>({
      action: "save",
      id: exam?.id,
      organisation,
      organisationType,
      name,
      year: year || null,
      about,
      status,
      qualificationLevels,
      qualificationText,
      ageMin: ageMin || null,
      ageMax: ageMax || null,
      states,
      isAllIndia,
      applicationStart,
      applicationEnd,
      vacancies: vacancies || null,
      applyUrl,
      fee,
      examDateFrom,
      examDateTo,
      dateNote,
      selectionProcess: selectionProcess.split(",").map((s) => s.trim()).filter(Boolean),
      evidenceUrl,
    });
    if (!done) return;
    router.push("/admin/govt");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Group
        title={exam ? "Edit recruitment" : "New recruitment"}
        note="Only the first two fields are needed. Post the page as soon as the notification is out — the numbers can be filled in afterwards, and an incomplete page that says so is more use than no page."
      >
        <Field label="Organisation" hint="The abbreviation people search for: SSC, BPSC, RRB, IBPS.">
          <Text
            value={organisation}
            onChange={(e) => setOrganisation(e.target.value)}
            placeholder="SSC"
            maxLength={80}
          />
        </Field>

        <Field label="Kind of organisation" hint="Used by the filters, not shown as a label.">
          <Select
            value={organisationType}
            onChange={(e) => setOrganisationType(e.target.value)}
            options={ORGANISATION_TYPES.map((t) => ({
              value: t,
              label: t[0].toUpperCase() + t.slice(1),
            }))}
          />
        </Field>

        <Field
          label="Recruitment name"
          hint="As the notification writes it. A full name, not an abbreviation — it becomes the web address."
          wide
        >
          <Text
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Combined Graduate Level Examination 2026"
            maxLength={160}
          />
        </Field>

        <Field label="Year" hint="Optional. Keeps two years of the same exam apart.">
          <Text
            value={year}
            onChange={(e) => setYear(e.target.value)}
            inputMode="numeric"
            placeholder="2026"
          />
        </Field>

        <Field label="Status" hint="Published is live immediately. Closed keeps the page up, marked over.">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "published", label: "Published — live" },
              { value: "draft", label: "Draft — not public" },
              { value: "closed", label: "Closed — live, applications over" },
              { value: "withdrawn", label: "Withdrawn — off the page" },
            ]}
          />
        </Field>

        <Field
          label="About this recruitment (optional)"
          hint="Two or three plain sentences. What the job is, who it is for. No marketing."
          wide
        >
          <Area value={about} onChange={(e) => setAbout(e.target.value)} maxLength={2000} />
        </Field>
      </Group>

      <Group
        title="Who can apply"
        note="The chips are what the filters read, so they have to be ticked for this recruitment to appear under 'jobs by education'. The sentence beside them is what a reader is actually shown."
      >
        <Field label="Education" hint="Tick every level that qualifies." wide>
          <Chips
            value={qualificationLevels}
            onChange={setQualificationLevels}
            options={QUALIFICATIONS.map((q) => ({ value: q, label: QUALIFICATION_LABEL[q] }))}
          />
        </Field>

        <Field
          label="Eligibility, in words"
          hint="Copied from the notification, not paraphrased."
          wide
        >
          <Area
            value={qualificationText}
            onChange={(e) => setQualificationText(e.target.value)}
            maxLength={1200}
            placeholder="Bachelor's degree in any discipline from a recognised university."
          />
        </Field>

        <Field label="Minimum age" hint="Leave blank if not stated.">
          <Text value={ageMin} onChange={(e) => setAgeMin(e.target.value)} inputMode="numeric" placeholder="18" />
        </Field>

        <Field label="Maximum age" hint="Before relaxations.">
          <Text value={ageMax} onChange={(e) => setAgeMax(e.target.value)} inputMode="numeric" placeholder="27" />
        </Field>

        <Field label="Open to the whole country" wide>
          <button
            type="button"
            onClick={() => setIsAllIndia(!isAllIndia)}
            aria-pressed={isAllIndia}
            className={`rounded-full border px-4 py-2 text-[0.8rem] transition-colors ${
              isAllIndia ? "border-ink bg-ink text-paper" : "border-ink-15 text-ink-50 hover:border-ink-30"
            }`}
          >
            {isAllIndia ? "All India — yes" : "All India — no"}
          </button>
        </Field>

        <Field
          label="States"
          hint="Only for a state-level recruitment. Leave empty if it is All India."
          wide
        >
          <Chips
            value={states}
            onChange={setStates}
            columns
            options={STATES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
      </Group>

      <Group
        title="Dates, posts and fee"
        note="These six are the ones that cost somebody something when they are wrong, so the page shows them only if you say which notification they came from. Paste that link first; anything you fill without it is dropped rather than shown."
      >
        <Field
          label={gatedFilled ? "Notification link — required" : "Notification link"}
          hint="The PDF or page these numbers were read off."
          wide
        >
          <Text
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://ssc.gov.in/.../notice.pdf"
            inputMode="url"
          />
        </Field>

        <Field label="Applications open" hint="Date the form goes live.">
          <Text type="date" value={applicationStart} onChange={(e) => setApplicationStart(e.target.value)} />
        </Field>

        <Field label="Last date" hint="This is what Closing soon and Closed are worked out from.">
          <Text type="date" value={applicationEnd} onChange={(e) => setApplicationEnd(e.target.value)} />
        </Field>

        <Field label="Vacancies" hint="The total, if the notification gives one.">
          <Text value={vacancies} onChange={(e) => setVacancies(e.target.value)} inputMode="numeric" placeholder="17727" />
        </Field>

        <Field label="Apply link" hint="Where the form is. Shown as the apply button.">
          <Text value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://..." inputMode="url" />
        </Field>

        <Field label="Fee by category" hint="In rupees. Leave a box empty if the notification does not say." wide>
          <span className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FEE_CATEGORIES.map((c) => (
              <span key={c} className="block">
                <span className="block text-[0.7rem] uppercase tracking-[0.1em] text-ink-30">{c}</span>
                <Text
                  value={fee[c] ?? ""}
                  onChange={(e) => setFee({ ...fee, [c]: e.target.value })}
                  inputMode="numeric"
                  placeholder="0"
                />
              </span>
            ))}
          </span>
        </Field>

        <Field label="Exam date" hint="Not gated — a date that moves is normal and says so.">
          <Text type="date" value={examDateFrom} onChange={(e) => setExamDateFrom(e.target.value)} />
        </Field>

        <Field label="Exam date, to" hint="Only if it runs across days.">
          <Text type="date" value={examDateTo} onChange={(e) => setExamDateTo(e.target.value)} />
        </Field>

        <Field label="Note on the dates" hint="'Tentative', 'to be announced', whatever the notice says." wide>
          <Text value={dateNote} onChange={(e) => setDateNote(e.target.value)} maxLength={200} placeholder="Tentative" />
        </Field>

        <Field label="Selection stages" hint="Comma separated, in order." wide>
          <Text
            value={selectionProcess}
            onChange={(e) => setSelectionProcess(e.target.value)}
            placeholder="Tier 1, Tier 2, Document verification"
          />
        </Field>
      </Group>

      {error && <Problem>{error}</Problem>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy} className={BUTTON}>
          {busy ? "Saving…" : exam ? "Save changes" : "Create recruitment"}
        </button>
        <Link href="/admin/govt" className={BUTTON_QUIET}>
          Cancel
        </Link>
        {exam && (
          <Link
            href={`/government-jobs/${exam.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.82rem] text-ink-50 underline underline-offset-2 hover:text-ink"
          >
            Open the public page
          </Link>
        )}
        {exam?.postedBy && <span className="text-[0.78rem] text-ink-30">Posted by {exam.postedBy}</span>}
      </div>
    </div>
  );
}
