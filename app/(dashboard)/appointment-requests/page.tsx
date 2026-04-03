"use client"

import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { MessageCircle, Phone, Calendar, User } from "lucide-react"

interface AppointmentRequest {
  _id: string
  name: string
  dateOfBirth: string
  phone: string
  status: "pending" | "contacted" | "booked" | "cancelled"
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  contacted: "bg-blue-100 text-blue-800 border-blue-200",
  booked: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
}

export default function AppointmentRequestsPage() {
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/appointment-requests")
      .then((r) => r.json())
      .then((d) => setRequests(d.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch("/api/appointment-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: status as AppointmentRequest["status"] } : r))
      )
      toast.success("Status updated")
    } else {
      toast.error("Failed to update status")
    }
  }

  const pending = requests.filter((r) => r.status === "pending")
  const others = requests.filter((r) => r.status !== "pending")

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="WhatsApp Appointment Requests"
        description="Patients who requested an appointment via WhatsApp bot"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center text-muted-foreground">
          <MessageCircle className="h-10 w-10 opacity-30" />
          <p className="text-sm">No appointment requests yet.</p>
          <p className="text-xs">Requests will appear here when patients message via WhatsApp.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {pending.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pending ({pending.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((req) => (
                  <RequestCard key={req._id} req={req} onStatusChange={updateStatus} />
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                All Requests
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((req) => (
                  <RequestCard key={req._id} req={req} onStatusChange={updateStatus} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RequestCard({
  req,
  onStatusChange,
}: {
  req: AppointmentRequest
  onStatusChange: (id: string, status: string) => void
}) {
  const whatsappLink = `https://wa.me/${req.phone}`
  const receivedAt = new Date(req.createdAt).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {req.name}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              DOB: {req.dateOfBirth}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              +{req.phone}
            </div>
          </div>
          <Badge className={`text-xs border ${STATUS_COLORS[req.status]}`} variant="outline">
            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">Received: {receivedAt}</p>

        <div className="flex items-center gap-2">
          <Select value={req.status} onValueChange={(v) => onStatusChange(req._id, v)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-3.5 w-3.5" />
              Chat
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
