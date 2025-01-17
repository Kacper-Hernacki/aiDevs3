import { promises as fs } from "fs";
import { createReadStream } from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

interface Question {
  id: string;
  text: string;
}

async function fetchQuestions(): Promise<Question[]> {
  try {
    const response = await axios.get(
      "https://centrala.ag3nts.org/data/75307b8d-20bc-4ff1-8188-e93924d30511/arxiv.txt"
    );
    const questionsText = response.data;

    // Parse questions line by line
    const questions = questionsText
      .split("\n")
      .map((line: string) => {
        const [id, text] = line.split("=");
        return {
          id,
          text: text || "",
        };
      })
      .filter((q: Question) => q.text); // Remove any empty entries

    console.log("Questions to answer:");
    questions.forEach((q: Question) => {
      console.log(`ID: ${q.id} - ${q.text}`);
    });

    return questions;
  } catch (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
}

async function describeImage(
  imagePath: string,
  questions: Question[]
): Promise<string> {
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
              {
                type: "text",
                text: `Please describe this image in detail, considering these questions: ${questions
                  .map((q) => q.text)
                  .join(", ")}`,
              },
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

async function transcribeAudio(
  filepath: string,
  questions: Question[]
): Promise<string> {
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
    return `Transcription (relevant to questions ${questions
      .map((q) => q.id)
      .join(", ")}): ${response.data.text}`;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return "";
  }
}

async function getAnswersFromDocument(
  markdownContent: string,
  questions: Question[]
): Promise<string> {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: `Based on this scientific document, please provide short, one-sentence answers to these questions. Format the response as a JSON object with question IDs as keys:

Document:
${markdownContent}

Questions to answer:
${questions.map((q) => `${q.id}: ${q.text}`).join("\n")}

Please respond with a pure JSON object without any markdown formatting or code block markers, in this format:
{
    "01": "short answer in one sentence",
    "02": "short answer in one sentence",
    ...
}`,
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

    const answers = response.data.choices[0].message.content.trim();
    console.log("Answers to questions:", answers);
    return answers;
  } catch (error) {
    console.error("Error getting answers:", error);
    return "";
  }
}

async function processMarkdown(): Promise<void> {
  // First fetch the questions
  const questions = await fetchQuestions();

  // Read and clean the markdown content
  const markdownPath = path.join(__dirname, "processed_arxiv_draft.md");
  let markdownContent = await fs.readFile(markdownPath, "utf-8");

  // Remove CSS styles more aggressively
  markdownContent = markdownContent.replace(
    /\/\*[\s\S]*?\*\/.*?figure \{[^}]*\}/s,
    ""
  );
  markdownContent = markdownContent.replace(/^\s+/, "");

  // Remove everything after the "Status dokumentu" section
  markdownContent = markdownContent.split("Źródła")[0];

  // Get answers from the document
  const answers = await getAnswersFromDocument(markdownContent, questions);
  console.log(answers);
  // Send answers to verification endpoint
  try {
    const payload = {
      task: "arxiv",
      apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
      answer: JSON.parse(answers),
    };
    console.log(payload);
    const response = await axios.post(
      "https://centrala.ag3nts.org/report",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log("Answers submitted successfully");
    console.log(response.data);
  } catch (error) {
    // @ts-ignore
    console.error("Error submitting answers:", error.response.data);
  }

  // Process images with questions context
  const imageRegex = /!\[.*?\]\((i\/(.*?))\)/g;
  const imageMatches = [...markdownContent.matchAll(imageRegex)];

  for (const match of imageMatches) {
    const originalPath = match[1];
    const filename = match[2];
    const imagePath = path.join(__dirname, "lessons2e5", filename);
    console.log(`Processing image: ${imagePath}`);

    try {
      const description = await describeImage(imagePath, questions);
      markdownContent = markdownContent.replace(
        `![](${originalPath})`,
        `![](${filename})\n\n**Image Description (Questions ${questions
          .map((q) => q.id)
          .join(", ")}):** ${description}\n`
      );
    } catch (error) {
      console.error(`Error processing image ${imagePath}:`, error);
      continue;
    }
  }

  // Process audio files with questions context
  const audioRegex = /\[.*?\]\(i\/(.*?\.mp3)\)/g;
  const audioMatches = [...markdownContent.matchAll(audioRegex)];

  for (const match of audioMatches) {
    const originalPath = match[0];
    const filename = match[1];
    const audioPath = path.join(__dirname, "lessons2e5", filename);
    console.log(`Processing audio: ${audioPath}`);

    try {
      const transcription = await transcribeAudio(audioPath, questions);
      markdownContent = markdownContent.replace(
        originalPath,
        `[${filename}](${filename})\n\n**Audio Transcription (Questions ${questions
          .map((q) => q.id)
          .join(", ")}):** ${transcription}\n`
      );
    } catch (error) {
      console.error(`Error processing audio ${audioPath}:`, error);
      continue;
    }
  }

  // Save the processed markdown
  const outputPath = path.join(__dirname, "processed_arxiv_draft.md");
  //   await fs.writeFile(outputPath, markdownContent);
  console.log(`Processed markdown saved to: ${outputPath}`);
}

// Execute the processing
processMarkdown().catch(console.error);
