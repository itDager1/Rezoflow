import { BookOpen, Clock, Zap } from 'lucide-react';

interface FilterPanelProps {
  selectedSubject: string;
  selectedDifficulty: string;
  selectedDeadline: string;
  onSubjectChange: (subject: string) => void;
  onDifficultyChange: (difficulty: string) => void;
  onDeadlineChange: (deadline: string) => void;
}

export function FilterPanel({
  selectedSubject,
  selectedDifficulty,
  selectedDeadline,
  onSubjectChange,
  onDifficultyChange,
  onDeadlineChange,
}: FilterPanelProps) {
  const subjects = ['Все', 'Математика', 'Физика', 'Химия', 'История', 'Литература'];
  const difficulties = ['Все', 'Легко', 'Средне', 'Сложно'];
  const deadlines = ['Все', 'Сегодня', 'На неделе', 'На месяце'];

  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <h3 className="opacity-90">Предмет</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <button
              key={subject}
              onClick={() => onSubjectChange(subject)}
              className={`px-4 py-2.5 rounded-xl transition-all ${
                selectedSubject === subject
                  ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-secondary/50 text-foreground hover:bg-secondary border border-border/50'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <h3 className="opacity-90">Сложность</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {difficulties.map((difficulty) => (
            <button
              key={difficulty}
              onClick={() => onDifficultyChange(difficulty)}
              className={`px-4 py-2.5 rounded-xl transition-all ${
                selectedDifficulty === difficulty
                  ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-secondary/50 text-foreground hover:bg-secondary border border-border/50'
              }`}
            >
              {difficulty}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <h3 className="opacity-90">Срок сдачи</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {deadlines.map((deadline) => (
            <button
              key={deadline}
              onClick={() => onDeadlineChange(deadline)}
              className={`px-4 py-2.5 rounded-xl transition-all ${
                selectedDeadline === deadline
                  ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-secondary/50 text-foreground hover:bg-secondary border border-border/50'
              }`}
            >
              {deadline}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
