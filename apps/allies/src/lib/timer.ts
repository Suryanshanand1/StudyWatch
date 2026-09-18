import { LocalNotifications } from "@capacitor/local-notifications"

export type Mode = "timer" | "watch"

export interface ActiveSession {
  mode: Mode
  subjectId: string
  chapterId: string
  subjectName: string
  chapterName: string
  durationMs: number
  startedAt: number
  segmentStartedAt: number
  accumulatedMs: number
  state: "running" | "paused"
  finished: boolean
}

const SESSION_KEY = "allies-active-session"

export function isNative(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window as unknown as { Capacitor?: { isNativePlatform?: boolean } }).Capacitor?.isNativePlatform
  )
}

export function pad(n: number): string {
  return String(n).padStart(2, "0")
}

export function fmtClock(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function fmtDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function elapsedMs(s: ActiveSession, now: number): number {
  return s.accumulatedMs + (s.state === "running" ? now - s.segmentStartedAt : 0)
}

export function remainingMs(s: ActiveSession, now: number): number {
  return Math.max(0, s.durationMs - elapsedMs(s, now))
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  return `${y}-${m}-${day}`
}

export function toTimeStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface SessionPayload {
  label: string
  date: string
  startTime: string
  endTime: string
  minutes: number
}

export function buildSessionLink(p: SessionPayload): string {
  const q = new URLSearchParams({
    label: p.label,
    date: p.date,
    start: p.startTime,
    end: p.endTime,
    minutes: String(p.minutes),
    source: "allies",
  })
  return `studyplanner://session?${q.toString()}`
}

export function loadSession(): ActiveSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || typeof s !== "object") return null
    return {
      mode: s.mode === "timer" ? "timer" : "watch",
      subjectId: String(s.subjectId ?? ""),
      chapterId: String(s.chapterId ?? ""),
      subjectName: String(s.subjectName ?? ""),
      chapterName: String(s.chapterName ?? ""),
      durationMs: Number(s.durationMs) || 0,
      startedAt: Number(s.startedAt) || Date.now(),
      segmentStartedAt: Number(s.segmentStartedAt) || Date.now(),
      accumulatedMs: Number(s.accumulatedMs) || 0,
      state: s.state === "paused" ? "paused" : "running",
      finished: !!s.finished,
    }
  } catch {
    return null
  }
}

export function persistSession(s: ActiveSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {}
}

let sessionState: ActiveSession | null | undefined
const sessionListeners = new Set<() => void>()

function readStoredSession(): ActiveSession | null {
  if (sessionState === undefined) {
    sessionState = typeof window !== "undefined" ? loadSession() : null
  }
  return sessionState
}

export function subscribeSession(listener: () => void): () => void {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

export function getSessionSnapshot(): ActiveSession | null {
  return readStoredSession()
}

export function getSessionServerSnapshot(): ActiveSession | null {
  return null
}

export function setSessionState(next: ActiveSession | null): void {
  sessionState = next
  persistSession(next)
  sessionListeners.forEach((l) => l())
}

async function requestNotificationPermission(): Promise<boolean> {
  if (isNative()) {
    try {
      const perm = await LocalNotifications.requestPermissions()
      return perm.display === "granted"
    } catch {
      return false
    }
  }
  if (!("Notification" in window)) return false
  if (Notification.permission === "granted") return true
  if (Notification.permission === "denied") return false
  const p = await Notification.requestPermission()
  return p === "granted"
}

/** Schedule the "time's up" alarm at now + remainingMs. Returns true if scheduled. */
export async function scheduleFinishAlarm(remainingMsN: number, label?: string): Promise<boolean> {
  if (remainingMsN <= 0) return false
  const ok = await requestNotificationPermission()
  if (!ok) return false
  const at = Date.now() + remainingMsN
  const body = label ? `Time's up for ${label}` : `Time's up!`
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [{ id: 5201, title: "Allies", body, schedule: { at: new Date(at) } }],
      })
      return true
    } catch {
      return false
    }
  }
  setTimeout(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Allies", { body, icon: "/icon-192.png" })
      } catch {}
    }
  }, remainingMsN)
  return true
}

export async function cancelFinishAlarm() {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 5201 }] })
  } catch {}
}

let wakeLock: globalThis.WakeLockSentinel | null = null

export async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request("screen")
  } catch {}
}

export function releaseWakeLock() {
  try {
    wakeLock?.release()
  } catch {}
  wakeLock = null
}