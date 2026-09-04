import path from "node:path";
import { OAuth2Client } from "google-auth-library";

const DEFAULT_TOKEN_PATH = path.resolve(process.cwd(), "config/google/google-oauth-token.json");
const DEFAULT_CREDENTIALS_PATH = path.resolve(
  process.cwd(),
  "config/google/google-oauth-credentials.json",
);

let cachedClient: OAuth2Client | null = null;

interface OAuthCredentialsJson {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
  };
}

interface OAuthTokensJson {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

export async function getOAuthClient(): Promise<OAuth2Client> {
  if (cachedClient) return cachedClient;

  const credsPath = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH ?? DEFAULT_CREDENTIALS_PATH;
  const tokenPath = process.env.GOOGLE_OAUTH_TOKEN_PATH ?? DEFAULT_TOKEN_PATH;

  let credsJson: OAuthCredentialsJson;
  try {
    credsJson = (await Bun.file(credsPath).json()) as OAuthCredentialsJson;
  } catch {
    throw new Error(
      `Google OAuth credentials not found at ${credsPath}. Ensure config/google/google-oauth-credentials.json exists.`,
    );
  }

  const clientInfo = credsJson.installed ?? credsJson.web;
  if (!clientInfo?.client_id || !clientInfo?.client_secret) {
    throw new Error(`Invalid OAuth credentials format in ${credsPath}`);
  }

  const client = new OAuth2Client({
    clientId: clientInfo.client_id,
    clientSecret: clientInfo.client_secret,
    redirectUri: clientInfo.redirect_uris?.[0] ?? "http://localhost",
  });

  let tokens: OAuthTokensJson;
  try {
    tokens = (await Bun.file(tokenPath).json()) as OAuthTokensJson;
  } catch {
    throw new Error(
      `Google OAuth tokens not found at ${tokenPath}. Ensure config/google/google-oauth-token.json exists.`,
    );
  }

  if (!tokens.refresh_token) {
    throw new Error(`Google OAuth tokens at ${tokenPath} do not contain a refresh_token.`);
  }

  client.setCredentials(tokens);

  // Auto-save refreshed tokens back to disk if refreshed
  client.on("tokens", async (newTokens) => {
    try {
      const merged = { ...tokens, ...newTokens };
      await Bun.write(tokenPath, JSON.stringify(merged, null, 2));
    } catch {
      // Ignore token write failures
    }
  });

  cachedClient = client;
  return client;
}

/**
 * Returns a valid Bearer access token, automatically refreshing it if expired.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const client = await getOAuthClient();
  const res = await client.getAccessToken();
  if (!res.token) {
    throw new Error("Failed to retrieve Google access token via OAuth client.");
  }
  return res.token;
}
