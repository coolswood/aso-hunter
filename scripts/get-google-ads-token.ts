import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

/**
 * Helper script to obtain a Google Ads API Refresh Token.
 * Run via: bun scripts/get-google-ads-token.ts
 */

const envPath = resolve(process.cwd(), ".env");
let envContent = "";
try {
  envContent = readFileSync(envPath, "utf-8");
} catch {
  // .env might not exist yet
}

function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=["']?([^"'\n]+)["']?`, "m"));
  return match ? match[1].trim() : (process.env[name] ?? "");
}

const clientId = getEnvVar("GOOGLE_ADS_CLIENT_ID");
const clientSecret = getEnvVar("GOOGLE_ADS_CLIENT_SECRET");

if (!clientId || !clientSecret) {
  console.error(
    "❌ Ошибка: В файле .env отсутствуют GOOGLE_ADS_CLIENT_ID или GOOGLE_ADS_CLIENT_SECRET.",
  );
  console.log("Пожалуйста, сначала укажите их в .env и запустите скрипт снова.");
  process.exit(1);
}

const PORT = 8085;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/adwords";

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(clientId)}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(SCOPE)}&` +
  `access_type=offline&` +
  `prompt=consent`;

console.log("\n=======================================================");
console.log("🔑 АВТОРИЗАЦИЯ GOOGLE ADS API");
console.log("=======================================================\n");
console.log("1. Откройте следующую ссылку в браузере под аккаунтом Google Ads:\n");
console.log(authUrl);
console.log("\n2. Нажмите «Продолжить» / «Разрешить доступ».");
console.log("3. Скрипт ожидает ответ на http://localhost:8085/oauth2callback ...\n");

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/oauth2callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(`<h1>Ошибка авторизации: ${error}</h1>`, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (!code) {
        return new Response(`<h1>Код авторизации не получен</h1>`, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Exchange authorization code for tokens
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: "authorization_code",
          }),
        });

        const tokenData = (await tokenRes.json()) as {
          refresh_token?: string;
          access_token?: string;
          error?: string;
          error_description?: string;
        };

        if (tokenData.error || !tokenData.refresh_token) {
          console.error("❌ Ошибка обмена токена:", tokenData);
          return new Response(
            `<h1>Ошибка получения Refresh Token:</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }

        const refreshToken = tokenData.refresh_token;

        // Automatically update .env
        let updatedEnv = envContent;
        if (updatedEnv.includes("GOOGLE_ADS_REFRESH_TOKEN=")) {
          updatedEnv = updatedEnv.replace(
            /GOOGLE_ADS_REFRESH_TOKEN=["']?[^"'\n]*["']?/,
            `GOOGLE_ADS_REFRESH_TOKEN="${refreshToken}"`,
          );
        } else {
          updatedEnv += `\nGOOGLE_ADS_REFRESH_TOKEN="${refreshToken}"\n`;
        }

        writeFileSync(envPath, updatedEnv, "utf-8");

        console.log("✅ УСПЕХ! Refresh Token получен и автоматически сохранен в .env:");
        console.log(`GOOGLE_ADS_REFRESH_TOKEN="${refreshToken}"\n`);

        setTimeout(() => {
          server.stop();
          process.exit(0);
        }, 1000);

        return new Response(
          `<h1>✅ Авторизация успешна!</h1><p>Refresh Token сохранен в ваш файл .env. Можете закрыть эту вкладку и вернуться в терминал.</p>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      } catch (err) {
        console.error("❌ Ошибка при запросе токена:", err);
        return new Response(`<h1>Внутренняя ошибка сервера: ${String(err)}</h1>`, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});
