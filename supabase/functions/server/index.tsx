import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import { SignJWT, jwtVerify } from "npm:jose";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const BUCKET_NAME = "make-ca4c8ee9-screenshots";

// ─── JWT ──────────────────────────────────────────────────────────────────────
const JWT_SECRET_STR =
  Deno.env.get("JWT_SECRET") || "rezoflow-dev-secret-key-min-32-chars!!";
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STR);
const TOKEN_TTL = "7d";

const generateToken = async (email: string, role: string): Promise<string> => {
  return await new SignJWT({ email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_TTL)
    .setIssuedAt()
    .sign(JWT_SECRET);
};

const verifyToken = async (
  token: string
): Promise<{ email: string; role: string } | null> => {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { email: string; role: string };
  } catch {
    return null;
  }
};

// Extract & verify auth from X-Auth-Token header
const getAuth = async (
  c: any
): Promise<{ email: string; role: string } | null> => {
  const token = c.req.header("X-Auth-Token");
  if (!token) return null;
  return verifyToken(token);
};

// ─── PASSWORD ─────────────────────────────────────────────────────────────────
const generateSalt = (): string => {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// salt="" preserves backwards-compat with legacy unsalted accounts
const hashPassword = async (
  password: string,
  salt: string = ""
): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// ─── SUPABASE STORAGE ─────────────────────────────────────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

(async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME);
      console.log(`Bucket ${BUCKET_NAME} created`);
    }
  } catch (err) {
    console.log("Storage init error:", err);
  }
})();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Auth-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get("/make-server-ca4c8ee9/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// ─── AUTH ─────────────────────────────────────────────────────────────────────

// Register
app.post("/make-server-ca4c8ee9/auth/register", async (c) => {
  try {
    const { name, email, password, role, studentClass } = await c.req.json();
    if (!name || !email || typeof password !== "string" || !role) {
      return c.json({ error: "Заполните все обязательные поля" }, 400);
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await kv.get(`user:${normalizedEmail}`);
    if (existing) {
      return c.json(
        { error: "Пользователь с таким email уже существует" },
        400
      );
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const user = {
      name,
      email: normalizedEmail,
      passwordHash,
      salt,
      role,
      studentClass: studentClass || null,
      createdAt: Date.now(),
    };
    await kv.set(`user:${normalizedEmail}`, user);

    const token = await generateToken(normalizedEmail, role);

    return c.json({
      success: true,
      token,
      user: {
        name,
        email: normalizedEmail,
        role,
        studentClass: studentClass || null,
      },
    });
  } catch (err) {
    console.log("Register error:", err);
    return c.json({ error: `Ошибка регистрации: ${err}` }, 500);
  }
});

// Login
app.post("/make-server-ca4c8ee9/auth/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || typeof password !== "string") {
      return c.json({ error: "Заполните все обязательные поля" }, 400);
    }
    const normalizedEmail = email.toLowerCase();
    const user = (await kv.get(`user:${normalizedEmail}`)) as any;

    if (!user) {
      return c.json({ error: "Пользователь не найден" }, 401);
    }

    // Support both salted (new) and legacy unsalted accounts
    let isPasswordValid = false;

    if (!user.passwordHash && password === "") {
      isPasswordValid = true;
    } else {
      const passwordHash = await hashPassword(password, user.salt || "");
      if (user.passwordHash === passwordHash) {
        isPasswordValid = true;
      }
    }

    if (!isPasswordValid) {
      return c.json({ error: "Неверный пароль" }, 401);
    }

    // Migrate unsalted account to salted on next login
    if (!user.salt && user.passwordHash) {
      const newSalt = generateSalt();
      const newHash = await hashPassword(password, newSalt);
      await kv.set(`user:${normalizedEmail}`, {
        ...user,
        salt: newSalt,
        passwordHash: newHash,
      });
    }

    const token = await generateToken(normalizedEmail, user.role);

    return c.json({
      success: true,
      token,
      user: {
        name: user.name,
        email: normalizedEmail,
        role: user.role,
        studentClass: user.studentClass,
      },
    });
  } catch (err) {
    console.log("Login error:", err);
    return c.json({ error: `Ошибка входа: ${err}` }, 500);
  }
});

// Verify token (for client-side session restore)
app.get("/make-server-ca4c8ee9/auth/me", async (c) => {
  const auth = await getAuth(c);
  if (!auth) return c.json({ error: "Недействительный токен" }, 401);

  const user = (await kv.get(`user:${auth.email}`)) as any;
  if (!user) return c.json({ error: "Пользователь не найден" }, 404);

  return c.json({
    user: {
      name: user.name,
      email: auth.email,
      role: user.role,
      studentClass: user.studentClass,
    },
  });
});

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

// Create assignment — teachers only
app.post("/make-server-ca4c8ee9/assignments", async (c) => {
  try {
    const auth = await getAuth(c);
    if (!auth || auth.role !== "teacher") {
      return c.json({ error: "Требуется авторизация учителя" }, 401);
    }

    const { title, subject, assignedClass, deadline, description, teacherName } =
      await c.req.json();
    if (!title || !assignedClass || (Array.isArray(assignedClass) && assignedClass.length === 0)) {
      return c.json({ error: "Заполните все обязательные поля" }, 400);
    }

    const id = Date.now();
    const assignment = {
      id,
      title,
      subject: subject || "",
      class: assignedClass,
      deadline: deadline || "",
      description: description || "",
      teacherEmail: auth.email,
      teacherName: teacherName || "Учитель",
      studentsCount: 0,
      createdAt: Date.now(),
    };
    await kv.set(`assignment:${id}`, assignment);

    return c.json({ success: true, assignment });
  } catch (err) {
    console.log("Create assignment error:", err);
    return c.json({ error: `Ошибка создания задания: ${err}` }, 500);
  }
});

// Get assignments for a class (student polling) — requires auth
app.get("/make-server-ca4c8ee9/assignments/class", async (c) => {
  try {
    const auth = await getAuth(c);
    if (!auth) return c.json({ error: "Требуется авторизация" }, 401);

    const className = c.req.query("name");
    if (!className) return c.json({ error: "Укажите класс" }, 400);

    const all = (await kv.getByPrefix("assignment:")) as any[];
    const filtered = all.filter((a) => a && (Array.isArray(a.class) ? a.class.includes(className) : a.class === className));
    return c.json(filtered.sort((a, b) => b.createdAt - a.createdAt));
  } catch (err) {
    console.log("Get class assignments error:", err);
    return c.json({ error: `Ошибка: ${err}` }, 500);
  }
});

// Get teacher's own assignments with submissions
app.get("/make-server-ca4c8ee9/assignments/teacher", async (c) => {
  try {
    const auth = await getAuth(c);
    if (!auth || auth.role !== "teacher") {
      return c.json({ error: "Требуется авторизация учителя" }, 401);
    }

    const allAssignments = (await kv.getByPrefix("assignment:")) as any[];
    const mine = allAssignments.filter(
      (a) => a && a.teacherEmail === auth.email
    );

    const allSubmissions = (await kv.getByPrefix("submission:")) as any[];
    const withSubs = mine.map((a) => ({
      ...a,
      submissions: allSubmissions.filter((s) => s && s.assignmentId === a.id),
    }));

    return c.json(withSubs.sort((a, b) => b.createdAt - a.createdAt));
  } catch (err) {
    console.log("Get teacher assignments error:", err);
    return c.json({ error: `Ошибка: ${err}` }, 500);
  }
});

// Delete assignment — only the teacher who created it
app.delete("/make-server-ca4c8ee9/assignments/:id", async (c) => {
  try {
    const auth = await getAuth(c);
    if (!auth || auth.role !== "teacher") {
      return c.json({ error: "Требуется авторизация учителя" }, 401);
    }

    const id = c.req.param("id");
    const assignment = (await kv.get(`assignment:${id}`)) as any;

    if (assignment && assignment.teacherEmail !== auth.email) {
      return c.json({ error: "Нет прав на удаление этого задания" }, 403);
    }

    await kv.del(`assignment:${id}`);

    // Cascade: delete orphaned submissions
    const allSubs = (await kv.getByPrefix("submission:")) as any[];
    const numericId = parseInt(id);
    const toDelete = allSubs.filter(
      (s) => s && s.assignmentId === numericId
    );
    await Promise.all(toDelete.map((s) => kv.del(`submission:${s.id}`)));

    return c.json({ success: true });
  } catch (err) {
    console.log("Delete assignment error:", err);
    return c.json({ error: `Ошибка: ${err}` }, 500);
  }
});

// ─── SUBMISSIONS ──────────────────────────────────────────────────────────────

// Submit assignment — students only, no duplicate submissions
app.post("/make-server-ca4c8ee9/assignments/:id/submit", async (c) => {
  try {
    const auth = await getAuth(c);
    if (!auth || auth.role !== "student") {
      return c.json({ error: "Требуется авторизация ученика" }, 401);
    }

    const assignmentId = parseInt(c.req.param("id"));
    const { studentName, screenshot } = await c.req.json();

    // Prevent duplicate submissions from the same student
    const allSubs = (await kv.getByPrefix("submission:")) as any[];
    const existing = allSubs.find(
      (s) =>
        s &&
        s.assignmentId === assignmentId &&
        s.studentEmail === auth.email
    );
    if (existing) {
      return c.json({ success: true, submission: existing, duplicate: true });
    }

    let screenshotUrl: string | null = null;

    if (screenshot && screenshot.startsWith("data:")) {
      try {
        const base64Data = screenshot.split(",")[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const safeEmail = auth.email.replace(/[^a-z0-9]/gi, "_");
        const fileName = `${assignmentId}_${safeEmail}_${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, bytes, { contentType: "image/png" });

        if (!uploadError) {
          // 10-year signed URL to avoid near-term expiry
          const { data: urlData } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 10 * 365 * 24 * 60 * 60);
          screenshotUrl = urlData?.signedUrl || null;
        } else {
          console.log("Screenshot upload error:", uploadError);
        }
      } catch (imgErr) {
        console.log("Screenshot processing error:", imgErr);
      }
    }

    const subId = Date.now();
    const submission = {
      id: subId,
      assignmentId,
      studentName: studentName || "Ученик",
      studentEmail: auth.email,
      screenshotUrl,
      submittedAt: Date.now(),
      status: "pending",
      xp: 20,
    };
    await kv.set(`submission:${subId}`, submission);

    return c.json({ success: true, submission });
  } catch (err) {
    console.log("Submit error:", err);
    return c.json({ error: `Ошибка отправки: ${err}` }, 500);
  }
});

// Update submission status — teachers only
app.patch("/make-server-ca4c8ee9/submissions/:id", async (c) => {
  try {
    const auth = await getAuth(c);
    if (!auth || auth.role !== "teacher") {
      return c.json({ error: "Требуется авторизация учителя" }, 401);
    }

    const subId = c.req.param("id");
    const { status } = await c.req.json();
    const submission = (await kv.get(`submission:${subId}`)) as any;
    if (!submission) return c.json({ error: "Работа не найдена" }, 404);

    // Verify the teacher owns the assignment this submission belongs to
    const assignment = (await kv.get(
      `assignment:${submission.assignmentId}`
    )) as any;
    if (assignment && assignment.teacherEmail !== auth.email) {
      return c.json({ error: "Нет прав на проверку этой работы" }, 403);
    }

    const updated = { ...submission, status };
    await kv.set(`submission:${subId}`, updated);
    return c.json({ success: true, submission: updated });
  } catch (err) {
    console.log("Update submission error:", err);
    return c.json({ error: `Ошибка: ${err}` }, 500);
  }
});

// Get student's own submissions
app.get("/make-server-ca4c8ee9/submissions/student", async (c) => {
  try {
    const auth = await getAuth(c);
    if (!auth) return c.json({ error: "Требуется авторизация" }, 401);

    const all = (await kv.getByPrefix("submission:")) as any[];
    const mine = all.filter((s) => s && s.studentEmail === auth.email);
    return c.json(mine);
  } catch (err) {
    console.log("Get student submissions error:", err);
    return c.json({ error: `Ошибка: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);
