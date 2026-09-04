import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
const envContent = readFileSync(envPath, "utf-8");

function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=["']?([^"'\n]+)["']?`, "m"));
  return match ? match[1].trim() : "";
}

const customerId = getEnvVar("GOOGLE_ADS_CUSTOMER_ID").replace(/\D/g, "");
const managerId = (getEnvVar("GOOGLE_ADS_MANAGER_ID") || customerId).replace(/\D/g, "");
const developerToken = getEnvVar("GOOGLE_ADS_DEVELOPER_TOKEN");
const clientId = getEnvVar("GOOGLE_ADS_CLIENT_ID");
const clientSecret = getEnvVar("GOOGLE_ADS_CLIENT_SECRET");
const refreshToken = getEnvVar("GOOGLE_ADS_REFRESH_TOKEN");

console.log("Customer ID:", customerId);
console.log("Manager ID (login-customer-id):", managerId);
console.log("Developer Token:", developerToken.slice(0, 5) + "...");
console.log("Client ID:", clientId.slice(0, 15) + "...");

async function run() {
  console.log("\n1. Получаем Access Token через Refresh Token...");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("❌ Ошибка получения access_token:", tokenData);
    return;
  }
  console.log("✅ Access token получен!");

  console.log("\n2. Проверяем запрос к Google Ads API generateKeywordIdeas (v25)...");
  const adsUrl = `https://googleads.googleapis.com/v25/customers/${customerId}:generateKeywordIdeas`;

  const adsRes = await fetch(adsUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tokenData.access_token}`,
      "developer-token": developerToken,
      "login-customer-id": managerId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "languageConstants/1031", // Russian
      geoTargetConstants: ["geoTargetConstants/2643"], // Russia
      keywordPlanNetwork: "GOOGLE_SEARCH",
      keywordSeed: {
        keywords: ["дневник с ии", "telegram", "трекер сна"],
      },
    }),
  });

  const text = await adsRes.text();
  console.log("HTTP Status:", adsRes.status);
  console.log("Raw Response:", text);
}

run();
