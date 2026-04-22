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

async function tryBrowserAI(input: string): Promise<ParsedTask | null> {
  try {
    // Проверяем наличие Chrome AI
    if ('ai' in window && (window as any).ai?.languageModel) {
      const session = await (window as any).ai.languageModel.create({
        systemPrompt: `Ты помощник для анализа домашних заданий. Извлекай информацию и возвращай ТОЛЬКО валидный JSON без дополнительного текста.`
      });

      const prompt = `Проанализируй это задание и верни JSON:
Текст: "${input}"
Текущая дата: ${new Date().toLocaleDateString('ru-RU')}

Формат ответа (только JSON, без объяснений):
{
  "title": "краткое название",
  "subject": "предмет с заглавной буквы",
  "difficulty": "Легко|Средне|Сложно",
  "deadline": "YYYY-MM-DD",
  "duration": "время на выполнение",
  "description": "полное описание",
  "isPriority": false
}`;

      const result = await session.prompt(prompt);
      session.destroy();

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || input.substring(0, 50),
          subject: parsed.subject || 'Разное',
          difficulty: parsed.difficulty || 'Средне',
          deadline: parsed.deadline || new Date(Date.now() + 86400000).toISOString().split('T')[0],
          duration: parsed.duration || '30 мин',
          description: parsed.description || input,
          isPriority: parsed.isPriority || false
        };
      }
    }
  } catch (e) {
    console.log('Browser AI не доступен:', e);
  }
  return null;
}

export async function parseTaskWithAI(input: string, imageUrl?: string | null): Promise<ParsedTask> {
  // Пробуем использовать встроенный AI браузера
  const browserResult = await tryBrowserAI(input);
  if (browserResult) return browserResult;

  // Имитация задержки обработки
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Улучшенный парсинг на основе ключевых слов и контекста
  const lowerInput = input.toLowerCase();
  const words = lowerInput.split(/\s+/);

  // Определение предмета с учетом контекста
  let subject = 'Разное';
  const subjectKeywords = {
    'Математика': ['математик', 'алгебр', 'геометр', 'уравнен', 'задач', 'примеры', 'решить', 'вычисли', 'формул', 'теорем'],
    'Русский язык': ['русск', 'сочинен', 'изложен', 'диктант', 'правописан', 'орфограф', 'грамматик', 'синтаксис'],
    'Литература': ['литерату', 'роман', 'повесть', 'стих', 'поэм', 'анализ текста', 'произведен'],
    'Английский язык': ['англ', 'english', 'перевод', 'топик', 'эссе на английском'],
    'Физика': ['физик', 'механик', 'электр', 'оптик', 'закон ньютона', 'силы', 'движен'],
    'Химия': ['хими', 'реакци', 'формул', 'элемент', 'вещество', 'раствор'],
    'Биология': ['биолог', 'клетк', 'организм', 'растен', 'животн', 'эволюци'],
    'История': ['истор', 'война', 'революци', 'век', 'событи', 'дата'],
    'География': ['географ', 'карт', 'страна', 'материк', 'климат', 'природ'],
    'Информатика': ['информатик', 'программ', 'код', 'алгоритм', 'компьютер', 'python', 'pascal']
  };

  for (const [subj, keywords] of Object.entries(subjectKeywords)) {
    if (keywords.some(kw => lowerInput.includes(kw))) {
      subject = subj;
      break;
    }
  }

  // Определение сложности на основе контекста
  let difficulty: 'Легко' | 'Средне' | 'Сложно' = 'Средне';
  if (lowerInput.match(/легк|прост|быстр|коротк|несложн/)) {
    difficulty = 'Легко';
  } else if (lowerInput.match(/сложн|труд|долг|большой объем|контрольн|экзамен|олимпиад/)) {
    difficulty = 'Сложно';
  }

  // Улучшенное определение срока
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  let deadline = tomorrow.toISOString().split('T')[0];

  // Поиск даты в формате "15 апреля", "к понедельнику", "через 3 дня"
  const monthNames: {[key: string]: number} = {
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
    'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
  };

  const dateMatch = input.match(/(\d{1,2})\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = monthNames[dateMatch[2].toLowerCase()];
    const year = new Date().getFullYear();
    const date = new Date(year, month, day);
    if (date < new Date()) {
      date.setFullYear(year + 1);
    }
    deadline = date.toISOString().split('T')[0];
  } else if (lowerInput.includes('завтра')) {
    deadline = tomorrow.toISOString().split('T')[0];
  } else if (lowerInput.includes('послезавтра')) {
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    deadline = dayAfter.toISOString().split('T')[0];
  } else if (lowerInput.match(/через\s+(\d+)\s+дн/)) {
    const match = lowerInput.match(/через\s+(\d+)\s+дн/);
    const days = parseInt(match![1]);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    deadline = futureDate.toISOString().split('T')[0];
  } else if (lowerInput.match(/к\s+(понедельник|вторник|среду|четверг|пятниц|субботу|воскресень)/)) {
    const weekDays = ['воскресень', 'понедельник', 'вторник', 'среду', 'четверг', 'пятниц', 'субботу'];
    const match = lowerInput.match(/к\s+(понедельник|вторник|среду|четверг|пятниц|субботу|воскресень)/);
    const targetDay = weekDays.indexOf(match![1]);
    const today = new Date();
    const currentDay = today.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + daysToAdd);
    deadline = targetDate.toISOString().split('T')[0];
  }

  // Определение длительности
  let duration = '30 мин';
  if (lowerInput.match(/страниц|параграф|номер/)) {
    const pageMatch = lowerInput.match(/(\d+)\s*страниц/);
    const parMatch = lowerInput.match(/(\d+)\s*параграф/);
    const numMatch = lowerInput.match(/(\d+)\s*номер/);

    if (pageMatch && parseInt(pageMatch[1]) > 5) {
      duration = '1-2 часа';
    } else if (parMatch && parseInt(parMatch[1]) > 2) {
      duration = '1 час';
    } else if (numMatch && parseInt(numMatch[1]) > 10) {
      duration = '45 мин';
    }
  } else if (lowerInput.match(/сочинен|изложен|эссе|реферат/)) {
    duration = '1-2 часа';
  } else if (lowerInput.match(/выучить|наизусть/)) {
    duration = '45 мин';
  } else if (lowerInput.match(/прочита/)) {
    duration = '30-45 мин';
  }

  // Приоритет
  const isPriority = lowerInput.match(/срочн|важн|контрольн|экзамен|зачет|олимпиад/) !== null;

  // Извлечение названия - первое предложение или ключевая фраза
  let title = input.trim();

  // Удаляем вводные фразы
  title = title.replace(/^(надо|нужно|необходимо|задали|дали|домашка|дз|задание)\s+/i, '');

  // Берем первое предложение
  const sentences = title.split(/[.!?;]/);
  if (sentences[0] && sentences[0].length < 100) {
    title = sentences[0].trim();
  } else if (title.length > 70) {
    title = title.substring(0, 67) + '...';
  }

  // Делаем первую букву заглавной
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Формируем подробное описание
  let description = input;
  if (input.length < 20) {
    description = `Задание по предмету "${subject}": ${input}`;
  }

  return {
    title: title || 'Новое задание',
    subject,
    difficulty,
    deadline,
    duration,
    description,
    isPriority
  };
}
