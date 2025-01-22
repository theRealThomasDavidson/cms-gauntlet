import { useEffect, useState } from 'react'
import { auth } from '../../lib/api'
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useNavigate } from 'react-router-dom'
import './Auth.css'

export default function AuthComponent() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const { data: { subscription } } = auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  const getErrorMessage = (error) => {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Incorrect email or password'
      case 'Email not confirmed':
        return 'Please confirm your email address'
      case 'User already registered':
        return 'An account with this email already exists'
      case 'Password should be at least 6 characters':
        return 'Password must be at least 6 characters long'
      default:
        return error.message
    }
  }

  const handleEmailSignIn = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await auth.signIn({ email, password })
      if (error) {
        setError(getErrorMessage(error))
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    }
    setLoading(false)
  }

  const handleEmailSignUp = async (e) => {
    e.preventDefault()
    setError(null)
    
    // Basic validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }
    
    setLoading(true)
    try {
      const { data, error } = await auth.signUp({ email, password })
      if (error) {
        setError(getErrorMessage(error))
      } else if (data?.user) {
        console.log('Signup successful:', data)
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    }
    setLoading(false)
  }

  const handleGitHubSignIn = async () => {
    const { error } = await auth.signInWithOAuth({
      provider: 'github'
    })
    if (error) console.log('Error:', error.message)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="auth-container">
        <CardHeader>
          <CardTitle className="text-center">
            Welcome to AutoCRM
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'Create your account' : 'Sign in to manage your tickets'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          <Button 
            variant="outline" 
            className="auth-button" 
            onClick={handleGitHubSignIn}
          >
            Continue with GitHub
          </Button>
          
          <div className="auth-divider" />

          <form onSubmit={isSignUp ? handleEmailSignUp : handleEmailSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email" className="auth-label">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="auth-input"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="auth-label">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="auth-input"
              />
            </div>

            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:underline"
              >
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              </button>
              <button
                type="button"
                className="text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="auth-button">
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 