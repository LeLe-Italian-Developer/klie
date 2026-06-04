import React from "react";
import { motion } from "framer-motion";

type SafeToggleProps = {
  isSafe: boolean;
  onChange: (next: boolean) => void;
  className?: string;
};

const SafeToggle: React.FC<SafeToggleProps> = ({ isSafe, onChange, className }) => {
  const stateLabel = isSafe ? "Safe" : "Uncensored";
  
  return (
    <button
      type="button"
      aria-pressed={isSafe}
      aria-label={`Toggle safety mode (current: ${stateLabel})`}
      onClick={() => onChange(!isSafe)}
      className={`glass-pill relative inline-flex items-center gap-3 px-4.5 py-1.5 text-xs font-bold uppercase tracking-wider text-text-high transition-all duration-300 hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-primary-400/30 cursor-pointer ${className ?? ""}`}
    >
      <span className="select-none text-text-muted">{stateLabel}</span>
      <div className={`relative flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-300 ${isSafe ? "bg-surface-800 border border-border-subtle/10" : "bg-primary-500/20 border border-primary-500/35"}`}>
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`h-3.5 w-3.5 rounded-full shadow-sm ${isSafe ? "bg-text-subtle" : "bg-primary-400"}`}
          style={{ x: isSafe ? 0 : 14 }}
        />
      </div>
    </button>
  );
};

export default SafeToggle;
