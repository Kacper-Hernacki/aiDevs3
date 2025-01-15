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

async function transcribeAssets() {
  try {
    // Read all files from assets directory
    const assetsDir = path.join(__dirname, "../solutions/assets");
    const outputDir = path.join(__dirname, "../transcriptions");

    // Create transcriptions directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });

    // Get all audio files
    const files = await fs.readdir(assetsDir);
    const audioFiles = files.filter(
      (file) =>
        file.endsWith(".m4a") || file.endsWith(".mp3") || file.endsWith(".wav")
    );

    console.log(`Found ${audioFiles.length} audio files to transcribe`);

    // Process each audio file
    for (const audioFile of audioFiles) {
      const inputPath = path.join(assetsDir, audioFile);
      const outputPath = path.join(
        outputDir,
        `${path.parse(audioFile).name}.json`
      );

      // Check if transcription already exists
      try {
        await fs.access(outputPath);
        console.log(`Skipping ${audioFile} - transcription already exists`);
        continue;
      } catch {
        // File doesn't exist, proceed with transcription
      }

      console.log(`Transcribing ${audioFile}...`);

      const result = await transcribeAudioFile(inputPath);

      // Save to JSON file
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

      console.log(`Transcription saved for ${audioFile}`);
    }

    console.log("All transcriptions completed!");
  } catch (error) {
    console.error("Error during transcription:", error);
  }
}

// Run the transcription when the script is executed
// transcribeAssets();
