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
  try {
    // Read all transcription files
    const transcriptionsDir = path.join(
      __dirname,
      "../solutions/transcriptions"
    );
    const files = await fs.readdir(transcriptionsDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    let allTranscriptions = "";

    // Read and combine all transcriptions
    for (const file of jsonFiles) {
      const content = await fs.readFile(
        path.join(transcriptionsDir, file),
        "utf-8"
      );
      const transcription: Transcription = JSON.parse(content);
      allTranscriptions += `\nTranskrypcja ${transcription.filename}:\n${transcription.transcription}\n`;
    }

    const openaiService = new OpenAIService();

    const systemPrompt = `Jesteś ekspertem w analizie tekstu. Przeanalizuj poniższe transkrypcje i stwórz jeden spójny kontekst, który będzie zawierał:
1. Szczegółowe informacje o wszystkich wspomnianych osobach
2. Dokładne lokalizacje (adresy, nazwy ulic, instytucje)
3. Powiązania między osobami i miejscami
4. Chronologię wydarzeń
5. Wszelkie potencjalne zagrożenia lub ostrzeżenia

Skup się szczególnie na:
- Dokładnych adresach i lokalizacjach
- Pełnych nazwiskach osób
- Konkretnych powiązaniach między ludźmi i miejscami
- Szczegółach dotyczących instytucji i uczelni

Format odpowiedzi powinien być przejrzysty i łatwy do przeszukiwania.`;

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: allTranscriptions,
      },
    ];

    const completion = await openaiService.completion(messages, "gpt-4", false);

    if ("choices" in completion && completion.choices[0].message.content) {
      const context = completion.choices[0].message.content;

      // Save the context to a file
      const outputPath = path.join(__dirname, "../solutions/context.txt");
      await fs.writeFile(outputPath, context, "utf-8");

      return context;
    } else {
      throw new Error("Failed to generate context");
    }
  } catch (error) {
    console.error("Error creating context:", error);
    throw error;
  }
}

// Execute the function
createContext()
  .then((context) => {
    console.log("Context created successfully:");
    console.log(context);
  })
  .catch((error) => console.error("Error:", error));

// Export the function for use in endpoints
export { createContext };
