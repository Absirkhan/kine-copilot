// KineCopilot — full prototype (all five states + transitions)
// React 18 + Tailwind-flavored utility classes via inline className helpers
// (this file uses plain CSS classes; production component lives in KineCopilotPanel.tsx)

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Mock data (matches the AnalysisResponse contract from the brief) ──────────
const MOCK_RESULT = {
  session_id: "kc_20260508_001",
  sport: "squat",
  overall_score: 74,
  summary:
    "Good overall depth and spine neutrality. Primary issue is right knee valgus collapse at the bottom of the movement (frame 12), with a secondary asymmetry in hip flexion angle of 11.2° — right hip significantly tighter than left. Focus on glute activation drills before lifting sessions.",
  observations: [
    {
      joint: "right_knee",
      severity: "critical",
      observation:
        "Right knee collapses inward at 74.1° at bottom position (frame 12). 37.8° below mean — consistent valgus pattern across 3 reps.",
      correction:
        "Drive knees out actively in line with toes throughout the descent. Cue: 'spread the floor with your feet'.",
      drill:
        "Banded squat walkouts: 3 sets of 12 reps with a light resistance band above the knees. Focus on maintaining band tension throughout.",
    },
    {
      joint: "right_hip",
      severity: "warning",
      observation:
        "Right hip flexion 11.2° less than left at equivalent depth. Indicates right hip flexor tightness or mobility restriction.",
      correction:
        "Ensure even weight distribution. Consider slightly wider stance to accommodate right hip anatomy.",
      drill:
        "90/90 hip stretch: 2 minutes per side, 2x daily. Prioritise right side.",
    },
    {
      joint: "spine_lean",
      severity: "good",
      observation:
        "Spine angle consistent at 42–48° forward lean throughout movement. Within normal range for back squat.",
      correction: "No correction needed. Maintain current torso positioning.",
      drill: undefined,
    },
    {
      joint: "left_knee",
      severity: "good",
      observation:
        "Left knee tracking well over toes across all frames. Angle range 91–143° — textbook squat mechanics.",
      correction: "No correction needed.",
      drill: undefined,
    },
  ],
  key_frames: [12, 18, 24],
  agent_reasoning:
    "Step 1: analyzed left_knee → normal range (91–143°). Step 2: analyzed right_knee → CRITICAL, valgus collapse at frame 12 (74.1°, 37.8° below mean). Step 3: computed symmetry score → 11.2° hip asymmetry flagged. Step 4: looked up drill for valgus_collapse → banded squat walkouts. Step 5: overall score computed: base 100, -18 for critical finding, -8 for warning finding = 74.",
  processing_time_ms: 3240,
};

// Joint normal ranges from the brief
const JOINT_RANGES = {
  left_knee:      [85, 150],
  right_knee:     [85, 150],
  left_hip:       [80, 170],
  right_hip:      [80, 170],
  left_elbow:    [140, 180],
  right_elbow:   [140, 180],
  left_shoulder:  [60, 160],
  right_shoulder: [60, 160],
  spine_lean:     [35,  55],
};

// Synthesized per-joint angle readings (key-frame snapshot of the squat)
const JOINT_VALUES = [
  { joint: "left_knee",    value: 143.0 },
  { joint: "right_knee",   value:  74.1 },
  { joint: "left_hip",     value: 167.2 },
  { joint: "right_hip",    value: 156.0 },
  { joint: "spine_lean",   value:  45.3 },
];

function severityForJoint(joint, value) {
  const r = JOINT_RANGES[joint];
  if (!r) return "good";
  const [lo, hi] = r;
  if (value >= lo && value <= hi) return "good";
  const dist = value < lo ? lo - value : value - hi;
  return dist <= 15 ? "warning" : "critical";
}

const SEV = {
  good:     { label: "Good",     color: "var(--good)", pill: "pill-good",  bar: "sev-good",  fill: "good"  },
  warning:  { label: "Warning",  color: "var(--warn)", pill: "pill-warn",  bar: "sev-warn",  fill: "warn"  },
  critical: { label: "Critical", color: "var(--crit)", pill: "pill-crit",  bar: "sev-crit",  fill: "crit"  },
};

const SPORTS = ["Squat", "Running", "Tennis Serve", "Push-up", "Deadlift", "General"];
const LEVELS = ["Amateur", "Intermediate", "Advanced"];

const PIPELINE_STEPS = [
  { key: "extract",  label: "Extract Frames",  copy: "Sampling key frames at 30fps…" },
  { key: "pose",     label: "Detect Pose",     copy: "Locating 33 body landmarks per frame…" },
  { key: "serial",   label: "Serialize",       copy: "Computing joint angles & symmetry deltas…" },
  { key: "agent",    label: "Agent Reasoning", copy: "Cross-referencing biomechanics priors…" },
];

// ── Small helpers ─────────────────────────────────────────────────────────────
const Icon = {
  Upload: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  ),
  Play: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 5v14l12-7z" /></svg>
  ),
  Reset: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
    </svg>
  ),
  Caret: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  Alert: (p) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  Check: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  ),
  File: (p) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" />
    </svg>
  ),
  Spark: (p) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>
    </svg>
  ),
};

function BrandMark() {
  return (
    <span className="mark" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EDEDED" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="4.5" r="1.6" fill="#EDEDED" stroke="none" />
        <path d="M12 7v4l-4 4 2 5" />
        <path d="M12 11l4 4-2 5" />
        <path d="M9 9l6 0" opacity=".55" />
      </svg>
    </span>
  );
}

// ── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar({ sessionId, onReset, view }) {
  return (
    <div className="topbar" style={{ position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandMark />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontWeight: 700, letterSpacing: ".01em" }}>KineCopilot</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".04em" }}>
              v0.4 · BIOMECH
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {sessionId && (
            <span className="mono tnum" style={{ fontSize: 11, color: "var(--muted)" }}>
              SESSION&nbsp;<span style={{ color: "var(--muted-2)" }}>{sessionId}</span>
            </span>
          )}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--good)", boxShadow: "0 0 8px var(--good)" }} />
            <span className="mono" style={{ letterSpacing: ".04em" }}>API ONLINE</span>
          </span>
          {view === "results" && (
            <button className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 12 }} onClick={onReset}>
              <Icon.Reset /> New analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload View ───────────────────────────────────────────────────────────────
function UploadView({ onAnalyze, justReset }) {
  const [over, setOver] = useState(false);
  const [file, setFile] = useState(null);
  const [sport, setSport] = useState("Squat");
  const [level, setLevel] = useState("Intermediate");
  const [showJson, setShowJson] = useState(false);
  const [json, setJson] = useState("");
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div className={`fade-up ${justReset ? "bloom" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Hero copy */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 4 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: ".12em", marginBottom: 10 }}>
            01 · INGEST
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-.02em" }}>
            Upload movement footage
          </h1>
          <p style={{ margin: "8px 0 0", color: "var(--muted-2)", maxWidth: 560, fontSize: 14, lineHeight: 1.55 }}>
            Drop a clip of the athlete performing the movement. KineCopilot extracts pose, computes joint angles, and surfaces coaching cues with frame-level precision.
          </p>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", lineHeight: 1.7 }}>
          <div>FRAMES&nbsp;<span style={{ color: "var(--muted-2)" }}>30 fps · 1080p max</span></div>
          <div>MODEL&nbsp;<span style={{ color: "var(--muted-2)" }}>kc-pose-v3 · agent-7b</span></div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`drop ${over ? "is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{ padding: "56px 28px", textAlign: "center", cursor: "pointer" }}
      >
        <input ref={inputRef} type="file" accept=".mp4,.mov,.avi,.json" style={{ display: "none" }}
               onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, display: "grid", placeItems: "center",
            background: "linear-gradient(180deg, #1a1a1a, #0d0d0d)", border: "1px solid #2a2a2a",
            color: "#EDEDED", boxShadow: "0 12px 40px -12px rgba(255,255,255,.18), inset 0 1px 0 rgba(255,255,255,.05)"
          }}>
            <Icon.Upload />
          </div>
          {file ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              <div className="mono" style={{ fontSize: 13, color: "var(--fg)", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon.File /> {file.name}
              </div>
              <div className="mono tnum" style={{ fontSize: 11, color: "var(--muted)" }}>
                {(file.size / (1024 * 1024)).toFixed(2)} MB · ready
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                Drop a clip here, or <span style={{ color: "var(--accent)" }}>browse files</span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".06em" }}>
                .MP4 &nbsp;·&nbsp; .MOV &nbsp;·&nbsp; .AVI &nbsp;·&nbsp; .JSON
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Sport selector */}
        <div className="card" style={{ padding: 16 }}>
          <label className="mono" style={{ display: "block", fontSize: 10, letterSpacing: ".12em", color: "var(--muted)", marginBottom: 10 }}>
            SPORT / MOVEMENT
          </label>
          <div style={{ position: "relative" }}>
            <select
              className="kc-select mono"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              style={{
                width: "100%", padding: "12px 14px", background: "#0d0d0d",
                color: "var(--fg)", border: "1px solid var(--border-strong)", borderRadius: 8,
                fontSize: 14, fontFamily: "var(--mono)",
              }}
            >
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Level toggle */}
        <div className="card" style={{ padding: 16 }}>
          <label className="mono" style={{ display: "block", fontSize: 10, letterSpacing: ".12em", color: "var(--muted)", marginBottom: 10 }}>
            ATHLETE LEVEL
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, padding: 4, background: "#0d0d0d", border: "1px solid var(--border-strong)", borderRadius: 10 }}>
            {LEVELS.map((l) => {
              const active = level === l;
              return (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  style={{
                    padding: "8px 10px", fontSize: 12, fontWeight: 600,
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "var(--accent-ink)" : "var(--muted-2)",
                    border: 0, borderRadius: 7, cursor: "default", transition: "all .15s ease",
                    boxShadow: active ? "0 4px 14px -4px rgba(255,255,255,.25)" : "none",
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* JSON paste expander */}
      <div className="card" style={{ overflow: "hidden" }}>
        <button
          onClick={() => setShowJson((v) => !v)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                   padding: "14px 18px", background: "transparent", border: 0, color: "var(--fg)", cursor: "default" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span className="pill pill-muted">advanced</span>
            Paste raw pose JSON for precomputed analysis
          </span>
          <span style={{ transition: "transform .2s ease", transform: showJson ? "rotate(180deg)" : "none", color: "var(--muted)" }}>
            <Icon.Caret />
          </span>
        </button>
        <div className="drill" style={{ maxHeight: showJson ? 220 : 0, opacity: showJson ? 1 : 0, padding: showJson ? "0 18px 18px" : "0 18px" }}>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"frames": [...], "landmarks": [...]}'
            spellCheck={false}
            className="mono"
            style={{
              width: "100%", minHeight: 140, resize: "vertical",
              background: "var(--bg)", color: "var(--fg)", border: "1px solid var(--border)",
              borderRadius: 8, padding: 12, fontSize: 12.5, lineHeight: 1.6, outline: "none",
            }}
          />
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 4 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
          {file || json ? "Ready to analyze." : "Awaiting input…"}
        </div>
        <button
          className="btn btn-primary"
          disabled={!file && !json}
          onClick={() => onAnalyze({ sport, level, file: file?.name || "json" })}
          style={{ minWidth: 200 }}
        >
          <Icon.Play /> Analyze Form
        </button>
      </div>
    </div>
  );
}

// ── Processing View ───────────────────────────────────────────────────────────
function ProcessingView({ onComplete, simulate }) {
  const [step, setStep] = useState(0);
  const [eta, setEta] = useState(8);

  useEffect(() => {
    if (!simulate) return;
    const stepDur = 1100;
    const t = setTimeout(() => {
      if (step < PIPELINE_STEPS.length - 1) setStep((s) => s + 1);
      else onComplete?.();
    }, stepDur);
    const tick = setInterval(() => setEta((e) => Math.max(0, +(e - 0.1).toFixed(1))), 100);
    return () => { clearTimeout(t); clearInterval(tick); };
  }, [step, simulate]);

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 30 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: ".12em", marginBottom: 10 }}>
            02 · ANALYSIS IN PROGRESS
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-.02em" }}>
            Reading the movement
          </h1>
          <p style={{ margin: "8px 0 0", color: "var(--muted-2)", maxWidth: 540, fontSize: 14, lineHeight: 1.55, transition: "opacity .3s ease" }} key={step}>
            <span className="fade-in">{PIPELINE_STEPS[step].copy}</span>
          </p>
        </div>
        <div className="mono tnum" style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".08em" }}>EST. REMAINING</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--fg)", marginTop: 2 }}>
            {eta.toFixed(1)}<span style={{ fontSize: 14, color: "var(--muted)" }}>s</span>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="card" style={{ padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${PIPELINE_STEPS.length}, 1fr)`, alignItems: "start", position: "relative" }}>
          {PIPELINE_STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <div key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, position: "relative", zIndex: 2 }}>
                <StepDot state={state} index={i} />
                <div style={{ textAlign: "center" }}>
                  <div className="mono" style={{
                    fontSize: 11, letterSpacing: ".06em",
                    color: state === "pending" ? "var(--muted)" : "var(--fg)",
                    transition: "color .3s ease"
                  }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{
                    marginTop: 4, fontSize: 13, fontWeight: 600,
                    color: state === "active" ? "var(--accent)" : state === "done" ? "var(--fg)" : "var(--muted)",
                    transition: "color .3s ease"
                  }}>
                    {s.label}
                  </div>
                </div>
              </div>
            );
          })}
          {/* connecting line behind dots */}
          <div style={{
            position: "absolute", left: "12.5%", right: "12.5%", top: 16, height: 1,
            background: "var(--border)", zIndex: 1,
          }} />
          <div style={{
            position: "absolute", left: "12.5%", top: 16, height: 1,
            width: `${(step / (PIPELINE_STEPS.length - 1)) * 75}%`,
            background: "linear-gradient(90deg, transparent, var(--accent))",
            transition: "width .8s cubic-bezier(.4,1,.4,1)", zIndex: 1,
          }} />
        </div>

        {/* Sub-progress: telemetry-style mini readout */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px dashed var(--border)" }}>
          <Telemetry step={step} />
        </div>
      </div>
    </div>
  );
}

function StepDot({ state, index }) {
  const isActive = state === "active";
  const isDone = state === "done";
  return (
    <div style={{ position: "relative", width: 32, height: 32 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: isDone ? "var(--accent)" : isActive ? "rgba(255,255,255,.08)" : "#0f0f0f",
        border: "1px solid",
        borderColor: isDone ? "var(--accent)" : isActive ? "var(--accent)" : "var(--border-strong)",
        display: "grid", placeItems: "center",
        boxShadow: isActive ? "0 0 0 6px rgba(255,255,255,.05)" : "none",
        transition: "all .3s ease",
      }}>
        {isDone ? <Icon.Check style={{ color: "var(--accent-ink)" }} /> :
          isActive ? <ActivePulse /> :
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{index + 1}</span>}
      </div>
    </div>
  );
}

function ActivePulse() {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: 2, background: "var(--accent)",
          animation: "pulse-dot 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function Telemetry({ step }) {
  const lines = [
    [["FRAMES_SAMPLED", "0142 / 0220"], ["RESOLUTION", "1080×1920"], ["DURATION", "7.34s"]],
    [["LANDMARKS",      "33 / 33"],     ["CONFIDENCE", "0.96"],     ["DROPPED",  "00"]],
    [["JOINTS",         "9 tracked"],   ["SYMMETRY_Δ", "11.2°"],    ["VARIANCE", "0.42"]],
    [["TOOLS_INVOKED",  "4"],           ["TOKENS",      "1,842"],   ["PRIORS",   "kc-bio-2026"]],
  ];
  const [l0, l1, l2] = [lines[step][0], lines[step][1], lines[step][2]];
  return (
    <div className="mono" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, fontSize: 11.5, animation: "fade-in .5s ease both" }} key={step}>
      {[l0, l1, l2].map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
          <span style={{ letterSpacing: ".06em" }}>{k}</span>
          <span style={{ color: "var(--fg)" }} className="tnum">{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── Score Circle ──────────────────────────────────────────────────────────────
function ScoreCircle({ score, size = 220 }) {
  const r = 92;
  const circ = 2 * Math.PI * r;
  const target = circ * (1 - score / 100);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  // Score-band color
  const band = score >= 80 ? "var(--good)" : score >= 60 ? "var(--warn)" : "var(--crit)";
  const bandLabel = score >= 80 ? "STRONG" : score >= 60 ? "DEVELOPING" : "AT RISK";

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg className="score-glow" width={size} height={size} viewBox="0 0 220 220" style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="score-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={band} stopOpacity="0.7" />
            <stop offset="100%" stopColor={band} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* track */}
        <circle cx="110" cy="110" r={r} fill="none" stroke="#1a1a1a" strokeWidth="10" />
        {/* tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const x1 = 110 + Math.cos(a) * (r + 10), y1 = 110 + Math.sin(a) * (r + 10);
          const x2 = 110 + Math.cos(a) * (r + 14), y2 = 110 + Math.sin(a) * (r + 14);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#222" strokeWidth={i % 5 === 0 ? "1.4" : ".8"} />;
        })}
        {/* progress */}
        <circle
          cx="110" cy="110" r={r} fill="none" stroke="url(#score-grad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? target : circ}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)" }}
        />
      </svg>
      {/* center */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: ".14em" }}>FORM SCORE</div>
        <div className="mono tnum" style={{ fontSize: 64, fontWeight: 700, lineHeight: 1, marginTop: 6, color: "var(--fg)", animation: "count-up .8s ease both", animationDelay: ".4s" }}>
          {score}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: band, letterSpacing: ".14em", marginTop: 8, fontWeight: 600 }}>
          ◆ {bandLabel}
        </div>
      </div>
    </div>
  );
}

// ── Joint Angle Chart ─────────────────────────────────────────────────────────
function JointAngleChart({ values }) {
  // Use a normalized scale 0–200° for the bar fill width.
  const SCALE_MAX = 200;
  return (
    <div className="card" style={{ padding: 22 }}>
      <ChartHeader title="Joint angles" subtitle="key-frame snapshot" />
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
        {values.map(({ joint, value }, i) => {
          const range = JOINT_RANGES[joint];
          const sev = severityForJoint(joint, value);
          const fillKey = sev === "good" ? "good" : sev === "warning" ? "warn" : "crit";
          const widthPct = Math.min(100, (value / SCALE_MAX) * 100);
          const rangeLeftPct = (range[0] / SCALE_MAX) * 100;
          const rangeWidthPct = ((range[1] - range[0]) / SCALE_MAX) * 100;
          return (
            <div key={joint} style={{ display: "grid", gridTemplateColumns: "140px 1fr 84px", gap: 14, alignItems: "center", animation: "fade-up .5s ease both", animationDelay: `${i * 70}ms` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: SEV[sev].color }} />
                <span className="mono" style={{ fontSize: 12, color: "var(--muted-2)", letterSpacing: ".02em" }}>
                  {joint.replace("_", " ")}
                </span>
              </div>
              <div className="joint-track">
                {/* normal-range strip */}
                <div className="joint-range" style={{ left: `${rangeLeftPct}%`, width: `${rangeWidthPct}%` }} />
                <div className={`joint-fill ${fillKey}`} style={{ width: `${widthPct}%`, animationDelay: `${i * 90 + 200}ms` }} />
              </div>
              <div className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", textAlign: "right" }}>
                {value.toFixed(1)}<span style={{ color: "var(--muted)", fontWeight: 400 }}>°</span>
              </div>
            </div>
          );
        })}
      </div>
      {/* legend */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px dashed var(--border)", display: "flex", gap: 18, flexWrap: "wrap" }}>
        {[
          ["good", "in normal range"],
          ["warn", "≤ 15° outside"],
          ["crit", "> 15° outside"],
        ].map(([k, label]) => (
          <span key={k} className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--muted)" }}>
            <span style={{ width: 14, height: 6, borderRadius: 2, background: `var(--${k === "warn" ? "warn" : k === "crit" ? "crit" : "good"})` }} />
            {label}
          </span>
        ))}
        <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
          <span style={{ width: 14, height: 6, borderRadius: 2, background: "rgba(255,255,255,.06)", border: "1px dashed rgba(255,255,255,.15)" }} />
          normal-range band
        </span>
      </div>
    </div>
  );
}

function ChartHeader({ title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-.005em" }}>{title}</h3>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase" }}>
        {subtitle}
      </span>
    </div>
  );
}

// ── Observation Card ──────────────────────────────────────────────────────────
function ObservationCard({ obs, index }) {
  const [open, setOpen] = useState(false);
  const sev = SEV[obs.severity];
  return (
    <div className="obs-card" style={{ animationDelay: `${index * 100}ms` }}>
      <span className={`sev-bar ${sev.bar}`} />
      <div className="obs-grid-bg" />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className={`pill ${sev.pill}`}>{obs.joint.replace("_", " ")}</span>
            <span className="mono" style={{ fontSize: 11, color: sev.color, letterSpacing: ".08em", fontWeight: 600 }}>
              {sev.label.toUpperCase()}
            </span>
          </div>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            FRAME&nbsp;<span style={{ color: "var(--muted-2)" }} className="tnum">{12 + index * 2}</span>
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--fg)" }}>
          {obs.observation}
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingTop: 4 }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: ".12em", marginTop: 3, minWidth: 64 }}>
            FIX
          </span>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--muted-2)" }}>
            {obs.correction}
          </p>
        </div>

        {obs.drill && (
          <>
            <button
              onClick={() => setOpen((v) => !v)}
              style={{
                marginTop: 4, alignSelf: "flex-start",
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px 7px 10px", background: "transparent",
                border: "1px solid var(--border-strong)", borderRadius: 8,
                color: "var(--fg)", fontSize: 12, fontWeight: 500, cursor: "default",
                transition: "all .15s ease",
              }}
            >
              <Icon.Spark style={{ color: sev.color }} />
              {open ? "Hide drill" : "View drill"}
              <span style={{ display: "inline-block", marginLeft: 4, transition: "transform .2s ease", transform: open ? "rotate(180deg)" : "none", color: "var(--muted)" }}>
                <Icon.Caret />
              </span>
            </button>
            <div className={`drill ${open ? "open" : ""}`}>
              <div style={{
                background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
                padding: "14px 16px", marginTop: 4,
                display: "flex", gap: 14, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: `${sev.color}1a`, border: `1px solid ${sev.color}33`,
                  display: "grid", placeItems: "center", color: sev.color,
                }}>
                  <Icon.Spark />
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: ".12em", marginBottom: 4 }}>
                    PRESCRIBED DRILL
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--fg)", lineHeight: 1.6 }}>
                    {obs.drill}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Agent Reasoning ───────────────────────────────────────────────────────────
function AgentReasoning({ raw, processingMs }) {
  const [open, setOpen] = useState(false);
  // Split & colorize "Step N: ..."
  const lines = useMemo(() => raw.split(/(?=Step \d+:)/g).map((s) => s.trim()).filter(Boolean), [raw]);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", background: "transparent", border: 0, color: "var(--fg)", cursor: "default",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: "var(--good)", boxShadow: "0 0 8px var(--good)" }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Agent reasoning trace</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            {lines.length} steps · {(processingMs / 1000).toFixed(2)}s
          </span>
        </span>
        <span style={{ transition: "transform .2s ease", transform: open ? "rotate(180deg)" : "none", color: "var(--muted)" }}>
          <Icon.Caret />
        </span>
      </button>
      <div className="drill" style={{ maxHeight: open ? 600 : 0, opacity: open ? 1 : 0, padding: open ? "0 20px 20px" : "0 20px" }}>
        <div className="code-block">
          {lines.map((l, i) => {
            // colorize keywords
            const colored = l
              .replace(/(CRITICAL)/g, '<span class="kw-crit">$1</span>')
              .replace(/(WARNING)/g, '<span class="kw-warn">$1</span>')
              .replace(/(normal range)/gi, '<span class="kw-good">$1</span>')
              .replace(/(\b\d+(?:\.\d+)?°?\b)/g, '<span class="kw-num">$1</span>');
            return (
              <div key={i} style={{ display: "flex", gap: 12 }}>
                <span className="step-num" style={{ width: 22, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <span dangerouslySetInnerHTML={{ __html: colored }} />
              </div>
            );
          })}
          <div style={{ marginTop: 8, color: "var(--muted)" }}>
            <span className="step-num" style={{ marginRight: 12 }}>{String(lines.length + 1).padStart(2, "0")}</span>
            $ <span className="cursor" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Results View ──────────────────────────────────────────────────────────────
function ResultsView({ result }) {
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, paddingTop: 8 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: ".12em", marginBottom: 8 }}>
            03 · ANALYSIS COMPLETE
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", textTransform: "capitalize" }}>
            {result.sport} · session report
          </h1>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", lineHeight: 1.7 }}>
          <div>SESSION&nbsp;<span style={{ color: "var(--muted-2)" }} className="tnum">{result.session_id}</span></div>
          <div>RUNTIME&nbsp;<span style={{ color: "var(--muted-2)" }} className="tnum">{(result.processing_time_ms / 1000).toFixed(2)}s</span></div>
        </div>
      </div>

      {/* Score + summary */}
      <div className="card" style={{ padding: "32px 28px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 32, alignItems: "center" }}>
        <ScoreCircle score={result.overall_score} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="pill pill-crit">1 critical</span>
            <span className="pill pill-warn">1 warning</span>
            <span className="pill pill-good">2 good</span>
            <span className="pill pill-muted">{result.key_frames.length} key frames</span>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--fg)" }}>
            {result.summary}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            {result.key_frames.map((f) => (
              <KeyFrameThumb key={f} frame={f} />
            ))}
          </div>
        </div>
      </div>

      {/* Joint chart */}
      <JointAngleChart values={JOINT_VALUES} />

      {/* Observations */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Observations</h3>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase" }}>
            {result.observations.length} findings · sorted by severity
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...result.observations]
            .sort((a, b) => ["critical","warning","good"].indexOf(a.severity) - ["critical","warning","good"].indexOf(b.severity))
            .map((o, i) => (
              <ObservationCard key={o.joint} obs={o} index={i} />
            ))}
        </div>
      </div>

      {/* Reasoning */}
      <AgentReasoning raw={result.agent_reasoning} processingMs={result.processing_time_ms} />
    </div>
  );
}

function KeyFrameThumb({ frame }) {
  return (
    <div style={{
      width: 80, height: 56, borderRadius: 8,
      background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)",
      border: "1px solid var(--border)",
      position: "relative", overflow: "hidden",
      display: "grid", placeItems: "center",
    }}>
      {/* fake stick figure silhouette */}
      <svg width="46" height="38" viewBox="0 0 46 38" fill="none" stroke="#EDEDED" strokeOpacity=".5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="23" cy="6" r="2.6" />
        <path d="M23 9 v8" />
        <path d="M16 13 L23 17 L30 13" />
        <path d="M23 17 L18 27 L20 36" />
        <path d="M23 17 L28 27 L26 36" />
      </svg>
      <span className="mono tnum" style={{ position: "absolute", bottom: 4, left: 6, fontSize: 9, color: "var(--muted)" }}>
        f{frame}
      </span>
      <span style={{ position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: 3, background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
    </div>
  );
}

// ── Error View ────────────────────────────────────────────────────────────────
function ErrorView({ onRetry }) {
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "60px 20px", gap: 22 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)",
        display: "grid", placeItems: "center", color: "var(--crit)",
        boxShadow: "0 12px 40px -12px rgba(239,68,68,.4)",
      }}>
        <Icon.Alert />
      </div>
      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--crit)", letterSpacing: ".14em", marginBottom: 8 }}>
          ERR · KC_502 · UPSTREAM
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-.01em" }}>
          Pose detection failed
        </h1>
        <p style={{ margin: "10px auto 0", color: "var(--muted-2)", maxWidth: 460, fontSize: 14, lineHeight: 1.6 }}>
          We couldn't extract reliable landmarks from the clip. Common causes: low light, partial body in frame, or unsupported codec.
          Try a clip with the full body visible, well lit, in MP4 format.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={onRetry}><Icon.Reset />Try again</button>
        <button className="btn btn-ghost">View troubleshooting</button>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        REQUEST_ID&nbsp;<span style={{ color: "var(--muted-2)" }}>req_a4f3c11e</span>
      </div>
    </div>
  );
}

// ── App / Router ──────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "view": "upload",
  "autoAdvance": true,
  "demoSeverity": "mixed"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useState("upload"); // upload | processing | results | error
  const [justReset, setJustReset] = useState(false);
  const [config, setConfig] = useState(null);

  // Tweaks-driven view override
  useEffect(() => {
    if (t.view && t.view !== view) setView(t.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.view]);

  const goAnalyze = useCallback((cfg) => {
    setConfig(cfg);
    setView("processing");
    setTweak("view", "processing");
  }, [setTweak]);

  const onProcessingDone = useCallback(() => {
    setView("results");
    setTweak("view", "results");
  }, [setTweak]);

  const reset = useCallback(() => {
    setView("upload");
    setTweak("view", "upload");
    setJustReset(true);
    setTimeout(() => setJustReset(false), 900);
  }, [setTweak]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      <TopBar
        sessionId={view === "results" ? MOCK_RESULT.session_id : null}
        view={view}
        onReset={reset}
      />
      <main style={{ flex: 1, maxWidth: 960, width: "100%", margin: "0 auto", padding: "32px 24px 80px" }}>
        {view === "upload"     && <UploadView onAnalyze={goAnalyze} justReset={justReset} />}
        {view === "processing" && <ProcessingView onComplete={onProcessingDone} simulate={t.autoAdvance} />}
        {view === "results"    && <ResultsView result={MOCK_RESULT} />}
        {view === "error"      && <ErrorView onRetry={reset} />}
      </main>

      {/* Footer breadcrumbs */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "16px 24px" }}>
        <div className="mono" style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 11, letterSpacing: ".04em" }}>
          <span>KINECOPILOT · BIOMECHANICS COACHING</span>
          <span>{new Date().getFullYear()} · BUILT FOR ATHLETES, COACHES & SPORTS STUDENTS</span>
        </div>
      </footer>

      <TweaksPanel>
        <TweakSection label="Prototype state" />
        <TweakRadio
          label="View"
          value={view}
          options={["upload", "processing", "results", "error"]}
          onChange={(v) => { setView(v); setTweak("view", v); }}
        />
        <TweakToggle
          label="Auto-advance processing"
          value={!!t.autoAdvance}
          onChange={(v) => setTweak("autoAdvance", v)}
        />
        <TweakSection label="Quick actions" />
        <TweakButton label="Reset to upload" onClick={reset} />
        <TweakButton label="Run full demo flow" onClick={() => { setView("processing"); setTweak("view", "processing"); }} />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
