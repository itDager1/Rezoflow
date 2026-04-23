import { useNavigate, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import Snowfall from 'react-snowfall';
import { TeacherDashboard } from './components/TeacherDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { ParentDashboard } from './components/ParentDashboard';
import { RegisterForm } from './components/RegisterForm';
import { clearStoredToken, setStoredToken } from './utils/api';

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
  
  const [isSnowEnabled, setIsSnowEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rezoflow_authenticated', isAuthenticated.toString());
      localStorage.setItem('rezoflow_userName', userName);
      localStorage.setItem('rezoflow_userEmail', userEmail);
      if (userRole) localStorage.setItem('rezoflow_userRole', userRole);
      localStorage.setItem('rezoflow_studentClass', studentClass);
    }
  }, [isAuthenticated, userName, userEmail, userRole, studentClass]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserName('');
    setUserEmail('');
    setUserRole(null);
    setStudentClass('5А');
    clearStoredToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rezoflow_authenticated');
      localStorage.removeItem('rezoflow_userName');
      localStorage.removeItem('rezoflow_userEmail');
      localStorage.removeItem('rezoflow_userRole');
      localStorage.removeItem('rezoflow_studentClass');
    }
  };

  const renderContent = () => {
    if (!isAuthenticated) {
      return (
        <RegisterForm 
          onRegister={(name, email, role, studentClass, token) => {
            if (token) setStoredToken(token);
            setIsAuthenticated(true);
            setUserName(name || 'Пользователь');
            setUserEmail(email);
            setUserRole((role as any) || 'student');
            if (studentClass) setStudentClass(studentClass);
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
          isSnowEnabled={isSnowEnabled}
          setIsSnowEnabled={setIsSnowEnabled}
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
          isSnowEnabled={isSnowEnabled}
          setIsSnowEnabled={setIsSnowEnabled}
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
          isSnowEnabled={isSnowEnabled}
          setIsSnowEnabled={setIsSnowEnabled}
          onLogout={handleLogout}
        />
      </>
    );
  };

  return (
    <div className={`min-h-screen ${isLightGradient ? 'bg-gradient-to-br from-[#1A1A2E] via-[#100B1A] to-[#2D1B4E]' : 'bg-[#0D0D0D]'} text-foreground relative overflow-hidden font-sans transition-colors duration-1000`}>
      {isSnowEnabled && <Snowfall snowflakeCount={70} style={{ position: 'fixed', zIndex: 9999, pointerEvents: 'none' }} />}
      {renderContent()}
    </div>
  );
}