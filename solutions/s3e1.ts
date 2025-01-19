import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { TextSplitter } from "../text-splitter/TextService";

interface KeywordMetadata {
  [key: string]: string;
}

export class TextProcessor {
  private splitter: TextSplitter;
  private openAiKey: string;
  private memoryContext: string = "";

  constructor(openAiKey: string) {
    this.splitter = new TextSplitter();
    this.openAiKey = openAiKey;
  }

  private async processFactsAndCreateMemory(): Promise<void> {
    const memoryPath = path.join(__dirname, "MEMORY.md");

    // Check if MEMORY.md already exists and has content
    try {
      const existingMemory = fs.readFileSync(memoryPath, "utf-8");
      if (existingMemory.trim()) {
        console.log("Using existing MEMORY.md content");
        this.memoryContext = existingMemory;
        return;
      }
    } catch (error) {
      console.log("MEMORY.md not found, processing facts...");
    }

    // If we get here, we need to process facts
    const factsDir = path.join(__dirname, "lesson3e1", "facts");
    const allKeywords: string[] = [];

    try {
      const files = fs.readdirSync(factsDir);

      for (const file of files.filter((f) => f.endsWith(".txt"))) {
        console.log(`Extracting keywords from fact file: ${file}`);
        const content = fs.readFileSync(path.join(factsDir, file), "utf-8");
        const keywords = await this.getKeywordsFromFact(content);
        allKeywords.push(keywords);
      }

      this.memoryContext = allKeywords.join("\n\n");

      // Save to MEMORY.md
      fs.writeFileSync(memoryPath, this.memoryContext);
      console.log("Memory context saved to MEMORY.md");
    } catch (error) {
      console.error("Error processing facts:", error);
      throw error;
    }
  }

  private async callOpenAI(
    messages: any[],
    maxTokens: number
  ): Promise<string> {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.3,
        max_tokens: maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${this.openAiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.choices[0].message.content.trim();
  }

  private async getKeywordsFromFact(text: string): Promise<string> {
    // First, determine if it's a sector or person and get the proper title
    const contextMessages = [
      {
        role: "system",
        content: `Określ główny kontekst tekstu i zwróć odpowiedni tytuł.
            - Dla sektora zwróć dokładnie "Sektor X" gdzie X to litera sektora
            - Dla osoby zwróć pełne imię i nazwisko z tekstu
            Zwróć tylko sam tytuł, bez dodatkowego tekstu.`,
      },
      {
        role: "user",
        content: text.slice(0, 500),
      },
    ];

    const context = await this.callOpenAI(contextMessages, 30);

    // Then get keywords for this context
    const messages = [
      {
        role: "system",
        content: `Wyodrębnij kluczowe informacje dla kontekstu: ${context}.
            Zasady:
            - Jeśli to sektor: lokalizacja, przeznaczenie, wyposażenie, działania
            - Jeśli to osoba: rola, umiejętności, powiązania, działalność
            - Zwróć w formie listy punktowanej
            - Nie używaj nagłówków ani wprowadzeń`,
      },
      {
        role: "user",
        content: text.slice(0, 1000),
      },
    ];

    const keywords = await this.callOpenAI(messages, 150);
    return `### ${context} ###\n${keywords}\n`;
  }

  private async getKeywordsFromDocument(text: string): Promise<string> {
    const memoryPath = path.join(__dirname, "MEMORY.md");
    const memoryContent = fs.readFileSync(memoryPath, "utf-8");

    if (!memoryContent) {
      throw new Error("MEMORY.md is empty or not found");
    }

    const messages = [
      {
        role: "system",
        content: `Przeanalizuj tekst i wyodrębnij 5-7 najważniejszych słów kluczowych.
            
            Zasady:
            - Wyodrębnij tylko te osoby i sektory, które faktycznie występują w tekście
            - Gdy pojawia się osoba, zawsze dodaj jej zawód/rolę (np. "Aleksander Ragowski nauczyciel", "Barbara Zawadzka frontend developer, javaScript programmer")
            - Nie dodawaj osób ani miejsc, których nie ma w analizowanym tekście
            - Zwróć uwagę na konkretne wydarzenia i działania
            - Zwróć same słowa kluczowe oddzielone przecinkami
            - Nie dodawaj żadnego wprowadzenia ani nagłówka
            - Każde słowo kluczowe powinno faktycznie występować w tekście
            - Nie używaj słów, których nie ma w analizowanym tekście
            
            Baza wiedzy (użyj tylko jeśli znajdziesz powiązanie w tekście):
            ${memoryContent}`,
      },
      {
        role: "user",
        content: text.slice(0, 500),
      },
    ];

    return this.callOpenAI(messages, 50);
  }

  async processFiles(): Promise<KeywordMetadata> {
    // First check/create memory file
    await this.processFactsAndCreateMemory();
    console.log("Memory context ready. Starting report processing...");

    const dataDir = path.join(__dirname, "data");
    const metadata: KeywordMetadata = {};

    try {
      const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.endsWith(".txt"))
        .sort((a, b) => a.localeCompare(b));

      console.log(`Found ${files.length} text files to process`);

      for (const file of files) {
        console.log(`Processing file: ${file}`);
        const filePath = path.join(dataDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        const chunks = await this.splitter.split(content, 500);

        const textToAnalyze = chunks[0].text;

        const keywords = await this.getKeywordsFromDocument(textToAnalyze);
        console.log(`Generated keywords for ${file}: ${keywords}`);

        metadata[file] = keywords;
      }

      // Send to centrala
      const payload = {
        task: "dokumenty",
        apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
        answer: metadata,
      };

      console.log(
        "Sending payload to centrala:",
        JSON.stringify(payload, null, 2)
      );

      try {
        const response = await axios.post(
          "https://centrala.ag3nts.org/report",
          payload,
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        console.log(`Response status: ${response.status}`);
        console.log("Response data:", response.data);
      } catch (error: any) {
        console.error("Error details:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }

      return metadata;
    } catch (error) {
      console.error("Error:", error.message);
      throw error;
    }
  }
}

// Execute the processing
const processor = new TextProcessor(process.env.OPENAI_API_KEY || "");
processor
  .processFiles()
  .catch((error) => console.error("Error:", error.message));
