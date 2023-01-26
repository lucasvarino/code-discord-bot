import { Client } from "discord.js";
import { config } from "dotenv";

// Load environment variables
config();

const client = new Client({
  intents: [],
});

client.login(process.env.TOKEN);

client.on("ready", () => {
  console.log("Bot is ready!");
});
