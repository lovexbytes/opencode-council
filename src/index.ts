import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin";

const CouncilPlugin: Plugin = async (_input: PluginInput): Promise<Hooks> => {
  return {
    "command.execute.before": async (input, output) => {
      const cmd = input.command.toLowerCase();
      if (cmd.includes("council")) {
        const question = input.command.replace(/council/i, "").trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output.parts = [{
          type: "text",
          text: `COUNCIL MODE: Analyze ${question} from multiple perspectives, then synthesize.`,
        } as any];
      }
    },
  };
};

export default CouncilPlugin;
