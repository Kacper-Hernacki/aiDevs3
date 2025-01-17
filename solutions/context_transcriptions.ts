import * as fs from "fs/promises";
import * as path from "path";
import { OpenAIService } from "../websearch/OpenAIService";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

interface Transcription {
  filename: string;
  transcription: string;
  timestamp: string;
}

async function createContext(): Promise<string> {
  const transcriptionsDir = path.join(__dirname, "../solutions/transcriptions");
  const files = await fs.readdir(transcriptionsDir);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  const allTranscriptions = await Promise.all(
    jsonFiles.map(async (file) => {
      const content = await fs.readFile(
        path.join(transcriptionsDir, file),
        "utf-8"
      );
      const transcription: Transcription = JSON.parse(content);
      return `\nTranskrypcja ${transcription.filename}:\n${transcription.transcription}\n`;
    })
  );

  const openaiService = new OpenAIService();
  const systemPrompt = `Jesteś ekspertem w analizie tekstu. Przeanalizuj poniższe transkrypcje i stwórz jeden spójny kontekst, który będzie zawierał:
    1. Szczegółowe informacje o wszystkich wspomnianych osobach
    2. Dokładne lokalizacje (adresy, nazwy ulic, instytucje)
    3. Powiązania między osobami i miejscami
    4. Chronologię wydarzeń
    5. Wszelkie potencjalne zagrożenia lub ostrzeżenia`;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: allTranscriptions.join("") },
  ];

  const completion = await openaiService.completion(messages, "gpt-4", false);

  if (!completion.choices?.[0]?.message?.content) {
    throw new Error("Failed to generate context");
  }

  const context = completion.choices[0].message.content;
  await fs.writeFile(
    path.join(__dirname, "../solutions/context.txt"),
    context,
    "utf-8"
  );

  return context;
}

export { createContext };
