import React from "react";
import { motion } from "framer-motion";

type CreatorCardProps = {
  displayName: string;
  handle: string;
  totalPoints: number;
  avatarUrl: string;
  rank: number;
  isFollowing?: boolean;
  onFollow?: (e: React.MouseEvent) => void;
  onClick?: () => void;
};

const rankStyles: Record<number, { ring: string; badge: string; badgeBg: string }> = {
  1: {
    ring: "rank-gold ring-2 ring-amber-400/40",
    badge: "bg-gradient-to-r from-amber-400 to-yellow-300 text-black shadow-lg shadow-amber-500/20",
    badgeBg: "bg-amber-500/10 border-amber-500/20",
  },
  2: {
    ring: "rank-silver ring-2 ring-gray-300/40",
    badge: "bg-gradient-to-r from-gray-300 to-gray-100 text-black shadow-lg shadow-gray-400/20",
    badgeBg: "bg-gray-400/10 border-gray-400/20",
  },
  3: {
    ring: "rank-bronze ring-2 ring-orange-400/40",
    badge: "bg-gradient-to-r from-orange-400 to-amber-300 text-black shadow-lg shadow-orange-500/20",
    badgeBg: "bg-orange-500/10 border-orange-500/20",
  },
};

const defaultRankStyle = {
  ring: "ring-2 ring-white/8",
  badge: "bg-white/[0.06] text-text-muted border border-white/10",
  badgeBg: "bg-primary-500/10 border-primary-500/10",
};

const CreatorCard: React.FC<CreatorCardProps> = ({
  displayName,
  handle,
  totalPoints,
  avatarUrl,
  rank,
  isFollowing = false,
  onFollow,
  onClick,
}) => {
  const pointsText = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(totalPoints);

  const rs = rankStyles[rank] || defaultRankStyle;

  const hasHover = typeof window !== "undefined" && window.innerWidth >= 1024;

  return (
    <motion.article
      whileHover={hasHover ? { scale: 1.02, y: -3, transition: { type: "spring", stiffness: 300, damping: 22 } } : undefined}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative card-shimmer glass-card flex flex-col justify-between gap-2.5 rounded-2xl p-3.5 border border-white/[0.08] bg-gradient-to-br from-surface-800/50 to-surface-800/30 shadow-glass cursor-pointer aspect-square w-full text-left"
    >
      <div className="flex items-start justify-between w-full gap-1.5">
        {/* Left: Avatar */}
        <div className={`h-11 w-11 overflow-hidden rounded-full flex-shrink-0 ${rs.ring}`}>
          <img
            src={avatarUrl}
            alt={`${displayName} avatar`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Right: Rank & Stars/Points Stack */}
        <div className="flex flex-col items-end flex-shrink-0 gap-1 mt-0.5">
          <div className={`rounded px-2 py-0.5 text-[9px] font-black tracking-wide border ${rs.badge}`}>
            #{rank}
          </div>
          <div className="flex items-center gap-0.5 text-[9px] text-amber-400 font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>{pointsText}</span>
          </div>
        </div>
      </div>

      {/* Center/Middle: Name & Handle */}
      <div className="flex flex-col min-w-0 w-full">
        <span className="font-display text-[12px] sm:text-xs font-bold leading-tight text-text-high truncate">{displayName}</span>
        <span className="text-[9.5px] sm:text-[10px] text-text-muted font-medium truncate">@{handle}</span>
      </div>

      {/* Follow Button */}
      <div className="w-full">
        {onFollow ? (
          <motion.button
            whileHover={hasHover ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.96 }}
            type="button"
            className={`w-full btn-primary-glow rounded-full py-1 text-[9px] font-bold transition-all flex items-center justify-center gap-0.5 cursor-pointer border ${
              isFollowing
                ? "border-primary-500/30 bg-primary-500/10 text-primary-400 hover:bg-primary-500/20"
                : "border-white/10 bg-white/[0.04] text-text-high hover:bg-white/10 hover:border-white/15"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onFollow?.(e);
            }}
          >
            {isFollowing ? "Following" : "Follow"}
          </motion.button>
        ) : (
          <div className="w-full rounded-full py-1 text-[9px] font-bold text-center border border-white/8 bg-white/[0.03] text-text-subtle">
            You
          </div>
        )}
      </div>
    </motion.article>
  );
};

export default CreatorCard;
