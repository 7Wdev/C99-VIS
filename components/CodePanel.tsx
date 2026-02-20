import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Edit3,
  Code as CodeIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface CodePanelProps {
  code: string;
  isEditing: boolean;
  activeLine: number | null;
  onCodeChange: (code: string) => void;
  onToggleEdit: () => void;
  readOnly?: boolean;
}

const SyntaxHighlighter: React.FC<{ code: string }> = ({ code }) => {
  const highlighted = useMemo(() => {
    // Simple C-syntax tokenizer
    const parts = code.split(
      /(\/\/.*|\/\*[\s\S]*?\*\/|".*?"|'.*?'|\b(?:int|void|char|float|double|bool|if|else|for|while|return|continue|break|struct|case|switch|default|const|static|typedef)\b|\b\d+\b|[{}()[\];,])/g,
    );

    return parts.map((part, i) => {
      if (!part) return null;
      // Comments
      if (part.startsWith("//") || part.startsWith("/*"))
        return (
          <span key={i} className="text-slate-500 italic">
            {part}
          </span>
        );
      // Strings/Chars
      if (part.startsWith('"') || part.startsWith("'"))
        return (
          <span key={i} className="text-emerald-400">
            {part}
          </span>
        );
      // Numbers
      if (/^\d+$/.test(part))
        return (
          <span key={i} className="text-orange-400">
            {part}
          </span>
        );
      // Keywords
      if (
        /^(int|void|char|float|double|bool|if|else|for|while|return|continue|break|struct|case|switch|default|const|static|typedef)$/.test(
          part,
        )
      ) {
        return (
          <span key={i} className="text-purple-400 font-bold">
            {part}
          </span>
        );
      }
      // Punctuation
      if (/^[{}()[\];,]$/.test(part))
        return (
          <span key={i} className="text-slate-400 dark:text-slate-400">
            {part}
          </span>
        );
      // Default (Identifiers etc)
      return (
        <span key={i} className="text-slate-800 dark:text-slate-200">
          {part}
        </span>
      );
    });
  }, [code]);

  return <>{highlighted}</>;
};

const CodePanel: React.FC<CodePanelProps> = ({
  code,
  isEditing,
  activeLine,
  onCodeChange,
  onToggleEdit,
  readOnly,
}) => {
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-scroll to active line in view mode
  useEffect(() => {
    if (
      !isEditing &&
      !isExpanded &&
      activeLine &&
      lineRefs.current[activeLine] &&
      scrollContainerRef.current
    ) {
      const el = lineRefs.current[activeLine];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeLine, isEditing, isExpanded]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const containerClasses = isExpanded
    ? "fixed inset-0 z-[100] bg-slate-50 dark:bg-[#0a0a0a] flex flex-col animate-in fade-in duration-200"
    : "bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/5 rounded-3xl flex flex-col overflow-hidden h-full shadow-xl transition-all duration-300";

  return (
    <div className={containerClasses}>
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <CodeIcon size={16} className="text-red-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {isEditing ? "Editing Source" : "Source Code"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              onClick={onToggleEdit}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[10px] flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none"
            >
              {isEditing ? (
                <>
                  <Play size={10} />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <Edit3 size={10} />
                  <span>Edit</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={toggleExpand}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      <div className="relative flex-grow overflow-hidden flex flex-col">
        {isEditing ? (
          <div className="relative w-full h-full">
            <textarea
              className="absolute inset-0 w-full h-full bg-slate-50 dark:bg-[#0a0a0a] p-4 pl-12 text-[13px] font-mono leading-relaxed text-slate-800 dark:text-slate-300 focus:outline-none resize-none z-10 custom-scrollbar"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              spellCheck={false}
              placeholder="// Write your C code here..."
            />
            {/* Line Numbers Background for Edit Mode */}
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-slate-100 dark:bg-white/5 border-r border-slate-200 dark:border-white/5 pointer-events-none z-20 flex flex-col pt-4 items-center text-[10px] text-slate-400 dark:text-slate-600 font-mono leading-relaxed">
              {code.split("\n").map((_, i) => (
                <div key={i} className="h-[20px] leading-relaxed select-none">
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Note: Aligning textarea perfectly with custom line numbers is tricky, so simpler approach: */}
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="w-full h-full overflow-y-auto p-4 custom-scrollbar bg-white dark:bg-[#0a0a0a]"
          >
            {code.split("\n").map((line, idx) => {
              const lineNum = idx + 1;
              const isActive = activeLine === lineNum;
              return (
                <div
                  key={lineNum}
                  ref={(el) => {
                    lineRefs.current[lineNum] = el;
                  }}
                  className={`
                    group flex text-[13px] font-mono leading-relaxed rounded-md px-2 -mx-2 min-h-[1.5em] transition-colors
                    ${isActive ? "bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.05)]" : "border-l-2 border-transparent hover:bg-slate-50 dark:hover:bg-white/5"}
                  `}
                >
                  <span
                    className={`w-6 shrink-0 text-right mr-4 select-none text-[11px] py-[2px] ${isActive ? "text-red-500 font-bold" : "text-slate-400 dark:text-slate-700"}`}
                  >
                    {lineNum}
                  </span>
                  <span
                    className={`whitespace-pre wrap-words ${isActive ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    <SyntaxHighlighter code={line} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodePanel;
