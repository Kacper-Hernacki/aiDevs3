import * as fs from "fs";
import * as path from "path";
import axios from "axios";

function processFile(filePath: string, label: number): any[] {
  const data = fs.readFileSync(filePath, "utf-8");
  const lines = data.split("\n").filter((line) => line.trim() !== "");
  return lines.map((line) => ({
    messages: [
      { role: "system", content: "validate numbers" },
      { role: "user", content: line.trim() },
      { role: "assistant", content: label.toString() },
    ],
  }));
}

function main() {
  const correctFilePath = path.join("solutions", "Lab Data", "correct.txt");
  const incorrectFilePath = path.join("solutions", "Lab Data", "incorrect.txt");
  const outputFilePath = path.join("solutions", "Lab Data", "output.jsonl");

  const correctData = processFile(correctFilePath, 1);
  const incorrectData = processFile(incorrectFilePath, 0);

  const outputStream = fs.createWriteStream(outputFilePath, { flags: "w" });
  [...correctData, ...incorrectData].forEach((entry) => {
    outputStream.write(JSON.stringify(entry) + "\n");
  });
  outputStream.end();
}

async function sendResults() {
  const payload = {
    task: "research",
    apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
    answer: ["01", "02", "10"],
  };
  try {
    const submitResponse = await axios.post(
      "https://centrala.ag3nts.org/report",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    console.log("Submission response:", submitResponse.data);
  } catch (error) {
    console.error("Error:", error);
  }
}
await sendResults();
