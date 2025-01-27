import { TopBar } from '../components/TopBar'
import SideBar from '../components/SideBar'
import Workspace from '../components/Workspace'
import { useState, useEffect, useCallback } from 'react'
import { getVisibleProfiles, supabase } from '../lib/supabaseClient'
import { useNavigate, useLocation } from 'react-router-dom'
import { NotificationProvider } from '../context/NotificationContext'

export default function Dashboard() {
  console.log('Dashboard component rendering');
  
  const navigate = useNavigate();
  const location = useLocation();
  const [activeComponent, setActiveComponent] = useState('dashboard')
  const [workflowState, setWorkflowState] = useState({ view: 'list', id: null })
  const [profile, setProfile] = useState(null)
  const [allProfiles, setAllProfiles] = useState([])
  const [selectedProfileId, setSelectedProfileId] = useState(null)
  const [ticketId, setTicketId] = useState(null);
  const [sessionKey, setSessionKey] = useState(Date.now());

  const clearAllState = useCallback(() => {
    console.log('Clearing all state...');
    setProfile(null);
    setAllProfiles([]);
    setSelectedProfileId(null);
    setActiveComponent('dashboard');
    setWorkflowState({ view: 'list', id: null });
    setTicketId(null);
    setSessionKey(Date.now());
    
    localStorage.clear();
    supabase.channel('*').unsubscribe();
  }, []);

  // Load profile on mount and auth state changes
  useEffect(() => {
    let mounted = true;
    
    const loadInitialSession = async () => {
      console.log('loadInitialSession starting');
      const { data: { session }} = await supabase.auth.getSession();
      console.log('Session check result:', { hasSession: !!session });
      
      if (!mounted) return;
      
      if (!session) {
        console.log('No session found, redirecting to login');
        clearAllState();
        navigate('/login');
        return;
      }
      
      console.log('Session found, loading profile');
      await loadProfile();
    };

    loadInitialSession();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT') {
        clearAllState();
        navigate('/login');
      } else if (event === 'SIGNED_IN' && session) {
        await loadProfile();
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [clearAllState, navigate]);

  // Handle URL-based navigation
  useEffect(() => {
    const path = location.pathname;
    const match = path.match(/^\/workflows\/([^/]+)\/kanban$/);
    if (match) {
      const workflowId = match[1];
      setActiveComponent('workflows');
      setWorkflowState({ view: 'kanban', id: workflowId });
    }
  }, [location]);

  useEffect(() => {
    const path = location.pathname;
    const ticketMatch = path.match(/^\/tickets\/([^/]+)$/);
    
    if (ticketMatch) {
      const id = ticketMatch[1];
      setActiveComponent('tickets');
      setTicketId(id);
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  // Effect to update profile when selectedProfileId changes
  useEffect(() => {
    if (selectedProfileId && allProfiles.length > 0) {
      const selectedProfile = allProfiles.find(p => p.id === selectedProfileId);
      if (selectedProfile) {
        setProfile(selectedProfile);
      }
    }
  }, [selectedProfileId, allProfiles]);

  const loadProfile = async () => {
    console.log('loadProfile starting');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Got user:', { hasUser: !!user });
      if (!user) return;

      const profiles = await getVisibleProfiles();
      console.log('Got profiles:', { count: profiles?.length });
      if (!profiles?.length) return;
      
      const currentUserProfile = profiles.find(p => p.auth_id === user.id);
      console.log('Found current profile:', { hasProfile: !!currentUserProfile });
      if (currentUserProfile) {
        setAllProfiles(profiles);
        setProfile(currentUserProfile);
        setSelectedProfileId(currentUserProfile.id);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  // Function to switch to viewing a different profile (for admins)
  const handleSwitchProfile = (profileId) => {
    if (profile?.role === 'admin') {
      setSelectedProfileId(profileId);
    }
  };

  const handleCreateWorkflow = () => {
    setActiveComponent('workflows')
    setWorkflowState({ view: 'new', id: null })
  }

  const handleEditWorkflow = (id) => {
    setActiveComponent('workflows')
    setWorkflowState({ view: 'edit', id })
  }

  const handleViewWorkflow = (id) => {
    setActiveComponent('workflows')
    setWorkflowState({ view: 'detail', id })
  }

  const handleWorkflowAction = (view = 'list', id = null) => {
    setActiveComponent('workflows')
    setWorkflowState({ view, id })
  }

  const handleViewTicket = (id) => {
    setActiveComponent('tickets');
    setTicketId(id);
    navigate('/', { replace: true });
  };

  const handleBackToTickets = () => {
    setTicketId(null);
    setActiveComponent('tickets');
    navigate('/', { replace: true });
  };

  return (
    <NotificationProvider key={`notifications-${sessionKey}`}>
      <div className="min-h-screen flex flex-col bg-background">
        <TopBar 
          key={`topbar-${sessionKey}`}
          profile={profile}
          allProfiles={profile?.role === 'admin' ? allProfiles : []}
          onSwitchProfile={handleSwitchProfile}
          selectedProfileId={selectedProfileId}
        />
        <div className="flex-1 flex relative">
          <SideBar 
            key={`sidebar-${sessionKey}`}
            setActiveComponent={setActiveComponent}
            onCreateWorkflow={handleCreateWorkflow}
            onWorkflowAction={handleWorkflowAction}
            profile={profile}
          />
          <main className="flex-1 ml-[200px] mt-[60px]">
            <Workspace 
              key={`workspace-${sessionKey}`}
              activeComponent={activeComponent} 
              workflowState={workflowState}
              ticketId={ticketId}
              onCreateWorkflow={handleCreateWorkflow}
              onEditWorkflow={handleEditWorkflow}
              onViewWorkflow={handleViewWorkflow}
              onWorkflowAction={handleWorkflowAction}
              onBackToTickets={handleBackToTickets}
              onViewTicket={handleViewTicket}
              profile={profile}
              allProfiles={profile?.role === 'admin' ? allProfiles : []}
            />
          </main>
        </div>
      </div>
    </NotificationProvider>
  )
} 