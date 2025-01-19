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

async function sendUserIds(userIds: number[]): Promise<void> {
  const payload = {
    task: "database",
    apikey: "75307b8d-20bc-4ff1-8188-e93924d30511",
    answer: userIds,
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

async function getActiveDatacentersWithUsers(): Promise<void> {
  try {
    // First, get the active datacenters
    const activeDatacentersQuery =
      "SELECT * FROM datacenters WHERE is_active = 1 LIMIT 100";
    console.log("Executing query:", activeDatacentersQuery);

    const result = await queryDatabase(
      "75307b8d-20bc-4ff1-8188-e93924d30511",
      activeDatacentersQuery
    );

    // Check if we have datacenters and log detailed information
    if (result && result.reply && result.reply.length > 0) {
      console.log("\n=== Active Datacenters ===");
      console.log("Number of datacenters found:", result.reply.length);
      console.log("Datacenter details:");
      result.reply.forEach((dc, index) => {
        console.log(`\nDatacenter ${index + 1}:`);
        console.log("DC ID:", dc.dc_id);
        console.log("Location:", dc.location);
        console.log("Manager ID:", dc.manager);
        console.log("Is Active:", dc.is_active);
      });

      const managerIds = [
        ...new Set(result.reply.map((dc) => Number(dc.manager))),
      ];
      console.log("\nUnique manager IDs:", managerIds);

      // Now query for inactive users from these managers
      const inactiveUsersQuery = `SELECT id FROM users WHERE is_active = 0 AND id IN (${managerIds.join(
        ","
      )})`;
      const usersResult = await queryDatabase(
        "75307b8d-20bc-4ff1-8188-e93924d30511",
        inactiveUsersQuery
      );

      if (usersResult && usersResult.reply && usersResult.reply.length > 0) {
        // Get the inactive user IDs
        const inactiveUserIds = usersResult.reply.map((user) =>
          Number(user.id)
        );

        // Find datacenter IDs managed by inactive users
        const datacenterIds = result.reply
          .filter((dc) => inactiveUserIds.includes(Number(dc.manager)))
          .map((dc) => Number(dc.dc_id));

        console.log("Datacenter IDs to send:", datacenterIds);

        // Send the datacenter IDs to the endpoint
        await sendUserIds(datacenterIds);
      } else {
        console.log("No inactive users found among datacenter managers");
      }
    } else {
      console.log("No active datacenters found in the response");
      console.log("Raw response:", JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function showTableStructure(tableName: string): Promise<void> {
  try {
    const query = `SHOW CREATE TABLE ${tableName}`;
    console.log("Executing query:", query);

    const result = await queryDatabase(
      "75307b8d-20bc-4ff1-8188-e93924d30511",
      query
    );

    console.log("\n=== Table Structure ===");
    console.log(`Table: ${tableName}`);
    if (result && result.reply && result.reply.length > 0) {
      console.log(JSON.stringify(result.reply, null, 2));
    } else {
      console.log("No table structure found");
      console.log("Raw response:", JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`Error getting table structure for ${tableName}:`, error);
    throw error;
  }
}

// Execute the function
getActiveDatacentersWithUsers();

// Example usage:
// Show structure for 'datacenters' table
// await showTableStructure("datacenters");
// // Show structure for 'users' table
// await showTableStructure("users");
