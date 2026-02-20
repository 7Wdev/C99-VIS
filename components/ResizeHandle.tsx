import React from "react";
import { PanelResizeHandle } from "react-resizable-panels";

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ direction }) => {
  return (
    <PanelResizeHandle
      className={`relative flex group items-center justify-center bg-transparent transition-all z-20 hover:bg-slate-200/60 dark:hover:bg-white/5 active:bg-slate-300/60 dark:active:bg-white/10
        ${direction === "horizontal" ? "w-2 cursor-col-resize flex-col" : "h-2 cursor-row-resize flex-row"}
      `}
    >
      <div
        className={`bg-slate-300 dark:bg-white/10 group-hover:bg-red-500 group-active:bg-red-600 transition-all duration-150 rounded-full group-hover:scale-110
          ${direction === "horizontal" ? "w-1 h-8 group-hover:w-1.5 group-hover:h-10" : "w-8 h-1 group-hover:w-10 group-hover:h-1.5"}
        `}
      />
    </PanelResizeHandle>
  );
};

export default ResizeHandle;
