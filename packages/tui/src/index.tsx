#!/usr/bin/env bun
import { render } from "ink"
import React from "react"
import { App } from "./App.js"
import { parseArgs } from "util"

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

const models = JSON.parse(values.models || "[]")
const question = values.question || "No question provided"
const socketPath = values.socket || `/tmp/opencode-council-default.sock`
const timeout = parseInt(values.timeout || "120", 10)
const synthesize = values.synthesize === "true"

render(
  <App
    question={question}
    models={models}
    socketPath={socketPath}
    timeout={timeout}
    synthesize={synthesize}
  />
)
