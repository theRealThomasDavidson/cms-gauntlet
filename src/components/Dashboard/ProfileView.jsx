import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Pencil, Save, X, Plus, UserPlus, Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

export default function ProfileView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allProfiles, setAllProfiles] = useState([])
  const [editingProfile, setEditingProfile] = useState(null)
  const [expandedProfile, setExpandedProfile] = useState(null)
  const [editForm, setEditForm] = useState({
    username: '',
    name: '',
    email: ''
  })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    email: '',
    username: '',
    name: '',
    password: ''
  })
  const [createError, setCreateError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const ITEMS_PER_PAGE = 5
  const [isFirstSignIn, setIsFirstSignIn] = useState(false)
  const [initialSetupForm, setInitialSetupForm] = useState({
    username: '',
    name: '',
    email: ''
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Get user's profile
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', user.id)
        .single()

      // If no profile exists, create one with default values
      if (profileError && (profileError.message.includes('returned no rows') || profileError.code === 'PGRST116')) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([
            {
              auth_id: user.id,
              email: user.email,
              username: user.email,  // Default to email
              name: user.email,      // Default to email
              preferences: {
                notifications: true,
                theme: 'light'
              }
            }
          ])
          .select()
          .single()

        if (createError) throw createError
        profile = newProfile
        setIsFirstSignIn(true)  // Trigger first-time setup
        setInitialSetupForm({
          username: user.email.split('@')[0],  // Default username from email
          name: '',
          email: user.email
        })
      } else if (profileError) {
        throw profileError
      } else if (profile.username === profile.email || profile.name === profile.email) {
        // If username or name matches email, also consider it first sign in
        setIsFirstSignIn(true)
        setInitialSetupForm({
          username: user.email.split('@')[0],
          name: '',
          email: user.email
        })
      }

      setProfile(profile)
      setIsAdmin(profile.role === 'admin')

      // If admin, load paginated profiles
      if (profile.role === 'admin') {
        await loadProfiles()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadProfiles = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })

      // Add search if query exists
      if (searchQuery) {
        query = query.or(`username.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      }

      // Get total count first
      const { count } = await query
      setTotalPages(Math.ceil(count / ITEMS_PER_PAGE))

      // Then get paginated results
      const { data: profiles, error } = await query
        .order('created_at', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1)

      if (error) throw error
      setAllProfiles(profiles)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      const timer = setTimeout(() => {
        setPage(0) // Reset to first page on new search
        loadProfiles()
      }, 300) // Debounce search

      return () => clearTimeout(timer)
    }
  }, [searchQuery])

  useEffect(() => {
    if (isAdmin) {
      loadProfiles()
    }
  }, [page])

  const handleRoleChange = async (email, newRole) => {
    try {
      const { error } = await supabase.rpc('change_role', { 
        user_email: email,
        new_role: newRole
      })
      if (error) throw error
      await loadProfile() // Reload profiles
    } catch (err) {
      setError(err.message)
    }
  }

  const handleStartEdit = (profile) => {
    setEditingProfile(profile.id)
    setEditForm({
      username: profile.username,
      name: profile.name,
      email: profile.email
    })
  }

  const handleCancelEdit = () => {
    setEditingProfile(null)
    setEditForm({
      username: '',
      name: '',
      email: ''
    })
  }

  const handleSaveEdit = async (profileId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: editForm.username,
          name: editForm.name,
          email: editForm.email
        })
        .eq('id', profileId)

      if (error) throw error
      
      await loadProfile() // Reload all profiles
      handleCancelEdit()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCreateProfile = async (e) => {
    e.preventDefault()
    setCreateError(null)
    
    try {
      // First create the auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: createForm.email,
        password: createForm.password,
        email_confirm: true
      })

      if (authError) throw authError

      // Then create their profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            auth_id: authData.user.id,
            email: createForm.email,
            username: createForm.username,
            name: createForm.name
          }
        ])

      if (profileError) throw profileError

      // Reset form and reload profiles
      setCreateForm({
        email: '',
        username: '',
        name: '',
        password: ''
      })
      setShowCreateForm(false)
      await loadProfile()
    } catch (err) {
      setCreateError(err.message)
    }
  }

  const handleDeleteUser = async (profileId, email) => {
    try {
      // Check if user is deleting themselves
      const { data: { user } } = await supabase.auth.getUser()
      const isSelfDelete = user.email === email

      // Call the delete_user function
      const { data, error } = await supabase.rpc('delete_user', {
        target_email: email
      })

      if (error) throw error
      if (!data.success) throw new Error(data.message)

      // Show success message
      setError(null)
      
      if (isSelfDelete) {
        // If deleting self, sign out and redirect
        await supabase.auth.signOut()
        window.location.href = '/login'
      } else {
        // If admin deleting someone else, just refresh the list
        await loadProfile()
      }

      setDeleteConfirm(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleInitialSetup = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: initialSetupForm.username,
          name: initialSetupForm.name,
        })
        .eq('auth_id', profile.auth_id)

      if (error) throw error
      
      setIsFirstSignIn(false)
      await loadProfile()
    } catch (err) {
      setError(err.message)
    }
  }

  const renderProfileCard = (p) => {
    const isEditing = editingProfile === p.id
    const isExpanded = expandedProfile === p.id

    return (
      <div key={p.id} className="border p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                <strong>{p.username}</strong>
                {!isExpanded && <span className="text-gray-500 ml-2">({p.email})</span>}
              </div>
              {p.role !== 'admin' && isAdmin ? (
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={p.role}
                  onChange={(e) => handleRoleChange(p.email, e.target.value)}
                >
                  <option value="customer">Customer</option>
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className="px-2 py-1 text-sm bg-gray-100 rounded">
                  {p.role}
                </span>
              )}
            </div>
          </div>
          <div className="space-x-2 flex items-center">
            <Button
              onClick={() => setExpandedProfile(isExpanded ? null : p.id)}
              variant="ghost"
              size="sm"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
            {!isEditing && (
              <>
                {deleteConfirm === p.id ? (
                  <>
                    <Button 
                      onClick={() => handleDeleteUser(p.id, p.email)}
                      variant="destructive"
                      size="sm"
                    >
                      Confirm Delete
                    </Button>
                    <Button 
                      onClick={() => setDeleteConfirm(null)}
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      onClick={() => handleStartEdit(p)}
                      variant="outline"
                      size="sm"
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      onClick={() => setDeleteConfirm(p.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Expanded or editing view */}
        {(isExpanded || isEditing) && (
          <div className="mt-4 border-t pt-4">
            {isEditing ? (
              <>
                <div className="space-y-4">
                  <div>
                    <Label>Username</Label>
                    <Input
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleSaveEdit(p.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button 
                      onClick={handleCancelEdit}
                      variant="outline"
                      size="sm"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div><strong>Name:</strong> {p.name}</div>
                <div><strong>Email:</strong> {p.email}</div>
                <div><strong>Created:</strong> {new Date(p.created_at).toLocaleDateString()}</div>
                {p.preferences && (
                  <div>
                    <strong>Preferences:</strong>
                    <ul className="list-disc list-inside ml-4">
                      <li>Theme: {p.preferences.theme}</li>
                      <li>Notifications: {p.preferences.notifications ? 'Enabled' : 'Disabled'}</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">Error: {error}</div>

  if (isFirstSignIn) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 pt-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to AutoCRM! 👋</CardTitle>
            <CardDescription>Let&apos;s set up your profile to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInitialSetup} className="space-y-6">
              <div>
                <Label>Username</Label>
                <Input
                  value={initialSetupForm.username}
                  onChange={(e) => setInitialSetupForm({ ...initialSetupForm, username: e.target.value })}
                  className="mt-1"
                  required
                />
                <span className="text-sm text-gray-500">This is how others will identify you in the system</span>
              </div>
              <div>
                <Label>Full Name</Label>
                <Input
                  value={initialSetupForm.name}
                  onChange={(e) => setInitialSetupForm({ ...initialSetupForm, name: e.target.value })}
                  className="mt-1"
                  required
                />
                <span className="text-sm text-gray-500">Your actual name</span>
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={initialSetupForm.email}
                  disabled
                  className="mt-1 bg-gray-50"
                />
                <span className="text-sm text-gray-500">Your email address (cannot be changed)</span>
              </div>
              <Button type="submit" className="w-full">
                Complete Setup
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* User's own profile */}
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {renderProfileCard(profile)}
          </div>
        </CardContent>
      </Card>

      {/* Admin section */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Manage Users</CardTitle>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              variant="outline"
              size="sm"
            >
              {showCreateForm ? (
                <>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-1" />
                  Create Profile
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateProfile} className="space-y-4 mb-6">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
                {createError && (
                  <div className="text-red-500 text-sm">{createError}</div>
                )}
                <Button type="submit">
                  <Plus className="h-4 w-4 mr-1" />
                  Create User
                </Button>
              </form>
            )}
            <div className="space-y-4">
              {allProfiles
                .filter(p => p.id !== profile.id)
                .map(renderProfileCard)}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </div>
              <div className="space-x-2">
                <Button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  variant="outline"
                  size="sm"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 