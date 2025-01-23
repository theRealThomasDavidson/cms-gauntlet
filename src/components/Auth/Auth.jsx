import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
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
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
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
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(getErrorMessage(error))
      }
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignUp = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            username,
            name
          }
        }
      })
      
      if (error) {
        setError(getErrorMessage(error))
      } else {
        // Update the profile with username and name
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ username, name })
          .eq('auth_id', data.user.id)

        if (profileError) {
          setError(getErrorMessage(profileError))
        } else {
          setError('Check your email for the confirmation link.')
        }
      }
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGitHubSignIn = async () => {
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github'
      })
      if (error) {
        setError(getErrorMessage(error))
      }
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
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
            {isSignUp && (
              <>
                <div>
                  <Label htmlFor="username" className="auth-label">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={isSignUp}
                    className="auth-input"
                  />
                </div>
                <div>
                  <Label htmlFor="name" className="auth-label">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isSignUp}
                    className="auth-input"
                  />
                </div>
              </>
            )}
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
              <Button 
                type="submit"
                className="auth-button"
                disabled={loading}
              >
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  if (!isSignUp) {
                    setUsername('')
                    setName('')
                  }
                }}
                className="auth-link"
                disabled={loading}
              >
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 