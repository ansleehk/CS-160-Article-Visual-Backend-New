import ChatGptService from "./chatGpt.js";
import path from "path";
import MermaidValidator from "./mermaidValidator.js";

class ConceptMapGenerationServiceError extends Error{
    constructor(message: string){
        super(message);
    }
}

export class ConceptMapGenerationService extends ChatGptService{
    private TASK_NAMES = ["get_keyword_from_pdf", "generate_mermaid_using_keyword"];

    constructor(){
        const CHATGPT_MODEL = "gpt-3.5-turbo";
        const JSON_PROMPT_FILE_PATH = path.resolve(import.meta.url, "../data/prompt/conceptMap.json");

        super(CHATGPT_MODEL, JSON_PROMPT_FILE_PATH);
    }

    private loadGetKeywordTaskPrompt(){
        this.addFewShotMsgToQueue(
            this.jsonPrompt!.tasks[this.TASK_NAMES[0]].few_shot
        )
    }

    private async getKeywordFromPdf(pdfText: string){
        const promptMsg = this.jsonPrompt!.tasks[this.TASK_NAMES[0]].prompt_msg;
        this.addUserMessageToQueue(promptMsg + pdfText);

        return (await this.send()).choices[0].message.content;
    }

    private loadGenerateMermaidTaskPrompt(){
        this.addFewShotMsgToQueue(
            this.jsonPrompt!.tasks[this.TASK_NAMES[1]].few_shot
        )
    }

    private async generateMermaidUsingKeyword(keyword: string){
        const promptMsg = this.jsonPrompt!.tasks[this.TASK_NAMES[1]].prompt_msg;
        this.addUserMessageToQueue(promptMsg + keyword);

        return (await this.send()).choices[0].message.content;
    }

    private async validateMermaidCode(mermaidCode: string): Promise<boolean>{
        const mermaidValidator = new MermaidValidator(mermaidCode);
        return await mermaidValidator.validate();
    }

    private async generateValidMermaidUsingKeyword(keyword: string){
        const MAX_ATTEMPT_COUNT = 3;
        let attemptCount = 0;

        do {
            const mermaidCode = await this.generateMermaidUsingKeyword(keyword);
            const isValid = await this.validateMermaidCode(mermaidCode!);

            if (isValid) {
                return mermaidCode;
            }

            attemptCount++;
        } while (attemptCount < MAX_ATTEMPT_COUNT);

        throw new ConceptMapGenerationServiceError("Failed to generate valid mermaid code. Tried maximum number of attempts.");
    }

    public async generateConceptMap(pdfText: string){
        this.loadGetKeywordTaskPrompt();
        const keyword = await this.getKeywordFromPdf(pdfText);

        this.loadGenerateMermaidTaskPrompt();
        const mermaidCode = await this.generateValidMermaidUsingKeyword(keyword!);

        return mermaidCode;
    }
}   