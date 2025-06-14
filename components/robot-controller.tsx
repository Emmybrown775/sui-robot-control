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
} from "lucide-react";
import { useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useAuth } from "@/contexts/auth-context";

const PACKAGE_ID =
  "0x8130346dd1589dde5f94692a4abaafcef082e502cb66e31360d88b590527f5c1";
const ROBOT_OBJECT_ID =
  "0x83a90af8bcff4571f342ae76843b9fc889f5f682dd91ca418193ec8332a191f2";

type Direction =
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "forward-left"
  | "forward-right"
  | "backward-left"
  | "backward-right";

export function RobotController() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentCommand, setCurrentCommand] = useState<Direction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const { user, signTransaction } = useAuth();

  const executeCommand = async (direction: Direction) => {
    if (!isConnected) {
      console.log("Robot not connected");
      return;
    }

    setCurrentCommand(direction);
    setIsExecuting(true);

    try {
      // TODO: Implement actual robot control logic

      if (!user || !user!.userAddress) return;
      console.log(`Executing command: ${direction}`);

      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::robot_control::move_forward`,
        arguments: [
          tx.object(ROBOT_OBJECT_ID),
          tx.object("0x6"),

          tx.pure.string(direction),
        ],
      });

      tx.setSender(user.userAddress);

      signTransaction(tx);
    } catch (error) {
      console.error("Command execution failed:", error);
    } finally {
      setIsExecuting(false);
      setCurrentCommand(null);
    }
  };

  const toggleConnection = async () => {
    if (!user || !user.isLoggedIn) {
      console.error("User not logged in");
      return;
    }

    if (isConnected) return;

    const tx = new Transaction();

    console.log("User address:", user.userAddress);
    console.log(
      "Ephemeral keypair address:",
      user.ephemeralKeyPair?.toSuiAddress(),
    );

    tx.moveCall({
      target: `${PACKAGE_ID}::robot_control::request_control`,
      arguments: [
        tx.object(ROBOT_OBJECT_ID),
        tx.pure.u64(10),
        tx.object("0x6"),
      ],
    });

    const response = await signTransaction(tx);

    if (response) setIsConnected(true);
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
              <Badge variant={isConnected ? "default" : "secondary"}>
                <Wifi className="w-3 h-3 mr-1" />
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Button
                variant={isConnected ? "destructive" : "default"}
                size="sm"
                onClick={toggleConnection}
                disabled={!user?.isLoggedIn}
              >
                {isConnected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </div>
          {!user?.isLoggedIn && (
            <div className="text-sm text-amber-600">
              Please login first to control the robot
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Status Display */}
            <div className="text-center">
              {currentCommand && (
                <div className="text-sm text-blue-600 font-medium">
                  Executing: {currentCommand.replace("-", " ").toUpperCase()}
                </div>
              )}
              {!currentCommand && isConnected && (
                <div className="text-sm text-gray-500">
                  Robot ready for commands
                </div>
              )}
              {!isConnected && user?.isLoggedIn && (
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
                      currentCommand === direction ? "default" : "outline"
                    }
                    size="lg"
                    className={`w-16 h-16 ${position}`}
                    onClick={() => executeCommand(direction)}
                    disabled={!isConnected || isExecuting || !user?.isLoggedIn}
                  >
                    <Icon className="w-6 h-6" />
                  </Button>
                ))}

                {/* Center stop button */}
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-16 h-16 row-start-2 col-start-2"
                  disabled={!isConnected || !user?.isLoggedIn}
                  onClick={() => {
                    setCurrentCommand(null);
                    console.log("Stop command sent");
                  }}
                >
                  <Power className="w-6 h-6" />
                </Button>
              </div>
            </div>

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
