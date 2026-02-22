"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useStore } from "@/lib/store"
import { RoleSwitcher } from "@/components/role-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  Receipt,
  BarChart3,
  Settings,
  ScrollText,
  Heart,
  FlaskConical,
  UserRound,
} from "lucide-react"
import type { Permission } from "@/lib/types"

interface NavItem {
  title: string
  href: string
  icon: typeof LayoutDashboard
  permission?: Permission
}

const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Patients", href: "/patients", icon: Users, permission: "patients.view" },
  { title: "Appointments", href: "/appointments", icon: CalendarDays, permission: "appointments.view" },
  { title: "Treatments", href: "/treatments", icon: Stethoscope, permission: "treatments.view" },
  { title: "Test Catalog", href: "/catalog", icon: FlaskConical, permission: "treatments.view" },
]

const financeNav: NavItem[] = [
  { title: "Billing", href: "/billing", icon: Receipt, permission: "billing.view" },
  { title: "Reports", href: "/reports", icon: BarChart3, permission: "reports.view" },
]

const adminNav: NavItem[] = [
  { title: "Doctors", href: "/doctors", icon: UserRound, permission: "doctors.view" },
  { title: "Settings", href: "/settings", icon: Settings, permission: "settings.view" },
  { title: "Audit Log", href: "/audit", icon: ScrollText, permission: "audit.view" },
]

function NavGroup({
  label,
  items,
  pathname,
  hasPermission,
}: {
  label: string
  items: NavItem[]
  pathname: string
  hasPermission: (p: Permission) => boolean
}) {
  const filteredItems = items.filter(
    (item) => !item.permission || hasPermission(item.permission)
  )
  if (filteredItems.length === 0) return null

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {filteredItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { hasPermission, clinicSettings } = useStore()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary overflow-hidden">
                  {clinicSettings?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clinicSettings.logo} alt="logo" className="h-full w-full object-cover" />
                  ) : (
                    <Heart className="h-4 w-4 text-primary-foreground" />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {clinicSettings?.name || "HealthCare Clinic"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">Management System</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavGroup label="Clinical" items={mainNav} pathname={pathname} hasPermission={hasPermission} />
        <NavGroup label="Finance" items={financeNav} pathname={pathname} hasPermission={hasPermission} />
        <NavGroup label="Administration" items={adminNav} pathname={pathname} hasPermission={hasPermission} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <RoleSwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
