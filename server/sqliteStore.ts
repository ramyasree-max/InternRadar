import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { buildDemoSeedData, DEMO_EMAIL, DEMO_USER_ID, REAL_INTEGRATED_SOURCES } from './seedData.ts';
import type { SourceCompanyConfig, StandardizedInternship } from './services/internshipFeedService.ts';
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

export class SqliteStore implements DatabaseStore {
  private db!: Database.Database;

  async init(): Promise<void> {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'internradar.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        is_demo INTEGER NOT NULL DEFAULT 0,
        reset_token TEXT,
        reset_expires INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS student_profiles (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        education_level TEXT DEFAULT '',
        college TEXT DEFAULT '',
        degree_branch TEXT DEFAULT '',
        graduation_year TEXT DEFAULT '',
        skills_json TEXT NOT NULL DEFAULT '[]',
        languages_json TEXT NOT NULL DEFAULT '[]',
        projects_json TEXT NOT NULL DEFAULT '[]',
        preferred_roles_json TEXT NOT NULL DEFAULT '[]',
        preferred_locations_json TEXT NOT NULL DEFAULT '[]',
        work_arrangement TEXT DEFAULT 'Any',
        preferred_categories_json TEXT NOT NULL DEFAULT '[]',
        notification_prefs_json TEXT NOT NULL DEFAULT '{"newMatches":true,"updates":true,"deadlines":true,"weeklySummary":true,"emailEnabled":false,"browserPushEnabled":false}',
        privacy_public INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        sector TEXT NOT NULL DEFAULT 'Private',
        logo_url TEXT DEFAULT '',
        website_url TEXT NOT NULL,
        careers_url TEXT NOT NULL,
        source_platform TEXT NOT NULL,
        source_board_token TEXT NOT NULL,
        integration_status TEXT NOT NULL DEFAULT 'Connected',
        last_checked_at TEXT,
        last_success_at TEXT,
        last_result_summary TEXT DEFAULT 'Pending initial verification',
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS internships (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        company_name TEXT NOT NULL,
        sector TEXT NOT NULL DEFAULT 'Private',
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        normalized_title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Software Engineering',
        description TEXT NOT NULL,
        required_skills_json TEXT NOT NULL DEFAULT '[]',
        preferred_skills_json TEXT NOT NULL DEFAULT '[]',
        eligibility TEXT NOT NULL DEFAULT 'Not specified',
        stipend_text TEXT NOT NULL DEFAULT 'Not specified',
        stipend_min INTEGER,
        paid_type TEXT NOT NULL DEFAULT 'Not specified',
        location TEXT NOT NULL DEFAULT 'Not specified',
        work_arrangement TEXT NOT NULL DEFAULT 'Not specified',
        source_platform TEXT NOT NULL,
        original_listing_url TEXT NOT NULL,
        original_application_url TEXT NOT NULL,
        published_at TEXT,
        deadline_at TEXT,
        first_discovered_at TEXT NOT NULL,
        last_updated_at TEXT NOT NULL,
        last_verified_at TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'Verified Open',
        content_hash TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0,
        UNIQUE(source_platform, external_id)
      );

      CREATE TABLE IF NOT EXISTS internship_verification_history (
        id TEXT PRIMARY KEY,
        internship_id TEXT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
        checked_at TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        change_summary TEXT NOT NULL,
        http_status INTEGER
      );

      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        internship_id TEXT REFERENCES internships(id) ON DELETE SET NULL,
        company_name TEXT NOT NULL,
        internship_title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Saved',
        applied_date TEXT,
        notes TEXT DEFAULT '',
        important_dates TEXT DEFAULT '',
        follow_up_date TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skill_matches (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        internship_id TEXT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
        match_percentage INTEGER NOT NULL,
        matching_skills_json TEXT NOT NULL DEFAULT '[]',
        missing_skills_json TEXT NOT NULL DEFAULT '[]',
        required_skills_json TEXT NOT NULL DEFAULT '[]',
        preferred_skills_json TEXT NOT NULL DEFAULT '[]',
        eligibility_warnings_json TEXT NOT NULL DEFAULT '[]',
        learning_resources_json TEXT NOT NULL DEFAULT '[]',
        project_suggestions_json TEXT NOT NULL DEFAULT '[]',
        explanation TEXT NOT NULL,
        used_ai INTEGER NOT NULL DEFAULT 0,
        computed_at TEXT NOT NULL,
        UNIQUE(user_id, internship_id)
      );

      CREATE TABLE IF NOT EXISTS career_goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Technical Skill',
        target_count INTEGER NOT NULL DEFAULT 1,
        current_count INTEGER NOT NULL DEFAULT 0,
        period TEXT NOT NULL DEFAULT 'weekly',
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS student_activity (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL,
        description TEXT NOT NULL,
        skill_practised TEXT DEFAULT '',
        minutes_spent INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS industry_news (
        id TEXT PRIMARY KEY,
        external_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        publisher TEXT NOT NULL,
        category TEXT NOT NULL,
        published_at TEXT NOT NULL,
        original_url TEXT NOT NULL,
        raw_excerpt TEXT NOT NULL,
        ai_summary TEXT NOT NULL,
        why_it_matters TEXT NOT NULL,
        related_skills_json TEXT NOT NULL DEFAULT '[]',
        fetched_at TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_internship_id TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collection_logs (
        id TEXT PRIMARY KEY,
        company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
        company_name TEXT NOT NULL,
        source_platform TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        status TEXT NOT NULL,
        discovered_count INTEGER NOT NULL DEFAULT 0,
        updated_count INTEGER NOT NULL DEFAULT 0,
        closed_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT DEFAULT ''
      );
    `);

    this.ensureColumn('companies', 'sector', "TEXT NOT NULL DEFAULT 'Private'");
    this.ensureColumn('internships', 'sector', "TEXT NOT NULL DEFAULT 'Private'");

    this.seedIntegratedSources();
    this.seedDemoWorkspace();
  }

  async close(): Promise<void> {
    this.db?.close();
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }

  private seedIntegratedSources() {
    const insertCompany = this.db.prepare(`
      INSERT INTO companies (
        id, name, slug, sector, logo_url, website_url, careers_url, source_platform,
        source_board_token, integration_status, last_result_summary, is_demo
      ) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, 'Verification Required', 'Scheduled for initial source verification', 0)
      ON CONFLICT(id) DO UPDATE SET sector = excluded.sector
    `);

    for (const c of REAL_INTEGRATED_SOURCES) {
      insertCompany.run(
        c.id,
        c.name,
        c.slug,
        c.sector,
        c.website_url,
        c.careers_url,
        c.source_platform,
        c.source_board_token
      );
    }
  }

  private seedDemoWorkspace() {
    const seed = buildDemoSeedData();
    const existingUser = this.db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as
      | { id: string }
      | undefined;

    if (!existingUser) {
      this.db
        .prepare(`INSERT INTO users (id, email, password_hash, role, is_demo, created_at) VALUES (?, ?, ?, 'student', 1, ?)`)
        .run(DEMO_USER_ID, DEMO_EMAIL, hashPassword('DemoStudent2026!'), seed.nowIso);

      const p = seed.demoProfile;
      this.db
        .prepare(`
          INSERT INTO student_profiles (
            user_id, name, education_level, college, degree_branch, graduation_year,
            skills_json, languages_json, projects_json, preferred_roles_json,
            preferred_locations_json, work_arrangement, preferred_categories_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          p.user_id,
          p.name,
          p.education_level,
          p.college,
          p.degree_branch,
          p.graduation_year,
          p.skills_json,
          p.languages_json,
          p.projects_json,
          p.preferred_roles_json,
          p.preferred_locations_json,
          p.work_arrangement,
          p.preferred_categories_json,
          p.updated_at
        );

      for (const g of seed.demoGoals) {
        this.db
          .prepare(`
            INSERT OR IGNORE INTO career_goals (id, user_id, title, category, target_count, current_count, period, completed, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(g.id, DEMO_USER_ID, g.title, g.category, g.target, g.current, g.period, g.completed, seed.nowIso, seed.nowIso);
      }

      for (const a of seed.demoActivities) {
        this.db
          .prepare(`
            INSERT OR IGNORE INTO student_activity (id, user_id, activity_type, description, skill_practised, minutes_spent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .run(a.id, DEMO_USER_ID, a.type, a.desc, a.skill, a.mins, a.createdAt);
      }
    }

    const demoCompanyCheck = this.db.prepare('SELECT id FROM companies WHERE id = ?').get('comp_demo_northstar');
    if (!demoCompanyCheck) {
      this.db
        .prepare(`
          INSERT INTO companies (
            id, name, slug, sector, website_url, careers_url, source_platform,
            source_board_token, integration_status, last_checked_at, last_success_at, last_result_summary, is_demo
          ) VALUES (?, ?, ?, 'Startup', ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `)
        .run(
          'comp_demo_northstar',
          'Northstar Cloud (DEMO)',
          'demo-northstar',
          'https://example.com',
          'https://example.com/careers',
          'DEMO Sample Dataset',
          'demo',
          'Operational',
          seed.nowIso,
          seed.nowIso,
          'Sample DEMO dataset for preview'
        );
    }

    const insertDemoJob = this.db.prepare(`
      INSERT OR IGNORE INTO internships (
        id, company_id, company_name, sector, external_id, title, normalized_title, category,
        description, required_skills_json, preferred_skills_json, eligibility,
        stipend_text, stipend_min, paid_type, location, work_arrangement,
        source_platform, original_listing_url, original_application_url,
        published_at, deadline_at, first_discovered_at, last_updated_at, last_verified_at,
        verification_status, content_hash, is_demo
      ) VALUES (?, 'comp_demo_northstar', 'Northstar Cloud (DEMO)', 'Startup', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DEMO Sample Dataset', 'https://example.com/demo-listing', 'https://example.com/demo-apply', ?, ?, ?, ?, ?, 'Verified Open', ?, 1)
    `);

    for (const job of seed.demoJobs) {
      insertDemoJob.run(
        job.id,
        job.ext,
        job.title,
        job.title.toLowerCase(),
        job.cat,
        job.desc,
        JSON.stringify(job.req),
        JSON.stringify(job.pref),
        job.elig,
        job.stipend,
        job.stipendMin,
        job.paid,
        job.loc,
        job.arr,
        seed.nowIso,
        job.deadlineIso,
        seed.nowIso,
        seed.nowIso,
        seed.nowIso,
        job.hash
      );
    }

    this.db
      .prepare(`
        INSERT OR IGNORE INTO applications (
          id, user_id, internship_id, company_name, internship_title, status, applied_date, notes, important_dates, follow_up_date, created_at, updated_at
        ) VALUES (?, ?, 'demo_intern_1', 'Northstar Cloud (DEMO)', '[DEMO] Frontend Engineering Intern — Design Systems', 'Applied', ?, 'Submitted portfolio link featuring Campus Transit Live Tracker.', 'Technical screen window opens next week', ?, ?, ?)
      `)
      .run('app_demo_1', DEMO_USER_ID, seed.nowIso.slice(0, 10), seed.followUpDate, seed.nowIso, seed.nowIso);

    this.db
      .prepare(`
        INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, related_internship_id, is_read, created_at)
        VALUES (?, ?, 'welcome', 'Welcome to InternRadar', 'Your career workspace is active. Complete your skill profile or run an AI Skill Match on any verified internship.', NULL, 0, ?)
      `)
      .run('notif_demo_welcome', DEMO_USER_ID, seed.nowIso);
  }

  async findAuthUserById(id: string) {
    return (
      (this.db.prepare('SELECT id, email, is_demo FROM users WHERE id = ?').get(id) as
        | { id: string; email: string; is_demo: number }
        | undefined) ?? null
    );
  }

  async findUserByIdWithHash(id: string) {
    return (
      (this.db.prepare('SELECT id, email, password_hash, is_demo FROM users WHERE id = ?').get(id) as
        | { id: string; email: string; password_hash: string; is_demo: number }
        | undefined) ?? null
    );
  }

  async findUserByEmail(email: string) {
    return (this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRecord | undefined) ?? null;
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
    this.db
      .prepare(`INSERT INTO users (id, email, password_hash, role, is_demo, created_at) VALUES (?, ?, ?, 'student', 0, ?)`)
      .run(input.userId, input.email, input.passwordHash, input.nowIso);

    this.db
      .prepare(`
        INSERT INTO student_profiles (
          user_id, name, education_level, college, degree_branch, graduation_year,
          skills_json, languages_json, projects_json, preferred_roles_json,
          preferred_locations_json, work_arrangement, preferred_categories_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.userId,
        input.name,
        input.educationLevel,
        input.college,
        input.degreeBranch,
        input.graduationYear,
        input.skillsJson,
        input.languagesJson,
        input.projectsJson,
        input.preferredRolesJson,
        input.preferredLocationsJson,
        input.workArrangement,
        input.preferredCategoriesJson,
        input.nowIso
      );

    this.db
      .prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, related_internship_id, is_read, created_at)
        VALUES (?, ?, 'welcome', 'Welcome to InternRadar', 'Your student account is ready. Explore live MNC, Private, Government, and Startup internships or set your first weekly goal in Motivation.', NULL, 0, ?)
      `)
      .run(input.welcomeNotificationId, input.userId, input.nowIso);

    return this.db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(input.userId) as StudentProfileRecord;
  }

  async setResetToken(userId: string, code: string, expiresAt: number) {
    this.db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(code, expiresAt, userId);
  }

  async resetUserPassword(userId: string, passwordHash: string) {
    this.db
      .prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?')
      .run(passwordHash, userId);
  }

  async updateUserPassword(userId: string, passwordHash: string) {
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  }

  async getStudentProfile(userId: string) {
    return (
      (this.db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(userId) as
        | StudentProfileRecord
        | undefined) ?? null
    );
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
  ) {
    this.db
      .prepare(`
        UPDATE student_profiles
        SET name = ?, education_level = ?, college = ?, degree_branch = ?, graduation_year = ?,
            skills_json = ?, languages_json = ?, projects_json = ?, preferred_roles_json = ?,
            preferred_locations_json = ?, work_arrangement = ?, preferred_categories_json = ?,
            notification_prefs_json = ?, privacy_public = ?, updated_at = ?
        WHERE user_id = ?
      `)
      .run(
        updates.name,
        updates.education_level,
        updates.college,
        updates.degree_branch,
        updates.graduation_year,
        updates.skills_json,
        updates.languages_json,
        updates.projects_json,
        updates.preferred_roles_json,
        updates.preferred_locations_json,
        updates.work_arrangement,
        updates.preferred_categories_json,
        updates.notification_prefs_json,
        updates.privacy_public,
        updates.updated_at,
        userId
      );
    return this.getStudentProfile(userId);
  }

  async clearUserSkillMatches(userId: string) {
    this.db.prepare('DELETE FROM skill_matches WHERE user_id = ?').run(userId);
  }

  async listAllStudentNotificationTargets() {
    return this.db
      .prepare('SELECT user_id, skills_json, languages_json, notification_prefs_json FROM student_profiles')
      .all() as Array<{
      user_id: string;
      skills_json: string;
      languages_json: string;
      notification_prefs_json: string;
    }>;
  }

  async queryInternships(filters: InternshipQueryFilters) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (!filters.includeDemo) {
      where.push('is_demo = 0');
    }
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'Verified Open') {
        where.push(`verification_status IN ('Verified Open', 'Closing Soon')`);
      } else {
        where.push('verification_status = ?');
        params.push(filters.status);
      }
    }
    if (filters.sector && filters.sector !== 'All') {
      where.push('sector = ?');
      params.push(filters.sector);
    }
    if (filters.q) {
      where.push('(LOWER(title) LIKE ? OR LOWER(company_name) LIKE ? OR LOWER(description) LIKE ?)');
      const like = `%${filters.q.toLowerCase()}%`;
      params.push(like, like, like);
    }
    if (filters.company) {
      where.push('LOWER(company_name) LIKE ?');
      params.push(`%${filters.company.toLowerCase()}%`);
    }
    if (filters.skill) {
      where.push('(LOWER(required_skills_json) LIKE ? OR LOWER(preferred_skills_json) LIKE ? OR LOWER(description) LIKE ?)');
      const like = `%${filters.skill.toLowerCase()}%`;
      params.push(like, like, like);
    }
    if (filters.location) {
      where.push('LOWER(location) LIKE ?');
      params.push(`%${filters.location.toLowerCase()}%`);
    }
    if (filters.category && filters.category !== 'All') {
      where.push('category = ?');
      params.push(filters.category);
    }
    if (filters.arrangement && filters.arrangement !== 'All') {
      where.push('LOWER(work_arrangement) = ?');
      params.push(filters.arrangement.toLowerCase());
    }
    if (filters.paidType && filters.paidType !== 'All') {
      where.push('LOWER(paid_type) = ?');
      params.push(filters.paidType.toLowerCase());
    }
    if (filters.stipendMin !== undefined && !Number.isNaN(filters.stipendMin)) {
      where.push('stipend_min >= ?');
      params.push(filters.stipendMin);
    }

    let orderBy = 'first_discovered_at DESC';
    if (filters.sort === 'recently_updated') orderBy = 'last_updated_at DESC';
    else if (filters.sort === 'closing_soon') {
      orderBy = 'CASE WHEN deadline_at IS NULL THEN 1 ELSE 0 END, deadline_at ASC, last_verified_at DESC';
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS count FROM internships ${whereClause}`)
      .get(...params) as { count: number };

    const rows = this.db
      .prepare(`SELECT * FROM internships ${whereClause} ORDER BY ${orderBy} LIMIT 500`)
      .all(...params) as InternshipRecord[];

    const sectorCountsRows = this.db
      .prepare(
        `SELECT sector, COUNT(*) as count FROM internships WHERE verification_status IN ('Verified Open', 'Closing Soon') ${filters.includeDemo ? '' : 'AND is_demo = 0'} GROUP BY sector`
      )
      .all() as Array<{ sector: string; count: number }>;

    const sectorCounts: Record<string, number> = { MNC: 0, Private: 0, Government: 0, Startup: 0 };
    for (const r of sectorCountsRows) {
      sectorCounts[r.sector] = r.count;
    }

    return { rows, total: totalRow.count, sectorCounts };
  }

  async findInternshipById(id: string) {
    return (this.db.prepare('SELECT * FROM internships WHERE id = ?').get(id) as InternshipRecord | undefined) ?? null;
  }

  async findCompanyById(id: string) {
    return (this.db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as CompanyRecord | undefined) ?? null;
  }

  async listVerificationHistory(internshipId: string, limit: number) {
    return this.db
      .prepare('SELECT * FROM internship_verification_history WHERE internship_id = ? ORDER BY checked_at DESC LIMIT ?')
      .all(internshipId, limit) as VerificationHistoryRecord[];
  }

  async listCompaniesWithOpenCounts(options: { includeDemo: boolean; sector: string }) {
    const filters: string[] = [];
    const params: unknown[] = [];
    if (!options.includeDemo) filters.push('c.is_demo = 0');
    if (options.sector !== 'All') {
      filters.push('c.sector = ?');
      params.push(options.sector);
    }

    return this.db
      .prepare(
        `SELECT c.*,
          (SELECT COUNT(*) FROM internships i WHERE i.company_id = c.id AND i.verification_status IN ('Verified Open', 'Closing Soon') AND i.is_demo = c.is_demo) AS verified_open_count
         FROM companies c
         ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
         ORDER BY verified_open_count DESC, c.name ASC`
      )
      .all(...params) as Array<CompanyRecord & { verified_open_count: number }>;
  }

  async getTransparencyStats() {
    const companies = this.db
      .prepare(
        `SELECT c.*,
          (SELECT COUNT(*) FROM internships i WHERE i.company_id = c.id AND i.is_demo = 0 AND i.verification_status IN ('Verified Open', 'Closing Soon')) AS verified_open_count
         FROM companies c
         WHERE c.is_demo = 0
         ORDER BY c.name ASC`
      )
      .all() as Array<CompanyRecord & { verified_open_count: number }>;

    const sourcePlatforms = this.db
      .prepare(`SELECT COUNT(DISTINCT source_platform) AS count FROM companies WHERE is_demo = 0`)
      .get() as { count: number };

    const lastSuccessRow = this.db
      .prepare(`SELECT MAX(last_success_at) AS last_success FROM companies WHERE is_demo = 0`)
      .get() as { last_success: string | null };

    const unavailableCountRow = this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM companies WHERE is_demo = 0 AND integration_status IN ('Temporarily Unavailable', 'Collection Failed')`
      )
      .get() as { count: number };

    const verifiedOpenRow = this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM internships WHERE is_demo = 0 AND verification_status IN ('Verified Open', 'Closing Soon')`
      )
      .get() as { count: number };

    const recentLogs = this.db
      .prepare(`SELECT * FROM collection_logs ORDER BY finished_at DESC LIMIT 30`)
      .all() as CollectionLogRecord[];

    return {
      companies,
      supportedJobSources: sourcePlatforms.count,
      lastSuccessfulCollectionAt: lastSuccessRow.last_success,
      sourcesTemporarilyUnavailable: unavailableCountRow.count,
      verifiedOpenInternships: verifiedOpenRow.count,
      recentLogs,
    };
  }

  async listNonDemoCompanies() {
    return this.db.prepare('SELECT * FROM companies WHERE is_demo = 0 ORDER BY name ASC').all() as SourceCompanyConfig[];
  }

  async markCompanyUnavailable(companyId: string, finishedAt: string, errorMsg: string) {
    this.db
      .prepare(`UPDATE companies SET integration_status = 'Temporarily Unavailable', last_checked_at = ?, last_result_summary = ? WHERE id = ?`)
      .run(finishedAt, errorMsg, companyId);
    this.db
      .prepare(`UPDATE internships SET verification_status = 'Source Temporarily Unavailable' WHERE company_id = ? AND is_demo = 0 AND verification_status IN ('Verified Open', 'Closing Soon')`)
      .run(companyId);
  }

  async insertCollectionLog(log: CollectionLogRecord) {
    this.db
      .prepare(`
        INSERT INTO collection_logs (id, company_id, company_name, source_platform, started_at, finished_at, status, discovered_count, updated_count, closed_count, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        log.id,
        log.company_id,
        log.company_name,
        log.source_platform,
        log.started_at,
        log.finished_at,
        log.status,
        log.discovered_count,
        log.updated_count,
        log.closed_count,
        log.error_message
      );
  }

  async findInternshipByExternal(sourcePlatform: string, externalId: string) {
    return (
      (this.db
        .prepare(`SELECT id, content_hash, verification_status FROM internships WHERE source_platform = ? AND external_id = ?`)
        .get(sourcePlatform, externalId) as
        | { id: string; content_hash: string; verification_status: string }
        | undefined) ?? null
    );
  }

  async findNonDemoDuplicateByTitle(companyId: string, normalizedTitle: string, location: string) {
    return (
      (this.db
        .prepare(`SELECT id, verification_status FROM internships WHERE company_id = ? AND normalized_title = ? AND location = ? AND is_demo = 0`)
        .get(companyId, normalizedTitle, location) as
        | { id: string; verification_status: string }
        | undefined) ?? null
    );
  }

  async touchInternshipVerified(id: string, verifiedAt: string) {
    this.db
      .prepare(`UPDATE internships SET last_verified_at = ?, verification_status = CASE WHEN verification_status = 'Closing Soon' THEN 'Closing Soon' ELSE 'Verified Open' END WHERE id = ?`)
      .run(verifiedAt, id);
  }

  async createInternshipWithHistory(input: {
    id: string;
    companyId: string;
    sourcePlatform: string;
    item: StandardizedInternship;
    verifiedAt: string;
    historyId: string;
    httpStatus: number;
  }) {
    const { item, verifiedAt } = input;
    this.db
      .prepare(`
        INSERT INTO internships (
          id, company_id, company_name, sector, external_id, title, normalized_title, category,
          description, required_skills_json, preferred_skills_json, eligibility,
          stipend_text, stipend_min, paid_type, location, work_arrangement,
          source_platform, original_listing_url, original_application_url,
          published_at, deadline_at, first_discovered_at, last_updated_at, last_verified_at,
          verification_status, content_hash, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'Verified Open', ?, 0)
      `)
      .run(
        input.id,
        input.companyId,
        item.companyName,
        item.sector,
        item.externalId,
        item.title,
        item.normalizedTitle,
        item.category,
        item.description,
        JSON.stringify(item.requiredSkills),
        JSON.stringify(item.preferredSkills),
        item.eligibility,
        item.stipendText,
        item.stipendMin,
        item.paidType,
        item.location,
        item.workArrangement,
        input.sourcePlatform,
        item.originalListingUrl,
        item.originalApplicationUrl,
        item.publishedAt,
        verifiedAt,
        verifiedAt,
        verifiedAt,
        item.contentHash
      );

    this.db
      .prepare(`
        INSERT INTO internship_verification_history (id, internship_id, checked_at, previous_status, new_status, change_summary, http_status)
        VALUES (?, ?, ?, NULL, 'Verified Open', 'Initial discovery, standardization, and URL verification passed', ?)
      `)
      .run(input.historyId, input.id, verifiedAt, input.httpStatus);
  }

  async updateInternshipFromSource(input: {
    id: string;
    item: StandardizedInternship;
    changed: boolean;
    verifiedAt: string;
  }) {
    const { item, changed, verifiedAt } = input;
    this.db
      .prepare(`
        UPDATE internships
        SET company_name = ?, sector = ?, title = ?, normalized_title = ?, category = ?,
            description = ?, required_skills_json = ?, preferred_skills_json = ?, eligibility = ?,
            stipend_text = ?, stipend_min = ?, paid_type = ?, location = ?, work_arrangement = ?,
            original_listing_url = ?, original_application_url = ?,
            last_updated_at = CASE WHEN ? = 1 THEN ? ELSE last_updated_at END,
            last_verified_at = ?,
            verification_status = CASE WHEN verification_status = 'Closing Soon' THEN 'Closing Soon' ELSE 'Verified Open' END,
            content_hash = ?
        WHERE id = ?
      `)
      .run(
        item.companyName,
        item.sector,
        item.title,
        item.normalizedTitle,
        item.category,
        item.description,
        JSON.stringify(item.requiredSkills),
        JSON.stringify(item.preferredSkills),
        item.eligibility,
        item.stipendText,
        item.stipendMin,
        item.paidType,
        item.location,
        item.workArrangement,
        item.originalListingUrl,
        item.originalApplicationUrl,
        changed ? 1 : 0,
        verifiedAt,
        verifiedAt,
        item.contentHash,
        input.id
      );
  }

  async insertVerificationHistory(entry: VerificationHistoryRecord) {
    this.db
      .prepare(`
        INSERT INTO internship_verification_history (id, internship_id, checked_at, previous_status, new_status, change_summary, http_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.id,
        entry.internship_id,
        entry.checked_at,
        entry.previous_status,
        entry.new_status,
        entry.change_summary,
        entry.http_status
      );
  }

  async listPreviouslyOpenInternships(companyId: string) {
    return this.db
      .prepare(
        `SELECT id, verification_status FROM internships WHERE company_id = ? AND is_demo = 0 AND verification_status IN ('Verified Open', 'Closing Soon', 'Source Temporarily Unavailable')`
      )
      .all(companyId) as Array<{ id: string; verification_status: string }>;
  }

  async markInternshipClosed(id: string, finishedAt: string) {
    this.db.prepare(`UPDATE internships SET verification_status = 'Closed', last_verified_at = ? WHERE id = ?`).run(finishedAt, id);
  }

  async markCompanyOperational(companyId: string, finishedAt: string, summaryMsg: string) {
    this.db
      .prepare(`UPDATE companies SET integration_status = 'Operational', last_checked_at = ?, last_success_at = ?, last_result_summary = ? WHERE id = ?`)
      .run(finishedAt, finishedAt, summaryMsg, companyId);
  }

  async listApproachingDeadlines(nowIso: string, fiveDaysFromNowIso: string) {
    return this.db
      .prepare(
        `SELECT id, company_name, title, deadline_at, verification_status
         FROM internships
         WHERE is_demo = 0 AND deadline_at IS NOT NULL AND deadline_at >= ? AND deadline_at <= ?
           AND verification_status IN ('Verified Open', 'Closing Soon')`
      )
      .all(nowIso, fiveDaysFromNowIso) as Array<{
      id: string;
      company_name: string;
      title: string;
      deadline_at: string;
      verification_status: string;
    }>;
  }

  async setInternshipClosingSoon(id: string) {
    this.db.prepare(`UPDATE internships SET verification_status = 'Closing Soon' WHERE id = ?`).run(id);
  }

  async listTrackersForDeadline(internshipId: string) {
    return this.db
      .prepare(
        `SELECT a.user_id, sp.notification_prefs_json
         FROM applications a
         JOIN student_profiles sp ON sp.user_id = a.user_id
         WHERE a.internship_id = ? AND a.status IN ('Saved', 'Applied')`
      )
      .all(internshipId) as Array<{ user_id: string; notification_prefs_json: string }>;
  }

  async hasNotification(userId: string, relatedInternshipId: string, type: string) {
    const found = this.db
      .prepare(`SELECT id FROM notifications WHERE user_id = ? AND related_internship_id = ? AND type = ? LIMIT 1`)
      .get(userId, relatedInternshipId, type);
    return Boolean(found);
  }

  async createNotification(notif: NotificationRecord) {
    this.db
      .prepare(`INSERT INTO notifications (id, user_id, type, title, message, related_internship_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        notif.id,
        notif.user_id,
        notif.type,
        notif.title,
        notif.message,
        notif.related_internship_id,
        notif.is_read,
        notif.created_at
      );
  }

  async getUserAppStatuses(userId: string) {
    return this.db
      .prepare('SELECT internship_id, status FROM applications WHERE user_id = ? AND internship_id IS NOT NULL')
      .all(userId) as Array<{ internship_id: string; status: string }>;
  }

  async findApplicationByUserAndInternship(userId: string, internshipId: string) {
    return (
      (this.db
        .prepare('SELECT * FROM applications WHERE user_id = ? AND internship_id = ?')
        .get(userId, internshipId) as ApplicationRecord | undefined) ?? null
    );
  }

  async listApplicationsWithInternship(userId: string) {
    return this.db
      .prepare(`
        SELECT a.*, i.original_application_url, i.verification_status, i.location, COALESCE(i.is_demo, 0) AS is_demo
        FROM applications a
        LEFT JOIN internships i ON a.internship_id = i.id
        WHERE a.user_id = ?
        ORDER BY a.updated_at DESC
      `)
      .all(userId) as ApplicationWithInternshipRecord[];
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
      const existing = this.db
        .prepare('SELECT id FROM applications WHERE user_id = ? AND internship_id = ?')
        .get(input.userId, input.internshipId) as { id: string } | undefined;
      if (existing) {
        this.db.prepare('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?').run(input.status, input.nowIso, existing.id);
        const updated = this.db.prepare('SELECT * FROM applications WHERE id = ?').get(existing.id) as ApplicationRecord;
        return { application: updated, created: false };
      }
    }

    this.db
      .prepare(`
        INSERT INTO applications (
          id, user_id, internship_id, company_name, internship_title, status,
          applied_date, notes, important_dates, follow_up_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.id,
        input.userId,
        input.internshipId,
        input.companyName,
        input.internshipTitle,
        input.status,
        input.appliedDate,
        input.notes,
        input.importantDates,
        input.followUpDate,
        input.nowIso,
        input.nowIso
      );

    const created = this.db.prepare('SELECT * FROM applications WHERE id = ?').get(input.id) as ApplicationRecord;
    return { application: created, created: true };
  }

  async findApplicationByIdForUser(id: string, userId: string) {
    return (
      (this.db.prepare('SELECT * FROM applications WHERE id = ? AND user_id = ?').get(id, userId) as
        | ApplicationRecord
        | undefined) ?? null
    );
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
  ) {
    this.db
      .prepare(`
        UPDATE applications
        SET status = ?, applied_date = ?, notes = ?, important_dates = ?, follow_up_date = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `)
      .run(
        updates.status,
        updates.applied_date,
        updates.notes,
        updates.important_dates,
        updates.follow_up_date,
        updates.updated_at,
        id,
        userId
      );
    return this.findApplicationByIdForUser(id, userId);
  }

  async deleteApplicationById(id: string, userId: string) {
    const info = this.db.prepare('DELETE FROM applications WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  }

  async getCachedSkillMatch(userId: string, internshipId: string) {
    return (
      (this.db
        .prepare('SELECT * FROM skill_matches WHERE user_id = ? AND internship_id = ?')
        .get(userId, internshipId) as SkillMatchRecord | undefined) ?? null
    );
  }

  async upsertSkillMatch(record: SkillMatchRecord) {
    this.db
      .prepare(`
        INSERT INTO skill_matches (
          id, user_id, internship_id, match_percentage, matching_skills_json, missing_skills_json,
          required_skills_json, preferred_skills_json, eligibility_warnings_json,
          learning_resources_json, project_suggestions_json, explanation, used_ai, computed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, internship_id) DO UPDATE SET
          match_percentage = excluded.match_percentage,
          matching_skills_json = excluded.matching_skills_json,
          missing_skills_json = excluded.missing_skills_json,
          required_skills_json = excluded.required_skills_json,
          preferred_skills_json = excluded.preferred_skills_json,
          eligibility_warnings_json = excluded.eligibility_warnings_json,
          learning_resources_json = excluded.learning_resources_json,
          project_suggestions_json = excluded.project_suggestions_json,
          explanation = excluded.explanation,
          used_ai = excluded.used_ai,
          computed_at = excluded.computed_at
      `)
      .run(
        record.id,
        record.user_id,
        record.internship_id,
        record.match_percentage,
        record.matching_skills_json,
        record.missing_skills_json,
        record.required_skills_json,
        record.preferred_skills_json,
        record.eligibility_warnings_json,
        record.learning_resources_json,
        record.project_suggestions_json,
        record.explanation,
        record.used_ai,
        record.computed_at
      );
  }

  async getDashboardContext(userId: string, includeDemo: boolean, sevenDaysAgoIso: string) {
    const demoFilter = includeDemo ? '' : 'AND is_demo = 0';
    const profile = await this.getStudentProfile(userId);
    const totalOpenRow = this.db
      .prepare(`SELECT COUNT(*) AS count FROM internships WHERE verification_status IN ('Verified Open', 'Closing Soon') ${demoFilter}`)
      .get() as { count: number };
    const openInternships = this.db
      .prepare(`SELECT * FROM internships WHERE verification_status IN ('Verified Open', 'Closing Soon') ${demoFilter} ORDER BY first_discovered_at DESC LIMIT 200`)
      .all() as InternshipRecord[];
    const allRequiredSkillRows = this.db
      .prepare(`SELECT required_skills_json FROM internships WHERE verification_status IN ('Verified Open', 'Closing Soon') ${demoFilter}`)
      .all() as Array<{ required_skills_json: string }>;
    const applications = this.db.prepare('SELECT * FROM applications WHERE user_id = ?').all(userId) as ApplicationRecord[];
    const weeklyActivities = this.db
      .prepare('SELECT * FROM student_activity WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC')
      .all(userId, sevenDaysAgoIso) as StudentActivityRecord[];
    const goals = this.db.prepare('SELECT * FROM career_goals WHERE user_id = ?').all(userId) as CareerGoalRecord[];
    const notifications = this.db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 6')
      .all(userId) as NotificationRecord[];

    return {
      profile,
      totalOpenCount: totalOpenRow.count,
      openInternships,
      allRequiredSkillRows,
      applications,
      weeklyActivities,
      goals,
      notifications,
    };
  }

  async listOpenRequiredSkills(includeDemo: boolean) {
    return this.db
      .prepare(
        `SELECT required_skills_json FROM internships WHERE verification_status IN ('Verified Open', 'Closing Soon') ${includeDemo ? '' : 'AND is_demo = 0'}`
      )
      .all() as Array<{ required_skills_json: string }>;
  }

  async getGrowthContext(userId: string) {
    const profile = await this.getStudentProfile(userId);
    const goals = this.db
      .prepare('SELECT * FROM career_goals WHERE user_id = ? ORDER BY completed ASC, created_at DESC')
      .all(userId) as CareerGoalRecord[];
    const activities = this.db
      .prepare('SELECT * FROM student_activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(userId) as StudentActivityRecord[];
    const applicationStatuses = this.db
      .prepare('SELECT status FROM applications WHERE user_id = ?')
      .all(userId) as Array<{ status: string }>;
    const ascRows = this.db
      .prepare(`SELECT DISTINCT substr(created_at, 1, 10) as day FROM student_activity WHERE user_id = ? ORDER BY day ASC`)
      .all(userId) as Array<{ day: string }>;
    const descRows = this.db
      .prepare(`SELECT DISTINCT substr(created_at, 1, 10) as day FROM student_activity WHERE user_id = ? ORDER BY day DESC`)
      .all(userId) as Array<{ day: string }>;

    return {
      profile,
      goals,
      activities,
      applicationStatuses,
      activityDaysAsc: ascRows.map((r) => r.day),
      activityDaysDesc: descRows.map((r) => r.day),
    };
  }

  async createCareerGoal(goal: CareerGoalRecord) {
    this.db
      .prepare(`
        INSERT INTO career_goals (id, user_id, title, category, target_count, current_count, period, completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        goal.id,
        goal.user_id,
        goal.title,
        goal.category,
        goal.target_count,
        goal.current_count,
        goal.period,
        goal.completed,
        goal.created_at,
        goal.updated_at
      );
  }

  async findCareerGoalByIdForUser(id: string, userId: string) {
    return (
      (this.db.prepare('SELECT * FROM career_goals WHERE id = ? AND user_id = ?').get(id, userId) as
        | CareerGoalRecord
        | undefined) ?? null
    );
  }

  async updateCareerGoal(id: string, currentCount: number, completed: number, updatedAt: string) {
    this.db
      .prepare('UPDATE career_goals SET current_count = ?, completed = ?, updated_at = ? WHERE id = ?')
      .run(currentCount, completed, updatedAt, id);
  }

  async deleteCareerGoal(id: string, userId: string) {
    this.db.prepare('DELETE FROM career_goals WHERE id = ? AND user_id = ?').run(id, userId);
  }

  async createStudentActivity(activity: StudentActivityRecord) {
    this.db
      .prepare(`
        INSERT INTO student_activity (id, user_id, activity_type, description, skill_practised, minutes_spent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        activity.id,
        activity.user_id,
        activity.activity_type,
        activity.description,
        activity.skill_practised,
        activity.minutes_spent,
        activity.created_at
      );
  }

  async listIndustryNews(category: string, limit: number) {
    const where = category !== 'All' ? 'WHERE category = ?' : '';
    const params = category !== 'All' ? [category, limit] : [limit];
    return this.db
      .prepare(`SELECT * FROM industry_news ${where} ORDER BY published_at DESC LIMIT ?`)
      .all(...params) as IndustryNewsRecord[];
  }

  async hasIndustryNewsByExternalId(externalId: string) {
    const found = this.db.prepare('SELECT id FROM industry_news WHERE external_id = ?').get(externalId);
    return Boolean(found);
  }

  async insertIndustryNewsIfNew(article: IndustryNewsRecord) {
    this.db
      .prepare(`
        INSERT OR IGNORE INTO industry_news (
          id, external_id, title, publisher, category, published_at, original_url,
          raw_excerpt, ai_summary, why_it_matters, related_skills_json, fetched_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        article.id,
        article.external_id,
        article.title,
        article.publisher,
        article.category,
        article.published_at,
        article.original_url,
        article.raw_excerpt,
        article.ai_summary,
        article.why_it_matters,
        article.related_skills_json,
        article.fetched_at,
        article.is_demo
      );
  }

  async listNotifications(userId: string, limit: number) {
    return this.db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit) as NotificationRecord[];
  }

  async markNotificationRead(id: string, userId: string) {
    this.db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
  }

  async markAllNotificationsRead(userId: string) {
    this.db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  }
}
