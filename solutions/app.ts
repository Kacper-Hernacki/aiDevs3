import express from "express";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

import { promises as fs } from "fs";
import { OpenAIService } from "../websearch/OpenAIService";
import axios from "axios";
import { createReadStream } from "fs";
import path from "path";
import { createContext } from "./context_transcriptions";

// Consolidate interfaces at the top
interface VerifyResponse {
  text: string;
  msgID: string;
}

interface TestData {
  question: string;
  answer: string;
  test?: {
    q: string;
    a: string;
  };
}

interface TranscriptionResult {
  filename: string;
  transcription: string;
}

const app = express();
const port = 3000;
app.use(express.json());

const openaiService = new OpenAIService();

// Simplified listen handler
app.listen(port, async () => {
  try {
    const context = await fs.readFile(
      path.join(__dirname, "context.txt"),
      "utf-8"
    );
    const allMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `use the {{context}} to answer the following question in polish:na jakiej ulicy znajduje się instytut, na którym wykłada Andrzej Maj. Odpowiedz tylko ulicą, bez dodatkowych informacji. {{context}}: ${context}`,
      },
    ];

    const completion = await openaiService.completion(
      allMessages,
      "gpt-4",
      false
    );
    // @ts-ignore
    const answer = completion.choices[0].message.content;

    const payload = {
      task: "mp3",
      apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
      answer,
    };

    await axios.post("https://centrala.ag3nts.org/report", payload, {
      headers: { "Content-Type": "application/json" },
    });

    console.log(`Server running at http://localhost:${port}`);
  } catch (error) {
    console.error("Error:", error);
  }
});

// Simplified chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    await fs.writeFile("prompt.md", "");
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error in chat processing:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request" });
  }
});

// Add new function to handle transcriptions
async function transcribeAudioFile(
  filepath: string
): Promise<TranscriptionResult> {
  try {
    const formData = new FormData();
    const file = createReadStream(filepath);
    // @ts-ignore
    formData.append("file", file);
    formData.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          // @ts-ignore
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    return {
      filename: path.basename(filepath),
      transcription: response.data.text,
    };
  } catch (error) {
    console.error(`Error transcribing file ${filepath}:`, error);
    throw error;
  }
}

// Add new endpoint to handle transcriptions
app.post("/api/transcribe", async (req, res) => {
  try {
    const audioDir = "./audio"; // Directory containing m4a files
    const files = await fs.readdir(audioDir);
    const m4aFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".m4a"
    );

    const transcriptions: TranscriptionResult[] = [];
    for (const file of m4aFiles) {
      const filepath = path.join(audioDir, file);
      const result = await transcribeAudioFile(filepath);
      transcriptions.push(result);
    }

    // Save transcriptions to JSON file
    await fs.writeFile(
      "transcriptions.json",
      JSON.stringify({ transcriptions }, null, 2)
    );

    res.json({ message: "Transcriptions completed", transcriptions });
  } catch (error) {
    console.error("Error processing transcriptions:", error);
    res.status(500).json({ error: "Failed to process transcriptions" });
  }
});

// Add the context endpoint
app.get("/api/context", async (req, res) => {
  try {
    const context = await createContext();
    res.json({ context });
  } catch (error) {
    console.error("Error generating context:", error);
    res.status(500).json({ error: "Failed to generate context" });
  }
});
