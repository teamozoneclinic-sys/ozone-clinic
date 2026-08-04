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

// ── Compute which appointment is "NOW" and which is "UP NEXT" ─────────────
// NOW  = the in-progress appointment (or, if none, the imminent scheduled/
//        checked-in one within ±15 min of the current time).
// UP NEXT = the next scheduled/checked-in appointment after NOW in the
//        chronological queue — this gets a blinking indicator so the
//        patient in the waiting room knows to be ready.
function getFocusedIds(
  active: DisplayAppointment[],
  now: Date
): { currentId: string | null; upNextId: string | null } {
  const queue = active
    .filter(
      (x) => x.status === "scheduled" || x.status === "checked-in" || x.status === "in-progress"
    )
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

  // UP NEXT = next scheduled/checked-in after the current one
  let upNextId: string | null = null
  const currentIdx = currentId ? queue.findIndex((x) => x.id === currentId) : -1
  for (let i = currentIdx + 1; i < queue.length; i++) {
    if (queue[i].status === "scheduled" || queue[i].status === "checked-in") {
      upNextId = queue[i].id
      break
    }
  }
  // If nothing is "current" and the first thing in queue isn't already
  // marked as current, that first upcoming is up-next.
  if (!upNextId && !currentId && queue.length > 0) {
    upNextId = queue[0].id
  }

  return { currentId, upNextId }
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

  // Recompute focus (NOW / UP NEXT) every minute — depends on `now` too, but
  // we don't need it to churn every second, so bucket by minute.
  const nowMinute = Math.floor(now.getTime() / 60_000)
  const { currentId, upNextId } = useMemo(
    () => getFocusedIds(active, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, nowMinute]
  )

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
    <div
      className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden"
      style={
        {
          // Fluid typography — every text size scales with viewport width via
          // clamp(min, preferred-vw, max). Reads well on a 720p monitor and
          // a 4K TV without any breakpoint fiddling.
          "--txt-h1":    "clamp(1.15rem, 2.1vw, 2.5rem)",
          "--txt-clock": "clamp(2rem,   4.2vw, 5.5rem)",
          "--txt-h2":    "clamp(0.9rem, 1.3vw, 1.5rem)",
          "--txt-time":  "clamp(0.95rem, 1.4vw, 1.85rem)",
          "--txt-name":  "clamp(0.85rem, 1.15vw, 1.45rem)",
          "--txt-meta":  "clamp(0.65rem, 0.85vw, 1.05rem)",
          "--txt-badge": "clamp(0.55rem, 0.72vw, 0.9rem)",
          "--txt-body":  "clamp(0.7rem, 0.9vw, 1.05rem)",
          "--txt-tiny":  "clamp(0.6rem, 0.72vw, 0.85rem)",
        } as React.CSSProperties
      }
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border bg-card px-[clamp(1rem,2vw,2rem)] py-[clamp(0.5rem,1vw,1rem)] flex items-center justify-between gap-4">
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
          <div
            style={{ fontSize: "var(--txt-tiny)" }}
            className="mt-1 flex items-center justify-end gap-1.5"
          >
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
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[70%_30%] gap-[clamp(0.5rem,1vw,1rem)] p-[clamp(0.5rem,1vw,1rem)] overflow-hidden">
        {/* Left 70% — Active */}
        <section className="flex flex-col min-h-0 overflow-hidden">
          <div className="mb-2 flex items-center justify-between gap-3 shrink-0">
            <h2
              style={{ fontSize: "var(--txt-h2)" }}
              className="font-semibold text-foreground"
            >
              Today&rsquo;s Appointments
              <span
                style={{ fontSize: "var(--txt-body)" }}
                className="ml-2 font-normal text-muted-foreground"
              >
                · {active.length}
              </span>
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
                  const isNow = a.id === currentId
                  const isUpNext = a.id === upNextId
                  return (
                    <article
                      key={a.id}
                      className={[
                        "relative flex flex-col justify-between rounded-lg border border-l-4 px-3 py-2 min-h-0 overflow-hidden transition-all",
                        s.bg,
                        s.border,
                        s.accent,
                        isNow
                          ? "ring-4 ring-orange-500 ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(249,115,22,0.55)] z-10"
                          : "",
                        isUpNext
                          ? "ring-2 ring-sky-500 ring-offset-1 ring-offset-background shadow-md"
                          : "",
                      ].join(" ")}
                    >
                      {/* NOW badge — big, absolute, pulsing so it's unmissable */}
                      {isNow && (
                        <>
                          {/* Pulsing outer glow — animate-ping fades + expands */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-lg ring-4 ring-orange-400 animate-ping opacity-30"
                          />
                          <span
                            style={{ fontSize: "var(--txt-badge)" }}
                            className="absolute -top-2 left-2 z-20 rounded-full bg-orange-500 px-2 py-0.5 font-extrabold uppercase tracking-wider text-white shadow-md flex items-center gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            Now Serving
                          </span>
                        </>
                      )}
                      {/* UP NEXT badge — blinking to attract the patient's attention */}
                      {isUpNext && (
                        <span
                          style={{ fontSize: "var(--txt-badge)" }}
                          className="absolute -top-2 left-2 z-20 rounded-full bg-sky-500 px-2 py-0.5 font-extrabold uppercase tracking-wider text-white shadow animate-pulse flex items-center gap-1"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          Up Next — Please Get Ready
                        </span>
                      )}

                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          style={{ fontSize: "var(--txt-time)" }}
                          className={`font-bold leading-tight ${s.text}`}
                        >
                          {formatTime12h(a.time)}
                        </span>
                        <span
                          style={{ fontSize: "var(--txt-badge)" }}
                          className={`inline-flex items-center gap-1 rounded-full ${s.bg} ${s.text} px-1.5 py-0 font-semibold border ${s.border} shrink-0`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      <p
                        style={{ fontSize: "var(--txt-name)" }}
                        className={`mt-0.5 font-semibold leading-tight truncate ${s.text}`}
                      >
                        {a.patientName}
                      </p>
                      <p
                        style={{ fontSize: "var(--txt-meta)" }}
                        className={`leading-tight truncate opacity-80 ${s.text}`}
                      >
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
        <aside className="flex flex-col min-h-0 overflow-hidden border-l border-border pl-[clamp(0.5rem,1vw,1rem)]">
          <h2
            style={{ fontSize: "var(--txt-h2)" }}
            className="mb-2 font-semibold text-emerald-700 shrink-0"
          >
            Completed
            <span
              style={{ fontSize: "var(--txt-body)" }}
              className="ml-2 font-normal text-muted-foreground"
            >
              · {completed.length}
            </span>
          </h2>

          {completed.length === 0 ? (
            <EmptyPanel message="No completed visits yet." muted />
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <div
                className="grid gap-2 h-full"
                style={{
                  gridAutoRows: "minmax(0, 1fr)",
                }}
              >
                {completed.map((a) => {
                  const s = statusStyle(a.status)
                  return (
                    <article
                      key={a.id}
                      className={[
                        "flex items-center justify-between gap-3 rounded-lg border border-l-4 px-3 py-2 min-h-0 overflow-hidden",
                        s.bg,
                        s.border,
                        s.accent,
                      ].join(" ")}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          style={{ fontSize: "var(--txt-name)" }}
                          className={`font-semibold truncate leading-tight ${s.text}`}
                        >
                          {a.patientName}
                        </p>
                        <p
                          style={{ fontSize: "var(--txt-meta)" }}
                          className={`mt-0.5 opacity-75 truncate leading-tight ${s.text}`}
                        >
                          {a.doctorName ? `Dr. ${a.doctorName}` : "—"}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                        <p
                          style={{ fontSize: "var(--txt-time)" }}
                          className={`font-bold leading-tight ${s.text}`}
                        >
                          {formatTime12h(a.time)}
                        </p>
                        <span
                          style={{ fontSize: "var(--txt-badge)" }}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0 font-semibold border border-emerald-200"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Done
                        </span>
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
      <footer
        style={{ fontSize: "var(--txt-tiny)" }}
        className="shrink-0 border-t border-border bg-card px-[clamp(1rem,2vw,2rem)] py-1.5 text-center text-muted-foreground"
      >
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
    <div
      style={{ fontSize: "var(--txt-tiny)" }}
      className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-muted-foreground"
    >
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
      <p style={{ fontSize: "var(--txt-body)" }}>{message}</p>
    </div>
  )
}
