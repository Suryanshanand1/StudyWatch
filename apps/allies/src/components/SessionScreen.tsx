"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AppLauncher } from "@capacitor/app-launcher"
import { CheckCircle, Minus, Pause, Play, Plus, RotateCcw, Save, Timer, Watch } from "lucide-react"
import { recordSession } from "@/lib/history"
import {
  buildSessionLink,
  cancelFinishAlarm,
  elapsedMs,
  fmtClock,
  fmtDuration,
  getSessionServerSnapshot,
  getSessionSnapshot,
  isNative,
  remainingMs,
  releaseWakeLock,
  requestWakeLock,
  scheduleFinishAlarm,
  setSessionState,
  subscribeSession,
  toDateStr,
  toTimeStr,
  type ActiveSession,
  type Mode,
} from "@/lib/timer"

const MIN_SAVE_MS = 60 * 1000

interface DurationSegments {
  h: number
  m: number
  s: number
}

function clamp(n: number, max: number): number {
  return Math.min(Math.max(0, n), max)
}

export default function SessionScreen() {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionServerSnapshot)
  const [mode, setMode] = useState<Mode>("timer")
  const [duration, setDuration] = useState<DurationSegments>({ h: 0, m: 25, s: 0 })
  const [label, setLabel] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const [saved, setSaved] = useState<string | null>(null)
  const finishedNotified = useRef(false)

  const running = session?.state === "running"
  const timerFinished = session?.mode === "timer" && (session.finished || (session.state === "paused" && remainingMs(session, now) <= 0))

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!running) return
    void requestWakeLock()
    return () => releaseWakeLock()
  }, [running])

  useEffect(() => {
    if (!session) {
      finishedNotified.current = false
      return
    }
    if (session.mode !== "timer" || session.finished) return
    if (running && remainingMs(session, now) <= 0 && !finishedNotified.current) {
      finishedNotified.current = true
      void cancelFinishAlarm()
      setSessionState({
        ...session,
        accumulatedMs: session.accumulatedMs + (now - session.segmentStartedAt),
        segmentStartedAt: now,
        state: "paused",
        finished: true,
      })
    }
  }, [now, running, session])

  const elapsed = session ? elapsedMs(session, now) : 0
  const remaining = session && session.mode === "timer" ? remainingMs(session, now) : 0
  const shown = session ? (session.mode === "timer" ? remaining : elapsed) : 0
  const canSave = !!session && elapsed >= MIN_SAVE_MS

  const sessionLabel = session ? session.subjectName || "Session" : label || "Session"

  const handleStart = () => {
    const timestamp = Date.now()
    const sess: ActiveSession = {
      mode,
      subjectId: "",
      chapterId: "",
      subjectName: label || "Session",
      chapterName: "",
      durationMs: mode === "timer" ? (duration.h * 3600 + duration.m * 60 + duration.s) * 1000 : 0,
      startedAt: timestamp,
      segmentStartedAt: timestamp,
      accumulatedMs: 0,
      state: "running",
      finished: false,
    }
    setSessionState(sess)
    setSaved(null)
    finishedNotified.current = false
    if (sess.durationMs > 0) void scheduleFinishAlarm(sess.durationMs, sess.subjectName || undefined)
  }

  const handlePause = () => {
    if (!session || session.state !== "running") return
    const nowMs = Date.now()
    const next: ActiveSession = {
      ...session,
      accumulatedMs: session.accumulatedMs + (nowMs - session.segmentStartedAt),
      state: "paused",
    }
    setSessionState(next)
    setNow(nowMs)
    if (session.mode === "timer") void cancelFinishAlarm()
  }

  const handleResume = () => {
    if (!session || session.state !== "paused") return
    const nowMs = Date.now()
    setSessionState({ ...session, segmentStartedAt: nowMs, state: "running" })
    setNow(nowMs)
    if (session.mode === "timer" && session.durationMs > 0) {
      void scheduleFinishAlarm(remainingMs(session, nowMs), session.subjectName || undefined)
    }
  }

  const handleReset = () => {
    setSessionState(null)
    setSaved(null)
    void cancelFinishAlarm()
    releaseWakeLock()
  }

  const handleSave = async () => {
    if (!session || !canSave) return
    const total = elapsedMs(session, now)
    const startDate = new Date(session.startedAt)
    const endDate = new Date(session.startedAt + total)
    const payload = {
      label: session.subjectName || "Session",
      date: toDateStr(startDate),
      startTime: toTimeStr(startDate),
      endTime: toTimeStr(endDate),
      minutes: Math.max(1, Math.round(total / 60000)),
    }
    recordSession(payload)
    let sent = false
    if (isNative()) {
      try {
        const check = await AppLauncher.canOpenUrl({ url: "studyplanner://session" })
        if (check.value) {
          await AppLauncher.openUrl({ url: buildSessionLink(payload) })
          sent = true
        }
      } catch {}
    }
    setSaved(`${payload.label} (${fmtDuration(total)})${sent ? " — sent to Study Planner" : " — saved"}`)
    setSessionState(null)
    releaseWakeLock()
    void cancelFinishAlarm()
  }

  const showDuration = !session && mode === "timer"

  const stepper = (label: string, value: number, max: number, onChange: (v: number) => void) => (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-surface px-2 py-1.5">
        <button
          onClick={() => onChange(clamp(value - 1, max))}
          className="rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-foreground active:scale-95"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={14} />
        </button>
        <span className="w-10 text-center font-mono text-xl font-semibold tabular-nums">{pad2(value)}</span>
        <button
          onClick={() => onChange(clamp(value + 1, max))}
          className="rounded-full p-1.5 text-muted transition hover:bg-white/5 hover:text-foreground active:scale-95"
          aria-label={`Increase ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-1 flex-col justify-between gap-6 py-6">
      <div className="space-y-5">
        {!session && (
          <div className="flex gap-1 rounded-2xl bg-surface p-1">
            {(
              [
                { key: "timer", label: "Timer", icon: Timer },
                { key: "watch", label: "Stopwatch", icon: Watch },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
                  mode === key ? "bg-accent text-black shadow-lg shadow-amber-500/20" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        )}

        {showDuration && (
          <div className="flex justify-center gap-3">
            {stepper("Hours", duration.h, 99, (v) => setDuration((d) => ({ ...d, h: v })))}
            {stepper("Min", duration.m, 59, (v) => setDuration((d) => ({ ...d, m: v })))}
            {stepper("Sec", duration.s, 59, (v) => setDuration((d) => ({ ...d, s: v })))}
          </div>
        )}

        {!session && (
          <div className="rounded-2xl border border-white/5 bg-surface p-4">
            <label className="mb-1 block text-xs font-medium text-muted">What are you studying?</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Physics — Thermodynamics"
              className="w-full rounded-xl border border-white/10 bg-raised px-4 py-3 text-sm outline-none focus:border-accent/60"
            />
          </div>
        )}

        <div className="text-center">
          <p
            className={`font-mono text-6xl font-bold tabular-nums tracking-tight sm:text-7xl ${
              timerFinished ? "text-accent" : "text-foreground"
            }`}
          >
            {fmtClock(shown)}
          </p>
          <p className="mt-2 text-sm text-muted">
            {!session
              ? mode === "timer"
                ? "Set a duration and start"
                : "Start to time any study session"
              : timerFinished
              ? "Time's up"
              : session.state === "running"
              ? session.mode === "timer"
                ? `${fmtDuration(remaining)} remaining`
                : `${fmtDuration(elapsed)} elapsed`
              : "Paused"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {!session ? (
          <button
            onClick={handleStart}
            disabled={mode === "timer" && (duration.h + duration.m + duration.s) === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-base font-semibold text-black shadow-lg shadow-amber-500/20 transition active:scale-[0.99] disabled:opacity-40"
          >
            <Play size={20} className="fill-black" />
            Start {mode === "timer" && sessionLabel ? `— ${sessionLabel}` : ""}
          </button>
        ) : (
          <>
            <div className="flex gap-2">
              {running ? (
                <button
                  onClick={handlePause}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface py-3.5 text-sm font-semibold transition active:scale-[0.99]"
                >
                  <Pause size={18} />
                  Pause
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  disabled={timerFinished}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-sm font-semibold text-black transition active:scale-[0.99] disabled:opacity-40"
                >
                  <Play size={18} className="fill-black" />
                  Resume
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex items-center justify-center rounded-2xl border border-white/10 bg-surface px-5 text-muted transition hover:text-foreground active:scale-[0.99]"
                title="Discard session"
              >
                <RotateCcw size={18} />
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 py-3.5 text-sm font-semibold text-accent transition active:scale-[0.99] disabled:opacity-40"
            >
              <Save size={18} />
              Send to Study Planner{canSave ? ` (${fmtDuration(elapsed)})` : " — min 1 min"}
            </button>
          </>
        )}

        {saved && (
          <div className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            <CheckCircle size={16} className="shrink-0" />
            <span className="truncate">{saved}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}