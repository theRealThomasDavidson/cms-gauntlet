import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"

export default function AuthComponent() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          setError(signUpError.message)
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message)
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
  }

  const handleGitHubSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github'
    })

    if (error) {
      setError(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {!session ? (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="text-sm text-red-500">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full">
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGitHubSignIn}
              >
                Continue with GitHub
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center mb-4">Signed in as {session.user.email}</p>
            <Button onClick={handleSignOut} variant="destructive">
              Sign Out
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}