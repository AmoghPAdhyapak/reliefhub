import { useState } from "react";
import { Search, Globe, ChevronRight, Check } from "lucide-react";
import { LANGUAGES, useLanguage, type Language } from "../context/LanguageContext";

const POPULAR = LANGUAGES.filter((l) => l.popular);
const OTHERS  = LANGUAGES.filter((l) => !l.popular);

function LangCard({
  lang,
  selected,
  onSelect,
}: {
  lang: Language;
  selected: boolean;
  onSelect: (code: string) => void;
}) {
  const isUrdu = lang.code === "ur" || lang.code === "ks" || lang.code === "sd";
  return (
    <button
      onClick={() => onSelect(lang.code)}
      className={`relative p-4 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-100 ${
        selected
          ? "border-emerald-500/70 bg-emerald-500/15 shadow-lg shadow-emerald-500/20"
          : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600/70 hover:bg-slate-800/70"
      }`}
    >
      <div
        className={`text-xl font-black leading-tight mb-0.5 ${selected ? "text-emerald-300" : "text-white"}`}
        dir={isUrdu ? "rtl" : "ltr"}
      >
        {lang.native}
      </div>
      <div className="text-[10px] text-slate-400 font-medium">{lang.english}</div>
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow shadow-emerald-500/50">
          <Check size={11} className="text-white stroke-[3]" />
        </div>
      )}
    </button>
  );
}

export default function LanguageSelectScreen() {
  const { setLanguageCode, closeSelector, languageCode } = useLanguage();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>(languageCode !== "en" ? languageCode : "");

  const query = search.trim().toLowerCase();
  const searchResults = query
    ? LANGUAGES.filter(
        (l) =>
          l.english.toLowerCase().includes(query) ||
          l.native.toLowerCase().includes(query) ||
          l.code.toLowerCase().includes(query)
      )
    : [];

  function handleContinue() {
    const code = selected || "en";
    setLanguageCode(code);
    closeSelector();
  }

  const selectedLang = LANGUAGES.find((l) => l.code === selected);
  const continueLabel = selected
    ? `${selectedLang?.native ?? "English"} · Continue`
    : "Select a language to continue";

  return (
    <div className="fixed inset-0 z-[99999] bg-gradient-to-br from-[#040a14] via-[#070d1a] to-[#040a14] overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow shadow-emerald-500/40">
            <Globe size={16} className="text-white" />
          </div>
          <span className="text-white text-sm font-black tracking-tight">ReliefHub</span>
        </div>
        <div className="text-[10px] text-slate-500 font-medium">
          Disaster Relief Coordination
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-32">
        {/* Headline */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4">
            <Globe size={11} />
            Language First
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight leading-tight">
            Choose Your Language
          </h1>
          {/* Multilingual subtitle — shown in all 10 popular languages */}
          <div className="space-y-1">
            <p className="text-slate-400 text-xs sm:text-sm">
              अपनी भाषा चुनें &nbsp;·&nbsp; ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ &nbsp;·&nbsp; உங்கள் மொழியை தேர்ந்தெடுக்கவும்
            </p>
            <p className="text-slate-500 text-xs">
              మీ భాషను ఎంచుకోండి &nbsp;·&nbsp; നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക &nbsp;·&nbsp; আপনার ভাষা বেছে নিন
            </p>
            <p className="text-slate-600 text-xs">
              Select your preferred language to continue
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search language... (e.g. Hindi, हिन्दी, Kannada, ಕನ್ನಡ)"
            className="w-full bg-slate-800/60 border border-slate-700/60 text-white placeholder-slate-500 text-sm rounded-2xl pl-10 pr-4 py-3.5 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-2 py-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search results */}
        {query && (
          <div className="mb-8">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
              <Search size={10} />
              Search results for "{search}"
            </div>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {searchResults.map((lang) => (
                  <LangCard key={lang.code} lang={lang} selected={selected === lang.code} onSelect={setSelected} />
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 text-sm py-6">
                No languages found for "{search}"
              </div>
            )}
          </div>
        )}

        {/* Popular languages */}
        {!query && (
          <>
            <div className="mb-8">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Popular Languages
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {POPULAR.map((lang) => (
                  <LangCard key={lang.code} lang={lang} selected={selected === lang.code} onSelect={setSelected} />
                ))}
              </div>
            </div>

            <div className="mb-8">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Other Languages
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {OTHERS.map((lang) => (
                  <LangCard key={lang.code} lang={lang} selected={selected === lang.code} onSelect={setSelected} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky continue bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-[#040a14] via-[#040a14]/95 to-transparent pt-8 pb-6 px-4">
        <div className="max-w-2xl mx-auto">
          {selected && (
            <div className="text-center text-xs text-slate-500 mb-2">
              Selected: <span className="text-emerald-400 font-semibold">{selectedLang?.native} ({selectedLang?.english})</span>
            </div>
          )}
          <button
            onClick={handleContinue}
            className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-xl ${
              selected
                ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:scale-[1.01]"
                : "bg-slate-700/60 text-slate-400 cursor-default border border-slate-700/50"
            }`}
          >
            <Globe size={15} />
            {continueLabel}
            {selected && <ChevronRight size={15} />}
          </button>
          {!selected && (
            <p className="text-center text-[10px] text-slate-600 mt-2">
              Pick any language card above, then tap Continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
