import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import { OpenAIService } from "../recognize/OpenAIService";
// import { ChatCompletionMessageParam } from "openai";

const openaiService = new OpenAIService();

async function main() {
  const payload = {
    task: "photos",
    apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
    answer:
      "Kobieta ma długie, ciemne włosy i nosi okulary. Ubrana jest w szary t-shirt. Na ramieniu ma tatuaż przedstawiający pająka. Wygląda na skoncentrowaną i zaangażowaną w ćwiczenia na siłowni.\nNa zdjęciu znajdują się dwie kobiety. Kobieta po lewej stronie ma proste, długie, rude włosy i nosi okulary o ciemnych oprawkach. Ma na sobie szarą koszulkę. Kobieta po prawej stronie ma prostą, długą, ciemną fryzurę, również nosi okulary z ciemnymi oprawkami i jest ubrana w szarą koszulkę.\nKobieta ma długie, proste, ciemne włosy i nosi okulary z cienkimi oprawkami. Jest ubrana w prostą szarą koszulkę. W ręku trzyma biały papierowy kubek, sugerujący, że może być to kubek z kawą lub innym napojem. Kobieta spogląda w górę, co nadaje jej wyraz zamyślenia lub refleksji. Tło jest rozmyte, wskazując na zieleń po lewej stronie i niejasne budynki lub ściany po prawej stronie.",
  };
  try {
    const response = await axios.post(
      "https://centrala.ag3nts.org/report",
      payload
    );
    console.log(response.data);
  } catch (error) {
    console.error("Error:", error);
  }
}
await main();

async function queryCentralBase(query: any): Promise<string[]> {
  const payload = {
    task: "photos",
    apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
    answer: query,
  };

  try {
    const response = await fetch("https://centrala.ag3nts.org/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("Response:", data);

    // Extract base URL if present
    const baseUrlPattern = /(https?:\/\/[^\s]+\/)/;
    const baseUrlMatch = data.message.match(baseUrlPattern);
    const baseUrl = baseUrlMatch ? baseUrlMatch[0] : "";

    // Extract full URLs and filenames
    const urlPattern = /(https?:\/\/[^\s]+)|IMG_\d+\.\w+/g;
    const matches = data.message.match(urlPattern) || [];

    // Construct full URLs if necessary
    const urls = matches.map((match: string) => {
      if (match.startsWith("http")) {
        return match; // It's a full URL
      } else {
        return `${baseUrl}${match}`; // It's a filename, append to base URL
      }
    });

    return urls;
  } catch (error) {
    // @ts-ignore
    console.error("Error sending user IDs:", error.data.message);
    throw error;
  }
}

async function ensureDirectoryExists(directory: string): Promise<void> {
  try {
    await fs.mkdir(directory, { recursive: true });
  } catch (error: any) {
    console.error(`Error creating directory ${directory}:`, error.message);
    throw error;
  }
}

async function downloadAndSaveImage(
  url: string,
  filename: string
): Promise<string> {
  const directory = path.join(__dirname, "downloaded_images");
  await ensureDirectoryExists(directory);

  const filePath = path.join(directory, filename);

  try {
    // Check if the file already exists
    await fs.access(filePath);
    console.log(`File already exists: ${filePath}`);
  } catch {
    // File does not exist, download it
    try {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      await fs.writeFile(filePath, response.data);
      console.log(`Downloaded and saved: ${filePath}`);
    } catch (error: any) {
      console.error(`Error downloading image from ${url}:`, error.message);
      throw error;
    }
  }

  return filePath;
}

async function analyzeImagesWithOpenAI(imageUrls: string[]): Promise<void> {
  for (const imageUrl of imageUrls) {
    try {
      const filename = path.basename(imageUrl);
      const filePath = await downloadAndSaveImage(imageUrl, filename);

      const imageData = await fs.readFile(filePath);
      const base64Image = imageData.toString("base64");

      const messages: any[] = [
        {
          role: "system",
          content: "You are an image analysis assistant.",
          name: "system-assistant",
        },
        {
          role: "user",
          content: `Please analyze the attached image and decide if it can be shown to Mrs. Barbara. If not, determine if it should be repaired, brightened, or darkened.`,
          name: "user-query",
        },
        {
          role: "user",
          content: `data:image/png;base64,${base64Image}`,
          name: "user-image",
        },
      ];

      const completion = await openaiService.completion(
        messages,
        "gpt-4o-mini",
        false
      );

      // @ts-ignore
      const decision = completion.choices[0].message.content.trim();
      console.log(`Decision for ${imageUrl}: ${decision}`);
    } catch (error: any) {
      console.error(`Error analyzing image ${imageUrl}:`, error.message);
    }
  }
}

// Example usage
// const imageUrls = await queryCentralBase("START");
// console.log("Extracted Image URLs:", imageUrls);
// await analyzeImagesWithOpenAI(imageUrls);
