import { GoogleGenAI } from "@google/genai";
import { SimulationData, SYSTEM_PROMPT } from "../types";

const defaultApiKey = process.env.API_KEY || "";

// Initialize the client once if possible, or inside the function.
// Since we need to access process.env.API_KEY which might be injected, we'll instantiate inside.

// Helper to backfill missing arrays and scalars to ensure no flickering
const normalizeData = (data: SimulationData): SimulationData => {
  const steps = data.steps;
  // Track the last known state of arrays to fill gaps globally
  const persistentArrays: Record<string, any[]> = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step.s) continue;

    // Ensure vars object exists
    if (!step.s.vars) step.s.vars = {};

    // --- 0. GARBAGE CLEANUP ---
    // Ensure any "garbage" or "random" strings in arrays are converted to "?"
    const cleanArray = (arr: any[]): any[] => {
      return arr.map((item: any) => {
        if (Array.isArray(item)) {
          return cleanArray(item);
        }
        if (
          typeof item === "string" &&
          (item.toLowerCase().includes("garbage") ||
            item.toLowerCase().includes("random") ||
            item.toLowerCase().includes("uninitialized"))
        ) {
          return "?";
        }
        return item;
      });
    };

    Object.keys(step.s.vars).forEach((key) => {
      const val = step.s.vars[key];
      if (Array.isArray(val)) {
        step.s.vars[key] = cleanArray(val);
      }
    });

    // --- 1. ARRAY PERSISTENCE ---
    // Arrays are treated as heap/persistent objects. Once seen, they stay until the end
    // (or until model explicitly changes them, though we only backfill missing ones here).
    Object.entries(step.s.vars).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        persistentArrays[k] = v;
      }
    });
    // Backfill arrays
    Object.entries(persistentArrays).forEach(([k, v]) => {
      if (step.s.vars[k] === undefined) {
        step.s.vars[k] = v;
      }
    });

    // --- 2. SCALAR/POINTER PERSISTENCE ---
    // Prevent flickering of local variables within the same stack frame.
    // Heuristic: If depth (h) is unchanged from previous step, inherit missing scalars.
    // This assumes that within the same stack depth, local variables should remain visible
    // unless explicitly removed (which is rare for line-by-line stepping).
    if (i > 0) {
      const prevStep = steps[i - 1];
      // Check if depth matches (using loose equality to handle string/number mismatch from JSON)
      if (prevStep.s && prevStep.s.h == step.s.h) {
        Object.entries(prevStep.s.vars).forEach(([k, v]) => {
          // If it's a scalar (not array) and missing in current step, carry it over.
          // This ensures pointers like 'i', 'low', 'high' don't disappear during loop iterations.
          if (!Array.isArray(v) && step.s.vars[k] === undefined) {
            step.s.vars[k] = v;
          }
        });
      }
    }

    // --- 3. TREE NODE NORMALIZATION ---
    // If the model generates a step with a node ID that it forgot to place in the tree object,
    // the D3 hierarchy layout will crash or render empty. We must inject a dummy node.
    if (step.n && !data.tree[step.n]) {
      console.warn(
        `Node ${step.n} referenced in step ${i} but missing from tree. Normalizing.`,
      );
      // Find the previous step's node to attempt linking, otherwise attach to root/null
      let parentNode = null;
      if (i > 0 && steps[i - 1].n) parentNode = steps[i - 1].n;

      data.tree[step.n] = {
        l: "normalized node",
        p: parentNode,
        level:
          parentNode && data.tree[parentNode]
            ? data.tree[parentNode].level + 1
            : 0,
        children: [],
        type: "standard",
      };

      // Also ensure the parent knows about this new child
      if (parentNode && data.tree[parentNode]) {
        if (!data.tree[parentNode].children)
          data.tree[parentNode].children = [];
        if (!data.tree[parentNode].children.includes(step.n)) {
          data.tree[parentNode].children.push(step.n);
        }
      }
    }
  }

  return data;
};

export class SimulationSession {
  private chat: any = null;
  private conversationalChat: any = null;
  private ai: GoogleGenAI | null = null;
  private sessionApiKey: string = "";
  private simModel: string = "gemini-3.1-pro-preview";
  private chatModel: string = "gemini-3.1-pro-preview";

  constructor(customApiKey?: string, simModel?: string, chatModel?: string) {
    this.sessionApiKey = customApiKey || defaultApiKey;
    if (simModel) this.simModel = simModel;
    if (chatModel) this.chatModel = chatModel;
    if (this.sessionApiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.sessionApiKey });
    }
  }

  private async retryWithBackoff<T>(
    operation: (retryReason?: string) => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 2000,
  ): Promise<T> {
    let delay = initialDelay;
    let retryReason: string | undefined = undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation(retryReason);
      } catch (error: any) {
        const isRateLimit =
          error?.message?.includes("429") ||
          error?.status === 429 ||
          error?.code === 429;

        const isParseError =
          error?.message?.includes("JSON") ||
          error?.message?.includes("Failed to parse");

        if ((isRateLimit || isParseError) && i < maxRetries - 1) {
          console.warn(
            `${isRateLimit ? "Rate limit hit" : "JSON Parse Error"}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`,
          );

          if (isParseError) {
            retryReason =
              "CRITICAL: Your last response contained invalid JSON or was truncated. Please regenerate the exact same batch of steps, ensuring it is a single, perfectly valid, and cleanly closed JSON object.";
          } else {
            retryReason = undefined;
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error;
        }
      }
    }
    throw new Error("Max retries exceeded");
  }

  async start(code: string, input: string): Promise<SimulationData | null> {
    if (!this.ai || !this.sessionApiKey) {
      console.error("API Key is missing. Please set it in Settings.");
      return null;
    }

    // Transform code to have line numbers for the prompt
    const codeWithLineNumbers = code
      .split("\n")
      .map((line, idx) => `${idx + 1} | ${line}`)
      .join("\n");
    const userPrompt = `Input Data: ${input}\n\nCode to Simulate:\n${codeWithLineNumbers}`;

    try {
      this.chat = this.ai.chats.create({
        model: this.simModel,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          maxOutputTokens: 100000,
        },
      });

      return await this.retryWithBackoff(async (retryReason) => {
        const prompt = retryReason ? retryReason : userPrompt;
        const response = await this.chat.sendMessage({ message: prompt });
        const text = response.text;
        if (!text) return null;

        const jsonStr = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        let data: SimulationData;
        try {
          data = JSON.parse(jsonStr);
        } catch (parseError) {
          console.error(
            "Gemini API returned invalid JSON in start():",
            parseError,
          );
          console.debug("Raw JSON String:", jsonStr);
          throw new Error(
            "Failed to parse Gemini response as JSON. The output may have been truncated.",
          );
        }

        return normalizeData(data);
      });
    } catch (error) {
      console.error("Gemini API Error (Start):", error);
      return null;
    }
  }

  async nextBatch(lastStepsContext?: any[]): Promise<SimulationData | null> {
    if (!this.chat) return null;

    try {
      const stepGuidance =
        this.simModel === "gemini-3.1-pro-preview"
          ? "Aim for 15 to 35 steps per batch"
          : "Aim for literally 10 to 20 steps per batch";

      return await this.retryWithBackoff(async (retryReason) => {
        let basePrompt = `Continue simulation. Generate the next batch of steps. Remember to maintain state and tree consistency. CRITICAL INSTRUCTION: ${stepGuidance} to ensure extremely fast response times and produce valid, complete JSON. You must properly close the JSON object.`;

        if (lastStepsContext && lastStepsContext.length > 0) {
          basePrompt += `\n\nCRITICAL CONTEXT - RECENT HISTORY:\nTo prevent execution jumps and desyncs, here are the VERY LAST ${lastStepsContext.length} steps that were executed right before this batch:\n\`\`\`json\n${JSON.stringify(lastStepsContext, null, 2)}\n\`\`\`\n\nYou MUST resume execution precisely on the very next logical line of code immediately following the final step in the history above. Do NOT repeat the last step. Do NOT jump to a random location. Maintain local variables exactly as they were left off!`;
        }

        const prompt = retryReason ? retryReason : basePrompt;
        const response = await this.chat.sendMessage({
          message: prompt,
        });

        const text = response.text;
        if (!text) return null;

        const jsonStr = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        let data: SimulationData;
        try {
          data = JSON.parse(jsonStr);
        } catch (parseError) {
          console.error(
            "Gemini API returned invalid JSON in nextBatch():",
            parseError,
          );
          console.debug("Raw JSON String:", jsonStr);
          throw new Error(
            "Failed to parse Gemini response as JSON. The output may have been truncated.",
          );
        }

        return normalizeData(data);
      });
    } catch (error) {
      console.error("Gemini API Error (Next Batch):", error);
      return null;
    }
  }

  async askQuestion(
    question: string,
    code: string,
    simData: SimulationData | null,
    images?: { mimeType: string; data: string }[],
  ): Promise<string> {
    if (!this.ai || !this.sessionApiKey) {
      return "Error: API Key is missing.";
    }

    try {
      if (!this.conversationalChat) {
        // Initialize a completely separate chat thread for normal explanations
        const systemInstruction = `You are a helpful Computer Science tutor explaining the execution of a C program.
The user will ask you questions about the code and the simulation results.
You can use Markdown and LaTeX mathematically formatted text to respond.

Here is the C code being simulated:
\`\`\`c
${code}
\`\`\`

Here is a summary of the execution complexity:
Time: ${simData?.complexity?.time}
Space: ${simData?.complexity?.space}
Explanation: ${simData?.complexity?.explanation}

IMPORTANT INSTRUCTIONS FOR YOUR PERSONA:
1. Act as a professional, concise tutor. 
2. Be rich in your answers but keep them SHORT.
3. DO NOT regurgitate all the context variables (like the current line, depth, or variables) you are given in every single answer.
4. Only add deep detail when it is strictly necessary depending on the user's explicit question.
5. Do NOT output JSON. Output perfectly formatted Markdown.`;

        this.conversationalChat = this.ai.chats.create({
          model: this.chatModel,
          config: {
            systemInstruction,
          },
        });
      }

      return await this.retryWithBackoff(async () => {
        let messagePayload: any = question;

        // If images exist, format as multimodal parts array
        if (images && images.length > 0) {
          messagePayload = [
            question,
            ...images.map((img) => ({
              inlineData: {
                data: img.data,
                mimeType: img.mimeType,
              },
            })),
          ];
        }

        const response = await this.conversationalChat.sendMessage({
          message: messagePayload,
        });
        return response.text || "I'm sorry, I couldn't generate a response.";
      });
    } catch (error) {
      console.error("Gemini API Error (Chat):", error);
      return "Error communicating with the AI. Please try again.";
    }
  }
}

// Keep the old function for backward compatibility if needed, but it won't be used by App.tsx
export const fetchSimulationData = async (
  code: string,
  input: string,
): Promise<SimulationData | null> => {
  const session = new SimulationSession();
  return session.start(code, input);
};
