export type TranscriptFile = {
    filename: string;
    filePath: string;
    updatedAt: number;
};
export declare function resolveTranscriptDirectory(projectDir?: string): Promise<string>;
export declare function saveCouncilTranscript(input: {
    projectDir?: string;
    sessionID: string;
    content: string;
}): Promise<{
    filePath: string;
    filename: string;
}>;
export declare function listCouncilTranscripts(projectDir?: string): Promise<TranscriptFile[]>;
export declare function readCouncilTranscript(input: {
    projectDir?: string;
    file: string;
}): Promise<{
    filePath: string;
    content: string;
}>;
//# sourceMappingURL=transcripts.d.ts.map