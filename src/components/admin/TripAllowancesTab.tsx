import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Plane, Save, MapPin, Plus, Trash2, Download, Upload, Navigation } from "lucide-react";
import * as XLSX from "xlsx";

export function TripAllowancesTab() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: policies, isLoading: loadingPolicies } = useQuery({
    queryKey: ["trip-allowance-policies"],
    queryFn: async () => {
      const res = await supabase
        .from("trip_allowance_policies")
        .select(`
          id,
          job_grade,
          nightly_rate,
          city_id,
          district,
          street,
          radius_m,
          cities ( name_en, name_ar )
        `);
      if (res.error) {
        // Fallback in case migration columns haven't been run yet
        if (res.error.message?.includes("column")) {
          const fallback = await supabase
            .from("trip_allowance_policies")
            .select(`
              id,
              job_grade,
              nightly_rate,
              city_id,
              cities ( name_en, name_ar )
            `);
          if (fallback.error) throw fallback.error;
          return fallback.data;
        }
        throw res.error;
      }
      return res.data;
    },
  });

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id, name_en, name_ar").order("name_en");
      if (error) throw error;
      return data;
    },
  });

  const { data: districts } = useQuery({
    queryKey: ["districts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("districts")
        .select("id, city_id, name_en, name_ar")
        .order("name_en");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeGrades = useMemo(() => ["Manager", "Engineer", "Technician", "Supervisor", "Driver"], []);

  // Group policies by city_id + district + street + radius_m
  const groupedPolicies = useMemo(() => {
    if (!policies) return [];
    const map = new Map<
      string,
      {
        key: string;
        city_id: string;
        city: any;
        district: string | null;
        street: string | null;
        radius_m: number;
        rates: Record<string, number>;
        ids: Record<string, string>;
      }
    >();

    for (const p of policies as any[]) {
      const dist = p.district?.trim() || null;
      const str = p.street?.trim() || null;
      const rad = Number(p.radius_m) || 500;
      const k = `${p.city_id}::${(dist || "").toLowerCase()}::${(str || "").toLowerCase()}::${rad}`;

      if (!map.has(k)) {
        map.set(k, {
          key: k,
          city_id: p.city_id,
          city: p.cities,
          district: dist,
          street: str,
          radius_m: rad,
          rates: {},
          ids: {},
        });
      }
      const item = map.get(k)!;
      item.rates[p.job_grade] = Number(p.nightly_rate);
      if (p.id) item.ids[p.job_grade] = p.id;
    }

    return Array.from(map.values()).sort((a, b) => {
      const cComp = (a.city?.name_en || "").localeCompare(b.city?.name_en || "");
      if (cComp !== 0) return cComp;
      const dComp = (a.district || "").localeCompare(b.district || "");
      if (dComp !== 0) return dComp;
      return (a.street || "").localeCompare(b.street || "");
    });
  }, [policies]);

  const upsertMutation = useMutation({
    mutationFn: async ({
      city_id,
      district,
      street,
      radius_m,
      rates,
      ids,
    }: {
      city_id: string;
      district?: string | null;
      street?: string | null;
      radius_m?: number;
      rates: Record<string, number>;
      ids?: Record<string, string>;
    }) => {
      const rows = Object.entries(rates).map(([grade, rate]) => ({
        ...(ids?.[grade] ? { id: ids[grade] } : {}),
        city_id,
        district: district?.trim() || null,
        street: street?.trim() || null,
        radius_m: radius_m || 500,
        job_grade: grade,
        nightly_rate: rate,
      }));
      const { error } = await supabase
        .from("trip_allowance_policies")
        .upsert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["trip-allowance-policies"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePolicyGroupMutation = useMutation({
    mutationFn: async (group: { ids: Record<string, string>; city_id: string; district?: string | null; street?: string | null }) => {
      const idList = Object.values(group.ids).filter(Boolean);
      if (idList.length > 0) {
        const { error } = await supabase.from("trip_allowance_policies").delete().in("id", idList);
        if (error) throw error;
        return;
      }
      let q = supabase.from("trip_allowance_policies").delete().eq("city_id", group.city_id);
      if (group.district) {
        q = q.eq("district", group.district);
      } else {
        q = q.is("district", null);
      }
      if (group.street) {
        q = q.eq("street", group.street);
      } else {
        q = q.is("street", null);
      }
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["trip-allowance-policies"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [newCityId, setNewCityId] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [newCustomDistrict, setNewCustomDistrict] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newRadius, setNewRadius] = useState<number>(500);
  const [newRates, setNewRates] = useState<Record<string, string>>({});

  const availableDistricts = useMemo(() => {
    if (!newCityId || !districts) return [];
    return districts.filter((d: any) => d.city_id === newCityId);
  }, [newCityId, districts]);

  const effectiveDistrict = newDistrict === "__custom__" ? newCustomDistrict.trim() : newDistrict.trim();

  const handleAdd = () => {
    if (!newCityId) return toast.error("Please select a city");
    if (!Object.values(newRates).some((r) => Number(r) > 0)) return toast.error("Please fill at least one rate");

    const rates: Record<string, number> = {};
    for (const g of activeGrades) rates[g] = Number(newRates[g]) || 0;

    upsertMutation.mutate(
      {
        city_id: newCityId,
        district: effectiveDistrict || null,
        street: newStreet.trim() || null,
        radius_m: Number(newRadius) || 500,
        rates,
      },
      {
        onSuccess: () => {
          setNewCityId("");
          setNewDistrict("");
          setNewCustomDistrict("");
          setNewStreet("");
          setNewRadius(500);
          setNewRates({ Manager: "", Engineer: "", Technician: "", Supervisor: "", Driver: "" });
        },
      },
    );
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const header = ["City", "District", "Street", "Radius (m)", "Manager", "Engineer", "Technician", "Supervisor", "Driver"];
    const data = [
      header,
      ["Cairo", "Nasr City", "Abbas El Akkad", 500, 500, 450, 400, 350, 250],
      ["Alexandria", "Smouha", "", 500, 600, 500, 450, 400, 300],
      ["Giza", "", "", 500, 400, 350, 300, 250, 200],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Trip_Allowances_Template.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (!cities) throw new Error("Cities not loaded yet");

        const rowsToUpsert: {
          city_id: string;
          district?: string | null;
          street?: string | null;
          radius_m: number;
          job_grade: string;
          nightly_rate: number;
        }[] = [];
        let skippedCities = 0;

        for (const row of data) {
          const cityName = row["City"];
          if (!cityName) continue;

          // Find matching city (case insensitive match on name_en or name_ar)
          const matchedCity = cities.find(
            (c) =>
              c.name_en?.toLowerCase() === String(cityName).toLowerCase() ||
              c.name_ar?.toLowerCase() === String(cityName).toLowerCase(),
          );

          if (!matchedCity) {
            skippedCities++;
            continue;
          }

          const district = String(row["District"] || "").trim() || null;
          const street = String(row["Street"] || "").trim() || null;
          const radius_m = Number(row["Radius (m)"] ?? row["Radius"] ?? 500) || 500;

          for (const grade of activeGrades) {
            const rate = Number(row[grade]);
            if (!isNaN(rate) && rate >= 0) {
              rowsToUpsert.push({
                city_id: matchedCity.id,
                district,
                street,
                radius_m,
                job_grade: grade,
                nightly_rate: rate,
              });
            }
          }
        }

        if (rowsToUpsert.length === 0) {
          toast.error("No valid data found to import.");
          return;
        }

        const { error } = await supabase.from("trip_allowance_policies").upsert(rowsToUpsert as any);

        if (error) throw error;

        toast.success(`Imported policies. ${skippedCities > 0 ? `Skipped ${skippedCities} unrecognized cities.` : ""}`);
        qc.invalidateQueries({ queryKey: ["trip-allowance-policies"] });
      } catch (err: any) {
        toast.error("Failed to import: " + err.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  if (loadingPolicies) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Plane className="h-6 w-6 text-brand" />
            Trip Allowances Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage overnight allowance rates based on destination city, district, street, radius, and job grade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
          >
            <Upload className="h-4 w-4" />
            Import Excel
          </button>
          <input
            type="file"
            accept=".xlsx, .xls"
            ref={fileInputRef}
            onChange={handleImportExcel}
            className="hidden"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start min-w-[130px]">City</th>
                <th className="px-3 py-3 text-start min-w-[120px]">District</th>
                <th className="px-3 py-3 text-start min-w-[130px]">Street</th>
                <th className="px-3 py-3 text-start min-w-[90px]">Radius</th>
                {activeGrades.map((g) => (
                  <th key={g} className="px-3 py-3 text-start min-w-[90px]">
                    {g}
                  </th>
                ))}
                <th className="w-16 px-3 py-3 text-center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groupedPolicies.map((group) => (
                <CityPolicyRow
                  key={group.key}
                  group={group}
                  activeGrades={activeGrades}
                  onSave={(rates, radius_m) =>
                    upsertMutation.mutate({
                      city_id: group.city_id,
                      district: group.district,
                      street: group.street,
                      radius_m: radius_m ?? group.radius_m,
                      rates,
                      ids: group.ids,
                    })
                  }
                  onDelete={() => deletePolicyGroupMutation.mutate(group)}
                />
              ))}

              {/* Add New Row */}
              <tr className="bg-muted/15 border-t-2 border-border/80">
                <td className="p-3">
                  <select
                    value={newCityId}
                    onChange={(e) => {
                      setNewCityId(e.target.value);
                      setNewDistrict("");
                      setNewCustomDistrict("");
                    }}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                  >
                    <option value="">Select City...</option>
                    {cities?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_en || c.name_ar}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  {availableDistricts.length > 0 ? (
                    <div className="space-y-1">
                      <select
                        value={newDistrict}
                        onChange={(e) => setNewDistrict(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand"
                        disabled={!newCityId}
                      >
                        <option value="">All Districts</option>
                        {availableDistricts.map((d: any) => (
                          <option key={d.id} value={d.name_en}>
                            {d.name_en}
                          </option>
                        ))}
                        <option value="__custom__">+ Custom District</option>
                      </select>
                      {newDistrict === "__custom__" && (
                        <input
                          type="text"
                          placeholder="Type district name..."
                          value={newCustomDistrict}
                          onChange={(e) => setNewCustomDistrict(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-brand"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="District (optional)"
                      value={newDistrict}
                      onChange={(e) => setNewDistrict(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand"
                      disabled={!newCityId}
                    />
                  )}
                </td>
                <td className="p-3">
                  <input
                    type="text"
                    placeholder="Street (optional)"
                    value={newStreet}
                    onChange={(e) => setNewStreet(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand"
                    disabled={!newCityId}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="50"
                      step="50"
                      value={newRadius}
                      onChange={(e) => setNewRadius(Number(e.target.value) || 500)}
                      className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-center outline-none focus:border-brand font-mono"
                      placeholder="500"
                    />
                    <span className="text-[11px] text-muted-foreground">m</span>
                  </div>
                </td>
                {activeGrades.map((g) => (
                  <td key={g} className="p-3">
                    <input
                      type="number"
                      min="0"
                      className="w-20 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none"
                      value={newRates[g] ?? ""}
                      onChange={(e) => setNewRates({ ...newRates, [g]: e.target.value })}
                      placeholder="0"
                    />
                  </td>
                ))}
                <td className="p-3 text-center">
                  <button
                    onClick={handleAdd}
                    disabled={upsertMutation.isPending}
                    className="rounded-lg bg-brand p-2 text-brand-foreground hover:bg-brand/90 disabled:opacity-50 transition-colors shadow-sm"
                    title="Add Policy"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CityPolicyRow({
  group,
  activeGrades,
  onSave,
  onDelete,
}: {
  group: {
    key: string;
    city_id: string;
    city: any;
    district: string | null;
    street: string | null;
    radius_m: number;
    rates: Record<string, number>;
  };
  activeGrades: string[];
  onSave: (rates: Record<string, number>, radius_m: number) => void;
  onDelete: () => void;
}) {
  const [editedRates, setEditedRates] = useState<Record<string, string>>({});
  const [editedRadius, setEditedRadius] = useState<string>(String(group.radius_m ?? 500));
  const currentRates = group.rates;

  const isRatesDirty = activeGrades.some(
    (g) =>
      editedRates[`${group.key}-${g}`] !== undefined &&
      Number(editedRates[`${group.key}-${g}`]) !== (currentRates[g] || 0),
  );

  const isRadiusDirty = Number(editedRadius) !== (group.radius_m ?? 500);
  const isDirty = isRatesDirty || isRadiusDirty;

  const handleSave = () => {
    const rates: Record<string, number> = {};
    for (const g of activeGrades) {
      rates[g] = Number(editedRates[`${group.key}-${g}`] ?? currentRates[g] ?? 0);
    }
    onSave(rates, Number(editedRadius) || 500);
    setEditedRates({});
  };

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="p-3 font-medium">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-brand shrink-0" />
          <span className="truncate">{group.city?.name_en || group.city?.name_ar || "Unknown City"}</span>
        </div>
      </td>
      <td className="p-3">
        {group.district ? (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            {group.district}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">All districts</span>
        )}
      </td>
      <td className="p-3">
        {group.street ? (
          <span className="text-xs text-foreground truncate block max-w-[140px]" title={group.street}>
            {group.street}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">—</span>
        )}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="50"
            step="50"
            value={editedRadius}
            onChange={(e) => setEditedRadius(e.target.value)}
            className="w-16 rounded-lg border border-border bg-transparent px-1.5 py-1 text-xs text-center font-mono focus:border-brand focus:outline-none"
          />
          <span className="text-[11px] text-muted-foreground">m</span>
        </div>
      </td>
      {activeGrades.map((g) => (
        <td key={g} className="p-3">
          <input
            type="number"
            min="0"
            className="w-20 rounded-lg border border-border bg-transparent px-2.5 py-1 text-xs focus:border-brand focus:outline-none"
            value={editedRates[`${group.key}-${g}`] ?? currentRates[g] ?? ""}
            onChange={(e) => setEditedRates({ ...editedRates, [`${group.key}-${g}`]: e.target.value })}
            placeholder="0"
          />
        </td>
      ))}
      <td className="p-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          {isDirty ? (
            <button
              onClick={handleSave}
              className="rounded-lg bg-brand p-1.5 text-brand-foreground hover:bg-brand/90 shadow-sm transition-colors"
              title="Save changes"
            >
              <Save className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="rounded-lg border border-transparent p-1.5 text-danger hover:bg-danger/10 transition-colors"
              title="Remove Policy"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
