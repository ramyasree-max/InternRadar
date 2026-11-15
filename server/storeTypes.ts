import crypto from 'crypto';
import type { SourceCompanyConfig, StandardizedInternship } from './services/internshipFeedService.ts';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface StorageStatus {
  engine: 'MongoDB Atlas' | 'SQLite (Local Fallback)';
  configured: boolean;
  connected: boolean;
  dbName: string;
  usernameHint: string;
  message: string;
  error?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  is_demo: number;
  reset_token: string | null;
  reset_expires: number | null;
  created_at: string;
}

export interface StudentProfileRecord {
  user_id: string;
  name: string;
  education_level: string;
  college: string;
  degree_branch: string;
  graduation_year: string;
  skills_json: string;
  languages_json: string;
  projects_json: string;
  preferred_roles_json: string;
  preferred_locations_json: string;
  work_arrangement: string;
  preferred_categories_json: string;
  notification_prefs_json: string;
  privacy_public: number;
  updated_at: string;
}

export interface CompanyRecord extends SourceCompanyConfig {
  logo_url: string;
  integration_status: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_result_summary: string;
  is_demo: number;
}

export interface InternshipRecord {
  id: string;
  company_id: string;
  company_name: string;
  sector: string;
  external_id: string;
  title: string;
  normalized_title: string;
  category: string;
  description: string;
  required_skills_json: string;
  preferred_skills_json: string;
  eligibility: string;
  stipend_text: string;
  stipend_min: number | null;
  paid_type: string;
  location: string;
  work_arrangement: string;
  source_platform: string;
  original_listing_url: string;
  original_application_url: string;
  published_at: string | null;
  deadline_at: string | null;
  first_discovered_at: string;
  last_updated_at: string;
  last_verified_at: string;
  verification_status: string;
  content_hash: string;
  is_demo: number;
}

export interface VerificationHistoryRecord {
  id: string;
  internship_id: string;
  checked_at: string;
  previous_status: string | null;
  new_status: string;
  change_summary: string;
  http_status: number | null;
}

export interface ApplicationRecord {
  id: string;
  user_id: string;
  internship_id: string | null;
  company_name: string;
  internship_title: string;
  status: string;
  applied_date: string;
  notes: string;
  important_dates: string;
  follow_up_date: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationWithInternshipRecord extends ApplicationRecord {
  original_application_url: string | null;
  verification_status: string | null;
  location: string | null;
  is_demo: number;
}

export interface SkillMatchRecord {
  id: string;
  user_id: string;
  internship_id: string;
  match_percentage: number;
  matching_skills_json: string;
  missing_skills_json: string;
  required_skills_json: string;
  preferred_skills_json: string;
  eligibility_warnings_json: string;
  learning_resources_json: string;
  project_suggestions_json: string;
  explanation: string;
  used_ai: number;
  computed_at: string;
}

export interface CareerGoalRecord {
  id: string;
  user_id: string;
  title: string;
  category: string;
  target_count: number;
  current_count: number;
  period: string;
  completed: number;
  created_at: string;
  updated_at: string;
}

export interface StudentActivityRecord {
  id: string;
  user_id: string;
  activity_type: string;
  description: string;
  skill_practised: string;
  minutes_spent: number;
  created_at: string;
}

export interface IndustryNewsRecord {
  id: string;
  external_id: string;
  title: string;
  publisher: string;
  category: string;
  published_at: string;
  original_url: string;
  raw_excerpt: string;
  ai_summary: string;
  why_it_matters: string;
  related_skills_json: string;
  fetched_at: string;
  is_demo: number;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_internship_id: string | null;
  is_read: number;
  created_at: string;
}

export interface CollectionLogRecord {
  id: string;
  company_id: string | null;
  company_name: string;
  source_platform: string;
  started_at: string;
  finished_at: string;
  status: string;
  discovered_count: number;
  updated_count: number;
  closed_count: number;
  error_message: string;
}

export interface InternshipQueryFilters {
  q?: string;
  company?: string;
  skill?: string;
  location?: string;
  category?: string;
  sector?: string;
  arrangement?: string;
  paidType?: string;
  stipendMin?: number;
  sort?: string;
  status?: string;
  includeDemo?: boolean;
}

export interface DatabaseStore {
  init(): Promise<void>;
  close(): Promise<void>;

  // Auth & Profiles
  findAuthUserById(id: string): Promise<{ id: string; email: string; is_demo: number } | null>;
  findUserByIdWithHash(id: string): Promise<{ id: string; email: string; password_hash: string; is_demo: number } | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  createStudentAccount(input: {
    userId: string;
    email: string;
    passwordHash: string;
    name: string;
    educationLevel: string;
    college: string;
    degreeBranch: string;
    graduationYear: string;
    skillsJson: string;
    languagesJson: string;
    projectsJson: string;
    preferredRolesJson: string;
    preferredLocationsJson: string;
    workArrangement: string;
    preferredCategoriesJson: string;
    welcomeNotificationId: string;
    nowIso: string;
  }): Promise<StudentProfileRecord>;
  setResetToken(userId: string, code: string, expiresAt: number): Promise<void>;
  resetUserPassword(userId: string, passwordHash: string): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  getStudentProfile(userId: string): Promise<StudentProfileRecord | null>;
  updateStudentProfile(
    userId: string,
    updates: {
      name: string;
      education_level: string;
      college: string;
      degree_branch: string;
      graduation_year: string;
      skills_json: string;
      languages_json: string;
      projects_json: string;
      preferred_roles_json: string;
      preferred_locations_json: string;
      work_arrangement: string;
      preferred_categories_json: string;
      notification_prefs_json: string;
      privacy_public: number;
      updated_at: string;
    }
  ): Promise<StudentProfileRecord | null>;
  clearUserSkillMatches(userId: string): Promise<void>;
  listAllStudentNotificationTargets(): Promise<
    Array<{
      user_id: string;
      skills_json: string;
      languages_json: string;
      notification_prefs_json: string;
    }>
  >;

  // Internships, Companies, Transparency
  queryInternships(filters: InternshipQueryFilters): Promise<{
    rows: InternshipRecord[];
    total: number;
    sectorCounts: Record<string, number>;
  }>;
  findInternshipById(id: string): Promise<InternshipRecord | null>;
  findCompanyById(id: string): Promise<CompanyRecord | null>;
  listVerificationHistory(internshipId: string, limit: number): Promise<VerificationHistoryRecord[]>;
  listCompaniesWithOpenCounts(options: {
    includeDemo: boolean;
    sector: string;
  }): Promise<Array<CompanyRecord & { verified_open_count: number }>>;
  getTransparencyStats(): Promise<{
    companies: Array<CompanyRecord & { verified_open_count: number }>;
    supportedJobSources: number;
    lastSuccessfulCollectionAt: string | null;
    sourcesTemporarilyUnavailable: number;
    verifiedOpenInternships: number;
    recentLogs: CollectionLogRecord[];
  }>;

  // Collector
  listNonDemoCompanies(): Promise<SourceCompanyConfig[]>;
  markCompanyUnavailable(companyId: string, finishedAt: string, errorMsg: string): Promise<void>;
  insertCollectionLog(log: CollectionLogRecord): Promise<void>;
  findInternshipByExternal(
    sourcePlatform: string,
    externalId: string
  ): Promise<{ id: string; content_hash: string; verification_status: string } | null>;
  findNonDemoDuplicateByTitle(
    companyId: string,
    normalizedTitle: string,
    location: string
  ): Promise<{ id: string; verification_status: string } | null>;
  touchInternshipVerified(id: string, verifiedAt: string): Promise<void>;
  createInternshipWithHistory(input: {
    id: string;
    companyId: string;
    sourcePlatform: string;
    item: StandardizedInternship;
    verifiedAt: string;
    historyId: string;
    httpStatus: number;
  }): Promise<void>;
  updateInternshipFromSource(input: {
    id: string;
    item: StandardizedInternship;
    changed: boolean;
    verifiedAt: string;
  }): Promise<void>;
  insertVerificationHistory(entry: VerificationHistoryRecord): Promise<void>;
  listPreviouslyOpenInternships(companyId: string): Promise<Array<{ id: string; verification_status: string }>>;
  markInternshipClosed(id: string, finishedAt: string): Promise<void>;
  markCompanyOperational(companyId: string, finishedAt: string, summaryMsg: string): Promise<void>;
  listApproachingDeadlines(
    nowIso: string,
    fiveDaysFromNowIso: string
  ): Promise<
    Array<{
      id: string;
      company_name: string;
      title: string;
      deadline_at: string;
      verification_status: string;
    }>
  >;
  setInternshipClosingSoon(id: string): Promise<void>;
  listTrackersForDeadline(internshipId: string): Promise<Array<{ user_id: string; notification_prefs_json: string }>>;
  hasNotification(userId: string, relatedInternshipId: string, type: string): Promise<boolean>;
  createNotification(notif: NotificationRecord): Promise<void>;

  // Applications & Skill Matches
  getUserAppStatuses(userId: string): Promise<Array<{ internship_id: string; status: string }>>;
  findApplicationByUserAndInternship(userId: string, internshipId: string): Promise<ApplicationRecord | null>;
  listApplicationsWithInternship(userId: string): Promise<ApplicationWithInternshipRecord[]>;
  createOrUpdateApplicationForInternship(input: {
    id: string;
    userId: string;
    internshipId: string | null;
    companyName: string;
    internshipTitle: string;
    status: string;
    appliedDate: string;
    notes: string;
    importantDates: string;
    followUpDate: string;
    nowIso: string;
  }): Promise<{ application: ApplicationRecord; created: boolean }>;
  findApplicationByIdForUser(id: string, userId: string): Promise<ApplicationRecord | null>;
  updateApplicationById(
    id: string,
    userId: string,
    updates: {
      status: string;
      applied_date: string;
      notes: string;
      important_dates: string;
      follow_up_date: string;
      updated_at: string;
    }
  ): Promise<ApplicationRecord | null>;
  deleteApplicationById(id: string, userId: string): Promise<boolean>;
  getCachedSkillMatch(userId: string, internshipId: string): Promise<SkillMatchRecord | null>;
  upsertSkillMatch(record: SkillMatchRecord): Promise<void>;

  // Dashboard, Growth, News, Notifications
  getDashboardContext(
    userId: string,
    includeDemo: boolean,
    sevenDaysAgoIso: string
  ): Promise<{
    profile: StudentProfileRecord | null;
    totalOpenCount: number;
    openInternships: InternshipRecord[];
    allRequiredSkillRows: Array<{ required_skills_json: string }>;
    applications: ApplicationRecord[];
    weeklyActivities: StudentActivityRecord[];
    goals: CareerGoalRecord[];
    notifications: NotificationRecord[];
  }>;
  listOpenRequiredSkills(includeDemo: boolean): Promise<Array<{ required_skills_json: string }>>;
  getGrowthContext(userId: string): Promise<{
    profile: StudentProfileRecord | null;
    goals: CareerGoalRecord[];
    activities: StudentActivityRecord[];
    applicationStatuses: Array<{ status: string }>;
    activityDaysAsc: string[];
    activityDaysDesc: string[];
  }>;
  createCareerGoal(goal: CareerGoalRecord): Promise<void>;
  findCareerGoalByIdForUser(id: string, userId: string): Promise<CareerGoalRecord | null>;
  updateCareerGoal(id: string, currentCount: number, completed: number, updatedAt: string): Promise<void>;
  deleteCareerGoal(id: string, userId: string): Promise<void>;
  createStudentActivity(activity: StudentActivityRecord): Promise<void>;
  listIndustryNews(category: string, limit: number): Promise<IndustryNewsRecord[]>;
  hasIndustryNewsByExternalId(externalId: string): Promise<boolean>;
  insertIndustryNewsIfNew(article: IndustryNewsRecord): Promise<void>;
  listNotifications(userId: string, limit: number): Promise<NotificationRecord[]>;
  markNotificationRead(id: string, userId: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
}
