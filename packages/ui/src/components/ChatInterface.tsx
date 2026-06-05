"use client";
const hasHover = typeof window !== "undefined" && window.innerWidth >= 1024;

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

const ReadMoreText: React.FC<{ text: string; maxChars?: number }> = ({ text, maxChars = 140 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (text.length <= maxChars) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
  return (
    <span className="whitespace-pre-wrap">
      {isExpanded ? text : `${text.slice(0, maxChars)}... `}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="text-primary-400 font-bold hover:underline inline ml-1 text-[11px] cursor-pointer"
      >
        {isExpanded ? "Read less" : "Read more"}
      </button>
    </span>
  );
};

export type ChatMessage = {
  role: "user" | "ai";
  content: string;
};

export type ChatBot = {
  id: string;
  name: string;
  avatarUrl?: string;
  lastMessage?: string;
  greeting?: string;
  hasUserMessage?: boolean;
};

type ChatInterfaceProps = {
  characterName?: string;
  initialMessages: ChatMessage[];
  messages?: ChatMessage[];
  setMessages?: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onSend?: (text: string, rawTextWithDirectives?: string) => Promise<void> | void;
  botsHistory?: ChatBot[];
  onSelectBot?: (id: string) => void;
  listOnly?: boolean;
  archivedOnly?: boolean;
  onBack?: () => void;
  onOpenArchived?: () => void;
  onOpenLibrary?: () => void;
  libraryOnly?: boolean;
  localCharacters?: any[];
  onSelectCharacter?: (id: string) => void;
  onDownloadCharacter?: (id: string) => void;
  onNewChat?: () => void;
  memoryEntries?: MemoryEntry[];
  onAddMemory?: (title: string, content: string) => void;
  onRemoveMemory?: (id: string) => void;
  onUpdateMemory?: (id: string, title: string, content: string) => void;
  onDeleteChat?: (id: string) => void;
  onDeleteDownloadedCharacter?: (id: string) => void;
  allCharacters?: any[];
  currentUser?: any;
  onTalkOnDiscord?: (botName: string) => void;
  onRunLocalInference?: (characterId: string, conversationId: string, userMessage: string) => Promise<string>;
  onSaveLocalMessage?: (characterId: string, conversationId: string, role: string, content: string) => Promise<void>;
  worldEntries?: WorldEntry[];
  worldLore?: any[];
  onAddLocation?: (name: string, description: string) => void;
  onRemoveLocation?: (id: string) => void;
  checkpoints?: any[];
  onCreateCheckpoint?: (name: string) => Promise<void> | void;
  onRestoreCheckpoint?: (id: string) => Promise<void> | void;
  onDeleteCheckpoint?: (id: string) => Promise<void> | void;
  onSelectCreator?: (creator: any) => void;
  creators?: any[];
};

type MultiCharacterForm = {
  name: string;
  description: string;
  sex: string;
  isSFW: boolean;
  personality: string;
  hairColor: string;
  eyeColor: string;
  skinColor: string;
  clothes: string;
  clothesSets: string[];
  body: string;
  gadgets: string;
  greeting: string;
};

type MemoryEntry = {
  id: string;
  title: string;
  content: string;
};

type WorldEntry = {
  id: string;
  name: string;
  description: string;
};

type AppEntry = {
  id: string;
  title: string;
  description: string;
  category: string;
  imageName?: string;
};

type ConversationPreview = {
  bot: ChatBot;
  time: string;
  unread?: number;
  online: boolean;
  preview: string;
  typing?: boolean;
};

function parseChatContent(text: string, isUser = false) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;
  const baseColorClass = isUser ? "text-black" : "text-white";

  while (remaining.length > 0) {
    const patterns = [
      { regex: /\[IMG_B64:\s*([^\]]+)\]/, type: "image" },
      { regex: /\^([^\^]+)\^/, type: "character" },
      { regex: /\*([^\*]+)\*/, type: "action" },
      { regex: /\[([^\]]+)\]/, type: "place" },
      { regex: /"([^"]+)"/, type: "speech" },
    ];

    let earliestMatch: { index: number; match: RegExpMatchArray; type: string } | null = null;

    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = { index: match.index, match, type: pattern.type };
        }
      }
    }

    if (earliestMatch) {
      if (earliestMatch.index > 0) {
        parts.push(<span key={keyIndex++} className={baseColorClass}>{remaining.slice(0, earliestMatch.index)}</span>);
      }

      const content = earliestMatch.match[1];
      const fullMatch = earliestMatch.match[0];

      switch (earliestMatch.type) {
        case "image":
          parts.push(
            <img key={keyIndex++} src={content} alt="User Upload" className="max-w-xs rounded-lg mb-2" />
          );
          break;
        case "character":
          parts.push(
            <span key={keyIndex++} className={`font-bold ${isUser ? "text-black" : "text-cyan-300"}`}>
              {fullMatch}
            </span>,
          );
          break;
        case "action":
          parts.push(
            <span key={keyIndex++} className={`italic ${isUser ? "text-black opacity-60" : "text-white/50"}`}>
              {fullMatch}
            </span>,
          );
          break;
        case "place":
          parts.push(
            <span key={keyIndex++} className={`underline ${isUser ? "text-black" : "text-emerald-400"}`}>
              {fullMatch}
            </span>,
          );
          break;
        case "speech":
          parts.push(
            <span key={keyIndex++} className={baseColorClass}>
              {fullMatch}
            </span>,
          );
          break;
      }


      remaining = remaining.slice(earliestMatch.index + earliestMatch.match[0].length);
    } else {
      parts.push(<span key={keyIndex++} className={baseColorClass}>{remaining}</span>);
      break;
    }
  }

  return <>{parts}</>;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M10 11v6m4-6v6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="m22 2-7 20-4-9-9-4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M22 2 11 13" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M6 18V6l8.5 6L6 18z" fill="currentColor" />
      <rect x="16" y="6" width="2" height="12" fill="currentColor" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M4 7h16M6 7l1 11h10l1-11M9 11h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 4h8l1 3H7l1-3Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M6 6h10M6 10h10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="m4 20 4.5-1 9.7-9.7a2.1 2.1 0 0 0 0-3L17.7 5a2.1 2.1 0 0 0-3 0L5 14.7 4 20Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m13.5 6.5 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M10.2 4.7h3.6l.5 1.8a7.4 7.4 0 0 1 1.5.9l1.8-.5 1.8 3.1-1.3 1.3c.1.5.1 1 .1 1.5s0 1-.1 1.5l1.3 1.3-1.8 3.1-1.8-.5a7.4 7.4 0 0 1-1.5.9l-.5 1.8h-3.6l-.5-1.8a7.4 7.4 0 0 1-1.5-.9l-1.8.5-1.8-3.1 1.3-1.3a8.8 8.8 0 0 1 0-3l-1.3-1.3 1.8-3.1 1.8.5a7.4 7.4 0 0 1 1.5-.9l.5-1.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function buildAvatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111111&color=ffffff`;
}

function buildDefaultCharacterForm(name = ""): MultiCharacterForm {
  return {
    name,
    description: "",
    sex: "",
    isSFW: true,
    personality: "",
    hairColor: "#000000",
    eyeColor: "#000000",
    skinColor: "#F5DEB3",
    clothes: "",
    clothesSets: [],
    body: "",
    gadgets: "",
    greeting: "",
  };
}

function SettingsSectionTitle({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm leading-6 text-text-muted">{desc}</div>
    </div>
  );
}

function buildPreviews(botsHistory: ChatBot[], activeName: string, messages: ChatMessage[]): ConversationPreview[] {
  const times = ["9:30 AM", "9:15 AM", "8:50 AM", "8:00 AM", "7:40 AM", "7:35 AM", "7:10 AM", "6:55 AM"];

  return botsHistory.map((bot, index) => {
    let previewText = "";
    if (bot.name === activeName && messages.length > 0) {
      previewText = messages[messages.length - 1]?.content ?? bot.lastMessage ?? bot.greeting ?? "";
    } else {
      previewText = bot.lastMessage ?? bot.greeting ?? "";
    }

    return {
      bot,
      time: times[index % times.length],
      unread: undefined,
      online: false,
      preview: previewText,
      typing: false,
    };
  });
}

export default function ChatInterface({
  characterName,
  initialMessages,
  messages,
  setMessages,
  onSend,
  botsHistory = [],
  onSelectBot,
  listOnly = false,
  archivedOnly = false,
  onBack,
  onOpenArchived,
  onOpenLibrary,
  libraryOnly = false,
  localCharacters = [],
  onSelectCharacter,
  onDownloadCharacter,
  onNewChat,
  memoryEntries: externalMemoryEntries,
  onAddMemory,
  onRemoveMemory,
  onUpdateMemory,
  onDeleteChat,
  onDeleteDownloadedCharacter,
  allCharacters = [],
  currentUser,
  onTalkOnDiscord,
  onRunLocalInference,
  onSaveLocalMessage,
  worldEntries: externalWorldEntries,
  worldLore,
  onAddLocation,
  onRemoveLocation,
  checkpoints = [],
  onCreateCheckpoint,
  onRestoreCheckpoint,
  onDeleteCheckpoint,
  onSelectCreator,
  creators = [],
}: ChatInterfaceProps) {
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(initialMessages);
  const [newCheckpointName, setNewCheckpointName] = useState("");
  const [text, setText] = useState("");
  const [showWikiGraph, setShowWikiGraph] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState<any>(null);
  const [responseStyle, setResponseStyle] = useState<'normale' | 'breve' | 'dettagliato'>('normale');
  const [imageB64, setImageB64] = useState<string | null>(null);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const selectedContext = (typeof window !== "undefined" && window.localStorage.getItem("klie.selectedContext")) || "8K";
        let max_size = 512;
        if (selectedContext === "4K") {
          max_size = 384;
        } else if (selectedContext === "8K") {
          max_size = 512;
        } else if (selectedContext === "16K") {
          max_size = 768;
        } else if (selectedContext === "32K") {
          max_size = 1024;
        }

        if (width > height) {
          if (width > max_size) {
            height *= max_size / width;
            width = max_size;
          }
        } else {
          if (height > max_size) {
            width *= max_size / height;
            height = max_size;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setImageB64(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };


  const [query, setQuery] = useState("");
  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("klie.archivedChats");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("klie.deletedChats");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [messageToolsOpen, setMessageToolsOpen] = useState(false);
  const [bubbleMode, setBubbleMode] = useState<"edit" | "prompt" | null>(null);
  const [editorText, setEditorText] = useState("");
  const [behaviorPrompt, setBehaviorPrompt] = useState("");
  const [lastAiTag, setLastAiTag] = useState<string | null>(null);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const headerTriggerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<any>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  const handleDeleteSelected = async () => {
    if (!onDeleteChat) return;
    for (const id of selectedChatIds) {
      await onDeleteChat(id);
    }
    setSelectedChatIds([]);
    setSelectMode(false);
  };

  const handleMouseEnter = () => {
    if (!hasHover) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (!hasHover) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setDetailsOpen(false);
    }, 150);
  };

  useEffect(() => {
    if (!detailsOpen) return;
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        detailsRef.current &&
        !detailsRef.current.contains(target) &&
        headerTriggerRef.current &&
        !headerTriggerRef.current.contains(target)
      ) {
        setDetailsOpen(false);
      }
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [detailsOpen]);

  const [chatSettingsTab, setChatSettingsTab] = useState<"multi" | "memory" | "world" | "character" | "internet" | "ai" | "report" | "checkpoints">("multi");
  const [mobileTabDropdownOpen, setMobileTabDropdownOpen] = useState(false);
  const [addingType, setAddingType] = useState<"memory" | "world" | "checkpoint" | null>(null);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryEntry | null>(null);
  const [multiMode, setMultiMode] = useState<"create" | "import">("create");
  const [multiForm, setMultiForm] = useState<MultiCharacterForm>(buildDefaultCharacterForm());
  const [localMemoryEntries, setLocalMemoryEntries] = useState<MemoryEntry[]>([]);
  const memoryEntries = externalMemoryEntries ?? localMemoryEntries;
  const setMemoryEntries = setLocalMemoryEntries;

  // Generate nodes and links from worldLore
  const graphData = useMemo(() => {
    if (!showWikiGraph) return { nodes: [], links: [] };

    const nodes: any[] = [];
    const links: any[] = [];

    // 1. Add center active character node
    const mainNodeId = "center-bot";
    nodes.push({
      id: mainNodeId,
      name: characterName || "Character",
      category: "CENTER",
      description: "Active bot persona driving this conversation.",
      color: "from-amber-400 to-orange-500 shadow-amber-500/50"
    });

    // 2. Parse connections from Wiki Index row
    const wikiRow = worldLore?.find((x: any) => x.category === "INDEX");
    const parsedLinks: { source: string; target: string; type?: string }[] = [];

    if (wikiRow && wikiRow.content) {
      const lines = wikiRow.content.split("\n");
      for (const line of lines) {
        // Try parsing "A -> B" or "A => B"
        const arrowMatch = line.match(/([^-=\n]+)(?:->|=>)([^-=\n]+)/);
        if (arrowMatch) {
          const srcName = arrowMatch[1].replace(/[-*#]/g, "").trim();
          const tgtName = arrowMatch[2].replace(/[-*#]/g, "").trim();
          if (srcName && tgtName) {
            parsedLinks.push({ source: srcName, target: tgtName });
          }
        }
      }
    }

    // 3. Collect all entities (locations, characters, etc.) from worldLore
    const rawEntities = worldLore?.filter((x: any) => x.category !== "INDEX") || [];

    // Helper to find or create a node by name
    const getOrCreateNode = (name: string, category: string, defaultDesc = "") => {
      let existing = nodes.find(n => n.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        // Find matching entity details if stored in worldLore
        const matchingEntity = rawEntities.find((e: any) => e.title.toLowerCase() === name.toLowerCase());
        const desc = matchingEntity?.content || defaultDesc;
        const cat = matchingEntity?.category || category;
        
        let color = "from-teal-400 to-emerald-500 shadow-teal-500/50";
        if (cat === "LOCATION") color = "from-cyan-400 to-blue-500 shadow-cyan-500/50";
        if (cat === "CHARACTER") color = "from-purple-400 to-fuchsia-500 shadow-purple-500/50";

        existing = {
          id: `node-${nodes.length}`,
          name,
          category: cat,
          description: desc || `Fictional entity discovered during roleplay.`,
          color
        };
        nodes.push(existing);
      }
      return existing;
    };

    // 4. Map parsed links to actual nodes
    for (const link of parsedLinks) {
      const srcNode = getOrCreateNode(link.source, "ENTITY");
      const tgtNode = getOrCreateNode(link.target, "ENTITY");
      links.push({
        source: srcNode.id,
        target: tgtNode.id,
        sourceName: srcNode.name,
        targetName: tgtNode.name
      });
    }

    // 5. Fallback orbital connections if index is empty
    if (links.length === 0) {
      // Connect all locations and supporting characters to center node
      for (const ent of rawEntities) {
        const cat = ent.category || "LOCATION";
        let color = "from-cyan-400 to-blue-500 shadow-cyan-500/50";
        if (cat === "CHARACTER") color = "from-purple-400 to-fuchsia-500 shadow-purple-500/50";
        
        const node = {
          id: `node-${nodes.length}`,
          name: ent.title,
          category: cat,
          description: ent.content || "",
          color
        };
        nodes.push(node);
        links.push({
          source: mainNodeId,
          target: node.id,
          sourceName: characterName || "Character",
          targetName: node.name
        });
      }
    }

    // 6. Compute orbital circular positions for all nodes
    const centerX = 250;
    const centerY = 250;
    const totalNodes = nodes.length;

    nodes.forEach((node, index) => {
      if (node.id === mainNodeId) {
        node.x = centerX;
        node.y = centerY;
      } else {
        const angle = ((index - 1) / (totalNodes - 1)) * Math.PI * 2;
        const distance = totalNodes > 6 ? 150 : 120;
        node.x = centerX + Math.cos(angle) * distance;
        node.y = centerY + Math.sin(angle) * distance;
      }
    });

    return { nodes, links };
  }, [showWikiGraph, worldLore, characterName]);

  const [memoryEditId, setMemoryEditId] = useState<string | null>(null);
  const [newMemKey, setNewMemKey] = useState("");
  const [newMemVal, setNewMemVal] = useState("");
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaPersonality, setNewPersonaPersonality] = useState("");
  const [personaFilter, setPersonaFilter] = useState<"all" | "my">("all");
  const [userPersona, setUserPersona] = useState(() => {
    const saved = localStorage.getItem("klie.userPersona");
    if (!saved) return { name: "User", sex: "", description: "", personality: "", body: "", clothing: "", gadgets: "" };
    try {
      const parsed = JSON.parse(saved);
      return {
        name: parsed.name || "User",
        sex: parsed.sex || "",
        description: parsed.description || "",
        personality: parsed.personality || "",
        body: parsed.body || "",
        clothing: parsed.clothing || "",
        gadgets: parsed.gadgets || "",
      };
    } catch {
      return { name: "User", sex: "", description: "", personality: "", body: "", clothing: "", gadgets: "" };
    }
  });
  const [localWorldEntries, setLocalWorldEntries] = useState<WorldEntry[]>([]);
  const worldEntries = externalWorldEntries ?? localWorldEntries;
  const [worldDraft, setWorldDraft] = useState({ name: "", description: "" });
  const [worldEditId, setWorldEditId] = useState<string | null>(null);
  const [worldEditDraft, setWorldEditDraft] = useState<WorldEntry | null>(null);
  const [characterEdits, setCharacterEdits] = useState<Record<string, MultiCharacterForm>>({});
  const [characterOutfitDrafts, setCharacterOutfitDrafts] = useState<Record<string, string>>({});
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [createdChatCharacters, setCreatedChatCharacters] = useState<
    Array<MultiCharacterForm & { id: string; avatarUrl: string }>
  >([]);
  const [internetApps, setInternetApps] = useState<AppEntry[]>([
    { id: "app-1", title: "Notes", description: "Quick memory capture and recall.", category: "Utility" },
    { id: "app-2", title: "Browser", description: "Look up references and sources.", category: "Web" },
  ]);
  const [appFormOpen, setAppFormOpen] = useState(false);
  const [appEditingId, setAppEditingId] = useState<string | null>(null);
  const [appEditDraft, setAppEditDraft] = useState<AppEntry | null>(null);
  const [newApp, setNewApp] = useState({
    title: "",
    description: "",
    category: "",
    imageName: "",
  });
  const activeName = characterName ?? "";

  const msgs = messages ?? localMessages;
  const setMsgs = setMessages ?? setLocalMessages;

  const displayedBots = useMemo(
    () => botsHistory.filter((bot) => {
      if (archivedIds.includes(bot.id) || deletedIds.includes(bot.id)) return false;
      const isNewEmpty = !bot.lastMessage || bot.lastMessage === "Start your Chat" || bot.lastMessage === "Start your chat";
      return bot.hasUserMessage || !isNewEmpty;
    }).slice(0, 12),
    [archivedIds, botsHistory, deletedIds],
  );
  const archivedBots = useMemo(
    () => botsHistory.filter((bot) => archivedIds.includes(bot.id) && !deletedIds.includes(bot.id)).slice(0, 12),
    [archivedIds, botsHistory, deletedIds],
  );
  const previews = useMemo(() => buildPreviews(displayedBots, activeName, msgs), [activeName, displayedBots, msgs]);
  const archivedPreviews = useMemo(() => buildPreviews(archivedBots, activeName, msgs), [activeName, archivedBots, msgs]);
  const filteredPreviews = useMemo(
    () => previews.filter(({ bot }) => bot.name.toLowerCase().includes(query.trim().toLowerCase())),
    [previews, query],
  );
  const storyBots = useMemo(() => displayedBots.slice(0, 6), [displayedBots]);
  const activeBot = useMemo(
    () => botsHistory.find((bot) => bot.name === activeName) ?? null,
    [activeName, botsHistory],
  );

  const activeCharDetails = useMemo(() => {
    if (!activeBot) return null;
    return allCharacters.find((c: any) => c.id === activeBot.id || c.name.toLowerCase() === activeBot.name.toLowerCase()) || null;
  }, [activeBot, allCharacters]);

  const activeCreator = useMemo(() => {
    if (!activeCharDetails || !creators) return null;
    return creators.find((c: any) => c.id === activeCharDetails.creatorId || c.displayName === activeCharDetails.creatorName) || {
      id: activeCharDetails.creatorId || "placeholder",
      displayName: activeCharDetails.creatorName || "Unknown Creator",
      handle: (activeCharDetails.creatorName || "creator").toLowerCase().replace(/\s+/g, ""),
      totalPoints: 0,
      avatarUrl: `https://ui-avatars.com/api/?name=${activeCharDetails.creatorName || "Creator"}&background=random`,
      rank: 0
    };
  }, [activeCharDetails, creators]);

  // ─── Discord Live Bot Status Sync (Global Worker) ───
  const [discordBotStatus, setDiscordBotStatus] = useState<"disconnected" | "connecting" | "connected" | "error">(() => {
    return (window as any).__klieDiscordStatus || "disconnected";
  });
  const [discordBotError, setDiscordBotError] = useState<string | null>(() => {
    return (window as any).__klieDiscordError || null;
  });

  useEffect(() => {
    const handleStatus = (e: any) => {
      setDiscordBotStatus(e.detail.status);
      setDiscordBotError(e.detail.error);
    };
    window.addEventListener("klie_discord_status", handleStatus);
    return () => {
      window.removeEventListener("klie_discord_status", handleStatus);
    };
  }, []);

  // Per-conversation Discord Active Toggle (default off)
  const [discordEnabled, setDiscordEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`klie_discord_enabled_conv_${activeBot?.id}`) === "true";
  });

  // Sync toggle state when character/conversation changes
  useEffect(() => {
    if (activeBot?.id) {
      setDiscordEnabled(localStorage.getItem(`klie_discord_enabled_conv_${activeBot?.id}`) === "true");
    }
  }, [activeBot?.id]);

  const handleToggleDiscord = useCallback((val: boolean) => {
    if (!activeBot?.id) return;
    setDiscordEnabled(val);
    localStorage.setItem(`klie_discord_enabled_conv_${activeBot?.id}`, val ? "true" : "false");
  }, [activeBot?.id]);
  const importedCharacters = useMemo(() => {
    const list = allCharacters.filter((bot) => selectedImportIds.includes(bot.id) && bot.id !== activeBot?.id);
    return list.map(c => ({
      id: c.id,
      name: c.name,
      avatarUrl: c.imageUrl || "",
      description: c.description || "",
    }));
  }, [activeBot?.id, allCharacters, selectedImportIds]);
  const chatCharacters = useMemo(
    () => [activeBot, ...importedCharacters, ...createdChatCharacters].filter(Boolean) as Array<
      ChatBot | (MultiCharacterForm & { id: string; avatarUrl: string })
    >,
    [activeBot, importedCharacters, createdChatCharacters],
  );
  const availablePersonas = useMemo(() => {
    const activeNameLower = activeName.toLowerCase();
    let list = allCharacters.filter(c => c.name.toLowerCase() !== activeNameLower);

    if (personaFilter === "my") {
      const userDisplayName = currentUser?.displayName || "";
      const userId = currentUser?.id || "";
      list = list.filter(c => 
        (c.creatorId && c.creatorId === userId) ||
        (c.creatorName && c.creatorName.toLowerCase() === userDisplayName.toLowerCase()) ||
        (c.ownerId && c.ownerId === userId)
      );
    }

    const seen = new Set();
    return list.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [allCharacters, activeName, personaFilter, currentUser]);
  const activeCharacterConfig = useMemo(
    () => characterEdits[activeBot?.id ?? ""] ?? {
      name: activeBot?.name ?? "",
      description: "",
      sex: "",
      isSFW: true,
      personality: "",
      hairColor: "#000000",
      eyeColor: "#000000",
      skinColor: "#F5DEB3",
      clothes: "",
      clothesSets: [],
      body: "",
      gadgets: "",
      greeting: "",
    },
    [activeBot?.id, activeBot?.name, characterEdits],
  );
  const selectedChatCharacter = useMemo(
    () =>
      chatCharacters.find(
        (character) => character.id === (selectedCharacterId || activeBot?.id || ""),
      ) ?? null,
    [activeBot?.id, chatCharacters, selectedCharacterId],
  );
  const theme = typeof document === "undefined" ? "midnight-glass" : document.documentElement.getAttribute("data-theme") || "midnight-glass";
  const themeClass = theme === "light" ? "klie-chat-theme-light" : theme === "oled-black" ? "klie-chat-theme-oled" : "klie-chat-theme-default";
  const chatThemeStyles = (
    <style>{`
      /* ─── Global container theme overrides ─── */
      section.klie-chat-theme-light {
        background-color: hsl(var(--surface-900)) !important;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.05) !important;
        ring-color: rgba(0, 0, 0, 0.08) !important;
      }
      section.klie-chat-theme-oled {
        background-color: #000000 !important;
        box-shadow: none !important;
        ring-color: rgba(255, 255, 255, 0.06) !important;
      }
      section.klie-chat-theme-default {
        background-color: hsl(var(--surface-900)) !important;
        ring-color: rgba(255, 255, 255, 0.06) !important;
      }

      /* ─── Light Mode Overrides ─── */
      .klie-chat-theme-light .bg-black {
        background-color: hsl(var(--surface-900)) !important;
      }

      .klie-chat-theme-light .bg-black\\/95,
      .klie-chat-theme-light .bg-black\\/92,
      .klie-chat-theme-light .bg-black\\/90,
      .klie-chat-theme-light .bg-black\\/70 {
        background-color: rgba(255, 255, 255, 0.93) !important;
      }

      .klie-chat-theme-light .bg-black\\/40 {
        background-color: rgba(0, 0, 0, 0.02) !important;
      }

      .klie-chat-theme-light .bg-white\\/\\[0\\.03\\],
      .klie-chat-theme-light .bg-white\\/\\[0\\.04\\],
      .klie-chat-theme-light .bg-white\\/\\[0\\.05\\],
      .klie-chat-theme-light .bg-white\\/\\[0\\.06\\],
      .klie-chat-theme-light .bg-white\\/\\[0\\.08\\],
      .klie-chat-theme-light .bg-white\\/\\[0\\.1\\],
      .klie-chat-theme-light .bg-white\\/5,
      .klie-chat-theme-light .bg-white\\/10 {
        background-color: rgba(0, 0, 0, 0.03) !important;
      }

      .klie-chat-theme-light,
      .klie-chat-theme-light * {
        text-shadow: none !important;
        box-shadow: none !important;
        filter: none !important;
      }

      .klie-chat-theme-light .border-white\\/6,
      .klie-chat-theme-light .border-white\\/8,
      .klie-chat-theme-light .border-white\\/10,
      .klie-chat-theme-light .border-white\\/20,
      .klie-chat-theme-light .ring-white\\/10 {
        border-color: rgba(0, 0, 0, 0.08) !important;
        ring-color: rgba(0, 0, 0, 0.08) !important;
      }

      .klie-chat-theme-light .text-white {
        color: hsl(var(--text-high)) !important;
      }

      .klie-chat-theme-light .text-white\\/35,
      .klie-chat-theme-light .text-white\\/40,
      .klie-chat-theme-light .text-white\\/50 {
        color: rgba(0, 0, 0, 0.45) !important;
      }

      .klie-chat-theme-light .klie-chat-bubble-ai {
        background-color: rgba(0, 0, 0, 0.03) !important;
        color: hsl(var(--text-high)) !important;
        border: 1px solid rgba(0, 0, 0, 0.04) !important;
      }

      .klie-chat-theme-light .klie-chat-bubble-user {
        background-color: hsl(var(--surface-800)) !important;
        color: hsl(var(--text-high)) !important;
        border: 1px solid rgba(0, 0, 0, 0.06) !important;
      }

      .klie-chat-theme-light .klie-chat-header,
      .klie-chat-theme-light .klie-chat-message-area {
        background-color: hsl(var(--surface-900)) !important;
      }

      .klie-chat-theme-light .klie-chat-composer {
        background-color: rgba(0, 0, 0, 0.02) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
      }

      .klie-chat-theme-light .klie-chat-floating-panel,
      .klie-chat-theme-light .klie-chat-settings-panel {
        background-color: hsl(var(--surface-900)) !important;
        border-color: rgba(0, 0, 0, 0.08) !important;
      }

      .klie-chat-theme-light .klie-chat-settings-panel input,
      .klie-chat-theme-light .klie-chat-settings-panel textarea {
        background-color: #ffffff !important;
        color: hsl(var(--text-high)) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
      }

      .klie-chat-theme-light .klie-chat-settings-panel .bg-white,
      .klie-chat-theme-light .klie-chat-settings-panel .bg-white\\/\\[0\\.08\\] {
        background-color: rgba(0, 0, 0, 0.04) !important;
        color: hsl(var(--text-high)) !important;
      }

      /* ─── OLED Pure Black overrides ─── */
      .klie-chat-theme-oled,
      .klie-chat-theme-oled .klie-chat-header,
      .klie-chat-theme-oled .klie-chat-message-area,
      .klie-chat-theme-oled .klie-chat-floating-panel,
      .klie-chat-theme-oled .klie-chat-settings-panel,
      .klie-chat-theme-oled aside {
        background-color: #000000 !important;
      }
      .klie-chat-theme-oled .border-white\\/6,
      .klie-chat-theme-oled .border-white\\/8,
      .klie-chat-theme-oled .border-white\\/10,
      .klie-chat-theme-oled .border-white\\/20,
      .klie-chat-theme-oled .ring-white\\/10 {
        border-color: rgba(255, 255, 255, 0.08) !important;
        ring-color: rgba(255, 255, 255, 0.08) !important;
      }
      .klie-chat-theme-oled .klie-chat-bubble-ai {
        background-color: #121212 !important;
        border-color: rgba(255, 255, 255, 0.08) !important;
      }
      .klie-chat-theme-oled .klie-chat-bubble-user {
        background-color: #1c1c1e !important;
        border-color: rgba(255, 255, 255, 0.12) !important;
      }
      .klie-chat-theme-oled .klie-chat-composer {
        background-color: #121212 !important;
        border-color: rgba(255, 255, 255, 0.08) !important;
      }
    `}</style>
  );
  const lastAiMessageIndex = useMemo(() => {
    for (let index = msgs.length - 1; index >= 0; index -= 1) {
      if (msgs[index]?.role === "ai") return index;
    }
    return -1;
  }, [msgs]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("klie.archivedChats", JSON.stringify(archivedIds));
    }
  }, [archivedIds]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("klie.deletedChats", JSON.stringify(deletedIds));
    }
  }, [deletedIds]);

  const handleArchive = (id: string) => {
    setArchivedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleRestore = (id: string) => {
    setArchivedIds((prev) => prev.filter((item) => item !== id));
  };

  const handleDelete = (id: string) => {
    setDeletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    onDeleteChat?.(id);
  };

  const handleSend = async () => {
    const cleanUserText = text.trim();
    if (!cleanUserText) return;
    
    let processedText = cleanUserText;
    
    if (responseStyle === 'breve') {
      processedText += "\n\n[System Directive: Your response MUST be extremely brief. Limit: strictly maximum 1 or 2 short sentences.]";
    } else if (responseStyle === 'normale') {
      processedText += "\n\n[System Directive: Your response MUST be normal in length. Limit: strictly maximum 1 or 2 medium paragraphs. Do not write a long, detailed, or overly verbose response.]";
    } else if (responseStyle === 'dettagliato') {
      processedText += "\n\n[System Directive: Your response MUST be highly detailed, descriptive, and verbose. Write multiple detailed paragraphs as needed.]";
    }
    
    if (imageB64) {
      processedText = `[IMG_B64: ${imageB64}] ` + processedText;
    }

    const userMsg: ChatMessage = { role: "user", content: cleanUserText };
    setMsgs((prev) => [...prev, userMsg]);
    setText("");
    setImageB64(null);
    
    try {
      await onSend?.(cleanUserText, processedText);
    } catch (err) {
      console.warn("send failed", err);
    }
  };


  const updateLastAiMessage = (nextContent: string) => {
    if (lastAiMessageIndex < 0) return;
    setMsgs((prev) =>
      prev.map((message, index) => (index === lastAiMessageIndex ? { ...message, content: nextContent } : message)),
    );
  };

  const rewriteMessage = (content: string) => {
    const normalized = content.trim().replace(/\s+/g, " ");
    const replacements: Array<[RegExp, string]> = [
      [/\bProvide me a new project\b/i, "Please provide me with a new project"],
      [/\bProject is done\b/i, "The project is complete"],
      [/\bReview the UI updates\b/i, "Please review the UI updates"],
      [/\bDid not get your point\b/i, "I did not fully understand your point"],
    ];

    let next = normalized;
    for (const [pattern, replacement] of replacements) {
      if (pattern.test(next)) {
        next = next.replace(pattern, replacement);
        break;
      }
    }

    if (next === normalized) {
      next = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      if (!/[.!?]$/.test(next)) next = `${next}.`;
    }

    return next;
  };

  const openTools = () => {
    setMessageToolsOpen((prev) => !prev);
  };

  const rewriteLastAiMessage = () => {
    if (lastAiMessageIndex < 0) return;
    updateLastAiMessage(rewriteMessage(msgs[lastAiMessageIndex]?.content ?? ""));
    setLastAiTag("rewrited");
    setMessageToolsOpen(false);
    setBubbleMode(null);
  };

  const saveEditedLastAiMessage = () => {
    updateLastAiMessage(editorText.trim() || editorText);
    setLastAiTag(null);
    setMessageToolsOpen(false);
    setBubbleMode(null);
  };

  const steerLastAiMessage = () => {
    if (!behaviorPrompt.trim()) return;
    // We reuse handleSend by prepending a hidden instruction if we wanted AI to rewrite,
    // but the user wants to "Rewrite that message with this prompt".
    // For now, let's just trigger a new AI response with the prompt context.
    onSend?.(`[REWRITE LAST MESSAGE WITH PROMPT: ${behaviorPrompt.trim()}]`);
    setMessageToolsOpen(false);
    setBubbleMode(null);
    setBehaviorPrompt("");
  };
  
  const triggerRewrite = () => {
    onSend?.("[REWRITE LAST MESSAGE]");
    setMessageToolsOpen(false);
  };

  const closeMessageTools = () => {
    setMessageToolsOpen(false);
    setBubbleMode(null);
    setEditorText("");
    setBehaviorPrompt("");
  };

  const updateMultiForm = (key: keyof MultiCharacterForm, value: string | boolean | string[]) => {
    setMultiForm((prev) => ({ ...prev, [key]: value }));
  };

  const addMemory = () => {
    const title = "New memory";
    const content = "Describe a memory to keep.";
    if (onAddMemory) {
      onAddMemory(title, content);
    } else {
      const nextId = `mem-${Date.now()}`;
      setMemoryEntries((prev) => [...prev, { id: nextId, title, content }]);
    }
  };


  const addWorldEntry = () => {
    if (!worldDraft.name.trim() || !worldDraft.description.trim()) return;
    if (onAddLocation) {
      onAddLocation(worldDraft.name.trim(), worldDraft.description.trim());
    } else {
      setLocalWorldEntries((prev) => [
        ...prev,
        { id: `world-${Date.now()}`, name: worldDraft.name.trim(), description: worldDraft.description.trim() },
      ]);
    }
    setWorldDraft({ name: "", description: "" });
  };

  const beginEditWorldEntry = (entry: WorldEntry) => {
    setWorldEditId(entry.id);
    setWorldEditDraft(entry);
  };

  const saveWorldEdit = () => {
    if (!worldEditDraft || !worldEditDraft.name.trim() || !worldEditDraft.description.trim()) return;
    setLocalWorldEntries((prev) => prev.map((entry) => (entry.id === worldEditDraft.id ? worldEditDraft : entry)));
    setWorldEditId(null);
    setWorldEditDraft(null);
  };

  const removeWorldEntry = (id: string) => {
    if (onRemoveLocation) {
      onRemoveLocation(id);
    } else {
      setLocalWorldEntries((prev) => prev.filter((entry) => entry.id !== id));
    }
    if (worldEditId === id) {
      setWorldEditId(null);
      setWorldEditDraft(null);
    }
  };

  const removeMemory = (id: string) => {
    if (onRemoveMemory) {
      onRemoveMemory(id);
    } else {
      setMemoryEntries((prev) => prev.filter((item) => item.id !== id));
    }
    if (memoryEditId === id) setMemoryEditId(null);
  };

  const updateMemory = (id: string, next: Partial<MemoryEntry>) => {
    setMemoryEntries((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)));
  };


  const updateCharacterEdit = (id: string, key: keyof MultiCharacterForm, value: string | boolean | string[]) => {
    setCharacterEdits((prev) => {
      const current = prev[id] ?? {
        name: activeBot?.name ?? "",
        description: "",
        sex: "",
        isSFW: true,
        personality: "",
        hairColor: "#000000",
        eyeColor: "#000000",
        skinColor: "#F5DEB3",
        clothes: "",
        clothesSets: [],
        body: "",
        gadgets: "",
        greeting: "",
      };

      return {
        ...prev,
        [id]: { ...current, [key]: value },
      };
    });
  };

  const addApp = () => {
    if (!newApp.title.trim() || !newApp.description.trim() || !newApp.category.trim()) return;
    setInternetApps((prev) => [
      ...prev,
      {
        id: `app-${Date.now()}`,
        title: newApp.title.trim(),
        description: newApp.description.trim(),
        category: newApp.category.trim(),
        imageName: newApp.imageName.trim() || undefined,
      },
    ]);
    setNewApp({ title: "", description: "", category: "", imageName: "" });
  };

  const beginEditApp = (app: AppEntry) => {
    setAppEditingId(app.id);
    setAppEditDraft(app);
  };

  const saveAppEdit = () => {
    if (!appEditDraft || !appEditDraft.title.trim() || !appEditDraft.description.trim() || !appEditDraft.category.trim()) return;
    setInternetApps((prev) => prev.map((app) => (app.id === appEditDraft.id ? appEditDraft : app)));
    setAppEditingId(null);
    setAppEditDraft(null);
  };

  const removeApp = (id: string) => {
    setInternetApps((prev) => prev.filter((app) => app.id !== id));
    if (appEditingId === id) {
      setAppEditingId(null);
      setAppEditDraft(null);
    }
  };

  const createMultiCharacter = () => {
    if (!multiForm.name.trim()) return;
    setCreatedChatCharacters((prev) => [
      ...prev,
      {
        id: `multi-${Date.now()}`,
        avatarUrl: buildAvatarUrl(multiForm.name.trim()),
        ...multiForm,
        name: multiForm.name.trim(),
      },
    ]);
    setMultiForm({
      name: "",
      description: "",
      sex: "",
      isSFW: true,
      personality: "",
      hairColor: "#000000",
      eyeColor: "#000000",
      skinColor: "#F5DEB3",
      clothes: "",
      clothesSets: [],
      body: "",
    gadgets: "",
      greeting: "",
    });
  };

  const SidebarContent = (
    <div className="flex h-full flex-col p-4 md:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        {selectMode ? (
          <button
            type="button"
            onClick={() => {
              setSelectMode(false);
              setSelectedChatIds([]);
            }}
            className="text-xs font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="text-sm font-semibold text-white hover:opacity-80 transition cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Select More</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          {selectMode ? (
            <button
              type="button"
              disabled={selectedChatIds.length === 0}
              onClick={handleDeleteSelected}
              className={`flex h-9 items-center gap-2 rounded-full px-4 text-xs font-bold transition-all ${
                selectedChatIds.length > 0
                  ? "bg-rose-500 text-white hover:bg-rose-600 cursor-pointer shadow-lg shadow-rose-500/20"
                  : "bg-white/5 text-text-muted cursor-not-allowed border border-white/5"
              }`}
            >
              <TrashIcon />
              <span>Delete ({selectedChatIds.length})</span>
            </button>
          ) : (
            <>
              {onNewChat && (
                <button
                  type="button"
                  onClick={onNewChat}
                  className="flex h-9 items-center gap-2 rounded-full bg-primary-500/10 px-3 text-xs font-semibold text-primary-400 ring-1 ring-primary-500/20 transition hover:bg-primary-500/20"
                >
                  <PenIcon />
                  <span>New</span>
                </button>
              )}
              {onOpenLibrary && (
                <button
                  type="button"
                  onClick={onOpenLibrary}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-white ring-1 ring-white/6 transition hover:bg-white/[0.1]"
                  aria-label="Open character library"
                  title="Character Library"
                >
                  <LibraryIcon />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenArchived}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-white ring-1 ring-white/6 transition hover:bg-white/[0.1]"
                aria-label="Open archived chats"
              >
                <ArchiveIcon />
              </button>
            </>
          )}
        </div>
      </div>

      <label className="mb-5 flex h-12 items-center gap-3 rounded-2xl bg-white/[0.02] px-4 text-text-muted border border-white/[0.06] focus-within:border-white/20 transition-all duration-300">
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats..."
          className="h-full w-full bg-transparent text-sm text-text-high outline-none placeholder:text-text-subtle"
        />
      </label>

      <div className="flex-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <div className="space-y-1">
          {filteredPreviews.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-8 text-center text-xs text-text-muted">
              {query ? "No chats match." : "No conversations yet."}
            </div>
          ) : (
            filteredPreviews.map(({ bot, time, unread, online, preview }) => (
              <button
                key={bot.id}
                onClick={() => {
                  if (selectMode) {
                    setSelectedChatIds(prev =>
                      prev.includes(bot.id) ? prev.filter(id => id !== bot.id) : [...prev, bot.id]
                    );
                  } else {
                    onSelectBot?.(bot.id);
                  }
                }}
                className="group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.02] cursor-pointer"
              >
                {activeBot?.id === bot.id && (
                  <span
                    className="absolute inset-0 bg-white/[0.08] rounded-2xl -z-10 border border-white/15 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                  />
                )}
                {selectMode && (
                  <div className="flex-shrink-0 flex items-center justify-center mr-1">
                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                      selectedChatIds.includes(bot.id)
                        ? "border-primary-500 bg-primary-500 text-surface-900"
                        : "border-white/30 bg-transparent"
                    }`}>
                      {selectedChatIds.includes(bot.id) && (
                        <svg className="h-3.5 w-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                )}
                <div className="relative h-11 w-11 flex-shrink-0">
                  {bot.avatarUrl ? (
                    <img src={bot.avatarUrl} alt={bot.name} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                      {getInitials(bot.name)}
                    </div>
                  )}
                  {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#090909] bg-emerald-500" />}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-text-high">{bot.name}</span>
                    <span className="text-[10px] text-text-muted">{time}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-text-muted">{preview}</p>
                    {unread && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-500 px-1 text-[9px] font-bold text-surface-900">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
                {!selectMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(bot.id);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer flex-shrink-0"
                    title="Delete chat"
                  >
                    <TrashIcon />
                  </button>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );

  if (libraryOnly) {
    return (
      <section className={`${themeClass} flex min-h-0 h-full flex-col overflow-hidden rounded-[2rem] bg-[hsl(var(--surface-900))] p-5 text-text-high shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10`}>
        {chatThemeStyles}
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-high ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <BackIcon />
          </button>
          <div className="text-sm font-medium text-white flex items-center gap-2">
            <LibraryIcon />
            <span>Character Library (Local Cache)</span>
          </div>
          <div className="w-10" />
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          {(!localCharacters || localCharacters.length === 0) ? (
            <div className="flex h-64 flex-col items-center justify-center text-center p-8">
              <div className="mb-4 h-16 w-16 rounded-full bg-white/5 flex items-center justify-center text-white/40 ring-1 ring-white/10">
                <LibraryIcon />
              </div>
              <h3 className="text-lg font-medium mt-4 mb-2 text-white">No downloaded characters</h3>
              <p className="text-sm text-text-muted max-w-xs">Start a chat or search for a character to download and cache them offline.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
              {localCharacters.map((char: any) => (
                <div
                  key={char.id}
                  onClick={() => onSelectCharacter?.(char.id)}
                  className="group relative flex flex-col items-center rounded-2xl bg-white/[0.03] p-4 text-center ring-1 ring-white/5 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/[0.06] hover:ring-white/10 cursor-pointer"
                >
                  {onDeleteDownloadedCharacter && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDownloadedCharacter(char.id);
                      }}
                      className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity ring-1 ring-rose-500/20 hover:bg-rose-500/25 cursor-pointer"
                      title="Delete Download"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  <div className="relative mb-3 h-20 w-20 overflow-hidden rounded-full ring-2 ring-primary-500/20 group-hover:ring-primary-500/50 transition-colors">
                    {char.imageUrl ? (
                      <img src={char.imageUrl} alt={char.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-white/10 text-xl font-semibold text-white">
                        {char.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm text-white group-hover:text-primary-400 transition-colors mb-1">{char.name}</h3>
                  {char.creatorName && (
                    <span className="text-[10px] text-text-muted mb-2">by {char.creatorName}</span>
                  )}
                  <p className="text-xs text-text-muted line-clamp-2 min-h-[2rem] px-2 mb-3">
                    {char.shortDescription || char.description || "No description provided."}
                  </p>
                  <div className="mt-auto w-full flex items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                      Offline Ready
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (archivedOnly) {
    return (
      <section className={`${themeClass} flex min-h-0 h-full flex-col overflow-hidden rounded-[2rem] bg-[hsl(var(--surface-900))] p-4 text-text-high shadow-[0_24px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10`}>
        {chatThemeStyles}
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-high ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <BackIcon />
          </button>
          <div className="text-sm font-medium text-white">Archived chats</div>
          <div className="w-10" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {archivedPreviews.map(({ bot, time, preview }, index) => (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, delay: Math.min(10, index) * 0.03, ease: "easeOut" }}
              whileHover={hasHover ? { scale: 1.01 } : undefined}
              key={bot.id}
              className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/5"
            >
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-xs">{getInitials(bot.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between"><span className="font-medium text-sm">{bot.name}</span><span className="text-[10px] opacity-50">{time}</span></div>
                <div className="text-xs opacity-50 truncate">{preview}</div>
              </div>
              <motion.button
                whileHover={hasHover ? { scale: 1.06 } : undefined}
                whileTap={{ scale: 0.94 }}
                onClick={() => handleRestore(bot.id)}
                className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full cursor-pointer font-bold uppercase tracking-wider transition-colors"
              >
                Restore
              </motion.button>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`${themeClass} flex h-full min-h-0 overflow-hidden rounded-none md:rounded-[2rem] bg-surface-900/60 text-text-high border-0 md:border md:border-white/[0.08] backdrop-blur-2xl md:shadow-glass relative`}>
      {/* Decorative ambient lights inside Chat Interface */}
      <div className="absolute top-[10%] left-[-10%] w-[350px] h-[350px] bg-gradient-to-tr from-primary-500/5 to-transparent rounded-full blur-[90px] pointer-events-none orb-morph z-0" />
      <div className="absolute bottom-[10%] right-[-10%] w-[350px] h-[350px] bg-gradient-to-br from-purple-500/5 to-transparent rounded-full blur-[90px] pointer-events-none orb-morph z-0" />
      {chatThemeStyles}
      
      {/* Sidebar - Desktop Only */}
      <aside className="hidden w-[340px] flex-shrink-0 border-r border-white/10 xl:flex flex-col bg-black/20 z-10">
        {SidebarContent}
      </aside>

      {/* Main Conversation Area */}
      <div className="relative flex flex-1 flex-col min-w-0 bg-[hsl(var(--surface-900))]">
        {!activeBot ? (
          <div className="flex h-full flex-col w-full xl:hidden bg-[hsl(var(--surface-900))]">
             {SidebarContent}
          </div>
        ) : (
          <>
            {!activeBot && (
              <div className="hidden h-full flex-col items-center justify-center p-8 text-center xl:flex">
                <div className="mb-6 h-20 w-20 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/10">
                  <ArchiveIcon />
                </div>
                <h3 className="text-xl font-display mb-2">Select a conversation</h3>
                <p className="text-sm text-text-muted max-w-xs">Choose a chatbot from the list to start messaging or create a new one.</p>
              </div>
            )}

            {activeBot && (
              <>
                <header className={`klie-chat-header absolute left-0 right-0 top-0 z-30 flex h-20 items-center justify-between border-b ${detailsOpen ? "border-transparent" : "border-white/[0.06]"} bg-surface-900/40 px-5 backdrop-blur-xl`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={onBack}
                      className="flex h-10 w-10 xl:hidden items-center justify-center rounded-full bg-white/5 text-text-high ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      <BackIcon />
                    </button>
                    <div 
                      ref={headerTriggerRef}
                      onClick={() => setDetailsOpen(!detailsOpen)}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition select-none min-w-0"
                    >
                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full ring-1 ring-white/10">
                        {activeBot?.avatarUrl ? (
                          <img src={activeBot.avatarUrl} alt={activeName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-semibold text-white">
                            {activeName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold tracking-[-0.02em] text-white">{activeName}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">


                    <button
                      type="button"
                      onClick={() => setChatSettingsOpen(true)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-text-high ring-1 ring-white/10 transition hover:bg-white/10"
                    >
                      <GearIcon />
                    </button>
                  </div>
                </header>

                <AnimatePresence>
                  {detailsOpen && (
                    <>
                      <div className="absolute inset-0 z-24 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDetailsOpen(false)} />
                      <motion.div
                        ref={detailsRef}
                        initial={{ y: -250, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -250, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className="absolute top-20 left-0 right-0 z-25 bg-surface-950/95 border-b border-white/[0.08] p-6 backdrop-blur-2xl flex flex-col items-center justify-center text-center gap-3 shadow-2xl"
                      >
                        {/* Big Avatar Image */}
                        <div className="h-36 w-36 overflow-hidden rounded-2xl ring-2 ring-white/10 shadow-lg flex-shrink-0">
                          {activeBot?.avatarUrl ? (
                            <img src={activeBot.avatarUrl} alt={activeName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-white/10 text-2xl font-bold text-white">
                              {activeName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        
                        {/* Character Name */}
                        <h3 className="text-base font-bold text-white tracking-tight">{activeName}</h3>
                        
                        {/* Creator Info */}
                        {activeCharDetails?.creatorName && (
                          <div className="text-xs text-text-muted">
                            {onSelectCreator && activeCreator ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectCreator(activeCreator);
                                  setDetailsOpen(false);
                                }}
                                className="text-primary-400 font-bold hover:underline cursor-pointer"
                              >
                                by {activeCharDetails.creatorName}
                              </button>
                            ) : (
                              <span className="font-semibold text-text-high">by {activeCharDetails.creatorName}</span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                <div className="klie-chat-message-area flex-1 overflow-y-auto px-4 pb-28 pt-24 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                  <div className="flex w-full flex-col gap-4">
                    {msgs.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                      >
                        <div className={`flex w-full items-start ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`klie-chat-bubble-${msg.role === "user" ? "user" : "ai"} max-w-[85%] rounded-[1.6rem] px-4 py-3 text-sm leading-7 shadow-lg ${
                              msg.role === "user" ? "bg-white text-black" : "border border-white/8 bg-white/[0.06] text-text-high"
                            }`}
                          >
                            {parseChatContent(msg.content, msg.role === "user")}
                          </div>
                        </div>
                        {msg.role === "ai" && idx === lastAiMessageIndex && (
                          <div className="mt-2 flex flex-col gap-2">
                            <div className="flex gap-2">
                              <button onClick={openTools} className="text-[10px] text-white/40 hover:text-white/70">Tools</button>
                            </div>
                            {messageToolsOpen && (
                              <div className="flex animate-in fade-in slide-in-from-top-1 gap-2 rounded-xl bg-white/[0.03] p-1 ring-1 ring-white/5">
                                <button 
                                  onClick={triggerRewrite}
                                  className="rounded-lg px-2 py-1 text-[9px] font-medium text-white/60 hover:bg-white/10 hover:text-white"
                                >
                                  Rewrite
                                </button>
                                <button 
                                  onClick={() => {
                                    setBubbleMode("prompt");
                                    setBehaviorPrompt("");
                                  }}
                                  className="rounded-lg px-2 py-1 text-[9px] font-medium text-white/60 hover:bg-white/10 hover:text-white"
                                >
                                  Prompt
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditorText(msg.content);
                                    setBubbleMode("edit");
                                  }}
                                  className="rounded-lg px-2 py-1 text-[9px] font-medium text-white/60 hover:bg-white/10 hover:text-white"
                                >
                                  Edit
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[hsl(var(--surface-900))] via-[hsl(var(--surface-900))] to-transparent p-4 pb-6">
                  {/* Image Preview */}
                  {imageB64 && (
                    <div className="mx-auto max-w-4xl mb-2 relative inline-block">
                      <img src={imageB64} alt="Upload preview" className="h-20 rounded-xl border border-white/10" />
                      <button
                        onClick={() => setImageB64(null)}
                        className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 text-xs hover:bg-rose-600 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-[2rem] bg-surface-900/60 p-3 shadow-glass border border-white/[0.08] backdrop-blur-xl ring-1 ring-black/20 focus-within:border-white/20 transition-all duration-300">
                    {/* Image Upload Button */}
                    <button
                      type="button"
                      onClick={() => document.getElementById('chat-image-upload')?.click()}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/5 text-text-muted hover:text-white transition shadow-lg cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <input
                      id="chat-image-upload"
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />

                    <textarea
                      rows={1}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={`Message ${activeName}...`}
                      className="max-h-32 min-h-[48px] flex-1 resize-none bg-transparent px-3 py-3 text-sm text-text-high outline-none placeholder:text-text-subtle"
                    />
                    
                    <motion.button
                      whileHover={hasHover ? { scale: 1.08 } : undefined}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => onSend?.("[SKIP]")}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-surface-800 text-white transition-colors shadow-lg cursor-pointer hover:bg-surface-700"
                      title="Skip"
                    >
                      <SkipIcon />
                    </motion.button>
                    <motion.button
                      whileHover={hasHover ? { scale: 1.08 } : undefined}
                      whileTap={{ scale: 0.92 }}
                      onClick={handleSend}
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform shadow-lg cursor-pointer"
                    >
                      <SendIcon />
                    </motion.button>
                  </div>
                </div>

              </>
            )}
          </>
        )}
      </div>

      {chatSettingsOpen && typeof document !== "undefined" && createPortal(
        <div className="klie-chat-overlay fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-[2.5rem] border border-white/[0.08] bg-surface-900/60 p-7 shadow-glass flex flex-col max-h-[85vh] text-left backdrop-blur-3xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Decorative background morphing orbs inside settings modal */}
            <div className="absolute top-[-25%] left-[-25%] w-[300px] h-[300px] bg-gradient-to-tr from-indigo-500/8 to-transparent rounded-full blur-[70px] pointer-events-none orb-morph z-0" />
            <div className="absolute bottom-[-25%] right-[-25%] w-[300px] h-[300px] bg-gradient-to-br from-purple-500/8 to-transparent rounded-full blur-[70px] pointer-events-none orb-morph z-0" />

            {/* Header */}
            <div className="relative flex items-start justify-between gap-4 mb-5 z-10">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Chat Settings</h3>
                <p className="text-xs text-text-muted mt-0.5">Configure your active personas, memories, and environment.</p>
              </div>
              <button
                type="button"
                onClick={() => setChatSettingsOpen(false)}
                className="text-text-subtle hover:text-white p-2 rounded-full hover:bg-white/5 transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Offline ready / Download banner */}
            {activeCharDetails && (
              <div className="relative mb-5 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-4 z-10">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${activeCharDetails.isDownloaded ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.4)]" : "bg-amber-400"}`} />
                  <div>
                    <div className="text-xs font-bold text-white">
                      {activeCharDetails.isDownloaded ? "Offline Ready" : "Cloud Usage (Online)"}
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5 leading-normal">
                      {activeCharDetails.isDownloaded 
                        ? "Downloaded. Full offline chat & lore caching enabled." 
                        : "Internet required. Click Download to cache offline."}
                    </p>
                  </div>
                </div>
                {!activeCharDetails.isDownloaded && onDownloadCharacter && (
                  <button
                    type="button"
                    onClick={() => {
                      onDownloadCharacter(activeCharDetails.id);
                    }}
                    className="rounded-full bg-white hover:bg-white/95 text-black px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer shadow-lg shadow-white/5"
                  >
                    Download
                  </button>
                )}
              </div>
            )}

            {/* Tab selection */}
            <div className="relative mb-5 z-25">
              {/* Mobile View */}
              <div className="sm:hidden relative w-full">
                <button
                  type="button"
                  onClick={() => setMobileTabDropdownOpen(!mobileTabDropdownOpen)}
                  className="w-full flex items-center justify-between gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] px-4 py-3 rounded-2xl text-xs font-bold text-white transition-all duration-200"
                >
                  <span>
                    {chatSettingsTab === "multi" && "Personas"}
                    {chatSettingsTab === "memory" && "Memory & Lore"}
                    {chatSettingsTab === "ai" && "AI Settings"}
                    {chatSettingsTab === "report" && "Report"}
                  </span>
                  <svg className={`w-4 h-4 text-text-subtle transition-transform duration-200 ${mobileTabDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {mobileTabDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMobileTabDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface-900 border border-white/[0.08] rounded-2xl shadow-xl py-2 z-40 overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                      {[
                        { value: "multi", label: "Personas" },
                        { value: "memory", label: "Memory & Lore" },
                        { value: "ai", label: "AI Settings" },
                        { value: "report", label: "Report" }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setChatSettingsTab(item.value as any);
                            setMobileTabDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors ${
                            chatSettingsTab === item.value 
                              ? "bg-white text-black" 
                              : "text-text-muted hover:text-white hover:bg-white/[0.03]"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Desktop View */}
              <div className="hidden sm:flex items-center gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.06] w-full">
                <button
                  type="button"
                  onClick={() => setChatSettingsTab("multi")}
                  className={`flex-1 rounded-xl py-2 text-center text-xs font-bold tracking-tight transition-all duration-200 ${
                    chatSettingsTab === "multi" ? "bg-white text-black shadow-lg scale-[1.02]" : "text-text-muted hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  Personas
                </button>
                <button
                  type="button"
                  onClick={() => setChatSettingsTab("memory")}
                  className={`flex-1 rounded-xl py-2 text-center text-xs font-bold tracking-tight transition-all duration-200 ${
                    chatSettingsTab === "memory" ? "bg-white text-black shadow-lg scale-[1.02]" : "text-text-muted hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  Memory & Lore
                </button>
                <button
                  type="button"
                  onClick={() => setChatSettingsTab("ai")}
                  className={`flex-1 rounded-xl py-2 text-center text-xs font-bold tracking-tight transition-all duration-200 ${
                    chatSettingsTab === "ai" ? "bg-white text-black shadow-lg scale-[1.02]" : "text-text-muted hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  AI Settings
                </button>
                <button
                  type="button"
                  onClick={() => setChatSettingsTab("report")}
                  className={`flex-1 rounded-xl py-2 text-center text-xs font-bold tracking-tight transition-all duration-200 ${
                    chatSettingsTab === "report" ? "bg-white text-black shadow-lg scale-[1.02]" : "text-text-muted hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  Report
                </button>
              </div>
            </div>

            {/* Tab content wrapper */}
            <div className="relative flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin z-10">
              
              {/* TAB 1: PERSONAS & CLOTHES */}
              {chatSettingsTab === "multi" && (
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Active Personas (Character Builder)</div>
                  <div className="space-y-3">
                         <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-sm hover:border-white/[0.08] transition duration-300 space-y-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
                          U
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{userPersona.name} (YOU)</span>
                            <span className="text-[9px] uppercase font-bold tracking-wider bg-white/10 text-white/80 px-2 py-0.5 rounded-full border border-white/20">User Persona</span>
                          </div>
                          <div className="text-[10px] text-text-subtle truncate max-w-sm mt-0.5">
                            {userPersona.description || "Describe yourself for interactive roleplay."}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3 text-left">
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block space-y-1">
                            <span className="text-[10px] font-semibold text-text-subtle">Name</span>
                            <input
                              type="text"
                              value={userPersona.name}
                              onChange={(e) => {
                                const updated = { ...userPersona, name: e.target.value };
                                setUserPersona(updated);
                                localStorage.setItem("klie.userPersona", JSON.stringify(updated));
                              }}
                              placeholder="Name"
                              className="w-full rounded-xl bg-surface-900/60 px-3 py-2 text-xs text-white outline-none border border-white/10 focus:border-white/25 focus:ring-1 focus:ring-white/10 hover:border-white/15 transition-all duration-300"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[10px] font-semibold text-text-subtle">Sex / Gender</span>
                            <input
                              type="text"
                              value={userPersona.sex}
                              onChange={(e) => {
                                const updated = { ...userPersona, sex: e.target.value };
                                setUserPersona(updated);
                                localStorage.setItem("klie.userPersona", JSON.stringify(updated));
                              }}
                              placeholder="e.g. Male"
                              className="w-full rounded-xl bg-surface-900/60 px-3 py-2 text-xs text-white outline-none border border-white/10 focus:border-white/25 focus:ring-1 focus:ring-white/10 hover:border-white/15 transition-all duration-300"
                            />
                          </label>
                        </div>
                        <label className="block space-y-1">
                          <span className="text-[10px] font-semibold text-text-subtle">Bio / Background Context</span>
                          <textarea
                            value={userPersona.description}
                            onChange={(e) => {
                              const updated = { ...userPersona, description: e.target.value };
                              setUserPersona(updated);
                              localStorage.setItem("klie.userPersona", JSON.stringify(updated));
                            }}
                            placeholder="Describe your background and relationship with character..."
                            className="w-full h-20 rounded-xl bg-surface-900/60 px-3 py-2 text-xs text-white outline-none border border-white/10 focus:border-white/25 focus:ring-1 focus:ring-white/10 hover:border-white/15 resize-none transition-all duration-300"
                          />
                        </label>
                    </div>
                  </div>

                    {chatCharacters.map((char) => {
                      const isMain = char.id === activeBot?.id;
                      const charAny = char as any;
                      return (
                        <div key={char.id} className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                              {char.avatarUrl ? (
                                <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" />
                              ) : (
                                char.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                                <span className="truncate">{char.name}</span>
                                {isMain && <span className="text-[9px] flex-shrink-0 uppercase tracking-wider bg-primary-500/10 text-primary-400 px-1.5 py-0.5 rounded-full border border-primary-500/20">Main</span>}
                              </div>
                              <div className="text-[10px] text-text-subtle truncate max-w-sm mt-0.5">
                                {charAny.description || charAny.personality || "Cast participant"}
                              </div>
                            </div>
                          </div>

                          {/* Outfit selector / customize */}
                          <div className="space-y-1">
                            <span className="text-[10px] text-text-subtle">Current Outfit / Clothes</span>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={characterOutfitDrafts[char.id] ?? charAny.clothes ?? ""}
                                onChange={(e) => setCharacterOutfitDrafts(prev => ({ ...prev, [char.id]: e.target.value }))}
                                placeholder="Describe their current clothes (e.g. Leather jacket)"
                                className="flex-1 rounded-xl bg-white/[0.05] px-3 py-1.5 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-white/30"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const currentOutfit = characterOutfitDrafts[char.id] ?? charAny.clothes ?? "";
                                  setCharacterEdits(prev => ({
                                    ...prev,
                                    [char.id]: {
                                      ...activeCharacterConfig,
                                      clothes: currentOutfit
                                    }
                                  }));
                                }}
                                className="rounded-xl bg-white text-black text-xs font-semibold px-3 py-1.5 hover:bg-white/90 active:scale-95 transition"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Custom Supportive Persona */}
                  <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 mt-4">
                    <div className="text-[11px] font-semibold text-white">Create a Custom Supporting Persona</div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newPersonaName}
                        onChange={(e) => setNewPersonaName(e.target.value)}
                        placeholder="Persona Name (e.g. Luna)"
                        className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10"
                      />
                      <textarea
                        value={newPersonaPersonality}
                        onChange={(e) => setNewPersonaPersonality(e.target.value)}
                        placeholder="Describe traits, behavior, clothes, hair..."
                        className="w-full h-14 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newPersonaName.trim() || !newPersonaPersonality.trim()) return;
                          const newChar = {
                            id: `custom-char-${Date.now()}`,
                            name: newPersonaName.trim(),
                            personality: newPersonaPersonality.trim(),
                            description: newPersonaPersonality.trim(),
                            avatarUrl: "",
                            sex: "",
                            isSFW: true,
                            hairColor: "#000000",
                            eyeColor: "#000000",
                            skinColor: "#ffffff",
                            clothes: "",
                            clothesSets: [],
                            body: "",
                            gadgets: "",
                            greeting: ""
                          };
                          setCreatedChatCharacters(prev => [...prev, newChar]);
                          setNewPersonaName("");
                          setNewPersonaPersonality("");
                        }}
                        className="w-full py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 transition active:scale-98"
                      >
                        Add Supportive Persona
                      </button>
                    </div>
                  </div>

                  {/* Import Supporting Personas */}
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Import Supporting Personas</div>
                      {/* Persona filter selector */}
                      <div className="flex bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.02]">
                        <button
                          type="button"
                          onClick={() => setPersonaFilter("all")}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                            personaFilter === "all" ? "bg-white text-black shadow" : "text-text-subtle hover:text-white"
                          }`}
                        >
                          Klie
                        </button>
                        <button
                          type="button"
                          onClick={() => setPersonaFilter("my")}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                            personaFilter === "my" ? "bg-white text-black shadow" : "text-text-subtle hover:text-white"
                          }`}
                        >
                          My Characters
                        </button>
                      </div>
                    </div>

                    {availablePersonas.length === 0 ? (
                      <div className="text-center py-6 bg-white/[0.01] rounded-2xl border border-dashed border-white/5 p-4">
                        <p className="text-xs text-text-subtle">
                          {personaFilter === "my" 
                            ? "No custom characters created by you are available." 
                            : "No Klie personas are available."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-2 grid-cols-2">
                        {availablePersonas.map(bot => {
                          const isImported = selectedImportIds.includes(bot.id);
                          return (
                            <button
                              key={bot.id}
                              type="button"
                              onClick={() => {
                                if (isImported) {
                                  setSelectedImportIds(prev => prev.filter(id => id !== bot.id));
                                } else {
                                  setSelectedImportIds(prev => [...prev, bot.id]);
                                }
                              }}
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                                isImported 
                                  ? "bg-primary-500/10 border-primary-500/40 text-white font-medium" 
                                  : "bg-white/[0.02] border-white/[0.05] text-text-subtle hover:bg-white/5"
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {bot.imageUrl ? (
                                  <img src={bot.imageUrl} alt={bot.name} className="w-full h-full object-cover" />
                                ) : (
                                  bot.name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-semibold text-white truncate block">{bot.name}</span>
                                <span className="text-[9px] text-text-subtle truncate block mt-0.5">By {bot.creatorName || "Klie"}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: MEMORY & LORE */}
              {chatSettingsTab === "memory" && (
                <div className="space-y-4 text-left">
                  {/* Header Row */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Memory & Lore</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowWikiGraph(true)}
                        className="px-2.5 py-1 rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 text-[10px] font-bold tracking-wide transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <svg className="w-3 h-3 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        <span>View Wiki Graph</span>
                      </button>
                      
                      {/* Plus button */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddOptions(!showAddOptions);
                          setAddingType(null);
                        }}
                        className="w-7 h-7 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition cursor-pointer text-base font-bold active:scale-95"
                      >
                        {showAddOptions ? "✕" : "+"}
                      </button>
                    </div>
                  </div>

                  {/* Add Options - Inline Grid (No clipping) */}
                  {showAddOptions && (
                    <div className="grid grid-cols-3 gap-2 bg-white/[0.02] border border-white/5 p-2 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-150 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingType("memory");
                          setShowAddOptions(false);
                        }}
                        className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-white/5 text-white gap-1 transition"
                      >
                        <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span className="text-[10px] font-bold">Add Memory</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingType("world");
                          setShowAddOptions(false);
                        }}
                        className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-white/5 text-white gap-1 transition"
                      >
                        <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth={2.5} fill="none" />
                        </svg>
                        <span className="text-[10px] font-bold">Add Location</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingType("checkpoint");
                          setShowAddOptions(false);
                        }}
                        className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-white/5 text-white gap-1 transition"
                      >
                        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        <span className="text-[10px] font-bold">Checkpoint</span>
                      </button>
                    </div>
                  )}

                  {/* Add Forms */}
                  {addingType === "memory" && (
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                      <div className="text-[11px] font-semibold text-white">Add new remembered fact</div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newMemKey}
                          onChange={(e) => setNewMemKey(e.target.value)}
                          placeholder="Fact Key (e.g. User Hobbies)"
                          className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10"
                        />
                        <textarea
                          value={newMemVal}
                          onChange={(e) => setNewMemVal(e.target.value)}
                          placeholder="What should the AI remember? (e.g. User likes green tea)"
                          className="w-full h-12 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const content = newMemVal.trim();
                              if (!content) return;
                              const title = newMemKey.trim() || "Fact";
                              if (onAddMemory) {
                                onAddMemory(title, content);
                              } else {
                                const newEntry = {
                                  id: `mem-${Date.now()}`,
                                  title,
                                  content
                                };
                                setLocalMemoryEntries(prev => [...prev, newEntry]);
                              }
                              setNewMemKey("");
                              setNewMemVal("");
                              setAddingType(null);
                            }}
                            className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 transition"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingType(null)}
                            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {addingType === "world" && (
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                      <div className="text-[11px] font-semibold text-white">Add new scene/location</div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={worldDraft.name}
                          onChange={(e) => setWorldDraft(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Location Name (e.g. Castle Balcony)"
                          className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10"
                        />
                        <textarea
                          value={worldDraft.description}
                          onChange={(e) => setWorldDraft(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="What happens in this environment? (e.g. Cold breeze)"
                          className="w-full h-12 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              addWorldEntry();
                              setAddingType(null);
                            }}
                            className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 transition"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingType(null)}
                            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {addingType === "checkpoint" && (
                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                      <div className="text-[11px] font-semibold text-white">Create New Checkpoint</div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newCheckpointName}
                          onChange={(e) => setNewCheckpointName(e.target.value)}
                          placeholder="Checkpoint Name (e.g. Before heist)"
                          className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!newCheckpointName.trim()) return;
                              if (onCreateCheckpoint) {
                                await onCreateCheckpoint(newCheckpointName.trim());
                                setNewCheckpointName("");
                              }
                              setAddingType(null);
                            }}
                            className="flex-1 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 transition"
                          >
                            Create
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingType(null)}
                            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Editing Memory Inline Form */}
                  {editingMemory && (
                    <div className="p-3 rounded-2xl bg-white/[0.04] border border-teal-500/25 space-y-3">
                      <div className="text-[11px] font-semibold text-teal-400">Edit remembered fact</div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingMemory.title}
                          onChange={(e) => setEditingMemory({ ...editingMemory, title: e.target.value })}
                          className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-teal-500/30"
                        />
                        <textarea
                          value={editingMemory.content}
                          onChange={(e) => setEditingMemory({ ...editingMemory, content: e.target.value })}
                          className="w-full h-12 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-teal-500/30 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (onUpdateMemory) {
                                onUpdateMemory(editingMemory.id, editingMemory.title, editingMemory.content);
                              } else {
                                updateMemory(editingMemory.id, { title: editingMemory.title, content: editingMemory.content });
                              }
                              setEditingMemory(null);
                            }}
                            className="flex-1 py-2 rounded-xl bg-teal-500 text-white text-xs font-bold hover:bg-teal-400 transition"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMemory(null)}
                            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Editing Location Inline Form */}
                  {worldEditId && worldEditDraft && (
                    <div className="p-3 rounded-2xl bg-white/[0.04] border border-teal-500/25 space-y-3">
                      <div className="text-[11px] font-semibold text-teal-400">Edit location</div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={worldEditDraft.name}
                          onChange={(e) => setWorldEditDraft({ ...worldEditDraft, name: e.target.value })}
                          className="w-full rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-teal-500/30"
                        />
                        <textarea
                          value={worldEditDraft.description}
                          onChange={(e) => setWorldEditDraft({ ...worldEditDraft, description: e.target.value })}
                          className="w-full h-12 rounded-xl bg-white/[0.05] px-3 py-2 text-xs text-white outline-none ring-1 ring-teal-500/30 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveWorldEdit}
                            className="flex-1 py-2 rounded-xl bg-teal-500 text-white text-xs font-bold hover:bg-teal-400 transition"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWorldEditId(null);
                              setWorldEditDraft(null);
                            }}
                            className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* List of Chips */}
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                    {/* Render Memories */}
                    {memoryEntries.map((mem) => (
                      <div key={mem.id} className="relative group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                        <div className="flex w-full overflow-x-auto md:overflow-visible scrollbar-none snap-x snap-mandatory">
                          <div className="w-full shrink-0 snap-start p-3 pr-4 flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                                <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <span>Memory</span>
                              </span>
                              <span className="text-xs font-bold text-white truncate">{mem.title}</span>
                            </div>
                            <p className="text-[11px] text-text-subtle mt-1 line-clamp-2 md:line-clamp-none leading-relaxed">
                              {mem.content}
                            </p>
                          </div>
                          <div className="shrink-0 snap-end flex items-center gap-2 px-3 bg-white/[0.04] md:bg-transparent border-l border-white/5 md:border-l-0 md:relative md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              type="button"
                              onClick={() => setEditingMemory(mem)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition cursor-pointer text-[10px] font-bold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMemory(mem.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer text-[10px] font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Render World/Locations */}
                    {worldEntries.map((loc) => (
                      <div key={loc.id} className="relative group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                        <div className="flex w-full overflow-x-auto md:overflow-visible scrollbar-none snap-x snap-mandatory">
                          <div className="w-full shrink-0 snap-start p-3 pr-4 flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                                <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth={2.5} fill="none" />
                                </svg>
                                <span>Location</span>
                              </span>
                              <span className="text-xs font-bold text-white truncate">{loc.name}</span>
                            </div>
                            <p className="text-[11px] text-text-subtle mt-1 line-clamp-2 md:line-clamp-none leading-relaxed">
                              {loc.description}
                            </p>
                          </div>
                          <div className="shrink-0 snap-end flex items-center gap-2 px-3 bg-white/[0.04] md:bg-transparent border-l border-white/5 md:border-l-0 md:relative md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              type="button"
                              onClick={() => beginEditWorldEntry(loc)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition cursor-pointer text-[10px] font-bold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeWorldEntry(loc.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer text-[10px] font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Render Checkpoints */}
                    {checkpoints.map((cp: any) => {
                      const dateStr = cp.createdAt 
                        ? new Date(cp.createdAt * 1000).toLocaleString()
                        : "Unknown date";
                      return (
                        <div key={cp.id} className="relative group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                          <div className="flex w-full overflow-x-auto md:overflow-visible scrollbar-none snap-x snap-mandatory">
                            <div className="w-full shrink-0 snap-start p-3 pr-4 flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                  </svg>
                                  <span>Checkpoint</span>
                                </span>
                                <span className="text-xs font-bold text-white truncate">{cp.name}</span>
                              </div>
                              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                                {dateStr}
                              </p>
                            </div>
                            <div className="shrink-0 snap-end flex items-center gap-2 px-3 bg-white/[0.04] md:bg-transparent border-l border-white/5 md:border-l-0 md:relative md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm("Return to this checkpoint? All messages and memories made AFTER this checkpoint will be deleted permanently.")) {
                                    if (onRestoreCheckpoint) {
                                      await onRestoreCheckpoint(cp.id);
                                    }
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer text-[10px] font-bold"
                              >
                                Return
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm("Delete this checkpoint?")) {
                                    if (onDeleteCheckpoint) {
                                      await onDeleteCheckpoint(cp.id);
                                    }
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer text-[10px] font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {memoryEntries.length === 0 && worldEntries.length === 0 && checkpoints.length === 0 && (
                      <p className="text-xs text-text-subtle text-center py-4">No memory, scenery locations, or checkpoints stored yet. Click "+" to create one!</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: AI SETTINGS */}
              {chatSettingsTab === "ai" && (
                <div className="space-y-4 text-left">
                  <div>
                    <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Conversation Detail Level</div>
                    <p className="text-[11px] text-text-muted mb-4 leading-relaxed">
                      Choose the length and level of detail for the chatbot's responses.
                    </p>
                    <div className="grid grid-cols-3 gap-2 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.06]">
                      {(["normale", "breve", "dettagliato"] as const).map((style) => {
                        const active = responseStyle === style;
                        const label = style === "normale" ? "Normal" : style === "breve" ? "Brief" : "Detailed";
                        const desc = style === "normale" ? "Standard length" : style === "breve" ? "Shorter replies" : "Rich detail";
                        return (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setResponseStyle(style)}
                            className={`rounded-xl py-3 px-2 text-center transition-all duration-200 cursor-pointer ${
                              active ? "bg-white text-black shadow-lg scale-[1.01]" : "text-text-muted hover:text-white hover:bg-white/[0.03]"
                            }`}
                          >
                            <div className="text-xs font-bold">{label}</div>
                            <div className={`text-[9px] mt-0.5 ${active ? "text-neutral-500" : "text-text-subtle"}`}>{desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {chatSettingsTab === "report" && (
                <div className="space-y-4 text-left">
                  <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Report Chatbot</div>
                  <ReportForm character={selectedChatCharacter} currentUser={currentUser} />
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}

      {bubbleMode && (
        <div className="klie-chat-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/8 bg-[#090909] p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-white">
              {bubbleMode === "edit" ? "Edit message" : "Rewrite with prompt"}
            </h3>
            {bubbleMode === "edit" ? (
              <textarea
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                className="mb-4 min-h-[120px] w-full resize-none rounded-2xl border border-white/8 bg-black px-4 py-3 text-sm text-white outline-none"
              />
            ) : (
              <input
                value={behaviorPrompt}
                onChange={(e) => setBehaviorPrompt(e.target.value)}
                className="mb-4 h-12 w-full rounded-2xl border border-white/8 bg-black px-4 text-sm text-white outline-none"
              />
            )}
            <div className="flex gap-2">
              <button onClick={bubbleMode === "edit" ? saveEditedLastAiMessage : steerLastAiMessage} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">Save</button>
              <button onClick={() => setBubbleMode(null)} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showWikiGraph && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0c0c0c]/90 p-6 shadow-2xl flex flex-col h-[600px] md:h-[650px] relative overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🌐</span> AI World Wiki Graph
                </h3>
                <p className="text-xs text-text-subtle">
                  Interactive connection map showing locations, alliances, and spatial indices parsed by the AI.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWikiGraph(false);
                  setSelectedGraphNode(null);
                }}
                className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Main Graph Viewport */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden pt-4">
              
              {/* SVG Canvas */}
              <div className="flex-1 bg-black/40 border border-white/5 rounded-2xl relative overflow-hidden flex items-center justify-center min-h-[300px]">
                {graphData.nodes.length <= 1 && graphData.links.length === 0 ? (
                  <div className="text-center p-4">
                    <span className="text-2xl">🌱</span>
                    <p className="text-xs text-text-subtle mt-2">
                      Wiki map is fresh. The AI will populate connections here as the roleplay story progresses!
                    </p>
                  </div>
                ) : (
                  <svg
                    viewBox="0 0 500 500"
                    className="w-full h-full max-w-[450px] max-h-[450px]"
                  >
                    {/* Render connection links/lines first (so they are under nodes) */}
                    {graphData.links.map((link, idx) => {
                      const srcNode = graphData.nodes.find(n => n.id === link.source);
                      const tgtNode = graphData.nodes.find(n => n.id === link.target);
                      if (!srcNode || !tgtNode) return null;

                      return (
                        <g key={`link-${idx}`}>
                          <line
                            x1={srcNode.x}
                            y1={srcNode.y}
                            x2={tgtNode.x}
                            y2={tgtNode.y}
                            stroke="#2dd4bf"
                            strokeWidth="1.5"
                            strokeOpacity="0.35"
                            strokeDasharray="4 4"
                            className="animate-[dash_10s_linear_infinite]"
                          />
                        </g>
                      );
                    })}

                    {/* Render interactive nodes */}
                    {graphData.nodes.map((node) => (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={() => setSelectedGraphNode(node)}
                        className="cursor-pointer transition hover:scale-105 active:scale-95 group"
                      >
                        <circle
                          r={node.category === "CENTER" ? "20" : "14"}
                          className={`fill-black stroke-2 transition duration-300 ${
                            node.category === "CENTER"
                              ? "stroke-amber-400"
                              : node.category === "LOCATION"
                              ? "stroke-cyan-400"
                              : node.category === "CHARACTER"
                              ? "stroke-purple-400"
                              : "stroke-teal-400"
                          }`}
                        />
                        {/* Glow filter under nodes */}
                        <circle
                          r={node.category === "CENTER" ? "24" : "18"}
                          className={`fill-none stroke-[3px] opacity-25 blur-sm transition duration-300 ${
                            node.category === "CENTER"
                              ? "stroke-amber-400"
                              : node.category === "LOCATION"
                              ? "stroke-cyan-400"
                              : node.category === "CHARACTER"
                              ? "stroke-purple-400"
                              : "stroke-teal-400"
                          }`}
                        />
                        <text
                          y={node.category === "CENTER" ? "32" : "24"}
                          textAnchor="middle"
                          className="fill-white text-[9px] font-semibold select-none group-hover:fill-teal-400 transition"
                        >
                          {node.name.length > 12 ? `${node.name.slice(0, 10)}...` : node.name}
                        </text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>

              {/* Node Details Sidebar Panel */}
              <div className="w-full md:w-[220px] bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col overflow-y-auto">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-3">
                  Node Inspector
                </div>
                {selectedGraphNode ? (
                  <div className="space-y-3 flex-1 flex flex-col">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${selectedGraphNode.color}`} />
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wide">
                          {selectedGraphNode.category}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1 leading-tight">
                        {selectedGraphNode.name}
                      </h4>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-1">
                      <p className="text-[11px] text-text-subtle leading-relaxed whitespace-pre-wrap">
                        {selectedGraphNode.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow flex items-center justify-center text-center p-2 text-xs text-text-subtle">
                    Click any node in the map to inspect connections, facts, and descriptions!
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>,
        document.body
      )}
    </section>
  );
}

const ReportForm = ({ character, currentUser }: { character: any; currentUser: any }) => {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !character) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://revtech.vercel.app/api/desktop/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character,
          reason: reason.trim(),
          reporterName: currentUser?.displayName || "Anonymous",
          reporterEmail: currentUser?.email || "",
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setReason("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send report.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
        <span className="text-xl">✅</span>
        <div className="text-xs font-bold text-emerald-400">Report Submitted</div>
        <p className="text-[10px] text-text-subtle leading-relaxed">
          Thank you for reporting. Our team will review this chatbot shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-white/70 block">Reason for Report</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Please describe why this character should be reviewed (offensive content, safety concern, broken traits)..."
          required
          className="w-full min-h-[100px] resize-none rounded-xl border border-white/8 bg-black px-3 py-2 text-xs text-white outline-none focus:border-white/20 transition leading-relaxed"
        />
      </div>
      {error && <div className="text-[10px] text-rose-400 font-medium">{error}</div>}
      <button
        type="submit"
        disabled={loading || !reason.trim()}
        className="w-full rounded-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2 px-4 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10"
      >
        {loading ? "Sending..." : "Submit Report"}
      </button>
    </form>
  );
};

