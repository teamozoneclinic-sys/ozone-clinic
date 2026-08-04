"use client"

import { useEffect, useMemo, useState } from "react"

// ── Types ───────────────────────────────────────────────────────────────────
type DisplayAppointment = {
  id: string
  time: string
  duration: number
  status: "scheduled" | "checked-in" | "in-progress" | "completed" | "cancelled" | "no-show"
  patientName: string
  doctorName: string
  doctorSpecialty: string
  type: string
}

type DisplayPayload = {
  date: string
  clinicName: string
  serverTime: string
  appointments: DisplayAppointment[]
}

// ── Status colour system (mirrors the app's calendar palette) ──────────────
function statusStyle(status: DisplayAppointment["status"]) {
  switch (status) {
    case "scheduled":
      return { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-900",    accent: "border-l-blue-500",    dot: "bg-blue-500",    label: "Scheduled" }
    case "checked-in":
      return { bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-900",  accent: "border-l-purple-500",  dot: "bg-purple-500",  label: "Checked In" }
    case "in-progress":
      return { bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-900",  accent: "border-l-orange-500",  dot: "bg-orange-500",  label: "In Progress" }
    case "completed":
      return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", accent: "border-l-emerald-500", dot: "bg-emerald-500", label: "Completed" }
    case "cancelled":
      return { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-900",     accent: "border-l-red-500",     dot: "bg-red-500",     label: "Cancelled" }
    case "no-show":
      return { bg: "bg-gray-100",   border: "border-gray-200",    text: "text-gray-700",    accent: "border-l-gray-400",    dot: "bg-gray-400",    label: "No Show" }
    default:
      return { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-800",   accent: "border-l-slate-400",   dot: "bg-slate-400",   label: status }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime12h(hhmm: string): string {
  if (!hhmm || !hhmm.includes(":")) return hhmm
  const [h, m] = hhmm.split(":").map(Number)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, "0")} ${period}`
}

function formatDateLong(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-PK", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    })
  } catch { return iso }
}

// ── Hooks ──────────────────────────────────────────────────────────────────
function useLiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function useLiveData() {
  const [data, setData] = useState<DisplayPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch("/api/display/today", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((json: DisplayPayload) => {
          if (cancelled) return
          setData(json); setLastSync(new Date()); setError(null)
        })
        .catch((e) => {
          if (cancelled) return
          setError(e instanceof Error ? e.message : "Sync failed")
        })
    }
    load()
    const interval = setInterval(load, 15_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { data, error, lastSync }
}

// ── Compute NOW + UP NEXT ─────────────────────────────────────────────────
function getFocusedIds(active: DisplayAppointment[], now: Date) {
  const queue = active
    .filter((x) => ["scheduled", "checked-in", "in-progress"].includes(x.status))
    .sort((a, b) => a.time.localeCompare(b.time))

  const inProgress = queue.find((x) => x.status === "in-progress")
  let currentId: string | null = null

  if (inProgress) {
    currentId = inProgress.id
  } else {
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const imminent = queue
      .map((x) => {
        const [h, m] = x.time.split(":").map(Number)
        return { id: x.id, mins: h * 60 + m }
      })
      .filter((x) => x.mins >= nowMins - 15)
      .sort((a, b) => a.mins - b.mins)[0]
    if (imminent) currentId = imminent.id
  }

  let upNextId: string | null = null
  const currentIdx = currentId ? queue.findIndex((x) => x.id === currentId) : -1
  for (let i = currentIdx + 1; i < queue.length; i++) {
    if (["scheduled", "checked-in"].includes(queue[i].status)) {
      upNextId = queue[i].id; break
    }
  }
  if (!upNextId && !currentId && queue.length > 0) upNextId = queue[0].id

  return { currentId, upNextId }
}

// ═══════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════
export default function DisplayBoardPage() {
  const now = useLiveClock()
  const { data, error, lastSync } = useLiveData()

  const { active, completed } = useMemo(() => {
    const all = data?.appointments ?? []
    return {
      active: all
        .filter((a) => a.status !== "completed")
        .sort((a, b) => a.time.localeCompare(b.time)),
      completed: all
        .filter((a) => a.status === "completed")
        .sort((a, b) => b.time.localeCompare(a.time)),
    }
  }, [data])

  const nowMinute = Math.floor(now.getTime() / 60_000)
  const { currentId, upNextId } = useMemo(
    () => getFocusedIds(active, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, nowMinute]
  )

  const clockTime = now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true })
  const clockDate = data ? formatDateLong(data.date) : ""
  const secondsSinceSync = lastSync
    ? Math.max(0, Math.floor((now.getTime() - lastSync.getTime()) / 1000))
    : null

  return (
    <div
      className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden"
      style={
        {
          // Fluid typography — but with sensible caps so wide TVs don't
          // blow up compact side-panel content.
          "--txt-clock": "clamp(2rem, 3.6vw, 4.5rem)",
          "--txt-h1":    "clamp(1.05rem, 1.7vw, 2rem)",
          "--txt-h2":    "clamp(0.85rem, 1.1vw, 1.25rem)",
          "--txt-time":  "clamp(0.95rem, 1.2vw, 1.5rem)",
          "--txt-name":  "clamp(0.85rem, 1vw,   1.25rem)",
          "--txt-meta":  "clamp(0.7rem,  0.8vw, 0.95rem)",
          "--txt-body":  "clamp(0.72rem, 0.82vw, 0.95rem)",
        } as React.CSSProperties
      }
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1
            style={{ fontSize: "var(--txt-h1)" }}
            className="font-bold tracking-tight text-foreground truncate leading-tight"
          >
            {data?.clinicName ?? "Clinic"}
            <span className="ml-2 text-muted-foreground font-medium">· Appointments Board</span>
          </h1>
          <p style={{ fontSize: "var(--txt-body)" }} className="mt-0.5 text-muted-foreground">
            {clockDate}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            style={{ fontSize: "var(--txt-clock)" }}
            className="font-mono font-bold tabular-nums text-foreground leading-none"
          >
            {clockTime}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                error ? "bg-red-500"
                : secondsSinceSync !== null && secondsSinceSync < 30 ? "bg-emerald-500 animate-pulse"
                : "bg-amber-500"
              }`}
            />
            <span className="text-muted-foreground">
              {error ? `Sync error: ${error}`
                : lastSync ? `Live · updated ${secondsSinceSync ?? 0}s ago`
                : "Loading…"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[70%_30%] gap-4 p-4 overflow-hidden">
        {/* Left 70% — Active */}
        <section className="flex flex-col min-h-0 overflow-hidden">
          <div className="mb-3 flex items-center justify-between gap-3 shrink-0">
            <h2
              style={{ fontSize: "var(--txt-h2)" }}
              className="font-semibold text-foreground"
            >
              Today&rsquo;s Appointments
              <span className="ml-2 font-normal text-muted-foreground">· {active.length}</span>
            </h2>
            <StatusLegend />
          </div>

          {active.length === 0 ? (
            <EmptyPanel
              message={data === null ? "Loading appointments…" : "No active appointments for today."}
            />
          ) : (
            <div
              className="flex-1 min-h-0 grid gap-3 overflow-hidden"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                gridAutoRows: "minmax(0, 1fr)",
              }}
            >
              {active.map((a) => {
                const s = statusStyle(a.status)
                const isNow = a.id === currentId
                const isUpNext = a.id === upNextId
                return (
                  <article
                    key={a.id}
                    className={[
                      "relative flex flex-col rounded-xl border overflow-hidden bg-card min-h-0",
                      s.border,
                      isNow ? "ring-2 ring-orange-500 shadow-[0_0_18px_-2px_rgba(249,115,22,0.55)]" : "",
                      isUpNext ? "ring-2 ring-sky-500 shadow-[0_0_14px_-4px_rgba(14,165,233,0.5)]" : "",
                    ].join(" ")}
                  >
                    {/* Top ribbon — NOW SERVING or UP NEXT (inline, no clipping) */}
                    {isNow && (
                      <div className="flex items-center gap-1.5 bg-orange-500 px-3 py-1 text-white">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest">
                          Now Serving
                        </span>
                      </div>
                    )}
                    {isUpNext && (
                      <div className="flex items-center gap-1.5 bg-sky-500 px-3 py-1 text-white animate-pulse">
                        <span className="h-2 w-2 rounded-full bg-white" />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest">
                          Up Next · Please Get Ready
                        </span>
                      </div>
                    )}

                    {/* Card body */}
                    <div className={`flex-1 min-h-0 flex flex-col justify-between border-l-4 ${s.bg} ${s.accent} px-3 py-2.5`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          style={{ fontSize: "var(--txt-time)" }}
                          className={`font-bold leading-tight ${s.text}`}
                        >
                          {formatTime12h(a.time)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full ${s.bg} ${s.text} px-1.5 py-0.5 text-[10px] font-semibold border ${s.border} shrink-0`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      <p
                        style={{ fontSize: "var(--txt-name)" }}
                        className={`mt-1 font-semibold leading-tight truncate ${s.text}`}
                      >
                        {a.patientName}
                      </p>
                      <p
                        style={{ fontSize: "var(--txt-meta)" }}
                        className={`mt-0.5 leading-tight truncate opacity-75 ${s.text}`}
                      >
                        {a.doctorName ? `Dr. ${a.doctorName}` : <em className="opacity-70">Doctor not assigned</em>}
                        {a.doctorSpecialty ? ` · ${a.doctorSpecialty}` : ""}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* Right 30% — Completed (compact history sidebar) */}
        <aside className="flex flex-col min-h-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="shrink-0 border-b border-border px-3 py-2 flex items-baseline justify-between gap-2">
            <h2
              style={{ fontSize: "var(--txt-h2)" }}
              className="font-semibold text-emerald-700"
            >
              Completed
            </h2>
            <span className="text-xs font-medium text-muted-foreground">
              {completed.length} today
            </span>
          </div>

          {completed.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-muted-foreground">No completed visits yet.</p>
            </div>
          ) : (
            <div
              className="flex-1 min-h-0 grid p-2 gap-1.5 overflow-hidden"
              style={{ gridAutoRows: "minmax(0, 1fr)" }}
            >
              {completed.map((a) => (
                <article
                  key={a.id}
                  className="flex items-center gap-2 min-w-0 rounded-md border border-emerald-100 border-l-4 border-l-emerald-500 bg-emerald-50/60 px-2.5 py-1.5 overflow-hidden"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-emerald-900 truncate leading-tight">
                      {a.patientName}
                    </p>
                    <p className="text-[11px] text-emerald-800/70 truncate leading-tight mt-0.5">
                      {a.doctorName ? `Dr. ${a.doctorName}` : "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                    <span className="text-[12px] font-bold text-emerald-900 tabular-nums leading-none">
                      {formatTime12h(a.time)}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider leading-none">
                      ✓ Done
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-border bg-card px-6 py-1.5 text-center text-[11px] text-muted-foreground">
        Screen auto-updates every 15 seconds · For assistance, please contact the reception desk
      </footer>
    </div>
  )
}

// ── Helper components ──────────────────────────────────────────────────────

function StatusLegend() {
  const items = [
    { label: "Scheduled",   dot: "bg-blue-500" },
    { label: "Checked In",  dot: "bg-purple-500" },
    { label: "In Progress", dot: "bg-orange-500" },
    { label: "Completed",   dot: "bg-emerald-500" },
    { label: "Cancelled",   dot: "bg-red-500" },
    { label: "No Show",     dot: "bg-gray-400" },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${i.dot}`} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground">
      <p className="text-sm">{message}</p>
    </div>
  )
}
