"use client";
const hasHover = typeof window !== "undefined" && window.innerWidth >= 1024;

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type AppLayoutProps = {
  children: React.ReactNode;
  isSafe: boolean;
  onToggleSafe: (next: boolean) => void;
  activeNav?: "home" | "chat" | "creators";
  onSelectNav?: (key: "home" | "chat" | "creators") => void;
  onSearch?: () => void;
  onNotifications?: () => void;
  centerContent?: React.ReactNode;
  onUpdates?: () => void;
  onSettings?: () => void;
  onSupport?: () => void;
  onLogout?: () => void;
  profileImageUrl?: string;
  profileAlt?: string;
  subscriptionPlan?: "FREE" | "PLUS" | "PRO";
  subscriptionStatus?: string;
  integrityStatus?: "OK" | "DEPRECATED" | "REVOKED" | "LOADING";
  integrityMessage?: string;
  updateUrl?: string;
  deviceType?: "phone" | "tablet" | "desktop";
};

const navItems: { key: "home" | "chat" | "creators"; label: string; icon: string }[] = [
  { key: "home", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "chat", label: "Chat", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "creators", label: "Creators", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" },
];

const menuItems: { label: string; icon: string; danger?: boolean }[] = [
  { label: "Updates", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" },
  { label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { label: "Support Us", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { label: "Log Out", icon: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1", danger: true },
];

const staggerItem = {
  hidden: { opacity: 0, y: 6, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.04, duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  }),
  exit: { opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.15 } },
};

export default function AppLayout({
  children,
  isSafe,
  onToggleSafe,
  activeNav = "home",
  onSelectNav,
  onSearch,
  onNotifications,
  centerContent,
  onUpdates,
  onSettings,
  onSupport,
  onLogout,
  profileImageUrl,
  profileAlt = "Profile",
  subscriptionPlan = "FREE",
  subscriptionStatus,
  integrityStatus = "OK",
  integrityMessage,
  updateUrl,
  deviceType,
}: AppLayoutProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Always set showOverlay to false to prevent security violation overlays from appearing
  const showOverlay = false;

  const getMenuCallback = (label: string) => {
    if (label === "Updates") return onUpdates;
    if (label === "Settings") return onSettings;
    if (label === "Support Us") return onSupport;
    return onLogout;
  };

  return (
    <div className="relative min-h-screen bg-surface-900 text-text-high overflow-hidden select-none">
      {/* Apple-Style Ambient Floating Glass Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-12%] left-[-12%] w-[58%] h-[58%] bg-indigo-500/22 rounded-full blur-[125px] orb-morph" />
        <div className="absolute bottom-[-12%] right-[-12%] w-[58%] h-[58%] bg-purple-500/18 rounded-full blur-[125px] orb-morph" style={{ animationDelay: "-6s" }} />
        <div className="absolute top-[35%] left-[55%] w-[35%] h-[35%] bg-pink-500/14 rounded-full blur-[110px] orb-morph" style={{ animationDelay: "-12s" }} />
      </div>

      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-surface-900/95 backdrop-blur-xl p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.8 }}
              className="max-w-md space-y-6 bg-surface-800/80 p-8 rounded-3xl border border-border-subtle/10 shadow-2xl backdrop-blur-2xl"
            >
              <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-display font-bold text-text-high">
                  {integrityStatus === "REVOKED" ? "Access Revoked" : "Update Required"}
                </h1>
                <p className="text-text-muted text-base leading-relaxed">
                  {integrityMessage || "A security issue has been detected or your version is no longer supported."}
                </p>
              </div>
              {updateUrl && (
                <a 
                  href={updateUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-primary-glow inline-block w-full rounded-full bg-primary-500 px-8 py-3.5 text-sm font-bold text-black hover:bg-primary-400 transition shadow-lg shadow-primary-500/15"
                >
                  Download Latest Version
                </a>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 w-full px-2 pb-4 pt-3 md:px-4">
        <header className="glass-header relative z-20 mb-4 flex items-center justify-between rounded-2xl px-3 py-2.5 md:px-4 md:py-3">
          {/* Profile button (left) */}
          <div className="relative" onMouseLeave={() => setIsProfileOpen(false)}>
            <motion.button
              whileHover={hasHover ? { scale: 1.06 } : undefined}
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="pulse-ring-hover relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 bg-surface-900 hover:border-primary-400/40 transition-all duration-300 focus:outline-none flex-shrink-0 cursor-pointer"
            >
              <img
                src={profileImageUrl ?? "https://ui-avatars.com/api/?name=User&background=111111&color=ffffff"}
                alt={profileAlt}
                className="w-full h-full object-cover"
              />
            </motion.button>
            
            <AnimatePresence>
              {isProfileOpen && (
                <>
                  {/* Click-away backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="absolute left-0 top-full mt-2 w-52 rounded-2xl shadow-2xl z-50 p-1.5 overflow-hidden"
                    style={{
                      backgroundColor: "hsl(var(--surface-800))",
                      borderColor: "hsl(var(--border-subtle) / 0.12)",
                      borderWidth: "1px",
                    }}
                  >
                    {/* User info header */}
                    <div 
                      className="px-3 py-2.5 mb-1"
                      style={{
                        borderBottom: "1px solid hsl(var(--border-subtle) / 0.05)"
                      }}
                    >
                      <p className="text-xs font-bold text-text-high truncate">{profileAlt}</p>
                      <p className="text-[10px] text-text-subtle font-medium mt-0.5">{subscriptionPlan} Plan</p>
                    </div>
 
                    {(deviceType === "phone" 
                      ? menuItems.filter(item => item.label === "Settings" || item.label === "Log Out")
                      : menuItems
                    ).map((item, i) => (
                      <motion.button
                        key={item.label}
                        custom={i}
                        variants={staggerItem}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        whileHover={hasHover ? { x: 2, backgroundColor: item.danger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.05)" } : undefined}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-2.5 transition-colors duration-200 cursor-pointer ${
                          item.danger ? "text-red-400" : "text-text-muted hover:text-text-high"
                        }`}
                        onClick={() => {
                          getMenuCallback(item.label)?.();
                          setIsProfileOpen(false);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                        </svg>
                        {item.label}
                      </motion.button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Center nav pill */}
          {centerContent ?? (
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full bg-surface-900/50 p-1 shadow-lg border border-white/6 backdrop-blur-xl">
              {navItems.map((item) => {
                const isActive = activeNav === item.key;
                return (
                  <motion.button
                    whileHover={hasHover ? { scale: 1.04 } : undefined}
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    key={item.key}
                    className={`relative rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 cursor-pointer flex items-center gap-1.5 ${
                      isActive ? "text-black font-extrabold" : "text-text-muted hover:text-text-high"
                    }`}
                    onClick={() => onSelectNav?.(item.key)}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeTabPill"
                        className="absolute inset-0 bg-primary-400 rounded-full -z-10 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      />
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </motion.button>
                );
              })}
              <motion.button
                whileHover={hasHover ? { scale: 1.1 } : undefined}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => onSearch?.()}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-text-muted hover:text-text-high ring-1 ring-white/6 hover:bg-white/10 hover:ring-white/12 transition-all cursor-pointer"
                aria-label="Search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
                </svg>
              </motion.button>
            </div>
          )}

          <div className="w-10 h-10 flex-shrink-0" />
        </header>

        {/* Body Container — with inner border glow */}
        <main className="rounded-2xl bg-surface-800/15 p-4 md:p-6 h-[calc(100vh-100px)] border border-white/[0.04] overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <div className="h-full w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
