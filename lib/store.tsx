"use client"

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
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

// ─── Store interface ─────────────────────────────────────────────────────────

interface StoreState {
  // Auth
  currentUser: User | null
  isLoading: boolean
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
  }) => Promise<void>
  collectPayment: (invoiceId: string, payment: Omit<Payment, "id">) => Promise<void>
  createTreatment: (data: Omit<Treatment, "id" | "createdAt" | "updatedAt">) => Promise<Treatment>
  updateAppointmentStatus: (appointmentId: string, status: Appointment["status"]) => Promise<void>
  deleteAppointment: (id: string) => Promise<void>
  updateAppointment: (id: string, data: Partial<Pick<Appointment, "date" | "time" | "duration">>) => Promise<void>
  refreshLiveData: () => Promise<void>
  refetch: () => Promise<void>

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
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [testCatalog, setTestCatalog] = useState<TestCatalogItem[]>([])
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [clinicSettings, setClinicSettings] = useState<ClinicInfo>(DEFAULT_CLINIC_INFO)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const prevRequestsCountRef = useRef(-1) // -1 = initial load, skip notification

  // ── Fetch all data ────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [meRes, patientsRes, doctorsRes, appointmentsRes, treatmentsRes, invoicesRes, catalogRes, clinicRes, auditRes] =
        await Promise.all([
          apiFetch<{ user: User }>("/api/auth/me"),
          apiFetch<{ data: Patient[] }>("/api/patients"),
          apiFetch<{ data: Doctor[] }>("/api/doctors"),
          apiFetch<{ data: Appointment[] }>("/api/appointments"),
          apiFetch<{ data: Treatment[] }>("/api/treatments"),
          apiFetch<{ data: Invoice[] }>("/api/invoices"),
          apiFetch<{ data: TestCatalogItem[] }>("/api/catalog"),
          apiFetch<{ data: ClinicInfo }>("/api/clinic-settings"),
          apiFetch<{ data: AuditLogEntry[] }>("/api/audit-log"),
        ])
      setCurrentUser(meRes.user)
      setPatients(patientsRes.data)
      setDoctors(doctorsRes.data)
      setAppointments(appointmentsRes.data)
      setTreatments(treatmentsRes.data)
      setInvoices(invoicesRes.data)
      setTestCatalog(catalogRes.data)
      setClinicSettings(clinicRes.data)
      setAuditLog(auditRes.data)
    } catch (err) {
      console.error("Store fetch error:", err)
    } finally {
      setIsLoading(false)
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
    }) => {
      const res = await apiFetch<{ data: Appointment }>("/api/appointments", {
        method: "POST",
        body: JSON.stringify(data),
      })
      setAppointments((prev) => [res.data, ...prev])
      // Refresh invoices to capture the auto-created one
      const invRes = await apiFetch<{ data: Invoice[] }>("/api/invoices")
      setInvoices(invRes.data)
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

  // ── Live data refresh (polls appointments + treatments + invoices) ─────
  const refreshLiveData = useCallback(async () => {
    try {
      const [appointmentsRes, treatmentsRes, invoicesRes] = await Promise.all([
        apiFetch<{ data: Appointment[] }>("/api/appointments"),
        apiFetch<{ data: Treatment[] }>("/api/treatments"),
        apiFetch<{ data: Invoice[] }>("/api/invoices"),
      ])
      setAppointments(appointmentsRes.data)
      setTreatments(treatmentsRes.data)
      setInvoices(invoicesRes.data)
    } catch {
      // Silent — background refresh failures must not disrupt the UI
    }
  }, [])

  // Poll every 30 s; also refresh immediately when the tab regains focus
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") refreshLiveData()
    }
    const timer = setInterval(poll, 30_000)
    document.addEventListener("visibilitychange", poll)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", poll)
    }
  }, [refreshLiveData])

  const updateClinicSettings = useCallback(async (data: Partial<ClinicInfo>) => {
    const res = await apiFetch<{ data: ClinicInfo }>("/api/clinic-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    })
    setClinicSettings(res.data)
  }, [])

  // ── WA appointment requests polling ───────────────────────────────────
  const pollRequestsCount = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: Array<{ status: string }> }>("/api/appointment-requests")
      const count = res.data.filter((r) => r.status === "pending").length
      if (prevRequestsCountRef.current >= 0 && count > prevRequestsCountRef.current) {
        const diff = count - prevRequestsCountRef.current
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(`New WA Request${diff > 1 ? "s" : ""}`, {
            body: `${diff} new appointment request${diff > 1 ? "s" : ""} pending from WhatsApp`,
            icon: "/favicon.ico",
          })
        }
      }
      prevRequestsCountRef.current = count
      setPendingRequestsCount(count)
    } catch {
      // silent — background poll must not disrupt UI
    }
  }, [])

  useEffect(() => {
    // Request browser notification permission on first load
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
    pollRequestsCount()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") pollRequestsCount()
    }, 30_000)
    return () => clearInterval(timer)
  }, [pollRequestsCount])

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
    () => invoices.reduce((sum, i) => sum + i.paidAmount, 0),
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
        hasPermission,
        setCurrentRole,
        patients,
        doctors,
        appointments,
        treatments,
        invoices,
        testCatalog,
        auditLog,
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
        createTreatment,
        updateAppointmentStatus,
        deleteAppointment,
        updateAppointment,
        refreshLiveData,
        refetch: fetchAll,
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
