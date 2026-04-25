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

  // ── No artificial delay: optimistic updates already handle the UI ──────

  const token = getStoredToken();
  const auth  = decodeToken(token);

  // Determine whether to use Supabase KV or localStorage
  const useKv = await isAvailable();

  // Unified CRUD helpers
  const dbGet = async (key: string): Promise<any> => {
    if (useKv) {
      try {
        const kvResult = await kvGet(key);
        return kvResult ?? lsGet(key);
      } catch { return lsGet(key); }
    }
    return lsGet(key);
  };
  // dbSet: writes to localStorage first (instant), then awaits KV so cross-device
  // data (assignments, submissions) is guaranteed to reach other browsers.
  const dbSet = async (key: string, value: any): Promise<void> => {
    lsSet(key, value);
    if (useKv) {
      try {
        await kvSet(key, value);
      } catch (e) {
        console.warn('kvSet failed:', e);
        // localStorage copy remains as fallback on the current device
      }
    }
  };
  const dbDel = async (key: string): Promise<void> => {
    lsDel(key);
    if (useKv) {
      try {
        await kvDel(key);
      } catch (e) {
        // Log but don't throw — localStorage is already clean.
        // KV inconsistency is handled by localDeletedRef guard in the dashboard.
        console.warn('kvDel failed for key', key, ':', e);
      }
    }
  };
  const dbByPrefix = async (prefix: string): Promise<any[]> => {
    const lsItems = lsByPrefix(prefix);
    if (!useKv) return lsItems;

    try {
      const kvItems = await kvGetByPrefix(prefix);
      const seen = new Set<string>();
      const result: any[] = [];
      for (const item of kvItems) {
        if (!item) continue;
        const uid = String(item.id ?? item.email ?? item.key ?? JSON.stringify(item));
        if (!seen.has(uid)) { seen.add(uid); result.push(item); }
      }
      for (const item of lsItems) {
        if (!item) continue;
        const uid = String(item.id ?? item.email ?? item.key ?? JSON.stringify(item));
        if (!seen.has(uid)) { seen.add(uid); result.push(item); }
      }
      return result;
    } catch {
      return lsItems;
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  AUTH — Register (Supabase Auth + kv_store profile)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/auth/register') && method === 'POST') {
    const email = body.email.toLowerCase().trim();
    const name  = (body.name || '').trim();
    const role  = body.role || 'student';

    // ── 1. Check for duplicates ──────────────────────────────────────────
    const existingKv    = useKv ? await kvGet(`user:${email}`).catch(() => null) : null;
    const existingLocal = lsGet(`user:${email}`);
    if (existingKv || existingLocal) {
      throw new Error('Пользователь с таким email уже зарегистрирован');
    }

    // ── 2. Hash password (kv_store is primary auth source) ───────────────
    const saltArr    = crypto.getRandomValues(new Uint8Array(16));
    const salt       = Array.from(saltArr).map(b => b.toString(16).padStart(2, '0')).join('');
    const saltedData = new TextEncoder().encode(body.password + salt);
    const hashBuf    = await crypto.subtle.digest('SHA-256', saltedData);
    const passwordHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // ── 3. Save profile + credentials to kv_store ────────────────────────
    const userProfile = {
      name,
      email,
      role,
      studentClass: body.studentClass || null,
      passwordHash,
      salt,
      createdAt: Date.now(),
    };

    lsSet(`user:${email}`, userProfile);
    if (useKv) {
      try {
        await kvSet(`user:${email}`, userProfile);
      } catch (e) {
        console.warn('kvSet profile failed during register:', e);
      }
    }

    // ── 4. Try Supabase Auth in background (best-effort, non-blocking) ───
    supabase.auth.signUp({
      email: body.email.trim(),
      password: body.password,
      options: { data: { name, role, studentClass: body.studentClass || null } },
    }).then(({ data }) => {
      if (data?.session) {
        resetAvailabilityCache();
        console.log('Supabase Auth signup succeeded for:', email);
      }
    }).catch(() => {
      // Supabase Auth unavailable — kv_store credentials are sufficient
    });

    const token = makeToken(email, role);
    return {
      success: true,
      token,
      user: { name, email, role, studentClass: body.studentClass || null },
    } as any;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  AUTH — Login (kv_store primary, Supabase Auth secondary)
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/auth/login') && method === 'POST') {
    const email = body.email.toLowerCase().trim();

    // ── 1. kv_store / localStorage credential check (always works) ───────
    const storedUser = useKv
      ? (await kvGet(`user:${email}`).catch(() => null)) ?? lsGet(`user:${email}`)
      : lsGet(`user:${email}`);

    if (storedUser?.passwordHash && storedUser.salt !== undefined) {
      const data = new TextEncoder().encode(body.password + (storedUser.salt || ''));
      const hash = await crypto.subtle.digest('SHA-256', data);
      const hex  = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (hex === storedUser.passwordHash) {
        // Password matches — try Supabase Auth session in background
        supabase.auth.signInWithPassword({
          email: body.email.trim(),
          password: body.password,
        }).then(({ data: sd }) => {
          if (sd?.session) {
            resetAvailabilityCache();
            console.log('Supabase Auth session established for:', email);
          }
        }).catch(() => {});

        const token = makeToken(email, storedUser.role);
        return {
          success: true,
          token,
          user: {
            name:         storedUser.name,
            email,
            role:         storedUser.role,
            studentClass: storedUser.studentClass,
          },
        } as any;
      }
    }

    // ── 2. Supabase Auth fallback (for users who signed up via OAuth etc.) ─
    try {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: body.email.trim(),
        password: body.password,
      });

      if (signInData?.session) {
        resetAvailabilityCache();
        await isAvailable();

        const meta         = signInData.user.user_metadata || {};
        const name         = meta.name         || email.split('@')[0];
        const role         = meta.role         || 'student';
        const studentClass = meta.studentClass || null;

        // Persist credentials to kv_store so next login uses path 1
        const saltArr    = crypto.getRandomValues(new Uint8Array(16));
        const salt       = Array.from(saltArr).map(b => b.toString(16).padStart(2, '0')).join('');
        const saltedData = new TextEncoder().encode(body.password + salt);
        const hashBuf    = await crypto.subtle.digest('SHA-256', saltedData);
        const passwordHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

        const migratedProfile = { name, email, role, studentClass, passwordHash, salt, createdAt: Date.now() };
        lsSet(`user:${email}`, migratedProfile);
        if (useKv) { kvSet(`user:${email}`, migratedProfile).catch(() => {}); }

        const token = makeToken(email, role);
        return { success: true, token, user: { name, email, role, studentClass } } as any;
      }
    } catch {
      // Supabase Auth unreachable — handled below
    }

    // ── 3. Very old rf_users plain-text array ─────────────────────────────
    try {
      const legacy      = JSON.parse(localStorage.getItem('rf_users') || '[]') as any[];
      const legacyEntry = legacy.find((u: any) => u.email === email && u.password === body.password);
      if (legacyEntry) {
        const token = makeToken(email, legacyEntry.role);
        return {
          success: true,
          token,
          user: { name: legacyEntry.name, email, role: legacyEntry.role, studentClass: legacyEntry.studentClass },
        } as any;
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

    // Accept the client-side tempId when provided so the optimistic entry and
    // the persisted entry share the same ID — no "replace" re-render needed.
    const id = typeof body.id === 'number' ? body.id : Date.now();
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
      createdAt:    id,
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

  // ═════════════════════════════════════════════════════════════════════════
  //  TEACHER — Get subjects by email
  // ═════════════════════════════════════════════════════════════════════════
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

    // Compress screenshot before storing to avoid hitting KV size limits.
    // Resizes to max 800 px wide and encodes as JPEG 0.70 quality.
    // A typical classroom photo goes from ~800 KB → ~60-120 KB this way.
    const compressImage = async (dataUrl: string): Promise<string> => {
      if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
      return new Promise((resolve) => {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              const MAX_W = 800;
              const scale = img.width > MAX_W ? MAX_W / img.width : 1;
              const canvas = document.createElement('canvas');
              canvas.width  = Math.round(img.width  * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext('2d');
              if (!ctx) { resolve(dataUrl); return; }
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.70));
            } catch { resolve(dataUrl); }
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
        } catch { resolve(dataUrl); }
      });
    };

    const rawScreenshot: string | null = body.screenshot || null;
    const screenshotUrl = rawScreenshot ? await compressImage(rawScreenshot) : null;

    // If a rejected submission exists, reset it to pending so the student can re-submit
    if (existing && existing.status === 'rejected') {
      const resubmitted = {
        ...existing,
        status: 'pending',
        screenshotUrl,
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
      screenshotUrl,
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

    // ── Immediately sync XP to leaderboard when teacher approves ─────────
    // This way the student's XP is visible right away without waiting for
    // the student's own polling cycle to detect the status change.
    if (body.status === 'approved' && submission.studentEmail) {
      try {
        const studentEmail = submission.studentEmail as string;
        const earnedXp = typeof submission.xp === 'number' ? submission.xp : 20;
        const existing = await dbGet(`xp:${studentEmail}`) as any;
        const currentXp = typeof existing?.xp === 'number' ? existing.xp : 0;
        await dbSet(`xp:${studentEmail}`, {
          name:         existing?.name         || studentEmail,
          email:        studentEmail,
          studentClass: existing?.studentClass || '',
          xp:           currentXp + earnedXp,
          updatedAt:    Date.now(),
        });
      } catch (e) {
        console.warn('XP leaderboard sync failed on approval:', e);
      }
    }
    // ─────────────────────────────────────────────────────────────────────

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
  // ═══════════════════���═════���════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════════════════
  //  PROFILE — Save / get student character choice
  // ══════════════════════════════════════════════════════════════════════════
  if (path.startsWith('/profile/char') && method === 'POST') {
    if (!auth) throw new Error('Требуетс авторизация');
    const characterId = body?.characterId || 'mage';
    await dbSet(`char:${auth.email}`, { characterId, updatedAt: Date.now() });
    return { success: true } as any;
  }

  if (path.startsWith('/profile/char') && method === 'GET') {
    const email = new URLSearchParams(path.split('?')[1]).get('email') || auth?.email || '';
    if (!email) throw new Error('Email не указан');
    const data = await dbGet(`char:${email}`) as any;
    return { characterId: data?.characterId || 'mage' } as any;
  }

  throw new Error(`API 404 — Not Found: ${method} ${path}`);
}