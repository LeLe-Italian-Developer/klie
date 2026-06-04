"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type SettingsSection = {
  key: string;
  label: string;
  icon?: string;
  content: React.ReactNode;
};

type SettingsLayoutProps = {
  sections: SettingsSection[];
  initialKey?: string;
  deviceType?: "phone" | "tablet" | "desktop";
  onBackToHome?: () => void;
};

const sectionIcons: Record<string, string> = {
  settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  updates: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
  support: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  theme: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
  account: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  notifications: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  ai: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  model: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
};

function getIconForKey(key: string, icon?: string): string {
  if (icon) return icon;
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(sectionIcons)) {
    if (lower.includes(k)) return v;
  }
  return "M4 6h16M4 12h16M4 18h16"; // fallback hamburger
}

export default function SettingsLayout({ sections, initialKey, deviceType = "desktop", onBackToHome }: SettingsLayoutProps) {
  const validKeys = useMemo(() => new Set(sections.map((s) => s.key)), [sections]);
  const firstKey = sections[0]?.key;
  const [activeKey, setActiveKey] = useState<string>(() => {
    if (initialKey && validKeys.has(initialKey)) return initialKey;
    return firstKey ?? "";
  });

  const [viewingDetail, setViewingDetail] = useState(false);

  const activeSection = sections.find((s) => s.key === activeKey) ?? sections[0];

  const handleSelectSection = (key: string) => {
    setActiveKey(key);
    if (deviceType === "phone") {
      setViewingDetail(true);
    }
  };

  if (deviceType === "phone") {
    return (
      <div className="w-full min-h-screen bg-surface-900 text-text-high p-4 flex flex-col">
        {!viewingDetail ? (
          <div className="flex-1 flex flex-col">
            {/* Top Bar with back to Home button */}
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={onBackToHome}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-muted border border-white/10 hover:bg-white/10 hover:text-text-high transition cursor-pointer"
                title="Go to Home"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-display font-black tracking-tight">Settings Menu</h2>
            </div>

            <aside className="rounded-2xl glass-header p-4 space-y-1.5 flex-1">
              <div className="px-3 py-2 mb-2">
                <h3 className="text-[10px] font-bold text-text-subtle uppercase tracking-widest">Options</h3>
              </div>
              {sections.map((section) => {
                const isActive = section.key === activeKey;
                const iconPath = getIconForKey(section.key, section.icon);
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => handleSelectSection(section.key)}
                    className="w-full rounded-xl px-4 py-3.5 text-left text-xs font-bold tracking-wide transition hover:bg-white/[0.04] cursor-pointer flex items-center justify-between border border-white/[0.03] bg-white/[0.01]"
                  >
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 opacity-60 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                      </svg>
                      {section.label}
                    </div>
                    <svg className="h-4 w-4 text-text-muted opacity-55" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </aside>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Top Bar with back to menu button */}
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => setViewingDetail(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-muted border border-white/10 hover:bg-white/10 hover:text-text-high transition cursor-pointer"
                title="Back to Settings Menu"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-display font-black tracking-tight">{activeSection.label}</h2>
            </div>

            <section className="rounded-2xl glass-header p-5 overflow-auto flex-1 max-h-[calc(100vh-80px)]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeKey}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeSection?.content ?? <div className="text-text-muted font-bold text-xs uppercase tracking-wider">Nothing to show here.</div>}
                </motion.div>
              </AnimatePresence>
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr] h-full items-start">
      <aside className="rounded-2xl glass-header p-3 space-y-0.5">
        <div className="px-3 py-2 mb-1">
          <h3 className="text-[10px] font-bold text-text-subtle uppercase tracking-widest">Settings</h3>
        </div>
        {sections.map((section) => {
          const isActive = section.key === activeKey;
          const iconPath = getIconForKey(section.key, section.icon);
          return (
            <button
              key={section.key}
              onClick={() => handleSelectSection(section.key)}
              className={`relative w-full rounded-xl px-3 py-2.5 text-left text-[11px] font-bold tracking-wide transition-colors duration-200 cursor-pointer flex items-center gap-2.5 ${
                isActive ? "text-text-high" : "text-text-muted hover:text-text-high hover:bg-white/[0.04]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSettingsTab"
                  className="absolute inset-0 bg-white/[0.06] border border-white/[0.06] rounded-xl -z-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
              </svg>
              {section.label}
            </button>
          );
        })}
      </aside>

      <section className="rounded-2xl glass-header p-5 overflow-auto h-full max-h-[calc(100vh-140px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeSection?.content ?? <div className="text-text-muted font-bold text-xs uppercase tracking-wider">Nothing to show here.</div>}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}
