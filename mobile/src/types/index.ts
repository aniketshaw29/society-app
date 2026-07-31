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
// Pre-Approval (T3-1 / T3-2)
// ---------------------------------------------------------------------------

export type PreApprovalStatus = 'active' | 'used' | 'cancelled' | 'locked';

export interface PreApproval {
  id: string;
  flatId: string;
  societyId: string;
  createdBy: string;
  guestName: string;
  /** Masked: e.g. "XXXXXX3210" */
  guestPhone: string;
  purpose: string | null;
  validFrom: string;
  validUntil: string;
  status: PreApprovalStatus;
  otpAttempts: number;
  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePreApprovalInput {
  guestName: string;
  guestPhone: string;
  purpose?: string;
  validFrom: string;
  validUntil: string;
}

export interface OtpVerifyResult {
  visitor: {
    id: string;
    societyId: string;
    flatId: string;
    visitorName: string;
    visitorPhone: string | null;
    purpose: string | null;
    entryMethod: string;
    status: string;
    entryTime: string | null;
    createdAt: string;
    flat: { flatNumber: string; buildingName: string | null } | null;
  };
  preApproval: {
    guestName: string;
    flatId: string;
    flatNumber: string | null;
    buildingName: string | null;
  };
}

export interface OtpVerifyError {
  code: 'expired' | 'wrong_otp' | 'already_used' | 'locked' | 'not_found';
  message: string;
  attemptsRemaining?: number;
}

// ---------------------------------------------------------------------------
// Recurring Staff
// ---------------------------------------------------------------------------

export type StaffCategory = 'maid' | 'cook' | 'driver' | 'security' | 'delivery' | 'other';

export interface RecurringStaff {
  id: string;
  societyId: string;
  flatId: string;
  residentId: string;
  name: string;
  phone: string | null;
  category: StaffCategory;
  /** 0 = Sunday … 6 = Saturday */
  allowedDays: number[];
  entryFrom: string; // HH:MM
  entryUntil: string; // HH:MM
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffInput {
  name: string;
  phone?: string;
  category: StaffCategory;
  allowedDays: number[];
  entryFrom: string;
  entryUntil: string;
}

export interface StaffSearchResult {
  staff: RecurringStaff;
  flat: { flatNumber: string; buildingName: string | null } | null;
  resident: { id: string; fullName: string | null; phone: string | null } | null;
}

export interface StaffVisit {
  id: string;
  staffId: string;
  societyId: string;
  flatId: string;
  guardId: string | null;
  entryTime: string;
  createdAt: string;
}


// ---------------------------------------------------------------------------
// SOS Alert (T4-5)
// ---------------------------------------------------------------------------

export type SosAlertStatus = 'active' | 'resolved';

export interface SosAlert {
  id: string;
  societyId: string;
  flatId: string;
  residentId: string;
  message: string;
  status: SosAlertStatus;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------

export type HistoryDateRange = 'today' | 'week' | 'month' | 'custom';

export interface HistoryFilters {
  status?: VisitorLogStatus | '';
  dateRange?: HistoryDateRange;
  fromDate?: string;
  toDate?: string;
  flatId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// UserProfile (flat member)
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  flatId: string | null;
  societyId: string | null;
  isActive: boolean;
  joinedAt: string;
  avatarUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Notice (T5-3)
// ---------------------------------------------------------------------------

export type NoticeType = 'general' | 'urgent' | 'event' | 'maintenance';
export type NoticeStatus = 'draft' | 'published' | 'archived';

export interface Notice {
  id: string;
  societyId: string;
  createdBy: string;
  title: string;
  body: string;
  /** 'all' | 'guards' | 'building:<uuid>' */
  audience: string;
  noticeType: NoticeType;
  isPinned: boolean;
  status: NoticeStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoticeInput {
  title: string;
  body: string;
  audience: string;
  noticeType: NoticeType;
  isPinned?: boolean;
  scheduledAt?: string | null;
}

// ---------------------------------------------------------------------------
// Admin Reports (T5-4)
// ---------------------------------------------------------------------------

export interface ReportFilters {
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
  buildingId?: string;
  guardId?: string;
  flatId?: string;
  staffCategory?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface VisitorReportRow {
  id: string;
  name: string;
  phone: string | null;
  purpose: string | null;
  flat: string | null;
  building: string | null;
  guard: string | null;
  status: string;
  entryTime: string | null;
  exitTime: string | null;
  createdAt: string;
}

export interface StaffVisitReportRow {
  id: string;
  staffName: string | null;
  staffCategory: string | null;
  staffPhone: string | null;
  flat: string | null;
  building: string | null;
  entryTime: string | null;
  exitTime: string | null;
  createdAt: string;
}

export interface SosReportRow {
  id: string;
  message: string | null;
  status: string;
  flat: string | null;
  building: string | null;
  residentName: string | null;
  residentPhone: string | null;
  resolvedAt: string | null;
  resolutionMinutes: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// LocalVisitor — mirrors visitor_logs, stored in SQLite for offline guard
// ---------------------------------------------------------------------------

export type SyncStatus = 'pending' | 'synced' | 'error';

export interface LocalVisitor {
  /** Server UUID once synced; empty string until first sync */
  id: string;
  /** Locally generated UUID, stable across the lifetime of the record */
  localId: string;
  societyId: string;
  flatId: string;
  visitorName: string;
  visitorPhone: string | null;
  purpose: string;
  vehicleNumber: string | null;
  status: VisitorLogStatus;
  photoLocalPath: string | null;
  photoUrl: string | null;
  entryTime: string;
  exitTime: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// SyncConflict — persisted locally for admin visibility
// ---------------------------------------------------------------------------

export type SyncConflictType = 'status_conflict' | 'exit_time_conflict';

export interface SyncConflict {
  id: number;
  visitorLocalId: string | null;
  conflictType: SyncConflictType;
  localValue: string | null;
  serverValue: string | null;
  resolvedValue: string | null;
  resolvedAt: string;
}

// ---------------------------------------------------------------------------
// SyncQueueEntry — record stored in sync_queue table
// ---------------------------------------------------------------------------

export type SyncQueueStatus = 'pending' | 'success' | 'abandoned';

export interface SyncQueueEntry {
  id: number;
  entityType: string;
  operation: string;
  payload: string;
  createdAt: string;
  attempts: number;
  lastAttempt: string | null;
  nextAttempt: string | null;
  status: SyncQueueStatus;
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
