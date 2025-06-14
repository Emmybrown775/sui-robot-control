"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { Chrome } from "lucide-react"

export function LoginForm() {
  const { login, isLoading } = useAuth()

  const handleGoogleLogin = async () => {
    try {
      await login()
    } catch (error) {
      console.error("Login failed:", error)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Sign in</CardTitle>
        <CardDescription className="text-center">
          Connect your Google account to access the Sui blockchain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2"
          size="lg"
        >
          <Chrome className="w-5 h-5" />
          {isLoading ? "Connecting..." : "Continue with Google"}
        </Button>

        <div className="text-xs text-gray-500 text-center">
          By signing in, you agree to connect your Google account with the Sui blockchain network
        </div>
      </CardContent>
    </Card>
  )
}
