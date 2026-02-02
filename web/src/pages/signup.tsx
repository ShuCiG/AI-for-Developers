import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"

export default function SignUpPage({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [userExists, setUserExists] = useState<boolean>(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPasswordError(null)
    setUserExists(false)

    // Validate passwords match
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters long")
      return
    }

    setLoading(true)

    try {
      // First, check if user already exists
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      // If sign in is successful, user exists
      if (!signInError && signInData.user) {
        await supabase.auth.signOut() // Sign out immediately after checking
        setUserExists(true)
        return
      }

      // If user doesn't exist, proceed with sign up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        // Check if error indicates user already exists
        if (signUpError.message.includes('already registered') || 
            signUpError.message.includes('already in use')) {
          setUserExists(true)
        } else {
          setError(signUpError.message)
        }
        return
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.identities && data.user.identities.length === 0) {
          setUserExists(true)
        } else {
          // Success! Navigate to dashboard
          navigate("/")
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      console.error("Sign up error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 min-w-[450px]", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <FieldDescription>
                  Must be at least 6 characters long
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  Confirm Password
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                {passwordError && (
                  <FieldError>{passwordError}</FieldError>
                )}
              </Field>
              {error && (
                <FieldError>{error}</FieldError>
              )}
              {userExists && (
                <div className="p-3 mb-4 text-sm bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="font-medium text-yellow-800">Account already exists</p>
                  <p className="text-yellow-700">An account with this email already exists. Please log in instead.</p>
                </div>
              )}
              <Field>
                <Button type="submit" disabled={loading || userExists}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
                
                {userExists ? (
                  <div className="mt-2">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => navigate("/auth/login", { state: { email, redirectToLogin: true } })}
                      className="w-full"
                    >
                      Go to Login
                    </Button>
                  </div>
                ) : (
                  <FieldDescription className="text-center">
                    Already have an account?{" "}
                    <a href="/auth/login" className="underline">
                      Login
                    </a>
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
