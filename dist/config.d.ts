import { z } from "zod";
declare const CouncilConfigSchema: z.ZodObject<{
    members: z.ZodArray<z.ZodString>;
    speaker: z.ZodString;
    serverUrl: z.ZodOptional<z.ZodString>;
    discussion: z.ZodOptional<z.ZodObject<{
        maxTurns: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CouncilConfig = z.infer<typeof CouncilConfigSchema> & {
    discussion: {
        maxTurns: number;
    };
};
export declare function loadCouncilConfig(projectDir: string): Promise<CouncilConfig>;
export {};
//# sourceMappingURL=config.d.ts.map