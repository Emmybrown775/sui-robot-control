"use client";

import { Transaction } from "@mysten/sui/transactions";
import { buildGoogleAuthUrl, suiClient } from "../utils/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  genAddressSeed,
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
} from "@mysten/sui/zklogin";
import { jwtDecode } from "jwt-decode";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface User {
  isLoggedIn: boolean;
  userAddress: string | null;
  jwt: string | null;
  salt: string | null;
  ephemeralKeyPair: Ed25519Keypair | null;
  maxEpoch: number | null;
  randomness: string | null;
  sub: string | null;
  aud: string | null;
  iss: string | null; // Added missing iss parameter
}

interface AuthContextType {
  user: User | null;
  balance: string | number | null;
  isLoading: boolean;
  login: () => Promise<void>;
  completeLogin: (jwt: string) => Promise<void>;
  refreshBalance: () => Promise<void>;
  logout: () => void;
  signTransaction: (tx: Transaction) => Promise<boolean>;
}

export type PartialZkLoginSignature = Omit<
  Parameters<typeof getZkLoginSignature>["0"]["inputs"],
  "addressSeed"
>;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({
    isLoggedIn: false,
    userAddress: null,
    jwt: null,
    salt: null,
    maxEpoch: null,
    randomness: null,
    sub: null,
    aud: null,
    iss: null, // Added iss
    ephemeralKeyPair: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<string | number | null>(null);

  useEffect(() => {
    if (user.userAddress) {
      refreshBalance();
    }
  }, [user.userAddress]);

  useEffect(() => {
    const session = localStorage.getItem("zklogin-session");
    if (session) {
      const {
        userAddress,
        jwt,
        salt,
        maxEpoch,
        randomness,
        secretKey,
        sub,
        aud,
        iss, // Added iss
      } = JSON.parse(session);
      setUser({
        isLoggedIn: true,
        userAddress,
        jwt,
        salt,
        ephemeralKeyPair: secretKey
          ? Ed25519Keypair.fromSecretKey(secretKey)
          : null,
        maxEpoch,
        randomness,
        sub,
        aud,
        iss, // Added iss
      });
    }
  }, []);

  function parseJwt(jwt: string) {
    const jsonPayload = jwtDecode(jwt);
    return jsonPayload;
  }

  const login = useCallback(async () => {
    setIsLoading(true);
    console.log("Initiate Login....");
    try {
      const ephemeralKeyPair = new Ed25519Keypair();

      const { epoch } = await suiClient.getLatestSuiSystemState();
      const maxEpoch = Number(epoch) + 10;

      const randomness = generateRandomness();
      // Don't generate salt here - it should be consistent per user

      const nonce = generateNonce(
        ephemeralKeyPair.getPublicKey(),
        maxEpoch,
        randomness,
      );

      // Store in localStorage instead of sessionStorage for persistence
      localStorage.setItem(
        "ephemeral-keypair",
        JSON.stringify({
          privateKey: ephemeralKeyPair.getSecretKey(),
          publicKey: ephemeralKeyPair.getPublicKey(),
        }),
      );
      localStorage.setItem("randomness", randomness);
      localStorage.setItem("max-epoch", maxEpoch.toString());

      console.log("randomness", randomness);
      console.log("maxEpoch", maxEpoch);
      console.log("nonce", nonce);

      const authUrl = buildGoogleAuthUrl(nonce);
      window.location.href = authUrl;
    } catch (error) {
      console.error("Login initiation failed:", error);
    }
    setIsLoading(false);
  }, []);

  const completeLogin = useCallback(async (jwt: string) => {
    try {
      // Parse JWT to get user ID (sub), audience (aud), and issuer (iss)
      const payload = parseJwt(jwt);
      const userId = payload.sub;
      const aud = payload.aud;
      const iss = payload.iss; // Get issuer from JWT

      console.log("JWT Payload:", { sub: userId, aud, iss });

      const randomness = localStorage.getItem("randomness");
      const maxEpoch = localStorage.getItem("max-epoch");

      if (!randomness || !maxEpoch) {
        throw new Error("Missing critical login parameters");
      }

      // Get or generate persistent salt per user
      const storageKey = `zklogin-salt-${userId}`;
      let salt = localStorage.getItem(storageKey);

      if (!salt) {
        salt = generateRandomness();
        localStorage.setItem(storageKey, salt);
        console.log("Generated new salt for user:", userId);
      } else {
        console.log("Using existing salt for user:", userId);
      }

      // Generate user address using the salt
      const userAddress = jwtToAddress(jwt, salt);
      console.log("Generated address:", userAddress);

      const ephemeralData = JSON.parse(
        localStorage.getItem("ephemeral-keypair") || "{}",
      );

      if (!ephemeralData.privateKey) {
        throw new Error("Missing ephemeral data");
      }

      const keypair = Ed25519Keypair.fromSecretKey(ephemeralData.privateKey);

      const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";

      const requestPayload = {
        jwt: jwt,
        extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(
          keypair.getPublicKey(),
        ),
        maxEpoch: maxEpoch,
        jwtRandomness: randomness,
        salt: salt,
        keyClaimName: "sub",
      };

      console.log("Prover request payload:", requestPayload);

      const proofResponse = await fetch(PROVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `Prover request failed: ${response.status} ${errorText}`,
            );
          }
          return await response.json();
        })
        .catch((error) => {
          console.error("Prover error:", error);
          throw new Error(`Prover service error: ${error.message}`);
        });

      console.log("Proof response:", proofResponse);

      localStorage.setItem(
        "partialZkloginSignature",
        JSON.stringify(proofResponse),
      );

      const sessionData = {
        userAddress,
        jwt,
        salt,
        randomness,
        maxEpoch: Number(maxEpoch),
        secretKey: keypair.getSecretKey(),
        sub: userId,
        aud: aud?.toString(),
        iss: iss?.toString(), // Store issuer
      };

      localStorage.setItem("zklogin-session", JSON.stringify(sessionData));

      setUser({
        isLoggedIn: true,
        userAddress,
        jwt,
        salt,
        randomness,
        maxEpoch: Number(maxEpoch),
        ephemeralKeyPair: keypair,
        sub: userId || "",
        aud: aud?.toString() || "",
        iss: iss?.toString() || "", // Set issuer
      });

      // Clean up temporary storage
      localStorage.removeItem("ephemeral-keypair");
      localStorage.removeItem("randomness");
      localStorage.removeItem("max-epoch");
    } catch (error) {
      console.error("Login completion failed:", error);
      throw error; // Re-throw to handle in calling component
    }
  }, []);

  const refreshBalance = async () => {
    if (!user.userAddress) return;
    try {
      const newBalance = suiClient.getBalance({
        owner: user.userAddress,
        coinType: "0x2::sui::SUI",
      });
      setBalance(parseInt((await newBalance).totalBalance) / 1000000000);
    } catch (error) {
      console.error("Failed to refresh balance:", error);
    }
  };

  const logout = useCallback(() => {
    setUser({
      isLoggedIn: false,
      userAddress: null,
      jwt: null,
      salt: null,
      ephemeralKeyPair: null,
      maxEpoch: null,
      randomness: null,
      aud: null,
      sub: null,
      iss: null, // Reset iss
    });
    localStorage.removeItem("zklogin-session");
    localStorage.removeItem("partialZkloginSignature");
  }, []);

  const signTransaction = async (tx: Transaction): Promise<boolean> => {
    try {
      tx.setSender(user.userAddress || "");

      const partialZkloginUnknown = JSON.parse(
        localStorage.getItem("partialZkloginSignature") || "{}",
      ) as unknown;
      const partialZkloginSignature =
        partialZkloginUnknown as PartialZkLoginSignature;

      if (
        !partialZkloginSignature ||
        Object.keys(partialZkloginSignature).length === 0
      ) {
        throw new Error("Missing partial zkLogin signature");
      }

      if (!user.ephemeralKeyPair) {
        throw new Error("Ephemeral keypair not available");
      }

      const { bytes, signature: userSignature } = await tx.sign({
        client: suiClient,
        signer: user.ephemeralKeyPair,
      });

      console.log("Transaction signed with ephemeral key");
      console.log("User data:", {
        salt: user.salt,
        sub: user.sub,
        aud: user.aud,
        iss: user.iss,
      });

      if (!user.salt || !user.sub || !user.aud) {
        throw new Error(
          "Missing required user parameters for address seed generation",
        );
      }

      const addressSeed = genAddressSeed(
        BigInt(user.salt),
        "sub", // keyClaimName
        user.sub,
        user.aud,
      ).toString();

      console.log("Generated address seed:", addressSeed);

      const zkLoginSignature = getZkLoginSignature({
        inputs: {
          ...partialZkloginSignature,
          addressSeed,
        },
        maxEpoch: user.maxEpoch || 0,
        userSignature,
      });

      console.log("zkLogin signature generated successfully");

      const result = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
      });

      console.log("Transaction executed successfully:", result);
      return true;
    } catch (error) {
      console.error("Transaction failed:", error);

      // Handle different types of errors
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });

        // Check for MoveAbort error (from Sui Move assertions)
        const moveAbortMatch = error.message.match(/MoveAbort\(.+?,\s*(\d+)\)/);
        if (moveAbortMatch) {
          const errorCode = parseInt(moveAbortMatch[1]);
          console.error("Move assertion failed with code:", errorCode);

          switch (errorCode) {
            case 4:
              console.error("No controller set for the robot.");
              break;
            case 5:
              console.error("Caller is not the robot's controller.");
              break;
            case 6:
              console.error("Control session has expired.");
              break;
            default:
              console.error("Unknown Move abort code:", errorCode);
          }
        }
      }

      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        balance,
        login,
        completeLogin,
        refreshBalance,
        logout,
        signTransaction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
