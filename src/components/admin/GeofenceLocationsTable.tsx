import { useState, useMemo } from "react";
import {
  MapPin,
  Users,
  Pencil,
  Trash2,
  Search,
  X,
  ExternalLink,
  Copy,
  Check,
  Plus,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  Navigation,
  Power,
  Map as MapIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
import type { GeofenceLocation } from "@/backend/functions/geofencing.functions";
import { useI18n } from "@/lib/i18n";

export interface GeofenceLocationsTableProps {
  locations: GeofenceLocation[];
  isLoading?: boolean;
  onEdit: (location: GeofenceLocation) => void;
  onAssign: (location: GeofenceLocation) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (location: GeofenceLocation) => void;
  onViewOnMap: (location: GeofenceLocation) => void;
  onAddLocation: () => void;
  onOpenImport?: () => void;
  onOpenBulkAssign?: () => void;
}

type SortField = "name" | "assigned" | "status" | "radius";
type SortOrder = "asc" | "desc";

export function GeofenceLocationsTable({
  locations,
  isLoading = false,
  onEdit,
  onAssign,
  onToggleActive,
  onDelete,
  onViewOnMap,
  onAddLocation,
  onOpenImport,
  onOpenBulkAssign,
}: GeofenceLocationsTableProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const totalAssigned = useMemo(
    () => locations.reduce((sum, l) => sum + (l.assigned_count || 0), 0),
    [locations],
  );
  const activeCount = useMemo(() => locations.filter((l) => l.active).length, [locations]);
  const inactiveCount = locations.length - activeCount;

  const handleCopyCoords = (loc: GeofenceLocation) => {
    const coords = `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`;
    navigator.clipboard.writeText(coords);
    setCopiedId(loc.id);
    toast.success(`Copied coordinates: ${coords}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const filteredLocations = useMemo(() => {
    let list = locations;
    if (filterStatus === "active") list = list.filter((l) => l.active);
    if (filterStatus === "inactive") list = list.filter((l) => !l.active);

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          String(l.lat).includes(q) ||
          String(l.lng).includes(q) ||
          String(l.radius_m).includes(q),
      );
    }

    return [...list].sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "assigned") {
        comparison = (a.assigned_count || 0) - (b.assigned_count || 0);
      } else if (sortField === "status") {
        comparison = a.active === b.active ? 0 : a.active ? -1 : 1;
      } else if (sortField === "radius") {
        comparison = a.radius_m - b.radius_m;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [locations, filterStatus, searchQuery, sortField, sortOrder]);

  // Pagination calculations (50 per page default)
  const totalItems = filteredLocations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedLocations = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredLocations.slice(startIndex, startIndex + pageSize);
  }, [filteredLocations, safePage, pageSize]);

  function getPaginationRange(current: number, total: number) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 3) {
      return [1, 2, 3, 4, "...", total];
    }
    if (current >= total - 2) {
      return [1, "...", total - 3, total - 2, total - 1, total];
    }
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  const startRecord = totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="space-y-4">
      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Locations</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/10 text-brand">
              <MapPin className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">
              {locations.length}
            </span>
            <span className="text-xs text-muted-foreground">zones</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active (On)</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Power className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </span>
            <span className="text-xs text-muted-foreground">in service</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Inactive (Off)</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Power className="h-3.5 w-3.5 opacity-60" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-muted-foreground">
              {inactiveCount}
            </span>
            <span className="text-xs text-muted-foreground">disabled</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Assigned Employees</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Users className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">
              {totalAssigned}
            </span>
            <span className="text-xs text-muted-foreground">staff members</span>
          </div>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Chips */}
            <div className="inline-flex rounded-full border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setFilterStatus("all");
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  filterStatus === "all"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({locations.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterStatus("active");
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  filterStatus === "active"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterStatus("inactive");
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  filterStatus === "inactive"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Off ({inactiveCount})
              </button>
            </div>

            <span className="hidden text-xs text-muted-foreground sm:inline">
              Showing {totalItems > 0 ? `${startRecord}–${endRecord}` : 0} of {totalItems} locations
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenBulkAssign && (
              <button
                type="button"
                onClick={onOpenBulkAssign}
                disabled={locations.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Bulk Assign
              </button>
            )}
            {onOpenImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Import Excel
              </button>
            )}
            <button
              type="button"
              onClick={onAddLocation}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand hover:opacity-95 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("addLocation")}
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search locations by name, latitude, longitude, radius..."
            className="w-full rounded-xl border border-input bg-background py-2 ps-10 pe-9 text-xs sm:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
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
              {/* Name Column */}
              <TableHead
                className="cursor-pointer select-none py-3 ps-4 font-semibold text-foreground text-xs"
                onClick={() => handleSort("name")}
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>Name</span>
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>

              {/* Total Assigned Employees Column */}
              <TableHead
                className="cursor-pointer select-none py-3 font-semibold text-foreground text-xs"
                onClick={() => handleSort("assigned")}
              >
                <div className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Total Assigned Employees</span>
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>

              {/* Lat, Lng Column */}
              <TableHead className="py-3 font-semibold text-foreground text-xs">
                <div className="inline-flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Lat, Lng</span>
                </div>
              </TableHead>

              {/* Radius Column */}
              <TableHead
                className="cursor-pointer select-none py-3 font-semibold text-foreground text-xs"
                onClick={() => handleSort("radius")}
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>Radius</span>
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>

              {/* On / Off Column */}
              <TableHead
                className="cursor-pointer select-none py-3 text-center font-semibold text-foreground text-xs"
                onClick={() => handleSort("status")}
              >
                <div className="inline-flex items-center justify-center gap-1.5">
                  <span>On / Off</span>
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableHead>

              {/* Actions / Edit Column */}
              <TableHead className="py-3 pe-4 text-end font-semibold text-foreground text-xs">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    <span>Loading geofence locations…</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedLocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="mx-auto max-w-sm space-y-3">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">No locations found</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {searchQuery
                          ? `No location matches "${searchQuery}". Try a different search.`
                          : "No locations configured yet. Add your first geofence location."}
                      </p>
                    </div>
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setFilterStatus("all");
                          setPage(1);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Clear filters
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onAddLocation}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground shadow-brand"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("addLocation")}
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedLocations.map((loc) => {
                const assignedCount = loc.assigned_count || 0;
                const isCopied = copiedId === loc.id;
                const googleMapsUrl = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

                return (
                  <TableRow
                    key={loc.id}
                    className="group transition-colors hover:bg-muted/40"
                  >
                    {/* Name */}
                    <TableCell className="ps-4 py-3.5 align-middle">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors ${
                            loc.active
                              ? "bg-brand/10 text-brand dark:bg-brand/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <MapPin className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {loc.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {loc.radius_m}m zone radius
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Total Assigned Employees */}
                    <TableCell className="py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onAssign(loc)}
                          title="Click to manage employee assignments"
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:border-brand/40 hover:bg-brand/5 transition-all shadow-sm group-hover:border-border/80"
                        >
                          <Users className="h-3.5 w-3.5 text-brand" />
                          <span className="font-bold tabular-nums">{assignedCount}</span>
                          <span className="text-muted-foreground text-[11px]">
                            {assignedCount === 1 ? "employee" : "employees"}
                          </span>
                        </button>
                      </div>
                    </TableCell>

                    {/* Lat, Lng */}
                    <TableCell className="py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-muted/50 px-2 py-1 font-mono text-xs tabular-nums text-foreground border border-border/50">
                          {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyCoords(loc)}
                            title="Copy coordinates"
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open in Google Maps"
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </TableCell>

                    {/* Radius */}
                    <TableCell className="py-3.5 align-middle">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                        {loc.radius_m} m
                      </span>
                    </TableCell>

                    {/* On / Off Switch */}
                    <TableCell className="py-3.5 align-middle text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={loc.active}
                          title={loc.active ? "Turn Off location" : "Turn On location"}
                          onClick={() => onToggleActive(loc.id, !loc.active)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 ${
                            loc.active
                              ? "bg-emerald-600 dark:bg-emerald-500"
                              : "bg-muted-foreground/30 dark:bg-muted-foreground/20"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              loc.active ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            loc.active
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {loc.active ? "Active" : "Off"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Actions: Edit, View on Map, Delete */}
                    <TableCell className="pe-4 py-3.5 align-middle text-end">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => onEdit(loc)}
                          title="Edit location details"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Edit</span>
                        </button>

                        {/* View on Map Button */}
                        <button
                          type="button"
                          onClick={() => onViewOnMap(loc)}
                          title="View on Map"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <MapIcon className="h-3.5 w-3.5 text-brand" />
                          <span className="hidden sm:inline">Map</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => onDelete(loc)}
                          title="Delete location"
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer (when records exist or multiple pages) */}
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
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="hidden sm:inline">
                Showing {startRecord}–{endRecord} of {totalItems} locations
              </span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="me-2 font-medium text-foreground sm:inline hidden">
                  Page {safePage} of {totalPages}
                </span>

                {/* First Page */}
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={safePage <= 1}
                  title="First Page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>

                {/* Previous Page */}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  title="Previous Page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {/* Numbered Page Buttons */}
                <div className="hidden items-center gap-1 sm:flex">
                  {getPaginationRange(safePage, totalPages).map((p, idx) =>
                    typeof p === "number" ? (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${
                          p === safePage
                            ? "bg-brand text-brand-foreground shadow-sm"
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

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  title="Next Page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Last Page */}
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
