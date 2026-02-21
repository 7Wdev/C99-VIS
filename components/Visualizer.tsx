import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Minus, Plus, Maximize } from "lucide-react";
import { TreeNode } from "../types";
import { calculateTreeLayout } from "../utils/layout";

interface VisualizerProps {
  treeData: Record<string, TreeNode>;
  activeNodeId: string | null;
  visibleNodes: Set<string>;
  backtrackedNodes: Set<string>;
}

const Visualizer: React.FC<VisualizerProps> = ({
  treeData,
  activeNodeId,
  visibleNodes,
  backtrackedNodes,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.9 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [isDark, setIsDark] = useState(true);

  // Monitor theme changes for SVG drawing
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    setIsDark(document.documentElement.classList.contains("dark"));
    return () => observer.disconnect();
  }, []);

  // Calculate layout whenever treeData changes
  const { nodes, links } = useMemo(() => {
    // Defensive: handle empty data
    if (!treeData || Object.keys(treeData).length === 0)
      return { nodes: [], links: [] };
    return calculateTreeLayout(treeData, 100, 100);
  }, [treeData]);

  // Center the view on mount or when data loads
  useEffect(() => {
    if (nodes.length > 0 && containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      const root = nodes.find(
        (n) => !n.parent || n.parent.data.id === "__SUPER_ROOT__",
      );
      if (root) {
        setTransform((prev) => ({
          ...prev,
          x: width / 2 - root.x * prev.k,
          y: 50, // slightly reduced top margin
        }));
      }
    }
  }, [nodes.length]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(3, transform.k * scaleFactor));
    setTransform((prev) => ({ ...prev, k: newScale }));
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPan({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setStartPan({
        x: e.touches[0].clientX - transform.x,
        y: e.touches[0].clientY - transform.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      e.preventDefault();
      setTransform((prev) => ({
        ...prev,
        x: e.touches[0].clientX - startPan.x,
        y: e.touches[0].clientY - startPan.y,
      }));
    }
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Zoom Controls
  const zoomIn = () =>
    setTransform((prev) => ({ ...prev, k: Math.min(3, prev.k * 1.2) }));
  const zoomOut = () =>
    setTransform((prev) => ({ ...prev, k: Math.max(0.1, prev.k * 0.8) }));
  const fitView = () => {
    if (nodes.length > 0 && containerRef.current) {
      const { width } = containerRef.current.getBoundingClientRect();
      const root = nodes.find(
        (n) => !n.parent || n.parent.data.id === "__SUPER_ROOT__",
      );
      if (root) {
        setTransform({
          x: width / 2 - root.x * 0.9,
          y: 50,
          k: 0.9,
        });
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing shadow-inner transition-colors duration-300 ${isDark ? "bg-transparent" : "bg-transparent"}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "none" }}
    >
      {/* Grid Background Pattern */}
      <div
        className="absolute inset-0 opacity-10 dark:opacity-20 pointer-events-none transition-opacity duration-300"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(#ffffff 1px, transparent 1px)"
            : "radial-gradient(#334155 1.5px, transparent 1.5px)",
          backgroundSize: `${20 * transform.k}px ${20 * transform.k}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />

      <div
        className="absolute origin-top-left transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
        }}
      >
        <svg width={8000} height={8000} className="overflow-visible">
          <g className="links">
            {links.map((link, i) => {
              const targetId = link.target.data.id;
              const parentId = link.source.data.id;
              const targetNode = nodes.find((n) => n.data.id === targetId)?.data
                .details;

              // Show link if both ends are visible
              const isVisible =
                visibleNodes.has(targetId) && visibleNodes.has(parentId);
              if (!isVisible) return null;

              const isPathActive = targetId === activeNodeId;
              const isBacktracked = backtrackedNodes.has(targetId);
              const isDead = targetNode?.type === "dead";

              let strokeColor = isDark ? "#334155" : "#cbd5e1";
              let strokeWidth = 1.5;
              let strokeDash = "none";

              if (isPathActive) {
                strokeColor = "#ef4444";
                strokeWidth = 2.5;
              } else if (isDead) {
                strokeColor = isDark ? "#450a0a" : "#fca5a5";
                strokeDash = "4,4";
                strokeWidth = 1;
              } else if (isBacktracked) {
                strokeColor = isDark ? "#1e293b" : "#e2e8f0";
              }

              return (
                <path
                  key={i}
                  d={
                    d3
                      .linkVertical()
                      .x((d: any) => d.x)
                      .y((d: any) => d.y)(link as any) || ""
                  }
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDash}
                  className="transition-all duration-300"
                  opacity={isBacktracked ? 0.4 : 1}
                />
              );
            })}
          </g>

          <g className="nodes">
            {nodes.map((node) => {
              const nodeId = node.data.id;

              const isVisible = visibleNodes.has(nodeId);
              if (!isVisible) return null;

              const isActive = nodeId === activeNodeId;
              const nodeType = node.data.details.type || "standard"; // 'standard', 'solution', 'dead'
              const isBacktracked = backtrackedNodes.has(nodeId);

              // Robust Label Parsing
              let funcName = "";
              let labelArgs = "";
              let labelInfo = "";

              try {
                let fullLabel = node.data.details.l || "";

                // First split off the INFO portion separated by "|"
                if (fullLabel.includes("|")) {
                  const parts = fullLabel.split("|");
                  labelInfo = parts.slice(1).join("|").trim();
                  fullLabel = parts[0].trim(); // remaining is funcName(args) or just args
                }

                // Extract function name and arguments
                // Pattern: funcName(args)
                const match = fullLabel.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
                if (match) {
                  funcName = match[1];
                  labelArgs = match[2];
                } else {
                  // Fallback if no function wrapper is found
                  labelArgs = fullLabel;
                }
              } catch (e) {
                labelArgs = "Error";
              }

              // Dimensions - Compacted
              const charWidth = 7;
              const padding = 30;
              const baseHeight = 32;

              // Base height supports args. If we have a funcName, we need extra height.
              // If we have labelInfo, we need another chunk of extra height.
              let extraHeight = 0;
              if (funcName) extraHeight += 16;
              if (labelInfo) extraHeight += 16;

              const rectHeight = baseHeight + extraHeight;

              const maxTextLen = Math.max(
                funcName.length,
                labelArgs.length,
                labelInfo ? labelInfo.length : 0,
              );
              const rectWidth = Math.max(70, maxTextLen * charWidth + padding);
              const rectX = -rectWidth / 2;
              const rectY = -(rectHeight / 2);

              // Type-based Styling
              let fillColor = isDark ? "#0a0a0a" : "#ffffff";
              let strokeColor = isDark ? "#475569" : "#cbd5e1";
              let textColor = isDark ? "#e2e8f0" : "#0f172a";
              let glowColor = "rgba(0,0,0,0)";

              // 1. DEAD NODES
              if (nodeType === "dead") {
                fillColor = isDark ? "#0f0505" : "#fef2f2";
                strokeColor = isDark ? "#450a0a" : "#fca5a5";
                textColor = isDark ? "#525252" : "#94a3b8";
              }
              // 2. SOLUTION NODES
              else if (nodeType === "solution") {
                fillColor = isDark ? "#064e3b" : "#d1fae5";
                strokeColor = isDark ? "#34d399" : "#10b981";
                textColor = isDark ? "#d1fae5" : "#064e3b";
                if (isActive) glowColor = "rgba(16, 185, 129, 0.5)";
                else glowColor = "rgba(16, 185, 129, 0.1)";
              }

              // 3. ACTIVE STATE OVERRIDES
              if (isActive) {
                if (nodeType === "dead") {
                  strokeColor = "#ef4444";
                  textColor = isDark ? "#fca5a5" : "#7f1d1d";
                } else if (nodeType !== "solution") {
                  // Active Standard Node
                  fillColor = isDark ? "#1a0505" : "#fef2f2";
                  strokeColor = "#ef4444";
                  textColor = isDark ? "#ffffff" : "#7f1d1d";
                  glowColor = "rgba(239, 68, 68, 0.4)";
                }
              } else if (isBacktracked) {
                // 4. BACKTRACKED STATE
                if (nodeType === "dead") {
                  fillColor = isDark ? "#000000" : "#f8fafc";
                  strokeColor = isDark ? "#2a0a0a" : "#e2e8f0";
                  textColor = isDark ? "#404040" : "#cbd5e1";
                } else if (nodeType === "solution") {
                  fillColor = isDark ? "#064e3b" : "#d1fae5";
                  strokeColor = isDark ? "#059669" : "#34d399";
                  textColor = isDark ? "#6ee7b7" : "#047857";
                } else {
                  fillColor = isDark ? "#050505" : "#f8fafc";
                  strokeColor = isDark ? "#1e293b" : "#e2e8f0";
                  textColor = isDark ? "#475569" : "#94a3b8";
                }
              }

              return (
                <g
                  key={nodeId}
                  transform={`translate(${node.x},${node.y})`}
                  className="transition-all duration-300"
                  style={{
                    opacity: isBacktracked && nodeType === "dead" ? 0.5 : 1,
                  }}
                >
                  {/* Shadow/Glow */}
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectWidth}
                    height={rectHeight}
                    rx={10}
                    fill={glowColor}
                    filter="blur(8px)"
                    className="transition-colors duration-300"
                  />

                  {/* Main Node Shape */}
                  <rect
                    x={rectX}
                    y={rectY}
                    width={rectWidth}
                    height={rectHeight}
                    rx={10}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isActive ? 2 : 1.5}
                    strokeDasharray={nodeType === "dead" ? "4 2" : "none"} // Dashed border for dead nodes
                    className="transition-all duration-300"
                  />

                  {/* Icons for specific types */}
                  {nodeType === "dead" && (
                    <g
                      transform={`translate(${rectX + rectWidth - 14}, ${rectY - 5}) scale(0.85)`}
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="8"
                        fill="#1f0a0a"
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                      <path
                        d="M5 5 L11 11 M11 5 L5 11"
                        stroke={strokeColor}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </g>
                  )}

                  {nodeType === "solution" && (
                    <g
                      transform={`translate(${rectX + rectWidth - 14}, ${rectY - 5}) scale(0.85)`}
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="8"
                        fill="#064e3b"
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                      <path
                        d="M5 8 L7 10 L11 5"
                        stroke={strokeColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </g>
                  )}

                  {/* Text Group */}
                  <text
                    textAnchor="middle"
                    fill={textColor}
                    className="font-mono font-bold select-none pointer-events-none tracking-tight"
                  >
                    {/* Function Name (Optional) */}
                    {funcName && (
                      <tspan
                        x="0"
                        dy={-(rectHeight / 2) + 20}
                        fontSize="12px"
                        fill={
                          isActive ? "#f87171" : isDark ? "#94a3b8" : "#475569"
                        }
                      >
                        {funcName}
                      </tspan>
                    )}

                    {/* Primary Args - Smaller font */}
                    <tspan
                      x="0"
                      dy={funcName ? "14" : labelInfo ? "-2" : "4"}
                      fontSize="11px"
                    >
                      {labelArgs}
                    </tspan>

                    {/* Secondary Info - Smaller font */}
                    {labelInfo && (
                      <tspan
                        x="0"
                        dy="15"
                        fontSize="9px"
                        fill={
                          nodeType === "dead"
                            ? "#7f1d1d"
                            : nodeType === "solution"
                              ? "#6ee7b7"
                              : isActive
                                ? "#fca5a5"
                                : "#64748b"
                        }
                      >
                        {labelInfo}
                      </tspan>
                    )}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-auto z-10">
        <div className="glass px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/50 backdrop-blur-md mb-1 shadow-sm">
          <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono font-bold">
            Zoom: {Math.round(transform.k * 100)}%
          </span>
        </div>
        <div className="flex flex-col gap-1 bg-white/80 dark:bg-black/80 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl p-1.5 shadow-sm">
          <button
            onClick={zoomIn}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={zoomOut}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition"
          >
            <Minus size={16} />
          </button>
          <div className="h-px bg-slate-200 dark:bg-white/10 mx-1.5 my-1"></div>
          <button
            onClick={fitView}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition"
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Visualizer;
