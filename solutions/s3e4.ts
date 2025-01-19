import axios from "axios";
import fs from "fs/promises";
import path from "path";

const API_KEY = "75307b8d-20bc-4ff1-8188-e93924d30511";
const BARBARA_NOTE_URL = "https://centrala.ag3nts.org/dane/barbara.txt";
const PEOPLE_API_URL = "https://centrala.ag3nts.org/people";
const PLACES_API_URL = "https://centrala.ag3nts.org/places";

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface PlaceResponse {
  success: boolean;
  data?: {
    connected_places?: string[]; // Array of related/connected places
    barbara_presence?: boolean; // Indicates if Barbara was found at this location
    // Potentially other place-related fields
  };
  error?: string;
}

async function downloadNote(): Promise<string> {
  try {
    const response = await axios.get(BARBARA_NOTE_URL);
    return response.data;
  } catch (error) {
    console.log("Error downloading note:", error);
    throw error;
  }
}

async function queryLLM(
  text: string
): Promise<{ persons: string[]; cities: string[] }> {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that analyzes text and extracts mentioned persons and cities/towns. Return only JSON.",
          },
          {
            role: "user",
            content: `Extract all person names and cities/towns from this text. Return as JSON with format {"persons": string[], "cities": string[]}: ${text}`,
          },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data.choices[0].message.content;
    const parsed = JSON.parse(result);
    return {
      persons: parsed.persons || [],
      cities: parsed.cities || [],
    };
  } catch (error) {
    console.error("Error querying LLM:", error);
    throw error;
  }
}

async function loadOrQueryLLM(
  text: string
): Promise<{ persons: string[]; cities: string[] }> {
  const cacheFile = path.join(__dirname, "llm_cache.json");

  try {
    // Try to load from cache first
    const cached = await fs.readFile(cacheFile, "utf-8");
    console.log("📂 Using cached LLM results");
    return JSON.parse(cached);
  } catch (error) {
    // If file doesn't exist or can't be read, query LLM
    console.log("🔄 No cache found, querying LLM...");
    const result = await queryLLM(text);

    // Save results to cache
    try {
      await fs.writeFile(cacheFile, JSON.stringify(result, null, 2));
      console.log("💾 Cached LLM results for future use");
    } catch (writeError) {
      console.error("⚠️ Failed to cache LLM results:", writeError);
    }

    return result;
  }
}

async function queryApi(
  query: string,
  type: "people" | "places"
): Promise<ApiResponse> {
  const url = type === "people" ? PEOPLE_API_URL : PLACES_API_URL;
  const normalizedQuery = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");

  try {
    console.log(
      `\n🔍 Querying ${type} API for: "${query}" (normalized: "${normalizedQuery}")`
    );
    const response = await axios.post(url, {
      apikey: API_KEY,
      query: normalizedQuery,
    });
    console.log(
      `✅ ${type} API Response:`,
      JSON.stringify(response.data, null, 2)
    );
    return response.data;
  } catch (error: any) {
    // Only show the error message from the API response
    const errorMessage = error.response?.data?.message || error.message;
    console.log(`❌ Error querying ${type} API:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function findBarbara(): Promise<void> {
  console.log("\n🕵️ Starting investigation...");

  // Step 1: Download and analyze the note
  const note = await downloadNote();
  console.log("\n📝 Note downloaded successfully");
  console.log("📄 Note content:", note);

  // Step 2: Extract persons and cities using cached LLM results or query if needed
  const { persons, cities } = await loadOrQueryLLM(note);
  console.log("\n👥 Initial persons found:", persons);
  console.log("🏢 Initial cities found:", cities);

  // Step 3: Query APIs for each person and city
  const processedCities = new Set<string>();
  const processedPeople = new Set<string>();
  const citiesToCheck = new Set<string>(cities);
  const peopleToCheck = new Set<string>(persons.map((p) => p.split(" ")[0]));

  console.log("\n🔎 Starting location checks...");
  while (citiesToCheck.size > 0 || peopleToCheck.size > 0) {
    console.log("\n📍 Cities to check:", Array.from(citiesToCheck));
    console.log("👤 People to check:", Array.from(peopleToCheck));

    // Process cities
    for (const city of Array.from(citiesToCheck)) {
      if (!processedCities.has(city)) {
        const placeResponse = await queryApi(city, "places");
        if (placeResponse.success && placeResponse.data) {
          processedCities.add(city);

          // Check for Barbara's presence
          if (placeResponse.data.barbara_presence === true) {
            console.log(`\n🎉 Success! Barbara found in: ${city}`);
            return;
          }

          // Add new people found in this location
          if (placeResponse.data.message) {
            const peopleInLocation = placeResponse.data.message.split(" ");
            console.log(`👥 Found people in ${city}:`, peopleInLocation);
            //@ts-ignore
            peopleInLocation.forEach((person) => {
              if (!processedPeople.has(person)) {
                peopleToCheck.add(person);
              }
            });
          }
        }
      }
      citiesToCheck.delete(city);
    }

    // Process people
    for (const person of Array.from(peopleToCheck)) {
      if (!processedPeople.has(person)) {
        const personResponse = await queryApi(person, "people");
        if (personResponse.success && personResponse.data) {
          processedPeople.add(person);

          if (
            personResponse.data.message &&
            personResponse.data.message !== "[**RESTRICTED DATA**]"
          ) {
            const locations = personResponse.data.message.split(" ");
            console.log(`📍 ${person} was seen in:`, locations);

            // Add each new location to check
            //@ts-ignore
            locations.forEach((location) => {
              if (!processedCities.has(location)) {
                citiesToCheck.add(location);
              }
            });
          }
        }
      }
      peopleToCheck.delete(person);
    }
  }

  console.log("\n✨ Investigation complete. Check logs above for findings.");
}

// Execute the search
findBarbara().catch(console.error);

const payload = {
  task: "loop",
  apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
  answer: "ELBLAG",
};

try {
  const response = await fetch("https://centrala.ag3nts.org/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log("Response:", data);
} catch (error) {
  console.error("Error sending user IDs:", error);
  throw error;
}
