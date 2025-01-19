import { OpenAI } from "openai";
import * as fs from "fs";
import * as path from "path";
import { QdrantClient } from "@qdrant/js-client-rest";
import axios from "axios";

interface Document {
  text: string;
  embedding: number[];
  metadata: {
    date: string;
  };
}

export async function solution() {
  // 2024-02-21
  const payload = {
    task: "wektory",
    apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
    answer: "2024-02-21",
  };

  try {
    const response = await axios.post(
      "https://centrala.ag3nts.org/report",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
  return;
  const openai = new OpenAI();
  const qdrant = new QdrantClient({ url: "http://localhost:6333" });
  const collectionName = "reports";

  // Create collection if not exists
  try {
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: 1536, // text-embedding-ada-002 dimension
        distance: "Cosine",
      },
    });
  } catch (e) {
    // Collection might already exist
  }

  // Question to embed
  const question =
    "W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?";
  console.log("\nQuestion:", question);

  // Get embedding for the question
  const questionEmbeddingResponse = await openai.embeddings.create({
    input: question,
    model: "text-embedding-ada-002",
  });

  const questionEmbedding = questionEmbeddingResponse.data[0].embedding;

  // List of files with their corresponding dates
  const filesWithDates = [
    ["2024_01_08.txt", "2024-01-08"],
    ["2024_01_17.txt", "2024-01-17"],
    ["2024_01_27.txt", "2024-01-27"],
    ["2024_01_29.txt", "2024-01-29"],
    ["2024_02_01.txt", "2024-02-01"],
    ["2024_02_11.txt", "2024-02-11"],
    ["2024_02_15.txt", "2024-02-15"],
    ["2024_02_21.txt", "2024-02-21"],
    ["2024_03_02.txt", "2024-03-02"],
    ["2024_03_12.txt", "2024-03-12"],
    ["2024_03_15.txt", "2024-03-15"],
    ["2024_03_18.txt", "2024-03-18"],
    ["2024_03_19.txt", "2024-03-19"],
    ["2024_03_25.txt", "2024-03-25"],
    ["2024_03_29.txt", "2024-03-29"],
    ["2024_03_31.txt", "2024-03-31"],
    ["2024_04_18.txt", "2024-04-18"],
    ["2024_04_27.txt", "2024-04-27"],
    ["2024_05_08.txt", "2024-05-08"],
    ["2024_05_14.txt", "2024-05-14"],
    ["2024_05_31.txt", "2024-05-31"],
    ["2024_06_02.txt", "2024-06-02"],
    ["2024_07_05.txt", "2024-07-05"],
  ];

  // Store documents and their embeddings
  for (let i = 0; i < filesWithDates.length; i++) {
    const [filename, date] = filesWithDates[i];
    const filePath = path.join(
      __dirname,
      "season3e2",
      "do-not-share",
      filename
    );
    const text = fs.readFileSync(filePath, "utf-8");

    const embeddingResponse = await openai.embeddings.create({
      input: text,
      model: "text-embedding-ada-002",
    });

    // Upload to Qdrant
    await qdrant.upsert(collectionName, {
      wait: true,
      points: [
        {
          id: i,
          vector: embeddingResponse.data[0].embedding,
          payload: {
            text,
            date,
          },
        },
      ],
    });
  }

  // Search for the most similar document
  const searchResult = await qdrant.search(collectionName, {
    vector: questionEmbedding,
    limit: 1,
  });

  const mostSimilarDocument = searchResult[0];

  console.log(
    "\nFound answer in report from:",
    // @ts-ignore
    mostSimilarDocument.payload.date
  );
  console.log("Similarity score:", mostSimilarDocument.score);
  console.log("\nRelevant text excerpt:");
  // @ts-ignore
  console.log(mostSimilarDocument.payload.text);
  // @ts-ignore
  return mostSimilarDocument.payload.date;
}

// Execute when run directly with Bun
if (import.meta.main) {
  solution().then(console.log).catch(console.error);
}
