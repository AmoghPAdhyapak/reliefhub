import { useState, useEffect, useRef, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SplashScreen from "./components/SplashScreen";
import {
  Shield, MapPin, AlertTriangle, CheckCircle, CircleDot, Send,
  ChevronRight, Package, Users, HeartPulse, Droplets, Tent,
  Thermometer, TrendingUp, Activity, BarChart3, Info, X, ChevronDown,
  Clock, FileText, Megaphone, ArrowRight, AlertOctagon, CircleCheck,
  Layers, Radio, Navigation, Crosshair, Target, Route, MapPinned,
  Maximize2, Minimize2, List, Filter, FlaskConical, RefreshCcw, Zap, Bell, Printer
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import { Routes, Route as RRRoute } from "react-router-dom";
import NavBar from "./components/NavBar";
import RadarPage from "./pages/RadarPage";
import LandingPage from "./pages/LandingPage";
import LanguageSelectScreen from "./pages/LanguageSelectScreen";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";

const queryClient = new QueryClient();

// ── API helpers ───────────────────────────────────────────────────────
const API_BASE = "/api/v1";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Report Generator ──────────────────────────────────────────────────
function buildReportHtml(d: Record<string, unknown>): string {
  function esc(v: unknown): string {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  const safeStatus = (s: unknown) => {
    const allowed = ["critical", "moderate", "covered"];
    const v = String(s ?? "");
    return allowed.includes(v) ? v : "unknown";
  };

  const statusColor: Record<string, string> = { critical: "#DC2626", moderate: "#D97706", covered: "#059669" };
  const supplyKeys = ["food_kits", "medicines", "water", "blankets", "tents"];
  const supplyLabels: Record<string, string> = { food_kits: "Food Kits", medicines: "Medicines", water: "Clean Water", blankets: "Blankets", tents: "Tents" };
  const villages = (d.villages as Record<string, unknown>[]) ?? [];
  const supply = (d.supply as Record<string, Record<string, number>>) ?? {};
  const activities = (d.activities as Record<string, unknown>[]) ?? [];
  const kpis = (d.dashboard as Record<string, number>) ?? {};
  const analytics = (d.analytics as Record<string, number>) ?? {};
  const rec = d.top_recommendation as Record<string, unknown> | null;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ReliefHub Situation Report — ${esc(d.generated_at)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#1e293b;padding:32px;max-width:900px;margin:0 auto;font-size:13px}
.print-btn{display:inline-flex;align-items:center;gap:8px;background:#1e3a5f;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:24px}
.print-btn:hover{background:#1e40af}
@media print{.no-print{display:none!important}body{padding:8mm}}
.report-header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px}
.report-title{font-size:22px;font-weight:800;color:#1e3a5f;letter-spacing:-0.5px}
.report-sub{font-size:11px;color:#64748b;margin-top:2px}
.report-meta{text-align:right;font-size:10px;color:#64748b;line-height:1.8}
.report-meta strong{color:#1e293b;font-size:12px;display:block}
.section{margin-bottom:26px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin-bottom:10px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.kpi-card{border:1px solid #e2e8f0;border-radius:8px;padding:12px}
.kpi-value{font-size:22px;font-weight:800;color:#1e293b}
.kpi-label{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;margin-top:2px}
.kpi-card.critical{border-color:#fecaca;background:#fef2f2}.kpi-card.critical .kpi-value{color:#dc2626}
.kpi-card.covered{border-color:#a7f3d0;background:#f0fdf4}.kpi-card.covered .kpi-value{color:#059669}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f1f5f9;text-align:left;padding:7px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b}
td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
tr:last-child td{border-bottom:none}
.badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
.badge-critical{background:#fee2e2;color:#991b1b}.badge-moderate{background:#fef3c7;color:#92400e}.badge-covered{background:#d1fae5;color:#065f46}
.supply-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.supply-label{width:90px;font-size:11px;font-weight:600;color:#1e293b;flex-shrink:0}
.supply-bar-wrap{flex:1;height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;display:flex}
.supply-nums{font-size:10px;color:#64748b;width:130px;flex-shrink:0;text-align:right}
.supply-legend{display:flex;gap:14px;margin-bottom:10px;font-size:10px;color:#64748b}
.dot{width:9px;height:9px;border-radius:2px;display:inline-block;margin-right:4px;vertical-align:middle}
.rec-box{border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:14px}
.rec-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#1d4ed8;margin-bottom:6px}
.rec-village{font-size:18px;font-weight:800;color:#1e293b}
.rec-detail{font-size:11px;color:#475569;margin-top:4px}
.rec-score{display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:8px}
.act-row{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #f1f5f9;align-items:flex-start}
.act-row:last-child{border-bottom:none}
.act-time{font-size:9px;color:#94a3b8;width:75px;flex-shrink:0;padding-top:1px}
.act-actor{font-size:10px;font-weight:700;color:#1e3a5f;width:130px;flex-shrink:0}
.act-body{flex:1;font-size:10px;color:#475569}
.act-action{font-weight:600;color:#1e293b}
.footer{margin-top:24px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨&nbsp; Print / Save as PDF</button>
<div class="report-header">
  <div>
    <div class="report-title">🛡 ReliefHub Situation Report</div>
    <div class="report-sub">AI-Powered Disaster Relief Coordination Platform</div>
  </div>
  <div class="report-meta">
    <strong>OPERATIONAL BRIEFING</strong>
    Generated: ${esc(d.generated_at)}<br>
    Active sectors: ${analytics.total ?? 0}&nbsp;&nbsp;|&nbsp;&nbsp;Status: LIVE
  </div>
</div>
<div class="section">
  <div class="section-title">Operational Summary</div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-value">${kpis.villages_affected ?? 0}</div><div class="kpi-label">Villages Affected</div></div>
    <div class="kpi-card"><div class="kpi-value">${(kpis.families_helped ?? 0).toLocaleString()}</div><div class="kpi-label">Families Assisted</div></div>
    <div class="kpi-card critical"><div class="kpi-value">${analytics.critical ?? 0}</div><div class="kpi-label">Critical Sectors</div></div>
    <div class="kpi-card covered"><div class="kpi-value">${analytics.covered ?? 0}</div><div class="kpi-label">Sectors Covered</div></div>
  </div>
</div>
<div class="section">
  <div class="section-title">Village Priority Registry (${villages.length} active sector${villages.length !== 1 ? "s" : ""})</div>
  <table><thead><tr><th>#</th><th>Village / Sector</th><th>State</th><th>Status</th><th>Priority</th><th>Families</th><th>Aid %</th><th>Need</th><th>NGO Assigned</th></tr></thead>
  <tbody>${villages.length === 0
    ? `<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:20px">No active villages registered</td></tr>`
    : villages.map((v, i) => {
        const status = safeStatus(v.status);
        const pct = Number(v.aid_received ?? 0);
        const color = statusColor[status] ?? "#1e293b";
        const ngo = v.assigned_ngo ? `✓ ${esc(v.assigned_ngo)}` : "—";
        const ngoColor = v.assigned_ngo ? "#059669" : "#94a3b8";
        return `<tr>
          <td style="color:#94a3b8;font-size:10px">${i + 1}</td>
          <td style="font-weight:700">${esc(v.name)}</td>
          <td style="color:#475569">${esc(v.state)}</td>
          <td><span class="badge badge-${status}">${status.toUpperCase()}</span></td>
          <td style="font-weight:700;color:${color}">${Number(v.priority_score ?? 0)}</td>
          <td>${Number(v.families ?? 0).toLocaleString()}</td>
          <td><div style="display:flex;align-items:center;gap:5px"><div style="width:48px;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden"><div style="width:${Math.min(pct, 100)}%;height:100%;background:${color}"></div></div><span style="font-size:10px">${pct}%</span></div></td>
          <td style="color:#475569;font-size:11px">${esc(v.needs)}</td>
          <td style="font-size:10px;color:${ngoColor}">${ngo}</td>
        </tr>`;
      }).join("")
  }</tbody></table>
</div>
<div class="section">
  <div class="section-title">Supply Tracking</div>
  <div class="supply-legend"><span><span class="dot" style="background:#059669"></span>Delivered</span><span><span class="dot" style="background:#3b82f6"></span>In Transit</span></div>
  ${supplyKeys.map(k => {
    const item = supply[k] ?? { total: 0, in_transit: 0, delivered: 0 };
    const total = item.total || 1;
    const dp = Math.round((item.delivered / total) * 100);
    const tp = Math.round((item.in_transit / total) * 100);
    return `<div class="supply-row"><div class="supply-label">${supplyLabels[k]}</div><div class="supply-bar-wrap"><div style="width:${dp}%;height:100%;background:#059669"></div><div style="width:${tp}%;height:100%;background:#3b82f6"></div></div><div class="supply-nums">${item.delivered}/${item.total} delivered · ${item.in_transit} transit</div></div>`;
  }).join("")}
</div>
<div class="section">
  <div class="section-title">AI Priority Engine Recommendation</div>
  ${rec ? `<div class="rec-box"><div class="rec-label">Priority Engine Directive</div><div style="display:flex;align-items:baseline;gap:10px"><span class="rec-score">Score ${Number(rec.priority_score ?? 0)}</span><span class="rec-village">${esc(rec.village)}</span></div><div class="rec-detail">${Number(rec.families ?? 0).toLocaleString()} families affected &nbsp;·&nbsp; Aid received: ${Number(rec.aid_received ?? 0)}% &nbsp;·&nbsp; Immediate need: ${esc(rec.needs)}</div><div class="rec-detail" style="margin-top:6px;font-style:italic">Recommendation: Route all pending supply drops and NGO dispatch to ${esc(rec.village)} to address critical resource gap. Priority Engine confidence: HIGH.</div></div>`
    : `<div style="color:#94a3b8;font-size:12px">No active villages — no recommendation available.</div>`}
</div>
<div class="section">
  <div class="section-title">Activity Log (last ${activities.length} entries)</div>
  ${activities.length === 0
    ? `<div style="color:#94a3b8;font-size:12px">No activity recorded.</div>`
    : activities.map((a: Record<string, unknown>) => `<div class="act-row"><div class="act-time">${esc(a.timestamp)}</div><div class="act-actor">${esc(a.actor)}</div><div class="act-body"><span class="act-action">${esc(a.action)}</span>${a.village && a.village !== "—" ? ` · ${esc(a.village)}` : ""}${a.details ? `<br><span style="color:#94a3b8">${esc(a.details)}</span>` : ""}</div></div>`).join("")}
</div>
<div class="footer"><span>ReliefHub · AI-Powered Disaster Relief Coordination Platform</span><span>Generated ${esc(d.generated_at)} · CONFIDENTIAL — For Operational Use Only</span></div>
</body></html>`;
}

// ── Types ─────────────────────────────────────────────────────────────
interface PriorityBreakdown {
  geographical_score: number;
  volunteer_report_score: number;
  ngo_report_score: number;
  crowd_verification_score: number;
  disaster_severity_score: number;
  previous_aid_impact: number;
  final_priority_score: number;
  classification: string;
}

interface Village {
  id: string;
  name: string;
  status: "critical" | "moderate" | "covered";
  needs: string;
  families: number;
  metrics: string;
  trackingDemand: string;
  position: { lat: number; lng: number };
  aid_received: number;
  severity_score: number;
  need_score: number;
  state: string;
  priority_breakdown: PriorityBreakdown;
  source?: string;
  completed?: boolean;
  assigned_ngo?: NgoData;
  delivery_status?: string;
  route_info?: RouteInfo;
}

interface NgoData {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  city: string;
  state: string;
  specialty: string;
}

interface NgoWithDistance extends NgoData {
  resources: string[];
  capacity: number;
  current_assignments: number;
  distance_km: number;
  eta_hours: number;
  workload_percent: number;
}

interface RouteInfo {
  distance_km: number;
  eta_hours: number;
  road_status: string;
  ngo_lat: number;
  ngo_lng: number;
}

interface DashboardData {
  villages_affected: number;
  families_helped: number;
  active_ngos: number;
  items_delivered: number;
}

interface SupplyData {
  food_kits: { total: number; in_transit: number; delivered: number };
  medicines: { total: number; in_transit: number; delivered: number };
  water: { total: number; in_transit: number; delivered: number };
  blankets: { total: number; in_transit: number; delivered: number };
  tents: { total: number; in_transit: number; delivered: number };
}

interface ChatResponse {
  response: string;
}

interface DuplicateResponse {
  duplicate: boolean;
  message: string;
  suggested_village?: string;
  priority_breakdown?: PriorityBreakdown;
}

interface SosResponse {
  success: boolean;
  message: string;
  inserted_id: string;
  calculated_priority: string;
  priority_breakdown: PriorityBreakdown;
}

interface AnalyticsData {
  critical: number;
  moderate: number;
  covered: number;
  total: number;
}

interface SosMarker {
  id: string;
  lat: number;
  lng: number;
  village: string;
  timestamp: string;
  families: number;
}

interface NgoCheckin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  last_checkin: number;
}

interface ActivityItem {
  timestamp: string;
  actor: string;
  action: string;
  village: string;
  details: string;
}

interface ActivitiesResponse {
  activities: ActivityItem[];
}

interface TestingVillagesResponse {
  simulation_mode: boolean;
  scenario: string;
  villages: Village[];
  sos_queue?: Village[];
}

// ── Status helpers ────────────────────────────────────────────────────
const statusColors = {
  critical: "bg-red-500 text-white",
  moderate: "bg-amber-500 text-white",
  covered: "bg-emerald-500 text-white",
};

const statusBgColors = {
  critical: "bg-red-50 border-red-200 text-red-800",
  moderate: "bg-amber-50 border-amber-200 text-amber-800",
  covered: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

// ── KPI Card ─────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  icon,
  accent,
  subtext,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  subtext?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[hsl(215,16%,47%)] uppercase tracking-wider">
          {label}
        </span>
        <div className={`p-2 rounded-lg ${accent}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-[hsl(222,47%,11%)]">{value}</div>
      {subtext && <div className="text-[10px] text-[hsl(215,16%,47%)] mt-1">{subtext}</div>}
    </div>
  );
}

// ── Priority Engine Panel ─────────────────────────────────────────────
function PriorityEnginePanel({
  village,
  onClose,
  isDefault = false,
  onAssignNgo,
  onRefresh,
}: {
  village: Village | null;
  onClose: () => void;
  isDefault?: boolean;
  onAssignNgo?: (v: Village) => void;
  onRefresh?: () => void;
}) {
  if (!village) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-[hsl(222,47%,8%)] rounded-xl border border-slate-700/50 p-5 shadow-xl animate-fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-blue-500/20 border border-blue-500/30 p-2 rounded-lg">
            <BarChart3 size={16} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">AI Priority Engine</h3>
            <p className="text-[10px] text-slate-400">Multi-factor scoring analysis</p>
          </div>
        </div>
        <div className="flex flex-col items-center py-6 gap-2 text-center">
          <div className="bg-slate-800 p-3 rounded-full border border-slate-700">
            <MapPin size={20} className="text-slate-400" />
          </div>
          <p className="text-xs text-slate-400">Click a village marker on the map<br />to see its AI priority breakdown</p>
        </div>
      </div>
    );
  }

  const pb = village.priority_breakdown;
  const score = pb.final_priority_score;
  const maxScore = 120;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(score / maxScore, 1));
  const scoreColor = pb.classification === "critical" ? "#EF4444" : pb.classification === "moderate" ? "#F59E0B" : "#22C55E";

  const factors = [
    { label: "Geographical Risk",   value: pb.geographical_score,     max: 30, color: "bg-blue-500"    },
    { label: "Volunteer Reports",   value: pb.volunteer_report_score,  max: 25, color: "bg-emerald-500" },
    { label: "NGO Verification",    value: pb.ngo_report_score,        max: 15, color: "bg-violet-500"  },
    { label: "Crowd Confirmation",  value: pb.crowd_verification_score,max: 20, color: "bg-amber-500"   },
    { label: "Disaster Severity",   value: pb.disaster_severity_score, max: 30, color: "bg-red-500"     },
    { label: "Aid History",         value: Math.abs(pb.previous_aid_impact), max: 20, color: "bg-slate-400" },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-[hsl(222,47%,7%)] rounded-xl border border-slate-700/60 p-5 shadow-2xl animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500/20 border border-blue-500/30 p-2 rounded-lg">
            <BarChart3 size={15} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">AI Priority Engine</h3>
            <p className="text-[10px] text-slate-400">Multi-factor scoring system</p>
          </div>
        </div>
        {isDefault && <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">TOP PRIORITY</span>}
        {!isDefault && <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X size={13} className="text-slate-400" /></button>}
      </div>

      {/* Circular score gauge + village info */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            <circle
              cx="50" cy="50" r={radius} fill="none"
              stroke={scoreColor} strokeWidth="10"
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1.2s ease-out", filter: `drop-shadow(0 0 6px ${scoreColor}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-black text-white leading-none">{score}</div>
            <div className="text-[9px] text-slate-500">/{maxScore}</div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate mb-0.5">{village.name}</div>
          <div className="text-[10px] text-slate-400 mb-2.5">{village.needs} · {village.families.toLocaleString()} families</div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
            pb.classification === "critical" ? "bg-red-500/15 text-red-400 border border-red-500/30" :
            pb.classification === "moderate" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
            "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${pb.classification === "critical" ? "bg-red-400 animate-pulse" : pb.classification === "moderate" ? "bg-amber-400" : "bg-emerald-400"}`} />
            {pb.classification}
          </div>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="border-t border-slate-700/40 pt-4">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Decision Factors</div>
        <div className="space-y-2.5">
          {factors.map((f) => {
            const pct = Math.min((f.value / f.max) * 100, 100);
            const passed = pct >= 60;
            return (
              <div key={f.label}>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black ${passed ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-500"}`}>
                      {passed ? "✓" : "·"}
                    </div>
                    <span className="text-slate-300">{f.label}</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[9px]">{f.value.toFixed(1)}/{f.max}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${f.color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* NGO Dispatch */}
      <div className="border-t border-slate-700/40 pt-4 mt-2">
        <div className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold mb-3">NGO Dispatch</div>
        {village.assigned_ngo ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-emerald-500/20 border border-emerald-500/30 p-2 rounded-lg shrink-0">
                <Users size={13} className="text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">{village.assigned_ngo.name}</div>
                <div className="text-[10px] text-slate-400">{village.assigned_ngo.specialty} · {village.assigned_ngo.city}</div>
              </div>
            </div>
            {village.route_info && (
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
                  <div className="text-[9px] text-slate-500">Distance</div>
                  <div className="text-xs font-bold text-white">{village.route_info.distance_km} km</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
                  <div className="text-[9px] text-slate-500">ETA</div>
                  <div className="text-xs font-bold text-white">{village.route_info.eta_hours}h</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
                  <div className="text-[9px] text-slate-500">Road</div>
                  <div className={`text-[9px] font-bold leading-tight ${village.route_info.road_status === "Clear" ? "text-emerald-400" : "text-amber-400"}`}>{village.route_info.road_status}</div>
                </div>
              </div>
            )}
            {village.delivery_status && onRefresh && (
              <div className="mb-3">
                <DeliveryStatusTracker status={village.delivery_status} villageId={village.id} onRefresh={onRefresh} dark={true} />
              </div>
            )}
            <button
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${village.position.lat},${village.position.lng}`, "_blank")}
              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
            >
              <Navigation size={13} /> Start Navigation
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAssignNgo && onAssignNgo(village)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Users size={13} /> Assign NGO
          </button>
        )}
      </div>
    </div>
  );
}

// ── Map Panel ──────────────────────────────────────────────────────────
function MapPanel({
  villages,
  onVillageSelect,
  selectedVillage,
  selectedState,
  sosMarkers = [],
  ngoCheckins = [],
}: {
  villages: Village[];
  onVillageSelect: (v: Village | null) => void;
  selectedVillage: Village | null;
  selectedState: string;
  sosMarkers?: SosMarker[];
  ngoCheckins?: NgoCheckin[];
}) {
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "moderate" | "covered">("all");
  const [showNgos, setShowNgos] = useState(true);
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null);
  const prevSosCountRef = useRef(sosMarkers.length);

  const defaultCenter: [number, number] = [15.5, 78.5];

  useEffect(() => {
    if (sosMarkers.length > prevSosCountRef.current) {
      const latest = sosMarkers[sosMarkers.length - 1];
      setPanTarget({ lat: latest.lat, lng: latest.lng });
    }
    prevSosCountRef.current = sosMarkers.length;
  }, [sosMarkers]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setGeoError("Location access denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const getMarkerIcon = (status: string, isHighlighted: boolean) => {
    const hlRing = isHighlighted ? "0 0 0 3px rgba(37,99,235,0.6)," : "";
    if (status === "critical") {
      return L.divIcon({
        className: "custom-marker",
        html: `<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(239,68,68,0.2);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:absolute;width:26px;height:26px;border-radius:50%;background:rgba(239,68,68,0.15);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite 0.4s;"></div>
          <div style="position:relative;width:22px;height:22px;border-radius:50%;background:#EF4444;border:3px solid white;box-shadow:${hlRing}0 0 14px rgba(239,68,68,0.7),0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:10px;font-weight:900;color:white;line-height:1;">!</span>
          </div>
        </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      });
    } else if (status === "moderate") {
      return L.divIcon({
        className: "custom-marker",
        html: `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
          <div style="position:relative;width:24px;height:24px;border-radius:50%;background:#F59E0B;border:3px solid white;box-shadow:${hlRing}0 0 10px rgba(245,158,11,0.5),0 2px 6px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:10px;font-weight:900;color:white;line-height:1;">~</span>
          </div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });
    } else {
      return L.divIcon({
        className: "custom-marker",
        html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <div style="position:relative;width:20px;height:20px;border-radius:50%;background:#22C55E;border:2.5px solid white;box-shadow:${hlRing}0 0 8px rgba(34,197,94,0.45),0 2px 4px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:10px;font-weight:900;color:white;line-height:1;">&#10003;</span>
          </div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12],
      });
    }
  };

  const userIcon = L.divIcon({
    className: "user-marker",
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 2px 10px rgba(37,99,235,0.5);display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-10-10h4m12 0h4"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  const sosIcon = L.divIcon({
    className: "sos-marker",
    html: `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(239,68,68,0.25);animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(239,68,68,0.35);animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite 0.3s;"></div>
      <div style="position:relative;width:22px;height:22px;border-radius:50%;background:#DC2626;border:3px solid white;box-shadow:0 2px 10px rgba(220,38,38,0.6);display:flex;align-items:center;justify-content:center;">
        <span style="font-size:9px;font-weight:900;color:white;line-height:1;">SOS</span>
      </div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });

  const ngoIcon = L.divIcon({
    className: "ngo-marker",
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 2px 14px rgba(37,99,235,0.55);display:flex;align-items:center;justify-content:center;font-size:16px;">🚑</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function getNgoCheckinIcon(name: string, ngoStatus: string) {
    const safeInitials = escapeHtml(
      name
        .split(" ")
        .filter((w) => w.length > 0)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("")
    );
    const pulse = ngoStatus === "active"
      ? `<div style="position:absolute;width:38px;height:38px;border-radius:50%;background:rgba(37,99,235,0.22);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>`
      : "";
    return L.divIcon({
      className: "ngo-checkin-marker",
      html: `<div style="position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
        ${pulse}
        <div style="position:relative;width:32px;height:32px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 2px 14px rgba(37,99,235,0.6);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:10px;font-weight:900;color:white;letter-spacing:-0.5px;line-height:1;">${safeInitials}</span>
        </div>
      </div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -19],
    });
  }

  async function calculateRoute(village: Village) {
    if (!userPos) {
      alert("Please enable location access first");
      return;
    }
    setRouteLoading(true);
    setNavigatingTo(village.id);
    setRoute(null);
    setRouteInfo(null);
    try {
      const start = [userPos.lng, userPos.lat];
      const end = [village.position.lng, village.position.lat];
      const resp = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=5b3ce3597851110001cf6248a7a8e0e8f7b04e5b8c4e0e8b9c0e8b0e8`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ coordinates: [start, end] }),
        }
      );
      if (!resp.ok) {
        const R = 6371;
        const dLat = (village.position.lat - userPos.lat) * Math.PI / 180;
        const dLon = (village.position.lng - userPos.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(userPos.lat*Math.PI/180)*Math.cos(village.position.lat*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const dist = R * c;
        const dur = (dist / 40) * 60;
        setRoute([[userPos.lat, userPos.lng], [village.position.lat, village.position.lng]]);
        setRouteInfo({
          distance: `${dist.toFixed(1)} km (straight line)`,
          duration: `${Math.round(dur)} min`,
        });
        return;
      }
      const data = await resp.json();
      const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
      const dist = data.routes[0].summary.distance / 1000;
      const dur = data.routes[0].summary.duration / 60;
      setRoute(coords);
      setRouteInfo({
        distance: `${dist.toFixed(1)} km`,
        duration: `${Math.round(dur)} min`,
      });
    } catch {
      const R = 6371;
      const dLat = (village.position.lat - userPos.lat) * Math.PI / 180;
      const dLon = (village.position.lng - userPos.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(userPos.lat*Math.PI/180)*Math.cos(village.position.lat*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = R * c;
      const dur = (dist / 40) * 60;
      setRoute([[userPos.lat, userPos.lng], [village.position.lat, village.position.lng]]);
      setRouteInfo({
        distance: `${dist.toFixed(1)} km (straight line)`,
        duration: `${Math.round(dur)} min`,
      });
    } finally {
      setRouteLoading(false);
    }
  }

  function MapCenterer({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      try {
        map.setView(center, map.getZoom());
      } catch {
        // map pane may have been removed from DOM
      }
    }, [center, map]);
    return null;
  }

  function SosPanner({ target }: { target: { lat: number; lng: number } | null }) {
    const map = useMap();
    useEffect(() => {
      if (!target) return;
      try {
        map.flyTo([target.lat, target.lng], 13, { animate: true, duration: 1.5 });
      } catch {
        // map pane may have been removed from DOM
      }
      return () => {
        try {
          map.stop();
        } catch {
          // already unmounted
        }
      };
    }, [target, map]);
    return null;
  }

  function MapContent({ height, isExpanded }: { height: string; isExpanded: boolean }) {
    return (
      <MapContainer
        center={userPos ? [userPos.lat, userPos.lng] : defaultCenter}
        zoom={userPos ? 10 : 6}
        style={{ height, width: "100%", borderRadius: "0.5rem", border: "1px solid hsl(214,32%,91%)" }}
        scrollWheelZoom={isExpanded}
        key={`map-${isExpanded ? 'expanded' : 'inline'}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <SosPanner target={panTarget} />

        {userPos && (
          <>
            <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
              <Popup>
                <div className="text-xs font-semibold">Your Position</div>
                <div className="text-[10px] text-[hsl(215,16%,47%)]">{userPos.lat.toFixed(4)}°N, {userPos.lng.toFixed(4)}°E</div>
              </Popup>
            </Marker>
            <MapCenterer center={[userPos.lat, userPos.lng]} />
          </>
        )}

        {villages.map((v) => {
          const isHighlighted = !!selectedState && v.state === selectedState;
          return (
            <Marker
              key={v.id}
              position={[v.position.lat, v.position.lng]}
              icon={getMarkerIcon(v.status, isHighlighted)}
              eventHandlers={{
                click: () => {
                  onVillageSelect(v);
                  setRoute(null);
                  setRouteInfo(null);
                  setNavigatingTo(null);
                },
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <div className="font-semibold text-sm text-[hsl(222,47%,11%)] mb-1">{v.name}</div>
                  <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white mb-2 ${
                    v.status === "critical" ? "bg-red-500" : v.status === "moderate" ? "bg-amber-500" : "bg-emerald-500"
                  }`}>
                    {v.status}
                  </div>
                  <div className="text-[10px] text-[hsl(215,16%,47%)] space-y-1">
                    <div><strong>State:</strong> {v.state}</div>
                    <div><strong>Priority Score:</strong> {v.priority_breakdown.final_priority_score}</div>
                    <div><strong>Families:</strong> {v.families.toLocaleString()}</div>
                    <div><strong>Needs:</strong> {v.needs}</div>
                    <div><strong>Aid Received:</strong> {v.aid_received}%</div>
                    <div><strong>Verification:</strong> {v.priority_breakdown.crowd_verification_score} / 20</div>
                  </div>
                  {v.status === "critical" && (
                    <button
                      className="mt-2 w-full bg-[hsl(142,76%,36%)] text-white text-[10px] font-bold py-1.5 rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        calculateRoute(v);
                      }}
                      disabled={routeLoading}
                    >
                      {routeLoading && navigatingTo === v.id ? (
                        <span>Calculating...</span>
                      ) : (
                        <>
                          <Navigation size={12} />
                          Navigate to Village
                        </>
                      )}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
        {selectedState && (
          <>
            {villages
              .filter((v) => v.state === selectedState)
              .map((v) => (
                <Circle
                  key={`ring-${v.id}`}
                  center={[v.position.lat, v.position.lng]}
                  radius={8000}
                  pathOptions={{
                    color: "#2563EB",
                    fillColor: "#2563EB",
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: "6, 6",
                  }}
                />
              ))}
          </>
        )}

        {route && (
          <Polyline
            positions={route}
            color="#2563EB"
            weight={4}
            opacity={0.7}
            dashArray={route.length > 2 ? undefined : "10, 10"}
          />
        )}

        {sosMarkers.map((sm) => (
          <Marker
            key={`sos-${sm.id}`}
            position={[sm.lat, sm.lng]}
            icon={sosIcon}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold text-sm text-red-700">EMERGENCY SOS</span>
                </div>
                <div className="text-[10px] text-[hsl(215,16%,47%)] space-y-1 mb-2">
                  <div><strong>Location:</strong> {sm.lat.toFixed(4)}°N, {sm.lng.toFixed(4)}°E</div>
                  <div><strong>Sector:</strong> {sm.village}</div>
                  <div><strong>Families:</strong> {sm.families.toLocaleString()}</div>
                  <div><strong>Time:</strong> {sm.timestamp}</div>
                </div>
                {userPos && (
                  <button
                    className="w-full bg-red-600 text-white text-[10px] font-bold py-1.5 rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      calculateRoute({ id: sm.id, name: sm.village, status: "critical", needs: "Emergency Response", families: sm.families, metrics: "", trackingDemand: "", position: { lat: sm.lat, lng: sm.lng }, aid_received: 0, severity_score: 30, need_score: 30, state: "—", priority_breakdown: { geographical_score: 0, volunteer_report_score: 0, ngo_report_score: 0, crowd_verification_score: 0, disaster_severity_score: 30, previous_aid_impact: 0, final_priority_score: 90, classification: "critical" } });
                    }}
                  >
                    <Navigation size={10} />
                    Navigate to Emergency
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {showNgos && ngoCheckins.map((nc) => (
          <Marker
            key={`ngo-checkin-${nc.id}`}
            position={[nc.lat, nc.lng]}
            icon={getNgoCheckinIcon(nc.name, nc.status)}
          >
            <Popup>
              <div className="min-w-[190px]">
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2563EB", border: "2.5px solid white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: "white" }}>
                      {nc.name.split(" ").filter(w => w.length > 0).slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{nc.name}</div>
                    <div className={`text-[10px] font-semibold ${nc.status === "active" ? "text-emerald-600" : nc.status === "on-scene" ? "text-blue-600" : "text-amber-600"}`}>
                      ● {nc.status.charAt(0).toUpperCase() + nc.status.slice(1)}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <div><strong>Last check-in:</strong> {new Date(nc.last_checkin * 1000).toLocaleTimeString()}</div>
                  <div><strong>Position:</strong> {nc.lat.toFixed(4)}°N, {nc.lng.toFixed(4)}°E</div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {selectedVillage?.route_info && selectedVillage.assigned_ngo && (
          <>
            <Marker
              position={[selectedVillage.route_info.ngo_lat, selectedVillage.route_info.ngo_lng]}
              icon={ngoIcon}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <div className="font-bold text-sm text-slate-800">{selectedVillage.assigned_ngo.name}</div>
                  <div className="text-[10px] text-slate-500 mb-1.5">{selectedVillage.assigned_ngo.specialty} · {selectedVillage.assigned_ngo.city}</div>
                  <div className="text-[10px] text-emerald-700 font-semibold">Dispatched → {selectedVillage.name}</div>
                  <div className="text-[10px] text-slate-500">{selectedVillage.route_info.distance_km} km · ETA {selectedVillage.route_info.eta_hours}h</div>
                  <div className="text-[10px] text-slate-500">Road: {selectedVillage.route_info.road_status}</div>
                </div>
              </Popup>
            </Marker>
            <Polyline
              positions={[
                [selectedVillage.route_info.ngo_lat, selectedVillage.route_info.ngo_lng],
                [selectedVillage.position.lat, selectedVillage.position.lng],
              ]}
              color="#22C55E"
              weight={3}
              dashArray="10, 6"
              opacity={0.85}
            />
          </>
        )}
      </MapContainer>
    );
  }

  const filteredVillages = filter === "all" ? villages : villages.filter(v => v.status === filter);

  return (
    <>
      {/* Inline Map Card */}
      <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[hsl(222,47%,11%)]">Live Situation Map</h3>
            <p className="text-xs text-[hsl(215,16%,47%)] mt-0.5">
              {userPos
                ? `Your position: ${userPos.lat.toFixed(4)}°N, ${userPos.lng.toFixed(4)}°E`
                : geoError || "Detecting your location..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {routeInfo && (
              <div className="bg-[hsl(210,40%,96%)] px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-semibold text-[hsl(222,47%,11%)]">
                <Route size={12} className="text-[hsl(142,76%,36%)]" />
                <span>{routeInfo.distance} · {routeInfo.duration}</span>
              </div>
            )}
            <button
              onClick={() => setShowNgos((p) => !p)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors border ${
                showNgos
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "border-[hsl(214,32%,91%)] text-[hsl(215,16%,47%)] hover:bg-[hsl(210,40%,96%)]"
              }`}
              title="Toggle NGO layer"
            >
              <Users size={11} />
              NGOs
            </button>
            <button
              onClick={() => setExpanded(true)}
              className="p-2 rounded-lg hover:bg-[hsl(210,40%,96%)] transition-colors border border-[hsl(214,32%,91%)]"
              title="Expand map to explore"
            >
              <Maximize2 size={14} className="text-[hsl(215,16%,47%)]" />
            </button>
          </div>
        </div>

        <div className="h-64 sm:h-80 lg:h-96">
          <MapContent height="100%" isExpanded={false} />
        </div>

        {selectedVillage && (
          <div className="mt-3 border border-[hsl(214,32%,91%)] rounded-lg p-3 bg-[hsl(210,40%,98%)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPinned size={14} className="text-[hsl(222,47%,11%)]" />
                <span className="text-xs font-semibold text-[hsl(222,47%,11%)]">{selectedVillage.name}</span>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white ${
                  selectedVillage.status === "critical" ? "bg-red-500" : selectedVillage.status === "moderate" ? "bg-amber-500" : "bg-emerald-500"
                }`}>
                  {selectedVillage.status}
                </span>
              </div>
              <button onClick={() => { onVillageSelect(null); setRoute(null); setRouteInfo(null); }} className="p-1 hover:bg-[hsl(210,40%,96%)] rounded-lg">
                <X size={12} className="text-[hsl(215,16%,47%)]" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-[hsl(222,47%,11%)]">
              <div className="bg-white p-2 rounded border border-[hsl(214,32%,91%)]">
                <div className="text-[hsl(215,16%,47%)]">Priority Score</div>
                <div className="font-bold text-sm">{selectedVillage.priority_breakdown.final_priority_score}</div>
              </div>
              <div className="bg-white p-2 rounded border border-[hsl(214,32%,91%)]">
                <div className="text-[hsl(215,16%,47%)]">Families</div>
                <div className="font-bold text-sm">{selectedVillage.families.toLocaleString()}</div>
              </div>
              <div className="bg-white p-2 rounded border border-[hsl(214,32%,91%)]">
                <div className="text-[hsl(215,16%,47%)]">Aid Received</div>
                <div className="font-bold text-sm">{selectedVillage.aid_received}%</div>
              </div>
              <div className="bg-white p-2 rounded border border-[hsl(214,32%,91%)]">
                <div className="text-[hsl(215,16%,47%)]">Verification</div>
                <div className="font-bold text-sm">{selectedVillage.priority_breakdown.crowd_verification_score} / 20</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-[hsl(215,16%,47%)]">
              <strong>Needs:</strong> {selectedVillage.needs}
            </div>
            {selectedVillage.status === "critical" && userPos && (
              <button
                className="mt-2 w-full bg-[hsl(142,76%,36%)] text-white text-xs font-bold py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
                onClick={() => calculateRoute(selectedVillage)}
                disabled={routeLoading}
              >
                {routeLoading && navigatingTo === selectedVillage.id ? (
                  <span>Calculating route...</span>
                ) : (
                  <>
                    <Navigation size={14} />
                    Navigate to Village
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded Full-Screen Overlay */}
      {expanded && (
        <div className="fixed inset-0 z-[9999] bg-[hsl(210,40%,98%)] flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-[hsl(214,32%,91%)] px-5 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-[hsl(142,76%,93%)] p-2 rounded-lg">
                <MapPin size={18} className="text-[hsl(142,76%,36%)]" />
              </div>
              <div>
                <div className="text-sm font-bold text-[hsl(222,47%,11%)]">Situation Explorer</div>
                <div className="text-[10px] text-[hsl(215,16%,47%)]">
                  {villages.length} villages monitored · {villages.filter(v => v.status === "critical").length} critical
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {routeInfo && (
                <div className="bg-[hsl(210,40%,96%)] px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-semibold text-[hsl(222,47%,11%)]">
                  <Route size={12} className="text-[hsl(142,76%,36%)]" />
                  <span>{routeInfo.distance} · {routeInfo.duration}</span>
                </div>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="p-2 rounded-lg hover:bg-[hsl(210,40%,96%)] transition-colors border border-[hsl(214,32%,91%)]"
              >
                <Minimize2 size={14} className="text-[hsl(215,16%,47%)]" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Map Area */}
            <div className="flex-1 p-4 min-h-0">
              <MapContent height="calc(100vh - 80px)" isExpanded={true} />
            </div>

            {/* Sidebar */}
            <div className="w-80 bg-white border-l border-[hsl(214,32%,91%)] overflow-y-auto">
              {/* Filter Tabs */}
              <div className="p-4 border-b border-[hsl(214,32%,91%)]">
                <div className="flex items-center gap-2 mb-3">
                  <List size={14} className="text-[hsl(215,16%,47%)]" />
                  <span className="text-xs font-semibold text-[hsl(222,47%,11%)]">Village List</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {(["all", "critical", "moderate", "covered"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold capitalize transition-colors ${
                        filter === f
                          ? f === "critical" ? "bg-red-500 text-white" : f === "moderate" ? "bg-amber-500 text-white" : f === "covered" ? "bg-emerald-500 text-white" : "bg-[hsl(222,47%,11%)] text-white"
                          : "bg-[hsl(210,40%,96%)] text-[hsl(215,16%,47%)] hover:bg-[hsl(210,40%,93%)]"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowNgos((p) => !p)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                      showNgos
                        ? "bg-blue-500 text-white"
                        : "bg-[hsl(210,40%,96%)] text-[hsl(215,16%,47%)] hover:bg-[hsl(210,40%,93%)]"
                    }`}
                  >
                    <Users size={9} />
                    NGOs
                  </button>
                </div>
              </div>

              {/* Village Cards */}
              <div className="p-4 space-y-3">
                {filteredVillages.map((v) => (
                  <div
                    key={v.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
                      selectedVillage?.id === v.id
                        ? "border-[hsl(142,76%,36%)] bg-[hsl(142,76%,97%)]"
                        : "border-[hsl(214,32%,91%)] bg-white"
                    }`}
                    onClick={() => {
                      onVillageSelect(v);
                      setRoute(null);
                      setRouteInfo(null);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[hsl(222,47%,11%)]">{v.name}</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase text-white ${
                        v.status === "critical" ? "bg-red-500" : v.status === "moderate" ? "bg-amber-500" : "bg-emerald-500"
                      }`}>
                        {v.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-[hsl(215,16%,47%)] space-y-1">
                      <div className="flex justify-between">
                        <span>Priority</span>
                        <span className="font-semibold text-[hsl(222,47%,11%)]">{v.priority_breakdown.final_priority_score}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Families</span>
                        <span className="font-semibold text-[hsl(222,47%,11%)]">{v.families.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Aid</span>
                        <span className="font-semibold text-[hsl(222,47%,11%)]">{v.aid_received}%</span>
                      </div>
                    </div>
                    <div className="mt-2 text-[9px] text-[hsl(215,16%,47%)] truncate">{v.needs}</div>
                    {v.status === "critical" && userPos && (
                      <button
                        className="mt-2 w-full bg-[hsl(142,76%,36%)] text-white text-[10px] font-bold py-1.5 rounded hover:opacity-90 transition-opacity flex items-center justify-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          calculateRoute(v);
                        }}
                        disabled={routeLoading}
                      >
                        {routeLoading && navigatingTo === v.id ? (
                          <span>Calculating...</span>
                        ) : (
                          <>
                            <Navigation size={10} />
                            Navigate
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
                {filteredVillages.length === 0 && (
                  <div className="text-center text-[10px] text-[hsl(215,16%,47%)] py-8">
                    No villages match this filter.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Supply Panel ──────────────────────────────────────────────────────
function SupplyPanel({ supply }: { supply: SupplyData | null }) {
  if (!supply) return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[hsl(222,47%,11%)] mb-3">Supply Tracking</h3>
      <div className="text-xs text-[hsl(215,16%,47%)]">Loading supply data...</div>
    </div>
  );

  const items = [
    { key: "food_kits" as keyof SupplyData, label: "Food Supply Kits", icon: <Package size={14} />, color: "bg-emerald-500" },
    { key: "medicines" as keyof SupplyData, label: "Medicines & Medical", icon: <HeartPulse size={14} />, color: "bg-blue-500" },
    { key: "water" as keyof SupplyData, label: "Clean Water", icon: <Droplets size={14} />, color: "bg-emerald-500" },
    { key: "blankets" as keyof SupplyData, label: "Blankets & Warm Supplies", icon: <Thermometer size={14} />, color: "bg-amber-500" },
    { key: "tents" as keyof SupplyData, label: "Shelter Tents", icon: <Tent size={14} />, color: "bg-indigo-500" },
  ];

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[hsl(222,47%,11%)] mb-1">Supply Tracking</h3>
      <p className="text-xs text-[hsl(215,16%,47%)] mb-4">Pipeline allocations vs. required targets</p>
      <div className="flex flex-col gap-3">
        {items.map(({ key, label, icon, color }) => {
          const s = supply[key];
          const pct = Math.round((s.delivered / s.total) * 100);
          return (
            <div key={key}>
              <div className="flex justify-between text-xs font-medium text-[hsl(222,47%,11%)] mb-1">
                <span className="flex items-center gap-1">{icon} {label}</span>
                <strong>{s.delivered.toLocaleString()} / {s.total.toLocaleString()} units</strong>
              </div>
              <div className="h-[7px] bg-[hsl(210,40%,96%)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATES = [
  "Tamil Nadu",
  "Karnataka",
  "Maharashtra",
  "Kerala",
  "Andhra Pradesh",
  "Gujarat",
  "Rajasthan",
  "Uttar Pradesh",
  "West Bengal",
  "Bihar",
  "Odisha",
  "Madhya Pradesh",
  "Telangana",
  "Punjab",
  "Haryana",
];

// ── AI Panel ───────────────────────────────────────────────────────────
function AiPanel({
  villages,
  onAction,
  selectedState,
  onStateChange,
  apiBase = "",
}: {
  villages: Village[];
  onAction: () => void;
  selectedState: string;
  onStateChange: (s: string) => void;
  apiBase?: string;
}) {
  const [ngo, setNgo] = useState("");
  const [selectedVillage, setSelectedVillage] = useState("");
  const [resource, setResource] = useState("Food Kits");
  const [dupResult, setDupResult] = useState<DuplicateResponse | null>(null);
  const [dupLoading, setDupLoading] = useState(false);

  const active = villages.filter((v) => v.status !== "covered");
  const stateVillages = selectedState
    ? villages.filter((v) => v.state === selectedState)
    : villages;

  // Reset selected village when state changes so it doesn't point to a filtered-out village
  useEffect(() => {
    setSelectedVillage("");
  }, [selectedState]);

  async function checkDuplicate() {
    if (!selectedVillage) return;
    setDupLoading(true);
    setDupResult(null);
    try {
      const result = await apiPost<DuplicateResponse>(`${apiBase}/duplicate-check`, {
        village: selectedVillage,
        resource,
      });
      setDupResult(result);
      onAction();
    } catch (e) {
      setDupResult({ duplicate: true, message: "Analysis failed. Please retry." });
    } finally {
      setDupLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-sm">
      <div className="mb-4">
        <span className="inline-block bg-[hsl(238,100%,96%)] text-[hsl(238,83%,57%)] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
          Gemini-Powered Intelligence
        </span>
        <h3 className="text-sm font-semibold text-[hsl(222,47%,11%)] mt-1">
          AI Optimization & Duplicate Supply Detection
        </h3>
        <p className="text-xs text-[hsl(215,16%,47%)]">Priority Engine allocations + collision prevention</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dynamic Allocation */}
        <div className="border border-[hsl(214,32%,91%)] rounded-lg p-4 bg-[hsl(210,40%,98%)]">
          <h4 className="text-[10px] font-bold text-[hsl(215,16%,47%)] uppercase tracking-wider mb-3">
            Dynamic Allocation Strategy
          </h4>
          <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto">
            {active.length === 0 ? (
              <div className="text-xs text-[hsl(215,16%,47%)]">All sectors currently served</div>
            ) : (
              active.map((v) => (
                <div key={v.id} className="bg-white border border-[hsl(214,32%,91%)] border-l-[3px] border-l-emerald-500 px-3 py-2.5 rounded-lg text-xs leading-relaxed">
                  <span className="font-bold text-[hsl(222,47%,11%)]">{v.name}</span>
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${
                    v.status === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {v.status.toUpperCase()}
                  </span>
                  <br />
                  <span className="text-[hsl(222,47%,11%)]">{v.needs} · {v.families.toLocaleString()} families</span>
                  <br />
                  <span className="text-[10px] text-[hsl(215,16%,47%)]">{v.trackingDemand}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Simulate NGO */}
        <div className="border border-[hsl(214,32%,91%)] rounded-lg p-4 bg-[hsl(40,33%,98%)]">
          <h4 className="text-[10px] font-bold text-[hsl(215,16%,47%)] uppercase tracking-wider mb-3">
            Simulate NGO Allocation
          </h4>
          <div className="flex flex-col gap-2">
            <input
              className="w-full bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
              placeholder="NGO / Volunteer Organization Name"
              value={ngo}
              onChange={(e) => setNgo(e.target.value)}
            />
            <select
              className="w-full bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
              value={selectedState}
              onChange={(e) => onStateChange(e.target.value)}
            >
              <option value="">All States</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              className="w-full bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
            >
              <option value="">Select Village...</option>
              {stateVillages.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <select
              className="w-full bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
            >
              <option>Food Kits</option>
              <option>Medicines</option>
              <option>Clean Water</option>
              <option>Shelter</option>
            </select>
            <button
              className="w-full bg-[hsl(222,47%,11%)] text-white text-xs font-semibold py-2.5 rounded-lg hover:bg-[hsl(222,47%,8%)] transition-colors"
              onClick={checkDuplicate}
              disabled={dupLoading}
            >
              {dupLoading ? "Analyzing..." : "Analyze Cargo Drop Integrity"}
            </button>
          </div>
          {dupResult && (
            <div className={`mt-2 rounded-lg text-xs leading-relaxed overflow-hidden border ${
              dupResult.duplicate
                ? "bg-red-50 border-red-200"
                : "bg-emerald-50 border-emerald-200"
            }`}>
              <div className="px-3 py-2">
                <div className={`font-bold mb-1 ${dupResult.duplicate ? "text-red-800" : "text-emerald-800"}`}>
                  {dupResult.duplicate ? "⚠ Conflict Detected" : "✓ Clear for Deployment"}
                </div>
                <div className={dupResult.duplicate ? "text-red-700" : "text-emerald-700"}>{dupResult.message}</div>
                {dupResult.suggested_village && (
                  <div className={`mt-1 font-semibold ${dupResult.duplicate ? "text-red-700" : "text-emerald-700"}`}>
                    → Redirect: {dupResult.suggested_village}
                  </div>
                )}
              </div>
              {/* Priority breakdown for suggested village */}
              {dupResult.priority_breakdown && (
                <div className="px-3 pb-2 pt-1 border-t border-red-200/50 bg-red-100/50">
                  <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Suggested Village Priority Breakdown</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <div className="text-red-600">Geo: {dupResult.priority_breakdown.geographical_score}</div>
                    <div className="text-red-600">Volunteer: {dupResult.priority_breakdown.volunteer_report_score}</div>
                    <div className="text-red-600">NGO: {dupResult.priority_breakdown.ngo_report_score}</div>
                    <div className="text-red-600">Crowd: {dupResult.priority_breakdown.crowd_verification_score}</div>
                    <div className="text-red-600 font-bold">Final: {dupResult.priority_breakdown.final_priority_score}</div>
                    <div className="text-red-600 font-bold">{dupResult.priority_breakdown.classification.toUpperCase()}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SOS Panel ─────────────────────────────────────────────────────────
function SosPanel({ onSuccess, apiBase = "" }: { onSuccess: () => void; apiBase?: string }) {
  const [village, setVillage] = useState("");
  const [resource, setResource] = useState("Food Kits");
  const [families, setFamilies] = useState("");
  const [priority, setPriority] = useState("CRITICAL");
  const [result, setResult] = useState<SosResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const r = await apiPost<SosResponse>(`${apiBase}/sos`, {
        village,
        resource,
        families: parseInt(families),
        priority,
        lat: 13.0,
        lng: 80.0,
        severity_indicator: 35,
        crowd_verification_count: 1,
      });
      setResult(r);
      onSuccess();
      setVillage("");
      setFamilies("");
    } catch (e) {
      setResult({
        success: false,
        message: "Submission failed",
        inserted_id: "",
        calculated_priority: "",
        priority_breakdown: {
          geographical_score: 0, volunteer_report_score: 0,
          ngo_report_score: 0, crowd_verification_score: 0,
          disaster_severity_score: 0, previous_aid_impact: 0,
          final_priority_score: 0, classification: "unknown",
        }
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[hsl(222,47%,11%)]">SOS Registration Portal</h3>
      <p className="text-xs text-[hsl(215,16%,47%)] mb-4">Broadcast critical relief requests</p>
      <form className="flex flex-col gap-2" onSubmit={submit}>
        <input
          className="w-full bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
          placeholder="Village Name"
          value={village}
          onChange={(e) => setVillage(e.target.value)}
          required
        />
        <select
          className="w-full bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
          value={resource}
          onChange={(e) => setResource(e.target.value)}
        >
          <option>Food Supply Kits</option>
          <option>Clean Water</option>
          <option>Medicine & Medical</option>
          <option>Temporary Shelter</option>
        </select>
        <input
          className="w-full bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
          placeholder="Families Affected"
          type="number"
          min={1}
          value={families}
          onChange={(e) => setFamilies(e.target.value)}
          required
        />
        <select
          className="w-full bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="CRITICAL">Emergency: Critical</option>
          <option value="STABLE">Emergency: Stable</option>
        </select>
        <button
          type="submit"
          className="w-full bg-[hsl(142,76%,36%)] text-white text-xs font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity shadow-sm"
          disabled={loading}
        >
          {loading ? "Submitting..." : "Broadcast Emergency Request"}
        </button>
      </form>
      {result && (
        <div className={`mt-2 rounded-lg text-xs leading-relaxed overflow-hidden border ${
          result.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
        }`}>
          <div className={`px-3 py-2 ${result.success ? "text-emerald-800" : "text-red-800"}`}>
            {result.success
              ? `✓ ${result.message} Priority: ${result.calculated_priority.toUpperCase()}`
              : result.message}
          </div>
          {result.success && result.priority_breakdown && (
            <div className="px-3 pb-2 pt-1 border-t border-emerald-200/50 bg-emerald-100/50">
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Priority Engine Score</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-emerald-700">
                <div>Geo: {result.priority_breakdown.geographical_score.toFixed(1)}</div>
                <div>Volunteer: {result.priority_breakdown.volunteer_report_score.toFixed(1)}</div>
                <div>NGO: {result.priority_breakdown.ngo_report_score.toFixed(1)}</div>
                <div>Crowd: {result.priority_breakdown.crowd_verification_score.toFixed(1)}</div>
                <div>Severity: {result.priority_breakdown.disaster_severity_score.toFixed(1)}</div>
                <div>Aid Impact: {result.priority_breakdown.previous_aid_impact.toFixed(1)}</div>
                <div className="font-bold col-span-2">Final: {result.priority_breakdown.final_priority_score} → {result.priority_breakdown.classification.toUpperCase()}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chat Panel ─────────────────────────────────────────────────────────
function ChatPanel({ apiBase = "" }: { apiBase?: string }) {
  const { languageCode } = useLanguage();
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "ReliefHub AI online. Ask about priorities, routes, or duplicates." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(msg?: string) {
    const text = msg || input.trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const r = await apiPost<ChatResponse>(`${apiBase}/chat`, { message: text, language_code: languageCode });
      setMessages((m) => [...m, { role: "ai", text: r.response }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: "AI unavailable. Please retry." }]);
    } finally {
      setLoading(false);
    }
  }

  const chips = [
    "Which village needs urgent help?",
    "Where should I send food kits?",
    "Check for duplicate supplies",
    "What is the priority score breakdown?",
  ];

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[hsl(222,47%,11%)]">AI Cognitive Copilot</h3>
      <p className="text-xs text-[hsl(215,16%,47%)] mb-3">Natural language relief intelligence</p>
      <div className="h-[150px] overflow-y-auto bg-[hsl(40,33%,98%)] border border-[hsl(214,32%,91%)] rounded-lg p-3 flex flex-col gap-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-line ${
              m.role === "user"
                ? "bg-[hsl(142,76%,93%)] text-[hsl(142,76%,20%)] self-end"
                : m.role === "ai"
                ? "bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] self-start border-l-[3px] border-l-blue-500"
                : "bg-white border border-[hsl(214,32%,91%)] text-[hsl(215,16%,47%)] self-start"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="bg-white border border-[hsl(214,32%,91%)] text-[hsl(215,16%,47%)] self-start px-3 py-2 rounded-lg text-xs">
            ...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {chips.map((c) => (
          <button
            key={c}
            className="bg-white border border-[hsl(214,32%,91%)] text-[hsl(215,16%,47%)] px-3 py-1 text-[10px] font-medium rounded-full hover:bg-[hsl(210,40%,96%)] transition-colors"
            onClick={() => send(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          className="flex-1 bg-white border border-[hsl(214,32%,91%)] text-[hsl(222,47%,11%)] px-3 py-2 text-xs rounded-lg focus:outline-none focus:border-[hsl(142,76%,36%)]"
          placeholder="Ask the AI copilot..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          className="bg-[hsl(142,76%,36%)] text-white px-3 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          onClick={() => send()}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Activity Feed Panel ──────────────────────────────────────────────
function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  type ActorCfg = { color: string; bg: string; icon: React.ReactNode };
  const actorCfg: Record<string, ActorCfg> = {
    "SOS Portal":          { color: "text-red-400",     bg: "bg-red-500/12 border-red-500/25",     icon: <AlertTriangle size={11} className="text-red-400" />    },
    "Priority Engine":     { color: "text-blue-400",    bg: "bg-blue-500/12 border-blue-500/25",    icon: <BarChart3 size={11} className="text-blue-400" />       },
    "NGO Alpha":           { color: "text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/25", icon: <Users size={11} className="text-emerald-400" />    },
    "NGO Beta":            { color: "text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/25", icon: <Users size={11} className="text-emerald-400" />    },
    "Volunteer Report":    { color: "text-amber-400",   bg: "bg-amber-500/12 border-amber-500/25",   icon: <Shield size={11} className="text-amber-400" />       },
    "AI Allocation Engine":{ color: "text-violet-400",  bg: "bg-violet-500/12 border-violet-500/25", icon: <Layers size={11} className="text-violet-400" />      },
    "Duplicate Detection": { color: "text-orange-400",  bg: "bg-orange-500/12 border-orange-500/25", icon: <AlertOctagon size={11} className="text-orange-400" />},
    "ReliefHub System":    { color: "text-slate-400",   bg: "bg-slate-600/20 border-slate-600/25",   icon: <Radio size={11} className="text-slate-400" />        },
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-[hsl(222,47%,8%)] rounded-xl border border-slate-700/60 p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/15 border border-emerald-500/30 p-2 rounded-lg">
            <Activity size={15} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Live Operations Feed</h3>
            <p className="text-[10px] text-slate-400">Real-time coordination events</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400">LIVE</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Radio size={14} className="text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400 font-medium">Waiting for verified reports…</p>
            <p className="text-[10px] text-slate-600">No events recorded yet. Channel is open.</p>
          </div>
        ) : (
          activities.map((a, i) => {
            const cfg: ActorCfg = actorCfg[a.actor] ?? { color: "text-slate-400", bg: "bg-slate-700/30 border-slate-600/25", icon: <Clock size={11} className="text-slate-400" /> };
            const time = a.timestamp.includes(" ") ? a.timestamp.split(" ")[1] : a.timestamp;
            return (
              <div key={i} className={`flex gap-2.5 items-start p-2.5 rounded-lg border ${cfg.bg} transition-all`}>
                <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border flex items-center justify-center ${cfg.bg}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold ${cfg.color}`}>{a.actor}</span>
                    <span className="text-[9px] text-slate-600">·</span>
                    <span className="text-[9px] text-slate-500 font-mono">{time}</span>
                  </div>
                  <div className="text-[10px] font-semibold text-slate-200 mb-0.5">{a.action}</div>
                  <div className="text-[10px] text-slate-500 leading-relaxed">{a.details}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── NGO Assignment Modal + Delivery Status Tracker ─────────────────────
const DELIVERY_STEPS = [
  { key: "assigned",     label: "Assigned",       icon: "📋" },
  { key: "traveling",   label: "En Route",        icon: "🚛" },
  { key: "arrived",     label: "On Site",         icon: "📍" },
  { key: "distributed", label: "Aid Distributed", icon: "📦" },
  { key: "completed",   label: "Completed",       icon: "✅" },
];

function DeliveryStatusTracker({ status, villageId, onRefresh, dark = false }: { status: string; villageId: string; onRefresh: () => void; dark?: boolean }) {
  const [advancing, setAdvancing] = useState(false);
  const currentIdx = DELIVERY_STEPS.findIndex((s) => s.key === status);
  const nextStep = DELIVERY_STEPS[currentIdx + 1];

  async function advance() {
    if (!nextStep) return;
    setAdvancing(true);
    try {
      await apiPost(`/villages/${villageId}/delivery-status`, { status: nextStep.key });
      onRefresh();
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-0.5 mb-2 flex-wrap">
        {DELIVERY_STEPS.map((step, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="flex items-center">
              <div className={`flex flex-col items-center ${done ? "opacity-100" : "opacity-25"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 transition-all ${
                  active
                    ? (dark ? "bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-emerald-500 border-emerald-300 shadow-md")
                    : done
                    ? (dark ? "bg-emerald-800 border-emerald-700" : "bg-emerald-100 border-emerald-300")
                    : (dark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200")
                }`}>
                  {step.icon}
                </div>
              </div>
              {i < DELIVERY_STEPS.length - 1 && (
                <div className={`w-4 h-0.5 ${i < currentIdx ? (dark ? "bg-emerald-500" : "bg-emerald-400") : (dark ? "bg-slate-700" : "bg-slate-200")}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className={`text-[10px] font-bold mb-2 ${dark ? "text-emerald-400" : "text-emerald-700"}`}>
        Status: {DELIVERY_STEPS[currentIdx]?.label ?? status}
      </div>
      {nextStep && (
        <button
          onClick={advance}
          disabled={advancing}
          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 ${
            dark ? "bg-white/10 hover:bg-white/20 text-white border border-white/20" : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {advancing ? "Updating…" : `Advance → ${nextStep.label}`}
        </button>
      )}
    </div>
  );
}

function NgoAssignModal({ village, onClose, onAssigned }: { village: Village; onClose: () => void; onAssigned: () => void }) {
  const [ngos, setNgos] = useState<NgoWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    apiGet<NgoWithDistance[]>(`/ngos?village_id=${village.id}`)
      .then(setNgos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [village.id]);

  async function assign(ngoId: string) {
    setAssigning(ngoId);
    try {
      await apiPost(`/villages/${village.id}/assign-ngo`, { ngo_id: ngoId });
      onAssigned();
    } catch {
      setAssigning(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-4 flex items-center gap-3">
          <div className="bg-blue-500/20 border border-blue-500/30 p-2.5 rounded-xl">
            <Users size={18} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Assign NGO Dispatch</div>
            <div className="text-[10px] text-slate-400">
              {village.name} · <span className={`font-bold ${village.status === "critical" ? "text-red-400" : "text-amber-400"}`}>{village.status.toUpperCase()}</span> · {village.families.toLocaleString()} families
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={15} className="text-slate-400" />
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs text-slate-500">Finding available NGOs…</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto pr-0.5">
              {ngos.map((ngo) => {
                const busy = assigning === ngo.id;
                return (
                  <div key={ngo.id} className="border border-slate-200 rounded-xl p-3.5 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <div className="text-sm font-bold text-slate-800">{ngo.name}</div>
                        <div className="text-[10px] text-slate-500">{ngo.specialty} · {ngo.city}, {ngo.state}</div>
                      </div>
                      <button
                        onClick={() => assign(ngo.id)}
                        disabled={!!assigning}
                        className="text-[11px] font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0 ml-2"
                      >
                        {busy ? (
                          <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Dispatching…</>
                        ) : <>Assign →</>}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <div className="text-center bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                        <div className="text-[9px] text-slate-400 uppercase tracking-wide">Distance</div>
                        <div className="text-xs font-bold text-slate-700">{ngo.distance_km} km</div>
                      </div>
                      <div className="text-center bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                        <div className="text-[9px] text-slate-400 uppercase tracking-wide">ETA</div>
                        <div className="text-xs font-bold text-slate-700">{ngo.eta_hours}h</div>
                      </div>
                      <div className="text-center bg-slate-50 border border-slate-100 rounded-lg p-1.5">
                        <div className="text-[9px] text-slate-400 uppercase tracking-wide">Workload</div>
                        <div className={`text-xs font-bold ${ngo.workload_percent > 66 ? "text-red-600" : ngo.workload_percent > 33 ? "text-amber-600" : "text-emerald-600"}`}>{ngo.workload_percent}%</div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className={`h-full rounded-full transition-all ${ngo.workload_percent > 66 ? "bg-red-500" : ngo.workload_percent > 33 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${ngo.workload_percent}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ngo.resources.map((r) => (
                        <span key={r} className="text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Village Story Section ───────────────────────────────────────────────
function VillageStorySection({ villages, onComplete, onAssignNgo }: { villages: Village[]; onComplete?: (id: string) => void; onAssignNgo?: (v: Village) => void }) {
  const critical = villages.filter((v) => v.status === "critical");
  const moderate = villages.filter((v) => v.status === "moderate");
  const shown = [...critical, ...moderate].slice(0, 4);
  if (shown.length === 0) return null;

  const needIcon: Record<string, string> = {
    "Food": "🍽", "Medical": "🏥", "Water": "💧",
    "Shelter": "⛺", "Blanket": "🛡", "Grain": "🌾",
  };
  function pickIcon(needs: string) {
    const hit = Object.entries(needIcon).find(([k]) => needs.toLowerCase().includes(k.toLowerCase()));
    return hit ? hit[1] : "📦";
  }

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,32%,91%)] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-red-50 p-2 rounded-lg">
          <AlertTriangle size={15} className="text-red-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[hsl(222,47%,11%)]">Village Crisis Reports</h3>
          <p className="text-[10px] text-[hsl(215,16%,47%)]">{critical.length} critical · {moderate.length} moderate requiring urgent aid</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shown.map((v) => (
          <div key={v.id} className={`rounded-xl border p-4 ${
            v.status === "critical"
              ? "border-red-200 bg-gradient-to-br from-red-50 to-rose-50"
              : "border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50"
          }`}>
            <div className="flex items-start justify-between mb-2.5">
              <div>
                <div className="text-sm font-bold text-[hsl(222,47%,11%)]">{v.name}</div>
                <div className="text-[10px] text-[hsl(215,16%,47%)]">{v.state}</div>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shrink-0 ${
                v.status === "critical" ? "bg-red-500 text-white" : "bg-amber-500 text-white"
              }`}>
                {v.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div>
                <div className="text-[9px] text-[hsl(215,16%,47%)] uppercase tracking-wide font-semibold">Families</div>
                <div className="text-xl font-black text-[hsl(222,47%,11%)]">{v.families.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] text-[hsl(215,16%,47%)] uppercase tracking-wide font-semibold">Priority</div>
                <div className="text-xl font-black text-[hsl(222,47%,11%)]">{v.priority_breakdown.final_priority_score}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[hsl(222,47%,11%)] font-medium mb-2">
              <span>{pickIcon(v.needs)}</span>
              <span className="truncate">{v.needs}</span>
            </div>
            {v.aid_received > 0 && (
              <div>
                <div className="flex justify-between text-[9px] text-[hsl(215,16%,47%)] mb-1">
                  <span>Aid Received</span>
                  <span>{v.aid_received}%</span>
                </div>
                <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${v.status === "critical" ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${Math.min(v.aid_received, 100)}%` }} />
                </div>
              </div>
            )}
            {v.assigned_ngo ? (
              <div className="mt-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-semibold text-emerald-800">{v.assigned_ngo.name} dispatched</span>
                </div>
                {v.delivery_status && (
                  <span className="text-[9px] font-bold text-blue-700">
                    {DELIVERY_STEPS.find((s) => s.key === v.delivery_status)?.icon}{" "}
                    {DELIVERY_STEPS.find((s) => s.key === v.delivery_status)?.label}
                  </span>
                )}
              </div>
            ) : (
              onAssignNgo && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAssignNgo(v); }}
                  className="mt-2.5 w-full text-[10px] font-bold py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  <Users size={10} /> Assign NGO
                </button>
              )
            )}
            {onComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(v.id); }}
                className="mt-1.5 w-full text-[10px] font-bold py-1.5 bg-white/70 hover:bg-emerald-100 border border-white hover:border-emerald-300 text-slate-600 hover:text-emerald-700 rounded-lg flex items-center justify-center gap-1 transition-colors"
              >
                <CircleCheck size={10} /> Mark Complete & Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty State — No Active Incidents ───────────────────────────────────
function EmptyStateMonitor() {
  const checks = [
    { label: "Monitoring Active",       ok: true  },
    { label: "No Critical Incidents",   ok: true  },
    { label: "Weather Conditions Stable", ok: true },
    { label: "ReliefHub Standing By",   ok: true  },
  ];
  return (
    <div className="bg-white rounded-2xl border border-[hsl(214,32%,91%)] shadow-sm overflow-hidden">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-[hsl(222,47%,11%)] to-[hsl(222,47%,18%)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 border border-emerald-500/40 p-2.5 rounded-xl">
            <Shield size={20} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">Normal Monitoring State</div>
            <div className="text-[10px] text-slate-400">No active disaster incidents detected</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">All Clear</span>
        </div>
      </div>

      {/* Status checks */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-6">
          {checks.map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-3 bg-[hsl(210,40%,98%)] border border-[hsl(214,32%,91%)] rounded-xl px-4 py-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckCircle size={14} className="text-emerald-600" />
              </div>
              <span className="text-[11px] font-semibold text-[hsl(222,47%,11%)]">{label}</span>
            </div>
          ))}
        </div>

        {/* Info block */}
        <div className="bg-[hsl(210,40%,98%)] border border-[hsl(214,32%,91%)] rounded-xl p-4 flex items-start gap-3">
          <div className="bg-blue-50 border border-blue-100 p-2 rounded-lg shrink-0 mt-0.5">
            <Info size={14} className="text-blue-500" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[hsl(222,47%,11%)] mb-1">No active disaster incidents detected.</div>
            <p className="text-[10px] text-[hsl(215,16%,47%)] leading-relaxed">
              The live dashboard only displays verified, real-world reports. When a field responder submits an SOS or a verified disaster event is registered, sectors will appear here automatically.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="text-[10px] text-[hsl(215,16%,47%)]">
            To run drills and test scenarios, visit the <span className="font-semibold text-[hsl(222,47%,11%)]">Simulation Dashboard</span> at <span className="font-mono text-[10px] bg-[hsl(210,40%,96%)] px-1.5 py-0.5 rounded">/testing</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────
// ── Simulation Control Panel ────────────────────────────────────────────
const SCENARIOS = [
  { key: "cascade", label: "Multi-State Cascade", icon: "🌊", desc: "Flood + Cyclone + Landslide" },
  { key: "earthquake", label: "Earthquake Response", icon: "🏚️", desc: "Gujarat Seismic Zone" },
  { key: "drought", label: "Drought & Famine", icon: "☀️", desc: "Rajasthan Crisis" },
];

const QUICK_EVENTS = [
  { label: "Flood Zone", icon: "🌊", resource: "Emergency Food Kits", severity: 88,
    lat: 25.6, lng: 85.1, state: "Bihar", families: 320 },
  { label: "Cyclone Hit", icon: "🌀", resource: "Temporary Shelter", severity: 85,
    lat: 15.3, lng: 80.0, state: "Andhra Pradesh", families: 265 },
  { label: "Earthquake", icon: "🏚️", resource: "Medical Aid", severity: 92,
    lat: 23.2, lng: 77.4, state: "Madhya Pradesh", families: 410 },
  { label: "Heatwave", icon: "🔥", resource: "Food Grains & Water", severity: 60,
    lat: 28.7, lng: 77.1, state: "Delhi", families: 150 },
];

function SimulationControlPanel({ base, onRefresh }: { base: string; onRefresh: () => void }) {
  const [scenario, setScenario] = useState("cascade");
  const [switching, setSwitching] = useState(false);
  const [injecting, setInjecting] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  async function handleScenarioSwitch(key: string) {
    if (key === scenario) return;
    setSwitching(true);
    setLastAction(null);
    try {
      await apiPost(`${base}/switch-scenario`, { scenario: key });
      setScenario(key);
      setLastAction(`Switched to ${SCENARIOS.find(s => s.key === key)?.label}`);
      onRefresh();
    } finally {
      setSwitching(false);
    }
  }

  async function handleReset() {
    setSwitching(true);
    setLastAction(null);
    try {
      await apiPost(`${base}/reset`, {});
      setScenario("cascade");
      setLastAction("Scenario reset to Multi-State Cascade");
      onRefresh();
    } finally {
      setSwitching(false);
    }
  }

  async function handleInject(ev: typeof QUICK_EVENTS[0]) {
    setInjecting(ev.label);
    try {
      await apiPost(`${base}/sos`, {
        village: ev.label,
        resource: ev.resource,
        families: ev.families,
        severity_indicator: ev.severity,
        crowd_verification_count: 4,
        lat: ev.lat,
        lng: ev.lng,
        state: ev.state,
      });
      setLastAction(`Injected: ${ev.icon} ${ev.label}`);
      onRefresh();
    } finally {
      setInjecting(null);
    }
  }

  const active = SCENARIOS.find(s => s.key === scenario)!;

  return (
    <div className="flex flex-col gap-2">
      {/* Alert bar */}
      <div className="bg-red-600 text-white rounded-xl px-5 py-3 flex items-center gap-3 shadow-md">
        <FlaskConical size={18} className="shrink-0" />
        <div>
          <div className="text-sm font-bold">⚠ SIMULATION MODE — Disaster Scenario Active</div>
          <div className="text-[11px] text-red-100">
            {active.icon} {active.desc} — All data is simulated for demonstration purposes
          </div>
        </div>
        <div className="ml-auto bg-red-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0">
          DEMO ONLY
        </div>
      </div>

      {/* Control bar */}
      <div className="bg-white border border-[hsl(214,32%,91%)] rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        {/* Scenario selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[hsl(215,16%,47%)] uppercase tracking-wide">Scenario</span>
          <div className="flex gap-1">
            {SCENARIOS.map(s => (
              <button
                key={s.key}
                onClick={() => handleScenarioSwitch(s.key)}
                disabled={switching}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  scenario === s.key
                    ? "bg-[hsl(222,47%,11%)] text-white"
                    : "bg-[hsl(210,40%,96%)] text-[hsl(222,47%,11%)] hover:bg-[hsl(210,40%,92%)]"
                } disabled:opacity-50`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-[hsl(214,32%,91%)]" />

        {/* Quick inject */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-[hsl(215,16%,47%)] uppercase tracking-wide">Inject Event</span>
          {QUICK_EVENTS.map(ev => (
            <button
              key={ev.label}
              onClick={() => handleInject(ev)}
              disabled={!!injecting}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-all disabled:opacity-50"
            >
              {injecting === ev.label ? "…" : `${ev.icon} ${ev.label}`}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-[hsl(214,32%,91%)]" />

        {/* Reset */}
        <button
          onClick={handleReset}
          disabled={switching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50 ml-auto"
        >
          <RefreshCcw size={12} />
          {switching ? "Resetting…" : "Reset Scenario"}
        </button>

        {/* Last action feedback */}
        {lastAction && (
          <span className="text-[10px] text-[hsl(142,76%,36%)] font-semibold ml-1">✓ {lastAction}</span>
        )}
      </div>
    </div>
  );
}

function Dashboard({ mode = "live" }: { mode?: "live" | "testing" }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [villages, setVillages] = useState<Village[]>([]);
  const [supply, setSupply] = useState<SupplyData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("ReliefHub coordination matrix online — all systems operational.");
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);
  const [selectedState, setSelectedState] = useState<string>("");

  const [sosQueue, setSosQueue] = useState<Village[]>([]);

  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosGeoStatus, setSosGeoStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [sosGeoPos, setSosGeoPos] = useState<{ lat: number; lng: number } | null>(null);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosToast, setSosToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sosMarkersList, setSosMarkersList] = useState<SosMarker[]>([]);
  const [ngoCheckins, setNgoCheckins] = useState<NgoCheckin[]>([]);
  const [ngoAssignVillage, setNgoAssignVillage] = useState<Village | null>(null);
  const [generating, setGenerating] = useState(false);

  const base = mode === "testing" ? "/testing" : "";

  async function loadAll() {
    setLoading(true);
    try {
      const [d, rawVillages, s, a, act, liveNgos] = await Promise.all([
        apiGet<DashboardData>(`${base}/dashboard`),
        mode === "testing"
          ? apiGet<TestingVillagesResponse>(`${base}/villages`)
          : apiGet<Village[]>(`${base}/villages`),
        apiGet<SupplyData>(`${base}/supply-tracking`),
        apiGet<AnalyticsData>(`${base}/analytics`),
        apiGet<ActivitiesResponse>(`${base}/activities`),
        apiGet<NgoCheckin[]>(`/ngos`),
      ]);
      const v = mode === "testing"
        ? (rawVillages as TestingVillagesResponse).villages
        : (rawVillages as Village[]);
      if (mode === "testing") {
        setSosQueue((rawVillages as TestingVillagesResponse).sos_queue ?? []);
      }
      setDashboard(d);
      setVillages(v);
      setSupply(s);
      setAnalytics(a);
      setActivities(act.activities);
      setNgoCheckins(liveNgos);
      const crit = v.filter((x) => x.status === "critical").length;
      if (mode === "live" && v.length === 0) {
        setTicker("Monitoring active — no active incidents detected. All systems normal. ReliefHub standing by.");
      } else {
        setTicker(`${v.length} village sectors monitored. ${crit} critical. Priority Engine active.`);
      }
    } catch (e) {
      console.error(e);
      setTicker("Error loading data. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  async function promoteVillage(id: string) {
    try {
      await apiPost<{ ok: boolean; message: string }>(`/villages/${id}/promote`, {});
      showToast("Activated in Live Dashboard ✓", true);
      loadAll();
    } catch {
      showToast("Failed to activate village", false);
    }
  }

  async function completeVillage(id: string) {
    try {
      await apiPost<{ ok: boolean; message: string }>(`/villages/${id}/complete`, {});
      showToast("Task marked complete ✓", true);
      loadAll();
    } catch {
      showToast("Failed to complete task", false);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setSosToast({ msg, ok });
    setTimeout(() => setSosToast(null), 4000);
  }

  async function generateReport() {
    setGenerating(true);
    try {
      const data = await apiGet<Record<string, unknown>>("/report");
      const html = buildReportHtml(data);
      const w = window.open("", "_blank", "width=960,height=750");
      if (!w) { showToast("Allow pop-ups to view the report", false); return; }
      w.document.write(html);
      w.document.close();
    } catch {
      showToast("Failed to generate report", false);
    } finally {
      setGenerating(false);
    }
  }

  function openSosEmergency() {
    setSosModalOpen(true);
    setSosGeoStatus("requesting");
    setSosGeoPos(null);
    if (!navigator.geolocation) {
      setSosGeoStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSosGeoPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSosGeoStatus("granted");
      },
      () => setSosGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function submitSosEmergency() {
    if (!sosGeoPos) return;
    setSosSubmitting(true);
    try {
      const ts = new Date().toLocaleTimeString();
      const r = await apiPost<SosResponse>(`/sos`, {
        village: "Field Responder",
        resource: "Emergency Response",
        families: 50,
        priority: "CRITICAL",
        lat: sosGeoPos.lat,
        lng: sosGeoPos.lng,
        severity_indicator: 88,
        crowd_verification_count: 4,
        state: "Field",
      });
      const marker: SosMarker = {
        id: r.inserted_id,
        lat: sosGeoPos.lat,
        lng: sosGeoPos.lng,
        village: "Field Responder",
        timestamp: ts,
        families: 50,
      };
      setSosMarkersList((prev) => [...prev, marker]);
      setSosModalOpen(false);
      setSosGeoStatus("idle");
      loadAll();
      showToast(`SOS transmitted! Priority: ${r.calculated_priority.toUpperCase()} · Score: ${r.priority_breakdown.final_priority_score}`, true);
    } catch {
      showToast("SOS transmission failed. Check connection.", false);
    } finally {
      setSosSubmitting(false);
    }
  }

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 10000);
    return () => clearInterval(interval);
  }, []);

  const topVillage = villages.length > 0
    ? villages.reduce((a, b) =>
        a.priority_breakdown.final_priority_score >= b.priority_breakdown.final_priority_score ? a : b
      )
    : null;
  const displayVillage = selectedVillage ?? topVillage;
  const isDefaultVillage = !selectedVillage && !!topVillage;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[hsl(210,40%,98%)] p-4 lg:p-6 flex flex-col gap-4">
      {/* Simulation Control Panel */}
      {mode === "testing" && (
        <SimulationControlPanel base={base} onRefresh={loadAll} />
      )}

      {ngoAssignVillage && (
        <NgoAssignModal
          village={ngoAssignVillage}
          onClose={() => setNgoAssignVillage(null)}
          onAssigned={() => { loadAll(); setNgoAssignVillage(null); }}
        />
      )}

      {/* SOS Incoming Queue — simulation mode only */}
      {mode === "testing" && sosQueue.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-orange-100 p-2 rounded-xl shrink-0">
              <AlertTriangle size={16} className="text-orange-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-orange-900">Incoming SOS Queue</div>
              <div className="text-[10px] text-orange-700">{sosQueue.length} unconfirmed SOS request{sosQueue.length > 1 ? "s" : ""} — awaiting review before Live Dashboard activation</div>
            </div>
            <span className="bg-orange-200 text-orange-800 text-[10px] font-black px-2 py-0.5 rounded-full">{sosQueue.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {sosQueue.map((v) => (
              <div key={v.id} className="flex items-center gap-3 bg-white border border-orange-100 rounded-xl px-3 py-2.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${v.status === "critical" ? "bg-red-500 animate-pulse" : "bg-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{v.name}</div>
                  <div className="text-[10px] text-slate-500">{v.families} families · {v.needs} · Priority {v.priority_breakdown.final_priority_score}</div>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap">
                  <button
                    onClick={() => promoteVillage(v.id)}
                    className="text-[10px] font-bold px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <CircleCheck size={10} /> Activate in Live
                  </button>
                  <button
                    onClick={() => setNgoAssignVillage(v)}
                    className="text-[10px] font-bold px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Users size={10} /> Assign NGO
                  </button>
                  <button
                    onClick={() => completeVillage(v.id)}
                    className="text-[10px] font-bold px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                  >
                    ✕ Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {sosToast && (
        <div className={`fixed top-16 right-4 z-[10000] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all animate-fade-in ${
          sosToast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {sosToast.ok ? <Bell size={16} /> : <AlertTriangle size={16} />}
          {sosToast.msg}
        </div>
      )}

      {/* Emergency SOS Modal */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-3 rounded-xl">
                <Zap size={22} className="text-red-600" />
              </div>
              <div>
                <div className="text-base font-bold text-[hsl(222,47%,11%)]">Emergency SOS</div>
                <div className="text-[11px] text-[hsl(215,16%,47%)]">Transmit your GPS location to dispatch</div>
              </div>
              <button
                className="ml-auto p-1.5 hover:bg-[hsl(210,40%,96%)] rounded-lg"
                onClick={() => { setSosModalOpen(false); setSosGeoStatus("idle"); }}
              >
                <X size={16} className="text-[hsl(215,16%,47%)]" />
              </button>
            </div>

            {sosGeoStatus === "requesting" && (
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-10 h-10 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
                <p className="text-sm text-[hsl(215,16%,47%)]">Acquiring GPS location…</p>
                <p className="text-[10px] text-[hsl(215,16%,47%)]">Please allow location access when prompted</p>
              </div>
            )}

            {sosGeoStatus === "denied" && (
              <div className="flex flex-col items-center py-4 gap-3 text-center">
                <div className="bg-red-100 p-3 rounded-full">
                  <MapPin size={24} className="text-red-500" />
                </div>
                <p className="text-sm font-semibold text-red-700">Location access denied</p>
                <p className="text-[11px] text-[hsl(215,16%,47%)] leading-relaxed">
                  Enable location in your browser settings (tap the lock icon in the address bar), then try again.
                </p>
                <button
                  className="mt-1 w-full min-h-[44px] bg-[hsl(210,40%,96%)] text-[hsl(222,47%,11%)] text-sm font-semibold py-2.5 rounded-xl"
                  onClick={() => { setSosModalOpen(false); setSosGeoStatus("idle"); }}
                >
                  Close
                </button>
              </div>
            )}

            {sosGeoStatus === "granted" && sosGeoPos && (
              <div className="flex flex-col gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0 animate-pulse" />
                  <div>
                    <div className="text-[11px] font-bold text-emerald-700 mb-0.5">GPS Acquired</div>
                    <div className="text-[10px] text-emerald-600">{sosGeoPos.lat.toFixed(5)}°N, {sosGeoPos.lng.toFixed(5)}°E</div>
                  </div>
                </div>
                <p className="text-[11px] text-[hsl(215,16%,47%)] leading-relaxed">
                  Your coordinates will be transmitted to the ReliefHub coordination matrix and a pulsing marker will appear on the live map for all NGOs to see.
                </p>
                <button
                  className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-200"
                  onClick={submitSosEmergency}
                  disabled={sosSubmitting}
                >
                  {sosSubmitting ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Transmitting…</>
                  ) : (
                    <><Zap size={16} /> Transmit Emergency SOS</>
                  )}
                </button>
                <button
                  className="w-full min-h-[44px] bg-[hsl(210,40%,96%)] text-[hsl(222,47%,11%)] text-sm font-semibold py-2.5 rounded-xl"
                  onClick={() => { setSosModalOpen(false); setSosGeoStatus("idle"); }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border border-[hsl(214,32%,91%)] px-4 sm:px-5 py-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${mode === "testing" ? "bg-red-100" : "bg-[hsl(142,76%,93%)]"}`}>
            {mode === "testing"
              ? <FlaskConical size={22} className="text-red-600" />
              : <Shield size={22} className="text-[hsl(142,76%,36%)]" />}
          </div>
          <div>
            <div className="text-lg font-bold text-[hsl(222,47%,11%)] tracking-tight">
              ReliefHub {mode === "testing" ? "— Simulation" : ""}
            </div>
            <div className="text-[11px] text-[hsl(215,16%,47%)]">
              {mode === "testing"
                ? "Disaster Scenario Testing Environment"
                : "AI-Powered Disaster Relief Coordination Platform"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateReport}
            disabled={generating}
            className="flex items-center gap-1.5 min-h-[44px] px-3 sm:px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-[11px] sm:text-xs font-bold transition-colors disabled:opacity-60"
            title="Generate printable situation report"
          >
            <Printer size={14} className="shrink-0" />
            <span className="hidden sm:inline">{generating ? "Generating…" : "Situation Report"}</span>
          </button>
          {mode === "live" && (
            <button
              onClick={openSosEmergency}
              className="flex items-center gap-1.5 min-h-[44px] px-3 sm:px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-xs font-bold transition-colors shadow-md shadow-red-200"
            >
              <Zap size={14} className="shrink-0" />
              <span className="hidden sm:inline">⚡ 91-SOS EMERGENCY</span>
              <span className="sm:hidden">SOS</span>
            </button>
          )}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-full ${mode === "testing" ? "bg-red-50" : "bg-[hsl(210,40%,96%)]"}`}>
            <div className={`w-2 h-2 rounded-full animate-[pulse-ring_2s_infinite] ${mode === "testing" ? "bg-red-500" : "bg-[hsl(142,76%,36%)]"}`} />
            <span className="text-[11px] font-semibold text-[hsl(215,16%,47%)]">
              {mode === "testing" ? "Simulation Mode: Active" : "Live Regional Sync: Active"}
            </span>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Villages Affected"
          value={dashboard?.villages_affected ?? "—"}
          icon={<MapPin size={16} />}
          accent="bg-[hsl(210,40%,96%)] text-[hsl(222,47%,11%)]"
        />
        <KpiCard
          label="Families Helped"
          value={dashboard?.families_helped?.toLocaleString() ?? "—"}
          icon={<Users size={16} />}
          accent="bg-[hsl(142,76%,93%)] text-[hsl(142,76%,36%)]"
        />
        <KpiCard
          label="Active NGOs"
          value={dashboard?.active_ngos ?? "—"}
          icon={<TrendingUp size={16} />}
          accent="bg-[hsl(210,40%,96%)] text-[hsl(222,47%,11%)]"
        />
        <KpiCard
          label="Relief Items Delivered"
          value={dashboard?.items_delivered?.toLocaleString() ?? "—"}
          icon={<Package size={16} />}
          accent="bg-[hsl(210,40%,96%)] text-[hsl(222,47%,11%)]"
        />
      </div>

      {/* Analytics KPIs — only show when there are real incidents */}
      {analytics && !(mode === "live" && villages.length === 0) && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-red-200 p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3">
            <div className="bg-red-100 p-2 rounded-lg shrink-0"><AlertTriangle size={16} className="text-red-600" /></div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-red-700">{analytics.critical}</div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-red-600 uppercase tracking-wider">Critical Villages</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3">
            <div className="bg-amber-100 p-2 rounded-lg shrink-0"><AlertOctagon size={16} className="text-amber-600" /></div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-amber-700">{analytics.moderate}</div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Moderate Villages</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-3 sm:p-4 shadow-sm flex items-center gap-2 sm:gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg shrink-0"><CircleCheck size={16} className="text-emerald-600" /></div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-700">{analytics.covered}</div>
              <div className="text-[9px] sm:text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Covered Villages</div>
            </div>
          </div>
        </div>
      )}

      {/* Village Story Section */}
      <VillageStorySection villages={villages} onComplete={completeVillage} onAssignNgo={setNgoAssignVillage} />

      {/* Empty State — live mode with no incidents */}
      {mode === "live" && villages.length === 0 && !loading && (
        <EmptyStateMonitor />
      )}

      {/* Main Grid */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1">
        {/* Left Column */}
        <div className="flex-[1.2] flex flex-col gap-4">
          <MapPanel
            villages={villages}
            onVillageSelect={setSelectedVillage}
            selectedVillage={selectedVillage}
            selectedState={selectedState}
            sosMarkers={sosMarkersList}
            ngoCheckins={ngoCheckins}
          />
          <PriorityEnginePanel
            village={displayVillage}
            onClose={() => setSelectedVillage(null)}
            isDefault={isDefaultVillage}
            onAssignNgo={setNgoAssignVillage}
            onRefresh={loadAll}
          />
          <SupplyPanel supply={supply} />
        </div>

        {/* Right Column */}
        <div className="flex-[1.5] flex flex-col gap-4">
          <AiPanel villages={villages} onAction={loadAll} selectedState={selectedState} onStateChange={setSelectedState} apiBase={base} />
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <SosPanel onSuccess={loadAll} apiBase={base} />
            </div>
            <div className="flex-1">
              <ChatPanel apiBase={base} />
            </div>
          </div>
          <ActivityFeed activities={activities} />
        </div>
      </div>

      {/* Footer Ticker */}
      <footer className="bg-white border border-[hsl(214,32%,91%)] px-4 sm:px-5 py-2.5 rounded-xl shadow-sm flex items-center gap-3 text-[11px]">
        <span className="text-[hsl(142,76%,36%)] font-bold uppercase tracking-wider shrink-0">System Event</span>
        <span className="text-[hsl(215,16%,47%)] font-medium truncate">[{new Date().toLocaleTimeString()}] — {ticker}</span>
      </footer>
    </div>
  );
}

function WithNav({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

function LanguageGate({ children }: { children: React.ReactNode }) {
  const { showSelector } = useLanguage();
  return (
    <>
      {showSelector && <LanguageSelectScreen />}
      {children}
    </>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  return (
    <>
      {!splashDone && <SplashScreen onDone={handleSplashDone} />}
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <LanguageGate>
            <Routes>
              <RRRoute path="/" element={<LandingPage />} />
              <RRRoute path="/dashboard" element={<WithNav><Dashboard mode="live" /></WithNav>} />
              <RRRoute path="/testing" element={<WithNav><Dashboard mode="testing" /></WithNav>} />
              <RRRoute path="/radar" element={<WithNav><RadarPage /></WithNav>} />
            </Routes>
          </LanguageGate>
        </QueryClientProvider>
      </LanguageProvider>
    </>
  );
}

export default App;
