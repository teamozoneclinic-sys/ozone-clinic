"use client"

import { useEffect, useMemo, useState } from "react"

// ── Types ───────────────────────────────────────────────────────────────────
type DisplayAppointment = {
  id: string
  time: string       // "HH:mm"
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

// ── Status → colour palette (matches the app's appointment calendar exactly) ──
function statusStyle(status: DisplayAppointment["status"]) {
  switch (status) {
    case "scheduled":
      return { bg: "bg-blue-50",    border: "border-blue-300",    text: "text-blue-900",    accent: "border-l-blue-500",    dot: "bg-blue-500",    label: "Scheduled" }
    case "checked-in":
      return { bg: "bg-purple-50",  border: "border-purple-300",  text: "text-purple-900",  accent: "border-l-purple-500",  dot: "bg-purple-500",  label: "Checked In" }
    case "in-progress":
      return { bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-900",  accent: "border-l-orange-500",  dot: "bg-orange-500",  label: "In Progress" }
    case "completed":
      return { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-900", accent: "border-l-emerald-500", dot: "bg-emerald-500", label: "Completed" }
    case "cancelled":
      return { bg: "bg-red-50",     border: "border-red-300",     text: "text-red-900",     accent: "border-l-red-500",     dot: "bg-red-500",     label: "Cancelled" }
    case "no-show":
      return { bg: "bg-gray-100",   border: "border-gray-300",    text: "text-gray-700",    accent: "border-l-gray-400",    dot: "bg-gray-400",    label: "No Show" }
    default:
      return { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-800",   accent: "border-l-slate-400",   dot: "bg-slate-400",   label: status }
  }
}

// "17:00" → "5:00 PM"
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
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

// ── Live clock (updates every second in the browser) ───────────────────────
function useLiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

// ── Auto-refresh appointments every 15s ────────────────────────────────────
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
          setData(json)
          setLastSync(new Date())
          setError(null)
        })
        .catch((e) => {
          if (cancelled) return
          setError(e instanceof Error ? e.message : "Sync failed")
        })
    }
    load()
    const interval = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { data, error, lastSync }
}

// ── Highlight the "current" appointment ────────────────────────────────────
function isCurrentAppointment(
  a: DisplayAppointment,
  now: Date,
  allActive: DisplayAppointment[]
): boolean {
  if (a.status === "in-progress") return true
  const anyInProgress = allActive.some((x) => x.status === "in-progress")
  if (anyInProgress) return false
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const upcoming = allActive
    .filter((x) => x.status === "scheduled" || x.status === "checked-in")
    .map((x) => {
      const [h, m] = x.time.split(":").map(Number)
      return { id: x.id, mins: h * 60 + m }
    })
    .filter((x) => x.mins >= nowMins - 15)
    .sort((a, b) => a.mins - b.mins)
  return upcoming[0]?.id === a.id
}

// ═══════════════════════════════════════════════════════════════════════════
// Page — fixed height, no scrolling, matches the app's light theme
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

  const clockTime = now.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
  const clockDate = data ? formatDateLong(data.date) : ""
  const secondsSinceSync = lastSync
    ? Math.max(0, Math.floor((now.getTime() - lastSync.getTime()) / 1000))
    : null

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
            {data?.clinicName ?? "Clinic"}
            <span className="ml-2 text-muted-foreground font-medium">· Appointments Board</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{clockDate}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-4xl font-mono font-bold tabular-nums text-foreground">{clockTime}</p>
          <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                error
                  ? "bg-red-500"
                  : secondsSinceSync !== null && secondsSinceSync < 30
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-amber-500"
              }`}
            />
            <span className="text-muted-foreground">
              {error
                ? `Sync error: ${error}`
                : lastSync
                ? `Live · updated ${secondsSinceSync ?? 0}s ago`
                : "Loading…"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Body (fills remaining height, never scrolls) ───────────────── */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[70%_30%] gap-3 p-3 overflow-hidden">
        {/* Left 70% — Active */}
        <section className="flex flex-col min-h-0 overflow-hidden">
          <div className="mb-2 flex items-center justify-between shrink-0">
            <h2 className="text-base font-semibold text-foreground">
              Today&rsquo;s Appointments
              <span className="ml-2 text-sm font-normal text-muted-foreground">· {active.length}</span>
            </h2>
            <StatusLegend />
          </div>

          {active.length === 0 ? (
            <EmptyPanel message={data === null ? "Loading appointments…" : "No active appointments for today."} />
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <div
                className="grid gap-2 h-full"
                style={{
                  // Auto-fit as many columns as fit, min card width 200px
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
                  gridAutoRows: "minmax(0, 1fr)",
                }}
              >
                {active.map((a) => {
                  const s = statusStyle(a.status)
                  const current = isCurrentAppointment(a, now, active)
                  return (
                    <article
                      key={a.id}
                      className={[
                        "relative flex flex-col justify-between rounded-lg border border-l-4 px-3 py-2 min-h-0 overflow-hidden",
                        s.bg,
                        s.border,
                        s.accent,
                        current ? "ring-2 ring-orange-500 shadow-md" : "",
                      ].join(" ")}
                    >
                      {current && (
                        <span className="absolute top-1 right-1 rounded-full bg-orange-500 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                          Now
                        </span>
                      )}
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-lg font-bold leading-tight ${s.text}`}>
                          {formatTime12h(a.time)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full ${s.bg} ${s.text} px-1.5 py-0 text-[10px] font-semibold border ${s.border} shrink-0`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      <p className={`mt-0.5 text-sm font-semibold leading-tight truncate ${s.text}`}>
                        {a.patientName}
                      </p>
                      <p className={`text-[11px] leading-tight truncate opacity-80 ${s.text}`}>
                        {a.doctorName ? `Dr. ${a.doctorName}` : <em className="opacity-70">Doctor not assigned</em>}
                        {a.doctorSpecialty ? ` · ${a.doctorSpecialty}` : ""}
                      </p>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {/* Right 30% — Completed */}
        <aside className="flex flex-col min-h-0 overflow-hidden border-l border-border pl-3">
          <h2 className="mb-2 text-base font-semibold text-emerald-700 shrink-0">
            Completed
            <span className="ml-2 text-sm font-normal text-muted-foreground">· {completed.length}</span>
          </h2>

          {completed.length === 0 ? (
            <EmptyPanel message="No completed visits yet." muted />
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <div
                className="grid gap-1.5 h-full"
                style={{
                  gridAutoRows: "minmax(0, 1fr)",
                }}
              >
                {completed.map((a) => {
                  const s = statusStyle(a.status)
                  return (
                    <article
                      key={a.id}
                      className={`flex items-center justify-between rounded-md border ${s.border} ${s.bg} px-2.5 py-1.5 min-h-0 overflow-hidden`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate leading-tight ${s.text}`}>
                          {a.patientName}
                        </p>
                        <p className={`text-[11px] opacity-70 truncate leading-tight ${s.text}`}>
                          {a.doctorName ? `Dr. ${a.doctorName}` : "—"}
                        </p>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <p className={`text-sm font-bold leading-tight ${s.text}`}>
                          {formatTime12h(a.time)}
                        </p>
                        <p className="text-[9px] text-emerald-700 font-semibold uppercase tracking-wide leading-tight">
                          ✓ Done
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* ── Footer / status line ───────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-border bg-card px-6 py-1.5 text-center text-[11px] text-muted-foreground">
        Screen auto-updates every 15 seconds · For assistance, please contact the reception desk
      </footer>
    </div>
  )
}

// ── Small helper components ────────────────────────────────────────────────

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
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${i.dot}`} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

function EmptyPanel({ message, muted = false }: { message: string; muted?: boolean }) {
  return (
    <div
      className={[
        "flex flex-1 items-center justify-center rounded-lg border-2 border-dashed",
        muted
          ? "border-border/60 bg-muted/30 text-muted-foreground"
          : "border-border bg-muted/40 text-muted-foreground",
      ].join(" ")}
    >
      <p className="text-sm">{message}</p>
    </div>
  )
}
