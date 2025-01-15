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
import { createContext } from "./s2e2";

type Role = "user" | "assistant" | "system";
type Message = Omit<ChatCompletionMessageParam, "role"> & { role: Role };

// Add new interface for the response type
interface VerifyResponse {
  text: string;
  msgID: string;
}

// Update the TestData interface to include the optional test property
interface TestData {
  question: string;
  answer: string;
  test?: {
    q: string;
    a: string;
  };
}

// Change the type of currentQuestion
let currentQuestion: VerifyResponse;

// Add new interface for transcription results
interface TranscriptionResult {
  filename: string;
  transcription: string;
}

/*
Start Express server
*/
const app = express();
const port = 3000;
app.use(express.json());

async function correctTestData(
  testData: TestData[],
  openaiService: OpenAIService
): Promise<TestData[]> {
  const correctedData = await Promise.all(
    testData.map(async (item) => {
      // Create a copy of the item
      const correctedItem = { ...item };

      // Handle the main question/answer pair
      if (isMathQuestion(item.question)) {
        const correctAnswer = evaluateMathExpression(item.question);
        correctedItem.answer = correctAnswer.toString();
      }

      // Handle nested test questions if they exist
      if (item.test?.q) {
        const question = item.test.q;
        if (!isMathQuestion(question) && item.test.a === "???") {
          const allMessages: ChatCompletionMessageParam[] = [
            {
              role: "system",
              content: `You are a helpful assistant. Please answer this question concisely with just the answer, no explanation: ${question}`,
            },
          ];

          const completion = await openaiService.completion(
            allMessages,
            "gpt-4",
            false
          );

          // Handle the completion response properly
          if (!isAsyncIterable(completion)) {
            correctedItem.test = {
              ...item.test,
              a: completion.choices[0].message.content || "",
            };
          }
        }
      }

      return correctedItem;
    })
  );

  return correctedData;
}

function isMathQuestion(question: string): boolean {
  // Check if the question contains basic math operators
  return /[\d\s+\-*\/]+/.test(question) && !/[a-zA-Z]/.test(question);
}

function evaluateMathExpression(expression: string): number {
  // Remove any whitespace and safely evaluate the expression
  const sanitizedExpression = expression.replace(/\s/g, "");

  // Split by operators while keeping them
  const parts = sanitizedExpression.split(/([+\-*\/])/);

  if (parts.length !== 3) {
    throw new Error("Only simple binary operations are supported");
  }

  const num1 = parseInt(parts[0]);
  const operator = parts[1];
  const num2 = parseInt(parts[2]);

  switch (operator) {
    case "+":
      return num1 + num2;
    case "-":
      return num1 - num2;
    case "*":
      return num1 * num2;
    case "/":
      return num1 / num2;
    default:
      throw new Error("Unsupported operator");
  }
}

// Helper function to check if something is an AsyncIterable
function isAsyncIterable(obj: any): obj is AsyncIterable<any> {
  return obj != null && typeof obj[Symbol.asyncIterator] === "function";
}

// Update the listen handler to use the correction function
app.listen(port, async () => {
  try {
    // const url =
    //   "https://centrala.ag3nts.org/data/75307b8d-20bc-4ff1-8188-e93924d30511/cenzura.txt";

    // Download and parse the JSON data
    // const response = await axios.get(url);

    // console.log(response.data);

    try {
      const context = await fs.readFile(
        path.join(__dirname, "context.txt"),
        "utf-8"
      );

      const allMessages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `use the {{context}} to answer the following question in polish:na jakiej ulicy znajduje się instytut, na którym wykłada Andrzej Maj. Odpowiedz tylko ulicą, bez dodatkowych informacji. Tip: there is no street provided in the context directly, you have to ufind it by a name, I am sure you can do it. For example, if the context says "Andrzej Maj works at the Institute of Computer Science and Mathematics at the University of Warsaw", you should find the street name not in the context but on your own as you by default know it and return it. {{context}}: ${context}`,
        },
      ];

      const completion = await openaiService.completion(
        allMessages,
        "gpt-4",
        false
      );

      console.log(completion.choices[0].message.content);

      const payload = {
        task: "mp3",
        apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
        answer: completion.choices[0].message.content,
      };

      console.log(payload);

      // Send the corrected data to the report endpoint
      try {
        const reportResponse = await axios.post(
          "https://centrala.ag3nts.org/report",
          payload,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Report response:", reportResponse.data);
      } catch (reportError) {
        console.error(
          "Failed to send report:",
          reportError.response?.data || reportError.message
        );
      }

      return true;
      const testData: TestData[] = response.data["test-data"];

      // Correct the test data
      const correctedTestData = await correctTestData(testData, openaiService);

      // Format the data according to the API requirements
      const reportPayload = {
        task: "json",
        apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
        answer: {
          apikey: "75307b8d-20bc-4ff1-8188-e93924d30511", // API key needs to be here too
          "test-data": correctedTestData,
        },
      };

      // Send the corrected data to the report endpoint
      try {
        const reportResponse = await axios.post(
          "https://centrala.ag3nts.org/report",
          reportPayload,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Report response:", reportResponse.data);
      } catch (reportError) {
        console.error(
          "Failed to send report:",
          reportError.response?.data || reportError.message
        );
      }

      console.log(`Server running at http://localhost:${port}`);
    } catch (error) {
      console.error("Failed to retrieve or correct test data:", error);
    }
  } catch (error) {
    console.error("Error:", error);
  }
});

const openaiService = new OpenAIService();

app.post("/api/chat", async (req, res) => {
  console.log("Received request");
  await fs.writeFile("prompt.md", "");

  const { messages }: { messages: Message[]; scrapedUrl?: string } = req.body;
  console.log(req.body);
  try {
    try {
      //   const allMessages: ChatCompletionMessageParam[] = [
      //     {
      //       role: "system",
      //       content: "",
      //     },
      //   ];
      //   const completion = await openaiService.completion(
      //     allMessages,
      //     "gpt-4",
      //     false
      //   );

      //   const username = "tester";
      //   const password = "574e112a";
      //   const postResult = await fetch("https://xyz.ag3nts.org/verify", {
      //     method: "POST",
      //     credentials: "include",
      //     headers: {
      //       "Content-Type": "application/x-www-form-urlencoded",
      //       Accept:
      //         "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      //     },
      //     body:
      //       "username=" +
      //       username +
      //       "&password=" +
      //       password +
      //       "&answer=" +
      //       (completion as ChatCompletion).choices[0].message.content,
      //   }).then((res) => res.text());

      return res.json(currentQuestion);
    } catch (error) {
      console.error("Error calling Firecrawl:", error);
    }
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
    formData.append("file", file);
    formData.append("model", "whisper-1");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
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
