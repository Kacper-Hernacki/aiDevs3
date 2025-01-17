import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import { createReadStream } from "fs";
import FormData from "form-data";

interface TranscriptionResult {
  filename: string;
  transcription: string;
}

async function transcribeAudioFile(
  filepath: string
): Promise<TranscriptionResult> {
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
}

async function transcribeAssets() {
  const assetsDir = path.join(__dirname, "../solutions/assets");
  const outputDir = path.join(__dirname, "../transcriptions");

  await fs.mkdir(outputDir, { recursive: true });

  const files = await fs.readdir(assetsDir);
  const audioFiles = files.filter((file) =>
    [".m4a", ".mp3", ".wav"].some((ext) => file.endsWith(ext))
  );

  for (const audioFile of audioFiles) {
    const inputPath = path.join(assetsDir, audioFile);
    const outputPath = path.join(
      outputDir,
      `${path.parse(audioFile).name}.json`
    );

    try {
      await fs.access(outputPath);
      console.log(`Skipping ${audioFile} - transcription exists`);
      continue;
    } catch {
      console.log(`Transcribing ${audioFile}...`);
      const result = await transcribeAudioFile(inputPath);

      await fs.writeFile(
        outputPath,
        JSON.stringify(
          {
            filename: audioFile,
            transcription: result.transcription,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }
  }
}

export { transcribeAssets, transcribeAudioFile };
