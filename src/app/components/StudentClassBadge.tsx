import { GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';

interface StudentClassBadgeProps {
  studentClass: string;
}

export function StudentClassBadge({ studentClass }: StudentClassBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/20 to-purple-500/20 backdrop-blur-xl border border-primary/30 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.2)]"
    >
      <GraduationCap className="w-4 h-4 text-primary" />
      <span className="text-sm font-semibold text-white">
        Класс: <span className="text-primary">{studentClass}</span>
      </span>
    </motion.div>
  );
}
