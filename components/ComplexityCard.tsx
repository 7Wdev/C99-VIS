import React from "react";
import { Clock, HardDrive } from "lucide-react";

interface ComplexityCardProps {
  time?: string;
  space?: string;
  explanation?: string;
}

const ComplexityCard: React.FC<ComplexityCardProps> = ({
  time,
  space,
  explanation,
}) => {
  return (
    <div className="bg-red-600 dark:bg-red-700 text-white border border-red-500 dark:border-red-600 rounded-3xl p-4 shrink-0 shadow-lg shadow-red-900/20 min-h-[90px] flex flex-col justify-center transition-colors">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/20">
        <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">
          Complexity Analysis
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-white/80 mb-0.5">
            <Clock size={12} />
            <span className="text-[10px] font-bold uppercase">Time</span>
          </div>
          <div
            className={`text-[13px] font-mono font-bold border rounded-lg px-2 py-1 inline-block text-center transition-colors ${time ? "bg-white/20 border-white/30 text-white" : "text-white/50 bg-black/10 border-black/10"}`}
          >
            {time || "?"}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-white/80 mb-0.5">
            <HardDrive size={12} />
            <span className="text-[10px] font-bold uppercase">Space</span>
          </div>
          <div
            className={`text-[13px] font-mono font-bold border rounded-lg px-2 py-1 inline-block text-center transition-colors ${space ? "bg-white/20 border-white/30 text-white" : "text-white/50 bg-black/10 border-black/10"}`}
          >
            {space || "?"}
          </div>
        </div>
      </div>

      {/* Explanation Area: Defensive check */}
      {explanation && explanation.length > 0 ? (
        <div className="mt-3 text-[11px] text-white/90 leading-relaxed border-t border-white/20 pt-2.5 italic animate-in fade-in slide-in-from-top-1">
          "{explanation}"
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-white/60 leading-relaxed border-t border-white/20 pt-2.5 italic">
          Analysis ready.
        </div>
      )}
    </div>
  );
};

export default ComplexityCard;
