import React, { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";

interface StdoutPanelProps {
  consoleOutput: string[];
}

const StdoutPanel: React.FC<StdoutPanelProps> = ({ consoleOutput }) => {
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleOutput]);

  const consoleText = consoleOutput.join("");

  return (
    <div className="bg-slate-50 dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-3xl p-4 flex flex-col h-full shadow-inner relative overflow-hidden shrink-0 group">
      <div className="flex items-center gap-2 mb-2 shrink-0 border-b border-slate-200 dark:border-white/5 pb-3">
        <Terminal size={14} className="text-slate-400 dark:text-slate-500" />
        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Stdout Terminal
        </span>
      </div>

      <div
        className="flex-grow overflow-y-auto custom-scrollbar font-mono text-[12px] font-medium leading-relaxed bg-slate-50 dark:bg-[#0f0f0f]"
        onClick={() =>
          consoleEndRef.current?.scrollIntoView({ behavior: "smooth" })
        }
      >
        {consoleOutput.length === 0 && (
          <div className="text-slate-400 dark:text-slate-700 italic opacity-80 flex items-center gap-2 select-none">
            <span>$</span>
            <span>./waiting_for_output...</span>
          </div>
        )}

        <div className="whitespace-pre-wrap text-emerald-700 dark:text-emerald-100/90 break-all bg-transparent">
          {consoleText}
          <span className="inline-block w-2 h-4 align-text-bottom bg-emerald-500/60 animate-pulse ml-1 mb-0.5"></span>
        </div>

        <div ref={consoleEndRef} />
      </div>
    </div>
  );
};

export default StdoutPanel;
