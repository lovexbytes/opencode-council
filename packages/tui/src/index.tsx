#!/usr/bin/env bun
import { render } from "ink"
import React from "react"
import { App } from "./App.js"
import { parseArgs } from "util"
import fs from "fs"

// Debug logging
const logFile = `/tmp/council-tui-${Date.now()}.log`
fs.appendFileSync(logFile, `TUI starting with args: ${Bun.argv.join(" ")}\n`)

try {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      socket:     { type: "string" },
      question:   { type: "string" },
      models:     { type: "string" },  // JSON string
      timeout:    { type: "string", default: "120" },
      synthesize: { type: "string", default: "true" },
    },
  })

  fs.appendFileSync(logFile, `Parsed values: ${JSON.stringify(values)}\n`)

  let models: Array<{ provider: string; model: string; label?: string }> = []
  try {
    models = JSON.parse(values.models || "[]")
    fs.appendFileSync(logFile, `Parsed models: ${JSON.stringify(models)}\n`)
  } catch (e) {
    fs.appendFileSync(logFile, `ERROR parsing models: ${e}\n`)
  }

  const question = values.question || "No question provided"
  const socketPath = values.socket || `/tmp/opencode-council-default.sock`
  const timeout = parseInt(values.timeout || "120", 10)
  const synthesize = values.synthesize === "true"

  fs.appendFileSync(logFile, `Rendering App with question: ${question}, models: ${models.length}\n`)

  render(
    <App
      question={question}
      models={models}
      socketPath={socketPath}
      timeout={timeout}
      synthesize={synthesize}
    />
  )
} catch (error) {
  fs.appendFileSync(logFile, `FATAL ERROR: ${error}\n`)
  console.error("Council TUI crashed:", error)
  process.exit(1)
}
