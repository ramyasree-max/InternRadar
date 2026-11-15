import crypto from 'crypto';
import { Router } from 'express';
import { getDbStore, hashPassword, verifyPassword } from '../db.ts';
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  type AuthedRequest,
} from '../middleware/auth.ts';
import type { StudentProfileRecord } from '../storeTypes.ts';

export const authRouter = Router();

function formatProfileRow(user: { id: string; email: string; is_demo: number }, prof: StudentProfileRecord) {
  const skills = JSON.parse(prof.skills_json || '[]');
  const languages = JSON.parse(prof.languages_json || '[]');
  const projects = JSON.parse(prof.projects_json || '[]');
  const preferredRoles = JSON.parse(prof.preferred_roles_json || '[]');
  const preferredLocations = JSON.parse(prof.preferred_locations_json || '[]');
  const preferredCategories = JSON.parse(prof.preferred_categories_json || '[]');
  const notificationPrefs = JSON.parse(prof.notification_prefs_json || '{}');

  const checks = [
    Boolean(prof.name),
    Boolean(prof.education_level),
    Boolean(prof.college),
    Boolean(prof.degree_branch),
    Boolean(prof.graduation_year),
    skills.length > 0,
    languages.length > 0,
    projects.length > 0,
    preferredRoles.length > 0,
    preferredLocations.length > 0,
  ];
  const completionPercentage = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    id: user.id,
    email: user.email,
    isDemo: Boolean(user.is_demo),
    name: prof.name,
    educationLevel: prof.education_level || '',
    college: prof.college || '',
    degreeBranch: prof.degree_branch || '',
    graduationYear: prof.graduation_year || '',
    skills,
    languages,
    projects,
    preferredRoles,
    preferredLocations,
    workArrangement: prof.work_arrangement || 'Any',
    preferredCategories,
    notificationPrefs,
    privacyPublic: Boolean(prof.privacy_public),
    completionPercentage,
    updatedAt: prof.updated_at,
  };
}

// Accepts ANY valid email address (Gmail, Outlook, Yahoo, college/university, personal, etc.)
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      educationLevel = '',
      college = '',
      degreeBranch = '',
      graduationYear = '',
      skills = [],
      languages = [],
      projects = [],
      preferredRoles = [],
      preferredLocations = [],
      workArrangement = 'Any',
      preferredCategories = [],
    } = req.body || {};

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Full name, email address, and password are required.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address (e.g. name@gmail.com).' });
      return;
    }

    const store = getDbStore();
    const existing = await store.findUserByEmail(cleanEmail);
    if (existing) {
      res.status(409).json({
        code: 'EMAIL_EXISTS',
        error: 'An account with this email already exists. Please sign in instead.',
      });
      return;
    }

    const userId = `user_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const prof = await store.createStudentAccount({
      userId,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      name: String(name).trim(),
      educationLevel: String(educationLevel),
      college: String(college),
      degreeBranch: String(degreeBranch),
      graduationYear: String(graduationYear),
      skillsJson: JSON.stringify(Array.isArray(skills) ? skills : []),
      languagesJson: JSON.stringify(Array.isArray(languages) ? languages : []),
      projectsJson: JSON.stringify(Array.isArray(projects) ? projects : []),
      preferredRolesJson: JSON.stringify(Array.isArray(preferredRoles) ? preferredRoles : []),
      preferredLocationsJson: JSON.stringify(Array.isArray(preferredLocations) ? preferredLocations : []),
      workArrangement: String(workArrangement || 'Any'),
      preferredCategoriesJson: JSON.stringify(Array.isArray(preferredCategories) ? preferredCategories : []),
      welcomeNotificationId: `notif_${crypto.randomUUID()}`,
      nowIso,
    });

    const token = signSessionToken({ userId, email: cleanEmail, isDemo: false });
    setSessionCookie(req, res, token);

    res.status(201).json({
      token,
      user: formatProfileRow({ id: userId, email: cleanEmail, is_demo: 0 }, prof),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const store = getDbStore();
    const user = await store.findUserByEmail(cleanEmail);

    if (!user) {
      res.status(401).json({
        code: 'ACCOUNT_NOT_FOUND',
        error: `No account found for ${cleanEmail} yet. Create a free student account below using this email.`,
      });
      return;
    }

    if (!verifyPassword(String(password), user.password_hash)) {
      res.status(401).json({ error: 'Incorrect password. Try again or use Reset Password.' });
      return;
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      isDemo: Boolean(user.is_demo),
    });
    setSessionCookie(req, res, token);

    const prof = await store.getStudentProfile(user.id);
    if (!prof) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }
    res.json({
      token,
      user: formatProfileRow(user, prof),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/demo', async (req, res, next) => {
  try {
    const store = getDbStore();
    const user = await store.findAuthUserById('user_demo_student');

    if (!user) {
      res.status(404).json({ error: 'Demo student workspace is unavailable.' });
      return;
    }

    const token = signSessionToken({ userId: user.id, email: user.email, isDemo: true });
    setSessionCookie(req, res, token);

    const prof = await store.getStudentProfile(user.id);
    if (!prof) {
      res.status(404).json({ error: 'Demo student profile is unavailable.' });
      return;
    }
    res.json({
      token,
      user: formatProfileRow(user, prof),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'Please provide your registered email address.' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const store = getDbStore();
    const user = await store.findUserByEmail(cleanEmail);

    if (!user) {
      res.json({
        message: 'If an account matches that email, a verification code has been issued.',
      });
      return;
    }

    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expires = Date.now() + 15 * 60 * 1000;
    await store.setResetToken(user.id, code, expires);

    res.json({
      message: 'Password reset verification code issued (valid for 15 minutes).',
      verificationCodeForLocalTesting: code,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Email, verification code, and new password are required.' });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const store = getDbStore();
    const user = await store.findUserByEmail(cleanEmail);

    if (!user || !user.reset_token || user.reset_token !== String(code).trim().toUpperCase()) {
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }
    if (!user.reset_expires || Date.now() > user.reset_expires) {
      res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      return;
    }

    await store.resetUserPassword(user.id, hashPassword(String(newPassword)));
    res.json({ ok: true, message: 'Password updated. You may now sign in.' });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const store = getDbStore();
    const user = await store.findAuthUserById(req.user!.id);
    const prof = await store.getStudentProfile(req.user!.id);
    if (!user || !prof) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json({ user: formatProfileRow(user, prof) });
  } catch (err) {
    next(err);
  }
});

authRouter.put('/profile', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const body = req.body || {};
    const nowIso = new Date().toISOString();
    const store = getDbStore();

    const existing = await store.getStudentProfile(req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }

    const updated = await store.updateStudentProfile(req.user!.id, {
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      education_level: body.educationLevel !== undefined ? String(body.educationLevel) : existing.education_level,
      college: body.college !== undefined ? String(body.college) : existing.college,
      degree_branch: body.degreeBranch !== undefined ? String(body.degreeBranch) : existing.degree_branch,
      graduation_year: body.graduationYear !== undefined ? String(body.graduationYear) : existing.graduation_year,
      skills_json: body.skills !== undefined ? JSON.stringify(body.skills) : existing.skills_json,
      languages_json: body.languages !== undefined ? JSON.stringify(body.languages) : existing.languages_json,
      projects_json: body.projects !== undefined ? JSON.stringify(body.projects) : existing.projects_json,
      preferred_roles_json:
        body.preferredRoles !== undefined ? JSON.stringify(body.preferredRoles) : existing.preferred_roles_json,
      preferred_locations_json:
        body.preferredLocations !== undefined
          ? JSON.stringify(body.preferredLocations)
          : existing.preferred_locations_json,
      work_arrangement: body.workArrangement !== undefined ? String(body.workArrangement) : existing.work_arrangement,
      preferred_categories_json:
        body.preferredCategories !== undefined
          ? JSON.stringify(body.preferredCategories)
          : existing.preferred_categories_json,
      notification_prefs_json:
        body.notificationPrefs !== undefined
          ? JSON.stringify(body.notificationPrefs)
          : existing.notification_prefs_json,
      privacy_public: body.privacyPublic !== undefined ? (body.privacyPublic ? 1 : 0) : existing.privacy_public,
      updated_at: nowIso,
    });

    await store.clearUserSkillMatches(req.user!.id);

    const user = await store.findAuthUserById(req.user!.id);
    if (!user || !updated) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }
    res.json({ user: formatProfileRow(user, updated) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/change-password', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    const store = getDbStore();
    const user = await store.findUserByIdWithHash(req.user!.id);
    if (!user || !verifyPassword(String(currentPassword), user.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    await store.updateUserPassword(user.id, hashPassword(String(newPassword)));
    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});
