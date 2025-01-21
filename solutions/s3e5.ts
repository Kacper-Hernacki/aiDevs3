import { promises as fs } from "fs";
import { Neo4jService } from "../neo4j-101/Neo4jService";
import { OpenAIService } from "../neo4j-101/OpenAIService";

interface DatabaseResponse {
  reply: any[];
  error: string;
}

interface DatabaseRequest {
  task: string;
  apikey: string;
  query: string;
}

async function queryDatabase(
  apiKey: string,
  query: string
): Promise<DatabaseResponse> {
  const url = "https://centrala.ag3nts.org/apidb";

  const payload: DatabaseRequest = {
    task: "database",
    apikey: apiKey,
    query: query,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error querying database:", error);
    throw error;
  }
}

interface Datacenter {
  dc_id: string;
  location: string;
  manager: string;
  is_active: string;
}

async function sendShortestPath(path: string): Promise<void> {
  const payload = {
    task: "connections",
    apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
    answer: path,
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
}

async function getAllUsers(): Promise<void> {
  try {
    // Fetch all users
    const allUsersQuery = "SELECT * FROM users";
    console.log("Executing query:", allUsersQuery);

    const usersResult = await queryDatabase(
      "75307b8d-20bc-4ff1-8188-e93924d30511",
      allUsersQuery
    );

    if (usersResult && usersResult.reply && usersResult.reply.length > 0) {
      console.log("\n=== All Users ===");
      console.log("Number of users found:", usersResult.reply.length);
      await fs.writeFile(
        "users.json",
        JSON.stringify(usersResult.reply, null, 2)
      );
      console.log("User data saved to users.json");
    } else {
      console.log("No users found in the response");
      console.log("Raw response:", JSON.stringify(usersResult, null, 2));
    }

    // Fetch all connections
    const allConnectionsQuery = "SELECT * FROM connections";
    console.log("Executing query:", allConnectionsQuery);

    const connectionsResult = await queryDatabase(
      "75307b8d-20bc-4ff1-8188-e93924d30511",
      allConnectionsQuery
    );

    if (
      connectionsResult &&
      connectionsResult.reply &&
      connectionsResult.reply.length > 0
    ) {
      console.log("\n=== All Connections ===");
      console.log(
        "Number of connections found:",
        connectionsResult.reply.length
      );
      await fs.writeFile(
        "connections.json",
        JSON.stringify(connectionsResult.reply, null, 2)
      );
      console.log("Connection data saved to connections.json");
    } else {
      console.log("No connections found in the response");
      console.log("Raw response:", JSON.stringify(connectionsResult, null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function pushDataToNeo4j() {
  const neo4jService = new Neo4jService(
    process.env.NEO4J_URI!,
    process.env.NEO4J_USER!,
    process.env.NEO4J_PASSWORD!,
    new OpenAIService()
  );

  try {
    // Read connections data
    const connectionsData = JSON.parse(
      await fs.readFile("solutions/connections.json", "utf-8")
    );

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
      } else {
        console.warn(
          `Could not find nodes for connection: ${connection.user1_id} -> ${connection.user2_id}`
        );
      }
    }

    console.log("Connections successfully added to Neo4j.");
  } catch (error) {
    console.error("Error adding connections to Neo4j:", error);
  } finally {
    await neo4jService.close();
  }
}

async function findShortestPath(
  startUsername: string,
  endUsername: string
): Promise<string> {
  const neo4jService = new Neo4jService(
    process.env.NEO4J_URI!,
    process.env.NEO4J_USER!,
    process.env.NEO4J_PASSWORD!,
    new OpenAIService()
  );

  try {
    const query = `
      MATCH (start:User {username: $startUsername}), (end:User {username: $endUsername}),
      path = shortestPath((start)-[:KNOWS*]-(end))
      RETURN [node IN nodes(path) | node.username] AS names
    `;
    const result = await neo4jService.executeQuery(query, {
      startUsername,
      endUsername,
    });

    if (result.records.length > 0) {
      const names = result.records[0].get("names");
      return names.join(", ");
    } else {
      return `No path found between ${startUsername} and ${endUsername}.`;
    }
  } catch (error) {
    console.error("Error finding shortest path:", error);
    return "An error occurred while finding the shortest path.";
  } finally {
    await neo4jService.close();
  }
}

// Execute the function
// getAllUsers();
// pushDataToNeo4j();

// Example usage:
// Show structure for 'datacenters' table
// await showTableStructure("datacenters");
// // Show structure for 'users' table
// await showTableStructure("users");

// Example usage
(async () => {
  const path = await findShortestPath("Rafał", "Barbara");
  sendShortestPath(path);
  console.log("Shortest path:", path);
})();
