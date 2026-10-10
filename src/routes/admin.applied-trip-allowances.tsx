import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MapPin,
  Users,
  Search,
  X,
  Calendar,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Navigation,
  Clock,
  Coins,
  Building,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listAppliedTripAllowances,
  type AppliedTripAllowanceRow,
} from "@/backend/functions/trips.functions";

export const Route = createFileRoute("/admin/applied-trip-allowances")({
  component: AppliedTripAllowancesPage,
});

export function AppliedTripAllowancesPage() {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [month, setMonth] = useState(currentMonthStr);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "applied" | "ineligible">("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination state (default: 30 per page)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const [yearNum, monthNum] = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(Date.UTC(yearNum, monthNum, 0)).toISOString().slice(0, 10);

  const fetchFn = useServerFn(listAppliedTripAllowances);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-applied-trip-allowances", startDate, endDate, selectedLocationId],
    queryFn: () =>
      fetchFn({
        data: {
          startDate,
          endDate,
          locationId: selectedLocationId !== "all" ? selectedLocationId : undefined,
        },
      }),
  });

  const rawRows = data?.rows ?? [];
  const locationsList = data?.locations ?? [];

  // Filter rows
  const filteredRows = useMemo(() => {
    let list = rawRows;

    if (statusFilter === "applied") {
      list = list.filter((r) => r.allowanceApplied && r.earnedAmount > 0);
    } else if (statusFilter === "ineligible") {
      list = list.filter((r) => !r.allowanceApplied || r.earnedAmount === 0);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(q) ||
          (r.employeeCode && r.employeeCode.toLowerCase().includes(q)) ||
          (r.department && r.department.toLowerCase().includes(q)) ||
          r.locationName.toLowerCase().includes(q) ||
          r.positionName.toLowerCase().includes(q) ||
          r.date.includes(q),
      );
    }

    return list;
  }, [rawRows, statusFilter, search]);

  // Pagination
  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  function getPaginationRange(current: number, total: number) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, "...", total];
    if (current >= total - 2) return [1, "...", total - 3, total - 2, total - 1, total];
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  const handleCopyCoords = (id: string, lat: number | null, lng: number | null) => {
    if (lat == null || lng == null) return;
    const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard.writeText(coords);
    setCopiedId(id);
    toast.success(`Copied coordinates: ${coords}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportToExcel = async () => {
    if (filteredRows.length === 0) return toast.error("No data to export");
    try {
      const XLSX = await import("xlsx");
      const exportData = filteredRows.map((r) => ({
        Date: r.date,
        "Employee Code": r.employeeCode || "—",
        "Employee Name": r.employeeName,
        Department: r.department || "—",
        Position: r.positionName,
        "Work Location": r.locationName,
        "Check-In Time": r.inTime || "—",
        "Check-Out Time": r.outTime || "—",
        "Distance to Center (m)": r.distanceMeters ?? "—",
        "Trip Allowance Rate (EGP)": r.nightlyRate,
        "Trip Allowance Enabled": r.tripAllowanceEnabled ? "Yes" : "No",
        "Allowance Applied": r.allowanceApplied ? "Yes" : "No",
        "Earned Allowance (EGP)": r.earnedAmount,
        Latitude: r.lat ?? "—",
        Longitude: r.lng ?? "—",
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Applied Trip Allowances");
      XLSX.writeFile(wb, `applied_trip_allowances_${month}.xlsx`);
      toast.success("Exported to Excel successfully");
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  };

  const totalAppliedAmount = data?.totalAppliedAmount ?? 0;
  const eligibleCount = data?.eligibleCount ?? 0;
  const totalCheckedIn = data?.totalCheckedInCount ?? 0;
  const uniqueEmployees = useMemo(
    () => new Set(rawRows.map((r) => r.employeeId)).size,
    [rawRows],
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl text-foreground">
              Applied Trip Allowances
            </h1>
            <span className="rounded-full bg-brand/10 text-brand px-2.5 py-0.5 text-xs font-semibold">
              {totalCheckedIn} check-ins
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Track employees who checked in or out at Trip Allowance work locations and their calculated daily allowances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month selector */}
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Month:</span>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) {
                  setMonth(e.target.value);
                  setPage(1);
                }
              }}
              className="bg-transparent font-semibold text-foreground focus:outline-none"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportToExcel}
            disabled={filteredRows.length === 0}
            className="rounded-full shadow-sm"
          >
            <Download className="me-1.5 h-3.5 w-3.5" />
            Export Excel
          </Button>

          <Link
            to="/admin/allowances"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted shadow-sm transition-colors"
          >
            <Coins className="h-3.5 w-3.5 text-brand" />
            Allowance Policies
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Trip Check-ins</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/10 text-brand">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">
              {totalCheckedIn}
            </span>
            <span className="text-xs text-muted-foreground">records</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Applied Allowances</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {eligibleCount}
            </span>
            <span className="text-xs text-muted-foreground">eligible</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Applied (EGP)</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Coins className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">
              {totalAppliedAmount.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">EGP</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Employees</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">
              {uniqueEmployees}
            </span>
            <span className="text-xs text-muted-foreground">staff</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Chips */}
            <div className="inline-flex rounded-full border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  statusFilter === "all"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({rawRows.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("applied");
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  statusFilter === "applied"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Applied ({eligibleCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ineligible");
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  statusFilter === "ineligible"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Ineligible / Zero ({rawRows.length - eligibleCount})
              </button>
            </div>

            {/* Work Location Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand max-w-[200px]"
              >
                <option value="all">All Trip Locations</option>
                {locationsList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <span className="text-xs text-muted-foreground">
            Showing {totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, totalItems)} of {totalItems} check-ins
          </span>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by employee name, code, department, position, location, or date..."
            className="w-full rounded-xl border border-input bg-background py-2 ps-10 pe-9 text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 ps-4 font-semibold text-foreground text-xs">Date</TableHead>
              <TableHead className="py-3 font-semibold text-foreground text-xs">Employee</TableHead>
              <TableHead className="py-3 font-semibold text-foreground text-xs">Position</TableHead>
              <TableHead className="py-3 font-semibold text-foreground text-xs">Trip Work Location</TableHead>
              <TableHead className="py-3 font-semibold text-foreground text-xs">Check-In / Out</TableHead>
              <TableHead className="py-3 font-semibold text-foreground text-xs text-center">Applied Allowance</TableHead>
              <TableHead className="py-3 pe-4 font-semibold text-foreground text-xs text-end">Coordinates</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                    <span>Loading applied trip allowances…</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="mx-auto max-w-sm space-y-3">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                      <Navigation className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">No check-ins found</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {search
                          ? `No check-in matches "${search}". Try adjusting your filters.`
                          : "No employee check-ins at Trip Allowance locations during this month."}
                      </p>
                    </div>
                    {search && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setStatusFilter("all");
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((r) => {
                const isCopied = copiedId === r.id;
                const googleMapsUrl =
                  r.lat != null && r.lng != null ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : null;

                const checkInFormatted = r.inTime
                  ? new Date(r.inTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—";
                const checkOutFormatted = r.outTime
                  ? new Date(r.outTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—";

                return (
                  <TableRow key={r.id} className="transition-colors hover:bg-muted/40">
                    {/* Date */}
                    <TableCell className="ps-4 py-3.5 font-medium whitespace-nowrap align-middle">
                      <div className="font-mono text-xs">{r.date}</div>
                    </TableCell>

                    {/* Employee */}
                    <TableCell className="py-3.5 align-middle">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/10 font-bold text-xs text-brand">
                          {r.employeeName.charAt(0) || "U"}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate">{r.employeeName}</p>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {r.employeeCode && <span>{r.employeeCode} · </span>}
                            <span>{r.department || "General"}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Position */}
                    <TableCell className="py-3.5 align-middle">
                      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                        {r.positionName}
                      </span>
                    </TableCell>

                    {/* Work Location */}
                    <TableCell className="py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-brand shrink-0" />
                        <div>
                          <p className="font-semibold text-xs text-foreground truncate max-w-[200px]">
                            {r.locationName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {r.distanceMeters != null ? `${r.distanceMeters}m from center` : "Inside zone"} · {r.locationRadius}m radius
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Check-In / Out Times */}
                    <TableCell className="py-3.5 align-middle whitespace-nowrap">
                      <div className="text-xs">
                        <div className="flex items-center gap-1 text-foreground">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold">In:</span>
                          <span className="font-mono font-medium">{checkInFormatted}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="text-[10px] uppercase font-semibold">Out:</span>
                          <span className="font-mono">{checkOutFormatted}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Applied Allowance Rate */}
                    <TableCell className="py-3.5 align-middle text-center">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        {r.allowanceApplied ? (
                          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <span>{r.earnedAmount} EGP</span>
                          </div>
                        ) : !r.tripAllowanceEnabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Disabled for employee
                          </span>
                        ) : r.nightlyRate === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            No policy rate set
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            0 EGP
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          Rate: {r.nightlyRate} EGP/night
                        </span>
                      </div>
                    </TableCell>

                    {/* Coordinates / Map Verification */}
                    <TableCell className="pe-4 py-3.5 align-middle text-end">
                      {r.lat != null && r.lng != null ? (
                        <div className="inline-flex items-center gap-1.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCoords(r.id, r.lat, r.lng)}
                            title="Copy coordinates"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                          {googleMapsUrl && (
                            <a
                              href={googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open in Google Maps"
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Branch match</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        {!isLoading && totalItems > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="hidden sm:inline">
                Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalItems)} of {totalItems} check-ins
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="me-2 font-medium text-foreground sm:inline hidden">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={safePage <= 1}
                  title="First Page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  title="Previous Page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="hidden items-center gap-1 sm:flex">
                  {getPaginationRange(safePage, totalPages).map((p, idx) =>
                    typeof p === "number" ? (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${
                          p === safePage
                            ? "bg-foreground text-background shadow-sm"
                            : "border border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={idx} className="px-1 text-muted-foreground select-none">
                        …
                      </span>
                    ),
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  title="Next Page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={safePage >= totalPages}
                  title="Last Page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
