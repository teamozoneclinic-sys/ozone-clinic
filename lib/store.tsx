"use client"

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import type {
  Role,
  User,
  Patient,
  Doctor,
  Appointment,
  Treatment,
  Invoice,
  Payment,
  TestCatalogItem,
  AuditLogEntry,
  Permission,
  ClinicInfo,
  ReferenceDoctor,
} from "./types"
import { ROLE_PERMISSIONS, DEFAULT_CLINIC_INFO } from "./constants"
import { getPKTDateString } from "./pkt"

// ─── helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// Upsert `incoming` into `prev` by id — used when merging delta-poll payloads
// so that:
//   • server-updated records replace their local copy,
//   • server-created records are prepended (newest-first, matches the API sort),
//   • records untouched by the delta stay exactly as they were locally.
// Deletes are not conveyed by delta polling (rare, admin-only) — a manual
// page refresh catches those, same as before.
function mergeById<T extends { id: string }>(prev: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return prev
  const incomingIds = new Set(incoming.map((x) => x.id))
  const untouched = prev.filter((p) => !incomingIds.has(p.id))
  // Incoming first (newest updates surface at the top of the list — matches
  // the .sort({ createdAt: -1 }) / .sort({ date: -1 }) API contract).
  return [...incoming, ...untouched]
}

// ─── Store interface ─────────────────────────────────────────────────────────

interface StoreState {
  // Auth
  currentUser: User | null
  isLoading: boolean
  // True while the four bulk collections (patients + appointments + invoices
  // + treatments) are still hydrating in Phase 2. The dashboard shell uses
  // this to keep the loading spinner up so users never see a half-populated
  // app on first login.
  isHydrating: boolean
  hasPermission: (permission: Permission) => boolean
  setCurrentRole: (role: Role) => void // legacy compat

  // Data
  patients: Patient[]
  doctors: Doctor[]
  appointments: Appointment[]
  treatments: Treatment[]
  invoices: Invoice[]
  testCatalog: TestCatalogItem[]
  auditLog: AuditLogEntry[]
  referenceDoctors: ReferenceDoctor[]

  // Mutations
  addPatient: (data: Omit<Patient, "id" | "createdAt" | "updatedAt" | "medicalHistory" | "documents">) => Promise<void>
  updatePatient: (id: string, data: Partial<Patient>) => Promise<void>
  deletePatient: (id: string) => Promise<void>
  addTestCatalogItem: (data: Omit<TestCatalogItem, "id" | "createdAt" | "updatedAt">) => Promise<void>
  updateTestCatalogItem: (id: string, data: Partial<TestCatalogItem>) => Promise<void>
  deleteTestCatalogItem: (id: string) => Promise<void>
  addDoctor: (data: Omit<Doctor, "id">) => Promise<void>
  updateDoctor: (id: string, data: Partial<Doctor>) => Promise<void>
  deleteDoctor: (id: string) => Promise<void>
  addAppointment: (data: {
    patientId: string
    doctorId: string
    date: string
    time: string
    duration: number
    type: string
    notes: string
    status?: string
    referral?: string
    procedures?: { name: string; amount: number }[]
    discount?: { description: string; amount: number }
  }) => Promise<void>
  collectPayment: (invoiceId: string, payment: Omit<Payment, "id">) => Promise<void>
  editInvoice: (
    invoiceId: string,
    lineItems: { id?: string; description: string; amount: number; quantity: number; category?: string }[]
  ) => Promise<Invoice>
  voidInvoice: (invoiceId: string, reason: string) => Promise<Invoice>
  markInvoiceRefunded: (invoiceId: string, notes?: string, reference?: string) => Promise<Invoice>
  // Reference doctors (external referrers) — CRUD is admin/manager only,
  // server-side enforced. List is fetched at boot alongside other data.
  fetchReferenceDoctors: () => Promise<void>
  addReferenceDoctor: (data: Partial<Omit<ReferenceDoctor, "id" | "createdAt" | "updatedAt" | "referralCount">>) => Promise<ReferenceDoctor>
  updateReferenceDoctor: (id: string, data: Partial<Omit<ReferenceDoctor, "id" | "createdAt" | "updatedAt" | "referralCount">>) => Promise<ReferenceDoctor>
  deleteReferenceDoctor: (id: string) => Promise<void>
  createTreatment: (data: Omit<Treatment, "id" | "createdAt" | "updatedAt">) => Promise<Treatment>
  updateTreatment: (id: string, data: Partial<Omit<Treatment, "id" | "createdAt" | "updatedAt">> & { customProcedures?: { name: string; amount: number }[]; newTestIds?: string[] }) => Promise<{ treatment: Treatment; invoice: Invoice | null }>
  updateAppointmentStatus: (appointmentId: string, status: Appointment["status"]) => Promise<void>
  deleteAppointment: (id: string, reason?: string) => Promise<void>
  updateAppointment: (id: string, data: Partial<Pick<Appointment, "date" | "time" | "duration">>) => Promise<void>
  assignDoctor: (appointmentId: string, doctorId: string) => Promise<void>
  acknowledgeAppointment: (appointmentId: string) => Promise<void>
  refreshLiveData: () => Promise<void>
  refetch: () => Promise<void>
  fetchAuditLog: () => Promise<void>

  // Helpers
  getPatient: (id: string) => Patient | undefined
  getDoctor: (id: string) => Doctor | undefined
  getAppointment: (id: string) => Appointment | undefined
  getTreatment: (id: string) => Treatment | undefined
  getInvoice: (id: string) => Invoice | undefined
  getPatientAppointments: (patientId: string) => Appointment[]
  getPatientInvoices: (patientId: string) => Invoice[]
  getPatientTreatments: (patientId: string) => Treatment[]
  getDoctorAppointments: (doctorId: string, date?: string) => Appointment[]
  getTodayAppointments: () => Appointment[]
  getUnpaidInvoices: () => Invoice[]
  getTotalRevenue: () => number
  getTreatmentByAppointment: (appointmentId: string) => Treatment | undefined

  // Clinic settings
  clinicSettings: ClinicInfo
  updateClinicSettings: (data: Partial<ClinicInfo>) => Promise<void>

  // WA requests
  pendingRequestsCount: number
}

const StoreContext = createContext<StoreState | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isHydrating, setIsHydrating] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [testCatalog, setTestCatalog] = useState<TestCatalogItem[]>([])
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [clinicSettings, setClinicSettings] = useState<ClinicInfo>(DEFAULT_CLINIC_INFO)
  const [referenceDoctors, setReferenceDoctors] = useState<ReferenceDoctor[]>([])

  // Per-collection delta cursors. Populated by every full/delta fetch and
  // sent back as `?since=<iso>` on the next poll. Kept in a ref so that
  // updating them never re-renders the tree.
  const lastSyncedRef = useRef<{
    patients: string | null
    appointments: string | null
    invoices: string | null
    treatments: string | null
  }>({ patients: null, appointments: null, invoices: null, treatments: null })

  // ── Fetch all data ────────────────────────────────────────────────────
  // Two-phase load so the app becomes usable as fast as possible:
  //
  //   Phase 1 (awaited, unblocks isLoading): auth + doctors + catalog +
  //     clinic settings + reference doctors. All small; needed to render
  //     the shell and enforce permissions.
  //
  //   Phase 2 (fired in the background, does NOT block isLoading): the
  //     four heavy collections — patients, appointments, invoices,
  //     treatments. Each one populates its state as soon as it lands, so
  //     the UI "fills in" instead of waiting for the slowest request.
  //     Merged via mergeById to preserve any mutations the user performed
  //     in the tiny window before Phase 2 completed.
  //
  // Audit logs are deliberately NOT in this initial load — they grow large
  // and are only viewed on /audit. The audit page fetches them on demand.
  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setIsHydrating(true)
    try {
      // ─── Phase 1 — small, essential payloads ───────────────────────────
      const [meRes, doctorsRes, catalogRes, clinicRes, refDocsRes] = await Promise.all([
        apiFetch<{ user: User }>("/api/auth/me"),
        apiFetch<{ data: Doctor[] }>("/api/doctors"),
        apiFetch<{ data: TestCatalogItem[] }>("/api/catalog"),
        apiFetch<{ data: ClinicInfo }>("/api/clinic-settings"),
        // Reference doctors — non-critical, defensively caught so a failure
        // here can never block the app boot for existing users.
        apiFetch<{ data: ReferenceDoctor[] }>("/api/reference-doctors").catch(() => ({ data: [] })),
      ])
      setCurrentUser(meRes.user)
      setDoctors(doctorsRes.data)
      setTestCatalog(catalogRes.data)
      setClinicSettings(clinicRes.data)
      setReferenceDoctors(refDocsRes.data)
    } catch (err) {
      console.error("Store phase-1 fetch error:", err)
    } finally {
      // Phase 1 done — auth + doctors + catalog are available. Any component
      // that only needs those can render now. The dashboard shell, however,
      // waits on `isHydrating` (below) so users never see empty tables.
      setIsLoading(false)
    }

    // ─── Phase 2 — bulk collections, fired in parallel ─────────────────
    // Each response seeds lastSyncedRef so the delta poll starts from a
    // good cursor. mergeById preserves any records the user just created
    // (via a mutation setState) that landed BEFORE the full response.
    // Wrapped in allSettled so we can flip `isHydrating` off exactly when
    // all four collections have resolved (regardless of individual failures).
    Promise.allSettled([
      apiFetch<{ data: Patient[]; serverTime?: string }>("/api/patients")
        .then((r) => {
          setPatients((prev) => mergeById(prev, r.data))
          if (r.serverTime) lastSyncedRef.current.patients = r.serverTime
        })
        .catch((e) => console.error("Patients initial load failed:", e)),
      apiFetch<{ data: Appointment[]; serverTime?: string }>("/api/appointments")
        .then((r) => {
          setAppointments((prev) => mergeById(prev, r.data))
          if (r.serverTime) lastSyncedRef.current.appointments = r.serverTime
        })
        .catch((e) => console.error("Appointments initial load failed:", e)),
      apiFetch<{ data: Invoice[]; serverTime?: string }>("/api/invoices")
        .then((r) => {
          setInvoices((prev) => mergeById(prev, r.data))
          if (r.serverTime) lastSyncedRef.current.invoices = r.serverTime
        })
        .catch((e) => console.error("Invoices initial load failed:", e)),
      apiFetch<{ data: Treatment[]; serverTime?: string }>("/api/treatments")
        .then((r) => {
          setTreatments((prev) => mergeById(prev, r.data))
          if (r.serverTime) lastSyncedRef.current.treatments = r.serverTime
        })
        .catch((e) => console.error("Treatments initial load failed:", e)),
    ]).finally(() => {
      // Everything is in — the dashboard shell can now unveil the UI.
      setIsHydrating(false)
    })
  }, [])

  // Fetch audit log on demand (used by the Audit page).
  const fetchAuditLog = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: AuditLogEntry[] }>("/api/audit-log")
      setAuditLog(res.data)
    } catch (err) {
      console.error("Audit log fetch error:", err)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Permissions ───────────────────────────────────────────────────────
  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!currentUser) return false
      const rolePerm = ROLE_PERMISSIONS.find((rp) => rp.role === currentUser.role)
      return rolePerm?.permissions.includes(permission) ?? false
    },
    [currentUser]
  )

  // Legacy compat — role comes from JWT; kept so RoleSwitcher compiles
  const setCurrentRole = useCallback((_role: Role) => {}, [])

  // ── Audit helper (fire-and-forget) ────────────────────────────────────
  const logAuditEntry = useCallback(
    async (action: string, entity: string, entityId: string, details: string) => {
      if (!currentUser) return
      try {
        const res = await apiFetch<{ data: AuditLogEntry }>("/api/audit-log", {
          method: "POST",
          body: JSON.stringify({
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            action,
            entity,
            entityId,
            details,
            timestamp: new Date().toISOString(),
          }),
        })
        setAuditLog((prev) => [res.data, ...prev])
      } catch {
        // Non-critical — audit failure must not block main action
      }
    },
    [currentUser]
  )

  // ── Mutations ─────────────────────────────────────────────────────────

  const addPatient = useCallback(
    async (data: Omit<Patient, "id" | "createdAt" | "updatedAt" | "medicalHistory" | "documents">) => {
      const res = await apiFetch<{ data: Patient }>("/api/patients", {
        method: "POST",
        body: JSON.stringify({ ...data, medicalHistory: [], documents: [] }),
      })
      setPatients((prev) => [res.data, ...prev])
      logAuditEntry("Patient Created", "Patient", res.data.id, `Patient "${res.data.name}" registered.`)
    },
    [logAuditEntry]
  )

  const updatePatient = useCallback(async (id: string, data: Partial<Patient>) => {
    const res = await apiFetch<{ data: Patient }>(`/api/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
    setPatients((prev) => prev.map((p) => (p.id === id ? res.data : p)))
  }, [])

  const deletePatient = useCallback(async (id: string) => {
    await apiFetch(`/api/patients/${id}`, { method: "DELETE" })
    setPatients((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const addTestCatalogItem = useCallback(
    async (data: Omit<TestCatalogItem, "id" | "createdAt" | "updatedAt">) => {
      const res = await apiFetch<{ data: TestCatalogItem }>("/api/catalog", {
        method: "POST",
        body: JSON.stringify(data),
      })
      setTestCatalog((prev) => [...prev, res.data])
    },
    []
  )

  const updateTestCatalogItem = useCallback(async (id: string, data: Partial<TestCatalogItem>) => {
    const res = await apiFetch<{ data: TestCatalogItem }>(`/api/catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
    setTestCatalog((prev) => prev.map((t) => (t.id === id ? res.data : t)))
  }, [])

  const deleteTestCatalogItem = useCallback(async (id: string) => {
    await apiFetch(`/api/catalog/${id}`, { method: "DELETE" })
    setTestCatalog((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addDoctor = useCallback(async (data: Omit<Doctor, "id">) => {
    const res = await apiFetch<{ data: Doctor }>("/api/doctors", {
      method: "POST",
      body: JSON.stringify(data),
    })
    setDoctors((prev) => [...prev, res.data])
  }, [])

  const updateDoctor = useCallback(async (id: string, data: Partial<Doctor>) => {
    const res = await apiFetch<{ data: Doctor }>(`/api/doctors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
    setDoctors((prev) => prev.map((d) => (d.id === id ? res.data : d)))
  }, [])

  const deleteDoctor = useCallback(async (id: string) => {
    await apiFetch(`/api/doctors/${id}`, { method: "DELETE" })
    setDoctors((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const addAppointment = useCallback(
    async (data: {
      patientId: string
      doctorId: string
      date: string
      time: string
      duration: number
      type: string
      notes: string
      status?: string
      referral?: string
      procedures?: { name: string; amount: number }[]
      discount?: { description: string; amount: number }
    }) => {
      const res = await apiFetch<{ data: Appointment; invoice: Invoice | null }>(
        "/api/appointments",
        { method: "POST", body: JSON.stringify(data) }
      )
      setAppointments((prev) => [res.data, ...prev])
      // Server returns the auto-created invoice in the same response — just
      // prepend it locally. No full /api/invoices refetch needed (saves ~1 s
      // per booking on the perceived time). Any invoices created concurrently
      // by other users are still picked up by the 3-s delta poll.
      if (res.invoice) {
        setInvoices((prev) => [res.invoice!, ...prev])
      }
      logAuditEntry(
        "Appointment Created",
        "Appointment",
        res.data.id,
        `Appointment on ${data.date} at ${data.time} (${data.type}).`
      )
    },
    [logAuditEntry]
  )

  const collectPayment = useCallback(
    async (invoiceId: string, payment: Omit<Payment, "id">) => {
      const res = await apiFetch<{ data: Invoice }>(`/api/invoices/${invoiceId}/payment`, {
        method: "POST",
        body: JSON.stringify(payment),
      })
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? res.data : inv)))
      logAuditEntry(
        "Payment Collected",
        "Invoice",
        invoiceId,
        `Rs. ${payment.amount.toLocaleString()} collected via ${payment.method.replace("-", " ")}.`
      )
    },
    [logAuditEntry]
  )

  // Edit an invoice's line items (admin & manager) — totals, balance,
  // refund-due and status are recomputed server-side (which also audits it).
  const editInvoice = useCallback(
    async (
      invoiceId: string,
      lineItems: { id?: string; description: string; amount: number; quantity: number; category?: string }[]
    ): Promise<Invoice> => {
      const res = await apiFetch<{ data: Invoice }>(`/api/invoices/${invoiceId}/edit`, {
        method: "POST",
        body: JSON.stringify({ lineItems }),
      })
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? res.data : inv)))
      return res.data
    },
    []
  )

  // Void an invoice (admin/manager per matrix). The server stamps the
  // reason + audit log and zeroes the balance so it drops out of outstanding
  // totals. Revenue cards filter on status !== "voided" to drop the void
  // from monthly/total revenue as well.
  const voidInvoice = useCallback(
    async (invoiceId: string, reason: string): Promise<Invoice> => {
      const res = await apiFetch<{ data: Invoice }>(`/api/invoices/${invoiceId}/void`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? res.data : inv)))
      return res.data
    },
    []
  )

  // Mark a refund as paid out to the patient — clears refundDue and stamps
  // refundedBy / refundedAt for the audit trail. Same permission tier as
  // voidInvoice (billing.void), enforced server-side.
  const markInvoiceRefunded = useCallback(
    async (invoiceId: string, notes?: string, reference?: string): Promise<Invoice> => {
      const res = await apiFetch<{ data: Invoice }>(
        `/api/invoices/${invoiceId}/mark-refunded`,
        {
          method: "POST",
          body: JSON.stringify({ notes: notes ?? "", reference: reference ?? "" }),
        }
      )
      setInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? res.data : inv)))
      return res.data
    },
    []
  )

  // ─── Reference doctors CRUD ──────────────────────────────────────────
  // Fully additive — none of these mutate any existing collection or field
  // on Appointments / Doctors / Patients. Safe to call without side effects
  // on any other part of the system.
  const fetchReferenceDoctors = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: ReferenceDoctor[] }>("/api/reference-doctors")
      setReferenceDoctors(res.data)
    } catch (err) {
      console.error("Failed to fetch reference doctors:", err)
    }
  }, [])

  const addReferenceDoctor = useCallback(
    async (
      data: Partial<Omit<ReferenceDoctor, "id" | "createdAt" | "updatedAt" | "referralCount">>
    ): Promise<ReferenceDoctor> => {
      const res = await apiFetch<{ data: ReferenceDoctor }>("/api/reference-doctors", {
        method: "POST",
        body: JSON.stringify(data),
      })
      setReferenceDoctors((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
      return res.data
    },
    []
  )

  const updateReferenceDoctor = useCallback(
    async (
      id: string,
      data: Partial<Omit<ReferenceDoctor, "id" | "createdAt" | "updatedAt" | "referralCount">>
    ): Promise<ReferenceDoctor> => {
      const res = await apiFetch<{ data: ReferenceDoctor }>(`/api/reference-doctors/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      })
      setReferenceDoctors((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...res.data } : r)).sort((a, b) => a.name.localeCompare(b.name))
      )
      return res.data
    },
    []
  )

  const deleteReferenceDoctor = useCallback(async (id: string) => {
    await apiFetch(`/api/reference-doctors/${id}`, { method: "DELETE" })
    setReferenceDoctors((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const createTreatment = useCallback(
    async (data: Omit<Treatment, "id" | "createdAt" | "updatedAt">): Promise<Treatment> => {
      const res = await apiFetch<{ data: Treatment; invoice: Invoice | null }>("/api/treatments", {
        method: "POST",
        body: JSON.stringify(data),
      })
      setTreatments((prev) => [res.data, ...prev])
      // If the server added test line items, sync the updated invoice into local state
      if (res.invoice) {
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === res.invoice!.id ? res.invoice! : inv))
        )
      }
      logAuditEntry(
        "Treatment Created",
        "Treatment",
        res.data.id,
        `Diagnosis: ${data.diagnosis || "—"}.`
      )
      // Reflect the new medical history entry in local patient state
      setPatients((prev) =>
        prev.map((p) => {
          if (p.id !== data.patientId) return p
          return {
            ...p,
            medicalHistory: [
              ...(p.medicalHistory ?? []),
              {
                id: res.data.id,
                date: data.date,
                type: "Visit",
                description: `Diagnosis: ${data.diagnosis}${data.complaint ? `. Complaint: ${data.complaint}` : ""}`,
                addedBy: data.doctorId,
              },
            ],
          }
        })
      )
      return res.data
    },
    [logAuditEntry]
  )

  const updateTreatment = useCallback(
    async (id: string, data: Partial<Omit<Treatment, "id" | "createdAt" | "updatedAt">> & { customProcedures?: { name: string; amount: number }[]; newTestIds?: string[] }) => {
      const res = await apiFetch<{ data: Treatment; invoice: Invoice | null }>(`/api/treatments/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      })
      setTreatments((prev) => prev.map((t) => (t.id === id ? res.data : t)))
      if (res.invoice) {
        setInvoices((prev) => prev.map((inv) => (inv.id === res.invoice!.id ? res.invoice! : inv)))
      }
      return { treatment: res.data, invoice: res.invoice }
    },
    []
  )

  const updateAppointmentStatus = useCallback(
    async (appointmentId: string, status: Appointment["status"]) => {
      const res = await apiFetch<{ data: Appointment }>(`/api/appointments/${appointmentId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      })
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? res.data : a)))

      if (status === "cancelled") {
        // Refresh invoices so the voided invoice appears in billing immediately
        try {
          const invRes = await apiFetch<{ data: Invoice[] }>("/api/invoices")
          setInvoices(invRes.data)
        } catch { /* silent */ }
        logAuditEntry(
          "Appointment Cancelled",
          "Appointment",
          appointmentId,
          `Appointment cancelled.`
        )
      }
    },
    [logAuditEntry]
  )

  const deleteAppointment = useCallback(async (id: string, reason?: string) => {
    await apiFetch(`/api/appointments/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ reason: reason ?? "No reason provided" }),
    })
    setAppointments((prev) => prev.filter((a) => a.id !== id))
    // Refresh invoices so the voided invoice appears in billing immediately
    try {
      const invRes = await apiFetch<{ data: Invoice[] }>("/api/invoices")
      setInvoices(invRes.data)
    } catch { /* silent */ }
  }, [])

  const updateAppointment = useCallback(
    async (id: string, data: Partial<Pick<Appointment, "date" | "time" | "duration">>) => {
      const res = await apiFetch<{ data: Appointment }>(`/api/appointments/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      })
      setAppointments((prev) => prev.map((a) => (a.id === id ? res.data : a)))
    },
    []
  )

  // Assign a doctor to an appointment booked without one — the server also
  // ensures the invoice carries the consultation charge.
  const assignDoctor = useCallback(
    async (appointmentId: string, doctorId: string) => {
      const res = await apiFetch<{ data: Appointment; invoice: Invoice | null }>(
        `/api/appointments/${appointmentId}/assign-doctor`,
        { method: "POST", body: JSON.stringify({ doctorId }) }
      )
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? res.data : a)))
      if (res.invoice) {
        setInvoices((prev) => {
          const exists = prev.some((i) => i.id === res.invoice!.id)
          return exists
            ? prev.map((i) => (i.id === res.invoice!.id ? res.invoice! : i))
            : [res.invoice!, ...prev]
        })
      }
    },
    []
  )

  // Acknowledge a WhatsApp-bot booking — server records who/when + audits it
  const acknowledgeAppointment = useCallback(async (appointmentId: string) => {
    const res = await apiFetch<{ data: Appointment }>(
      `/api/appointments/${appointmentId}/acknowledge`,
      { method: "POST" }
    )
    setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? res.data : a)))
  }, [])

  // ── Live data refresh — FULL pull of patients + appointments + treatments + invoices ─
  // Kept for backward compatibility with callers that explicitly want a
  // fresh, cursor-resetting full fetch (e.g. the patient detail page after
  // uploading a document, or internal mutation-follow-ups). Resets the
  // delta cursor so the very next delta poll picks up from THIS moment.
  // The patients-list payload is slim — heavy `documents` and
  // `medicalHistory` arrays are stripped server-side and fetched on demand
  // from the patient detail page.
  const refreshLiveData = useCallback(async () => {
    try {
      const [patientsRes, appointmentsRes, treatmentsRes, invoicesRes] = await Promise.all([
        apiFetch<{ data: Patient[]; serverTime?: string }>("/api/patients"),
        apiFetch<{ data: Appointment[]; serverTime?: string }>("/api/appointments"),
        apiFetch<{ data: Treatment[]; serverTime?: string }>("/api/treatments"),
        apiFetch<{ data: Invoice[]; serverTime?: string }>("/api/invoices"),
      ])
      setPatients(patientsRes.data)
      setAppointments(appointmentsRes.data)
      setTreatments(treatmentsRes.data)
      setInvoices(invoicesRes.data)
      if (patientsRes.serverTime) lastSyncedRef.current.patients = patientsRes.serverTime
      if (appointmentsRes.serverTime) lastSyncedRef.current.appointments = appointmentsRes.serverTime
      if (treatmentsRes.serverTime) lastSyncedRef.current.treatments = treatmentsRes.serverTime
      if (invoicesRes.serverTime) lastSyncedRef.current.invoices = invoicesRes.serverTime
    } catch {
      // Silent — background refresh failures must not disrupt the UI
    }
  }, [])

  // ── Delta poll — the "eye-blink" live sync ────────────────────────────
  // Every 3 s (while the tab is visible), ask each of the four live
  // collections for records that changed since our last cursor. Payloads
  // are typically empty ({data:[], serverTime:"..."}), so the roundtrip is
  // trivial. When something DID change (another user booked an
  // appointment, collected a payment, uploaded a doc, etc.) the affected
  // record is merged into local state by id — no full reload, no flicker,
  // no lost mutations in flight.
  //
  // Safety net: if the cursor is null (Phase 2 hasn't stamped it yet, or
  // an earlier delta failed to return serverTime), we fall back to a full
  // fetch for that collection this tick, and stamp the cursor from its
  // serverTime for subsequent ticks.
  const deltaPoll = useCallback(async () => {
    const buildUrl = (base: string, cursor: string | null) =>
      cursor ? `${base}?since=${encodeURIComponent(cursor)}` : base
    try {
      const [pRes, aRes, iRes, tRes] = await Promise.all([
        apiFetch<{ data: Patient[]; serverTime?: string }>(
          buildUrl("/api/patients", lastSyncedRef.current.patients)
        ).catch(() => null),
        apiFetch<{ data: Appointment[]; serverTime?: string }>(
          buildUrl("/api/appointments", lastSyncedRef.current.appointments)
        ).catch(() => null),
        apiFetch<{ data: Invoice[]; serverTime?: string }>(
          buildUrl("/api/invoices", lastSyncedRef.current.invoices)
        ).catch(() => null),
        apiFetch<{ data: Treatment[]; serverTime?: string }>(
          buildUrl("/api/treatments", lastSyncedRef.current.treatments)
        ).catch(() => null),
      ])
      if (pRes) {
        if (pRes.data.length > 0) setPatients((prev) => mergeById(prev, pRes.data))
        if (pRes.serverTime) lastSyncedRef.current.patients = pRes.serverTime
      }
      if (aRes) {
        if (aRes.data.length > 0) setAppointments((prev) => mergeById(prev, aRes.data))
        if (aRes.serverTime) lastSyncedRef.current.appointments = aRes.serverTime
      }
      if (iRes) {
        if (iRes.data.length > 0) setInvoices((prev) => mergeById(prev, iRes.data))
        if (iRes.serverTime) lastSyncedRef.current.invoices = iRes.serverTime
      }
      if (tRes) {
        if (tRes.data.length > 0) setTreatments((prev) => mergeById(prev, tRes.data))
        if (tRes.serverTime) lastSyncedRef.current.treatments = tRes.serverTime
      }
    } catch {
      // Silent — background poll failures must not disrupt the UI.
    }
  }, [])

  // Poll every 3 s while the tab is visible; also fire immediately when
  // the tab regains focus so a returning user sees fresh data at once.
  useEffect(() => {
    if (typeof document === "undefined") return
    const tick = () => {
      if (document.visibilityState === "visible") deltaPoll()
    }
    const timer = setInterval(tick, 3_000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [deltaPoll])

  const updateClinicSettings = useCallback(async (data: Partial<ClinicInfo>) => {
    const res = await apiFetch<{ data: ClinicInfo }>("/api/clinic-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    })
    setClinicSettings(res.data)
  }, [])

  // WhatsApp-bot bookings still awaiting staff acknowledgement — drives the
  // sidebar badge. Derived from appointments, which are already polled live.
  const pendingRequestsCount = appointments.filter(
    (a) => a.referral === "WhatsApp Bot" && !a.whatsappAcknowledgedBy
  ).length

  // Update document title with pending count
  useEffect(() => {
    if (typeof document === "undefined") return
    const base = clinicSettings?.name || "Clinic ERP"
    document.title = pendingRequestsCount > 0 ? `(${pendingRequestsCount}) ${base}` : base
  }, [pendingRequestsCount, clinicSettings?.name])

  // ── Helpers ───────────────────────────────────────────────────────────

  const getPatient = useCallback((id: string) => patients.find((p) => p.id === id), [patients])
  const getDoctor = useCallback((id: string) => doctors.find((d) => d.id === id), [doctors])
  const getAppointment = useCallback((id: string) => appointments.find((a) => a.id === id), [appointments])
  const getTreatment = useCallback((id: string) => treatments.find((t) => t.id === id), [treatments])
  const getInvoice = useCallback((id: string) => invoices.find((i) => i.id === id), [invoices])

  const getPatientAppointments = useCallback(
    (patientId: string) => appointments.filter((a) => a.patientId === patientId),
    [appointments]
  )
  const getPatientInvoices = useCallback(
    (patientId: string) => invoices.filter((i) => i.patientId === patientId),
    [invoices]
  )
  const getPatientTreatments = useCallback(
    (patientId: string) => treatments.filter((t) => t.patientId === patientId),
    [treatments]
  )
  const getDoctorAppointments = useCallback(
    (doctorId: string, date?: string) =>
      appointments.filter((a) => {
        const matchDoctor = a.doctorId === doctorId
        const matchDate = date ? a.date === date : true
        return matchDoctor && matchDate
      }),
    [appointments]
  )

  const getTodayAppointments = useCallback(() => {
    const today = getPKTDateString()
    return appointments
      .filter((a) => a.date === today && a.status !== "cancelled")
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [appointments])

  const getUnpaidInvoices = useCallback(
    () => invoices.filter((i) => i.status === "unpaid" || i.status === "partially-paid"),
    [invoices]
  )

  const getTotalRevenue = useCallback(
    // Voided invoices are excluded — their payments are tracked as `refundDue`
    // and must not inflate revenue (per business rule).
    () => invoices.filter((i) => i.status !== "voided").reduce((sum, i) => sum + i.paidAmount, 0),
    [invoices]
  )

  const getTreatmentByAppointment = useCallback(
    (appointmentId: string) => treatments.find((t) => t.appointmentId === appointmentId),
    [treatments]
  )

  return (
    <StoreContext.Provider
      value={{
        currentUser,
        isLoading,
        isHydrating,
        hasPermission,
        setCurrentRole,
        patients,
        doctors,
        appointments,
        treatments,
        invoices,
        testCatalog,
        auditLog,
        referenceDoctors,
        fetchReferenceDoctors,
        addReferenceDoctor,
        updateReferenceDoctor,
        deleteReferenceDoctor,
        addPatient,
        updatePatient,
        deletePatient,
        addTestCatalogItem,
        updateTestCatalogItem,
        deleteTestCatalogItem,
        addDoctor,
        updateDoctor,
        deleteDoctor,
        addAppointment,
        collectPayment,
        editInvoice,
        voidInvoice,
        markInvoiceRefunded,
        createTreatment,
        updateTreatment,
        updateAppointmentStatus,
        deleteAppointment,
        updateAppointment,
        assignDoctor,
        acknowledgeAppointment,
        refreshLiveData,
        refetch: fetchAll,
        fetchAuditLog,
        getPatient,
        getDoctor,
        getAppointment,
        getTreatment,
        getInvoice,
        getPatientAppointments,
        getPatientInvoices,
        getPatientTreatments,
        getDoctorAppointments,
        getTodayAppointments,
        getUnpaidInvoices,
        getTotalRevenue,
        getTreatmentByAppointment,
        clinicSettings,
        updateClinicSettings,
        pendingRequestsCount,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) throw new Error("useStore must be used within StoreProvider")
  return context
}
