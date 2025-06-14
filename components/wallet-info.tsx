"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Wallet, DollarSign, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";

export function WalletInfo() {
  const { user, balance, refreshBalance } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Add toast notification
    console.log("Copied to clipboard:", text);
  };

  const formatAddress = (address: string) => {
    if (!address) return "Not connected";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance: string | number) => {
    if (!balance) return "0.00";
    return Number.parseFloat(balance.toString()).toFixed(4);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshBalance();
    } catch (error) {
      console.error("Failed to refresh balance:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Wallet Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Status</label>
            <div className="mt-1">
              <Badge variant={user?.userAddress ? "default" : "secondary"}>
                {user?.userAddress ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">
              Wallet Address
            </label>
            <div className="mt-1 flex items-center gap-2">
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                {formatAddress(user?.userAddress || "")}
              </code>
              {user?.userAddress && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(user.userAddress || "")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Balance</label>
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-lg font-semibold">
                  {formatBalance(balance || 0)} SUI
                </span>
              </div>
              {user?.userAddress && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                </Button>
              )}
            </div>
          </div>

          {user && (
            <div>
              <label className="text-sm font-medium text-gray-500">
                Connected Account
              </label>
              <div className="mt-1">
                <div className="text-sm">A sui guy</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
