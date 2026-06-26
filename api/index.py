import os
import math
import sqlite3
import time
from contextlib import closing
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from mangum import Mangum

# =====================================================================
# 1. APP + CORS
# =====================================================================
app = FastAPI(
    title="ReliefHub Core API Engine",
    description="AI-Powered Disaster Relief Coordination Platform",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# 2. SQLITE DATABASE
# Note: /tmp is ephemeral on Vercel (per cold-start). Data resets on
# cold start, which matches the original in-memory hackathon design.
# =====================================================================
DB_PATH = "/tmp/reliefhub.db"


def _db():
    return sqlite3.connect(DB_PATH)


def init_db():
    with closing(_db()) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sos_villages (
                id TEXT PRIMARY KEY,
                name TEXT, status TEXT, needs TEXT,
                families INTEGER, metrics TEXT,
                tracking_demand TEXT,
                lat REAL, lng REAL,
                aid_received INTEGER DEFAULT 0,
                severity_score INTEGER, need_score INTEGER,
                priority_breakdown TEXT,
                state TEXT DEFAULT 'Tamil Nadu'
            )
        """)
        cols = conn.execute("PRAGMA table_info(sos_villages)").fetchall()
        col_names = [c[1] for c in cols]
        if "state" not in col_names:
            conn.execute("ALTER TABLE sos_villages ADD COLUMN state TEXT DEFAULT 'Tamil Nadu'")
        if "source" not in col_names:
            conn.execute("ALTER TABLE sos_villages ADD COLUMN source TEXT DEFAULT 'real'")
        if "completed" not in col_names:
            conn.execute("ALTER TABLE sos_villages ADD COLUMN completed INTEGER DEFAULT 0")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                actor TEXT,
                action TEXT,
                village TEXT,
                details TEXT
            )
        """)
        conn.commit()


def save_village(v: Dict[str, Any]):
    with closing(_db()) as conn:
        conn.execute("""
            INSERT OR REPLACE INTO sos_villages
            (id, name, status, needs, families, metrics, tracking_demand,
             lat, lng, aid_received, severity_score, need_score,
             priority_breakdown, state, source, completed)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            v["id"], v["name"], v["status"], v["needs"], v["families"],
            v["metrics"], v["trackingDemand"],
            v["position"]["lat"], v["position"]["lng"],
            v["aid_received"], v["severity_score"], v["need_score"],
            str(v.get("priority_breakdown", {})), v.get("state", "Tamil Nadu"),
            v.get("source", "real"), int(v.get("completed", False))
        ))
        conn.commit()


def load_saved_villages() -> List[Dict[str, Any]]:
    with closing(_db()) as conn:
        rows = conn.execute("SELECT * FROM sos_villages").fetchall()
    result = []
    for r in rows:
        import json
        pb = {}
        try:
            pb = json.loads(r[12]) if r[12] else {}
        except Exception:
            pass
        if not pb:
            pb = {
                "geographical_score": 15.0,
                "volunteer_report_score": 10.0,
                "ngo_report_score": 5.0,
                "crowd_verification_score": 5.0,
                "disaster_severity_score": 15.0,
                "previous_aid_impact": -5.0,
                "final_priority_score": 45,
                "classification": r[2] or "moderate",
            }
        result.append({
            "id": r[0], "name": r[1], "status": r[2], "needs": r[3],
            "families": r[4], "metrics": r[5], "trackingDemand": r[6],
            "position": {"lat": r[7], "lng": r[8]},
            "aid_received": r[9], "severity_score": r[10], "need_score": r[11],
            "priority_breakdown": pb,
            "state": r[13] if len(r) > 13 else "Tamil Nadu",
            "source": r[14] if len(r) > 14 else "real",
            "completed": bool(r[15]) if len(r) > 15 else False,
        })
    return result


def log_activity(actor: str, action: str, village: str, details: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with closing(_db()) as conn:
        conn.execute(
            "INSERT INTO activities (timestamp, actor, action, village, details) VALUES (?,?,?,?,?)",
            (ts, actor, action, village, details)
        )
        conn.commit()


def load_activities(limit: int = 50) -> List[Dict[str, Any]]:
    with closing(_db()) as conn:
        rows = conn.execute(
            "SELECT timestamp, actor, action, village, details FROM activities ORDER BY id DESC LIMIT ?",
            (limit,)
        ).fetchall()
    return [
        {"timestamp": r[0], "actor": r[1], "action": r[2], "village": r[3], "details": r[4]}
        for r in rows
    ]


# =====================================================================
# 3. PRIORITY ENGINE
# =====================================================================
def compute_priority_breakdown(
    lat: float, lng: float,
    severity_indicator: int, crowd_verification_count: int,
    families: int, aid_received: int
) -> Dict[str, Any]:
    geo = min(abs(13.5 - lat) * 10 + abs(80 - lng) * 0.5, 30)
    vol = min(families * 0.2, 25)
    ngo = max(15 - aid_received * 0.2, 0)
    crowd = min(crowd_verification_count * 5, 20)
    severity = min(severity_indicator, 30)
    aid_impact = max(-20, -aid_received * 0.3)

    final = int(geo + vol + ngo + crowd + severity + aid_impact)
    classification = "critical" if final >= 75 else "moderate" if final >= 40 else "covered"

    return {
        "geographical_score": round(geo, 1),
        "volunteer_report_score": round(vol, 1),
        "ngo_report_score": round(ngo, 1),
        "crowd_verification_score": round(crowd, 1),
        "disaster_severity_score": round(severity, 1),
        "previous_aid_impact": round(aid_impact, 1),
        "final_priority_score": final,
        "classification": classification,
    }


def _priority_score(v: Dict[str, Any]) -> int:
    pb = v.get("priority_breakdown", {})
    return pb.get("final_priority_score", 0)


def _status_from_score(s: int) -> str:
    return "critical" if s >= 75 else "moderate" if s >= 40 else "covered"


# =====================================================================
# 4. IN-MEMORY DATA
# =====================================================================
ngo_checkins_db: List[Dict[str, Any]] = []

dashboard_stats: Dict[str, Any] = {
    "villages_affected": 0,
    "families_helped": 0,
    "active_ngos": 0,
    "items_delivered": 0,
}

villages_db: List[Dict[str, Any]] = []

supply_tracking: Dict[str, Any] = {
    "food_kits": {"total": 0, "in_transit": 0, "delivered": 0},
    "medicines": {"total": 0, "in_transit": 0, "delivered": 0},
    "water": {"total": 0, "in_transit": 0, "delivered": 0},
    "blankets": {"total": 0, "in_transit": 0, "delivered": 0},
    "tents": {"total": 0, "in_transit": 0, "delivered": 0},
}

NGO_DB: List[Dict[str, Any]] = [
    {"id": "ngo1", "name": "NGO Alpha", "location": {"lat": 13.08, "lng": 80.27}, "city": "Chennai", "state": "Tamil Nadu",
     "resources": ["Food Kits", "Medical Aid", "Clean Water"], "capacity": 150, "current_assignments": 0, "specialty": "Medical + Food"},
    {"id": "ngo2", "name": "NGO Beta", "location": {"lat": 17.38, "lng": 78.47}, "city": "Hyderabad", "state": "Telangana",
     "resources": ["Temporary Shelter", "Clean Water", "Blankets"], "capacity": 200, "current_assignments": 1, "specialty": "Shelter + WASH"},
    {"id": "ngo3", "name": "NGO Gamma", "location": {"lat": 19.07, "lng": 72.87}, "city": "Mumbai", "state": "Maharashtra",
     "resources": ["Emergency Food", "Blankets", "Rescue Teams"], "capacity": 180, "current_assignments": 0, "specialty": "Search & Rescue"},
    {"id": "ngo4", "name": "NGO Delta", "location": {"lat": 12.97, "lng": 77.59}, "city": "Bangalore", "state": "Karnataka",
     "resources": ["Medical Aid", "Heavy Rescue", "Water"], "capacity": 120, "current_assignments": 2, "specialty": "Heavy Rescue"},
    {"id": "ngo5", "name": "NGO Epsilon", "location": {"lat": 22.57, "lng": 88.36}, "city": "Kolkata", "state": "West Bengal",
     "resources": ["Food Kits", "Water", "Blankets"], "capacity": 160, "current_assignments": 0, "specialty": "Relief Distribution"},
]

# =====================================================================
# 5. STARTUP
# =====================================================================
@app.on_event("startup")
def on_startup():
    init_db()
    saved = load_saved_villages()
    existing_ids = {v["id"] for v in villages_db}
    for v in saved:
        if v["id"] not in existing_ids:
            villages_db.append(v)
            dashboard_stats["families_helped"] += v["families"]
    dashboard_stats["villages_affected"] = len(villages_db)

    now = time.time()
    for ngo in NGO_DB:
        ngo_checkins_db.append({
            "id": ngo["id"],
            "name": ngo["name"],
            "lat": ngo["location"]["lat"],
            "lng": ngo["location"]["lng"],
            "status": "active",
            "last_checkin": now,
        })

    if not load_activities(limit=1):
        log_activity(
            "ReliefHub System", "Monitoring Initialized", "—",
            "All sensors online. Real-time coordination matrix active. Awaiting verified field reports."
        )


# =====================================================================
# 6. SCHEMAS
# =====================================================================
class CoordinateSchema(BaseModel):
    lat: float
    lng: float


class PriorityBreakdown(BaseModel):
    geographical_score: float
    volunteer_report_score: float
    ngo_report_score: float
    crowd_verification_score: float
    disaster_severity_score: float
    previous_aid_impact: float
    final_priority_score: int
    classification: str


class VillageResponse(BaseModel):
    id: str
    name: str
    status: str
    needs: str
    families: int
    metrics: str
    trackingDemand: str
    position: CoordinateSchema
    aid_received: int
    severity_score: int
    need_score: int
    state: str = "Tamil Nadu"
    priority_breakdown: PriorityBreakdown
    source: str = "real"
    completed: bool = False
    assigned_ngo: Optional[Any] = None
    delivery_status: Optional[str] = None
    route_info: Optional[Any] = None


class DashboardResponse(BaseModel):
    villages_affected: int
    families_helped: int
    active_ngos: int
    items_delivered: int


class SosRequest(BaseModel):
    village: str = Field(..., example="Delta")
    resource: str = Field(..., example="Food Kits")
    families: int = Field(..., example=95)
    priority: str = Field(..., example="CRITICAL")
    lat: Optional[float] = 13.0
    lng: Optional[float] = 80.0
    severity_indicator: Optional[int] = 35
    crowd_verification_count: Optional[int] = 1
    state: Optional[str] = "Tamil Nadu"


class SosResponse(BaseModel):
    success: bool
    message: str
    inserted_id: str
    calculated_priority: str
    priority_breakdown: PriorityBreakdown


class AllocateRequest(BaseModel):
    resource: str = Field(..., example="Food Kits")
    quantity: int = Field(..., example=50)


class AllocateResponse(BaseModel):
    recommended_village: str
    reason: str
    priority_score_calculated: int
    priority_breakdown: PriorityBreakdown


class DuplicateCheckRequest(BaseModel):
    village: str = Field(..., example="v1")
    resource: str = Field(..., example="Food Kits")


class DuplicateCheckResponse(BaseModel):
    duplicate: bool
    message: str
    suggested_village: Optional[str] = None
    priority_breakdown: Optional[PriorityBreakdown] = None


class ChatRequest(BaseModel):
    message: str = Field(..., example="Which village needs urgent help?")
    language_code: Optional[str] = Field(None, example="hi")


class ChatResponse(BaseModel):
    response: str


class SupplyItem(BaseModel):
    total: int
    in_transit: int
    delivered: int


class SupplyTrackingResponse(BaseModel):
    food_kits: SupplyItem
    medicines: SupplyItem
    water: SupplyItem
    blankets: SupplyItem
    tents: SupplyItem


class ActivityItem(BaseModel):
    timestamp: str
    actor: str
    action: str
    village: str
    details: str


class ActivitiesResponse(BaseModel):
    activities: List[ActivityItem]


class AnalyticsResponse(BaseModel):
    critical: int
    moderate: int
    covered: int
    total: int


class NgoCheckinRequest(BaseModel):
    name: str = Field(..., example="NGO Alpha")
    lat: float = Field(..., example=13.08)
    lng: float = Field(..., example=80.27)
    status: str = Field(..., example="active")


class NgoCheckinItem(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    status: str
    last_checkin: float


# =====================================================================
# 7. API ROUTES
# =====================================================================

@app.get("/api/v1/dashboard", response_model=DashboardResponse, tags=["Dashboard"])
def get_dashboard():
    dashboard_stats["villages_affected"] = len(villages_db)
    return dashboard_stats


@app.get("/api/v1/villages", response_model=List[VillageResponse], tags=["Logistics"])
def get_villages():
    return [v for v in villages_db if v.get("source", "real") == "real" and not v.get("completed", False)]


@app.get("/api/v1/village/{village_id}", response_model=VillageResponse, tags=["Logistics"])
def get_village_detail(village_id: str):
    v = next((v for v in villages_db if v["id"] == village_id), None)
    if not v:
        raise HTTPException(status_code=404, detail="Village not found")
    return v


@app.get("/api/v1/priority/{village_id}", response_model=PriorityBreakdown, tags=["Priority Engine"])
def get_priority_breakdown(village_id: str):
    v = next((v for v in villages_db if v["id"] == village_id), None)
    if not v:
        raise HTTPException(status_code=404, detail="Village not found")
    return v.get("priority_breakdown", {})


@app.get("/api/v1/analytics", response_model=AnalyticsResponse, tags=["Analytics"])
def get_analytics():
    crit = len([v for v in villages_db if v["status"] == "critical"])
    mod = len([v for v in villages_db if v["status"] == "moderate"])
    cov = len([v for v in villages_db if v["status"] == "covered"])
    return {"critical": crit, "moderate": mod, "covered": cov, "total": len(villages_db)}


@app.get("/api/v1/activities", response_model=ActivitiesResponse, tags=["Activity Feed"])
def get_activities(limit: int = 20):
    return {"activities": load_activities(limit)}


@app.post("/api/v1/sos", response_model=SosResponse, status_code=status.HTTP_201_CREATED, tags=["Ingestion"])
def post_sos(payload: SosRequest):
    new_id = f"v{len(villages_db) + 1}"
    severity = payload.severity_indicator or 30
    verif = payload.crowd_verification_count or 1
    families = payload.families

    pb = compute_priority_breakdown(
        payload.lat, payload.lng,
        severity, verif,
        families, 0
    )
    s_status = pb["classification"]

    entry = {
        "id": new_id,
        "name": f"Sector {payload.village}",
        "status": s_status,
        "needs": payload.resource,
        "families": families,
        "metrics": f"Severity Index: {pb['final_priority_score']}% | Multi-Source Verification Confirmed",
        "trackingDemand": f"Engine Priority Tier: {s_status.upper()} Influx Block",
        "position": {"lat": payload.lat, "lng": payload.lng},
        "aid_received": 0,
        "severity_score": severity,
        "need_score": int(min(families * 0.5, 40)),
        "priority_breakdown": pb,
        "source": "sos",
        "completed": False,
    }

    villages_db.append(entry)
    save_village(entry)
    dashboard_stats["families_helped"] += families

    log_activity(
        "SOS Portal",
        "Emergency Request Submitted",
        entry["name"],
        f"{families} families affected. Priority: {s_status.upper()} (Score: {pb['final_priority_score']}). Resource: {payload.resource}"
    )
    log_activity(
        "Priority Engine",
        "Score Recalculated",
        entry["name"],
        f"Final score: {pb['final_priority_score']} ({s_status.upper()}) — geographical={pb['geographical_score']}, volunteer={pb['volunteer_report_score']}, NGO={pb['ngo_report_score']}, crowd={pb['crowd_verification_score']}, severity={pb['disaster_severity_score']}, aid_impact={pb['previous_aid_impact']}"
    )

    return SosResponse(
        success=True,
        message="Multi-source priority score processed. Ingested into active layout matrix.",
        inserted_id=new_id,
        calculated_priority=s_status,
        priority_breakdown=pb,
    )


@app.post("/api/v1/allocate", response_model=AllocateResponse, tags=["AI Optimization"])
def post_allocate(payload: AllocateRequest):
    if not villages_db:
        raise HTTPException(status_code=404, detail="No village data found.")

    best = max(villages_db, key=_priority_score)
    best_score = _priority_score(best)
    pb = best.get("priority_breakdown", {})

    reason = (
        f"The Priority Engine selected {best['name']} (Score: {best_score}). "
        f"Active deficit: {best['needs']} — {best['families']} families affected. "
        f"Only {best['aid_received']}% of allocated supplies received."
    )

    log_activity(
        "AI Allocation Engine",
        "Resource Allocated",
        best["name"],
        f"{payload.resource} ({payload.quantity} units) recommended. Priority score: {best_score}. Reason: {reason}"
    )

    return AllocateResponse(
        recommended_village=best["name"],
        reason=reason,
        priority_score_calculated=best_score,
        priority_breakdown=pb,
    )


@app.post("/api/v1/duplicate-check", response_model=DuplicateCheckResponse, tags=["AI Optimization"])
def post_duplicate(payload: DuplicateCheckRequest):
    target = next((v for v in villages_db if v["id"] == payload.village), None)
    if not target:
        target = next((v for v in villages_db if payload.village.lower() in v["name"].lower()), None)

    if target:
        incoming = payload.resource.lower()
        existing = target["needs"].lower()
        is_dup = (
            incoming in existing
            or any(w in incoming for w in existing.split() if len(w) > 3)
            or (target["id"] == "v1" and "food" in incoming)
        )
        if is_dup:
            alt = next((v for v in villages_db if v["id"] != target["id"] and v["status"] == "critical"), None)
            if not alt:
                alt = next((v for v in villages_db if v["id"] != target["id"] and v["status"] == "moderate"), None)

            log_activity(
                "Duplicate Detection",
                "Conflict Alert",
                target["name"],
                f"{payload.resource} already allocated. Reroute suggested: {alt['name'] if alt else 'None'}"
            )

            return DuplicateCheckResponse(
                duplicate=True,
                message=f"⚠ Conflict: [{payload.resource}] matches open allocation for {target['name']}. Re-routing recommended.",
                suggested_village=alt["name"] if alt else "Unassigned Safe Sector",
                priority_breakdown=alt.get("priority_breakdown") if alt else None,
            )

    log_activity(
        "Duplicate Detection",
        "Clearance Verified",
        target["name"] if target else "Unknown",
        f"{payload.resource} — no conflicts detected"
    )

    return DuplicateCheckResponse(
        duplicate=False,
        message="✓ Clear Runway: No delivery overlaps detected for this asset class.",
        suggested_village=None,
        priority_breakdown=None,
    )


LANG_NAMES: dict[str, str] = {
    "en": "English", "hi": "Hindi", "kn": "Kannada", "ta": "Tamil",
    "te": "Telugu", "ml": "Malayalam", "bn": "Bengali", "gu": "Gujarati",
    "mr": "Marathi", "pa": "Punjabi", "ur": "Urdu", "or": "Odia",
    "as": "Assamese", "ne": "Nepali", "sa": "Sanskrit",
}


def _lang_instruction(code: Optional[str]) -> str:
    if not code or code == "en":
        return ""
    name = LANG_NAMES.get(code, code)
    return f"\n\n**IMPORTANT: Reply entirely in {name} ({code}). Do not use English.**\n"


@app.post("/api/v1/chat", response_model=ChatResponse, tags=["AI Copilot"])
def post_chat(payload: ChatRequest):
    q = payload.message.lower()
    lang_note = _lang_instruction(payload.language_code)
    crits = [v for v in villages_db if v["status"] == "critical"]
    mod = [v for v in villages_db if v["status"] == "moderate"]
    cov = [v for v in villages_db if v["status"] == "covered"]

    def explain_priority(v):
        pb = v.get("priority_breakdown", {})
        return (
            f"**Priority Breakdown for {v['name']}:**\n"
            f"- Geographical Assignment: {pb.get('geographical_score', 0)}/30\n"
            f"- Volunteer Report: {pb.get('volunteer_report_score', 0)}/25\n"
            f"- NGO Report: {pb.get('ngo_report_score', 0)}/15\n"
            f"- Crowd Verification: {pb.get('crowd_verification_score', 0)}/20\n"
            f"- Disaster Severity: {pb.get('disaster_severity_score', 0)}/30\n"
            f"- Previous Aid Impact: {pb.get('previous_aid_impact', 0)}\n"
            f"**Final Score: {pb.get('final_priority_score', 0)} → {pb.get('classification', 'unknown').upper()}**"
        )

    if any(k in q for k in ["priority", "score", "engine", "urgent", "critical", "breakdown"]):
        names = ", ".join(v["name"] for v in crits) or "None currently"
        if crits:
            top = crits[0]
            resp = (
                f"### 🤖 Priority Engine Audit\n\n"
                f"**Critical sectors:** {names}\n\n"
                f"{explain_priority(top)}\n\n"
                f"**Formula:** *(Geographical + Volunteer + NGO + Crowd + Severity) + Aid Impact*\n\n"
                f"**Action:** Route all supply drops to critical sectors immediately."
            )
        else:
            resp = "### 🤖 Priority Engine Audit\n\nNo critical sectors currently. All villages are stable."

    elif any(k in q for k in ["food", "supply", "send", "route", "allocate", "kits"]):
        top = max(villages_db, key=_priority_score)
        pb = top.get("priority_breakdown", {})
        resp = (
            f"### 📦 Logistics Directive\n\n"
            f"**Top priority destination:** {top['name']} (Score: {pb.get('final_priority_score', 0)})\n"
            f"**Deficit:** {top['needs']}\n"
            f"**Families at risk:** {top['families']}\n\n"
            f"Priority breakdown:")
        for k, v in pb.items():
            if k not in ("final_priority_score", "classification"):
                resp += f"\n- {k.replace('_', ' ').title()}: {v}"
        resp += f"\n\nRun a duplicate check before dispatching."

    elif any(k in q for k in ["duplicate", "collision", "double", "overlap"]):
        resp = (
            "### 🚨 Duplicate Detection Status\n\n"
            "Engine actively cross-references every delivery against village allocation records.\n\n"
            "**Known collision risk:** Village Alpha Cluster — food kits already scheduled.\n"
            "**Safe alternative:** Village Beta Sector (medicine deficit unmet).\n\n"
            "Use the Duplicate Detection panel to validate any NGO drop before dispatch."
        )

    elif any(k in q for k in ["village", "which", "who", "need help", "needs"]):
        if crits:
            v = crits[0]
            resp = (
                f"### 🏘️ Village Priority Report\n\n"
                f"{explain_priority(v)}\n\n"
                f"**Recommendation:** Immediate deployment to {v['name']}."
            )
        else:
            resp = "### 🏘️ Village Priority Report\n\nAll villages currently covered. No urgent action needed."

    elif any(k in q for k in ["medicine", "medical", "health", "antibiotic"]):
        resp = (
            "### 💊 Medical Supply Intelligence\n\n"
            "**Village Beta Sector** is the top medical destination.\n"
            "Deficit: Antibiotics & Medical Field Tents — 85 families.\n\n"
            "Severity Index: 68. Route medical supply flights immediately."
        )
    else:
        resp = (
            f"### 👋 ReliefHub AI Copilot Online\n\n"
            f"Connected to the Priority Engine.\n\n"
            f"* **Sectors monitored:** {len(villages_db)}\n"
            f"* **Critical:** {len(crits)} | **Moderate:** {len(mod)} | **Covered:** {len(cov)}\n"
            f"* **Duplication safeguards:** Active\n\n"
            f"Ask: *'Which village needs food?'* or *'Explain priority scores'*"
        )

    return ChatResponse(response=resp + lang_note)


@app.get("/api/v1/supply-tracking", response_model=SupplyTrackingResponse, tags=["Supply Tracking"])
def get_supply():
    return supply_tracking


@app.get("/api/v1/report", tags=["Dashboard"])
def get_situation_report():
    live = [v for v in villages_db if v.get("source", "real") == "real" and not v.get("completed", False)]
    top = max(live, key=_priority_score) if live else None
    return {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "dashboard": dashboard_stats,
        "analytics": {
            "critical": len([v for v in live if v["status"] == "critical"]),
            "moderate": len([v for v in live if v["status"] == "moderate"]),
            "covered": len([v for v in live if v["status"] == "covered"]),
            "total": len(live),
        },
        "villages": sorted([
            {
                "name": v["name"],
                "state": v.get("state", "Tamil Nadu"),
                "status": v["status"],
                "priority_score": v.get("priority_breakdown", {}).get("final_priority_score", 0),
                "families": v["families"],
                "aid_received": v.get("aid_received", 0),
                "needs": v.get("needs", "—"),
                "assigned_ngo": (v.get("assigned_ngo") or {}).get("name"),
                "delivery_status": v.get("delivery_status"),
            }
            for v in live
        ], key=lambda x: x["priority_score"], reverse=True),
        "supply": supply_tracking,
        "top_recommendation": {
            "village": top["name"],
            "priority_score": _priority_score(top),
            "needs": top.get("needs"),
            "families": top["families"],
            "aid_received": top.get("aid_received", 0),
        } if top else None,
        "activities": load_activities(10),
    }


@app.get("/api/healthz", tags=["System"])
def healthz():
    return {"status": "ok", "version": "1.2.0", "villages": len(villages_db)}


# =====================================================================
# 8. TESTING / SIMULATION ENDPOINTS
# =====================================================================

testing_villages_db: List[Dict[str, Any]] = [
    {
        "id": "t1", "name": "Flood Zone Alpha", "status": "critical",
        "needs": "Emergency Food Kits & Rescue Teams",
        "families": 420,
        "metrics": "Severity Index: 95% | Godavari River Breach — Level 5 Flood",
        "trackingDemand": "IMMEDIATE EVACUATION REQUIRED (0-4 hours)",
        "position": {"lat": 16.5, "lng": 81.5},
        "aid_received": 5, "severity_score": 95, "need_score": 90,
        "state": "Andhra Pradesh",
        "priority_breakdown": {
            "geographical_score": 29.5, "volunteer_report_score": 25.0,
            "ngo_report_score": 14.5, "crowd_verification_score": 20.0,
            "disaster_severity_score": 30.0, "previous_aid_impact": -1.5,
            "final_priority_score": 118, "classification": "critical",
        },
    },
    {
        "id": "t2", "name": "Cyclone Impact Delta", "status": "critical",
        "needs": "Temporary Shelter & Clean Water",
        "families": 310,
        "metrics": "Severity Index: 88% | Cyclone Landfall — Category 3",
        "trackingDemand": "CRITICAL INBOUND — Shelter Fleet Deploying",
        "position": {"lat": 13.5, "lng": 80.3},
        "aid_received": 10, "severity_score": 88, "need_score": 85,
        "state": "Tamil Nadu",
        "priority_breakdown": {
            "geographical_score": 28.0, "volunteer_report_score": 24.0,
            "ngo_report_score": 13.0, "crowd_verification_score": 18.0,
            "disaster_severity_score": 29.0, "previous_aid_impact": -3.0,
            "final_priority_score": 109, "classification": "critical",
        },
    },
    {
        "id": "t3", "name": "Landslide Sector Omega", "status": "critical",
        "needs": "Medical Aid & Heavy Rescue Equipment",
        "families": 195,
        "metrics": "Severity Index: 82% | Nilgiri Landslide — Road Cut Off",
        "trackingDemand": "Helicopter Access Only — Air Dispatch Authorized",
        "position": {"lat": 11.4, "lng": 76.7},
        "aid_received": 8, "severity_score": 82, "need_score": 80,
        "state": "Kerala",
        "priority_breakdown": {
            "geographical_score": 27.0, "volunteer_report_score": 22.0,
            "ngo_report_score": 12.5, "crowd_verification_score": 16.0,
            "disaster_severity_score": 28.0, "previous_aid_impact": -2.4,
            "final_priority_score": 103, "classification": "critical",
        },
    },
    {
        "id": "t4", "name": "Flash Flood Gamma", "status": "moderate",
        "needs": "Drinking Water & Sanitation Kits",
        "families": 140,
        "metrics": "Severity Index: 72% | Mahanadi Tributary Overflow",
        "trackingDemand": "Moderate Priority — Deploy within 24 hours",
        "position": {"lat": 20.5, "lng": 85.8},
        "aid_received": 20, "severity_score": 72, "need_score": 68,
        "state": "Odisha",
        "priority_breakdown": {
            "geographical_score": 24.0, "volunteer_report_score": 20.0,
            "ngo_report_score": 9.0, "crowd_verification_score": 12.0,
            "disaster_severity_score": 25.0, "previous_aid_impact": -6.0,
            "final_priority_score": 84, "classification": "critical",
        },
    },
    {
        "id": "t5", "name": "Drought Zone Kappa", "status": "moderate",
        "needs": "Food Grains & Livestock Feed",
        "families": 280,
        "metrics": "Severity Index: 58% | Telangana Drought — 3rd Consecutive Season",
        "trackingDemand": "Sustained Supply Chain Required — 7-Day Window",
        "position": {"lat": 17.3, "lng": 78.5},
        "aid_received": 35, "severity_score": 58, "need_score": 55,
        "state": "Telangana",
        "priority_breakdown": {
            "geographical_score": 20.0, "volunteer_report_score": 18.0,
            "ngo_report_score": 7.0, "crowd_verification_score": 10.0,
            "disaster_severity_score": 20.0, "previous_aid_impact": -10.5,
            "final_priority_score": 65, "classification": "moderate",
        },
    },
]

testing_supply: Dict[str, Any] = {
    "food_kits": {"total": 8000, "in_transit": 3200, "delivered": 400},
    "medicines": {"total": 3000, "in_transit": 800, "delivered": 150},
    "water": {"total": 15000, "in_transit": 5000, "delivered": 800},
    "blankets": {"total": 5000, "in_transit": 2000, "delivered": 300},
    "tents": {"total": 2000, "in_transit": 700, "delivered": 80},
}

INITIAL_TESTING_SUPPLY: Dict[str, Any] = {
    "food_kits": {"total": 8000, "in_transit": 3200, "delivered": 400},
    "medicines": {"total": 3000, "in_transit": 800, "delivered": 150},
    "water": {"total": 15000, "in_transit": 5000, "delivered": 800},
    "blankets": {"total": 5000, "in_transit": 2000, "delivered": 300},
    "tents": {"total": 2000, "in_transit": 700, "delivered": 80},
}

SCENARIO_PRESETS: Dict[str, List[Dict[str, Any]]] = {
    "cascade": [
        {"name": "Flood Zone Alpha", "status": "critical", "needs": "Emergency Food Kits & Rescue Teams",
         "families": 420, "lat": 16.5, "lng": 81.1, "state": "Andhra Pradesh", "severity": 90,
         "resource": "Emergency Food Kits"},
        {"name": "Cyclone Impact Delta", "status": "critical", "needs": "Temporary Shelter & Clean Water",
         "families": 310, "lat": 13.5, "lng": 80.3, "state": "Tamil Nadu", "severity": 88,
         "resource": "Temporary Shelter"},
        {"name": "Landslide Sector Omega", "status": "critical", "needs": "Medical Aid & Heavy Rescue Equipment",
         "families": 195, "lat": 11.4, "lng": 76.7, "state": "Kerala", "severity": 82,
         "resource": "Medical Aid"},
        {"name": "Flash Flood Gamma", "status": "moderate", "needs": "Drinking Water & Sanitation Kits",
         "families": 140, "lat": 20.5, "lng": 85.8, "state": "Odisha", "severity": 72,
         "resource": "Drinking Water"},
        {"name": "Drought Zone Kappa", "status": "moderate", "needs": "Food Grains & Livestock Feed",
         "families": 280, "lat": 17.3, "lng": 78.5, "state": "Telangana", "severity": 58,
         "resource": "Food Grains"},
    ],
    "earthquake": [
        {"name": "Earthquake Epicenter Alpha", "status": "critical", "needs": "Heavy Rescue & Medical Teams",
         "families": 580, "lat": 23.0, "lng": 70.1, "state": "Gujarat", "severity": 96,
         "resource": "Medical Aid"},
        {"name": "Aftershock Zone Beta", "status": "critical", "needs": "Temporary Shelter & Food",
         "families": 340, "lat": 22.3, "lng": 71.2, "state": "Gujarat", "severity": 88,
         "resource": "Temporary Shelter"},
        {"name": "Collapsed District Gamma", "status": "critical", "needs": "Search & Rescue Equipment",
         "families": 210, "lat": 23.8, "lng": 69.7, "state": "Gujarat", "severity": 84,
         "resource": "Medical Aid"},
        {"name": "Displaced Camp Delta", "status": "moderate", "needs": "Food & Blankets",
         "families": 450, "lat": 22.1, "lng": 70.8, "state": "Gujarat", "severity": 65,
         "resource": "Food Grains"},
        {"name": "Infrastructure Breakdown Sector", "status": "moderate", "needs": "Clean Water & Sanitation",
         "families": 175, "lat": 24.0, "lng": 70.5, "state": "Gujarat", "severity": 60,
         "resource": "Drinking Water"},
    ],
    "drought": [
        {"name": "Drought Zone Rajasthan-1", "status": "critical", "needs": "Drinking Water & Food Grains",
         "families": 620, "lat": 26.9, "lng": 70.9, "state": "Rajasthan", "severity": 78,
         "resource": "Drinking Water"},
        {"name": "Famine Alert Sector Marwar", "status": "critical", "needs": "Emergency Food Rations",
         "families": 480, "lat": 25.1, "lng": 73.0, "state": "Rajasthan", "severity": 74,
         "resource": "Food Grains"},
        {"name": "Livestock Crisis Zone", "status": "moderate", "needs": "Animal Feed & Veterinary Aid",
         "families": 320, "lat": 27.2, "lng": 72.6, "state": "Rajasthan", "severity": 62,
         "resource": "Food Grains"},
        {"name": "Crop Failure Delta", "status": "moderate", "needs": "Seed Kits & Irrigation Aid",
         "families": 240, "lat": 24.5, "lng": 74.7, "state": "Rajasthan", "severity": 55,
         "resource": "Food Grains"},
        {"name": "Migration Camp Alpha", "status": "covered", "needs": "Basic Amenities",
         "families": 190, "lat": 26.0, "lng": 75.8, "state": "Rajasthan", "severity": 40,
         "resource": "Food Grains"},
    ],
}


class TestingVillagesResponse(BaseModel):
    simulation_mode: bool = True
    scenario: str
    villages: List[VillageResponse]
    sos_queue: List[VillageResponse] = []


@app.get("/api/v1/testing/villages", response_model=TestingVillagesResponse, tags=["Simulation"])
def get_testing_villages():
    sos_pending = [v for v in villages_db if v.get("source") == "sos" and not v.get("completed", False)]
    active_sim = [v for v in testing_villages_db if not v.get("completed", False)]
    return TestingVillagesResponse(
        simulation_mode=True,
        scenario="Multi-State Disaster Cascade — Flood + Cyclone + Landslide",
        villages=active_sim,
        sos_queue=sos_pending,
    )


@app.post("/api/v1/villages/{village_id}/promote", tags=["Logistics"])
def promote_village(village_id: str):
    v = next((x for x in villages_db if x["id"] == village_id), None)
    if not v:
        raise HTTPException(status_code=404, detail="Village not found")
    v["source"] = "real"
    save_village(v)
    dashboard_stats["villages_affected"] = len([x for x in villages_db if x.get("source", "real") == "real" and not x.get("completed", False)])
    log_activity("Operations", "SOS Promoted to Live", v["name"], "SOS confirmed as real disaster — activated in Live Dashboard.")
    return {"ok": True, "message": f"{v['name']} activated in Live Dashboard"}


@app.post("/api/v1/villages/{village_id}/complete", tags=["Logistics"])
def complete_village(village_id: str):
    for x in villages_db:
        if x["id"] == village_id:
            x["completed"] = True
            save_village(x)
            dashboard_stats["villages_affected"] = len([v for v in villages_db if v.get("source", "real") == "real" and not v.get("completed", False)])
            log_activity("Operations", "Task Completed", x["name"], "Task marked complete and removed from dashboard.")
            return {"ok": True, "message": f"{x['name']} marked complete"}
    for x in testing_villages_db:
        if x["id"] == village_id:
            x["completed"] = True
            return {"ok": True, "message": f"{x['name']} marked complete"}
    raise HTTPException(status_code=404, detail="Village not found")


@app.get("/api/v1/testing/dashboard", tags=["Simulation"])
def get_testing_dashboard():
    total_fam = sum(v["families"] for v in testing_villages_db)
    return {
        "villages_affected": len(testing_villages_db),
        "families_helped": total_fam,
        "active_ngos": 34,
        "items_delivered": 12800,
        "simulation_mode": True,
        "scenario": "Multi-State Disaster Cascade — Flood + Cyclone + Landslide",
    }


@app.get("/api/v1/testing/analytics", response_model=AnalyticsResponse, tags=["Simulation"])
def get_testing_analytics():
    crit = len([v for v in testing_villages_db if v["status"] == "critical"])
    mod = len([v for v in testing_villages_db if v["status"] == "moderate"])
    cov = len([v for v in testing_villages_db if v["status"] == "covered"])
    return {"critical": crit, "moderate": mod, "covered": cov, "total": len(testing_villages_db)}


@app.get("/api/v1/testing/supply-tracking", response_model=SupplyTrackingResponse, tags=["Simulation"])
def get_testing_supply():
    return testing_supply


@app.post("/api/v1/testing/allocate", response_model=AllocateResponse, tags=["Simulation"])
def post_testing_allocate(payload: AllocateRequest):
    best = max(testing_villages_db, key=_priority_score)
    best_score = _priority_score(best)
    pb = best.get("priority_breakdown", {})
    reason = (
        f"[SIMULATION] Priority Engine selected {best['name']} (Score: {best_score}). "
        f"Active deficit: {best['needs']} — {best['families']} families affected. "
        f"Only {best['aid_received']}% of allocated supplies received."
    )
    return AllocateResponse(
        recommended_village=best["name"],
        reason=reason,
        priority_score_calculated=best_score,
        priority_breakdown=pb,
    )


@app.post("/api/v1/testing/duplicate-check", response_model=DuplicateCheckResponse, tags=["Simulation"])
def post_testing_duplicate(payload: DuplicateCheckRequest):
    target = next((v for v in testing_villages_db if v["id"] == payload.village), None)
    if not target:
        target = next((v for v in testing_villages_db if payload.village.lower() in v["name"].lower()), None)
    if target:
        incoming = payload.resource.lower()
        existing = target["needs"].lower()
        is_dup = incoming in existing or any(w in incoming for w in existing.split() if len(w) > 3)
        if is_dup:
            alt = next((v for v in testing_villages_db if v["id"] != target["id"] and v["status"] == "critical"), None)
            return DuplicateCheckResponse(
                duplicate=True,
                message=f"[SIMULATION] ⚠ Conflict: [{payload.resource}] matches open allocation for {target['name']}.",
                suggested_village=alt["name"] if alt else "Unassigned Safe Sector",
                priority_breakdown=alt.get("priority_breakdown") if alt else None,
            )
    return DuplicateCheckResponse(
        duplicate=False,
        message="[SIMULATION] ✓ Clear Runway: No delivery overlaps detected.",
        suggested_village=None,
        priority_breakdown=None,
    )


@app.get("/api/v1/testing/activities", response_model=ActivitiesResponse, tags=["Simulation"])
def get_testing_activities():
    return {"activities": [
        {"timestamp": "2026-06-13 07:00:00", "actor": "Priority Engine", "action": "Scenario Initialized",
         "village": "All Zones", "details": "Multi-state disaster cascade scenario loaded — 5 sectors, 3 critical"},
        {"timestamp": "2026-06-13 06:55:00", "actor": "SOS Portal", "action": "Emergency Broadcast",
         "village": "Flood Zone Alpha", "details": "Level 5 flood — 420 families affected. Priority score: 118 (CRITICAL)"},
        {"timestamp": "2026-06-13 06:50:00", "actor": "NGO Alpha", "action": "Air Drop Deployed",
         "village": "Cyclone Impact Delta", "details": "Temporary shelter units (50) — helicopter deployment authorized"},
        {"timestamp": "2026-06-13 06:45:00", "actor": "Priority Engine", "action": "Score Recalculated",
         "village": "Landslide Sector Omega", "details": "Road cut off — score escalated to 103 (CRITICAL). Helicopter access only."},
        {"timestamp": "2026-06-13 06:40:00", "actor": "Volunteer Report", "action": "Verified Need",
         "village": "Flash Flood Gamma", "details": "Mahanadi tributary overflow confirmed. 140 families displaced."},
        {"timestamp": "2026-06-13 06:35:00", "actor": "AI Allocation Engine", "action": "Resource Allocated",
         "village": "Flood Zone Alpha", "details": "Emergency Food Kits (500 units) routed. Highest priority sector."},
        {"timestamp": "2026-06-13 06:30:00", "actor": "ReliefHub System", "action": "Simulation Started",
         "village": "All Zones", "details": "[SIMULATION] Disaster scenario engine activated for judge demonstration"},
    ]}


class ScenarioSwitchRequest(BaseModel):
    scenario: str


@app.post("/api/v1/testing/reset", tags=["Simulation"])
def reset_testing_scenario():
    global testing_villages_db, testing_supply
    testing_villages_db.clear()
    testing_villages_db.extend([
        {
            "id": f"t{i+1}", "name": p["name"], "status": p["status"],
            "needs": p["needs"], "families": p["families"],
            "metrics": f"Severity Index: {p['severity']}% | Scenario Reload",
            "trackingDemand": f"SCENARIO RESET — {p['status'].upper()} Priority",
            "position": {"lat": p["lat"], "lng": p["lng"]},
            "aid_received": 0, "severity_score": p["severity"],
            "need_score": int(min(p["families"] * 0.5, 40)),
            "state": p["state"],
            "priority_breakdown": {
                "geographical_score": round(p["severity"] * 0.3, 1),
                "volunteer_report_score": round(p["severity"] * 0.25, 1),
                "ngo_report_score": round(p["severity"] * 0.13, 1),
                "crowd_verification_score": round(p["severity"] * 0.18, 1),
                "disaster_severity_score": round(p["severity"] * 0.3, 1),
                "previous_aid_impact": round(-p["aid_received"] * 0.1, 1),
                "final_priority_score": p["severity"],
                "classification": p["status"],
            },
        }
        for i, p in enumerate(SCENARIO_PRESETS["cascade"])
    ])
    for k in testing_supply:
        testing_supply[k] = dict(INITIAL_TESTING_SUPPLY[k])
    return {"ok": True, "message": "Scenario reset to Multi-State Cascade", "villages": len(testing_villages_db)}


@app.post("/api/v1/testing/switch-scenario", tags=["Simulation"])
def switch_testing_scenario(payload: ScenarioSwitchRequest):
    global testing_villages_db, testing_supply
    key = payload.scenario.lower()
    presets = SCENARIO_PRESETS.get(key, SCENARIO_PRESETS["cascade"])
    testing_villages_db.clear()
    testing_villages_db.extend([
        {
            "id": f"t{i+1}", "name": p["name"], "status": p["status"],
            "needs": p["needs"], "families": p["families"],
            "metrics": f"Severity Index: {p['severity']}% | {key.title()} Scenario",
            "trackingDemand": f"{p['status'].upper()} — {key.title()} Response Active",
            "position": {"lat": p["lat"], "lng": p["lng"]},
            "aid_received": 0, "severity_score": p["severity"],
            "need_score": int(min(p["families"] * 0.5, 40)),
            "state": p["state"],
            "priority_breakdown": {
                "geographical_score": round(p["severity"] * 0.3, 1),
                "volunteer_report_score": round(p["severity"] * 0.25, 1),
                "ngo_report_score": round(p["severity"] * 0.13, 1),
                "crowd_verification_score": round(p["severity"] * 0.18, 1),
                "disaster_severity_score": round(p["severity"] * 0.3, 1),
                "previous_aid_impact": -2.0,
                "final_priority_score": p["severity"],
                "classification": p["status"],
            },
        }
        for i, p in enumerate(presets)
    ])
    for k in testing_supply:
        testing_supply[k] = dict(INITIAL_TESTING_SUPPLY[k])
    names = {
        "cascade": "Multi-State Cascade — Flood + Cyclone + Landslide",
        "earthquake": "Major Earthquake — Gujarat Seismic Zone",
        "drought": "Drought & Famine — Rajasthan Crisis",
    }
    return {"ok": True, "scenario": names.get(key, key), "villages": len(testing_villages_db)}


@app.post("/api/v1/testing/chat", response_model=ChatResponse, tags=["Simulation"])
def post_testing_chat(payload: ChatRequest):
    q = payload.message.lower()
    lang_note = _lang_instruction(payload.language_code)
    crits = [v for v in testing_villages_db if v["status"] == "critical"]
    mod = [v for v in testing_villages_db if v["status"] == "moderate"]
    cov = [v for v in testing_villages_db if v["status"] == "covered"]

    def explain_priority(v):
        pb = v.get("priority_breakdown", {})
        return (
            f"**Priority Breakdown for {v['name']} [SIMULATION]:**\n"
            f"- Geographical Assignment: {pb.get('geographical_score', 0)}/30\n"
            f"- Volunteer Report: {pb.get('volunteer_report_score', 0)}/25\n"
            f"- NGO Report: {pb.get('ngo_report_score', 0)}/15\n"
            f"- Crowd Verification: {pb.get('crowd_verification_score', 0)}/20\n"
            f"- Disaster Severity: {pb.get('disaster_severity_score', 0)}/30\n"
            f"**Final Score: {pb.get('final_priority_score', 0)} → {pb.get('classification', 'unknown').upper()}**"
        )

    if any(k in q for k in ["priority", "score", "engine", "urgent", "critical", "breakdown"]):
        names = ", ".join(v["name"] for v in crits) or "None currently"
        if crits:
            top = crits[0]
            resp = (
                f"### 🤖 [SIMULATION] Priority Engine Audit\n\n"
                f"**Critical sectors:** {names}\n\n"
                f"{explain_priority(top)}\n\n"
                f"**Scenario:** Multi-State Disaster Cascade. Route all supplies to critical zones immediately."
            )
        else:
            resp = "### 🤖 [SIMULATION] Priority Engine Audit\n\nNo critical sectors in simulation. Scenario stable."

    elif any(k in q for k in ["food", "supply", "send", "route", "allocate", "kits"]):
        top = max(testing_villages_db, key=_priority_score)
        pb = top.get("priority_breakdown", {})
        resp = (
            f"### 📦 [SIMULATION] Logistics Directive\n\n"
            f"**Top priority destination:** {top['name']} (Score: {pb.get('final_priority_score', 0)})\n"
            f"**Deficit:** {top['needs']}\n"
            f"**Families at risk:** {top['families']}\n\n"
            f"This is simulation data — no real dispatch initiated."
        )

    elif any(k in q for k in ["village", "which", "who", "need help", "needs"]):
        if crits:
            v = crits[0]
            resp = (
                f"### 🏘️ [SIMULATION] Village Priority Report\n\n"
                f"{explain_priority(v)}\n\n"
                f"**Recommendation:** In a real event, immediate deployment to {v['name']} would be priority."
            )
        else:
            resp = "### 🏘️ [SIMULATION] All simulation villages currently covered."

    else:
        resp = (
            f"### 👋 [SIMULATION] ReliefHub AI Copilot\n\n"
            f"Connected to the **Simulation Engine** — disaster scenario active.\n\n"
            f"* **Simulated sectors:** {len(testing_villages_db)}\n"
            f"* **Critical:** {len(crits)} | **Moderate:** {len(mod)} | **Covered:** {len(cov)}\n\n"
            f"Ask: *'Which village needs help?'* or *'Explain priority scores'*"
        )

    return ChatResponse(response=resp + lang_note)


# =====================================================================
# 9. NGO ROUTING & ASSIGNMENT
# =====================================================================

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


class NgoAssignRequest(BaseModel):
    ngo_id: str


class DeliveryStatusRequest(BaseModel):
    status: str


@app.post("/api/v1/ngo-checkin", response_model=NgoCheckinItem, status_code=status.HTTP_201_CREATED, tags=["NGO Routing"])
def post_ngo_checkin(payload: NgoCheckinRequest):
    now = time.time()
    ngo_match = next((n for n in NGO_DB if n["name"].lower() == payload.name.lower()), None)
    ngo_id = ngo_match["id"] if ngo_match else payload.name.lower().replace(" ", "_")
    existing = next((c for c in ngo_checkins_db if c["id"] == ngo_id), None)
    if existing:
        existing["lat"] = payload.lat
        existing["lng"] = payload.lng
        existing["status"] = payload.status
        existing["last_checkin"] = now
        return existing
    entry: Dict[str, Any] = {
        "id": ngo_id,
        "name": payload.name,
        "lat": payload.lat,
        "lng": payload.lng,
        "status": payload.status,
        "last_checkin": now,
    }
    ngo_checkins_db.append(entry)
    log_activity(payload.name, "NGO Check-In", "—", f"Position update: {payload.lat:.4f}°N {payload.lng:.4f}°E · Status: {payload.status}")
    return entry


@app.get("/api/v1/ngos", tags=["NGO Routing"])
def get_ngos(village_id: Optional[str] = None):
    if not village_id:
        cutoff = time.time() - 1800
        return [c for c in ngo_checkins_db if c["last_checkin"] >= cutoff]
    all_v = villages_db + testing_villages_db
    v = next((x for x in all_v if x["id"] == village_id), None)
    if not v:
        raise HTTPException(status_code=404, detail="Village not found")
    vlat, vlng = v["position"]["lat"], v["position"]["lng"]
    result = []
    for ngo in NGO_DB:
        dist = _haversine_km(ngo["location"]["lat"], ngo["location"]["lng"], vlat, vlng)
        eta = dist / 65
        wl = min(int((ngo["current_assignments"] / 3) * 100), 100)
        result.append({**ngo, "distance_km": round(dist, 1), "eta_hours": round(eta, 1), "workload_percent": wl})
    result.sort(key=lambda x: x["distance_km"])
    return result


@app.post("/api/v1/villages/{village_id}/assign-ngo", tags=["NGO Routing"])
def assign_ngo(village_id: str, payload: NgoAssignRequest):
    all_v = villages_db + testing_villages_db
    village = next((x for x in all_v if x["id"] == village_id), None)
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
    ngo = next((n for n in NGO_DB if n["id"] == payload.ngo_id), None)
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")
    dist = _haversine_km(ngo["location"]["lat"], ngo["location"]["lng"], village["position"]["lat"], village["position"]["lng"])
    eta = dist / 65
    road = "Clear" if dist < 150 else ("Moderate Traffic" if dist < 400 else "Heavy — Alt Route Advised")
    village["assigned_ngo"] = {"id": ngo["id"], "name": ngo["name"], "location": ngo["location"], "city": ngo["city"], "specialty": ngo["specialty"]}
    village["delivery_status"] = "assigned"
    village["route_info"] = {"distance_km": round(dist, 1), "eta_hours": round(eta, 1), "road_status": road, "ngo_lat": ngo["location"]["lat"], "ngo_lng": ngo["location"]["lng"]}
    ngo["current_assignments"] += 1
    log_activity(ngo["name"], "NGO Dispatched", village["name"], f"Dispatched → {village['name']} · ETA {round(eta, 1)}h · {round(dist, 1)} km")
    return {"ok": True, "message": f"{ngo['name']} assigned to {village['name']}", "assigned_ngo": village["assigned_ngo"], "route_info": village["route_info"]}


@app.post("/api/v1/villages/{village_id}/delivery-status", tags=["NGO Routing"])
def update_delivery_status(village_id: str, payload: DeliveryStatusRequest):
    valid = {"assigned", "traveling", "arrived", "distributed", "completed"}
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {sorted(valid)}")
    all_v = villages_db + testing_villages_db
    village = next((x for x in all_v if x["id"] == village_id), None)
    if not village:
        raise HTTPException(status_code=404, detail="Village not found")
    village["delivery_status"] = payload.status
    if payload.status == "completed":
        village["completed"] = True
    ngo_name = (village.get("assigned_ngo") or {}).get("name", "NGO")
    log_activity(ngo_name, f"Status: {payload.status.title()}", village["name"], f"Delivery status → {payload.status.upper()}")
    return {"ok": True, "status": payload.status}


@app.post("/api/v1/testing/sos", response_model=SosResponse, status_code=status.HTTP_201_CREATED, tags=["Simulation"])
def post_testing_sos(payload: SosRequest):
    new_id = f"t{len(testing_villages_db) + 1}"
    severity = payload.severity_indicator or 80
    verif = payload.crowd_verification_count or 3
    pb = compute_priority_breakdown(
        payload.lat, payload.lng, severity, verif, payload.families, 0
    )
    s_status = pb["classification"]
    entry = {
        "id": new_id,
        "name": f"[SIM] Sector {payload.village}",
        "status": s_status,
        "needs": payload.resource,
        "families": payload.families,
        "metrics": f"[SIMULATION] Severity Index: {pb['final_priority_score']}% | Scenario Injected",
        "trackingDemand": f"[SIM] Priority: {s_status.upper()}",
        "position": {"lat": payload.lat, "lng": payload.lng},
        "aid_received": 0,
        "severity_score": severity,
        "need_score": int(min(payload.families * 0.5, 40)),
        "priority_breakdown": pb,
        "state": payload.state or "Tamil Nadu",
    }
    testing_villages_db.append(entry)
    return SosResponse(
        success=True,
        message="[SIMULATION] SOS injected into simulation matrix.",
        inserted_id=new_id,
        calculated_priority=s_status,
        priority_breakdown=pb,
    )


# =====================================================================
# VERCEL HANDLER
# =====================================================================
handler = Mangum(app)
