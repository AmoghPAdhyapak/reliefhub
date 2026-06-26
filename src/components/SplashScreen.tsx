import { useState, useEffect } from "react";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);
  const [loadMsg, setLoadMsg] = useState("Loading ReliefHub...");

  useEffect(() => {
    const t1 = setTimeout(() => setLoadMsg("Initializing Disaster Response Network..."), 980);
    const t2 = setTimeout(() => setExiting(true), 1850);
    const t3 = setTimeout(onDone, 2250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone]);

  return (
    <>
      <style>{`
        @keyframes rh-logo-in {
          from { opacity: 0; transform: scale(0.82); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes rh-text-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rh-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes rh-glow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 0.9; transform: scale(1.12); }
        }
        @keyframes rh-bar {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "linear-gradient(160deg, #050c1a 0%, #0a1628 55%, #061018 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          transition: "opacity 0.38s ease",
          opacity: exiting ? 0 : 1,
          pointerEvents: exiting ? "none" : "all",
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(34,197,94,0.10) 0%, rgba(16,185,129,0.04) 45%, transparent 70%)",
            animation: "rh-glow 2.8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        {/* Secondary ring glow */}
        <div
          style={{
            position: "absolute",
            width: 280,
            height: 280,
            borderRadius: "50%",
            border: "1px solid rgba(34,197,94,0.08)",
            animation: "rh-glow 3.2s ease-in-out 0.4s infinite",
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <div
          style={{
            animation: "rh-logo-in 0.55s cubic-bezier(0.34,1.25,0.64,1) 0.08s both",
            filter: "drop-shadow(0 0 28px rgba(34,197,94,0.28)) drop-shadow(0 4px 16px rgba(0,0,0,0.6))",
          }}
        >
          <img
            src="/reliefhub-logo.png"
            alt="ReliefHub"
            width={152}
            height={152}
            style={{ objectFit: "contain", display: "block" }}
          />
        </div>

        {/* Wordmark */}
        <div
          style={{
            marginTop: 18,
            animation: "rh-text-in 0.48s ease 0.42s both",
            display: "flex",
            alignItems: "baseline",
            gap: 0,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: 34,
              fontWeight: 900,
              color: "#f1f5f9",
              letterSpacing: -1,
            }}
          >
            RELIEF
          </span>
          <span
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: 34,
              fontWeight: 900,
              color: "#22c55e",
              letterSpacing: -1,
            }}
          >
            HUB
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 10,
            animation: "rh-fade-in 0.5s ease 0.72s both",
            fontSize: 11,
            color: "rgba(203,213,225,0.55)",
            letterSpacing: 1.8,
            textTransform: "uppercase",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          The Right Aid. The Right Place. The Right Time.
        </div>

        {/* Divider dots */}
        <div
          style={{
            marginTop: 32,
            animation: "rh-fade-in 0.4s ease 0.85s both",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ width: 28, height: 1, background: "rgba(34,197,94,0.35)", borderRadius: 1 }} />
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(34,197,94,0.6)" }} />
          <div style={{ width: 28, height: 1, background: "rgba(34,197,94,0.35)", borderRadius: 1 }} />
        </div>

        {/* Progress bar */}
        <div
          style={{
            marginTop: 18,
            width: 210,
            height: 2,
            background: "rgba(255,255,255,0.07)",
            borderRadius: 2,
            overflow: "hidden",
            animation: "rh-fade-in 0.3s ease 0.9s both",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #16a34a 0%, #22c55e 60%, #4ade80 100%)",
              borderRadius: 2,
              width: 0,
              animation: "rh-bar 1.55s cubic-bezier(0.4,0,0.2,1) 0.3s forwards",
            }}
          />
        </div>

        {/* Loading message */}
        <div
          style={{
            marginTop: 12,
            height: 16,
            fontSize: 10.5,
            color: "rgba(148,163,184,0.5)",
            fontWeight: 500,
            letterSpacing: 0.4,
            transition: "opacity 0.25s ease",
            animation: "rh-fade-in 0.3s ease 1s both",
          }}
        >
          {loadMsg}
        </div>
      </div>
    </>
  );
}
