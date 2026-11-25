import React, { useEffect, useRef, useState } from "react";
import { INDIA_CENTER } from "@shared/india-locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  CheckCircle2,
  Compass,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

export type SupplyStatus = "available" | "limited" | "critical" | "unavailable";
export type FacilityStatus = "open" | "limited" | "critical" | "closed";

export interface HospitalBranchRecord {
  id: number;
  ownerUserId?: number | null;
  name: string;
  organizationName: string;
  branchName: string;
  registrationId?: string | null;
  isPrimaryBranch: boolean;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPhone?: string | null;
  phone?: string | null;
  specialty?: string;
  specialties?: string[];
  latitude: number;
  longitude: number;
  totalEmergencyBeds?: number;
  availableEmergencyBeds?: number;
  totalIcuBeds?: number;
  availableIcuBeds?: number;
  erTotal?: number;
  erAvailable?: number;
  icuTotal?: number;
  icuAvailable?: number;
  oxygenCylinderCount?: number;
  bloodUnitCount?: number;
  oxygenUnits?: number;
  bloodUnits?: number;
  oxygenCylinders?: number;
  ambulanceCount?: number;
  ambulances?: number;
  foodSupplyStatus: SupplyStatus;
  medicineSupplyStatus: SupplyStatus;
  waterSupplyStatus: SupplyStatus;
  powerBackupStatus: SupplyStatus;
  status: string;
  legacyStatus?: FacilityStatus;
  isSahayVerified?: boolean;
  updatedAt?: string | Date;
}

export interface HospitalBranchSubmitPayload {
  organizationName: string;
  branchName: string;
  registrationId?: string;
  isPrimaryBranch: boolean;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  latitude: number;
  longitude: number;
  specialties: string[];
  erTotal: number;
  erAvailable: number;
  icuTotal: number;
  icuAvailable: number;
  oxygenUnits: number;
  bloodUnits: number;
  ambulances: number;
  foodSupplyStatus: SupplyStatus;
  medicineSupplyStatus: SupplyStatus;
  waterSupplyStatus: SupplyStatus;
  powerBackupStatus: SupplyStatus;
  status: FacilityStatus;
}

const DEFAULT_SPECIALTIES = [
  "Emergency Medicine",
  "Trauma Care",
  "ICU & Critical Care",
  "Maternity & NICU",
  "Paediatrics",
  "Orthopaedics",
  "Cardiology",
  "Burns Unit",
  "Neurosurgery",
  "General Surgery",
];

type NominatimSearchHit = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    state_district?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
};

function extractAddressParts(addr: NominatimSearchHit["address"], fallbackDisplay?: string) {
  const streetParts = [addr?.road, addr?.neighbourhood || addr?.suburb].filter(Boolean);
  const city = addr?.city || addr?.town || addr?.village || addr?.state_district || addr?.county || "";
  const state = addr?.state || "";
  const pincode = (addr?.postcode || "").replace(/\s+/g, "").slice(0, 12);
  const address =
    streetParts.length > 0
      ? streetParts.join(", ")
      : fallbackDisplay
      ? fallbackDisplay.split(",").slice(0, 3).join(", ").trim()
      : "";
  return { address, city, state, pincode };
}

export function HospitalBranchForm({
  mode,
  initialValues,
  defaultOrganizationName,
  isFirstBranch = false,
  onSubmit,
  onCancel,
  submitting = false,
}: {
  mode: "create" | "edit";
  initialValues?: Partial<HospitalBranchRecord> | null;
  defaultOrganizationName?: string;
  isFirstBranch?: boolean;
  onSubmit: (payload: HospitalBranchSubmitPayload) => Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
}) {
  const [organizationName, setOrganizationName] = useState(
    initialValues?.organizationName || defaultOrganizationName || ""
  );
  const [branchName, setBranchName] = useState(
    initialValues?.branchName || (isFirstBranch ? "Main Hospital" : "")
  );
  const [registrationId, setRegistrationId] = useState(initialValues?.registrationId || "");
  const [isPrimaryBranch, setIsPrimaryBranch] = useState(
    initialValues?.isPrimaryBranch ?? isFirstBranch
  );
  const [contactPhone, setContactPhone] = useState(
    initialValues?.contactPhone || initialValues?.phone || ""
  );
  const [address, setAddress] = useState(initialValues?.address || "");
  const [city, setCity] = useState(initialValues?.city || "");
  const [stateName, setStateName] = useState(initialValues?.state || "");
  const [pincode, setPincode] = useState(initialValues?.pincode || "");

  const [latitude, setLatitude] = useState<string>(
    initialValues?.latitude != null ? String(initialValues.latitude) : ""
  );
  const [longitude, setLongitude] = useState<string>(
    initialValues?.longitude != null ? String(initialValues.longitude) : ""
  );

  const initialSpecialties = (() => {
    if (Array.isArray(initialValues?.specialties) && initialValues!.specialties.length > 0) {
      return initialValues!.specialties;
    }
    if (initialValues?.specialty) {
      return initialValues.specialty
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    }
    return ["Emergency Medicine", "Trauma Care"];
  })();

  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(initialSpecialties);
  const [customSpecialty, setCustomSpecialty] = useState("");

  const [totalEmergencyBeds, setTotalEmergencyBeds] = useState(
    initialValues?.erTotal ?? initialValues?.totalEmergencyBeds ?? 20
  );
  const [availableEmergencyBeds, setAvailableEmergencyBeds] = useState(
    initialValues?.erAvailable ?? initialValues?.availableEmergencyBeds ?? 10
  );
  const [totalIcuBeds, setTotalIcuBeds] = useState(
    initialValues?.icuTotal ?? initialValues?.totalIcuBeds ?? 8
  );
  const [availableIcuBeds, setAvailableIcuBeds] = useState(
    initialValues?.icuAvailable ?? initialValues?.availableIcuBeds ?? 4
  );
  const [oxygenCylinders, setOxygenCylinders] = useState(
    initialValues?.oxygenUnits ?? initialValues?.oxygenCylinderCount ?? initialValues?.oxygenCylinders ?? 25
  );
  const [bloodUnits, setBloodUnits] = useState(
    initialValues?.bloodUnits ?? initialValues?.bloodUnitCount ?? 15
  );
  const [ambulanceCount, setAmbulanceCount] = useState(
    initialValues?.ambulances ?? initialValues?.ambulanceCount ?? 2
  );
  const [status, setStatus] = useState<FacilityStatus>(
    (initialValues?.legacyStatus ?? initialValues?.status ?? "open").toLowerCase() as FacilityStatus
  );
  const [foodSupplyStatus, setFoodSupplyStatus] = useState<SupplyStatus>(
    initialValues?.foodSupplyStatus ?? "available"
  );
  const [medicineSupplyStatus, setMedicineSupplyStatus] = useState<SupplyStatus>(
    initialValues?.medicineSupplyStatus ?? "available"
  );
  const [waterSupplyStatus, setWaterSupplyStatus] = useState<SupplyStatus>(
    initialValues?.waterSupplyStatus ?? "available"
  );
  const [powerBackupStatus, setPowerBackupStatus] = useState<SupplyStatus>(
    initialValues?.powerBackupStatus ?? "available"
  );

  // Location Picker state
  const [placeQuery, setPlaceQuery] = useState("");
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [searchResults, setSearchResults] = useState<NominatimSearchHit[]>([]);
  const [locatingGps, setLocatingGps] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const numericLat = parseFloat(latitude);
  const numericLng = parseFloat(longitude);
  const hasValidPin =
    Number.isFinite(numericLat) &&
    Number.isFinite(numericLng) &&
    numericLat >= -90 &&
    numericLat <= 90 &&
    numericLng >= -180 &&
    numericLng <= 180;

  async function reverseGeocodePoint(lat: number, lng: number, forceFill = false) {
    setReverseGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data: NominatimSearchHit = await res.json();
      const parts = extractAddressParts(data.address, data.display_name);
      if (parts.address && (forceFill || !address.trim())) setAddress(parts.address);
      if (parts.city && (forceFill || !city.trim())) setCity(parts.city);
      if (parts.state && (forceFill || !stateName.trim())) setStateName(parts.state);
      if (parts.pincode && (forceFill || !pincode.trim())) setPincode(parts.pincode);
    } catch {
      // Silently ignore offline reverse geocoding failure
    } finally {
      setReverseGeocoding(false);
    }
  }

  // Initialize mini Leaflet location picker map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let mounted = true;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (!mounted || !mapContainerRef.current) return;
        const startCenter: [number, number] = hasValidPin
          ? [numericLat, numericLng]
          : [INDIA_CENTER.lat, INDIA_CENTER.lng];
        const startZoom = hasValidPin ? 14 : 5;

        const map = L.map(mapContainerRef.current, {
          center: startCenter,
          zoom: startZoom,
          zoomControl: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        const pinIcon = L.divIcon({
          className: "hospital-form-pin",
          html: `<div style="background:#2457FF;color:#fff;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(36,87,255,0.45);font-size:14px;">🏥</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        if (hasValidPin) {
          markerRef.current = L.marker(startCenter, { icon: pinIcon }).addTo(map);
        }

        map.on("click", (e: any) => {
          const pickedLat = Number(e.latlng.lat.toFixed(6));
          const pickedLng = Number(e.latlng.lng.toFixed(6));
          setLatitude(String(pickedLat));
          setLongitude(String(pickedLng));
          if (markerRef.current) {
            markerRef.current.setLatLng([pickedLat, pickedLng]);
          } else {
            markerRef.current = L.marker([pickedLat, pickedLng], { icon: pinIcon }).addTo(map);
          }
          void reverseGeocodePoint(pickedLat, pickedLng, false);
        });

        leafletRef.current = map;
        setTimeout(() => {
          if (mounted) map.invalidateSize();
        }, 200);
      } catch (err) {
        console.warn("[HospitalBranchForm] Mini map init skipped:", err);
      }
    })();

    return () => {
      mounted = false;
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Keep marker synced if user updates lat/lng via search or GPS
  useEffect(() => {
    if (!leafletRef.current || !hasValidPin) return;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        const map = leafletRef.current;
        if (!map) return;
        const pinIcon = L.divIcon({
          className: "hospital-form-pin",
          html: `<div style="background:#2457FF;color:#fff;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(36,87,255,0.45);font-size:14px;">🏥</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        if (markerRef.current) {
          markerRef.current.setLatLng([numericLat, numericLng]);
        } else {
          markerRef.current = L.marker([numericLat, numericLng], { icon: pinIcon }).addTo(map);
        }
        map.flyTo([numericLat, numericLng], Math.max(map.getZoom(), 14), { duration: 0.6 });
      } catch {}
    })();
  }, [hasValidPin, numericLat, numericLng]);

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Device GPS is not supported in this browser.");
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatitude(String(lat));
        setLongitude(String(lng));
        setLocatingGps(false);
        toast.success("GPS coordinates captured. Auto-filling address…");
        await reverseGeocodePoint(lat, lng, true);
      },
      err => {
        setLocatingGps(false);
        toast.error(`Unable to detect GPS location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSearchPlace() {
    const q = placeQuery.trim();
    if (!q) return;
    setSearchingPlace(true);
    setSearchResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&addressdetails=1&q=${encodeURIComponent(
        q
      )}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("Location lookup unavailable");
      const data: NominatimSearchHit[] = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      if (!data.length) {
        toast.info("No matching address found in India. Try adding city or click on the map.");
      }
    } catch {
      toast.error("Place search failed — click directly on the map or enter coordinates.");
    } finally {
      setSearchingPlace(false);
    }
  }

  function selectPlaceHit(hit: NominatimSearchHit) {
    const lat = Number(parseFloat(hit.lat).toFixed(6));
    const lng = Number(parseFloat(hit.lon).toFixed(6));
    setLatitude(String(lat));
    setLongitude(String(lng));
    const parts = extractAddressParts(hit.address, hit.display_name);
    if (parts.address) setAddress(parts.address);
    if (parts.city) setCity(parts.city);
    if (parts.state) setStateName(parts.state);
    if (parts.pincode) setPincode(parts.pincode);
    setSearchResults([]);
    toast.success("Facility location selected from OpenStreetMap.");
  }

  function toggleSpecialty(spec: string) {
    setSelectedSpecialties(prev =>
      prev.includes(spec) ? prev.filter(item => item !== spec) : [...prev, spec]
    );
  }

  function handleAddCustomSpecialty() {
    const trimmed = customSpecialty.trim();
    if (!trimmed) return;
    if (!selectedSpecialties.includes(trimmed)) {
      setSelectedSpecialties(prev => [...prev, trimmed]);
    }
    setCustomSpecialty("");
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!organizationName.trim()) {
      setFormError("Organization / Hospital Name is required.");
      return;
    }
    if (!branchName.trim()) {
      setFormError("Branch Name is required (e.g., Main Hospital or Wing Name).");
      return;
    }
    if (!contactPhone.trim() || contactPhone.trim().length < 5) {
      setFormError("A valid Emergency Helpline Phone number is required.");
      return;
    }
    if (!address.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
      setFormError("Complete Address, City, State, and Pincode are required.");
      return;
    }
    if (!hasValidPin) {
      setFormError("Please capture GPS coordinates, search your hospital, or click on the map to set latitude & longitude.");
      return;
    }
    if (availableEmergencyBeds > totalEmergencyBeds) {
      setFormError("Available ER beds cannot exceed Total ER capacity.");
      return;
    }
    if (availableIcuBeds > totalIcuBeds) {
      setFormError("Available ICU beds cannot exceed Total ICU capacity.");
      return;
    }

    const finalSpecialties = selectedSpecialties.length > 0 ? selectedSpecialties : ["Emergency Medicine"];

    await onSubmit({
      organizationName: organizationName.trim(),
      branchName: branchName.trim(),
      registrationId: registrationId.trim() || undefined,
      isPrimaryBranch,
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      pincode: pincode.trim(),
      phone: contactPhone.trim(),
      latitude: numericLat,
      longitude: numericLng,
      specialties: finalSpecialties,
      erTotal: Math.max(0, Number(totalEmergencyBeds) || 0),
      erAvailable: Math.max(0, Number(availableEmergencyBeds) || 0),
      icuTotal: Math.max(0, Number(totalIcuBeds) || 0),
      icuAvailable: Math.max(0, Number(availableIcuBeds) || 0),
      oxygenUnits: Math.max(0, Number(oxygenCylinders) || 0),
      bloodUnits: Math.max(0, Number(bloodUnits) || 0),
      ambulances: Math.max(0, Number(ambulanceCount) || 0),
      foodSupplyStatus,
      medicineSupplyStatus,
      waterSupplyStatus,
      powerBackupStatus,
      status,
    });
  }

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {formError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
          {formError}
        </div>
      )}

      {/* 1. Organization & Branch Identity */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Building2 className="h-4 w-4 text-[#2457FF]" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
            Facility & Branch Identity
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="hosp-org-name" className="text-xs font-bold">
              Hospital / Healthcare Organization Name *
            </Label>
            <Input
              id="hosp-org-name"
              value={organizationName}
              onChange={e => setOrganizationName(e.target.value)}
              placeholder="e.g. City Care Medical Centre"
              className="mt-1.5 rounded-xl"
              required
            />
          </div>
          <div>
            <Label htmlFor="hosp-branch-name" className="text-xs font-bold">
              Branch / Campus Name *
            </Label>
            <Input
              id="hosp-branch-name"
              value={branchName}
              onChange={e => setBranchName(e.target.value)}
              placeholder="e.g. Main Hospital or South Wing"
              className="mt-1.5 rounded-xl"
              required
            />
          </div>
          <div>
            <Label htmlFor="hosp-phone" className="text-xs font-bold">
              Emergency Triage / ER Phone *
            </Label>
            <Input
              id="hosp-phone"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="+91 98XXXXXXXX or 0XX-XXXXXXXX"
              className="mt-1.5 rounded-xl"
              required
            />
          </div>
          <div>
            <Label htmlFor="hosp-reg-id" className="text-xs font-bold">
              ABDM / HFR / State Registration ID (Optional)
            </Label>
            <Input
              id="hosp-reg-id"
              value={registrationId}
              onChange={e => setRegistrationId(e.target.value)}
              placeholder="e.g. IN-HFR-1048292"
              className="mt-1.5 rounded-xl font-mono text-xs"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 pt-1 text-xs font-semibold text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={isPrimaryBranch}
            onChange={e => setIsPrimaryBranch(e.target.checked)}
            className="h-4 w-4 rounded accent-[#2457FF]"
          />
          <span>Set as Primary Command Branch for this account</span>
        </label>
      </div>

      {/* 2. Pan-India GPS & Address Picker */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#2457FF]" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
              Live GPS & Pan-India Address Picker
            </h3>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentLocation}
            disabled={locatingGps}
            className="rounded-xl border-[#2457FF]/30 text-[#2457FF] hover:bg-[#2457FF]/10 font-bold"
          >
            {locatingGps ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Navigation className="mr-1.5 h-3.5 w-3.5" />
            )}
            Use My Current Location
          </Button>
        </div>

        {/* Search OpenStreetMap Place anywhere in India */}
        <div className="relative">
          <Label className="text-xs font-bold">Search Hospital / Street / Locality Anywhere in India</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              value={placeQuery}
              onChange={e => setPlaceQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearchPlace();
                }
              }}
              placeholder="Search hospital name, street, city, or pincode in India…"
              className="rounded-xl"
            />
            <Button
              type="button"
              onClick={() => void handleSearchPlace()}
              disabled={searchingPlace}
              className="rounded-xl bg-[#111C44] text-white hover:bg-[#1a2b66] shrink-0"
            >
              {searchingPlace ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Find</span>
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 rounded-2xl border border-border bg-card shadow-lg divide-y divide-border/50 max-h-48 overflow-y-auto">
              {searchResults.map(hit => (
                <button
                  key={hit.place_id}
                  type="button"
                  onClick={() => selectPlaceHit(hit)}
                  className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-muted/70 transition flex items-start gap-2"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2457FF]" />
                  <span className="line-clamp-2 font-medium text-foreground">{hit.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Click-to-Pin Mini Map */}
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-muted/30">
          <div ref={mapContainerRef} className="h-56 w-full" />
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-3.5 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-[#2457FF]" />
              Click anywhere on the map to pin exact entrance coordinates
            </span>
            {reverseGeocoding && (
              <span className="font-semibold text-[#2457FF]">Resolving address…</span>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="hosp-lat" className="text-xs font-bold">Latitude *</Label>
            <Input
              id="hosp-lat"
              type="number"
              step="any"
              value={latitude}
              onChange={e => setLatitude(e.target.value)}
              placeholder="e.g. 19.076090"
              className="mt-1 rounded-xl font-mono text-xs tabular-nums"
              required
            />
          </div>
          <div>
            <Label htmlFor="hosp-lng" className="text-xs font-bold">Longitude *</Label>
            <Input
              id="hosp-lng"
              type="number"
              step="any"
              value={longitude}
              onChange={e => setLongitude(e.target.value)}
              placeholder="e.g. 72.877426"
              className="mt-1 rounded-xl font-mono text-xs tabular-nums"
              required
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="hosp-address" className="text-xs font-bold">Street / Landmark Address *</Label>
            <Input
              id="hosp-address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Building, Road, Locality"
              className="mt-1 rounded-xl"
              required
            />
          </div>
          <div>
            <Label htmlFor="hosp-city" className="text-xs font-bold">City / District *</Label>
            <Input
              id="hosp-city"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Pune, Bengaluru, Patna"
              className="mt-1 rounded-xl"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="hosp-state" className="text-xs font-bold">State / UT *</Label>
              <Input
                id="hosp-state"
                value={stateName}
                onChange={e => setStateName(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="mt-1 rounded-xl"
                required
              />
            </div>
            <div>
              <Label htmlFor="hosp-pincode" className="text-xs font-bold">Pincode *</Label>
              <Input
                id="hosp-pincode"
                value={pincode}
                onChange={e => setPincode(e.target.value)}
                placeholder="e.g. 411001"
                className="mt-1 rounded-xl font-mono text-xs"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Specialties & Initial Live Capacity */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Sparkles className="h-4 w-4 text-[#2457FF]" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-foreground">
            Clinical Specialties & Bed Capacity
          </h3>
        </div>

        <div>
          <Label className="text-xs font-bold">Medical Specialties</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEFAULT_SPECIALTIES.map(spec => {
              const active = selectedSpecialties.includes(spec);
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpecialty(spec)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition border ${
                    active
                      ? "border-[#2457FF] bg-[#2457FF] text-white"
                      : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {spec}
                </button>
              );
            })}
            {selectedSpecialties
              .filter(s => !DEFAULT_SPECIALTIES.includes(s))
              .map(custom => (
                <span
                  key={custom}
                  className="inline-flex items-center gap-1 rounded-full border border-[#2457FF] bg-[#2457FF] px-3 py-1 text-xs font-bold text-white"
                >
                  {custom}
                  <button type="button" onClick={() => toggleSpecialty(custom)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
          </div>
          <div className="mt-2.5 flex gap-2 max-w-md">
            <Input
              value={customSpecialty}
              onChange={e => setCustomSpecialty(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustomSpecialty();
                }
              }}
              placeholder="Add custom specialty (e.g. Dialysis, Snakebite)…"
              className="rounded-xl text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAddCustomSpecialty} className="rounded-xl">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
          <div>
            <Label className="text-[11px] font-bold">Total ER Beds</Label>
            <Input
              type="number"
              min={0}
              value={totalEmergencyBeds}
              onChange={e => setTotalEmergencyBeds(Number(e.target.value))}
              className="mt-1 rounded-xl tabular-nums font-bold"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold">Available ER Beds</Label>
            <Input
              type="number"
              min={0}
              max={totalEmergencyBeds}
              value={availableEmergencyBeds}
              onChange={e => setAvailableEmergencyBeds(Number(e.target.value))}
              className="mt-1 rounded-xl tabular-nums font-bold text-[#2457FF]"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold">Total ICU Beds</Label>
            <Input
              type="number"
              min={0}
              value={totalIcuBeds}
              onChange={e => setTotalIcuBeds(Number(e.target.value))}
              className="mt-1 rounded-xl tabular-nums font-bold"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold">Available ICU Beds</Label>
            <Input
              type="number"
              min={0}
              max={totalIcuBeds}
              value={availableIcuBeds}
              onChange={e => setAvailableIcuBeds(Number(e.target.value))}
              className="mt-1 rounded-xl tabular-nums font-bold text-[#2457FF]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label className="text-[11px] font-bold">Oxygen Units</Label>
            <Input
              type="number"
              min={0}
              value={oxygenCylinders}
              onChange={e => setOxygenCylinders(Number(e.target.value))}
              className="mt-1 rounded-xl tabular-nums"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold">Blood Units</Label>
            <Input
              type="number"
              min={0}
              value={bloodUnits}
              onChange={e => setBloodUnits(Number(e.target.value))}
              className="mt-1 rounded-xl tabular-nums"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold">Ambulances</Label>
            <Input
              type="number"
              min={0}
              value={ambulanceCount}
              onChange={e => setAmbulanceCount(Number(e.target.value))}
              className="mt-1 rounded-xl tabular-nums"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold">Operational Status</Label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as FacilityStatus)}
              className="mt-1 h-9 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold uppercase"
            >
              <option value="open">OPEN</option>
              <option value="limited">LIMITED</option>
              <option value="critical">FULL / CRITICAL</option>
              <option value="closed">CLOSED</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
          {(
            [
              { label: "Food Supply", value: foodSupplyStatus, setter: setFoodSupplyStatus },
              { label: "Medicine Supply", value: medicineSupplyStatus, setter: setMedicineSupplyStatus },
              { label: "Clean Water", value: waterSupplyStatus, setter: setWaterSupplyStatus },
              { label: "Power Backup", value: powerBackupStatus, setter: setPowerBackupStatus },
            ] as const
          ).map(item => (
            <div key={item.label}>
              <Label className="text-[11px] font-bold">{item.label}</Label>
              <select
                value={item.value}
                onChange={e => item.setter(e.target.value as SupplyStatus)}
                className="mt-1 h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs font-semibold capitalize"
              >
                <option value="available">Available</option>
                <option value="limited">Limited</option>
                <option value="critical">Critical</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#2457FF] px-6 font-extrabold text-white hover:bg-[#1d47db] shadow-md"
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {mode === "create"
            ? isFirstBranch
              ? "Register Hospital & Open Command Desk"
              : "Save Hospital Branch"
            : "Save Branch Updates"}
        </Button>
      </div>
    </form>
  );
}
