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

// ── Status → colour palette (matches the app's appointments calendar) ──────
function statusStyle(status: DisplayAppointment["status"]) {
  switch (status) {
    case "scheduled":
      return { bg: "bg-blue-50",    border: "border-blue-400",    text: "text-blue-900",    dot: "bg-blue-500",    label: "Scheduled" }
    case "checked-in":
      return { bg: "bg-purple-50",  border: "border-purple-400",  text: "text-purple-900",  dot: "bg-purple-500",  label: "Checked In" }
    case "in-progress":
      return { bg: "bg-orange-50",  border: "border-orange-500",  text: "text-orange-900",  dot: "bg-orange-500",  label: "In Progress" }
    case "completed":
      return { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-900", dot: "bg-emerald-500", label: "Completed" }
    case "cancelled":
      return { bg: "bg-red-50",     border: "border-red-400",     text: "text-red-900",     dot: "bg-red-500",     label: "Cancelled" }
    case "no-show":
      return { bg: "bg-gray-100",   border: "border-gray-300",    text: "text-gray-700",    dot: "bg-gray-400",    label: "No Show" }
    default:
      return { bg: "bg-slate-100",  border: "border-slate-300",   text: "text-slate-800",   dot: "bg-slate-400",   label: status }
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

// ── Highlight rule ─────────────────────────────────────────────────────────
// The "current" appointment is any in-progress one; if none, the next
// upcoming scheduled/checked-in appointment closest to now.
function isCurrentAppointment(
  a: DisplayAppointment,
  now: Date,
  allActive: DisplayAppointment[]
): boolean {
  if (a.status === "in-progress") return true
  const anyInProgress = allActive.some((x) => x.status === "in-progress")
  if (anyInProgress) return false
  // Fallback: next upcoming (scheduled or checked-in) by clock time
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const upcoming = allActive
    .filter((x) => x.status === "scheduled" || x.status === "checked-in")
    .map((x) => {
      const [h, m] = x.time.split(":").map(Number)
      return { id: x.id, mins: h * 60 + m }
    })
    .filter((x) => x.mins >= nowMins - 15) // ±15 min tolerance
    .sort((a, b) => a.mins - b.mins)
  return upcoming[0]?.id === a.id
}

// ═══════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════
export default function DisplayBoardPage() {
  const now = useLiveClock()
  const { data, error, lastSync } = useLiveData()

  // Partition appointments — active (left 70%) vs completed (right 30%)
  const { active, completed } = useMemo(() => {
    const all = data?.appointments ?? []
    return {
      active: all
        .filter((a) => a.status !== "completed")
        .sort((a, b) => a.time.localeCompare(b.time)),
      completed: all
        .filter((a) => a.status === "completed")
        .sort((a, b) => b.time.localeCompare(a.time)), // most recently done first
    }
  }, [data])

  const clockTime = now.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
  const clockDate = data ? formatDateLong(data.date) : ""
  const secondsSinceSync = lastSync
    ? Math.max(0, Math.floor((now.getTime() - lastSync.getTime()) / 1000))
    : null

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-8 py-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {data?.clinicName ?? "Clinic"} · <span className="text-slate-300">Appointments Board</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">{clockDate}</p>
        </div>
        <div className="text-right">
          <p className="text-5xl font-mono font-bold tabular-nums text-white">{clockTime}</p>
          <div className="mt-1 flex items-center justify-end gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                error ? "bg-red-500" : secondsSinceSync !== null && secondsSinceSync < 30 ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="text-slate-400">
              {error
                ? `Sync error: ${error}`
                : lastSync
                ? `Live · updated ${secondsSinceSync ?? 0}s ago`
                : "Loading…"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main className="flex flex-1 gap-6 p-6 overflow-hidden">
        {/* Left 70% — Active / upcoming appointments */}
        <section className="flex-[7] flex flex-col min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-100">
              Today’s Appointments{" "}
              <span className="text-slate-500 text-base font-normal">· {active.length}</span>
            </h2>
            <StatusLegend />
          </div>

          {active.length === 0 ? (
            <EmptyPanel
              message={
                data === null
                  ? "Loading appointments…"
                  : "No active appointments for today."
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto pr-1">
              {active.map((a) => {
                const s = statusStyle(a.status)
                const current = isCurrentAppointment(a, now, active)
                return (
                  <article
                    key={a.id}
                    className={[
                      "relative flex flex-col gap-2 rounded-xl border-2 p-4 transition-all",
                      s.bg,
                      s.border,
                      current ? "ring-4 ring-orange-400 ring-offset-2 ring-offset-slate-950 scale-[1.02] shadow-xl" : "",
                    ].join(" ")}
                  >
                    {current && (
                      <span className="absolute -top-3 left-4 rounded-full bg-orange-500 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                        Now Serving
                      </span>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={`text-2xl font-bold ${s.text}`}>
                        {formatTime12h(a.time)}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full ${s.bg} ${s.text} px-2.5 py-0.5 text-xs font-semibold border ${s.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>
                    <p className={`text-lg font-semibold leading-tight ${s.text}`}>
                      {a.patientName}
                    </p>
                    <div className={`text-sm ${s.text} opacity-80`}>
                      <p className="truncate">
                        {a.doctorName ? `Dr. ${a.doctorName}` : <span className="italic">Doctor not assigned</span>}
                      </p>
                      {a.doctorSpecialty && (
                        <p className="text-xs opacity-70 truncate">{a.doctorSpecialty}</p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* Right 30% — Completed */}
        <aside className="flex-[3] flex flex-col min-w-0 border-l border-slate-800 pl-6">
          <h2 className="mb-3 text-xl font-semibold text-emerald-400">
            Completed{" "}
            <span className="text-slate-500 text-base font-normal">· {completed.length}</span>
          </h2>

          {completed.length === 0 ? (
            <EmptyPanel message="No completed visits yet today." muted />
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto pr-1">
              {completed.map((a) => {
                const s = statusStyle(a.status)
                return (
                  <article
                    key={a.id}
                    className={`flex items-center justify-between rounded-lg border ${s.border} ${s.bg} p-3`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${s.text}`}>
                        {a.patientName}
                      </p>
                      <p className={`text-xs opacity-70 truncate ${s.text}`}>
                        {a.doctorName ? `Dr. ${a.doctorName}` : "—"}
                      </p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className={`text-sm font-bold ${s.text}`}>{formatTime12h(a.time)}</p>
                      <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide">
                        ✓ Done
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </aside>
      </main>

      {/* ── Footer / status line ───────────────────────────────────────── */}
      <footer className="border-t border-slate-800 bg-slate-900 px-8 py-2 text-center text-xs text-slate-500">
        Screen auto-updates every 15 seconds · For assistance please contact the reception desk
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${i.dot}`} />
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
        "flex flex-1 items-center justify-center rounded-xl border-2 border-dashed",
        muted
          ? "border-slate-800 bg-slate-900/30 text-slate-500"
          : "border-slate-700 bg-slate-900/50 text-slate-400",
      ].join(" ")}
    >
      <p className="text-lg">{message}</p>
    </div>
  )
}
