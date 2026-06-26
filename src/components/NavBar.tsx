import { NavLink, useNavigate } from "react-router-dom";
import { Shield, FlaskConical, Radar, Home, Globe, Play } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function NavBar() {
  const { language, openSelector, t } = useLanguage();
  const navigate = useNavigate();

  const links = [
    { href: "/",          label: t("nav_home"),        icon: <Home size={13} />,         exact: true  },
    { href: "/dashboard", label: t("nav_dashboard"),   icon: <Shield size={13} />,        exact: true  },
    { href: "/testing",   label: t("nav_simulation"),  icon: <FlaskConical size={13} />,  exact: false },
    { href: "/radar",     label: t("nav_radar"),       icon: <Radar size={13} />,         exact: false },
  ];

  const displayLang = language.code === "en" ? "English" : language.native;

  return (
    <nav className="bg-[hsl(222,47%,11%)] px-4 py-2 flex items-center gap-3 sticky top-0 z-[9998]">
      {/* LEFT — Language switcher */}
      <button
        onClick={openSelector}
        title="Change language"
        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/18 border border-white/10 hover:border-emerald-500/40 px-2.5 py-1.5 rounded-full transition-all shrink-0"
      >
        <Globe size={12} className="text-emerald-400 shrink-0" />
        <span className="text-[10px] font-bold text-white/80 max-w-[72px] truncate hidden sm:block">
          {displayLang}
        </span>
      </button>

      {/* Brand */}
      <div className="flex items-center gap-2 mr-2">
        <img
          src="/reliefhub-logo.png"
          alt="ReliefHub"
          className="w-6 h-6 object-contain shrink-0"
        />
        <span className="text-white text-xs font-bold tracking-tight hidden sm:block">
          <span className="text-white">Relief</span><span className="text-emerald-400">Hub</span>
        </span>
      </div>

      {/* Nav links */}
      <div className="flex items-center gap-1 flex-1">
        {links.map(({ href, label, icon, exact }) => (
          <NavLink
            key={href}
            to={href}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                isActive
                  ? "bg-white text-[hsl(222,47%,11%)]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`
            }
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </div>

      {/* RIGHT — Live Demo + Ops Online */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate("/testing")}
          className="flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 hover:text-emerald-200 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all"
        >
          <Play size={10} className="fill-current" />
          <span className="hidden sm:inline">{t("nav_live_demo")}</span>
        </button>

        <div className="hidden sm:flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(142,76%,36%)] animate-pulse" />
          <span className="text-[10px] font-semibold text-white/70">{t("ops_online")}</span>
        </div>
      </div>
    </nav>
  );
}
