"use client"

import { useSessionHistory } from "@/lib/history"
import SessionScreen from "@/components/SessionScreen"

export default function Page() {
  const sessions = useSessionHistory()
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = sessions.filter((s) => s.date === today).length

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold tracking-tight">Allies</span>
          <span className="text-xs text-muted">{todayCount > 0 ? `${todayCount} session${todayCount === 1 ? "" : "s"} today` : "no sessions yet"}</span>
        </div>
      </header>
      <SessionScreen />
    </div>
  )
}