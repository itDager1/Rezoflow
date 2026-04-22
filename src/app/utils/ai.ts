export const OPENROUTER_API_KEY = "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";

export interface ParsedTask {
  title: string;
  subject: string;
  difficulty: 'Легко' | 'Средне' | 'Сложно';
  deadline: string;
  duration: string;
  description: string;
  isPriority: boolean;
}

export async function parseTaskWithAI(input: string, imageUrl?: string | null): Promise<ParsedTask> {
  // Имитация задержки AI обработки
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Простой парсинг на основе ключевых слов
  const lowerInput = input.toLowerCase();

  // Определение предмета
  let subject = 'Разное';
  if (lowerInput.includes('математик') || lowerInput.includes('алгебр') || lowerInput.includes('геометр') || lowerInput.includes('уравнен')) {
    subject = 'Математика';
  } else if (lowerInput.includes('русск') || lowerInput.includes('литерату')) {
    subject = 'Русский язык';
  } else if (lowerInput.includes('англ') || lowerInput.includes('english')) {
    subject = 'Английский язык';
  } else if (lowerInput.includes('физик')) {
    subject = 'Физика';
  } else if (lowerInput.includes('хими')) {
    subject = 'Химия';
  } else if (lowerInput.includes('биолог')) {
    subject = 'Биология';
  } else if (lowerInput.includes('истор')) {
    subject = 'История';
  } else if (lowerInput.includes('географ')) {
    subject = 'География';
  } else if (lowerInput.includes('информатик') || lowerInput.includes('программ')) {
    subject = 'Информатика';
  }

  // Определение сложности
  let difficulty: 'Легко' | 'Средне' | 'Сложно' = 'Средне';
  if (lowerInput.includes('легк') || lowerInput.includes('прост')) {
    difficulty = 'Легко';
  } else if (lowerInput.includes('сложн') || lowerInput.includes('труд')) {
    difficulty = 'Сложно';
  }

  // Определение срока
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  let deadline = tomorrow.toISOString().split('T')[0];

  const dateMatch = input.match(/(\d{1,2})\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
  if (dateMatch) {
    const months: {[key: string]: number} = {
      'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
      'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
    };
    const day = parseInt(dateMatch[1]);
    const month = months[dateMatch[2].toLowerCase()];
    const date = new Date(new Date().getFullYear(), month, day);
    deadline = date.toISOString().split('T')[0];
  }

  // Определение длительности
  let duration = '30 мин';
  if (lowerInput.includes('быстр') || lowerInput.includes('коротк')) {
    duration = '15 мин';
  } else if (lowerInput.includes('долг') || lowerInput.includes('много')) {
    duration = '1-2 часа';
  }

  // Приоритет
  const isPriority = lowerInput.includes('срочн') || lowerInput.includes('важн') || lowerInput.includes('контрольн');

  // Извлечение названия (первые 60 символов или до точки)
  let title = input.trim();
  const firstSentence = title.split(/[.!?]/)[0];
  if (firstSentence.length > 0 && firstSentence.length < 100) {
    title = firstSentence;
  } else if (title.length > 60) {
    title = title.substring(0, 60) + '...';
  }

  return {
    title: title || 'Новое задание',
    subject,
    difficulty,
    deadline,
    duration,
    description: input || 'Описание не указано',
    isPriority
  };
}
