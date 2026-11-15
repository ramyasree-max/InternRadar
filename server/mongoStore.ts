import { MongoClient, type Db, type Filter, type Sort } from 'mongodb';
import { buildDemoSeedData, DEMO_EMAIL, DEMO_USER_ID, REAL_INTEGRATED_SOURCES } from './seedData.ts';
import type { SourceCompanyConfig } from './services/internshipFeedService.ts';
import {
  hashPassword,
  type ApplicationRecord,
  type ApplicationWithInternshipRecord,
  type CareerGoalRecord,
  type CollectionLogRecord,
  type CompanyRecord,
  type DatabaseStore,
  type IndustryNewsRecord,
  type InternshipQueryFilters,
  type InternshipRecord,
  type NotificationRecord,
  type SkillMatchRecord,
  type StudentActivityRecord,
  type StudentProfileRecord,
  type UserRecord,
  type VerificationHistoryRecord,
} from './storeTypes.ts';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ciContains(value: string): { $regex: string; $options: string } {
  return { $regex: escapeRegex(value), $options: 'i' };
}

function ciExact(value: string): { $regex: string; $options: string } {
  return { $regex: `^${escapeRegex(value)}$`, $options: 'i' };
}

export class MongoStore implements DatabaseStore {
  private client: MongoClient;
  private db!: Db;
  private uri: string;
  private dbName: string;

  constructor(uri: string, dbName: string) {
    this.uri = uri;
    this.dbName = dbName;
    this.client = new MongoClient(this.uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
  }

  private get users() {
    return this.db.collection<UserRecord>('users');
  }
  private get studentProfiles() {
    return this.db.collection<StudentProfileRecord>('student_profiles');
  }
  private get companies() {
    return this.db.collection<CompanyRecord>('companies');
  }
  private get internships() {
    return this.db.collection<InternshipRecord>('internships');
  }
  private get verificationHistory() {
    return this.db.collection<VerificationHistoryRecord>('internship_verification_history');
  }
  private get applications() {
    return this.db.collection<ApplicationRecord>('applications');
  }
  private get skillMatches() {
    return this.db.collection<SkillMatchRecord>('skill_matches');
  }
  private get careerGoals() {
    return this.db.collection<CareerGoalRecord>('career_goals');
  }
  private get studentActivity() {
    return this.db.collection<StudentActivityRecord>('student_activity');
  }
  private get industryNews() {
    return this.db.collection<IndustryNewsRecord>('industry_news');
  }
  private get notifications() {
    return this.db.collection<NotificationRecord>('notifications');
  }
  private get collectionLogs() {
    return this.db.collection<CollectionLogRecord>('collection_logs');
  }

  async init(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    await this.db.command({ ping: 1 });
    await this.ensureIndexes();
    await this.seedIntegratedSources();
    await this.seedDemoWorkspace();
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  private async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.users.createIndex({ id: 1 }, { unique: true }),
      this.users.createIndex({ email: 1 }, { unique: true }),
      this.studentProfiles.createIndex({ user_id: 1 }, { unique: true }),
      this.companies.createIndex({ id: 1 }, { unique: true }),
      this.companies.createIndex({ slug: 1 }, { unique: true }),
      this.companies.createIndex({ is_demo: 1, name: 1 }),
      this.internships.createIndex({ id: 1 }, { unique: true }),
      this.internships.createIndex({ source_platform: 1, external_id: 1 }, { unique: true }),
      this.internships.createIndex({ company_id: 1, verification_status: 1, is_demo: 1 }),
      this.internships.createIndex({ is_demo: 1, verification_status: 1, first_discovered_at: -1 }),
      this.verificationHistory.createIndex({ id: 1 }, { unique: true }),
      this.verificationHistory.createIndex({ internship_id: 1, checked_at: -1 }),
      this.applications.createIndex({ id: 1 }, { unique: true }),
      this.applications.createIndex({ user_id: 1, updated_at: -1 }),
      this.applications.createIndex({ user_id: 1, internship_id: 1 }),
      this.skillMatches.createIndex({ id: 1 }, { unique: true }),
      this.skillMatches.createIndex({ user_id: 1, internship_id: 1 }, { unique: true }),
      this.careerGoals.createIndex({ id: 1 }, { unique: true }),
      this.careerGoals.createIndex({ user_id: 1, completed: 1, created_at: -1 }),
      this.studentActivity.createIndex({ id: 1 }, { unique: true }),
      this.studentActivity.createIndex({ user_id: 1, created_at: -1 }),
      this.industryNews.createIndex({ id: 1 }, { unique: true }),
      this.industryNews.createIndex({ external_id: 1 }, { unique: true }),
      this.industryNews.createIndex({ category: 1, published_at: -1 }),
      this.notifications.createIndex({ id: 1 }, { unique: true }),
      this.notifications.createIndex({ user_id: 1, created_at: -1 }),
      this.collectionLogs.createIndex({ id: 1 }, { unique: true }),
      this.collectionLogs.createIndex({ finished_at: -1 }),
    ]);
  }

  private async seedIntegratedSources(): Promise<void> {
    if (REAL_INTEGRATED_SOURCES.length === 0) return;
    await this.companies.bulkWrite(
      REAL_INTEGRATED_SOURCES.map((c) => ({
        updateOne: {
          filter: { id: c.id },
          update: {
            $set: { sector: c.sector },
            $setOnInsert: {
              id: c.id,
              name: c.name,
              slug: c.slug,
              logo_url: '',
              website_url: c.website_url,
              careers_url: c.careers_url,
              source_platform: c.source_platform,
              source_board_token: c.source_board_token,
              integration_status: 'Verification Required',
              last_checked_at: null,
              last_success_at: null,
              last_result_summary: 'Scheduled for initial source verification',
              is_demo: 0,
            },
          },
          upsert: true,
        },
      }))
    );
  }

  private async seedDemoWorkspace(): Promise<void> {
    const seed = buildDemoSeedData();
    const existingUser = await this.users.findOne({ email: DEMO_EMAIL }, { projection: { _id: 0, id: 1 } });

    if (!existingUser) {
      await this.users.insertOne({
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        password_hash: hashPassword('DemoStudent2026!'),
        role: 'student',
        is_demo: 1,
        reset_token: null,
        reset_expires: null,
        created_at: seed.nowIso,
      });

      await this.studentProfiles.insertOne(seed.demoProfile);

      for (const g of seed.demoGoals) {
        await this.careerGoals.updateOne(
          { id: g.id },
          {
            $setOnInsert: {
              id: g.id,
              user_id: DEMO_USER_ID,
              title: g.title,
              category: g.category,
              target_count: g.target,
              current_count: g.current,
              period: g.period,
              completed: g.completed,
              created_at: seed.nowIso,
              updated_at: seed.nowIso,
            },
          },
          { upsert: true }
        );
      }

      for (const a of seed.demoActivities) {
        await this.studentActivity.updateOne(
          { id: a.id },
          {
            $setOnInsert: {
              id: a.id,
              user_id: DEMO_USER_ID,
              activity_type: a.type,
              description: a.desc,
              skill_practised: a.skill,
              minutes_spent: a.mins,
              created_at: a.createdAt,
            },
          },
          { upsert: true }
        );
      }
    }

    await this.companies.updateOne(
      { id: 'comp_demo_northstar' },
      {
        $setOnInsert: {
          id: 'comp_demo_northstar',
          name: 'Northstar Cloud (DEMO)',
          slug: 'demo-northstar',
          sector: 'Startup',
          logo_url: '',
          website_url: 'https://example.com',
          careers_url: 'https://example.com/careers',
          source_platform: 'DEMO Sample Dataset',
          source_board_token: 'demo',
          integration_status: 'Operational',
          last_checked_at: seed.nowIso,
          last_success_at: seed.nowIso,
          last_result_summary: 'Sample DEMO dataset for preview',
          is_demo: 1,
        },
      },
      { upsert: true }
    );

    for (const job of seed.demoJobs) {
      await this.internships.updateOne(
        { id: job.id },
        {
          $setOnInsert: {
            id: job.id,
            company_id: 'comp_demo_northstar',
            company_name: 'Northstar Cloud (DEMO)',
            sector: 'Startup',
            external_id: job.ext,
            title: job.title,
            normalized_title: job.title.toLowerCase(),
            category: job.cat,
            description: job.desc,
            required_skills_json: JSON.stringify(job.req),
            preferred_skills_json: JSON.stringify(job.pref),
            eligibility: job.elig,
            stipend_text: job.stipend,
            stipend_min: job.stipendMin,
            paid_type: job.paid,
            location: job.loc,
            work_arrangement: job.arr,
            source_platform: 'DEMO Sample Dataset',
            original_listing_url: 'https://example.com/demo-listing',
            original_application_url: 'https://example.com/demo-apply',
            published_at: seed.nowIso,
            deadline_at: job.deadlineIso,
            first_discovered_at: seed.nowIso,
            last_updated_at: seed.nowIso,
            last_verified_at: seed.nowIso,
            verification_status: 'Verified Open',
            content_hash: job.hash,
            is_demo: 1,
          },
        },
        { upsert: true }
      );
    }

    await this.applications.updateOne(
      { id: 'app_demo_1' },
      {
        $setOnInsert: {
          id: 'app_demo_1',
          user_id: DEMO_USER_ID,
          internship_id: 'demo_intern_1',
          company_name: 'Northstar Cloud (DEMO)',
          internship_title: '[DEMO] Frontend Engineering Intern — Design Systems',
          status: 'Applied',
          applied_date: seed.nowIso.slice(0, 10),
          notes: 'Submitted portfolio link featuring Campus Transit Live Tracker.',
          important_dates: 'Technical screen window opens next week',
          follow_up_date: seed.followUpDate,
          created_at: seed.nowIso,
          updated_at: seed.nowIso,
        },
      },
      { upsert: true }
    );

    await this.notifications.updateOne(
      { id: 'notif_demo_welcome' },
      {
        $setOnInsert: {
          id: 'notif_demo_welcome',
          user_id: DEMO_USER_ID,
          type: 'welcome',
          title: 'Welcome to InternRadar',
          message:
            'Your career workspace is active. Complete your skill profile or run an AI Skill Match on any verified internship.',
          related_internship_id: null,
          is_read: 0,
          created_at: seed.nowIso,
        },
      },
      { upsert: true }
    );
  }

  // Auth & Profiles
  async findAuthUserById(id: string) {
    return this.users.findOne({ id }, { projection: { _id: 0, id: 1, email: 1, is_demo: 1 } });
  }

  async findUserByIdWithHash(id: string) {
    return this.users.findOne(
      { id },
      { projection: { _id: 0, id: 1, email: 1, password_hash: 1, is_demo: 1 } }
    );
  }

  async findUserByEmail(email: string) {
    return this.users.findOne({ email }, { projection: { _id: 0 } });
  }

  async createStudentAccount(input: {
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
  }): Promise<StudentProfileRecord> {
    await this.users.insertOne({
      id: input.userId,
      email: input.email,
      password_hash: input.passwordHash,
      role: 'student',
      is_demo: 0,
      reset_token: null,
      reset_expires: null,
      created_at: input.nowIso,
    });

    const profile: StudentProfileRecord = {
      user_id: input.userId,
      name: input.name,
      education_level: input.educationLevel,
      college: input.college,
      degree_branch: input.degreeBranch,
      graduation_year: input.graduationYear,
      skills_json: input.skillsJson,
      languages_json: input.languagesJson,
      projects_json: input.projectsJson,
      preferred_roles_json: input.preferredRolesJson,
      preferred_locations_json: input.preferredLocationsJson,
      work_arrangement: input.workArrangement,
      preferred_categories_json: input.preferredCategoriesJson,
      notification_prefs_json: JSON.stringify({
        newMatches: true,
        updates: true,
        deadlines: true,
        weeklySummary: true,
        emailEnabled: false,
        browserPushEnabled: false,
      }),
      privacy_public: 0,
      updated_at: input.nowIso,
    };
    await this.studentProfiles.insertOne(profile);

    await this.notifications.insertOne({
      id: input.welcomeNotificationId,
      user_id: input.userId,
      type: 'welcome',
      title: 'Welcome to InternRadar',
      message:
        'Your student account is ready. Explore live MNC, Private, Government, and Startup internships or set your first weekly goal in Motivation.',
      related_internship_id: null,
      is_read: 0,
      created_at: input.nowIso,
    });

    return profile;
  }

  async setResetToken(userId: string, code: string, expiresAt: number): Promise<void> {
    await this.users.updateOne({ id: userId }, { $set: { reset_token: code, reset_expires: expiresAt } });
  }

  async resetUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.users.updateOne(
      { id: userId },
      { $set: { password_hash: passwordHash, reset_token: null, reset_expires: null } }
    );
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.users.updateOne({ id: userId }, { $set: { password_hash: passwordHash } });
  }

  async getStudentProfile(userId: string): Promise<StudentProfileRecord | null> {
    return this.studentProfiles.findOne({ user_id: userId }, { projection: { _id: 0 } });
  }

  async updateStudentProfile(
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
  ): Promise<StudentProfileRecord | null> {
    await this.studentProfiles.updateOne({ user_id: userId }, { $set: updates });
    return this.getStudentProfile(userId);
  }

  async clearUserSkillMatches(userId: string): Promise<void> {
    await this.skillMatches.deleteMany({ user_id: userId });
  }

  async listAllStudentNotificationTargets() {
    return this.studentProfiles
      .find({}, { projection: { _id: 0, user_id: 1, skills_json: 1, languages_json: 1, notification_prefs_json: 1 } })
      .toArray();
  }

  // Internships, Companies, Transparency
  async queryInternships(filters: InternshipQueryFilters) {
    const andClauses: Filter<InternshipRecord>[] = [];

    if (!filters.includeDemo) {
      andClauses.push({ is_demo: 0 });
    }

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'Verified Open') {
        andClauses.push({ verification_status: { $in: ['Verified Open', 'Closing Soon'] } });
      } else {
        andClauses.push({ verification_status: filters.status });
      }
    }

    if (filters.sector && filters.sector !== 'All') {
      andClauses.push({ sector: filters.sector });
    }

    if (filters.q) {
      const rx = ciContains(filters.q);
      andClauses.push({ $or: [{ title: rx }, { company_name: rx }, { description: rx }] });
    }

    if (filters.company) {
      andClauses.push({ company_name: ciContains(filters.company) });
    }

    if (filters.skill) {
      const rx = ciContains(filters.skill);
      andClauses.push({
        $or: [{ required_skills_json: rx }, { preferred_skills_json: rx }, { description: rx }],
      });
    }

    if (filters.location) {
      andClauses.push({ location: ciContains(filters.location) });
    }

    if (filters.category && filters.category !== 'All') {
      andClauses.push({ category: filters.category });
    }

    if (filters.arrangement && filters.arrangement !== 'All') {
      andClauses.push({ work_arrangement: ciExact(filters.arrangement) });
    }

    if (filters.paidType && filters.paidType !== 'All') {
      andClauses.push({ paid_type: ciExact(filters.paidType) });
    }

    if (filters.stipendMin !== undefined && !Number.isNaN(filters.stipendMin)) {
      andClauses.push({ stipend_min: { $gte: filters.stipendMin } });
    }

    const mongoFilter: Filter<InternshipRecord> = andClauses.length > 0 ? { $and: andClauses } : {};
    const total = await this.internships.countDocuments(mongoFilter);

    let rows: InternshipRecord[];
    if (filters.sort === 'closing_soon') {
      rows = await this.internships
        .aggregate<InternshipRecord>([
          { $match: mongoFilter },
          {
            $addFields: {
              _hasNullDeadline: { $cond: [{ $eq: ['$deadline_at', null] }, 1, 0] },
            },
          },
          { $sort: { _hasNullDeadline: 1, deadline_at: 1, last_verified_at: -1 } },
          { $limit: 500 },
          { $project: { _id: 0, _hasNullDeadline: 0 } },
        ])
        .toArray();
    } else {
      const sortSpec: Sort =
        filters.sort === 'recently_updated' ? { last_updated_at: -1 } : { first_discovered_at: -1 };
      rows = await this.internships
        .find(mongoFilter, { projection: { _id: 0 } })
        .sort(sortSpec)
        .limit(500)
        .toArray();
    }

    const sectorMatch: Filter<InternshipRecord> = {
      verification_status: { $in: ['Verified Open', 'Closing Soon'] },
      ...(filters.includeDemo ? {} : { is_demo: 0 }),
    };

    const sectorAgg = await this.internships
      .aggregate<{ _id: string; count: number }>([
        { $match: sectorMatch },
        { $group: { _id: '$sector', count: { $sum: 1 } } },
      ])
      .toArray();

    const sectorCounts: Record<string, number> = { MNC: 0, Private: 0, Government: 0, Startup: 0 };
    for (const s of sectorAgg) {
      if (s._id) sectorCounts[s._id] = s.count;
    }

    return { rows, total, sectorCounts };
  }

  async findInternshipById(id: string): Promise<InternshipRecord | null> {
    return this.internships.findOne({ id }, { projection: { _id: 0 } });
  }

  async findCompanyById(id: string): Promise<CompanyRecord | null> {
    return this.companies.findOne({ id }, { projection: { _id: 0 } });
  }

  async listVerificationHistory(internshipId: string, limit: number): Promise<VerificationHistoryRecord[]> {
    return this.verificationHistory
      .find({ internship_id: internshipId }, { projection: { _id: 0 } })
      .sort({ checked_at: -1 })
      .limit(limit)
      .toArray();
  }

  async listCompaniesWithOpenCounts(options: { includeDemo: boolean; sector: string }) {
    const companyFilter: Filter<CompanyRecord> = {};
    if (!options.includeDemo) companyFilter.is_demo = 0;
    if (options.sector !== 'All') companyFilter.sector = options.sector;

    const companies = await this.companies.find(companyFilter, { projection: { _id: 0 } }).toArray();

    const openCountsAgg = await this.internships
      .aggregate<{ _id: { company_id: string; is_demo: number }; count: number }>([
        { $match: { verification_status: { $in: ['Verified Open', 'Closing Soon'] } } },
        { $group: { _id: { company_id: '$company_id', is_demo: '$is_demo' }, count: { $sum: 1 } } },
      ])
      .toArray();

    const countMap = new Map<string, number>();
    for (const row of openCountsAgg) {
      countMap.set(`${row._id.company_id}:${row._id.is_demo}`, row.count);
    }

    return companies
      .map((c) => ({
        ...c,
        verified_open_count: countMap.get(`${c.id}:${c.is_demo}`) ?? 0,
      }))
      .sort((a, b) => b.verified_open_count - a.verified_open_count || a.name.localeCompare(b.name));
  }

  async getTransparencyStats() {
    const companies = await this.companies
      .find({ is_demo: 0 }, { projection: { _id: 0 } })
      .sort({ name: 1 })
      .toArray();

    const openCountsAgg = await this.internships
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            is_demo: 0,
            verification_status: { $in: ['Verified Open', 'Closing Soon'] },
          },
        },
        { $group: { _id: '$company_id', count: { $sum: 1 } } },
      ])
      .toArray();

    const openMap = new Map<string, number>(openCountsAgg.map((r) => [r._id, r.count]));
    const companiesWithCounts = companies.map((c) => ({
      ...c,
      verified_open_count: openMap.get(c.id) ?? 0,
    }));

    const supportedJobSources = new Set(companies.map((c) => c.source_platform)).size;

    let lastSuccessfulCollectionAt: string | null = null;
    for (const c of companies) {
      if (c.last_success_at && (!lastSuccessfulCollectionAt || c.last_success_at > lastSuccessfulCollectionAt)) {
        lastSuccessfulCollectionAt = c.last_success_at;
      }
    }

    const sourcesTemporarilyUnavailable = companies.filter((c) =>
      ['Temporarily Unavailable', 'Collection Failed'].includes(c.integration_status)
    ).length;

    const verifiedOpenInternships = await this.internships.countDocuments({
      is_demo: 0,
      verification_status: { $in: ['Verified Open', 'Closing Soon'] },
    });

    const recentLogs = await this.collectionLogs
      .find({}, { projection: { _id: 0 } })
      .sort({ finished_at: -1 })
      .limit(30)
      .toArray();

    return {
      companies: companiesWithCounts,
      supportedJobSources,
      lastSuccessfulCollectionAt,
      sourcesTemporarilyUnavailable,
      verifiedOpenInternships,
      recentLogs,
    };
  }

  // Collector
  async listNonDemoCompanies(): Promise<SourceCompanyConfig[]> {
    return this.companies.find({ is_demo: 0 }, { projection: { _id: 0 } }).sort({ name: 1 }).toArray();
  }

  async markCompanyUnavailable(companyId: string, finishedAt: string, errorMsg: string): Promise<void> {
    await this.companies.updateOne(
      { id: companyId },
      {
        $set: {
          integration_status: 'Temporarily Unavailable',
          last_checked_at: finishedAt,
          last_result_summary: errorMsg,
        },
      }
    );
    await this.internships.updateMany(
      {
        company_id: companyId,
        is_demo: 0,
        verification_status: { $in: ['Verified Open', 'Closing Soon'] },
      },
      { $set: { verification_status: 'Source Temporarily Unavailable' } }
    );
  }

  async insertCollectionLog(log: CollectionLogRecord): Promise<void> {
    await this.collectionLogs.insertOne(log);
  }

  async findInternshipByExternal(sourcePlatform: string, externalId: string) {
    return this.internships.findOne(
      { source_platform: sourcePlatform, external_id: externalId },
      { projection: { _id: 0, id: 1, content_hash: 1, verification_status: 1 } }
    );
  }

  async findNonDemoDuplicateByTitle(companyId: string, normalizedTitle: string, location: string) {
    return this.internships.findOne(
      {
        company_id: companyId,
        normalized_title: normalizedTitle,
        location,
        is_demo: 0,
      },
      { projection: { _id: 0, id: 1, verification_status: 1 } }
    );
  }

  async touchInternshipVerified(id: string, verifiedAt: string): Promise<void> {
    const current = await this.internships.findOne({ id }, { projection: { _id: 0, verification_status: 1 } });
    const nextStatus = current?.verification_status === 'Closing Soon' ? 'Closing Soon' : 'Verified Open';
    await this.internships.updateOne(
      { id },
      { $set: { last_verified_at: verifiedAt, verification_status: nextStatus } }
    );
  }

  async createInternshipWithHistory(input: {
    id: string;
    companyId: string;
    sourcePlatform: string;
    item: import('./services/internshipFeedService.ts').StandardizedInternship;
    verifiedAt: string;
    historyId: string;
    httpStatus: number;
  }): Promise<void> {
    const { item, verifiedAt } = input;
    await this.internships.insertOne({
      id: input.id,
      company_id: input.companyId,
      company_name: item.companyName,
      sector: item.sector,
      external_id: item.externalId,
      title: item.title,
      normalized_title: item.normalizedTitle,
      category: item.category,
      description: item.description,
      required_skills_json: JSON.stringify(item.requiredSkills),
      preferred_skills_json: JSON.stringify(item.preferredSkills),
      eligibility: item.eligibility,
      stipend_text: item.stipendText,
      stipend_min: item.stipendMin,
      paid_type: item.paidType,
      location: item.location,
      work_arrangement: item.workArrangement,
      source_platform: input.sourcePlatform,
      original_listing_url: item.originalListingUrl,
      original_application_url: item.originalApplicationUrl,
      published_at: item.publishedAt,
      deadline_at: null,
      first_discovered_at: verifiedAt,
      last_updated_at: verifiedAt,
      last_verified_at: verifiedAt,
      verification_status: 'Verified Open',
      content_hash: item.contentHash,
      is_demo: 0,
    });

    await this.verificationHistory.insertOne({
      id: input.historyId,
      internship_id: input.id,
      checked_at: verifiedAt,
      previous_status: null,
      new_status: 'Verified Open',
      change_summary: 'Initial discovery, standardization, and URL verification passed',
      http_status: input.httpStatus,
    });
  }

  async updateInternshipFromSource(input: {
    id: string;
    item: import('./services/internshipFeedService.ts').StandardizedInternship;
    changed: boolean;
    verifiedAt: string;
  }): Promise<void> {
    const current = await this.internships.findOne(
      { id: input.id },
      { projection: { _id: 0, verification_status: 1, last_updated_at: 1 } }
    );
    const nextStatus = current?.verification_status === 'Closing Soon' ? 'Closing Soon' : 'Verified Open';
    const nextUpdatedAt = input.changed ? input.verifiedAt : current?.last_updated_at || input.verifiedAt;
    const { item } = input;

    await this.internships.updateOne(
      { id: input.id },
      {
        $set: {
          company_name: item.companyName,
          sector: item.sector,
          title: item.title,
          normalized_title: item.normalizedTitle,
          category: item.category,
          description: item.description,
          required_skills_json: JSON.stringify(item.requiredSkills),
          preferred_skills_json: JSON.stringify(item.preferredSkills),
          eligibility: item.eligibility,
          stipend_text: item.stipendText,
          stipend_min: item.stipendMin,
          paid_type: item.paidType,
          location: item.location,
          work_arrangement: item.workArrangement,
          original_listing_url: item.originalListingUrl,
          original_application_url: item.originalApplicationUrl,
          last_updated_at: nextUpdatedAt,
          last_verified_at: input.verifiedAt,
          verification_status: nextStatus,
          content_hash: item.contentHash,
        },
      }
    );
  }

  async insertVerificationHistory(entry: VerificationHistoryRecord): Promise<void> {
    await this.verificationHistory.insertOne(entry);
  }

  async listPreviouslyOpenInternships(companyId: string) {
    return this.internships
      .find(
        {
          company_id: companyId,
          is_demo: 0,
          verification_status: { $in: ['Verified Open', 'Closing Soon', 'Source Temporarily Unavailable'] },
        },
        { projection: { _id: 0, id: 1, verification_status: 1 } }
      )
      .toArray();
  }

  async markInternshipClosed(id: string, finishedAt: string): Promise<void> {
    await this.internships.updateOne({ id }, { $set: { verification_status: 'Closed', last_verified_at: finishedAt } });
  }

  async markCompanyOperational(companyId: string, finishedAt: string, summaryMsg: string): Promise<void> {
    await this.companies.updateOne(
      { id: companyId },
      {
        $set: {
          integration_status: 'Operational',
          last_checked_at: finishedAt,
          last_success_at: finishedAt,
          last_result_summary: summaryMsg,
        },
      }
    );
  }

  async listApproachingDeadlines(nowIso: string, fiveDaysFromNowIso: string) {
    const docs = await this.internships
      .find(
        {
          is_demo: 0,
          deadline_at: { $ne: null, $gte: nowIso, $lte: fiveDaysFromNowIso },
          verification_status: { $in: ['Verified Open', 'Closing Soon'] },
        },
        { projection: { _id: 0, id: 1, company_name: 1, title: 1, deadline_at: 1, verification_status: 1 } }
      )
      .toArray();
    return docs.map((d) => ({
      id: d.id,
      company_name: d.company_name,
      title: d.title,
      deadline_at: d.deadline_at || '',
      verification_status: d.verification_status,
    }));
  }

  async setInternshipClosingSoon(id: string): Promise<void> {
    await this.internships.updateOne({ id }, { $set: { verification_status: 'Closing Soon' } });
  }

  async listTrackersForDeadline(internshipId: string) {
    const apps = await this.applications
      .find({ internship_id: internshipId, status: { $in: ['Saved', 'Applied'] } }, { projection: { _id: 0, user_id: 1 } })
      .toArray();
    if (apps.length === 0) return [];
    const userIds = Array.from(new Set(apps.map((a) => a.user_id)));
    const profiles = await this.studentProfiles
      .find({ user_id: { $in: userIds } }, { projection: { _id: 0, user_id: 1, notification_prefs_json: 1 } })
      .toArray();
    const profMap = new Map(profiles.map((p) => [p.user_id, p.notification_prefs_json]));
    return apps
      .filter((a) => profMap.has(a.user_id))
      .map((a) => ({ user_id: a.user_id, notification_prefs_json: profMap.get(a.user_id) || '{}' }));
  }

  async hasNotification(userId: string, relatedInternshipId: string, type: string): Promise<boolean> {
    const found = await this.notifications.findOne(
      { user_id: userId, related_internship_id: relatedInternshipId, type },
      { projection: { _id: 0, id: 1 } }
    );
    return Boolean(found);
  }

  async createNotification(notif: NotificationRecord): Promise<void> {
    await this.notifications.insertOne(notif);
  }

  // Applications & Skill Matches
  async getUserAppStatuses(userId: string) {
    const rows = await this.applications
      .find({ user_id: userId, internship_id: { $ne: null } }, { projection: { _id: 0, internship_id: 1, status: 1 } })
      .toArray();
    return rows
      .filter((r) => typeof r.internship_id === 'string' && r.internship_id.length > 0)
      .map((r) => ({ internship_id: r.internship_id as string, status: r.status }));
  }

  async findApplicationByUserAndInternship(userId: string, internshipId: string) {
    return this.applications.findOne({ user_id: userId, internship_id: internshipId }, { projection: { _id: 0 } });
  }

  async listApplicationsWithInternship(userId: string): Promise<ApplicationWithInternshipRecord[]> {
    const apps = await this.applications
      .find({ user_id: userId }, { projection: { _id: 0 } })
      .sort({ updated_at: -1 })
      .toArray();

    const internshipIds = Array.from(
      new Set(apps.map((a) => a.internship_id).filter((id): id is string => Boolean(id)))
    );

    const internshipDocs =
      internshipIds.length > 0
        ? await this.internships
            .find(
              { id: { $in: internshipIds } },
              {
                projection: {
                  _id: 0,
                  id: 1,
                  original_application_url: 1,
                  verification_status: 1,
                  location: 1,
                  is_demo: 1,
                },
              }
            )
            .toArray()
        : [];
    const jobMap = new Map(internshipDocs.map((j) => [j.id, j]));

    return apps.map((a) => {
      const job = a.internship_id ? jobMap.get(a.internship_id) : undefined;
      return {
        ...a,
        original_application_url: job?.original_application_url || null,
        verification_status: job?.verification_status || null,
        location: job?.location || null,
        is_demo: job?.is_demo ?? 0,
      };
    });
  }

  async createOrUpdateApplicationForInternship(input: {
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
  }): Promise<{ application: ApplicationRecord; created: boolean }> {
    if (input.internshipId) {
      const existing = await this.applications.findOne(
        { user_id: input.userId, internship_id: input.internshipId },
        { projection: { _id: 0 } }
      );
      if (existing) {
        await this.applications.updateOne(
          { id: existing.id },
          { $set: { status: input.status, updated_at: input.nowIso } }
        );
        const updated = await this.applications.findOne({ id: existing.id }, { projection: { _id: 0 } });
        return { application: updated!, created: false };
      }
    }

    const doc: ApplicationRecord = {
      id: input.id,
      user_id: input.userId,
      internship_id: input.internshipId,
      company_name: input.companyName,
      internship_title: input.internshipTitle,
      status: input.status,
      applied_date: input.appliedDate,
      notes: input.notes,
      important_dates: input.importantDates,
      follow_up_date: input.followUpDate,
      created_at: input.nowIso,
      updated_at: input.nowIso,
    };
    await this.applications.insertOne(doc);
    return { application: doc, created: true };
  }

  async findApplicationByIdForUser(id: string, userId: string): Promise<ApplicationRecord | null> {
    return this.applications.findOne({ id, user_id: userId }, { projection: { _id: 0 } });
  }

  async updateApplicationById(
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
  ): Promise<ApplicationRecord | null> {
    await this.applications.updateOne({ id, user_id: userId }, { $set: updates });
    return this.applications.findOne({ id, user_id: userId }, { projection: { _id: 0 } });
  }

  async deleteApplicationById(id: string, userId: string): Promise<boolean> {
    const res = await this.applications.deleteOne({ id, user_id: userId });
    return res.deletedCount > 0;
  }

  async getCachedSkillMatch(userId: string, internshipId: string): Promise<SkillMatchRecord | null> {
    return this.skillMatches.findOne({ user_id: userId, internship_id: internshipId }, { projection: { _id: 0 } });
  }

  async upsertSkillMatch(record: SkillMatchRecord): Promise<void> {
    await this.skillMatches.updateOne(
      { user_id: record.user_id, internship_id: record.internship_id },
      {
        $set: {
          match_percentage: record.match_percentage,
          matching_skills_json: record.matching_skills_json,
          missing_skills_json: record.missing_skills_json,
          required_skills_json: record.required_skills_json,
          preferred_skills_json: record.preferred_skills_json,
          eligibility_warnings_json: record.eligibility_warnings_json,
          learning_resources_json: record.learning_resources_json,
          project_suggestions_json: record.project_suggestions_json,
          explanation: record.explanation,
          used_ai: record.used_ai,
          computed_at: record.computed_at,
        },
        $setOnInsert: {
          id: record.id,
          user_id: record.user_id,
          internship_id: record.internship_id,
        },
      },
      { upsert: true }
    );
  }

  // Dashboard, Growth, News, Notifications
  async getDashboardContext(userId: string, includeDemo: boolean, sevenDaysAgoIso: string) {
    const openFilter: Filter<InternshipRecord> = {
      verification_status: { $in: ['Verified Open', 'Closing Soon'] },
      ...(includeDemo ? {} : { is_demo: 0 }),
    };

    const [
      profile,
      totalOpenCount,
      openInternships,
      allRequiredSkillRows,
      applications,
      weeklyActivities,
      goals,
      notifications,
    ] = await Promise.all([
      this.studentProfiles.findOne({ user_id: userId }, { projection: { _id: 0 } }),
      this.internships.countDocuments(openFilter),
      this.internships.find(openFilter, { projection: { _id: 0 } }).sort({ first_discovered_at: -1 }).limit(200).toArray(),
      this.internships.find(openFilter, { projection: { _id: 0, required_skills_json: 1 } }).toArray(),
      this.applications.find({ user_id: userId }, { projection: { _id: 0 } }).toArray(),
      this.studentActivity
        .find({ user_id: userId, created_at: { $gte: sevenDaysAgoIso } }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .toArray(),
      this.careerGoals.find({ user_id: userId }, { projection: { _id: 0 } }).toArray(),
      this.notifications
        .find({ user_id: userId }, { projection: { _id: 0 } })
        .sort({ created_at: -1 })
        .limit(6)
        .toArray(),
    ]);

    return {
      profile,
      totalOpenCount,
      openInternships,
      allRequiredSkillRows,
      applications,
      weeklyActivities,
      goals,
      notifications,
    };
  }

  async listOpenRequiredSkills(includeDemo: boolean) {
    const filter: Filter<InternshipRecord> = {
      verification_status: { $in: ['Verified Open', 'Closing Soon'] },
      ...(includeDemo ? {} : { is_demo: 0 }),
    };
    return this.internships.find(filter, { projection: { _id: 0, required_skills_json: 1 } }).toArray();
  }

  async getGrowthContext(userId: string) {
    const [profile, goals, activities, applicationStatuses, allActivityDates] = await Promise.all([
      this.studentProfiles.findOne({ user_id: userId }, { projection: { _id: 0 } }),
      this.careerGoals.find({ user_id: userId }, { projection: { _id: 0 } }).sort({ completed: 1, created_at: -1 }).toArray(),
      this.studentActivity.find({ user_id: userId }, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(100).toArray(),
      this.applications.find({ user_id: userId }, { projection: { _id: 0, status: 1 } }).toArray(),
      this.studentActivity.find({ user_id: userId }, { projection: { _id: 0, created_at: 1 } }).toArray(),
    ]);

    const daySet = new Set(allActivityDates.map((a) => String(a.created_at).slice(0, 10)).filter(Boolean));
    const activityDaysAsc = Array.from(daySet).sort();
    const activityDaysDesc = [...activityDaysAsc].reverse();

    return {
      profile,
      goals,
      activities,
      applicationStatuses,
      activityDaysAsc,
      activityDaysDesc,
    };
  }

  async createCareerGoal(goal: CareerGoalRecord): Promise<void> {
    await this.careerGoals.insertOne(goal);
  }

  async findCareerGoalByIdForUser(id: string, userId: string): Promise<CareerGoalRecord | null> {
    return this.careerGoals.findOne({ id, user_id: userId }, { projection: { _id: 0 } });
  }

  async updateCareerGoal(id: string, currentCount: number, completed: number, updatedAt: string): Promise<void> {
    await this.careerGoals.updateOne(
      { id },
      { $set: { current_count: currentCount, completed, updated_at: updatedAt } }
    );
  }

  async deleteCareerGoal(id: string, userId: string): Promise<void> {
    await this.careerGoals.deleteOne({ id, user_id: userId });
  }

  async createStudentActivity(activity: StudentActivityRecord): Promise<void> {
    await this.studentActivity.insertOne(activity);
  }

  async listIndustryNews(category: string, limit: number): Promise<IndustryNewsRecord[]> {
    const filter: Filter<IndustryNewsRecord> = category !== 'All' ? { category } : {};
    return this.industryNews
      .find(filter, { projection: { _id: 0 } })
      .sort({ published_at: -1 })
      .limit(limit)
      .toArray();
  }

  async hasIndustryNewsByExternalId(externalId: string): Promise<boolean> {
    const found = await this.industryNews.findOne({ external_id: externalId }, { projection: { _id: 0, id: 1 } });
    return Boolean(found);
  }

  async insertIndustryNewsIfNew(article: IndustryNewsRecord): Promise<void> {
    await this.industryNews.updateOne(
      { external_id: article.external_id },
      { $setOnInsert: article },
      { upsert: true }
    );
  }

  async listNotifications(userId: string, limit: number): Promise<NotificationRecord[]> {
    return this.notifications
      .find({ user_id: userId }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  async markNotificationRead(id: string, userId: string): Promise<void> {
    await this.notifications.updateOne({ id, user_id: userId }, { $set: { is_read: 1 } });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.notifications.updateMany({ user_id: userId }, { $set: { is_read: 1 } });
  }
}
