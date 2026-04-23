  // One-time global system reset (Clears tasks, assignments, and XP)
  useEffect(() => {
    const doCleanup = async () => {
      const cleanupKey = 'rezoflow_cleanup_cmd_teacher_4';
      const hasCleaned = localStorage.getItem(cleanupKey);
      if (!hasCleaned && !isLoading) {
        console.log('Running requested system cleanup (Teacher)...');
        
        // 1. Delete all assignments from the API if they exist
        if (assignments.length > 0) {
          try {
            await Promise.all(assignments.map(a => 
              apiRequest(`/assignments/${a.id}`, { method: 'DELETE' })
            ));
          } catch (e) {
            console.error('Failed to delete some assignments:', e);
          }
        }
        
        // 2. Clear all local storage records for students
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
        window.location.reload();
      }
    };
    
    doCleanup();
  }, [assignments, isLoading]);
