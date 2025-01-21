import { Neo4jService } from "./Neo4jService";
import { OpenAIService } from "./OpenAIService";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";
import { thinkingSystemPrompt } from "./prompts";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

if (
  !process.env.NEO4J_URI ||
  !process.env.NEO4J_USER ||
  !process.env.NEO4J_PASSWORD
) {
  throw new Error("NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set");
}

const openAIService = new OpenAIService();
const neo4jService = new Neo4jService(
  process.env.NEO4J_URI,
  process.env.NEO4J_USER,
  process.env.NEO4J_PASSWORD,
  openAIService
);

async function main() {
  try {
    // Read users and connections data
    const usersData = JSON.parse(
      await fs.readFile("solutions/users.json", "utf-8")
    );
    const connectionsData = JSON.parse(
      await fs.readFile("solutions/connections.json", "utf-8")
    );

    // Create User nodes
    for (const user of usersData) {
      await neo4jService.addNode("User", {
        id: user.id,
        username: user.username,
      });
    }

    // Create KNOWS relationships
    for (const connection of connectionsData) {
      const user1 = await neo4jService.findNodeByProperty(
        "User",
        "id",
        connection.user1_id
      );
      const user2 = await neo4jService.findNodeByProperty(
        "User",
        "id",
        connection.user2_id
      );
      if (user1 && user2) {
        await neo4jService.connectNodes(user1.id, user2.id, "KNOWS");
      }
    }

    // Example query: Find shortest path from Rafał to Barbara
    const query = `
      MATCH (start:User {username: 'Rafał'}), (end:User {username: 'Barbara'}),
      path = shortestPath((start)-[:KNOWS*]-(end))
      RETURN [node IN nodes(path) | node.username] AS names
    `;
    const result = await neo4jService.executeQuery(query);
    result.records.forEach((record) => {
      console.log("Shortest path:", record.get("names").join(", "));
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await neo4jService.close();
  }
}

main();
