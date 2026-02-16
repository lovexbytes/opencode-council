import { type Plugin, tool } from "@opencode-ai/plugin"
import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { connect } from "net"

// ---------- Config ----------

interface CouncilConfig {
  enabled: boolean
  models: Array<{ provider: string; model: string; label?: string }>
  tmux: {
    mode: "split" | "window"    // split-window vs new-window
    percent: number             // split percentage (default 40)
    position: "right" | "bottom" // split direction
  }
  synthesize: boolean           // auto-synthesize at end
  timeout: number               // per-model timeout in seconds
}

const DEFAULT_CONFIG: CouncilConfig = {
  enabled: true,
  models: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514", label: "Sonnet" },
    { provider: "openai", model: "gpt-4o", label: "GPT-4o" },
    { provider: "google", model: "gemini-2.5-pro", label: "Gemini Pro" },
  ],
  tmux: { mode: "split", percent: 40, position: "right" },
  synthesize: true,
  timeout: 120,
}

function loadConfig(): CouncilConfig {
  const configPath = join(
    process.env.HOME || "~",
    ".config/opencode/council.json"
  )
  try {
    if (existsSync(configPath)) {
      const raw = JSON.parse(readFileSync(configPath, "utf-8"))
      return { ...DEFAULT_CONFIG, ...raw }
    }
  } catch (e) {
    // Fall back to defaults
  }
  return DEFAULT_CONFIG
}

// ---------- IPC ----------

const SOCKET_PATH = `/tmp/opencode-council-${process.pid}.sock`

function sendToTUI(socketPath: string, message: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = connect(socketPath, () => {
      client.write(JSON.stringify(message) + "\n")
    })
    let data = ""
    client.on("data", (chunk) => { data += chunk.toString() })
    client.on("end", () => resolve(data))
    client.on("error", reject)
    setTimeout(() => { client.destroy(); reject(new Error("timeout")) }, 5000)
  })
}

// ---------- Active sessions ----------

const activeSessions = new Map<string, {
  socketPath: string
  tmuxPane: string
  question: string
}>()

// ---------- Plugin export ----------

export const CouncilPlugin: Plugin = async (ctx) => {
  const config = loadConfig()

  if (!config.enabled) {
    return {}
  }

  return {
    tool: {
      council_spawn: tool({
        description:
          "Spawn a council of AI models to deliberate on a question. " +
          "Opens a tmux pane showing real-time multi-model discussion. " +
          "Use for architecture decisions, comparisons, or getting diverse perspectives. " +
          "Returns a council_id to check status or close later.",
        args: {
          question: tool.schema.string(),
        },
        async execute(args, context) {
          const councilId = `council-${Date.now()}`
          const socketPath = `/tmp/opencode-council-${councilId}.sock`

          // Find TUI path - try multiple locations
          const home = process.env.HOME || "~"
          const tuiPaths = [
            // Standard location (if cloned to ~/.config/opencode/)
            join(home, ".config/opencode/opencode-council/packages/tui/dist/index.js"),
            // Current working directory (if running from repo)
            join(process.cwd(), "packages/tui/dist/index.js"),
            // Try COUNCIL_TUI env var if set
            process.env.COUNCIL_TUI,
          ].filter(Boolean) as string[]
          
          let tuiPath: string | null = null
          for (const path of tuiPaths) {
            try {
              const check = Bun.spawn(["ls", path], { stdout: "pipe", stderr: "pipe" })
              await check.exited
              if (check.exitCode === 0) {
                tuiPath = path
                console.error(`[Council] Found TUI at: ${path}`)
                break
              }
            } catch {
              // Continue to next path
            }
          }
          
          if (!tuiPath) {
            return `Error: TUI not found. Tried:\n${tuiPaths.join("\n")}\n\nPlease run install.sh first or set COUNCIL_TUI env var.`
          }
          
          const tuiArgs = [
            "bun",
            tuiPath,
            "--socket", socketPath,
            "--question", args.question,
            "--models", JSON.stringify(config.models),
            "--timeout", String(config.timeout),
            "--synthesize", String(config.synthesize),
          ].join(" ")

          const tmuxArgs: string[] = []
          if (config.tmux.mode === "split") {
            tmuxArgs.push("split-window")
            if (config.tmux.position === "right") {
              tmuxArgs.push("-h")
            }
            tmuxArgs.push("-p", String(config.tmux.percent))
            // Don't steal focus - but remove temporarily to debug
            // tmuxArgs.push("-d")
          } else {
            tmuxArgs.push("new-window")
          }
          tmuxArgs.push(tuiArgs)

          try {
            console.error(`[Council] Spawning: tmux ${tmuxArgs.join(" ")}`)
            
            // Spawn - keep pane open on error for debugging
            const wrappedCmd = `(${tuiArgs}) || (echo "TUI CRASHED - check logs at /tmp/council-tui-*.log" && sleep 30)`
            const finalArgs = [...tmuxArgs.slice(0, -1), wrappedCmd] // Replace last arg with wrapped version
            
            const proc = Bun.spawn(["tmux", ...finalArgs], {
              stdout: "inherit",
              stderr: "inherit",
            })
            
            // Quick check if process started (non-blocking)
            await new Promise(r => setTimeout(r, 100))
            
            // Try to verify pane was created by listing panes
            const checkProc = Bun.spawn(["tmux", "list-panes", "-F", "#{pane_title}"], {
              stdout: "pipe",
              stderr: "pipe",
            })
            await checkProc.exited
            
            if (checkProc.exitCode !== 0) {
              return `Tmux error: Unable to list panes. Is tmux running?`
            }
            
            console.error(`[Council] Spawned successfully, check your tmux for new pane`)
          } catch (e: any) {
            return `Failed to spawn council: ${e.message}. Is tmux running?`
          }

          // Wait briefly for socket server to start
          await new Promise(r => setTimeout(r, 500))

          activeSessions.set(councilId, {
            socketPath,
            tmuxPane: "council",
            question: args.question,
          })

          return (
            `Council spawned (id: ${councilId}) with ${config.models.length} models.\n` +
            `Models: ${config.models.map(m => m.label || m.model).join(", ")}\n` +
            `Question: "${args.question}"\n` +
            `Check the tmux pane for real-time deliberation.\n` +
            `Use council_status with this id to get results when ready.`
          )
        },
      }),

      council_status: tool({
        description:
          "Check the status of an active council deliberation. " +
          "Returns current progress and results if complete.",
        args: {
          council_id: tool.schema.string(),
        },
        async execute(args) {
          const session = activeSessions.get(args.council_id)
          if (!session) {
            return `No active council with id: ${args.council_id}. Active councils: ${
              [...activeSessions.keys()].join(", ") || "none"
            }`
          }

          try {
            const response = await sendToTUI(session.socketPath, {
              type: "status",
            })
            const status = JSON.parse(response)

            if (status.complete) {
              // Auto-cleanup
              activeSessions.delete(args.council_id)
              return formatResults(status, session.question)
            }

            return (
              `Council "${args.council_id}" in progress.\n` +
              `Models completed: ${status.completed}/${status.total}\n` +
              `Status: ${status.models.map((m: any) =>
                `${m.label}: ${m.status}`
              ).join(", ")}`
            )
          } catch (e: any) {
            // Socket gone = TUI closed
            activeSessions.delete(args.council_id)
            return `Council session ended (TUI closed or errored: ${e.message})`
          }
        },
      }),

      council_close: tool({
        description: "Close an active council deliberation and its tmux pane.",
        args: {
          council_id: tool.schema.string(),
        },
        async execute(args) {
          const session = activeSessions.get(args.council_id)
          if (!session) {
            return `No active council: ${args.council_id}`
          }

          try {
            await sendToTUI(session.socketPath, { type: "close" })
          } catch {
            // Already closed
          }

          activeSessions.delete(args.council_id)
          return `Council ${args.council_id} closed.`
        },
      }),
    },
  }
}

// ---------- Helpers ----------

function formatResults(status: any, question: string): string {
  let output = `# Council Results\n\n**Question:** ${question}\n\n`

  for (const model of status.models) {
    output += `## ${model.label} (${model.provider}/${model.model})\n\n`
    output += `${model.response}\n\n`
  }

  if (status.synthesis) {
    output += `## Synthesis\n\n${status.synthesis}\n`
  }

  return output
}
