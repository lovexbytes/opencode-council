import { createServer, type Server } from "net"
import { unlinkSync, existsSync } from "fs"

// Simple logger
const log = (msg: string) => {
  const fs = require('fs')
  try {
    fs.appendFileSync(`/tmp/council-tui-debug.log`, `${new Date().toISOString()} [SOCKET]: ${msg}\n`)
  } catch {}
}

export function startSocketServer(
  socketPath: string,
  getState: () => any,
  onClose: () => void
): () => void {
  log(`Starting socket server at: ${socketPath}`)
  
  // Clean up stale socket
  try {
    if (existsSync(socketPath)) {
      log(`Removing stale socket: ${socketPath}`)
      unlinkSync(socketPath)
    }
  } catch (e: any) {
    log(`Warning: Could not remove stale socket: ${e.message}`)
  }

  const server: Server = createServer((conn) => {
    log("Client connected to socket")
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
          log(`Received message: ${msg.type}`)
          handleMessage(msg, conn, getState, onClose)
        } catch (e) {
          log(`Invalid JSON received: ${line.slice(0, 50)}`)
          conn.write(JSON.stringify({ error: "invalid json" }) + "\n")
        }
      }
    })
    
    conn.on("error", (err) => {
      log(`Connection error: ${err.message}`)
    })
    
    conn.on("close", () => {
      log("Client disconnected")
    })
  })
  
  server.on("error", (err: any) => {
    log(`Server error: ${err.message}`)
  })

  try {
    server.listen(socketPath)
    log(`Server listening on ${socketPath}`)
  } catch (e: any) {
    log(`Failed to start server: ${e.message}`)
    throw e
  }

  return () => {
    log("Shutting down socket server...")
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
        type: "status",
        data: {
          status: state.status,
          models: state.models.map((m: any) => ({
            label: m.label,
            status: m.status,
            response: m.response.slice(0, 200), // Truncate for socket
          })),
        },
      }
      conn.write(JSON.stringify(response) + "\n")
      break
    }

    case "getFullState": {
      conn.write(JSON.stringify({ type: "fullState", data: state }) + "\n")
      break
    }

    case "close": {
      conn.write(JSON.stringify({ type: "closing" }) + "\n")
      conn.end()
      onClose()
      break
    }

    default: {
      conn.write(JSON.stringify({ error: `unknown type: ${msg.type}` }) + "\n")
    }
  }
}
