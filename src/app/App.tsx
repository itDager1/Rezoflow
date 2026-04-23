import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App() {
  useEffect(() => {
    const cleanupKey = 'rezoflow_cleanup_cmd_global_2';
    const hasCleaned = localStorage.getItem(cleanupKey);
    if (!hasCleaned) {
      console.log('Running global cleanup for students...');
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('rezoflow_student_tasks_') ||
          key.startsWith('rezoflow_student_completed_') ||
          key.startsWith('rezoflow_student_xp_') ||
          key.startsWith('rezoflow_student_notifications_') ||
          key.startsWith('rezoflow_ai_chat') ||
          key.startsWith('rezoflow_notified_deadlines')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(cleanupKey, 'true');
    }
  }, []);

  return <RouterProvider router={router} />;
}
