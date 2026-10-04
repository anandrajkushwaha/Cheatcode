"use client";

import type { Resume, ResumeRole, ResumeEducation, ResumeProject } from "@/lib/app/resume-schema";
import { Area, Bullets, Chips, Move, Text, isEmail, isPhone } from "@/components/app/builder/fields";
import { bulletsFor, skillsFor } from "@/lib/app/builder/suggestions";

/**
 * One card per section, in the order the PRD lists them.
 *
 * Each takes the whole résumé and a setter rather than its own slice: a
 * section needs to read the target role to know which suggestions to offer,
 * and keeping one object means there is still exactly one copy of the
 * content — the rule the whole rebuild rests on.
 */
export type Patch = (fn: (r: Resume) => Resume) => void;

const card = "rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6";
const grid = "grid gap-4 sm:grid-cols-2";

export function Personal({ r, patch }: { r: Resume; patch: Patch }) {
  return (
    <div className={card}>
      <div className={grid}>
        <Text label="Full name" value={r.full_name ?? ""} placeholder="Your name as on your ID"
          onChange={(v) => patch((x) => ({ ...x, full_name: v }))} />
        <Text label="Headline" hint="12 words" value={r.headline ?? ""}
          placeholder="Product Designer · 4 years · Bengaluru"
          onChange={(v) => patch((x) => ({ ...x, headline: v }))} />
        <Text label="Email" type="email" value={r.email ?? ""} validate={isEmail}
          placeholder="you@example.com"
          onChange={(v) => patch((x) => ({ ...x, email: v }))} />
        <Text label="Phone" type="tel" value={r.phone ?? ""} validate={isPhone}
          placeholder="98765 43210"
          onChange={(v) => patch((x) => ({ ...x, phone: v }))} />
        <Text label="City" value={r.location ?? ""} placeholder="Bengaluru"
          onChange={(v) => patch((x) => ({ ...x, location: v }))} />
        <Text label="Target role" hint="aims the résumé" value={r.target_role ?? ""}
          placeholder="Senior Product Designer"
          onChange={(v) => patch((x) => ({ ...x, target_role: v }))} />
      </div>
    </div>
  );
}

export function Summary({ r, patch }: { r: Resume; patch: Patch }) {
  return (
    <div className={card}>
      <Area label="Summary" rows={4} target={220} value={r.summary ?? ""}
        hint="2–4 sentences"
        placeholder="What you do, how long you have done it, and the one thing you are best at."
        onChange={(v) => patch((x) => ({ ...x, summary: v }))} />
    </div>
  );
}

const emptyRole = (): ResumeRole => ({
  title: "", company: "", start: "", end: "", is_current: false, highlights: [""],
});

export function Experience({ r, patch }: { r: Resume; patch: Patch }) {
  const set = (i: number, fn: (x: ResumeRole) => ResumeRole) =>
    patch((x) => ({ ...x, roles: x.roles.map((v, j) => (j === i ? fn(v) : v)) }));
  const swap = (i: number, d: number) =>
    patch((x) => {
      const a = [...x.roles];
      [a[i], a[i + d]] = [a[i + d], a[i]];
      return { ...x, roles: a };
    });

  return (
    <div className="space-y-3">
      {r.roles.map((role, i) => (
        <div key={i} className={card}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[0.8rem] font-medium text-ink-50">Role {i + 1}</p>
            <Move first={i === 0} last={i === r.roles.length - 1}
              onUp={() => swap(i, -1)} onDown={() => swap(i, 1)}
              onDuplicate={() => patch((x) => ({ ...x, roles: [...x.roles.slice(0, i + 1), { ...role }, ...x.roles.slice(i + 1)] }))}
              onRemove={() => patch((x) => ({ ...x, roles: x.roles.filter((_, j) => j !== i) }))} />
          </div>

          <div className={grid}>
            <Text label="Job title" value={role.title ?? ""} placeholder="Product Designer"
              onChange={(v) => set(i, (x) => ({ ...x, title: v }))} />
            <Text label="Company" value={role.company ?? ""} placeholder="Acme Technologies"
              onChange={(v) => set(i, (x) => ({ ...x, company: v }))} />
            <Text label="Started" value={role.start ?? ""} placeholder="Jan 2022"
              onChange={(v) => set(i, (x) => ({ ...x, start: v }))} />
            <div>
              <Text label="Ended" value={role.is_current ? "" : (role.end ?? "")}
                placeholder={role.is_current ? "Present" : "Mar 2024"}
                onChange={(v) => set(i, (x) => ({ ...x, end: v }))} />
              <label className="mt-2 flex items-center gap-2 text-[0.82rem] text-ink-50">
                <input type="checkbox" checked={role.is_current}
                  onChange={(e) => set(i, (x) => ({ ...x, is_current: e.target.checked }))} />
                I still work here
              </label>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[0.82rem] font-medium">What you did</p>
            <Bullets values={role.highlights}
              suggestions={bulletsFor(role.title || r.target_role || r.headline)}
              onChange={(v) => set(i, (x) => ({ ...x, highlights: v }))} />
          </div>
        </div>
      ))}

      <button type="button"
        onClick={() => patch((x) => ({ ...x, roles: [...x.roles, emptyRole()] }))}
        className="w-full rounded-2xl border border-dashed border-ink-15 py-3 text-[0.86rem] font-medium text-ink-50 transition-colors hover:border-ink hover:text-ink">
        + Add a role
      </button>
    </div>
  );
}

const emptyEdu = (): ResumeEducation => ({ degree: "", institution: "", year: "" });

export function Education({ r, patch }: { r: Resume; patch: Patch }) {
  const set = (i: number, fn: (x: ResumeEducation) => ResumeEducation) =>
    patch((x) => ({ ...x, education: x.education.map((v, j) => (j === i ? fn(v) : v)) }));
  const swap = (i: number, d: number) =>
    patch((x) => {
      const a = [...x.education];
      [a[i], a[i + d]] = [a[i + d], a[i]];
      return { ...x, education: a };
    });

  return (
    <div className="space-y-3">
      {r.education.map((e, i) => (
        <div key={i} className={card}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[0.8rem] font-medium text-ink-50">Qualification {i + 1}</p>
            <Move first={i === 0} last={i === r.education.length - 1}
              onUp={() => swap(i, -1)} onDown={() => swap(i, 1)}
              onDuplicate={() => patch((x) => ({ ...x, education: [...x.education.slice(0, i + 1), { ...e }, ...x.education.slice(i + 1)] }))}
              onRemove={() => patch((x) => ({ ...x, education: x.education.filter((_, j) => j !== i) }))} />
          </div>
          <div className={grid}>
            <Text label="Degree" value={e.degree ?? ""} placeholder="B.Tech, Computer Science"
              onChange={(v) => set(i, (x) => ({ ...x, degree: v }))} />
            <Text label="Institution" value={e.institution ?? ""} placeholder="VIT Vellore"
              onChange={(v) => set(i, (x) => ({ ...x, institution: v }))} />
            <Text label="Year" value={e.year ?? ""} placeholder="2022"
              onChange={(v) => set(i, (x) => ({ ...x, year: v }))} />
          </div>
        </div>
      ))}
      <button type="button"
        onClick={() => patch((x) => ({ ...x, education: [...x.education, emptyEdu()] }))}
        className="w-full rounded-2xl border border-dashed border-ink-15 py-3 text-[0.86rem] font-medium text-ink-50 transition-colors hover:border-ink hover:text-ink">
        + Add education
      </button>
    </div>
  );
}

export function Skills({ r, patch }: { r: Resume; patch: Patch }) {
  return (
    <div className={card}>
      <Chips label="Skills" values={r.skills}
        placeholder="Type a skill and press Enter"
        suggestions={skillsFor(r.target_role || r.headline || r.roles[0]?.title)}
        onChange={(v) => patch((x) => ({ ...x, skills: v }))} />
    </div>
  );
}

const emptyProject = (): ResumeProject => ({
  name: "", description: "", link: "", highlights: [],
});

export function Projects({ r, patch }: { r: Resume; patch: Patch }) {
  const set = (i: number, fn: (x: ResumeProject) => ResumeProject) =>
    patch((x) => ({ ...x, projects: x.projects.map((v, j) => (j === i ? fn(v) : v)) }));

  return (
    <div className="space-y-3">
      {r.projects.map((p, i) => (
        <div key={i} className={card}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[0.8rem] font-medium text-ink-50">Project {i + 1}</p>
            <Move first={i === 0} last={i === r.projects.length - 1}
              onUp={() => patch((x) => { const a=[...x.projects]; [a[i],a[i-1]]=[a[i-1],a[i]]; return {...x, projects:a}; })}
              onDown={() => patch((x) => { const a=[...x.projects]; [a[i],a[i+1]]=[a[i+1],a[i]]; return {...x, projects:a}; })}
              onDuplicate={() => patch((x) => ({ ...x, projects: [...x.projects.slice(0, i + 1), { ...p }, ...x.projects.slice(i + 1)] }))}
              onRemove={() => patch((x) => ({ ...x, projects: x.projects.filter((_, j) => j !== i) }))} />
          </div>
          <div className="space-y-4">
            <div className={grid}>
              <Text label="Project" value={p.name ?? ""} placeholder="Fare-split app"
                onChange={(v) => set(i, (x) => ({ ...x, name: v }))} />
              <Text label="Link" value={p.link ?? ""} placeholder="github.com/you/project"
                onChange={(v) => set(i, (x) => ({ ...x, link: v }))} />
            </div>
            <Area label="What it is" rows={2} value={p.description ?? ""}
              placeholder="One line on what it does and who it is for."
              onChange={(v) => set(i, (x) => ({ ...x, description: v }))} />
            <Bullets values={p.highlights}
              onChange={(v) => set(i, (x) => ({ ...x, highlights: v }))} />
          </div>
        </div>
      ))}
      <button type="button"
        onClick={() => patch((x) => ({ ...x, projects: [...x.projects, emptyProject()] }))}
        className="w-full rounded-2xl border border-dashed border-ink-15 py-3 text-[0.86rem] font-medium text-ink-50 transition-colors hover:border-ink hover:text-ink">
        + Add a project
      </button>
    </div>
  );
}

export function Extras({ r, patch }: { r: Resume; patch: Patch }) {
  return (
    <div className="space-y-3">
      <div className={card}>
        <Chips label="Certifications" values={r.certifications}
          placeholder="Google UX Certificate"
          onChange={(v) => patch((x) => ({ ...x, certifications: v }))} />
      </div>
      <div className={card}>
        <Chips label="Achievements" values={r.achievements}
          placeholder="Top 1% in GATE 2023"
          onChange={(v) => patch((x) => ({ ...x, achievements: v }))} />
      </div>
    </div>
  );
}
