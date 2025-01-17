import { promises as fs } from "fs";
import { createReadStream } from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

async function transcribeAudio(filepath: string): Promise<string> {
  const formData = new FormData();
  const file = createReadStream(filepath);
  formData.append("file", file);
  formData.append("model", "whisper-1");

  try {
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
    return response.data.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return "";
  }
}

async function describeImage(imagePath: string): Promise<string> {
  const imageData = await fs.readFile(imagePath);
  const base64Image = imageData.toString("base64");

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Please describe this image in detail." },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error describing image:", error);
    return "";
  }
}

async function processMarkdown(): Promise<void> {
  // Fix the path to read from lessons2e5 directory
  const markdownPath = path.join(__dirname, "lessons2e5/arxiv-draft.md");
  let markdownContent = await fs.readFile(markdownPath, "utf-8");

  // Remove CSS styles more aggressively
  markdownContent = markdownContent.replace(
    /\/\*[\s\S]*?\*\/.*?figure \{[^}]*\}/s,
    ""
  );

  // Clean up any extra newlines that might be left
  markdownContent = markdownContent.replace(/^\s+/, "");

  // Remove everything after the "Status dokumentu" section
  markdownContent = markdownContent.split("Źródła")[0];

  // Create lessons2e5 directory if it doesn't exist
  const lessons2e5Dir = path.join(__dirname, "lessons2e5");
  await fs.mkdir(lessons2e5Dir, { recursive: true });

  // Process images
  const imageRegex = /!\[.*?\]\((i\/(.*?))\)/g;
  const imageMatches = [...markdownContent.matchAll(imageRegex)];

  for (const match of imageMatches) {
    const originalPath = match[1];
    const filename = match[2];
    const imagePath = path.join(lessons2e5Dir, filename);
    console.log(`Processing image: ${imagePath}`);

    try {
      const description = await describeImage(imagePath);
      // Replace image reference with description
      markdownContent = markdownContent.replace(
        `![](${originalPath})`,
        `![](${filename})\n\n**Image Description:** ${description}\n`
      );
    } catch (error) {
      console.error(`Error processing image ${imagePath}:`, error);
      continue;
    }
  }

  // Process audio files
  const audioRegex = /\[.*?\]\(i\/(.*?\.mp3)\)/g;
  const audioMatches = [...markdownContent.matchAll(audioRegex)];

  for (const match of audioMatches) {
    const originalPath = match[0];
    const filename = match[1];
    const audioPath = path.join(lessons2e5Dir, filename);
    console.log(`Processing audio: ${audioPath}`);

    try {
      const transcription = await transcribeAudio(audioPath);
      // Replace audio reference with transcription
      markdownContent = markdownContent.replace(
        originalPath,
        `[${filename}](${filename})\n\n**Audio Transcription:** ${transcription}\n`
      );
    } catch (error) {
      console.error(`Error processing audio ${audioPath}:`, error);
      continue;
    }
  }

  // Save the processed markdown
  const outputPath = path.join(__dirname, "processed_arxiv_draft.md");
  await fs.writeFile(outputPath, markdownContent);
  console.log(`Processed markdown saved to: ${outputPath}`);
}

// Execute the processing
processMarkdown().catch(console.error);
