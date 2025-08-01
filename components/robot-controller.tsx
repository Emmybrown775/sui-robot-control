"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  MoveUpLeft,
  MoveUpRight,
  MoveDownLeft,
  MoveDownRight,
  Power,
  Wifi,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useAuth } from "@/contexts/auth-context";

const PACKAGE_ID =
  "0xfaf53bf5fdc0ddc7cc3bf0ae2d0fa29451f591064fe80559146c934861231a0d";
const ROBOT_OBJECT_ID =
  "0x801149c17022812cdeff8cc031f822f272895d5f82a2a9f8118cd7dcaacc57d1";

type Direction =
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "forward-left"
  | "forward-right"
  | "backward-left"
  | "backward-right";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type CommandState = "idle" | "executing" | "success" | "error";

interface ErrorInfo {
  message: string;
  code?: number;
  timestamp: number;
}

// Smart contract error codes mapping
const ERROR_CODES = {
  0: "Robot is not active",
  1: "Only robot owner can confirm execution",
  2: "Robot is currently being controlled by another user",
  3: "You don't have permission to end this session",
  4: "No active controller session",
  5: "You are not the current controller",
  6: "Session has expired",
} as const;

export function RobotController() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [commandState, setCommandState] = useState<CommandState>("idle");
  const [currentCommand, setCurrentCommand] = useState<Direction | null>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [sessionDuration, setSessionDuration] = useState(10);
  const [sessionEndTime, setSessionEndTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const { user, signTransaction } = useAuth();

  // Timer for session countdown
  useEffect(() => {
    if (sessionEndTime && connectionState === "connected") {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, sessionEndTime - now);
        setTimeRemaining(remaining);

        if (remaining === 0) {
          setConnectionState("disconnected");
          setSessionEndTime(null);
          setError({
            message: "Session expired",
            timestamp: now,
          });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [sessionEndTime, connectionState]);

  // Clear errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [error]);

  const handleError = (err: any, context: string) => {
    console.error(`${context} error:`, err);

    let errorMessage = "An unexpected error occurred";
    let errorCode: number | undefined;

    // Parse different error types
    if (typeof err === "string") {
      errorMessage = err;
    } else if (err?.message) {
      errorMessage = err.message;

      // Try to extract error code from abort codes
      const abortMatch = err.message.match(/abort.*?(\d+)/i);
      if (abortMatch) {
        errorCode = parseInt(abortMatch[1]);
        const knownError = ERROR_CODES[errorCode as keyof typeof ERROR_CODES];
        if (knownError) {
          errorMessage = knownError;
        }
      }
    } else if (err?.error?.message) {
      errorMessage = err.error.message;
    }

    setError({
      message: errorMessage,
      code: errorCode,
      timestamp: Date.now(),
    });

    // Reset states on error
    if (context === "connection") {
      setConnectionState("error");
    } else if (context === "command") {
      setCommandState("error");
      setCurrentCommand(null);
    }
  };

  const executeCommand = async (direction: Direction) => {
    if (connectionState !== "connected") {
      setError({
        message: "Robot not connected",
        timestamp: Date.now(),
      });
      return;
    }

    if (!user?.userAddress) {
      setError({
        message: "User not authenticated",
        timestamp: Date.now(),
      });
      return;
    }

    setCurrentCommand(direction);
    setCommandState("executing");
    setError(null);

    try {
      console.log(`Executing command: ${direction}`);

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::robot_control::move_forward`,
        arguments: [
          tx.object(ROBOT_OBJECT_ID),
          tx.object("0x6"), // Clock object
          tx.pure.string(direction),
        ],
      });

      tx.setSender(user.userAddress);
      const response = await signTransaction(tx);

      if (response) {
        setCommandState("success");
        setTimeout(() => {
          setCommandState("idle");
          setCurrentCommand(null);
        }, 1000);
      } else {
        throw new Error("Transaction failed or was rejected");
      }
    } catch (error) {
      handleError(error, "command");
      setTimeout(() => {
        setCommandState("idle");
        setCurrentCommand(null);
      }, 2000);
    }
  };

  const toggleConnection = async () => {
    if (!user?.isLoggedIn || !user?.userAddress) {
      setError({
        message: "Please login first to control the robot",
        timestamp: Date.now(),
      });
      return;
    }

    if (connectionState === "connected") {
      await disconnectRobot();
      return;
    }

    setConnectionState("connecting");
    setError(null);

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::robot_control::request_control`,
        arguments: [
          tx.object(ROBOT_OBJECT_ID),
          tx.pure.u64(sessionDuration),
          tx.object("0x6"), // Clock object
        ],
      });

      tx.setSender(user.userAddress);
      const response = await signTransaction(tx);

      if (response) {
        setConnectionState("connected");
        const endTime = Date.now() + sessionDuration * 60 * 1000;
        setSessionEndTime(endTime);
        setTimeRemaining(sessionDuration * 60 * 1000);
      } else {
        throw new Error("Connection request failed or was rejected");
      }
    } catch (error) {
      handleError(error, "connection");
      setTimeout(() => {
        setConnectionState("disconnected");
      }, 2000);
    }
  };

  const disconnectRobot = async () => {
    if (!user?.userAddress) return;

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::robot_control::end_session`,
        arguments: [
          tx.object(ROBOT_OBJECT_ID),
          tx.object("0x6"), // Clock object
        ],
      });

      tx.setSender(user.userAddress);
      await signTransaction(tx);

      setConnectionState("disconnected");
      setSessionEndTime(null);
      setTimeRemaining(null);
    } catch (error) {
      handleError(error, "disconnection");
    }
  };

  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getConnectionColor = () => {
    switch (connectionState) {
      case "connected":
        return "default";
      case "connecting":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getConnectionIcon = () => {
    switch (connectionState) {
      case "connected":
        return <CheckCircle className="w-3 h-3 mr-1" />;
      case "connecting":
        return <Loader2 className="w-3 h-3 mr-1 animate-spin" />;
      case "error":
        return <XCircle className="w-3 h-3 mr-1" />;
      default:
        return <Wifi className="w-3 h-3 mr-1" />;
    }
  };

  const getConnectionText = () => {
    switch (connectionState) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  const controlButtons = [
    {
      direction: "forward-left" as Direction,
      icon: MoveUpLeft,
      position: "row-start-1 col-start-1",
    },
    {
      direction: "forward" as Direction,
      icon: ArrowUp,
      position: "row-start-1 col-start-2",
    },
    {
      direction: "forward-right" as Direction,
      icon: MoveUpRight,
      position: "row-start-1 col-start-3",
    },
    {
      direction: "left" as Direction,
      icon: ArrowLeft,
      position: "row-start-2 col-start-1",
    },
    {
      direction: "right" as Direction,
      icon: ArrowRight,
      position: "row-start-2 col-start-3",
    },
    {
      direction: "backward-left" as Direction,
      icon: MoveDownLeft,
      position: "row-start-3 col-start-1",
    },
    {
      direction: "backward" as Direction,
      icon: ArrowDown,
      position: "row-start-3 col-start-2",
    },
    {
      direction: "backward-right" as Direction,
      icon: MoveDownRight,
      position: "row-start-3 col-start-3",
    },
  ];

  const isControlsDisabled =
    connectionState !== "connected" ||
    commandState === "executing" ||
    !user?.isLoggedIn;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Power className="w-5 h-5" />
              Control Ebuka
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={getConnectionColor()}>
                {getConnectionIcon()}
                {getConnectionText()}
              </Badge>
              {timeRemaining && connectionState === "connected" && (
                <Badge variant="outline" className="text-xs">
                  {formatTimeRemaining(timeRemaining)}
                </Badge>
              )}
              <Button
                variant={
                  connectionState === "connected" ? "destructive" : "default"
                }
                size="sm"
                onClick={toggleConnection}
                disabled={!user?.isLoggedIn || connectionState === "connecting"}
              >
                {connectionState === "connecting" && (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                )}
                {connectionState === "connected" ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-3 p-4 border border-red-200 bg-red-50 rounded-lg text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="font-medium">{error.message}</span>
                  {error.code && (
                    <span className="ml-2 text-xs opacity-75">
                      (Code: {error.code})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Auth Warning */}
            {!user?.isLoggedIn && (
              <div className="flex items-center gap-3 p-4 border border-amber-200 bg-amber-50 rounded-lg text-amber-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span>Please login first to control the robot</span>
              </div>
            )}

            {/* Status Display */}
            <div className="text-center">
              {commandState === "executing" && currentCommand && (
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Executing: {currentCommand.replace("-", " ").toUpperCase()}
                </div>
              )}
              {commandState === "success" && currentCommand && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Command executed successfully
                </div>
              )}
              {commandState === "idle" && connectionState === "connected" && (
                <div className="text-sm text-gray-500">
                  Robot ready for commands
                </div>
              )}
              {connectionState === "disconnected" && user?.isLoggedIn && (
                <div className="text-sm text-red-500">
                  Connect robot to enable controls
                </div>
              )}
            </div>

            {/* Control Grid */}
            <div className="flex justify-center">
              <div className="grid grid-cols-3 grid-rows-3 gap-3 w-fit">
                {controlButtons.map(({ direction, icon: Icon, position }) => (
                  <Button
                    key={direction}
                    variant={
                      currentCommand === direction &&
                      commandState === "executing"
                        ? "default"
                        : commandState === "success" &&
                            currentCommand === direction
                          ? "default"
                          : "outline"
                    }
                    size="lg"
                    className={`w-16 h-16 ${position} ${
                      commandState === "success" && currentCommand === direction
                        ? "border-green-500 bg-green-50"
                        : ""
                    }`}
                    onClick={() => executeCommand(direction)}
                    disabled={isControlsDisabled}
                  >
                    {commandState === "executing" &&
                    currentCommand === direction ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : commandState === "success" &&
                      currentCommand === direction ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </Button>
                ))}

                {/* Center stop button */}
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-16 h-16 row-start-2 col-start-2"
                  disabled={isControlsDisabled}
                  onClick={() => {
                    setCurrentCommand(null);
                    setCommandState("idle");
                    console.log("Stop command sent");
                  }}
                >
                  <Power className="w-6 h-6" />
                </Button>
              </div>
            </div>

            {/* Session Info */}
            {connectionState === "connected" && timeRemaining && (
              <div className="text-center text-sm text-gray-600">
                Session time remaining: {formatTimeRemaining(timeRemaining)}
              </div>
            )}

            {/* Command Legend */}
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
              <div>
                <div className="font-medium mb-2">Movement Controls:</div>
                <ul className="space-y-1">
                  <li>↑ Forward</li>
                  <li>↓ Backward</li>
                  <li>← Left</li>
                  <li>→ Right</li>
                </ul>
              </div>
              <div>
                <div className="font-medium mb-2">Diagonal Controls:</div>
                <ul className="space-y-1">
                  <li>↖ Forward Left</li>
                  <li>↗ Forward Right</li>
                  <li>↙ Backward Left</li>
                  <li>↘ Backward Right</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
