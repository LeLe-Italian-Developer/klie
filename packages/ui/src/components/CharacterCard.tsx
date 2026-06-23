import React, { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";

type CharacterCardProps = {
  name: string;
  creatorName: string;
  points: number;
  imageUrl: string;
  isPro?: boolean;
  onClick?: () => void;
};

const CharacterCard: React.FC<CharacterCardProps> = ({
  name,
  creatorName,
  points,
  imageUrl,
  isPro = false,
  onClick,
}) => {
  const pointsText = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(points);

  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      rotateX: (0.5 - y) * 12,
      rotateY: (x - 0.5) * 12,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  return (
    <motion.article
      ref={cardRef}
      animate={{
        rotateX: tilt.rotateX,
        rotateY: tilt.rotateY,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      whileTap={{ scale: 0.97 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="card-shimmer glass-card relative aspect-square overflow-hidden rounded-3xl cursor-pointer shadow-glass group border border-white/[0.08] bg-surface-800/40"
      style={{ perspective: 800, transformStyle: "preserve-3d" }}
      onClick={onClick ?? (() => {})}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          (onClick ?? (() => {}))();
        }
      }}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
        style={{ backgroundImage: `url(${imageUrl})` }}
        aria-hidden
      />

      {/* Gradient overlay with stronger bottom fade */}
      <div 
        className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-95" 
        style={{
          backgroundImage: "linear-gradient(to top, var(--card-gradient-from, rgba(0,0,0,0.95)) 0%, var(--card-gradient-via, rgba(0,0,0,0.3)) 50%, var(--card-gradient-to, transparent) 100%)"
        }}
      />

      {/* Hover border glow effect */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ring-1 ring-inset ring-white/10" />

      {/* Bottom info directly on gradient overlay */}
      <div className="absolute inset-0 p-3.5 flex flex-col justify-end text-left">
        <div className="text-sm font-bold text-text-high truncate">{name}</div>
        <div className="text-[10px] text-text-muted truncate mt-0.5">By {creatorName || "Unknown"}</div>
      </div>
    </motion.article>
  );
};

export default CharacterCard;
