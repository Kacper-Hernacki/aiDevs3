import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import TurndownService from "turndown";

async function downloadFile(url: string, outputPath: string) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, response.data);
    console.log(`Downloaded: ${outputPath}`);
  } catch (error) {
    // @ts-ignore
    console.error(`Failed to download ${url}:`, error.message);
  }
}

async function downloadAndConvertToMarkdown() {
  try {
    // Download HTML content
    const baseUrl = "https://centrala.ag3nts.org/dane/";
    const response = await axios.get(`${baseUrl}arxiv-draft.html`);
    const html = response.data;

    // Configure Turndown
    const turndownService = new TurndownService();

    // Find all image and audio file references in HTML
    const mediaRegex = /(?:src|href)="(i\/[^"]+)"/g;
    const matches = [...html.matchAll(mediaRegex)];

    // Create solutions directory if it doesn't exist
    const solutionsDir = path.join(__dirname);
    fs.mkdirSync(solutionsDir, { recursive: true });

    // Download all media files to solutions directory
    for (const match of matches) {
      const relativePath = match[1];
      const fileUrl = `${baseUrl}${relativePath}`;
      const outputPath = path.join(solutionsDir, relativePath);
      await downloadFile(fileUrl, outputPath);
    }

    // Convert HTML to Markdown
    const markdown = turndownService.turndown(html);

    // Save to markdown file in solutions directory
    fs.writeFileSync(path.join(solutionsDir, "arxiv-draft.md"), markdown);

    console.log("Successfully downloaded and converted to markdown");
  } catch (error) {
    // @ts-ignore
    console.error("Error:", error.message);
  }
}

downloadAndConvertToMarkdown();
