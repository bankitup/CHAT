import type { AppLanguage } from '@/modules/i18n';

export type KeepCozyPreviewUpdate = {
  id: string;
  label: string;
  note: string;
  timestamp: string;
};

export type KeepCozyPreviewRoom = {
  id: string;
  name: string;
  summary: string;
  focus: string;
  historyNote: string;
};

export type KeepCozyPreviewIssue = {
  id: string;
  roomId: string;
  title: string;
  summary: string;
  status: string;
  nextStep: string;
  updates: KeepCozyPreviewUpdate[];
};

export type KeepCozyPreviewTask = {
  id: string;
  issueId: string;
  title: string;
  summary: string;
  status: string;
  nextStep: string;
  updates: KeepCozyPreviewUpdate[];
};

export type KeepCozyPreviewDataset = {
  rooms: KeepCozyPreviewRoom[];
  issues: KeepCozyPreviewIssue[];
  tasks: KeepCozyPreviewTask[];
};

const previewByLanguage: Record<AppLanguage, KeepCozyPreviewDataset> = {
  en: {
    rooms: [
      {
        id: 'entryway',
        name: 'Entryway',
        summary: 'Access, lighting, and first-impression fixes.',
        focus: 'A good room to catch small safety and arrival issues early.',
        historyNote: 'Most updates here start with a quick note, a photo, and one follow-up task.',
      },
      {
        id: 'kitchen',
        name: 'Kitchen',
        summary: 'Daily-use systems, water, and appliance follow-through.',
        focus: 'Issues here usually turn into small task chains rather than one-off notes.',
        historyNote: 'Task history tends to matter more than chat because details stack quickly.',
      },
      {
        id: 'bathroom',
        name: 'Bathroom',
        summary: 'Ventilation, leaks, humidity, and comfort checks.',
        focus: 'A practical room for proving issue-to-task-to-resolution history.',
        historyNote: 'Resolution often depends on a tidy sequence of observations and checks.',
      },
    ],
    issues: [
      {
        id: 'entryway-lighting',
        roomId: 'entryway',
        title: 'Entry light flickers at night',
        summary:
          'The light by the front door flickers after dark and makes arrival feel unreliable.',
        status: 'Needs attention',
        nextStep: 'Confirm whether the bulb or the switch is the first task to handle.',
        updates: [
          {
            id: 'entryway-lighting-observed',
            label: 'Issue logged',
            note: 'Resident reported the flicker as intermittent and more noticeable in the evening.',
            timestamp: 'Today, 18:10',
          },
          {
            id: 'entryway-lighting-follow-up',
            label: 'Follow-up needed',
            note: 'Capture the bulb type and run a quick switch check before calling it electrical.',
            timestamp: 'Today, 18:24',
          },
        ],
      },
      {
        id: 'kitchen-faucet-drip',
        roomId: 'kitchen',
        title: 'Kitchen faucet keeps dripping after shutoff',
        summary:
          'The sink faucet drips for a while after use, which makes this a clear issue-to-task case.',
        status: 'In review',
        nextStep: 'Identify the faucet model so the task list can stay specific and small.',
        updates: [
          {
            id: 'kitchen-faucet-drip-observed',
            label: 'Issue logged',
            note: 'A slow drip continues after the handle is fully closed.',
            timestamp: 'Today, 09:15',
          },
          {
            id: 'kitchen-faucet-drip-assessed',
            label: 'Initial assessment',
            note: 'Looks like a cartridge or washer path, so the first task should narrow the fixture details.',
            timestamp: 'Today, 09:42',
          },
        ],
      },
      {
        id: 'bathroom-fan-noise',
        roomId: 'bathroom',
        title: 'Bathroom fan is louder than normal',
        summary:
          'The ventilation fan still works, but the noise level now feels like a maintenance issue worth tracking.',
        status: 'Planned',
        nextStep: 'Capture a short sound sample and confirm whether airflow changed too.',
        updates: [
          {
            id: 'bathroom-fan-noise-observed',
            label: 'Issue logged',
            note: 'Noise is described as a new rattle that was not present last week.',
            timestamp: 'Yesterday, 20:05',
          },
          {
            id: 'bathroom-fan-noise-prep',
            label: 'Prep note',
            note: 'A short video and airflow check should be enough to decide the next task.',
            timestamp: 'Yesterday, 20:27',
          },
        ],
      },
    ],
    tasks: [
      {
        id: 'check-entry-bulb-fit',
        issueId: 'entryway-lighting',
        title: 'Check bulb fit and rating',
        summary: 'Confirm the installed bulb matches the fixture and is seated correctly.',
        status: 'Active',
        nextStep: 'Capture the bulb details so the issue history stays concrete.',
        updates: [
          {
            id: 'check-entry-bulb-fit-assigned',
            label: 'Task created',
            note: 'This is the fastest first task before expanding the issue.',
            timestamp: 'Today, 18:25',
          },
          {
            id: 'check-entry-bulb-fit-awaiting',
            label: 'Waiting on check',
            note: 'Needs a quick in-person look before deciding whether more task work is required.',
            timestamp: 'Today, 18:31',
          },
        ],
      },
      {
        id: 'capture-faucet-model',
        issueId: 'kitchen-faucet-drip',
        title: 'Capture faucet model and cartridge type',
        summary: 'Take the smallest possible step that keeps the repair path specific.',
        status: 'Waiting',
        nextStep: 'Add one update with the model details before creating any supplier-heavy flow.',
        updates: [
          {
            id: 'capture-faucet-model-assigned',
            label: 'Task created',
            note: 'The issue should stay narrow until the fixture is identified.',
            timestamp: 'Today, 09:44',
          },
          {
            id: 'capture-faucet-model-note',
            label: 'Scope held',
            note: 'Do not jump to ordering or vendor steps yet. The MVP loop only needs clean history.',
            timestamp: 'Today, 09:49',
          },
        ],
      },
      {
        id: 'record-fan-video',
        issueId: 'bathroom-fan-noise',
        title: 'Record a short fan noise video',
        summary: 'Use one small piece of evidence to decide whether the issue should move forward.',
        status: 'Planned',
        nextStep: 'Log the recording as a task update and decide whether the issue stays open.',
        updates: [
          {
            id: 'record-fan-video-created',
            label: 'Task created',
            note: 'This is a good example of a lightweight task tied to issue history.',
            timestamp: 'Yesterday, 20:29',
          },
        ],
      },
    ],
  },
  ru: {
    rooms: [
      {
        id: 'entryway',
        name: 'Прихожая',
        summary: 'Доступ, свет и мелкие исправления на входе.',
        focus: 'Хорошая комната, чтобы рано ловить небольшие вопросы безопасности и входа.',
        historyNote:
          'Обновления здесь обычно начинаются с короткой заметки, фото и одной следующей задачи.',
      },
      {
        id: 'kitchen',
        name: 'Кухня',
        summary: 'Ежедневные системы, вода и доведение бытовых вопросов до конца.',
        focus: 'Проблемы здесь чаще превращаются в небольшую цепочку задач, а не в одну заметку.',
        historyNote:
          'История задач здесь обычно важнее чата, потому что детали быстро накапливаются.',
      },
      {
        id: 'bathroom',
        name: 'Ванная',
        summary: 'Вентиляция, протечки, влажность и проверки комфорта.',
        focus: 'Практичная комната, чтобы доказать цикл проблема -> задача -> история -> решение.',
        historyNote:
          'Решение здесь часто зависит от аккуратной последовательности наблюдений и проверок.',
      },
    ],
    issues: [
      {
        id: 'entryway-lighting',
        roomId: 'entryway',
        title: 'Свет у входа мигает вечером',
        summary:
          'Свет возле входной двери мигает после наступления темноты и делает возвращение домой ненадежным.',
        status: 'Требует внимания',
        nextStep:
          'Нужно понять, что первым делом проверить в задаче: лампу или выключатель.',
        updates: [
          {
            id: 'entryway-lighting-observed',
            label: 'Проблема зафиксирована',
            note: 'Житель описал мигание как периодическое и более заметное вечером.',
            timestamp: 'Сегодня, 18:10',
          },
          {
            id: 'entryway-lighting-follow-up',
            label: 'Нужен следующий шаг',
            note:
              'Нужно записать тип лампы и быстро проверить выключатель, прежде чем считать это электрикой.',
            timestamp: 'Сегодня, 18:24',
          },
        ],
      },
      {
        id: 'kitchen-faucet-drip',
        roomId: 'kitchen',
        title: 'Кухонный кран продолжает капать после закрытия',
        summary:
          'Кран у мойки еще какое-то время капает после использования. Это хороший пример цикла проблема -> задача.',
        status: 'На разборе',
        nextStep:
          'Нужно определить модель крана, чтобы список задач оставался конкретным и небольшим.',
        updates: [
          {
            id: 'kitchen-faucet-drip-observed',
            label: 'Проблема зафиксирована',
            note: 'После полного закрытия ручки остается медленное капание.',
            timestamp: 'Сегодня, 09:15',
          },
          {
            id: 'kitchen-faucet-drip-assessed',
            label: 'Первичная оценка',
            note:
              'Похоже на картридж или уплотнение, поэтому первая задача должна сузить детали по смесителю.',
            timestamp: 'Сегодня, 09:42',
          },
        ],
      },
      {
        id: 'bathroom-fan-noise',
        roomId: 'bathroom',
        title: 'Вытяжка в ванной стала шумнее обычного',
        summary:
          'Вентилятор по-прежнему работает, но уровень шума уже похож на проблему обслуживания, которую стоит отслеживать.',
        status: 'Запланировано',
        nextStep:
          'Нужно снять короткое видео со звуком и понять, не изменился ли поток воздуха.',
        updates: [
          {
            id: 'bathroom-fan-noise-observed',
            label: 'Проблема зафиксирована',
            note: 'Шум описывается как новый дребезг, которого не было на прошлой неделе.',
            timestamp: 'Вчера, 20:05',
          },
          {
            id: 'bathroom-fan-noise-prep',
            label: 'Подготовительная заметка',
            note:
              'Короткого видео и проверки тяги должно хватить, чтобы решить, какая задача нужна дальше.',
            timestamp: 'Вчера, 20:27',
          },
        ],
      },
    ],
    tasks: [
      {
        id: 'check-entry-bulb-fit',
        issueId: 'entryway-lighting',
        title: 'Проверить тип и посадку лампы',
        summary: 'Нужно подтвердить, что установленная лампа подходит к светильнику и сидит плотно.',
        status: 'В работе',
        nextStep:
          'Нужно зафиксировать данные по лампе, чтобы история проблемы была конкретной.',
        updates: [
          {
            id: 'check-entry-bulb-fit-assigned',
            label: 'Задача создана',
            note: 'Это самый быстрый первый шаг, прежде чем расширять проблему.',
            timestamp: 'Сегодня, 18:25',
          },
          {
            id: 'check-entry-bulb-fit-awaiting',
            label: 'Ждет проверки',
            note:
              'Нужен быстрый очный осмотр, чтобы понять, требуется ли дальше расширять работу.',
            timestamp: 'Сегодня, 18:31',
          },
        ],
      },
      {
        id: 'capture-faucet-model',
        issueId: 'kitchen-faucet-drip',
        title: 'Зафиксировать модель крана и тип картриджа',
        summary: 'Нужно сделать самый маленький шаг, который сохранит путь ремонта конкретным.',
        status: 'Ожидание',
        nextStep:
          'Нужно добавить одно обновление с моделью, прежде чем расширяться в поставщиков или закупки.',
        updates: [
          {
            id: 'capture-faucet-model-assigned',
            label: 'Задача создана',
            note: 'Проблема должна оставаться узкой, пока сантехника не определена.',
            timestamp: 'Сегодня, 09:44',
          },
          {
            id: 'capture-faucet-model-note',
            label: 'Границы сохранены',
            note:
              'Не нужно прыгать к заказам или подрядчикам. Для MVP важнее чистая история изменений.',
            timestamp: 'Сегодня, 09:49',
          },
        ],
      },
      {
        id: 'record-fan-video',
        issueId: 'bathroom-fan-noise',
        title: 'Снять короткое видео со звуком вытяжки',
        summary:
          'Одного небольшого доказательства достаточно, чтобы решить, нужно ли двигать проблему дальше.',
        status: 'Запланировано',
        nextStep:
          'Нужно оформить запись как обновление задачи и решить, остается ли проблема открытой.',
        updates: [
          {
            id: 'record-fan-video-created',
            label: 'Задача создана',
            note: 'Это хороший пример легкой задачи, привязанной к истории проблемы.',
            timestamp: 'Вчера, 20:29',
          },
        ],
      },
    ],
  },
};

export function getKeepCozyPreview(language: AppLanguage) {
  return previewByLanguage[language];
}

export function getKeepCozyPreviewRoom(
  language: AppLanguage,
  roomId: string,
) {
  return getKeepCozyPreview(language).rooms.find((room) => room.id === roomId) ?? null;
}

export function getKeepCozyPreviewIssue(
  language: AppLanguage,
  issueId: string,
) {
  return getKeepCozyPreview(language).issues.find((issue) => issue.id === issueId) ?? null;
}

export function getKeepCozyPreviewTask(
  language: AppLanguage,
  taskId: string,
) {
  return getKeepCozyPreview(language).tasks.find((task) => task.id === taskId) ?? null;
}
