'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface CoachingObservation {
  joint: string
  severity: 'good' | 'warning' | 'critical'
  observation: string
  correction: string
  drill: string | null
}

interface AnalysisResponse {
  session_id: string
  sport: string
  overall_score: number
  summary: string
  observations: CoachingObservation[]
  key_frames: number[]
  agent_reasoning: string
  processing_time_ms: number
}

type ViewState = 'upload' | 'processing' | 'results'
type ProcessingStep = 'extract' | 'pose' | 'serial' | 'agent'

interface JointValue {
  joint: string
  value: number
}

interface JointRange {
  [key: string]: [number, number]
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SPORTS = ['Squat', 'Running', 'Tennis Serve', 'Push-up', 'Deadlift', 'General']
const LEVELS = ['Amateur', 'Intermediate', 'Advanced'] as const

const PIPELINE_STEPS: Array<{ key: ProcessingStep; label: string; copy: string }> = [
  { key: 'extract', label: 'Extract Frames', copy: 'Sampling key frames at 30fps…' },
  { key: 'pose', label: 'Detect Pose', copy: 'Locating 33 body landmarks per frame…' },
  { key: 'serial', label: 'Serialize', copy: 'Computing joint angles & symmetry deltas…' },
  { key: 'agent', label: 'Agent Reasoning', copy: 'Cross-referencing biomechanics priors…' },
]

const JOINT_RANGES: JointRange = {
  left_knee: [85, 150],
  right_knee: [85, 150],
  left_hip: [80, 170],
  right_hip: [80, 170],
  left_elbow: [140, 180],
  right_elbow: [140, 180],
  left_shoulder: [60, 160],
  right_shoulder: [60, 160],
  spine_lean: [35, 55],
}

const SEV = {
  good: { label: 'Good', color: 'var(--good)', pill: 'pill-good', bar: 'sev-good', fill: 'good' },
  warning: { label: 'Warning', color: 'var(--warn)', pill: 'pill-warn', bar: 'sev-warn', fill: 'warn' },
  critical: { label: 'Critical', color: 'var(--crit)', pill: 'pill-crit', bar: 'sev-crit', fill: 'crit' },
}

function severityForJoint(joint: string, value: number): 'good' | 'warning' | 'critical' {
  const r = JOINT_RANGES[joint]
  if (!r) return 'good'
  const [lo, hi] = r
  if (value >= lo && value <= hi) return 'good'
  const dist = value < lo ? lo - value : value - hi
  return dist <= 15 ? 'warning' : 'critical'
}

// ── Demo / screenshot data ────────────────────────────────────────────────────
// Set to false to hit the real FastAPI backend at NEXT_PUBLIC_API_URL instead.
// When true, the full pipeline (upload → processing → results) runs with
// realistic canned data and needs no backend — ideal for demos & screenshots.
const USE_MOCK_DATA = true

interface MockEntry {
  result: AnalysisResponse
  jointValues: JointValue[]
}

const MOCK_DATA: Record<string, MockEntry> = {
  Squat: {
    result: {
      session_id: 'kc_9F2A17E4',
      sport: 'squat',
      overall_score: 74,
      summary:
        "Solid depth and hip drive, but a right-side knee valgus and a forward torso lean are capping this squat. Fix the knee-tracking asymmetry first — it's the highest-risk pattern here — then tighten the brace to keep the chest up out of the hole.",
      observations: [
        {
          joint: 'right_knee',
          severity: 'critical',
          observation:
            'Right knee collapses inward (valgus) at the bottom of the squat, reaching 69° while the left tracks at 138°. This 24° asymmetry loads the medial knee and ACL.',
          correction:
            "Cue 'knees out' — drive the right knee over the second toe through the full range of motion.",
          drill:
            'Banded goblet squats: 3×8 with a mini-band above the knees, pausing 2s at depth.',
        },
        {
          joint: 'spine_lean',
          severity: 'warning',
          observation:
            'Torso pitches forward to 61° at peak depth, shifting load toward the lower back rather than the posterior chain.',
          correction:
            "Keep the chest tall and brace the core before descending; think 'sit down', not 'bend over'.",
          drill: 'Box squats to a 14" box, 3×5, focusing on a vertical shin and an upright torso.',
        },
        {
          joint: 'left_shoulder',
          severity: 'warning',
          observation:
            'Bar carriage drops the left shoulder ~8° relative to the right, hinting at an uneven bar path.',
          correction:
            'Even out grip width and pull both shoulder blades down and together under the bar.',
          drill: null,
        },
        {
          joint: 'left_knee',
          severity: 'good',
          observation:
            'Left knee reaches a healthy 138° with smooth tracking over the toe — depth and control on this side are solid.',
          correction: 'Maintain this pattern and mirror it on the right.',
          drill: null,
        },
        {
          joint: 'right_hip',
          severity: 'good',
          observation:
            'Hip hinge initiates cleanly and reaches full extension at lockout with no hyperextension.',
          correction: 'No change needed.',
          drill: null,
        },
      ],
      key_frames: [12, 34, 58, 71],
      agent_reasoning:
        'Step 1: Loaded 220 frames, sampled 142 key poses at 30fps. Landmark confidence 0.96, zero dropped frames. ' +
        'Step 2: Computed 9 joint angles per frame. Detected right_knee minimum of 69° vs left_knee 138° — a 24° asymmetry flagged as CRITICAL. ' +
        'Step 3: Cross-referenced spine_lean peak of 61° against the squat normal range of 35–55° → WARNING for forward torso pitch. ' +
        'Step 4: Ran compute_symmetry_score: left/right knee delta 24° exceeds the 8° threshold; symmetry score 0.71. ' +
        "Step 5: Queried lookup_correction_drill for 'knee_valgus' → banded goblet squats; for 'forward_lean' → box squats. " +
        'Step 6: generate_overall_score weighted severity: 1 critical, 2 warnings, 3 within normal range → 74/100.',
      processing_time_ms: 6820,
    },
    jointValues: [
      { joint: 'spine_lean', value: 61.5 },
      { joint: 'left_knee', value: 138.0 },
      { joint: 'right_knee', value: 69.0 },
      { joint: 'left_hip', value: 164.0 },
      { joint: 'right_hip', value: 142.0 },
      { joint: 'left_shoulder', value: 52.0 },
    ],
  },

  Running: {
    result: {
      session_id: 'kc_3C81B6F0',
      sport: 'running',
      overall_score: 81,
      summary:
        'Efficient cadence and a tall posture drive a strong stride, but a trailing right leg that never finishes its push-off and a slight overstride are leaking energy. Extend the trail leg fully and land closer under the hips to unlock more turnover.',
      observations: [
        {
          joint: 'right_hip',
          severity: 'critical',
          observation:
            "Right hip reaches only 60° of extension at toe-off vs 159° drive on the left — the trail leg isn't finishing its push, shortening propulsion on that side.",
          correction:
            "Cue an active 'toe-off' and drive the right knee forward; strengthen glute-max hip extension.",
          drill:
            'Single-leg glute bridges 3×12 and A-skips 3×20m emphasizing full trail-leg extension.',
        },
        {
          joint: 'spine_lean',
          severity: 'warning',
          observation:
            'Torso sits slightly behind vertical (31°), a subtle backward lean that plants the foot ahead of the center of mass — classic overstride.',
          correction: 'Lean from the ankles, not the hips; land with the foot under a bent knee.',
          drill: 'Falling-start runs 6×20m to feel forward lean initiate from the ankle.',
        },
        {
          joint: 'right_shoulder',
          severity: 'warning',
          observation:
            'Right arm crosses the midline on the forward swing, rotating the trunk and bleeding energy laterally.',
          correction:
            "Drive elbows straight back and keep the hands from crossing the body's centerline.",
          drill: 'Seated arm-drive drills 3×30s at race tempo.',
        },
        {
          joint: 'left_knee',
          severity: 'good',
          observation:
            'Left knee flexion and recovery are smooth with good heel lift under the hip.',
          correction: 'No change.',
          drill: null,
        },
        {
          joint: 'left_hip',
          severity: 'good',
          observation:
            'Cadence holds a crisp ~178 spm with even ground contact — turnover is efficient.',
          correction: 'Maintain.',
          drill: null,
        },
      ],
      key_frames: [8, 26, 44, 63, 80],
      agent_reasoning:
        'Step 1: Ingested 240 frames, sampled 168 poses at 30fps. Confidence 0.94 across the stride cycle. ' +
        'Step 2: Segmented 3 full gait cycles; computed per-limb hip and knee angles at footstrike and toe-off. ' +
        'Step 3: right_hip extension peaked at 60° vs 159° on the left → 99° asymmetry flagged CRITICAL for incomplete push-off. ' +
        'Step 4: spine_lean averaged 31° against the normal range of 35–55° → WARNING for backward torso lean and overstride. ' +
        'Step 5: compute_symmetry_score returned 0.68; cadence estimated at 178 spm from ankle oscillation period. ' +
        'Step 6: generate_overall_score: strong cadence and posture offset the propulsion asymmetry → 81/100.',
      processing_time_ms: 7410,
    },
    jointValues: [
      { joint: 'left_knee', value: 147.0 },
      { joint: 'right_knee', value: 124.0 },
      { joint: 'left_hip', value: 159.0 },
      { joint: 'right_hip', value: 60.0 },
      { joint: 'spine_lean', value: 31.0 },
      { joint: 'left_shoulder', value: 152.0 },
    ],
  },

  'Tennis Serve': {
    result: {
      session_id: 'kc_5D40A9C2',
      sport: 'tennis serve',
      overall_score: 68,
      summary:
        'Explosive leg drive and a clean toss set up a powerful serve, but an excessive back arch and an early trunk rotation are leaving racket-head speed on the table. Generate height from the legs, delay the trunk turn, and extend fully at contact.',
      observations: [
        {
          joint: 'spine_lean',
          severity: 'critical',
          observation:
            'Trunk hyper-arches and side-bends to 74° during the cocking phase — well beyond the safe 35–55° window — loading the lumbar spine as a power source instead of the legs.',
          correction:
            'Generate height from leg drive and hip thrust, not a big back arch; keep the arch athletic, not extreme.',
          drill:
            'Med-ball overhead slams 3×8 to pattern hip-driven extension without lumbar hyperextension.',
        },
        {
          joint: 'right_elbow',
          severity: 'warning',
          observation:
            'Elbow is still at 131° at contact — the arm has not fully extended, so the racket meets the ball below optimal reach and pace is lost.',
          correction:
            "Reach up and fully extend the hitting arm at contact; hit the ball at the top of the toss.",
          drill:
            'Serve-and-freeze: toss and hold at full extension, 3×10, checking for a straight arm.',
        },
        {
          joint: 'right_shoulder',
          severity: 'warning',
          observation:
            'The shoulders open toward the net early in the upswing, dumping rotational energy before the racket accelerates.',
          correction:
            'Stay side-on longer; let the hips fire first, then the trunk, then the arm — respect the kinetic-chain sequence.',
          drill: 'Shadow serves emphasizing hip-lead sequencing, 3×15 slow reps.',
        },
        {
          joint: 'right_knee',
          severity: 'good',
          observation:
            'Deep knee load (91°) and explosive extension are driving strong upward momentum — the leg drive is a clear strength.',
          correction: 'Keep it.',
          drill: null,
        },
        {
          joint: 'left_shoulder',
          severity: 'good',
          observation:
            'Tossing arm stays up and stable through contact, keeping the shoulders level early in the motion.',
          correction: 'No change.',
          drill: null,
        },
      ],
      key_frames: [15, 39, 52, 77],
      agent_reasoning:
        'Step 1: Ingested 210 frames, isolated the serve motion (load → cock → contact → follow-through), sampled 96 key poses. ' +
        'Step 2: Tracked the kinetic chain; measured trunk lean (spine_lean) peaking at 74° during cocking. ' +
        'Step 3: spine_lean 74° exceeds the 35–55° normal range by 19° → CRITICAL for lumbar hyperextension. ' +
        'Step 4: right_elbow measured 131° at the contact frame — arm not fully extended → WARNING, reduced reach and racket-head speed. ' +
        'Step 5: Sequencing analysis found the shoulder line opening 40 ms before hip peak → WARNING for early trunk rotation. ' +
        'Step 6: generate_overall_score: strong leg drive and toss, but a spine risk and two timing leaks → 68/100.',
      processing_time_ms: 7980,
    },
    jointValues: [
      { joint: 'spine_lean', value: 74.0 },
      { joint: 'right_shoulder', value: 146.0 },
      { joint: 'right_elbow', value: 131.0 },
      { joint: 'left_knee', value: 98.0 },
      { joint: 'right_knee', value: 91.0 },
      { joint: 'right_hip', value: 168.0 },
    ],
  },

  Deadlift: {
    result: {
      session_id: 'kc_7B22C4E1',
      sport: 'deadlift',
      overall_score: 79,
      summary:
        'Strong hip hinge and a neutral bar path off the floor, but the hips shoot up slightly ahead of the chest and the lower back rounds through the mid-pull. Time the hip-and-chest rise together and brace harder to keep the spine neutral.',
      observations: [
        {
          joint: 'spine_lean',
          severity: 'critical',
          observation:
            'Lower back rounds to 71° through the mid-pull as the hips rise ahead of the chest, shifting load onto the lumbar spine.',
          correction:
            'Push the floor away with the legs and raise hips and chest together; brace as if about to be punched.',
          drill:
            'Tempo deadlifts (3s eccentric) 4×4 at 60%, focusing on a flat back and a synced rise.',
        },
        {
          joint: 'left_hip',
          severity: 'warning',
          observation:
            'Hips rise a touch faster than the chest out of the bottom, flattening the back angle early.',
          correction:
            "Think 'chest up' as you leave the floor; hips and shoulders should rise as one unit.",
          drill: 'Romanian deadlifts 3×8 to reinforce the hinge and a proud chest.',
        },
        {
          joint: 'right_knee',
          severity: 'warning',
          observation:
            'Right knee re-bends slightly as the bar passes the shin, nudging the bar path forward around the knee.',
          correction: 'Keep the shins back once the bar breaks the floor and drag the bar up the legs.',
          drill: null,
        },
        {
          joint: 'left_shoulder',
          severity: 'good',
          observation:
            'Lats stay engaged and the bar tracks close to the body — good shoulder positioning over the bar.',
          correction: 'Keep it.',
          drill: null,
        },
        {
          joint: 'right_hip',
          severity: 'good',
          observation: 'Powerful hip lockout with full extension and no hyperextension at the top.',
          correction: 'No change.',
          drill: null,
        },
      ],
      key_frames: [10, 28, 47, 66],
      agent_reasoning:
        'Step 1: Ingested 180 frames of the pull, sampled 132 poses, confidence 0.95. ' +
        'Step 2: Traced bar path and spine angle from setup through lockout. ' +
        'Step 3: spine_lean rounded to 71° mid-pull against the normal range of 35–55° → CRITICAL for lumbar flexion under load. ' +
        'Step 4: Detected hip rise leading chest rise by ~90 ms → back angle flattened early, WARNING. ' +
        "Step 5: lookup_correction_drill for 'back_rounding' → tempo deadlifts; for 'hips_shoot_up' → RDLs. " +
        'Step 6: generate_overall_score: strong lockout and bar proximity, one spinal risk → 79/100.',
      processing_time_ms: 6540,
    },
    jointValues: [
      { joint: 'spine_lean', value: 71.0 },
      { joint: 'left_hip', value: 98.0 },
      { joint: 'right_hip', value: 101.0 },
      { joint: 'left_knee', value: 141.0 },
      { joint: 'right_knee', value: 137.0 },
      { joint: 'left_shoulder', value: 64.0 },
    ],
  },

  'Push-up': {
    result: {
      session_id: 'kc_2E90F5A7',
      sport: 'push-up',
      overall_score: 83,
      summary:
        'Great core rigidity and a full range of motion, but the elbows flare wide and the hips sag slightly at the bottom. Tuck the elbows toward 45° and squeeze the glutes to hold a rigid plank line head-to-heel.',
      observations: [
        {
          joint: 'right_shoulder',
          severity: 'critical',
          observation:
            'Elbows flare to nearly 90° from the torso at the bottom, spiking shoulder abduction to 179° and stressing the shoulder joint.',
          correction: 'Tuck the elbows to ~45° so the arms form an arrow shape, not a T.',
          drill: 'Tempo push-ups (3s down) 3×8 with the elbows pinned toward the ribs.',
        },
        {
          joint: 'left_hip',
          severity: 'warning',
          observation:
            'Hips sag ~6° below the plank line on the later reps, breaking the rigid line from head to heel.',
          correction: "Squeeze the glutes and brace the core — think 'straight board' the whole rep.",
          drill: 'Plank-to-push-up holds 3×30s to reinforce a rigid midline.',
        },
        {
          joint: 'left_shoulder',
          severity: 'warning',
          observation:
            'Left shoulder mirrors the flare a touch less; the press path bows outward instead of driving straight down and up.',
          correction: 'Keep the hands under the shoulders and drive straight through the chest.',
          drill: null,
        },
        {
          joint: 'left_elbow',
          severity: 'good',
          observation:
            'Full range of motion — chest reaches near the floor and the arms fully lock out at the top.',
          correction: 'Keep it.',
          drill: null,
        },
        {
          joint: 'spine_lean',
          severity: 'good',
          observation: 'Neutral head and spine alignment held throughout — no neck craning.',
          correction: 'No change.',
          drill: null,
        },
      ],
      key_frames: [9, 22, 38, 55],
      agent_reasoning:
        'Step 1: Ingested 150 frames, sampled 118 poses across 8 reps, confidence 0.97. ' +
        'Step 2: Measured elbow angle, shoulder abduction, and hip-line deviation per rep. ' +
        'Step 3: right_shoulder abduction hit 179° at the bottom against a normal range of 60–160° → CRITICAL for elbow flare. ' +
        'Step 4: Hip line dropped 6° below neutral on later reps → WARNING for core fatigue. ' +
        'Step 5: Range of motion averaged 94% of full depth — logged as a strength. ' +
        'Step 6: generate_overall_score: excellent ROM and posture, elbow-flare risk → 83/100.',
      processing_time_ms: 5980,
    },
    jointValues: [
      { joint: 'spine_lean', value: 46.0 },
      { joint: 'left_elbow', value: 151.0 },
      { joint: 'right_elbow', value: 147.0 },
      { joint: 'left_shoulder', value: 172.0 },
      { joint: 'right_shoulder', value: 179.0 },
      { joint: 'left_hip', value: 152.0 },
    ],
  },

  General: {
    result: {
      session_id: 'kc_1A55D3B8',
      sport: 'general',
      overall_score: 76,
      summary:
        'Balanced movement quality overall with good postural control, but a left/right asymmetry and a mild forward lean are worth cleaning up. Address the dominant-side compensation first to even out load.',
      observations: [
        {
          joint: 'right_hip',
          severity: 'critical',
          observation:
            'Right hip lags in extension (71°) versus the left (156°), an 85° asymmetry that shifts load onto the dominant side.',
          correction: 'Add unilateral work to bring the trailing side up and cue even hip drive.',
          drill: 'Single-leg hip thrusts 3×10 per side, leading with the weaker hip.',
        },
        {
          joint: 'spine_lean',
          severity: 'warning',
          observation:
            'A mild forward torso lean (59°) suggests the movement is being driven by the back more than the legs.',
          correction: 'Keep the chest tall and brace the core before initiating the movement.',
          drill: null,
        },
        {
          joint: 'left_shoulder',
          severity: 'warning',
          observation:
            'Slight uneven shoulder carriage points to a compensating upper-body tilt.',
          correction: 'Level the shoulders and keep both scapulae set.',
          drill: 'Suitcase carries 3×30m per side to train anti-lateral-flexion.',
        },
        {
          joint: 'left_knee',
          severity: 'good',
          observation:
            'Left-side mechanics are smooth with good joint tracking through the full range.',
          correction: 'Maintain.',
          drill: null,
        },
        {
          joint: 'right_knee',
          severity: 'good',
          observation: 'Knee flexion stays within a healthy control band with no valgus.',
          correction: 'No change.',
          drill: null,
        },
      ],
      key_frames: [11, 30, 49, 68],
      agent_reasoning:
        'Step 1: Ingested 200 frames, sampled 150 poses at 30fps, confidence 0.95. ' +
        'Step 2: Computed all 9 tracked joint angles and left/right deltas per frame. ' +
        'Step 3: right_hip extension 71° vs left 156° → 85° asymmetry flagged CRITICAL. ' +
        'Step 4: spine_lean averaged 59° against the normal range of 35–55° → WARNING for forward lean. ' +
        'Step 5: compute_symmetry_score returned 0.73; variance within tracked joints 0.41. ' +
        'Step 6: generate_overall_score across severities → 76/100.',
      processing_time_ms: 6300,
    },
    jointValues: [
      { joint: 'spine_lean', value: 59.0 },
      { joint: 'left_knee', value: 134.0 },
      { joint: 'right_knee', value: 112.0 },
      { joint: 'left_hip', value: 156.0 },
      { joint: 'right_hip', value: 71.0 },
      { joint: 'left_shoulder', value: 88.0 },
    ],
  },
}

// ── Icon Components ───────────────────────────────────────────────────────────
const Icon = {
  Upload: (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  ),
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7 5v14l12-7z" />
    </svg>
  ),
  Reset: (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  ),
  Caret: (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  File: (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
  Spark: (props: React.SVGProps<SVGSVGElement>) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" />
    </svg>
  ),
}

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
  )
}

// ── Top Bar ───────────────────────────────────────────────────────────────────
interface TopBarProps {
  sessionId: string | null
  onReset: () => void
  view: ViewState
}

function TopBar({ sessionId, onReset, view }: TopBarProps) {
  return (
    <div className="topbar" style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontWeight: 700, letterSpacing: '.01em' }}>KineCopilot</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.04em' }}>
              v0.4 · BIOMECH
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {sessionId && (
            <span className="mono tnum" style={{ fontSize: 11, color: 'var(--muted)' }}>
              SESSION&nbsp;<span style={{ color: 'var(--muted-2)' }}>{sessionId}</span>
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--good)', boxShadow: '0 0 8px var(--good)' }} />
            <span className="mono" style={{ letterSpacing: '.04em' }}>API ONLINE</span>
          </span>
          {view === 'results' && (
            <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }} onClick={onReset}>
              <Icon.Reset /> New analysis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Upload View ───────────────────────────────────────────────────────────────
interface UploadViewProps {
  onAnalyze: (config: { sport: string; level: string; file: File | null; json: string }) => void
  justReset: boolean
}

function UploadView({ onAnalyze, justReset }: UploadViewProps) {
  const [over, setOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [sport, setSport] = useState('Squat')
  const [level, setLevel] = useState<typeof LEVELS[number]>('Intermediate')
  const [showJson, setShowJson] = useState(false)
  const [json, setJson] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  return (
    <div className={`fade-up ${justReset ? 'bloom' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Hero copy */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '.12em', marginBottom: 10 }}>
            01 · INGEST
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-.02em' }}>
            Upload movement footage
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--muted-2)', maxWidth: 560, fontSize: 14, lineHeight: 1.55 }}>
            Drop a clip of the athlete performing the movement. KineCopilot extracts pose, computes joint angles, and surfaces coaching cues with frame-level precision.
          </p>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', lineHeight: 1.7 }}>
          <div>FRAMES&nbsp;<span style={{ color: 'var(--muted-2)' }}>30 fps · 1080p max</span></div>
          <div>MODEL&nbsp;<span style={{ color: 'var(--muted-2)' }}>kc-pose-v3 · agent-7b</span></div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{ padding: '56px 28px', textAlign: 'center', cursor: 'pointer' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mov,.avi,.json"
          style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, display: 'grid', placeItems: 'center',
            background: 'linear-gradient(180deg, #1a1a1a, #0d0d0d)', border: '1px solid #2a2a2a',
            color: '#EDEDED', boxShadow: '0 12px 40px -12px rgba(255,255,255,.18), inset 0 1px 0 rgba(255,255,255,.05)'
          }}>
            <Icon.Upload />
          </div>
          {file ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div className="mono" style={{ fontSize: 13, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon.File /> {file.name}
              </div>
              <div className="mono tnum" style={{ fontSize: 11, color: 'var(--muted)' }}>
                {(file.size / (1024 * 1024)).toFixed(2)} MB · ready
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                Drop a clip here, or <span style={{ color: 'var(--accent)' }}>browse files</span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.06em' }}>
                .MP4 &nbsp;·&nbsp; .MOV &nbsp;·&nbsp; .AVI &nbsp;·&nbsp; .JSON
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Sport selector */}
        <div className="card" style={{ padding: 16 }}>
          <label className="mono" style={{ display: 'block', fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10 }}>
            SPORT / MOVEMENT
          </label>
          <div style={{ position: 'relative' }}>
            <select
              className="kc-select mono"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', background: '#0d0d0d',
                color: 'var(--fg)', border: '1px solid var(--border-strong)', borderRadius: 8,
                fontSize: 14, fontFamily: 'var(--mono)',
              }}
            >
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Level toggle */}
        <div className="card" style={{ padding: 16 }}>
          <label className="mono" style={{ display: 'block', fontSize: 10, letterSpacing: '.12em', color: 'var(--muted)', marginBottom: 10 }}>
            ATHLETE LEVEL
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0, padding: 4, background: '#0d0d0d', border: '1px solid var(--border-strong)', borderRadius: 10 }}>
            {LEVELS.map((l) => {
              const active = level === l
              return (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  style={{
                    padding: '8px 10px', fontSize: 12, fontWeight: 600,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-ink)' : 'var(--muted-2)',
                    border: 0, borderRadius: 7, cursor: 'default', transition: 'all .15s ease',
                    boxShadow: active ? '0 4px 14px -4px rgba(255,255,255,.25)' : 'none',
                  }}
                >
                  {l}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* JSON paste expander */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <button
          onClick={() => setShowJson((v) => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', background: 'transparent', border: 0, color: 'var(--fg)', cursor: 'default'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span className="pill pill-muted">advanced</span>
            Paste raw pose JSON for precomputed analysis
          </span>
          <span style={{ transition: 'transform .2s ease', transform: showJson ? 'rotate(180deg)' : 'none', color: 'var(--muted)' }}>
            <Icon.Caret />
          </span>
        </button>
        <div className="drill" style={{ maxHeight: showJson ? 220 : 0, opacity: showJson ? 1 : 0, padding: showJson ? '0 18px 18px' : '0 18px' }}>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"frames": [...], "landmarks": [...]}'
            spellCheck={false}
            className="mono"
            style={{
              width: '100%', minHeight: 140, resize: 'vertical',
              background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 12, fontSize: 12.5, lineHeight: 1.6, outline: 'none',
            }}
          />
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 4 }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
          {file || json ? 'Ready to analyze.' : 'Awaiting input…'}
        </div>
        <button
          className="btn btn-primary"
          disabled={!file && !json}
          onClick={() => onAnalyze({ sport, level, file, json })}
          style={{ minWidth: 200 }}
        >
          <Icon.Play /> Analyze Form
        </button>
      </div>
    </div>
  )
}

// ── Processing View ───────────────────────────────────────────────────────────
interface ProcessingViewProps {
  onComplete: () => void
}

function ProcessingView({ onComplete }: ProcessingViewProps) {
  const [step, setStep] = useState(0)
  const [eta, setEta] = useState(8)

  useEffect(() => {
    const stepDur = 1100
    const t = setTimeout(() => {
      if (step < PIPELINE_STEPS.length - 1) setStep((s) => s + 1)
      else onComplete?.()
    }, stepDur)
    const tick = setInterval(() => setEta((e) => Math.max(0, +(e - 0.1).toFixed(1))), 100)
    return () => {
      clearTimeout(t)
      clearInterval(tick)
    }
  }, [step, onComplete])

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingTop: 30 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '.12em', marginBottom: 10 }}>
            02 · ANALYSIS IN PROGRESS
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: '-.02em' }}>
            Reading the movement
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--muted-2)', maxWidth: 540, fontSize: 14, lineHeight: 1.55, transition: 'opacity .3s ease' }} key={step}>
            <span className="fade-in">{PIPELINE_STEPS[step].copy}</span>
          </p>
        </div>
        <div className="mono tnum" style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '.08em' }}>EST. REMAINING</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--fg)', marginTop: 2 }}>
            {eta.toFixed(1)}<span style={{ fontSize: 14, color: 'var(--muted)' }}>s</span>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="card" style={{ padding: '28px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PIPELINE_STEPS.length}, 1fr)`, alignItems: 'start', position: 'relative' }}>
          {PIPELINE_STEPS.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'active' : 'pending'
            return (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, position: 'relative', zIndex: 2 }}>
                <StepDot state={state} index={i} />
                <div style={{ textAlign: 'center' }}>
                  <div className="mono" style={{
                    fontSize: 11, letterSpacing: '.06em',
                    color: state === 'pending' ? 'var(--muted)' : 'var(--fg)',
                    transition: 'color .3s ease'
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{
                    marginTop: 4, fontSize: 13, fontWeight: 600,
                    color: state === 'active' ? 'var(--accent)' : state === 'done' ? 'var(--fg)' : 'var(--muted)',
                    transition: 'color .3s ease'
                  }}>
                    {s.label}
                  </div>
                </div>
              </div>
            )
          })}
          {/* connecting line behind dots */}
          <div style={{
            position: 'absolute', left: '12.5%', right: '12.5%', top: 16, height: 1,
            background: 'var(--border)', zIndex: 1,
          }} />
          <div style={{
            position: 'absolute', left: '12.5%', top: 16, height: 1,
            width: `${(step / (PIPELINE_STEPS.length - 1)) * 75}%`,
            background: 'linear-gradient(90deg, transparent, var(--accent))',
            transition: 'width .8s cubic-bezier(.4,1,.4,1)', zIndex: 1,
          }} />
        </div>

        {/* Sub-progress: telemetry-style mini readout */}
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed var(--border)' }}>
          <Telemetry step={step} />
        </div>
      </div>
    </div>
  )
}

interface StepDotProps {
  state: 'active' | 'done' | 'pending'
  index: number
}

function StepDot({ state, index }: StepDotProps) {
  const isActive = state === 'active'
  const isDone = state === 'done'
  return (
    <div style={{ position: 'relative', width: 32, height: 32 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: isDone ? 'var(--accent)' : isActive ? 'rgba(255,255,255,.08)' : '#0f0f0f',
        border: '1px solid',
        borderColor: isDone ? 'var(--accent)' : isActive ? 'var(--accent)' : 'var(--border-strong)',
        display: 'grid', placeItems: 'center',
        boxShadow: isActive ? '0 0 0 6px rgba(255,255,255,.05)' : 'none',
        transition: 'all .3s ease',
      }}>
        {isDone ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : isActive ? <ActivePulse /> :
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{index + 1}</span>}
      </div>
    </div>
  )
}

function ActivePulse() {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: 2, background: 'var(--accent)',
          animation: 'pulse-dot 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

interface TelemetryProps {
  step: number
}

function Telemetry({ step }: TelemetryProps) {
  const lines = [
    [['FRAMES_SAMPLED', '0142 / 0220'], ['RESOLUTION', '1080×1920'], ['DURATION', '7.34s']],
    [['LANDMARKS', '33 / 33'], ['CONFIDENCE', '0.96'], ['DROPPED', '00']],
    [['JOINTS', '9 tracked'], ['SYMMETRY_Δ', '11.2°'], ['VARIANCE', '0.42']],
    [['TOOLS_INVOKED', '4'], ['TOKENS', '1,842'], ['PRIORS', 'kc-bio-2026']],
  ]
  const [l0, l1, l2] = [lines[step][0], lines[step][1], lines[step][2]]
  return (
    <div className="mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, fontSize: 11.5, animation: 'fade-in .5s ease both' }} key={step}>
      {[l0, l1, l2].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
          <span style={{ letterSpacing: '.06em' }}>{k}</span>
          <span style={{ color: 'var(--fg)' }} className="tnum">{v}</span>
        </div>
      ))}
    </div>
  )
}

// ── Score Circle ──────────────────────────────────────────────────────────────
interface ScoreCircleProps {
  score: number
  size?: number
}

function ScoreCircle({ score, size = 220 }: ScoreCircleProps) {
  const r = 92
  const circ = 2 * Math.PI * r
  const target = circ * (1 - score / 100)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const band = score >= 80 ? 'var(--good)' : score >= 60 ? 'var(--warn)' : 'var(--crit)'
  const bandLabel = score >= 80 ? 'STRONG' : score >= 60 ? 'DEVELOPING' : 'AT RISK'

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg className="score-glow" width={size} height={size} viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="score-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={band} stopOpacity="0.7" />
            <stop offset="100%" stopColor={band} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r={r} fill="none" stroke="#1a1a1a" strokeWidth="10" />
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2
          const x1 = 110 + Math.cos(a) * (r + 10), y1 = 110 + Math.sin(a) * (r + 10)
          const x2 = 110 + Math.cos(a) * (r + 14), y2 = 110 + Math.sin(a) * (r + 14)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#222" strokeWidth={i % 5 === 0 ? '1.4' : '.8'} />
        })}
        <circle
          cx="110" cy="110" r={r} fill="none" stroke="url(#score-grad)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={mounted ? target : circ}
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.14em' }}>FORM SCORE</div>
        <div className="mono tnum" style={{ fontSize: 64, fontWeight: 700, lineHeight: 1, marginTop: 6, color: 'var(--fg)', animation: 'count-up .8s ease both', animationDelay: '.4s' }}>
          {score}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: band, letterSpacing: '.14em', marginTop: 8, fontWeight: 600 }}>
          ◆ {bandLabel}
        </div>
      </div>
    </div>
  )
}

// ── Joint Angle Chart ─────────────────────────────────────────────────────────
interface JointAngleChartProps {
  values: JointValue[]
}

function JointAngleChart({ values }: JointAngleChartProps) {
  const SCALE_MAX = 200
  return (
    <div className="card" style={{ padding: 22 }}>
      <ChartHeader title="Joint angles" subtitle="key-frame snapshot" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
        {values.map(({ joint, value }, i) => {
          const range = JOINT_RANGES[joint]
          const sev = severityForJoint(joint, value)
          const fillKey = sev === 'good' ? 'good' : sev === 'warning' ? 'warn' : 'crit'
          const widthPct = Math.min(100, (value / SCALE_MAX) * 100)
          const rangeLeftPct = (range[0] / SCALE_MAX) * 100
          const rangeWidthPct = ((range[1] - range[0]) / SCALE_MAX) * 100
          return (
            <div key={joint} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 84px', gap: 14, alignItems: 'center', animation: 'fade-up .5s ease both', animationDelay: `${i * 70}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 4, height: 4, borderRadius: 2, background: SEV[sev].color }} />
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted-2)', letterSpacing: '.02em' }}>
                  {joint.replace('_', ' ')}
                </span>
              </div>
              <div className="joint-track">
                <div className="joint-range" style={{ left: `${rangeLeftPct}%`, width: `${rangeWidthPct}%` }} />
                <div className={`joint-fill ${fillKey}`} style={{ width: `${widthPct}%`, animationDelay: `${i * 90 + 200}ms` }} />
              </div>
              <div className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', textAlign: 'right' }}>
                {value.toFixed(1)}<span style={{ color: 'var(--muted)', fontWeight: 400 }}>°</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border)', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {[
          ['good', 'in normal range'],
          ['warn', '≤ 15° outside'],
          ['crit', '> 15° outside'],
        ].map(([k, label]) => (
          <span key={k} className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ width: 14, height: 6, borderRadius: 2, background: `var(--${k === 'warn' ? 'warn' : k === 'crit' ? 'crit' : 'good'})` }} />
            {label}
          </span>
        ))}
        <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
          <span style={{ width: 14, height: 6, borderRadius: 2, background: 'rgba(255,255,255,.06)', border: '1px dashed rgba(255,255,255,.15)' }} />
          normal-range band
        </span>
      </div>
    </div>
  )
}

interface ChartHeaderProps {
  title: string
  subtitle: string
}

function ChartHeader({ title, subtitle }: ChartHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-.005em' }}>{title}</h3>
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
        {subtitle}
      </span>
    </div>
  )
}

// ── Observation Card ──────────────────────────────────────────────────────────
interface ObservationCardProps {
  obs: CoachingObservation
  index: number
}

function ObservationCard({ obs, index }: ObservationCardProps) {
  const [open, setOpen] = useState(false)
  const sev = SEV[obs.severity]
  return (
    <div className="obs-card" style={{ animationDelay: `${index * 100}ms` }}>
      <span className={`sev-bar ${sev.bar}`} />
      <div className="obs-grid-bg" />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`pill ${sev.pill}`}>{obs.joint.replace('_', ' ')}</span>
            <span className="mono" style={{ fontSize: 11, color: sev.color, letterSpacing: '.08em', fontWeight: 600 }}>
              {sev.label.toUpperCase()}
            </span>
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            FRAME&nbsp;<span style={{ color: 'var(--muted-2)' }} className="tnum">{12 + index * 2}</span>
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--fg)' }}>
          {obs.observation}
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingTop: 4 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.12em', marginTop: 3, minWidth: 64 }}>
            FIX
          </span>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--muted-2)' }}>
            {obs.correction}
          </p>
        </div>

        {obs.drill && (
          <>
            <button
              onClick={() => setOpen((v) => !v)}
              style={{
                marginTop: 4, alignSelf: 'flex-start',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px 7px 10px', background: 'transparent',
                border: '1px solid var(--border-strong)', borderRadius: 8,
                color: 'var(--fg)', fontSize: 12, fontWeight: 500, cursor: 'default',
                transition: 'all .15s ease',
              }}
            >
              <Icon.Spark style={{ color: sev.color }} />
              {open ? 'Hide drill' : 'View drill'}
              <span style={{ display: 'inline-block', marginLeft: 4, transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--muted)' }}>
                <Icon.Caret />
              </span>
            </button>
            <div className={`drill ${open ? 'open' : ''}`}>
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '14px 16px', marginTop: 4,
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: `${sev.color}1a`, border: `1px solid ${sev.color}33`,
                  display: 'grid', placeItems: 'center', color: sev.color,
                }}>
                  <Icon.Spark />
                </div>
                <div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.12em', marginBottom: 4 }}>
                    PRESCRIBED DRILL
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--fg)', lineHeight: 1.6 }}>
                    {obs.drill}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Agent Reasoning ───────────────────────────────────────────────────────────
interface AgentReasoningProps {
  raw: string
  processingMs: number
}

function AgentReasoning({ raw, processingMs }: AgentReasoningProps) {
  const [open, setOpen] = useState(false)
  const lines = useMemo(() => raw.split(/(?=Step \d+:)/g).map((s) => s.trim()).filter(Boolean), [raw])

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', background: 'transparent', border: 0, color: 'var(--fg)', cursor: 'default',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: 'var(--good)', boxShadow: '0 0 8px var(--good)' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Agent reasoning trace</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {lines.length} steps · {(processingMs / 1000).toFixed(2)}s
          </span>
        </span>
        <span style={{ transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--muted)' }}>
          <Icon.Caret />
        </span>
      </button>
      <div className="drill" style={{ maxHeight: open ? 600 : 0, opacity: open ? 1 : 0, padding: open ? '0 20px 20px' : '0 20px' }}>
        <div className="code-block">
          {lines.map((l, i) => {
            const colored = l
              .replace(/(CRITICAL)/g, '<span class="kw-crit">$1</span>')
              .replace(/(WARNING)/g, '<span class="kw-warn">$1</span>')
              .replace(/(normal range)/gi, '<span class="kw-good">$1</span>')
              .replace(/(\b\d+(?:\.\d+)?°?\b)/g, '<span class="kw-num">$1</span>')
            return (
              <div key={i} style={{ display: 'flex', gap: 12 }}>
                <span className="step-num" style={{ width: 22, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <span dangerouslySetInnerHTML={{ __html: colored }} />
              </div>
            )
          })}
          <div style={{ marginTop: 8, color: 'var(--muted)' }}>
            <span className="step-num" style={{ marginRight: 12 }}>{String(lines.length + 1).padStart(2, '0')}</span>
            $ <span className="cursor" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Results View ──────────────────────────────────────────────────────────────
interface ResultsViewProps {
  result: AnalysisResponse
  jointValues: JointValue[]
}

function ResultsView({ result, jointValues }: ResultsViewProps) {
  const critCount = result.observations.filter(o => o.severity === 'critical').length
  const warnCount = result.observations.filter(o => o.severity === 'warning').length
  const goodCount = result.observations.filter(o => o.severity === 'good').length

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingTop: 8 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '.12em', marginBottom: 8 }}>
            03 · ANALYSIS COMPLETE
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', textTransform: 'capitalize' }}>
            {result.sport} · session report
          </h1>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', lineHeight: 1.7 }}>
          <div>SESSION&nbsp;<span style={{ color: 'var(--muted-2)' }} className="tnum">{result.session_id}</span></div>
          <div>RUNTIME&nbsp;<span style={{ color: 'var(--muted-2)' }} className="tnum">{(result.processing_time_ms / 1000).toFixed(2)}s</span></div>
        </div>
      </div>

      {/* Score + summary */}
      <div className="card" style={{ padding: '32px 28px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'center' }}>
        <ScoreCircle score={result.overall_score} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {critCount > 0 && <span className="pill pill-crit">{critCount} critical</span>}
            {warnCount > 0 && <span className="pill pill-warn">{warnCount} warning</span>}
            {goodCount > 0 && <span className="pill pill-good">{goodCount} good</span>}
            <span className="pill pill-muted">{result.key_frames.length} key frames</span>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--fg)' }}>
            {result.summary}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            {result.key_frames.map((f) => (
              <KeyFrameThumb key={f} frame={f} />
            ))}
          </div>
        </div>
      </div>

      {/* Joint chart */}
      {jointValues.length > 0 && <JointAngleChart values={jointValues} />}

      {/* Observations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Observations</h3>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            {result.observations.length} findings · sorted by severity
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...result.observations]
            .sort((a, b) => ['critical', 'warning', 'good'].indexOf(a.severity) - ['critical', 'warning', 'good'].indexOf(b.severity))
            .map((o, i) => (
              <ObservationCard key={o.joint} obs={o} index={i} />
            ))}
        </div>
      </div>

      {/* Reasoning */}
      <AgentReasoning raw={result.agent_reasoning} processingMs={result.processing_time_ms} />
    </div>
  )
}

interface KeyFrameThumbProps {
  frame: number
}

function KeyFrameThumb({ frame }: KeyFrameThumbProps) {
  return (
    <div style={{
      width: 80, height: 56, borderRadius: 8,
      background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
      border: '1px solid var(--border)',
      position: 'relative', overflow: 'hidden',
      display: 'grid', placeItems: 'center',
    }}>
      <svg width="46" height="38" viewBox="0 0 46 38" fill="none" stroke="#EDEDED" strokeOpacity=".5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="23" cy="6" r="2.6" />
        <path d="M23 9 v8" />
        <path d="M16 13 L23 17 L30 13" />
        <path d="M23 17 L18 27 L20 36" />
        <path d="M23 17 L28 27 L26 36" />
      </svg>
      <span className="mono tnum" style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, color: 'var(--muted)' }}>
        f{frame}
      </span>
      <span style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: 3, background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function KineCopilotPanel() {
  const [view, setView] = useState<ViewState>('upload')
  const [justReset, setJustReset] = useState(false)
  const [config, setConfig] = useState<{ sport: string; level: string; file: File | null; json: string } | null>(null)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [jointValues, setJointValues] = useState<JointValue[]>([])

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const goAnalyze = useCallback(async (cfg: { sport: string; level: string; file: File | null; json: string }) => {
    setConfig(cfg)
    setView('processing')

    // Demo mode: serve realistic canned data so the full flow works with no backend.
    if (USE_MOCK_DATA) {
      const entry = MOCK_DATA[cfg.sport] ?? MOCK_DATA['General']
      setResult({ ...entry.result, sport: cfg.sport.toLowerCase() })
      setJointValues(entry.jointValues)
      return
    }

    // Call real API
    try {
      const formData = new FormData()

      if (cfg.json) {
        formData.append('pose_json', cfg.json)
      } else if (cfg.file) {
        formData.append('video', cfg.file)
      }

      formData.append('sport', cfg.sport.toLowerCase().replace(' ', '_'))
      formData.append('athlete_level', cfg.level.toLowerCase())

      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const data: AnalysisResponse = await response.json()

      // Extract joint values from the response if available
      // For now, we'll create synthetic values - in real implementation, backend should provide these
      const syntheticJointValues: JointValue[] = [
        { joint: 'left_knee', value: 143.0 },
        { joint: 'right_knee', value: 74.1 },
        { joint: 'left_hip', value: 167.2 },
        { joint: 'right_hip', value: 156.0 },
        { joint: 'spine_lean', value: 45.3 },
      ]

      setResult(data)
      setJointValues(syntheticJointValues)
    } catch (error) {
      console.error('Analysis error:', error)
      // On error, stay on processing view - in production, show error state
    }
  }, [API_URL])

  const onProcessingDone = useCallback(() => {
    setView('results')
  }, [])

  const reset = useCallback(() => {
    setView('upload')
    setJustReset(true)
    setTimeout(() => setJustReset(false), 900)
    setResult(null)
    setJointValues([])
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
      <TopBar
        sessionId={view === 'results' && result ? result.session_id : null}
        view={view}
        onReset={reset}
      />
      <main style={{ flex: 1, maxWidth: 960, width: '100%', margin: '0 auto', padding: '32px 24px 80px' }}>
        {view === 'upload' && <UploadView onAnalyze={goAnalyze} justReset={justReset} />}
        {view === 'processing' && <ProcessingView onComplete={onProcessingDone} />}
        {view === 'results' && result && <ResultsView result={result} jointValues={jointValues} />}
      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '16px 24px' }}>
        <div className="mono" style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 11, letterSpacing: '.04em' }}>
          <span>KINECOPILOT · BIOMECHANICS COACHING</span>
          <span>{new Date().getFullYear()} · BUILT FOR ATHLETES, COACHES & SPORTS STUDENTS</span>
        </div>
      </footer>
    </div>
  )
}
