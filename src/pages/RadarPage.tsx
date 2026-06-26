import { useState, useEffect } from "react";
import {
  Cloud, Wind, Thermometer, Droplets, AlertTriangle, Activity,
  RefreshCw, MapPin, Radio, Zap, Shield, AlertOctagon
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface WeatherData {
  rainfall_mm: number;
  wind_speed_kmh: number;
  temperature_c: number;
  wind_gusts_kmh: number;
  flood_risk: "Low" | "Moderate" | "High" | "Extreme";
  storm_intensity: "Calm" | "Moderate" | "Severe" | "Extreme";
  weather_alert: string;
  alert_level: "green" | "yellow" | "orange" | "red";
  fetched_at: string;
}

const MOCK_DATA: WeatherData = {
  rainfall_mm: 87.4,
  wind_speed_kmh: 64,
  temperature_c: 32.1,
  wind_gusts_kmh: 112,
  flood_risk: "High",
  storm_intensity: "Severe",
  weather_alert: "active_storm",
  alert_level: "orange",
  fetched_at: new Date().toLocaleString(),
};

type AlertKey = "red" | "orange" | "yellow" | "green";
type AlertMsgKey = "extreme" | "storm" | "watch" | "clear";

function deriveInsights(data: {
  precipitation_sum: number;
  windspeed_10m_max: number;
  temperature_2m_max: number;
  windgusts_10m_max: number;
}): Omit<WeatherData, "weather_alert"> & { alert_msg_key: AlertMsgKey } {
  const rain = data.precipitation_sum;
  const wind = data.windspeed_10m_max;
  const gusts = data.windgusts_10m_max;
  const temp = data.temperature_2m_max;

  const floodRisk: WeatherData["flood_risk"] =
    rain > 100 ? "Extreme" : rain > 50 ? "High" : rain > 20 ? "Moderate" : "Low";

  const stormIntensity: WeatherData["storm_intensity"] =
    gusts > 120 ? "Extreme" : gusts > 80 ? "Severe" : gusts > 40 ? "Moderate" : "Calm";

  let alertLevel: AlertKey = "green";
  let alertMsgKey: AlertMsgKey = "clear";

  if (rain > 80 || gusts > 100) {
    alertLevel = "red";
    alertMsgKey = "extreme";
  } else if (rain > 40 || gusts > 70) {
    alertLevel = "orange";
    alertMsgKey = "storm";
  } else if (rain > 15 || gusts > 40) {
    alertLevel = "yellow";
    alertMsgKey = "watch";
  }

  return {
    rainfall_mm: rain,
    wind_speed_kmh: wind,
    temperature_c: temp,
    wind_gusts_kmh: gusts,
    flood_risk: floodRisk,
    storm_intensity: stormIntensity,
    alert_level: alertLevel,
    alert_msg_key: alertMsgKey,
    fetched_at: new Date().toLocaleString(),
  };
}

function RadarSweep({ alertLevel }: { alertLevel: WeatherData["alert_level"] }) {
  const sweepColor = alertLevel === "red" ? "#EF4444" : alertLevel === "orange" ? "#F97316" : alertLevel === "yellow" ? "#EAB308" : "#22C55E";
  const ringColor = alertLevel === "red" ? "rgba(239,68,68,0.15)" : alertLevel === "orange" ? "rgba(249,115,22,0.15)" : alertLevel === "yellow" ? "rgba(234,179,8,0.12)" : "rgba(34,197,94,0.12)";

  return (
    <div className="relative w-44 h-44 mx-auto shrink-0">
      <svg className="w-full h-full" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="96" fill="none" stroke={ringColor} strokeWidth="1.5" />
        <circle cx="100" cy="100" r="68" fill="none" stroke={ringColor} strokeWidth="1" />
        <circle cx="100" cy="100" r="40" fill="none" stroke={ringColor} strokeWidth="1" />
        <line x1="100" y1="4" x2="100" y2="196" stroke={ringColor} strokeWidth="0.8" />
        <line x1="4" y1="100" x2="196" y2="100" stroke={ringColor} strokeWidth="0.8" />
        <line x1="32" y1="32" x2="168" y2="168" stroke={ringColor} strokeWidth="0.5" />
        <line x1="168" y1="32" x2="32" y2="168" stroke={ringColor} strokeWidth="0.5" />
        <g className="animate-spin" style={{ transformOrigin: "100px 100px", animationDuration: "4s", animationTimingFunction: "linear" }}>
          <path d="M100,100 L100,4 A96,96 0 0,1 196,100 Z" fill={`url(#sweep-${alertLevel})`} opacity="0.7" />
          <line x1="100" y1="100" x2="100" y2="4" stroke={sweepColor} strokeWidth="1.5" opacity="0.9" />
        </g>
        <defs>
          <radialGradient id={`sweep-${alertLevel}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={sweepColor} stopOpacity="0.5" />
            <stop offset="70%" stopColor={sweepColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={sweepColor} stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full animate-pulse" style={{ background: sweepColor, boxShadow: `0 0 12px 4px ${sweepColor}60` }} />
    </div>
  );
}

const ALERT_THEME = {
  red:    { border: "border-red-500/50",    bg: "bg-red-950/60",     text: "text-red-300",    badge: "bg-red-500 text-white",    glow: "shadow-red-500/20"    },
  orange: { border: "border-orange-500/50", bg: "bg-orange-950/50",  text: "text-orange-300", badge: "bg-orange-500 text-white", glow: "shadow-orange-500/20" },
  yellow: { border: "border-amber-500/40",  bg: "bg-amber-950/40",   text: "text-amber-300",  badge: "bg-amber-500 text-white",  glow: "shadow-amber-500/20"  },
  green:  { border: "border-emerald-500/30",bg: "bg-emerald-950/30", text: "text-emerald-300",badge: "bg-emerald-600 text-white", glow: "shadow-emerald-500/20"},
};

const RISK_BADGE: Record<string, string> = {
  Low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Moderate: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  High: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Extreme: "bg-red-500/20 text-red-400 border-red-500/30",
  Calm: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Severe: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  iconBg: string;
  subtext?: string;
  badge?: string;
  badgeClass?: string;
}

function MetricCard({ label, value, unit, icon, iconBg, subtext, badge, badgeClass }: MetricCardProps) {
  return (
    <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 flex flex-col gap-3 backdrop-blur-sm hover:border-slate-600/60 transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-3xl font-black text-white">{value}</div>
        {unit && <div className="text-sm text-slate-500 font-medium">{unit}</div>}
      </div>
      {badge && (
        <div className={`self-start inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
          {badge}
        </div>
      )}
      {subtext && <div className="text-[10px] text-slate-500">{subtext}</div>}
    </div>
  );
}

export default function RadarPage() {
  const { t } = useLanguage();
  const [weather, setWeather] = useState<(Omit<WeatherData, "weather_alert"> & { alert_msg_key: AlertMsgKey }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  async function fetchWeather() {
    setLoading(true);
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=20.0&longitude=78.5" +
        "&daily=temperature_2m_max,precipitation_sum,windspeed_10m_max,windgusts_10m_max" +
        "&timezone=Asia%2FKolkata&forecast_days=1";
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json();
      const daily = data.daily;
      const insights = deriveInsights({
        precipitation_sum: daily.precipitation_sum?.[0] ?? 0,
        windspeed_10m_max: daily.windspeed_10m_max?.[0] ?? 0,
        temperature_2m_max: daily.temperature_2m_max?.[0] ?? 30,
        windgusts_10m_max: daily.windgusts_10m_max?.[0] ?? 0,
      });
      setWeather(insights);
      setUsingMock(false);
    } catch {
      const { weather_alert: _unused, ...rest } = MOCK_DATA;
      void _unused;
      setWeather({ ...rest, alert_msg_key: "storm", fetched_at: new Date().toLocaleString() });
      setUsingMock(true);
    } finally {
      setLoading(false);
      setLastRefresh(new Date().toLocaleTimeString());
    }
  }

  useEffect(() => { fetchWeather(); }, []);

  const alertMessages: Record<AlertMsgKey, string> = {
    extreme: "⚠ " + t("alert_emergency") + " — Immediate evacuation recommended for low-lying areas.",
    storm: t("alert_storm") + " — Coastal and riverside areas on high alert.",
    watch: t("alert_watch") + " — Monitor conditions. Pre-position relief supplies.",
    clear: t("alert_clear") + " — No significant weather alerts. Conditions nominal.",
  };

  const alertLabels: Record<AlertKey, string> = {
    red:    "🔴 " + t("alert_emergency"),
    orange: "🟠 " + t("alert_storm"),
    yellow: "🟡 " + t("alert_watch"),
    green:  "🟢 " + t("alert_clear"),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#080e1a] to-slate-950 p-4 lg:p-6 flex flex-col gap-5">
      {/* Header */}
      <header className="bg-slate-900/80 border border-slate-700/60 px-5 py-4 rounded-2xl shadow-xl backdrop-blur-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-500/20 border border-blue-500/30 p-3 rounded-xl">
            <Radio size={22} className="text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-black text-white tracking-tight">{t("radar_portal")}</div>
            <div className="text-[11px] text-slate-400">
              {t("radar_subtitle")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {usingMock && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-3 py-1.5 rounded-full">
              {t("scenario_mode_badge")}
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[10px] font-bold text-blue-400">{t("radar_scanning")}</span>
          </div>
          <button
            onClick={fetchWeather}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all disabled:opacity-50 border border-white/10"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            {t("refresh_btn")}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-900 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
            <div className="text-sm text-slate-400 font-medium">{t("radar_loading")}</div>
          </div>
        </div>
      ) : weather ? (
        <>
          {/* Alert + Radar hero */}
          {(() => {
            const theme = ALERT_THEME[weather.alert_level];
            return (
              <div className={`border ${theme.border} ${theme.bg} rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center gap-6`}>
                <RadarSweep alertLevel={weather.alert_level} />
                <div className="flex-1 text-center sm:text-left">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${theme.badge} mb-3`}>
                    {alertLabels[weather.alert_level]}
                  </div>
                  <div className={`text-base font-bold ${theme.text} mb-2`}>
                    {alertMessages[weather.alert_msg_key]}
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center sm:justify-start text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><MapPin size={10} /> Central India Region</span>
                    {lastRefresh && <span className="flex items-center gap-1">⟳ {lastRefresh}</span>}
                    {usingMock && <span className="flex items-center gap-1"><Shield size={10} /> {t("scenario_mode_badge")}</span>}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Weather metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <MetricCard
              label={t("rainfall")}
              value={weather.rainfall_mm.toFixed(1)}
              unit="mm"
              icon={<Droplets size={16} className="text-blue-400" />}
              iconBg="bg-blue-500/15 border border-blue-500/20"
              subtext="24-hour precipitation total"
              badge={weather.rainfall_mm > 60 ? t("heavy_rain") : weather.rainfall_mm > 20 ? t("moderate_rain_lbl") : t("light_rain")}
              badgeClass={weather.rainfall_mm > 60 ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-sky-500/20 text-sky-400 border-sky-500/30"}
            />
            <MetricCard
              label={t("wind_speed_lbl")}
              value={weather.wind_speed_kmh.toFixed(0)}
              unit="km/h"
              icon={<Wind size={16} className="text-violet-400" />}
              iconBg="bg-violet-500/15 border border-violet-500/20"
              subtext="10m sustained wind"
            />
            <MetricCard
              label={t("temperature_lbl")}
              value={weather.temperature_c.toFixed(1)}
              unit="°C"
              icon={<Thermometer size={16} className="text-orange-400" />}
              iconBg="bg-orange-500/15 border border-orange-500/20"
              subtext="Max daily temperature"
              badge={weather.temperature_c > 38 ? t("extreme_heat") : weather.temperature_c > 33 ? t("high_heat") : t("normal_temp")}
              badgeClass={weather.temperature_c > 38 ? "bg-red-500/20 text-red-400 border-red-500/30" : weather.temperature_c > 33 ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}
            />
            <MetricCard
              label={t("flood_risk_lbl")}
              value={weather.flood_risk}
              icon={<Activity size={16} className="text-red-400" />}
              iconBg="bg-red-500/15 border border-red-500/20"
              subtext="Derived from precipitation data"
              badge={weather.flood_risk}
              badgeClass={RISK_BADGE[weather.flood_risk]}
            />
            <MetricCard
              label={t("storm_intensity_lbl")}
              value={weather.storm_intensity}
              icon={<Zap size={16} className="text-amber-400" />}
              iconBg="bg-amber-500/15 border border-amber-500/20"
              subtext="Based on wind gust analysis"
              badge={weather.storm_intensity}
              badgeClass={RISK_BADGE[weather.storm_intensity]}
            />
            <MetricCard
              label={t("wind_gusts")}
              value={weather.wind_gusts_kmh.toFixed(0)}
              unit="km/h"
              icon={<Cloud size={16} className="text-slate-400" />}
              iconBg="bg-slate-600/30 border border-slate-600/30"
              subtext="Peak gust speed recorded"
            />
          </div>

          {/* Situation Assessment */}
          <div className="bg-slate-900/70 border border-slate-700/60 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-violet-500/15 border border-violet-500/30 p-2 rounded-lg">
                <AlertOctagon size={15} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t("situation_assessment")}</h3>
                <p className="text-[10px] text-slate-400">AI-derived relief implications from current weather pattern</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="bg-blue-950/50 border border-blue-800/40 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Droplets size={13} className="text-blue-400" />
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{t("flood_vulnerability")}</div>
                </div>
                <div className="text-xs text-blue-200/70 leading-relaxed">
                  {weather.rainfall_mm > 60
                    ? "High risk of flash flooding. Pre-position boats and water rescue equipment. Evacuate riverside villages immediately."
                    : weather.rainfall_mm > 20
                    ? "Moderate rainfall — monitor drainage capacity. Alert NGOs for potential flooding in low-lying areas."
                    : "Low flood risk currently. Continue standard supply operations."}
                </div>
              </div>
              <div className="bg-violet-950/50 border border-violet-800/40 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Wind size={13} className="text-violet-400" />
                  <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">{t("supply_route_impact")}</div>
                </div>
                <div className="text-xs text-violet-200/70 leading-relaxed">
                  {weather.wind_gusts_kmh > 80
                    ? "Severe wind gusts. Ground transport only — suspend air drops. Expect 24–48 hour delivery delays."
                    : weather.wind_gusts_kmh > 40
                    ? "Moderate wind conditions. Helicopter operations restricted to essential-only. Road transport advised."
                    : "Favorable conditions for all supply chain operations. Full logistics capacity available."}
                </div>
              </div>
              <div className="bg-orange-950/50 border border-orange-800/40 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Thermometer size={13} className="text-orange-400" />
                  <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">{t("health_risk_lbl")}</div>
                </div>
                <div className="text-xs text-orange-200/70 leading-relaxed">
                  {weather.temperature_c > 38
                    ? "Extreme heat alert. Prioritize water delivery and heat illness prevention. Restrict outdoor activity to early morning."
                    : weather.temperature_c > 33
                    ? "High temperature conditions. Increase water and ORS delivery. Monitor for heat exhaustion among relief workers."
                    : "Temperature within normal range. Standard health protocols apply."}
                </div>
              </div>
            </div>
          </div>

          {/* Data source footer */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3 flex items-center gap-2 text-[11px] text-slate-500">
            <MapPin size={11} className="text-blue-500 shrink-0" />
            <span>
              <strong className="text-slate-400">Data Source:</strong>{" "}
              {usingMock ? "Scenario mock data (Open-Meteo API unavailable)" : "Open-Meteo API — Real-time forecast data · Central India"}
              {lastRefresh && ` · ${t("refresh_btn")}: ${lastRefresh}`}
            </span>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-20">
          <AlertTriangle size={24} className="text-slate-600" />
        </div>
      )}
    </div>
  );
}
