import crypto from 'crypto';

export type CompanySector = 'MNC' | 'Private' | 'Government' | 'Startup';

export type SourcePlatform =
  | 'Greenhouse Job Board API'
  | 'Lever Postings API'
  | 'Ashby Public Job API'
  | 'SmartRecruiters Public API'
  | 'Arbeitnow Public Job API'
  | 'Official RSS/Atom Feed';

export interface SourceCompanyConfig {
  id: string;
  name: string;
  slug: string;
  sector: string;
  website_url: string;
  careers_url: string;
  source_platform: string;
  source_board_token: string;
  integration_status?: string;
}

export interface StandardizedInternship {
  externalId: string;
  title: string;
  normalizedTitle: string;
  companyName: string;
  sector: string;
  category: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  eligibility: string;
  stipendText: string;
  stipendMin: number | null;
  paidType: 'Paid' | 'Unpaid' | 'Not specified';
  location: string;
  workArrangement: 'Remote' | 'Hybrid' | 'Onsite' | 'Not specified';
  sourcePlatform: string;
  originalListingUrl: string;
  originalApplicationUrl: string;
  publishedAt: string | null;
  contentHash: string;
}

export interface FeedFetchResult {
  ok: boolean;
  companyId: string;
  companyName: string;
  sourcePlatform: string;
  sourceUrl: string;
  fetchedAt: string;
  durationMs: number;
  httpStatus?: number;
  rawCount: number;
  listings: StandardizedInternship[];
  error?: string;
}

interface RawListingInput {
  externalId: string;
  title: string;
  companyNameOverride?: string;
  descriptionRaw: string;
  locationRaw?: string;
  workArrangementOverride?: string;
  listingUrl: string;
  applicationUrl?: string;
  publishedAtRaw?: string | number | null;
  eligibilityOverride?: string;
  extraTextForSkillMatching?: string;
}

export type SourceAdapter = (company: SourceCompanyConfig) => Promise<FeedFetchResult>;

const KNOWN_SKILLS = [
  'TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'Swift', 'Kotlin',
  'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST APIs', 'Docker', 'Kubernetes',
  'AWS', 'GCP', 'Azure', 'Terraform', 'Linux', 'Git', 'CI/CD', 'PyTorch', 'TensorFlow',
  'Machine Learning', 'Distributed Systems', 'Data Structures', 'SQL', 'HTML', 'CSS', 'Tailwind CSS',
  'Figma', 'Security', 'Networking', 'Kafka', 'Spark', 'Scala', 'MATLAB', 'Embedded Systems',
];

const USER_AGENT = 'InternRadarBot/1.0 (+https://internradar.app; public-careers-standardizer)';

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function stripHtml(raw: string): string {
  if (!raw) return '';
  const decoded = decodeHtmlEntities(raw);
  return decoded
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|li|h1|h2|h3|h4|br|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isValidHttpUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isInternshipTitle(title: string, extraTypes = ''): boolean {
  const combined = `${title} ${extraTypes}`;
  return /\b(intern|internship|co-op|coop|university grad|student|studentship|fellowship|summer analyst|apprentice|trainee|working student|werkstudent|praktikum)\b/i.test(
    combined
  );
}

export function normalizeIsoDate(raw?: string | number | null): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number' || /^\d{9,13}$/.test(String(raw).trim())) {
    const num = Number(raw);
    const ms = num < 10_000_000_000 ? num * 1000 : num;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(raw).trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/\b(machine learning|deep learning|ai research|llm|nlp|computer vision|ml intern|data science)\b/.test(text)) {
    return 'AI & Machine Learning';
  }
  if (/\b(security|cyber|infosec|appsec|threat)\b/.test(text)) {
    return 'Cybersecurity';
  }
  if (/\b(frontend|front-end|ui engineer|web engineer|react)\b/.test(text)) {
    return 'Frontend Engineering';
  }
  if (/\b(infrastructure|cloud|devops|sre|reliability|platform|kubernetes)\b/.test(text)) {
    return 'Cloud & Infrastructure';
  }
  if (/\b(product design|ux|ui\/ux|design intern)\b/.test(text)) {
    return 'Product & Design';
  }
  if (/\b(data engineer|analytics|data analyst|business intelligence)\b/.test(text)) {
    return 'Data Engineering';
  }
  return 'Software Engineering';
}

export function normalizeWorkArrangement(
  title: string,
  location: string,
  description: string,
  override?: string
): 'Remote' | 'Hybrid' | 'Onsite' | 'Not specified' {
  const rawOverride = (override || '').trim().toLowerCase();
  if (rawOverride === 'remote') return 'Remote';
  if (rawOverride === 'hybrid') return 'Hybrid';
  if (rawOverride === 'onsite' || rawOverride === 'on-site') return 'Onsite';

  const combined = `${title} ${location} ${description.slice(0, 600)}`.toLowerCase();
  if (/\bremote\b/.test(combined) && /\bhybrid\b/.test(combined)) return 'Hybrid';
  if (/\bhybrid\b/.test(combined)) return 'Hybrid';
  if (/\bremote\b/.test(combined)) return 'Remote';
  if (/\b(on-site|onsite|in-person|in office)\b/.test(combined)) return 'Onsite';
  return 'Not specified';
}

export function extractStipend(text: string): {
  stipendText: string;
  stipendMin: number | null;
  paidType: 'Paid' | 'Unpaid' | 'Not specified';
} {
  const hourly = text.match(
    /\$\s*(\d{2,3})(?:\.\d{2})?\s*(?:-|to|–)?\s*(?:\$\s*(\d{2,3}))?\s*(?:\/|\s*per\s*)\s*(?:hr|hour)/i
  );
  if (hourly) {
    const min = parseInt(hourly[1], 10);
    const max = hourly[2] ? parseInt(hourly[2], 10) : null;
    return {
      stipendText: max ? `$${min}–$${max}/hr` : `$${min}/hr`,
      stipendMin: min,
      paidType: 'Paid',
    };
  }
  const monthly = text.match(
    /\$\s*(\d{1,2},?\d{3})\s*(?:-|to|–)?\s*(?:\$\s*(\d{1,2},?\d{3}))?\s*(?:\/|\s*per\s*)\s*(?:mo|month)/i
  );
  if (monthly) {
    const min = parseInt(monthly[1].replace(/,/g, ''), 10);
    return {
      stipendText: `$${monthly[1]}/month`,
      stipendMin: Math.round(min / 160),
      paidType: 'Paid',
    };
  }
  if (/\bunpaid\b/i.test(text)) {
    return { stipendText: 'Unpaid', stipendMin: 0, paidType: 'Unpaid' };
  }
  return { stipendText: 'Not specified', stipendMin: null, paidType: 'Not specified' };
}

export function extractEligibility(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (
      /(enrolled|pursuing|bachelor|master|phd|graduat|currently a student|university|degree|student)/i.test(line) &&
      line.length < 280
    ) {
      return line;
    }
  }
  return 'Not specified';
}

export function extractSkills(text: string): { required: string[]; preferred: string[] } {
  const found: string[] = [];
  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, 'i');
    if (regex.test(text)) {
      found.push(skill);
    }
  }
  return {
    required: found.slice(0, 7),
    preferred: found.slice(7, 12),
  };
}

export function computeListingContentHash(payload: {
  title: string;
  description: string;
  requiredSkills: string[];
  stipendText: string;
  location: string;
  originalApplicationUrl: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        payload.title,
        payload.description.slice(0, 1500),
        payload.requiredSkills,
        payload.stipendText,
        payload.location,
        payload.originalApplicationUrl,
      ])
    )
    .digest('hex');
}

export function standardizeRawListing(
  company: SourceCompanyConfig,
  raw: RawListingInput
): StandardizedInternship | null {
  const title = raw.title.trim();
  const listingUrl = raw.listingUrl.trim();
  if (!title || !isValidHttpUrl(listingUrl)) return null;

  const applyUrl = raw.applicationUrl && isValidHttpUrl(raw.applicationUrl) ? raw.applicationUrl.trim() : listingUrl;
  const description = stripHtml(raw.descriptionRaw) || 'Full opportunity details are published on the official career page.';
  const location = raw.locationRaw?.trim() || 'Not specified';
  const companyName = raw.companyNameOverride?.trim() || company.name;
  const stipend = extractStipend(description);
  const skills = extractSkills(`${title}\n${description}\n${raw.extraTextForSkillMatching || ''}`);
  const eligibility = raw.eligibilityOverride?.trim() || extractEligibility(description);
  const workArrangement = normalizeWorkArrangement(title, location, description, raw.workArrangementOverride);
  const category = inferCategory(title, `${description} ${raw.extraTextForSkillMatching || ''}`);
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, ' ').trim();
  const publishedAt = normalizeIsoDate(raw.publishedAtRaw);

  const contentHash = computeListingContentHash({
    title,
    description,
    requiredSkills: skills.required,
    stipendText: stipend.stipendText,
    location,
    originalApplicationUrl: applyUrl,
  });

  return {
    externalId: raw.externalId,
    title,
    normalizedTitle,
    companyName,
    sector: company.sector || 'Private',
    category,
    description,
    requiredSkills: skills.required,
    preferredSkills: skills.preferred,
    eligibility,
    stipendText: stipend.stipendText,
    stipendMin: stipend.stipendMin,
    paidType: stipend.paidType,
    location,
    workArrangement,
    sourcePlatform: company.source_platform,
    originalListingUrl: listingUrl,
    originalApplicationUrl: applyUrl,
    publishedAt,
    contentHash,
  };
}

async function fetchWithRetry(
  url: string,
  options: { timeoutMs?: number; accept?: string; maxRetries?: number } = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 11000;
  const accept = options.accept ?? 'application/json';
  const maxRetries = options.maxRetries ?? 2;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept,
        },
      });
      clearTimeout(timer);

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const backoffMs = 350 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < maxRetries) {
        const backoffMs = 350 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed after retries');
}

function extractXmlTag(block: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeHtmlEntities(match[1]).trim() : '';
}

function extractAtomLink(block: string): string {
  const attrHref = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (attrHref && attrHref[1]) return decodeHtmlEntities(attrHref[1]).trim();
  return extractXmlTag(block, 'link');
}

export function parseRssOrAtomItems(xml: string): Array<{
  externalId: string;
  title: string;
  link: string;
  description: string;
  publishedAt: string;
  companyName?: string;
  location?: string;
  jobType?: string;
}> {
  const items: Array<{
    externalId: string;
    title: string;
    link: string;
    description: string;
    publishedAt: string;
    companyName?: string;
    location?: string;
    jobType?: string;
  }> = [];

  const rssMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of rssMatches) {
    const title = stripHtml(extractXmlTag(block, 'title'));
    const link = extractAtomLink(block);
    const guid = stripHtml(extractXmlTag(block, 'guid')) || link;
    const description =
      extractXmlTag(block, 'content:encoded') ||
      extractXmlTag(block, 'description') ||
      extractXmlTag(block, 'summary');
    const publishedAt = extractXmlTag(block, 'pubDate') || extractXmlTag(block, 'dc:date');
    const companyName =
      stripHtml(extractXmlTag(block, 'company')) ||
      stripHtml(extractXmlTag(block, 'dc:creator')) ||
      undefined;
    const location = stripHtml(extractXmlTag(block, 'location')) || undefined;
    const jobType = stripHtml(extractXmlTag(block, 'type')) || stripHtml(extractXmlTag(block, 'category')) || undefined;

    if (title && link) {
      items.push({
        externalId: stripHtml(extractXmlTag(block, 'jobId')) || guid,
        title,
        link,
        description,
        publishedAt,
        companyName,
        location,
        jobType,
      });
    }
  }

  if (items.length === 0) {
    const atomMatches = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
    for (const block of atomMatches) {
      const title = stripHtml(extractXmlTag(block, 'title'));
      const link = extractAtomLink(block);
      const id = stripHtml(extractXmlTag(block, 'id')) || link;
      const description = extractXmlTag(block, 'content') || extractXmlTag(block, 'summary');
      const publishedAt = extractXmlTag(block, 'published') || extractXmlTag(block, 'updated');
      const companyName = stripHtml(extractXmlTag(block, 'author')) || undefined;

      if (title && link) {
        items.push({ externalId: id, title, link, description, publishedAt, companyName });
      }
    }
  }

  return items;
}

const fetchGreenhouseAdapter: SourceAdapter = async (company) => {
  const startedMs = Date.now();
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.source_board_token)}/jobs?content=true`;
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      return {
        ok: false,
        companyId: company.id,
        companyName: company.name,
        sourcePlatform: company.source_platform,
        sourceUrl: url,
        fetchedAt,
        durationMs: Date.now() - startedMs,
        httpStatus: res.status,
        rawCount: 0,
        listings: [],
        error: `Greenhouse API returned HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { jobs?: Array<Record<string, any>> };
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const listings: StandardizedInternship[] = [];

    for (const job of jobs) {
      const title = String(job.title || '').trim();
      if (!title || !isInternshipTitle(title)) continue;

      const standardized = standardizeRawListing(company, {
        externalId: String(job.id),
        title,
        descriptionRaw: String(job.content || ''),
        locationRaw: job.location?.name ? String(job.location.name) : undefined,
        listingUrl: String(job.absolute_url || ''),
        publishedAtRaw: job.updated_at ? String(job.updated_at) : null,
      });
      if (standardized) listings.push(standardized);
    }

    return {
      ok: true,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      httpStatus: res.status,
      rawCount: jobs.length,
      listings,
    };
  } catch (err) {
    return {
      ok: false,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      rawCount: 0,
      listings: [],
      error: err instanceof Error ? err.message : 'Network error connecting to Greenhouse API',
    };
  }
};

const fetchLeverAdapter: SourceAdapter = async (company) => {
  const startedMs = Date.now();
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company.source_board_token)}?mode=json`;
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      return {
        ok: false,
        companyId: company.id,
        companyName: company.name,
        sourcePlatform: company.source_platform,
        sourceUrl: url,
        fetchedAt,
        durationMs: Date.now() - startedMs,
        httpStatus: res.status,
        rawCount: 0,
        listings: [],
        error: `Lever API returned HTTP ${res.status}`,
      };
    }

    const jobs = (await res.json()) as Array<Record<string, any>>;
    if (!Array.isArray(jobs)) {
      return {
        ok: false,
        companyId: company.id,
        companyName: company.name,
        sourcePlatform: company.source_platform,
        sourceUrl: url,
        fetchedAt,
        durationMs: Date.now() - startedMs,
        httpStatus: res.status,
        rawCount: 0,
        listings: [],
        error: 'Unexpected Lever API response format',
      };
    }

    const listings: StandardizedInternship[] = [];
    for (const job of jobs) {
      const title = String(job.text || '').trim();
      if (!title || !isInternshipTitle(title)) continue;

      const rawDesc = [
        job.descriptionPlain || job.description || '',
        ...(Array.isArray(job.lists) ? job.lists.map((l: any) => `${l.text}: ${l.content}`) : []),
      ].join('\n\n');

      const standardized = standardizeRawListing(company, {
        externalId: String(job.id),
        title,
        descriptionRaw: rawDesc,
        locationRaw: job.categories?.location ? String(job.categories.location) : undefined,
        workArrangementOverride: job.workplaceType ? String(job.workplaceType) : undefined,
        listingUrl: String(job.hostedUrl || ''),
        applicationUrl: String(job.applyUrl || job.hostedUrl || ''),
        publishedAtRaw: job.createdAt ?? null,
      });
      if (standardized) listings.push(standardized);
    }

    return {
      ok: true,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      httpStatus: res.status,
      rawCount: jobs.length,
      listings,
    };
  } catch (err) {
    return {
      ok: false,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      rawCount: 0,
      listings: [],
      error: err instanceof Error ? err.message : 'Network error connecting to Lever API',
    };
  }
};

const fetchAshbyAdapter: SourceAdapter = async (company) => {
  const startedMs = Date.now();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(company.source_board_token)}`;
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetchWithRetry(url, { timeoutMs: 12000 });
    if (!res.ok) {
      return {
        ok: false,
        companyId: company.id,
        companyName: company.name,
        sourcePlatform: company.source_platform,
        sourceUrl: url,
        fetchedAt,
        durationMs: Date.now() - startedMs,
        httpStatus: res.status,
        rawCount: 0,
        listings: [],
        error: `Ashby API returned HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { jobs?: Array<Record<string, any>> };
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const listings: StandardizedInternship[] = [];

    for (const job of jobs) {
      const title = String(job.title || '').trim();
      if (!title || !isInternshipTitle(title)) continue;

      const standardized = standardizeRawListing(company, {
        externalId: String(job.id),
        title,
        descriptionRaw: String(job.descriptionPlain || job.descriptionHtml || ''),
        locationRaw: job.location ? String(job.location) : undefined,
        workArrangementOverride: job.isRemote ? 'Remote' : undefined,
        listingUrl: String(job.jobUrl || ''),
        applicationUrl: String(job.applyUrl || job.jobUrl || ''),
        publishedAtRaw: job.publishedAt ? String(job.publishedAt) : null,
      });
      if (standardized) listings.push(standardized);
    }

    return {
      ok: true,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      httpStatus: res.status,
      rawCount: jobs.length,
      listings,
    };
  } catch (err) {
    return {
      ok: false,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      rawCount: 0,
      listings: [],
      error: err instanceof Error ? err.message : 'Network error connecting to Ashby API',
    };
  }
};

const fetchSmartRecruitersAdapter: SourceAdapter = async (company) => {
  const startedMs = Date.now();
  const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company.source_board_token)}/postings?limit=100`;
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) {
      return {
        ok: false,
        companyId: company.id,
        companyName: company.name,
        sourcePlatform: company.source_platform,
        sourceUrl: url,
        fetchedAt,
        durationMs: Date.now() - startedMs,
        httpStatus: res.status,
        rawCount: 0,
        listings: [],
        error: `SmartRecruiters API returned HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { content?: Array<Record<string, any>> };
    const jobs = Array.isArray(data.content) ? data.content : [];
    const listings: StandardizedInternship[] = [];

    for (const job of jobs) {
      const title = String(job.name || '').trim();
      if (!title || !isInternshipTitle(title)) continue;

      const jobId = String(job.id || job.uuid || '').trim();
      if (!jobId) continue;

      const listingUrl = `https://jobs.smartrecruiters.com/${encodeURIComponent(company.source_board_token)}/${encodeURIComponent(jobId)}`;
      const locParts = [job.location?.city, job.location?.region, job.location?.country].filter(Boolean);
      const dept = job.department?.label ? `Department: ${job.department.label}. ` : '';
      const exp = job.experienceLevel?.label ? `Experience Level: ${job.experienceLevel.label}. ` : '';
      const rawDesc = `${dept}${exp}Official opportunity published by ${company.name} via SmartRecruiters. Open the official posting URL for complete responsibilities and application instructions.`;

      const standardized = standardizeRawListing(company, {
        externalId: jobId,
        title,
        descriptionRaw: rawDesc,
        locationRaw: locParts.length > 0 ? locParts.join(', ') : undefined,
        workArrangementOverride: job.location?.remote ? 'Remote' : undefined,
        listingUrl,
        publishedAtRaw: job.releasedDate ? String(job.releasedDate) : null,
        eligibilityOverride: job.experienceLevel?.label || undefined,
        extraTextForSkillMatching: dept,
      });
      if (standardized) listings.push(standardized);
    }

    return {
      ok: true,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      httpStatus: res.status,
      rawCount: jobs.length,
      listings,
    };
  } catch (err) {
    return {
      ok: false,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      rawCount: 0,
      listings: [],
      error: err instanceof Error ? err.message : 'Network error connecting to SmartRecruiters API',
    };
  }
};

const fetchArbeitnowAdapter: SourceAdapter = async (company) => {
  const startedMs = Date.now();
  const url = 'https://www.arbeitnow.com/api/job-board-api';
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetchWithRetry(url, { timeoutMs: 12000 });
    if (!res.ok) {
      return {
        ok: false,
        companyId: company.id,
        companyName: company.name,
        sourcePlatform: company.source_platform,
        sourceUrl: url,
        fetchedAt,
        durationMs: Date.now() - startedMs,
        httpStatus: res.status,
        rawCount: 0,
        listings: [],
        error: `Arbeitnow API returned HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { data?: Array<Record<string, any>> };
    const jobs = Array.isArray(data.data) ? data.data : [];
    const listings: StandardizedInternship[] = [];

    for (const job of jobs) {
      const title = String(job.title || '').trim();
      const jobTypes = Array.isArray(job.job_types) ? job.job_types.join(' ') : '';
      if (!title || !isInternshipTitle(title, jobTypes)) continue;

      const standardized = standardizeRawListing(company, {
        externalId: String(job.slug || job.url),
        title,
        companyNameOverride: job.company_name ? String(job.company_name).trim() : company.name,
        descriptionRaw: String(job.description || ''),
        locationRaw: job.location ? String(job.location) : undefined,
        workArrangementOverride: job.remote ? 'Remote' : undefined,
        listingUrl: String(job.url || ''),
        publishedAtRaw: job.created_at ?? null,
        extraTextForSkillMatching: jobTypes,
      });
      if (standardized) listings.push(standardized);
    }

    return {
      ok: true,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      httpStatus: res.status,
      rawCount: jobs.length,
      listings,
    };
  } catch (err) {
    return {
      ok: false,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      rawCount: 0,
      listings: [],
      error: err instanceof Error ? err.message : 'Network error connecting to Arbeitnow API',
    };
  }
};

const fetchRssAtomFeedAdapter: SourceAdapter = async (company) => {
  const startedMs = Date.now();
  const url = company.source_board_token.trim();
  const fetchedAt = new Date().toISOString();

  if (!isValidHttpUrl(url)) {
    return {
      ok: false,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      rawCount: 0,
      listings: [],
      error: `Invalid RSS/Atom feed URL configured: ${url}`,
    };
  }

  try {
    const res = await fetchWithRetry(url, {
      timeoutMs: 12000,
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    });
    if (!res.ok) {
      return {
        ok: false,
        companyId: company.id,
        companyName: company.name,
        sourcePlatform: company.source_platform,
        sourceUrl: url,
        fetchedAt,
        durationMs: Date.now() - startedMs,
        httpStatus: res.status,
        rawCount: 0,
        listings: [],
        error: `Public RSS/Atom feed returned HTTP ${res.status}`,
      };
    }

    const xml = await res.text();
    const rawItems = parseRssOrAtomItems(xml);
    const listings: StandardizedInternship[] = [];

    for (const item of rawItems) {
      if (!isInternshipTitle(item.title, item.jobType || '')) continue;

      let resolvedCompany = item.companyName || company.name;
      if (!item.companyName) {
        const prefixMatch = item.title.match(/^([A-Z][A-Za-z0-9.& ]{1,36}?)\s*(?:\([^)]+\))?\s+(?:is hiring|seeks)\b/i);
        if (prefixMatch?.[1]) {
          resolvedCompany = prefixMatch[1].trim();
        }
      }

      const standardized = standardizeRawListing(company, {
        externalId: item.externalId,
        title: item.title,
        companyNameOverride: resolvedCompany,
        descriptionRaw: item.description,
        locationRaw: item.location,
        listingUrl: item.link,
        publishedAtRaw: item.publishedAt || null,
        extraTextForSkillMatching: item.jobType || '',
      });
      if (standardized) listings.push(standardized);
    }

    return {
      ok: true,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      httpStatus: res.status,
      rawCount: rawItems.length,
      listings,
    };
  } catch (err) {
    return {
      ok: false,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: url,
      fetchedAt,
      durationMs: Date.now() - startedMs,
      rawCount: 0,
      listings: [],
      error: err instanceof Error ? err.message : 'Network error reading public RSS/Atom feed',
    };
  }
};

export const SOURCE_ADAPTERS: Record<SourcePlatform, SourceAdapter> = {
  'Greenhouse Job Board API': fetchGreenhouseAdapter,
  'Lever Postings API': fetchLeverAdapter,
  'Ashby Public Job API': fetchAshbyAdapter,
  'SmartRecruiters Public API': fetchSmartRecruitersAdapter,
  'Arbeitnow Public Job API': fetchArbeitnowAdapter,
  'Official RSS/Atom Feed': fetchRssAtomFeedAdapter,
};

export function getSupportedAdapters(): Array<{ platform: SourcePlatform; kind: 'JSON API' | 'XML Feed' }> {
  return [
    { platform: 'Greenhouse Job Board API', kind: 'JSON API' },
    { platform: 'Lever Postings API', kind: 'JSON API' },
    { platform: 'Ashby Public Job API', kind: 'JSON API' },
    { platform: 'SmartRecruiters Public API', kind: 'JSON API' },
    { platform: 'Arbeitnow Public Job API', kind: 'JSON API' },
    { platform: 'Official RSS/Atom Feed', kind: 'XML Feed' },
  ];
}

export async function fetchAndStandardizeFromSource(company: SourceCompanyConfig): Promise<FeedFetchResult> {
  const adapter = SOURCE_ADAPTERS[company.source_platform as SourcePlatform];
  if (!adapter) {
    return {
      ok: false,
      companyId: company.id,
      companyName: company.name,
      sourcePlatform: company.source_platform,
      sourceUrl: company.careers_url,
      fetchedAt: new Date().toISOString(),
      durationMs: 0,
      rawCount: 0,
      listings: [],
      error: `Unsupported source adapter: ${company.source_platform}`,
    };
  }
  return adapter(company);
}

export async function fetchAndStandardizeBatch(
  companies: SourceCompanyConfig[],
  concurrency = 4
): Promise<FeedFetchResult[]> {
  const results: FeedFetchResult[] = [];
  for (let i = 0; i < companies.length; i += concurrency) {
    const batch = companies.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((c) => fetchAndStandardizeFromSource(c)));
    results.push(...batchResults);
  }
  return results;
}
