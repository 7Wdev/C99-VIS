import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Play,
  RotateCcw,
  Cpu,
  Settings,
  Zap,
  Layers,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CodePanel from "./components/CodePanel";
import ControlPanel from "./components/ControlPanel";
import Visualizer from "./components/Visualizer";
import ComplexityCard from "./components/ComplexityCard";
import ArrayVisualizer from "./components/ArrayVisualizer";
import StackVisualizer from "./components/StackVisualizer";
import ChatWidget from "./components/ChatWidget";
import { PRESETS, SimulationData, StepState } from "./types";
import { SimulationSession } from "./services/geminiService";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import ResizeHandle from "./components/ResizeHandle";
import StdoutPanel from "./components/StdoutPanel";

const LOADING_PHRASES = [
  "Traversing recursive pathways and logic states...",
  "Analyzing control flow and tracking variables...",
  "Constructing call stack snapshots line by line...",
  "Generating multi-dimensional array structures...",
  "Synchronizing AST nodes with AI reasoning...",
  "Evaluating pointer references and memory bounds...",
  "Optimizing JSON serialization of execution data...",
  "Running deep deterministic static analysis...",
];

const App: React.FC = () => {
  // Config State
  const [selectedPresetId, setSelectedPresetId] = useState<string>("subsets");
  const [code, setCode] = useState<string>(PRESETS[0].code);
  const [inputVal, setInputVal] = useState<string>(PRESETS[0].defaultInput);

  // Simulation State
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulatingFull, setIsSimulatingFull] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState<{
    steps: number;
    batches: number;
    isComplete: boolean;
  }>({ steps: 0, batches: 0, isComplete: false });
  const [simData, setSimData] = useState<SimulationData | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [loadingPhraseIdx, setLoadingPhraseIdx] = useState(0);

  useEffect(() => {
    if (isSimulatingFull || isLoading) {
      const interval = setInterval(() => {
        setLoadingPhraseIdx((prev) => (prev + 1) % LOADING_PHRASES.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isSimulatingFull, isLoading]);

  // Responsive: detect desktop (≥1024px) for panel layout vs stacked
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    setIsDesktop(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Session Ref
  const sessionRef = useRef<SimulationSession | null>(null);

  // UI State
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    localStorage.getItem("theme") !== "light",
  );
  const [customApiKey, setCustomApiKey] = useState<string>(
    localStorage.getItem("gemini_api_key") || "",
  );
  const [simModel, setSimModel] = useState<string>(
    localStorage.getItem("gemini_sim_model") || "gemini-3.1-pro-preview",
  );
  const [chatModel, setChatModel] = useState<string>(
    localStorage.getItem("gemini_chat_model") || "gemini-3.1-pro-preview",
  );

  const saveApiKey = (key: string) => {
    setCustomApiKey(key);
    localStorage.setItem("gemini_api_key", key);
  };

  const saveSimModel = (model: string) => {
    setSimModel(model);
    localStorage.setItem("gemini_sim_model", model);
  };

  const saveChatModel = (model: string) => {
    setChatModel(model);
    localStorage.setItem("gemini_chat_model", model);
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Load preset
  useEffect(() => {
    if (selectedPresetId === "custom") {
      setIsEditing(true);
      return;
    }
    const preset = PRESETS.find((p) => p.id === selectedPresetId);
    if (preset) {
      setCode(preset.code);
      setInputVal(preset.defaultInput);
      setIsEditing(false);
    }
  }, [selectedPresetId]);

  const handleBuild = async () => {
    setIsLoading(true);
    setIsSimulatingFull(true);
    setSimulationProgress({ steps: 0, batches: 0, isComplete: false });
    setSimData(null);
    setCurrentStepIdx(-1);
    setConsoleOutput([]);

    if (!customApiKey && !process.env.API_KEY) {
      alert("Please configure your Gemini API Key in Settings first.");
      setShowSettings(true);
      setIsLoading(false);
      setIsSimulatingFull(false);
      return;
    }

    sessionRef.current = new SimulationSession(
      customApiKey,
      simModel,
      chatModel,
    );

    // Call Gemini for the first batch
    let data = await sessionRef.current.start(code, inputVal);

    if (data) {
      setSimData(data);
      setCurrentStepIdx(0);
      if (data.steps[0]?.out) {
        setConsoleOutput([data.steps[0].out]);
      }
      setSimulationProgress({
        steps: data.steps.length,
        batches: 1,
        isComplete: !!data.isComplete,
      });

      // Automatically fetch more batches until isComplete is true
      let currentData = data;
      let sanityLimit = 0;
      while (!currentData.isComplete && sanityLimit < 20) {
        sanityLimit++;
        const moreData = await sessionRef.current?.nextBatch();
        if (!moreData) break;

        setSimData((prev) => {
          if (!prev) return moreData;
          return {
            ...moreData,
            steps: [...prev.steps, ...moreData.steps],
            tree: { ...prev.tree, ...moreData.tree },
          };
        });

        setSimulationProgress((prev) => ({
          steps: prev.steps + moreData.steps.length,
          batches: prev.batches + 1,
          isComplete: !!moreData.isComplete,
        }));

        currentData = moreData;
      }
    } else {
      alert(
        "Failed to generate simulation. Please check the API key or try simpler code.",
      );
    }

    setIsAutoPlaying(false);
    setIsLoading(false);

    // Give a short delay before dropping the loader completely for smoothness
    setTimeout(() => {
      setIsSimulatingFull(false);
    }, 500);
  };

  const handleNext = useCallback(() => {
    if (!simData) return;
    if (currentStepIdx < simData.steps.length - 1) {
      const nextIdx = currentStepIdx + 1;
      setCurrentStepIdx(nextIdx);
      const step = simData.steps[nextIdx];
      if (step.out) {
        setConsoleOutput((prev) => [...prev, step.out!]);
      }
    }
  }, [simData, currentStepIdx]);

  const handlePrev = useCallback(() => {
    if (currentStepIdx > 0) {
      const nextIdx = currentStepIdx - 1;
      setCurrentStepIdx(nextIdx);

      // Rebuild console output EXACTLY up to the new index
      if (simData) {
        const newOutput: string[] = [];
        // Include step 0 up to nextIdx inclusive
        for (let i = 0; i <= nextIdx; i++) {
          if (simData.steps[i].out) newOutput.push(simData.steps[i].out!);
        }
        setConsoleOutput(newOutput);
      }
    }
    // Stop autoplay when manually interrupting
    setIsAutoPlaying(false);
  }, [currentStepIdx, simData]);

  // Auto-play interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (isAutoPlaying && simData) {
      // If we're at the end, stop autoplay
      if (currentStepIdx >= simData.steps.length - 1) {
        setIsAutoPlaying(false);
      } else {
        intervalId = setInterval(() => {
          handleNext();
        }, 600); // 600ms = "smooth" enough to see transitions
      }
    }
    return () => clearInterval(intervalId);
  }, [isAutoPlaying, currentStepIdx, simData, handleNext]);

  // Derived state for children
  const currentStep = simData?.steps[currentStepIdx];
  const activeLine = currentStep?.L || null;
  const activeNodeId = currentStep?.n || null;
  const currentState = currentStep?.s || null;
  const currentStack = currentState?.stack || [];

  // Calculate Node Visibility & State
  const { visibleNodes, backtrackedNodes } = useMemo(() => {
    if (!simData || currentStepIdx === -1) {
      return {
        visibleNodes: new Set<string>(),
        backtrackedNodes: new Set<string>(),
      };
    }

    const visible = new Set<string>();
    // Add all nodes visited up to current step
    for (let i = 0; i <= currentStepIdx; i++) {
      const nId = simData.steps[i].n;
      if (nId) visible.add(nId);
    }

    // Identify ancestors of the current active node
    const ancestors = new Set<string>();
    let curr = activeNodeId;
    while (curr && simData.tree[curr]) {
      ancestors.add(curr);
      curr = simData.tree[curr].p;
    }

    // Backtracked = Visible AND NOT (Active OR Ancestor)
    const backtracked = new Set<string>();
    visible.forEach((id) => {
      if (!ancestors.has(id)) {
        backtracked.add(id);
      }
    });

    return { visibleNodes: visible, backtrackedNodes: backtracked };
  }, [simData, currentStepIdx, activeNodeId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleNext, handlePrev]);

  return (
    // Responsive Root
    <div className="flex flex-col h-[100dvh] font-sans overflow-hidden text-sm selection:bg-red-500/30">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="shrink-0 p-2 lg:p-3 border-b border-slate-200 dark:border-white/5 bg-white/60 dark:bg-[#050505]/80 backdrop-blur-2xl z-50 sticky top-0 lg:static shadow-sm"
      >
        <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
          {/* Branding */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 lg:w-8 lg:h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/40">
              <Zap className="text-white" size={16} fill="currentColor" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm lg:text-lg font-bold text-slate-800 dark:text-white tracking-tight leading-tight">
                C99 <span className="text-red-500 font-light">VISUALIZER</span>
              </h1>
              <p className="text-[8px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-1">
                <Cpu size={8} /> Powered by Gemini Pro 3.1
              </p>
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-grow flex-wrap bg-white dark:bg-white/5 rounded-xl lg:rounded-2xl border border-slate-200 dark:border-white/5 p-1 shadow-sm dark:shadow-none">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 lg:p-2 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition shrink-0"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 lg:p-2 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition shrink-0"
              title="Settings"
            >
              <Settings size={16} />
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-white/10 hidden sm:block"></div>

            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition cursor-pointer min-w-0 flex-shrink"
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  Preset: {p.name}
                </option>
              ))}
              <option value="custom">Custom Code</option>
            </select>

            <div className="relative flex-grow min-w-[80px] group">
              <span className="absolute -top-1 left-2 bg-white dark:bg-[#131313] px-1 text-[7px] text-slate-500 uppercase font-bold group-focus-within:text-red-500 transition-colors z-10">
                Args
              </span>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition w-full placeholder-slate-400 dark:placeholder-slate-700"
                placeholder="e.g. arr={1,2}"
              />
            </div>

            <button
              onClick={handleBuild}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-500 text-white px-3 lg:px-5 py-1.5 rounded-lg text-[11px] font-bold transition shadow-lg shadow-red-900/20 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Processing...</span>
                </>
              ) : (
                <>
                  <Play size={11} fill="currentColor" />
                  <span>Visualize</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Main Content Area */}
      <main className="flex-grow min-h-0 p-2 lg:p-3 overflow-hidden bg-slate-50 dark:bg-[#050505]">
        {/* Desktop: 3-column resizable panels */}
        {isDesktop ? (
          <PanelGroup
            direction="horizontal"
            className="h-full w-full max-w-[1920px] mx-auto"
          >
            {/* Left Column: Code, Controls, Stack */}
            <Panel
              defaultSize={25}
              minSize={15}
              maxSize={40}
              className="flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar pr-1 pb-4"
            >
              <div className="h-[280px] shrink-0">
                <CodePanel
                  code={code}
                  isEditing={isEditing}
                  activeLine={activeLine}
                  onCodeChange={setCode}
                  onToggleEdit={() => setIsEditing(!isEditing)}
                  readOnly={selectedPresetId !== "custom"}
                />
              </div>

              <div className="shrink-0 flex flex-col scale-100 origin-top">
                <ControlPanel
                  currentStepIndex={currentStepIdx}
                  totalSteps={simData?.steps.length || 0}
                  currentState={currentState}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  isAutoPlaying={isAutoPlaying}
                  onToggleAutoPlay={() => setIsAutoPlaying(!isAutoPlaying)}
                />
              </div>

              {/* Call Stack */}
              <div className="h-[220px] shrink-0 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/5 rounded-3xl p-4 shadow-xl flex flex-col relative overflow-hidden">
                <div className="flex items-center gap-2 mb-2 border-b border-slate-200 dark:border-white/5 pb-2 shrink-0">
                  <Layers
                    size={14}
                    className="text-blue-500 dark:text-blue-400"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Call Stack
                  </span>
                </div>
                <StackVisualizer stack={currentStack} />
              </div>
            </Panel>

            <ResizeHandle direction="horizontal" />

            {/* Center Column: Visualizer Tree & Arrays */}
            <Panel defaultSize={55} minSize={30} maxSize={75}>
              <PanelGroup direction="vertical" className="h-full">
                {/* Top Center: Tree Visualizer */}
                <Panel
                  defaultSize={70}
                  minSize={20}
                  maxSize={85}
                  className="relative group border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden bg-white/60 dark:bg-[#050505]/80 backdrop-blur-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-white/5 transition-all duration-500 flex flex-col"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-red-500/5 dark:from-red-900/10 to-transparent pointer-events-none z-10 opacity-50 mix-blend-overlay"></div>
                  <div className="flex-grow relative h-full w-full">
                    <Visualizer
                      treeData={simData?.tree || {}}
                      activeNodeId={activeNodeId}
                      visibleNodes={visibleNodes}
                      backtrackedNodes={backtrackedNodes}
                    />
                    {!simData && !isLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="text-center space-y-4">
                          <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto border border-slate-200 dark:border-white/10 shadow-inner">
                            <Cpu
                              size={36}
                              className="text-slate-400 dark:text-slate-600"
                            />
                          </div>
                          <div>
                            <h3 className="text-slate-800 dark:text-slate-300 font-bold text-base">
                              Ready to Visualize
                            </h3>
                            <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">
                              Select a preset or enter your own C code, then
                              click 'Visualize'.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Panel>

                <ResizeHandle direction="vertical" />

                {/* Bottom Center: Array Visualizer */}
                <Panel
                  defaultSize={30}
                  minSize={10}
                  maxSize={60}
                  className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/5 rounded-3xl p-4 shadow-2xl flex flex-col relative overflow-hidden transition-colors duration-300"
                >
                  <div className="flex items-center gap-2 mb-3 border-b border-slate-200 dark:border-white/5 pb-2 shrink-0">
                    <Layers
                      size={14}
                      className="text-orange-500 dark:text-orange-400"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Data Structures
                    </span>
                  </div>
                  <div className="flex-grow overflow-auto custom-scrollbar">
                    {currentState ? (
                      <ArrayVisualizer
                        vars={currentState.vars}
                        identifiedPointers={simData?.pointers}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-[12px] text-slate-400 dark:text-slate-600 italic">
                        Data structures will appear here...
                      </div>
                    )}
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>

            <ResizeHandle direction="horizontal" />

            {/* Right Column: Complexity & Stdout */}
            <Panel
              defaultSize={20}
              minSize={12}
              maxSize={35}
              className="flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar pl-1 pb-4"
            >
              <ComplexityCard
                time={simData?.complexity?.time}
                space={simData?.complexity?.space}
                explanation={simData?.complexity?.explanation}
              />
              <div className="flex-grow min-h-[250px] overflow-hidden">
                <StdoutPanel consoleOutput={consoleOutput} />
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          /* Tablet & Mobile: Stacked scrollable layout */
          <div className="h-full overflow-y-auto custom-scrollbar space-y-3 pb-6">
            {/* Code Editor */}
            <div className="h-[240px] md:h-[280px]">
              <CodePanel
                code={code}
                isEditing={isEditing}
                activeLine={activeLine}
                onCodeChange={setCode}
                onToggleEdit={() => setIsEditing(!isEditing)}
                readOnly={selectedPresetId !== "custom"}
              />
            </div>

            {/* Nav + Vars */}
            <ControlPanel
              currentStepIndex={currentStepIdx}
              totalSteps={simData?.steps.length || 0}
              currentState={currentState}
              onNext={handleNext}
              onPrev={handlePrev}
              isAutoPlaying={isAutoPlaying}
              onToggleAutoPlay={() => setIsAutoPlaying(!isAutoPlaying)}
            />

            {/* Tree Visualizer */}
            <div className="h-[350px] md:h-[450px] relative group border border-slate-200 dark:border-white/5 rounded-3xl overflow-hidden bg-white/60 dark:bg-[#050505]/80 backdrop-blur-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-red-500/5 dark:from-red-900/10 to-transparent pointer-events-none z-10 opacity-50 mix-blend-overlay"></div>
              <Visualizer
                treeData={simData?.tree || {}}
                activeNodeId={activeNodeId}
                visibleNodes={visibleNodes}
                backtrackedNodes={backtrackedNodes}
              />
              {!simData && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto border border-slate-200 dark:border-white/10 shadow-inner">
                      <Cpu
                        size={28}
                        className="text-slate-400 dark:text-slate-600"
                      />
                    </div>
                    <div>
                      <h3 className="text-slate-800 dark:text-slate-300 font-bold text-sm">
                        Ready to Visualize
                      </h3>
                      <p className="text-slate-500 text-xs max-w-xs mx-auto mt-1">
                        Select a preset or enter code, then click 'Visualize'.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Data Structures */}
            <div className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/5 rounded-3xl p-4 shadow-2xl">
              <div className="flex items-center gap-2 mb-3 border-b border-slate-200 dark:border-white/5 pb-2">
                <Layers
                  size={14}
                  className="text-orange-500 dark:text-orange-400"
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Data Structures
                </span>
              </div>
              <div className="min-h-[100px] overflow-auto custom-scrollbar">
                {currentState ? (
                  <ArrayVisualizer
                    vars={currentState.vars}
                    identifiedPointers={simData?.pointers}
                  />
                ) : (
                  <div className="flex items-center justify-center h-20 text-[12px] text-slate-400 dark:text-slate-600 italic">
                    Data structures will appear here...
                  </div>
                )}
              </div>
            </div>

            {/* Two-column grid for smaller panels on tablet, stacked on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Call Stack */}
              <div className="h-[200px] bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-2xl border border-slate-200 dark:border-white/5 rounded-3xl p-4 shadow-xl flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 mb-2 border-b border-slate-200 dark:border-white/5 pb-2 shrink-0">
                  <Layers
                    size={14}
                    className="text-blue-500 dark:text-blue-400"
                  />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Call Stack
                  </span>
                </div>
                <StackVisualizer stack={currentStack} />
              </div>

              {/* Complexity */}
              <ComplexityCard
                time={simData?.complexity?.time}
                space={simData?.complexity?.space}
                explanation={simData?.complexity?.explanation}
              />
            </div>

            {/* Stdout */}
            <div className="h-[200px]">
              <StdoutPanel consoleOutput={consoleOutput} />
            </div>
          </div>
        )}
      </main>

      {/* Full Screen Loading Overlay */}
      <AnimatePresence>
        {isSimulatingFull && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: { duration: 0.8, ease: "easeInOut" },
            }}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-[#050505] font-sans text-slate-900 dark:text-white/90"
          >
            {/* Background Vignettting */}
            <div className="absolute inset-0 z-0 bg-gradient-to-radial from-transparent via-slate-200/50 to-slate-300/80 dark:via-[#050505]/80 dark:to-[#020202] pointer-events-none" />

            {/* --- Animated Neural Network SVG --- */}
            <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center opacity-30 dark:opacity-80 dark:mix-blend-screen overflow-visible">
              <svg
                className="w-full h-full min-w-[100vw] min-h-[100vh] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                viewBox="0 0 1000 800"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  {/* Glowing Red Node Filter */}
                  <filter
                    id="glowRed"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Glowing White Node Filter */}
                  <filter
                    id="glowWhite"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Pulse Animation for Lines */}
                  <linearGradient
                    id="linePulse"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop
                      offset="0%"
                      stopColor={isDarkMode ? "#111" : "#e2e8f0"}
                    />
                    <stop offset="50%" stopColor="#ff1744" />
                    <stop
                      offset="100%"
                      stopColor={isDarkMode ? "#111" : "#e2e8f0"}
                    />
                  </linearGradient>
                </defs>

                {/* --- Connections (Synapses) --- */}
                {/* Use a set of paths with stroke-dasharray animations to look like data traveling */}
                {[
                  // Layer 1 to 2
                  { path: "M200,200 L400,100", d: 1 },
                  { path: "M200,200 L400,300", d: 1.5 },
                  { path: "M200,200 L400,500", d: 2 },
                  { path: "M200,400 L400,300", d: 1.2 },
                  { path: "M200,400 L400,500", d: 1.7 },
                  { path: "M200,400 L400,700", d: 2.2 },
                  { path: "M200,600 L400,500", d: 1.1 },
                  { path: "M200,600 L400,700", d: 1.6 },

                  // Layer 2 to 3 (Hidden)
                  { path: "M400,100 L600,200", d: 2.5 },
                  { path: "M400,100 L600,400", d: 3 },
                  { path: "M400,300 L600,200", d: 2.1 },
                  { path: "M400,300 L600,400", d: 2.6 },
                  { path: "M400,300 L600,600", d: 3.1 },
                  { path: "M400,500 L600,400", d: 2.2 },
                  { path: "M400,500 L600,600", d: 2.7 },
                  { path: "M400,700 L600,600", d: 2.3 },

                  // Layer 3 to Output
                  { path: "M600,200 L800,300", d: 3.5 },
                  { path: "M600,200 L800,500", d: 4 },
                  { path: "M600,400 L800,300", d: 3.1 },
                  { path: "M600,400 L800,500", d: 3.6 },
                  { path: "M600,600 L800,500", d: 3.2 },
                ].map((conn, i) => (
                  <g key={`conn-${i}`}>
                    {/* Base dim connection line */}
                    <path
                      d={conn.path}
                      stroke={isDarkMode ? "#222" : "#cbd5e1"}
                      strokeWidth="1.5"
                      fill="none"
                    />
                    {/* Glowing pulse riding the path */}
                    <motion.path
                      d={conn.path}
                      stroke="url(#linePulse)"
                      strokeWidth="2"
                      fill="none"
                      initial={{ pathLength: 0, pathOffset: 0, opacity: 0 }}
                      animate={{
                        pathLength: [0, 0.2, 0],
                        pathOffset: [0, 0.8, 1],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "linear",
                        delay: conn.d,
                      }}
                    />
                  </g>
                ))}

                {/* --- Nodes (Neurons) --- */}
                {[
                  // Input Layer
                  {
                    cx: 200,
                    cy: 200,
                    r: 8,
                    color: "white",
                    glow: "glowWhite",
                    delay: 0,
                  },
                  {
                    cx: 200,
                    cy: 400,
                    r: 10,
                    color: "red",
                    glow: "glowRed",
                    delay: 0.5,
                  },
                  {
                    cx: 200,
                    cy: 600,
                    r: 8,
                    color: "white",
                    glow: "glowWhite",
                    delay: 1,
                  },

                  // Hidden Layer 1
                  {
                    cx: 400,
                    cy: 100,
                    r: 7,
                    color: "white",
                    glow: "glowWhite",
                    delay: 1.2,
                  },
                  {
                    cx: 400,
                    cy: 300,
                    r: 12,
                    color: "red",
                    glow: "glowRed",
                    delay: 0.2,
                  },
                  {
                    cx: 400,
                    cy: 500,
                    r: 9,
                    color: "white",
                    glow: "glowWhite",
                    delay: 1.5,
                  },
                  {
                    cx: 400,
                    cy: 700,
                    r: 11,
                    color: "red",
                    glow: "glowRed",
                    delay: 0.8,
                  },

                  // Hidden Layer 2
                  {
                    cx: 600,
                    cy: 200,
                    r: 10,
                    color: "red",
                    glow: "glowRed",
                    delay: 1.8,
                  },
                  {
                    cx: 600,
                    cy: 400,
                    r: 14,
                    color: "white",
                    glow: "glowWhite",
                    delay: 0.3,
                  },
                  {
                    cx: 600,
                    cy: 600,
                    r: 8,
                    color: "red",
                    glow: "glowRed",
                    delay: 1.1,
                  },

                  // Output Layer
                  {
                    cx: 800,
                    cy: 300,
                    r: 16,
                    color: "red",
                    glow: "glowRed",
                    delay: 2.2,
                  },
                  {
                    cx: 800,
                    cy: 500,
                    r: 12,
                    color: "white",
                    glow: "glowWhite",
                    delay: 2.5,
                  },
                ].map((node, i) => (
                  <motion.circle
                    key={`node-${i}`}
                    cx={node.cx}
                    cy={node.cy}
                    r={node.r}
                    initial={{ r: node.r, opacity: 0.6 }}
                    fill={
                      node.color === "red"
                        ? "#ff1744"
                        : isDarkMode
                          ? "#ffffff"
                          : "#1e293b"
                    }
                    filter={`url(#${node.glow})`}
                    animate={{
                      r: [node.r, node.r * 1.4, node.r],
                      opacity: [0.6, 1, 0.6],
                    }}
                    transition={{
                      duration: node.color === "red" ? 1.5 : 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: node.delay,
                    }}
                  />
                ))}
              </svg>
            </div>

            {/* --- Core Text & Progress Overlay --- */}
            {/* We position this highly visible over the animation */}
            <div className="relative z-10 flex flex-col items-center max-w-2xl px-8 mt-[20vh]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="flex items-center gap-4 mb-3"
              >
                <div className="p-2.5 bg-red-600/10 dark:bg-red-600/20 rounded-2xl border border-red-500/20 dark:border-red-500/30 backdrop-blur-md">
                  <Cpu size={32} className="text-red-500" />
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-600 to-slate-500 dark:from-white dark:via-white dark:to-white/50 drop-shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  Simulating Execution
                </h1>
              </motion.div>

              <div className="h-16 flex items-center justify-center mb-10 w-full max-w-lg relative perspective-1000">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingPhraseIdx}
                    initial={{ opacity: 0, rotateX: -20, y: 15 }}
                    animate={{ opacity: 1, rotateX: 0, y: 0 }}
                    exit={{ opacity: 0, rotateX: 20, y: -15 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="text-lg text-slate-500 dark:text-white/60 font-medium text-center leading-relaxed absolute"
                  >
                    {LOADING_PHRASES[loadingPhraseIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Dynamic Stats Row */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex items-center gap-6 md:gap-12 mb-12"
              >
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-red-500/80 mb-1">
                    Current Batch
                  </span>
                  <div className="text-3xl font-mono font-light text-slate-800 dark:text-white flex items-baseline">
                    <motion.span
                      key={simulationProgress.batches}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                    >
                      {String(simulationProgress.batches).padStart(2, "0")}
                    </motion.span>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-px h-12 bg-gradient-to-b from-transparent via-slate-300 dark:via-white/20 to-transparent" />

                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400 dark:text-white/40 mb-1">
                    Steps Decoded
                  </span>
                  <div className="text-3xl font-mono font-light text-slate-800 dark:text-white flex items-baseline gap-1">
                    <motion.span
                      key={simulationProgress.steps}
                      initial={{ scale: 1.2, color: "#ff1744" }}
                      animate={{
                        scale: 1,
                        color: isDarkMode ? "#ffffff" : "#1e293b",
                      }}
                    >
                      {simulationProgress.steps}
                    </motion.span>
                  </div>
                </div>
              </motion.div>

              {/* Minimalist Progress Line */}
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "100%", opacity: 1 }}
                transition={{ duration: 1, delay: 0.8 }}
                className="w-full max-w-md h-px bg-slate-200 dark:bg-white/10 relative overflow-hidden"
              >
                {/* The "Head" of the progress */}
                <motion.div
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-red-500 to-white w-[30%]"
                  animate={{
                    x: ["-100%", "333%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>

              {/* Simulated AI Log Ticker */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1 }}
                className="mt-12 text-[10px] sm:text-xs font-mono text-slate-400 dark:text-white/30 uppercase tracking-widest flex items-center gap-3 drop-shadow-sm"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(255,23,68,0.8)] animate-pulse" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={loadingPhraseIdx}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 5 }}
                    transition={{ duration: 0.3 }}
                  >
                    OP_V{Math.floor(Math.random() * 90 + 10)} // STATUS:{" "}
                    {LOADING_PHRASES[loadingPhraseIdx]
                      .split(" ")[0]
                      .toUpperCase()}
                  </motion.span>
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-md px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-red-500/20 rounded-3xl p-8 w-full max-w-md shadow-2xl relative ring-1 ring-slate-200 dark:ring-red-500/10"
            >
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl transition hover:bg-slate-100 dark:hover:bg-red-500/20"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-3">
                <Settings size={24} className="text-red-500" />
                Settings
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                Configure your Google Gemini API key here. The key is securely
                stored in your browser's local storage and is only used to
                communicate directly with the Gemini API.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={customApiKey}
                    onChange={(e) => saveApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition placeholder-slate-400 dark:placeholder-slate-700 shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                    Simulation Model
                  </label>
                  <select
                    value={simModel}
                    onChange={(e) => saveSimModel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition shadow-inner"
                  >
                    <option value="gemini-3.1-pro-preview">
                      gemini-3.1-pro-preview
                    </option>
                    <option value="gemini-3-flash-preview">
                      gemini-3-flash-preview
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                    Chat Model
                  </label>
                  <select
                    value={chatModel}
                    onChange={(e) => saveChatModel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-red-500 transition shadow-inner"
                  >
                    <option value="gemini-3.1-pro-preview">
                      gemini-3.1-pro-preview
                    </option>
                    <option value="gemini-3-flash-preview">
                      gemini-3-flash-preview
                    </option>
                  </select>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowSettings(false)}
                  className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl text-sm font-bold transition shadow-lg shadow-red-900/20"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatWidget
        session={sessionRef.current}
        code={code}
        simData={simData}
        isComplete={!!simData?.isComplete}
        currentState={currentState}
        currentStack={currentStack}
        currentLine={simData?.steps[currentStepIdx]?.L ?? null}
        currentStepIndex={currentStepIdx}
        consoleOutput={consoleOutput}
      />
    </div>
  );
};

export default App;
