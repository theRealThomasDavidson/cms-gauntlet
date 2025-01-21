# Service Interfaces

## Types

```typescript
type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
type UserRole = 'customer' | 'agent' | 'admin'

interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignedTo: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  customFields: Record<string, any>
  tags: string[]
  comments: Comment[]
}

interface User {
  id: string
  email: string
  name: string
  role: UserRole
  teams: string[]
  createdAt: Date
  lastActive: Date
  preferences: Record<string, any>
}

interface Article {
  id: string
  title: string
  content: string
  categories: string[]
  tags: string[]
  author: string
  createdAt: Date
  updatedAt: Date
  version: number
}

interface Comment {
  id: string
  ticketId: string
  content: string
  createdBy: string
  createdAt: Date
  isInternal: boolean
}

interface Notification {
  id: string
  userId: string
  type: string
  content: Record<string, any>
  read: boolean
  createdAt: Date
}

interface Session {
  user: User
  token: string
  expiresAt: Date
}

interface Team {
  id: string
  name: string
  members: string[]
  createdAt: Date
}

interface Category {
  id: string
  name: string
  description: string
  parentId?: string
}

interface Version {
  id: string
  articleId: string
  content: string
  createdAt: Date
  createdBy: string
}

interface Suggestion {
  content: string
  confidence: number
  source?: string
}

interface Response {
  content: string
  type: 'auto' | 'suggested'
  metadata: Record<string, any>
}

interface Alert {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high'
  content: Record<string, any>
}

interface Subscription {
  id: string
  channel: string
  callback: (data: any) => void
}

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

interface AuthResponse {
  data: {
    session: Session | null
    user: User | null
  }
  error: Error | null
}

interface AuthSubscription {
  data: {
    subscription: {
      unsubscribe: () => void
    }
  }
}

type HookType = 'email' | 'notification' | 'webhook' | 'assignment'

interface Workflow {
  id: string
  name: string
  description: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

interface WorkflowStage {
  id: string
  workflowId: string
  name: string
  description: string
  isStart: boolean
  isEnd: boolean
  nextStageId: string | null
  prevStageId: string | null
  createdAt: Date
  updatedAt: Date
}

interface WorkflowStageHook {
  id: string
  stageId: string
  type: HookType
  config: Record<string, any>
  createdAt: Date
  updatedAt: Date
}
```

## TicketService
```typescript
interface TicketService {
  // Core Operations
  createTicket(data: {
    title: string;
    description: string;
    priority: TicketPriority;
    workflowId?: string; // Optional, will use org's default if not provided
  }): Promise<Ticket>;

  updateTicket(ticketId: string, data: {
    title?: string;
    description?: string;
    priority?: TicketPriority;
  }): Promise<Ticket>;

  // Stage Management
  moveToStage(ticketId: string, stageId: string): Promise<Ticket>;
  
  // Assignment
  assignTicket(ticketId: string, userId: string): Promise<Ticket>;
  unassignTicket(ticketId: string): Promise<Ticket>;

  // Comments
  addComment(ticketId: string, data: {
    content: string;
    isInternal?: boolean;
  }): Promise<Comment>;

  // Attachments
  addAttachment(ticketId: string, file: File): Promise<Attachment>;
  removeAttachment(attachmentId: string): Promise<void>;

  // Queries
  getTicket(ticketId: string): Promise<TicketDetails>;
  listTickets(filters?: {
    workflowId?: string;
    stageId?: string;
    assignedTo?: string;
    priority?: TicketPriority;
    createdBy?: string;
  }): Promise<Ticket[]>;
  
  getTicketHistory(ticketId: string): Promise<TicketHistory[]>;
  getTicketComments(ticketId: string): Promise<Comment[]>;
  getTicketAttachments(ticketId: string): Promise<Attachment[]>;
}

interface TicketDetails extends Ticket {
  history: TicketHistory[];
  comments: Comment[];
  attachments: Attachment[];
  workflow: {
    id: string;
    name: string;
    currentStage: {
      id: string;
      name: string;
      description: string;
    };
    availableStages: {
      id: string;
      name: string;
      description: string;
    }[];
  };
}
```

## UserService
```typescript
interface UserService {
  // Authentication
  signIn(email: string, password: string): Promise<Session>
  signUp(userData: {
    email: string
    password: string
    name: string
    role?: UserRole
  }): Promise<User>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<boolean>
  
  // Profile Management
  updateProfile(userId: string, updates: Partial<User>): Promise<User>
  getProfile(userId: string): Promise<User>
  
  // Team Management
  assignToTeam(userId: string, teamId: string): Promise<boolean>
  removeFromTeam(userId: string, teamId: string): Promise<boolean>
  listTeamMembers(teamId: string): Promise<User[]>
  
  // Roles & Permissions
  setRole(userId: string, role: UserRole): Promise<boolean>
  getRoles(userId: string): Promise<UserRole[]>
  hasPermission(userId: string, permission: string): Promise<boolean>
}
```

## KnowledgeBaseService
```typescript
interface KnowledgeBaseService {
  // Article Management
  createArticle(data: {
    title: string
    content: string
    categories: string[]
    tags: string[]
  }): Promise<Article>
  updateArticle(articleId: string, updates: Partial<Article>): Promise<Article>
  deleteArticle(articleId: string): Promise<boolean>
  getArticle(articleId: string): Promise<Article>
  
  // Search & Categories
  searchArticles(query: string): Promise<Article[]>
  listByCategory(categoryId: string): Promise<Article[]>
  listCategories(): Promise<Category[]>
  
  // Version Control
  getArticleVersion(articleId: string, version: number): Promise<Article>
  listVersions(articleId: string): Promise<Version[]>
  
  // Future RAG Integration
  getSimilarArticles(content: string): Promise<Article[]> // Week 2
  getAIEnhancedSearch(query: string): Promise<Article[]> // Week 2
}
```

## NotificationService
```typescript
interface NotificationService {
  // Real-time Updates
  subscribe(channel: string, callback: (data: any) => void): Subscription
  unsubscribe(subscription: Subscription): void
  
  // Notifications
  sendNotification(userId: string, notification: {
    type: string
    content: Record<string, any>
  }): Promise<boolean>
  markAsRead(notificationId: string): Promise<boolean>
  listNotifications(userId: string): Promise<Notification[]>
  
  // Email
  sendEmail(to: string, template: string, data: Record<string, any>): Promise<boolean>
  
  // Future AI Features
  getSmartAlerts(userId: string): Promise<Alert[]> // Week 2
}
```

## AuthService
```typescript
interface AuthService {
  // Session Management
  getSession(): Promise<AuthResponse>
  onAuthStateChange(callback: (event: string, session: Session | null) => void): AuthSubscription
  
  // Authentication
  signInWithGithub(): Promise<AuthResponse>
  signOut(): Promise<{ error: Error | null }>
  
  // Profile Management
  getCurrentUser(): Promise<User | null>
  getProfile(): Promise<Profile | null>
  
  // Helpers
  isAuthenticated(): boolean
  hasRole(role: UserRole): boolean
}

// React Hook (for components)
interface UseAuth {
  authState: AuthState
  signInWithGithub: () => Promise<void>
  signOut: () => Promise<void>
  user: User | null
  profile: Profile | null
  isAuthenticated: boolean
  isLoading: boolean
  hasRole: (role: UserRole) => boolean
}

## WorkflowService
```typescript
interface WorkflowService {
  // Core Operations
  createWorkflow(data: {
    name: string
    description?: string
    isActive?: boolean
  }): Promise<Workflow>
  
  updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow>
  deleteWorkflow(workflowId: string): Promise<boolean>
  
  // Stage Management
  addStage(workflowId: string, data: {
    name: string
    description?: string
    isStart?: boolean
    isEnd?: boolean
  }): Promise<WorkflowStage>
  
  updateStage(stageId: string, updates: Partial<WorkflowStage>): Promise<WorkflowStage>
  deleteStage(stageId: string): Promise<boolean>
  
  // Stage Order Management
  setNextStage(stageId: string, nextStageId: string | null): Promise<WorkflowStage>
  setPrevStage(stageId: string, prevStageId: string | null): Promise<WorkflowStage>
  
  // Hook Management
  addHook(stageId: string, data: {
    type: HookType
    config: Record<string, any>
  }): Promise<WorkflowStageHook>
  
  updateHook(hookId: string, updates: Partial<WorkflowStageHook>): Promise<WorkflowStageHook>
  deleteHook(hookId: string): Promise<boolean>
  
  // Queries
  getWorkflow(workflowId: string): Promise<Workflow>
  listWorkflows(filters?: {
    isActive?: boolean
  }): Promise<Workflow[]>
  
  getWorkflowStages(workflowId: string): Promise<WorkflowStage[]>
  getStageHooks(stageId: string): Promise<WorkflowStageHook[]>
} 