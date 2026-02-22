"use client"

import { useState, useMemo, useEffect } from "react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FlaskConical, Search, Plus, Pencil, TestTube, Trash2, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import type { TestCatalogItem } from "@/lib/types"

const CATEGORIES = [
  "Blood Test",
  "Biochemistry",
  "Urine Test",
  "Pathology",
  "Cardiac",
  "Imaging",
  "Ultrasound",
  "Doppler",
  "Other",
]

const URGENCY_OPTIONS = ["routine", "urgent", "stat"]

const CATEGORY_COLORS: Record<string, string> = {
  "Blood Test": "border-red-200 text-red-700",
  Biochemistry: "border-purple-200 text-purple-700",
  "Urine Test": "border-yellow-200 text-yellow-700",
  Pathology: "border-orange-200 text-orange-700",
  Cardiac: "border-pink-200 text-pink-700",
  Imaging: "border-blue-200 text-blue-700",
  Ultrasound: "border-teal-200 text-teal-700",
  Doppler: "border-cyan-200 text-cyan-700",
}

export default function CatalogPage() {
  const { testCatalog, hasPermission, currentUser, deleteTestCatalogItem } = useStore()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTest, setEditingTest] = useState<TestCatalogItem | null>(null)
  const [deletingTest, setDeletingTest] = useState<TestCatalogItem | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const canEdit = hasPermission("settings.edit")
  const isAdmin = currentUser?.role === "admin"

  const handleDeleteTest = async () => {
    if (!deletingTest) return
    setDeletingBusy(true)
    try {
      await deleteTestCatalogItem(deletingTest.id)
      toast.success(`"${deletingTest.name}" deleted from catalog.`)
      setDeletingTest(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete test.")
    } finally {
      setDeletingBusy(false)
    }
  }

  const uniqueCategories = useMemo(
    () => Array.from(new Set(testCatalog.map((t) => t.category))).sort(),
    [testCatalog]
  )

  const filtered = useMemo(() => {
    return testCatalog.filter((t) => {
      const matchSearch =
        search === "" ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase())
      const matchCat = categoryFilter === "all" || t.category === categoryFilter
      return matchSearch && matchCat
    })
  }, [testCatalog, search, categoryFilter])

  // Summary stats
  const activeCount = testCatalog.filter((t) => t.isActive).length
  const categoryCounts = useMemo(() => {
    return ["Ultrasound", "Doppler", "Blood Test", "Biochemistry"].map((cat) => ({
      cat,
      count: testCatalog.filter((t) => t.category === cat && t.isActive).length,
    }))
  }, [testCatalog])

  return (
    <>
      <PageHeader
        title="Test Catalog"
        description={`${activeCount} active tests offered by the clinic`}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Test Catalog" }]}
        actions={
          canEdit ? (
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Test
            </Button>
          ) : undefined
        }
      />

      {/* Category summary cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categoryCounts.map(({ cat, count }) => (
          <Card
            key={cat}
            className={`cursor-pointer transition-all hover:shadow-sm ${categoryFilter === cat ? "ring-2 ring-primary" : ""}`}
            onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <TestTube className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{cat}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tests by name or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {mounted ? (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories ({testCatalog.length})</SelectItem>
                  {uniqueCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} ({testCatalog.filter((t) => t.category === c).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 w-[180px] rounded-md border border-input bg-background" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Urgency Options</TableHead>
                <TableHead className="text-right">Price (Rs.)</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 6 : 5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No tests found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">{test.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={CATEGORY_COLORS[test.category] ?? ""}
                      >
                        {test.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {test.urgencyOptions.map((u) => (
                          <Badge
                            key={u}
                            variant="outline"
                            className={
                              u === "stat"
                                ? "border-red-300 text-red-700 text-xs"
                                : u === "urgent"
                                ? "border-amber-300 text-amber-700 text-xs"
                                : "border-emerald-300 text-emerald-700 text-xs"
                            }
                          >
                            {u}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {test.price.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          test.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-border text-muted-foreground"
                        }
                      >
                        {test.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingTest(test)}
                            title="Edit test"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeletingTest(test)}
                              title="Delete test"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Modal */}
      <TestFormModal
        open={showAddModal || !!editingTest}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false)
            setEditingTest(null)
          }
        }}
        editTest={editingTest}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTest} onOpenChange={(open) => { if (!open) setDeletingTest(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Test
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">{deletingTest?.name}</span>?
              This test will be removed from the catalog. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTest}
              disabled={deletingBusy}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deletingBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {deletingBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Add / Edit Test Modal ─────────────────────────────────────────────────────

function TestFormModal({
  open,
  onOpenChange,
  editTest,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTest: TestCatalogItem | null
}) {
  const { addTestCatalogItem, updateTestCatalogItem } = useStore()
  const isEdit = !!editTest
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [urgency, setUrgency] = useState<string[]>(["routine"])
  const [saving, setSaving] = useState(false)

  // Populate form when editing
  useEffect(() => {
    if (editTest) {
      setName(editTest.name)
      setCategory(editTest.category)
      setPrice(editTest.price.toString())
      setUrgency(editTest.urgencyOptions)
    } else {
      setName("")
      setCategory("")
      setPrice("")
      setUrgency(["routine"])
    }
  }, [editTest, open])

  const toggleUrgency = (opt: string) => {
    setUrgency((prev) =>
      prev.includes(opt) ? prev.filter((u) => u !== opt) : [...prev, opt]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !category || !price) {
      toast.error("Please fill in all required fields.")
      return
    }
    if (urgency.length === 0) {
      toast.error("Select at least one urgency option.")
      return
    }
    setSaving(true)
    try {
      if (isEdit && editTest) {
        await updateTestCatalogItem(editTest.id, {
          name: name.trim(),
          category,
          price: parseFloat(price),
          urgencyOptions: urgency,
        })
        toast.success(`"${name}" updated in catalog.`)
      } else {
        await addTestCatalogItem({
          name: name.trim(),
          category,
          price: parseFloat(price),
          urgencyOptions: urgency,
          isActive: true,
        })
        toast.success(`"${name}" added to catalog.`)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save test.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            {isEdit ? "Edit Test" : "Add New Test"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this test's details in the catalog."
              : "Add a new diagnostic test to the clinic catalog."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="test-name">
              Test Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="test-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Complete Blood Count (CBC)"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>
              Category <span className="text-red-500">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="test-price">
              Price (Rs.) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="test-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              min={0}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Urgency Options</Label>
            <div className="flex gap-2">
              {URGENCY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleUrgency(opt)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                    urgency.includes(opt)
                      ? opt === "stat"
                        ? "border-red-300 bg-red-50 text-red-700"
                        : opt === "urgent"
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : isEdit ? "Update Test" : "Add Test"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
