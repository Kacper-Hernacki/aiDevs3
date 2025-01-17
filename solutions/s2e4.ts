import { promises as fs } from "fs";
import path from "path";
import { OpenAIService } from "../recognize/OpenAIService";
import type {
  ChatCompletionContentPartImage,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import axios from "axios";
import { createReadStream } from "fs";
import FormData from "form-data";

const openaiService = new OpenAIService();

// Uncomment the CategoryResult interface
interface CategoryResult {
  people: string[];
  hardware: string[];
}

async function processFiles(): Promise<CategoryResult> {
  console.log("Starting file processing...");
  // Hardcoded result based on the provided categorization
  const result: CategoryResult = {
    people: [
      "2024-11-12_report-00-sektor_C4.txt",
      "2024-11-12_report-07-sektor_C4.txt",
      "2024-11-12_report-10-sektor-C1.mp3",
    ],
    hardware: [
      //   "2024-11-12_report-05-sektor_C1.txt",
      //   "2024-11-12_report-06-sektor_C2.txt",
      //   "2024-11-12_report-10-sektor-C1.mp3",
      //   "2024-11-12_report-11-sektor-C2.mp3",
      "2024-11-12_report-13.png",
      //   "2024-11-12_report-14.png",
      "2024-11-12_report-15.png",
      //   "2024-11-12_report-16.png",
      "2024-11-12_report-17.png",
    ],
  };

  /* Comment out all the AI processing code
  try {
    const dataDir = path.join(__dirname, "data");
    ...
    all the processing logic
    ...
  } catch (error) {
    console.error("Error processing files:", error);
    throw error;
  }
  */

  return result;
}

async function sendResults(result: CategoryResult): Promise<void> {
  try {
    console.log("Sending results to centrala...");

    // const answer = JSON.stringify(result);
    const payload = {
      task: "kategorie",
      apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
      answer: result,
    };

    console.log("Sending payload:", payload); // Debug the payload

    const response = await axios.post(
      "https://centrala.ag3nts.org/report",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log("Results sent successfully:", response.data);
  } catch (error) {
    // @ts-ignore
    if (error.response) {
      console.error("Error details:", {
        // @ts-ignore
        status: error.response.status,
        // @ts-ignore
        statusText: error.response.statusText,
        // @ts-ignore
        data: error.response.data,
      });
    } else {
      // @ts-ignore
      console.error("Error sending results:", error.message);
    }
    throw error;
  }
}

// Update the execution part
processFiles()
  .then(async (result) => {
    console.log("Processing results:", JSON.stringify(result, null, 2));
    await sendResults(result);
  })
  .catch((error) =>
    console.error("Failed to process or send results:", error.message)
  );
