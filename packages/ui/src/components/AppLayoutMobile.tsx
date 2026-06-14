"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type AppLayoutMobileProps = {
  children: React.ReactNode;
  isSafe: boolean;
  onToggleSafe: (next: boolean) => void;
  activeNav?: "home" | "chat" | "creators";
  onSelectNav?: (key: "home" | "chat" | "creators") => void;
  onSearch?: () => void;
  onNotifications?: () => void;
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

const navItems: { key: "home" | "chat" | "creators"; label: string; icon: React.ReactNode }[] = [
  {
    key: "home",
    label: "Home",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
      </svg>
    ),
  },
  {
    key: "chat",
    label: "Chat",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    key: "creators",
    label: "Creators",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

export default function AppLayoutMobile({
  children,
  isSafe,
  onToggleSafe,
  activeNav = "home",
  onSelectNav,
  onSearch,
  onNotifications,
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
}: AppLayoutMobileProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClosingProfile, setIsClosingProfile] = useState(false);
  // Always set showOverlay to false to prevent security violation overlays from appearing
  const showOverlay = false;

  const closeProfileDropdown = () => {
    setIsClosingProfile(true);
    setTimeout(() => {
      setIsClosingProfile(false);
      setIsProfileOpen(false);
    }, 150);
  };

  const toggleProfileDropdown = () => {
    if (isProfileOpen) {
      closeProfileDropdown();
    } else {
      setIsProfileOpen(true);
    }
  };

  const parts = window.location.pathname.split("/").filter(Boolean);
  const isTablet = typeof window !== "undefined" && window.innerWidth >= 768;
  const isFullScreen = (parts[0] === "chat" && parts[1] !== undefined && !["library", "archived"].includes(parts[1])) || (parts[0] === "settings" && !isTablet);
  const isChatRoute = parts[0] === "chat";

  const navRootRef = useRef<HTMLDivElement>(null);

  const setNavShifts = (activeIdx: number | null, phase: "in" | "out") => {
    if (!navRootRef.current) return;
    const cs = getComputedStyle(document.documentElement);
    const num = (name: string, fb: number) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : fb;
    };
    const ease = (name: string, fb: string) =>
      cs.getPropertyValue(name).trim() || fb;

    const lift    = num("--avatar-lift", -5);
    const falloff = num("--avatar-falloff", 0.45);
    const scale   = num("--avatar-scale", 1.06);
    const tf      = phase === "out"
      ? ease("--avatar-ease-out", "cubic-bezier(0.34, 3.85, 0.64, 1)")
      : ease("--avatar-ease-in",  "cubic-bezier(0.22, 1, 0.36, 1)");

    navRootRef.current.querySelectorAll(".t-avatar").forEach((el: any, i) => {
      el.style.transitionTimingFunction = tf;
      if (activeIdx == null) {
        el.style.setProperty("--shift", "0px");
        el.style.setProperty("--scale-active", "1");
        return;
      }
      const d = Math.abs(i - activeIdx);
      el.style.setProperty(
        "--shift",
        (lift * Math.pow(falloff, d)).toFixed(3) + "px"
      );
      el.style.setProperty(
        "--scale-active",
        i === activeIdx ? String(scale) : "1"
      );
    });
  };

  return (
    <div className="h-screen bg-surface-900 text-text-high flex flex-col overflow-hidden">
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

      {/* Top bar — Centered Title only */}
      {!isFullScreen && (
        <header className="flex-shrink-0 z-20 px-3 pt-2 pb-1">
          <div className="flex items-center justify-between rounded-2xl bg-surface-900/70 px-3 py-2 shadow-xl backdrop-blur-md ring-1 ring-border-subtle/20 h-12">
            <div className="w-8 h-8 flex-shrink-0" />
            <span className="font-display text-lg font-semibold text-text-high">Klie</span>
            <div className="w-8 h-8 flex-shrink-0" />
          </div>
        </header>
      )}

      {/* Body */}
      <main className={`flex-1 ${isFullScreen ? "h-full p-0 overflow-hidden" : isChatRoute ? "px-2 pb-2 overflow-hidden flex flex-col" : "overflow-y-auto px-2 pb-2"} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']`}>
        <div className={`${isFullScreen ? "h-full w-full" : isChatRoute ? "h-full w-full rounded-2xl bg-surface-900/60 flex flex-col overflow-hidden" : "min-h-full w-full rounded-2xl bg-surface-900/60"}`}>{children}</div>
      </main>

      {/* Bottom nav */}
      {!isFullScreen && (
        <nav className="flex-shrink-0 z-20 px-4 pt-1 pb-3 flex justify-center">
          <div className="flex items-center gap-1 rounded-full bg-surface-900/50 p-1.5 shadow-lg border border-white/6 backdrop-blur-xl max-w-sm sm:max-w-md md:max-w-lg w-auto justify-center">
          
          {/* User Icon (Profile) Button - Left side */}
          <div className="relative">
            <button
              onClick={toggleProfileDropdown}
              className="relative w-11 h-11 rounded-full overflow-hidden border border-surface-700 bg-surface-900 hover:ring-2 hover:ring-primary-500 transition-all focus:outline-none flex-shrink-0 cursor-pointer"
            >
              <img
                src={profileImageUrl ?? "https://ui-avatars.com/api/?name=User&background=111111&color=ffffff"}
                alt={profileAlt}
                className="w-full h-full object-cover"
              />
            </button>
            {(isProfileOpen || isClosingProfile) && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={closeProfileDropdown}
                />
                {/* Dropdown - opens ABOVE the navbar */}
                <div
                  className={`t-dropdown absolute left-0 bottom-full mb-2.5 w-48 bg-surface-800/95 backdrop-blur-md border border-surface-700 rounded-lg shadow-xl py-1.5 z-50 ${
                    isProfileOpen && !isClosingProfile ? "is-open" : ""
                  } ${isClosingProfile ? "is-closing" : ""}`}
                  data-origin="bottom-left"
                >
                  {deviceType !== "phone" && (
                    <button
                      className="w-full text-left px-4 py-2.5 text-sm text-text-muted hover:bg-surface-700 hover:text-text-high transition-colors cursor-pointer"
                      onClick={() => {
                        onUpdates?.();
                        closeProfileDropdown();
                      }}
                    >
                      Updates
                    </button>
                  )}
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-text-muted hover:bg-surface-700 hover:text-text-high transition-colors cursor-pointer"
                    onClick={() => {
                      onSettings?.();
                      closeProfileDropdown();
                    }}
                  >
                    Settings
                  </button>
                  {deviceType !== "phone" && (
                    <button
                      className="w-full text-left px-4 py-2.5 text-sm text-text-muted hover:bg-surface-700 hover:text-text-high transition-colors cursor-pointer"
                      onClick={() => {
                        onSupport?.();
                        closeProfileDropdown();
                      }}
                    >
                      Support Us
                    </button>
                  )}
                  <hr className="my-1 border-border-subtle/20" />
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    onClick={() => {
                      onLogout?.();
                      closeProfileDropdown();
                    }}
                  >
                    Log Out
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Main Nav Items (Home, Chat, Creators) */}
          <div
            ref={navRootRef}
            onMouseLeave={() => setNavShifts(null, "out")}
            className="flex items-center gap-1.5 px-1.5"
          >
            {navItems.map((item, idx) => {
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectNav?.(item.key)}
                  onMouseEnter={() => setNavShifts(idx, "in")}
                  className={`t-avatar relative rounded-full px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 cursor-pointer flex items-center gap-1.5 ${
                    isActive ? "text-black font-extrabold" : "text-text-muted hover:text-text-high"
                  }`}
                >
                  {isActive && (
                    <span
                      className="absolute inset-0 bg-primary-400 rounded-full -z-10 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
                    />
                  )}
                  {item.icon}
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Button - Right side */}
          <button
            onClick={onSearch}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-700/50 text-text-high ring-1 ring-border-subtle/30 hover:bg-surface-700 transition cursor-pointer flex-shrink-0"
            aria-label="Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
            </svg>
          </button>

        </div>
      </nav>
      )}
    </div>
  );
}
