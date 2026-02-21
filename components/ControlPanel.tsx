import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  GitCommit,
  Play,
  Pause,
} from "lucide-react";
import { StepState, SimulationData } from "../types";

interface ControlPanelProps {
  currentStepIndex: number;
  totalSteps: number;
  currentState: StepState | null;
  simData?: SimulationData | null;
  onNext: () => void;
  onPrev: () => void;
  isAutoPlaying?: boolean;
  onToggleAutoPlay?: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  currentStepIndex,
  totalSteps,
  currentState,
  simData,
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
                : Array.isArray(currentState.stack) &&
                    currentState.stack.length > 0
                  ? currentState.stack.filter(
                      (frame) =>
                        frame.func ===
                        currentState.stack[currentState.stack.length - 1].func,
                    ).length - 1
                  : "?"}
            </span>
          )}
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3 max-h-[160px]">
          {currentState && Object.keys(currentState.vars).length > 0 ? (
            (() => {
              // 1. Filter out arrays
              const scalars = Object.entries(currentState.vars).filter(
                ([, v]) => !Array.isArray(v),
              );

              if (scalars.length === 0) {
                return (
                  <div className="text-center text-[11px] text-white/60 italic py-2">
                    No scalar variables.
                  </div>
                );
              }

              // 2. Identify categories
              const pointers: string[] = [];
              const constants: string[] = [];
              const locals: string[] = [];

              scalars.forEach(([k, _v]) => {
                const lowerK = k.toLowerCase();
                // A) Pointer/Index check
                const isExplicitPointer = simData?.pointers?.includes(k);
                const isImplicitPointer =
                  /^[a-zA-Z]\d+$/.test(lowerK) ||
                  lowerK.includes("ptr") ||
                  lowerK.includes("idx");

                if (isExplicitPointer || isImplicitPointer) {
                  pointers.push(k);
                  return;
                }

                // B) Constant vs Mutating Local check
                // Look across the whole simulation to see if it ever changes value while in scope
                let isConstant = true;
                let firstSeenValue = undefined;

                if (simData) {
                  for (let i = 0; i < simData.steps.length; i++) {
                    const stepVars = simData.steps[i].s.vars;
                    if (stepVars && stepVars[k] !== undefined) {
                      if (firstSeenValue === undefined) {
                        firstSeenValue = stepVars[k];
                      } else if (stepVars[k] !== firstSeenValue) {
                        isConstant = false;
                        break;
                      }
                    }
                  }
                } else {
                  isConstant = false; // Fallback if no simData
                }

                if (isConstant) {
                  constants.push(k);
                } else {
                  locals.push(k);
                }
              });

              // Variable renderer helper
              const renderVarBlock = (
                key: string,
                val: any,
                dimmed = false,
              ) => (
                <div
                  key={key}
                  className={`flex flex-col gap-0.5 px-3 py-2 rounded-xl border h-fit shadow-sm transition-colors ${
                    dimmed
                      ? "bg-black/10 border-black/20 text-white/60"
                      : "bg-white/10 border-white/20 text-white"
                  }`}
                >
                  <span
                    className={`text-[10px] font-bold ${dimmed ? "text-white/40" : "text-white/70"}`}
                  >
                    {key}
                  </span>
                  <span
                    className="font-mono text-[12px] truncate font-bold drop-shadow-sm"
                    title={String(val)}
                  >
                    {String(val)}
                  </span>
                </div>
              );

              return (
                <div className="flex flex-col gap-3">
                  {/* Category: Pointers */}
                  {pointers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-white/50 pl-1 border-b border-white/10 pb-1">
                        Pointers & Indices
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {pointers.map((k) =>
                          renderVarBlock(k, currentState.vars[k]),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Category: Active Locals */}
                  {locals.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-white/50 pl-1 border-b border-white/10 pb-1">
                        Active Locals
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {locals.map((k) =>
                          renderVarBlock(k, currentState.vars[k]),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Category: Constants */}
                  {constants.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] uppercase tracking-wider font-bold text-white/50 pl-1 border-b border-white/10 pb-1">
                        Constants
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {constants.map((k) =>
                          renderVarBlock(k, currentState.vars[k], true),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="text-center text-[11px] text-white/60 italic py-2">
              Variables inactive
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
