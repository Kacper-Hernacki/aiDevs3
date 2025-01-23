import express from "express";
import https from "https";
import fs from "fs";
import axios from "axios";

const app = express();
app.use(express.json()); // Middleware to parse JSON requests

const mapDescription = `
Map contains 4 rows and 4 columns. Each cell shows an image. Below I will provide you with a description of the map and each cell with proper coordinates. 

The first number in coordinates is the number of column counted from 1 to 4 from left to the right like X axis in math.

The second number is the number of row counted from 1 to 4 from top to the bottom like Y axis in math.

For example, if I say "(1, 1)" it means the first cell in the first row.

1. (1, 1): Starting Point
2. (2, 1): trawa
3. (3, 1): drzewo
4. (4, 1): dom
5. (1, 2): trawa
6. (2, 2): młyn
7. (3, 2): trawa
8. (4, 2): trawa
9. (1, 3): trawa
10. (2, 3): trawa
11. (3, 3): skała
11. (4, 3): drzewa
12. (1, 4): skała
13. (2, 4): skała
14. (3, 4): samochów
15. (4, 4): jaskinia
`;
const example = "poleciałem jedno pole w prawo, a później na sam dół";
// Endpoint to handle JSON requests
app.post("/process", async (req, res) => {
  const { instruction } = req.body; // Extract 'instruction' from request
  console.log(instruction);
  try {
    // Make a request to the GPT-4o-mini model with the provided instruction
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant. Please process the instruction provided by the user and return the coordinates of the cell that contains the image that matches the description in the instruction. Instruction will be provided in polish like: ${example} then you should return coordinates and what is in the cell in polish. please also return the thinking process. Response should be in json format like: {"coordinates": "(1, 1)", "description": "trawa", "_thinking_process": "I first checked the map and found that the cell (1, 1) which is a starting point. Then I checked the instruction and found that the user said "poleciałem jedno pole w prawo". This means that the user moved from (1, 1) to (2, 1). Then the user said "a później na sam dół". This means that the user moved from (2, 1) to (2, 4). Therefore, the cell that contains the image that matches the description in the instruction is (2, 4). (2,4) represents skały"}. Please always start from a starting point (1, 1) and then move in the direction of the instruction. Use ${mapDescription} to find the coordinates of the cell that contains the image that matches the description in the instruction.`,
          },
          {
            role: "user",
            content: instruction,
          },
        ],
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Use environment variable for API key
          "Content-Type": "application/json",
        },
      }
    );
    // Extract the response from the GPT-4o-mini model
    const llmResponse = response.data.choices[0].message.content;

    // Parse the JSON string to an object
    const parsedResponse = JSON.parse(llmResponse);
    console.log(parsedResponse);
    // Respond with JSON containing the parsed response
    res.json(parsedResponse);
  } catch (error) {
    console.error("Error making request to GPT-4o-mini:", error);
    res.status(500).json({ error: "Failed to process instruction" });
  }
});

// Start HTTP server on localhost:3000
app.listen(3000, () => {
  console.log("HTTP Server running on http://localhost:3000");
});
