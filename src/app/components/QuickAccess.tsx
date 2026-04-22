import { Clock, TrendingUp, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';

export function QuickAccess() {
  const quickLinks = [
    {
      icon: Clock,
      label: 'Недавние',
      count: 5,
      gradient: 'from-violet-500/20 to-purple-500/5',
      color: 'text-violet-400',
    },
    {
      icon: TrendingUp,
      label: 'Срочные',
      count: 3,
      gradient: 'from-rose-500/20 to-pink-500/5',
      color: 'text-rose-400',
    },
    {
      icon: Bookmark,
      label: 'Избранное',
      count: 8,
      gradient: 'from-cyan-500/20 to-blue-500/5',
      color: 'text-cyan-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {quickLinks.map((link, idx) => (
        null
      ))}
    </div>
  );
}
