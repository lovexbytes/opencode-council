import { tool } from "@opencode-ai/plugin";
import { runCouncil } from "./council";
const CouncilPlugin = async (input) => {
    return {
        tool: {
            council: tool({
                description: "Run a multi-model council discussion with a speaker synthesis.",
                args: {
                    message: tool.schema.string().describe("The user request to send to the council."),
                },
                async execute(args, context) {
                    context.metadata({ title: "Council" });
                    return runCouncil(input, context, args.message);
                },
            }),
        },
    };
};
export default CouncilPlugin;
//# sourceMappingURL=index.js.map