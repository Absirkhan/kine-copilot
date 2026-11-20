# Claude Code: integrate KineCopilotPanel into the existing Next.js app

You have access to two design-prototype files alongside this prompt:

- `KineCopilot.html` — the visual reference (all five states rendered)
- `kinecopilot-app.jsx` — the React implementation in plain JSX with CSS variables

Both files use a monochrome palette (`#000` bg, `#121212` surfaces, `#27272A` borders, white CTA, severity green/amber/red) and a 4-step processing pipeline: **Extract Frames → Detect Pose → Serialize → Agent Reasoning**.

---

## Your job

Port the prototype into the current Next.js 14 codebase as a single self-contained Tailwind component:

```
src/components/KineCopilotPanel.tsx        // primary deliverable
```

`export default function KineCopilotPanel({ apiUrl }: { apiUrl?: string })`.

The component must drop into an existing page and work immediately, no extra config beyond what Tailwind already provides.

---

## Step 0 — explore before writing

**Do not start coding yet.** First:

1. Read `package.json` to confirm Next.js + Tailwind versions and any existing UI libs (don't introduce new ones — no shadcn, no recharts, no chart.js, no framer-motion).
2. Walk the project tree and identify:
   - the components directory convention (`src/components`, `app/components`, `components/`)
   - how existing components are styled (Tailwind classes? CSS modules? `cn()` helper?)
   - whether `dark:` variants are in use or the app is already always-dark
   - any existing typography, spacing, or color tokens in `tailwind.config.{ts,js}` and `globals.css`
3. Read 2–3 existing components to match the local code style (named vs default export, prop typing patterns, file headers).
4. Summarize what you found in one paragraph before writing any code.

---

## Step 1 — port the component

Translate `kinecopilot-app.jsx` into one TypeScript file:

- Single default export `KineCopilotPanel`
- Keep all five conditional states (upload / processing / results / error / reset) inside this one component — render based on a `view` state machine
- Replace the inline CSS variables with Tailwind utility classes wherever practical; keep a small `<style jsx>` (or single `<style>` tag) only for the score-circle keyframe and the bar-grow keyframe — both depend on dynamic values that don't translate to Tailwind cleanly
- All state via `useState` / `useRef` only — **no** `localStorage`, cookies, or external state libs
- Strict TypeScript: no `any`, type the `AnalysisResponse` shape exactly as in the brief, type all props and event handlers
- Drag-and-drop must use `onDragOver`, `onDragLeave`, `onDrop` (not a third-party uploader)
- Score circle: SVG `strokeDasharray = circumference`, `strokeDashoffset = circumference * (1 - score/100)`, animated via CSS `transition` on the `strokeDashoffset` style — no JS animation loop
- Observation cards stagger in via `style={{ animationDelay: \`${index * 100}ms\` }}` on a CSS `fadeUp` keyframe
- Drill collapsible: CSS `max-height` transition (smooth, not abrupt)
- Agent reasoning block: dark inset bg `#000`, monospace, blinking green terminal cursor at the end

---

## Step 2 — wire the API

```
fetch(`${apiUrl ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/analyze`, {
  method: 'POST',
  body: formData,   // multipart/form-data
})
```

- For video uploads: `formData.append('file', file)`, `formData.append('sport', sport)`, `formData.append('level', level)`
- For pasted JSON: `formData.append('poses', json)`, plus the sport/level fields
- Response is typed as `AnalysisResponse` (see contract below)
- On non-2xx OR network failure, transition to the error state and surface a `request_id` if present in the response

While waiting, the UI runs the 4-step `AnalysisProgress` stepper. The pipeline copy and telemetry-style readout in the prototype are decorative — drive the visual progress on a fixed interpolation so users always see the full sequence even on a fast response.

---

## Step 3 — wire the data contract

Type and use this exact shape:

```ts
interface CoachingObservation {
  joint: string;
  severity: 'good' | 'warning' | 'critical';
  observation: string;
  correction: string;
  drill?: string;
}

interface AnalysisResponse {
  session_id: string;
  sport: string;
  overall_score: number;          // 0-100
  summary: string;
  observations: CoachingObservation[];
  key_frames: number[];
  agent_reasoning: string;
  processing_time_ms: number;
}
```

The mock object in the prototype (`MOCK_RESULT`) is the canonical example for fixture-driven Storybook / dev-mode rendering. Keep it exported as a named `MOCK_ANALYSIS_RESPONSE` for tests and Storybook.

---

## Step 4 — joint-angle bar chart logic

Color each bar by range:

| Joint | Normal range (deg) |
|---|---|
| `left_knee`, `right_knee` | 85–150 |
| `left_hip`, `right_hip` | 80–170 |
| `left_elbow`, `right_elbow` | 140–180 |
| `left_shoulder`, `right_shoulder` | 60–160 |
| `spine_lean` | 35–55 |

Rule:
- inside range → `green`
- ≤ 15° outside → `amber`
- > 15° outside → `red`

Bar fill uses a per-severity inset `box-shadow` glow matching the bar color (see prototype CSS).

---

## Step 5 — verify and hand back

1. Run `pnpm tsc --noEmit` (or whatever the repo's typecheck script is) — must be zero errors.
2. Run the linter — fix anything it flags.
3. Drop a temporary `<KineCopilotPanel />` mount on a dev route (`app/dev/kinecopilot/page.tsx` or similar) so the user can sanity-check all five states using a tiny dev-only `view` switcher in the corner.
4. Report back with:
   - the file paths you created or modified
   - any deviations from the prototype and why
   - any tokens you added to `tailwind.config` or `globals.css`

---

## Hard constraints — do not violate

- **No new dependencies.** Tailwind + React + Next is the entire toolbox.
- **No `any`.** Type everything.
- **No localStorage / cookies / global state.**
- **No external animation libs.** CSS keyframes + transitions only.
- **Single file** for the component — splitting into sub-components inside the same file is fine, but everything ships from `KineCopilotPanel.tsx`.
- **Match the visual fidelity of the prototype.** If a Tailwind utility doesn't exist for what you need, use arbitrary values (`bg-[#121212]`) — do not approximate.

When in doubt, open `KineCopilot.html` in a browser to confirm the intended look.
