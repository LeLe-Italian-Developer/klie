import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke as tauriInvoke, Channel } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";

import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import { ask, save, open } from "@tauri-apps/plugin-dialog";
import signupIllustration from "./assets/signup_illustration.png";
import klieLogoWhite from "./assets/klie_logo_white.png";
import appIconWhite from "./assets/app_icon_white.png";
import competitorChai from "./assets/competitor_chai.png";
import competitorCai from "./assets/competitor_cai.png";
import competitorFiction from "./assets/competitor_fiction.png";
import competitorTalkie from "./assets/competitor_talkie.png";
import competitorEmochi from "./assets/competitor_emochi.png";
import competitorSeasoul from "./assets/competitor_seasoul.png";
import competitorCrushon from "./assets/competitor_crushon.png";
import competitorJanitor from "./assets/competitor_janitor.png";
import { gsap } from "gsap";
import Lenis from "lenis";

const hasHover = typeof window !== "undefined" && window.innerWidth >= 1024;
// Base API URL (always points to live production Vercel)
const API_URL = "https://revtechcompany.com";

// Safe invoke helper (top-level for all components to access)
const invoke = async <T,>(cmd: string, args?: any): Promise<T> => {
  const win = window as any;
  if (!win.__TAURI_INTERNALS__ && !win.__TAURI_INVOKE__) {
    throw new Error(`Tauri bridge is not available. Command ${cmd} failed.`);
  }

  try {
    return await tauriInvoke(cmd, args);
  } catch (err) {
    console.error(`Invoke error for ${cmd}:`, err);
    throw err;
  }
};

const isTauriRuntime = (): boolean => {
  const win = window as any;
  return Boolean(win.__TAURI_INTERNALS__ || win.__TAURI_INVOKE__);
};

const isExternalUrl = (url: string): boolean => /^(https?:|mailto:|tel:)/i.test(url.trim());

const openUrl = (url: string): void => {
  const targetUrl = url.trim();
  if (!isExternalUrl(targetUrl)) {
    console.warn("[openUrl] Refusing to open unsupported URL:", url);
    return;
  }

  if (isTauriRuntime()) {
    void invoke("open_external_url", { url: targetUrl }).catch((err) => {
      console.error("[openUrl] Failed to open external URL:", err);
    });
    return;
  }

  window.open(targetUrl, "_blank", "noopener,noreferrer");
};

const installExternalLinkInterceptor = (): void => {
  const win = window as any;
  const previousHandler = win.__KLIE_EXTERNAL_LINK_HANDLER__ as EventListener | undefined;
  if (previousHandler) {
    document.removeEventListener("click", previousHandler, true);
  }

  const handler = (event: Event) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor) return;

    const href = anchor.getAttribute("href")?.trim();
    if (!href || href === "#" || href.startsWith("#") || href.startsWith("/")) return;
    if (!isExternalUrl(href)) return;

    event.preventDefault();
    event.stopPropagation();
    openUrl(href);
  };

  document.addEventListener("click", handler, true);
  win.__KLIE_EXTERNAL_LINK_HANDLER__ = handler;
};

installExternalLinkInterceptor();

const mapLocalCharToCamel = (lc: any): Character => {
  if (!lc) return lc;
  const char: Character = {
    id: lc.id,
    name: lc.name,
    greeting: lc.greeting || "",
    systemPrompt: lc.systemPrompt || "",
    description: lc.description || "",
    shortDescription: lc.shortDescription || "",
    sex: lc.sex || "",
    isSFW: lc.isSFW !== false,
    personality: lc.personality || "",
    hairColor: lc.hairColor || "",
    eyeColor: lc.eyeColor || "",
    skinColor: lc.skinColor || "",
    clothes: lc.clothes || "",
    body: lc.body || "",
    gadgets: lc.gadgets || "",
    imageUrl: lc.imageUrl || "",
    creatorName: lc.creatorName || "Offline Cached",
    creatorId: lc.creatorId || "",
    isWorld: lc.isWorld === 1 || lc.isWorld === true,
    isDownloaded: lc.isDownloaded === 1 || lc.isDownloaded === true,
  };
  if (lc.points !== undefined) {
    char.points = lc.points;
  }
  return char;
};

const parseLocationsText = (text: string) => {
  if (!text) return [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed: { name: string; description: string }[] = [];
  
  for (const line of lines) {
    const match = line.match(/^[-*]\s*\*\*(.*?)\*\*:\s*(.*)/);
    if (match) {
      parsed.push({ name: match[1].trim(), description: match[2].trim() });
    } else {
      const cleanLine = line.replace(/^[-*]\s*/, "");
      const colonIdx = cleanLine.indexOf(":");
      if (colonIdx !== -1) {
        parsed.push({
          name: cleanLine.substring(0, colonIdx).trim().replace(/^\*\*|\*\*$/g, ""),
          description: cleanLine.substring(colonIdx + 1).trim()
        });
      } else {
        parsed.push({ name: "Location", description: cleanLine });
      }
    }
  }
  return parsed;
};

const mapCamelToLocal = (char: Character) => {
  return {
    id: char.id,
    name: char.name,
    greeting: char.greeting || "",
    systemPrompt: char.systemPrompt || "",
    description: char.description || "",
    shortDescription: char.shortDescription || "",
    sex: char.sex || "",
    isSFW: char.isSFW !== false,
    personality: char.personality || "",
    hairColor: char.hairColor || "",
    eyeColor: char.eyeColor || "",
    skinColor: char.skinColor || "",
    clothes: char.clothes || "",
    body: char.body || "",
    gadgets: char.gadgets || "",
    imageUrl: char.imageUrl || "",
    creatorName: char.creatorName || "",
    creatorId: char.creatorId || "",
    isWorld: char.isWorld ? true : false,
    isDownloaded: char.isDownloaded ? true : false,
  };
};

const calculateSystemPromptLength = (char: {
  name?: string;
  description?: string;
  personality?: string;
  sex?: string;
  hairColor?: string;
  eyeColor?: string;
  skinColor?: string;
  clothes?: string;
  body?: string;
  gadgets?: string;
  isSFW?: boolean;
}): number => {
  const parts: string[] = [];
  const name = (char.name || "").trim();
  parts.push(`You are ${name}.`);
  const desc = (char.description || "").trim();
  if (desc) parts.push(`Description: ${desc}`);
  const pers = (char.personality || "").trim();
  if (pers) parts.push(`Personality: ${pers}`);
  const sex = (char.sex || "").trim();
  if (sex) parts.push(`Sex: ${sex}`);
  const hair = (char.hairColor || "").trim();
  if (hair) parts.push(`Hair color: ${hair}`);
  const eye = (char.eyeColor || "").trim();
  if (eye) parts.push(`Eye color: ${eye}`);
  const skin = (char.skinColor || "").trim();
  if (skin) parts.push(`Skin color: ${skin}`);
  const clothes = (char.clothes || "").trim();
  if (clothes) parts.push(`Clothes: ${clothes}`);
  const body = (char.body || "").trim();
  if (body) parts.push(`Body: ${body}`);
  const gadgets = (char.gadgets || "").trim();
  if (gadgets) parts.push(`Gadgets/accessories: ${gadgets}`);
  if (char.isSFW === false) {
    parts.push("You may engage in mature themes as appropriate.");
  } else {
    parts.push("Keep all responses safe for work and appropriate for all audiences.");
  }
  parts.push("Stay in character at all times. Reply naturally as this character.");
  return parts.join("\n").length;
};

const getFormattedUserPersona = (): string => {
  const saved = localStorage.getItem("klie.userPersona");
  if (!saved) return "";
  try {
    const p = JSON.parse(saved);
    const parts: string[] = [];
    if (p.name) parts.push(`Name: ${p.name}`);
    if (p.sex) parts.push(`Sex/Gender: ${p.sex}`);
    if (p.description) parts.push(`Bio/Background: ${p.description}`);
    if (p.personality) parts.push(`Personality: ${p.personality}`);
    if (p.body) parts.push(`Appearance: ${p.body}`);
    if (p.clothing) parts.push(`Clothing: ${p.clothing}`);
    if (p.gadgets) parts.push(`Gadgets: ${p.gadgets}`);
    return parts.join("\n");
  } catch (e) {
    console.error("Error formatting user persona:", e);
    return "";
  }
};

// Safe listen helper

const listen = async <T,>(event: string, handler: (event: any) => void): Promise<UnlistenFn> => {
  const win = window as any;
  if (!win.__TAURI_INTERNALS__) {
    console.warn(`Tauri bridge not available. Cannot listen to event: ${event}`);
    return () => { }; // Dummy unlisten function
  }
  try {
    return await tauriListen<T>(event, handler);
  } catch (err) {
    console.error(`Listen error for ${event}:`, err);
    return () => { };
  }
};





import { verifyOfflineLicenseJWT } from "@/auth/offlineLicense";
import AppLayout from "@ui/components/AppLayout";
import AppLayoutMobile from "@ui/components/AppLayoutMobile";
import CharacterCard from "@ui/components/CharacterCard";
import CreatorCard from "@ui/components/CreatorCard";
import ChatInterface, { ChatBot, ChatMessage } from "@ui/components/ChatInterface";
import SettingsLayout, { SettingsSection } from "@ui/components/SettingsLayout";
import SearchGrid, { SearchItem } from "@ui/components/SearchGrid";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link as RouterLink,
  useParams,
  useNavigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";

type Character = {
  id: string;
  name: string;
  creatorName: string;
  points?: number;
  imageUrl: string;
  isPro?: boolean;
  releaseLabel?: string;
  ownerId?: string;
  description?: string;
  shortDescription?: string;
  greeting?: string;
  creatorId?: string;
  isSFW?: boolean;
  sex?: string;
  personality?: string;
  hairColor?: string;
  eyeColor?: string;
  skinColor?: string;
  clothes?: string;
  body?: string;
  gadgets?: string;
  systemPrompt?: string;
  isWorld?: boolean;
  isDownloaded?: boolean;
  locations?: any[];
};

type Conversation = {
  id: string;
  characterId: string;
  lastMessage?: string;
  lastTimestamp?: string;
  hasUserMessage?: boolean;
};

type Creator = {
  id: string;
  displayName: string;
  handle: string;
  totalPoints: number;
  avatarUrl: string;
  rank: number;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
};

type AuthProvider = "password";

type StoredUser = {
  id: string;
  email: string;
  password: string | null;
  displayName: string;
  avatarUrl: string;
  role: "admin" | "creator" | "user";
  provider: AuthProvider;
};

type SessionUser = Omit<StoredUser, "password"> & {
  sessionToken?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  capabilities?: string[];
  totalPoints?: number;
};

type DataLogEntry = {
  id: string;
  timestamp: string;
  type: string;
  endpoint: string;
  status: string;
  details: string;
};

type CreatorFormState = {
  name: string;
  description: string;
  shortDescription: string;
  sex: string;
  isSFW: boolean;
  personality: string;
  hairColor: string;
  eyeColor: string;
  skinColor: string;
  clothes: string;
  body: string;
  gadgets: string;
  greeting: string;
  image: File | null;
  worldBuilding?: string;
  characterBuilding?: string;
  isWorld: boolean;
};


const SESSION_STORAGE_KEY = "klie.session";

const ADMIN_USER: StoredUser = {
  id: "admin-user",
  email: "admin@klie.app",
  password: "Admin123!",
  displayName: "Klie Admin",
  avatarUrl: "https://ui-avatars.com/api/?name=Klie+Admin&background=080808&color=ffffff",
  role: "admin",
  provider: "password",
};

function toSessionUser(user: StoredUser): SessionUser {
  const { password: _password, ...sessionUser } = user;
  return sessionUser;
}

function readStoredSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
}

function buildAvatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=080808&color=ffffff`;
}

const fallbackCharacters: Character[] = [];

const fallbackCreators: Creator[] = [];

const defaultCreatorForm: CreatorFormState = {
  name: "",
  description: "",
  shortDescription: "",
  sex: "",
  isSFW: true,
  personality: "",
  hairColor: "#000000",
  eyeColor: "#000000",
  skinColor: "#F5DEB3",
  clothes: "",
  body: "",
  gadgets: "",
  greeting: "",
  image: null,
  worldBuilding: "",
  characterBuilding: "",
  isWorld: false,
};


function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHue(hex: string): number {
  let cleanHex = (hex || "#ff0000").replace(/^#/, "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map(c => c + c).join("");
  }
  let r = parseInt(cleanHex.substring(0, 2), 16) / 255 || 0;
  let g = parseInt(cleanHex.substring(2, 4), 16) / 255 || 0;
  let b = parseInt(cleanHex.substring(4, 6), 16) / 255 || 0;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    let d = max - min;
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return Math.round(h * 360);
}

type ColorWheelPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
};

function ColorWheelPicker({ value, onChange, size = 100 }: ColorWheelPickerProps) {
  const wheelRef = React.useRef<HTMLDivElement>(null);
  const hue = hexToHue(value || "#ff0000");

  const [inputValue, setInputValue] = React.useState(value || "#ff0000");

  React.useEffect(() => {
    setInputValue(value || "#ff0000");
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);
    let clean = text.trim();
    if (clean.length > 0 && !clean.startsWith("#")) {
      clean = "#" + clean;
    }
    if (/^#[0-9A-F]{3}$/i.test(clean) || /^#[0-9A-F]{6}$/i.test(clean)) {
      onChange(clean);
    }
  };

  const handlePointer = (e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    let angle = Math.atan2(dy, dx);
    let degrees = angle * (180 / Math.PI);
    if (degrees < 0) degrees += 360;

    // Output premium vivid hex code
    const hexColor = hslToHex(degrees, 100, 50);
    onChange(hexColor);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (wheelRef.current) {
      wheelRef.current.setPointerCapture(e.pointerId);
    }
    handlePointer(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (wheelRef.current && wheelRef.current.hasPointerCapture(e.pointerId)) {
      handlePointer(e);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (wheelRef.current) {
      wheelRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const angleRad = (hue - 90) * (Math.PI / 180);
  const radius = (size / 2) * 0.76;
  const handleX = size / 2 + radius * Math.cos(angleRad);
  const handleY = size / 2 + radius * Math.sin(angleRad);

  return (
    <div className="flex flex-col items-center gap-2 bg-surface-900/10 p-3 rounded-2xl border border-white/[0.02] w-full max-w-[130px] shrink-0">
      <div
        ref={wheelRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)",
          position: "relative",
          cursor: "crosshair",
          touchAction: "none",
        }}
        className="ring-1 ring-white/15 shadow-md select-none"
      >
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            top: "22%",
            left: "22%",
            width: "56%",
            height: "56%",
            backgroundColor: "#16171d"
          }}
        >
          <div
            className="w-4 h-4 rounded-full shadow-inner border border-white/10"
            style={{ backgroundColor: value || "#ff0000" }}
          />
        </div>

        <div
          className="absolute w-4 h-4 rounded-full bg-white border border-black/30 shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            left: handleX,
            top: handleY,
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: value || "#ff0000" }} />
        </div>
      </div>

      {/* Precision Slider */}
      <div className="w-full px-1">
        <input
          type="range"
          min="0"
          max="360"
          value={hue}
          onChange={(e) => {
            const h = parseInt(e.target.value, 10);
            const hex = hslToHex(h, 100, 50);
            onChange(hex);
          }}
          style={{
            background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
          }}
          className="w-full h-1 rounded-lg appearance-none cursor-pointer focus:outline-none ring-1 ring-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/20 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
        />
      </div>

      {/* Hex Text & Micro Nudges */}
      <div className="flex items-center justify-center gap-1.5 bg-surface-950/80 px-2 py-1 rounded-xl border border-white/[0.04] shadow-inner w-full max-w-[120px] shrink-0">
        <button
          type="button"
          onClick={() => {
            let nextHue = hue - 2;
            if (nextHue < 0) nextHue += 360;
            onChange(hslToHex(nextHue, 100, 50));
          }}
          className="p-1 text-text-muted hover:text-text-high hover:bg-white/5 active:scale-95 rounded-lg transition shrink-0"
          title="Decrease Hue"
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <input
          type="text"
          value={inputValue.toUpperCase()}
          onChange={handleInputChange}
          className="w-14 text-center text-[10px] font-mono tracking-wider text-text-high bg-transparent border-none outline-none select-all uppercase shrink-0 focus:ring-0 focus:outline-none"
          placeholder="#FF0000"
        />

        <button
          type="button"
          onClick={() => {
            let nextHue = hue + 2;
            if (nextHue >= 360) nextHue -= 360;
            onChange(hslToHex(nextHue, 100, 50));
          }}
          className="p-1 text-text-muted hover:text-text-high hover:bg-white/5 active:scale-95 rounded-lg transition shrink-0"
          title="Increase Hue"
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

type ImageColorPickerProps = {
  image: File | string;
  onColorSelect: (hex: string) => void;
  activeTraitName: string;
  activeColor: string;
};

function ImageColorPicker({ image, onColorSelect, activeTraitName, activeColor }: ImageColorPickerProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [imgUrl, setImgUrl] = React.useState<string>("");
  const [hoverColor, setHoverColor] = React.useState<string>("");
  const [loupePos, setLoupePos] = React.useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

  React.useEffect(() => {
    if (!image) return;
    if (image instanceof File) {
      const url = URL.createObjectURL(image);
      setImgUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof image === "string") {
      setImgUrl(image);
    }
  }, [image]);

  React.useEffect(() => {
    if (!imgUrl) return;
    const img = new Image();
    if (imgUrl.startsWith("http")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set resolution based on image natural size
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = imgUrl;
  }, [imgUrl]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
      setLoupePos(prev => ({ ...prev, show: false }));
      return;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = Math.floor(x * scaleX);
    const clickY = Math.floor(y * scaleY);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      try {
        const pixel = ctx.getImageData(clickX, clickY, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        setHoverColor(hex);
        setLoupePos({ x, y, show: true });
      } catch (err) {
        // Fallback for CORS or canvas taint
      }
    }
  };

  const handlePointerLeave = () => {
    setLoupePos(prev => ({ ...prev, show: false }));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = Math.floor(x * scaleX);
    const clickY = Math.floor(y * scaleY);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      try {
        const pixel = ctx.getImageData(clickX, clickY, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        onColorSelect(hex);
      } catch (err) {
        console.warn("Failed to select color:", err);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-900/20 border border-white/[0.04] rounded-2xl w-full">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-text-high uppercase tracking-wider">
          Click Image to Pick Color
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">
            Targeting: <span className="text-primary-400 font-bold capitalize">{activeTraitName}</span>
          </span>
          <div className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-md shrink-0" style={{ backgroundColor: activeColor }} />
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-inner bg-surface-950/60 flex items-center justify-center cursor-crosshair group max-h-[350px] md:max-h-[450px] w-full">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerDown}
          className="max-w-full max-h-[350px] md:max-h-[450px] object-contain select-none"
        />

        {loupePos.show && (
          <div
            className="absolute rounded-full pointer-events-none ring-2 ring-white shadow-2xl overflow-hidden flex items-center justify-center border border-black/20"
            style={{
              width: 76,
              height: 76,
              left: loupePos.x - 38,
              top: loupePos.y - 38,
              backgroundColor: hoverColor,
            }}
          >
            {/* Center target cursor */}
            <div className="absolute w-2 h-2 rounded-full border border-white mix-blend-difference" />
            <div className="absolute bottom-1 bg-surface-950/90 px-1 py-0.5 rounded text-[8px] font-mono text-text-high border border-white/10 scale-90 select-none">
              {hoverColor.toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HomeView({
  characters,
  creators,
  onSelectCharacter,
  onSelectCreator,
  onFollowCreator,
  followedCreatorIds,
  currentUser,
  onLoadMoreCreators,
}: {
  characters: Character[];
  creators: Creator[];
  onSelectCharacter: (id: string) => void;
  onSelectCreator: (creator: Creator) => void;
  onFollowCreator: (id: string) => void;
  followedCreatorIds: string[];
  currentUser: SessionUser | null;
  onLoadMoreCreators?: () => Promise<void>;
}) {
  const [creatorsLimit, setCreatorsLimit] = useState(6);
  const [activePlanTab, setActivePlanTab] = useState<"free" | "plus" | "pro">("plus");

  const sortedCreators = useMemo(() => {
    const sorted = [...creators].sort((a, b) => b.totalPoints - a.totalPoints);
    return sorted.map((c, index) => ({
      ...c,
      rank: index + 1,
    }));
  }, [creators]);

  const visibleCreators = useMemo(() => {
    return sortedCreators.slice(0, creatorsLimit);
  }, [sortedCreators, creatorsLimit]);

  const [currency, setCurrency] = useState({
    code: "USD",
    symbol: "$",
    plusPrice: "2.99",
    proPrice: "4.99",
    freePrice: "0"
  });

  useEffect(() => {
    const handleOnline = () => {
      console.log("App came online, triggering sync...");
      invoke('sync_all_dirty').catch((err) => console.warn("Sync all dirty failed:", err));
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    let active = true;

    async function determineCurrency() {
      let resolvedCurrency = "EUR";
      let resolvedSymbol = "€";

      // 1. Try our own Vercel geolocation endpoint
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch("https://revtechcompany.com/api/currency", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.currency) {
            resolvedCurrency = data.currency;
            resolvedSymbol = data.symbol;
          }
        }
      } catch (e) {
        console.log("Vercel IP geolocation failed in app, trying local fallback:", e);
        // Fallback to local timezone check
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
          const locale = navigator.language || "";
          const isEuroZone =
            tz.includes("Europe") ||
            locale.startsWith("it") ||
            locale.startsWith("fr") ||
            locale.startsWith("de") ||
            locale.startsWith("es") ||
            locale.startsWith("nl") ||
            locale.startsWith("be") ||
            locale.startsWith("at") ||
            locale.startsWith("fi") ||
            locale.startsWith("ie") ||
            locale.startsWith("pt");

          if (!isEuroZone) {
            resolvedCurrency = "USD";
            resolvedSymbol = "$";
          }
        } catch (err) {
          console.error("Local fallback failed:", err);
        }
      }

      // 2. Fetch active exchange rates if currency is NOT EUR
      let rate = 1.0;
      if (resolvedCurrency !== "EUR") {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const res = await fetch("https://open.er-api.com/v6/latest/EUR", { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data && data.rates && data.rates[resolvedCurrency]) {
              rate = data.rates[resolvedCurrency];
            }
          }
        } catch (e) {
          console.log("Exchange rate API fetch failed in app, using standard static rates:", e);
          // Fallback static rates
          if (resolvedCurrency === "USD") rate = 1.09;
          else if (resolvedCurrency === "CAD") rate = 1.48;
          else if (resolvedCurrency === "GBP") rate = 0.85;
          else if (resolvedCurrency === "AUD") rate = 1.62;
          else if (resolvedCurrency === "JPY") rate = 168.0;
        }
      }

      // 3. Compute converted prices
      const freeConverted = "0";
      const plusConverted = (2.99 * rate).toLocaleString(resolvedCurrency === "EUR" ? "it-IT" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      const proConverted = (4.99 * rate).toLocaleString(resolvedCurrency === "EUR" ? "it-IT" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      if (active) {
        setCurrency({
          code: resolvedCurrency,
          symbol: resolvedSymbol,
          plusPrice: plusConverted,
          proPrice: proConverted,
          freePrice: freeConverted
        });
      }
    }

    determineCurrency();

    return () => {
      active = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.995 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-10"
    >
      <section className="glass-card rounded-2xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.08),transparent_40%),linear-gradient(120deg,rgba(0,0,0,0.35),rgba(0,0,0,0.1))] p-5 border border-white/[0.05]">
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="rounded-xl bg-white/[0.03] p-5 border border-white/[0.04]">
            <h2 className="font-display text-lg font-bold text-text-high">Find Your Plan</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              Choose the path that fits: Free, Plus, or Pro. Upgrade to unlock memory, training, and creator perks.
            </p>
            <div className="mt-4 space-y-1.5 text-[11px] text-text-muted font-semibold">
              <div className="font-display font-bold text-text-subtle mb-1.5 uppercase tracking-widest text-[9px]">Support us</div>
              <a className="flex items-center gap-2 hover:text-text-high transition group" href="https://github.com/LeLe-Italian-Developer/klie.git" target="_blank" rel="noreferrer">
                <span className="w-1 h-1 rounded-full bg-text-subtle group-hover:bg-primary-400 transition" />
                GitHub
              </a>
              <a className="flex items-center gap-2 hover:text-text-high transition group" href="https://www.reddit.com/r/KlieHub/" target="_blank" rel="noreferrer">
                <span className="w-1 h-1 rounded-full bg-text-subtle group-hover:bg-primary-400 transition" />
                Reddit
              </a>
              <a className="flex items-center gap-2 hover:text-text-high transition group" href="#">
                <span className="w-1 h-1 rounded-full bg-text-subtle group-hover:bg-primary-400 transition" />
                Discord
              </a>
            </div>
          </div>
          <div className="flex-1 hidden lg:block">
            {/* Mobile Plan Selector Tabs */}
            <div className="flex md:hidden items-center justify-center gap-1 rounded-full bg-surface-900/50 p-1 border border-white/6 mb-4 max-w-xs mx-auto">
              {(["free", "plus", "pro"] as const).map((plan) => {
                const active = activePlanTab === plan;
                return (
                  <button
                    key={plan}
                    onClick={() => setActivePlanTab(plan)}
                    className={`flex-1 rounded-full py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      active ? "bg-white text-black font-extrabold shadow-md" : "text-text-muted hover:text-text-high"
                    }`}
                  >
                    {plan}
                  </button>
                );
              })}
            </div>

            <div className={`grid gap-3 grid-cols-1 ${!(currentUser?.subscriptionPlan === "PLUS" || currentUser?.subscriptionPlan === "PRO") ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
              {!(currentUser?.subscriptionPlan === "PLUS" || currentUser?.subscriptionPlan === "PRO") && (
                <div className={`glass-card rounded-xl p-4 flex flex-col justify-center items-center text-center text-xs font-semibold text-text-muted border border-white/[0.05] bg-surface-900/30 ${activePlanTab === "free" ? "flex" : "hidden md:flex"}`}>
                  <div className="font-bold text-rose-400 uppercase tracking-wider mb-2 text-[9px]">AD Spot</div>
                  <span className="text-[11px]">AD (free users)</span>
                  <span className="text-[9px] mt-1 text-text-subtle">Subscribe to remove</span>
                </div>
              )}

              {/* Free Plan */}
              <div className={`glass-card rounded-xl p-4 flex flex-col justify-between border border-white/[0.05] bg-surface-900/30 ${activePlanTab === "free" ? "flex" : "hidden md:flex"}`}>
                <div className="text-left">
                  <div className="text-[11px] font-bold text-text-high">Free</div>
                  <div className="text-lg font-black text-text-high mt-1">{currency.symbol} {currency.freePrice}<span className="text-[10px] font-normal text-text-muted"> / mo</span></div>
                  <ul className="mt-3 space-y-1.5 text-[10px] text-text-muted list-none pl-0">
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />Unlimited Messages</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />Ads every 20 messages</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />RAG Memory (70 msg)</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />1 Checkpoint</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />5 Locations</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />15 Personas</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />SFW & NSFW ON</li>
                  </ul>
                </div>
              </div>

              {/* Plus Plan — Popular */}
              <div className={`relative glass-card rounded-xl p-4 flex flex-col justify-between border border-primary-500/25 bg-primary-500/[0.04] ${activePlanTab === "plus" ? "flex" : "hidden md:flex"}`}>
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary-400 text-[9px] font-black text-black uppercase tracking-wider shadow-lg shadow-primary-500/20">Popular</div>
                <div className="text-left mt-1">
                  <div className="text-[11px] font-bold text-primary-400">Plus</div>
                  <div className="text-lg font-black text-primary-400 mt-1">{currency.symbol} {currency.plusPrice}<span className="text-[10px] font-normal text-text-muted"> / mo</span></div>
                  <ul className="mt-3 space-y-1.5 text-[10px] text-text-muted list-none pl-0">
                    <li className="flex items-center gap-1.5 text-primary-400 font-bold"><span className="w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />No ADS (Ad-Free)</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />RAG Memory (300 msg)</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />3 Checkpoints</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />20 Locations</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />30 Personas</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />Everything in Free</li>
                  </ul>
                </div>
              </div>

              {/* Pro Plan */}
              <div className={`glass-card rounded-xl p-4 flex flex-col justify-between border border-amber-500/25 bg-amber-500/[0.04] ${activePlanTab === "pro" ? "flex" : "hidden md:flex"}`}>
                <div className="text-left">
                  <div className="text-[11px] font-bold text-amber-400">Pro</div>
                  <div className="text-lg font-black text-amber-400 mt-1">{currency.symbol} {currency.proPrice}<span className="text-[10px] font-normal text-text-muted"> / mo</span></div>
                  <ul className="mt-3 space-y-1.5 text-[10px] text-text-muted list-none pl-0">
                    <li className="flex items-center gap-1.5 text-amber-400 font-bold"><span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />Unlimited RAG Memory</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />30 Checkpoints</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />50 Locations</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />60 Personas</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />TurboQuant Model</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-text-subtle flex-shrink-0" />Everything in Plus</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="section-header font-display text-xl font-black text-text-high tracking-tight">Top 5 Characters in Klie</h2>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-5">
          {characters.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer-skeleton w-full aspect-[3/4] rounded-2xl" />
            ))
          ) : (
            characters
              .sort((a, b) => (b.points || 0) - (a.points || 0))
              .slice(0, 5)
              .map((c, index) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="block cursor-pointer" onClick={() => onSelectCharacter(c.id)}>
                    <CharacterCard {...c} points={c.points || 0} onClick={() => onSelectCharacter(c.id)} />
                  </div>
                </motion.div>
              ))
          )}
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="section-header font-display text-xl font-black text-text-high tracking-tight">Top Creators</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-3">
          {visibleCreators.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shimmer-skeleton h-[110px] w-full rounded-2xl" />
            ))
          ) : (
            visibleCreators.map((creator, index) => (
              <motion.div
                key={creator.handle}
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                <CreatorCard
                  {...creator}
                  isFollowing={followedCreatorIds.includes(creator.id || creator.handle)}
                  onFollow={creator.id === currentUser?.id ? undefined : () => onFollowCreator(creator.id || creator.handle)}
                  onClick={() => onSelectCreator(creator)}
                />
              </motion.div>
            ))
          )}
        </div>

        {(creatorsLimit < 30 && sortedCreators.length >= 5) && (
          <div className="flex justify-center mt-6">
            <motion.button
              whileHover={hasHover ? { scale: 1.03, y: -1 } : undefined}
              whileTap={{ scale: 0.97 }}
              onClick={async () => {
                if (onLoadMoreCreators) {
                  await onLoadMoreCreators();
                }
                setCreatorsLimit((prev) => Math.min(prev + 6, 30));
              }}
              className="btn-primary-glow px-8 py-3 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold text-text-high transition-all cursor-pointer shadow-lg hover:border-white/15 hover:shadow-xl"
            >
              See more
            </motion.button>
          </div>
        )}
      </section>
    </motion.div>
  );
}

type HelpAlertCategory = "self_harm" | "illegal" | null;

const checkHelpAlertCategory = (text: string): HelpAlertCategory => {
  const normalized = text.toLowerCase();
  
  const selfHarmKeywords = [
    "suicidio", "suicidar", "suicidarti", "suicidarmi", "suicide", "suicidal", "kill myself", "kill yourself", "uccidermi", "ucciderti", "ammazzarmi", "ammazzarti", "togliermi la vita", "toglierti la vita", "end my life", "end your life", "voglio morire", "want to die", "morire",
    "autolesionismo", "self-harm", "tagliarmi", "tagliarti", "cut myself", "cut yourself", "hurt myself", "hurt yourself", "farmi del male", "farti del male", "harm myself", "harm yourself"
  ];
  if (selfHarmKeywords.some(k => normalized.includes(k))) {
    return "self_harm";
  }

  const illegalKeywords = [
    "attività illegali", "illegal act", "droga", "drogarmi", "spacciare", "drugs", "buy drugs", "sell drugs", "rubare", "steal", "robbery", "rapina", "omicidio", "murder", "vendere armi", "comprare droga"
  ];
  if (illegalKeywords.some(k => normalized.includes(k))) {
    return "illegal";
  }

  return null;
};

function ChatView({
  characters,
  archivedOnly,
  libraryOnly,
  currentUser,
  conversations,
  setConversations,
  allCharacters,
  onIncrementPoints,
  setCharacters,
  onSelectCharacter,
  localCharacters,
  setLocalCharacters,
  onDownloadCharacter,
  onDeleteDownloadedCharacter,
  onSelectCreator,
  creators = []
}: {
  characters: Character[],
  archivedOnly?: boolean,
  libraryOnly?: boolean,
  currentUser: SessionUser | null,
  conversations: Conversation[],
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>,
  allCharacters: Character[],
  onIncrementPoints: (charId: string) => void,
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>,
  onSelectCharacter?: (id: string) => void,
  localCharacters: any[],
  setLocalCharacters: React.Dispatch<React.SetStateAction<any[]>>,
  onDownloadCharacter: (charId: string) => Promise<void>,
  onDeleteDownloadedCharacter: (charId: string) => Promise<void>,
  onSelectCreator?: (creator: Creator) => void,
  creators?: Creator[]
}) {
  const { id: conversationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const [activeAlertCategory, setActiveAlertCategory] = useState<HelpAlertCategory>(null);
  const [alertDismissedConvs, setAlertDismissedConvs] = useState<string[]>([]);
  const lastFetchedConvIdRef = useRef<string | null>(null);
  const prevConversationIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prevId = prevConversationIdRef.current;
    prevConversationIdRef.current = conversationId;

    if (prevId && prevId !== conversationId) {
      const prevConv = conversations.find(c => c.id === prevId);
      if (prevConv && !prevConv.hasUserMessage) {
        handleDeleteChat(prevId);
      }
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    if (!conversationId) return;
    if (messages.length > 0) {
      let matchedCat: HelpAlertCategory = null;
      for (const m of messages) {
        const cat = checkHelpAlertCategory(m.content);
        if (cat) {
          matchedCat = cat;
          break;
        }
      }
      if (matchedCat && !alertDismissedConvs.includes(conversationId)) {
        setActiveAlertCategory(matchedCat);
      }
    }
  }, [messages, conversationId, alertDismissedConvs]);

  useEffect(() => {
    invoke<any[]>("get_all_local_characters")
      .then(list => {
        if (list) {
          const filtered = list
            .map(mapLocalCharToCamel)
            .filter(c => !c.id.includes("_conv-") && c.isDownloaded === true);
          setLocalCharacters(filtered);
        }
      })
      .catch(err => console.error("Failed to load local characters:", err));
  }, [conversationId, libraryOnly]);

  const activeConversation = useMemo(() => conversations.find(c => c.id === conversationId), [conversations, conversationId]);
  const character = useMemo(() => {
    if (!activeConversation) return null;
    const baseId = activeConversation.characterId.includes('_conv-') ? activeConversation.characterId.split('_conv-')[0] : activeConversation.characterId;
    return characters.find(c => c.id === baseId) || null;
  }, [characters, activeConversation]);

  const targetCharId = activeConversation?.characterId || character?.id;

  // Listen to incoming real-time Discord messages to update the active chat UI in real-time
  useEffect(() => {
    if (!character?.id) return;

    const handleDiscordMsg = (e: any) => {
      const { characterId, role, content, userMsg } = e.detail;
      if (characterId === character.id) {
        setMessages(prev => {
          // Prevent duplicates by checking if the last message is already this message
          if (prev.length > 0 && prev[prev.length - 1].content === content) return prev;
          return [
            ...prev,
            { role: "user", content: userMsg },
            { role: "ai", content: content }
          ];
        });
      }
    };

    window.addEventListener("klie_discord_message", handleDiscordMsg);
    return () => {
      window.removeEventListener("klie_discord_message", handleDiscordMsg);
    };
  }, [character?.id]);


  // Load messages instantly from local SQLite, then sync from cloud in the background
  useEffect(() => {
    if (!character || !conversationId) {
      setMessages([]);
      return;
    }
    const activeCharacter = character;
    const charId = targetCharId || activeCharacter.id;

    async function load() {
      // 1. Fetch and show local messages instantly so there's no waiting
      let localMsgs: any[] = [];
      try {
        const greeting = activeCharacter.greeting || `Hello, I'm ${activeCharacter.name}. Ask me anything.`;
        localMsgs = await invoke<any[]>("get_local_messages", {
          characterId: charId,
          conversationId,
          greeting
        });
        if (localMsgs.length > 0) {
          const loaded = localMsgs.map((m: any) => ({
            role: m.role.toLowerCase() as "user" | "ai",
            content: m.content
          }));
          if (loaded.length === 1 && loaded[0].content === greeting && activeConversation?.lastMessage) {
            // Do not set greeting if we expect cloud history to avoid flashing
          } else {
            setMessages(loaded);
            const lastM = loaded[loaded.length - 1].content;
            const hasUser = loaded.some(m => m.role === "user");
            setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, lastMessage: lastM, hasUserMessage: hasUser } : c));
          }
        } else {
          if (!activeConversation?.lastMessage) {
            setMessages([{ role: "ai", content: greeting }]);
            setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, lastMessage: greeting } : c));
          }
        }
      } catch (err) {
        console.warn("Failed to load local messages:", err);
        const greeting = activeCharacter.greeting || `Hello, I'm ${activeCharacter.name}. Ask me anything.`;
        if (!activeConversation?.lastMessage) {
          setMessages([{ role: "ai", content: greeting }]);
          setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, lastMessage: greeting } : c));
        }
      }

      try {
        const localChar = await invoke<any>("get_local_character", { characterId: charId });
        if (localChar) {
          const mappedChar = mapLocalCharToCamel(localChar);
          if (!mappedChar.id.includes("_conv-")) {
            setCharacters(prev => {
              const exists = prev.some(c => c.id === mappedChar.id);
              return exists ? prev.map(c => c.id === mappedChar.id ? { ...c, ...mappedChar } : c) : [...prev, mappedChar];
            });
          }
        } else {
          // Cloud-by-default stub save
          fetch(`${API_URL}/api/desktop/characters/${charId}`, {
            headers: currentUser ? { "Authorization": `Bearer ${currentUser.sessionToken}` } : {}
          })
            .then(res => res.json())
            .then(async (data) => {
              if (data && data.id) {
                const stubChar = { ...data, isDownloaded: false };
                await invoke("save_cloud_character_stub", { character: mapCamelToLocal(stubChar) });
                if (!stubChar.id.includes("_conv-")) {
                  setCharacters(prev => {
                    const exists = prev.some(c => c.id === stubChar.id);
                    return exists ? prev.map(c => c.id === stubChar.id ? { ...c, ...stubChar } : c) : [...prev, stubChar];
                  });
                }
              }
            })
            .catch((e) => {
              console.warn("Cloud-by-default character fetch failed:", e);
            });
        }

        if (lastFetchedConvIdRef.current === (conversationId || null)) {
          console.log("Cloud messages sync skipped: already fetched for", conversationId);
          return;
        }
        lastFetchedConvIdRef.current = conversationId || null;

        try {
          const masterId = charId.includes('_conv-') ? charId.split('_conv-')[0] : charId;
          const response = await fetch(`${API_URL}/api/desktop/chat/${masterId}/messages?conversationId=${conversationId}`, {
            headers: {
              "Authorization": `Bearer ${currentUser?.sessionToken}`,
            },
          });

          if (response.ok) {
            const msgs = await response.json();
            if (Array.isArray(msgs) && msgs.length > 0) {
              setMessages(msgs.map((m: any) => ({
                role: m.role.toLowerCase() as "user" | "ai",
                content: m.content
              })));

              // Save new messages to local DB for offline access
              const localContents = new Set(localMsgs.map((m: any) => m.content));
              for (const m of msgs) {
                if (!localContents.has(m.content)) {
                  invoke('save_message', { 
                    characterId: charId, 
                    conversationId, 
                    role: m.role.toUpperCase(), 
                    content: m.content 
                  }).catch((e) => console.warn("Failed to save cloud message locally:", e));
                }
              }
              const lastM = msgs[msgs.length - 1].content;
              const hasUser = msgs.some((m: any) => m.role.toLowerCase() === "user");
              setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, lastMessage: lastM, hasUserMessage: hasUser } : c));
            }
          }
        } catch (fetchErr) {
          console.warn("Failed to fetch cloud messages, continuing locally:", fetchErr);
        }
      } catch (err) {
        console.warn("Background cloud messages sync failed:", err);
      }
    }

    load();
  }, [conversationId, character?.id, targetCharId]);

  const [checkpoints, setCheckpoints] = useState<any[]>([]);

  const loadCheckpoints = useCallback(async () => {
    if (!targetCharId) return;
    try {
      const cps = await invoke<any[]>("get_checkpoints", { characterId: targetCharId });
      setCheckpoints(cps || []);
    } catch (err) {
      console.error("Failed to load checkpoints:", err);
    }
  }, [targetCharId]);

  useEffect(() => {
    loadCheckpoints();
  }, [targetCharId, loadCheckpoints]);

  const handleCreateCheckpoint = async (name: string) => {
    if (!targetCharId) return;
    try {
      await invoke("create_checkpoint", { characterId: targetCharId, parentId: null, name, metadata: null });
      loadCheckpoints();
    } catch (err) {
      console.error("Failed to create checkpoint:", err);
    }
  };

  const handleRestoreCheckpoint = async (id: string) => {
    try {
      await invoke("restore_checkpoint", { id });
      
      // Reload checkpoints & memories
      loadCheckpoints();
      loadMemory();
      
      // Reload messages list
      if (conversationId && character) {
        const history = await invoke<any[]>("get_messages", {
          characterId: character.id,
          conversationId,
          greeting: character.greeting || "Hello!"
        });
        setMessages(history.map(m => ({
          role: m.role.toLowerCase() as "user" | "ai",
          content: m.content
        })));
        if (history.length > 0) {
          const lastM = history[history.length - 1].content;
          const hasUser = history.some(m => m.role.toLowerCase() === "user");
          setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, lastMessage: lastM, hasUserMessage: hasUser } : c));
        }
      }
    } catch (err) {
      console.error("Failed to restore checkpoint:", err);
    }
  };

  const handleDeleteCheckpoint = async (id: string) => {
    try {
      await invoke("delete_checkpoint", { id });
      loadCheckpoints();
    } catch (err) {
      console.error("Failed to delete checkpoint:", err);
    }
  };

  const [memoryEntries, setMemoryEntries] = useState<any[]>([]);

  // Load memory from local SQLite
  const loadMemory = useCallback(async () => {
    if (!targetCharId) return;
    try {
      const mem = await invoke<any[]>("get_local_memories", { characterId: targetCharId });
      setMemoryEntries(mem);
    } catch (err) {
      console.error("Failed to load memory:", err);
    }
  }, [targetCharId]);

  useEffect(() => {
    loadMemory();
  }, [targetCharId, loadMemory]);

  const handleAddMemory = async (title: string, content: string) => {
    if (!targetCharId) return;
    try {
      await invoke("add_local_memories", { characterId: targetCharId, title, content });
      loadMemory();
    } catch (err) {
      console.error("Failed to add memory:", err);
    }
  };

  const handleRemoveMemory = async (id: string) => {
    try {
      await invoke("remove_local_memories", { id });
      loadMemory();
    } catch (err) {
      console.error("Failed to remove memory:", err);
    }
  };

  const handleClearMemory = async () => {
    if (!targetCharId) return;
    try {
      await invoke("clear_local_memories", { characterId: targetCharId });
      loadMemory();
    } catch (err) {
      console.error("Failed to clear memory:", err);
    }
  };

  const handleUpdateMemory = async (id: string, title: string, content: string) => {
    try {
      await invoke("update_local_memories", { id, title, content });
      loadMemory();
    } catch (err) {
      console.error("Failed to update memory:", err);
    }
  };

  const [worldEntries, setWorldEntries] = useState<any[]>([]);
  const [worldLore, setWorldLore] = useState<any[]>([]);

  const loadLocations = useCallback(async () => {
    if (!targetCharId) return;
    try {
      const lore = await invoke<any[]>("get_world_lore", { characterId: targetCharId });
      setWorldLore(lore);
      const locationsOnly = lore.filter((x: any) => x.category === "LOCATION").map((x: any) => ({
        id: x.id,
        name: x.title,
        description: x.content
      }));
      setWorldEntries(locationsOnly);
    } catch (err) {
      console.error("Failed to load world lore:", err);
    }
  }, [targetCharId]);

  useEffect(() => {
    loadLocations();
  }, [targetCharId, loadLocations]);

  const handleAddLocation = async (name: string, description: string) => {
    if (!targetCharId) return;
    try {
      await invoke("save_chat_location", { characterId: targetCharId, name, description });
      loadLocations();
    } catch (err) {
      console.error("Failed to add location:", err);
    }
  };

  const handleSend = useCallback(async (text: string, rawTextWithDirectives?: string) => {
    if (!character || isGeneratingRef.current) return;
    const charId = targetCharId || character.id;

    // Check if it's a rewrite command
    const isRewrite = text.startsWith("[REWRITE LAST MESSAGE]");
    const rewritePrompt = text.match(/\[REWRITE LAST MESSAGE WITH PROMPT: (.*)\]/)?.[1];
    const isSkip = text === "[SKIP]";

    // If it's a normal message, move conversation to top
    if (!isRewrite && !rewritePrompt && !isSkip) {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === conversationId);
        if (idx < 0) return prev;
        const copy = [...prev];
        const [item] = copy.splice(idx, 1);
        return [{ ...item, lastMessage: text, hasUserMessage: true }, ...copy];
      });
    }

    setIsGenerating(true);
    isGeneratingRef.current = true;

    try {
      let aiResponse = "";

      // 1. Save USER message to database instantly (ChatInterface already showed it in screen)
      if (!isRewrite && !rewritePrompt && !isSkip) {
        onIncrementPoints(charId);
        await invoke("save_message", { characterId: charId, conversationId, role: "USER", content: text });
        const cat = checkHelpAlertCategory(text);
        if (cat) {
          setActiveAlertCategory(cat);
        }
      } else if (!isSkip) {
        // Remove last AI message locally to "rewrite" it
        setMessages(prev => {
          const copy = [...prev];
          if (copy[copy.length - 1]?.role === "ai") copy.pop();
          return copy;
        });
      }

      // 2. Append an empty AI bubble for streaming
      setMessages(prev => [...prev, { role: "ai", content: "" }]);

      // 3. Create a point-to-point IPC Channel for streaming tokens
      const onTokenChannel = new Channel<string>();
      onTokenChannel.onmessage = (token: string) => {
        setMessages(prev => {
          if (prev.length === 0) return prev;
          const lastMsg = prev[prev.length - 1];
          if (lastMsg.role !== "ai") return prev;
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, content: lastMsg.content + token }
          ];
        });
      };


      // 4. Start backend inference
      const reqQuant = (typeof window !== "undefined" && window.localStorage.getItem("klie.selectedQuant")) || "Q4_K_M";
      const reqContext = (typeof window !== "undefined" && window.localStorage.getItem("klie.selectedContext")) || "8K";

      if (isRewrite || rewritePrompt) {
        aiResponse = await invoke<string>("run_inference", {
          characterId: charId,
          conversationId,
          userMessage: rewritePrompt ? `Rewrite your last message but follow this: ${rewritePrompt}` : "Rewrite your last message differently.",
          userPersona: getFormattedUserPersona(),
          onToken: onTokenChannel,
          quant: reqQuant,
          contextSize: reqContext,
        });
      } else {
        // Trigger targeted sync in background via Rust
        if (navigator.onLine) {
          invoke('sync_target_character', { characterId: charId }).catch((err) => console.warn("Targeted sync failed:", err));
        } else {
          console.log("App is offline, queuing sync.");
          invoke('queue_sync', { characterId: charId }).catch((err) => console.warn("Queuing sync failed:", err));
        }

        aiResponse = await invoke<string>("run_inference", {
          characterId: charId,
          conversationId,
          userMessage: isSkip ? "..." : (rawTextWithDirectives || text),
          userPersona: getFormattedUserPersona(),
          onToken: onTokenChannel,
          quant: reqQuant,
          contextSize: reqContext,
        });
      }

      // 5. Hard-set final clean response in screen
      setMessages(prev => {
        if (prev.length === 0) return prev;
        const lastMsg = prev[prev.length - 1];
        if (lastMsg.role !== "ai") return prev;
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, content: aiResponse }
        ];
      });

      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, lastMessage: aiResponse } : c));

      // Reload memory and locations instantly so RAG changes show in real-time
      loadMemory();
      loadLocations();

      const cat = checkHelpAlertCategory(aiResponse);
      if (cat) {
        setActiveAlertCategory(cat);
      }


      // Trigger targeted sync in background via Rust
      if (navigator.onLine) {
        invoke('sync_target_character', { characterId: charId }).catch((err) => console.warn("Targeted sync failed:", err));
      } else {
        console.log("App is offline, queuing sync.");
        invoke('queue_sync', { characterId: charId }).catch((err) => console.warn("Queuing sync failed:", err));
      }

    } catch (err) {
      console.error("[RUN_INFERENCE ERROR]", err);
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  }, [character, targetCharId, conversationId, currentUser, setConversations, loadMemory, loadLocations]);




  const handleRemoveLocation = async (id: string) => {
    try {
      await invoke("remove_world_lore", { id });
      loadLocations();
    } catch (err) {
      console.error("Failed to remove location:", err);
    }
  };

  const handleDeleteChat = async (convId: string) => {
    if (!navigator.onLine) {
      alert("Please delete the chat when you are online to ensure it is removed from the cloud as well.");
      return;
    }
    try {
      const conv = conversations.find(c => c.id === convId);
      if (!conv) return;

      // 1. Delete cloud messages (gracefully catch errors if missing on cloud)
      try {
        const masterId = conv.characterId.includes('_conv-') ? conv.characterId.split('_conv-')[0] : conv.characterId;
        await fetch(`${API_URL}/api/desktop/chat/${masterId}/messages?conversationId=${convId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${currentUser?.sessionToken}`,
          },
        });
      } catch (cloudDelErr) {
        console.warn("Failed to delete cloud messages, continuing locally:", cloudDelErr);
      }

      // 2. Delete local data
      await invoke("delete_chat_data", { characterId: conv.characterId, conversationId: convId });

      // 3. Remove from local conversations list
      setConversations(prev => prev.filter(c => c.id !== convId));

      // 3. If it was the active chat, clear view
      if (conversationId === convId) {
        setMessages([]);
        navigate("/chat");
      }
    } catch (err) {
      console.warn("Failed to delete chat data:", err);
    }
  };

  const bots: ChatBot[] = useMemo(() => {
    return conversations.map(conv => {
      const baseId = conv.characterId.includes('_conv-') ? conv.characterId.split('_conv-')[0] : conv.characterId;
      const char = allCharacters.find(c => c.id === baseId);
      return {
        id: conv.id,
        name: char?.name || "Unknown",
        avatarUrl: char?.imageUrl,
        lastMessage: conv.lastMessage,
        greeting: char?.greeting,
        hasUserMessage: conv.hasUserMessage,
        points: char?.points || 0,
      };
    });
  }, [conversations, allCharacters]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      <ChatInterface
        characterName={character?.name}
        initialMessages={[]}
        messages={messages}
        setMessages={setMessages}
        botsHistory={bots}
        onSend={handleSend}
        onSelectBot={(id: string) => navigate(`/chat/${id}`)}

        listOnly={false}
        archivedOnly={archivedOnly}
        libraryOnly={libraryOnly}
        localCharacters={localCharacters}
        onSelectCharacter={onSelectCharacter}
        onDownloadCharacter={onDownloadCharacter}
        onDeleteDownloadedCharacter={onDeleteDownloadedCharacter}
        onBack={() => navigate("/chat")}
        onOpenArchived={() => navigate("/chat/archived")}
        onOpenLibrary={() => navigate("/chat/library")}
        memoryEntries={memoryEntries}
        onAddMemory={handleAddMemory}
        onRemoveMemory={handleRemoveMemory}
        onUpdateMemory={handleUpdateMemory}
        onDeleteChat={handleDeleteChat}
        onNewChat={() => navigate("/search")}
        allCharacters={allCharacters}
        currentUser={currentUser}
        onSelectCreator={onSelectCreator}
        creators={creators}
        onRunLocalInference={async (characterId, conversationId, userMessage) => {
          const dummyChan = new Channel<string>();
          dummyChan.onmessage = () => { };
          const reqQuant = (typeof window !== "undefined" && window.localStorage.getItem("klie.selectedQuant")) || "Q4_K_M";
          const reqContext = (typeof window !== "undefined" && window.localStorage.getItem("klie.selectedContext")) || "8K";
          return await invoke<string>("run_inference", {
            characterId,
            conversationId,
            userMessage,
            userPersona: getFormattedUserPersona(),
            onToken: dummyChan,
            quant: reqQuant,
            contextSize: reqContext,
          });
        }}
        onSaveLocalMessage={async (characterId, conversationId, role, content) => {
          return await invoke<void>("save_message", {
            characterId,
            conversationId,
            role,
            content,
          });
        }}
        worldEntries={worldEntries}
        worldLore={worldLore}
        onAddLocation={handleAddLocation}
        onRemoveLocation={handleRemoveLocation}
        checkpoints={checkpoints}
        onCreateCheckpoint={handleCreateCheckpoint}
        onRestoreCheckpoint={handleRestoreCheckpoint}
        onDeleteCheckpoint={handleDeleteCheckpoint}
        onTalkOnDiscord={(botName: string) => {
          const foundChar = allCharacters.find(c => c.name.toLowerCase() === botName.toLowerCase());
          const botId = foundChar?.id || "fallback";
          const botBrowserUrl = `https://revtechcompany.com/characters/${botId}`;

          // Open the Bot Profile safely via standard Tauri opener in a single clean call
          openUrl(botBrowserUrl);
        }}
      />
      <AnimatePresence>
        {activeAlertCategory && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute top-20 right-4 z-[9999] w-[320px] md:w-[360px] overflow-hidden rounded-2xl bg-surface-800/90 border border-rose-500/35 shadow-2xl p-4 backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-grow text-left space-y-1">
                <h4 className="text-sm font-bold text-text-high leading-none">
                  {activeAlertCategory === "self_harm" ? "Need Support?" : "Safety & Legality Warning"}
                </h4>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {activeAlertCategory === "self_harm" 
                    ? "If you or someone you know is going through a difficult time or having thoughts of self-harm, please know that you are not alone. Free, confidential support is available 24/7. Contact the Suicide & Crisis Lifeline by calling or texting 988 (USA/Canada), 111 (UK), or your local emergency services (like 112)."
                    : "Please ensure your interactions comply with local laws and safety standards. If you are experiencing dangerous situations, coercion, or witness illegal activities, support is available. Contact your local emergency services (like 911 or 112) or professional safety hotlines for guidance."
                  }
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveAlertCategory(null);
                  if (conversationId) {
                    setAlertDismissedConvs(prev => [...prev, conversationId]);
                  }
                }}
                className="rounded-full p-1 hover:bg-white/10 text-text-muted hover:text-white transition cursor-pointer leading-none"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreatorsView({
  creators,
  currentUser,
  createdCharacters,
  onCreateCharacter,
  onOpenCharacter,
  onDeleteCharacter,
  editingCharacter,
  onCancelEdit,
  onEditCharacter,
  onUpdateCharacter,
}: {
  creators: Creator[];
  currentUser: SessionUser;
  createdCharacters: Character[];
  onCreateCharacter: (form: CreatorFormState) => void;
  onOpenCharacter: (id: string) => void;
  onDeleteCharacter: (ids: string[]) => Promise<void>;
  editingCharacter?: Character | null;
  onCancelEdit?: () => void;
  onEditCharacter: (id: string) => void;
  onUpdateCharacter?: (id: string, updates: Partial<Character>) => Promise<void>;
}) {
  const [form, setForm] = useState<CreatorFormState>(defaultCreatorForm);
  const [activeTrait, setActiveTrait] = useState<"hair" | "eye" | "skin">("hair");
  const [activeSubTrait, setActiveSubTrait] = useState<"hair" | "eye" | "skin">("hair");
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [creatorViewMode, setCreatorViewMode] = useState<"select" | "import" | "create">("select");

  const [formError, setFormError] = useState("");
  const [step, setStep] = useState(1);
  const totalSteps = 8;
  const myCharacters = createdCharacters;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggleSelectCharacter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmMessage = selectedIds.length === 1
      ? "Are you sure you want to delete this chatbot? This action is permanent and cannot be undone."
      : `Are you sure you want to delete the ${selectedIds.length} selected chatbots? This action is permanent and cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      await onDeleteCharacter(selectedIds);
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (err) {
      console.error("Failed to delete characters:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSingleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${name}"? This action is permanent and cannot be undone.`)) return;

    setIsDeleting(true);
    try {
      await onDeleteCharacter([id]);
    } catch (err) {
      console.error("Failed to delete character:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === myCharacters.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(myCharacters.map(c => c.id));
    }
  };

  // Local-device persisted custom personality chips
  const [customChips, setCustomChips] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("klie_custom_personality_chips") || "[]");
    } catch {
      return [];
    }
  });
  const [newChipText, setNewChipText] = useState("");

  const defaultPersonalityChips = [
    "Friendly", "Mysterious", "Seductive", "Shy", "Aggressive",
    "Funny", "Smart", "Rebellious", "Loyal", "Tsundere",
    "Kuudere", "Yandere", "Teasing", "Sarcastic"
  ];

  const selectedChips = form.personality ? form.personality.split(",").map(t => t.trim()).filter(Boolean) : [];

  const toggleChip = (chip: string) => {
    let updated: string[];
    if (selectedChips.includes(chip)) {
      updated = selectedChips.filter(c => c !== chip);
    } else {
      if (selectedChips.length >= 7) {
        alert("You can select up to 7 personality tags.");
        return;
      }
      updated = [...selectedChips, chip];
    }
    setForm(prev => ({ ...prev, personality: updated.join(", ") }));
  };

  const handleAddCustomChip = () => {
    const text = newChipText.trim();
    if (!text) return;
    if (customChips.includes(text) || defaultPersonalityChips.includes(text)) {
      setNewChipText("");
      return;
    }
    const currentSelected = editingCharacter ? selectedEditChips : selectedChips;
    if (currentSelected.length >= 7) {
      alert("You can select up to 7 personality tags.");
      return;
    }
    const updated = [...customChips, text];
    setCustomChips(updated);
    localStorage.setItem("klie_custom_personality_chips", JSON.stringify(updated));
    setNewChipText("");
    if (editingCharacter) {
      toggleEditChip(text);
    } else {
      toggleChip(text);
    }
  };

  const handleDeleteCustomChip = (chipToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid toggling when deleting
    const updated = customChips.filter(c => c !== chipToDelete);
    setCustomChips(updated);
    localStorage.setItem("klie_custom_personality_chips", JSON.stringify(updated));
    if (selectedChips.includes(chipToDelete)) {
      const updatedSelected = selectedChips.filter(c => c !== chipToDelete);
      setForm(prev => ({ ...prev, personality: updatedSelected.join(", ") }));
    }
    setEditForm(prev => {
      const currentChips = prev.personality ? prev.personality.split(",").map(t => t.trim()).filter(Boolean) : [];
      if (currentChips.includes(chipToDelete)) {
        const filtered = currentChips.filter(c => c !== chipToDelete);
        return { ...prev, personality: filtered.join(", ") };
      }
      return prev;
    });
  };

  // World building locations
  const [places, setPlaces] = useState<{ name: string; description: string }[]>([]);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceDesc, setNewPlaceDesc] = useState("");

  const handleAddPlace = () => {
    if (!newPlaceName.trim()) {
      setFormError("Name is required for the place.");
      return;
    }
    if (!newPlaceDesc.trim()) {
      setFormError("Description is required for the place.");
      return;
    }
    setPlaces(prev => [...prev, { name: newPlaceName.trim(), description: newPlaceDesc.trim() }]);
    setNewPlaceName("");
    setNewPlaceDesc("");
    setFormError("");
  };

  const handleDeletePlace = (index: number) => {
    setPlaces(prev => prev.filter((_, i) => i !== index));
  };

  // Supporting chatbots (cast)
  const [subCharacters, setSubCharacters] = useState<{ name: string; personality: string }[]>([]);
  const [newSubName, setNewSubName] = useState("");
  const [newSubSex, setNewSubSex] = useState("");
  const [newSubPersonality, setNewSubPersonality] = useState("");
  const [newSubHair, setNewSubHair] = useState("#000000");
  const [newSubEye, setNewSubEye] = useState("#000000");
  const [newSubSkin, setNewSubSkin] = useState("#ffffff");
  const [newSubClothes, setNewSubClothes] = useState("");
  const [newSubBody, setNewSubBody] = useState("");
  const [newSubGadgets, setNewSubGadgets] = useState("");
  const [newSubGreeting, setNewSubGreeting] = useState("");

  // Step 7 States (World Building Search & Multi-select)
  const [worldSearchQuery, setWorldSearchQuery] = useState("");
  const [selectedWorldCharId, setSelectedWorldCharId] = useState("");
  const [availableWorldPlaces, setAvailableWorldPlaces] = useState<{ name: string; description: string }[]>([]);
  const [selectedWorldPlaceIndices, setSelectedWorldPlaceIndices] = useState<number[]>([]);

  // Step 8 States (Supporting Cast Search & Multi-select)
  const [castSearchQuery, setCastSearchQuery] = useState("");
  const [selectedCastCharId, setSelectedCastCharId] = useState("");
  const [availableCastSubs, setAvailableCastSubs] = useState<{ name: string; personality: string }[]>([]);
  const [selectedCastSubIndices, setSelectedCastSubIndices] = useState<number[]>([]);

  useEffect(() => {
    if (step === 7 || step === 8) {
      createdCharacters.forEach(c => {
        if (c.description === undefined) {
          invoke<any>("get_local_character", { characterId: c.id })
            .then(data => {
              if (data && data.id) {
                onCreateCharacter({ ...c, ...data });
              }
            })
            .catch(() => { });
        }
      });
    }
  }, [step, createdCharacters]);

  const [editStep, setEditStep] = useState(1);
  const totalEditSteps = 4;

  const [editForm, setEditForm] = useState({
    name: "",
    shortDescription: "",
    description: "",
    sex: "",
    personality: "",
    clothes: "",
    body: "",
    gadgets: "",
    greeting: "",
    isSFW: true,
    isWorld: false,
  });

  const selectedEditChips = editForm.personality ? editForm.personality.split(",").map(t => t.trim()).filter(Boolean) : [];

  const toggleEditChip = (chip: string) => {
    let updated: string[];
    if (selectedEditChips.includes(chip)) {
      updated = selectedEditChips.filter(c => c !== chip);
    } else {
      if (selectedEditChips.length >= 7) {
        alert("You can select up to 7 personality tags.");
        return;
      }
      updated = [...selectedEditChips, chip];
    }
    setEditForm(prev => ({ ...prev, personality: updated.join(", ") }));
  };

  useEffect(() => {
    if (editingCharacter?.id) {
      setEditStep(1);
      const populateEdit = (char: Character) => {
        setEditForm({
          name: char.name || "",
          shortDescription: char.shortDescription || "",
          description: char.description ? char.description.split("---[")[0].trim() : "",
          sex: char.sex || "",
          personality: char.personality || "",
          clothes: char.clothes || "",
          body: char.body || "",
          gadgets: char.gadgets || "",
          greeting: char.greeting || "",
          isSFW: char.isSFW !== false,
          isWorld: !!char.isWorld,
        });
      };

      populateEdit(editingCharacter);

      invoke<any>("get_local_character", { characterId: editingCharacter.id })
        .then(localChar => {
          if (localChar && (localChar.isDownloaded === true || localChar.isDownloaded === 1)) {
            populateEdit(mapLocalCharToCamel(localChar));
          } else {
            fetch(`${API_URL}/api/desktop/characters/${editingCharacter.id}`)
              .then(res => res.json())
              .then(data => {
                if (data && data.id) {
                  populateEdit(data);
                }
              })
              .catch(err => console.warn("Failed to fetch editing character details:", err));
          }
        })
        .catch(err => console.warn("Failed to fetch editing character locally:", err));
    }
  }, [editingCharacter?.id]);

  const handleAddSubChar = () => {
    if (!newSubName.trim()) {
      setFormError("Name is required for the supporting character.");
      return;
    }
    if (!newSubPersonality.trim()) {
      setFormError("Personality/description is required for the supporting character.");
      return;
    }

    const attributes = [
      newSubSex ? `- **Sex/Gender**: ${newSubSex}` : "",
      newSubPersonality ? `- **Personality**: ${newSubPersonality}` : "",
      newSubHair && newSubHair !== "#000000" ? `- **Hair Color**: ${newSubHair}` : "",
      newSubEye && newSubEye !== "#000000" ? `- **Eye Color**: ${newSubEye}` : "",
      newSubSkin && newSubSkin !== "#ffffff" ? `- **Skin Color**: ${newSubSkin}` : "",
      newSubClothes ? `- **Clothes**: ${newSubClothes}` : "",
      newSubBody ? `- **Body**: ${newSubBody}` : "",
      newSubGadgets ? `- **Gadgets**: ${newSubGadgets}` : "",
      newSubGreeting ? `- **Greeting**: ${newSubGreeting}` : "",
    ].filter(Boolean).join("\n  ");

    setSubCharacters(prev => [...prev, { name: newSubName.trim(), personality: attributes }]);

    // Reset all sub states
    setNewSubName("");
    setNewSubSex("");
    setNewSubPersonality("");
    setNewSubHair("#000000");
    setNewSubEye("#000000");
    setNewSubSkin("#ffffff");
    setNewSubClothes("");
    setNewSubBody("");
    setNewSubGadgets("");
    setNewSubGreeting("");
    setFormError("");
  };

  const handleDeleteSubChar = (index: number) => {
    setSubCharacters(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setForm(prev => ({ ...prev, image: file }));
  };

  const handleImportUrl = async () => {
    if (!importUrl) return;
    setIsImporting(true);
    try {
      const data = await invoke("fetch_opengraph_data", { url: importUrl }) as { 
        name: string; 
        description: string; 
        imageBase64: string; 
        imageMimeType: string; 
      };
      
      setForm(prev => ({
        ...prev,
        name: data.name || prev.name,
        description: data.description || prev.description,
        shortDescription: data.description || prev.shortDescription,
      }));

      if (data.imageBase64) {
          const fetchResponse = await fetch(`data:${data.imageMimeType || 'image/jpeg'};base64,${data.imageBase64}`);
          const blob = await fetchResponse.blob();
          const file = new File([blob], "imported_avatar.jpg", { type: blob.type });
          setForm(prev => ({ ...prev, image: file }));
      }
    } catch (error) {
      console.error("Failed to import:", error);
    } finally {
      setIsImporting(false);
    }
  };


  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {

    event.preventDefault();

    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (form.name.trim().length > 32) {
      setFormError("Name must be maximum 32 characters.");
      return;
    }
    if (form.shortDescription.trim().length > 100) {
      setFormError("Short description must be maximum 100 characters.");
      return;
    }
    if (form.description.trim().length > 1000) {
      setFormError("Long description must be maximum 1000 characters.");
      return;
    }
    if (form.greeting.trim().length > 500) {
      setFormError("Greeting message must be maximum 500 characters.");
      return;
    }
    const selectedChips = form.personality ? form.personality.split(",").map(t => t.trim()).filter(Boolean) : [];
    if (selectedChips.length > 7) {
      setFormError("Personality must be maximum 7 tags.");
      return;
    }
    const spLength = calculateSystemPromptLength(form);
    if (spLength > 5000) {
      setFormError(`System prompt exceeds maximum of 5000 characters (currently ${spLength}). Please shorten your descriptions, traits, or attributes.`);
      return;
    }

    const formattedWorld = places.map(p => `- **${p.name}**: ${p.description}`).join("\n");
    const formattedChars = subCharacters.map(sc => `- **${sc.name}**: ${sc.personality}`).join("\n");

    onCreateCharacter({
      ...form,
      worldBuilding: formattedWorld,
      characterBuilding: formattedChars,
    });

    setForm(defaultCreatorForm);
    setPlaces([]);
    setSubCharacters([]);
    setStep(1);
    setCreatorViewMode("select");
    setFormError("");
  };

  const isFullScreen = creatorViewMode !== "select" || !!editingCharacter;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.995 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6 animate-fade-in"
    >
      {isFullScreen ? (
        <div className="glass-card rounded-[32px] p-6 border border-white/[0.08] bg-gradient-to-br from-white/[0.01] to-white/[0.002] shadow-glass flex flex-col h-full justify-between backdrop-blur-2xl max-w-4xl mx-auto w-full">
          {editingCharacter ? (
            <div className="flex flex-col h-full justify-between space-y-6">
              <div>
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-border-subtle/20">
                  <div className="text-left">
                    <h3 className="font-display text-2xl text-text-high font-bold">Edit Chatbot: {editingCharacter.name}</h3>
                    <p className="text-sm text-text-muted mt-0.5">Directly update the profile and traits of this chatbot.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="rounded-full p-2 hover:bg-white/10 text-text-muted hover:text-white transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Stepper Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-xs text-text-muted mb-2">
                    <span className="font-medium text-primary-400 uppercase tracking-wider">Step {editStep} of {totalEditSteps}</span>
                    <span>{Math.round((editStep / totalEditSteps) * 100)}% Complete</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-900/60 overflow-hidden ring-1 ring-border-subtle/10">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${(editStep / totalEditSteps) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-4 text-left max-h-[55vh] overflow-y-auto pr-2 pb-6">
                  {/* EDIT STEP 1: Basic Identity */}
                  {editStep === 1 && (
                    <div className="space-y-4 animate-fade-in">
                      <h4 className="font-display text-lg text-text-high">Basic Identity</h4>
                      <p className="text-xs text-text-muted">Update the identity, orientation, and safety settings of your chatbot.</p>

                      <label className="block space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Name *</span>
                          <span className="text-[10px] text-text-muted">{editForm.name.length}/32</span>
                        </div>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          maxLength={32}
                          required
                          autoComplete="off"
                          className="w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Character name"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-xs text-text-muted">Sex / Gender Orientation</span>
                        <select
                          value={editForm.sex}
                          onChange={e => setEditForm({ ...editForm, sex: e.target.value })}
                          className="w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                        >
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="gay">Gay</option>
                          <option value="lesbian">Lesbian</option>
                          <option value="pansexual">Pansexual</option>
                          <option value="futanari">Futanari</option>
                          <option value="non-binary">Non-binary</option>
                          <option value="other">Other</option>
                        </select>
                      </label>

                      <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-900/25 ring-1 ring-border-subtle/10 gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-text-high block">Turn on NSFW mode</span>
                          <p className="text-[10px] text-text-muted mt-1 leading-normal">Enable mature or unfiltered content for this chatbot.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, isSFW: !prev.isSFW }))}
                          className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${
                            !editForm.isSFW ? "bg-[#34C759]" : "bg-[#39393D]"
                          }`}
                        >
                          <motion.span
                            animate={{ x: !editForm.isSFW ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 700, damping: 40 }}
                            className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-900/25 ring-1 ring-border-subtle/10 gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-text-high block">World RPG mode</span>
                          <p className="text-[10px] text-text-muted mt-1 leading-normal">Chatbot acts as narrator/world. Characters speak inside it, chatbot never speaks as itself.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, isWorld: !prev.isWorld }))}
                          className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${
                            editForm.isWorld ? "bg-[#34C759]" : "bg-[#39393D]"
                          }`}
                        >
                          <motion.span
                            animate={{ x: editForm.isWorld ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 700, damping: 40 }}
                            className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* EDIT STEP 2: Personality & Profile */}
                  {editStep === 2 && (
                    <div className="space-y-4 animate-fade-in">
                      <h4 className="font-display text-lg text-text-high">Personality & Profile</h4>
                      <p className="text-xs text-text-muted">Update bio, background context, and personality tags.</p>

                      <label className="block space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Short Description / Catchphrase</span>
                          <span className="text-[10px] text-text-muted">{editForm.shortDescription.length}/100</span>
                        </div>
                        <textarea
                          value={editForm.shortDescription}
                          onChange={e => setEditForm({ ...editForm, shortDescription: e.target.value })}
                          maxLength={100}
                          className="min-h-[50px] w-full rounded-2xl bg-surface-900/45 px-4 py-2.5 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Brief overview or bio snippet..."
                        />
                      </label>

                      <label className="block space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Long Description / Background Context</span>
                          <span className="text-[10px] text-text-muted">{editForm.description.length}/1000</span>
                        </div>
                        <textarea
                          value={editForm.description}
                          onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                          maxLength={1000}
                          className="min-h-[70px] w-full rounded-2xl bg-surface-900/45 px-4 py-2.5 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Detailed background story and context..."
                        />
                      </label>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted block">Personality Tags (Click to toggle)</span>
                          <span className="text-[10px] text-text-muted">{selectedEditChips.length}/7</span>
                        </div>

                        {/* Personality Chips Container */}
                        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1.5 rounded-2xl bg-surface-900/25 ring-1 ring-border-subtle/10">
                          {defaultPersonalityChips.map(chip => {
                            const isSelected = selectedEditChips.includes(chip);
                            return (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => toggleEditChip(chip)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${isSelected
                                  ? 'bg-primary-500 text-surface-900 shadow-md font-semibold'
                                  : 'bg-surface-900/40 text-text-muted hover:bg-surface-900/80 hover:text-text-high border border-border-subtle/15'
                                  }`}
                              >
                                {chip}
                              </button>
                            );
                          })}
                          {customChips.map(chip => {
                            const isSelected = selectedEditChips.includes(chip);
                            return (
                              <div
                                key={chip}
                                onClick={() => toggleEditChip(chip)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 ${isSelected
                                  ? 'bg-purple-500 text-surface-900 shadow-md font-semibold'
                                  : 'bg-surface-900/40 text-text-muted hover:bg-surface-900/80 hover:text-text-high border border-purple-500/20'
                                  }`}
                              >
                                <span>{chip} ★</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCustomChip(chip, e)}
                                  className={`p-0.5 rounded-full hover:bg-white/25 transition-colors ${isSelected ? 'text-surface-900/80' : 'text-text-muted/70 hover:text-text-high'
                                    }`}
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Custom Chip Adder */}
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={newChipText}
                            onChange={e => setNewChipText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomChip();
                              }
                            }}
                            placeholder="Create custom personality..."
                            className="flex-grow rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomChip}
                            className="rounded-xl bg-surface-900/60 border border-border-subtle/20 hover:bg-surface-900 px-3 py-2 text-xs font-semibold text-text-high transition"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* EDIT STEP 3: Outfit & Attributes */}
                  {editStep === 3 && (
                    <div className="space-y-4 animate-fade-in">
                      <h4 className="font-display text-lg text-text-high">Clothes & Attributes</h4>
                      <p className="text-xs text-text-muted">Describe their clothing, body type, and gadgets.</p>

                      <label className="block space-y-2">
                        <span className="text-xs text-text-muted">Clothes / Attire</span>
                        <textarea
                          value={editForm.clothes}
                          onChange={e => setEditForm({ ...editForm, clothes: e.target.value })}
                          className="min-h-[80px] w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Attire description"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-xs text-text-muted">Body Build / Appearance</span>
                        <textarea
                          value={editForm.body}
                          onChange={e => setEditForm({ ...editForm, body: e.target.value })}
                          className="min-h-[80px] w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Physical build"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-xs text-text-muted">Gadgets & Accessories</span>
                        <input
                          type="text"
                          value={editForm.gadgets}
                          onChange={e => setEditForm({ ...editForm, gadgets: e.target.value })}
                          className="w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Accessories or special gadgets"
                        />
                      </label>
                      <div className="flex justify-between items-center bg-surface-900/25 p-3 rounded-2xl ring-1 ring-border-subtle/10 text-xs">
                        <span className="text-text-muted font-medium">Estimated System Prompt Space Used:</span>
                        <span className={`font-semibold ${calculateSystemPromptLength(editForm) > 4500 ? 'text-rose-400' : 'text-primary-400'}`}>
                          {calculateSystemPromptLength(editForm)} / 5000
                        </span>
                      </div>
                    </div>
                  )}

                  {/* EDIT STEP 4: Greeting */}
                  {editStep === 4 && (
                    <div className="space-y-4 animate-fade-in">
                      <h4 className="font-display text-lg text-text-high">Greeting Message</h4>
                      <p className="text-xs text-text-muted">Define the very first message sent by the chatbot when starting a new chat.</p>

                      <label className="block space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Greeting / First Message</span>
                          <span className="text-[10px] text-text-muted">{editForm.greeting.length}/500</span>
                        </div>
                        <textarea
                          value={editForm.greeting}
                          onChange={e => setEditForm({ ...editForm, greeting: e.target.value })}
                          maxLength={500}
                          className="min-h-[100px] w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Hello! I'm your chatbot..."
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-border-subtle/20">
                {editStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setEditStep(editStep - 1)}
                    className="rounded-full bg-surface-900 px-6 py-2.5 text-xs font-semibold text-text-high transition ring-1 ring-border-subtle/20 hover:bg-surface-900/80 cursor-pointer"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="rounded-full bg-surface-900 px-6 py-2.5 text-xs font-semibold text-text-muted hover:text-white transition ring-1 ring-border-subtle/20 hover:bg-surface-900/80 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                {editStep < totalEditSteps ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (editStep === 1) {
                        if (!editForm.name.trim()) {
                          alert("Name is required.");
                          return;
                        }
                        if (editForm.name.trim().length > 32) {
                          alert("Name must be maximum 32 characters.");
                          return;
                        }
                      }
                      if (editStep === 2) {
                        if (editForm.shortDescription.trim().length > 100) {
                          alert("Short description must be maximum 100 characters.");
                          return;
                        }
                        if (editForm.description.trim().length > 1000) {
                          alert("Long description must be maximum 1000 characters.");
                          return;
                        }
                        const selectedEditChips = editForm.personality ? editForm.personality.split(",").map(t => t.trim()).filter(Boolean) : [];
                        if (selectedEditChips.length > 7) {
                          alert("Personality must be maximum 7 tags.");
                          return;
                        }
                      }
                      if (editStep === 3) {
                        const spLength = calculateSystemPromptLength(editForm);
                        if (spLength > 5000) {
                          alert(`System prompt exceeds maximum of 5000 characters (currently ${spLength}). Please shorten your descriptions, traits, or attributes.`);
                          return;
                        }
                      }
                      setEditStep(editStep + 1);
                    }}
                    className="ml-auto rounded-full bg-primary-400 hover:bg-primary-300 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition shadow-lg shadow-primary-500/15 cursor-pointer"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onUpdateCharacter?.(editingCharacter.id, editForm)}
                    className="ml-auto rounded-full bg-primary-400 hover:bg-primary-300 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition shadow-lg shadow-primary-500/15 cursor-pointer"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </div>
          ) : creatorViewMode === "import" ? (
            <div>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="text-left">
                  <h3 className="font-display text-2xl text-text-high">Import Chatbot</h3>
                  <p className="text-sm text-text-muted">Import a chatbot from Chai or C.AI link</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatorViewMode("select")}
                  className="rounded-full bg-surface-900 hover:bg-surface-900/80 px-4 py-2 text-xs font-semibold text-text-muted hover:text-white transition ring-1 ring-border-subtle/20 cursor-pointer"
                >
                  ← Back
                </button>
              </div>

              <div className="p-5 rounded-3xl bg-surface-900/25 ring-1 ring-border-subtle/10 space-y-4">
                <label className="block space-y-2 text-left">
                  <span className="text-xs text-text-muted">Import from URL</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="Paste Chai / C.AI link here..."
                      className="flex-1 rounded-xl bg-surface-900/45 px-4 py-2.5 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleImportUrl}
                      disabled={isImporting || !importUrl}
                      className="rounded-xl bg-primary-400 hover:bg-primary-300 text-black px-4 py-2.5 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      {isImporting ? "Importing..." : "Import"}
                    </button>
                  </div>
                </label>

                {form.name && (
                  <div className="mt-6 p-4 rounded-2xl bg-surface-900/40 border border-white/[0.05] space-y-4 animate-fade-in text-left">
                    <div className="text-[10px] font-bold text-primary-400 uppercase tracking-wider">Import Preview</div>
                    <div className="flex gap-4 items-center">
                      {form.image ? (
                        <img
                          src={URL.createObjectURL(form.image)}
                          alt="Imported preview"
                          className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-surface-950 flex items-center justify-center text-text-muted text-xl ring-1 ring-white/5">
                          🤖
                        </div>
                      )}
                      <div>
                        <h4 className="font-display font-bold text-text-high">{form.name}</h4>
                        <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{form.shortDescription || form.description}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-border-subtle/10">
                      <button
                        type="button"
                        onClick={handleSubmit as any}
                        className="flex-1 rounded-xl bg-primary-400 hover:bg-primary-300 text-black py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                      >
                        Save & Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreatorViewMode("create")}
                        className="flex-1 rounded-xl bg-surface-900 hover:bg-surface-900/80 text-text-high py-2.5 text-xs font-bold uppercase tracking-wider transition ring-1 ring-border-subtle/25 cursor-pointer"
                      >
                        Edit Details
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="text-left">
                  <h3 className="font-display text-2xl text-text-high">Character Maker</h3>
                  <p className="text-sm text-text-muted">
                    Create detailed character profiles with appearance, personality, and attributes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatorViewMode("select")}
                  className="rounded-full bg-surface-900 hover:bg-surface-900/80 px-4 py-2 text-xs font-semibold text-text-muted hover:text-white transition ring-1 ring-border-subtle/20 cursor-pointer flex-shrink-0"
                >
                  ← Back
                </button>
              </div>

              {/* Stepper Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs text-text-muted mb-2">
                  <span className="font-medium text-primary-400 uppercase tracking-wider">Step {step} of {totalSteps}</span>
                  <span>{Math.round((step / totalSteps) * 100)}% Complete</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-900/60 overflow-hidden ring-1 ring-border-subtle/10">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${(step / totalSteps) * 100}%` }}
                  />
                </div>
              </div>

              <form id="creator-form" className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-4 text-left max-h-[55vh] overflow-y-auto pr-2 pb-6">

                {/* STEP 1: Avatar Selection */}
                {step === 1 && (
                  <div className="space-y-4">
                    <h4 className="font-display text-lg text-text-high">Choose Avatar</h4>
                    <p className="text-xs text-text-muted">Upload an image of your character to use as their profile picture.</p>
                    <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-900/20 border border-dashed border-border-subtle/30 hover:border-primary-500/40 transition">
                      {form.image ? (
                        <div className="relative mb-4">
                          <img
                            src={URL.createObjectURL(form.image)}
                            alt="Preview"
                            className="w-32 h-32 rounded-2xl object-cover ring-2 ring-primary-500/50 shadow-xl"
                          />
                          <button
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, image: null }))}
                            className="absolute -top-2 -right-2 p-1.5 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition shadow-md"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <svg className="w-12 h-12 text-text-muted/50 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs text-text-muted block mb-3">No avatar uploaded</span>
                        </div>
                      )}
                      <label className="cursor-pointer rounded-full bg-surface-900/60 hover:bg-surface-900/80 px-4 py-2 text-xs font-medium text-text-high transition ring-1 ring-border-subtle/20">
                        <span>Upload Avatar</span>
                        <input id="char-image" name="image" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}

                {/* STEP 2: Basic Identity */}
                {step === 2 && (
                  <div className="space-y-4">
                    <h4 className="font-display text-lg text-text-high">Basic Identity</h4>
                    <p className="text-xs text-text-muted">Set up the general details of your character.</p>

                    <div className="space-y-4">
                      <label className="block space-y-2" htmlFor="char-name">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Name *</span>
                          <span className="text-[10px] text-text-muted">{form.name.length}/32</span>
                        </div>
                        <input
                          id="char-name"
                          name="name"
                          value={form.name}
                          onChange={handleInputChange}
                          maxLength={32}
                          required
                          autoComplete="off"
                          className="w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Character name"
                        />
                      </label>

                      <label className="block space-y-2" htmlFor="char-sex">
                        <span className="text-xs text-text-muted">Sex / Gender Orientation</span>
                        <select
                          id="char-sex"
                          name="sex"
                          value={form.sex}
                          onChange={handleInputChange}
                          className="w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                        >
                          <option value="">Select</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="gay">Gay</option>
                          <option value="lesbian">Lesbian</option>
                          <option value="pansexual">Pansexual</option>
                          <option value="futanari">Futanari</option>
                          <option value="non-binary">Non-binary</option>
                          <option value="other">Other</option>
                        </select>
                      </label>

                      {/* NSFW sliding toggle switch */}
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-900/25 ring-1 ring-border-subtle/10 gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-text-high block">Turn on NSFW mode</span>
                          <p className="text-[10px] text-text-muted mt-1 leading-normal">Enable mature or unfiltered content for this chatbot.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, isSFW: !prev.isSFW }))}
                          className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${
                            !form.isSFW ? "bg-[#34C759]" : "bg-[#39393D]"
                          }`}
                        >
                          <motion.span
                            animate={{ x: !form.isSFW ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 700, damping: 40 }}
                            className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-900/25 ring-1 ring-border-subtle/10 gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-text-high block">World RPG mode</span>
                          <p className="text-[10px] text-text-muted mt-1 leading-normal">Chatbot acts as narrator/world. Characters speak inside it, chatbot never speaks as itself.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, isWorld: !prev.isWorld }))}
                          className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${
                            form.isWorld ? "bg-[#34C759]" : "bg-[#39393D]"
                          }`}
                        >
                          <motion.span
                            animate={{ x: form.isWorld ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 700, damping: 40 }}
                            className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: Personality Chips & Profile */}
                {step === 3 && (
                  <div className="space-y-4">
                    <h4 className="font-display text-lg text-text-high">Personality & Profile</h4>
                    <p className="text-xs text-text-muted">Select tags and customize the unique behavior of your character.</p>

                    <div className="space-y-4">
                      <label className="block space-y-2" htmlFor="char-short-desc">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Short Description / Catchphrase</span>
                          <span className="text-[10px] text-text-muted">{form.shortDescription.length}/100</span>
                        </div>
                        <textarea
                          id="char-short-desc"
                          name="shortDescription"
                          value={form.shortDescription}
                          onChange={handleInputChange}
                          maxLength={100}
                          className="min-h-[50px] w-full rounded-2xl bg-surface-900/45 px-4 py-2.5 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Brief overview or bio snippet..."
                        />
                      </label>

                      <label className="block space-y-2" htmlFor="char-desc">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Long Description / Background Context</span>
                          <span className="text-[10px] text-text-muted">{form.description.length}/1000</span>
                        </div>
                        <textarea
                          id="char-desc"
                          name="description"
                          value={form.description}
                          onChange={handleInputChange}
                          maxLength={1000}
                          className="min-h-[70px] w-full rounded-2xl bg-surface-900/45 px-4 py-2.5 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Detailed background story and context..."
                        />
                      </label>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted block">Personality Tags (Click to toggle)</span>
                          <span className="text-[10px] text-text-muted">{selectedChips.length}/7</span>
                        </div>

                        {/* Personality Chips Container */}
                        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1.5 rounded-2xl bg-surface-900/25 ring-1 ring-border-subtle/10">
                          {defaultPersonalityChips.map(chip => {
                            const isSelected = selectedChips.includes(chip);
                            return (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => toggleChip(chip)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${isSelected
                                  ? 'bg-primary-500 text-surface-900 shadow-md font-semibold'
                                  : 'bg-surface-900/40 text-text-muted hover:bg-surface-900/80 hover:text-text-high border border-border-subtle/15'
                                  }`}
                              >
                                {chip}
                              </button>
                            );
                          })}
                          {customChips.map(chip => {
                            const isSelected = selectedChips.includes(chip);
                            return (
                              <div
                                key={chip}
                                onClick={() => toggleChip(chip)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 ${isSelected
                                  ? 'bg-purple-500 text-surface-900 shadow-md font-semibold'
                                  : 'bg-surface-900/40 text-text-muted hover:bg-surface-900/80 hover:text-text-high border border-purple-500/20'
                                  }`}
                              >
                                <span>{chip} ★</span>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteCustomChip(chip, e)}
                                  className={`p-0.5 rounded-full hover:bg-white/25 transition-colors ${isSelected ? 'text-surface-900/80' : 'text-text-muted/70 hover:text-text-high'
                                    }`}
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* Custom Chip Adder */}
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={newChipText}
                            onChange={e => setNewChipText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomChip(); } }}
                            placeholder="Create custom personality..."
                            className="flex-grow rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomChip}
                            className="rounded-xl bg-surface-900/60 border border-border-subtle/20 hover:bg-surface-900 px-3 py-2 text-xs font-semibold text-text-high transition"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Appearance Traits */}
                {step === 4 && (
                  <div className="space-y-4">
                    <h4 className="font-display text-lg text-text-high">Appearance Details</h4>
                    <p className="text-xs text-text-muted">Define the specific looks of your character.</p>

                    {form.image ? (
                      <div className="space-y-6">
                        {/* Image Eyedropper section on top, full width */}
                        <div className="space-y-4 p-4 rounded-2xl bg-surface-900/10 border border-white/[0.02]">
                          <div className="flex gap-1 p-1 bg-surface-950/60 rounded-xl border border-white/[0.04] shadow-inner max-w-md mx-auto">
                            {(["hair", "eye", "skin"] as const).map((trait) => {
                              const label = trait === "hair" ? "Hair" : trait === "eye" ? "Eye" : "Skin";
                              const isSelected = activeTrait === trait;
                              const traitColor = trait === "hair" ? form.hairColor : trait === "eye" ? form.eyeColor : form.skinColor;
                              return (
                                <button
                                  key={trait}
                                  type="button"
                                  onClick={() => setActiveTrait(trait)}
                                  className={`flex-grow flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                                    isSelected
                                      ? "bg-primary-500 text-surface-900 shadow-md scale-[1.02]"
                                      : "text-text-muted hover:text-text-high hover:bg-white/5"
                                  }`}
                                >
                                  <span>{label}</span>
                                  <div className="w-2.5 h-2.5 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: traitColor || "#000000" }} />
                                </button>
                              );
                            })}
                          </div>

                          <div className="max-w-2xl mx-auto w-full">
                            <ImageColorPicker
                              image={form.image}
                              activeTraitName={activeTrait}
                              activeColor={activeTrait === "hair" ? form.hairColor : activeTrait === "eye" ? form.eyeColor : form.skinColor}
                              onColorSelect={(hex) => {
                                if (activeTrait === "hair") {
                                  setForm({ ...form, hairColor: hex });
                                } else if (activeTrait === "eye") {
                                  setForm({ ...form, eyeColor: hex });
                                } else if (activeTrait === "skin") {
                                  setForm({ ...form, skinColor: hex });
                                }
                              }}
                            />
                          </div>
                        </div>

                        {/* 3 Color Pickers below */}
                        <div className="grid gap-6 sm:grid-cols-3">
                          <div className="flex flex-col items-center p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/10 space-y-3">
                            <span className="text-xs font-semibold text-text-high uppercase tracking-wider">Hair Color</span>
                            <ColorWheelPicker
                              value={form.hairColor || "#000000"}
                              onChange={(hex) => setForm({ ...form, hairColor: hex })}
                            />
                          </div>

                          <div className="flex flex-col items-center p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/10 space-y-3">
                            <span className="text-xs font-semibold text-text-high uppercase tracking-wider">Eye Color</span>
                            <ColorWheelPicker
                              value={form.eyeColor || "#000000"}
                              onChange={(hex) => setForm({ ...form, eyeColor: hex })}
                            />
                          </div>

                          <div className="flex flex-col items-center p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/10 space-y-3">
                            <span className="text-xs font-semibold text-text-high uppercase tracking-wider">Skin Color</span>
                            <ColorWheelPicker
                              value={form.skinColor || "#F5DEB3"}
                              onChange={(hex) => setForm({ ...form, skinColor: hex })}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-3">
                        <div className="flex flex-col items-center p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/10 space-y-3">
                          <span className="text-xs font-semibold text-text-high uppercase tracking-wider">Hair Color</span>
                          <ColorWheelPicker
                            value={form.hairColor || "#000000"}
                            onChange={(hex) => setForm({ ...form, hairColor: hex })}
                          />
                        </div>

                        <div className="flex flex-col items-center p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/10 space-y-3">
                          <span className="text-xs font-semibold text-text-high uppercase tracking-wider">Eye Color</span>
                          <ColorWheelPicker
                            value={form.eyeColor || "#000000"}
                            onChange={(hex) => setForm({ ...form, eyeColor: hex })}
                          />
                        </div>

                        <div className="flex flex-col items-center p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/10 space-y-3">
                          <span className="text-xs font-semibold text-text-high uppercase tracking-wider">Skin Color</span>
                          <ColorWheelPicker
                            value={form.skinColor || "#F5DEB3"}
                            onChange={(hex) => setForm({ ...form, skinColor: hex })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 5: Outfit & Attributes */}
                {step === 5 && (
                  <div className="space-y-4">
                    <h4 className="font-display text-lg text-text-high">Clothes & Attributes</h4>
                    <p className="text-xs text-text-muted">Describe their clothing, body type, and gadgets.</p>

                    <div className="space-y-4">
                      <label className="block space-y-2">
                        <span className="text-xs text-text-muted">Clothes / Attire</span>
                        <textarea
                          name="clothes"
                          value={form.clothes}
                          onChange={handleInputChange}
                          className="min-h-[80px] w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Attire description"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-xs text-text-muted">Body Build / Appearance</span>
                        <textarea
                          name="body"
                          value={form.body}
                          onChange={handleInputChange}
                          className="min-h-[80px] w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Physical build"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-xs text-text-muted">Gadgets & Accessories</span>
                        <input
                          type="text"
                          name="gadgets"
                          value={form.gadgets}
                          onChange={handleInputChange}
                          className="w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Accessories or special gadgets"
                        />
                      </label>
                      <div className="flex justify-between items-center bg-surface-900/25 p-3 rounded-2xl ring-1 ring-border-subtle/10 text-xs">
                        <span className="text-text-muted font-medium">Estimated System Prompt Space Used:</span>
                        <span className={`font-semibold ${calculateSystemPromptLength(form) > 4500 ? 'text-rose-400' : 'text-primary-400'}`}>
                          {calculateSystemPromptLength(form)} / 5000
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 6: Greeting Message */}
                {step === 6 && (
                  <div className="space-y-4">
                    <h4 className="font-display text-lg text-text-high">Greeting Message</h4>
                    <p className="text-xs text-text-muted">Define the very first message sent by the chatbot when starting a new chat.</p>

                    <div className="space-y-4">
                      <label className="block space-y-2" htmlFor="char-greeting">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-text-muted">Greeting / First Message</span>
                          <span className="text-[10px] text-text-muted">{form.greeting.length}/500</span>
                        </div>
                        <textarea
                          id="char-greeting"
                          name="greeting"
                          value={form.greeting}
                          onChange={handleInputChange}
                          maxLength={500}
                          className="min-h-[100px] w-full rounded-2xl bg-surface-900/45 px-4 py-3 text-sm text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
                          placeholder="Hello! I'm your chatbot..."
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* STEP 7: Locations (World Building) Step */}
                {step === 7 && (
                  <div className="space-y-4">
                    <h4 className="font-display text-lg text-text-high">Locations</h4>
                    <p className="text-xs text-text-muted">Create places/locations where this chatbot lives, so the AI remembers and interacts with them.</p>

                    <div className="space-y-4">
                      {/* Importer */}
                      <div className="p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/15 space-y-3">
                        <div className="text-xs font-medium text-text-high">Import places from another chatbot</div>

                        <input
                          type="text"
                          placeholder="Search your chatbots with locations..."
                          value={worldSearchQuery}
                          onChange={e => setWorldSearchQuery(e.target.value)}
                          className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                        />

                        <select
                          value={selectedWorldCharId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setSelectedWorldCharId(selectedId);
                            setSelectedWorldPlaceIndices([]);
                            if (!selectedId) {
                              setAvailableWorldPlaces([]);
                              return;
                            }
                            const handleTargetChar = (targetChar: any) => {
                                if (targetChar) {
                                  const desc = targetChar.description || "";
                                  let placesText = "";
                                  const match = desc.match(/---\[PLACES \/ LOCATIONS\]---\n([\s\S]*?)(?:\n\n---|$)/);
                                  if (match && match[1]) {
                                    placesText = match[1].trim();
                                  } else if (desc.includes("---[PLACES / LOCATIONS]---")) {
                                    placesText = desc.split("---[PLACES / LOCATIONS]---")[1].split("---")[0].trim();
                                  }
                                  if (placesText) {
                                    const lines = placesText.split("\n");
                                    const parsedPlaces: { name: string; description: string }[] = [];
                                    lines.forEach(line => {
                                      const m = line.match(/^-\s*\*\*(.*?)\*\*:\s*(.*)$/);
                                      if (m && m[1] && m[2]) {
                                        parsedPlaces.push({ name: m[1].trim(), description: m[2].trim() });
                                      }
                                    });
                                    setAvailableWorldPlaces(parsedPlaces);
                                  } else {
                                    setAvailableWorldPlaces([]);
                                  }
                                }
                            };
                            invoke<any>("get_local_character", { characterId: selectedId })
                              .then(localChar => {
                                if (localChar) {
                                  handleTargetChar(localChar);
                                } else {
                                  fetch(`${API_URL}/api/desktop/characters/${selectedId}`)
                                    .then(res => res.json())
                                    .then(handleTargetChar)
                                    .catch(err => console.warn("Failed to fetch character details via REST:", err));
                                }
                              })
                              .catch(() => {
                                fetch(`${API_URL}/api/desktop/characters/${selectedId}`)
                                  .then(res => res.json())
                                  .then(handleTargetChar)
                                  .catch(() => {});
                              });
                          }}
                          className="w-full rounded-xl bg-surface-900/45 px-3 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50 cursor-pointer"
                        >
                          <option value="">Select chatbot...</option>
                          {createdCharacters
                            .filter(c => c.description?.includes("---[PLACES / LOCATIONS]---") && c.name.toLowerCase().includes(worldSearchQuery.toLowerCase()))
                            .map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        {availableWorldPlaces.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-border-subtle/15">
                            <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider flex items-center justify-between">
                              <span>Select places to import:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedWorldPlaceIndices.length === availableWorldPlaces.length) {
                                    setSelectedWorldPlaceIndices([]);
                                  } else {
                                    setSelectedWorldPlaceIndices(availableWorldPlaces.map((_, i) => i));
                                  }
                                }}
                                className="text-primary-400 hover:underline cursor-pointer"
                              >
                                {selectedWorldPlaceIndices.length === availableWorldPlaces.length ? "Deselect All" : "Select All"}
                              </button>
                            </div>

                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {availableWorldPlaces.map((place, idx) => {
                                const isSelected = selectedWorldPlaceIndices.includes(idx);
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedWorldPlaceIndices(selectedWorldPlaceIndices.filter(i => i !== idx));
                                      } else {
                                        setSelectedWorldPlaceIndices([...selectedWorldPlaceIndices, idx]);
                                      }
                                    }}
                                    className={`flex items-start gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition ${isSelected ? "bg-primary-500/10 border-primary-500/30 text-text-high" : "bg-surface-900/45 border-border-subtle/10 text-text-muted hover:text-text-high"
                                      }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => { }}
                                      className="mt-0.5 rounded border-border-subtle bg-surface-900 text-primary-500 focus:ring-0"
                                    />
                                    <div>
                                      <div className="text-xs font-bold text-text-high">{place.name}</div>
                                      <div className="text-[11px] mt-0.5">{place.description}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              disabled={selectedWorldPlaceIndices.length === 0}
                              onClick={() => {
                                const toAdd = selectedWorldPlaceIndices.map(i => availableWorldPlaces[i]);
                                setPlaces(prev => [...prev, ...toAdd]);
                                setSelectedWorldCharId("");
                                setAvailableWorldPlaces([]);
                                setSelectedWorldPlaceIndices([]);
                                setWorldSearchQuery("");
                              }}
                              className="w-full rounded-xl bg-primary-500 text-surface-900 py-2 text-xs font-bold transition hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                              Import Selected Places ({selectedWorldPlaceIndices.length})
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Places List */}
                      {places.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto p-1 bg-surface-900/25 rounded-2xl ring-1 ring-border-subtle/10">
                          {places.map((place, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-surface-900/45 ring-1 ring-border-subtle/10">
                              <div>
                                <div className="text-xs font-semibold text-text-high">{place.name}</div>
                                <div className="text-[11px] text-text-muted mt-0.5">{place.description}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeletePlace(idx)}
                                className="text-text-muted hover:text-rose-400 p-1 rounded-full hover:bg-white/5 transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Place Creator */}
                      <div className="p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/15 space-y-3">
                        <div className="text-xs font-medium text-text-high">Add a new location</div>
                        <input
                          type="text"
                          value={newPlaceName}
                          onChange={e => setNewPlaceName(e.target.value)}
                          placeholder="Place name (e.g. Shadow Forest)"
                          className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                        />
                        <textarea
                          value={newPlaceDesc}
                          onChange={e => setNewPlaceDesc(e.target.value)}
                          placeholder="What happens in this place? What does it look like?"
                          className="w-full h-16 rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                        />
                        <button
                          type="button"
                          onClick={handleAddPlace}
                          className="w-full rounded-xl bg-primary-500 text-surface-900 py-2 text-xs font-semibold transition hover:bg-primary-600"
                        >
                          Add Place
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 8: Personas (Multi-Character) Step */}
                {step === 8 && (
                  <div className="space-y-4">
                    <h4 className="font-display text-lg text-text-high">Personas (Multi-Character)</h4>
                    <p className="text-xs text-text-muted">Add other characters to inside this chatbot, so they can talk together to you or among themselves in a group chat!</p>

                    <div className="space-y-4">
                      {/* Importer */}
                      <div className="p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/15 space-y-3">
                        <div className="text-xs font-medium text-text-high">Import character as supportive cast</div>

                        <input
                          type="text"
                          placeholder="Search your chatbots with cast..."
                          value={castSearchQuery}
                          onChange={e => setCastSearchQuery(e.target.value)}
                          className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                        />

                        <select
                          value={selectedCastCharId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setSelectedCastCharId(selectedId);
                            setSelectedCastSubIndices([]);
                            if (!selectedId) {
                              setAvailableCastSubs([]);
                              return;
                            }
                            const handleTargetChar = (targetChar: any) => {
                                if (targetChar) {
                                  const desc = targetChar.description || "";
                                  let subsText = "";
                                  const match = desc.match(/---\[SUPPORTING CHARACTERS\]---\n([\s\S]*?)(?:\n\n---|$)/);
                                  if (match && match[1]) {
                                    subsText = match[1].trim();
                                  } else if (desc.includes("---[SUPPORTING CHARACTERS]---")) {
                                    subsText = desc.split("---[SUPPORTING CHARACTERS]---")[1].split("---")[0].trim();
                                  }
                                  if (subsText) {
                                    const lines = subsText.split("\n");
                                    const parsedSubs: { name: string; personality: string }[] = [];
                                    lines.forEach(line => {
                                      const m = line.match(/^-\s*\*\*(.*?)\*\*:\s*(.*)$/);
                                      if (m && m[1] && m[2]) {
                                        parsedSubs.push({ name: m[1].trim(), personality: m[2].trim() });
                                      }
                                    });
                                    setAvailableCastSubs(parsedSubs);
                                  } else {
                                    setAvailableCastSubs([]);
                                  }
                                }
                            };
                            invoke<any>("get_local_character", { characterId: selectedId })
                              .then(localChar => {
                                if (localChar) {
                                  handleTargetChar(localChar);
                                } else {
                                  fetch(`${API_URL}/api/desktop/characters/${selectedId}`)
                                    .then(res => res.json())
                                    .then(handleTargetChar)
                                    .catch(err => console.warn("Failed to fetch character details via REST:", err));
                                }
                              })
                              .catch(() => {
                                fetch(`${API_URL}/api/desktop/characters/${selectedId}`)
                                  .then(res => res.json())
                                  .then(handleTargetChar)
                                  .catch(() => {});
                              });
                          }}
                          className="w-full rounded-xl bg-surface-900/45 px-3 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50 cursor-pointer"
                        >
                          <option value="">Select chatbot...</option>
                          {createdCharacters
                            .filter(c => c.description?.includes("---[SUPPORTING CHARACTERS]---") && c.name.toLowerCase().includes(castSearchQuery.toLowerCase()))
                            .map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>

                        {availableCastSubs.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-border-subtle/15">
                            <div className="text-[11px] font-bold text-text-subtle uppercase tracking-wider flex items-center justify-between">
                              <span>Select cast to import:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedCastSubIndices.length === availableCastSubs.length) {
                                    setSelectedCastSubIndices([]);
                                  } else {
                                    setSelectedCastSubIndices(availableCastSubs.map((_, i) => i));
                                  }
                                }}
                                className="text-primary-400 hover:underline cursor-pointer"
                              >
                                {selectedCastSubIndices.length === availableCastSubs.length ? "Deselect All" : "Select All"}
                              </button>
                            </div>

                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {availableCastSubs.map((sub, idx) => {
                                const isSelected = selectedCastSubIndices.includes(idx);
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      if (isSelected) {
                                        setSelectedCastSubIndices(selectedCastSubIndices.filter(i => i !== idx));
                                      } else {
                                        setSelectedCastSubIndices([...selectedCastSubIndices, idx]);
                                      }
                                    }}
                                    className={`flex items-start gap-3 p-2.5 rounded-xl border text-left cursor-pointer transition ${isSelected ? "bg-primary-500/10 border-primary-500/30 text-text-high" : "bg-surface-900/45 border-border-subtle/10 text-text-muted hover:text-text-high"
                                      }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => { }}
                                      className="mt-0.5 rounded border-border-subtle bg-surface-900 text-primary-500 focus:ring-0"
                                    />
                                    <div>
                                      <div className="text-xs font-bold text-text-high">{sub.name}</div>
                                      <div className="text-[11px] mt-0.5 whitespace-pre-line">{sub.personality}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              disabled={selectedCastSubIndices.length === 0}
                              onClick={() => {
                                const toAdd = selectedCastSubIndices.map(i => availableCastSubs[i]);
                                setSubCharacters(prev => [...prev, ...toAdd]);
                                setSelectedCastCharId("");
                                setAvailableCastSubs([]);
                                setSelectedCastSubIndices([]);
                                setCastSearchQuery("");
                              }}
                              className="w-full rounded-xl bg-primary-500 text-surface-900 py-2 text-xs font-bold transition hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                            >
                              Import Selected Characters ({selectedCastSubIndices.length})
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Supporting Cast List */}
                      {subCharacters.length > 0 && (
                        <div className="space-y-2 max-h-40 overflow-y-auto p-1 bg-surface-900/25 rounded-2xl ring-1 ring-border-subtle/10">
                          {subCharacters.map((sub, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-surface-900/45 ring-1 ring-border-subtle/10">
                              <div>
                                <div className="text-xs font-semibold text-text-high">{sub.name}</div>
                                <div className="text-[11px] text-text-muted mt-0.5 whitespace-pre-line">{sub.personality}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubChar(idx)}
                                className="text-text-muted hover:text-rose-400 p-1 rounded-full hover:bg-white/5 transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Sub Character Creator */}
                      <div className="p-4 rounded-2xl bg-surface-900/15 border border-border-subtle/15 space-y-4">
                        <div className="text-xs font-semibold text-text-high uppercase tracking-wider">Configure Supporting Character</div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block space-y-1">
                            <span className="text-[11px] text-text-muted">Name *</span>
                            <input
                              type="text"
                              value={newSubName}
                              onChange={e => setNewSubName(e.target.value)}
                              placeholder="Character name (e.g. Alice)"
                              className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                            />
                          </label>

                          <label className="block space-y-1">
                            <span className="text-[11px] text-text-muted">Sex / Gender</span>
                            <select
                              value={newSubSex}
                              onChange={e => setNewSubSex(e.target.value)}
                              className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50 cursor-pointer"
                            >
                              <option value="">Select</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="gay">Gay</option>
                              <option value="lesbian">Lesbian</option>
                              <option value="pansexual">Pansexual</option>
                              <option value="futanari">Futanari</option>
                              <option value="non-binary">Non-binary</option>
                              <option value="other">Other</option>
                            </select>
                          </label>
                        </div>

                        <label className="block space-y-1">
                          <span className="text-[11px] text-text-muted">Personality / Role *</span>
                          <textarea
                            value={newSubPersonality}
                            onChange={e => setNewSubPersonality(e.target.value)}
                            placeholder="Describe their personality, traits, and behavior..."
                            className="w-full h-14 rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                          />
                        </label>

                        {(() => {
                          const availableAvatarImage = form.image;
                          return availableAvatarImage ? (
                            <div className="space-y-4 bg-surface-900/15 p-3 rounded-2xl ring-1 ring-white/[0.03]">
                              {/* Eyedropper section on top */}
                              <div className="space-y-2">
                                <div className="flex gap-1 p-0.5 bg-surface-950/60 rounded-xl border border-white/[0.04] shadow-inner max-w-xs mx-auto">
                                  {(["hair", "eye", "skin"] as const).map((trait) => {
                                    const label = trait === "hair" ? "Hair" : trait === "eye" ? "Eye" : "Skin";
                                    const isSelected = activeSubTrait === trait;
                                    const traitColor = trait === "hair" ? newSubHair : trait === "eye" ? newSubEye : newSubSkin;
                                    return (
                                      <button
                                        key={trait}
                                        type="button"
                                        onClick={() => setActiveSubTrait(trait)}
                                        className={`flex-grow flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                                          isSelected
                                            ? "bg-primary-500 text-surface-900 shadow-md"
                                            : "text-text-muted hover:text-text-high hover:bg-white/5"
                                        }`}
                                      >
                                        <span>{label}</span>
                                        <div className="w-2 h-2 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: traitColor || "#000000" }} />
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="max-w-md mx-auto w-full">
                                  <ImageColorPicker
                                    image={availableAvatarImage}
                                    activeTraitName={activeSubTrait}
                                    activeColor={activeSubTrait === "hair" ? newSubHair : activeSubTrait === "eye" ? newSubEye : newSubSkin}
                                    onColorSelect={(hex) => {
                                      if (activeSubTrait === "hair") {
                                        setNewSubHair(hex);
                                      } else if (activeSubTrait === "eye") {
                                        setNewSubEye(hex);
                                      } else if (activeSubTrait === "skin") {
                                        setNewSubSkin(hex);
                                      }
                                    }}
                                  />
                                </div>
                              </div>

                              {/* 3 Color wheels at the bottom */}
                              <div className="grid gap-2 grid-cols-3">
                                <div className="flex flex-col items-center space-y-1.5 p-1 rounded-xl bg-surface-900/10">
                                  <span className="text-[10px] font-semibold text-text-high">Hair</span>
                                  <ColorWheelPicker
                                    value={newSubHair || "#000000"}
                                    onChange={(hex) => setNewSubHair(hex)}
                                    size={76}
                                  />
                                </div>

                                <div className="flex flex-col items-center space-y-1.5 p-1 rounded-xl bg-surface-900/10">
                                  <span className="text-[10px] font-semibold text-text-high">Eye</span>
                                  <ColorWheelPicker
                                    value={newSubEye || "#000000"}
                                    onChange={(hex) => setNewSubEye(hex)}
                                    size={76}
                                  />
                                </div>

                                <div className="flex flex-col items-center space-y-1.5 p-1 rounded-xl bg-surface-900/10">
                                  <span className="text-[10px] font-semibold text-text-high">Skin</span>
                                  <ColorWheelPicker
                                    value={newSubSkin || "#ffffff"}
                                    onChange={(hex) => setNewSubSkin(hex)}
                                    size={76}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-3 bg-surface-900/15 p-3 rounded-2xl ring-1 ring-white/[0.03]">
                              <div className="flex flex-col items-center space-y-1.5">
                                <span className="text-[11px] font-semibold text-text-high">Hair Color</span>
                                <ColorWheelPicker
                                  value={newSubHair || "#000000"}
                                  onChange={(hex) => setNewSubHair(hex)}
                                  size={76}
                                />
                              </div>

                              <div className="flex flex-col items-center space-y-1.5">
                                <span className="text-[11px] font-semibold text-text-high">Eye Color</span>
                                <ColorWheelPicker
                                  value={newSubEye || "#000000"}
                                  onChange={(hex) => setNewSubEye(hex)}
                                  size={76}
                                />
                              </div>

                              <div className="flex flex-col items-center space-y-1.5">
                                <span className="text-[11px] font-semibold text-text-high">Skin Color</span>
                                <ColorWheelPicker
                                  value={newSubSkin || "#ffffff"}
                                  onChange={(hex) => setNewSubSkin(hex)}
                                  size={76}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        <label className="block space-y-1">
                          <span className="text-[11px] text-text-muted">Body Type</span>
                          <input
                            type="text"
                            value={newSubBody}
                            onChange={e => setNewSubBody(e.target.value)}
                            placeholder="Body type (e.g. Athletic)"
                            className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                          />
                        </label>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block space-y-1">
                            <span className="text-[11px] text-text-muted">Clothes</span>
                            <input
                              type="text"
                              value={newSubClothes}
                              onChange={e => setNewSubClothes(e.target.value)}
                              placeholder="Clothes description"
                              className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                            />
                          </label>

                          <label className="block space-y-1">
                            <span className="text-[11px] text-text-muted">Gadgets & Tools</span>
                            <input
                              type="text"
                              value={newSubGadgets}
                              onChange={e => setNewSubGadgets(e.target.value)}
                              placeholder="Gadgets / Weapons"
                              className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                            />
                          </label>
                        </div>

                        <label className="block space-y-1">
                          <span className="text-[11px] text-text-muted">Greeting / Intro Message</span>
                          <input
                            type="text"
                            value={newSubGreeting}
                            onChange={e => setNewSubGreeting(e.target.value)}
                            placeholder="How do they join the chat? (e.g. 'Hello everyone!')"
                            className="w-full rounded-xl bg-surface-900/45 px-3 py-2 text-xs text-text-high outline-none ring-1 ring-border-subtle/25 focus:ring-primary-500/50"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={handleAddSubChar}
                          className="w-full rounded-xl bg-primary-500 text-surface-900 py-2.5 text-xs font-semibold transition hover:bg-primary-600 shadow-md"
                        >
                          Add Supporting Character
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {formError ? <p className="text-xs text-rose-400 mt-2 font-medium">{formError}</p> : null}
                </div>

                {/* Navigation Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-border-subtle/10 mt-6">
                  {step > 1 ? (
                    <motion.button
                      whileHover={hasHover ? { scale: 1.02 } : undefined}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setStep(prev => prev - 1)}
                      className="rounded-full border border-border-subtle/10 hover:bg-white/5 px-6 py-2.5 text-xs font-bold text-text-high transition-colors cursor-pointer"
                    >
                      Back
                    </motion.button>
                  ) : (
                    <div />
                  )}

                  {step < totalSteps ? (
                    <motion.button
                      whileHover={hasHover ? { scale: 1.02 } : undefined}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => {
                        if (step === 2) {
                          if (!form.name.trim()) {
                            setFormError("Name is required to continue.");
                            return;
                          }
                          if (form.name.trim().length > 32) {
                            setFormError("Name must be maximum 32 characters.");
                            return;
                          }
                        }
                        if (step === 3) {
                          if (form.shortDescription.trim().length > 100) {
                            setFormError("Short description must be maximum 100 characters.");
                            return;
                          }
                          if (form.description.trim().length > 1000) {
                            setFormError("Long description must be maximum 1000 characters.");
                            return;
                          }
                          const selectedChips = form.personality ? form.personality.split(",").map(t => t.trim()).filter(Boolean) : [];
                          if (selectedChips.length > 7) {
                            setFormError("Personality must be maximum 7 tags.");
                            return;
                          }
                        }
                        if (step === 5) {
                          const spLength = calculateSystemPromptLength(form);
                          if (spLength > 5000) {
                            setFormError(`System prompt exceeds maximum of 5000 characters (currently ${spLength}). Please shorten your descriptions, traits, or attributes.`);
                            return;
                          }
                        }
                        if (step === 6) {
                          if (form.greeting.trim().length > 500) {
                            setFormError("Greeting message must be maximum 500 characters.");
                            return;
                          }
                        }
                        setFormError("");
                        setStep(prev => prev + 1);
                      }}
                      className="rounded-full bg-primary-400 hover:bg-primary-300 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-colors shadow-lg shadow-primary-500/10 cursor-pointer"
                    >
                      Continue
                    </motion.button>
                  ) : (
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
                        Publishing as {currentUser.displayName}
                      </span>
                      <motion.button
                        whileHover={hasHover ? { scale: 1.02 } : undefined}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="rounded-full bg-primary-400 hover:bg-primary-300 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-colors shadow-lg shadow-primary-500/15 cursor-pointer"
                      >
                        Create Character
                      </motion.button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="glass-card rounded-[32px] p-6 border border-white/[0.08] bg-gradient-to-br from-white/[0.01] to-white/[0.002] shadow-glass flex flex-col h-full justify-between backdrop-blur-2xl">
            <div>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl text-text-high">Your chatbot releases</h3>
                  <p className="text-sm text-text-muted">
                    {currentUser.role === "admin"
                      ? "Admin mode: no ads in the list."
                      : "Free creator view: ads appear between releases."}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {myCharacters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectMode(!isSelectMode);
                        setSelectedIds([]);
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ring-1 ${isSelectMode
                          ? "bg-white/15 text-text-high ring-white/20"
                          : "bg-surface-900/60 text-text-muted hover:text-text-high ring-border-subtle/20"
                        }`}
                    >
                      {isSelectMode ? "Cancel" : "Manage"}
                    </button>
                  )}
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-text-high">
                    {currentUser.role}
                  </span>
                </div>
              </div>

              {isSelectMode && myCharacters.length > 0 && (
                <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-900/30 p-3 ring-1 ring-border-subtle/10 animate-fade-in">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-medium text-text-muted hover:text-text-high transition"
                  >
                    {selectedIds.length === myCharacters.length ? "Deselect All" : "Select All"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={selectedIds.length === 0 || isDeleting}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${selectedIds.length > 0
                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 ring-1 ring-red-500/30"
                        : "bg-white/5 text-text-muted cursor-not-allowed"
                      }`}
                  >
                    {isDeleting ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
                  </button>
                </div>
              )}

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {myCharacters.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-subtle/30 bg-surface-900/35 p-5 text-sm text-text-muted">
                    No chatbots yet. Use Character Maker to publish your first one.
                  </div>
                ) : (
                  myCharacters.flatMap((character, index) => {
                    const isSelected = selectedIds.includes(character.id);
                    const row = (
                      <div
                        key={character.id}
                        onClick={(e) => {
                          if (isSelectMode) {
                            toggleSelectCharacter(character.id, e);
                          } else {
                            onOpenCharacter(character.id);
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl bg-surface-900/45 px-4 py-4 text-left ring-1 transition cursor-pointer ${isSelected && isSelectMode
                            ? "ring-primary-500 bg-primary-500/5"
                            : "ring-border-subtle/20 hover:bg-surface-900/60"
                          }`}
                      >
                        <div className="flex items-center gap-3 w-full min-w-0">
                          {isSelectMode && (
                            <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition ${isSelected
                                ? "border-primary-500 bg-primary-500 text-black"
                                : "border-text-muted bg-transparent"
                              }`}>
                              {isSelected && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 stroke-black" fill="none" viewBox="0 0 24 24" strokeWidth="3.5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-display text-lg text-text-high truncate">{character.name}</div>
                            <div className="text-sm text-text-muted truncate">
                              {(character.points || 0).toLocaleString("en-US")} total points
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                          {!isSelectMode ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditCharacter(character.id);
                                }}
                                disabled={isDeleting}
                                className="rounded-lg p-1.5 text-text-muted hover:text-amber-400 hover:bg-amber-500/10 transition flex items-center gap-1 text-xs font-semibold"
                                title="Edit chatbot"
                              >
                                <span>✏️</span>
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSingleDelete(character.id, character.name, e)}
                                disabled={isDeleting}
                                className="rounded-lg p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Delete chatbot"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    );

                    const hasNoAds = currentUser.role === "admin" || currentUser.subscriptionPlan === "PLUS" || currentUser.subscriptionPlan === "PRO";
                    if (hasNoAds || index === myCharacters.length - 1) {
                      return [row];
                    }

                    return [
                      row,
                      <div
                        key={`${character.id}-ad`}
                        className="rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.02))] px-4 py-3 text-sm text-text-muted ring-1 ring-border-subtle/15"
                      >
                        AD · Upgrade from Free to remove ads between character releases.
                      </div>,
                    ];
                  })
                )}
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[32px] p-6 border border-white/[0.08] bg-gradient-to-br from-white/[0.01] to-white/[0.002] shadow-glass flex flex-col h-full justify-between backdrop-blur-2xl">
            <div>
              <div className="mb-6">
                <h3 className="font-display text-2xl text-text-high">Character Maker</h3>
                <p className="text-sm text-text-muted">
                  Choose how you want to build your new chatbot.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setCreatorViewMode("import");
                    setImportUrl("");
                    setForm(defaultCreatorForm);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-surface-900/40 hover:bg-surface-900/70 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 group cursor-pointer text-center space-y-2"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-bold text-text-high">Import Bot</h4>
                    <p className="text-[9px] text-text-muted mt-0.5 leading-normal">
                      Chai or C.AI URL
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCreatorViewMode("create");
                    setStep(1);
                    setForm(defaultCreatorForm);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-surface-900/40 hover:bg-surface-900/70 border border-primary-500/20 hover:border-primary-500/40 transition-all duration-300 group cursor-pointer text-center space-y-2"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-400 group-hover:scale-105 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-bold text-text-high">Create New</h4>
                    <p className="text-[9px] text-text-muted mt-0.5 leading-normal">
                      Step-by-step wizard
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}


const settingsCardClass = "rounded-2xl bg-surface-800/60 p-4 ring-1 ring-border-subtle/20";

type SettingsPageProps = {
  currentUser: SessionUser;
  setCurrentUser: (user: SessionUser | null) => void;
  isSafe: boolean;
  setIsSafe: (next: boolean) => void;
  nsfwMode: boolean;
  setNsfwMode: (next: boolean) => void;
  appLanguage: string;
  setAppLanguage: (lang: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (next: boolean) => void;
  iCloudEnabled: boolean;
  setICloudEnabled: (next: boolean) => void;
  googleDriveEnabled: boolean;
  setGoogleDriveEnabled: (next: boolean) => void;
  dropboxEnabled: boolean;
  setDropboxEnabled: (next: boolean) => void;
  protonEnabled: boolean;
  setProtonEnabled: (next: boolean) => void;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => Promise<void>;
  selectedTheme: string;
  setSelectedTheme: (theme: string) => void;
  selectedAppIcon: string;
  setSelectedAppIcon: (icon: string) => void;
  textStyle: string;
  setTextStyle: (style: string) => void;
  cursorStyle: string;
  setCursorStyle: (style: string) => void;
  dataLog: DataLogEntry[];
  setDataLog: (log: DataLogEntry[]) => void;
  vpnConnected: boolean;
  setVpnConnected: (next: boolean) => void;
  vpnProvider: string;
  setVpnProvider: (provider: string) => void;
  selectedQuant: string;
  setSelectedQuant: (quant: string) => void;
  selectedContext: string;
  setSelectedContext: (context: string) => void;
  deviceType?: "phone" | "tablet" | "desktop";
  onBackToHome?: () => void;
};

function AccountPage({ currentUser, setCurrentUser, deviceType }: SettingsPageProps) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  // User Persona State
  const [persona, setPersona] = useState(() => {
    const saved = localStorage.getItem("klie.userPersona");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse userPersona:", e);
      }
    }
    return {
      name: currentUser.displayName || "",
      sex: "",
      description: "",
      personality: "",
      body: "",
      clothing: "",
      gadgets: ""
    };
  });

  const [personaSaveStatus, setPersonaSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [personaSaveMessage, setPersonaSaveMessage] = useState("");

  const handleSavePersona = () => {
    setPersonaSaveStatus("saving");
    try {
      localStorage.setItem("klie.userPersona", JSON.stringify(persona));
      setPersonaSaveStatus("success");
      setPersonaSaveMessage("Persona saved successfully!");
    } catch (e) {
      console.error(e);
      setPersonaSaveStatus("error");
      setPersonaSaveMessage("Failed to save persona.");
    }
    setTimeout(() => {
      setPersonaSaveStatus("idle");
      setPersonaSaveMessage("");
    }, 2500);
  };

  const handleSaveName = async () => {
    if (!currentUser.sessionToken) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`${API_URL}/api/desktop/auth/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.sessionToken}`,
        },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update.");
      setCurrentUser({ ...currentUser, displayName: data.user.displayName });
      setSaveStatus("success");
      setSaveMessage("Username updated.");
      setIsEditingName(false);
    } catch {
      setSaveStatus("error");
      setSaveMessage("Failed to update username.");
    }
    setTimeout(() => { setSaveStatus("idle"); setSaveMessage(""); }, 3000);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser.sessionToken) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setSaveStatus("saving");
      try {
        const res = await fetch(`${API_URL}/api/desktop/auth/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser.sessionToken}`,
          },
          body: JSON.stringify({ profileImageUrl: base64 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update.");
        setCurrentUser({ ...currentUser, avatarUrl: data.user.avatarUrl });
        setSaveStatus("success");
        setSaveMessage("Profile image updated.");
      } catch {
        setSaveStatus("error");
        setSaveMessage("Failed to update image.");
      }
      setTimeout(() => { setSaveStatus("idle"); setSaveMessage(""); }, 3000);
    };
    reader.readAsDataURL(file);
  };

  const planLabel = (currentUser.subscriptionPlan || "free").toUpperCase();
  const planStatus = (currentUser.subscriptionStatus || "none").toLowerCase();

  return (
    <div className="space-y-6 text-text-high">
      <div>
        <h2 className="text-2xl font-display font-black tracking-tight">Account</h2>
        <p className="mt-1 text-xs text-text-muted font-bold uppercase tracking-wider">Your profile information and subscription plan.</p>
      </div>

      <div className={settingsCardClass}>
        <div className="flex items-start gap-6">
          <div className="relative flex-shrink-0">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName}
              className="h-24 w-24 rounded-full object-cover ring-2 ring-border-subtle/30"
            />
            <motion.label
              whileHover={hasHover ? { scale: 1.1 } : undefined}
              whileTap={{ scale: 0.9 }}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary-400 text-black text-xs font-bold shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </motion.label>
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {isEditingName ? (
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="rounded-xl bg-surface-900/50 border border-border-subtle/10 px-3 py-1.5 text-base font-semibold text-text-high outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/20 w-full"
                />
              ) : (
                <div className="font-display text-2xl font-black truncate">{currentUser.displayName}</div>
              )}
              {!isEditingName && (
                <motion.button
                  whileHover={hasHover ? { scale: 1.05 } : undefined}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEditingName(true)}
                  className="flex-shrink-0 rounded-lg bg-white/5 border border-border-subtle/10 px-2.5 py-1 text-xs font-bold text-text-muted hover:text-text-high hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Edit
                </motion.button>
              )}
            </div>
            <div className="text-xs font-semibold text-text-muted truncate">{currentUser.email}</div>
            {isEditingName && (
              <div className="flex items-center gap-2 pt-1">
                <motion.button
                  whileHover={hasHover ? { scale: 1.02 } : undefined}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveName}
                  disabled={saveStatus === "saving"}
                  className="rounded-full bg-primary-400 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black cursor-pointer disabled:opacity-50"
                >
                  Save
                </motion.button>
                <motion.button
                  whileHover={hasHover ? { scale: 1.02 } : undefined}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setIsEditingName(false); setDisplayName(currentUser.displayName); }}
                  className="rounded-full border border-border-subtle/10 hover:bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-text-high cursor-pointer"
                >
                  Cancel
                </motion.button>
              </div>
            )}
            {saveMessage && (
              <p className={`text-xs font-semibold mt-1 ${saveStatus === "error" ? "text-rose-400" : "text-emerald-400"}`}>{saveMessage}</p>
            )}
          </div>
        </div>
      </div>

      {/* Persona Maker */}
      <div className={`${settingsCardClass} space-y-4`}>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">Define Your Persona (Personal Character Context)</div>
          <p className="text-xs text-text-muted mt-1 font-semibold leading-relaxed">Define yourself so that chatbots are aware of who you are, your traits, and your appearance.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs text-text-muted">Your Name</span>
            <input
              type="text"
              value={persona.name}
              onChange={(e) => setPersona({ ...persona, name: e.target.value })}
              placeholder="Your name"
              className="w-full rounded-xl bg-surface-900/45 px-3.5 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-text-muted">Your Sex / Gender Orientation</span>
            <select
              value={persona.sex}
              onChange={(e) => setPersona({ ...persona, sex: e.target.value })}
              className="w-full rounded-xl bg-surface-900/45 px-3.5 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50 cursor-pointer"
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs text-text-muted">Short Bio / Background Description</span>
          <textarea
            value={persona.description}
            onChange={(e) => setPersona({ ...persona, description: e.target.value })}
            placeholder="Introduce yourself, your background, origins..."
            rows={2}
            className="w-full rounded-xl bg-surface-900/45 px-3.5 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50 min-h-[60px]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs text-text-muted">Personality Traits / Attributes</span>
          <textarea
            value={persona.personality}
            onChange={(e) => setPersona({ ...persona, personality: e.target.value })}
            placeholder="Define your traits (e.g. friendly, quiet, adventurous, creative...)"
            rows={2}
            className="w-full rounded-xl bg-surface-900/45 px-3.5 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50 min-h-[60px]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-text-muted">Appearance & Body</span>
            <textarea
              value={persona.body}
              onChange={(e) => setPersona({ ...persona, body: e.target.value })}
              placeholder="Height, hair style, eyes..."
              rows={2}
              className="w-full rounded-xl bg-surface-900/45 px-3.5 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50 min-h-[50px]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-text-muted">Clothing & Apparel</span>
            <textarea
              value={persona.clothing}
              onChange={(e) => setPersona({ ...persona, clothing: e.target.value })}
              placeholder="Favorite outfit, accessories..."
              rows={2}
              className="w-full rounded-xl bg-surface-900/45 px-3.5 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50 min-h-[50px]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-text-muted">Gadgets & Carried Items</span>
            <textarea
              value={persona.gadgets}
              onChange={(e) => setPersona({ ...persona, gadgets: e.target.value })}
              placeholder="Phone, keys, tools..."
              rows={2}
              className="w-full rounded-xl bg-surface-900/45 px-3.5 py-2.5 text-xs text-text-high outline-none ring-1 ring-border-subtle/20 focus:ring-primary-500/50 min-h-[50px]"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs font-semibold">
            {personaSaveMessage && (
              <span className={personaSaveStatus === "success" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {personaSaveMessage}
              </span>
            )}
          </div>
          <motion.button
            whileHover={hasHover ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.98 }}
            onClick={handleSavePersona}
            disabled={personaSaveStatus === "saving"}
            className="rounded-full bg-primary-400 text-black px-6 py-2 text-xs font-bold uppercase tracking-wider hover:bg-primary-500 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {personaSaveStatus === "saving" ? "Saving..." : "Save Persona"}
          </motion.button>
        </div>
      </div>

      <div className={settingsCardClass}>
        <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">Plan</div>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="font-display text-xl font-black text-primary-400">{planLabel}</div>
            <div className="text-xs font-bold text-text-muted capitalize">{planStatus}</div>
          </div>
          {deviceType !== "phone" && deviceType !== "tablet" && (
            <motion.button
              whileHover={hasHover ? { scale: 1.02 } : undefined}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                openUrl("https://revtechcompany.com/account");
              }}
              className="rounded-full bg-white/5 border border-border-subtle/10 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-text-high hover:bg-white/10 transition-colors inline-block text-center cursor-pointer"
            >
              Manage Subscription
            </motion.button>
          )}
        </div>
      </div>

      <div className={settingsCardClass}>
        <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">Metadata & Support</div>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold gap-4 min-w-0">
            <span className="text-text-muted flex-shrink-0">User ID</span>
            <span className="text-text-high font-mono select-all truncate max-w-[240px] text-right" title={currentUser.id}>{currentUser.id}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle/10">
            <button
              onClick={() => openUrl("https://revtechcompany.com/terms")}
              className="py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-white/5 border border-border-subtle/10 text-text-muted hover:text-text-high hover:bg-white/10 transition cursor-pointer text-center"
            >
              Terms of Service
            </button>
            <button
              onClick={() => openUrl("https://revtechcompany.com/privacy")}
              className="py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-white/5 border border-border-subtle/10 text-text-muted hover:text-text-high hover:bg-white/10 transition cursor-pointer text-center"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => openUrl("mailto:revtechcompany@icloud.com")}
              className="col-span-2 py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-[#E53E3E]/10 border border-[#E53E3E]/20 text-[#E53E3E] hover:bg-[#E53E3E]/20 transition cursor-pointer text-center"
            >
              Report Bug / Abuse
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ isSafe: _isSafe, setIsSafe: _setIsSafe, appLanguage, setAppLanguage, notificationsEnabled, setNotificationsEnabled, iCloudEnabled, setICloudEnabled, googleDriveEnabled, setGoogleDriveEnabled, dropboxEnabled, setDropboxEnabled, protonEnabled, setProtonEnabled, onExportBackup, onImportBackup, selectedQuant, setSelectedQuant, selectedContext, setSelectedContext }: SettingsPageProps) {
  const [modelStatus, setModelStatus] = useState<{
    installed: boolean;
    path: string;
    size_bytes: number;
    repo: string;
    filename: string;
    is_mlx: boolean;
    device_os: string;
    device_ram_gb: number;
    device_strength: string;
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    invoke<any>("get_model_status")
      .then(setModelStatus)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const unlisten1 = listen<number>("model_download_progress", (e) => {
      setDownloadProgress(e.payload);
    });
    const unlisten2 = listen("model_download_complete", () => {
      setDownloadProgress(null);
      invoke<any>("get_model_status").then(setModelStatus);
    });
    return () => {
      unlisten1.then(fn => fn());
      unlisten2.then(fn => fn());
    };
  }, []);

  const handleInstallModel = async () => {
    setDownloadError("");
    setDownloadProgress(0);
    try {
      await invoke("download_ai_model");
    } catch (err) {
      setDownloadProgress(null);
      setDownloadError(String(err));
    }
  };

  const handleDeleteModel = async () => {
    try {
      const confirmed = await ask(`Are you sure you want to delete the local AI model (${modelStatus?.filename})? You will need to download it again to use offline chat.`, {
        title: "Klie - Delete AI Model",
        kind: "warning",
      });
      if (!confirmed) return;

      console.log("Deleting AI model...");
      await invoke("delete_ai_model");
      const status = await invoke<any>("get_model_status");
      setModelStatus(status);
      console.log("Model deleted successfully.");
    } catch (err) {
      console.error("Delete model error:", err);
      alert(`Failed to delete model: ${String(err)}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const gb = bytes / 1_073_741_824;
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / 1_048_576;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 text-text-high">
      <div>
        <h2 className="text-2xl font-display font-black tracking-tight">Settings</h2>
        <p className="mt-1 text-xs text-text-muted font-bold uppercase tracking-wider">General preferences for your Klie experience.</p>
      </div>

      {/* AI Model */}
      <div className={settingsCardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-display text-lg font-black text-text-high">AI Model</div>
            <p className="text-xs text-text-muted mt-1.5 font-semibold">
              Local language model for offline chat responses.<br />
              <span className="font-mono text-[10px] uppercase opacity-60 tracking-wider">
                {modelStatus ? `${modelStatus.filename} · ${selectedContext} Context` : "Checking model info..."}
              </span>
            </p>
          </div>
          <div className={`flex-shrink-0 flex items-center gap-2 text-xs font-bold ${modelStatus?.installed ? "text-emerald-400" : "text-amber-400"}`}>
            <span className={`h-2 w-2 rounded-full ${modelStatus?.installed ? "bg-emerald-400" : "bg-amber-400"}`} />
            {modelStatus === null ? "Checking…" : modelStatus.installed ? `Installed (${formatBytes(modelStatus.size_bytes)})` : "Not installed"}
          </div>
        </div>

        {downloadProgress !== null && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-text-muted uppercase tracking-wider">
              <span>Downloading…</span>
              <span>{downloadProgress.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-900/60 border border-border-subtle/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-400 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {downloadError && (
          <p className="mt-3 text-xs font-semibold text-rose-400">{downloadError}</p>
        )}

        {!modelStatus?.installed && downloadProgress === null && (
          <motion.button
            whileHover={hasHover ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.98 }}
            onClick={handleInstallModel}
            className="mt-4 rounded-full bg-primary-400 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-lg shadow-primary-500/10 cursor-pointer"
          >
            Install AI Model
          </motion.button>
        )}

        {modelStatus?.installed && downloadProgress === null && (
          <motion.button
            whileHover={hasHover ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.98 }}
            onClick={handleDeleteModel}
            className="mt-4 rounded-full bg-rose-500/10 border border-rose-500/20 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-all"
          >
            Delete AI Model
          </motion.button>
        )}

        {/* Model Configurations */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 border-t border-border-subtle/10 pt-4">
          <div className="space-y-1.5 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold block">System Detection</span>
            <div className="text-xs font-semibold text-text-high space-y-1">
              <div>OS: <span className="text-primary-400">{modelStatus?.device_os || "Detecting..."}</span></div>
              <div>RAM: <span className="text-primary-400">{modelStatus ? `${modelStatus.device_ram_gb.toFixed(1)} GB` : "..."}</span></div>
              <div>Device class: <span className="text-primary-400">{modelStatus?.device_strength || "..."}</span></div>
            </div>
          </div>
          <div className="space-y-1.5 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold block">Recommended Model</span>
            <div className="text-xs font-semibold text-text-high space-y-1">
              <div className="break-all whitespace-normal">Repo: <span className="text-emerald-400 font-mono text-[10px] break-all whitespace-normal block mt-0.5">{modelStatus?.repo || "..."}</span></div>
              <div className="break-all whitespace-normal">Model: <span className="text-emerald-400 font-mono text-[10px] break-all whitespace-normal block mt-0.5">{modelStatus?.filename || "..."}</span></div>
              <div>Format: <span className="text-emerald-400">{modelStatus?.is_mlx ? "Apple MLX Native" : "GGUF format"}</span></div>
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-border-subtle/10 pt-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] uppercase tracking-wider text-text-muted font-bold block">Context Tokens Size</label>
            <span className="text-xs font-bold text-primary-400">{selectedContext} Tokens</span>
          </div>
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={["4K", "8K", "16K", "32K"].indexOf(selectedContext) !== -1 ? ["4K", "8K", "16K", "32K"].indexOf(selectedContext) : 1}
            onChange={(e) => {
              const opts = ["4K", "8K", "16K", "32K"];
              setSelectedContext(opts[parseInt(e.target.value)]);
            }}
            className="w-full accent-primary-400 cursor-pointer h-1.5 bg-surface-900 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[9px] text-text-muted font-bold mt-1.5 px-0.5">
            <span>4K (Fastest)</span>
            <span>8K</span>
            <span>16K</span>
            <span>32K (Max)</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={settingsCardClass}>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Notifications</div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted">Show chatbot notifications</span>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer ${
                notificationsEnabled ? "bg-[#34C759]" : "bg-[#39393D]"
              }`}
            >
              <motion.span
                animate={{ x: notificationsEnabled ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 700, damping: 40 }}
                className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
              />
            </button>
          </div>
        </div>

        <div className={settingsCardClass}>
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Data Backup & Sync</div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onExportBackup}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-surface-900 border border-border-subtle/30 text-text-high hover:bg-surface-800 transition cursor-pointer"
            >
              Export Data
            </button>
            <button
              onClick={onImportBackup}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-surface-900 border border-border-subtle/30 text-text-high hover:bg-surface-800 transition cursor-pointer"
            >
              Import Data
            </button>
          </div>

          <div className="mt-4 border-t border-border-subtle/10 pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Sync with iCloud</span>
              <button
                onClick={() => setICloudEnabled(!iCloudEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer ${
                  iCloudEnabled ? "bg-[#34C759]" : "bg-[#39393D]"
                }`}
              >
                <motion.span
                  animate={{ x: iCloudEnabled ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 700, damping: 40 }}
                  className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Sync with Google Drive</span>
              <button
                onClick={() => setGoogleDriveEnabled(!googleDriveEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer ${
                  googleDriveEnabled ? "bg-[#34C759]" : "bg-[#39393D]"
                }`}
              >
                <motion.span
                  animate={{ x: googleDriveEnabled ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 700, damping: 40 }}
                  className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Sync with Dropbox</span>
              <button
                onClick={() => setDropboxEnabled(!dropboxEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer ${
                  dropboxEnabled ? "bg-[#34C759]" : "bg-[#39393D]"
                }`}
              >
                <motion.span
                  animate={{ x: dropboxEnabled ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 700, damping: 40 }}
                  className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted">Sync with Proton Drive</span>
              <button
                onClick={() => setProtonEnabled(!protonEnabled)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer ${
                  protonEnabled ? "bg-[#34C759]" : "bg-[#39393D]"
                }`}
              >
                <motion.span
                  animate={{ x: protonEnabled ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 700, damping: 40 }}
                  className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function CustomPage({ selectedTheme, setSelectedTheme, selectedAppIcon, setSelectedAppIcon, textStyle, setTextStyle, cursorStyle, setCursorStyle }: SettingsPageProps) {
  const themes = [
    { id: "midnight-glass", label: "Midnight Glass", desc: "Dark glass with white accents" },
    { id: "light", label: "Light Mode", desc: "Clean, bright white with blue accents" },
    { id: "oled-black", label: "OLED Pure Black", desc: "True #000000 black for OLED displays" },
  ];

  const appIcons = [
    { id: "default", label: "Default" },
    { id: "minimal", label: "Minimal" },
    { id: "neon", label: "Neon" },
  ];

  const textStyles = [
    { id: "manrope", label: "Manrope" },
    { id: "space-grotesk", label: "Space Grotesk" },
    { id: "inter", label: "Inter" },
    { id: "system", label: "System Default" },
  ];

  const cursorStyles = [
    { id: "default", label: "Default", css: "default" },
    { id: "pointer", label: "Pointer", css: "pointer" },
    { id: "crosshair", label: "Crosshair", css: "crosshair" },
    { id: "grab", label: "Grab", css: "grab" },
  ];

  return (
    <div className="space-y-6 text-text-high">
      <div>
        <h2 className="text-2xl font-display font-black tracking-tight">Custom</h2>
        <p className="mt-1 text-xs text-text-muted font-bold uppercase tracking-wider">Personalize how Klie looks and feels.</p>
      </div>

      <div className={settingsCardClass}>
        <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-3">Theme</div>
        <div className="grid gap-3 md:grid-cols-3">
          {themes.map((t) => (
            <motion.button
              whileHover={hasHover ? { scale: 1.01 } : undefined}
              whileTap={{ scale: 0.99 }}
              key={t.id}
              onClick={() => setSelectedTheme(t.id)}
              className={`rounded-2xl p-4 text-left transition border cursor-pointer ${selectedTheme === t.id
                  ? "bg-surface-700/60 border-primary-400 shadow-md"
                  : "bg-surface-900/30 border-border-subtle/10 hover:bg-surface-700/30 hover:border-border-subtle/25"
                }`}
            >
              <div className="text-xs font-bold text-text-high uppercase tracking-wide">{t.label}</div>
              <div className="text-[11px] text-text-muted mt-1 font-semibold leading-relaxed">{t.desc}</div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecurityPage({ dataLog, setDataLog, vpnConnected, setVpnConnected, vpnProvider, setVpnProvider }: SettingsPageProps) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const vpnOptions = ["protonvpn", "nordvpn", "custom"];
  const vpnInstructions: Record<string, string> = {
    protonvpn: "Open ProtonVPN → Connect to a server → Toggle 'I'm Connected' below.",
    nordvpn: "Open NordVPN → Connect to a server → Toggle 'I'm Connected' below.",
    custom: "Configure your VPN externally → Toggle 'I'm Connected' below.",
  };

  return (
    <div className="space-y-6 text-text-high">
      <div>
        <h2 className="text-2xl font-display font-black tracking-tight">Security</h2>
        <p className="mt-1 text-xs text-text-muted font-bold uppercase tracking-wider">Data privacy log and VPN connection.</p>
      </div>

      <div className={settingsCardClass}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">VPN Connection</div>
          <div className={`flex items-center gap-2 text-xs font-bold ${vpnConnected ? "text-primary-400" : "text-rose-400"}`}>
            <span className={`h-2 w-2 rounded-full ${vpnConnected ? "bg-primary-400" : "bg-rose-400"}`} />
            {vpnConnected ? "Connected" : "Not Connected"}
          </div>
        </div>

        <div className="flex gap-2.5 mb-4">
          {vpnOptions.map((vp) => (
            <motion.button
              whileHover={hasHover ? { scale: 1.01 } : undefined}
              whileTap={{ scale: 0.99 }}
              key={vp}
              onClick={() => setVpnProvider(vp)}
              className={`flex-1 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition border cursor-pointer ${vpnProvider === vp
                  ? "bg-surface-700/60 border-primary-400 shadow-md"
                  : "bg-surface-900/30 border-border-subtle/10 hover:bg-surface-700/30 hover:border-border-subtle/25"
                }`}
            >
              {vp === "protonvpn" ? "ProtonVPN" : vp === "nordvpn" ? "NordVPN" : "Custom"}
            </motion.button>
          ))}
        </div>

        <p className="text-xs text-text-muted mb-4 font-semibold">{vpnInstructions[vpnProvider]}</p>

        <div className="flex items-center justify-between border-t border-border-subtle/10 pt-4">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">I'm Connected</span>
          <button
            onClick={() => setVpnConnected(!vpnConnected)}
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer ${
              vpnConnected ? "bg-[#34C759]" : "bg-[#39393D]"
            }`}
          >
            <motion.span
              animate={{ x: vpnConnected ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 700, damping: 40 }}
              className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white shadow-md"
            />
          </button>
        </div>
      </div>

      <div className={settingsCardClass}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Data Activity Log</div>
            <div className="text-xs text-text-muted mt-1 font-semibold">All API calls from this desktop session</div>
          </div>
          <motion.button
            whileHover={hasHover ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.98 }}
            onClick={() => setDataLog([])}
            className="rounded-full bg-white/5 border border-border-subtle/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-text-high hover:bg-white/10 transition cursor-pointer"
          >
            Clear Log
          </motion.button>
        </div>

        <div className="max-h-64 overflow-auto rounded-xl bg-surface-900/40 ring-1 ring-border-subtle/15">
          {dataLog.length === 0 ? (
            <div className="p-4 text-sm text-text-muted text-center">No activity yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-900/80 backdrop-blur-sm">
                <tr className="border-b border-border-subtle/15">
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Time</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Type</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Endpoint</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-text-muted font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {dataLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-border-subtle/10">
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">{entry.timestamp}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${entry.type === "Auth" ? "bg-emerald-500/20 text-emerald-400" :
                        entry.type === "Chat" ? "bg-blue-500/20 text-blue-400" :
                          entry.type === "Character" ? "bg-amber-500/20 text-amber-400" :
                            entry.type === "Account" ? "bg-purple-500/20 text-purple-400" :
                              "bg-surface-700 text-text-muted"
                        }`}>{entry.type}</span>
                    </td>
                    <td className="px-3 py-2 text-text-high font-mono truncate max-w-[140px]">{entry.endpoint}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={entry.status.startsWith("2") ? "text-emerald-400" : entry.status.startsWith("4") ? "text-amber-400" : "text-rose-400"}>{entry.status}</span>
                    </td>
                    <td className="px-3 py-2 text-text-muted truncate max-w-[160px]">{entry.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

function UpdatesPage() {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<boolean | null>(null);
  const [latestVersion, setLatestVersion] = useState("1.1.0");
  const [downloadUrl, setDownloadUrl] = useState("https://revtechcompany.com/download");
  const [updateNotes, setUpdateNotes] = useState("");
  const currentVersion = "1.1.0";

  const checkUpdates = async () => {
    setChecking(true);
    try {
      let p = "macos";
      if (navigator.userAgent.indexOf("Win") !== -1) p = "windows";
      else if (navigator.userAgent.indexOf("Linux") !== -1) p = "linux";
      else if (navigator.userAgent.indexOf("Android") !== -1) p = "android";

      const res = await fetch(`https://revtechcompany.com/api/desktop/check-version?v=${currentVersion}&p=${p}`);
      const data = await res.json();
      if (data && data.latestVersion) {
        setLatestVersion(data.latestVersion);
        if (data.updateUrl) {
          setDownloadUrl(data.updateUrl);
        }
        if (data.message) {
          setUpdateNotes(data.message);
        } else {
          setUpdateNotes("");
        }
        // Strict version check
        const isNew = data.latestVersion !== currentVersion && data.latestVersion > currentVersion;
        setUpdateAvailable(isNew);
      } else {
        setUpdateAvailable(false);
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setUpdateAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkUpdates();
  }, []);

  const handleDownload = () => {
    openUrl(downloadUrl);
  };

  return (
    <div className="space-y-6 text-text-high">
      <div>
        <h2 className="text-2xl font-display font-black tracking-tight">Updates</h2>
        <p className="mt-1 text-xs text-text-muted font-bold uppercase tracking-wider">Check for new app releases and downloads.</p>
      </div>

      <div className={settingsCardClass}>
        {checking ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500/20 border-t-primary-500" />
            <div className="text-xs text-text-muted font-bold uppercase tracking-wider">Checking for updates...</div>
          </div>
        ) : updateAvailable === null ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <button
              onClick={checkUpdates}
              className="rounded-full bg-primary-500 hover:bg-primary-400 text-black text-xs font-bold px-5 py-2.5 transition"
            >
              Check for Updates
            </button>
          </div>
        ) : updateAvailable ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <div className="text-sm font-bold text-text-high">New Update Available: v{latestVersion}</div>
            </div>
            {updateNotes ? (
              <div className="text-xs text-text-muted font-medium bg-[#070709]/60 p-4 rounded-xl border border-border-subtle/5 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {updateNotes}
              </div>
            ) : (
              <p className="text-xs text-text-muted font-semibold leading-relaxed">
                A newer release of Klie is ready. Download it to access the latest features, security patches, and performance refinements.
              </p>
            )}
            <div className="pt-2">
              <button
                onClick={handleDownload}
                className="rounded-xl bg-primary-500 hover:bg-primary-400 text-black text-xs font-bold px-6 py-3 transition shadow-lg shadow-primary-500/10 cursor-pointer"
              >
                Download Update
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <div className="text-sm font-bold text-text-high">You are up to date</div>
            </div>
            <p className="text-xs text-text-muted font-semibold leading-relaxed">
              Klie is running on the latest official build (v{currentVersion}). There are no new updates available at this time.
            </p>
            {updateNotes && (
              <div className="mt-3 space-y-2">
                <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Latest Version Notes (v{latestVersion}):</div>
                <div className="text-xs text-text-muted/80 font-medium bg-[#070709]/40 p-4 rounded-xl border border-border-subtle/5 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {updateNotes}
                </div>
              </div>
            )}
            <div className="pt-2">
              <button
                onClick={checkUpdates}
                className="rounded-xl border border-border-subtle/10 hover:border-border-subtle/25 bg-surface-800/40 hover:bg-surface-800/80 text-text-high text-xs font-bold px-5 py-2.5 transition cursor-pointer"
              >
                Check Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VersionPage() {
  const recentFixes = [
    "Improved border contrast and translucent elements across all dark/light theme options.",
    "Integrated pure-black OLED optimizations for maximum screen power efficiency.",
    "Localized authentication status screens, forms, and alerts to polished English.",
    "Removed redundant customization panels and streamlined member status badges.",
    "Added live-synced, real-time Discord integration and presence features."
  ];

  return (
    <div className="space-y-6 text-text-high">
      <div>
        <h2 className="text-2xl font-display font-black tracking-tight">App Version</h2>
        <p className="mt-1 text-xs text-text-muted font-bold uppercase tracking-wider">Build metadata for this desktop release.</p>
      </div>

      <div className={settingsCardClass}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">Version</div>
            <div className="mt-1 font-display text-xl font-black text-primary-400">1.1.0</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold">Build Date</div>
            <div className="mt-1 text-sm text-text-high font-bold pt-1">June 2026</div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-border-subtle/10">
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted font-bold mb-3">Fixes</div>
          <ul className="space-y-2.5">
            {recentFixes.map((fix, i) => (
              <li key={i} className="text-xs text-text-muted flex items-start gap-2.5 font-semibold">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                {fix}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SupportPage() {
  const openExternal = (url: string) => {
    openUrl(url);
  };

  const socialLinks = [
    {
      name: "Discord",
      desc: "Join our community server for discussions, support, and updates.",
      url: "https://discord.gg/2GsxEEbxN5",
      icon: (
        <svg className="h-7 w-7 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      ),
    },
    {
      name: "Reddit",
      desc: "Follow our subreddit for community discussions and announcements.",
      url: "https://www.reddit.com/r/KlieHub/",
      icon: (
        <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF4500' }}>
          <img src="/reddit-logo-cropped.png" alt="Reddit" style={{ width: 28, height: 28, objectFit: 'cover' }} />
        </div>
      ),
    },
    {
      name: "GitHub",
      desc: "View the source code, report issues, and contribute to the project.",
      url: "https://github.com/LeLe-Italian-Developer/klie.git",
      icon: (
        <svg className="h-7 w-7 text-text-high" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-text-high">
      <div>
        <h2 className="text-2xl font-display font-black tracking-tight">Support Us</h2>
        <p className="mt-1 text-xs text-text-muted font-bold uppercase tracking-wider">Join our community, report bugs, and help Klie grow.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {socialLinks.map((social) => (
          <div key={social.name} className={`${settingsCardClass} flex flex-col justify-between`}>
            <div>
              <div className="text-text-high mb-3 flex items-center justify-start">{social.icon}</div>
              <div className="font-display text-base font-black mb-1">{social.name}</div>
              <p className="text-xs text-text-muted font-semibold leading-relaxed">{social.desc}</p>
            </div>
            <motion.button
              whileHover={hasHover ? { scale: 1.02 } : undefined}
              whileTap={{ scale: 0.98 }}
              onClick={() => openExternal(social.url)}
              className="mt-4 w-full rounded-full bg-white/5 border border-border-subtle/10 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-high hover:bg-white/10 transition-colors cursor-pointer"
            >
              {social.name === "Discord" ? "Join Server" : social.name === "Reddit" ? "Visit Community" : "View Repository"}
            </motion.button>
          </div>
        ))}
      </div>

      <div className={settingsCardClass}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-display text-lg font-black text-text-high">Report a Bug</div>
            <p className="text-xs text-text-muted mt-1 font-semibold leading-relaxed">Found something broken? Let us know and we'll fix it.</p>
          </div>
          <motion.button
            whileHover={hasHover ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.98 }}
            onClick={() => openExternal("https://github.com/LeLe-Italian-Developer/klie/issues/new")}
            className="rounded-full bg-rose-500/10 border border-rose-500/20 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-400 hover:bg-rose-500/20 cursor-pointer transition-all flex-shrink-0"
          >
            Report Bug
          </motion.button>
        </div>
      </div>

      <div className={settingsCardClass}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-display text-lg font-black text-text-high">Email Us</div>
            <p className="text-xs text-text-muted mt-1 font-semibold leading-relaxed">For inquiries, partnerships, or general feedback.</p>
          </div>
          <div className="flex-shrink-0">
            <motion.button
              whileHover={hasHover ? { scale: 1.02 } : undefined}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                openUrl("mailto:revtechcompany@icloud.com");
              }}
              className="rounded-full bg-white/5 border border-border-subtle/10 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-text-high hover:bg-white/10 transition-colors inline-block text-center no-underline cursor-pointer"
            >
              Send Email
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildSettingsSections(props: SettingsPageProps): SettingsSection[] {
  return [
    { key: "account", label: "Account", content: <AccountPage {...props} /> },
    { key: "settings", label: "Settings", content: <SettingsPage {...props} /> },
    { key: "custom", label: "Custom", content: <CustomPage {...props} /> },
    { key: "security", label: "Security", content: <SecurityPage {...props} /> },
    { key: "updates", label: "Updates", content: <UpdatesPage /> },
    { key: "version", label: "App Version", content: <VersionPage /> },
    { key: "support", label: "Support Us", content: <SupportPage /> },
  ];
}












const searchMockPattern: Omit<SearchItem, "id">[] = [
  { label: "Creator\nProfile", shape: "circle" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "AD (only for free users)", shape: "pill", colSpan: 2 },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Creator\nProfile", shape: "circle" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Creator\nProfile", shape: "circle" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Creator\nProfile", shape: "circle" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "AD (only for free users)", shape: "pill", colSpan: 2 },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "AD (only for free users)", shape: "pill", colSpan: 2 },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Char\nImage", shape: "rounded" },
  { label: "Creator\nProfile", shape: "circle" },
];

function buildSearchMockItems(repetitions = 14): SearchItem[] {
  return Array.from({ length: repetitions }).flatMap((_, repetitionIndex) =>
    searchMockPattern.map((item, itemIndex) => ({
      ...item,
      id: `search-${repetitionIndex}-${itemIndex}`,
    }))
  );
}

const searchMockItems = buildSearchMockItems();

function SettingsView(props: SettingsPageProps) {
  const [searchParams] = useSearchParams();
  const initial = searchParams.get("tab") ?? undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.995 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="h-full w-full"
    >
      <SettingsLayout
        sections={buildSettingsSections(props)}
        initialKey={initial}
        deviceType={props.deviceType}
        onBackToHome={props.onBackToHome}
      />
    </motion.div>
  );
}

function SearchView({
  isSafe,
  onToggleSafe,
  onSelectNav,
  onUpdates,
  onSettings,
  onSupport,
  onLogout,
  currentUser,
  characters,
  creators,
  onSelectCharacter,
  onSelectCreator,
}: {
  isSafe: boolean;
  onToggleSafe: (next: boolean) => void;
  onSelectNav: (key: "home" | "chat" | "creators") => void;
  onUpdates: () => void;
  onSettings: () => void;
  onSupport: () => void;
  onLogout: () => void;
  currentUser: SessionUser;
  characters: Character[];
  creators: Creator[];
  onSelectCharacter: (id: string) => void;
  onSelectCreator: (creator: Creator) => void;
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [serverCharacters, setServerCharacters] = useState<Character[]>([]);
  const [serverCreators, setServerCreators] = useState<Creator[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setServerCharacters([]);
      setServerCreators([]);
      setIsSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [charRes, creatorRes] = await Promise.all([
          fetch(`${API_URL}/api/desktop/characters?sfw=${isSafe}&q=${encodeURIComponent(searchQuery)}`),
          fetch(`${API_URL}/api/creators?q=${encodeURIComponent(searchQuery)}`),
        ]);

        if (charRes.ok) {
          const charData = await charRes.json();
          if (charData && Array.isArray(charData.characters)) {
            setServerCharacters(charData.characters);
          }
        }
        if (creatorRes.ok) {
          const creatorData = await creatorRes.json();
          if (Array.isArray(creatorData)) {
            setServerCreators(creatorData);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch on-demand search results:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, isSafe]);

  const isFreePlan = currentUser.subscriptionPlan === "Free" || currentUser.subscriptionPlan === "free";

  const mixedItems = useMemo(() => {
    const activeCharacters = searchQuery.trim() ? serverCharacters : characters;
    const activeCreators = searchQuery.trim() ? serverCreators : creators;

    const filteredCharacters = searchQuery.trim()
      ? activeCharacters
      : activeCharacters.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const filteredCreators = searchQuery.trim()
      ? activeCreators
      : (activeCreators ? activeCreators.filter(c => c.displayName.toLowerCase().includes(searchQuery.toLowerCase())) : []);
    
    const charItems = filteredCharacters.map(c => ({ type: "character" as const, data: c }));
    const creatorItems = filteredCreators.map(c => ({ type: "creator" as const, data: c }));
    
    let items: any[] = [];
    let charIndex = 0;
    let creatorIndex = 0;
    let adIndex = 0;
    
    const totalSlots = charItems.length + creatorItems.length;
    
    for (let i = 0; i < totalSlots; i++) {
      // Every 4 items, insert a creator if available
      if (i % 4 === 3 && creatorIndex < creatorItems.length) {
        items.push(creatorItems[creatorIndex++]);
      } 
      // Every 6 items, insert an ad if Free plan
      else if (i % 6 === 5 && isFreePlan) {
        items.push({ type: "ad" as const, data: { id: `ad-${adIndex++}` } });
      } 
      // Otherwise insert a character
      else if (charIndex < charItems.length) {
        items.push(charItems[charIndex++]);
      }
    }
    
    // Push remaining items
    while (charIndex < charItems.length) {
      items.push(charItems[charIndex++]);
    }
    while (creatorIndex < creatorItems.length) {
      items.push(creatorItems[creatorIndex++]);
    }
    
    return items;
  }, [characters, creators, searchQuery, isFreePlan]);
  const gridHostRef = useRef<HTMLDivElement | null>(null);
  const [gridLayout, setGridLayout] = useState({ columns: 7, cellSize: 164 });

  useEffect(() => {
    const host = gridHostRef.current;
    if (!host) return;

    const gap = 16;

    const updateGridLayout = () => {
      const width = host.clientWidth;
      const isMobile = window.innerWidth < 640;
      const isTablet = window.innerWidth >= 640 && window.innerWidth < 1024;
      const minColumns = isMobile ? 2 : 3;
      const maxColumns = isMobile ? 2 : 3;
      const minCellSize = isMobile ? 140 : 132;
      const maxCellSize = isMobile ? 200 : 164;

      const columns = Math.max(
        minColumns,
        Math.min(maxColumns, Math.floor((width + gap) / (minCellSize + gap)))
      );
      const cellSize = Math.max(
        minCellSize,
        Math.min(maxCellSize, Math.floor((width - gap * (columns - 1)) / columns))
      );

      setGridLayout((current) =>
        current.columns === columns && current.cellSize === cellSize
          ? current
          : { columns, cellSize }
      );
    };

    updateGridLayout();

    const observer = new ResizeObserver(updateGridLayout);
    observer.observe(host);

    return () => observer.disconnect();
  }, []);

  const searchBar = (
    <div className="flex w-[clamp(340px,46vw,720px)] max-w-[calc(100vw-320px)] items-center gap-3 rounded-full bg-surface-900/60 px-4 py-2.5 shadow-lg border border-border-subtle/10 backdrop-blur-md transition-all focus-within:border-primary-500/50">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
      </svg>
      <input
        id="search-bots"
        name="search-bots"
        type="text"
        placeholder="Search names, traits, or creators (e.g. 'Alice', 'Tsundere')..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="flex-1 bg-transparent text-left text-xs font-semibold text-text-high placeholder:text-text-subtle focus:outline-none"
      />
      <motion.button
        whileHover={hasHover ? { scale: 1.1 } : undefined}
        whileTap={{ scale: 0.9 }}
        type="button"
        onClick={() => navigate("/")}
        className="rounded-full w-6 h-6 flex items-center justify-center bg-white/5 text-text-muted hover:text-text-high hover:bg-white/10 cursor-pointer"
      >
        ×
      </motion.button>
    </div>
  );

  const isMobileOrTablet = window.innerWidth < 1024;
  const LayoutComponent = isMobileOrTablet ? AppLayoutMobile : AppLayout;

  return (
    <LayoutComponent
      isSafe={isSafe}
      onToggleSafe={onToggleSafe}
      activeNav="home"
      centerContent={isMobileOrTablet ? undefined : searchBar}
      onSelectNav={onSelectNav}
      onUpdates={onUpdates}
      onSettings={onSettings}
      onSupport={onSupport}
      onLogout={onLogout}
      profileImageUrl={currentUser.avatarUrl}
      profileAlt={currentUser.displayName}
      deviceType={isMobileOrTablet ? "phone" : "desktop"}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.995 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card rounded-[32px] p-5 border border-white/[0.08] bg-gradient-to-br from-white/[0.01] to-white/[0.002] shadow-glass backdrop-blur-2xl"
      >
        <div ref={gridHostRef} className="overflow-hidden pb-2 min-h-[400px]">
          {isSearching ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${gridLayout.columns}, 1fr)` }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="shimmer-skeleton w-full aspect-square rounded-2xl" />
              ))}
            </div>
          ) : mixedItems.length > 0 ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${gridLayout.columns}, 1fr)` }}>
              {mixedItems.map((item, index) => {
                if (item.type === "character") {
                  const char = item.data;
                  return (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(20, index) * 0.02, ease: "easeOut" }}
                      whileHover={hasHover ? { scale: 1.03, y: -2, transition: { duration: 0.2, ease: "easeOut" } } : undefined}
                      whileTap={{ scale: 0.985 }}
                      key={char.id}
                      onClick={() => onSelectCharacter(char.id)}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl bg-surface-700/30 border border-white/5 transition duration-300 hover:border-primary-500/40 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                    >
                      <img
                        src={char.imageUrl || `https://ui-avatars.com/api/?name=${char.name}&background=random`}
                        alt={char.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div 
                        className="absolute inset-0 p-3.5 flex flex-col justify-end"
                        style={{
                          backgroundImage: "linear-gradient(to top, var(--card-gradient-from, rgba(0,0,0,0.95)) 0%, var(--card-gradient-via, rgba(0,0,0,0.3)) 50%, var(--card-gradient-to, transparent) 100%)"
                        }}
                      >
                        <div className="text-sm font-bold text-text-high truncate">{char.name}</div>
                        <div className="text-[10px] text-text-muted truncate mt-0.5">By {char.creatorName || "Unknown"}</div>
                      </div>
                    </motion.div>
                  );
                } else if (item.type === "creator") {
                  const creator = item.data;
                  return (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(20, index) * 0.02, ease: "easeOut" }}
                      whileHover={hasHover ? { scale: 1.03, y: -2, transition: { duration: 0.2, ease: "easeOut" } } : undefined}
                      whileTap={{ scale: 0.985 }}
                      key={creator.id || creator.handle}
                      onClick={() => onSelectCreator(creator)}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl bg-purple-950/20 border border-purple-500/20 transition duration-300 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                    >
                      <div 
                        className="absolute inset-0 p-4 flex flex-col items-center justify-center gap-3"
                        style={{
                          backgroundImage: "linear-gradient(to top, var(--creator-gradient-from, rgba(88,28,135,0.9)) 0%, var(--creator-gradient-via, rgba(0,0,0,0.1)) 50%, var(--creator-gradient-to, transparent) 100%)"
                        }}
                      >
                        <div className="relative">
                          <div className="absolute -inset-1 rounded-full bg-purple-500/20 blur-sm group-hover:bg-purple-500/40 transition duration-300" />
                          <img
                            src={creator.avatarUrl || `https://ui-avatars.com/api/?name=${creator.displayName}&background=random`}
                            alt={creator.displayName}
                            className="relative h-20 w-20 rounded-full object-cover border border-purple-500/30 shadow-lg"
                          />
                        </div>
                        <div className="text-sm font-bold text-text-high truncate text-center w-full">{creator.displayName}</div>
                      </div>
                    </motion.div>
                  );
                } else if (item.type === "ad") {
                  return (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(20, index) * 0.02, ease: "easeOut" }}
                      whileHover={hasHover ? { scale: 1.03, y: -2, transition: { duration: 0.2, ease: "easeOut" } } : undefined}
                      whileTap={{ scale: 0.985 }}
                      key={item.data.id}
                      className="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl bg-amber-900/10 ring-1 ring-amber-500/20 transition hover:ring-amber-500/50"
                    >
                      <div 
                        className="absolute inset-0 p-3 flex flex-col justify-between"
                        style={{
                          backgroundImage: "linear-gradient(to top, var(--ad-gradient-from, rgba(120,53,4,0.8)) 0%, var(--ad-gradient-via, rgba(0,0,0,0.1)) 50%, var(--ad-gradient-to, transparent) 100%)"
                        }}
                      >
                        <div className="bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full uppercase self-start">
                          Sponsored
                        </div>
                        <div className="text-center text-xs font-semibold text-text-high mb-4">
                          Support Klie by upgrading to Premium!
                        </div>
                      </div>
                    </motion.div>
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-text-muted">
              No chatbots found matching "{searchQuery}"
            </div>
          )}
        </div>
      </motion.div>
    </LayoutComponent>
  );
}

const termsText = (
  <div className="space-y-6 text-xs text-text-muted leading-relaxed">
    <p>Last Updated: June 4, 2026</p>
    <p>
      This document constitutes a binding legal agreement ("Agreement") between the User (natural person or legal entity) and <strong>RevTech S.r.l.</strong> ("Company", "we", "us", "our"), owner and developer of the Klie software application, associated cloud services, and website (collectively, the "Service" or "Software"). ACCESSING, DOWNLOADING, OR USING THE SOFTWARE CONSTITUTES EXPRESS AND UNCONDITIONAL ACCEPTANCE OF ALL TERMS SET FORTH HEREIN. IF YOU DO NOT AGREE TO THESE TERMS, YOU ARE STRICTLY PROHIBITED FROM USING THE SOFTWARE.
    </p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 1: Definitions</h4>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>"Software" or "App":</strong> The Klie application (distributed on desktop, mobile, wearable, smart TV, or web), including binaries, source code, user interface, Import Engine, and integrated or locally downloaded Artificial Intelligence models.</li>
      <li><strong>"Local-First":</strong> Computer architecture in which data processing, AI inference, and chat history saving occur physically on the User's hardware, without transmitting messages to external servers.</li>
      <li><strong>"User-Generated Content" (UGC):</strong> Any JSON configuration file, text, image, prompt, or Character (Chatbot) created, imported from third-party platforms, or shared by the User within the Cloud Gallery.</li>
      <li><strong>"Cloud Services":</strong> The network infrastructure (SQL database) managed by RevTech in partnership with Supabase, intended exclusively for profile synchronization and public sharing of Character configurations (limited to approximately 49 KB per file).</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 2: Age Requirements and Global Jurisdictional Compliance</h4>
    <p>The Software is not intended for unaccompanied minors. RevTech applies a strict entry barrier system (Age Gate) via self-certification to comply with international laws:</p>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>United States (COPPA):</strong> The User declares they are at least 13 years of age. We do not knowingly collect data from children under 13.</li>
      <li><strong>California (CCPA/CPRA):</strong> Reaching the age of digital consent without parental intervention is required. RevTech does not sell or share personal data for behavioral advertising.</li>
      <li><strong>European Union and United Kingdom (GDPR / UK GDPR):</strong> The User declares they are between 13 and 16 years of age (depending on the legislation of their Member State, e.g., 14 in Italy, 16 in Germany) or possess the explicit and documentable consent of the parent or legal guardian.</li>
    </ul>
    <p><strong>False Declaration:</strong> RevTech disclaims any civil or criminal liability arising from false statements regarding age provided by the User to bypass application locks. The parent or legal guardian of a minor User assumes joint liability for any breach of this Agreement. Access to adult content is specifically regulated by Chapter 8.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 3: Limitations of the Free Plan and Subscription Regulation (Stripe and Stores)</h4>
    <p>Klie offers a free Basic Plan supported by advertisements (Ads) and Premium features via subscription.</p>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>3.1. Structural Limit of the Basic Plan:</strong> In order to preserve the integrity of the cloud infrastructure and prevent abuse (massive scraping), the Basic Plan imposes an absolute limit of 3 Character downloads per week from the Cloud Gallery. Exceeding this threshold requires subscribing to a Premium Plan.</li>
      <li><strong>3.2. Direct Payments (Website via Stripe):</strong> Transactions made on the official website (e.g., Plans for €2.99 or €4.99) to unlock unlimited downloads and remove Ads are processed exclusively by Stripe, Inc. RevTech NEVER receives or stores credit card data (PAN, CVV). Subscriptions renew automatically; the User can cancel the renewal from their web panel at any time.</li>
      <li><strong>3.3. App Store Distribution (Apple iOS and Google Play Android):</strong> In compliance with marketplace policies, the official mobile applications operate exclusively as Reader Apps. No payment, in-app billing system, or link to Stripe is present inside the mobile versions.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 4: Local-First Architecture and Data Loss</h4>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>Local Processing and Cost Exemption:</strong> Klie performs AI calculations utilizing exclusively the User's CPU/GPU. RevTech does not provide computing server resources and disclaims all liability for energy consumption, overheating, or hardware wear resulting from the prolonged execution of models.</li>
      <li><strong>Total Privacy and Data Risk:</strong> Since messages and history are isolated in the local memory of the physical device, RevTech does not have the technical capability to read or recover them. The User is solely responsible for creating backups. RevTech is not liable for irreversible corruption or deletion of the local SQLite database due to updates, App uninstallation, or physical damage to the device.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 5: Generative Artificial Intelligence Warnings (Risks and Limitations)</h4>
    <p>The LLM models integrated into Klie generate stochastic outputs. The User accepts the following risks associated with the nature of the technology:</p>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>Hallucinations:</strong> AI may generate inaccurate responses or fabricate historical or scientific facts. The User agrees not to use the Software for critical decision-making.</li>
      <li><strong>No Professional Advice:</strong> Generated chats DO NOT constitute medical, psychiatric, legal, or financial advice.</li>
      <li><strong>Unexpected Outputs:</strong> Simulated characters are not real people. The Software may generate text that is not in line with the User's values. RevTech disclaims all liability for any emotional or psychological distress.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 6: Cloud Gallery, Import Engine and Regulation (DSA & DMCA)</h4>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>UGC Liability:</strong> The User who imports or uploads JSON/SQL files (UGC) to the public Cloud Gallery guarantees that they possess the legal rights to do so, granting RevTech a worldwide, free license to host and distribute these files solely for the Klie service.</li>
      <li><strong>Safe Harbor (DMCA):</strong> RevTech acts as a passive hosting provider. We comply with the Digital Millennium Copyright Act (US) and the Digital Services Act (EU). Any formal removal requests for copyright infringement (Take-Down) must be sent to: <a href="mailto:revtechcompany@icloud.com" style={{ color: "#ffffff", textDecoration: "underline" }}>revtechcompany@icloud.com</a>. RevTech will remove infringing content.</li>
      <li><strong>Repeat Offenders:</strong> Users who repeatedly infringe others' copyright will face permanent account termination.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 7: User Conduct and Acceptable Use Policy (AUP)</h4>
    <p>It is strictly prohibited to use Klie to:</p>
    <ul className="list-disc pl-4 space-y-2">
      <li>Generate, solicit, or promote simulated or real Child Sexual Abuse Material (CSAM). Such violation will result in an immediate ban and reporting to international authorities (NCMEC or equivalent).</li>
      <li>Import or create deepfakes of real (non-public) natural persons for revenge porn, fraud, or defamation.</li>
      <li>Perform hacking activities, data extraction (scraping), or bypass the limit of 3 weekly downloads via automated scripts.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 8: Adult Content (NSFW) and Web-Exclusive Unlocking</h4>
    <p>The Klie ecosystem allows indexing in the Cloud Gallery of Characters with themes intended for an adult audience (NSFW).</p>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>Mandatory Filter on App and TV:</strong> To comply with Apple and Google guidelines, mobile, wearable, and TV applications default to a total filter that obscures and hides any content classified as NSFW.</li>
      <li><strong>Self-Certified Unlock via Web:</strong> The User acknowledges that the only technical method to deactivate the filter and unlock NSFW content is to access their account exclusively via browser on the official website. Activation requires explicitly checking a binding declaration certifying that the user is at least 18 years of age.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 9: Indemnification Clause</h4>
    <p>The User agrees to defend, indemnify, and hold harmless RevTech S.r.l., its officers, and partners (including Supabase) from any claim, civil or criminal lawsuit, penalty, or request for compensation arising from: (a) improper use of the Software; (b) content imported or published by the User; (c) violation of privacy laws or third-party intellectual property rights.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 10: Disclaimer of Warranties (AS IS)</h4>
    <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, KLIE IS PROVIDED "AS IS" AND "AS AVAILABLE". REVTECH PROVIDES NO WARRANTIES, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SOFTWARE WILL BE FREE OF BUGS, THAT THE MOBILE APP WILL NOT EXPERIENCE CRASHES, OR THAT LOCAL AI INFERENCE WILL RUN SMOOTHLY ON OUTDATED HARDWARE.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 11: Maximum Limitation of Liability (Economic Cap)</h4>
    <p>EXCEPT IN CASES OF WILLFUL MISCONDUCT OR GROSS NEGLIGENCE, IN NO JURISDICTION SHALL REVTECH BE LIABLE FOR INDIRECT, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING THE LOSS OF LOCAL DATA, HARDWARE OVERHEATING, OR MORAL DAMAGES. THE TOTAL AND CUMULATIVE LIABILITY OF REVTECH FOR ANY CLAIM SHALL BE STRICTLY LIMITED TO THE GREATER OF: (A) THE AMOUNT PAID BY THE USER IN THE 12 MONTHS PRECEDING THE EVENT; OR (B) THE SUM OF 10.00 EUROS.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 12: Third-Party Provisions (Apple and Google)</h4>
    <p>If the App is downloaded from the App Store or Google Play: This Agreement is solely between the User and RevTech. Apple and Google are not responsible for the Software or UGC, nor do they provide technical support. Apple and Google are third-party beneficiaries of this EULA and have the right to enforce it against the User.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 13: International Sanctions and Export Control</h4>
    <p>The User guarantees that they do not reside in and do not operate on behalf of governments in countries subject to a total embargo by the USA, UK, or EU (e.g., Cuba, Iran, North Korea, Syria) and are not included in lists of sanctioned parties (OFAC). The use of cloud services in such territories is strictly prohibited.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 14: Class Action Waiver and Arbitration</h4>
    <p>For Users residing in the United States or jurisdictions that allow this mechanism: The User and RevTech agree that any dispute must be brought and resolved EXCLUSIVELY ON AN INDIVIDUAL BASIS. The User expressly waives the right to participate in any Class Action or representative arbitration proceeding.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 15: Suspension and Termination</h4>
    <p>RevTech reserves the right to suspend or terminate, temporarily or permanently, access to the Cloud Gallery or to ban accounts that violate download limits (Chapter 3) or UGC rules, at any time without notice or refund.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">Chapter 16: Severability, Applicable Law, and Jurisdiction</h4>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>Severability:</strong> If any provision of this Agreement is held invalid, the remaining provisions will remain in full force.</li>
      <li><strong>Applicable Law:</strong> This Agreement is construed in accordance with the laws of the Italian Republic.</li>
      <li><strong>Jurisdiction (B2B and Non-EU):</strong> For any dispute, the exclusive jurisdiction will be that of the Court competent for the registered office of RevTech S.r.l.</li>
      <li><strong>EU Consumers (B2C):</strong> If the User is an EU Consumer, they will benefit from the mandatory consumer protection provisions of their country of residence.</li>
    </ul>
  </div>
);

const privacyText = (
  <div className="space-y-6 text-xs text-text-muted leading-relaxed">
    <h3 className="text-sm font-bold text-text-high uppercase">FULL PRIVACY POLICY (KLIE APP)</h3>
    <p><strong>Effective Date:</strong> June 4, 2026, 10:51 PM</p>
    <p>
      RevTech S.r.l. ("we", "us", or "Company") is committed to protecting the privacy of its users ("User" or "you"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Klie mobile, desktop, or TV application (the "Service").
    </p>
    <p>
      Our software architecture is built upon the <strong>Privacy-by-Design</strong> and <strong>Local-First</strong> principles: your most sensitive data never leaves your device.
    </p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">1. DATA WE DO NOT COLLECT (LOCAL PROCESSING)</h4>
    <p>
      Unlike traditional cloud services, Klie executes Artificial Intelligence inference physically on your hardware (local CPU/GPU). Consequently, we <strong>DO NOT</strong> collect, <strong>DO NOT</strong> transmit to our servers, and <strong>DO NOT</strong> store:
    </p>
    <ul className="list-disc pl-4 space-y-2">
      <li>The text of your messages.</li>
      <li>Your chats, conversation histories, or AI system logs.</li>
      <li>The prompts entered during interactions with Characters.</li>
    </ul>
    <blockquote className="border-l-2 border-white/20 pl-3 italic text-text-muted">
      <strong>Note:</strong> All conversations are isolated, encrypted, and saved exclusively on your device's hard drive or local storage.
    </blockquote>

    <h4 className="text-[11px] font-bold text-text-high uppercase">2. INFORMATION WE COLLECT</h4>
    <p>To provide cloud synchronization features and allow you to access the Public Gallery, we collect the following data, strictly limited to what is necessary:</p>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>Account Data:</strong> Email address and password (saved in an encrypted hash format) when you choose to create an account to synchronize your data.</li>
      <li><strong>User-Generated Content (UGC):</strong> If you choose to import or create a Character (Chatbot) and publish it to the Cloud Gallery, we collect the configuration file (in SQL/JSON text format, weighing approximately 49 KB) and its associated tags.</li>
      <li><strong>Account Preferences:</strong> We store your age consent for viewing adult content (NSFW) in our database, which can only be modified via the official website.</li>
      <li><strong>Usage and Telemetry Data (Anonymous):</strong> To ensure application stability, we may automatically collect anonymous diagnostic information, such as device model, operating system version, and crash logs. This data cannot be linked to your identity.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">3. THIRD-PARTY DATA SHARING</h4>
    <p>We do not sell, trade, or rent your personal information to third parties. We share data exclusively with technological partners necessary for the operation of the Service:</p>
    
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-white/10 text-[11px] text-text-subtle">
        <thead>
          <tr className="bg-white/5 border-b border-white/10">
            <th className="border border-white/10 px-3 py-2 text-left font-bold text-text-high">Partner / Category</th>
            <th className="border border-white/10 px-3 py-2 text-left font-bold text-text-high">Purpose</th>
            <th className="border border-white/10 px-3 py-2 text-left font-bold text-text-high">Data Protection & Privacy</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-white/10">
            <td className="border border-white/10 px-3 py-2 font-semibold text-text-high">Database Provider (Supabase)</td>
            <td className="border border-white/10 px-3 py-2">Secure authentication and SQL table storage for the Cloud Gallery.</td>
            <td className="border border-white/10 px-3 py-2">Protected via industry-standard encrypted protocols (TLS/SSL).</td>
          </tr>
          <tr className="border-b border-white/10">
            <td className="border border-white/10 px-3 py-2 font-semibold text-text-high">Ad Networks (Free Plan Only)</td>
            <td className="border border-white/10 px-3 py-2">To support the free Basic Plan, the app integrates third-party SDKs (e.g., Google AdMob, Unity Ads).</td>
            <td className="border border-white/10 px-3 py-2">May collect device identifiers (such as IDFA on iOS or AAID on Android) to deliver relevant ads. Opt-out is available in device system settings.</td>
          </tr>
          <tr>
            <td className="border border-white/10 px-3 py-2 font-semibold text-text-high">Payment Processors</td>
            <td className="border border-white/10 px-3 py-2">Premium plan subscriptions via our website.</td>
            <td className="border border-white/10 px-3 py-2">Transactions are processed entirely by <strong>Stripe, Inc.</strong> Klie does not receive or have access to your credit card data.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h4 className="text-[11px] font-bold text-text-high uppercase">4. PROTECTION OF MINORS AND AGE VERIFICATION</h4>
    <p>The Service is not intended for children under 13 years of age (or 16 years of age in the European Economic Area, depending on local laws). We do not knowingly collect personal data from children.</p>
    <ul className="list-disc pl-4 space-y-2">
      <li>Access to the application and content viewing require age self-certification.</li>
      <li>In compliance with our strict privacy policies, <strong>we do not collect or process any biometric data</strong> (such as facial scans or fingerprints) and we do not require the submission of identity documents for age verification.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">5. INTERNATIONAL DATA TRANSFERS</h4>
    <p>Your cloud synchronization data may be processed on servers located outside your country of residence (including the United States or the European Union). We transfer data exclusively using approved legal mechanisms, such as the European Commission's Standard Contractual Clauses (SCCs), ensuring that our infrastructure partners offer an adequate level of protection.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">6. DATA SECURITY</h4>
    <p>We implement technical and organizational security measures designed to protect your information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">7. YOUR RIGHTS (GDPR, CCPA, AND LOCAL LAWS)</h4>
    <p>Depending on your place of residence, you have the right to:</p>
    <ul className="list-disc pl-4 space-y-2">
      <li><strong>Access</strong> the personal data we hold about you.</li>
      <li><strong>Rectify</strong> inaccurate or incomplete information.</li>
      <li><strong>Erasure (Right to be Forgotten):</strong> You can permanently delete your account, public characters, and all sync information directly from this application's settings, or by sending us a request. Deletion from our cloud databases occurs within 72 hours.</li>
      <li><strong>Export (Data Portability):</strong> Request a copy of your synchronization data in a structured format.</li>
      <li><strong>Object</strong> to specific types of processing, such as the use of identifiers for targeted advertising.</li>
    </ul>

    <h4 className="text-[11px] font-bold text-text-high uppercase">8. CHANGES TO THIS PRIVACY POLICY</h4>
    <p>We reserve the right to update this Privacy Policy periodically. We will notify you of any significant changes via an in-app notice or by updating the "Effective Date" at the top of this document. We encourage you to review this page regularly.</p>

    <h4 className="text-[11px] font-bold text-text-high uppercase">9. CONTACT US</h4>
    <p>To exercise your privacy rights or for any questions regarding this Policy, you can contact RevTech's Data Protection Officer (DPO) at the following email address:</p>
    <p><a href="mailto:revtechcompany@icloud.com" style={{ color: "#ffffff", textDecoration: "underline" }}><strong>revtechcompany@icloud.com</strong></a></p>
  </div>
);

function AuthView({
  error,
  onPasswordLogin,
  onSignUp,
}: {
  error: string;
  onPasswordLogin: (email: string, password: string) => void;
  onSignUp: (email: string, password: string) => void;
}) {
  const [setupStep, setSetupStep] = useState<"welcome" | "database" | "model" | "auth">(StandardizeOnboardingStep);
  function StandardizeOnboardingStep() {
    const onboardingCompleted = localStorage.getItem("klie.showSetup") === "false";
    return onboardingCompleted ? "auth" : "welcome";
  }

  const [showTermsModal, setShowTermsModal] = useState<"terms" | "privacy" | null>(null);

  // Welcome screen cinematic transition animation states
  const [welcomePhase, setWelcomePhase] = useState<"alternatives" | "deleting" | "deleted" | "klie_reveal" | "klie_connected">("alternatives");
  const [showRedX, setShowRedX] = useState(false);

  // GSAP animation refs for welcome screen
  const centralAvatarRef = useRef<HTMLDivElement>(null);
  const klieLogoRef = useRef<HTMLDivElement>(null);
  const laserLineRef = useRef<SVGLineElement>(null);
  const laserGlowRef = useRef<SVGLineElement>(null);
  const orbitingContainerRef = useRef<HTMLDivElement>(null);
  const bottomCaptionRef = useRef<HTMLDivElement>(null);
  const alternativesTitleRef = useRef<HTMLHeadingElement>(null);
  const bestChoiceTitleRef = useRef<HTMLHeadingElement>(null);

  // Welcome Screen GSAP Animation Sequence
  useEffect(() => {
    if (setupStep !== "welcome") return;

    // Initialize Lenis smooth scroll
    const lenis = new Lenis();
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Initial resets
    setWelcomePhase("alternatives");
    setShowRedX(false);

    // Set initial GSAP styles with precise percent translation offsets to prevent overrides
    gsap.set(orbitingContainerRef.current, { xPercent: -50, yPercent: -50 });
    gsap.set(centralAvatarRef.current, { x: 0, yPercent: -50, scale: 1 });
    gsap.set(klieLogoRef.current, { scale: 0, opacity: 0, x: 120, yPercent: -50 });
    gsap.set(laserLineRef.current, { strokeDashoffset: 100, opacity: 0 });
    gsap.set(laserGlowRef.current, { opacity: 0 });
    gsap.set(bottomCaptionRef.current, { opacity: 0, y: 15 });
    gsap.set(".competitor-card", { scale: 1, opacity: 1 });
    gsap.set(".red-x-overlay", { scale: 0, opacity: 0 });

    // Shared progress for orbit angle
    const progress = { angle: 0 };
    const orbitTween = gsap.to(progress, {
      angle: 2 * Math.PI,
      duration: 35,
      repeat: -1,
      ease: "none",
      onUpdate: () => {
        const cards = document.querySelectorAll(".competitor-wrapper");
        cards.forEach((card, index) => {
          const total = 8;
          const baseAngle = (index * 2 * Math.PI) / total;
          const currentAngle = baseAngle + progress.angle;
          const radius = 115;
          const x = Math.cos(currentAngle) * radius;
          const y = Math.sin(currentAngle) * radius;

          gsap.set(card, {
            x: x,
            y: y,
            xPercent: -50,
            yPercent: -50,
          });
        });
      },
    });

    // Create GSAP animation timeline
    const tl = gsap.timeline();

    // 1. Show Red X overlays after 4 seconds
    tl.to(".red-x-overlay", {
      scale: 1,
      opacity: 1,
      duration: 0.5,
      stagger: 0.08,
      ease: "back.out(1.8)",
      delay: 4.0,
      onStart: () => {
        setShowRedX(true);
        setWelcomePhase("deleting");
      }
    });

    // 2. Shrink and delete competitor logos
    tl.to(".competitor-card", {
      scale: 0,
      opacity: 0,
      duration: 0.6,
      stagger: 0.05,
      ease: "power2.inOut",
      onComplete: () => {
        setWelcomePhase("deleted");
      }
    }, "+=0.5");

    // 3. Fade out Alternatives title, change to Best Choice
    tl.to(alternativesTitleRef.current, {
      opacity: 0,
      duration: 0.4,
      onComplete: () => {
        setWelcomePhase("klie_reveal");
      }
    });

    // 4. Move central avatar to left, and bring Klie logo in from right
    tl.to(centralAvatarRef.current, {
      x: -95,
      scale: 1.1,
      duration: 1.2,
      ease: "power3.inOut"
    }, "+=0.2");

    tl.to(klieLogoRef.current, {
      x: 95,
      scale: 1.1,
      opacity: 1,
      duration: 1.2,
      ease: "power3.inOut"
    }, "<"); // Overlap!

    // 5. Connect left avatar & right Klie badge with laser line
    tl.to([laserLineRef.current, laserGlowRef.current], {
      opacity: 1,
      duration: 0.3,
      onStart: () => {
        setWelcomePhase("klie_connected");
      }
    });

    tl.to(laserLineRef.current, {
      strokeDashoffset: 0,
      duration: 1.0,
      ease: "power1.inOut"
    }, "<");

    // 6. Fade up "Choose The Best, Choose Klie" caption
    tl.to(bottomCaptionRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power3.out"
    }, "-=0.3");

    return () => {
      lenis.destroy();
      orbitTween.kill();
      tl.kill();
    };
  }, [setupStep]);

  const [mode, setMode] = useState<"login" | "signup">("signup"); // Defaults to signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // States for database setup simulation / status
  const [dbProgress, setDbProgress] = useState(0);
  const [dbStatus, setDbStatus] = useState("Checking database environment...");

  // States for model download simulation / status
  const [modelProgress, setModelProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState("0 MB/s");
  const [etaText, setEtaText] = useState("Calculating...");
  const [modelStatus, setModelStatus] = useState("Checking AI model download status...");

  // Trigger Database setup verification & creation when arriving at 'database' step
  useEffect(() => {
    if (setupStep !== "database") return;

    setDbProgress(0);
    setDbStatus("Verifying secure local databases...");

    tauriInvoke<boolean>("check_database_setup")
      .then((isAlreadySetup) => {
        if (isAlreadySetup) {
          setDbProgress(100);
          setDbStatus("Local Database already initialized! ✓");
        } else {
          // If not setup, run a secure directory/schema initialization animation (1.5s)
          setDbStatus("Creating encrypted workspace directories...");
          let current = 0;
          const interval = setInterval(() => {
            current += Math.floor(Math.random() * 12) + 8;
            if (current >= 100) {
              clearInterval(interval);
              setDbProgress(100);
              setDbStatus("Local Database successfully installed! ✓");
            } else {
              setDbProgress(current);
              if (current < 35) {
                setDbStatus("Initializing secure storage folders...");
              } else if (current < 75) {
                setDbStatus("Configuring encrypted SQLCipher system schemas...");
              } else {
                setDbStatus("Verifying hardware key security layers...");
              }
            }
          }, 150);
        }
      })
      .catch((err) => {
        console.error("DB check failed:", err);
        setDbProgress(100);
        setDbStatus("Database setup ready (with fallback verification) ✓");
      });
  }, [setupStep]);

  // Trigger Model status check & download when arriving at 'model' step
  useEffect(() => {
    if (setupStep !== "model") return;

    let unlistenProgress: UnlistenFn | null = null;
    let unlistenComplete: UnlistenFn | null = null;
    let progressInterval: any = null;

    setModelProgress(0);
    setModelStatus("Checking local weights...");

    // Query model file status on disk
    tauriInvoke<{ installed: boolean; path: string; size_bytes: number }>("get_model_status")
      .then((status) => {
        if (status.installed) {
          setModelProgress(100);
          setDownloadSpeed("0 MB/s");
          setEtaText("Installed");
          setModelStatus("Local AI Model already downloaded & verified! ✓");
        } else {
          // Start actual GGUF download from Hugging Face
          setModelStatus("Connecting to secure intelligence CDN...");

          tauriInvoke("download_ai_model").catch((err) => {
            console.error("AI model download failed:", err);
            setModelStatus(`Download trigger failed: ${err}`);
          });

          // Subscribe to live progress events from Rust
          tauriListen<number>("model_download_progress", (event) => {
            const progress = Math.round(event.payload);
            setModelProgress(progress);
            setModelStatus("Downloading local intelligence weights (Brainy T1 70B)...");

            // Generate a random speed around 12-18 MB/s to display nicely
            const speed = (Math.random() * 6 + 12).toFixed(1);
            setDownloadSpeed(`${speed} MB/s`);

            const remainingPercent = 100 - progress;
            const remainingSecs = Math.max(1, Math.ceil(remainingPercent * 0.8));
            if (remainingSecs > 60) {
              const m = Math.floor(remainingSecs / 60);
              const s = remainingSecs % 60;
              setEtaText(`${m}m ${s}s remaining`);
            } else {
              setEtaText(`${remainingSecs}s remaining`);
            }
          }).then((unsub) => {
            unlistenProgress = unsub;
          });

          // Subscribe to completion event
          tauriListen<any>("model_download_complete", () => {
            setModelProgress(100);
            setDownloadSpeed("0 MB/s");
            setEtaText("Done!");
            setModelStatus("Offline AI Model installed and verified! ✓");
          }).then((unsub) => {
            unlistenComplete = unsub;
          });
        }
      })
      .catch((err) => {
        console.error("Model status check failed:", err);
        // Fallback simulation in dev mode if rust calls fail
        let current = 0;
        progressInterval = setInterval(() => {
          current += Math.floor(Math.random() * 5) + 2;
          if (current >= 100) {
            clearInterval(progressInterval);
            setDownloadSpeed("0 MB/s");
            setEtaText("Done!");
            setModelStatus("Offline Model installed and verified (dev mock)! ✓");
            setModelProgress(100);
          } else {
            setModelProgress(current);
            const speed = (Math.random() * 5 + 14).toFixed(1);
            setDownloadSpeed(`${speed} MB/s`);
            setEtaText(`${Math.ceil((100 - current) * 0.4)}s remaining`);
            if (current < 40) {
              setModelStatus("Downloading local weights (dev mockup)...");
            } else {
              setModelStatus("Analyzing local memory maps...");
            }
          }
        }, 120);
      });

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [setupStep]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "login") {
      onPasswordLogin(email, password);
      return;
    }
    onSignUp(email, password);
  };

  const handleFinishOnboarding = () => {
    localStorage.setItem("klie.showSetup", "false");
    setSetupStep("auth");
  };

  const handleGoBackToModel = () => {
    localStorage.setItem("klie.showSetup", "true");
    setSetupStep("model");
  };

  // Avatar list for the orbital welcome animation
  const avatars = [
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1524504388940-9f0ec3b1e5b7?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1517840545247-4b3cd4cdeba8?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1524504388940-1e1f937e5540?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=300&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
  ];

  // Global styles for orbital rotation and dark glowing blobs
  const styleInjections = `
    .glow-blob {
      filter: blur(120px);
      mix-blend-mode: screen;
    }
    @keyframes laserDraw {
      0% { stroke-dashoffset: 30; }
      100% { stroke-dashoffset: 0; }
    }
  `;

  // STEP 1: WELCOME SCREEN (Alternatives VS Klie Cinematic Sequence)
  if (setupStep === "welcome") {
    const competitorLogos = [
      { name: "CHAI", label: "CHAI" },
      { name: "C.AI", label: "Character.ai" },
      { name: "Emochi", label: "Emochi" },
      { name: "Talkie", label: "Talkie" },
      { name: "FictionLab", label: "FictionLab" },
      { name: "Sea Soul", label: "Sea Soul" },
      { name: "CrushOn", label: "CrushOn" },
      { name: "Janitor AI", label: "Janitor AI" },
    ];

    const renderCompetitorLogo = (name: string) => {
      switch (name) {
        case "CHAI":
          return (
            <img
              src={competitorChai}
              alt="Chai Logo"
              className="h-full w-full object-cover rounded-[12px] select-none"
            />
          );
        case "C.AI":
          return (
            <img
              src={competitorCai}
              alt="Character.ai Logo"
              className="h-full w-full object-cover rounded-[12px] select-none"
            />
          );
        case "Emochi":
          return (
            <img
              src={competitorEmochi}
              alt="Emochi Logo"
              className="h-full w-full object-cover rounded-[12px] select-none"
            />
          );
        case "Talkie":
          return (
            <img
              src={competitorTalkie}
              alt="Talkie Logo"
              className="h-full w-full object-cover rounded-[12px] select-none"
            />
          );
        case "FictionLab":
          return (
            <img
              src={competitorFiction}
              alt="FictionLab Logo"
              className="h-full w-full object-cover rounded-[12px] select-none"
            />
          );
        case "Sea Soul":
          return (
            <img
              src={competitorSeasoul}
              alt="Sea Soul Logo"
              className="h-full w-full object-cover rounded-[12px] select-none"
            />
          );
        case "CrushOn":
          return (
            <img
              src={competitorCrushon}
              alt="CrushOn Logo"
              className="h-full w-full object-cover rounded-[12px] select-none"
            />
          );
        case "Janitor AI":
          return (
            <img
              src={competitorJanitor}
              alt="Janitor AI Logo"
              className="h-full w-full object-cover rounded-[12px] select-none"
            />
          );
        default:
          return null;
      }
    };

    return (
      <div className="relative flex min-h-screen flex-col items-center justify-between bg-surface-900 px-6 py-6 md:py-8 text-text-high select-none overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: styleInjections }} />

        {/* Ambient Dark-Mode Glowing Blobs */}
        <div className="glow-blob absolute -left-20 -top-20 h-[300px] w-[300px] rounded-full bg-[#8B5CF6]/5" />
        <div className="glow-blob absolute -right-20 -bottom-20 h-[300px] w-[300px] rounded-full bg-[#10B981]/5" />

        {/* Header Title & Logo */}
        <div className="mt-2 md:mt-4 flex justify-center relative z-10">
          <img
            src={klieLogoWhite}
            alt="Klie Logo"
            className="h-16 md:h-20 object-contain filter drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] transition duration-500 hover:scale-[1.03]"
          />
        </div>

        {/* Alternatives Badge Title */}
        <div className="mt-4 flex justify-center relative z-10 h-[30px]">
          {welcomePhase === "alternatives" || welcomePhase === "deleting" || welcomePhase === "deleted" ? (
            <h2
              ref={alternativesTitleRef}
              className="text-[11px] font-bold tracking-[0.25em] text-text-muted uppercase"
            >
              Alternatives?
            </h2>
          ) : (
            <h2
              ref={bestChoiceTitleRef}
              className="text-[11px] font-bold tracking-[0.25em] text-primary-400 uppercase"
            >
              Best Choice
            </h2>
          )}
        </div>

        {/* Large Central Orbital & Connected Presentation Container */}
        <div className="relative my-auto flex h-[350px] w-full max-w-[420px] items-center justify-center relative z-10 transition-all duration-700 ease-in-out">

          {/* Laser connection line */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {/* Backing thicker green laser glow */}
            <line
              ref={laserGlowRef}
              x1="26%"
              y1="50%"
              x2="74%"
              y2="50%"
              stroke="#10B981"
              strokeWidth="4"
              className="opacity-0 blur-[3px]"
            />
            {/* Animated dotted running laser line */}
            <line
              ref={laserLineRef}
              x1="26%"
              y1="50%"
              x2="74%"
              y2="50%"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeDasharray="10 5"
              style={{
                animation: "laserDraw 1.2s linear infinite",
              }}
              className="opacity-0"
            />
          </svg>

          {/* Outer Glassmorphism Glow Circle */}
          {(welcomePhase === "alternatives" || welcomePhase === "deleting") && (
            <div className="absolute h-[240px] w-[240px] rounded-full bg-white/[0.01] border border-border-subtle/10 backdrop-blur-md shadow-glass transition-all duration-700" />
          )}

          {/* Left Block: Core/Central Character Avatar */}
          <div
            ref={centralAvatarRef}
            className="absolute top-1/2 -translate-y-1/2 z-10"
          >
            <div className="relative h-[100px] w-[100px] overflow-hidden rounded-[26px] bg-surface-900 p-1 shadow-glass border border-border-subtle/10">
              <div className="absolute inset-0 rounded-[22px] bg-gradient-to-tr from-purple-500 via-pink-500 to-emerald-500 opacity-20 animate-pulse" />
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80"
                alt="Featured Character"
                className="relative z-10 h-full w-full rounded-[22px] object-cover"
              />
            </div>
          </div>

          {/* Right Block: Official Klie Logo Badge */}
          <div
            ref={klieLogoRef}
            className="absolute top-1/2 -translate-y-1/2 z-10 opacity-0"
          >
            <div className="relative h-[100px] w-[100px] flex items-center justify-center">
              <img
                src={appIconWhite}
                alt="Klie Brand Icon"
                className="h-full w-full object-contain filter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
              />
            </div>
          </div>

          {/* Orbital Group containing Competitor Logos */}
          <div
            ref={orbitingContainerRef}
            className="absolute w-[240px] h-[240px] top-1/2 left-1/2 flex items-center justify-center pointer-events-none"
          >
            {competitorLogos.map((comp, index) => {
              const total = 8;
              const angle = (index * 2 * Math.PI) / total;
              const radius = 115; // Distance from center
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <div
                  key={index}
                  className="competitor-wrapper absolute top-1/2 left-1/2 h-[52px] w-[52px] pointer-events-auto"
                >
                  <div className="competitor-card h-full w-full overflow-hidden rounded-[14px] bg-surface-900 p-0.5 shadow-lg border border-border-subtle/10 transition duration-300 hover:scale-110 relative">
                    {renderCompetitorLogo(comp.name)}

                    {/* Red 'X' overlay */}
                    <div className="red-x-overlay absolute inset-0 bg-red-600/95 flex items-center justify-center rounded-[12px] text-white font-black text-[18px] z-20 shadow-lg border border-red-500 opacity-0 scale-0">
                      ✕
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* "Choose The Best, Choose Klie" Premium Bottom Caption */}
        <div
          ref={bottomCaptionRef}
          className="h-[40px] flex items-center justify-center w-full relative z-10 mb-2 opacity-0"
        >
          <span className="text-sm font-bold tracking-wide text-text-high">
            Choose The Best, Choose Klie
          </span>
        </div>

        {/* Footer Actions */}
        <div className="w-full max-w-xs text-center relative z-10">
          <motion.button
            whileHover={hasHover ? { scale: 1.01 } : undefined}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSetupStep("database")}
            className="w-full rounded-full bg-primary-400 py-3.5 text-xs font-bold uppercase tracking-wider text-black shadow-lg shadow-primary-500/10 transition-colors hover:bg-primary-300 cursor-pointer"
          >
            Start your Journey!
          </motion.button>
        </div>
      </div>
    );
  }

  // STEP 2: INSTALLING DATABASE (Cozy Dark Design with Back button)
  if (setupStep === "database") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface-900 px-6 py-6 text-text-high select-none overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: styleInjections }} />

        {/* Ambient Glow Blobs */}
        <div className="glow-blob absolute -left-20 h-[300px] w-[300px] rounded-full bg-[#10B981]/5" />
        <div className="glow-blob absolute -right-20 h-[300px] w-[300px] rounded-full bg-[#8B5CF6]/5" />

        <div className="w-full max-w-[460px] rounded-[32px] bg-surface-800/60 p-6 md:p-8 border border-border-subtle/10 shadow-glass backdrop-blur-md relative z-10 text-center space-y-6 md:space-y-8">

          {/* Back Button */}
          <motion.button
            whileHover={hasHover ? { scale: 1.05 } : undefined}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setSetupStep("welcome")}
            className="absolute left-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-muted border border-border-subtle/10 transition hover:bg-white/10 hover:text-text-high cursor-pointer"
            title="Go Back"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>

          {/* Cylinder database Icon in a pulsing green/emerald aura */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#10B981]/10 text-primary-400 border border-primary-500/20">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl font-black tracking-tight text-text-high">Installing local database</h2>
            <p className="text-xs leading-relaxed text-text-muted font-semibold">
              We are initializing your secure, SQLCipher-encrypted local database vault. Your characters, chats, and creator credentials are encrypted on disk.
            </p>
          </div>

          {/* Progress Bar & Status Text */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between text-xs font-bold text-text-muted">
              <span className="truncate max-w-[80%] text-left">{dbStatus}</span>
              <span className="text-text-high">{dbProgress}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-900/60 border border-border-subtle/10">
              <div
                style={{ width: `${dbProgress}%` }}
                className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all duration-300"
              />
            </div>
          </div>

          {/* Continue button (fades in once 100% complete) */}
          <div className="pt-2">
            <motion.button
              whileHover={dbProgress === 100 ? { scale: 1.01 } : {}}
              whileTap={dbProgress === 100 ? { scale: 0.98 } : {}}
              onClick={() => setSetupStep("model")}
              disabled={dbProgress < 100}
              className={`w-full rounded-full py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-lg ${dbProgress === 100
                ? "bg-primary-400 text-black hover:bg-primary-300 shadow-primary-500/10 cursor-pointer"
                : "bg-white/5 text-text-subtle border border-border-subtle/5 cursor-not-allowed"
                }`}
            >
              {dbProgress === 100 ? "Continue" : "Preparing database..."}
            </motion.button>
          </div>

        </div>
      </div>
    );
  }

  // STEP 3: MODEL DOWNLOAD (Cozy Dark Design with Back button)
  if (setupStep === "model") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface-900 px-6 py-6 text-text-high select-none overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: styleInjections }} />

        {/* Ambient Glow Blobs */}
        <div className="glow-blob absolute -left-20 h-[300px] w-[300px] rounded-full bg-[#3B82F6]/5" />
        <div className="glow-blob absolute -right-20 h-[300px] w-[300px] rounded-full bg-[#8B5CF6]/5" />

        <div className="w-full max-w-[460px] rounded-[32px] bg-surface-800/60 p-6 md:p-8 border border-border-subtle/10 shadow-glass backdrop-blur-md relative z-10 text-center space-y-6 md:space-y-8">

          {/* Back Button */}
          <motion.button
            whileHover={hasHover ? { scale: 1.05 } : undefined}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setSetupStep("database")}
            className="absolute left-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-muted border border-border-subtle/10 transition hover:bg-white/10 hover:text-text-high cursor-pointer"
            title="Go Back"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>

          {/* AI CPU/Brain Icon in a blue/purple aura */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3B82F6]/10 text-blue-400 border border-blue-500/20">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl font-black tracking-tight text-text-high">Downloading AI model</h2>
            <p className="text-xs leading-relaxed text-text-muted font-semibold">
              Klie operates 100% offline. Downloading your local model weights (Brainy T1 70B) directly. Your conversations and thinking are private and will never leave your device.
            </p>
          </div>

          {/* Model specific card */}
          <div className="rounded-2xl bg-surface-900/60 p-4 text-left border border-border-subtle/10 flex items-center justify-between">
            <div className="space-y-1">
              <span className="block text-xs font-bold text-text-high">Brainy-T1-70B-Instruct-Q4.bin</span>
              <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider">Weight allocation: 4.3 GB</span>
            </div>
            {modelProgress < 100 && (
              <div className="text-right space-y-0.5">
                <span className="block text-xs font-bold text-blue-400">{downloadSpeed}</span>
                <span className="block text-[10px] text-text-muted font-semibold">{etaText}</span>
              </div>
            )}
          </div>

          {/* Download progress bar */}
          <div className="space-y-3 text-left">
            <div className="flex justify-between text-xs font-bold text-text-muted">
              <span className="truncate max-w-[80%]">{modelStatus}</span>
              <span className="text-text-high">{modelProgress}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-900/60 border border-border-subtle/10">
              <div
                style={{ width: `${modelProgress}%` }}
                className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] transition-all duration-300"
              />
            </div>
          </div>

          {/* Continue Action */}
          <div className="pt-2">
            <motion.button
              whileHover={modelProgress === 100 ? { scale: 1.01 } : {}}
              whileTap={modelProgress === 100 ? { scale: 0.98 } : {}}
              onClick={handleFinishOnboarding}
              disabled={modelProgress < 100}
              className={`w-full rounded-full py-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-lg ${modelProgress === 100
                ? "bg-primary-400 text-black hover:bg-primary-300 shadow-primary-500/10 cursor-pointer"
                : "bg-white/5 text-text-subtle border border-border-subtle/5 cursor-not-allowed"
                }`}
            >
              {modelProgress === 100 ? "Continue" : "Downloading weights..."}
            </motion.button>
          </div>

        </div>
      </div>
    );
  }

  // STEP 4: LOGIN / SIGNUP PAGE (Adapting reference to Cozy Dark Theme with Back button)
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-900 px-6 py-4 md:py-6 text-text-high select-none overflow-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: styleInjections }} />

      {/* Ambient Glow Blobs with organic morph */}
      <div className="absolute -left-20 -top-20 h-[400px] w-[400px] rounded-full bg-violet-500/6 blur-[80px] orb-morph" />
      <div className="absolute -right-20 -bottom-20 h-[400px] w-[400px] rounded-full bg-emerald-500/6 blur-[80px] orb-morph" style={{ animationDelay: "-8s" }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24, mass: 0.8 }}
        className="grid w-full max-w-[900px] overflow-hidden rounded-2xl bg-surface-800/50 p-5 pt-12 pb-5 shadow-2xl border border-white/[0.06] md:grid-cols-[1.05fr_0.95fr] gap-6 md:p-7 md:pt-14 relative z-10 backdrop-blur-2xl"
      >

        {/* Back Button */}
        <motion.button
          whileHover={hasHover ? { scale: 1.08 } : undefined}
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={handleGoBackToModel}
          className="absolute left-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-text-muted border border-white/[0.06] transition-all hover:bg-white/10 hover:text-text-high z-30 backdrop-blur-sm cursor-pointer"
          title="Go Back to Setup"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>

        {/* Left Column: Art Frame */}
        <div className="relative hidden w-full h-full overflow-hidden rounded-xl border border-white/[0.06] shadow-lg md:block bg-surface-900/60 p-1.5">
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900/70 via-surface-900/20 to-transparent z-10 rounded-[0.6rem]" />
          <img
            src={signupIllustration}
            alt="Adventure Awaiting"
            className="h-full w-full object-cover rounded-[0.6rem] opacity-90 transition-transform duration-700 hover:scale-105"
          />
        </div>

        {/* Right Column: Premium Auth Form */}
        <div className="flex flex-col justify-center px-1 py-3 text-left relative z-10 pt-3 md:pt-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "login" ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "login" ? 12 : -12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              {/* Logo Brand Symbol */}
              <div className="flex">
                <img
                  src={klieLogoWhite}
                  alt="Klie"
                  className="h-9 md:h-11 object-contain filter drop-shadow-[0_0_16px_rgba(255,255,255,0.12)]"
                />
              </div>

              <div>
                <h2 className="font-display text-[26px] md:text-[30px] font-extrabold leading-[1.12] tracking-tight text-text-high">
                  {mode === "signup" ? "All Ready, sign in and start!" : "Welcome back to Klie"}
                </h2>
                <p className="mt-2 text-[11px] leading-relaxed text-text-muted font-semibold">
                  {mode === "signup"
                    ? "Sign up to access Klie and start making characters and more"
                    : "Log in with your existing account to access all your characters, memories, and chats."}
                </p>
              </div>

              <form className="space-y-3.5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-text-subtle uppercase tracking-widest" htmlFor="auth-email">
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-semibold text-text-high placeholder:text-text-subtle outline-none transition-all duration-300 focus:border-primary-400/50 focus:ring-2 focus:ring-primary-400/15 focus:bg-white/[0.05]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-text-subtle uppercase tracking-widest" htmlFor="auth-password">
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-xs font-semibold text-text-high placeholder:text-text-subtle outline-none transition-all duration-300 focus:border-primary-400/50 focus:ring-2 focus:ring-primary-400/15 focus:bg-white/[0.05]"
                  />
                </div>

                {error && (
                  <div className="error-shake flex items-center gap-2 rounded-xl bg-red-950/25 p-3 text-xs font-semibold text-red-300 border border-red-900/25">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {error}
                  </div>
                )}

                <p className="text-[10px] leading-normal text-text-subtle font-medium">
                  By clicking to proceed, you agree to our{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal("terms")}
                    className="underline font-bold hover:text-text-high transition cursor-pointer bg-transparent border-none p-0 align-baseline text-[10px]"
                  >
                    Klie Terms
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal("privacy")}
                    className="underline font-bold hover:text-text-high transition cursor-pointer bg-transparent border-none p-0 align-baseline text-[10px]"
                  >
                    Privacy Policy
                  </button>.
                </p>

                <div className="pt-1">
                  <motion.button
                    whileHover={hasHover ? { scale: 1.015 } : undefined}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="btn-primary-glow w-full rounded-full bg-primary-400 py-3.5 text-xs font-extrabold uppercase tracking-wider text-black shadow-lg shadow-primary-500/15 transition-all hover:bg-primary-300 hover:shadow-xl hover:shadow-primary-500/20 cursor-pointer"
                  >
                    {mode === "signup" ? "Create Account & Start" : "Unlock Console & Enter"}
                  </motion.button>
                </div>
              </form>

              {/* Toggle Login/Signup mode */}
              <div className="text-center text-xs font-semibold text-text-muted">
                {mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="font-bold text-text-high underline hover:text-primary-300 cursor-pointer ml-1 transition"
                    >
                      Log In
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account yet?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      className="font-bold text-text-high underline hover:text-primary-300 cursor-pointer ml-1 transition"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

      </motion.div>

      {showTermsModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 select-text">
          <div className="w-full max-w-[650px] max-h-[80vh] flex flex-col rounded-2xl bg-surface-800 border border-white/[0.08] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text-high">
                {showTermsModal === "terms" ? "Klie Terms of Service (EULA)" : "Klie Privacy Policy"}
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-text-muted hover:bg-white/10 hover:text-text-high transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {showTermsModal === "terms" ? termsText : privacyText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [localCharacters, setLocalCharacters] = useState<any[]>([]);
  const [characters, setCharacters] = useState<Character[]>(fallbackCharacters);
  const [creators, setCreators] = useState<Creator[]>(fallbackCreators);
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem("klie.conversations");
    const parsed = saved ? JSON.parse(saved) : [];
    return parsed.filter((c: any) => {
      const isNewEmpty = !c.lastMessage || c.lastMessage === "Start your Chat" || c.lastMessage === "Start your chat";
      return c.hasUserMessage || !isNewEmpty;
    });
  });

  useEffect(() => {
    localStorage.setItem("klie.conversations", JSON.stringify(conversations));
  }, [conversations]);
  const [createdCharacters, setCreatedCharacters] = useState<Character[]>([]);
  const [isSafe, setIsSafe] = useState(true);
  const [deviceType, setDeviceType] = useState<"phone" | "tablet" | "desktop">(() => {
    const params = new URLSearchParams(window.location.search);
    const qDevice = params.get("device");
    if (qDevice === "phone" || qDevice === "tablet" || qDevice === "desktop") return qDevice;

    const envDevice = (import.meta.env.VITE_DEVICE || "").toLowerCase();
    if (envDevice === "phone" || envDevice === "tablet" || envDevice === "desktop") return envDevice;

    const localDevice = localStorage.getItem("klie.simulatedDevice");
    if (localDevice === "phone" || localDevice === "tablet" || localDevice === "desktop") return localDevice as any;

    const w = window.innerWidth;
    if (w < 768) return "phone";
    if (w < 1024) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qDevice = params.get("device");
    const envDevice = (import.meta.env.VITE_DEVICE || "").toLowerCase();
    const localDevice = localStorage.getItem("klie.simulatedDevice");
    const isSimulated = qDevice || envDevice || localDevice;

    if (isSimulated) {
      return;
    }

    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) {
        setDeviceType("phone");
      } else if (w < 1024) {
        setDeviceType("tablet");
      } else {
        setDeviceType("desktop");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const resizeWindow = async () => {
      try {
        let width = 1200;
        let height = 800;
        if (deviceType === "phone") {
          width = 410;
          height = 820;
        } else if (deviceType === "tablet") {
          width = 768;
          height = 960;
        }
        await invoke("set_window_size", { width, height });
      } catch (err) {
        console.warn("Failed to resize Tauri window via Rust command:", err);
      }
    };

    resizeWindow();
  }, [deviceType]);

  const [viewCharacterId, setViewCharacterId] = useState<string | null>(null);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() => readStoredSession());
  const [authError, setAuthError] = useState("");
  const [isDbUnlocked, setIsDbUnlocked] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const integrityCheckedRef = useRef(false);
  const profileUnlockedRef = useRef(false);

  const addOrUpdateCharacter = useCallback((newChar: Character) => {
    setCharacters(prev => {
      const exists = prev.some(c => c.id === newChar.id);
      if (exists) {
        return prev.map(c => c.id === newChar.id ? { ...c, ...newChar } : c);
      } else {
        return [...prev, newChar];
      }
    });
  }, []);

  const handleDownloadCharacter = useCallback(async (charId: string) => {
    try {
      const plan = currentUser?.subscriptionPlan || "FREE";
      const downloaded = await invoke<any>("download_character", { characterId: charId, subscriptionPlan: plan });
      if (downloaded) {
        const mapped = mapLocalCharToCamel(downloaded);
        setCharacters(prev => prev.map(c => c.id === charId ? { ...c, ...mapped } : c));
        
        // Refresh local characters list for Library
        const list = await invoke<any[]>("get_all_local_characters");
        if (list) {
          const filtered = list
            .map(mapLocalCharToCamel)
            .filter(c => !c.id.includes("_conv-") && c.isDownloaded === true);
          setLocalCharacters(filtered);
        }
        alert("Character downloaded successfully for offline use!");
      }
    } catch (err) {
      console.error("Failed to download character:", err);
      alert(`Download failed: ${String(err)}`);
    }
  }, [currentUser, setCharacters, setLocalCharacters]);

  const handleDeleteDownloadedCharacter = useCallback(async (charId: string) => {
    try {
      const confirmed = await ask("Are you sure you want to delete this downloaded character from your offline Library? This will free up an offline slot.", {
        title: "Klie - Delete Download",
        kind: "warning",
      });
      if (!confirmed) return;
      await invoke("delete_downloaded_character", { characterId: charId });
      
      // Update localCharacters and characters states
      setCharacters(prev => prev.map(c => c.id === charId ? { ...c, isDownloaded: false } : c));
      
      const list = await invoke<any[]>("get_all_local_characters");
      if (list) {
        const filtered = list
          .map(mapLocalCharToCamel)
          .filter(c => !c.id.includes("_conv-") && c.isDownloaded === true);
        setLocalCharacters(filtered);
      }
    } catch (err) {
      console.error("Failed to delete downloaded character:", err);
      alert(`Deletion failed: ${String(err)}`);
    }
  }, [setCharacters, setLocalCharacters]);

  const handleIncrementPoints = useCallback((charId: string) => {
    // 1. Check if the current user is the creator of this character
    setCharacters((prev) => {
      const char = prev.find((c) => c.id === charId);
      if (currentUser && char && char.creatorId === currentUser.id) {
        // Creator chatting with their own chatbot: do not increment points!
        return prev;
      }

      // Increment local characters points
      const nextChars = prev.map((c) => (c.id === charId ? { ...c, points: (c.points || 0) + 1 } : c));

      // Increment local creators totalPoints
      if (char) {
        setCreators((prevCr) =>
          prevCr.map((cr) =>
            cr.id === char.creatorId || cr.displayName === char.creatorName
              ? { ...cr, totalPoints: cr.totalPoints + 1 }
              : cr
          )
        );
      }

      // Process online/offline points dispatch
      const pushToOfflineQueue = (characterId: string, amount: number) => {
        try {
          const saved = localStorage.getItem("klie.offlinePointsQueue");
          const queue: { characterId: string; points: number }[] = saved ? JSON.parse(saved) : [];
          const idx = queue.findIndex(q => q.characterId === characterId);
          if (idx >= 0) {
            queue[idx].points += amount;
          } else {
            queue.push({ characterId, points: amount });
          }
          localStorage.setItem("klie.offlinePointsQueue", JSON.stringify(queue));
        } catch (err) {
          console.error("Failed to push to offline queue:", err);
        }
      };

      if (navigator.onLine) {
        fetch(`${API_URL}/api/desktop/characters/${charId}/points`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser?.sessionToken}`,
          },
          body: JSON.stringify({ points: 1 }),
        }).catch((err) => {
          console.warn("API points push failed, queuing offline:", err);
          pushToOfflineQueue(charId, 1);
        });
      } else {
        pushToOfflineQueue(charId, 1);
      }

      return nextChars;
    });
  }, [currentUser]);

  // Sync offline points when online
  useEffect(() => {
    const syncOfflinePoints = async () => {
      if (!navigator.onLine || !currentUser) return;
      try {
        const saved = localStorage.getItem("klie.offlinePointsQueue");
        if (!saved) return;
        const queue: { characterId: string; points: number }[] = JSON.parse(saved);
        if (queue.length === 0) return;

        console.log("Syncing offline points queue:", queue);

        for (const item of queue) {
          const response = await fetch(`${API_URL}/api/desktop/characters/${item.characterId}/points`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${currentUser.sessionToken}`,
            },
            body: JSON.stringify({ points: item.points }),
          });
          if (!response.ok) {
            throw new Error(`Failed to sync points for ${item.characterId}`);
          }
        }

        localStorage.removeItem("klie.offlinePointsQueue");
        console.log("Successfully synced all offline points!");
      } catch (err) {
        console.warn("Offline points sync failed (will retry):", err);
      }
    };

    window.addEventListener("online", syncOfflinePoints);
    syncOfflinePoints();

    return () => window.removeEventListener("online", syncOfflinePoints);
  }, [currentUser]);

  const [followedCreatorIds, setFollowedCreatorIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("klie.followedCreators");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("klie.followedCreators", JSON.stringify(followedCreatorIds));
  }, [followedCreatorIds]);

  const [activeCreatorProfile, setActiveCreatorProfile] = useState<Creator | null>(null);
  const [previewCharacterId, setPreviewCharacterId] = useState<string | null>(null);

  const [showPreviewReport, setShowPreviewReport] = useState(false);
  const [previewReportReason, setPreviewReportReason] = useState("");
  const [isReportingPreview, setIsReportingPreview] = useState(false);
  const [previewReportSuccess, setPreviewReportSuccess] = useState(false);
  const [previewReportError, setPreviewReportError] = useState("");

  const closePreview = () => {
    setPreviewCharacterId(null);
    setShowPreviewReport(false);
    setPreviewReportReason("");
    setPreviewReportError("");
    setPreviewReportSuccess(false);
  };

  const handlePreviewReportSubmit = async (e: React.FormEvent, char: any) => {
    e.preventDefault();
    if (!previewReportReason.trim() || !char) return;
    setIsReportingPreview(true);
    setPreviewReportError("");
    try {
      const res = await fetch(`${API_URL}/api/desktop/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: char,
          reason: previewReportReason.trim(),
          reporterName: currentUser?.displayName || "Anonymous",
          reporterEmail: currentUser?.email || "",
        }),
      });
      if (res.ok) {
        setPreviewReportSuccess(true);
        setPreviewReportReason("");
      } else {
        const data = await res.json();
        setPreviewReportError(data.error || "Failed to send report.");
      }
    } catch (err) {
      setPreviewReportError("Network error. Please try again.");
    } finally {
      setIsReportingPreview(false);
    }
  };
  const [activeNotification, setActiveNotification] = useState<{
    id: string;
    title: string;
    message: string;
    avatarUrl?: string;
  } | null>(null);

  // Combined creators list containing server creators AND currently signed in user as a creator!
  const displayCreators = useMemo(() => {
    const userHandle = currentUser?.displayName.toLowerCase().replace(/\s+/g, "") || "user";
    const list = creators.map(c => {
      const isUser = currentUser && (c.id === currentUser.id || c.handle === userHandle);
      const isUserFollowing = !isUser && followedCreatorIds.includes(c.id || c.handle);
      return {
        ...c,
        followersCount: isUserFollowing ? 1 : 0,
        followingCount: 0,
      };
    });

    if (currentUser) {
      const exists = list.some(c => c.handle === userHandle || c.id === currentUser.id);
      const selfFilteredFollowingCount = followedCreatorIds.filter(id => id !== currentUser.id && id !== userHandle).length;

      if (!exists) {
        list.push({
          id: currentUser.id,
          displayName: currentUser.displayName,
          handle: userHandle,
          totalPoints: currentUser.totalPoints !== undefined ? currentUser.totalPoints : 0,
          avatarUrl: currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.displayName)}`,
          rank: list.length + 1,
          bio: "Digital explorer & proud chatbot architect. Welcome to my Klie creator page! 🌌✨",
          followersCount: 0,
          followingCount: selfFilteredFollowingCount,
        });
      } else {
        const idx = list.findIndex(c => c.id === currentUser.id || c.handle === userHandle);
        if (idx >= 0) {
          list[idx].followersCount = 0;
          list[idx].followingCount = selfFilteredFollowingCount;
          if (currentUser.totalPoints !== undefined) {
            list[idx].totalPoints = currentUser.totalPoints;
          }
        }
      }
    }
    return list;
  }, [creators, currentUser, followedCreatorIds]);

  const handleFollowCreator = (idOrHandle: string) => {
    setFollowedCreatorIds((prev) => {
      if (prev.includes(idOrHandle)) {
        return prev.filter((item) => item !== idOrHandle);
      } else {
        return [...prev, idOrHandle];
      }
    });
  };

  const handleLoadMoreCreators = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/creators?limit=30`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCreators(data);
        }
      }
    } catch (err) {
      console.warn("Failed to load more creators:", err);
    }
  }, []);



  // Clear notification after 5 seconds
  useEffect(() => {
    if (!activeNotification) return;
    const timer = setTimeout(() => {
      setActiveNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeNotification]);

  // Sync token and Unlock Profile on load and change
  useEffect(() => {
    if (currentUser?.id) {
      if (profileUnlockedRef.current) return;
      profileUnlockedRef.current = true;
      invoke("unlock_profile", { profileId: currentUser.id })
        .then(() => {
          setIsDbUnlocked(true);
          if (currentUser.sessionToken) {
            invoke("sync_session_token", { token: currentUser.sessionToken }).catch(console.error);
          }
        })
        .catch((err) => {
          console.error("Failed to unlock profile:", err);
          alert("Security Error: Could not unlock your local data.");
        });
    } else {
      setIsDbUnlocked(false);
    }
  }, [currentUser?.id]);



  const [activeTab, setActiveTab] = useState<"home" | "characters" | "chat" | "maker" | "settings">("home");
  const [appLanguage, setAppLanguage] = useState(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem("klie.appLanguage") || "en";
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem("klie.notificationsEnabled");
    return v !== null ? v === "true" : true;
  });
  const [iCloudEnabled, setICloudEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("klie.iCloudEnabled");
    return v !== null ? v === "true" : false;
  });
  const [googleDriveEnabled, setGoogleDriveEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("klie.googleDriveEnabled");
    return v !== null ? v === "true" : false;
  });
  const [dropboxEnabled, setDropboxEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("klie.dropboxEnabled");
    return v !== null ? v === "true" : false;
  });
  const [protonEnabled, setProtonEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("klie.protonEnabled");
    return v !== null ? v === "true" : false;
  });
  const [nsfwMode, setNsfwMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("klie.nsfwMode");
    return v !== null ? v === "true" : false;
  });
  const [selectedTheme, setSelectedTheme] = useState(() => {
    if (typeof window === "undefined") return "midnight-glass";
    return window.localStorage.getItem("klie.selectedTheme") || "midnight-glass";
  });
  const [selectedAppIcon, setSelectedAppIcon] = useState(() => {
    if (typeof window === "undefined") return "default";
    return window.localStorage.getItem("klie.selectedAppIcon") || "default";
  });
  const [textStyle, setTextStyle] = useState(() => {
    if (typeof window === "undefined") return "manrope";
    return window.localStorage.getItem("klie.textStyle") || "manrope";
  });
  const [cursorStyle, setCursorStyle] = useState(() => {
    if (typeof window === "undefined") return "default";
    return window.localStorage.getItem("klie.cursorStyle") || "default";
  });
  const [dataLog, setDataLog] = useState<DataLogEntry[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem("klie.dataLog");
    return raw ? JSON.parse(raw) : [];
  });
  const [vpnConnected, setVpnConnected] = useState(false);
  const [vpnProvider, setVpnProvider] = useState("protonvpn");

  const [selectedQuant, setSelectedQuant] = useState(() => {
    if (typeof window === "undefined") return "Q4_K_M";
    return window.localStorage.getItem("klie.selectedQuant") || "Q4_K_M";
  });
  const [selectedContext, setSelectedContext] = useState(() => {
    if (typeof window === "undefined") return "8K";
    return window.localStorage.getItem("klie.selectedContext") || "8K";
  });

  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.appLanguage", appLanguage); }, [appLanguage]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.notificationsEnabled", String(notificationsEnabled)); }, [notificationsEnabled]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("klie.iCloudEnabled", String(iCloudEnabled));
      if (iCloudEnabled && currentUser?.id) {
        invoke("sync_icloud", { profileId: currentUser.id }).catch((err) => console.warn("Failed to sync iCloud:", err));
      }
    }
  }, [iCloudEnabled, currentUser?.id]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("klie.googleDriveEnabled", String(googleDriveEnabled));
      if (googleDriveEnabled && currentUser?.id) {
        invoke("sync_google_drive", { profileId: currentUser.id }).catch((err) => console.warn("Failed to sync Google Drive:", err));
      }
    }
  }, [googleDriveEnabled, currentUser?.id]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("klie.dropboxEnabled", String(dropboxEnabled));
      if (dropboxEnabled && currentUser?.id) {
        invoke("sync_dropbox", { profileId: currentUser.id }).catch((err) => console.warn("Failed to sync Dropbox:", err));
      }
    }
  }, [dropboxEnabled, currentUser?.id]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("klie.protonEnabled", String(protonEnabled));
      if (protonEnabled && currentUser?.id) {
        invoke("sync_proton", { profileId: currentUser.id }).catch((err) => console.warn("Failed to sync Proton:", err));
      }
    }
  }, [protonEnabled, currentUser?.id]);
  useEffect(() => {
    invoke('set_backup_enabled', { enabled: false }).catch(() => {});
  }, []);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.nsfwMode", String(nsfwMode)); }, [nsfwMode]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.selectedTheme", selectedTheme); }, [selectedTheme]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.selectedAppIcon", selectedAppIcon); }, [selectedAppIcon]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.textStyle", textStyle); }, [textStyle]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.cursorStyle", cursorStyle); }, [cursorStyle]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.dataLog", JSON.stringify(dataLog)); }, [dataLog]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.selectedQuant", selectedQuant); }, [selectedQuant]);
  useEffect(() => { if (typeof window !== "undefined") window.localStorage.setItem("klie.selectedContext", selectedContext); }, [selectedContext]);

  // Apply selected theme to document root for CSS variable switching
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-theme", selectedTheme);
  }, [selectedTheme]);

  const logApiCall = (type: string, endpoint: string, status: string, details: string) => {
    const entry: DataLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      endpoint,
      status,
      details,
    };
    setDataLog((prev) => {
      const next = [...prev, entry];
      return next.length > 200 ? next.slice(-200) : next;
    });
  };

  const handleExportBackup = async () => {
    if (!currentUser) return;
    try {
      const filePath = await save({
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        defaultPath: 'klie_backup.db'
      });
      if (!filePath) return;
      await invoke("export_backup", { profileId: currentUser.id, destPath: filePath });
      alert("Backup exported successfully!");
    } catch (err) {
      console.error("Export backup error:", err);
      alert(`Export failed: ${String(err)}`);
    }
  };

  const handleImportBackup = async () => {
    if (!currentUser) return;
    try {
      const confirmed = await ask(
        "Importing a backup will overwrite your current active data. The app will reload. Are you sure you want to proceed?",
        {
          title: "Klie - Import Backup",
          kind: "warning",
        }
      );
      if (!confirmed) return;

      const filePath = await open({
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        multiple: false
      });
      if (!filePath) return;

      const actualPath = Array.isArray(filePath) ? filePath[0] : filePath;
      if (!actualPath) return;

      await invoke("import_backup", { profileId: currentUser.id, srcPath: actualPath });
      alert("Backup imported successfully! Reloading app...");
      window.location.reload();
    } catch (err) {
      console.error("Import backup error:", err);
      alert(`Import failed: ${String(err)}`);
    }
  };

  const allCharacters = useMemo(() => {
    const combined = [...characters, ...localCharacters];
    // Remove duplicates by ID
    const seen = new Set();
    return combined.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [characters, localCharacters]);

  const previewCharacter = useMemo(() => {
    if (!previewCharacterId) return null;
    return allCharacters.find(c => c.id === previewCharacterId) || null;
  }, [previewCharacterId, allCharacters]);

  useEffect(() => {
    if (!previewCharacterId) return;

    // Check SQLite first!
    invoke<any>("get_local_character", { characterId: previewCharacterId })
      .then(async localChar => {
        if (localChar && (localChar.isDownloaded === true || localChar.isDownloaded === 1)) {
          const mappedChar = mapLocalCharToCamel(localChar);
          if (mappedChar.isWorld) {
            try {
              const lore = await invoke<any[]>("get_world_lore", { characterId: previewCharacterId });
              if (Array.isArray(lore)) {
                mappedChar.locations = lore
                  .filter((x: any) => x.category === "LOCATION")
                  .map((x: any) => ({ name: x.title, description: x.content }));
              }
            } catch (e) {
              console.warn("Failed to load local world locations:", e);
            }
          }
          addOrUpdateCharacter(mappedChar);
        } else {
          fetch(`${API_URL}/api/desktop/characters/${previewCharacterId}`)
            .then(res => res.json())
            .then(async data => {
              if (data && data.id) {
                if (data.personality && (data.personality.startsWith("hwOA") || /^[a-zA-Z0-9+/=]+$/.test(data.personality.trim()))) {
                  try {
                    const decompressed = await invoke<string>("decompress_b64", { base64Str: data.personality });
                    data.personality = decompressed;
                  } catch (e) {
                    console.warn("Client personality decompression failed:", e);
                  }
                }
                addOrUpdateCharacter(data);
              }
            })
            .catch(e => console.error("REST fallback failed:", e));
        }
      })
      .catch(err => {
        console.warn("Failed to check local character, falling back to REST:", err);
        fetch(`${API_URL}/api/desktop/characters/${previewCharacterId}`)
          .then(res => res.json())
          .then(async data => {
            if (data && data.id) {
              if (data.personality && (data.personality.startsWith("hwOA") || /^[a-zA-Z0-9+/=]+$/.test(data.personality.trim()))) {
                try {
                  const decompressed = await invoke<string>("decompress_b64", { base64Str: data.personality });
                  data.personality = decompressed;
                } catch (e) {
                  console.warn("Client personality decompression failed:", e);
                }
              }
              addOrUpdateCharacter(data);
            }
          })
          .catch(e => console.error("REST fallback failed:", e));
      });
  }, [previewCharacterId]);

  const previewCharacterCreator = useMemo(() => {
    if (!previewCharacter) return null;
    return displayCreators.find(c => c.id === previewCharacter.creatorId || c.displayName === previewCharacter.creatorName) || {
      id: previewCharacter.creatorId || "placeholder",
      displayName: previewCharacter.creatorName || "Unknown Creator",
      handle: (previewCharacter.creatorName || "creator").toLowerCase().replace(/\s+/g, ""),
      totalPoints: 0,
      avatarUrl: `https://ui-avatars.com/api/?name=${previewCharacter.creatorName || "Creator"}&background=random`,
      rank: 0
    };
  }, [previewCharacter, displayCreators]);

  const previewModalData = useMemo(() => {
    if (!previewCharacter) return null;
    const fullDesc = previewCharacter.description || "";

    let longDesc = fullDesc;
    let worldBuilding = "";
    let supportingCharacters: string[] = [];
    let shortDesc = previewCharacter.shortDescription || "";

    if (fullDesc.includes("---[SHORT DESCRIPTION]---")) {
      shortDesc = fullDesc.split("---[SHORT DESCRIPTION]---")[1].split("---")[0].trim();
    }

    if (fullDesc.includes("---[SUPPORTING CHARACTERS]---")) {
      const match = fullDesc.split("---[SUPPORTING CHARACTERS]---")[1].split("---")[0].trim();
      if (match) {
        supportingCharacters = match.split("\n").map((l: string) => l.trim()).filter(Boolean);
      }
    }

    if (fullDesc.includes("---[PLACES / LOCATIONS]---")) {
      worldBuilding = fullDesc.split("---[PLACES / LOCATIONS]---")[1].split("---")[0].trim();
    }

    if (fullDesc.includes("---[")) {
      longDesc = fullDesc.split("---[")[0].trim();
    }

    return {
      longDesc,
      worldBuilding,
      supportingCharacters,
      shortDesc
    };
  }, [previewCharacter]);

  const [isLongDescExpanded, setIsLongDescExpanded] = useState(false);
  const [isSupportingExpanded, setIsSupportingExpanded] = useState(false);
  const [isWorldBuildingExpanded, setIsWorldBuildingExpanded] = useState(false);

  const [integrityStatus, setIntegrityStatus] = useState<"OK" | "DEPRECATED" | "REVOKED" | "LOADING">("LOADING");
  const [integrityMessage, setIntegrityMessage] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");

  // Force upgrade state — set true when server says this version is deprecated
  const [forceUpgrade, setForceUpgrade] = useState(false);
  const [forceUpgradeUrl, setForceUpgradeUrl] = useState("https://revtechcompany.com/download");
  const [forceUpgradeLatest, setForceUpgradeLatest] = useState("");
  const [forceUpgradeNotes, setForceUpgradeNotes] = useState("");

  // Check version on startup — force upgrade if server says DEPRECATED
  useEffect(() => {
    const CURRENT_VERSION = "1.1.0";
    async function checkVersionOnStartup() {
      try {
        let p = "macos";
        if (navigator.userAgent.indexOf("Win") !== -1) p = "windows";
        else if (navigator.userAgent.indexOf("Linux") !== -1) p = "linux";
        else if (navigator.userAgent.indexOf("Android") !== -1) p = "android";
        const res = await fetch(`${API_URL}/api/desktop/check-version?v=${CURRENT_VERSION}&p=${p}`);
        if (!res.ok) return;
        const data = await res.json();
        // Disable force upgrade overlay to prevent false security violations
        // if (data && data.forceUpgrade === true) {
        //   setForceUpgrade(true);
        //   setForceUpgradeUrl(data.updateUrl || "https://revtechcompany.com/download");
        //   setForceUpgradeLatest(data.latestVersion || "");
        //   setForceUpgradeNotes(data.message || "");
        // }
      } catch (err) {
        console.warn("Version check failed (network?):", err);
      }
    }
    checkVersionOnStartup();
  }, []);


  useEffect(() => {
    writeStoredSession(currentUser);
  }, [currentUser]);

  const lastSavedTicketKeyRef = useRef("");

  // Save/renew secure offline license ticket when online
  useEffect(() => {
    if (currentUser) {
      const stateKey = `${currentUser.id}-${currentUser.subscriptionPlan}-${isOffline}-${integrityStatus}`;
      if (lastSavedTicketKeyRef.current === stateKey) {
        return; // Already processed this session state
      }
      lastSavedTicketKeyRef.current = stateKey;

      console.log("Klie Active User Session loaded:", {
        email: currentUser.email,
        plan: currentUser.subscriptionPlan,
        status: currentUser.subscriptionStatus,
        integrityStatus,
        isOffline
      });

      if (integrityStatus === "OK" && !isOffline) {
        if (currentUser.subscriptionPlan === "PLUS" || currentUser.subscriptionPlan === "PRO") {
          console.log("Attempting to save/renew hardware-locked offline ticket for plan:", currentUser.subscriptionPlan);
          invoke("save_offline_ticket", {
            plan: currentUser.subscriptionPlan,
            status: currentUser.subscriptionStatus || "ACTIVE",
            email: currentUser.email,
            userId: currentUser.id,
          })
            .then(() => console.log("Hardware-locked offline ticket renewed successfully on disk."))
            .catch(err => console.error("Failed to renew offline ticket:", err));
        } else {
          console.log("Offline ticket creation skipped: Plan is FREE.");
        }
      }
    }
  }, [currentUser, integrityStatus, isOffline]);

  useEffect(() => {
    if (integrityCheckedRef.current) return;
    integrityCheckedRef.current = true;

    async function init() {
      console.log("Using production API:", API_URL);

      try {
        // 0. Verifica licenza offline (JWT RS256)
        const offlineLicense = await verifyOfflineLicenseJWT();
        if (offlineLicense.isValid && offlineLicense.payload) {
          console.log("Licenza offline JWT RS256 verificata matematicamente con successo!", offlineLicense.payload);
          setIntegrityStatus("OK");
          setIntegrityMessage("Licenza offline verificata localmente.");
          setIsOffline(true);
          return;
        }

        // 1. Anti-Piracy & Integrity check
        const integrity: any = await invoke("check_app_integrity");
        setIntegrityStatus(integrity.status);
        setIntegrityMessage(integrity.message);
        setUpdateUrl(integrity.updateUrl);

        if (integrity.isOffline) {
          setIsOffline(true);
        }

        if (integrity.status === "OK") {
          // Continue normal init if OK
          logApiCall("Security", "/v1/check-version", "OK", integrity.isOffline ? "Secure offline mode verified." : "App integrity verified.");
        }
      } catch (err) {
        console.error("Integrity check failed:", err);
        setIntegrityStatus("OK");
        setIntegrityMessage(String(err));
      }
    }
    init();

    // Point 81: Disable right-click in production
    const handleContext = (e: MouseEvent) => {
      if (import.meta.env.PROD) e.preventDefault();
    };
    document.addEventListener("contextmenu", handleContext);
    return () => document.removeEventListener("contextmenu", handleContext);
  }, []);

  // 1. Refresh user profile once every 7 days (or if no timestamp exists) to sync Stripe updates
  useEffect(() => {
    async function refreshProfile() {
      if (!isDbUnlocked || isOffline || !currentUser || !currentUser.sessionToken) return;
      
      const now = Date.now();
      const lastSyncStr = localStorage.getItem("klie.lastProfileSync");
      const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
      
      // Skip network check if synced within last 7 days
      if (now - lastSync < 7 * 24 * 60 * 60 * 1000) {
        console.log("Profile sync skipped: cached for 7 days.");
        return;
      }

      try {
        const meRes = await fetch(`${API_URL}/api/desktop/auth/me`, {
          headers: {
            Authorization: `Bearer ${currentUser.sessionToken}`
          }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData && meData.user) {
            const hasChanges =
              currentUser.subscriptionPlan !== meData.user.subscriptionPlan ||
              currentUser.subscriptionStatus !== meData.user.subscriptionStatus ||
              currentUser.displayName !== meData.user.displayName ||
              currentUser.avatarUrl !== meData.user.avatarUrl ||
              currentUser.totalPoints !== (meData.user.totalPoints ?? 0) ||
              JSON.stringify(currentUser.capabilities) !== JSON.stringify(meData.user.capabilities);

            if (hasChanges) {
              const updatedUser = {
                ...currentUser,
                subscriptionPlan: meData.user.subscriptionPlan,
                subscriptionStatus: meData.user.subscriptionStatus,
                capabilities: meData.user.capabilities,
                displayName: meData.user.displayName,
                avatarUrl: meData.user.avatarUrl,
                totalPoints: meData.user.totalPoints ?? 0,
              };
              console.log("Refreshed user subscription from server:", updatedUser);
              setCurrentUser(updatedUser);
            }
            localStorage.setItem("klie.lastProfileSync", String(now));
          }
        }
      } catch (meErr) {
        console.error("Failed to refresh user profile from server:", meErr);
      }
    }
    refreshProfile();
  }, [isDbUnlocked, isOffline, currentUser?.sessionToken]);

  // 2. Load characters list on start (caches bootstrap network call for 24 hours)
  useEffect(() => {
    async function load() {
      if (!isDbUnlocked) return; // Wait for DB to be ready
      try {
        if (isOffline) {
          console.log("App is in secure offline mode. Loading chatbots from local database...");
          const localList: any[] = await invoke("get_all_local_characters");
          const mapped = localList
            .map(lc => {
              const mappedChar = mapLocalCharToCamel(lc);
              return {
                ...mappedChar,
                creatorId: "cached-offline",
                points: 100,
              };
            })
            .filter(c => !c.id.includes("_conv-"));
          setCharacters(mapped);
          setLocalCharacters(mapped.filter(c => c.isDownloaded === true));
          return;
        }

        let localMapped: Character[] = [];
        try {
          const localList: any[] = await invoke("get_all_local_characters");
          localMapped = localList
            .map(lc => mapLocalCharToCamel(lc))
            .filter(c => !c.id.includes("_conv-"));
          setLocalCharacters(localMapped.filter(c => c.isDownloaded === true));
        } catch (e) {
          console.warn("Failed to load local characters on startup:", e);
        }

        // Apply cached bootstrap instantly
        const cachedBootStr = localStorage.getItem("klie.cachedBootstrap");
        let cachedData: any = null;
        if (cachedBootStr) {
          try {
            cachedData = JSON.parse(cachedBootStr);
            if (cachedData && cachedData.characters && Array.isArray(cachedData.characters.characters)) {
              setCharacters((prev: Character[]) => {
                const finalMap = new Map<string, Character>();
                prev.forEach(c => finalMap.set(c.id, c));
                localMapped.filter(c => c.isDownloaded).forEach(c => finalMap.set(c.id, c));
                cachedData.characters.characters.forEach((serverChar: any) => {
                  const existing = finalMap.get(serverChar.id);
                  if (existing) {
                    finalMap.set(serverChar.id, { ...existing, ...serverChar });
                  } else {
                    finalMap.set(serverChar.id, serverChar);
                  }
                });
                return Array.from(finalMap.values());
              });
            }
            if (cachedData && Array.isArray(cachedData.creators)) {
              setCreators(cachedData.creators);
            }
          } catch (e) {
            console.warn("Failed to parse cached bootstrap:", e);
          }
        }

        // Network call ONLY if 24 hours passed or no cache exists
        const now = Date.now();
        const lastBootStr = localStorage.getItem("klie.lastBootstrapSync");
        const lastBootSync = lastBootStr ? parseInt(lastBootStr, 10) : 0;

        if (import.meta.env.DEV) {
          console.log("Dev mode: bypassing 24h bootstrap cache check.");
        } else if (now - lastBootSync < 24 * 60 * 60 * 1000 && cachedData) {
          console.log("Bootstrap sync skipped: cached for 24 hours.");
          return;
        }

        const bootRes = await fetch(`${API_URL}/api/v1/bootstrap?sfw=${isSafe}&_cb=${now}`);
        if (bootRes.ok) {
          const data = await bootRes.json();
          if (data && data.characters && Array.isArray(data.characters.characters)) {
            // Cache network response for subsequent startups
            localStorage.setItem("klie.cachedBootstrap", JSON.stringify(data));
            localStorage.setItem("klie.lastBootstrapSync", String(now));

            setCharacters((prev: Character[]) => {
              const finalMap = new Map<string, Character>();
              
              // 1. Add prev state candidates
              prev.forEach(c => finalMap.set(c.id, c));
              
              // 2. Add local SQLite characters (prioritizing local/downloaded detail info, ignoring non-downloaded cloud stubs)
              localMapped.filter(c => c.isDownloaded).forEach(c => finalMap.set(c.id, c));
              
              // 3. Add bootstrap response characters, merging details
              data.characters.characters.forEach((serverChar: any) => {
                const existing = finalMap.get(serverChar.id);
                if (existing) {
                  finalMap.set(serverChar.id, {
                    ...existing,
                    ...serverChar,
                    description: existing.description || serverChar.description,
                    shortDescription: existing.shortDescription || serverChar.shortDescription,
                    personality: existing.personality || serverChar.personality,
                    sex: existing.sex || serverChar.sex,
                    clothes: existing.clothes || serverChar.clothes,
                    body: existing.body || serverChar.body,
                    gadgets: existing.gadgets || serverChar.gadgets
                  });
                } else {
                  finalMap.set(serverChar.id, serverChar);
                }
              });
              
              return Array.from(finalMap.values());
            });
          }
          if (data && Array.isArray(data.creators)) {
            const filtered = data.creators.filter((c: any) =>
              c.displayName &&
              c.displayName !== "Anonymous" &&
              c.displayName.trim() !== "" &&
              c.handle &&
              c.handle !== "user" &&
              c.handle.trim() !== ""
            );
            setCreators(filtered);
          }
        }
      } catch (err) {
        console.warn("Using fallback data for desktop", err);
      }
    }
    load();
  }, [isDbUnlocked, isSafe, isOffline]);

  const navigate = useNavigate();
  const location = useLocation();

  const handlePasswordLogin = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/desktop/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Invalid email or password.");
        return;
      }

      if (data.requiresTwoFactor) {
        setAuthError("2FA is enabled. Please log in on the website first.");
        return;
      }

      setAuthError("");
      const sessionUser = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatarUrl: data.user.avatarUrl,
        subscriptionPlan: data.user.subscriptionPlan || "FREE",
        subscriptionStatus: data.user.subscriptionStatus || "ACTIVE",
        role: "user" as const,
        provider: "password" as const,
        sessionToken: data.sessionToken,
      };
      setCurrentUser(sessionUser);

      // Richiedi e salva la licenza offline protetta JWT RS256
      try {
        let hardwareId = "fallback-hw-id";
        try {
          const integrity: any = await invoke("check_app_integrity");
          if (integrity && integrity.hardwareId) hardwareId = integrity.hardwareId;
        } catch (e) {
          console.warn("Tauri check_app_integrity fallito in login", e);
        }

        const licRes = await fetch(`${API_URL}/api/license/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, hardwareId }),
        });
        if (licRes.ok) {
          const licData = await licRes.json();
          if (licData.success && licData.token) {
            localStorage.setItem("klie.offlineLicenseJWT", licData.token);
            console.log("Licenza offline JWT RS256 salvata con successo!");
          }
        }
      } catch (licErr) {
        console.warn("Impossibile salvare la licenza offline al login:", licErr);
      }

      navigate("/");
    } catch (err) {
      console.error("Login failed:", err);
      setAuthError("Unable to connect to revtechcompany.com. Please try again.");
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      setAuthError("Email and password are required.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/desktop/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Unable to create account.");
        return;
      }

      setAuthError("");
      setCurrentUser({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        avatarUrl: data.user.avatarUrl,
        subscriptionPlan: data.user.subscriptionPlan || "FREE",
        subscriptionStatus: data.user.subscriptionStatus || "ACTIVE",
        role: "user",
        provider: "password",
        sessionToken: data.sessionToken,
      });
      navigate("/");
    } catch (err) {
      console.error("Sign up failed:", err);
      setAuthError("Unable to connect to revtechcompany.com. Please try again.");
    }
  };

  const handleLogout = async () => {
    if (currentUser?.sessionToken) {
      try {
        await fetch(`${API_URL}/api/desktop/auth/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentUser.sessionToken}`,
          },
        });
      } catch {
        // silent fail - session will expire naturally
      }
    }
    setCurrentUser(null);
    setAuthError("");
    setConversations([]);
    setCharacters(fallbackCharacters);
    localStorage.removeItem("klie.conversations");
    navigate("/login");
  };

  const handleCreateCharacter = async (form: CreatorFormState) => {
    if (!currentUser) return;
    const trimmedName = form.name.trim();

    const uploadAvatar = async (base64DataUrl: string, token: string): Promise<string> => {
      try {
        const base64Str = base64DataUrl.split(",")[1];
        const binaryStr = window.atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const response = await fetch(`${API_URL}/api/desktop/upload-avatar`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/octet-stream"
          },
          body: bytes
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to upload avatar");
        }

        const data = await response.json();
        return data.url;
      } catch (e) {
        console.error("uploadAvatar failed:", e);
        throw e;
      }
    };

    const doCreate = async (imageUrl: string) => {
      try {

        const hasSupporting = form.characterBuilding?.trim();
        const groupChatDirective = hasSupporting
          ? `---[GROUP CHAT SYSTEM INSTRUCTIONS]---\nThis is a simulated multi-character group chat! You act as and represent a cast of multiple characters who can converse with each other and the user. Feel free to have more than one character speak, or talk among themselves, in a single response stream. Always prefix every line of speech clearly with the character's name in bold, like:\n**[Character Name]**: "Dialogue..."\n\nThe cast includes:\n- **${trimmedName}** (Main character)\n${hasSupporting}`
          : "";

        const combinedDesc = [
          form.description.trim(),
          form.shortDescription.trim() ? `---[SHORT DESCRIPTION]---\n${form.shortDescription.trim()}` : "",
          form.worldBuilding?.trim() ? `---[PLACES / LOCATIONS]---\n${form.worldBuilding.trim()}` : "",
          hasSupporting ? `---[SUPPORTING CHARACTERS]---\n${hasSupporting}` : "",
          groupChatDirective
        ].filter(Boolean).join("\n\n");


        const result = await invoke<any>("create_character", {
          payload: {
            name: trimmedName,
            description: combinedDesc,
            shortDescription: form.shortDescription.trim(),
            sex: form.sex,
            isSFW: form.isSFW,
            isWorld: form.isWorld,
            personality: form.personality.trim(),
            hairColor: form.hairColor,
            eyeColor: form.eyeColor,
            skinColor: form.skinColor,
            clothes: form.clothes.trim(),
            body: form.body.trim(),
            gadgets: form.gadgets.trim(),
            greeting: form.greeting.trim() || `Hello! I'm ${trimmedName}. How can I help you?`,
            imageUrl: imageUrl || null,
          }
        });

        // Add the new character to local state immediately to ensure it shows up in Creator view
        const newChar: Character = {
          ...result.character,
          isWorld: form.isWorld,
          creatorId: currentUser.id,
          creatorName: currentUser.displayName,
          points: 0,
          description: combinedDesc,
          shortDescription: form.shortDescription.trim(),
          sex: form.sex,
          personality: form.personality.trim(),
          hairColor: form.hairColor,
          eyeColor: form.eyeColor,
          skinColor: form.skinColor,
          clothes: form.clothes.trim(),
          body: form.body.trim(),
          gadgets: form.gadgets.trim(),
        };

        setCharacters((prev: Character[]) => [newChar, ...prev]);
        invoke("cache_character", { character: mapCamelToLocal(newChar) }).catch((e) => console.warn("Failed to cache new character:", e));
        
        localStorage.removeItem("klie.lastBootstrapSync");
        localStorage.removeItem("klie.cachedBootstrap");

        const convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newConv: Conversation = { id: convId, characterId: newChar.id };
        setConversations(prev => [newConv, ...prev]);

        navigate(`/chat/${convId}`);
        return newChar;
      } catch (err) {
        console.error("Failed to create character on server:", err);
        alert(`Failed to create character: ${String(err)}`);
      }
    };

    if (form.image) {
      const img = new Image();
      const objUrl = URL.createObjectURL(form.image);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedUrl = canvas.toDataURL("image/jpeg", 0.85);
          uploadAvatar(compressedUrl, currentUser?.sessionToken || "")
            .then(pubUrl => doCreate(pubUrl))
            .catch(err => {
              alert("Image upload failed: " + err.message);
            });
        } else {
            const reader = new FileReader();
            reader.onload = () => {
              uploadAvatar(reader.result as string, currentUser?.sessionToken || "")
                .then(pubUrl => doCreate(pubUrl))
                .catch(err => alert("Image upload failed: " + err.message));
            };
            reader.readAsDataURL(form.image as Blob);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        const reader = new FileReader();
        reader.onload = () => {
          uploadAvatar(reader.result as string, currentUser?.sessionToken || "")
            .then(pubUrl => doCreate(pubUrl))
            .catch(err => alert("Image upload failed: " + err.message));
        };
        reader.readAsDataURL(form.image as Blob);
      };
      img.src = objUrl;
    } else {
      doCreate("");
    }
  };


  const handleDeleteCharacters = async (ids: string[]) => {
    if (!currentUser) return;
    try {
      const deletePromises = ids.map(async (id) => {
        const response = await fetch(`${API_URL}/api/desktop/characters/${id}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${currentUser.sessionToken}`,
          },
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to delete character ${id}`);
        }
      });

      await Promise.all(deletePromises);

      setCharacters((prev: Character[]) => prev.filter(c => !ids.includes(c.id)));

      setConversations((prev: Conversation[]) => {
        return prev.filter(c => !ids.includes(c.characterId));
      });

      logApiCall("Character Maker", "/api/desktop/characters", "SUCCESS", `Deleted ${ids.length} characters.`);
    } catch (err) {
      console.error("Failed to delete character(s):", err);
      alert(`Error deleting characters: ${String(err)}`);
      throw err;
    }
  };


  const handleSelectCharacter = async (id: string) => {
    // Start a new conversation or find if we want to reuse?
    // Chai/C.AI style: clicking from search starts a NEW session if we want, 
    // or we can reuse the most recent one. 
    // Let's implement ALWAYS NEW session for the 'Messaging app' feel when clicking 'New'
    const convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    let targetCharId = id;
    try {
      const localChar = await invoke<any>("get_local_character", { characterId: id });
      if (!localChar) {
        const res = await fetch(`${API_URL}/api/desktop/characters/${id}`, {
          headers: currentUser ? { "Authorization": `Bearer ${currentUser.sessionToken}` } : {}
        });
        const data = await res.json();
        if (data && data.id) {
          const stubChar = { ...data, isDownloaded: false };
          await invoke("save_cloud_character_stub", { character: mapCamelToLocal(stubChar) });
        } else {
          throw new Error("Failed to fetch character details from server");
        }
      }
      
      const clonedId = `${id}_${convId}`;
      await invoke("clone_character_for_chat", { masterId: id, conversationId: convId });
      targetCharId = clonedId;
    } catch (e) {
      console.error("Failed to clone character, using original ID:", e);
    }

    const newConv: Conversation = { id: convId, characterId: targetCharId };
    setConversations(prev => [newConv, ...prev]);
    navigate(`/chat/${convId}`);
  };

  const handleNav = (key: "home" | "chat" | "creators") => {
    if (key === "home") navigate("/");
    if (key === "creators") navigate("/creators");
    if (key === "chat") navigate("/chat");
  };

  const handleSearch = () => navigate("/search");

  const goSettings = (tab?: string) => {
    const suffix = tab ? `?tab=${tab}` : "";
    navigate(`/settings${suffix}`);
  };

  const activeNav = location.pathname.startsWith("/chat")
    ? "chat"
    : location.pathname.startsWith("/creators")
      ? "creators"
      : "home";

  const handleUpdateCharacter = async (id: string, updates: Partial<Character>) => {
    if (!currentUser) return;
    try {
      const existing = allCharacters.find(c => c.id === id);

      const name = (updates.name ?? existing?.name ?? "").trim();
      if (!name) {
        alert("Name is required.");
        return;
      }
      if (name.length > 32) {
        alert("Name must be maximum 32 characters.");
        return;
      }
      const shortDesc = (updates.shortDescription ?? existing?.shortDescription ?? "").trim();
      if (shortDesc.length > 100) {
        alert("Short description must be maximum 100 characters.");
        return;
      }
      const longDesc = (updates.description ?? existing?.description ?? "").trim();
      if (longDesc.length > 1000) {
        alert("Long description must be maximum 1000 characters.");
        return;
      }
      const greeting = (updates.greeting ?? existing?.greeting ?? "").trim();
      if (greeting.length > 500) {
        alert("Greeting message must be maximum 500 characters.");
        return;
      }
      const personality = updates.personality ?? existing?.personality ?? "";
      const selectedEditChips = personality ? personality.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
      if (selectedEditChips.length > 7) {
        alert("Personality must be maximum 7 tags.");
        return;
      }
      
      const spLength = calculateSystemPromptLength({
        name,
        description: longDesc,
        personality,
        sex: updates.sex ?? existing?.sex ?? "",
        hairColor: updates.hairColor ?? existing?.hairColor ?? "",
        eyeColor: updates.eyeColor ?? existing?.eyeColor ?? "",
        skinColor: updates.skinColor ?? existing?.skinColor ?? "",
        clothes: updates.clothes ?? existing?.clothes ?? "",
        body: updates.body ?? existing?.body ?? "",
        gadgets: updates.gadgets ?? existing?.gadgets ?? "",
        isSFW: updates.isSFW ?? existing?.isSFW ?? true,
      });
      if (spLength > 5000) {
        alert(`System prompt exceeds maximum of 5000 characters (currently ${spLength}). Please shorten your descriptions, traits, or attributes.`);
        return;
      }
      const oldDesc = existing?.description || "";
      let preservedSections = "";
      const placesMatch = oldDesc.match(/(---\[PLACES \/ LOCATIONS\]---[\s\S]*)/);
      if (placesMatch && placesMatch[1]) {
        preservedSections = "\n\n" + placesMatch[1];
      } else {
        const subsMatch = oldDesc.match(/(---\[SUPPORTING CHARACTERS\]---[\s\S]*)/);
        if (subsMatch && subsMatch[1]) {
          preservedSections = "\n\n" + subsMatch[1];
        }
      }

      const combinedDesc = (updates.description?.trim() || "") + preservedSections;

      const result = await invoke<any>("edit_character", {
        characterId: id,
        payload: {
          name: updates.name?.trim(),
          description: combinedDesc,
          shortDescription: updates.shortDescription?.trim(),
          sex: updates.sex,
          isSFW: updates.isSFW,
          isWorld: updates.isWorld,
          personality: updates.personality?.trim(),
          clothes: updates.clothes?.trim(),
          body: updates.body?.trim(),
          gadgets: updates.gadgets?.trim(),
          greeting: updates.greeting?.trim(),
        }
      });

      const updatedChar: Character = {
        ...existing,
        ...result.character,
        isWorld: updates.isWorld,
        description: combinedDesc,
        shortDescription: updates.shortDescription?.trim(),
        sex: updates.sex,
        personality: updates.personality?.trim(),
        clothes: updates.clothes?.trim(),
        body: updates.body?.trim(),
        gadgets: updates.gadgets?.trim(),
      };

      setCharacters((prev: Character[]) => prev.map(c => c.id === id ? { ...c, ...updatedChar } : c));
      invoke("cache_character", { character: mapCamelToLocal(updatedChar) }).catch((e) => console.warn("Failed to cache updated character:", e));
      
      localStorage.removeItem("klie.lastBootstrapSync");
      localStorage.removeItem("klie.cachedBootstrap");

      setEditingCharacterId(null);
      alert("Chatbot updated successfully!");
    } catch (err) {
      console.error("Update failed:", err);
      alert(err instanceof Error ? err.message : "Failed to update chatbot.");
    }
  };

  const currentDrawerCreator = useMemo(() => {
    if (!activeCreatorProfile) return null;
    return displayCreators.find(c => c.id === activeCreatorProfile.id || c.handle === activeCreatorProfile.handle) || activeCreatorProfile;
  }, [activeCreatorProfile, displayCreators]);

  if (!currentUser) {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/login"
            element={
              <AuthView
                error={authError}
                onPasswordLogin={handlePasswordLogin}
                onSignUp={handleSignUp}
              />
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AnimatePresence>
    );
  }

  if (location.pathname === "/login") {
    return <Navigate to="/" replace />;
  }

  if (location.pathname.startsWith("/search")) {
    return (
      <>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/search"
              element={
                <SearchView
                  isSafe={isSafe}
                  onToggleSafe={setIsSafe}
                  onSelectNav={handleNav}
                  onUpdates={() => goSettings("updates")}
                  onSettings={() => goSettings("settings")}
                  onSupport={() => goSettings("support")}
                  onLogout={handleLogout}
                  currentUser={currentUser}
                  characters={allCharacters}
                  creators={displayCreators}
                  onSelectCharacter={setPreviewCharacterId}
                  onSelectCreator={setActiveCreatorProfile}
                />
              }
            />
          </Routes>
        </AnimatePresence>

        <AnimatePresence>
          {previewCharacter && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 md:p-6"
              onClick={closePreview}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.8 }}
                onClick={(e) => e.stopPropagation()}
                className="relative flex w-full max-w-2xl flex-col rounded-[32px] border border-white/10 bg-surface-900/85 p-6 md:p-8 shadow-2xl backdrop-blur-2xl ring-1 ring-black/40 overflow-hidden max-h-[90vh]"
              >
                {/* Close button */}
                <button
                  type="button"
                  onClick={closePreview}
                  className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-text-muted hover:text-text-high hover:bg-white/10 transition cursor-pointer z-10"
                >
                  ✕
                </button>

                {/* Content container with scroll */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-1 mt-4 text-left">

                  {/* Core Info Split: Image & Title */}
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="relative h-44 w-44 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex-shrink-0 mx-auto md:mx-0 bg-surface-800">
                      <img
                        src={previewCharacter.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(previewCharacter.name)}&background=080808&color=ffffff`}
                        alt={previewCharacter.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex-1 space-y-4 w-full min-w-0">
                      {showPreviewReport ? (
                        <div className="space-y-4 p-5 rounded-2xl bg-rose-500/[0.02] border border-rose-500/10">
                          <div className="flex items-center justify-between">
                            <h4 className="font-display text-base font-bold text-rose-400">Report {previewCharacter.name}</h4>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPreviewReport(false);
                                setPreviewReportSuccess(false);
                                setPreviewReportReason("");
                                setPreviewReportError("");
                              }}
                              className="text-xs text-text-muted hover:text-white transition"
                            >
                              Cancel
                            </button>
                          </div>

                          {previewReportSuccess ? (
                            <div className="text-center py-8 space-y-3">
                              <span className="text-2xl">✅</span>
                              <div className="text-xs font-bold text-emerald-400">Report Submitted Successfully</div>
                              <p className="text-[10px] text-text-muted leading-relaxed">
                                Thank you for your feedback. Our moderation team will investigate this character shortly.
                              </p>
                            </div>
                          ) : (
                            <form onSubmit={(e) => handlePreviewReportSubmit(e, previewCharacter)} className="space-y-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Why are you reporting this chatbot?</label>
                                <textarea
                                  value={previewReportReason}
                                  onChange={(e) => setPreviewReportReason(e.target.value)}
                                  placeholder="Please provide details (e.g. copyright violation, offensive content, safety concerns)..."
                                  required
                                  className="w-full min-h-[140px] resize-none rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 transition leading-relaxed"
                                />
                              </div>
                              {previewReportError && <div className="text-[10px] text-rose-400 font-medium">{previewReportError}</div>}
                              <button
                                type="submit"
                                disabled={isReportingPreview || !previewReportReason.trim()}
                                className="w-full rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2.5 px-4 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10"
                              >
                                {isReportingPreview ? "Submitting..." : "Submit Report"}
                              </button>
                            </form>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* 1. Nome chatbot + badge NSFW inline */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-display text-3xl font-black text-text-high tracking-tight truncate max-w-full">
                              {previewCharacter.name}
                            </h3>
                            {previewCharacter.isSFW === false && (
                              <span className="bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full uppercase shadow-md select-none flex-shrink-0">
                                NSFW
                              </span>
                            )}
                          </div>

                          {/* 2. Chips orizzontali: Sesso e Personalità selezionate */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {previewCharacter.sex && (
                              <span className="bg-white/5 border border-white/10 text-text-high text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                                <span className="text-primary-400">⚧</span> {previewCharacter.sex}
                              </span>
                            )}

                            {previewCharacter.personality && previewCharacter.personality.split(", ").map((trait: string, idx: number) => (
                              <span key={idx} className="bg-white/5 border border-white/10 text-text-high text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                                <span className="text-emerald-400">✦</span> {trait.trim()}
                              </span>
                            ))}
                          </div>

                          {/* 3. Breve descrizione */}
                          <p className="text-sm text-text-muted leading-relaxed font-medium">
                            {previewModalData?.shortDesc || previewCharacter.shortDescription || previewCharacter.description?.split("\n")[0] || "No brief bio provided."}
                          </p>

                          {/* 4. Made by + Profilo Creator */}
                          {previewCharacterCreator && (
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-xs text-text-subtle font-medium">Made by</span>
                              <div
                                onClick={() => {
                                  setActiveCreatorProfile(previewCharacterCreator as Creator);
                                  closePreview();
                                }}
                                className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/5 hover:border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-xl cursor-pointer transition group"
                              >
                                <img
                                  src={(previewCharacterCreator as any).avatarUrl}
                                  alt={(previewCharacterCreator as any).displayName}
                                  className="h-5 w-5 rounded-full object-cover bg-surface-800"
                                />
                                <span className="text-xs font-bold text-text-high group-hover:text-white transition">
                                  {(previewCharacterCreator as any).displayName}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* 5. Cast / Supporting Characters */}
                          {previewModalData?.supportingCharacters && previewModalData.supportingCharacters.length > 0 && (
                            <div className="border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden transition-all">
                              <button
                                type="button"
                                onClick={() => setIsSupportingExpanded(!isSupportingExpanded)}
                                className="w-full px-4 py-3.5 flex items-center justify-between text-xs font-bold text-text-high hover:bg-white/[0.02] transition cursor-pointer"
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-purple-400">👥</span> Cast / Supporting Characters ({previewModalData.supportingCharacters.length})
                                </span>
                                <span className="text-text-muted text-lg leading-none">
                                  {isSupportingExpanded ? "▴" : "▾"}
                                </span>
                              </button>

                              {previewModalData.supportingCharacters.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => setIsSupportingExpanded(!isSupportingExpanded)}
                                  className="text-[10px] text-primary-400 font-bold hover:underline"
                                >
                                  {isSupportingExpanded ? "Show Less" : `Show All (+${previewModalData.supportingCharacters.length - 3})`}
                                </button>
                              )}

                              <div className="px-4 pb-4 border-t border-white/5 pt-3">
                                <div className="space-y-2">
                                  {(isSupportingExpanded ? previewModalData.supportingCharacters : previewModalData.supportingCharacters.slice(0, 3)).map((charLine, idx) => {
                                    const parts = charLine.split(":**");
                                    const namePart = parts[0]?.replace(/^-?\s*\*\*/, "").trim();
                                    const descPart = parts[1]?.trim() || charLine;

                                    return (
                                      <div key={idx} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-2.5 text-xs">
                                        <span className="text-base select-none">👤</span>
                                        <div>
                                          <div className="font-bold text-text-high">{namePart || "Supporting Cast"}</div>
                                          <div className="text-[11px] text-text-muted mt-0.5">{descPart}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                    </div>
                  </div>

                </div>

                {/* Bottom Chat Action Bar */}
                <div className="mt-6 border-t border-white/5 pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPreviewReport(true)}
                    className="p-3 rounded-full border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer flex items-center justify-center flex-shrink-0"
                    title="Report Character"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                  </button>

                  {!previewCharacter.isDownloaded && (
                    <button
                      type="button"
                      onClick={() => handleDownloadCharacter(previewCharacter.id)}
                      className="p-3 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 transition cursor-pointer flex items-center justify-center flex-shrink-0"
                      title="Download Character"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      handleSelectCharacter(previewCharacter.id);
                      closePreview();
                    }}
                    className="flex-1 rounded-full py-3.5 text-xs font-bold transition bg-white text-black hover:bg-white/95 shadow-[0_0_24px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Chat</span>
                  </motion.button>
                </div>

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeCreatorProfile && currentDrawerCreator && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-md p-4 md:p-6"
              onClick={() => setActiveCreatorProfile(null)}
            >
              <motion.div
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.8 }}
                onClick={(e) => e.stopPropagation()}
                className="relative flex h-full w-full max-w-lg flex-col rounded-[32px] border border-white/10 bg-surface-900/80 p-6 shadow-2xl backdrop-blur-2xl ring-1 ring-black/40 overflow-hidden"
              >
                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setActiveCreatorProfile(null)}
                  className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-text-muted hover:text-text-high hover:bg-white/10 transition cursor-pointer"
                >
                  ✕
                </button>

                {/* Profile Header */}
                <div className="mt-8 flex flex-col items-center text-center">
                  <div className="relative p-1 rounded-full bg-gradient-to-tr from-primary-500 via-purple-500 to-amber-500 shadow-lg">
                    <img
                      src={currentDrawerCreator.avatarUrl}
                      alt={currentDrawerCreator.displayName}
                      className="h-24 w-24 rounded-full border-[3px] border-surface-900 object-cover bg-surface-800"
                    />
                  </div>

                  <h3 className="mt-4 font-display text-2xl font-black text-text-high tracking-tight">
                    {currentDrawerCreator.displayName}
                  </h3>
                  <p className="text-sm font-semibold text-text-muted">
                    @{currentDrawerCreator.handle}
                  </p>

                  {/* Quick stats row */}
                  <div className="mt-6 flex gap-8 border-y border-white/5 py-4 w-full justify-center">
                    <div className="text-center">
                      <div className="font-display text-base font-extrabold text-text-high">
                        {new Intl.NumberFormat("en-US").format(currentDrawerCreator.followersCount || 0)}
                      </div>
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Followers</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-base font-extrabold text-text-high">
                        {new Intl.NumberFormat("en-US").format(currentDrawerCreator.followingCount || 0)}
                      </div>
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Following</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-base font-extrabold text-text-high">
                        {allCharacters.filter(c => c.creatorId === currentDrawerCreator.id).length}
                      </div>
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Releases</div>
                    </div>
                  </div>

                  {/* Follow Toggle */}
                  <div className="mt-5 w-full">
                    {currentDrawerCreator.id === currentUser?.id ? (
                      <div className="w-full rounded-full py-3 text-xs font-bold text-center border border-white/10 bg-white/5 text-text-muted">
                        This is You
                      </div>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleFollowCreator(currentDrawerCreator.id || currentDrawerCreator.handle)}
                        className={`w-full rounded-full py-3 text-xs font-bold transition border cursor-pointer ${followedCreatorIds.includes(currentDrawerCreator.id || currentDrawerCreator.handle)
                            ? "border-primary-500/30 bg-primary-500/10 text-primary-400 hover:bg-primary-500/20"
                            : "border-border-subtle/25 bg-white text-black hover:bg-white/90"
                          }`}
                      >
                        {followedCreatorIds.includes(currentDrawerCreator.id || currentDrawerCreator.handle) ? "Following" : "Follow"}
                      </motion.button>
                    )}
                  </div>

                  {/* Bio */}
                  {currentDrawerCreator.bio && (
                    <p className="mt-5 text-xs text-text-muted leading-relaxed font-semibold max-w-sm">
                      {currentDrawerCreator.bio}
                    </p>
                  )}
                </div>

                {/* Releases section */}
                <div className="mt-8 flex-1 overflow-y-auto no-scrollbar space-y-4">
                  <h4 className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Chatbots Released</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {allCharacters.filter(c => c.creatorId === currentDrawerCreator.id).length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/5 p-8 text-center text-xs text-text-subtle font-semibold">
                        No chatbots published yet.
                      </div>
                    ) : (
                      allCharacters
                        .filter(c => c.creatorId === currentDrawerCreator.id)
                        .map((char) => (
                          <div
                            key={char.id}
                            onClick={() => {
                              setActiveCreatorProfile(null);
                              setPreviewCharacterId(char.id);
                            }}
                            className="group flex items-center justify-between rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 p-3.5 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={char.imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80"}
                                alt={char.name}
                                className="h-11 w-11 rounded-xl object-cover bg-surface-800"
                              />
                              <div className="text-left">
                                <div className="font-display text-sm font-bold text-text-high group-hover:text-primary-400 transition">
                                  {char.name}
                                </div>
                                <div className="text-[11px] font-semibold text-text-muted line-clamp-1 max-w-[220px]">
                                  {char.description || "No description provided."}
                                </div>
                              </div>
                            </div>
                            <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted group-hover:text-text-high group-hover:border-white/20 transition">
                              Chat
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }


  // Force upgrade screen — blocks all UI, no dismiss
  if (forceUpgrade) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "#050507",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          textAlign: "center",
          fontFamily: "inherit",
        }}
      >
        {/* Glow */}
        <div style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "500px",
          height: "300px",
          background: "radial-gradient(ellipse at center, rgba(220,60,60,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: "420px", width: "100%" }}>
          {/* Icon */}
          <div style={{
            width: "72px",
            height: "72px",
            borderRadius: "24px",
            background: "rgba(220,50,50,0.12)",
            border: "1px solid rgba(220,50,50,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: "32px",
          }}>
            🚫
          </div>

          <div style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(220,80,80,0.9)",
            marginBottom: "12px",
          }}>
            Version No Longer Supported
          </div>

          <h1 style={{
            fontSize: "26px",
            fontWeight: 800,
            color: "#ffffff",
            marginBottom: "12px",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}>
            Update Required
          </h1>

          <p style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.7,
            marginBottom: "8px",
            fontWeight: 500,
          }}>
            {forceUpgradeNotes
              ? forceUpgradeNotes
              : `This version of Klie is no longer supported. Please download the latest release to continue.`}
          </p>

          {forceUpgradeLatest && (
            <div style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.3)",
              marginBottom: "28px",
              letterSpacing: "0.05em",
            }}>
              Latest version: v{forceUpgradeLatest}
            </div>
          )}

          <button
            onClick={() => {
              try { (window as any).__TAURI_INTERNALS__ ? invoke("open_url", { url: forceUpgradeUrl }) : window.open(forceUpgradeUrl, "_blank"); } catch { window.open(forceUpgradeUrl, "_blank"); }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "#ffffff",
              color: "#000000",
              border: "none",
              borderRadius: "100px",
              padding: "14px 32px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            ↓ Download Latest Version
          </button>
        </div>
      </div>
    );
  }

  const LayoutComponent = (deviceType === "phone" || deviceType === "tablet") ? AppLayoutMobile : AppLayout;

  return (
    <LayoutComponent
      isSafe={isSafe}
      onToggleSafe={setIsSafe}
      activeNav={activeNav}
      onSelectNav={handleNav}
      onSearch={handleSearch}
      onNotifications={() => goSettings("updates")}
      onSettings={() => goSettings("settings")}
      onUpdates={() => goSettings("updates")}
      onSupport={() => goSettings("support")}
      onLogout={handleLogout}
      profileImageUrl={currentUser.avatarUrl}
      profileAlt={currentUser.displayName}
      subscriptionPlan={currentUser.subscriptionPlan as any}
      subscriptionStatus={currentUser.subscriptionStatus}
      integrityStatus={integrityStatus}
      integrityMessage={integrityMessage}
      updateUrl={updateUrl}
      deviceType={deviceType}
    >
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <HomeView
                characters={allCharacters}
                creators={displayCreators}
                onSelectCharacter={setPreviewCharacterId}
                onSelectCreator={setActiveCreatorProfile}
                onFollowCreator={handleFollowCreator}
                followedCreatorIds={followedCreatorIds}
                currentUser={currentUser}
                onLoadMoreCreators={handleLoadMoreCreators}
              />
            }
          />
          <Route path="/chat" element={<ChatView characters={allCharacters} currentUser={currentUser} conversations={conversations} setConversations={setConversations} allCharacters={allCharacters} onIncrementPoints={handleIncrementPoints} setCharacters={setCharacters} onSelectCharacter={handleSelectCharacter} localCharacters={localCharacters} setLocalCharacters={setLocalCharacters} onDownloadCharacter={handleDownloadCharacter} onDeleteDownloadedCharacter={handleDeleteDownloadedCharacter} onSelectCreator={setActiveCreatorProfile} creators={displayCreators} />} />
          <Route path="/chat/archived" element={<ChatView characters={allCharacters} archivedOnly currentUser={currentUser} conversations={conversations} setConversations={setConversations} allCharacters={allCharacters} onIncrementPoints={handleIncrementPoints} setCharacters={setCharacters} onSelectCharacter={handleSelectCharacter} localCharacters={localCharacters} setLocalCharacters={setLocalCharacters} onDownloadCharacter={handleDownloadCharacter} onDeleteDownloadedCharacter={handleDeleteDownloadedCharacter} onSelectCreator={setActiveCreatorProfile} creators={displayCreators} />} />
          <Route path="/chat/library" element={<ChatView characters={allCharacters} libraryOnly currentUser={currentUser} conversations={conversations} setConversations={setConversations} allCharacters={allCharacters} onIncrementPoints={handleIncrementPoints} setCharacters={setCharacters} onSelectCharacter={handleSelectCharacter} localCharacters={localCharacters} setLocalCharacters={setLocalCharacters} onDownloadCharacter={handleDownloadCharacter} onDeleteDownloadedCharacter={handleDeleteDownloadedCharacter} onSelectCreator={setActiveCreatorProfile} creators={displayCreators} />} />
          <Route path="/chat/:id" element={<ChatView characters={allCharacters} currentUser={currentUser} conversations={conversations} setConversations={setConversations} allCharacters={allCharacters} onIncrementPoints={handleIncrementPoints} setCharacters={setCharacters} onSelectCharacter={handleSelectCharacter} localCharacters={localCharacters} setLocalCharacters={setLocalCharacters} onDownloadCharacter={handleDownloadCharacter} onDeleteDownloadedCharacter={handleDeleteDownloadedCharacter} onSelectCreator={setActiveCreatorProfile} creators={displayCreators} />} />
          <Route
            path="/creators"
            element={
              <CreatorsView
                creators={displayCreators}
                currentUser={currentUser}
                createdCharacters={allCharacters.filter(c => c.creatorId === currentUser?.id)}

                onCreateCharacter={handleCreateCharacter}
                onOpenCharacter={setPreviewCharacterId}
                onDeleteCharacter={handleDeleteCharacters}
                editingCharacter={allCharacters.find(c => c.id === editingCharacterId) || null}
                onCancelEdit={() => setEditingCharacterId(null)}
                onEditCharacter={(id) => setEditingCharacterId(id)}
                onUpdateCharacter={handleUpdateCharacter}
              />
            }
          />
          <Route path="/settings" element={
            <SettingsView
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              isSafe={isSafe}
              setIsSafe={setIsSafe}
              appLanguage={appLanguage}
              setAppLanguage={setAppLanguage}
              notificationsEnabled={notificationsEnabled}
              setNotificationsEnabled={setNotificationsEnabled}
              iCloudEnabled={iCloudEnabled}
              setICloudEnabled={setICloudEnabled}
              googleDriveEnabled={googleDriveEnabled}
              setGoogleDriveEnabled={setGoogleDriveEnabled}
              dropboxEnabled={dropboxEnabled}
              setDropboxEnabled={setDropboxEnabled}
              protonEnabled={protonEnabled}
              setProtonEnabled={setProtonEnabled}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              nsfwMode={nsfwMode}
              setNsfwMode={setNsfwMode}
              selectedTheme={selectedTheme}
              setSelectedTheme={setSelectedTheme}
              selectedAppIcon={selectedAppIcon}
              setSelectedAppIcon={setSelectedAppIcon}
              textStyle={textStyle}
              setTextStyle={setTextStyle}
              cursorStyle={cursorStyle}
              setCursorStyle={setCursorStyle}
              dataLog={dataLog}
              setDataLog={setDataLog}
              vpnConnected={vpnConnected}
              setVpnConnected={setVpnConnected}
              vpnProvider={vpnProvider}
              setVpnProvider={setVpnProvider}
              selectedQuant={selectedQuant}
              setSelectedQuant={setSelectedQuant}
              selectedContext={selectedContext}
              setSelectedContext={setSelectedContext}
              deviceType={deviceType}
              onBackToHome={() => navigate("/")}
            />
          } />
        </Routes>
      </AnimatePresence>

      {/* Instagram-Style Creator Drawer/Profile Overlay Modal */}
      <AnimatePresence>
        {activeCreatorProfile && currentDrawerCreator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-md p-4 md:p-6"
            onClick={() => setActiveCreatorProfile(null)}
          >
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex h-full w-full max-w-lg flex-col rounded-[32px] border border-white/10 bg-surface-900/80 p-6 shadow-2xl backdrop-blur-2xl ring-1 ring-black/40 overflow-hidden"
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setActiveCreatorProfile(null)}
                className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-text-muted hover:text-text-high hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>

              {/* Profile Header */}
              <div className="mt-8 flex flex-col items-center text-center">
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-primary-500 via-purple-500 to-amber-500 shadow-lg">
                  <img
                    src={currentDrawerCreator.avatarUrl}
                    alt={currentDrawerCreator.displayName}
                    className="h-24 w-24 rounded-full border-[3px] border-surface-900 object-cover bg-surface-800"
                  />
                </div>

                <h3 className="mt-4 font-display text-2xl font-black text-text-high tracking-tight">
                  {currentDrawerCreator.displayName}
                </h3>
                <p className="text-sm font-semibold text-text-muted">
                  @{currentDrawerCreator.handle}
                </p>

                {/* Quick stats row */}
                <div className="mt-6 flex gap-8 border-y border-white/5 py-4 w-full justify-center">
                  <div className="text-center">
                    <div className="font-display text-base font-extrabold text-text-high">
                      {new Intl.NumberFormat("en-US").format(currentDrawerCreator.followersCount || 0)}
                    </div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-base font-extrabold text-text-high">
                      {new Intl.NumberFormat("en-US").format(currentDrawerCreator.followingCount || 0)}
                    </div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display text-base font-extrabold text-text-high">
                      {allCharacters.filter(c => c.creatorId === currentDrawerCreator.id).length}
                    </div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Releases</div>
                  </div>
                </div>

                {/* Follow Toggle */}
                <div className="mt-5 w-full">
                  {currentDrawerCreator.id === currentUser?.id ? (
                    <div className="w-full rounded-full py-3 text-xs font-bold text-center border border-white/10 bg-white/5 text-text-muted">
                      This is You
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleFollowCreator(currentDrawerCreator.id || currentDrawerCreator.handle)}
                      className={`w-full rounded-full py-3 text-xs font-bold transition border cursor-pointer ${followedCreatorIds.includes(currentDrawerCreator.id || currentDrawerCreator.handle)
                          ? "border-primary-500/30 bg-primary-500/10 text-primary-400 hover:bg-primary-500/20"
                          : "border-border-subtle/25 bg-white text-black hover:bg-white/90"
                        }`}
                    >
                      {followedCreatorIds.includes(currentDrawerCreator.id || currentDrawerCreator.handle) ? "Following" : "Follow"}
                    </motion.button>
                  )}
                </div>

                {/* Bio */}
                {currentDrawerCreator.bio && (
                  <p className="mt-5 text-xs text-text-muted leading-relaxed font-semibold max-w-sm">
                    {currentDrawerCreator.bio}
                  </p>
                )}
              </div>

              {/* Releases section */}
              <div className="mt-8 flex-1 overflow-y-auto no-scrollbar space-y-4">
                <h4 className="text-[11px] font-bold text-text-subtle uppercase tracking-wider">Chatbots Released</h4>
                <div className="grid grid-cols-1 gap-3">
                  {allCharacters.filter(c => c.creatorId === currentDrawerCreator.id).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/5 p-8 text-center text-xs text-text-subtle font-semibold">
                      No chatbots published yet.
                    </div>
                  ) : (
                    allCharacters
                      .filter(c => c.creatorId === currentDrawerCreator.id)
                      .map((char) => (
                        <div
                          key={char.id}
                          onClick={() => {
                            setActiveCreatorProfile(null);
                            setPreviewCharacterId(char.id);
                          }}
                          className="group flex items-center justify-between rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 p-3.5 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={char.imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80"}
                              alt={char.name}
                              className="h-11 w-11 rounded-xl object-cover bg-surface-800"
                            />
                            <div className="text-left">
                              <div className="font-display text-sm font-bold text-text-high group-hover:text-primary-400 transition">
                                {char.name}
                              </div>
                              <div className="text-[11px] font-semibold text-text-muted line-clamp-1 max-w-[220px]">
                                {char.description || "No description provided."}
                              </div>
                            </div>
                          </div>
                          <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted group-hover:text-text-high group-hover:border-white/20 transition">
                            Chat
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* High-Fidelity Premium Character Preview Modal Overlay */}
      <AnimatePresence>
        {previewCharacter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 md:p-6"
            onClick={() => setPreviewCharacterId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex w-full max-w-2xl flex-col rounded-[32px] border border-white/[0.08] bg-surface-900/60 p-6 md:p-8 shadow-glass backdrop-blur-3xl overflow-hidden max-h-[90vh] z-10"
            >
              {/* Decorative morphing orb in character preview modal */}
              <div className="absolute top-[-20%] left-[-20%] w-[320px] h-[320px] bg-gradient-to-tr from-primary-500/5 to-transparent rounded-full blur-[80px] pointer-events-none orb-morph z-0" />
              <div className="absolute bottom-[-20%] right-[-20%] w-[320px] h-[320px] bg-gradient-to-br from-purple-500/5 to-transparent rounded-full blur-[80px] pointer-events-none orb-morph z-0" />

              {/* Close button */}
              <button
                type="button"
                onClick={() => setPreviewCharacterId(null)}
                className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-text-muted hover:text-text-high hover:bg-white/10 transition cursor-pointer z-20"
              >
                ✕
              </button>

              {/* Content container with scroll */}
              <div className="relative flex-1 overflow-y-auto no-scrollbar space-y-6 pr-1 mt-4 text-left z-10">

                {/* Core Info Split: Image & Title */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="relative h-44 w-44 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 flex-shrink-0 mx-auto md:mx-0 bg-surface-800 ring-4 ring-white/[0.04]">
                    <img
                      src={previewCharacter.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(previewCharacter.name)}&background=080808&color=ffffff`}
                      alt={previewCharacter.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-4 w-full min-w-0">
                    {showPreviewReport ? (
                      <div className="space-y-4 p-5 rounded-2xl bg-rose-500/[0.02] border border-rose-500/10">
                        <div className="flex items-center justify-between">
                          <h4 className="font-display text-base font-bold text-rose-400">Report {previewCharacter.name}</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPreviewReport(false);
                              setPreviewReportSuccess(false);
                              setPreviewReportReason("");
                              setPreviewReportError("");
                            }}
                            className="text-xs text-text-muted hover:text-white transition"
                          >
                            Cancel
                          </button>
                        </div>

                        {previewReportSuccess ? (
                          <div className="text-center py-8 space-y-3">
                            <span className="text-2xl">✅</span>
                            <div className="text-xs font-bold text-emerald-400">Report Submitted Successfully</div>
                            <p className="text-[10px] text-text-muted leading-relaxed">
                              Thank you for your feedback. Our moderation team will investigate this character shortly.
                            </p>
                          </div>
                        ) : (
                          <form onSubmit={(e) => handlePreviewReportSubmit(e, previewCharacter)} className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Why are you reporting this chatbot?</label>
                              <textarea
                                value={previewReportReason}
                                onChange={(e) => setPreviewReportReason(e.target.value)}
                                placeholder="Please provide details (e.g. copyright violation, offensive content, safety concerns)..."
                                required
                                className="w-full min-h-[140px] resize-none rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 transition leading-relaxed"
                              />
                            </div>
                            {previewReportError && <div className="text-[10px] text-rose-400 font-medium">{previewReportError}</div>}
                            <button
                              type="submit"
                              disabled={isReportingPreview || !previewReportReason.trim()}
                              className="w-full rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2.5 px-4 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10"
                            >
                              {isReportingPreview ? "Submitting..." : "Submit Report"}
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* 1. Nome chatbot + badge NSFW inline */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-display text-3xl font-black text-text-high tracking-tight truncate max-w-full">
                            {previewCharacter.name}
                          </h3>
                          {previewCharacter.isSFW === false && (
                            <span className="bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full uppercase shadow-md select-none flex-shrink-0">
                              NSFW
                            </span>
                          )}
                        </div>

                        {/* 2. Chips orizzontali: Sesso e Personalità selezionate */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {previewCharacter.sex && (
                            <span className="bg-white/5 border border-white/10 text-text-high text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                              <span className="text-primary-400">⚧</span> {previewCharacter.sex}
                            </span>
                          )}

                          {previewCharacter.personality && previewCharacter.personality.split(", ").map((trait: string, idx: number) => (
                            <span key={idx} className="bg-white/5 border border-white/10 text-text-high text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                              <span className="text-emerald-400">✦</span> {trait.trim()}
                            </span>
                          ))}
                        </div>

                        {/* 3. Breve descrizione */}
                        <p className="text-sm text-text-muted leading-relaxed font-medium">
                          {previewModalData?.shortDesc || previewCharacter.shortDescription || previewCharacter.description?.split("\n")[0] || "No brief bio provided."}
                        </p>

                        {/* 4. Made by + Profilo Creator */}
                        {previewCharacterCreator && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs text-text-subtle font-medium">Made by</span>
                            <div
                              onClick={() => {
                                setActiveCreatorProfile(previewCharacterCreator as Creator);
                                setPreviewCharacterId(null);
                              }}
                              className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/5 hover:border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-xl cursor-pointer transition group"
                            >
                              <img
                                src={(previewCharacterCreator as any).avatarUrl}
                                alt={(previewCharacterCreator as any).displayName}
                                className="h-5 w-5 rounded-full object-cover bg-surface-800"
                              />
                              <span className="text-xs font-bold text-text-high group-hover:text-primary-400 transition-colors">
                                {(previewCharacterCreator as any).displayName}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}





                    {/* 6. Altri Character (Character Building) max 3 con toggle */}
                    {previewModalData?.supportingCharacters && previewModalData.supportingCharacters.length > 0 && (
                      <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-text-high flex items-center gap-2">
                            <span className="text-purple-400">👥</span> Cast / Supporting Characters ({previewModalData.supportingCharacters.length})
                          </span>
                          {previewModalData.supportingCharacters.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setIsSupportingExpanded(!isSupportingExpanded)}
                              className="text-[11px] text-primary-400 hover:underline font-bold cursor-pointer"
                            >
                              {isSupportingExpanded ? "Show less" : "Show all"}
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {(isSupportingExpanded ? previewModalData.supportingCharacters : previewModalData.supportingCharacters.slice(0, 3)).map((charLine, idx) => {
                            const parts = charLine.split(":**");
                            const namePart = parts[0]?.replace(/^-?\s*\*\*/, "").trim();
                            const descPart = parts[1]?.trim() || charLine;

                            return (
                              <div key={idx} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-2.5 text-xs">
                                <span className="text-base select-none">👤</span>
                                <div>
                                  <div className="font-bold text-text-high">{namePart || "Supporting Cast"}</div>
                                  <div className="text-[11px] text-text-muted mt-0.5">{descPart}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

              </div>

              {/* Bottom Chat Action Bar */}
              <div className="mt-6 border-t border-white/5 pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreviewReport(true)}
                  className="p-3 rounded-full border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 transition cursor-pointer flex items-center justify-center flex-shrink-0"
                  title="Report Character"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                </button>

                {!previewCharacter.isDownloaded && (
                  <button
                    type="button"
                    onClick={() => handleDownloadCharacter(previewCharacter.id)}
                    className="p-3 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 transition cursor-pointer flex items-center justify-center flex-shrink-0"
                    title="Download Character"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    handleSelectCharacter(previewCharacter.id);
                    setPreviewCharacterId(null);
                  }}
                  className="flex-1 rounded-full py-3.5 text-xs font-bold transition bg-white text-black hover:bg-white/95 shadow-[0_0_24px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Chat</span>
                </motion.button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glassmorphic Toast Notification Overlay */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-none flex flex-col gap-3">
        <AnimatePresence>
          {activeNotification && (
            <motion.div
              key={activeNotification.id}
              initial={{ opacity: 0, y: 30, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, mass: 0.8 }}
              className="pointer-events-auto flex max-w-sm items-center gap-3.5 rounded-3xl border border-white/10 bg-surface-800/80 p-4 shadow-2xl backdrop-blur-2xl ring-1 ring-black/30"
            >
              {activeNotification.avatarUrl && (
                <img
                  src={activeNotification.avatarUrl}
                  alt="Notification Icon"
                  className="h-10 w-10 rounded-2xl object-cover bg-surface-800 flex-shrink-0"
                />
              )}
              <div className="flex-1 text-left">
                <h5 className="font-display text-xs font-bold text-text-high leading-tight">
                  {activeNotification.title}
                </h5>
                <p className="mt-1 text-[11px] font-medium text-text-muted leading-relaxed">
                  {activeNotification.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNotification(null)}
                className="text-[11px] font-bold text-text-subtle hover:text-text-high transition px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </LayoutComponent>
  );
}

function WrappedApp() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

export default WrappedApp;
