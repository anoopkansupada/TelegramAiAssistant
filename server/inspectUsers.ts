import { db } from "./db";
import { users } from "./schema";

// Function to list all users
async function listUsers() {
    const allUsers = await db.select().from(users);
    console.log("Users:", allUsers);
}

// Execute the function
listUsers().catch(console.error);