import { createServer, type Server } from "net"
import { unlinkSync } from "fs"

export function startSocketServer(
  socketPath: string,
  getState: () => any,
  onClose: () => void
): () => void {
  // Clean up stale socket
  try { unlinkSync(socketPath) } catch {}

  const server: Server = createServer((conn) => {
    let data = ""
    conn.on("data", (chunk) => {
      data += chunk.toString()
      // Process complete messages (newline-delimited)
      const lines = data.split("\n")
      data = lines.pop() || ""

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          handleMessage(msg, conn, getState, onClose)
        } catch {
          conn.write(JSON.stringify({ error: "invalid json" }) + "\n")
        }
      }
    })
  })

  server.listen(socketPath)

  return () => {
    server.close()
    try { unlinkSync(socketPath) } catch {}
  }
}

function handleMessage(
  msg: any,
  conn: any,
  getState: () => any,
  onClose: () => void
) {
  const state = getState()

  switch (msg.type) {
    case "status": {
      const response = {
        complete: state.status === "complete",
        status: state.status,
        completed: state.models.filter((m: any) => m.status === "done").length,
        total: state.models.length,
        models: state.models.map((m: any) => ({
          label: m.label,
          provider: m.provider,
          model: m.model,
          status: m.status,
          response: m.response,
        })),
        synthesis: state.synthesis,
      }
      conn.end(JSON.stringify(response))
      break
    }
    case "close": {
      conn.end(JSON.stringify({ ok: true }))
      onClose()
      break
    }
    default:
      conn.end(JSON.stringify({ error: "unknown command" }))
  }
}
