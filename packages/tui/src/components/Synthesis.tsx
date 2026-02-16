import React from "react"
import { Box, Text } from "ink"

interface Props {
  text: string
}

export function Synthesis({ text }: Props) {
  return (
    <Box
      flexDirection="column"
      marginTop={1}
      padding={1}
      borderStyle="double"
      borderColor="cyan"
    >
      <Text bold color="cyan">📋 Synthesis</Text>
      <Text wrap="wrap">{text}</Text>
    </Box>
  )
}
