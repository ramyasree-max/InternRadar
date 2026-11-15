const TOKEN_KEY = 'internradar_token';
let memoryToken: string | null = null;

export function getStoredToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return memoryToken;
  }
}

export function setStoredToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Fallback remains in memoryToken
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed with status ${res.status}`) as Error & { code?: string };
    if (data.code) err.code = data.code;
    throw err;
  }
  return data as T;
}

export interface StudentProject {
  title: string;
  summary: string;
  stack: string;
}

export interface NotificationPrefs {
  newMatches: boolean;
  updates: boolean;
  deadlines: boolean;
  weeklySummary: boolean;
  emailEnabled: boolean;
  browserPushEnabled: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  isDemo: boolean;
  name: string;
  educationLevel: string;
  college: string;
  degreeBranch: string;
  graduationYear: string;
  skills: string[];
  languages: string[];
  projects: StudentProject[];
  preferredRoles: string[];
  preferredLocations: string[];
  workArrangement: string;
  preferredCategories: string[];
  notificationPrefs: NotificationPrefs;
  privacyPublic: boolean;
  completionPercentage: number;
  updatedAt: string;
}

export interface Internship {
  id: string;
  companyId: string;
  companyName: string;
  sector: string;
  externalId: string;
  title: string;
  category: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  eligibility: string;
  stipendText: string;
  stipendMin: number | null;
  paidType: string;
  location: string;
  workArrangement: string;
  sourcePlatform: string;
  originalListingUrl: string;
  originalApplicationUrl: string;
  publishedAt: string | null;
  deadlineAt: string | null;
  firstDiscoveredAt: string;
  lastUpdatedAt: string;
  lastVerifiedAt: string;
  verificationStatus: string;
  isDemo: boolean;
  applicationStatus?: string | null;
  isSaved?: boolean;
}

export interface SkillMatchResult {
  estimatedMatchPercentage: number;
  matchingSkills: string[];
  missingSkills: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  eligibilityWarnings: string[];
  recommendedResources: Array<{ topic: string; resourceType: string; action: string }>;
  suggestedProjects: Array<{ title: string; scope: string; skillsCovered: string[] }>;
  explanation: string;
  usedAi: boolean;
  computedAt?: string;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Not available';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not available';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return 'Not specified';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not specified';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
