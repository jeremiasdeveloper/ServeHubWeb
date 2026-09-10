// ServeHub — shared frontend types

export interface ServeHubConfig {
  restaurant: { name: string; id: string; logo: string | null; tagline?: string }
  branding: { primaryColor: string; secondaryColor: string; accentColor: string }
  features: {
    orders: boolean
    employees: boolean
    complaints: boolean
    customerService: boolean
    chat: boolean
    attendance: boolean
    tables: boolean
    notifications: boolean
  }
  localization: { defaultLanguage: "es" | "en"; supportedLanguages: ("es" | "en")[] }
  server: { realtimePort: number; version: string }
  counts?: { users: number; tables: number; orders: number }
}

export interface CurrentUser {
  id: string
  username: string
  displayName: string
  email: string | null
  role: { id: string; name: string }
  permissions: string[]
  isAdmin: boolean
  active: boolean
}

export interface RoleInfo {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
  userCount: number
}

export interface TableInfo {
  id: string
  number: string
  capacity: number
  status: string
  location: string | null
  orders?: { id: string; number: number; status: string }[]
}

export interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
  notes: string | null
  status: string
}

export interface OrderInfo {
  id: string
  number: number
  tableId: string
  table: { id: string; number: string; status: string }
  createdById: string
  createdBy: { id: string; username: string; displayName: string }
  assignedToId: string | null
  assignedTo: { id: string; username: string; displayName: string } | null
  status: string
  notes: string | null
  total: number
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  history?: { id: string; fromStatus: string | null; toStatus: string; changedById: string | null; note: string | null; createdAt: string }[]
}

export interface EmployeeInfo {
  id: string
  username: string
  displayName: string
  email: string | null
  active: boolean
  createdAt: string
  lastLoginAt: string | null
  roleId: string
  role: { id: string; name: string }
  permissions: string
}

export interface ComplaintInfo {
  id: string
  title: string
  description: string
  category: string
  priority: string
  status: string
  customerName: string | null
  resolution: string | null
  createdAt: string
  updatedAt: string
  createdById: string
  createdBy: { id: string; username: string; displayName: string }
  assignedToId: string | null
  assignedTo: { id: string; username: string; displayName: string } | null
}

export interface CustomerServiceInfo {
  id: string
  subject: string
  description: string
  channel: string
  customerName: string | null
  customerContact: string | null
  status: string
  createdAt: string
}

export interface ConversationInfo {
  id: string
  name: string | null
  isGroup: boolean
  updatedAt: string
  participants: { id: string; user: { id: string; username: string; displayName: string } }[]
  messages?: { id: string; content: string; createdAt: string; senderId: string }[]
}

export interface MessageInfo {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
  sender: { id: string; username: string; displayName: string }
}

export interface AttendanceInfo {
  id: string
  userId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  notes: string | null
  user: { id: string; username: string; displayName: string; role: { name: string } }
}

export interface NotificationInfo {
  id: string
  userId: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
  data: string | null
}
