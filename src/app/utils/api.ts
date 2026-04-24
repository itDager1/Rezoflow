// ═══════════════════════════════════════════════════════════════════════════
// RezoFlow — client-side API layer v3
//
// Auth:  Supabase Auth (signUp / signInWithPassword) — works from ANY device.
//        User profile stored in auth.user.user_metadata + mirrored to kv_store.
//
// Data:  kv_store_ca4c8ee9 (Supabase) — authenticated client after login.
//        Transparent fallback to localStorage if kv_store is unavailable.
//
// Key schema:
//   user:<email>      → { name, email, role, studentClass, createdAt }
//   assignment:<id>   → { id, title, subject, class, teacherEmail, … }
//   submission:<id>   → { id, assignmentId, studentEmail, status, xp, … }
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';
import { isAvailable, kvGet, kvSet, kvDel, kvGetByPrefix, resetAvailabilityCache } from './kvClient';

// ─── Session token helpers ────────────────────────────────────────────────────
const TOKEN_KEY = 'rezoflow_token';

export const getStoredToken  = (): string | null => { try { return localStorage.getItem(TOKEN_KEY); }   catch { return null; } };
export const setStoredToken  = (t: string)       => { try { localStorage.setItem(TOKEN_KEY, t); }        catch {} };
export const clearStoredToken = ()               => { try { localStorage.removeItem(TOKEN_KEY); }        catch {} };

// ─── localStorage KV helpers (offline / anon fallback) ───────────────────────
const LS_NS = 'rf_kv:';
const lsGet      = (key: string): any    => { try { const v = localStorage.getItem(LS_NS + key); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet      = (key: string, v: any) => { try { localStorage.setItem(LS_NS + key, JSON.stringify(v)); } catch {} };
const lsDel      = (key: string)         => { try { localStorage.removeItem(LS_NS + key); } catch {} };
const lsByPrefix = (prefix: string): any[] => {
  const results: any[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_NS + prefix)) {
        try { const v = localStorage.getItem(k); if (v) results.push(JSON.parse(v)); } catch {}
      }
    }
  } catch {}
  return results;
};

// ─── Token decode ─────────────────────────────────────────────────────────────
const decodeToken = (token: string | null): { email: string; role: string } | null => {
  if (!token) return null;
  try { return JSON.parse(atob(token)); } catch { return null; }
};

const makeToken = (email: string, role: string) => btoa(JSON.stringify({ email, role }));

// ─── Main API dispatcher ──────────────────────────────────────────────────────
export async function apiRequest<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const method = options?.method || 'GET';
  const body   = options?.body ? JSON.parse(options.body as string) : null;

  await new Promise(r => setTimeout(r, 120)); // brief UX delay

  const token = getStoredToken();
  const auth  = decodeToken(token);

  // Determine whether to use Supabase KV or localStorage
  const useKv = await isAvailable();

  // Unified CRUD helpers
  const dbGet = async (key: string): Promise<any> => {
    if (useKv) { try { return await kvGet(key); } catch { return lsGet(key); } }
    return lsGet(key);
  };
  const dbSet = async (key: string, value: any): Promise<void> => {
    lsSet(key, value);
    if (useKv) { try { await kvSet(key, value); } catch (e) { console.warn('kvSet failed:', e); } }
  };
  const dbDel = async (key: string): Promise<void> => {
    lsDel(key);
    if (useKv) { try { await kvDel(key); } catch {} }
  };
  const dbByPrefix = async (prefix: string): Promise<any[]> => {
    if (useKv) { try { return await kvGetByPrefix(prefix); } catch { return lsByPrefix(prefix); } }
    return lsByPrefix(prefix);
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  AUTH — Register (Supabase Auth + kv_store profile)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/auth/register') && method === 'POST') {
    const email = body.email.toLowerCase().trim();

    // 1. Register with Supabase Auth (password stored securely in Supabase)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: body.email.trim(),
      password: body.password,
      options: {
        data: {
          name:         body.name,
          role:         body.role,
          studentClass: body.studentClass || null,
        },
      },
    });

    if (signUpError) {
      // If user already exists in Supabase Auth → try to detect it
      if (
        signUpError.message.toLowerCase().includes('already registered') ||
        signUpError.message.toLowerCase().includes('already been registered') ||
        signUpError.message.toLowerCase().includes('user already exists')
      ) {
        throw new Error('Пользователь с таким email уже зарегистрирован');
      }
      throw new Error(signUpError.message);
    }

    // Email confirmation required — Supabase project setting
    if (!signUpData.session) {
      throw new Error(
        'На ваш email отправлена ссылка для подтверждения. ' +
        'Перейдите по ней и затем войдите в аккаунт. ' +
        '(Или отключите подтверждение email в настройках Supabase: Authentication → Settings → Disable email confirmations)'
      );
    }

    // 2. After auth session is active, reset kv probe (now authenticated)
    resetAvailabilityCache();
    // Re-check availability with authenticated client
    const kvNowAvail = await isAvailable();

    // 3. Store public profile in kv_store (and localStorage mirror)
    const userProfile = {
      name:         body.name,
      email,
      role:         body.role,
      studentClass: body.studentClass || null,
      createdAt:    Date.now(),
    };
    if (kvNowAvail) {
      try { await kvSet(`user:${email}`, userProfile); } catch (e) { console.warn('Profile kvSet failed:', e); }
    }
    lsSet(`user:${email}`, userProfile);

    const token = makeToken(email, body.role);
    return {
      success: true,
      token,
      user: { name: body.name, email, role: body.role, studentClass: body.studentClass || null },
    } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  AUTH — Login (Supabase Auth with legacy fallback)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/auth/login') && method === 'POST') {
    const email = body.email.toLowerCase().trim();

    // ── Try Supabase Auth first ──────────────────────────────────────────
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: body.email.trim(),
      password: body.password,
    });

    if (!signInError && signInData.session) {
      // Successful Supabase Auth login
      resetAvailabilityCache();
      await isAvailable(); // re-probe with authenticated client

      const meta = signInData.user.user_metadata || {};
      let name         = meta.name         || '';
      let role         = meta.role         || 'student';
      let studentClass = meta.studentClass || null;

      // Also try kv_store for richer profile (catches migrated users)
      try {
        const kvProfile = await dbGet(`user:${email}`) as any;
        if (kvProfile) {
          name         = kvProfile.name         || name;
          role         = kvProfile.role         || role;
          studentClass = kvProfile.studentClass ?? studentClass;
        }
      } catch {}

      // Ensure profile is in kv_store for other users to query
      const profile = { name, email, role, studentClass, createdAt: Date.now() };
      try { await dbSet(`user:${email}`, profile); } catch {}

      const token = makeToken(email, role);
      return { success: true, token, user: { name, email, role, studentClass } } as any;
    }

    // ── Supabase Auth failed → try legacy kv_store / localStorage login ──
    // This handles existing accounts registered before Supabase Auth integration
    console.warn('Supabase Auth login failed, trying legacy:', signInError?.message);

    const legacyUser = await dbGet(`user:${email}`) as any;

    if (legacyUser) {
      // Verify password (legacy hashed format)
      let valid = false;
      if (legacyUser.passwordHash && legacyUser.salt !== undefined) {
        const data  = new TextEncoder().encode(body.password + (legacyUser.salt || ''));
        const hash  = await crypto.subtle.digest('SHA-256', data);
        const hex   = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        valid = hex === legacyUser.passwordHash;
      } else if (legacyUser.password) {
        valid = legacyUser.password === body.password;
      }

      if (valid) {
        // Migrate to Supabase Auth silently
        supabase.auth.signUp({
          email: body.email.trim(),
          password: body.password,
          options: { data: { name: legacyUser.name, role: legacyUser.role, studentClass: legacyUser.studentClass } },
        }).then(({ data: sd }) => {
          if (sd?.session) {
            resetAvailabilityCache();
            console.log('Legacy user migrated to Supabase Auth:', email);
          }
        }).catch(() => {});

        const token = makeToken(email, legacyUser.role);
        return {
          success: true,
          token,
          user: { name: legacyUser.name, email, role: legacyUser.role, studentClass: legacyUser.studentClass },
        } as any;
      }
    }

    // Check very old rf_users array
    try {
      const legacy = JSON.parse(localStorage.getItem('rf_users') || '[]') as any[];
      const legacyEntry = legacy.find((u: any) => u.email === email && u.password === body.password);
      if (legacyEntry) {
        const token = makeToken(email, legacyEntry.role);
        return { success: true, token, user: { name: legacyEntry.name, email, role: legacyEntry.role, studentClass: legacyEntry.studentClass } } as any;
      }
    } catch {}

    throw new Error('Неверный email или пароль');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  AUTH — Me
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/auth/me') && method === 'GET') {
    if (!auth) throw new Error('Недействительный токен');
    const user = await dbGet(`user:${auth.email}`) as any;
    if (!user) throw new Error('Пользователь не найден');
    return { user: { name: user.name, email: user.email, role: user.role, studentClass: user.studentClass } } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ASSIGNMENTS — Create (teacher only)
  // ══════════════════════════════════════════════════════════════════════════
  if (path === '/assignments' && method === 'POST') {
    if (!auth || auth.role !== 'teacher') throw new Error('Требуется авторизация учителя');

    const id = Date.now();
    const assignedClass = body.assignedClass || body.class;
    const assignment = {
      id,
      title:        body.title,
      subject:      body.subject || '',
      class:        assignedClass,
      deadline:     body.deadline || '',
      description:  body.description || '',
      teacherEmail: auth.email,
      teacherName:  body.teacherName || 'Учитель',
      studentsCount: 0,
      createdAt:    Date.now(),
    };

    await dbSet(`assignment:${id}`, assignment);
    return { success: true, assignment } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TEACHER — Save subjects list
  // ══════════════════════════════════════════════════════════════════════════
  if (path === '/teacher/subjects' && method === 'POST') {
    if (!auth || auth.role !== 'teacher') throw new Error('Требуется авторизация учителя');
    const subjects = Array.isArray(body?.subjects) ? body.subjects : [];
    await dbSet(`teacher_subjects:${auth.email}`, subjects);
    return { success: true } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TEACHER — Get subjects by email
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/teacher/subjects') && method === 'GET') {
    if (!auth) throw new Error('Требуется авторизация');
    const email = new URLSearchParams(path.split('?')[1]).get('email') || auth.email;
    const subjects = await dbGet(`teacher_subjects:${email}`);
    return { subjects: Array.isArray(subjects) ? subjects : [] } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ASSIGNMENTS — Get for class (student view)
  // ═════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/assignments/class') && method === 'GET') {
    if (!auth) throw new Error('Требуется авторизация');
    const className = (new URLSearchParams(path.split('?')[1]).get('name') || '').trim();

    const all = await dbByPrefix('assignment:');
    const filtered = (all as any[])
      .filter((a: any) => {
        if (!a) return false;
        const classes: string[] = Array.isArray(a.class) ? a.class : [a.class];
        return classes.some((c: string) => (c || '').trim() === className);
      })
      .sort((a: any, b: any) => b.createdAt - a.createdAt);

    // Enrich each assignment with its teacher's subjects
    const teacherEmails = [...new Set(filtered.map((a: any) => a.teacherEmail).filter(Boolean))] as string[];
    const subjectsMap: Record<string, string[]> = {};
    await Promise.all(
      teacherEmails.map(async (email) => {
        try {
          const subs = await dbGet(`teacher_subjects:${email}`);
          subjectsMap[email] = Array.isArray(subs) ? subs : [];
        } catch { subjectsMap[email] = []; }
      })
    );

    return filtered.map((a: any) => ({
      ...a,
      teacherSubjects: subjectsMap[a.teacherEmail] || [],
    })) as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ASSIGNMENTS — Get teacher's own (with submissions nested)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/assignments/teacher') && method === 'GET') {
    if (!auth || auth.role !== 'teacher') throw new Error('Требуется авторизация учителя');

    const [allAssignments, allSubmissions] = await Promise.all([
      dbByPrefix('assignment:'),
      dbByPrefix('submission:'),
    ]);

    const mine = (allAssignments as any[]).filter((a: any) => a && a.teacherEmail === auth.email);
    return mine.map((a: any) => ({
      ...a,
      submissions: (allSubmissions as any[]).filter((s: any) => s && s.assignmentId === a.id),
    })).sort((a: any, b: any) => b.createdAt - a.createdAt) as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ASSIGNMENTS — Delete
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/assignments/') && method === 'DELETE') {
    if (!auth || auth.role !== 'teacher') throw new Error('Требуется авторизация учителя');
    const id = parseInt(path.split('/')[2]);

    const assignment = await dbGet(`assignment:${id}`) as any;
    if (assignment && assignment.teacherEmail !== auth.email) throw new Error('Нет прав');

    await dbDel(`assignment:${id}`);
    const allSubs = await dbByPrefix('submission:') as any[];
    await Promise.all(allSubs.filter((s: any) => s && s.assignmentId === id).map((s: any) => dbDel(`submission:${s.id}`)));

    return { success: true } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUBMISSIONS — Submit (student only)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.includes('/submit') && method === 'POST') {
    if (!auth || auth.role !== 'student') throw new Error('Требуется авторизация ученика');
    const id = parseInt(path.split('/')[2]);

    // Look up the assignment to get teacherEmail for proper routing
    const assignment = await dbGet(`assignment:${id}`) as any;
    const teacherEmail = assignment?.teacherEmail || '';

    const allSubs = await dbByPrefix('submission:') as any[];
    const existing = allSubs.find((s: any) => s && s.assignmentId === id && s.studentEmail === auth.email);

    // If a rejected submission exists, reset it to pending so the student can re-submit
    if (existing && existing.status === 'rejected') {
      const resubmitted = {
        ...existing,
        status: 'pending',
        screenshotUrl: body.screenshot || null,
        submittedAt: Date.now(),
        teacherEmail,
      };
      await dbSet(`submission:${existing.id}`, resubmitted);
      return { success: true, submission: resubmitted } as any;
    }

    // If a pending/approved submission already exists, return it as-is
    if (existing) return { success: true, submission: existing, duplicate: true } as any;

    const subId = Date.now();
    const difficultyXpMap: Record<string, number> = { Легко: 8, Средне: 20, Сложно: 50, '': 20 };
    const submissionXp = typeof body.xp === 'number' ? body.xp : (difficultyXpMap[body.difficulty] ?? 20);
    const submission = {
      id:           subId,
      assignmentId: id,
      teacherEmail,
      studentName:  body.studentName || 'Ученик',
      studentEmail: auth.email,
      screenshotUrl: body.screenshot || null,
      submittedAt:  Date.now(),
      status:       'pending',
      xp:           submissionXp,
    };

    await dbSet(`submission:${subId}`, submission);
    return { success: true, submission } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUBMISSIONS — Get student's own
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/submissions/student') && method === 'GET') {
    if (!auth) throw new Error('Требуется авторизация');
    const all = await dbByPrefix('submission:') as any[];
    return all.filter((s: any) => s && s.studentEmail === auth.email) as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SUBMISSIONS — Update status (teacher approve / reject)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/submissions/') && method === 'PATCH') {
    if (!auth || auth.role !== 'teacher') throw new Error('Требуется авторизация учителя');
    const id = parseInt(path.split('/')[2]);

    const submission = await dbGet(`submission:${id}`) as any;
    if (!submission) throw new Error('Работа не найдена');

    const assignment = await dbGet(`assignment:${submission.assignmentId}`) as any;
    if (assignment && assignment.teacherEmail !== auth.email) throw new Error('Нет прав');

    const updated = { ...submission, status: body.status };
    await dbSet(`submission:${id}`, updated);
    return { success: true, submission: updated } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PARENT — Get child profile (public info only)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/parent/child') && method === 'GET') {
    if (!auth) throw new Error('Требуется авторизация');
    const childEmail = new URLSearchParams(path.split('?')[1]).get('email') || '';
    if (!childEmail) throw new Error('Email ученика не указан');
    const child = await dbGet(`user:${childEmail.toLowerCase().trim()}`) as any;
    if (!child) throw new Error('Пользователь с таким email не найден');
    return { name: child.name, email: child.email, role: child.role, studentClass: child.studentClass } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PARENT — Get submissions by student email
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/parent/submissions') && method === 'GET') {
    if (!auth) throw new Error('Требуется авторизация');
    const studentEmail = new URLSearchParams(path.split('?')[1]).get('studentEmail') || '';
    if (!studentEmail) throw new Error('Email ученика не указан');
    const all = await dbByPrefix('submission:') as any[];
    return all.filter((s: any) => s && s.studentEmail === studentEmail.toLowerCase().trim()) as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LEADERBOARD — Sync student XP
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/leaderboard/sync') && method === 'POST') {
    if (!auth) throw new Error('Требуется авторизация');
    const entry = {
      name: body.name || auth.email,
      email: auth.email,
      studentClass: body.studentClass || '',
      xp: typeof body.xp === 'number' ? body.xp : 0,
      updatedAt: Date.now(),
    };
    await dbSet(`xp:${auth.email}`, entry);
    return { success: true } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LEADERBOARD — Get top students
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/leaderboard') && method === 'GET') {
    const all = await dbByPrefix('xp:');
    return (all as any[])
      .filter((e: any) => e && typeof e.xp === 'number')
      .sort((a: any, b: any) => b.xp - a.xp)
      .slice(0, 50) as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STUDENTS — Get all students (teacher only)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/students/all') && method === 'GET') {
    if (!auth || auth.role !== 'teacher') throw new Error('Требуется авторизация учителя');
    const allUsers = await dbByPrefix('user:') as any[];
    const students = allUsers
      .filter((u: any) => u && u.role === 'student')
      .map((u: any) => ({
        name:         u.name,
        email:        u.email,
        studentClass: u.studentClass || '',
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ru'));
    return students as any;
  }

  throw new Error(`API 404 — Not Found: ${method} ${path}`);
}