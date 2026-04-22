import { useState } from 'react';
import Snowfall from 'react-snowfall';
import { RegisterForm } from './components/RegisterForm';
import { StudentDashboard } from './components/StudentDashboard';
import { ParentDashboard } from './components/ParentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [userName, setUserName] = useState('Алексей');
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'parent' | null>('student');
  const [isLightGradient, setIsLightGradient] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [isSnowEnabled, setIsSnowEnabled] = useState(false);

  const handleRegister = (name: string, email: string, password: string, role: string) => {
    setUserName(name);
    setUserRole(role as 'student' | 'teacher' | 'parent');
    setIsAuthenticated(true);
  };

  const renderContent = () => {
    if (!isAuthenticated) {
      return <RegisterForm onRegister={handleRegister} />;
    }

    if (userRole === 'student') {
      return (
        <StudentDashboard 
          userName={userName} 
          isLightGradient={isLightGradient}
          setIsLightGradient={setIsLightGradient}
          isSnowEnabled={isSnowEnabled}
          setIsSnowEnabled={setIsSnowEnabled}
        />
      );
    }

    if (userRole === 'teacher') {
      return (
        <TeacherDashboard
          userName={userName}
          isLightGradient={isLightGradient}
          setIsLightGradient={setIsLightGradient}
          isSnowEnabled={isSnowEnabled}
          setIsSnowEnabled={setIsSnowEnabled}
        />
      );
    }

    if (userRole === 'parent') {
      return <ParentDashboard userName={userName} />;
    }

    return null;
  };

  return (
    <div className={`min-h-screen ${isLightGradient ? 'bg-gradient-to-br from-[#1A1A2E] via-[#100B1A] to-[#2D1B4E]' : 'bg-[#0D0D0D]'} text-foreground relative overflow-hidden font-sans transition-colors duration-1000`}>
      {isSnowEnabled && <Snowfall snowflakeCount={70} style={{ position: 'fixed', zIndex: 9999, pointerEvents: 'none' }} />}
      {renderContent()}
    </div>
  );
}