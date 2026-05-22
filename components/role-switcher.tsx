"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import type { Role } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { ChevronsUpDown, Shield, Stethoscope, UserCog, Calculator, Headset, LogOut } from "lucide-react"

const roleConfig: Record<Role, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Admin", icon: Shield, color: "text-red-600" },
  doctor: { label: "Doctor", icon: Stethoscope, color: "text-teal-600" },
  manager: { label: "Manager", icon: UserCog, color: "text-blue-600" },
  accounts: { label: "Accounts", icon: Calculator, color: "text-amber-600" },
  receptionist: { label: "Receptionist", icon: Headset, color: "text-purple-600" },
}

export function RoleSwitcher() {
  const { currentUser } = useStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex h-12 w-full items-center gap-2 rounded-md px-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10" />
        <div className="grid flex-1 gap-1">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-2 w-16 rounded bg-muted" />
        </div>
      </div>
    )
  }

  const role = currentUser?.role ?? "admin"
  const config = roleConfig[role]
  const Icon = config.icon

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/login")
      router.refresh()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className={`h-4 w-4 ${config.color}`} />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{currentUser?.name ?? "Loading…"}</span>
            <span className="truncate text-xs text-muted-foreground">{config.label}</span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
        align="start"
        side="top"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">Signed in as</DropdownMenuLabel>
        <div className="px-2 py-1.5">
          <p className="text-sm font-semibold truncate">{currentUser?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{currentUser?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={loggingOut}
          className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          <span>{loggingOut ? "Signing out…" : "Sign Out"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
