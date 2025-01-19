import { OpenAIService } from "../websearch/OpenAIService";
import axios from "axios";

const openaiService = new OpenAIService();

async function generateRobotImage() {
  try {
    // Step 1: Fetch robot description
    console.log("Step 1: Fetching robot description...");
    const response = await axios.get(
      "https://centrala.ag3nts.org/data/75307b8d-20bc-4ff1-8188-e93924d30511/robotid.json"
    );
    const robotDescription = response.data.description;
    console.log("Robot description received:", robotDescription);

    // Step 2: Generate image with DALL-E
    console.log("Step 2: Generating image with DALL-E...");
    const imageResponse = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        prompt: robotDescription,
        model: "dall-e-3",
        n: 1,
        size: "1024x1024",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const imageUrl = imageResponse.data.data[0].url;
    console.log("Image generated successfully. URL:", imageUrl);

    // Step 3: Send result to centrala
    console.log("Step 3: Sending result to centrala...");
    const payload = {
      task: "robotid",
      apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
      answer: imageUrl,
    };

    const submitResponse = await axios.post(
      "https://centrala.ag3nts.org/report",
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log("Submission response:", submitResponse.data);
    return submitResponse.data;
  } catch (error) {
    console.error("Error in generateRobotImage:", error);
    throw error;
  }
}

// Execute the function
generateRobotImage().catch(console.error);
