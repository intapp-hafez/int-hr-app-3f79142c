import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Plane, Calendar, RouteIcon, Plus, X, CheckCircle } from "lucide-react";
import { useState } from "react";
import { createTrip, approveTrip } from "@/backend/functions/trips.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export function EmployeeTripsPanel({ employeeId }: { employeeId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const createFn = useServerFn(createTrip);
  const approveFn = useServerFn(approveTrip);
  const [showModal, setShowModal] = useState(false);
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [nights, setNights] = useState(1);
  const [locId, setLocId] = useState("");

  const { data: locations } = useQuery({
    queryKey: ["geo", "work-locations"],
    queryFn: async () => {
      const { data } = await supabase.from("geofence_locations").select("id, name, radius_m, active").order("name");
      return (data ?? []).filter((l: any) => l.active !== false);
    },
    enabled: showModal,
  });

  const { data: rateInfo } = useQuery({
    queryKey: ["trip-rate", employeeId, locId],
    queryFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("position_id").eq("id", employeeId).maybeSingle();
      if (!prof?.position_id) return { rate: null as number | null, noPosition: true };
      const { data } = await (supabase as any).from("trip_allowance_policies")
        .select("nightly_rate").eq("geofence_location_id", locId).eq("position_id", prof.position_id).maybeSingle();
      return { rate: data ? Number(data.nightly_rate) : null, noPosition: false };
    },
    enabled: !!locId && showModal,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!destination.trim()) throw new Error("Destination is required");
      return createFn({
        data: {
          assignee: employeeId,
          destination: destination.trim(),
          trip_date: date,
          overnight_nights: nights,
          geofence_location_id: locId || undefined,
        }
      });
    },
    onSuccess: () => {
      toast.success(t("addTrip") ?? "Trip added");
      setShowModal(false);
      setDestination("");
      setNights(1);
      setLocId("");
      qc.invalidateQueries({ queryKey: ["employee-trips", employeeId] });
    },
    onError: (err: any) => {
      console.error(err);
      toast.error(err.message || "Failed to create trip");
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (tripId: string) => approveFn({ data: { id: tripId } }),
    onSuccess: () => {
      toast.success("Trip approved successfully");
      qc.invalidateQueries({ queryKey: ["employee-trips", employeeId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve trip");
    }
  });

  const { data: trips, isLoading } = useQuery({
    queryKey: ["employee-trips", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(`
          id,
          destination,
          trip_date,
          status,
          overnight_nights,
          calculated_allowance,
          allowance_status,
          city,
          cities (name_en, name_ar)
        `)
        .eq("assignee", employeeId)
        .order("trip_date", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  const modalUi = showModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">{t("addTrip") ?? "Add Trip"}</h3>
          <button onClick={() => setShowModal(false)} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Destination</span>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" placeholder="e.g. Branch visit" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Work location (from geofencing)</span>
            <select value={locId} onChange={(e) => setLocId(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none">
              <option value="">— Select location —</option>
              {(locations || []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {locId && rateInfo && (
              <div className={`mt-1.5 text-xs ${rateInfo.rate == null ? "text-destructive" : "text-muted-foreground"}`}>
                {rateInfo.noPosition
                  ? "This employee has no position set, so no allowance applies."
                  : rateInfo.rate == null
                    ? "No allowance set for this position at this location."
                    : `${rateInfo.rate} EGP / night × ${nights} = ${rateInfo.rate * nights} EGP`}
              </div>
            )}
          </label>
            )}
            {cityId && cityPolicies?.length === 0 && (
               <div className="mt-1.5 text-xs text-destructive">No policies configured for this city.</div>
            )}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Overnights</span>
              <input type="number" min="0" value={nights} onChange={(e) => setNights(Number(e.target.value))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </label>
          </div>
          <button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="mt-2 w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? "Saving..." : t("save") ?? "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!trips || trips.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <RouteIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground mb-4">No trips found for this employee.</p>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow hover:opacity-90">
          <Plus className="h-4 w-4" /> {t("addTrip") ?? "Add Trip"}
        </button>
        {modalUi}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base font-semibold">{t("tripAllowance") ?? "Trip Allowance"}</h2>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground shadow hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> {t("addTrip") ?? "Add Trip"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Nights</th>
              <th className="px-4 py-3">Allowance (EGP)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {trips.map((trip: any) => (
              <tr key={trip.id} className="hover:bg-muted/20">
                <td className="p-4">
                  <div className="font-medium text-foreground">{trip.destination}</div>
                  {trip.cities && (
                    <div className="text-xs text-muted-foreground">
                      {trip.cities.name_en || trip.cities.name_ar}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {trip.trip_date}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">{trip.overnight_nights || 0}</td>
                <td className="px-4 py-3 font-mono">
                  {trip.calculated_allowance ? `${trip.calculated_allowance.toLocaleString()} EGP` : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                      Trip: {trip.status}
                    </span>
                    {trip.calculated_allowance > 0 && (
                      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        trip.allowance_status === "paid" ? "bg-emerald-500/20 text-emerald-700" :
                        trip.allowance_status === "approved" ? "bg-blue-500/20 text-blue-700" :
                        "bg-amber-500/20 text-amber-700"
                      }`}>
                        Allow: {trip.allowance_status}
                      </span>
                    )}
                    {trip.allowance_status === "pending" && (
                      <button 
                        onClick={() => approveMutation.mutate(trip.id)}
                        disabled={approveMutation.isPending}
                        className="mt-1 flex w-fit items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <CheckCircle className="h-3 w-3" /> Approve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalUi}
    </div>
  );
}
