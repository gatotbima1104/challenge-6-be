import { config } from "dotenv";
import { resolve } from "path";

export const NODE_ENV = process.env.NODE_ENV || "development";
const envFile = NODE_ENV === "development" ? ".env.local" : ".env";

config({ path: resolve(__dirname, `../${envFile}`), override: true });

export const PORT = process.env.PORT || 8000;
export const sumopodApiKey = process.env.SUMOPOD_API_KEY || "";
export const sumopodApiUrl = process.env.SUMOPOD_API_URL || "";
export const CLOUDKIT_CONFIG = {
  container: "iCloud.com.gatotdev.VoteApp", // your container ID
  environment: "development", // or "production"
  apiToken: process.env.CLOUDKIT_API_TOKEN!, // from CloudKit Dashboard > API Access
};