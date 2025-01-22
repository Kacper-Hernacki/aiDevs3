import { v4 as uuidv4 } from "uuid";
import path from "path";
import { promises as fs } from "fs";
import axios from "axios";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Ensure your API key is set in the environment variables
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function fetchAndSaveToMarkdown(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.text(); // Fetch the content as text

    // Convert the content to markdown format
    const markdownContent = `# Content from ${url}\n\n${data}`;

    // Save markdown content to a file using fs/promises
    const fileName = `content_${uuidv4()}.md`;
    const filePath = path.join(process.cwd(), fileName);
    await fs.writeFile(filePath, markdownContent, "utf8");

    console.log(`Content saved to ${filePath}`);
  } catch (error: any) {
    console.error("Error fetching or saving content:", error);
  }
}

const urlToBeResearched = "https://softo.ag3nts.org";
// fetchAndSaveToMarkdown(urlToBeResearched);

async function fetchContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    if (response.status !== 200) {
      throw new Error(`Failed to fetch content from ${url}`);
    }
    return response.data;
  } catch (error) {
    console.error(`Error fetching content from ${url}:`, error);
    return "";
  }
}

async function findAnswersInContent(
  content: string,
  questions: string[]
): Promise<string[]> {
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: `Content: ${content}` },
          { role: "user", content: `Questions: ${questions.join("\n")}` },
          {
            role: "user",
            content:
              "If you cannot find an answer, suggest the most probable link or subpage that might contain the answer.",
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    const answers = response.data.choices[0].message.content.split("\n");
    return answers;
  } catch (error) {
    console.error("Error finding answers with LLM:", error);
    return questions.map((question) => `Error finding answer for: ${question}`);
  }
}

async function exploreLinksAndFindAnswers(
  baseUrl: string,
  links: string[],
  questions: string[],
  visitedLinks: Set<string> = new Set(),
  answeredQuestions: Set<string> = new Set(),
  foundAnswers: Map<string, string> = new Map()
) {
  for (const link of links) {
    const fullUrl = new URL(link, baseUrl).toString();

    // Skip if the link has already been visited
    if (visitedLinks.has(fullUrl)) {
      continue;
    }

    visitedLinks.add(fullUrl);

    const content = await fetchContent(fullUrl);
    const answers = await findAnswersInContent(content, questions);

    // Log the answers found
    console.log(`Answers found at ${fullUrl}:`, answers);

    // Check which questions have been answered
    answers.forEach((answer, index) => {
      if (!answer.includes("Suggested link or subpage")) {
        answeredQuestions.add(questions[index]);
        foundAnswers.set(questions[index], answer);
      }
    });

    // Filter out answered questions
    const unansweredQuestions = questions.filter(
      (question) => !answeredQuestions.has(question)
    );

    // If there are unanswered questions, look for more links in the content
    if (unansweredQuestions.length > 0) {
      const newLinks = extractLinksFromContent(content);
      if (newLinks.length > 0) {
        await exploreLinksAndFindAnswers(
          baseUrl,
          newLinks,
          unansweredQuestions,
          visitedLinks,
          answeredQuestions,
          foundAnswers
        );
      }
    }

    // Handle suggested links for unanswered questions
    answers.forEach((answer, index) => {
      if (answer.includes("Suggested link or subpage")) {
        const suggestedLinks = extractLinksFromContent(answer);
        if (suggestedLinks.length > 0) {
          exploreLinksAndFindAnswers(
            baseUrl,
            suggestedLinks,
            [questions[index]],
            visitedLinks,
            answeredQuestions,
            foundAnswers
          );
        }
      }
    });
  }

  // Output the found answers
  console.log("Final Answers:", Array.from(foundAnswers.entries()));
}

function extractLinksFromContent(content: string): string[] {
  // Implement logic to extract links from the content
  // This is a placeholder for the actual implementation
  const linkRegex = /href="(\/[^"]+)"/g;
  const links = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

async function provideContextAndAskQuestions() {
  try {
    // Load the markdown content
    const filePath = path.join(
      process.cwd(),
      "content_7a2c0691-b79d-4b9b-a933-9842a9c1547d.md"
    );
    const markdownContent = await fs.readFile(filePath, "utf8");

    // Define the questions
    const questions = [
      "Question 01: Podaj adres mailowy do firmy SoftoAI",
      "Question 02: Jaki jest adres interfejsu webowego do sterowania robotami zrealizowanego dla klienta jakim jest firma BanAN?",
      "Question 03: Jakie dwa certyfikaty jakości ISO otrzymała firma SoftoAI?",
    ];

    // Extract links from the model's response
    const links = ["/kontakt", "/uslugi", "/aktualnosci"];
    const baseUrl = "https://softo.ag3nts.org";

    // Explore links and find answers
    await exploreLinksAndFindAnswers(baseUrl, links, questions);
  } catch (error) {
    console.error("Error providing context and asking questions:", error);
  }
}

// provideContextAndAskQuestions();

// kontakt@softoai.whatever
// https://banan.ag3nts.org/
// Firma SoftoAI otrzymała certyfikaty jakości ISO 9001 oraz ISO/IEC 27001.

async function sendResults() {
  const payload = {
    task: "softo",
    apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
    answer: {
      "01": "kontakt@softoai.whatever",
      "02": "https://banan.ag3nts.org/",
      "03": "Firma SoftoAI otrzymała certyfikaty jakości ISO 9001 oraz ISO/IEC 27001.",
    },
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
