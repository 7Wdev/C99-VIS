import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  X,
  Send,
  User,
  Cpu,
  ChevronDown,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { SimulationSession } from "../services/geminiService";
import { SimulationData, StepState } from "../types";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  images?: string[]; // Array of Base64 strings to render
}

interface AttachedImage {
  file: File;
  url: string;
  base64: string;
}

interface ChatWidgetProps {
  session: SimulationSession | null;
  code: string;
  simData: SimulationData | null;
  isComplete: boolean;
  currentState?: StepState | null;
  currentStack?: any[]; // Pass down stack context from App
  currentLine?: number | null;
  currentStepIndex?: number;
  consoleOutput?: string[];
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  session,
  code,
  simData,
  isComplete,
  currentState,
  currentStack,
  currentLine,
  currentStepIndex,
  consoleOutput,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      content:
        "Hello! I am ready to answer any questions you have about the simulation or code.",
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Reset chat when a new session starts
  useEffect(() => {
    if (!isComplete) {
      setMessages([
        {
          id: "welcome",
          role: "ai",
          content:
            "Hello! I am ready to answer any questions you have about the simulation or code.",
        },
      ]);
      setIsOpen(false); // Close chat if a new simulation builds
    }
  }, [session, isComplete]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (attachedImages.length + files.length > 3) {
      alert("You can only attach up to 3 images.");
      e.target.value = "";
      return;
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    const validFiles = files.filter((f) => validTypes.includes(f.type));

    if (validFiles.length !== files.length) {
      alert("Only JPG, JPEG, and PNG images are supported.");
    }

    if (!validFiles.length) {
      e.target.value = "";
      return;
    }

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImages((prev) => [
          ...prev,
          {
            url: URL.createObjectURL(file),
            file,
            base64: reader.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input value so the same file can be selected again if removed
    e.target.value = "";
  };

  const handleSend = async () => {
    if (
      (!inputVal.trim() && attachedImages.length === 0) ||
      !session ||
      !isComplete ||
      isLoading
    )
      return;

    // Grab current values
    const textContent = inputVal.trim();
    const imagesPayload = [...attachedImages];

    // Reset UI state immediately
    setInputVal("");
    setAttachedImages([]);
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textContent,
      images:
        imagesPayload.length > 0
          ? imagesPayload.map((img) => img.base64)
          : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);

    // Format for Gemini API
    const inlineImages =
      imagesPayload.length > 0
        ? imagesPayload.map((img) => ({
            mimeType: img.file.type,
            data: img.base64.split(",")[1], // Extract pure base64 without data URI prefix
          }))
        : undefined;

    // Build the dynamic runtime context strictly for the prompt
    // This allows the AI to "see" exactly what the user is currently looking at in the playback
    let richPrompt =
      textContent || "Please describe these images in relation to the code.";

    if (currentState && currentStack && simData) {
      const activeLine = currentLine;
      const stackDepth = currentStack.length;
      const activeVars = JSON.stringify(currentState.vars, null, 2);
      const stackTrace = JSON.stringify(currentStack, null, 2);

      // Get the currently active tree node (the last step's node)
      const currentNodeId = simData.steps[currentStepIndex ?? 0]?.n;
      const treeNodeContext = currentNodeId
        ? JSON.stringify(simData.tree[currentNodeId], null, 2)
        : "N/A";

      const stdoutCtx =
        consoleOutput && consoleOutput.length > 0
          ? consoleOutput.join("\n")
          : "No output yet.";

      richPrompt = `
[CONTEXT: The user is currently viewing Step ${currentStepIndex} of the simulation.]

--- CURRENT EXECUTION STATE ---
- Current Executing Line: ${activeLine ?? "N/A"}
- Call Stack Depth: ${stackDepth}
- Current Call Stack:
${stackTrace}

--- LOCAL VARIABLES (SCOPE) ---
${activeVars}

--- RECURSION/EXECUTION TREE NODE ---
- Current Node Info: ${treeNodeContext}

--- STDOUT (CONSOLE OUTPUT) ---
${stdoutCtx}

---------------------------------
User Question: ${textContent}
`;
    }

    const responseText = await session.askQuestion(
      richPrompt,
      code,
      simData,
      inlineImages,
    );

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "ai",
      content: responseText,
    };

    setMessages((prev) => [...prev, aiMessage]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Only show the floating button when simulation is complete OR is partially complete but has data
  // The user requested the chat bubble to be always visible but un-interactive beforehand.

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl mb-4 overflow-hidden flex flex-col transition-all duration-300 ${
              isExpanded
                ? "fixed top-4 left-4 right-4 bottom-[88px] sm:w-auto h-auto min-h-[500px] max-h-none z-[60]"
                : "w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] relative"
            }`}
          >
            {/* Chat Header */}
            <div className="bg-slate-50 dark:bg-[#151515] p-3 flex items-center justify-between border-b border-slate-200 dark:border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center">
                  <Cpu size={16} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                    AI Tutor
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                    {isComplete
                      ? "Simulation Complete"
                      : "Simulation in Progress"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  title={isExpanded ? "Collapse" : "Expand to Full"}
                >
                  {isExpanded ? (
                    <Minimize2 size={16} />
                  ) : (
                    <Maximize2 size={16} />
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  title="Close Chat"
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-[#050505]/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      msg.role === "user"
                        ? "bg-red-600 text-white rounded-br-none"
                        : "bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm"
                    }`}
                  >
                    {msg.role === "ai" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {msg.images.map((imgBase64, idx) => (
                              <img
                                key={idx}
                                src={imgBase64}
                                alt={`Uploaded attachment ${idx + 1}`}
                                className="max-w-full h-auto rounded-lg max-h-48 object-contain border border-white/20"
                              />
                            ))}
                          </div>
                        )}
                        {msg.content && (
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/5 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-100" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-200" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-3 bg-white dark:bg-[#0f0f0f] border-t border-slate-200 dark:border-white/5 shrink-0 w-full mt-auto">
              {attachedImages.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-3 ml-2">
                  {attachedImages.map((img, idx) => (
                    <div key={idx} className="relative inline-block group">
                      <img
                        src={img.url}
                        alt={`Preview ${idx + 1}`}
                        className="h-16 w-auto rounded-lg border border-slate-200 dark:border-white/10 shadow-sm object-cover"
                      />
                      <button
                        onClick={() =>
                          setAttachedImages((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors border-2 border-white dark:border-[#0f0f0f]"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 p-1.5 rounded-xl focus-within:border-red-500/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  disabled={!isComplete || isLoading}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isComplete || isLoading}
                  className="text-slate-400 hover:text-red-500 p-2 transition-colors disabled:opacity-50 shrink-0 mb-0.5"
                  title="Upload Image (JPG, PNG)"
                >
                  <ImageIcon size={18} />
                </button>

                <textarea
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isComplete
                      ? "Ask a question..."
                      : "Simulation must finish..."
                  }
                  disabled={!isComplete || isLoading}
                  rows={1}
                  className="w-full bg-transparent border-none focus:ring-0 text-sm max-h-[150px] resize-none py-2 px-1 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 disabled:opacity-50 custom-scrollbar"
                  style={{ minHeight: "36px" }}
                />

                <button
                  onClick={handleSend}
                  disabled={
                    (!inputVal.trim() && attachedImages.length === 0) ||
                    !isComplete ||
                    isLoading
                  }
                  className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg transition-colors flex items-center justify-center shrink-0 disabled:opacity-50 disabled:hover:bg-red-600 mb-0.5"
                >
                  <Send size={16} />
                </button>
              </div>
              {!isComplete && (
                <p className="text-[10px] text-center text-slate-400 mt-2">
                  Wait for the simulation to complete fully.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-colors ${
          isOpen
            ? "bg-slate-800 hover:bg-slate-700 text-white"
            : "bg-red-600 hover:bg-red-500 text-white shadow-red-900/40"
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </motion.button>
    </div>
  );
};

export default ChatWidget;
