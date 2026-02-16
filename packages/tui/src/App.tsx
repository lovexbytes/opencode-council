import React, { useState, useEffect, useRef, useCallback } from "react"
import { Box, Text, useApp } from "ink"
import { Header } from "./components/Header.js"
import { ModelPanel } from "./components/ModelPanel.js"
import { Synthesis } from "./components/Synthesis.js"
import { runCouncil, type CouncilState, type ModelState } from "./council.js"
import { startSocketServer } from "./socket-server.js"
import fs from "fs"

interface Props {
  question: string
  models: Array<{ provider: string; model: string; label?: string }>
  socketPath: string
  timeout: number
  synthesize: boolean
}

// Debug logger that always writes
const debugLog = (msg: string) => {
  const logFile = `/tmp/council-tui-debug.log`
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()}: ${msg}\n`)
  } catch (e) {
    // Ignore
  }
}

export function App({ question, models, socketPath, timeout, synthesize }: Props) {
  const { exit } = useApp()
  const [state, setState] = useState<CouncilState>({
    status: "starting",
    models: models.map(m => ({
      provider: m.provider,
      model: m.model,
      label: m.label || m.model,
      status: "pending" as const,
      response: "",
      streaming: "",
    })),
    synthesis: null,
    error: null,
  })

  // Use ref for latest state in socket callbacks
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const getState = useCallback(() => stateRef.current, [])

  useEffect(() => {
    debugLog(`App mounted. Socket: ${socketPath}, Models: ${models.length}`)
    
    let cleanup = () => {}
    
    try {
      // Start IPC socket server
      debugLog("Starting socket server...")
      cleanup = startSocketServer(socketPath, getState, () => exit())
      debugLog("Socket server started successfully")
    } catch (e: any) {
      debugLog(`Socket server failed: ${e.message}`)
      setState(prev => ({ ...prev, status: "error", error: `Socket: ${e.message}` }))
    }

    // Start council deliberation
    try {
      debugLog("Starting council...")
      runCouncil({
        question,
        models,
        timeout,
        synthesize,
        onUpdate: (update) => {
          debugLog(`Council update: ${JSON.stringify(update).slice(0, 100)}`)
          setState(prev => {
            // Handle model array updates specially
            if (update.models && Array.isArray(update.models) && update.models.length > 0) {
              const first = update.models[0] as any
              if (first && typeof first.index === 'number') {
                // It's a granular model update
                const newModels = [...prev.models]
                const { index, ...modelUpdate } = first
                newModels[index] = { ...newModels[index], ...modelUpdate }
                return { ...prev, models: newModels }
              }
            }
            // Regular state merge
            return { ...prev, ...update }
          })
        },
        onComplete: () => {
          debugLog("Council complete")
          setState(prev => ({ ...prev, status: "complete" }))
        },
        onError: (err) => {
          debugLog(`Council error: ${err}`)
          setState(prev => ({ ...prev, status: "error", error: err }))
        },
      })
    } catch (e: any) {
      debugLog(`Council run failed: ${e.message}`)
      setState(prev => ({ ...prev, status: "error", error: `Council: ${e.message}` }))
    }

    return () => {
      debugLog("App unmounting, cleaning up...")
      cleanup()
    }
  }, [])

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        question={question}
        status={state.status}
        completed={state.models.filter(m => m.status === "done").length}
        total={state.models.length}
      />

      {state.error && (
        <Box marginY={1}>
          <Text color="red">Error: {state.error}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginY={1}>
        {state.models.map((model, i) => (
          <ModelPanel key={i} model={model} index={i} />
        ))}
      </Box>

      {state.status === "complete" && state.synthesis && (
        <Synthesis synthesis={state.synthesis} />
      )}

      <Box marginTop={2}>
        <Text dimColor>Socket: {socketPath}</Text>
      </Box>
    </Box>
  )
}
