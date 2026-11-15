import crypto from 'crypto';
import { Router } from 'express';
import { getDbStore } from '../db.ts';
import { optionalAuth, requireAuth, type AuthedRequest } from '../middleware/auth.ts';
import { analyzeSkillMatchWithAI, generateCareerRecommendationsWithAI } from '../services/gemini.ts';
import { refreshIndustryNews } from '../services/newsCollector.ts';
import type { StudentProfileRecord } from '../storeTypes.ts';

export const workspaceRouter = Router();

function formatStudentProfileInput(prof: StudentProfileRecord | null) {
  return {
    name: prof?.name || 'Student',
    education_level: prof?.education_level || '',
    college: prof?.college || '',
    degree_branch: prof?.degree_branch || '',
    graduation_year: prof?.graduation_year || '',
    skills: JSON.parse(prof?.skills_json || '[]') as string[],
    languages: JSON.parse(prof?.languages_json || '[]') as string[],
    projects: JSON.parse(prof?.projects_json || '[]') as Array<{ title: string; summary: string; stack: string }>,
    preferred_roles: JSON.parse(prof?.preferred_roles_json || '[]') as string[],
  };
}

function computeStreakDaysFromDesc(daysDesc: string[]): number {
  if (daysDesc.length === 0) return 0;
  const daySet = new Set(daysDesc);
  let streak = 0;
  const cursor = new Date();
  const todayStr = cursor.toISOString().slice(0, 10);
  if (!daySet.has(todayStr)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function computeLongestStreakDaysFromAsc(daysAsc: string[]): number {
  if (daysAsc.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < daysAsc.length; i++) {
    const prev = Date.parse(`${daysAsc[i - 1]}T00:00:00Z`);
    const curr = Date.parse(`${daysAsc[i]}T00:00:00Z`);
    if (curr - prev === 86400000) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

workspaceRouter.get('/dashboard', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const includeDemo = req.query.includeDemo === 'true';
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const store = getDbStore();

    const [ctx, growthCtx] = await Promise.all([
      store.getDashboardContext(userId, includeDemo, sevenDaysAgo),
      store.getGrowthContext(userId),
    ]);

    const rawProf = ctx.profile;
    const prof = formatStudentProfileInput(rawProf);

    const checks = [
      Boolean(rawProf?.name),
      Boolean(rawProf?.education_level),
      Boolean(rawProf?.college),
      Boolean(rawProf?.degree_branch),
      Boolean(rawProf?.graduation_year),
      prof.skills.length > 0,
      prof.languages.length > 0,
      prof.projects.length > 0,
      prof.preferred_roles.length > 0,
    ];
    const profileCompletion = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    const studentSet = new Set([...prof.skills, ...prof.languages].map((s) => s.toLowerCase()));
    const scored = ctx.openInternships.map((job) => {
      const reqSkills = JSON.parse(job.required_skills_json || '[]') as string[];
      const matched = reqSkills.filter((s) => studentSet.has(s.toLowerCase()));
      const estScore = reqSkills.length > 0 ? Math.round((matched.length / reqSkills.length) * 100) : 50;
      return {
        id: job.id,
        companyName: job.company_name,
        title: job.title,
        location: job.location,
        workArrangement: job.work_arrangement,
        stipendText: job.stipend_text,
        verificationStatus: job.verification_status,
        firstDiscoveredAt: job.first_discovered_at,
        deadlineAt: job.deadline_at,
        lastVerifiedAt: job.last_verified_at,
        requiredSkills: reqSkills,
        estimatedSkillOverlap: estScore,
        isDemo: Boolean(job.is_demo),
      };
    });

    const recommended = [...scored].sort((a, b) => b.estimatedSkillOverlap - a.estimatedSkillOverlap).slice(0, 4);
    const newlyDiscovered = scored.slice(0, 4);
    const closingSoon = scored.filter((j) => j.deadlineAt || j.verificationStatus === 'Closing Soon').slice(0, 4);

    const apps = ctx.applications;
    const savedCount = apps.filter((a) => a.status === 'Saved').length;
    const activePipelineCount = apps.filter((a) =>
      ['Applied', 'Assessment', 'Interview', 'Shortlisted'].includes(a.status)
    ).length;

    const weeklyMinutes = ctx.weeklyActivities.reduce((acc, a) => acc + (Number(a.minutes_spent) || 0), 0);
    const skillsPractised = Array.from(new Set(ctx.weeklyActivities.map((a) => a.skill_practised).filter(Boolean)));
    const completedGoals = ctx.goals.filter((g) => g.completed === 1).length;

    const skillFreq = new Map<string, number>();
    for (const row of ctx.allRequiredSkillRows) {
      for (const sk of JSON.parse(row.required_skills_json || '[]') as string[]) {
        skillFreq.set(sk, (skillFreq.get(sk) || 0) + 1);
      }
    }
    const topMarketSkills = Array.from(skillFreq.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const missingFromStudent = topMarketSkills.filter((m) => !studentSet.has(m.skill.toLowerCase())).slice(0, 4);

    res.json({
      student: {
        name: prof.name,
        isDemo: req.user!.isDemo,
        profileCompletion,
        skillsCount: prof.skills.length + prof.languages.length,
        projectsCount: prof.projects.length,
      },
      overview: {
        newlyDiscoveredCount: ctx.totalOpenCount,
        savedCount,
        activeApplicationsCount: activePipelineCount,
        totalApplicationsCount: apps.length,
      },
      internships: {
        recommended,
        newlyDiscovered,
        closingSoon,
      },
      careerProgress: {
        streakDays: computeStreakDaysFromDesc(growthCtx.activityDaysDesc),
        weeklyMinutes,
        skillsPractised,
        completedGoals,
        totalGoals: ctx.goals.length,
        applicationMilestones: apps.filter((a) => a.status !== 'Saved').length,
      },
      skillGaps: missingFromStudent,
      notifications: ctx.notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        relatedInternshipId: n.related_internship_id,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/skills/match/:internshipId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const internshipId = String(req.params.internshipId);
    const forceRefresh = req.body?.refresh === true;
    const store = getDbStore();

    const job = await store.findInternshipById(internshipId);
    if (!job) {
      res.status(404).json({ error: 'Internship not found.' });
      return;
    }

    if (!forceRefresh) {
      const cached = await store.getCachedSkillMatch(userId, internshipId);
      if (cached) {
        res.json({
          match: {
            estimatedMatchPercentage: cached.match_percentage,
            matchingSkills: JSON.parse(cached.matching_skills_json || '[]'),
            missingSkills: JSON.parse(cached.missing_skills_json || '[]'),
            requiredSkills: JSON.parse(cached.required_skills_json || '[]'),
            preferredSkills: JSON.parse(cached.preferred_skills_json || '[]'),
            eligibilityWarnings: JSON.parse(cached.eligibility_warnings_json || '[]'),
            recommendedResources: JSON.parse(cached.learning_resources_json || '[]'),
            suggestedProjects: JSON.parse(cached.project_suggestions_json || '[]'),
            explanation: cached.explanation,
            usedAi: Boolean(cached.used_ai),
            computedAt: cached.computed_at,
          },
        });
        return;
      }
    }

    const rawProf = await store.getStudentProfile(userId);
    const profile = formatStudentProfileInput(rawProf);
    const analysis = await analyzeSkillMatchWithAI(profile, {
      title: job.title,
      company_name: job.company_name,
      description: job.description,
      required_skills: JSON.parse(job.required_skills_json || '[]'),
      preferred_skills: JSON.parse(job.preferred_skills_json || '[]'),
      eligibility: job.eligibility,
    });

    const nowIso = new Date().toISOString();
    await store.upsertSkillMatch({
      id: `sm_${crypto.randomUUID()}`,
      user_id: userId,
      internship_id: internshipId,
      match_percentage: analysis.estimatedMatchPercentage,
      matching_skills_json: JSON.stringify(analysis.matchingSkills),
      missing_skills_json: JSON.stringify(analysis.missingSkills),
      required_skills_json: JSON.stringify(analysis.requiredSkills),
      preferred_skills_json: JSON.stringify(analysis.preferredSkills),
      eligibility_warnings_json: JSON.stringify(analysis.eligibilityWarnings),
      learning_resources_json: JSON.stringify(analysis.recommendedResources),
      project_suggestions_json: JSON.stringify(analysis.suggestedProjects),
      explanation: analysis.explanation,
      used_ai: analysis.usedAi ? 1 : 0,
      computed_at: nowIso,
    });

    res.json({ match: { ...analysis, computedAt: nowIso } });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.get('/skills/recommendations', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const includeDemo = req.query.includeDemo === 'true';
    const store = getDbStore();

    const [rawProf, rows] = await Promise.all([
      store.getStudentProfile(userId),
      store.listOpenRequiredSkills(includeDemo),
    ]);
    const profile = formatStudentProfileInput(rawProf);

    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const sk of JSON.parse(r.required_skills_json || '[]') as string[]) {
        counts.set(sk, (counts.get(sk) || 0) + 1);
      }
    }
    const marketTopSkills = Array.from(counts.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const recommendations = await generateCareerRecommendationsWithAI(profile, marketTopSkills);
    res.json({ marketTopSkills, recommendations });
  } catch (err) {
    next(err);
  }
});

// Application Tracker CRUD
workspaceRouter.get('/applications', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await getDbStore().listApplicationsWithInternship(req.user!.id);

    res.json({
      applications: rows.map((r) => ({
        id: r.id,
        internshipId: r.internship_id,
        companyName: r.company_name,
        internshipTitle: r.internship_title,
        status: r.status,
        appliedDate: r.applied_date,
        notes: r.notes,
        importantDates: r.important_dates,
        followUpDate: r.follow_up_date,
        originalApplicationUrl: r.original_application_url || null,
        verificationStatus: r.verification_status || null,
        location: r.location || null,
        isDemo: Boolean(r.is_demo),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/applications', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const {
      internshipId = null,
      companyName,
      internshipTitle,
      status = 'Saved',
      appliedDate = '',
      notes = '',
      importantDates = '',
      followUpDate = '',
    } = req.body || {};

    if (!companyName || !internshipTitle) {
      res.status(400).json({ error: 'Company name and internship title are required.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const { application, created } = await getDbStore().createOrUpdateApplicationForInternship({
      id: `app_${crypto.randomUUID()}`,
      userId: req.user!.id,
      internshipId,
      companyName: String(companyName).trim(),
      internshipTitle: String(internshipTitle).trim(),
      status: String(status),
      appliedDate: String(appliedDate || (status !== 'Saved' ? nowIso.slice(0, 10) : '')),
      notes: String(notes),
      importantDates: String(importantDates),
      followUpDate: String(followUpDate),
      nowIso,
    });

    res.status(created ? 201 : 200).json({ application });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.patch('/applications/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const store = getDbStore();
    const appId = String(req.params.id);
    const existing = await store.findApplicationByIdForUser(appId, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Application entry not found.' });
      return;
    }

    const body = req.body || {};
    const updated = await store.updateApplicationById(appId, req.user!.id, {
      status: body.status ?? existing.status,
      applied_date: body.appliedDate ?? existing.applied_date,
      notes: body.notes ?? existing.notes,
      important_dates: body.importantDates ?? existing.important_dates,
      follow_up_date: body.followUpDate ?? existing.follow_up_date,
      updated_at: new Date().toISOString(),
    });

    res.json({ application: updated });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.delete('/applications/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const deleted = await getDbStore().deleteApplicationById(String(req.params.id), req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: 'Application entry not found.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Career Growth & Motivation Centre
workspaceRouter.get('/growth', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const ctx = await getDbStore().getGrowthContext(userId);
    const prof = formatStudentProfileInput(ctx.profile);
    const goals = ctx.goals;
    const activities = ctx.activities;
    const apps = ctx.applicationStatuses;

    // Build real 28-day (4-week) activity heatmap & 7-day chart buckets from actual student_activity rows
    const activityHeatmap: Array<{ date: string; label: string; dayNum: string; minutes: number; sessions: number }> = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      const dayNum = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const matching = activities.filter((a) => String(a.created_at).startsWith(key));
      const mins = matching.reduce((sum, a) => sum + (Number(a.minutes_spent) || 0), 0);
      activityHeatmap.push({ date: key, label, dayNum, minutes: mins, sessions: matching.length });
    }
    const dailyChart = activityHeatmap.slice(-7).map(({ date, label, minutes }) => ({ date, label, minutes }));

    const skillTotals = new Map<string, { minutes: number; sessions: number }>();
    for (const a of activities) {
      const skillName = String(a.skill_practised || '').trim() || 'General Practice';
      const curr = skillTotals.get(skillName) || { minutes: 0, sessions: 0 };
      curr.minutes += Number(a.minutes_spent) || 0;
      curr.sessions += 1;
      skillTotals.set(skillName, curr);
    }
    const skillBreakdown = Array.from(skillTotals.entries())
      .map(([skill, stats]) => ({ skill, minutes: stats.minutes, sessions: stats.sessions }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);

    const streakDays = computeStreakDaysFromDesc(ctx.activityDaysDesc);
    const longestStreakDays = computeLongestStreakDaysFromAsc(ctx.activityDaysAsc);
    const activeDaysLast7 = dailyChart.filter((d) => d.minutes > 0).length;
    const completedGoalsCount = goals.filter((g) => g.completed === 1).length;
    const submittedAppsCount = apps.filter((a) => a.status !== 'Saved').length;

    const projectActivities = activities.filter(
      (a) =>
        a.activity_type === 'project_milestone' ||
        String(a.skill_practised || '').toLowerCase().includes('project') ||
        String(a.description || '').toLowerCase().includes('project')
    );
    const projectMilestones = {
      portfolioProjectsCount: prof.projects.length,
      projects: prof.projects.slice(0, 6),
      projectSessionsCount: projectActivities.length,
      projectMinutes: projectActivities.reduce((sum, a) => sum + (Number(a.minutes_spent) || 0), 0),
    };

    const applicationMilestones = {
      totalTracked: apps.length,
      saved: apps.filter((a) => a.status === 'Saved').length,
      applied: apps.filter((a) => a.status === 'Applied').length,
      assessmentOrInterview: apps.filter((a) => a.status === 'Assessment' || a.status === 'Interview').length,
      shortlistedOrSelected: apps.filter((a) => a.status === 'Shortlisted' || a.status === 'Selected').length,
      rejected: apps.filter((a) => a.status === 'Rejected').length,
    };

    const dailyGoals = goals.filter((g) => g.period === 'daily');
    const weeklyGoals = goals.filter((g) => g.period !== 'daily');
    const dailyGoalStats = {
      total: dailyGoals.length,
      completed: dailyGoals.filter((g) => g.completed === 1).length,
    };
    const weeklyGoalStats = {
      total: weeklyGoals.length,
      completed: weeklyGoals.filter((g) => g.completed === 1).length,
    };

    let encouragement =
      "You're making steady progress. Every focused skill session brings you closer to your internship goals.";
    if (streakDays >= 5) {
      encouragement = `Strong ${streakDays}-day consistency! Steady daily habits build deep engineering confidence.`;
    } else if (completedGoalsCount >= 2) {
      encouragement = `You've completed ${completedGoalsCount} career goals so far. Keep stacking realistic milestones at your own pace.`;
    } else if (activities.length === 0 && goals.length === 0) {
      encouragement = 'Every strong career starts with one focused 20-minute session. Pick a starter goal below to begin.';
    }

    const badges = [
      {
        id: 'badge_profile',
        title: 'Profile Ready',
        description: 'Added technical skills and project work to your profile.',
        earned: prof.skills.length >= 3 && prof.projects.length >= 1,
      },
      {
        id: 'badge_goal',
        title: 'Goal Finisher',
        description: 'Completed at least one daily or weekly career preparation goal.',
        earned: completedGoalsCount >= 1,
      },
      {
        id: 'badge_streak',
        title: 'Consistent Builder',
        description: 'Maintained a 3-day learning and practice streak.',
        earned: streakDays >= 3 || longestStreakDays >= 3,
      },
      {
        id: 'badge_applicant',
        title: 'Active Candidate',
        description: 'Submitted and logged your first internship application.',
        earned: submittedAppsCount >= 1,
      },
    ];

    res.json({
      streakDays,
      longestStreakDays,
      activeDaysLast7,
      weeklyMinutes: dailyChart.reduce((s, d) => s + d.minutes, 0),
      completedGoalsCount,
      submittedAppsCount,
      dailyGoalStats,
      weeklyGoalStats,
      encouragement,
      dailyChart,
      activityHeatmap,
      skillBreakdown,
      projectMilestones,
      applicationMilestones,
      profileSkills: Array.from(new Set([...prof.skills, ...prof.languages])).slice(0, 10),
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        category: g.category,
        targetCount: g.target_count,
        currentCount: g.current_count,
        period: g.period,
        completed: Boolean(g.completed),
        createdAt: g.created_at,
      })),
      activities: activities.slice(0, 30).map((a) => ({
        id: a.id,
        activityType: a.activity_type,
        description: a.description,
        skillPractised: a.skill_practised,
        minutesSpent: a.minutes_spent,
        createdAt: a.created_at,
      })),
      badges,
    });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/growth/goals', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { title, category = 'Technical Skill', targetCount = 1, period = 'weekly' } = req.body || {};
    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'Goal title is required.' });
      return;
    }
    const id = `goal_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    await getDbStore().createCareerGoal({
      id,
      user_id: req.user!.id,
      title: String(title).trim(),
      category: String(category),
      target_count: Math.max(1, Number(targetCount) || 1),
      current_count: 0,
      period: String(period),
      completed: 0,
      created_at: nowIso,
      updated_at: nowIso,
    });

    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.patch('/growth/goals/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const store = getDbStore();
    const goalId = String(req.params.id);
    const existing = await store.findCareerGoalByIdForUser(goalId, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Goal not found.' });
      return;
    }
    const { currentCount, completed } = req.body || {};
    const nextCount = currentCount !== undefined ? Math.max(0, Number(currentCount)) : existing.current_count;
    const nextCompleted =
      completed !== undefined ? (completed ? 1 : 0) : nextCount >= existing.target_count ? 1 : 0;

    await store.updateCareerGoal(goalId, nextCount, nextCompleted, new Date().toISOString());
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.delete('/growth/goals/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await getDbStore().deleteCareerGoal(String(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/growth/activity', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { activityType = 'skill_practice', description, skillPractised = '', minutesSpent = 30 } = req.body || {};
    if (!description || !String(description).trim()) {
      res.status(400).json({ error: 'Activity description is required.' });
      return;
    }
    const id = `act_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    await getDbStore().createStudentActivity({
      id,
      user_id: req.user!.id,
      activity_type: String(activityType),
      description: String(description).trim(),
      skill_practised: String(skillPractised).trim(),
      minutes_spent: Math.min(480, Math.max(5, Number(minutesSpent) || 30)),
      created_at: nowIso,
    });
    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

// Industry News Centre
workspaceRouter.get('/news', optionalAuth, async (req, res, next) => {
  try {
    const category = String(req.query.category || 'All');
    const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 24));
    const rows = await getDbStore().listIndustryNews(category, limit);

    res.json({
      articles: rows.map((r) => ({
        id: r.id,
        title: r.title,
        publisher: r.publisher,
        category: r.category,
        publishedAt: r.published_at,
        originalUrl: r.original_url,
        rawExcerpt: r.raw_excerpt,
        aiSummary: r.ai_summary,
        whyItMatters: r.why_it_matters,
        relatedSkills: JSON.parse(r.related_skills_json || '[]'),
        fetchedAt: r.fetched_at,
        isDemo: Boolean(r.is_demo),
      })),
    });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/news/refresh', requireAuth, async (_req, res, next) => {
  try {
    const result = await refreshIndustryNews();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Notification Centre
workspaceRouter.get('/notifications', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await getDbStore().listNotifications(req.user!.id, 60);

    res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        relatedInternshipId: n.related_internship_id,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at,
      })),
      unreadCount: rows.filter((n) => !n.is_read).length,
    });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.patch('/notifications/:id/read', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await getDbStore().markNotificationRead(String(req.params.id), req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/notifications/read-all', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await getDbStore().markAllNotificationsRead(req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
