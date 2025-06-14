"use client";

import { RobotController } from "@/components/robot-controller";
import { WalletInfo } from "@/components/wallet-info";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function ControlPage() {
  const handleLogout = () => {
    // TODO: Implement logout logic
    console.log("Logout clicked");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              {"Ebuka's Control Dashboard"}
            </h1>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <WalletInfo />
          </div>
          <div className="lg:col-span-2">
            <RobotController />
          </div>
        </div>
      </main>
    </div>
  );
}
