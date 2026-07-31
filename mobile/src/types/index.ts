// ---------------------------------------------------------------------------
// User & Auth
// ---------------------------------------------------------------------------

export type UserRole =
  | 'guard'
  | 'resident'
  | 'flat_owner'
  | 'tenant'
  | 'society_admin'
  | 'super_admin';

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  societyId?: string | null;
  flatId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Society
// ---------------------------------------------------------------------------

export interface Society {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  inviteCode: string;
  logoUrl?: string | null;
  adminId: string;
  totalBuildings: number;
  totalFlats: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

export interface Building {
  id: string;
  societyId: string;
  name: string;
  totalFloors: number;
  totalFlats: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Flat
// ---------------------------------------------------------------------------

export type FlatStatus = 'occupied' | 'vacant' | 'under_maintenance';

export interface Flat {
  id: string;
  buildingId: string;
  societyId: string;
  flatNumber: string;
  floor: number;
  status: FlatStatus;
  ownerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Resident
// ---------------------------------------------------------------------------

export type ResidentType = 'owner' | 'tenant';

export interface Resident {
  id: string;
  userId: string;
  flatId: string;
  societyId: string;
  residentType: ResidentType;
  moveInDate: string;
  moveOutDate?: string | null;
  isCurrentResident: boolean;
  vehicleNumbers: string[];
  emergencyContact?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

export interface Guard {
  id: string;
  userId: string;
  societyId: string;
  employeeId?: string | null;
  shift: 'morning' | 'evening' | 'night';
  isOnDuty: boolean;
  gateAssigned?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Visitor
// ---------------------------------------------------------------------------

export type VisitorStatus =
  | 'pending_approval'
  | 'approved'
  | 'denied'
  | 'checked_in'
  | 'checked_out'
  | 'expired';

export type VisitorEntryMethod =
  | 'qr_code'
  | 'otp'
  | 'photo'
  | 'manual'
  | 'pre_approved';

export interface Visitor {
  id: string;
  societyId: string;
  flatId: string;
  residentId: string;
  name: string;
  phone: string;
  photoUrl?: string | null;
  purpose: string;
  vehicleNumber?: string | null;
  status: VisitorStatus;
  entryMethod: VisitorEntryMethod;
  otp?: string | null;
  qrCode?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  guardId?: string | null;
  validUntil?: string | null;
  isFrequentVisitor: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'visitor_approval_request'
  | 'visitor_approved'
  | 'visitor_denied'
  | 'visitor_checked_in'
  | 'visitor_checked_out'
  | 'parcel_arrived'
  | 'announcement'
  | 'maintenance_request'
  | 'payment_reminder'
  | 'emergency';

export interface AppNotification {
  id: string;
  userId: string;
  societyId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  deepLink?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Visitor Log (gate-centric view, aligned with DB visitor_logs table)
// ---------------------------------------------------------------------------

export type VisitorLogStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'entered'
  | 'exited'
  | 'expired';

export type VisitorLogEntryMethod = 'manual' | 'qr_code' | 'otp' | 'pre_approved';

export interface VisitorLog {
  id: string;
  societyId: string;
  flatId: string;
  guardId?: string | null;
  visitorName: string;
  visitorPhone?: string | null;
  visitorPhotoUrl?: string | null;
  vehicleNumber?: string | null;
  purpose?: string | null;
  entryMethod: VisitorLogEntryMethod;
  status: VisitorLogStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields (returned from detail endpoints)
  flat?: {
    flatNumber: string;
    buildingName?: string;
  } | null;
  approver?: {
    fullName?: string | null;
    phone?: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// History filters
// ---------------------------------------------------------------------------

export type HistoryDateRange = 'today' | 'week' | 'month' | 'custom';

export interface HistoryFilters {
  status?: VisitorLogStatus | '';
  dateRange?: HistoryDateRange;
  fromDate?: string;
  toDate?: string;
  flatId?: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// API Response helpers
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}
