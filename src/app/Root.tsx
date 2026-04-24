import { useNavigate, useLocation } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { ParentDashboard } from './components/ParentDashboard';
import { RegisterForm } from './components/RegisterForm';
import { clearStoredToken, setStoredToken } from './utils/api';
import { supabase } from './utils/supabase';
import { resetAvailabilityCache } from './utils/kvClient';

export function Root() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rezoflow_authenticated') === 'true';
    }
    return false;
  });

  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rezoflow_userName') || '';
    }
    return '';
  });

  const [userEmail, setUserEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rezoflow_userEmail') || '';
    }
    return '';
  });

  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'parent' | null>(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('rezoflow_userRole');
      return (role as 'student' | 'teacher' | 'parent') || null;
    }
    return null;
  });

  const [studentClass, setStudentClass] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rezoflow_studentClass') || '5А';
    }
    return '5А';
  });

  const [isLightGradient, setIsLightGradient] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });

  // Track whether we've finished checking the Supabase session (prevents flash)
  const [sessionChecked, setSessionChecked] = useState(false);
  const sessionCheckRunRef = useRef(false);

  // ─── Persist state to localStorage ──────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rezoflow_authenticated', isAuthenticated.toString());
      localStorage.setItem('rezoflow_userName', userName);
      localStorage.setItem('rezoflow_userEmail', userEmail);
      if (userRole) localStorage.setItem('rezoflow_userRole', userRole);
      localStorage.setItem('rezoflow_studentClass', studentClass);
    }
  }, [isAuthenticated, userName, userEmail, userRole, studentClass]);

  // ─── Restore session from Supabase Auth on any device ────────────────────
  // This is what enables cross-device login: if Supabase has a valid session
  // (user logged in recently on this device) or if we need to re-login,
  // we pull name/role from user_metadata.
  useEffect(() => {
    if (sessionCheckRunRef.current) return;
    sessionCheckRunRef.current = true;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session && session.user) {
          const meta = session.user.user_metadata || {};
          const role = (meta.role as 'student' | 'teacher' | 'parent') || null;
          const name = meta.name || '';
          const email = session.user.email || '';
          const sClass = meta.studentClass || '5А';

          if (role && email) {
            // Reset kv cache so it re-probes with authenticated JWT
            resetAvailabilityCache();

            // Always refresh the stored token (needed for fetchTeacherAssignments guard)
            setStoredToken(btoa(JSON.stringify({ email, role })));

            // Always update studentClass from session metadata — handles new devices
            // or cases where the class was never written to localStorage
            if (sClass) setStudentClass(sClass);

            // Only apply the rest if not already authenticated (avoid overwriting manual logout)
            if (!isAuthenticated) {
              setIsAuthenticated(true);
              setUserName(name);
              setUserEmail(email);
              setUserRole(role);
            }
          }
        }
      } catch (err) {
        console.warn('Session restore error:', err);
      } finally {
        setSessionChecked(true);
      }
    };

    checkSession();
  }, []); // run once on mount

  // ─── Listen to Supabase auth state changes ───────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          resetAvailabilityCache();
        }
        if (event === 'SIGNED_OUT') {
          // Already handled by handleLogout, but catch external sign-outs
          setIsAuthenticated(false);
          clearStoredToken();
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ─── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserName('');
    setUserEmail('');
    setUserRole(null);
    setStudentClass('5А');
    clearStoredToken();
    supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rezoflow_authenticated');
      localStorage.removeItem('rezoflow_userName');
      localStorage.removeItem('rezoflow_userEmail');
      localStorage.removeItem('rezoflow_userRole');
      localStorage.removeItem('rezoflow_studentClass');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const renderContent = () => {
    // Show nothing while checking session to prevent flash of login screen
    if (!sessionChecked && !isAuthenticated) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-white/40 text-sm">Загрузка RezoFlow...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <RegisterForm
          onRegister={(name, email, role, sClass, token) => {
            if (token) setStoredToken(token);
            setIsAuthenticated(true);
            setUserName(name || 'Пользователь');
            setUserEmail(email);
            setUserRole((role as any) || 'student');
            if (sClass) setStudentClass(sClass);
            resetAvailabilityCache();
          }}
        />
      );
    }

    if (userRole === 'teacher') {
      return (
        <TeacherDashboard
          userName={userName}
          userEmail={userEmail}
          isLightGradient={isLightGradient}
          setIsLightGradient={setIsLightGradient}
          onLogout={handleLogout}
        />
      );
    }

    if (userRole === 'parent') {
      return (
        <ParentDashboard
          userName={userName}
          userEmail={userEmail}
          isLightGradient={isLightGradient}
          setIsLightGradient={setIsLightGradient}
          onLogout={handleLogout}
        />
      );
    }

    return (
      <>
        <StudentDashboard
          userName={userName}
          userEmail={userEmail}
          studentClass={studentClass}
          isLightGradient={isLightGradient}
          setIsLightGradient={setIsLightGradient}
          onLogout={handleLogout}
        />
      </>
    );
  };

  return (
    <div className={`min-h-screen ${isLightGradient ? 'bg-gradient-to-br from-[#1A1A2E] via-[#100B1A] to-[#2D1B4E]' : 'bg-[#0D0D0D]'} text-foreground relative overflow-hidden font-sans transition-colors duration-1000`}>
      {renderContent()}
    </div>
  );
}