export interface StepState {
  h: number | string; // Height/Depth
  p: any; // Path/Current Array State (Array or String)
  vars: Record<string, any>; // Local variables
  stack: { func: string; args: Record<string, any>; line?: number }[]; // Call stack
}

export interface SimulationStep {
  L: number; // Line number (1-based)
  s: StepState;
  n: string | null; // Node ID
  out?: string; // Stdout output
}

export interface TreeNode {
  l: string; // Label
  p: string | null; // Parent ID
  level: number;
  children: string[];
  type?: "standard" | "solution" | "dead"; // Node classification
  // Computed layout properties
  x?: number;
  y?: number;
}

export interface SimulationData {
  complexity: {
    time: string;
    space: string;
    explanation?: string;
  };
  pointers?: string[]; // Variables identified as pointers/indices
  isComplete?: boolean; // Flag to indicate if the simulation has naturally terminated
  steps: SimulationStep[];
  tree: Record<string, TreeNode>;
}

export interface Preset {
  id: string;
  name: string;
  code: string;
  defaultInput: string;
}

export const SYSTEM_PROMPT = `
You are a C Backtracking/Recursion Logic Simulator. The user provides C code and Input.

**GOAL**: Return a JSON object simulating the execution line-by-line.

### 0. INPUT ADHERENCE (HIGHEST PRIORITY - CRITICAL)
- **STRICTLY RESPECT INPUT VALUES**: If the user provides "N=8", you **MUST** simulate N=8.
- **DO NOT** revert to N=4, N=5, or any other default from examples or training data.
- **DO NOT** simplify the problem. If the input is complex, simulate the complex input.
- **CHECK INPUT FIRST**: Before generating step 1, verify the value of N and array sizes from the "Input Data" section.
- **EXECUTION LENGTH**: If the simulation is extremely long (e.g., > 1000 steps), prioritize reaching the **FIRST SOLUTION** and then stop, rather than cutting off in the middle of nowhere.
- **COMPLETENESS**: Ensure that if a solution exists, the steps clearly show reaching it.

### 1. CODE ANALYSIS & INPUT
- The user will provide the code with **EXPLICIT LINE NUMBERS** (e.g., "1 | void func()").
- **L** in your JSON **MUST** match these provided integer line numbers exactly.
- **Do not** re-number lines. Use the numbers provided in the prompt.
- **NO RANDOM JUMPS**: Execution must flow precisely line-by-line exactly as a real C compiler/debugger evaluates the code. Do not jump out of blocks randomly or skip loop iterations unless a break, continue, return. actually executes.
- **Analyze Variable Lifetimes**: Understand which variables are local (stack) and which are arrays/pointers (effectively heap/shared).
- **Identify Pointers**: Scan the code for integer variables used as array indices (e.g., \`arr[i]\`, \`s1[n1]\`) or pointers (e.g., \`*p\`, \`*s1\`). List their names. Explicitly include variables like \`i\`, \`j\`, \`k\`, \`n1\`, \`n2\`, \`p1\`, \`p2\`, \`col\`, \`row\` if they are used to index into an array or string.

### 2. EXECUTION RULES (STRICT SYNC)
- **Line Skipping**:
  - **NEVER** generate a step for a line that only contains a closing brace \`}\`.
  - **NEVER** generate a step for whitespace or comments.
  - **Start of Function**: When a function is called, generate a step at the **Call Site**, then the next step is the **First Executable Line** inside the function.
- **Output (\`out\`)**:
  - **INCREMENTAL ONLY**: If a line prints "A", and the previous line printed "B", the \`out\` field for this step is "A". **DO NOT** output "BA".
  - If no new output is generated in a step, omit the \`out\` field.

### 3. VARIABLE SNAPSHOTS (MEMORY PERSISTENCE)
- **\`vars\` Object**: Must contain **ALL** variables currently in scope.
- **ARRAYS & MATRICES (CRITICAL)**: 
  - Arrays (e.g., \`arr\`, \`set\`, \`board\`) are treated as **PERSISTENT** data structures.
  - **2D ARRAYS**: Must be represented as an array of arrays (e.g., \`[[1,0],[0,1]]\`).
  - **ONCE DEFINED, AN ARRAY MUST APPEAR IN EVERY SUBSEQUENT STEP'S \`vars\`**.
  - **NEVER** omit an array to save space. Even if it didn't change, output it.
  - **UNINITIALIZED ARRAYS**: If a local array is declared (e.g. \`int buf[5];\`) and not initialized, you **MUST** fill the uninitialized indices with the string "?". **DO NOT** use random integers. **DO NOT** use the word "garbage". Use strictly "?". **DO NOT DEFAULT TO 0** unless it is \`static\` or global.
  - **STRINGS & CHAR ARRAYS**: When outputting \`char\` arrays, always output the literal **character strings** (e.g., \`["h", "e", "l", "l", "o", "\\0"]\`). **NEVER** convert chars to their raw integer ASCII codes (like \`[104, 101]\`). Let the frontend do the binary/ASCII conversion.
  - **COLORS & SPECIAL TYPES**: If an array explicitly stores color variables (like CSS hex codes \`"#FF0000"\` or ANSI escapes), output the literal string format representing the context to visualizer rather than obscure base-10 integers.
- **SCALARS**:
  - Include all local variables (\`i\`, \`n\`, \`sum\`, \`row\`, \`col\`) valid in the **CURRENT** stack frame.
  - Do not show variables from other stack frames (unless they are passed by pointer).
- **CALL STACK (\`stack\`)**:
  - You **MUST** maintain a \`stack\` array in every step.
  - Each element is an object: \`{ "func": "solveNQ", "args": { "col": 0, "N": 4 } }\`.
  - **Push** when entering a function. **Pop** when returning.
  - The last element is the **current** stack frame.

### 4. RECURSION TREE (VISUALIZATION)
- **Node IDs**: simple strings ("root", "n1", "n2").
- **Roots & Independent Functions**: Every distinct core function execution (e.g. \`main\`, \`solve\`, \`readStr\`) should start its own disconnected tree by setting \`"p": null\`. Do not force them all under one giant tree.
- **Ignore Library Functions**: **DO NOT** create nodes in the tree for standard C library functions like \`printf\`, \`scanf\`, \`malloc\`, or \`free\`. Keep the tree focused strictly on the user's core algorithmic logic.
- **Types (\`type\`) - CRITICAL FOR BACKTRACKING**:
  - \`"solution"\`: 
      - The node reached a **successful** base case.
      - OR the node printed output (e.g., printed a permutation).
      - OR returned \`true\` (in boolean search) or found the target.
  - \`"dead"\`: 
      - The node was **pruned** by a condition (e.g., \`if (!isSafe) return\`).
      - OR the node reached a base case that was **NOT** successful.
      - OR the node is a **leaf** (no children) that produced no result/output.
  - \`"standard"\`: 
      - An intermediate node that successfully spawned recursive children.
      - Default type if neither success nor dead.
- **Labels (\`l\`)**: "ARGS | INFO"
  - ARGS: "i=0, sum=2" or "r=1, c=2"
  - INFO: "printed: (1,2)" or "pruned" or "base case".

### 5. COMPLETION FLAG (CRITICAL)
- **"isComplete"**: Set this boolean to \`true\` ONLY if you have reached the very end of the code execution, all paths have returned, and the program terminates naturally. Set it to \`false\` if you are pausing execution to yield a batch. It is CRITICAL to set this correctly for automated handling.

### 6. OUTPUT FORMAT
- **MAXIMUM STEPS PER BATCH**: Aim for 10 to 20 steps per response to ensure lightning-fast generation speed. Do not exceed the output token limit and ensure the JSON is perfectly complete and well-formed.
- Return **ONLY** valid JSON.
\`\`\`json
{
  "complexity": { "time": "O(2^N)", "space": "O(N)", "explanation": "..." },
  "pointers": ["i", "col", "start", "end", "row", "c", "n1", "n2"], 
  "isComplete": false,
  "steps": [
    { 
      "L": 12, 
      "s": { 
        "h": 0, 
        "p": null, 
        "vars": { "arr": [1,2,2], "grid": [[0,1],[1,0]], "n": 3, "i": 0 },
        "stack": [
           { "func": "main", "args": {} },
           { "func": "solve", "args": { "n": 3 } }
        ]
      }, 
      "n": "root", 
      "out": "new_text_only" 
    }
  ],
  "tree": { 
    "root": { "l": "idx=0 | start", "p": null, "level": 0, "children": ["n1"], "type": "standard" },
    "n1": { "l": "idx=1 | pruned", "p": "root", "level": 1, "children": [], "type": "dead" }
  }
}
\`\`\`
`;

export const PRESETS: Preset[] = [
  {
    id: "subsets",
    name: "Unique Subsets",
    code: `void printSubset(int sub[], int n) {
    printf("(");
    for (int i = 0; i < n; i++) {
        printf("%d%s", sub[i], (i == n - 1) ? "" : " ");
    }
    printf(")");
}

void findSubsets(int arr[], int n, int index, int set[], int h) {
    printSubset(set, h); // Print current subset
    printf(",");

    for (int i = index; i < n; i++) {
        // Skip duplicates
        if (i > index && arr[i] == arr[i - 1]) {
            continue;
        }

        set[h] = arr[i]; // Include element

        // Recurse
        findSubsets(arr, n, i + 1, set, h + 1);
    }
}

void AllSubsets(int arr[], int n) {
    // Sort logic assumed or pre-sorted
    int set[10]; // Buffer
    findSubsets(arr, n, 0, set, 0);
}`,
    defaultInput: "arr = {1, 2, 2}",
  },
  {
    id: "permutations",
    name: "Permutations",
    code: `void permute(int *a, int l, int r) {
  if (l == r) {
    print(a, l+1);
  } else {
    for (int i = l; i <= r; i++) {
      swap((a+l), (a+i));
      permute(a, l+1, r);
      swap((a+l), (a+i)); // backtrack
    }
  }
}`,
    defaultInput: "arr = {1, 2, 3}",
  },
  {
    id: "nqueens",
    name: "N-Queens (Backtracking)",
    code: `bool isSafe(int board[], int row, int col, int N) {
    for (int i = 0; i < col; i++)
        if (board[i] == row || abs(board[i] - row) == abs(i - col))
            return false;
    return true;
}

void solveNQ(int board[], int col, int N) {
    if (col >= N) {
        printBoard(board, N);
        return;
    }
    for (int i = 0; i < N; i++) {
        if (isSafe(board, i, col, N)) {
            board[col] = i;
            solveNQ(board, col + 1, N);
        }
    }
}`,
    defaultInput: "N = 4",
  },
  {
    id: "ratmaze",
    name: "Rat in a Maze",
    code: `bool isSafe(int maze[4][4], int x, int y, int N) {
    return (x >= 0 && x < N && y >= 0 && y < N && maze[x][y] == 1);
}

bool solveMazeUtil(int maze[4][4], int x, int y, int sol[4][4], int N) {
    // Base case: if (x, y) is goal
    if (x == N - 1 && y == N - 1 && maze[x][y] == 1) {
        sol[x][y] = 1;
        return true;
    }

    if (isSafe(maze, x, y, N) && sol[x][y] == 0) {
        sol[x][y] = 1; // Mark path

        // Move forward in x direction
        if (solveMazeUtil(maze, x + 1, y, sol, N)) return true;

        // Move down in y direction
        if (solveMazeUtil(maze, x, y + 1, sol, N)) return true;

        // Backtrack
        sol[x][y] = 0;
        return false;
    }
    return false;
}

void solveMaze(int maze[4][4], int N) {
    int sol[4][4] = { {0, 0, 0, 0},
                      {0, 0, 0, 0},
                      {0, 0, 0, 0},
                      {0, 0, 0, 0} };
    if (!solveMazeUtil(maze, 0, 0, sol, N)) {
        printf("No Solution");
    } else {
        printSolution(sol);
    }
}`,
    defaultInput:
      "maze = {{1, 0, 0, 0}, {1, 1, 0, 1}, {0, 1, 0, 0}, {1, 1, 1, 1}}",
  },
];
