import React, { useState, useEffect, useRef, useCallback } from "react"
import { Box, Text, useApp } from "ink"
import { Header } from "./components/Header.js"
import { ModelPanel } from "./components/ModelPanel.js"
import { Synthesis } from "./components/Synthesis.js"
import { runCouncil, type CouncilState, type ModelState } from "./council.js"
import { startSocketServer } from "./socket-server.js"

interface Props {
  question: string
  models: Array<{ provider: string; model: string; label?: string }>
  socketPath: string
  timeout: number
  synthesize: boolean
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
    // Start IPC socket server
    const cleanup = startSocketServer(socketPath, getState, () => exit())

    // Start council deliberation
    runCouncil({
      question,
      models,
      timeout,
      synthesize,
      onUpdate: (update) => setState(prev => {
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
      }),
      onComplete: () => setState(prev => ({ ...prev, status: "complete" })),
      onError: (err) => setState(prev => ({ ...prev, status: "error", error: err })),
    })

    return cleanup
  }, [])

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        question={question}
        status={state.status}
        completed={state.models.filter(m => m.status === "done").length}
        total={state.models.length}
      />
      <Box flexDirection="row" flexWrap="wrap">
        {state.models.map((model, i) => (
          <ModelPanel key={i} model={model} />
        ))}
      </Box>
      {state.synthesis && <Synthesis text={state.synthesis} />}
      {state.error && (
        <Box marginTop={1}>
          <Text color="red">Error: {state.error}</Text>
        </Box>
      )}
      {state.status === "complete" && (
        <Box marginTop={1}>
          <Text dimColor>Council complete. This pane will stay open for review. Press q to close.</Text>
        </Box>
      )}
    </Box>
  )
}
