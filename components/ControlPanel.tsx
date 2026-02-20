import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  GitCommit,
  Play,
  Pause,
} from "lucide-react";
import { StepState } from "../types";

interface ControlPanelProps {
  currentStepIndex: number;
  totalSteps: number;
  currentState: StepState | null;
  onNext: () => void;
  onPrev: () => void;
  isAutoPlaying?: boolean;
  onToggleAutoPlay?: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  currentStepIndex,
  totalSteps,
  currentState,
  onNext,
  onPrev,
  isAutoPlaying = false,
  onToggleAutoPlay,
}) => {
  const canPrev = currentStepIndex > 0;
  const canNext = currentStepIndex < totalSteps - 1;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Navigation Buttons */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 shrink-0">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white py-3 rounded-2xl font-bold text-[12px] uppercase transition-all shadow-sm dark:shadow-none"
        >
          <ChevronLeft size={14} />
          Back
        </button>

        <button
          onClick={onToggleAutoPlay}
          disabled={!canNext && !isAutoPlaying}
          className={`flex items-center justify-center w-12 bg-white dark:bg-white/10 hover:bg-slate-50 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-2xl transition-all shadow-sm ${
            isAutoPlaying
              ? "text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 shadow-inner"
              : ""
          } disabled:opacity-30`}
          title={isAutoPlaying ? "Pause Auto-play" : "Start Auto-play"}
        >
          {isAutoPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>

        <button
          onClick={onNext}
          disabled={!canNext}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white py-3 rounded-2xl font-bold text-[12px] uppercase transition-all shadow-lg shadow-red-900/20"
        >
          Next Step
          <ChevronRight size={14} />
        </button>
      </div>

      {/* State Inspector (Scalar Vars) - Reduced Min Height */}
      <div className="bg-red-600 dark:bg-red-700 text-white border border-red-500 dark:border-red-600 rounded-3xl p-4 space-y-3 shrink-0 shadow-lg shadow-red-900/20 min-h-[110px] flex flex-col transition-colors">
        <div className="flex justify-between items-start border-b border-white/20 pb-3 shrink-0">
          <div className="flex items-center gap-2 text-white">
            <GitCommit size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">
              Local Variables
            </span>
          </div>
          {currentState && (
            <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded border border-white/30 font-mono shadow-sm">
              Depth:{" "}
              {currentState.h !== undefined && currentState.h !== null
                ? currentState.h
                : currentState.stack && currentState.stack.length > 0
                  ? currentState.stack.filter(
                      (frame) =>
                        frame.func ===
                        currentState.stack[currentState.stack.length - 1].func,
                    ).length - 1
                  : "?"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 content-start flex-grow overflow-y-auto custom-scrollbar pr-1 max-h-[180px]">
          {currentState ? (
            Object.entries(currentState.vars).map(([k, v]) => {
              // Skip arrays here as they are shown in the right panel
              if (Array.isArray(v)) return null;
              return (
                <div
                  key={k}
                  className="flex flex-col gap-0.5 bg-white/10 px-3 py-2 rounded-xl border border-white/20 h-fit shadow-sm transition-colors"
                >
                  <span className="text-white/70 text-[10px] font-bold">
                    {k}
                  </span>
                  <span
                    className="text-white font-mono text-[12px] truncate font-bold drop-shadow-sm"
                    title={String(v)}
                  >
                    {String(v)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 text-center text-[11px] text-white/60 italic py-2">
              Variables inactive
            </div>
          )}

          {/* Empty state filler if active but no scalar vars found */}
          {currentState &&
            Object.values(currentState.vars).every((v) => Array.isArray(v)) && (
              <div className="col-span-2 text-center text-[11px] text-white/60 italic py-2">
                No scalar variables.
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
