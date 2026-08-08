"use client"

import { useEffect, useMemo, useState } from "react"

// ── Types ───────────────────────────────────────────────────────────────────
type Status = "scheduled" | "checked-in" | "in-progress" | "completed" | "cancelled" | "no-show"

type DisplayAppointment = {
  id: string
  time: string
  duration: number
  status: Status
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

// ── Column theme system (each column has its own colour tokens) ────────────
type ColumnTheme = {
  key: "scheduled" | "checked-in" | "in-progress" | "completed"
  title: string
  bg: string           // subtle tinted background for the column
  headerBar: string    // top accent bar on the column
  titleText: string    // heading colour
  cardAccent: string   // left border on each card
  countBg: string      // count badge in header
  countText: string
}

const COLUMNS: ColumnTheme[] = [
  {
    key: "scheduled",
    title: "Scheduled",
    bg: "bg-blue-50/40",
    headerBar: "bg-blue-500",
    titleText: "text-blue-800",
    cardAccent: "border-l-blue-500",
    countBg: "bg-blue-100",
    countText: "text-blue-800",
  },
  {
    key: "checked-in",
    title: "Checked In",
    bg: "bg-purple-50/40",
    headerBar: "bg-purple-500",
    titleText: "text-purple-800",
    cardAccent: "border-l-purple-500",
    countBg: "bg-purple-100",
    countText: "text-purple-800",
  },
  {
    key: "in-progress",
    title: "In Progress",
    bg: "bg-orange-50/50",
    headerBar: "bg-orange-500",
    titleText: "text-orange-800",
    cardAccent: "border-l-orange-500",
    countBg: "bg-orange-100",
    countText: "text-orange-800",
  },
  {
    key: "completed",
    title: "Completed",
    bg: "bg-emerald-50/40",
    headerBar: "bg-emerald-500",
    titleText: "text-emerald-800",
    cardAccent: "border-l-emerald-500",
    countBg: "bg-emerald-100",
    countText: "text-emerald-800",
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════
export default function DisplayBoardPage() {
  const now = useLiveClock()
  const { data, error, lastSync } = useLiveData()

  // Bucket every appointment into its column (cancelled + no-show are omitted
  // from the patient-facing board — they never help someone in the waiting room)
  const buckets = useMemo(() => {
    const all = data?.appointments ?? []
    const byTimeAsc = (a: DisplayAppointment, b: DisplayAppointment) =>
      a.time.localeCompare(b.time)
    const byTimeDesc = (a: DisplayAppointment, b: DisplayAppointment) =>
      b.time.localeCompare(a.time)
    return {
      scheduled:   all.filter((a) => a.status === "scheduled").sort(byTimeAsc),
      "checked-in": all.filter((a) => a.status === "checked-in").sort(byTimeAsc),
      "in-progress": all.filter((a) => a.status === "in-progress").sort(byTimeAsc),
      completed:   all.filter((a) => a.status === "completed").sort(byTimeDesc), // newest done first
    } as const
  }, [data])

  // "Up Next" = the first checked-in patient; falls back to first scheduled
  // if the waiting room is empty.
  const upNextId = useMemo(() => {
    return buckets["checked-in"][0]?.id ?? buckets.scheduled[0]?.id ?? null
  }, [buckets])

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
          "--txt-clock": "clamp(1.75rem, 3.2vw, 3.75rem)",
          "--txt-h1":    "clamp(1rem,    1.6vw, 1.85rem)",
          "--txt-h2":    "clamp(0.8rem,  1vw,   1.2rem)",
          "--txt-time":  "clamp(0.9rem,  1.15vw, 1.4rem)",
          "--txt-name":  "clamp(0.85rem, 1vw,   1.2rem)",
          "--txt-meta":  "clamp(0.7rem,  0.82vw, 0.95rem)",
          "--txt-body":  "clamp(0.72rem, 0.85vw, 0.95rem)",
        } as React.CSSProperties
      }
    >
      {/* Custom scrollbars — thin, matches the theme */}
      <style>{`
        .col-scroll::-webkit-scrollbar { width: 6px; }
        .col-scroll::-webkit-scrollbar-track { background: transparent; }
        .col-scroll::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.35); border-radius: 3px; }
        .col-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.55); }
        .col-scroll { scrollbar-width: thin; scrollbar-color: rgba(100, 116, 139, 0.35) transparent; }
      `}</style>

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

      {/* ── Body: 4 columns ────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-3 overflow-hidden">
        {COLUMNS.map((col) => (
          <BoardColumn
            key={col.key}
            theme={col}
            items={buckets[col.key]}
            upNextId={upNextId}
            isLoading={data === null}
          />
        ))}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-border bg-card px-6 py-1.5 text-center text-[11px] text-muted-foreground">
        Screen auto-updates every 15 seconds · For assistance, please contact the reception desk
      </footer>
    </div>
  )
}

// ── Column ─────────────────────────────────────────────────────────────────
function BoardColumn({
  theme,
  items,
  upNextId,
  isLoading,
}: {
  theme: ColumnTheme
  items: readonly DisplayAppointment[]
  upNextId: string | null
  isLoading: boolean
}) {
  const isCompleted = theme.key === "completed"
  return (
    <section
      className={`flex flex-col min-h-0 overflow-hidden rounded-xl border border-border ${theme.bg}`}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${theme.headerBar} shrink-0`} />

      {/* Header */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 flex items-baseline justify-between gap-2">
        <h2
          style={{ fontSize: "var(--txt-h2)" }}
          className={`font-bold uppercase tracking-wider ${theme.titleText}`}
        >
          {theme.title}
        </h2>
        <span
          className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full ${theme.countBg} ${theme.countText} text-[11px] font-bold tabular-nums`}
        >
          {items.length}
        </span>
      </div>

      {/* Body — scrolls when it overflows */}
      <div className="flex-1 min-h-0 overflow-y-auto col-scroll px-2 pb-2">
        {isLoading ? (
          <EmptyState message="Loading…" />
        ) : items.length === 0 ? (
          <EmptyState
            message={
              theme.key === "scheduled"   ? "No upcoming appointments."
              : theme.key === "checked-in" ? "Waiting room is empty."
              : theme.key === "in-progress" ? "No consultations in progress."
              : "No completed visits yet."
            }
          />
        ) : (
          <div className={`flex flex-col ${isCompleted ? "gap-1.5" : "gap-2"}`}>
            {items.map((a) =>
              isCompleted ? (
                <CompletedRow key={a.id} appt={a} accentClass={theme.cardAccent} />
              ) : (
                <QueueCard
                  key={a.id}
                  appt={a}
                  accentClass={theme.cardAccent}
                  columnKey={theme.key}
                  isUpNext={a.id === upNextId}
                />
              )
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Queue card (Scheduled / Checked In / In Progress) ─────────────────────
function QueueCard({
  appt,
  accentClass,
  columnKey,
  isUpNext,
}: {
  appt: DisplayAppointment
  accentClass: string
  columnKey: ColumnTheme["key"]
  isUpNext: boolean
}) {
  const badge = getCardBadge(columnKey, isUpNext)

  return (
    <article
      className={`
        rounded-lg border border-border border-l-4 ${accentClass} bg-card
        px-3 py-2 flex flex-col gap-1
        ${columnKey === "in-progress" ? "shadow-[0_0_12px_-4px_rgba(249,115,22,0.45)]" : ""}
      `}
    >
      {/* Top row: time + badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          style={{ fontSize: "var(--txt-time)" }}
          className="font-bold text-foreground leading-none tabular-nums"
        >
          {formatTime12h(appt.time)}
        </span>
        {badge && (
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${badge.className}`}
          >
            {badge.pulseDot && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            )}
            {badge.text}
          </span>
        )}
      </div>

      {/* Patient */}
      <p
        style={{ fontSize: "var(--txt-name)" }}
        className="font-semibold text-foreground leading-tight truncate"
      >
        {appt.patientName}
      </p>

      {/* Doctor */}
      <p
        style={{ fontSize: "var(--txt-meta)" }}
        className="text-muted-foreground leading-tight truncate"
      >
        {appt.doctorName ? (
          <>
            {appt.doctorName}
            {appt.doctorSpecialty ? ` · ${appt.doctorSpecialty}` : ""}
          </>
        ) : (
          <em className="opacity-70">Doctor not assigned</em>
        )}
      </p>
    </article>
  )
}

// ── Compact completed row ──────────────────────────────────────────────────
function CompletedRow({ appt, accentClass }: { appt: DisplayAppointment; accentClass: string }) {
  return (
    <article
      className={`rounded-md border border-border border-l-4 ${accentClass} bg-card px-2.5 py-1.5 flex items-center gap-2`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
          {appt.patientName}
        </p>
        <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
          {appt.doctorName ? `${appt.doctorName}` : "—"}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-1">
        <span className="text-[12px] font-bold text-foreground tabular-nums">
          {formatTime12h(appt.time)}
        </span>
        <span className="text-emerald-600 text-sm leading-none" aria-label="Completed">✓</span>
      </div>
    </article>
  )
}

// ── Card badge logic — SCHEDULED / UP NEXT / WAITING / NOW SERVING ────────
function getCardBadge(
  columnKey: ColumnTheme["key"],
  isUpNext: boolean
): { text: string; className: string; pulseDot?: boolean } | null {
  if (columnKey === "in-progress") {
    return { text: "Now Serving", className: "bg-orange-500 text-white", pulseDot: true }
  }
  if (columnKey === "checked-in") {
    if (isUpNext) return { text: "Up Next", className: "bg-orange-500 text-white", pulseDot: true }
    return { text: "Waiting", className: "bg-slate-200 text-slate-700" }
  }
  if (columnKey === "scheduled") {
    if (isUpNext) return { text: "Up Next", className: "bg-orange-500 text-white", pulseDot: true }
    return { text: "Scheduled", className: "bg-slate-700 text-white" }
  }
  return null
}

// ── Empty state ────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center py-6">
      <p className="text-[12px] text-muted-foreground italic text-center px-2">{message}</p>
    </div>
  )
}
