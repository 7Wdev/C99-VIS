import React from "react";
import { Layers, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StackFrame {
  func: string;
  args: Record<string, any>;
  line?: number;
}

interface StackVisualizerProps {
  stack: StackFrame[];
}

const StackVisualizer: React.FC<StackVisualizerProps> = ({ stack }) => {
  if (!stack || stack.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-slate-400 dark:text-slate-700 italic">
        Call stack is empty...
      </div>
    );
  }

  // Reverse stack to show top-of-stack at the top
  const displayStack = [...stack].reverse();

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto custom-scrollbar pr-1">
      <AnimatePresence mode="popLayout">
        {displayStack.map((frame, index) => {
          const isTop = index === 0;
          const depth = stack.length - 1 - index;

          return (
            <motion.div
              key={`${depth}-${frame.func}`}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className={`
                relative p-3 rounded-2xl border transition-colors
                ${
                  isTop
                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)] dark:shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                    : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5"
                }
              `}
            >
              {/* Frame Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg
                      ${isTop ? "bg-red-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}
                    `}
                  >
                    #{depth}
                  </span>
                  <span
                    className={`text-[13px] font-bold font-mono ${isTop ? "text-red-600 dark:text-red-200" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {frame.func}()
                  </span>
                </div>
                {isTop && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-500 dark:text-red-400 font-bold uppercase tracking-wider">
                    <Layers size={12} />
                    Active
                  </div>
                )}
              </div>

              {/* Arguments / Locals */}
              <div className="grid grid-cols-1 gap-1.5 pl-1 mt-1">
                {Object.entries(frame.args).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 text-[11px] font-mono group"
                  >
                    <span className="text-slate-500 w-auto min-w-[20px] text-right font-bold">
                      {key}
                    </span>
                    <ArrowRight
                      size={10}
                      className="text-slate-400 dark:text-slate-700 group-hover:text-red-400 transition-colors"
                    />
                    <span
                      className={`font-medium ${isTop ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}
                    >
                      {typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default StackVisualizer;
