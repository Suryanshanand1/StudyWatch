# Allies

Allies (repo name: StudyWatch) is a minimal timer + stopwatch companion app for
[Study Planner](https://github.com/Suryanshanand1/StudyPlaner-Android).
Time a study session here, send it over, file it under a subject and chapter there.
No accounts, no server, works fully offline.

## How sync works

Sync is a direct app-to-app handoff on the same phone, via an Android deep link:

1. Time a session in Allies (timer or stopwatch) with a free-text label.
2. Tap **Send to Study Planner** (enabled after 1 minute). Allies checks Study
   Planner is installed, then opens a link of the form
   `studyplanner://session?label=...&date=YYYY-MM-DD&start=HH:MM&end=HH:MM&minutes=N&source=allies`.
3. Study Planner opens with a dialog showing the label, date and times. Pick a
   subject and chapter, save it as a confirmed plan — or discard it.

Each side also keeps its own local copy: Allies stores a history list
("N sessions today"), Study Planner stores the confirmed plan.

## Repo layout

- `apps/allies` — the Next.js app (static export) + Capacitor Android project
  (`apps/allies/android`, appId `com.allies.app`).
- `.github/workflows/build-apk.yml` — builds `Allies.apk` on every push to `main`.

## Development

```bash
npm install          # at repo root (npm workspaces)
cd apps/allies
npm run dev          # local dev server
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run build        # icons + static export to out/
```

## APK releases

Pushing to `main` triggers the Build APK workflow: web build, `cap sync`,
`assembleRelease`, then publishes `Allies.apk` to GitHub Releases.
The release tag comes from `apps/allies/version.json` (currently `0.1.0` → `v0.1.0`).
Release signing uses a keystore generated once by the workflow itself.

## Requirements

- For the handoff to work on-device, the Study Planner app must be installed
  (it registers the `studyplanner://` scheme). Without it, Allies still works
  standalone and keeps its local session history.
