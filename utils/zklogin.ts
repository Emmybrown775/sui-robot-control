import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { jwtDecode } from "jwt-decode";

const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/auth/callback";
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID_GOOGLE;

export interface ZkLoginState {
  isLoggedIn: boolean;
  userAddress: string | null;
  jwt: string | null;
  salt: string | null;
  secretkey: string;
}

export const suiClient = new SuiClient({
  url: getFullnodeUrl("devnet"),
});

export function buildGoogleAuthUrl(nonce: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function verifyJWT(jwt: string) {
  try {
    const decoded = jwtDecode(jwt);
    return decoded;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}
