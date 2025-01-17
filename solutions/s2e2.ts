import { promises as fs } from "fs";
import path from "path";
import { OpenAIService } from "../recognize/OpenAIService";
import type {
  ChatCompletionContentPartImage,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

const openaiService = new OpenAIService();

async function processImage(): Promise<void> {
  try {
    // Read all map image files
    const imageFiles = ["map-1.png", "map-2.png", "map-3.png", "map-4.png"];
    const base64Images = await Promise.all(
      imageFiles.map(async (file) => {
        const imagePath = path.join(__dirname, `assets/${file}`);
        const imageData = await fs.readFile(imagePath);
        return imageData.toString("base64");
      })
    );

    // Prepare messages with multiple images
    const allMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `The attached images are screenshots of some city. There are 4 fragments, Name that city in polish. Double check if city you're going to give me as answer has locations presented in the map fragments. One of the fragments is from another city. Eliminate Kraków, Białystok, Poznań, Gdańsk, Łódź, warszawa, grudziądz and Wrocław from consideration.`,
      },
      {
        role: "user",
        content: base64Images.map((base64Image) => ({
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
            detail: "high",
          },
        })) as ChatCompletionContentPartImage[],
      },
    ];

    // Get completion from GPT-4V
    const completion = await openaiService.completion(
      allMessages,
      "gpt-4o",
      false
    );
    // @ts-ignore
    const answer = completion.choices[0].message.content;
    console.log("Answer:", answer);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Execute the function
processImage();
