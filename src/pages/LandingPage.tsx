import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, AlertTriangle, ChevronRight, Package, Users, BarChart3,
  FlaskConical, Home, MapPin, Crosshair, X, CheckCircle,
  AlertOctagon, Navigation, Loader2, Send, Clock, FileText,
  Thermometer, Droplets, Wind, Mountain, Activity,
  Globe, ChevronDown, Search, Check, Zap,
} from "lucide-react";
import { LANGUAGES, useLanguage } from "../context/LanguageContext";

// ── Constants ─────────────────────────────────────────────────────────

const INDIA_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh",
  "Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh",
  "Jammu & Kashmir","Jharkhand","Karnataka","Kerala","Ladakh",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim",
  "Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand",
  "West Bengal",
];

const STATE_COORDS: Record<string, [number, number]> = {
  "Andhra Pradesh": [15.91, 79.74], "Arunachal Pradesh": [28.22, 94.73],
  "Assam": [26.20, 92.94], "Bihar": [25.10, 85.31], "Chandigarh": [30.73, 76.78],
  "Chhattisgarh": [21.28, 81.87], "Delhi": [28.61, 77.21], "Goa": [15.30, 74.12],
  "Gujarat": [22.26, 71.19], "Haryana": [29.06, 76.09], "Himachal Pradesh": [31.10, 77.17],
  "Jammu & Kashmir": [33.78, 76.58], "Jharkhand": [23.61, 85.28], "Karnataka": [15.32, 75.71],
  "Kerala": [10.85, 76.27], "Ladakh": [34.23, 77.56], "Madhya Pradesh": [22.97, 78.66],
  "Maharashtra": [19.75, 75.71], "Manipur": [24.66, 93.91], "Meghalaya": [25.47, 91.37],
  "Mizoram": [23.16, 92.94], "Nagaland": [26.16, 94.56], "Odisha": [20.95, 85.10],
  "Puducherry": [11.94, 79.81], "Punjab": [31.15, 75.34], "Rajasthan": [27.02, 74.22],
  "Sikkim": [27.53, 88.51], "Tamil Nadu": [11.13, 78.66], "Telangana": [18.11, 79.02],
  "Tripura": [23.94, 91.99], "Uttar Pradesh": [26.85, 80.95], "Uttarakhand": [30.07, 79.02],
  "West Bengal": [22.99, 87.85],
};

const REGION_VILLAGES: Record<string, string[]> = {
  "Bihar": ["Patna North Block", "Muzaffarpur Rural", "Darbhanga East", "Hajipur"],
  "Assam": ["Guwahati East", "Jorhat Block", "Dibrugarh South", "Silchar"],
  "West Bengal": ["Murshidabad North", "Malda Block", "Cooch Behar", "Jalpaiguri"],
  "Odisha": ["Cuttack Rural", "Puri Coastal", "Balasore", "Bhadrak"],
  "Andhra Pradesh": ["Vijayawada Rural", "Rajahmundry East", "Guntur Block", "Eluru"],
  "Kerala": ["Ernakulam Rural", "Thrissur Block", "Alappuzha", "Idukki"],
  "Uttarakhand": ["Tehri Block", "Chamoli Rural", "Pithoragarh", "Rudraprayag"],
  "Himachal Pradesh": ["Mandi Block", "Kullu Rural", "Chamba", "Kinnaur"],
  "default": ["Village Alpha Sector", "Village Beta Block", "Village Gamma Area", "Village Delta"],
};

const INDIA_DISTRICTS: Record<string, string[]> = {
  "Karnataka": ["Belagavi","Bengaluru Urban","Mysuru","Dharwad","Vijayapura","Bagalkot","Kalaburagi","Haveri","Uttara Kannada","Shivamogga","Tumakuru","Raichur","Hassan","Chikkamagaluru","Bidar"],
  "Bihar": ["Patna","Gaya","Bhagalpur","Muzaffarpur","Darbhanga","Purnia","Araria","Supaul","Madhubani","Sitamarhi"],
  "Assam": ["Kamrup","Dibrugarh","Jorhat","Nagaon","Sivasagar","Sonitpur","Cachar","Barpeta","Dhubri","Goalpara"],
  "West Bengal": ["Murshidabad","Malda","North 24 Parganas","South 24 Parganas","Howrah","Hooghly","Cooch Behar","Jalpaiguri","Darjeeling","Bankura"],
  "Odisha": ["Cuttack","Puri","Balasore","Bhadrak","Ganjam","Kendrapara","Jagatsinghpur","Jajpur","Mayurbhanj","Khordha"],
  "Andhra Pradesh": ["Vijayawada","Rajahmundry","Guntur","Eluru","Nellore","Tirupati","Kurnool","Kadapa","Anantapur","Visakhapatnam"],
  "Kerala": ["Ernakulam","Thrissur","Alappuzha","Idukki","Kozhikode","Malappuram","Palakkad","Wayanad","Kannur","Kasaragod"],
  "Uttarakhand": ["Dehradun","Haridwar","Tehri","Chamoli","Pithoragarh","Rudraprayag","Nainital","Almora","Pauri Garhwal","Uttarkashi"],
  "Himachal Pradesh": ["Shimla","Mandi","Kullu","Chamba","Kinnaur","Lahaul and Spiti","Solan","Sirmaur","Una","Hamirpur"],
  "Madhya Pradesh": ["Bhopal","Indore","Jabalpur","Gwalior","Ujjain","Rewa","Satna","Sagar","Dewas","Chhindwara"],
  "Maharashtra": ["Mumbai","Pune","Nagpur","Aurangabad","Nashik","Amravati","Kolhapur","Solapur","Raigad","Ratnagiri"],
  "Gujarat": ["Ahmedabad","Surat","Vadodara","Rajkot","Bhavnagar","Jamnagar","Junagadh","Kutch","Anand","Gandhinagar"],
  "Rajasthan": ["Jaipur","Jodhpur","Udaipur","Kota","Bikaner","Ajmer","Alwar","Bharatpur","Barmer","Jaisalmer"],
  "Uttar Pradesh": ["Lucknow","Kanpur","Agra","Allahabad","Varanasi","Meerut","Gorakhpur","Aligarh","Bareilly","Moradabad"],
  "Tamil Nadu": ["Chennai","Coimbatore","Madurai","Tiruchirappalli","Salem","Tirunelveli","Erode","Vellore","Thoothukudi","Thanjavur"],
  "Telangana": ["Hyderabad","Warangal","Nizamabad","Karimnagar","Khammam","Rangareddy","Nalgonda","Adilabad","Mahbubnagar","Medak"],
};

type RiskLevel = "Low" | "Moderate" | "High" | "N/A";

interface RiskProfile {
  flood: RiskLevel;
  waterlogging: RiskLevel;
  storm: RiskLevel;
  landslide: RiskLevel;
  heatwave: RiskLevel;
}

interface AnalysisResult {
  hasDisaster: boolean;
  disasterType?: string;
  severity?: string;
  affectedAreas?: string[];
  safeRoute?: string;
  risks: RiskProfile;
  simulatedScenario?: string;
  nearbyVillages?: string[];
  estimatedFamilies?: number;
  possibleResources?: string[];
}

function getRisks(state: string): RiskProfile {
  const coastal = ["Andhra Pradesh","Tamil Nadu","Odisha","West Bengal","Kerala","Goa","Maharashtra","Gujarat"];
  const floodProne = ["Bihar","Assam","West Bengal","Odisha","Uttar Pradesh","Kerala","Manipur","Tripura","Jharkhand"];
  const mountainous = ["Himachal Pradesh","Uttarakhand","Arunachal Pradesh","Sikkim","Nagaland","Manipur","Meghalaya","Mizoram","Jammu & Kashmir","Ladakh"];
  const arid = ["Rajasthan","Gujarat","Haryana","Delhi","Punjab"];

  return {
    flood: floodProne.includes(state) ? "High" : coastal.includes(state) ? "Moderate" : "Low",
    waterlogging: (floodProne.includes(state) || coastal.includes(state)) ? "Moderate" : "Low",
    storm: coastal.includes(state) ? "High" : mountainous.includes(state) ? "Low" : "Moderate",
    landslide: mountainous.includes(state) ? "High" : floodProne.includes(state) ? "Moderate" : "N/A",
    heatwave: arid.includes(state) ? "High" : mountainous.includes(state) ? "Low" : "Moderate",
  };
}

function generateScenario(state: string, risks: RiskProfile): string {
  if (risks.flood === "High") return `Heavy rainfall forecast for 48 hours may cause severe flooding across low-lying areas in ${state}. River levels are approaching warning marks.`;
  if (risks.storm === "High") return `Cyclonic conditions forming in the Bay of Bengal may bring strong winds and storm surge to coastal areas of ${state}.`;
  if (risks.heatwave === "High") return `A prolonged heat wave is forecast for ${state} with temperatures expected to exceed 45°C for the next 72 hours.`;
  if (risks.landslide === "High") return `Unstable slopes and recent rainfall in ${state} create conditions favorable for landslides in hilly terrain.`;
  return `Analysis indicates moderate weather-related risk for ${state}. Localized flooding possible during heavy rainfall events.`;
}

function getResources(risks: RiskProfile): string[] {
  const out: string[] = [];
  if (risks.flood === "High" || risks.storm === "High") out.push("Emergency Food Kits", "Clean Drinking Water", "Rescue Boats");
  if (risks.landslide === "High") out.push("Search & Rescue Teams", "Medical Aid");
  if (risks.heatwave === "High") out.push("ORS & Hydration Packs", "Portable Cooling Units");
  if (out.length === 0) out.push("Basic Food Supplies", "First Aid Kits", "Temporary Shelter");
  return out;
}

// ── Step-level components ──────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const { t } = useLanguage();
  const labels = [t("step_location"), t("step_analyzing"), t("step_results"), t("step_sos")];
  return (
    <div className="flex items-center justify-center gap-1 mb-5">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-all ${
            i + 1 < current ? "bg-emerald-500 text-white" :
            i + 1 === current ? "bg-red-500 text-white" :
            "bg-slate-800 text-slate-500"
          }`}>
            {i + 1 < current ? "✓" : i + 1}
          </div>
          <span className={`text-[9px] font-semibold hidden sm:block ${i + 1 === current ? "text-white" : "text-slate-600"}`}>{label}</span>
          {i < labels.length - 1 && <div className={`w-4 h-px mx-0.5 ${i + 1 < current ? "bg-emerald-500" : "bg-slate-700"}`} />}
        </div>
      ))}
    </div>
  );
}

function LocationChoice({ onGPS, onManual }: { onGPS: () => void; onManual: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <p className="text-sm text-slate-300 font-semibold">How would you like to share your location?</p>
        <p className="text-xs text-slate-500 mt-1">We use your location to check for nearby disasters and risks.</p>
      </div>

      <button
        onClick={onGPS}
        className="group w-full min-h-[80px] bg-emerald-950/60 border border-emerald-800/60 hover:border-emerald-500/70 rounded-xl p-4 flex items-center gap-4 text-left transition-all hover:bg-emerald-950/80"
      >
        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-700/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/30 transition-all">
          <Crosshair size={22} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white mb-0.5">{t("lp_use_gps")}</div>
          <div className="text-xs text-slate-400">Automatically detect my location using browser GPS</div>
        </div>
        <ChevronRight size={16} className="text-slate-500 group-hover:text-emerald-400 shrink-0 transition-all" />
      </button>

      <button
        onClick={onManual}
        className="group w-full min-h-[80px] bg-blue-950/40 border border-blue-800/50 hover:border-blue-500/60 rounded-xl p-4 flex items-center gap-4 text-left transition-all hover:bg-blue-950/60"
      >
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-700/50 flex items-center justify-center shrink-0 group-hover:bg-blue-500/30 transition-all">
          <MapPin size={22} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white mb-0.5">{t("lp_manual_entry")}</div>
          <div className="text-xs text-slate-400">Enter your State, District, Village, and Pincode</div>
        </div>
        <ChevronRight size={16} className="text-slate-500 group-hover:text-blue-400 shrink-0 transition-all" />
      </button>
    </div>
  );
}

function GPSGetting({ error, onManual }: { error: string; onManual: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      {!error ? (
        <>
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <Crosshair size={28} className="text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="text-white font-bold text-sm mb-1">{t("lp_gps_detecting")}</p>
            <p className="text-slate-400 text-xs">Please allow location access when prompted by your browser</p>
          </div>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertOctagon size={26} className="text-red-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm mb-1">Location Access Denied</p>
            <p className="text-slate-400 text-xs mb-4 max-w-xs">{error}</p>
            <button
              onClick={onManual}
              className="min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all"
            >
              {t("lp_manual_entry")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ManualForm({
  loc, setLoc, onSubmit,
}: {
  loc: { state: string; district: string; village: string; pincode: string; landmark: string };
  setLoc: (v: typeof loc) => void;
  onSubmit: () => void;
}) {
  const { t } = useLanguage();
  const inputClass = "w-full bg-slate-800/80 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-lg placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all";
  const labelClass = "block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wide";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={labelClass}>{t("lp_state_label")} *</label>
        <select
          value={loc.state}
          onChange={e => setLoc({ ...loc, state: e.target.value })}
          className={`${inputClass} cursor-pointer`}
          style={{ background: "#1e293b" }}
        >
          <option value="">Select State…</option>
          {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t("lp_district_label")} *</label>
        {INDIA_DISTRICTS[loc.state]?.length ? (
          <select
            value={loc.district}
            onChange={e => setLoc({ ...loc, district: e.target.value })}
            className={`${inputClass} cursor-pointer`}
            style={{ background: "#1e293b" }}
          >
            <option value="">Select District…</option>
            {INDIA_DISTRICTS[loc.state].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        ) : (
          <input
            type="text"
            placeholder="e.g. Patna"
            value={loc.district}
            onChange={e => setLoc({ ...loc, district: e.target.value })}
            className={inputClass}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t("lp_village_label")}</label>
          <input
            type="text"
            placeholder="e.g. Hajipur"
            value={loc.village}
            onChange={e => setLoc({ ...loc, village: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t("lp_pincode_label")}</label>
          <input
            type="text"
            placeholder="e.g. 800001"
            value={loc.pincode}
            maxLength={6}
            onChange={e => setLoc({ ...loc, pincode: e.target.value.replace(/\D/g, "") })}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t("lp_landmark_label")} <span className="text-slate-600 normal-case">(Optional)</span></label>
        <input
          type="text"
          placeholder="e.g. Near the river bridge"
          value={loc.landmark}
          onChange={e => setLoc({ ...loc, landmark: e.target.value })}
          className={inputClass}
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={!loc.state || !loc.district}
        className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all mt-1"
      >
        {t("lp_continue_btn")} <ChevronRight size={18} />
      </button>
    </div>
  );
}

function Analyzing() {
  const { t } = useLanguage();
  const ANALYSIS_STEPS = [t("anl_step1"), t("anl_step2"), t("anl_step3"), t("anl_step4"), t("anl_step5")];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIdx(i => Math.min(i + 1, ANALYSIS_STEPS.length - 1)), 700);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
        <div className="absolute inset-0 rounded-full border-4 border-t-amber-400 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Activity size={22} className="text-amber-400" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-white font-bold text-sm mb-3">{t("lp_analyzing_title")}</p>
        <div className="flex flex-col gap-1.5">
          {ANALYSIS_STEPS.map((s, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs transition-all ${i <= idx ? "text-slate-300" : "text-slate-700"}`}>
              {i < idx
                ? <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                : i === idx
                  ? <Loader2 size={12} className="text-amber-400 animate-spin shrink-0" />
                  : <div className="w-3 h-3 rounded-full border border-slate-700 shrink-0" />
              }
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const RISK_COLORS: Record<RiskLevel, { bar: string; badge: string; text: string }> = {
  "High": { bar: "bg-red-500", badge: "bg-red-950/60 text-red-400 border-red-800/60", text: "text-red-400" },
  "Moderate": { bar: "bg-amber-500", badge: "bg-amber-950/60 text-amber-400 border-amber-800/60", text: "text-amber-400" },
  "Low": { bar: "bg-emerald-500", badge: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60", text: "text-emerald-400" },
  "N/A": { bar: "bg-slate-700", badge: "bg-slate-800/60 text-slate-500 border-slate-700/60", text: "text-slate-500" },
};

function RiskBar({ label, level, icon }: { label: string; level: RiskLevel; icon: ReactNode }) {
  const c = RISK_COLORS[level];
  const pct = level === "High" ? 85 : level === "Moderate" ? 55 : level === "Low" ? 20 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-32 shrink-0">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[11px] text-slate-400 font-medium">{label}</span>
      </div>
      <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-bold w-14 text-right ${c.text}`}>{level}</span>
    </div>
  );
}

function Results({
  result, onSOS, stateName,
}: {
  result: AnalysisResult;
  onSOS: () => void;
  stateName: string;
}) {
  const { t } = useLanguage();

  if (result.hasDisaster) {
    return (
      <div className="flex flex-col gap-4">
        {/* Disaster detected banner */}
        <div className="bg-red-950/60 border border-red-700/60 rounded-xl p-4 flex items-start gap-3">
          <AlertOctagon size={22} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-red-400 font-black text-sm mb-0.5">{t("lp_disaster_detected")}</div>
            <div className="text-xs text-red-300">{result.disasterType}</div>
          </div>
          <span className="ml-auto bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shrink-0">{result.severity}</span>
        </div>

        {/* Affected areas */}
        {result.affectedAreas && result.affectedAreas.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-2">{t("lp_nearby_areas")}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.affectedAreas.map(a => (
                <span key={a} className="bg-red-950/50 border border-red-900/50 text-red-300 text-[11px] px-2 py-1 rounded-lg">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Safe route */}
        <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3 flex items-start gap-2">
          <Navigation size={15} className="text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] text-slate-500 font-semibold mb-0.5">{t("lp_safe_route_lbl")}</p>
            <p className="text-xs text-emerald-300">{result.safeRoute}</p>
          </div>
        </div>

        {/* SOS button */}
        <button
          onClick={onSOS}
          className="w-full min-h-[52px] bg-red-600 hover:bg-red-500 text-white font-black text-base rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/50 animate-pulse"
        >
          <Send size={18} />
          {t("lp_submit_sos")}
        </button>
      </div>
    );
  }

  // Simulation mode
  return (
    <div className="flex flex-col gap-4">
      {/* No disaster banner */}
      <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3 flex items-start gap-3">
        <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-emerald-400 font-bold text-sm">{t("lp_no_disaster")}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {t("lp_based_on_sim")}
          </div>
        </div>
      </div>

      {/* Risk analysis */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2.5">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">{t("lp_risk_assessment")} — {stateName || "Your Region"}</p>
        <RiskBar label={t("lp_flood_risk_bar")} level={result.risks.flood} icon={<Droplets size={12} />} />
        <RiskBar label={t("lp_waterlogging")} level={result.risks.waterlogging} icon={<Droplets size={12} />} />
        <RiskBar label={t("lp_storm_risk")} level={result.risks.storm} icon={<Wind size={12} />} />
        <RiskBar label={t("lp_landslide")} level={result.risks.landslide} icon={<Mountain size={12} />} />
        <RiskBar label={t("lp_heatwave")} level={result.risks.heatwave} icon={<Thermometer size={12} />} />
      </div>

      {/* Simulated scenario */}
      {result.simulatedScenario && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3">
          <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide mb-1.5">{t("lp_hypothetical")}</p>
          <p className="text-xs text-amber-200 leading-relaxed">"{result.simulatedScenario}"</p>
        </div>
      )}

      {/* Simulated impact */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
          <div className="text-lg font-black text-white">{(result.nearbyVillages ?? []).length}</div>
          <div className="text-[10px] text-slate-500">{t("lp_areas_risk")}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
          <div className="text-lg font-black text-white">{(result.estimatedFamilies ?? 0).toLocaleString()}</div>
          <div className="text-[10px] text-slate-500">Est. Families</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
          <div className="text-lg font-black text-white">{(result.possibleResources ?? []).length}</div>
          <div className="text-[10px] text-slate-500">Resource Types</div>
        </div>
      </div>

      {/* Possible resources */}
      {result.possibleResources && result.possibleResources.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Possible Resource Requirements</p>
          <div className="flex flex-wrap gap-1.5">
            {result.possibleResources.map(r => (
              <span key={r} className="bg-slate-800 border border-slate-700/60 text-slate-300 text-[11px] px-2.5 py-1 rounded-lg">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* SOS option */}
      <div className="border border-slate-700/50 rounded-xl p-3 flex flex-col gap-2">
        <p className="text-[11px] text-slate-400 text-center">You can still submit an SOS even if no active disaster is detected.</p>
        <button
          onClick={onSOS}
          className="w-full min-h-[48px] bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
        >
          <Send size={16} />
          {t("lp_submit_sos_anyway")}
        </button>
      </div>
    </div>
  );
}

function SOSForm({
  pos, manualState, notes, setNotes, onSubmit, submitting,
}: {
  pos: { lat: number; lng: number } | null;
  manualState: string;
  notes: string;
  setNotes: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const { t } = useLanguage();
  const now = new Date().toLocaleTimeString();
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-red-950/50 border border-red-800/50 rounded-xl p-3">
        <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mb-2">{t("lp_sos_details")}</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin size={12} className="text-red-400" />
            {pos ? `${pos.lat.toFixed(4)}°N, ${pos.lng.toFixed(4)}°E` : manualState || "Unknown"}
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock size={12} className="text-red-400" />
            {now}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
          <span className="flex items-center gap-1"><FileText size={11} /> {t("lp_your_notes")}</span>
        </label>
        <textarea
          placeholder="Describe the emergency situation — number of people stranded, severity, what help is needed..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-slate-800/80 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-lg placeholder-slate-500 focus:outline-none focus:border-red-500 transition-all resize-none"
        />
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full min-h-[52px] bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black text-base rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/50"
      >
        {submitting
          ? <><Loader2 size={18} className="animate-spin" /> Transmitting…</>
          : <><Send size={18} /> {t("lp_confirm_sos_btn")}</>}
      </button>
      <p className="text-[10px] text-slate-600 text-center">Your SOS will be registered in the coordination center and visible on the live map.</p>
    </div>
  );
}

function SOSSuccess({
  result, onClose, onDashboard,
}: {
  result: { calculated_priority?: string; priority_breakdown?: { final_priority_score: number }; inserted_id?: string } | null;
  onClose: () => void;
  onDashboard: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
        <CheckCircle size={32} className="text-emerald-400" />
      </div>
      <div>
        <p className="text-white font-black text-base mb-1">✅ SOS TRANSMITTED</p>
        <p className="text-slate-400 text-xs">Your emergency has been registered in the coordination center.</p>
      </div>
      {result && (
        <div className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 grid grid-cols-2 gap-3 text-left">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Priority</p>
            <p className="text-sm font-black text-red-400">{(result.calculated_priority ?? "CRITICAL").toUpperCase()}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Score</p>
            <p className="text-sm font-black text-white">{result.priority_breakdown?.final_priority_score ?? "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Status</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-emerald-400 font-semibold">NGOs Alerted · Map Marker Created · Aid Dispatching</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-3 w-full">
        <button
          onClick={onClose}
          className="flex-1 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl transition-all"
        >
          Close
        </button>
        <button
          onClick={onDashboard}
          className="flex-1 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all"
        >
          <Activity size={15} />
          View on Dashboard
        </button>
      </div>
    </div>
  );
}

// ── Main modal ──────────────────────────────────────────────────────────

type Step = "location-choice" | "gps-getting" | "manual-form" | "analyzing" | "results" | "sos-form" | "sos-success";

function HelpPortalModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("location-choice");
  const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [manualLoc, setManualLoc] = useState({ state: "", district: "", village: "", pincode: "", landmark: "" });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [sosNotes, setSosNotes] = useState("");
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosResult, setSosResult] = useState<Parameters<typeof SOSSuccess>[0]["result"]>(null);
  const navigate = useNavigate();

  const stepNum = { "location-choice": 1, "gps-getting": 1, "manual-form": 1, "analyzing": 2, "results": 3, "sos-form": 4, "sos-success": 4 }[step] ?? 1;

  function handleGPS() {
    setGpsError("");
    setStep("gps-getting");
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsPos(coord);
        runAnalysis(coord, "");
      },
      (err) => setGpsError(err.message || "Could not detect location. Please use manual entry."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleManualSubmit() {
    const query = [manualLoc.district, manualLoc.village, manualLoc.state, "India"].filter(Boolean).join(", ");
    let pos: { lat: number; lng: number };
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await resp.json();
      if (data && data[0]) {
        pos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      } else {
        const coords = STATE_COORDS[manualLoc.state] ?? [20.5, 78.9];
        pos = { lat: coords[0], lng: coords[1] };
      }
    } catch {
      const coords = STATE_COORDS[manualLoc.state] ?? [20.5, 78.9];
      pos = { lat: coords[0], lng: coords[1] };
    }
    setGpsPos(pos);
    runAnalysis(pos, manualLoc.state);
  }

  async function runAnalysis(pos: { lat: number; lng: number }, state: string) {
    setStep("analyzing");
    // Minimum spinner time
    const delay = new Promise(r => setTimeout(r, 2800));
    try {
      const [analyticsResp, villagesResp] = await Promise.all([
        fetch("/api/v1/analytics").then(r => r.json()).catch(() => ({ critical: 0 })),
        fetch("/api/v1/villages").then(r => r.json()).catch(() => []),
      ]);
      await delay;

      const hasCritical = (analyticsResp.critical ?? 0) > 0;
      const allVillages: { name: string; status: string; needs: string; families: number; priority_breakdown: { final_priority_score: number } }[] = Array.isArray(villagesResp) ? villagesResp : [];
      const critVillages = allVillages.filter(v => v.status === "critical");
      const risks = getRisks(state);

      if (hasCritical && critVillages.length > 0) {
        const worst = critVillages.reduce((a, b) =>
          (a.priority_breakdown?.final_priority_score ?? 0) >= (b.priority_breakdown?.final_priority_score ?? 0) ? a : b
        );
        setAnalysisResult({
          hasDisaster: true,
          disasterType: worst.needs || "Flood / Multi-hazard",
          severity: "CRITICAL",
          affectedAreas: critVillages.slice(0, 4).map(v => v.name),
          safeRoute: "Evacuate to nearest elevated shelter via main highway. Avoid low-lying routes.",
          risks,
          nearbyVillages: critVillages.map(v => v.name),
          estimatedFamilies: critVillages.reduce((acc, v) => acc + (v.families ?? 0), 0),
          possibleResources: getResources(risks),
        });
      } else {
        const villages = (REGION_VILLAGES[state] ?? REGION_VILLAGES["default"]).slice();
        setAnalysisResult({
          hasDisaster: false,
          risks,
          simulatedScenario: generateScenario(state || "your region", risks),
          nearbyVillages: villages,
          estimatedFamilies: Math.floor(Math.random() * 800 + 300),
          possibleResources: getResources(risks),
        });
      }
      setStep("results");
    } catch {
      await delay;
      const risks = getRisks(state);
      const villages = (REGION_VILLAGES[state] ?? REGION_VILLAGES["default"]).slice();
      setAnalysisResult({
        hasDisaster: false,
        risks,
        simulatedScenario: generateScenario(state || "your region", risks),
        nearbyVillages: villages,
        estimatedFamilies: Math.floor(Math.random() * 800 + 300),
        possibleResources: getResources(risks),
      });
      setStep("results");
    }
  }

  async function submitSOS() {
    if (!gpsPos) return;
    setSosSubmitting(true);
    try {
      const r = await fetch("/api/v1/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          village: manualLoc.village || manualLoc.district || "Emergency Location",
          resource: "Emergency Response",
          families: 50,
          priority: "CRITICAL",
          lat: gpsPos.lat,
          lng: gpsPos.lng,
          severity_indicator: 88,
          crowd_verification_count: 4,
          state: manualLoc.state || "Unknown",
          notes: sosNotes,
        }),
      });
      const result = await r.json();
      setSosResult(result);
      setStep("sos-success");
    } catch {
      setSosResult(null);
      setStep("sos-success");
    } finally {
      setSosSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-2xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
              <AlertTriangle size={15} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black text-xs tracking-wide">{t("lp_portal_header")}</p>
              <p className="text-[10px] text-slate-500">ReliefHub · Disaster Response System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4">
          <StepIndicator current={stepNum} />
        </div>

        {/* Content */}
        <div className="px-5 pb-5">
          {step === "location-choice" && <LocationChoice onGPS={handleGPS} onManual={() => setStep("manual-form")} />}
          {step === "gps-getting" && <GPSGetting error={gpsError} onManual={() => setStep("manual-form")} />}
          {step === "manual-form" && (
            <ManualForm loc={manualLoc} setLoc={setManualLoc} onSubmit={handleManualSubmit} />
          )}
          {step === "analyzing" && <Analyzing />}
          {step === "results" && analysisResult && (
            <Results result={analysisResult} onSOS={() => setStep("sos-form")} stateName={manualLoc.state} />
          )}
          {step === "sos-form" && (
            <SOSForm
              pos={gpsPos}
              manualState={manualLoc.state}
              notes={sosNotes}
              setNotes={setSosNotes}
              onSubmit={submitSOS}
              submitting={sosSubmitting}
            />
          )}
          {step === "sos-success" && (
            <SOSSuccess
              result={sosResult}
              onClose={onClose}
              onDashboard={() => navigate("/dashboard")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Animated counter ──────────────────────────────────────────────────

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let frame = 0;
    const total = 55;
    const timer = setInterval(() => {
      frame++;
      const eased = 1 - Math.pow(1 - frame / total, 3);
      setCount(Math.round(target * eased));
      if (frame >= total) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [started, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const IMPACT_STATS = [
  { emoji: "🏘", label: "Villages Protected", value: 2400, suffix: "+", color: "emerald" },
  { emoji: "👨‍👩‍👧", label: "Families Helped", value: 12800, suffix: "+", color: "blue" },
  { emoji: "📦", label: "Resources Delivered", value: 45000, suffix: "+", color: "amber" },
  { emoji: "🤝", label: "NGOs Coordinated", value: 38, suffix: "", color: "violet" },
  { emoji: "⚡", label: "Faster Response", value: 70, suffix: "% faster", color: "red" },
];

const colorMap: Record<string, { card: string; val: string }> = {
  emerald: { card: "border-emerald-800/40 bg-emerald-950/30", val: "text-emerald-400" },
  blue:    { card: "border-blue-800/40 bg-blue-950/30",       val: "text-blue-400"    },
  amber:   { card: "border-amber-800/40 bg-amber-950/30",     val: "text-amber-400"   },
  violet:  { card: "border-violet-800/40 bg-violet-950/30",   val: "text-violet-400"  },
  red:     { card: "border-red-800/40 bg-red-950/30",         val: "text-red-400"     },
};

// ── Static section data ─────────────────────────────────────────────────

const HELP_FEATURES = [
  "🚨 Emergency SOS", "🍽 Request Food", "🏥 Request Medical Help",
  "🌊 Report Flooding", "📍 Share Current Location", "🤝 View Nearby Relief Support",
];

const COORD_FEATURES = [
  "🗺 Live Relief Map", "⚡ Priority Engine", "🤝 NGO Coordination",
  "🔍 Duplicate Aid Detection", "📦 Resource Allocation", "🌦 Weather Radar", "🧭 Route Guidance",
];


// ── Language Dropdown ────────────────────────────────────────────────────

function LanguageDropdown() {
  const { language, setLanguageCode, languageCode } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    setTimeout(() => inputRef.current?.focus(), 60);
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? LANGUAGES.filter(l =>
        l.english.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
      )
    : LANGUAGES;

  const isRTL = (code: string) => ["ur", "ks", "sd"].includes(code);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/16 border border-white/14 hover:border-emerald-400/50 px-3 py-2 rounded-full transition-all backdrop-blur-sm group"
      >
        <Globe size={14} className="text-emerald-400 shrink-0" />
        <span className="text-sm font-bold text-white leading-none" dir={isRTL(languageCode) ? "rtl" : "ltr"}>
          {language.native}
        </span>
        <ChevronDown size={12} className={`text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden backdrop-blur-xl">
          {/* Search bar */}
          <div className="p-3 border-b border-slate-800/80">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search… e.g. Hindi, हिन्दी, Kannada, ಕನ್ನಡ"
                className="w-full bg-slate-800/70 border border-slate-700/50 text-white text-xs placeholder-slate-500 rounded-xl pl-8 pr-3 py-2.5 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Language list */}
          <div className="max-h-72 overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">No languages found</div>
            ) : (
              <>
                {!q && (
                  <div className="px-4 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                    All Languages ({LANGUAGES.length})
                  </div>
                )}
                {filtered.map(lang => {
                  const active = languageCode === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguageCode(lang.code); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/70 transition-colors text-left ${active ? "bg-emerald-500/10" : ""}`}
                    >
                      <span
                        className={`text-base font-black leading-none flex-1 ${active ? "text-emerald-300" : "text-white"}`}
                        dir={isRTL(lang.code) ? "rtl" : "ltr"}
                      >
                        {lang.native}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">{lang.english}</span>
                      {active && <Check size={12} className="text-emerald-400 shrink-0 stroke-[3]" />}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main landing page ────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const HOW_STEPS = [
    { step: "01", icon: <AlertTriangle size={26} className="text-red-400" />, title: t("how_step1_title"), desc: t("how_step1_desc"), accent: "border-red-800/60 bg-red-950/40", dot: "bg-red-500" },
    { step: "02", icon: <BarChart3 size={26} className="text-amber-400" />, title: t("how_step2_title"), desc: t("how_step2_desc"), accent: "border-amber-800/60 bg-amber-950/40", dot: "bg-amber-500" },
    { step: "03", icon: <Users size={26} className="text-blue-400" />, title: t("how_step3_title"), desc: t("how_step3_desc"), accent: "border-blue-800/60 bg-blue-950/40", dot: "bg-blue-500" },
    { step: "04", icon: <Package size={26} className="text-emerald-400" />, title: t("how_step4_title"), desc: t("how_step4_desc"), accent: "border-emerald-800/60 bg-emerald-950/40", dot: "bg-emerald-500" },
  ];

  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {helpOpen && <HelpPortalModal onClose={() => setHelpOpen(false)} />}

      {/* ── FIXED TOP BAR ────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-[990] flex items-center justify-between px-4 sm:px-6 py-3 pointer-events-none">
        {/* Left — Language Selector */}
        <div className="pointer-events-auto">
          <LanguageDropdown />
        </div>

        {/* Right — View Live Demo */}
        <div className="pointer-events-auto flex flex-col items-end gap-1">
          <button
            onClick={() => navigate("/testing")}
            className="relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-2xl font-black text-sm text-slate-950 transition-all duration-200 hover:scale-[1.04] active:scale-100 shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60"
            style={{ background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" }}
          >
            <Zap size={15} className="shrink-0 fill-current" />
            <span className="hidden sm:inline">🚀 View Live Demo</span>
            <span className="sm:hidden">🚀 Demo</span>
            <ChevronRight size={14} className="shrink-0" />
            {/* Glow ring */}
            <span className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400/30 animate-pulse pointer-events-none" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
            {["Disaster Sim", "Critical Villages", "NGO Dispatch", "Route Guidance"].map(tag => (
              <span key={tag} className="text-[9px] font-semibold text-emerald-400/70 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen bg-gradient-to-br from-slate-950 via-[#0a1628] to-slate-950 flex flex-col items-center justify-center px-4 py-16 gap-10 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)`, backgroundSize: "48px 48px" }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/8 rounded-full blur-[100px] pointer-events-none" />

        {/* Brand */}
        <div className="relative flex flex-col items-center text-center gap-5 max-w-2xl">
          <div className="relative">
            <div className="w-20 h-20 rounded-[22px] bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/50">
              <Shield size={38} className="text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 animate-ping opacity-60" />
          </div>
          <div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none mb-3">RELIEFHUB</h1>
            <p className="text-base sm:text-lg font-semibold text-emerald-400 leading-snug mb-4">"Helping Aid Reach The Right Place At The Right Time"</p>
            <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed">AI-powered disaster relief coordination platform that helps citizens, volunteers, NGOs, and emergency teams coordinate aid efficiently.</p>
          </div>
        </div>

        {/* Portal cards */}
        <div className="relative w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* HELP & EMERGENCY */}
          <div className="group border border-red-900/60 bg-gradient-to-br from-red-950/70 to-rose-950/50 rounded-2xl p-6 flex flex-col backdrop-blur-sm hover:border-red-600/70 transition-all duration-300 hover:shadow-xl hover:shadow-red-950/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0 shadow-lg shadow-red-500/40"><AlertTriangle size={19} className="text-white" /></div>
              <div>
                <h2 className="text-sm font-black text-white tracking-wide">{t("lp_help_title")}</h2>
                <p className="text-[10px] text-red-400 font-semibold">{t("lp_help_sub")}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">For citizens, villagers, volunteers, and people affected by disasters.</p>
            <ul className="flex flex-col gap-1.5 mb-5 flex-1">
              {HELP_FEATURES.map(f => <li key={f} className="text-[12px] text-slate-300">{f}</li>)}
            </ul>
            <button
              onClick={() => setHelpOpen(true)}
              className="w-full min-h-[48px] bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-red-900/50"
            >
              {t("get_help")} <ChevronRight size={18} />
            </button>
          </div>

          {/* COORDINATION CENTER */}
          <div className="group border border-blue-900/60 bg-gradient-to-br from-blue-950/70 to-slate-900/70 rounded-2xl p-6 flex flex-col backdrop-blur-sm hover:border-blue-600/70 transition-all duration-300 hover:shadow-xl hover:shadow-blue-950/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/40"><BarChart3 size={19} className="text-white" /></div>
              <div>
                <h2 className="text-sm font-black text-white tracking-wide">{t("lp_coord_title")}</h2>
                <p className="text-[10px] text-blue-400 font-semibold">{t("lp_coord_sub")}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">For relief organizations coordinating disaster response.</p>
            <ul className="flex flex-col gap-1.5 mb-5 flex-1">
              {COORD_FEATURES.map(f => <li key={f} className="text-[12px] text-slate-300">{f}</li>)}
            </ul>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-blue-900/50"
            >
              {t("coord_center")} <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Demo CTA */}
        <div className="relative flex flex-col items-center gap-2">
          <button
            onClick={() => navigate("/testing")}
            className="flex items-center gap-2.5 min-h-[52px] bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-base px-8 py-3.5 rounded-2xl transition-all duration-200 shadow-2xl shadow-emerald-500/40 hover:scale-[1.02]"
          >
            <FlaskConical size={20} />
            {t("view_demo")}
          </button>
          <p className="text-xs text-slate-500">Instantly load a flood disaster simulation — no setup required</p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce opacity-40">
          <div className="w-px h-8 bg-slate-500" />
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">How it works</p>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="bg-[#080e1a] py-16 sm:py-20 px-4 border-t border-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">{t("how_title").toUpperCase()}</h2>
            <p className="text-sm text-slate-400">From emergency to aid delivery in minutes</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
            {HOW_STEPS.map((item, i) => (
              <div key={i} className="relative flex flex-col">
                <div className={`border ${item.accent} rounded-2xl p-5 flex flex-col gap-3 flex-1`}>
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800">{item.icon}</div>
                    <span className="text-4xl font-black text-slate-800 leading-none">{item.step}</span>
                  </div>
                  <h3 className="text-[13px] font-bold text-white leading-snug">{item.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed flex-1">{item.desc}</p>
                  {i < HOW_STEPS.length - 1 && (
                    <div className="lg:hidden flex justify-center pt-1">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${item.dot}`} />
                        <div className="w-px h-4 bg-slate-700" />
                      </div>
                    </div>
                  )}
                </div>
                {i < HOW_STEPS.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full items-center justify-center shadow-md">
                    <ChevronRight size={13} className="text-slate-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── IMPACT SECTION ──────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#070d1a] to-slate-950 py-16 sm:py-20 px-4 border-t border-slate-800/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Platform Impact
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              {t("impact_title").toUpperCase()}
            </h2>
            <p className="text-sm text-slate-400">{t("impact_subtitle")}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {IMPACT_STATS.map((s) => {
              const c = colorMap[s.color];
              return (
                <div key={s.label} className={`border ${c.card} rounded-2xl p-5 flex flex-col gap-2 text-center backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300`}>
                  <div className="text-2xl">{s.emoji}</div>
                  <div className={`text-2xl sm:text-3xl font-black ${c.val} leading-none`}>
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium leading-tight">{s.label}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-600">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Figures based on simulation capacity modelling and platform analytics
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
      <section className="bg-slate-950 py-12 px-4 border-t border-slate-800/50">
        <div className="max-w-xl mx-auto text-center flex flex-col items-center gap-5">
          <div className="flex items-center gap-2.5">
            <img src="/reliefhub-logo.png" alt="ReliefHub" className="w-10 h-10 object-contain" />
            <span className="text-xl font-black text-white tracking-tight">
              Relief<span className="text-emerald-400">Hub</span>
            </span>
          </div>
          <p className="text-sm text-slate-400">AI-powered disaster relief coordination for everyone</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 min-h-[44px] bg-white/10 hover:bg-white/15 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all">
              <Home size={16} /> Dashboard
            </button>
            <button onClick={() => navigate("/testing")} className="flex items-center gap-2 min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-6 py-2.5 rounded-xl transition-all">
              <FlaskConical size={16} /> Live Demo
            </button>
          </div>
          <p className="text-[11px] text-slate-700">Hackathon MVP · Built for rapid disaster response</p>
        </div>
      </section>
    </div>
  );
}
