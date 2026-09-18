import { useSyncExternalStore } from "react"

export interface SavedSession {
  id: string
  label: string
  date: string
  startTime: string
  endTime: string
  minutes: number
  createdAt: number
}

export type NewSession = Omit<SavedSession, "id" | "createdAt">

const STORAGE_KEY = "allies-history"
const MAX_ENTRIES = 200

const SERVER_HISTORY: SavedSession[] = []

let historyState: SavedSession[] | undefined
const historyListeners = new Set<() => void>()

function loadHistory(): SavedSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is SavedSession => !!s && typeof s === "object")
  } catch {
    return []
  }
}

function readHistory(): SavedSession[] {
  if (historyState === undefined) {
    historyState = typeof window !== "undefined" ? loadHistory() : SERVER_HISTORY
  }
  return historyState
}

export function subscribeHistory(listener: () => void): () => void {
  historyListeners.add(listener)
  return () => {
    historyListeners.delete(listener)
  }
}

export function getHistorySnapshot(): SavedSession[] {
  return readHistory()
}

export function getHistoryServerSnapshot(): SavedSession[] {
  return SERVER_HISTORY
}

export function recordSession(input: NewSession): void {
  const entry: SavedSession = { ...input, id: crypto.randomUUID(), createdAt: Date.now() }
  readHistory()
  historyState = [entry, ...(historyState ?? [])].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historyState))
  } catch {}
  historyListeners.forEach((l) => l())
}

export function useSessionHistory(): SavedSession[] {
  return useSyncExternalStore(subscribeHistory, getHistorySnapshot, getHistoryServerSnapshot)
}