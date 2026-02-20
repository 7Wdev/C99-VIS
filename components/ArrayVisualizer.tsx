import React from "react";
import { ArrowUp, CornerDownRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ArrayVisualizerProps {
  vars: Record<string, any>;
  identifiedPointers?: string[];
}

// Extended list of common pointer variable names
const COMMON_POINTER_NAMES = new Set([
  "i",
  "j",
  "k",
  "idx",
  "index",
  "l",
  "r",
  "low",
  "high",
  "start",
  "end",
  "col",
  "row",
  "pos",
  "head",
  "tail",
  "m",
  "mid",
  "p",
  "q",
  "x",
  "y",
  "h",
  "ptr",
  "current",
  "next",
  "prev",
]);

// Common coordinate pairs for 2D arrays
const COORDINATE_PAIRS = [
  ["i", "j"],
  ["r", "c"],
  ["row", "col"],
  ["x", "y"],
  ["rows", "cols"],
];

const ArrayVisualizer: React.FC<ArrayVisualizerProps> = ({
  vars,
  identifiedPointers = [],
}) => {
  // 1. Identify Arrays
  const arrays = Object.entries(vars).filter(([_, val]) =>
    Array.isArray(val),
  ) as [string, any[]][];

  // 2. Identify Pointers (Integer variables)
  const pointers = Object.entries(vars).filter(([key, val]) => {
    if (typeof val !== "number" || !Number.isInteger(val)) return false;
    if (identifiedPointers.includes(key)) return true;
    const lowerKey = key.toLowerCase();
    return (
      COMMON_POINTER_NAMES.has(lowerKey) ||
      lowerKey.includes("ptr") ||
      lowerKey.includes("idx") ||
      /^[a-zA-Z]\d+$/.test(lowerKey) // Matches variables like n1, n2, p1, x2
    );
  });

  if (arrays.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-[11px] text-slate-600 italic">
          No arrays or data structures in current scope.
        </span>
      </div>
    );
  }

  const render1DArray = (name: string, arr: any[]) => (
    <div className="flex items-start gap-1 p-2 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/5 w-fit shadow-inner">
      {arr.map((val: any, index: number) => {
        // Find all pointers pointing to this index
        const activePointers = pointers.filter(([_, pVal]) => pVal === index);
        const isRelevant = activePointers.length > 0;
        const isGarbage =
          val === "?" ||
          (typeof val === "string" && val.toLowerCase().includes("garbage"));

        return (
          <div
            key={index}
            className="flex flex-col items-center gap-1 min-w-[32px] relative group"
          >
            {/* Array Cell */}
            <motion.div
              layoutId={`${name}-cell-${index}`}
              className={`
                min-w-[2rem] w-auto px-1 h-8 border rounded-lg flex items-center justify-center text-[13px] font-bold font-mono relative z-10 shadow-sm transition-all duration-300
                ${
                  isRelevant
                    ? "bg-red-100 dark:bg-[#1e0a0a] border-red-300 dark:border-red-500/40 text-red-600 dark:text-white scale-110 z-20 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                    : isGarbage
                      ? "bg-white dark:bg-[#111111] border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-600"
                      : "bg-white dark:bg-[#111111] border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300"
                }
              `}
            >
              <motion.span
                key={`${val}-${index}`}
                initial={{ opacity: 0.5, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.1 }}
                className={isGarbage ? "italic" : ""}
              >
                {val}
              </motion.span>
            </motion.div>

            {/* Index Label */}
            <span
              className={`text-[8px] font-mono transition-colors ${isRelevant ? "text-red-400 font-bold" : "text-slate-700"}`}
            >
              {index}
            </span>

            {/* Pointers Arrows - Container */}
            <div className="h-6 w-full relative flex justify-center">
              <AnimatePresence>
                {activePointers.map(([pName], i) => (
                  <motion.div
                    key={`${name}-pointer-${pName}`}
                    layoutId={`${name}-pointer-${pName}`}
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.8 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 20,
                    }}
                    className="absolute top-0 flex flex-col items-center pointer-events-none"
                    style={{
                      zIndex: 50 + i,
                      y: i * -12,
                    }}
                  >
                    <ArrowUp
                      size={12}
                      className="text-red-500 mb-0.5 drop-shadow-[0_2px_4px_rgba(220,38,38,0.5)]"
                      strokeWidth={3}
                    />
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-bold text-red-50 font-mono bg-red-600 px-1.5 rounded-md leading-none py-0.5 shadow-lg border border-red-400/50 backdrop-blur-sm">
                        {pName}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );

  const render2DArray = (name: string, grid: any[][]) => {
    return (
      <div className="flex flex-col gap-1 p-3 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-200 dark:border-white/5 w-fit shadow-inner">
        {grid.map((row, rIndex) => (
          <div key={rIndex} className="flex gap-1">
            {row.map((val: any, cIndex: number) => {
              // Check for coordinate pointers (e.g. i=0, j=0)
              const activeCoords = COORDINATE_PAIRS.filter(([rVar, cVar]) => {
                return vars[rVar] === rIndex && vars[cVar] === cIndex;
              });

              const isRelevant = activeCoords.length > 0;
              const isGarbage =
                val === "?" ||
                (typeof val === "string" &&
                  val.toLowerCase().includes("garbage"));

              return (
                <div key={`${rIndex}-${cIndex}`} className="relative group">
                  <motion.div
                    layoutId={`${name}-cell-${rIndex}-${cIndex}`}
                    className={`
                      w-8 h-8 border rounded-lg flex items-center justify-center text-[13px] font-bold font-mono relative z-10 shadow-sm transition-all duration-300
                      ${
                        isRelevant
                          ? "bg-red-100 dark:bg-[#1e0a0a] border-red-300 dark:border-red-500/40 text-red-600 dark:text-white scale-110 z-20 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                          : isGarbage
                            ? "bg-white dark:bg-[#111111] border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-600"
                            : "bg-white dark:bg-[#111111] border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300"
                      }
                    `}
                  >
                    <motion.span
                      key={`${val}-${rIndex}-${cIndex}`}
                      initial={{ opacity: 0.5, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={isGarbage ? "italic" : ""}
                    >
                      {val}
                    </motion.span>

                    {/* Coordinate Tooltip on Hover */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-black text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-600 dark:border-white/10">
                      [{rIndex}][{cIndex}]
                    </div>
                  </motion.div>

                  {/* Active Coordinate Label Overlay */}
                  <AnimatePresence>
                    {activeCoords.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -bottom-2 -right-2 z-20 flex flex-col items-end pointer-events-none"
                      >
                        {activeCoords.map(([rVar, cVar], idx) => (
                          <span
                            key={idx}
                            className="text-[8px] font-bold text-white bg-red-600/90 px-1 rounded shadow-sm border border-red-400/30 backdrop-blur-[1px] mb-0.5"
                          >
                            {rVar},{cVar}
                          </span>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-nowrap gap-8 content-start pb-2 min-w-max h-full items-start px-2">
      <AnimatePresence mode="popLayout">
        {arrays.map(([name, arr]) => {
          const is2D = Array.isArray(arr[0]);

          return (
            <motion.div
              key={name}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2 shrink-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tracking-wide font-mono bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/5 shadow-sm">
                  <span className="text-emerald-500 mr-1.5">
                    {is2D ? "[][]" : "[]"}
                  </span>
                  {name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-600 font-mono font-bold">
                  {is2D
                    ? `${arr.length}x${(arr[0] as any[]).length}`
                    : `size: ${arr.length}`}
                </span>
              </div>

              {is2D
                ? render2DArray(name, arr as any[][])
                : render1DArray(name, arr)}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ArrayVisualizer;
