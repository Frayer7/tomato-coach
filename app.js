const BUILD_DATE = '2026-07-12'; // 每次发布时手动更新此日期

/**
 * PomodoroRecord
 * id: 唯一标识
 * date: 记录日期，格式 YYYY-MM-DD
 * startTime: 开始时间，格式 HH:MM
 * endTime: 结束时间，格式 HH:MM
 * duration: 专注时长，单位分钟
 * goal: 本次番茄钟目标
 * projectId: 所属项目 ID（默认 uncategorized）
 * goalId: 关联的目标 ID（可选，不填则不贡献任何目标进度）
 * achievement: 完成情况，full | partial | none
 * quality: 专注质量，范围 1-5
 * energy: 精力/状态，范围 1-5（可选）
 * summary: 本次总结
 * interrupted: 是否被中断
 * interruptionNote: 中断说明
 * createdAt: 创建时间，ISO 字符串
 */

/**
 * Project（项目/分类）
 * id: 唯一标识
 * name: 项目名
 * color: 标签颜色（HEX）
 * icon: emoji 图标
 * archived: 是否归档隐藏
 */

/**
 * Goal（目标，挂在项目下）
 * id: 唯一标识
 * projectId: 所属项目 ID
 * title: 目标标题
 * targetPomodoros: 目标番茄数
 * startDate: 统计起始日期 YYYY-MM-DD（进度只计此后番茄）
 * deadline: 截止日期 YYYY-MM-DD（可选）
 * status: active | done | paused | failed
 * createdAt: 创建时间，ISO 字符串
 * completionDate: 完成/失败日期，ISO 字符串（status=done/failed 时）
 * completionReason: 完成感想或失败原因
 * extensions: 延期续目标历史 [{ date, reason, previousTarget, newTarget, previousDeadline, newDeadline }]
 */

/**
 * ReminderItem
 * id: 唯一标识
 * content: 提醒内容
 * createdDate: 创建日期，格式 YYYY-MM-DD
 * consecutiveDays: 连续提醒天数
 * lastReminderDate: 最近提醒日期，格式 YYYY-MM-DD
 * status: 状态，active | improved | ignored | deferred
 * practicedDate: 练习日期，字符串或 null
 */

/**
 * Settings
 * apiKey: OpenAI API Key
 * apiBase: API 基础地址，默认 https://api.openai.com/v1
 * model: 模型名称，默认 gpt-4o-mini
 * coachTone: 教练语气，默认 gentle
 * timerDuration: 番茄钟时长，默认 25 分钟
 * shortBreak: 短休息时长，默认 5 分钟
 * longBreak: 长休息时长，默认 15 分钟
 * quickEvaluate: 是否启用快速评价模式
 * githubToken: GitHub Token（仅 gist 权限）
 * gistId: 同步用 Gist ID
 * autoSync: 是否自动同步
 * lastSyncedAt: 最近一次同步时间
 * syncPassword: 同步密码短语（不持久化，仅内存中使用）
 */

const STORAGE_KEYS = {
  records: 'tc_records',
  reminders: 'tc_reminders',
  settings: 'tc_settings',
  reports: 'tc_reports',
  achievements: 'tc_achievements',
  projects: 'tc_projects',
  goals: 'tc_goals',
  journals: 'tc_journals',
  chats: 'tc_chats',
  syncPwdHint: 'tc_sync_pwd_hint' // 仅存一个密码提示词，帮助用户回忆
};

// 未分类项目的固定 ID，所有历史记录与未指定项目的番茄都归到此项目
const UNCATEGORIZED_PROJECT_ID = 'uncategorized';

// 首次使用时写入的预设项目，用户可在设置页增删改
const DEFAULT_PROJECTS = [
  { id: UNCATEGORIZED_PROJECT_ID, name: '未分类', color: '#9E9E9E', icon: '📥', archived: false },
  { id: 'work', name: '工作', color: '#1E88E5', icon: '💼', archived: false },
  { id: 'study', name: '学习', color: '#43A047', icon: '📚', archived: false },
  { id: 'reading', name: '读书', color: '#8E24AA', icon: '📖', archived: false },
  { id: 'side', name: '副业', color: '#FB8C00', icon: '🚀', archived: false }
];

const PROJECT_COLOR_PRESETS = [
  '#1E88E5', '#43A047', '#8E24AA', '#FB8C00', '#E53935',
  '#00ACC1', '#FDD835', '#6D4C41', '#3949AB', '#9E9E9E'
];

// 精力/状态选项，供评价表单选择，作为 LLM 分析的情绪维度
const ENERGY_OPTIONS = [
  { value: 5, label: '⚡ 充沛' },
  { value: 4, label: '🙂 不错' },
  { value: 3, label: '😐 一般' },
  { value: 2, label: '🥱 疲惫' },
  { value: 1, label: '😵 枯竭' }
];

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiBase: 'https://api.openai.com/v1',
  model: 'deepseek-v4-flash',
  coachTone: 'gentle',
  timerDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  quickEvaluate: false,
  autoWeeklySummary: true,
  weeklySummaryWeekday: 0,
  lastAutoWeeklyKey: '',
  githubToken: '',
  gistId: '',
  autoSync: false,
  lastSyncedAt: null,
  syncPassword: '' // 同步密码短语（不持久化，仅内存中使用）
};

// 模型预设列表，按服务商分组。
// 未来新增/修改模型只需编辑此处，UI 自动更新。
const PRESET_MODEL_GROUPS = [
  {
    label: 'OpenAI',
    suggestedBase: 'https://api.openai.com/v1',
    models: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4o', label: 'GPT-4o' }
    ]
  },
  {
    label: 'DeepSeek',
    suggestedBase: 'https://api.deepseek.com/v1',
    models: [
      { value: 'deepseek-v3-0324', label: 'DeepSeek V3' },
      { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }
    ]
  },
  {
    label: 'Moonshot',
    suggestedBase: 'https://api.moonshot.cn/v1',
    models: [
      { value: 'moonshot-v1-8k', label: 'Moonshot V1 8K' },
      { value: 'moonshot-v1-32k', label: 'Moonshot V1 32K' }
    ]
  }
];

// 从分组中提取所有预设 value 的扁平数组，供 isPreset 判断使用
const PRESET_MODELS = PRESET_MODEL_GROUPS.flatMap((group) => group.models.map((model) => model.value));

const GIST_FILE_NAME = 'tomato-coach-data.json';
const VOLATILE_SETTINGS_KEYS = new Set(['syncPassword']);
const VOLATILE_SETTINGS = {
  syncPassword: DEFAULT_SETTINGS.syncPassword
};

function getRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.records);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveRecords(arr) {
  try {
    const records = Array.isArray(arr) ? arr : [];
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
    return records;
  } catch (error) {
    return [];
  }
}

function getReminders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reminders);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveReminders(arr) {
  try {
    const reminders = Array.isArray(arr) ? arr : [];
    localStorage.setItem(STORAGE_KEYS.reminders, JSON.stringify(reminders));
    return reminders;
  } catch (error) {
    return [];
  }
}

function getProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.projects);

    if (raw === null) {
      // 首次使用：写入预设项目
      saveProjects(DEFAULT_PROJECTS);
      return DEFAULT_PROJECTS.slice();
    }

    const parsed = JSON.parse(raw);
    const projects = Array.isArray(parsed) ? parsed : [];

    // 确保「未分类」项目始终存在
    if (!projects.some((project) => project.id === UNCATEGORIZED_PROJECT_ID)) {
      projects.unshift(DEFAULT_PROJECTS[0]);
    }

    return projects;
  } catch (error) {
    return DEFAULT_PROJECTS.slice();
  }
}

function saveProjects(arr) {
  try {
    const projects = Array.isArray(arr) ? arr : [];
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects));
    return projects;
  } catch (error) {
    return [];
  }
}

function getActiveProjects() {
  return getProjects().filter((project) => !project.archived);
}

function getProjectById(projectId) {
  return getProjects().find((project) => project.id === (projectId || UNCATEGORIZED_PROJECT_ID))
    || getProjects().find((project) => project.id === UNCATEGORIZED_PROJECT_ID)
    || DEFAULT_PROJECTS[0];
}

function addProject(project) {
  const projects = getProjects();
  projects.push(project);
  saveProjects(projects);
  scheduleDebouncedSync();
  return projects;
}

function updateProject(id, patch) {
  const projects = getProjects().map((project) => {
    return project.id === id ? { ...project, ...patch } : project;
  });
  saveProjects(projects);
  scheduleDebouncedSync();
  return projects;
}

function deleteProject(id) {
  if (id === UNCATEGORIZED_PROJECT_ID) {
    return getProjects();
  }

  // 该项目下的番茄改归「未分类」，其目标一并删除
  const records = getRecords().map((record) => {
    return record.projectId === id ? { ...record, projectId: UNCATEGORIZED_PROJECT_ID } : record;
  });
  saveRecords(records);

  const goals = getGoals().filter((goal) => goal.projectId !== id);
  saveGoals(goals);

  const projects = getProjects().filter((project) => project.id !== id);
  saveProjects(projects);
  scheduleDebouncedSync();
  return projects;
}

function getGoals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.goals);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveGoals(arr) {
  try {
    const goals = Array.isArray(arr) ? arr : [];
    localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
    return goals;
  } catch (error) {
    return [];
  }
}

function addGoal(goal) {
  const goals = getGoals();
  goals.push(goal);
  saveGoals(goals);
  scheduleDebouncedSync();
  return goals;
}

function updateGoal(id, patch) {
  const goals = getGoals().map((goal) => {
    return goal.id === id ? { ...goal, ...patch } : goal;
  });
  saveGoals(goals);
  scheduleDebouncedSync();
  return goals;
}

function deleteGoal(id) {
  const goals = getGoals().filter((goal) => goal.id !== id);
  saveGoals(goals);
  scheduleDebouncedSync();
  return goals;
}

function getActiveGoalsForProject(projectId) {
  return getGoals().filter((goal) => goal.status !== 'paused' && goal.status !== 'done' && goal.status !== 'failed' && goal.projectId === (projectId || UNCATEGORIZED_PROJECT_ID));
}

// 一次性迁移：确保项目预设存在，并把没有 projectId 的旧番茄归到「未分类」
function ensureProjectMigration() {
  getProjects(); // 触发首次预设写入

  const records = getRecords();
  let changed = false;

  records.forEach((record) => {
    if (!record.projectId) {
      record.projectId = UNCATEGORIZED_PROJECT_ID;
      changed = true;
    }
  });

  if (changed) {
    saveRecords(records);
  }
}

// 目标进度：只统计标记了该目标的番茄，不再把同项目所有番茄都算进去
function getGoalProgress(goal) {
  if (!goal) {
    return { done: 0, target: 0, percent: 0 };
  }

  const target = Number(goal.targetPomodoros) || 0;
  const records = getRecords().filter((record) => {
    if (!record.goalId || record.goalId !== goal.id) {
      return false;
    }

    if (goal.startDate && record.date < goal.startDate) {
      return false;
    }

    return true;
  });
  const done = records.length;
  const percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;

  return { done, target, percent };
}

// 每日自我评价（日记），结构为 { [date]: text }
function getJournals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.journals);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveJournals(obj) {
  try {
    const journals = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
    localStorage.setItem(STORAGE_KEYS.journals, JSON.stringify(journals));
    return journals;
  } catch (error) {
    return {};
  }
}

function getJournal(dateStr) {
  return getJournals()[dateStr] || '';
}

function setJournal(dateStr, text) {
  const journals = getJournals();
  const trimmed = String(text || '').trim();

  if (trimmed) {
    journals[dateStr] = trimmed;
  } else {
    delete journals[dateStr];
  }

  saveJournals(journals);
  scheduleDebouncedSync();
  return journals;
}

// 合并两份日记：按日期，本地优先；远端独有的日期补入
function mergeJournals(localJournals, remoteJournals) {
  const local = localJournals && typeof localJournals === 'object' ? localJournals : {};
  const remote = remoteJournals && typeof remoteJournals === 'object' ? remoteJournals : {};
  return { ...remote, ...local };
}

// 自由提问对话记录（全部保留），每条为一次问答
function getChats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.chats);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveChats(arr) {
  try {
    const chats = Array.isArray(arr) ? arr : [];
    localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(chats));
    return chats;
  } catch (error) {
    return [];
  }
}

function addChatEntry(question, answer) {
  const chats = getChats();
  chats.push({
    id: generateId(),
    date: today(),
    createdAt: new Date().toISOString(),
    question: String(question || ''),
    answer: String(answer || '')
  });
  saveChats(chats);
  scheduleDebouncedSync();
  return chats;
}

function mergeChats(localChats, remoteChats) {
  return mergeById(localChats, remoteChats);
}

// 从持久化的对话记录恢复内存中的对话（按时间排序）
function loadChatHistoryFromStore() {
  const chats = getChats()
    .slice()
    .sort((left, right) => (left.createdAt || '').localeCompare(right.createdAt || ''));

  APP_STATE.coachChatHistory = [];
  chats.forEach((chat) => {
    if (chat.question) APP_STATE.coachChatHistory.push({ role: 'user', content: chat.question });
    if (chat.answer) APP_STATE.coachChatHistory.push({ role: 'assistant', content: chat.answer });
  });
}

function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_SETTINGS,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      ...VOLATILE_SETTINGS
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS, ...VOLATILE_SETTINGS };
  }
}

function saveSettings(obj) {
  try {
    const patch = obj && typeof obj === 'object' ? obj : {};

    VOLATILE_SETTINGS_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        VOLATILE_SETTINGS[key] = String(patch[key] || '');
      }
    });

    const currentSettings = getSettings();
    const nextSettings = {
      ...DEFAULT_SETTINGS,
      ...currentSettings,
      ...patch
    };

    const persistentSettings = { ...nextSettings };
    VOLATILE_SETTINGS_KEYS.forEach((key) => {
      delete persistentSettings[key];
    });

    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(persistentSettings));
    return {
      ...persistentSettings,
      ...VOLATILE_SETTINGS
    };
  } catch (error) {
    return { ...DEFAULT_SETTINGS, ...VOLATILE_SETTINGS };
  }
}

function getReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reports);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveReports(arr) {
  try {
    const reports = Array.isArray(arr) ? arr : [];
    localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(reports));
    return reports;
  } catch (error) {
    return [];
  }
}

function addReport(report) {
  try {
    const reports = getReports();
    reports.push(report);
    return saveReports(reports);
  } catch (error) {
    return [];
  }
}

function cleanOldReports() {
  // 按类型分别保留最近 30 条，避免日报过多把周报挤掉（周报需长期用于纵向对比）
  const byType = {};
  getReports().forEach((report) => {
    const type = report.type || 'daily';
    (byType[type] = byType[type] || []).push(report);
  });

  const kept = [];
  Object.keys(byType).forEach((type) => {
    const sorted = byType[type]
      .slice()
      .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
      .slice(0, 30);
    kept.push(...sorted);
  });

  return saveReports(kept);
}

function getStorageUsageInfo() {
  try {
    let total = 0;

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (!key) {
        continue;
      }

      total += (key.length + (localStorage.getItem(key) || '').length) * 2;
    }

    const usedKB = total / 1024;
    const usedPercent = Math.round((usedKB / 5120) * 100);
    return { usedKB, usedPercent };
  } catch (error) {
    return { usedKB: 0, usedPercent: 0 };
  }
}

function getAchievements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.achievements);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveAchievements(arr) {
  try {
    const achievements = Array.isArray(arr) ? arr : [];
    localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify(achievements));
    return achievements;
  } catch (error) {
    return [];
  }
}

function addAchievement(achievement) {
  try {
    const achievements = getAchievements();
    achievements.push(achievement);
    return saveAchievements(achievements);
  } catch (error) {
    return [];
  }
}

async function createGist(token, data) {
  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: {
        [GIST_FILE_NAME]: {
          content: JSON.stringify(data)
        }
      },
      description: '番茄教练同步数据',
      public: false
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function findExistingSyncGist(token) {
  const response = await fetch('https://api.github.com/gists?per_page=100', {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const gists = await response.json();

  if (!Array.isArray(gists)) {
    return null;
  }

  return gists.find((gist) => gist?.files?.[GIST_FILE_NAME]) || null;
}

async function fetchGistData(token, gistId) {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.files[GIST_FILE_NAME].content);
}

async function updateGistData(token, gistId, data) {
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: {
        [GIST_FILE_NAME]: {
          content: JSON.stringify(data)
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// ========== 端到端加密模块 ==========

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function deriveEncryptionKey(password) {
  const enc = new TextEncoder();
  const salt = enc.encode('tomato-coach-pbkdf2-salt-2024');
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(plaintext) {
  const password = getSettings().syncPassword || '';

  if (!password) {
    throw new Error('no_password');
  }

  const key = await deriveEncryptionKey(password);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  const ivArray = new Uint8Array(iv);
  const ctArray = new Uint8Array(ciphertext);
  const combined = new Uint8Array(ivArray.length + ctArray.length);
  combined.set(ivArray);
  combined.set(ctArray, ivArray.length);

  return bytesToBase64(combined);
}

async function decryptData(encryptedBase64) {
  const password = getSettings().syncPassword || '';

  if (!password) {
    throw new Error('no_password');
  }

  const combined = base64ToBytes(encryptedBase64);

  if (combined.length < 13) {
    throw new Error('数据损坏');
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const key = await deriveEncryptionKey(password);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

function getPwdHint() {
  try {
    return localStorage.getItem(STORAGE_KEYS.syncPwdHint) || '';
  } catch (error) {
    return '';
  }
}

function savePwdHint(hint) {
  try {
    const normalizedHint = String(hint || '').trim();

    if (!normalizedHint) {
      localStorage.removeItem(STORAGE_KEYS.syncPwdHint);
      return;
    }

    localStorage.setItem(STORAGE_KEYS.syncPwdHint, normalizedHint);
  } catch (error) {
    // ignore pwd hint save failures
  }
}

function promptSyncPassword(action = 'sync') {
  return new Promise((resolve, reject) => {
    const actionText = action === 'import' ? '解密导入' : (action === 'export' ? '加密导出' : '同步');
    const modal = openModal(`
      <h2 class="modal__title">🔐 密码验证</h2>
      <div class="modal__body">
        <div class="pwd-prompt">
          <p class="pwd-prompt__desc">请输入密码短语以${actionText}数据</p>
          <input id="pwd-prompt-input" class="settings-field__input" type="password" placeholder="输入密码短语" autocomplete="off">
          <p class="pwd-prompt__hint" id="pwd-prompt-hint-display"></p>
          <div class="pwd-prompt__actions">
            <button id="pwd-prompt-cancel" class="btn btn--ghost" type="button">取消</button>
            <button id="pwd-prompt-confirm" class="btn btn--primary" type="button">确认</button>
          </div>
        </div>
      </div>
    `);

    const input = modal.querySelector('#pwd-prompt-input');
    const confirmBtn = modal.querySelector('#pwd-prompt-confirm');
    const cancelBtn = modal.querySelector('#pwd-prompt-cancel');
    const hintDisplay = modal.querySelector('#pwd-prompt-hint-display');
    const hint = getPwdHint();
    let settled = false;

    if (hintDisplay && hint) {
      hintDisplay.textContent = `💡 提示：${hint}`;
    }

    const doResolve = (password) => {
      if (settled) {
        return;
      }

      settled = true;
      closeActiveModal();
      resolve(password);
    };

    const doReject = () => {
      if (settled) {
        return;
      }

      settled = true;
      closeActiveModal();
      reject(new Error('cancelled'));
    };

    confirmBtn?.addEventListener('click', () => {
      const pwd = input?.value.trim() || '';

      if (!pwd) {
        showToast('请输入密码短语', 'error');
        return;
      }

      doResolve(pwd);
    });

    cancelBtn?.addEventListener('click', doReject);

    input?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      const pwd = input.value.trim();

      if (!pwd) {
        showToast('请输入密码短语', 'error');
        return;
      }

      doResolve(pwd);
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        doReject();
      }
    });

    window.setTimeout(() => input?.focus(), 100);
  });
}

function mergeRecords(localRecords, remoteRecords) {
  const map = new Map();

  remoteRecords.forEach((record) => {
    if (record && record.id) {
      map.set(record.id, record);
    }
  });

  localRecords.forEach((record) => {
    if (record && record.id) {
      map.set(record.id, record);
    }
  });

  return Array.from(map.values());
}

// 项目/目标按 id 合并：本地优先（冲突时保留本地），双方独有的都保留
function mergeById(localItems, remoteItems) {
  const map = new Map();

  (Array.isArray(remoteItems) ? remoteItems : []).forEach((item) => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });

  (Array.isArray(localItems) ? localItems : []).forEach((item) => {
    if (item && item.id) {
      map.set(item.id, item);
    }
  });

  return Array.from(map.values());
}

function mergeProjects(localProjects, remoteProjects) {
  const merged = mergeById(localProjects, remoteProjects);

  // 确保「未分类」始终存在
  if (!merged.some((project) => project.id === UNCATEGORIZED_PROJECT_ID)) {
    merged.unshift(DEFAULT_PROJECTS[0]);
  }

  return merged;
}

function mergeGoals(localGoals, remoteGoals) {
  return mergeById(localGoals, remoteGoals);
}

function mergeReports(localReports, remoteReports) {
  return mergeById(localReports, remoteReports);
}

function mergeReminders(localReminders, remoteReminders) {
  const STATUS_PRIORITY = { improved: 4, active: 3, deferred: 2, ignored: 1 };
  const map = new Map();

  remoteReminders.forEach((reminder) => {
    if (reminder && reminder.id) {
      map.set(reminder.id, reminder);
    }
  });

  localReminders.forEach((reminder) => {
    if (!reminder || !reminder.id) {
      return;
    }

    const existing = map.get(reminder.id);

    if (!existing) {
      map.set(reminder.id, reminder);
      return;
    }

    const localPriority = STATUS_PRIORITY[reminder.status] || 0;
    const remotePriority = STATUS_PRIORITY[existing.status] || 0;

    if (localPriority >= remotePriority) {
      map.set(reminder.id, reminder);
    }
  });

  return Array.from(map.values());
}

function addRecord(record) {
  try {
    const records = getRecords();
    records.push(record);
    return saveRecords(records);
  } catch (error) {
    return [];
  }
}

function updateRecord(id, patch) {
  try {
    const records = getRecords();
    const target = records.find((record) => record.id === id);

    if (!target) {
      return records;
    }

    Object.assign(target, patch);
    return saveRecords(records);
  } catch (error) {
    return [];
  }
}

function deleteRecord(id) {
  try {
    const records = getRecords().filter((record) => record.id !== id);
    return saveRecords(records);
  } catch (error) {
    return [];
  }
}

function addReminder(reminder) {
  try {
    const reminders = getReminders();
    reminders.push(reminder);
    return saveReminders(reminders);
  } catch (error) {
    return [];
  }
}

function updateReminder(id, patch) {
  try {
    const reminders = getReminders();
    const target = reminders.find((reminder) => reminder.id === id);

    if (!target) {
      return reminders;
    }

    Object.assign(target, patch);
    return saveReminders(reminders);
  } catch (error) {
    return [];
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateCN(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);

  if (!year || !month || !day) {
    return '';
  }

  return `${month}月${day}日`;
}

function getRecordsByDate(dateStr) {
  return getRecords().filter((record) => record.date === dateStr);
}

const TIMER_STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  EVALUATING: 'evaluating',
  BREAK: 'break'
};

// Reminder escalation rules:
// consecutiveDays === 1 -> gentle
// consecutiveDays >= 3 && < 5 -> moderate
// consecutiveDays >= 5 -> urgent
const REMINDER_LEVELS = {
  GENTLE: 'gentle',
  MODERATE: 'moderate',
  URGENT: 'urgent'
};

const ACHIEVEMENT_OPTIONS = [
  { value: 'full', label: '✅ 完全达成', icon: '✅' },
  { value: 'partial', label: '🔶 部分达成', icon: '🔶' },
  { value: 'none', label: '❌ 未达成', icon: '❌' }
];

const ACHIEVEMENT_ICONS = ACHIEVEMENT_OPTIONS.reduce((result, option) => {
  result[option.value] = option.icon;
  return result;
}, {});

const now = new Date();

const APP_STATE = {
  timerState: TIMER_STATES.IDLE,
  intervalId: null,
  alarmInterval: null,
  remainingSeconds: DEFAULT_SETTINGS.timerDuration * 60,
  breakType: null,
  pendingAlarm: false,
  sessionGoal: '',
  sessionProjectId: UNCATEGORIZED_PROJECT_ID,
  sessionStartTime: '',
  sessionDate: today(),
  sessionDurationMinutes: DEFAULT_SETTINGS.timerDuration,
  modalElement: null,
  timerEventsBound: false,
  historyViewYear: now.getFullYear(),
  historyViewMonth: now.getMonth(),
  historySelectedDate: today(),
  historyEventsBound: false,
  coachEventsBound: false,
  coachActiveTab: 'daily',
  coachChatHistory: [],
  settingsEventsBound: false,
  pendingSwUpdate: false,
  sessionEndEpoch: 0,
  endTimeoutId: null
};

const NOTIFICATION_ICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍅</text></svg>";

let _keepAliveAudio = null;
let _keepAliveAudioUrl = null;
let _audioCtx = null;
let _wakeLock = null;

const DOM = {};

let _syncDebounceTimer = null;
let _syncInProgress = false;

function cacheTimerDom() {
  DOM.coachNagArea = document.getElementById('coach-nag-area');
  DOM.todayCount = document.getElementById('today-count');
  DOM.countdownDisplay = document.getElementById('countdown-display');
  DOM.timerStatus = document.getElementById('timer-status');
  DOM.startTimerBtn = document.getElementById('start-timer-btn');
  DOM.pauseTimerBtn = document.getElementById('pause-timer-btn');
  DOM.stopTimerBtn = document.getElementById('stop-timer-btn');
  DOM.calendarReminderBtn = document.getElementById('calendar-reminder-btn');
  DOM.calendarReminderArea = document.getElementById('calendar-reminder-area');
  DOM.todayRecords = document.getElementById('today-records');
  DOM.historyTitle = document.getElementById('history-title');
  DOM.historyPrevMonth = document.getElementById('history-prev-month');
  DOM.historyNextMonth = document.getElementById('history-next-month');
  DOM.historyCalendar = document.getElementById('history-calendar');
  DOM.historyDetail = document.getElementById('history-detail');
  DOM.historyDetailTitle = document.getElementById('history-detail-title');
  DOM.historyAddRecord = document.getElementById('history-add-record');
  DOM.historyRecords = document.getElementById('history-records');
  DOM.coachActiveTitle = document.getElementById('coach-active-title');
  DOM.coachActiveReminders = document.getElementById('coach-active-reminders');
  DOM.coachImprovedReminders = document.getElementById('coach-improved-reminders');
  DOM.coachArchivedReminders = document.getElementById('coach-archived-reminders');
  DOM.coachFeedback = document.getElementById('coach-feedback');
  DOM.coachTabButtons = Array.from(document.querySelectorAll('[data-coach-tab]'));
  DOM.coachTabPanels = Array.from(document.querySelectorAll('.coach-tab-panel'));
  DOM.dailySummaryCount = document.getElementById('daily-summary-count');
  DOM.dailySummaryPreview = document.getElementById('daily-summary-preview');
  DOM.generateDailySummaryBtn = document.getElementById('generate-daily-summary');
  DOM.dailySummaryResult = document.getElementById('daily-summary-result');
  DOM.dailySelfNote = document.getElementById('daily-self-note');
  DOM.dailySelfNoteSave = document.getElementById('daily-self-note-save');
  DOM.weeklyStartDate = document.getElementById('weekly-start-date');
  DOM.weeklyEndDate = document.getElementById('weekly-end-date');
  DOM.generateWeeklyReportBtn = document.getElementById('generate-weekly-report');
  DOM.weeklyReportResult = document.getElementById('weekly-report-result');
  DOM.chatHistory = document.getElementById('chat-history');
  DOM.chatForm = document.getElementById('chat-form');
  DOM.chatInput = document.getElementById('chat-input');
  DOM.sendChatBtn = document.getElementById('send-chat-btn');
  DOM.settingsApiKey = document.getElementById('settings-api-key');
  DOM.toggleApiKeyVisibility = document.getElementById('toggle-api-key-visibility');
  DOM.settingsApiBase = document.getElementById('settings-api-base');
  DOM.settingsModel = document.getElementById('settings-model');
  DOM.settingsModelCustom = document.getElementById('settings-model-custom');
  DOM.settingsApiSave = document.getElementById('settings-api-save');
  DOM.settingsApiTest = document.getElementById('settings-api-test');
  DOM.settingsToneOptions = Array.from(document.querySelectorAll('.tone-option'));
  DOM.settingsEvalModeButtons = Array.from(document.querySelectorAll('.eval-mode-btn'));
  DOM.settingsTimerDuration = document.getElementById('settings-timer-duration');
  DOM.settingsShortBreak = document.getElementById('settings-short-break');
  DOM.settingsLongBreak = document.getElementById('settings-long-break');
  DOM.settingsTimerSave = document.getElementById('settings-timer-save');
  DOM.exportCopyToday = document.getElementById('export-copy-today');
  DOM.exportCopyWeek = document.getElementById('export-copy-week');
  DOM.exportCsv = document.getElementById('export-csv');
  DOM.exportLlmXls = document.getElementById('export-llm-xls');
  DOM.exportJson = document.getElementById('export-json');
  DOM.importJsonBtn = document.getElementById('import-json-btn');
  DOM.importJsonInput = document.getElementById('import-json-input');
  DOM.clearOldData = document.getElementById('clear-old-data');
  DOM.clearAllData = document.getElementById('clear-all-data');
  DOM.dailyReportHistory = document.getElementById('daily-report-history');
  DOM.weeklyReportHistory = document.getElementById('weekly-report-history');
  DOM.storageBarFill = document.getElementById('storage-bar-fill');
  DOM.storageUsageLabel = document.getElementById('storage-usage-label');
  DOM.settingsGithubToken = document.getElementById('settings-github-token');
  DOM.settingsGistId = document.getElementById('settings-gist-id');
  DOM.settingsPwdHint = document.getElementById('settings-pwd-hint');
  DOM.settingsAutoSyncToggle = document.getElementById('settings-auto-sync-toggle');
  DOM.settingsSyncStatus = document.getElementById('settings-sync-status');
  DOM.settingsSyncSave = document.getElementById('settings-sync-save');
  DOM.settingsSyncNow = document.getElementById('settings-sync-now');
  DOM.toggleGithubTokenVisibility = document.getElementById('toggle-github-token-visibility');
  renderModelSelector();
}

function padNumber(value) {
  return String(value).padStart(2, '0');
}

function toDateString(year, monthIndex, day) {
  return `${year}-${padNumber(monthIndex + 1)}-${padNumber(day)}`;
}

function formatDateValue(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function parseDateString(dateStr) {
  const [year, month, day] = (dateStr || '').split('-').map(Number);
  return { year, month, day };
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getMonthLabel(year, monthIndex) {
  return `${year}年${monthIndex + 1}月`;
}

function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = (timeStr || '').split(':').map(Number);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return Number.NaN;
  }

  return hours * 60 + minutes;
}

function formatMinutesOfDay(totalMinutes) {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${padNumber(hours)}:${padNumber(minutes)}`;
}

function getDurationMinutes(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return end - start;
}

function sortRecordsByStartTimeDesc(records) {
  return records.slice().sort((left, right) => {
    const timeResult = right.startTime.localeCompare(left.startTime);

    if (timeResult !== 0) {
      return timeResult;
    }

    return (right.createdAt || '').localeCompare(left.createdAt || '');
  });
}

function sortRecordsByDateTimeDesc(records) {
  return records.slice().sort((left, right) => {
    const dateResult = (right.date || '').localeCompare(left.date || '');

    if (dateResult !== 0) {
      return dateResult;
    }

    const timeResult = (right.startTime || '').localeCompare(left.startTime || '');

    if (timeResult !== 0) {
      return timeResult;
    }

    return (right.createdAt || '').localeCompare(left.createdAt || '');
  });
}

function getRecordsByDateRange(startDate, endDate) {
  return sortRecordsByDateTimeDesc(getRecords().filter((record) => {
    return record.date >= startDate && record.date <= endDate;
  }));
}

function getPreviousWeekRange() {
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(current);
  thisMonday.setDate(current.getDate() + mondayOffset);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);

  return {
    startDate: formatDateValue(lastMonday),
    endDate: formatDateValue(lastSunday)
  };
}

function getCurrentWeekRange() {
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(current);
  thisMonday.setDate(current.getDate() + mondayOffset);

  return {
    startDate: formatDateValue(thisMonday),
    endDate: today()
  };
}

function checkAndAwardAchievements() {
  const todayStr = today();
  const todayRecords = getRecordsByDate(todayStr);

  if (!todayRecords.length) {
    return;
  }

  const awarded = getAchievements().slice();
  const hasEarnedToday = (type) => {
    return awarded.some((achievement) => achievement.type === type && achievement.earnedDate === todayStr);
  };
  const award = (type, description, toastMessage) => {
    if (hasEarnedToday(type)) {
      return;
    }

    const achievement = {
      id: generateId(),
      type,
      earnedDate: todayStr,
      description
    };

    addAchievement(achievement);
    awarded.push(achievement);
    showToast(toastMessage);
  };

  if (todayRecords.length >= 3 && todayRecords.every((record) => record.interrupted === false)) {
    award('no_interrupt', '今日零打断', '🧘 心流时刻：今日全程零打断！');
  }

  if (todayRecords.length >= 4) {
    award('daily_4plus', `完成 ${todayRecords.length} 个番茄`, `🎯 高效达人：今日完成 ${todayRecords.length} 个番茄！`);
  }

  const past30Start = formatDateValue(new Date(Date.now() - 30 * 86400000));
  const historicalRecords = getRecords().filter((record) => {
    return record.date >= past30Start && record.date < todayStr && Number.isFinite(Number(record.quality));
  });

  if (historicalRecords.length >= 10) {
    const todayAvg = todayRecords.reduce((sum, record) => sum + Number(record.quality || 0), 0) / todayRecords.length;
    const historyAvg = historicalRecords.reduce((sum, record) => sum + Number(record.quality || 0), 0) / historicalRecords.length;

    if (todayAvg > historyAvg) {
      award('quality_peak', `质量均分 ${todayAvg.toFixed(1)}`, `⭐ 质量新高：今日均分 ${todayAvg.toFixed(1)}，超越历史！`);
    }
  }
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function formatSyncTime(dateStr) {
  const parsed = new Date(dateStr || '');

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return `${parsed.getMonth() + 1}月${parsed.getDate()}日 ${padNumber(parsed.getHours())}:${padNumber(parsed.getMinutes())}`;
}

function renderSyncStatus(state = 'idle', errorMsg = '') {
  if (!DOM.settingsSyncStatus) {
    return;
  }

  const container = DOM.settingsSyncStatus;
  container.className = 'settings-sync-status';

  if (state === 'syncing') {
    container.textContent = '🔄 正在同步…';
    container.classList.add('settings-sync-status--syncing');
    return;
  }

  if (state === 'error') {
    container.textContent = errorMsg || '同步失败';
    container.classList.add('settings-sync-status--error');
    return;
  }

  const settings = getSettings();
  const token = String(settings.githubToken || '').trim();

  if (settings.lastSyncedAt) {
    container.textContent = `✅ 上次同步：${formatSyncTime(settings.lastSyncedAt)}`;
    container.classList.add('settings-sync-status--ok');
    return;
  }

  if (!token) {
    container.textContent = '尚未配置同步';
    return;
  }

  container.textContent = '已配置，尚未同步';
}

async function performSync() {
  const settings = getSettings();
  const token = String(settings.githubToken || '').trim();
  const gistId = String(settings.gistId || '').trim();

  if (!token) {
    showToast('请先在设置页面配置 GitHub Token', 'error');
    return false;
  }

  let password = getSettings().syncPassword || '';
  if (!password) {
    try {
      password = await promptSyncPassword('sync');
      saveSettings({ syncPassword: password });
    } catch (error) {
      return false;
    }
  }

  renderSyncStatus('syncing');

  const previousSyncState = _syncInProgress;
  _syncInProgress = true;

  try {
    const nowIso = new Date().toISOString();
    const localRecords = getRecords();
    const localReminders = getReminders();
    const localProjects = getProjects();
    const localGoals = getGoals();
    const localReports = getReports();
    const localJournals = getJournals();
    const localChats = getChats();
    let activeGistId = gistId;

    if (!activeGistId) {
      const existingGist = await findExistingSyncGist(token);

      if (existingGist?.id) {
        activeGistId = existingGist.id;
        saveSettings({ gistId: activeGistId });

        if (DOM.settingsGistId) {
          DOM.settingsGistId.value = activeGistId;
        }
      }
    }

    if (!activeGistId) {
      const encryptedPayload = await encryptData(JSON.stringify({
        version: 3,
        lastModified: nowIso,
        records: localRecords,
        reminders: localReminders,
        projects: localProjects,
        goals: localGoals,
        reports: localReports,
        journals: localJournals,
        chats: localChats
      }));
      const created = await createGist(token, {
        encrypted: true,
        data: encryptedPayload
      });

      saveSettings({ gistId: created.id || '', lastSyncedAt: nowIso });
      if (DOM.settingsGistId) {
        DOM.settingsGistId.value = created.id || '';
      }
      renderSyncStatus('ok');
      showToast('✅ 已创建云端同步并完成首轮同步');
      return true;
    }

    let remoteData = await fetchGistData(token, activeGistId);

    if (remoteData?.encrypted === true) {
      if (typeof remoteData.data !== 'string') {
        throw new Error('加密数据格式不正确');
      }

      remoteData = JSON.parse(await decryptData(remoteData.data));
    }

    const mergedRecords = mergeRecords(localRecords, Array.isArray(remoteData.records) ? remoteData.records : []);
    const mergedReminders = mergeReminders(localReminders, Array.isArray(remoteData.reminders) ? remoteData.reminders : []);
    const mergedProjects = mergeProjects(localProjects, Array.isArray(remoteData.projects) ? remoteData.projects : []);
    const mergedGoals = mergeGoals(localGoals, Array.isArray(remoteData.goals) ? remoteData.goals : []);
    const mergedReports = mergeReports(localReports, Array.isArray(remoteData.reports) ? remoteData.reports : []);
    const mergedJournals = mergeJournals(localJournals, remoteData.journals);
    const mergedChats = mergeChats(localChats, Array.isArray(remoteData.chats) ? remoteData.chats : []);
    const addedRecordCount = Math.max(0, mergedRecords.length - localRecords.length);
    const addedReminderCount = Math.max(0, mergedReminders.length - localReminders.length);

    saveRecords(mergedRecords);
    saveReminders(mergedReminders);
    saveProjects(mergedProjects);
    saveGoals(mergedGoals);
    saveReports(mergedReports);
    saveJournals(mergedJournals);
    saveChats(mergedChats);
    cleanOldReports();
    loadChatHistoryFromStore();

    const encryptedPayload = await encryptData(JSON.stringify({
      version: 3,
      lastModified: nowIso,
      records: mergedRecords,
      reminders: mergedReminders,
      projects: mergedProjects,
      goals: mergedGoals,
      reports: getReports(),
      journals: mergedJournals,
      chats: mergedChats
    }));

    await updateGistData(token, activeGistId, {
      encrypted: true,
      data: encryptedPayload
    });

    saveSettings({ gistId: activeGistId, lastSyncedAt: nowIso });
    refreshRecordViews();
    refreshReminderViews();
    renderReportHistory('daily');
    renderReportHistory('weekly');
    renderChatHistory();
    showToast(`✅ 同步完成：本地 ${mergedRecords.length} 条记录（云端新增 ${addedRecordCount} 条）`);
    renderSyncStatus('ok');
    return true;
  } catch (error) {
    const statusMatch = error?.message?.match(/HTTP (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
    let message;

    if (error?.message === 'no_password') {
      saveSettings({ syncPassword: '' });
      message = '密码已清除，请重新同步';
    } else if (error?.name === 'OperationError') {
      message = '同步失败：密码错误或云端数据已损坏';
    } else if (status === 401) {
      message = '同步失败：GitHub Token 无效或权限不足';
    } else if (status === 404) {
      saveSettings({ gistId: '' });
      if (DOM.settingsGistId) {
        DOM.settingsGistId.value = '';
      }
      message = '同步失败：Gist 不存在，请检查或清除 Gist ID';
    } else {
      message = `同步失败：${error.message}`;
    }

    showToast(message, 'error');
    renderSyncStatus('error', message);
    return false;
  } finally {
    _syncInProgress = previousSyncState;
  }
}

async function exportConfig() {
  let passwordProvided = false;

  try {
    const settings = getSettings();
    const payload = JSON.stringify({
      apiKey: settings.apiKey || '',
      apiBase: settings.apiBase || '',
      model: settings.model || '',
      githubToken: settings.githubToken || '',
      gistId: settings.gistId || '',
    });

    const password = await promptSyncPassword('export');
    saveSettings({ syncPassword: password });
    passwordProvided = true;

    const encrypted = await encryptData(payload);
    const code = `CFG:${btoa(encrypted)}`;

    if (!navigator.clipboard?.writeText) {
      throw new Error('当前环境不支持自动复制');
    }

    await navigator.clipboard.writeText(code);
    showToast('✅ 配置已复制到剪贴板，粘贴到新设备的“导入配置”即可');
  } catch (error) {
    if (error?.message === 'cancelled') {
      return;
    }

    if (error?.message === 'no_password') {
      showToast('请输入密码短语', 'error');
      return;
    }

    showToast(`导出失败：${error.message}`, 'error');
  } finally {
    if (passwordProvided) {
      saveSettings({ syncPassword: '' });
    }
  }
}

async function importConfig() {
  const modal = openModal(`
    <h2 class="modal__title">📥 导入配置</h2>
    <div class="modal__body">
      <p style="margin-bottom:12px;font-size:14px">粘贴从其他设备导出的配置码，再输入当时设置的密码</p>
      <textarea id="config-import-code" class="settings-field__input" rows="4" placeholder="粘贴配置码（CFG:...）" style="width:100%;margin-bottom:12px"></textarea>
      <div class="pwd-prompt__actions">
        <button class="btn btn--ghost" id="config-import-cancel" type="button">取消</button>
        <button class="btn btn--primary" id="config-import-confirm" type="button">导入</button>
      </div>
    </div>
  `);

  modal.querySelector('#config-import-cancel')?.addEventListener('click', () => closeActiveModal());
  modal.querySelector('#config-import-confirm')?.addEventListener('click', async () => {
    const code = modal.querySelector('#config-import-code')?.value.trim() || '';

    if (!code.startsWith('CFG:')) {
      showToast('配置码格式不正确，应以 CFG: 开头', 'error');
      return;
    }

    closeActiveModal();

    let passwordProvided = false;

    try {
      const password = await promptSyncPassword('import');
      saveSettings({ syncPassword: password });
      passwordProvided = true;

      const encrypted = atob(code.slice(4));
      const payload = JSON.parse(await decryptData(encrypted));

      saveSettings({
        apiKey: payload?.apiKey || '',
        apiBase: payload?.apiBase || '',
        model: payload?.model || '',
        githubToken: payload?.githubToken || '',
        gistId: payload?.gistId || '',
      });

      initSettingsPage();
      showToast('✅ 配置导入成功！');
    } catch (error) {
      if (error?.message === 'cancelled') {
        return;
      }

      if (error?.message === 'no_password') {
        showToast('请输入密码短语', 'error');
        return;
      }

      showToast('导入失败：密码错误或配置码已损坏', 'error');
    } finally {
      if (passwordProvided) {
        saveSettings({ syncPassword: '' });
      }
    }
  });

  modal.querySelector('#config-import-code')?.focus();
}

function cancelDebouncedSync() {
  clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = null;
}

function scheduleDebouncedSync() {
  if (_syncInProgress) return;

  const settings = getSettings();
  const token = String(settings.githubToken || '').trim();

  if (!settings.autoSync || !token) {
    cancelDebouncedSync();
    return;
  }

  cancelDebouncedSync();
  _syncDebounceTimer = window.setTimeout(() => {
    _syncDebounceTimer = null;
    _syncInProgress = true;
    performSync().finally(() => {
      _syncInProgress = false;
    });
  }, 3000);
}

function getSelectedSettingsModelValue() {
  if (!DOM.settingsModel) {
    return DEFAULT_SETTINGS.model;
  }

  if (DOM.settingsModel.value === 'custom') {
    return (DOM.settingsModelCustom?.value || '').trim();
  }

  return DOM.settingsModel.value;
}

function renderModelSelector() {
  if (!DOM.settingsModel) return;

  const currentValue = DOM.settingsModel.value;

  DOM.settingsModel.replaceChildren();

  PRESET_MODEL_GROUPS.forEach((group) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.label;

    group.models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.value;
      option.textContent = model.label;
      optgroup.appendChild(option);
    });

    DOM.settingsModel.appendChild(optgroup);
  });

  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = '✏️ 自定义';
  DOM.settingsModel.appendChild(customOption);

  if (currentValue) {
    DOM.settingsModel.value = currentValue;
  }
}

function getSuggestedBaseForModel(modelValue) {
  for (const group of PRESET_MODEL_GROUPS) {
    if (group.models.some((model) => model.value === modelValue)) {
      return group.suggestedBase || '';
    }
  }

  return '';
}

function syncSettingsModelField(modelValue) {
  if (!DOM.settingsModel || !DOM.settingsModelCustom) {
    return;
  }

  // 确保选项已渲染（DOM 可能尚未填充）
  if (DOM.settingsModel.options.length <= 1) renderModelSelector();

  const isPresetModel = PRESET_MODELS.includes(modelValue);
  DOM.settingsModel.value = isPresetModel ? modelValue : 'custom';
  DOM.settingsModelCustom.hidden = isPresetModel;
  DOM.settingsModelCustom.value = isPresetModel ? '' : modelValue;
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function triggerDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result || ''));
    };
    reader.onerror = () => {
      reject(reader.error || new Error('读取文件失败'));
    };
    reader.readAsText(file, 'utf-8');
  });
}

function isFutureMonth(year, monthIndex) {
  const current = new Date();

  if (year > current.getFullYear()) {
    return true;
  }

  return year === current.getFullYear() && monthIndex > current.getMonth();
}

function setHistoryMonth(year, monthIndex, preferredDay = 1) {
  const monthDate = new Date(year, monthIndex, 1);
  const nextYear = monthDate.getFullYear();
  const nextMonth = monthDate.getMonth();

  if (isFutureMonth(nextYear, nextMonth)) {
    return;
  }

  const safeDay = Math.min(Math.max(1, preferredDay), getDaysInMonth(nextYear, nextMonth));
  APP_STATE.historyViewYear = nextYear;
  APP_STATE.historyViewMonth = nextMonth;
  APP_STATE.historySelectedDate = toDateString(nextYear, nextMonth, safeDay);
}

function syncHistoryViewToDate(dateStr) {
  const { year, month, day } = parseDateString(dateStr);

  if (!year || !month || !day) {
    return;
  }

  APP_STATE.historyViewYear = year;
  APP_STATE.historyViewMonth = month - 1;
  APP_STATE.historySelectedDate = toDateString(year, month - 1, day);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReminderDate(dateStr) {
  return dateStr ? formatDateCN(dateStr) : '未记录';
}

function getReminderDayCount(reminder) {
  const count = Number(reminder.consecutiveDays);

  if (!Number.isFinite(count) || count < 1) {
    return 1;
  }

  return Math.floor(count);
}

function getReminderLastDate(reminder) {
  return reminder.lastReminderDate || reminder.createdDate || today();
}

function sortRemindersByDays(reminders) {
  return reminders.slice().sort((left, right) => {
    const dayDiff = getReminderDayCount(right) - getReminderDayCount(left);

    if (dayDiff !== 0) {
      return dayDiff;
    }

    return (right.createdDate || '').localeCompare(left.createdDate || '');
  });
}

function sortRemindersByRecentDate(reminders, key) {
  return reminders.slice().sort((left, right) => {
    const rightValue = right[key] || right.createdDate || '';
    const leftValue = left[key] || left.createdDate || '';
    return rightValue.localeCompare(leftValue);
  });
}

function getReminderLevel(reminder) {
  const dayCount = getReminderDayCount(reminder);

  if (dayCount >= 5) {
    return REMINDER_LEVELS.URGENT;
  }

  if (dayCount >= 3) {
    return REMINDER_LEVELS.MODERATE;
  }

  return REMINDER_LEVELS.GENTLE;
}

function getReminderLevelLabel(level) {
  if (level === REMINDER_LEVELS.URGENT) {
    return '顽固';
  }

  if (level === REMINDER_LEVELS.MODERATE) {
    return '加重';
  }

  return '温和';
}

function getActiveReminders() {
  return sortRemindersByDays(getReminders().filter((reminder) => reminder.status === 'active'));
}

function checkReminderDays() {
  getReminders().forEach((reminder) => {
    if (reminder.status !== 'active') {
      return;
    }

    const normalizedDays = getReminderDayCount(reminder);
    const normalizedLastDate = getReminderLastDate(reminder);

    if (normalizedLastDate !== today()) {
      updateReminder(reminder.id, {
        consecutiveDays: normalizedDays + 1,
        lastReminderDate: today()
      });
      return;
    }

    if (reminder.consecutiveDays !== normalizedDays || reminder.lastReminderDate !== normalizedLastDate) {
      updateReminder(reminder.id, {
        consecutiveDays: normalizedDays,
        lastReminderDate: normalizedLastDate
      });
    }
  });
}

function markReminderImproved(reminderId) {
  updateReminder(reminderId, {
    status: 'improved',
    practicedDate: today()
  });
}

function deferReminder(reminderId, reason = '') {
  updateReminder(reminderId, {
    status: 'deferred',
    feedbackReason: String(reason || '').trim(),
    statusChangedDate: today()
  });
}

function ignoreReminder(reminderId, reason = '') {
  updateReminder(reminderId, {
    status: 'ignored',
    feedbackReason: String(reason || '').trim(),
    statusChangedDate: today()
  });
}

function reactivateReminder(reminderId) {
  const reminder = getReminders().find((item) => item.id === reminderId);

  if (!reminder) {
    return;
  }

  updateReminder(reminderId, {
    status: 'active',
    consecutiveDays: getReminderDayCount(reminder),
    lastReminderDate: today(),
    practicedDate: null
  });
}

function getTimerDurationMinutes() {
  const rawDuration = Number(getSettings().timerDuration);

  if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
    return DEFAULT_SETTINGS.timerDuration;
  }

  return Math.max(1, Math.round(rawDuration));
}

// 生成系统日历提醒（iCalendar .ics 文件），到点触发系统级提醒，锁屏也能响应
function triggerCalendarReminder() {
  try {
    const endTime = new Date(Date.now() + APP_STATE.sessionEndEpoch - Date.now());
    if (Number.isNaN(endTime.getTime())) return;

    const pad = (value) => String(value).padStart(2, '0');
    const formatICSDate = (date) => {
      return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
    };

    const now = new Date();
    const start = formatICSDate(endTime);
    const end = formatICSDate(new Date(endTime.getTime() + 60000));
    const uid = `tomato-coach-${Date.now()}@tomato-coach`;
    const description = APP_STATE.sessionGoal ? `番茄目标：${APP_STATE.sessionGoal}` : '番茄教练提醒——番茄结束，请去记录。';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tomato Coach//Pomodoro Reminder//ZH-CN',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `UID:${uid}`,
      'SUMMARY:🍅 番茄教练提醒',
      `DESCRIPTION:${description}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT0M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${description}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tomato-reminder-${today()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('📆 日历提醒文件已下载，请打开它添加到系统日历');
  } catch (error) {
    showToast('生成日历提醒失败', 'error');
  }
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function clearTimerInterval() {
  if (APP_STATE.intervalId) {
    clearInterval(APP_STATE.intervalId);
    APP_STATE.intervalId = null;
  }
}

function closeActiveModal() {
  if (APP_STATE.modalElement) {
    APP_STATE.modalElement.remove();
    APP_STATE.modalElement = null;
  }
}

function openModal(content) {
  closeActiveModal();

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal__card" role="dialog" aria-modal="true">${content}</div>`;
  document.body.appendChild(modal);
  APP_STATE.modalElement = modal;

  return modal;
}

function updateTimerUI() {
  if (!DOM.countdownDisplay || !DOM.timerStatus) {
    return;
  }

  DOM.countdownDisplay.textContent = formatCountdown(APP_STATE.remainingSeconds);

  if (APP_STATE.timerState === TIMER_STATES.RUNNING) {
    DOM.timerStatus.textContent = `专注进行中：${APP_STATE.sessionGoal}`;
  } else if (APP_STATE.timerState === TIMER_STATES.PAUSED) {
    DOM.timerStatus.textContent = `已暂停：${APP_STATE.sessionGoal}`;
  } else if (APP_STATE.timerState === TIMER_STATES.BREAK) {
    DOM.timerStatus.textContent = APP_STATE.breakType === 'long' ? '长休息中，放松一下。' : '短休息中，喝口水吧。';
  } else if (APP_STATE.timerState === TIMER_STATES.EVALUATING) {
    DOM.timerStatus.textContent = '这个番茄结束了，来回顾一下。';
  } else {
    DOM.timerStatus.textContent = '准备开始一个新的番茄。';
  }

  if (DOM.startTimerBtn) {
    DOM.startTimerBtn.hidden = APP_STATE.timerState !== TIMER_STATES.IDLE;
  }

  if (DOM.pauseTimerBtn) {
    DOM.pauseTimerBtn.hidden = ![
      TIMER_STATES.RUNNING,
      TIMER_STATES.PAUSED
    ].includes(APP_STATE.timerState);
    DOM.pauseTimerBtn.textContent = APP_STATE.timerState === TIMER_STATES.PAUSED ? '继续' : '暂停';
  }

  if (DOM.stopTimerBtn) {
    DOM.stopTimerBtn.hidden = ![
      TIMER_STATES.RUNNING,
      TIMER_STATES.PAUSED,
      TIMER_STATES.BREAK
    ].includes(APP_STATE.timerState);
    DOM.stopTimerBtn.textContent = APP_STATE.timerState === TIMER_STATES.BREAK ? '结束休息' : '停止';
  }
}

function updateTodayCount(count) {
  if (!DOM.todayCount) {
    return;
  }

  DOM.todayCount.textContent = `今日 ${count} 🍅`;
}

function createRecordCard(record, options = {}) {
  const { showActions = false } = options;
  const card = document.createElement('article');
  card.className = 'record-card';

  const accent = document.createElement('div');
  accent.className = 'record-card__accent';

  const project = getProjectById(record.projectId);
  if (project) {
    accent.style.background = project.color || '#9E9E9E';
  }

  const body = document.createElement('div');
  body.className = 'record-card__body';

  const header = document.createElement('div');
  header.className = 'record-card__header';

  const meta = document.createElement('div');
  meta.className = 'record-card__meta';
  const energyText = record.energy ? ` | 精力${'●'.repeat(Number(record.energy))}` : '';
  meta.textContent = `${record.startTime}-${record.endTime} | ⭐${record.quality}颗 | ${ACHIEVEMENT_ICONS[record.achievement] || '❔'}${energyText}`;

  header.appendChild(meta);

  if (showActions) {
    const actions = document.createElement('div');
    actions.className = 'record-card__actions';

    const editButton = document.createElement('button');
    editButton.className = 'record-card__action';
    editButton.type = 'button';
    editButton.dataset.action = 'edit';
    editButton.dataset.id = record.id;
    editButton.textContent = '✏️ 编辑';

    const deleteButton = document.createElement('button');
    deleteButton.className = 'record-card__action';
    deleteButton.type = 'button';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.id = record.id;
    deleteButton.textContent = '🗑️ 删除';

    actions.append(editButton, deleteButton);
    header.appendChild(actions);
  }

  const goal = document.createElement('div');
  goal.className = 'record-card__goal';

  if (project) {
    const tag = document.createElement('span');
    tag.className = 'record-card__project';
    tag.style.background = project.color || '#9E9E9E';
    tag.textContent = `${project.icon || ''} ${project.name}`.trim();
    goal.appendChild(tag);
  }

  const goalText = document.createElement('span');
  goalText.className = 'record-card__goal-text';
  goalText.textContent = record.goal;
  goal.appendChild(goalText);

  const summary = document.createElement('div');
  summary.className = 'record-card__summary';
  summary.textContent = record.summary;

  body.append(header, goal, summary);
  card.append(accent, body);

  return card;
}

function renderRecordsList(container, records, options = {}) {
  const {
    emptyText = '还没有记录。',
    showActions = false
  } = options;

  container.replaceChildren();

  if (!records.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'record-empty';
    emptyState.textContent = emptyText;
    container.appendChild(emptyState);
    return;
  }

  records.forEach((record) => {
    container.appendChild(createRecordCard(record, { showActions }));
  });
}

function renderTodayRecords() {
  if (!DOM.todayRecords) {
    return;
  }

  const records = sortRecordsByStartTimeDesc(getRecordsByDate(today()));
  const settings = getSettings();

  updateTodayCount(records.length);
  renderRecordsList(DOM.todayRecords, records, {
    emptyText: '今天还没有番茄，开始第一个吧！'
  });

  if (records.length === 0 && !String(settings.apiKey || '').trim()) {
    const onboardingCard = document.createElement('div');
    const onboardingTitle = document.createElement('div');
    const onboardingBody = document.createElement('div');

    onboardingCard.className = 'onboarding-card';
    onboardingTitle.className = 'onboarding-card__title';
    onboardingBody.className = 'onboarding-card__body';

    onboardingTitle.textContent = '👋 欢迎使用番茄教练！';
    onboardingBody.innerHTML = '先去 <strong>⚙️ 设置</strong> 页配置 API Key，然后点"开始番茄"完成第一个专注！';

    onboardingCard.appendChild(onboardingTitle);
    onboardingCard.appendChild(onboardingBody);
    DOM.todayRecords.appendChild(onboardingCard);
  }
}

function refreshRecordViews() {
  renderTodayRecords();
  renderHistoryView();
  renderDailySummaryPreview();
  renderGoals();
  scheduleDebouncedSync();
}

// 生成 SVG 进度环
function createProgressRing(percent, size = 56) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const color = clamped >= 100 ? '#43A047' : '#E53935';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'goal-card__ring');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('class', 'progress-ring__track');
  track.setAttribute('cx', String(size / 2));
  track.setAttribute('cy', String(size / 2));
  track.setAttribute('r', String(radius));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke-width', String(stroke));

  const value = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  value.setAttribute('class', 'progress-ring__value');
  value.setAttribute('cx', String(size / 2));
  value.setAttribute('cy', String(size / 2));
  value.setAttribute('r', String(radius));
  value.setAttribute('fill', 'none');
  value.setAttribute('stroke', color);
  value.setAttribute('stroke-width', String(stroke));
  value.setAttribute('stroke-dasharray', String(circumference));
  value.setAttribute('stroke-dashoffset', String(offset));
  value.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('class', 'progress-ring__label');
  label.setAttribute('x', '50%');
  label.setAttribute('y', '50%');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('dominant-baseline', 'central');
  label.textContent = `${clamped}%`;

  svg.append(track, value, label);
  return svg;
}

function getGoalDeadlineHint(goal, progress) {
  if (!goal.deadline) {
    return '';
  }

  const msPerDay = 86400000;
  const deadlineTime = new Date(`${goal.deadline}T00:00:00`).getTime();
  const todayTime = new Date(`${today()}T00:00:00`).getTime();

  if (Number.isNaN(deadlineTime)) {
    return '';
  }

  const daysLeft = Math.round((deadlineTime - todayTime) / msPerDay);

  if (daysLeft < 0) {
    return '已过截止日期';
  }

  const remaining = Math.max(0, progress.target - progress.done);

  if (remaining <= 0) {
    return `剩 ${daysLeft} 天 · 已达标 🎉`;
  }

  if (daysLeft === 0) {
    return `今天截止 · 还差 ${remaining} 个`;
  }

  const perDay = (remaining / daysLeft).toFixed(1);
  return `剩 ${daysLeft} 天 · 需日均 ${perDay} 个`;
}

function renderGoals() {
  const container = document.getElementById('goals-list');

  if (!container) {
    return;
  }

  container.replaceChildren();
  const allGoals = getGoals();
  const activeGoals = allGoals.filter((goal) => goal.status === 'active');
  const archivedGoals = allGoals.filter((goal) => goal.status === 'done' || goal.status === 'failed').sort((left, right) => {
    return (right.completionDate || '').localeCompare(left.completionDate || '');
  });

  if (!activeGoals.length && !archivedGoals.length) {
    const empty = document.createElement('div');
    empty.className = 'goals-empty';
    empty.textContent = '还没有目标。点「+ 新建目标」给某个项目设定番茄数目标吧。';
    container.appendChild(empty);
    return;
  }

  // 未达标的排前面
  activeGoals.sort((left, right) => {
    return getGoalProgress(left).percent - getGoalProgress(right).percent;
  });

  // 活跃目标
  activeGoals.forEach((goal) => {
    container.appendChild(createGoalCard(goal));
  });

  // 已归档目标（done + failed，折叠区）
  if (archivedGoals.length) {
    const fold = document.createElement('details');
    fold.className = 'goal-done-fold';

    const summary = document.createElement('summary');
    summary.className = 'goal-done-fold__summary';
    summary.textContent = `📦 已归档（${archivedGoals.length}）`;

    const list = document.createElement('div');
    list.className = 'goal-done-list';
    archivedGoals.forEach((goal) => {
      list.appendChild(createGoalCard(goal, { isDone: true }));
    });

    fold.append(summary, list);
    container.appendChild(fold);
  }
}

function createGoalCard(goal, options = {}) {
  const { isDone = false } = options;
  const progress = getGoalProgress(goal);
  const project = getProjectById(goal.projectId);
  const isFailed = goal.status === 'failed';
  const isOverdue = !isDone && !isFailed
    && goal.deadline && goal.deadline < today();
  const cardStyle = isFailed ? ' goal-card--failed' : (isOverdue ? ' goal-card--overdue' : '');
  const card = document.createElement('article');
  card.className = `goal-card${isDone ? ' goal-card--done' : ''}${cardStyle}`;

  // 逾期目标的进度环用橙色
  if (isOverdue) {
    const svg = createProgressRing(progress.percent);
    const valueCircle = svg.querySelector('.progress-ring__value');
    if (valueCircle) valueCircle.setAttribute('stroke', '#FB8C00');
    card.appendChild(svg);
  } else {
    card.appendChild(createProgressRing(progress.percent));
  }

  const info = document.createElement('div');
  info.className = 'goal-card__info';

  const title = document.createElement('div');
  title.className = 'goal-card__title';

  if (project) {
    const tag = document.createElement('span');
    tag.className = 'goal-card__project';
    tag.style.background = project.color || '#9E9E9E';
    tag.textContent = `${project.icon || ''} ${project.name}`.trim();
    title.appendChild(tag);
  }

  const titleText = document.createElement('span');
  titleText.textContent = goal.title;
  title.appendChild(titleText);

  const meta = document.createElement('div');
  meta.className = 'goal-card__meta';

  if (isDone || isFailed) {
    const dateKey = goal.completionDate
      ? (goal.completionDate.split('T')[0] || goal.completionDate)
      : '';
    const label = isFailed ? '失败于' : '完成于';
    meta.textContent = `${label} ${formatDateCN(dateKey)} · ${progress.done} / ${goal.targetPomodoros} 🍅`;

    if (goal.completionReason) {
      const reason = document.createElement('div');
      reason.className = 'goal-card__reason';
      reason.textContent = goal.completionReason;
      info.append(title, meta, reason);
    } else {
      info.append(title, meta);
    }
  } else {
    const deadlineHint = getGoalDeadlineHint(goal, progress);
    const overdueTag = isOverdue ? ' ⚠️ 已过截止日期' : '';
    meta.textContent = `${progress.done} / ${goal.targetPomodoros} 🍅${deadlineHint ? ` · ${deadlineHint}` : ''}${overdueTag}`;
    info.append(title, meta);
  }

  const actions = document.createElement('div');
  actions.className = 'goal-card__actions';

  if (!isDone && !isFailed) {
    const achieved = progress.percent >= 100;

    if (isOverdue) {
      // 逾期目标：延期重新规划 + 宣布失败
      const replanBtn = document.createElement('button');
      replanBtn.className = 'goal-card__action';
      replanBtn.type = 'button';
      replanBtn.textContent = '🔄';
      replanBtn.setAttribute('aria-label', '延期重新规划');
      replanBtn.addEventListener('click', () => openGoalExtendModal(goal, true));

      const failBtn = document.createElement('button');
      failBtn.className = 'goal-card__action';
      failBtn.type = 'button';
      failBtn.textContent = '❌';
      failBtn.setAttribute('aria-label', '宣布失败');
      failBtn.addEventListener('click', () => openGoalFailModal(goal));

      actions.append(replanBtn, failBtn);
    } else {
      // 正常活跃目标：确认完成
      const doneBtn = document.createElement('button');
      doneBtn.className = 'goal-card__action';
      doneBtn.type = 'button';
      doneBtn.textContent = '✅';
      doneBtn.setAttribute('aria-label', '确认完成');
      doneBtn.addEventListener('click', () => openGoalCompleteModal(goal, progress));
      actions.append(doneBtn);

      // 延期续目标：只在达标时才显示
      if (achieved) {
        const extendBtn = document.createElement('button');
        extendBtn.className = 'goal-card__action';
        extendBtn.type = 'button';
        extendBtn.textContent = '🔄';
        extendBtn.setAttribute('aria-label', '延期续目标');
        extendBtn.addEventListener('click', () => openGoalExtendModal(goal));
        actions.append(extendBtn);
      }
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'goal-card__action';
    editBtn.type = 'button';
    editBtn.textContent = '✏️';
    editBtn.setAttribute('aria-label', '编辑目标');
    editBtn.addEventListener('click', () => openGoalEditModal(goal));

    actions.append(editBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'goal-card__action';
  delBtn.type = 'button';
  delBtn.textContent = '🗑️';
  delBtn.setAttribute('aria-label', '删除目标');
  delBtn.addEventListener('click', () => {
    if (confirm(`删除目标「${goal.title}」？`)) {
      deleteGoal(goal.id);
      renderGoals();
      showToast('目标已删除');
    }
  });

  actions.append(delBtn);
  card.append(info, actions);
  return card;
}

function openGoalEditModal(goal) {
  const isNew = !goal;
  const projects = getActiveProjects();
  const data = goal || {
    id: generateId(),
    projectId: (projects.find((project) => project.id !== UNCATEGORIZED_PROJECT_ID) || projects[0] || {}).id || UNCATEGORIZED_PROJECT_ID,
    title: '',
    targetPomodoros: 20,
    startDate: today(),
    deadline: '',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  const projectOptions = projects.map((project) => {
    const selected = project.id === data.projectId ? ' selected' : '';
    return `<option value="${escapeHtml(project.id)}"${selected}>${escapeHtml(project.icon || '')} ${escapeHtml(project.name)}</option>`;
  }).join('');

  const modal = openModal(`
    <h2 class="modal__title">${isNew ? '新建目标' : '编辑目标'}</h2>
    <div class="modal__body">
      <form id="goal-edit-form">
        <div class="field">
          <label class="field__label" for="goal-edit-project">项目</label>
          <select id="goal-edit-project" class="field__input">${projectOptions}</select>
        </div>
        <div class="field">
          <label class="field__label" for="goal-edit-title">目标标题</label>
          <input id="goal-edit-title" class="field__input" type="text" maxlength="40" placeholder="例如：本月读完 3 本书" value="${escapeHtml(data.title)}">
        </div>
        <div class="field">
          <label class="field__label" for="goal-edit-target">目标番茄数</label>
          <input id="goal-edit-target" class="field__input" type="number" min="1" max="999" inputmode="numeric" value="${Number(data.targetPomodoros) || 20}">
        </div>
        <div class="field">
          <label class="field__label" for="goal-edit-deadline">截止日期（可选）</label>
          <input id="goal-edit-deadline" class="field__input" type="date" value="${escapeHtml(data.deadline || '')}">
        </div>
        <div id="goal-edit-error" class="modal__error" hidden></div>
        <div class="modal__actions">
          <button id="goal-edit-cancel" class="btn btn--ghost" type="button">取消</button>
          <button class="btn btn--primary" type="submit">保存</button>
        </div>
      </form>
    </div>
  `);

  const form = modal.querySelector('#goal-edit-form');
  const projectSelect = modal.querySelector('#goal-edit-project');
  const titleInput = modal.querySelector('#goal-edit-title');
  const targetInput = modal.querySelector('#goal-edit-target');
  const deadlineInput = modal.querySelector('#goal-edit-deadline');
  const error = modal.querySelector('#goal-edit-error');

  modal.querySelector('#goal-edit-cancel')?.addEventListener('click', closeActiveModal);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const target = Number(targetInput.value);

    if (!title) {
      error.textContent = '请填写目标标题。';
      error.hidden = false;
      return;
    }

    if (!target || target < 1) {
      error.textContent = '目标番茄数需大于 0。';
      error.hidden = false;
      return;
    }

    const patch = {
      projectId: projectSelect.value,
      title,
      targetPomodoros: target,
      deadline: deadlineInput.value || ''
    };

    if (isNew) {
      addGoal({ ...data, ...patch });
    } else {
      updateGoal(data.id, patch);
    }

    closeActiveModal();
    renderGoals();
    showToast(isNew ? '目标已创建' : '目标已更新');
  });

  titleInput.focus();
}

function openGoalCompleteModal(goal, progress) {
  const isAchieved = (progress || getGoalProgress(goal)).percent >= 100;
  const title = isAchieved ? '✅ 确认完成目标' : '✅ 提前完成目标';
  const hint = isAchieved
    ? `目标「${escapeHtml(goal.title)}」已完成 ${progress ? progress.done : getGoalProgress(goal).done} / ${goal.targetPomodoros} 个番茄，确认关闭这个目标？`
    : `目标「${escapeHtml(goal.title)}」尚未达标（${progress ? progress.done : getGoalProgress(goal).done} / ${goal.targetPomodoros}），确认提前完成？`;

  const modal = openModal(`
    <h2 class="modal__title">${title}</h2>
    <div class="modal__body">
      <form id="goal-complete-form">
        <p class="modal__hint">${hint}</p>
        <div class="field">
          <label class="field__label" for="goal-complete-reason">完成感想（可选）</label>
          <textarea id="goal-complete-reason" class="field__textarea" rows="3" placeholder="记录下你的感想或总结，教练以后会读到"></textarea>
        </div>
        <div class="modal__actions">
          <button id="goal-complete-cancel" class="btn btn--ghost" type="button">取消</button>
          <button class="btn btn--primary" type="submit">确认完成</button>
        </div>
      </form>
    </div>
  `);

  const form = modal.querySelector('#goal-complete-form');
  modal.querySelector('#goal-complete-cancel')?.addEventListener('click', closeActiveModal);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const reason = modal.querySelector('#goal-complete-reason')?.value.trim() || '';
    updateGoal(goal.id, {
      status: 'done',
      completionDate: new Date().toISOString(),
      completionReason: reason
    });
    closeActiveModal();
    renderGoals();
    showToast('目标已完成 ✅');
  });
}

function openGoalExtendModal(goal, isOverdue = false) {
  const progress = getGoalProgress(goal);
  const currentTarget = goal.targetPomodoros || 0;
  const currentDeadline = goal.deadline || '';
  const title = isOverdue ? '🔄 延期重新规划' : '🔄 延期续目标';
  const hint = isOverdue
    ? `目标「${escapeHtml(goal.title)}」已过截止日期（${goal.deadline || '—'}），当前进度 ${progress.done} / ${currentTarget}。请说明为什么没按时完成，以及新的计划。`
    : `目标「${escapeHtml(goal.title)}」已投入 ${progress.done} 个番茄（原定 ${currentTarget} 个），但工作还没做完，需要继续推进。`;
  const reasonPlaceholder = isOverdue
    ? '为什么没按时完成？之后计划怎么继续？'
    : '为什么番茄数到了但实际没完成？之后计划怎么继续？';

  const modal = openModal(`
    <h2 class="modal__title">${title}</h2>
    <div class="modal__body">
      <form id="goal-extend-form">
        <p class="modal__hint">${hint}</p>
        <div class="field">
          <label class="field__label" for="goal-extend-reason">原因（必填）</label>
          <textarea id="goal-extend-reason" class="field__textarea" rows="2" placeholder="${escapeHtml(reasonPlaceholder)}" required></textarea>
        </div>
        <div class="field">
          <label class="field__label" for="goal-extend-add">追加番茄数</label>
          <input id="goal-extend-add" class="field__input" type="number" min="1" max="999" inputmode="numeric" value="${currentTarget}">
        </div>
        <div class="field">
          <label class="field__label" for="goal-extend-deadline">新截止日期（可选）</label>
          <input id="goal-extend-deadline" class="field__input" type="date" value="${escapeHtml(currentDeadline)}">
        </div>
        <div id="goal-extend-error" class="modal__error" hidden></div>
        <div class="modal__actions">
          <button id="goal-extend-cancel" class="btn btn--ghost" type="button">取消</button>
          <button class="btn btn--primary" type="submit">确认</button>
        </div>
      </form>
    </div>
  `);

  const form = modal.querySelector('#goal-extend-form');
  const error = modal.querySelector('#goal-extend-error');
  modal.querySelector('#goal-extend-cancel')?.addEventListener('click', closeActiveModal);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const reason = modal.querySelector('#goal-extend-reason')?.value.trim() || '';

    if (!reason) {
      error.textContent = '请填写原因。';
      error.hidden = false;
      return;
    }

    const addPomodoros = Number(modal.querySelector('#goal-extend-add')?.value) || currentTarget;
    const newTarget = currentTarget + addPomodoros;
    const newDeadline = modal.querySelector('#goal-extend-deadline')?.value || '';
    const extensions = Array.isArray(goal.extensions) ? goal.extensions.slice() : [];
    extensions.push({
      date: today(),
      reason,
      previousTarget: currentTarget,
      newTarget,
      previousDeadline: currentDeadline,
      newDeadline
    });

    const patch = {
      targetPomodoros: newTarget,
      extensions,
      status: 'active'
    };
    if (newDeadline) {
      patch.deadline = newDeadline;
    }

    updateGoal(goal.id, patch);
    closeActiveModal();
    renderGoals();
    showToast(`目标已${isOverdue ? '重新规划' : '延期续订'}：新增 ${addPomodoros} 个番茄`);
  });
}

function openGoalFailModal(goal) {
  const progress = getGoalProgress(goal);
  const modal = openModal(`
    <h2 class="modal__title">❌ 宣布目标失败</h2>
    <div class="modal__body">
      <form id="goal-fail-form">
        <p class="modal__hint">目标「${escapeHtml(goal.title)}」已过截止日期（${goal.deadline || '—'}），当前进度 ${progress.done} / ${goal.targetPomodoros}。确认放弃这个目标？</p>
        <div class="field">
          <label class="field__label" for="goal-fail-reason">失败原因（必填）</label>
          <textarea id="goal-fail-reason" class="field__textarea" rows="2" placeholder="为什么没完成？学到了什么？教练以后会看到。" required></textarea>
        </div>
        <div id="goal-fail-error" class="modal__error" hidden></div>
        <div class="modal__actions">
          <button id="goal-fail-cancel" class="btn btn--ghost" type="button">取消</button>
          <button class="btn btn--primary" type="submit">确认放弃</button>
        </div>
      </form>
    </div>
  `);

  const form = modal.querySelector('#goal-fail-form');
  const error = modal.querySelector('#goal-fail-error');
  modal.querySelector('#goal-fail-cancel')?.addEventListener('click', closeActiveModal);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const reason = modal.querySelector('#goal-fail-reason')?.value.trim() || '';

    if (!reason) {
      error.textContent = '请填写失败原因。';
      error.hidden = false;
      return;
    }

    updateGoal(goal.id, {
      status: 'failed',
      completionDate: new Date().toISOString(),
      completionReason: reason
    });
    closeActiveModal();
    renderGoals();
    showToast('目标已归档为失败');
  });
}

function createReminderActionChip(label, action, reminderId) {
  const button = document.createElement('button');
  button.className = 'action-chip';
  button.type = 'button';
  button.dataset.reminderAction = action;

  if (reminderId) {
    button.dataset.id = reminderId;
  }

  button.textContent = label;
  return button;
}

function getNagText(reminder) {
  const dayCount = getReminderDayCount(reminder);
  const level = getReminderLevel(reminder);

  if (level === REMINDER_LEVELS.URGENT) {
    return `🔥 顽固问题第 ${dayCount} 天：${reminder.content}`;
  }

  if (level === REMINDER_LEVELS.MODERATE) {
    return `⚡ 已关注 ${dayCount} 使用日：${reminder.content}`;
  }

  return `💡 ${reminder.content}`;
}

function createNagCard(reminder) {
  const article = document.createElement('article');
  const level = getReminderLevel(reminder);
  article.className = `nag-card nag-card--${level}`;

  const text = document.createElement('div');
  text.className = 'nag-card__text';
  text.textContent = getNagText(reminder);

  const actions = document.createElement('div');
  actions.className = 'nag-card__actions';
  actions.append(
    createReminderActionChip('✅ 已改善', 'improve', reminder.id),
    createReminderActionChip('⏭ 暂缓', 'defer', reminder.id),
    createReminderActionChip('👎 无用', 'ignore', reminder.id)
  );

  article.append(text, actions);
  return article;
}

function renderNagArea() {
  if (!DOM.coachNagArea) {
    return;
  }

  const activeReminders = getActiveReminders();
  const panel = document.createElement('section');
  panel.className = 'nag-panel';

  const header = document.createElement('div');
  header.className = 'nag-panel__header';

  const title = document.createElement('div');
  title.className = 'nag-panel__title';
  title.textContent = '教练唠叨';
  header.appendChild(title);
  panel.appendChild(header);

  if (!activeReminders.length) {
    const empty = document.createElement('div');
    empty.className = 'nag-empty';
    empty.textContent = '✨ 暂无待改进项，继续保持！';
    panel.appendChild(empty);
    DOM.coachNagArea.replaceChildren(panel);
    return;
  }

  const list = document.createElement('div');
  list.className = 'nag-list';
  activeReminders.slice(0, 3).forEach((reminder) => {
    list.appendChild(createNagCard(reminder));
  });
  panel.appendChild(list);

  if (activeReminders.length > 3) {
    const viewAll = createReminderActionChip(`查看全部 ${activeReminders.length} 条 →`, 'view-all');
    viewAll.classList.add('nag-panel__link');
    panel.appendChild(viewAll);
  }

  DOM.coachNagArea.replaceChildren(panel);
}

function createCoachReminderCard(reminder, section) {
  const article = document.createElement('article');
  const level = getReminderLevel(reminder);
  article.className = `coach-reminder-card coach-reminder-card--${level}`;

  const header = document.createElement('div');
  header.className = 'coach-reminder-card__header';

  const content = document.createElement('div');
  content.className = 'coach-reminder-card__content';
  content.textContent = reminder.content;

  const status = document.createElement('span');
  status.className = 'coach-reminder-card__status';

  const meta = document.createElement('div');
  meta.className = 'coach-reminder-card__meta';

  const actions = document.createElement('div');
  actions.className = 'coach-reminder-card__actions';

  if (section === 'active') {
    status.textContent = getReminderLevelLabel(level);
    meta.textContent = `创建于 ${formatReminderDate(reminder.createdDate)} · 已关注 ${getReminderDayCount(reminder)} 使用日`;
    actions.append(
      createReminderActionChip('✅ 已改善', 'improve', reminder.id),
      createReminderActionChip('⏭ 暂缓', 'defer', reminder.id),
      createReminderActionChip('👎 无用', 'ignore', reminder.id)
    );
  } else if (section === 'improved') {
    status.textContent = '已改善';
    meta.textContent = `创建于 ${formatReminderDate(reminder.createdDate)} · 改善于 ${formatReminderDate(reminder.practicedDate)}`;
  } else {
    status.textContent = reminder.status === 'deferred' ? '已暂缓' : '已忽略';
    meta.textContent = `创建于 ${formatReminderDate(reminder.createdDate)} · 已关注 ${getReminderDayCount(reminder)} 使用日`;
    actions.append(createReminderActionChip('↩ 重新激活', 'reactivate', reminder.id));
  }

  header.append(content, status);
  article.append(header, meta);

  if (reminder.feedbackReason) {
    const reason = document.createElement('div');
    reason.className = 'coach-reminder-card__reason';
    reason.textContent = `我的原因：${reminder.feedbackReason}`;
    article.appendChild(reason);
  }

  if (actions.childElementCount) {
    article.appendChild(actions);
  }

  return article;
}

function renderCoachReminderList(container, reminders, section, emptyText) {
  container.replaceChildren();

  if (!reminders.length) {
    const empty = document.createElement('div');
    empty.className = 'coach-reminder-empty';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  reminders.forEach((reminder) => {
    container.appendChild(createCoachReminderCard(reminder, section));
  });
}

function renderCoachCenter() {
  if (!DOM.coachActiveReminders || !DOM.coachImprovedReminders || !DOM.coachArchivedReminders) {
    return;
  }

  const reminders = getReminders();
  const activeReminders = sortRemindersByDays(reminders.filter((reminder) => reminder.status === 'active'));
  const improvedReminders = sortRemindersByRecentDate(
    reminders.filter((reminder) => reminder.status === 'improved'),
    'practicedDate'
  );
  const archivedReminders = sortRemindersByRecentDate(
    reminders.filter((reminder) => ['ignored', 'deferred'].includes(reminder.status)),
    'createdDate'
  );

  if (DOM.coachActiveTitle) {
    DOM.coachActiveTitle.textContent = `活跃提醒（${activeReminders.length}）`;
  }

  if (DOM.coachActiveReminders.parentElement) {
    let nagNote = DOM.coachActiveReminders.parentElement.querySelector('.nag-day-note');

    if (!nagNote) {
      nagNote = document.createElement('p');
      nagNote.className = 'nag-day-note';
      nagNote.textContent = '「使用日」= 打开应用的天数，非自然日';
      DOM.coachActiveReminders.parentElement.insertBefore(nagNote, DOM.coachActiveReminders);
    }
  }

  renderCoachReminderList(
    DOM.coachActiveReminders,
    activeReminders,
    'active',
    '还没有活跃提醒，当前没有需要反复盯住的问题。'
  );
  renderCoachReminderList(
    DOM.coachImprovedReminders,
    improvedReminders,
    'improved',
    '还没有完成改善的提醒。'
  );
  renderCoachReminderList(
    DOM.coachArchivedReminders,
    archivedReminders,
    'archived',
    '还没有被忽略或暂缓的提醒。'
  );
}

function refreshReminderViews() {
  renderNagArea();
  renderCoachCenter();
  scheduleDebouncedSync();
}

function getToneDescription(tone) {
  if (tone === 'sharp') {
    return '犀利直接';
  }

  if (tone === 'funny') {
    return '轻松幽默';
  }

  return '温和鼓励';
}

// 厚人设 + 示范例句，让三种语气读起来截然不同，真正"打动人"
function getTonePersona(tone) {
  if (tone === 'sharp') {
    return `【你的人设：犀利直接的教练】
你像一个不留情面但真心想让他变强的老教练。短句、直给、不说安慰剂，敢点破他在回避的问题。可以扎心，但扎的是问题不是人。不写客套话、不喊口号。
示范语气：「3 个番茄有 2 个被微信打断——你不是没时间，是没关手机。」「这条建议你搁置第 4 天了，要么今天做，要么承认它对你没用。」`;
  }

  if (tone === 'funny') {
    return `【你的人设：逗比但走心的教练】
你像一个爱开玩笑的朋友，用比喻、自嘲和调侃把道理讲进去。轻松但不油腻，玩笑之后总有一句戳中要害。
示范语气：「今天的专注力像 WiFi 信号，飘忽得很——不过下午那格满格的时段，建议你以后都拿来打硬仗。」「目标进度 30%，deadline 在招手，它不急，你该急了 😏」`;
  }

  return `【你的人设：温和鼓励的教练】
你像一个耐心、共情的伙伴。先接住他的情绪和努力（"我看到你今天…"），再温和地给方向。不居高临下、不说教，让他感到被理解、有力量继续。
示范语气：「今天状态不在线也没关系，你还是坐下来完成了 2 个番茄，这本身就值得肯定。」「昨天你说想早点收工，今天真的做到了——这种小小的兑现很珍贵。」`;
}

function getAchievementLabel(achievement) {
  if (achievement === 'full') {
    return '完全达成';
  }

  if (achievement === 'partial') {
    return '部分达成';
  }

  return '未达成';
}

function buildRecordPreviewText(record) {
  return `${record.startTime}-${record.endTime} | ${record.goal} | ${record.summary}`;
}

function buildRecordContextLine(record) {
  const interruptionText = record.interrupted
    ? `是${record.interruptionNote ? `（${record.interruptionNote}）` : ''}`
    : '否';
  const project = getProjectById(record.projectId);
  const projectText = project ? project.name : '未分类';
  const energyText = record.energy ? `${record.energy}/5` : '未记录';

  return `- ${record.date} ${record.startTime}-${record.endTime} | 项目：${projectText} | 目标：${record.goal} | 达成：${getAchievementLabel(record.achievement)} | 质量：${record.quality}/5 | 精力：${energyText} | 被打断：${interruptionText} | 总结：${record.summary}`;
}

// 汇总近几天的具体总结文本，让教练能"连点成线"看到跨天规律
function buildRecentSummariesContext(days = 4) {
  const lines = [];

  for (let index = 1; index <= days; index += 1) {
    const dateKey = formatDateValue(new Date(Date.now() - index * 86400000));
    const dayRecords = getRecordsByDate(dateKey);

    if (!dayRecords.length) {
      continue;
    }

    const summaries = dayRecords
      .map((record) => record.summary)
      .filter(Boolean)
      .slice(0, 4)
      .join('；');
    lines.push(`- ${dateKey}（${dayRecords.length}个）：${summaries || '无总结'}`);
  }

  if (!lines.length) {
    return '';
  }

  return `【近${days}天每日总结原文】\n${lines.join('\n')}`;
}

// 汇总近几天用户亲述的自我评价日记，供教练做跨天对比
function buildRecentJournalsContext(days = 5) {
  const lines = [];

  for (let index = 1; index <= days; index += 1) {
    const dateKey = formatDateValue(new Date(Date.now() - index * 86400000));
    const journal = getJournal(dateKey);

    if (journal) {
      lines.push(`- ${dateKey}：${journal}`);
    }
  }

  if (!lines.length) {
    return '';
  }

  return `【近${days}天自我评价日记原文】（用户亲述，请据此发现跨天的情绪/状态变化与反复出现的问题）\n${lines.join('\n')}`;
}

// 汇总当前活跃目标与进度，供教练依据目标给出计划/调整建议
function buildGoalsContext() {
  const goals = getGoals().filter((goal) => goal.status !== 'paused');

  if (!goals.length) {
    return '';
  }

  const lines = ['【当前目标与进度】'];
  goals.forEach((goal) => {
    const progress = getGoalProgress(goal);
    const project = getProjectById(goal.projectId);
    const deadlineHint = getGoalDeadlineHint(goal, progress);
    lines.push(`- [${project ? project.name : '未分类'}] ${goal.title}：${progress.done}/${progress.target} 个（${progress.percent}%）${deadlineHint ? `，${deadlineHint}` : ''}`);
  });

  return lines.join('\n');
}

// 汇总最近被用户勾选"已践行"的建议，形成反馈闭环
function buildPracticedFeedbackContext() {
  const recentDates = new Set();
  for (let index = 0; index <= 2; index += 1) {
    recentDates.add(formatDateValue(new Date(Date.now() - index * 86400000)));
  }

  const practiced = getReminders().filter((reminder) => {
    return reminder.practicedDate && recentDates.has(reminder.practicedDate);
  });

  if (!practiced.length) {
    return '';
  }

  const lines = ['【用户近期已践行的建议】（请在报告中先认可这些进展）'];
  practiced.forEach((reminder) => {
    lines.push(`- ${reminder.content}（${reminder.practicedDate}）`);
  });

  return lines.join('\n');
}

// 汇总用户主动搁置/否决的建议及原因，让教练避免重复无效建议、据原因调整方向
function buildDismissedFeedbackContext() {
  const dismissed = getReminders().filter((reminder) => {
    return reminder.status === 'ignored' || reminder.status === 'deferred';
  });

  if (!dismissed.length) {
    return '';
  }

  // 优先展示带原因的，最多 6 条
  const sorted = dismissed
    .slice()
    .sort((left, right) => (right.feedbackReason ? 1 : 0) - (left.feedbackReason ? 1 : 0))
    .slice(0, 6);

  const lines = ['【用户已否决/搁置的建议及原因】（重要：不要再提用户判定"无用"的同类建议；据这些原因调整建议的方向和时机）'];
  sorted.forEach((reminder) => {
    const label = reminder.status === 'ignored' ? '判为无用' : '暂缓';
    const reason = reminder.feedbackReason ? `，原因：${reminder.feedbackReason}` : '（未填原因）';
    lines.push(`- [${label}] ${reminder.content}${reason}`);
  });

  return lines.join('\n');
}

function buildHistoricalContext() {
  const allRecords = getRecords();
  const dateKeys = [];

  for (let index = 1; index <= 7; index += 1) {
    dateKeys.push(formatDateValue(new Date(Date.now() - index * 86400000)));
  }

  const historicalRecords = allRecords.filter((record) => dateKeys.includes(record.date));

  if (!historicalRecords.length) {
    // 即使没有近7天数据，也把目标与提醒反馈背景带上
    return [buildGoalsContext(), buildDismissedFeedbackContext()].filter(Boolean).join('\n\n');
  }

  const daysWithRecords = dateKeys.filter((dateKey) => {
    return historicalRecords.some((record) => record.date === dateKey);
  }).length;
  const past7AvgCount = historicalRecords.length / 7;
  const qualityValues = historicalRecords
    .map((record) => Number(record.quality))
    .filter((value) => Number.isFinite(value));
  const past7AvgQuality = qualityValues.length
    ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length
    : 0;

  const lines = [
    '【近7天背景数据】',
    `- 日均番茄：${past7AvgCount.toFixed(1)} 个（共 ${daysWithRecords} 天有记录）`,
    `- 平均质量：${past7AvgQuality.toFixed(1)} / 5`
  ];

  const todayRecords = getRecordsByDate(today());
  const todayQualityValues = todayRecords
    .map((record) => Number(record.quality))
    .filter((value) => Number.isFinite(value));

  if (todayQualityValues.length && past7AvgQuality > 0) {
    const todayAvgQuality = todayQualityValues.reduce((sum, value) => sum + value, 0) / todayQualityValues.length;
    const diffPercent = ((todayAvgQuality - past7AvgQuality) / past7AvgQuality) * 100;
    let trendText = '今日均分与近7天均值持平';

    if (diffPercent > 5) {
      trendText = `今日均分比近7天均值高 ${Math.round(diffPercent)}%`;
    } else if (diffPercent < -5) {
      trendText = `今日均分比近7天均值低 ${Math.round(Math.abs(diffPercent))}%`;
    }

    lines.push(`- 今日趋势：${trendText}`);
  }

  // 按项目统计近7天投入分布
  const projectCounts = {};
  historicalRecords.forEach((record) => {
    const project = getProjectById(record.projectId);
    const name = project ? project.name : '未分类';
    projectCounts[name] = (projectCounts[name] || 0) + 1;
  });
  const distribution = Object.entries(projectCounts)
    .sort((left, right) => right[1] - left[1])
    .map(([name, count]) => `${name} ${count}个`)
    .join('、');
  if (distribution) {
    lines.push(`- 近7天项目投入：${distribution}`);
  }

  const activeReminders = getActiveReminders().slice(0, 3);
  lines.push(`- 活跃待改进项（${activeReminders.length}条）：`);
  activeReminders.forEach((reminder, index) => {
    lines.push(`  ${index + 1}. ${reminder.content}（已关注 ${getReminderDayCount(reminder)} 使用日）`);
  });

  const sections = [lines.join('\n')];
  const recentSummaries = buildRecentSummariesContext();
  if (recentSummaries) sections.push(recentSummaries);
  const goalsContext = buildGoalsContext();
  if (goalsContext) sections.push(goalsContext);
  const practicedFeedback = buildPracticedFeedbackContext();
  if (practicedFeedback) sections.push(practicedFeedback);
  const dismissedFeedback = buildDismissedFeedbackContext();
  if (dismissedFeedback) sections.push(dismissedFeedback);

  return sections.join('\n\n');
}

function renderRecordPreview(container, records, emptyText) {
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'coach-record-preview__empty';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'coach-record-preview__list';

  records.forEach((record) => {
    const item = document.createElement('li');
    item.className = 'coach-record-preview__item';
    item.textContent = buildRecordPreviewText(record);
    list.appendChild(item);
  });

  container.appendChild(list);
}

function renderDailySummaryPreview() {
  if (!DOM.dailySummaryCount || !DOM.dailySummaryPreview) {
    return;
  }

  const records = sortRecordsByStartTimeDesc(getRecordsByDate(today()));
  DOM.dailySummaryCount.textContent = `今日 ${records.length} 个番茄`;
  renderRecordPreview(DOM.dailySummaryPreview, records, '今天还没有番茄记录，先完成一个再来复盘。');

  // 始终回填当天已保存的自我评价日记
  if (DOM.dailySelfNote) {
    DOM.dailySelfNote.value = getJournal(today());
  }
}

function renderInlineMarkdown(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function renderMarkdownLite(text) {
  const lines = String(text || '').split(/\r?\n/);
  const blocks = [];
  let listItems = [];

  function flushList() {
    if (!listItems.length) {
      return;
    }

    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
    listItems = [];
  }

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();
    blocks.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
  });

  flushList();
  return blocks.join('');
}

function renderReportHistory(type) {
  const container = type === 'daily' ? DOM.dailyReportHistory : DOM.weeklyReportHistory;

  if (!container) {
    return;
  }

  const reports = getReports()
    .filter((report) => report.type === type)
    .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
    .slice(0, 10);

  container.replaceChildren();

  if (!reports.length) {
    const empty = document.createElement('div');
    empty.className = 'report-history__empty';
    empty.textContent = '还没有历史报告。';
    container.appendChild(empty);
    return;
  }

  reports.forEach((report) => {
    const item = document.createElement('div');
    const header = document.createElement('div');
    const content = document.createElement('div');

    item.className = 'report-history__item';
    header.className = 'report-history__item-header';
    header.tabIndex = 0;
    header.setAttribute('role', 'button');
    header.textContent = type === 'daily'
      ? formatDateCN(report.dateKey)
      : `${String(report.dateKey || '').replace('_', ' 至 ')} · ${report.recordCount} 个番茄${report.auto ? ' · 自动' : ''}`;
    content.className = 'report-history__item-content';
    content.hidden = true;
    content.innerHTML = renderMarkdownLite(report.content);

    const toggle = () => {
      const isOpen = !content.hidden;
      content.hidden = isOpen;
      header.classList.toggle('is-open', !isOpen);
    };

    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });

    item.append(header, content);
    container.appendChild(item);
  });
}

function setResultCardContent(element, text, emptyText) {
  if (!element) {
    return;
  }

  if (!text) {
    element.classList.add('coach-result-card--empty');
    element.textContent = emptyText;
    return;
  }

  element.classList.remove('coach-result-card--empty');
  element.innerHTML = `<div class="coach-markdown">${renderMarkdownLite(text)}</div>`;
}

function renderChatHistory() {
  if (!DOM.chatHistory) {
    return;
  }

  DOM.chatHistory.replaceChildren();

  if (!APP_STATE.coachChatHistory.length) {
    const empty = document.createElement('div');
    empty.className = 'chat-history--empty';
    empty.textContent = '还没有对话，问教练一个具体问题试试。';
    DOM.chatHistory.appendChild(empty);
    return;
  }

  APP_STATE.coachChatHistory.forEach((message) => {
    if (message.hint) {
      const hint = document.createElement('div');
      hint.className = 'chat-hint';
      hint.textContent = message.hint;
      DOM.chatHistory.appendChild(hint);
    }

    const bubble = document.createElement('article');
    bubble.className = `chat-bubble chat-bubble--${message.role === 'user' ? 'user' : 'assistant'}`;

    const label = document.createElement('div');
    label.className = 'chat-bubble__label';
    label.textContent = message.role === 'user' ? '你' : '教练';

    const body = document.createElement('div');

    if (message.role === 'assistant') {
      body.className = 'coach-markdown';
      body.innerHTML = renderMarkdownLite(message.content);
    } else {
      body.textContent = message.content;
    }

    bubble.append(label, body);
    DOM.chatHistory.appendChild(bubble);
  });

  DOM.chatHistory.scrollTop = DOM.chatHistory.scrollHeight;
}

function showCoachFeedback(message) {
  if (!DOM.coachFeedback) {
    return;
  }

  DOM.coachFeedback.textContent = message;
  DOM.coachFeedback.hidden = !message;
}

function clearCoachFeedback() {
  showCoachFeedback('');
}

function setCoachActionLoading(button, isLoading) {
  if (!button) {
    return;
  }

  button.classList.toggle('is-loading', isLoading);
  button.disabled = isLoading;
}

function switchCoachTab(tabId) {
  APP_STATE.coachActiveTab = tabId;

  DOM.coachTabButtons.forEach((button) => {
    const isActive = button.dataset.coachTab === tabId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  DOM.coachTabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `coach-panel-${tabId}`);
  });
}

function initializeCoachDateInputs() {
  if (!DOM.weeklyStartDate || !DOM.weeklyEndDate) {
    return;
  }

  const { startDate, endDate } = getPreviousWeekRange();
  DOM.weeklyStartDate.max = today();
  DOM.weeklyEndDate.max = today();

  if (!DOM.weeklyStartDate.value) {
    DOM.weeklyStartDate.value = startDate;
  }

  if (!DOM.weeklyEndDate.value) {
    DOM.weeklyEndDate.value = endDate;
  }
}

function getToastStack() {
  let stack = document.querySelector('.toast-stack');

  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }

  return stack;
}

function showToast(message, type = 'success') {
  const stack = getToastStack();
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  toast.textContent = message;
  stack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
    if (!stack.childElementCount) {
      stack.remove();
    }
  }, 3200);
}

async function callLLM(systemPrompt, userMessage, options = {}) {
  const settings = getSettings();
  const apiKey = (settings.apiKey || '').trim();
  const apiBase = (settings.apiBase || DEFAULT_SETTINGS.apiBase).replace(/\/$/, '');
  const model = settings.model || DEFAULT_SETTINGS.model;
  const timeoutMs = Number(options.timeoutMs) || 30000;

  if (!apiKey) {
    const message = '未配置 API Key，请先到设置页配置。';
    showCoachFeedback(message);
    showToast(message, 'error');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    clearCoachFeedback();

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: Number.isFinite(options.temperature) ? options.temperature : 0.7
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('响应内容为空');
    }

    return content;
  } catch (error) {
    const statusMatch = error?.message?.match(/HTTP (\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
    const isRetryable = (
      error?.name === 'AbortError'
      || error instanceof TypeError
      || (status >= 500 && status < 600)
    );

    if (isRetryable && !callLLM._retrying) {
      callLLM._retrying = true;
      showToast('网络波动，正在重试…', 'info');
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      callLLM._retrying = false;
      return callLLM(systemPrompt, userMessage, options);
    }
    callLLM._retrying = false;

    console.error('[callLLM] 调用失败：', error);

    let message;
    if (error?.name === 'AbortError') {
      message = '请求超时，请检查网络后重试。';
    } else if (status === 400) {
      message = '内容超出模型上下文长度，请缩短日期范围或减少对话历史后重试。';
    } else if (status === 401) {
      message = 'API Key 无效或已过期，请在设置页更新。';
    } else if (status === 429) {
      message = 'API 请求频率超限，请稍后再试。';
    } else if (status >= 500) {
      message = `AI 服务暂时不可用（HTTP ${status}），请稍后重试。`;
    } else {
      message = `调用教练服务失败：${error.message}`;
    }

    showCoachFeedback(message);
    showToast(message, 'error');
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

callLLM._retrying = false;

function extractReminders(llmText) {
  const existingContents = new Set(getReminders().map((reminder) => reminder.content));
  const rawContents = new Set();
  const patterns = [
    /【待改进】\s*(.+?)(?=\n|$)/gm,
    /待改进[：:]\s*(.+?)(?=\n|$)/gm,
    /^\s*[\d一二三四五]+[.、)）]\s*待改进[：:]\s*(.+?)(?=\n|$)/gm,
    /\*\*待改进\*\*[：:]\s*(.+?)(?=\n|$)/gm
  ];
  let addedCount = 0;

  patterns.forEach((pattern) => {
    for (const match of String(llmText || '').matchAll(pattern)) {
      const content = (match[1] || '').trim();

      if (content) {
        rawContents.add(content);
      }
    }
  });

  let currentActiveCount = getReminders().filter((reminder) => reminder.status === 'active').length;
  let hitLimit = false;

  if (currentActiveCount >= 5) {
    showToast('提醒池已达上限（5条活跃），请先处理现有提醒再生成新的', 'info');
    return 0;
  }

  rawContents.forEach((content) => {

    if (currentActiveCount >= 5) {
      hitLimit = true;
      return;
    }

    if (!content || existingContents.has(content)) {
      return;
    }

    addReminder({
      id: generateId(),
      content,
      createdDate: today(),
      consecutiveDays: 1,
      lastReminderDate: today(),
      status: 'active',
      practicedDate: null
    });
    existingContents.add(content);
    currentActiveCount += 1;
    addedCount += 1;
  });

  if (String(llmText || '').length > 100 && rawContents.size === 0) {
    showToast('AI 本次未输出待改进项，可在提醒池手动添加', 'info');
    return 0;
  }

  if (rawContents.size) {
    refreshReminderViews();
  }

  if (hitLimit) {
    showToast('提醒池已达上限（5条活跃），请先处理现有提醒再生成新的', 'info');
    return addedCount;
  }

  showToast(`✅ 已自动提取 ${addedCount} 条待改进项到提醒池`);
  return addedCount;
}

function buildDailySummarySystemPrompt(records = []) {
  const avgQuality = records.length
    ? records.reduce((sum, record) => sum + Number(record.quality || 0), 0) / records.length
    : 0;
  const empathyNote = avgQuality > 0 && avgQuality < 2.5
    ? '\n\n【情绪感知提示】今日质量均分偏低，请以共情和认可开场（先肯定用户坚持记录的行为），再温和提出改进建议，不要强化挫败感。'
    : '';

  return `你是用户的私人番茄教练。${getTonePersona(getSettings().coachTone)}

你的目标不是写格式化报告，而是像真正懂他的教练那样说到他心里去、并推动他明天更好。

【怎么写】
- 你自己判断今天最该聊什么，从下面这份"可聊清单"里挑**真正有价值的**来写，不必面面俱到、不要为凑齐而硬写：
  · 回应他今天的自我评价（如果他写了，优先回应，像对话）
  · 一个基于跨天对比的真实洞察（引用具体哪天、哪条数据/感受）
  · 承接昨天：认可已践行的建议、评估老问题今天有没有改善
  · 目标推进：落后就直说、给追赶节奏
  · 明日一个最小且可验证的具体动作
- **按情境决定篇幅**：番茄少、平淡的一天，两三句就够，别硬撑；有明显转折、情绪波动或目标偏差的一天，才展开细说。
- 可以用极少量小标题或直接写成几段话/一小段"给他的话"，怎么自然怎么来。别每天都长一个样。
- 具体、走心或扎心（取决于人设），不凑字数、不喊口号。宁可短，也不要正确的废话。

【结尾的机器块（重要格式）】
如果——且仅当——今天确实存在值得改进、可执行、可验证的点，就在**回复的最末尾**另起一段，用如下格式列出（最多 2 条，每条≤25字，能在单次番茄内执行并清晰验证；禁止"保持专注"这类空话；老的活跃待改进项若仍未解决，优先复用不新增）：
【待改进】具体条目
如果今天没有值得新增的，就**不要输出任何【待改进】行**。${empathyNote}`;
}

function buildDailySummaryUserMessage(records, selfNote = '') {
  const lines = records.length
    ? records.map((record) => buildRecordContextLine(record)).join('\n')
    : '- 今天还没有任何番茄记录，请根据空记录给出轻量复盘。';

  const selfNoteBlock = selfNote
    ? `\n\n【今日自我评价】（用户亲述，请优先据此回应他的真实感受）\n${selfNote}`
    : '';

  const originalContent = `日期：${today()}
今日番茄数：${records.length}
今日记录：
${lines}${selfNoteBlock}`;
  const ctx = buildHistoricalContext();
  const journalCtx = buildRecentJournalsContext();
  const prevReportsCtx = buildPreviousDailyReportsContext();

  return `${originalContent}${prevReportsCtx ? `\n\n${prevReportsCtx}` : ''}${journalCtx ? `\n\n${journalCtx}` : ''}${ctx ? `\n\n${ctx}` : ''}`;
}

function buildWeeklyReportSystemPrompt() {
  return `你是用户的私人番茄教练。${getTonePersona(getSettings().coachTone)}

用户给你一段时间的番茄记录，请生成一份教练式周报。基于真实数据、引用具体项目/时段/感受，避免空话套话。下面是可以覆盖的话题，**按这段时间真正值得说的来取舍，不适用的可跳过或合并，不要为凑齐硬写**：
- ⏰ 黄金时段与精力：什么时段、什么精力状态下最有产出
- 🧮 项目性价比：哪些项目最值得继续、哪些在消耗时间
- 🚧 打断模式：最常见的打断来源和代价
- 🎯 目标推进：结合目标进度评估是否在正轨；落后的给出明确追赶计划（每周/每天需几个番茄）
- 📌 下周计划：2-3 条具体、可执行、和上面结论直接挂钩的行动
- 一句总评：点出这段时间最该盯住的核心模式

若背景数据中有超过 7 天未改善的活跃待改进项，请明确指出是否该重新审视它。写得像人话、有重点，别像流水账。`;
}

function buildWeeklyReportUserMessage(startDate, endDate, records) {
  const MAX_DETAIL = 60; // 明细超过此数量则改为聚合+采样，避免请求过大导致超时/超上下文
  let detailBlock;

  if (!records.length) {
    detailBlock = '- 这个时间范围内没有番茄记录，请基于空记录给出保守结论。';
  } else if (records.length <= MAX_DETAIL) {
    detailBlock = records.map((record) => buildRecordContextLine(record)).join('\n');
  } else {
    // 记录太多：给出按项目/达成/打断的聚合统计 + 最近的采样明细
    detailBlock = `${buildRecordsAggregateSummary(records)}\n\n（记录较多，仅附最近 ${MAX_DETAIL} 条明细供参考）\n${records.slice(0, MAX_DETAIL).map((record) => buildRecordContextLine(record)).join('\n')}`;
  }

  const originalContent = `统计范围：${startDate} 至 ${endDate}
番茄总数：${records.length}
记录明细：
${detailBlock}`;
  const ctx = buildHistoricalContext();
  const priorWeeks = buildPriorWeeksStatsContext(startDate);
  const priorReports = buildPreviousWeeklyReportsContext();
  const comparisonBlocks = [priorWeeks, priorReports].filter(Boolean).join('\n\n');

  return `${originalContent}${comparisonBlocks ? `\n\n${comparisonBlocks}` : ''}${ctx ? `\n\n${ctx}` : ''}`;
}

// 记录聚合统计：项目分布 / 达成率 / 打断次数 / 平均质量与精力
function buildRecordsAggregateSummary(records) {
  const projectCounts = {};
  let fullCount = 0;
  let interruptedCount = 0;
  const qualityValues = [];
  const energyValues = [];

  records.forEach((record) => {
    const project = getProjectById(record.projectId);
    const name = project ? project.name : '未分类';
    projectCounts[name] = (projectCounts[name] || 0) + 1;

    if (record.achievement === 'full') fullCount += 1;
    if (record.interrupted) interruptedCount += 1;

    const quality = Number(record.quality);
    if (Number.isFinite(quality)) qualityValues.push(quality);
    const energy = Number(record.energy);
    if (Number.isFinite(energy) && energy > 0) energyValues.push(energy);
  });

  const avg = (arr) => (arr.length ? (arr.reduce((sum, value) => sum + value, 0) / arr.length).toFixed(1) : '—');
  const distribution = Object.entries(projectCounts)
    .sort((left, right) => right[1] - left[1])
    .map(([name, count]) => `${name} ${count}个`)
    .join('、');

  return [
    '【聚合统计】',
    `- 项目分布：${distribution}`,
    `- 完全达成：${fullCount}/${records.length}`,
    `- 被打断：${interruptedCount} 次`,
    `- 平均质量：${avg(qualityValues)}/5，平均精力：${avg(energyValues)}/5`
  ].join('\n');
}

// 统计本周之前 2 周的完成数据，供周报做纵向对比
function buildPriorWeeksStatsContext(currentStartDate) {
  const msPerDay = 86400000;
  const currentStart = new Date(`${currentStartDate}T00:00:00`).getTime();

  if (Number.isNaN(currentStart)) {
    return '';
  }

  const lines = [];

  for (let weekAgo = 1; weekAgo <= 2; weekAgo += 1) {
    const end = new Date(currentStart - (7 * (weekAgo - 1) + 1) * msPerDay);
    const start = new Date(currentStart - 7 * weekAgo * msPerDay);
    const startKey = formatDateValue(start);
    const endKey = formatDateValue(end);
    const weekRecords = getRecordsByDateRange(startKey, endKey);

    if (!weekRecords.length) {
      continue;
    }

    const qualityValues = weekRecords.map((record) => Number(record.quality)).filter((value) => Number.isFinite(value));
    const avgQuality = qualityValues.length
      ? (qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length).toFixed(1)
      : '—';
    const interrupted = weekRecords.filter((record) => record.interrupted).length;
    lines.push(`- ${startKey} 至 ${endKey}：${weekRecords.length} 个番茄，均质 ${avgQuality}/5，被打断 ${interrupted} 次`);
  }

  if (!lines.length) {
    return '';
  }

  return `【前两周完成数据】（请与本段时间做对比，指出是进步还是退步）\n${lines.join('\n')}`;
}

// 取最近 2 篇周报原文，供本次周报与历史对比
function buildPreviousWeeklyReportsContext() {
  const weeklyReports = getReports()
    .filter((report) => report.type === 'weekly')
    .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
    .slice(0, 2);

  if (!weeklyReports.length) {
    return '';
  }

  const lines = ['【最近的历史周总结原文】（请对比上次周总结：老问题是否仍在、是否兑现了上次的计划）'];
  weeklyReports.forEach((report) => {
    const label = String(report.dateKey || '').replace('_', ' 至 ');
    lines.push(`— 周报（${label}）——\n${report.content}`);
  });

  return lines.join('\n');
}

// 取最近 1-2 篇日报原文，让教练避免重复自己说过的话、形成连续对话感
function buildPreviousDailyReportsContext() {
  const dailyReports = getReports()
    .filter((report) => report.type === 'daily' && report.dateKey !== today())
    .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
    .slice(0, 2);

  if (!dailyReports.length) {
    return '';
  }

  const lines = ['【你最近写给他的日报原文】（别重复这些话和建议；今天若和昨天类似，就直说"节奏和昨天差不多"，不要硬造新洞察）'];
  dailyReports.forEach((report) => {
    lines.push(`— ${formatDateCN(report.dateKey)} 的日报 ——\n${report.content}`);
  });

  return lines.join('\n');
}

function buildCoachChatSystemPrompt() {
  return `你是用户的私人番茄教练。${getTonePersona(getSettings().coachTone)}

你的首要任务是直接、简洁地回答用户的当前问题。上下文数据只是供你引用以支撑答案的参考，不要先复述数据、不要做一轮"总览分析"——除非用户问的本身就是"帮我分析/总结这段时间"这类宏观问题。如果上下文不足以回答，直接说明并提出你可以帮他分析的方向。`;
}

function buildCoachChatUserMessage(history, question, range) {
  const rangeRecords = getRecordsByDateRange(range.startDate, range.endDate);
  const MAX_DETAIL = 20;
  let detailBlock;

  if (!rangeRecords.length) {
    detailBlock = '- 该时间段没有番茄记录。';
  } else if (rangeRecords.length <= MAX_DETAIL) {
    detailBlock = rangeRecords.map((record) => buildRecordContextLine(record)).join('\n');
  } else {
    detailBlock = `${buildRecordsAggregateSummary(rangeRecords)}\n\n（记录较多，仅附最近 ${MAX_DETAIL} 条明细供参考）\n${rangeRecords.slice(0, MAX_DETAIL).map((record) => buildRecordContextLine(record)).join('\n')}`;
  }

  const historyLines = history.length
    ? history.slice(-12).map((item) => `${item.role === 'user' ? '用户' : '教练'}：${item.content}`).join('\n')
    : '无';

  const extraContexts = [buildGoalsContext(), buildDismissedFeedbackContext(), buildPracticedFeedbackContext()].filter(Boolean);
  const extraContext = extraContexts.length ? `\n\n${extraContexts.join('\n\n')}` : '';

  const truncationText = history.length > 12 ? '（对话历史已截断至最近 6 轮）\n\n' : '';

  // 问题优先，数据在后且仅作参考
  return `当前问题：
${question}

（以下是你可选的内容：${range.label}番茄记录、目标、建议反馈等，供你在回答上面问题时引用具体数据。不必逐条分析这些数据——只有当你需要引用某条记录来支撑你的回答时才用它）

分析范围：${range.label}（${range.startDate} 至 ${range.endDate}），共 ${rangeRecords.length} 个番茄
${detailBlock}${extraContext}

历史对话：
${historyLines}
${truncationText}`;
}

// 把中文/阿拉伯数字（1..99，含"两""几"）解析为整数，失败返回 NaN
function parseFlexibleInt(token) {
  const raw = String(token || '').trim();

  if (/^\d+$/.test(raw)) {
    return parseInt(raw, 10);
  }

  if (raw === '几') {
    return 3;
  }

  const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

  if (raw === '十') {
    return 10;
  }

  if (raw.includes('十')) {
    const [left, right] = raw.split('十');
    const tens = left === '' ? 1 : digits[left];
    const ones = right === '' ? 0 : digits[right];

    if (tens === undefined || ones === undefined) {
      return NaN;
    }

    return tens * 10 + ones;
  }

  return raw in digits ? digits[raw] : NaN;
}

// 从提问文本解析时间范围，返回 { startDate, endDate, label } 或 null
function parseQuestionDateRange(question) {
  const text = String(question || '');
  const todayStr = today();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const num = '([\\d一二两三四五六七八九十几]+)';
  const clampEnd = (dateStr) => (dateStr > todayStr ? todayStr : dateStr);
  const daysAgo = (n) => formatDateValue(new Date(now.getTime() - (n - 1) * 86400000));
  const range = (startStr, endStr, label) => ({ startDate: startStr, endDate: clampEnd(endStr), label });

  try {
    // 全部 / 至今
    if (/(全部|所有|一直以来|所有时间|历史(记录)?|至今|以来的?全部)/.test(text) && !/最近|近|过去/.test(text)) {
      const records = getRecords();
      const earliest = records.reduce((min, record) => (record.date && record.date < min ? record.date : min), todayStr);
      return range(earliest, todayStr, '全部');
    }

    if (/今天|今日/.test(text)) return range(todayStr, todayStr, '今天');
    if (/昨天|昨日/.test(text)) return range(daysAgo(2), daysAgo(2), '昨天');
    if (/(上周|上一周|上个星期|上星期)/.test(text)) {
      const r = getPreviousWeekRange();
      return range(r.startDate, r.endDate, '上周');
    }
    if (/(本周|这周|这一周|本星期|这星期)/.test(text)) {
      const r = getCurrentWeekRange();
      return range(r.startDate, r.endDate, '本周');
    }

    // 最近N个月 / 一个月
    let m = text.match(new RegExp(`(?:最近|近|过去|这)?\\s*${num}\\s*个月`));
    if (m) {
      const n = parseFlexibleInt(m[1]);
      if (Number.isFinite(n) && n > 0) return range(daysAgo(n * 30), todayStr, `最近${n}个月`);
    }

    // 半年（需带"最近/近/过去"前缀，避免误吞"上半年/下半年"）
    if (/(最近|近|过去|这)\s*半年/.test(text)) return range(daysAgo(180), todayStr, '近半年');

    // 最近N周
    m = text.match(new RegExp(`(?:最近|近|过去|这)?\\s*${num}\\s*(?:周|个星期|星期)`));
    if (m) {
      const n = parseFlexibleInt(m[1]);
      if (Number.isFinite(n) && n > 0) return range(daysAgo(n * 7), todayStr, `最近${n}周`);
    }

    // 最近N天 / 这几天
    m = text.match(new RegExp(`(?:最近|近|过去|这)\\s*${num}\\s*(?:天|日)`));
    if (m) {
      const n = parseFlexibleInt(m[1]);
      if (Number.isFinite(n) && n > 0) return range(daysAgo(n), todayStr, `最近${n}天`);
    }

    // 上个月
    if (/(上个月|上一个月|上月)/.test(text)) {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return range(formatDateValue(start), formatDateValue(end), '上个月');
    }
    // 本月
    if (/(本月|这个月|这一个月|本月份)/.test(text)) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return range(formatDateValue(start), todayStr, '本月');
    }

    // 季度
    const quarterRange = (offset) => {
      let q = Math.floor(now.getMonth() / 3) + offset;
      let year = now.getFullYear();
      while (q < 0) { q += 4; year -= 1; }
      const startMonth = q * 3;
      const start = new Date(year, startMonth, 1);
      const end = new Date(year, startMonth + 3, 0);
      return { start, end };
    };
    if (/(上个季度|上一季度|上季度)/.test(text)) {
      const r = quarterRange(-1);
      return range(formatDateValue(r.start), formatDateValue(r.end), '上季度');
    }
    if (/(本季度|这个季度|这一季度)/.test(text) || /(最近|近|过去)\s*(?:一个|1个)?季度/.test(text)) {
      const r = quarterRange(0);
      return range(formatDateValue(r.start), todayStr, '本季度');
    }
    if (/最近三个月|近三个月|过去三个月/.test(text)) {
      return range(daysAgo(90), todayStr, '最近三个月');
    }

    // 上/下半年
    if (/上半年/.test(text)) {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 5, 30);
      return range(formatDateValue(start), formatDateValue(end), '上半年');
    }
    if (/下半年/.test(text)) {
      const start = new Date(now.getFullYear(), 6, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return range(formatDateValue(start), formatDateValue(end), '下半年');
    }

    // 去年 / 今年
    if (/去年/.test(text)) {
      const y = now.getFullYear() - 1;
      return range(`${y}-01-01`, `${y}-12-31`, '去年');
    }
    if (/(今年|本年|今年以来)/.test(text)) {
      return range(`${now.getFullYear()}-01-01`, todayStr, '今年');
    }

    // 绝对月份 "X月" / "X月份"（不含"个月"，前面已排除）
    m = text.match(new RegExp(`${num}\\s*月份?`));
    if (m) {
      const month = parseFlexibleInt(m[1]);
      if (Number.isFinite(month) && month >= 1 && month <= 12) {
        const currentMonth = now.getMonth() + 1;
        const year = month <= currentMonth ? now.getFullYear() : now.getFullYear() - 1;
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        return range(formatDateValue(start), formatDateValue(end), `${month}月`);
      }
    }

    return null;
  } catch (error) {
    console.error('[parseQuestionDateRange] 解析失败：', error);
    return null;
  }
}

// 确定自由提问要分析的时间范围：解析到用之，否则默认最近 30 天
function resolveChatRange(question) {
  const parsed = parseQuestionDateRange(question);

  if (parsed && parsed.startDate && parsed.endDate) {
    return { ...parsed, matched: true };
  }

  const start = formatDateValue(new Date(Date.now() - 29 * 86400000));
  return { startDate: start, endDate: today(), label: '最近30天', matched: false };
}

async function handleGenerateDailySummary() {
  if (!DOM.generateDailySummaryBtn) {
    return;
  }

  // 先保存今日自我评价为日记
  const selfNote = DOM.dailySelfNote ? DOM.dailySelfNote.value.trim() : '';
  setJournal(today(), selfNote);

  const records = sortRecordsByStartTimeDesc(getRecordsByDate(today()));
  setCoachActionLoading(DOM.generateDailySummaryBtn, true);

  let result = null;
  try {
    result = await callLLM(buildDailySummarySystemPrompt(records), buildDailySummaryUserMessage(records, selfNote), { temperature: 0.8 });
  } catch (error) {
    console.error('[日报] 生成失败：', error);
    showCoachFeedback('生成日报时出错，请重试。');
  } finally {
    setCoachActionLoading(DOM.generateDailySummaryBtn, false);
  }

  if (!result) {
    return;
  }

  setResultCardContent(DOM.dailySummaryResult, result, '今天的教练报告会显示在这里。');
  addReport({ id: generateId(), type: 'daily', dateKey: today(), content: result, selfNote, createdAt: new Date().toISOString(), recordCount: records.length });
  renderReportHistory('daily');
  extractReminders(result);

  // 到设定的星期几且本周尚未自动生成，则自动附带一次周总结
  await maybeGenerateAutoWeeklySummary();
}

async function handleGenerateWeeklyReport() {
  if (!DOM.generateWeeklyReportBtn || !DOM.weeklyStartDate || !DOM.weeklyEndDate) {
    return;
  }

  const startDate = DOM.weeklyStartDate.value;
  const endDate = DOM.weeklyEndDate.value;

  if (!startDate || !endDate) {
    showCoachFeedback('请选择完整的周报日期范围。');
    return;
  }

  if (endDate < startDate) {
    showCoachFeedback('结束日期不能早于开始日期。');
    return;
  }

  const records = getRecordsByDateRange(startDate, endDate);
  setCoachActionLoading(DOM.generateWeeklyReportBtn, true);

  let result = null;
  try {
    result = await callLLM(
      buildWeeklyReportSystemPrompt(),
      buildWeeklyReportUserMessage(startDate, endDate, records),
      { timeoutMs: 60000 }
    );
  } catch (error) {
    console.error('[周报] 生成失败：', error);
    showCoachFeedback('生成周报时出错，请重试或缩短日期范围。');
  } finally {
    setCoachActionLoading(DOM.generateWeeklyReportBtn, false);
  }

  if (!result) {
    return;
  }

  setResultCardContent(DOM.weeklyReportResult, result, '选择日期范围后生成周报。');
  addReport({ id: generateId(), type: 'weekly', dateKey: `${startDate}_${endDate}`, content: result, createdAt: new Date().toISOString(), recordCount: records.length });
  renderReportHistory('weekly');
}

// 生成今日报告时，若到达设定星期几且本周尚未自动生成，则自动追加一次周总结
async function maybeGenerateAutoWeeklySummary() {
  const settings = getSettings();

  if (!settings.autoWeeklySummary) {
    return;
  }

  const targetWeekday = Number(settings.weeklySummaryWeekday);

  if (new Date().getDay() !== targetWeekday) {
    return;
  }

  const weekRange = getCurrentWeekRange();
  const weekKey = weekRange.startDate; // 以本周起始日作为去重键

  if (settings.lastAutoWeeklyKey === weekKey) {
    return; // 本周已自动生成过
  }

  const records = getRecordsByDateRange(weekRange.startDate, weekRange.endDate);

  if (DOM.dailySummaryResult) {
    const note = document.createElement('div');
    note.className = 'auto-weekly-note';
    note.textContent = '📈 正在生成本周自动周总结…';
    DOM.dailySummaryResult.after(note);
    APP_STATE._autoWeeklyNote = note;
  }

  const result = await callLLM(
    buildWeeklyReportSystemPrompt(),
    buildWeeklyReportUserMessage(weekRange.startDate, weekRange.endDate, records),
    { timeoutMs: 60000 }
  ).catch((error) => {
    console.error('[自动周总结] 生成失败：', error);
    return null;
  });

  if (!result) {
    if (APP_STATE._autoWeeklyNote) {
      APP_STATE._autoWeeklyNote.remove();
      APP_STATE._autoWeeklyNote = null;
    }
    return;
  }

  addReport({
    id: generateId(),
    type: 'weekly',
    dateKey: `${weekRange.startDate}_${weekRange.endDate}`,
    content: result,
    createdAt: new Date().toISOString(),
    recordCount: records.length,
    auto: true
  });
  saveSettings({ lastAutoWeeklyKey: weekKey });
  renderReportHistory('weekly');

  if (DOM.weeklyReportResult) {
    setResultCardContent(DOM.weeklyReportResult, result, '选择日期范围后生成周报。');
  }

  if (APP_STATE._autoWeeklyNote) {
    APP_STATE._autoWeeklyNote.textContent = '📈 本周自动周总结已生成，可在下方「周报」标签页查看。';
    APP_STATE._autoWeeklyNote = null;
  }

  showToast('📈 已自动生成本周周总结');
}

async function handleChatSubmit(event) {
  event.preventDefault();

  if (!DOM.chatInput || !DOM.sendChatBtn) {
    return;
  }

  const question = DOM.chatInput.value.trim();

  if (!question) {
    return;
  }

  const historySnapshot = APP_STATE.coachChatHistory.slice();
  APP_STATE.coachChatHistory.push({ role: 'user', content: question });
  renderChatHistory();
  DOM.chatInput.value = '';

  const range = resolveChatRange(question);

  setCoachActionLoading(DOM.sendChatBtn, true);
  let answer = null;
  try {
    answer = await callLLM(
      buildCoachChatSystemPrompt(),
      buildCoachChatUserMessage(historySnapshot, question, range),
      { temperature: 0.8, timeoutMs: 60000 }
    );
  } catch (error) {
    console.error('[自由提问] 调用失败：', error);
    showCoachFeedback('提问出错，请重试。');
  } finally {
    setCoachActionLoading(DOM.sendChatBtn, false);
  }

  if (!answer) {
    return;
  }

  const assistantMessage = { role: 'assistant', content: answer };
  if (range.matched) {
    assistantMessage.hint = `📊 已按"${range.label}"（${range.startDate} 至 ${range.endDate}）范围分析`;
  }
  APP_STATE.coachChatHistory.push(assistantMessage);
  renderChatHistory();
  addChatEntry(question, answer);
}

function renderCoachPage() {
  renderDailySummaryPreview();
  renderChatHistory();
  renderCoachCenter();
  switchCoachTab(APP_STATE.coachActiveTab);
  renderReportHistory('daily');
  renderReportHistory('weekly');
}

function initSettingsPage() {
  if (
    !DOM.settingsApiKey
    || !DOM.settingsApiBase
    || !DOM.settingsModel
    || !DOM.settingsTimerDuration
    || !DOM.settingsShortBreak
    || !DOM.settingsLongBreak
  ) {
    return;
  }

  const settings = getSettings();
  DOM.settingsApiKey.type = 'password';
  DOM.settingsApiKey.value = settings.apiKey || '';
  DOM.settingsApiBase.value = settings.apiBase || DEFAULT_SETTINGS.apiBase;
  syncSettingsModelField(settings.model || DEFAULT_SETTINGS.model);

  DOM.settingsToneOptions.forEach((button) => {
    button.classList.toggle('is-selected', button.dataset.tone === settings.coachTone);
  });

  DOM.settingsEvalModeButtons.forEach((button) => {
    const isQuick = button.dataset.mode === 'quick';
    button.classList.toggle('is-selected', isQuick === Boolean(settings.quickEvaluate));
  });

  DOM.settingsTimerDuration.value = String(settings.timerDuration);
  DOM.settingsShortBreak.value = String(settings.shortBreak);
  DOM.settingsLongBreak.value = String(settings.longBreak);

  const { usedKB, usedPercent } = getStorageUsageInfo();
  if (DOM.storageUsageLabel) DOM.storageUsageLabel.textContent = `${usedKB.toFixed(1)} KB（${usedPercent}%）`;
  if (DOM.storageBarFill) {
    DOM.storageBarFill.style.width = `${Math.min(usedPercent, 100)}%`;
    DOM.storageBarFill.classList.toggle('is-warning', usedPercent > 60 && usedPercent <= 80);
    DOM.storageBarFill.classList.toggle('is-danger', usedPercent > 80);
    if (usedPercent > 80) showToast(`⚠️ 本地存储已用 ${usedPercent}%，建议到数据管理清理旧数据`, 'error');
  }

  if (DOM.settingsGithubToken) DOM.settingsGithubToken.value = settings.githubToken || '';
  if (DOM.settingsGistId) DOM.settingsGistId.value = settings.gistId || '';
  if (DOM.settingsPwdHint) DOM.settingsPwdHint.value = getPwdHint();
  if (DOM.settingsAutoSyncToggle) {
    const isOn = Boolean(settings.autoSync);
    DOM.settingsAutoSyncToggle.textContent = isOn ? '开' : '关';
    DOM.settingsAutoSyncToggle.classList.toggle('is-on', isOn);
    DOM.settingsAutoSyncToggle.setAttribute('aria-pressed', String(isOn));
  }
  renderSyncStatus();

  renderProjectManager();
  renderCoachSettings();

  const versionEl = document.getElementById('settings-version-display');
  if (versionEl) {
    const swVer = typeof VERSION !== 'undefined' ? VERSION : '?'; // sw.js 中的 VERSION 不在同一作用域，如需显示 SW 版本，在 SW_UPDATED 消息处理中更新
    versionEl.textContent = `当前版本：${BUILD_DATE}`;
  }
}

function renderCoachSettings() {
  const toggle = document.getElementById('settings-auto-weekly-toggle');
  const settings = getSettings();

  if (toggle) {
    const isOn = Boolean(settings.autoWeeklySummary);
    toggle.textContent = isOn ? '开' : '关';
    toggle.classList.toggle('is-on', isOn);
    toggle.setAttribute('aria-pressed', String(isOn));
  }

  const weekday = Number(settings.weeklySummaryWeekday);
  document.querySelectorAll('#settings-weekday-options .weekday-option').forEach((button) => {
    button.classList.toggle('is-selected', Number(button.dataset.weekday) === weekday);
  });
}

function renderProjectManager() {
  const container = document.getElementById('settings-project-list');

  if (!container) {
    return;
  }

  container.replaceChildren();
  const projects = getProjects();
  const records = getRecords();

  projects.forEach((project) => {
    const isUncategorized = project.id === UNCATEGORIZED_PROJECT_ID;
    const row = document.createElement('div');
    row.className = 'project-row';

    const swatch = document.createElement('span');
    swatch.className = 'project-row__swatch';
    swatch.style.background = project.color || '#9E9E9E';
    swatch.textContent = project.icon || '';

    const name = document.createElement('span');
    name.className = 'project-row__name';
    const count = records.filter((record) => (record.projectId || UNCATEGORIZED_PROJECT_ID) === project.id).length;
    name.textContent = `${project.name}（${count} 🍅）`;

    row.append(swatch, name);

    if (!isUncategorized) {
      const editBtn = document.createElement('button');
      editBtn.className = 'project-row__action';
      editBtn.type = 'button';
      editBtn.textContent = '✏️';
      editBtn.setAttribute('aria-label', '编辑项目');
      editBtn.addEventListener('click', () => openProjectEditModal(project));

      const delBtn = document.createElement('button');
      delBtn.className = 'project-row__action';
      delBtn.type = 'button';
      delBtn.textContent = '🗑️';
      delBtn.setAttribute('aria-label', '删除项目');
      delBtn.addEventListener('click', () => {
        if (confirm(`删除项目「${project.name}」？该项目下的番茄将归到「未分类」，其目标一并删除。`)) {
          deleteProject(project.id);
          renderProjectManager();
          refreshRecordViews();
          showToast('项目已删除');
        }
      });

      row.append(editBtn, delBtn);
    }

    container.appendChild(row);
  });
}

function openProjectEditModal(project) {
  const isNew = !project;
  const data = project || {
    id: generateId(),
    name: '',
    color: PROJECT_COLOR_PRESETS[0],
    icon: '📁',
    archived: false
  };

  const colorSwatches = PROJECT_COLOR_PRESETS.map((color) => {
    const selected = color === data.color ? ' is-selected' : '';
    return `<button type="button" class="color-swatch${selected}" data-color="${color}" style="background:${color}" aria-label="颜色 ${color}"></button>`;
  }).join('');

  const modal = openModal(`
    <h2 class="modal__title">${isNew ? '新建项目' : '编辑项目'}</h2>
    <div class="modal__body">
      <form id="project-form">
        <div class="field">
          <label class="field__label" for="project-name">项目名</label>
          <input id="project-name" class="field__input" type="text" maxlength="20" placeholder="例如：写作" value="${escapeHtml(data.name)}">
        </div>
        <div class="field">
          <label class="field__label" for="project-icon">图标（emoji）</label>
          <input id="project-icon" class="field__input" type="text" maxlength="2" placeholder="📁" value="${escapeHtml(data.icon || '')}">
        </div>
        <div class="field">
          <span class="field__label">颜色</span>
          <div class="color-swatches">${colorSwatches}</div>
        </div>
        <div id="project-form-error" class="modal__error" hidden></div>
        <div class="modal__actions">
          <button id="project-cancel-btn" class="btn btn--ghost" type="button">取消</button>
          <button class="btn btn--primary" type="submit">保存</button>
        </div>
      </form>
    </div>
  `);

  const form = modal.querySelector('#project-form');
  const nameInput = modal.querySelector('#project-name');
  const iconInput = modal.querySelector('#project-icon');
  const error = modal.querySelector('#project-form-error');
  const swatchButtons = Array.from(modal.querySelectorAll('.color-swatch'));
  let selectedColor = data.color;

  swatchButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedColor = button.dataset.color;
      swatchButtons.forEach((other) => other.classList.toggle('is-selected', other === button));
    });
  });

  modal.querySelector('#project-cancel-btn')?.addEventListener('click', closeActiveModal);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();

    if (!name) {
      error.textContent = '请填写项目名。';
      error.hidden = false;
      return;
    }

    const patch = {
      name,
      icon: iconInput.value.trim() || '📁',
      color: selectedColor
    };

    if (isNew) {
      addProject({ ...data, ...patch });
    } else {
      updateProject(data.id, patch);
    }

    closeActiveModal();
    renderProjectManager();
    refreshRecordViews();
    showToast(isNew ? '项目已创建' : '项目已更新');
  });

  nameInput.focus();
}

function buildRecordTextLine(record) {
  return `${record.startTime}-${record.endTime} | ${record.goal} | ⭐${record.quality}颗 | ${ACHIEVEMENT_ICONS[record.achievement] || '❔'} ${getAchievementLabel(record.achievement)} | ${record.summary}`;
}

function exportCopyToday() {
  const records = getRecordsByDate(today()).slice().sort((left, right) => {
    return left.startTime.localeCompare(right.startTime);
  });

  if (!records.length) {
    showToast('今天还没有记录可复制', 'error');
    return;
  }

  const text = records.map((record) => buildRecordTextLine(record)).join('\n');

  if (!navigator.clipboard?.writeText) {
    showToast('复制失败，请手动复制', 'error');
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => showToast('✅ 今日记录已复制'))
    .catch(() => showToast('复制失败，请手动复制', 'error'));
}

function exportCopyWeek() {
  const { startDate, endDate } = getCurrentWeekRange();
  const records = getRecordsByDateRange(startDate, endDate).slice().sort((left, right) => {
    const dateResult = left.date.localeCompare(right.date);

    if (dateResult !== 0) {
      return dateResult;
    }

    return left.startTime.localeCompare(right.startTime);
  });

  if (!records.length) {
    showToast('本周还没有记录可复制', 'error');
    return;
  }

  const grouped = records.reduce((result, record) => {
    if (!result[record.date]) {
      result[record.date] = [];
    }

    result[record.date].push(record);
    return result;
  }, {});

  const text = Object.keys(grouped).map((dateStr) => {
    const lines = grouped[dateStr].map((record) => buildRecordTextLine(record));
    return [`=== ${formatDateCN(dateStr)} ===`, ...lines].join('\n');
  }).join('\n\n');

  if (!navigator.clipboard?.writeText) {
    showToast('复制失败，请手动复制', 'error');
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => showToast('✅ 本周记录已复制'))
    .catch(() => showToast('复制失败，请手动复制', 'error'));
}

function exportCSV() {
  const achievementLabels = {
    full: '完全达成',
    partial: '部分达成',
    none: '未达成'
  };

  const lines = [
    '日期,开始时间,结束时间,时长,项目,目标,达成,质量,精力,关联目标,总结,打断,打断备注'
  ];

  sortRecordsByDateTimeDesc(getRecords()).forEach((record) => {
    const project = getProjectById(record.projectId);
    const goal = record.goalId ? getGoals().find((g) => g.id === record.goalId) : null;
    lines.push([
      csvEscape(record.date),
      csvEscape(record.startTime),
      csvEscape(record.endTime),
      csvEscape(record.duration),
      csvEscape(project ? project.name : '未分类'),
      csvEscape(record.goal),
      csvEscape(achievementLabels[record.achievement] || '未知'),
      csvEscape(record.quality),
      csvEscape(record.energy || ''),
      csvEscape(goal ? goal.title : ''),
      csvEscape(record.summary),
      csvEscape(record.interrupted ? '是' : '否'),
      csvEscape(record.interruptionNote)
    ].join(','));
  });

  const csv = `\uFEFF${lines.join('\n')}`;
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `tomato-coach-${today()}.csv`);
  showToast('✅ CSV 已开始下载');
}

// 将所有 LLM 相关记录导出为多工作表 Excel（Excel 2003 XML 格式，双击即用 Excel/WPS 打开）
function exportLLMRecords() {
  const xmlEscape = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r\n|\r|\n/g, '&#10;');

  const buildSheet = (name, headers, rows) => {
    const headerCells = headers.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('');
    const bodyRows = rows.map((row) => {
      const cells = row.map((value) => `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`).join('');
      return `<Row>${cells}</Row>`;
    }).join('');
    return `<Worksheet ss:Name="${xmlEscape(name)}"><Table><Row>${headerCells}</Row>${bodyRows}</Table></Worksheet>`;
  };

  const formatDateTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : `${formatDateValue(date)} ${formatTime(date)}`;
  };

  const reports = getReports().slice().sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''));

  const dailyRows = reports
    .filter((report) => report.type === 'daily')
    .map((report) => [report.dateKey || '', formatDateTime(report.createdAt), report.recordCount ?? '', report.selfNote || report._selfNote || '', report.content || '']);

  const weeklyRows = reports
    .filter((report) => report.type === 'weekly')
    .map((report) => [String(report.dateKey || '').replace('_', ' 至 '), formatDateTime(report.createdAt), report.recordCount ?? '', report.auto ? '是' : '否', report.content || '']);

  const chatRows = getChats().slice()
    .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
    .map((chat) => [chat.date || '', formatDateTime(chat.createdAt), chat.question || '', chat.answer || '']);

  const journals = getJournals();
  const journalRows = Object.keys(journals)
    .sort((left, right) => right.localeCompare(left))
    .map((date) => [date, journals[date] || '']);

  const allGoals = getGoals();
  const goalRows = allGoals.slice().sort((left, right) => (left.status === 'done' ? 1 : 0) - (right.status === 'done' ? 1 : 0))
    .map((goal) => {
      const progress = getGoalProgress(goal);
      const project = getProjectById(goal.projectId);
      const statusLabel = goal.status === 'done' ? '已完成' : goal.status === 'failed' ? '已失败' : goal.status === 'paused' ? '已暂停' : '进行中';
      const extensionsText = (Array.isArray(goal.extensions) ? goal.extensions : []).map((ext) => {
        return `${ext.date || ''} 从${ext.previousTarget}延至${ext.newTarget}，原因：${ext.reason || ''}`;
      }).join('\n');
      return [
        project ? project.name : '未分类',
        goal.title || '',
        goal.targetPomodoros ?? '',
        progress.done,
        statusLabel,
        goal.startDate || '',
        goal.deadline || '',
        goal.completionDate ? formatDateCN(goal.completionDate.split('T')[0] || goal.completionDate) : '',
        goal.completionReason || '',
        extensionsText
      ];
    });

  const sheets = [
    buildSheet('日报', ['日期', '生成时间', '番茄数', '自我评价', '报告内容'], dailyRows),
    buildSheet('周报', ['范围', '生成时间', '番茄数', '是否自动', '报告内容'], weeklyRows),
    buildSheet('自由提问', ['日期', '时间', '提问', 'AI 回复'], chatRows),
    buildSheet('每日自评', ['日期', '自评内容'], journalRows),
    buildSheet('目标', ['项目', '标题', '目标番茄数', '已完成', '状态', '创建日期', '截止日期', '完成日期', '完成感想', '延期记录'], goalRows)
  ].join('');

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets}
</Workbook>`;

  if (!dailyRows.length && !weeklyRows.length && !chatRows.length && !journalRows.length) {
    showToast('还没有可导出的 LLM 记录', 'error');
    return;
  }

  triggerDownload(
    new Blob(['\uFEFF' + workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' }),
    `tomato-coach-llm-${today()}.xls`
  );
  showToast('✅ LLM 记录（Excel）已开始下载');
}

async function exportJSON() {
  let passwordProvided = false;

  try {
    const password = await promptSyncPassword('export');
    saveSettings({ syncPassword: password });
    passwordProvided = true;

    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      records: getRecords(),
      reminders: getReminders(),
      projects: getProjects(),
      goals: getGoals(),
      reports: getReports(),
      journals: getJournals(),
      chats: getChats()
    };
    const encryptedPayload = await encryptData(JSON.stringify(payload));
    const json = JSON.stringify({ encrypted: true, data: encryptedPayload }, null, 2);
    triggerDownload(
      new Blob([json], { type: 'application/json;charset=utf-8' }),
      `tomato-coach-encrypted-${today()}.json`
    );
    showToast('✅ 加密 JSON 备份已开始下载');
  } catch (error) {
    if (error?.message === 'cancelled') {
      return;
    }

    if (error?.message === 'no_password') {
      showToast('请输入密码短语', 'error');
      return;
    }

    showToast(`导出失败：${error.message}`, 'error');
  } finally {
    if (passwordProvided) {
      saveSettings({ syncPassword: '' });
    }
  }
}

async function importJSON(file) {
  let passwordProvided = false;

  try {
    const content = await readFileAsText(file);
    let parsed = JSON.parse(content);

    if (parsed?.encrypted === true) {
      if (typeof parsed.data !== 'string') {
        showToast('加密文件格式不正确', 'error');
        return;
      }

      try {
        const password = await promptSyncPassword('import');
        saveSettings({ syncPassword: password });
        passwordProvided = true;
      } catch (error) {
        return;
      }

      try {
        parsed = JSON.parse(await decryptData(parsed.data));
      } catch (error) {
        if (error?.message === 'no_password') {
          showToast('请输入密码短语', 'error');
          return;
        }

        if (error?.name === 'OperationError') {
          showToast('解密失败：密码错误或文件已损坏', 'error');
          return;
        }

        throw error;
      }
    }

    const hasVersion = Object.prototype.hasOwnProperty.call(parsed, 'version');
    const records = Array.isArray(parsed.records) ? parsed.records : [];
    const reminders = Array.isArray(parsed.reminders) ? parsed.reminders : [];
    const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    const goals = Array.isArray(parsed.goals) ? parsed.goals : [];
    const reports = Array.isArray(parsed.reports) ? parsed.reports : [];
    const journals = parsed.journals && typeof parsed.journals === 'object' && !Array.isArray(parsed.journals) ? parsed.journals : {};
    const chats = Array.isArray(parsed.chats) ? parsed.chats : [];

    if (!hasVersion || (!Array.isArray(parsed.records) && !Array.isArray(parsed.reminders))) {
      showToast('文件格式不正确', 'error');
      return;
    }

    const extraCounts = [];
    if (projects.length) extraCounts.push(`${projects.length} 个项目`);
    if (goals.length) extraCounts.push(`${goals.length} 个目标`);
    if (reports.length) extraCounts.push(`${reports.length} 份报告`);
    const journalCount = Object.keys(journals).length;
    if (journalCount) extraCounts.push(`${journalCount} 篇日记`);
    if (chats.length) extraCounts.push(`${chats.length} 条对话`);
    const extraText = extraCounts.length ? `、${extraCounts.join('、')}` : '';

    const modal = openModal(`
      <h2 class="modal__title">导入确认</h2>
      <div class="modal__body">
        <p>将导入 ${records.length} 条记录、${reminders.length} 条提醒${extraText}</p>
        <div class="modal__actions">
          <button id="import-merge-btn" class="btn btn--primary" type="button">合并</button>
          <button id="import-replace-btn" class="btn btn--secondary" type="button">覆盖</button>
          <button id="import-cancel-btn" class="btn btn--ghost" type="button">取消</button>
        </div>
      </div>
    `);

    modal.querySelector('#import-cancel-btn')?.addEventListener('click', () => {
      closeActiveModal();
    });

    modal.querySelector('#import-merge-btn')?.addEventListener('click', () => {
      const existingRecordIds = new Set(getRecords().map((record) => record.id));
      const existingReminderIds = new Set(getReminders().map((reminder) => reminder.id));
      const mergedRecords = [
        ...getRecords(),
        ...records.filter((record) => !existingRecordIds.has(record.id))
      ];
      const mergedReminders = [
        ...getReminders(),
        ...reminders.filter((reminder) => !existingReminderIds.has(reminder.id))
      ];

      saveRecords(mergedRecords);
      saveReminders(mergedReminders);

      if (projects.length) {
        saveProjects(mergeProjects(getProjects(), projects));
      }
      if (goals.length) {
        saveGoals(mergeGoals(getGoals(), goals));
      }
      if (reports.length) {
        saveReports(mergeReports(getReports(), reports));
        cleanOldReports();
      }
      if (journalCount) {
        saveJournals(mergeJournals(getJournals(), journals));
      }
      if (chats.length) {
        saveChats(mergeChats(getChats(), chats));
      }

      ensureProjectMigration();
      loadChatHistoryFromStore();
      closeActiveModal();
      showToast('✅ 已合并导入');
      refreshRecordViews();
      refreshReminderViews();
      renderReportHistory('daily');
      renderReportHistory('weekly');
      renderChatHistory();
    });

    modal.querySelector('#import-replace-btn')?.addEventListener('click', () => {
      saveRecords(records);
      saveReminders(reminders);

      if (projects.length) {
        saveProjects(mergeProjects(projects, []));
      }
      saveGoals(goals);
      saveReports(reports);
      cleanOldReports();
      saveJournals(journals);
      saveChats(chats);

      ensureProjectMigration();
      loadChatHistoryFromStore();
      closeActiveModal();
      showToast('✅ 已覆盖导入');
      refreshRecordViews();
      refreshReminderViews();
      renderReportHistory('daily');
      renderReportHistory('weekly');
      renderChatHistory();
    });
  } catch (error) {
    showToast('文件格式不正确', 'error');
  } finally {
    if (passwordProvided) {
      saveSettings({ syncPassword: '' });
    }
  }
}

function openClearAllDataModal() {
  const modal = openModal(`
    <h2 class="modal__title modal__title--danger">⚠️ 清除全部数据</h2>
    <div class="modal__body">
      <p>此操作不可恢复。请输入「确认清除」后点击确认。</p>
      <div class="field">
        <input id="confirm-clear-input" class="field__input" type="text" placeholder="输入：确认清除">
      </div>
      <div class="modal__actions">
        <button id="cancel-clear-all" class="btn btn--ghost" type="button">取消</button>
        <button id="confirm-clear-all" class="btn btn--danger" type="button" disabled>确认清除</button>
      </div>
    </div>
  `);

  const input = modal.querySelector('#confirm-clear-input');
  const confirmButton = modal.querySelector('#confirm-clear-all');

  modal.querySelector('#cancel-clear-all')?.addEventListener('click', () => {
    closeActiveModal();
  });

  input?.addEventListener('input', () => {
    confirmButton.disabled = input.value !== '确认清除';
  });

  confirmButton?.addEventListener('click', () => {
    saveRecords([]);
    saveReminders([]);

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);

      if (key && key.startsWith('tc_') && key !== STORAGE_KEYS.settings) {
        localStorage.removeItem(key);
      }
    }

    APP_STATE.coachChatHistory = [];
    closeActiveModal();
    showToast('所有数据已清除');
    refreshRecordViews();
    refreshReminderViews();
    renderChatHistory();
  });
}

function bindSettingsEvents() {
  if (
    APP_STATE.settingsEventsBound
    || !DOM.settingsApiKey
    || !DOM.toggleApiKeyVisibility
    || !DOM.settingsModel
    || !DOM.settingsApiSave
    || !DOM.settingsApiTest
    || !DOM.settingsTimerSave
    || !DOM.importJsonBtn
    || !DOM.importJsonInput
    || !DOM.clearOldData
    || !DOM.clearAllData
  ) {
    return;
  }

  DOM.toggleApiKeyVisibility.addEventListener('click', () => {
    DOM.settingsApiKey.type = DOM.settingsApiKey.type === 'password' ? 'text' : 'password';
  });

  if (DOM.toggleGithubTokenVisibility && DOM.settingsGithubToken) {
    DOM.toggleGithubTokenVisibility.addEventListener('click', () => {
      DOM.settingsGithubToken.type = DOM.settingsGithubToken.type === 'password' ? 'text' : 'password';
    });
  }

  DOM.settingsPwdHint?.addEventListener('change', () => {
    savePwdHint(DOM.settingsPwdHint.value.trim());
  });

  DOM.settingsModel.addEventListener('change', () => {
    const isCustom = DOM.settingsModel.value === 'custom';
    DOM.settingsModelCustom.hidden = !isCustom;

    if (isCustom) {
      DOM.settingsModelCustom.focus();
    }

    // 自动更新 API 地址为所选服务商的推荐地址
    const selectedModel = DOM.settingsModel.value;
    if (selectedModel !== 'custom') {
      const suggested = getSuggestedBaseForModel(selectedModel);
      if (suggested && DOM.settingsApiBase) {
        DOM.settingsApiBase.value = suggested;
      }
    }
  });

  DOM.settingsToneOptions.forEach((button) => {
    button.addEventListener('click', () => {
      const tone = button.dataset.tone;
      saveSettings({ coachTone: tone });
      DOM.settingsToneOptions.forEach((item) => {
        item.classList.toggle('is-selected', item === button);
      });
      showToast('语气已更新');
    });
  });

  DOM.settingsEvalModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      DOM.settingsEvalModeButtons.forEach((item) => {
        item.classList.toggle('is-selected', item === button);
      });
      saveSettings({ quickEvaluate: button.dataset.mode === 'quick' });
      showToast('评价模式已更新');
    });
  });

  if (DOM.settingsAutoSyncToggle) {
    DOM.settingsAutoSyncToggle.addEventListener('click', () => {
      const currentPressed = DOM.settingsAutoSyncToggle.getAttribute('aria-pressed') === 'true';
      const nextPressed = !currentPressed;
      saveSettings({ autoSync: nextPressed });
      DOM.settingsAutoSyncToggle.textContent = nextPressed ? '开' : '关';
      DOM.settingsAutoSyncToggle.classList.toggle('is-on', nextPressed);
      DOM.settingsAutoSyncToggle.setAttribute('aria-pressed', String(nextPressed));
      renderSyncStatus();
      if (!nextPressed) {
        cancelDebouncedSync();
      }
    });
  }

  if (DOM.settingsSyncSave && DOM.settingsGithubToken) {
    DOM.settingsSyncSave.addEventListener('click', () => {
      const token = DOM.settingsGithubToken.value.trim();

      if (!token) {
        showToast('请填写 GitHub Token', 'error');
        return;
      }

      saveSettings({ githubToken: token });
      showToast('✅ 同步配置已保存');
      renderSyncStatus();
      if (_syncDebounceTimer) {
        scheduleDebouncedSync();
      }
    });
  }

  if (DOM.settingsSyncNow && DOM.settingsGithubToken) {
    DOM.settingsSyncNow.addEventListener('click', async () => {
      const originalText = DOM.settingsSyncNow.textContent;
      const token = DOM.settingsGithubToken.value.trim();

      DOM.settingsSyncNow.disabled = true;
      DOM.settingsSyncNow.textContent = '同步中…';

      try {
        if (token && token !== getSettings().githubToken) {
          saveSettings({ githubToken: token });
        }

        await performSync();
      } finally {
        DOM.settingsSyncNow.disabled = false;
        DOM.settingsSyncNow.textContent = originalText;
      }
    });
  }

  document.getElementById('settings-clear-sync-pwd')?.addEventListener('click', () => {
    saveSettings({ syncPassword: '' });
    showToast('密码已清除，下次同步时需重新输入');
  });

  document.getElementById('config-export-btn')?.addEventListener('click', exportConfig);
  document.getElementById('config-import-btn')?.addEventListener('click', importConfig);

  DOM.settingsApiSave.addEventListener('click', () => {
    const apiKey = DOM.settingsApiKey.value.trim();
    const apiBase = DOM.settingsApiBase.value.trim() || DEFAULT_SETTINGS.apiBase;
    const model = getSelectedSettingsModelValue() || DEFAULT_SETTINGS.model;

    if (DOM.settingsModel.value === 'custom' && !model) {
      showToast('请输入自定义模型名', 'error');
      return;
    }

    saveSettings({ apiKey, apiBase, model });
    showToast('✅ API 配置已保存');
    initSettingsPage();
  });

  DOM.settingsApiTest.addEventListener('click', async () => {
    const apiKey = DOM.settingsApiKey.value.trim();
    const apiBase = DOM.settingsApiBase.value.trim() || DEFAULT_SETTINGS.apiBase;
    const model = getSelectedSettingsModelValue() || DEFAULT_SETTINGS.model;

    if (!apiKey) {
      showToast('请先填写 API Key', 'error');
      return;
    }

    if (DOM.settingsModel.value === 'custom' && !model) {
      showToast('请输入自定义模型名', 'error');
      return;
    }

    const originalText = DOM.settingsApiTest.textContent;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);

    DOM.settingsApiTest.disabled = true;
    DOM.settingsApiTest.textContent = '测试中…';

    try {
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'hello' }],
          max_tokens: 5
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      showToast('✅ 连接成功！');
    } catch (error) {
      const errorMsg = error?.name === 'AbortError' ? '请求超时' : error.message;
      showToast(`连接失败：${errorMsg}`, 'error');
    } finally {
      window.clearTimeout(timeoutId);
      DOM.settingsApiTest.disabled = false;
      DOM.settingsApiTest.textContent = originalText;
    }
  });

  DOM.settingsTimerSave.addEventListener('click', () => {
    const timerDuration = clampNumber(DOM.settingsTimerDuration.value, 5, 90, DEFAULT_SETTINGS.timerDuration);
    const shortBreak = clampNumber(DOM.settingsShortBreak.value, 1, 30, DEFAULT_SETTINGS.shortBreak);
    const longBreak = clampNumber(DOM.settingsLongBreak.value, 5, 60, DEFAULT_SETTINGS.longBreak);
    saveSettings({ timerDuration, shortBreak, longBreak });
    DOM.settingsTimerDuration.value = String(timerDuration);
    DOM.settingsShortBreak.value = String(shortBreak);
    DOM.settingsLongBreak.value = String(longBreak);

    if (APP_STATE.timerState === TIMER_STATES.IDLE) {
      resetTimerState({ closeModal: false });
    }

    showToast('✅ 时长设置已保存');
  });

  DOM.exportCopyToday.addEventListener('click', exportCopyToday);
  DOM.exportCopyWeek.addEventListener('click', exportCopyWeek);
  DOM.exportCsv.addEventListener('click', exportCSV);
  DOM.exportLlmXls?.addEventListener('click', exportLLMRecords);
  DOM.exportJson.addEventListener('click', () => {
    void exportJSON();
  });

  DOM.importJsonBtn.addEventListener('click', () => {
    DOM.importJsonInput.click();
  });

  DOM.importJsonInput.addEventListener('change', async () => {
    const file = DOM.importJsonInput.files?.[0];

    if (file) {
      await importJSON(file);
    }

    DOM.importJsonInput.value = '';
  });

  DOM.clearOldData.addEventListener('click', () => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 90);
    const oldRecords = getRecords().filter((record) => {
      const recordDate = new Date(`${record.date}T00:00:00`);
      return !Number.isNaN(recordDate.getTime()) && recordDate < cutoff;
    });
    const count = oldRecords.length;

    if (confirm(`将清除 ${count} 条 90 天前的记录，确认吗？`)) {
      cleanOldRecords();
      showToast(`已清除 ${count} 条旧记录`);
      refreshRecordViews();
    }
  });

  DOM.clearAllData.addEventListener('click', () => {
    openClearAllDataModal();
  });

  document.getElementById('settings-project-add')?.addEventListener('click', () => {
    openProjectEditModal(null);
  });

  document.getElementById('settings-auto-weekly-toggle')?.addEventListener('click', () => {
    const next = !getSettings().autoWeeklySummary;
    saveSettings({ autoWeeklySummary: next });
    renderCoachSettings();
    showToast(next ? '已开启自动周总结' : '已关闭自动周总结');
  });

  document.querySelectorAll('#settings-weekday-options .weekday-option').forEach((button) => {
    button.addEventListener('click', () => {
      saveSettings({ weeklySummaryWeekday: Number(button.dataset.weekday) });
      renderCoachSettings();
    });
  });

  APP_STATE.settingsEventsBound = true;
}

// 取得（并在需要时创建）一个复用的 AudioContext。
// iOS 只允许在用户手势中解锁音频，故 unlockAudio 必须在点击等手势里调用。
function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!_audioCtx) {
    try {
      _audioCtx = new AudioContextClass();
    } catch (error) {
      _audioCtx = null;
    }
  }

  return _audioCtx;
}

// 在用户手势里解锁音频：resume + 播放一个极短静音，之后 playBeep 才能在 iOS 前台出声
function unlockAudio() {
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (error) {
    // ignore
  }
}

function playBeep() {
  try {
    const audioContext = getAudioContext();

    if (!audioContext) {
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    // 三声递进「叮」，更响更持久，避免被忽略
    const base = audioContext.currentTime;
    [880, 1046, 1318].forEach((freq, index) => {
      const start = base + index * 0.22;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, start);
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
  } catch (error) {
    // ignore beep failures to avoid blocking the evaluation flow
  }
}

// 生成一段极短静音 WAV，用于番茄进行期间循环播放，
// 防止浏览器把后台标签页的定时器/音频冻结，从而保证「到点」能立即响铃提醒。
function getSilentAudioUrl() {
  if (_keepAliveAudioUrl) {
    return _keepAliveAudioUrl;
  }

  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 秒
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  // 采样数据全为 0，即静音

  _keepAliveAudioUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  return _keepAliveAudioUrl;
}

function startKeepAlive() {
  // 移动端（iOS/Android）上保活音频无实际防冻结作用，反而会抢占系统音频会话导致
  // 其他 App 的播客/音乐被暂停。移动端直接跳过。
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')) {
    return;
  }

  try {
    if (!_keepAliveAudio) {
      _keepAliveAudio = new Audio(getSilentAudioUrl());
      _keepAliveAudio.loop = true;
    }

    _keepAliveAudio.play().catch(() => {});
  } catch (error) {
    // ignore：保活失败仅影响后台提醒时效，不阻塞计时
  }
}

function stopKeepAlive() {
  if (_keepAliveAudio) {
    _keepAliveAudio.pause();
  }
}

// 屏幕常亮：番茄进行时保持不锁屏、应用在前台，让到点提醒能可靠出声（尤其 iPhone）
function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    return;
  }

  navigator.wakeLock.request('screen')
    .then((lock) => {
      _wakeLock = lock;
      lock.addEventListener('release', () => {
        _wakeLock = null;
      });
    })
    .catch(() => {
      // 用户拒绝或不支持时静默失败，不影响计时
    });
}

function releaseWakeLock() {
  if (_wakeLock) {
    _wakeLock.release().catch(() => {});
    _wakeLock = null;
  }
}

// 用绝对截止时间安排一次精确的到点触发，作为 500ms 轮询的兜底，
// 配合静音保活音频，即使标签页在后台也能在到点瞬间响铃。
function scheduleTimerEnd() {
  clearTimerEndTimeout();

  if (!APP_STATE.sessionEndEpoch) {
    return;
  }

  const delay = Math.max(0, APP_STATE.sessionEndEpoch - Date.now());
  APP_STATE.endTimeoutId = window.setTimeout(() => {
    APP_STATE.endTimeoutId = null;

    if (APP_STATE.timerState === TIMER_STATES.RUNNING) {
      beginEvaluationFlow();
    } else if (APP_STATE.timerState === TIMER_STATES.BREAK) {
      endBreak();
    }
  }, delay);
}

function clearTimerEndTimeout() {
  if (APP_STATE.endTimeoutId) {
    clearTimeout(APP_STATE.endTimeoutId);
    APP_STATE.endTimeoutId = null;
  }
}

function startAlarm() {
  stopAlarm();

  let count = 0;
  APP_STATE.alarmInterval = window.setInterval(() => {
    playBeep();
    count += 1;

    if (count >= 8) {
      stopAlarm();
    }
  }, 2000);

  playBeep();
}

function stopAlarm() {
  if (APP_STATE.alarmInterval) {
    clearInterval(APP_STATE.alarmInterval);
    APP_STATE.alarmInterval = null;
  }
}

function resetTimerState(options = {}) {
  const shouldCloseModal = options.closeModal !== false;

  clearTimerInterval();
  clearTimerEndTimeout();
  stopKeepAlive();
  releaseWakeLock();
  stopAlarm();

  if (shouldCloseModal) {
    closeActiveModal();
  }

  document.getElementById('alarm-overlay')?.remove();

  if (DOM.calendarReminderArea) {
    DOM.calendarReminderArea.hidden = true; // 只针对 resetTimerState
  }

  APP_STATE.timerState = TIMER_STATES.IDLE;
  APP_STATE.breakType = null;
  APP_STATE.pendingAlarm = false;
  APP_STATE.sessionEndEpoch = 0;
  APP_STATE.sessionGoal = '';
  APP_STATE.sessionStartTime = '';
  APP_STATE.sessionDate = today();
  APP_STATE.sessionDurationMinutes = getTimerDurationMinutes();
  APP_STATE.remainingSeconds = APP_STATE.sessionDurationMinutes * 60;

  updateTimerUI();

  // 计时结束后，若有待处理的 SW 更新通知，此时再提示
  if (APP_STATE.pendingSwUpdate) {
    window.setTimeout(promptSwUpdate, 800);
  }
}

function openRecordFormModal(options) {
  const {
    title,
    submitText,
    initialData = {},
    includeGoalField = false,
    includeTimingFields = false,
    reminderPracticeOptions = [],
    onSubmit
  } = options;

  const projects = getActiveProjects();
  const currentProjectId = initialData.projectId || APP_STATE.sessionProjectId || UNCATEGORIZED_PROJECT_ID;
  const projectOptionsHtml = projects.map((project) => {
    const selected = project.id === currentProjectId ? ' selected' : '';
    return `<option value="${escapeHtml(project.id)}"${selected}>${escapeHtml(project.icon || '')} ${escapeHtml(project.name)}</option>`;
  }).join('');
  const currentEnergy = Number(initialData.energy || 0);

  const modal = openModal(`
    <h2 class="modal__title">${title}</h2>
    <div class="modal__body">
      <form id="record-form">
        ${includeGoalField ? `
          <div class="field">
            <label class="field__label" for="record-goal">目标</label>
            <input id="record-goal" class="field__input" type="text" placeholder="写下这次番茄的目标">
          </div>
        ` : ''}
        <div class="field">
          <label class="field__label" for="record-project">项目</label>
          <select id="record-project" class="field__input">${projectOptionsHtml}</select>
        </div>
        <div class="field" id="record-goal-field">
          <label class="field__label" for="record-goal-id">目标（可选）</label>
          <select id="record-goal-id" class="field__input">
            <option value="">（不关联目标）</option>
            ${getActiveGoalsForProject(currentProjectId).map((goal) => {
              const progress = getGoalProgress(goal);
              const selected = goal.id === (initialData.goalId || '') ? ' selected' : '';
              return `<option value="${escapeHtml(goal.id)}"${selected}>${escapeHtml(goal.title)}（${progress.done}/${progress.target}）</option>`;
            }).join('')}
          </select>
        </div>
        ${includeTimingFields ? `
          <div class="field">
            <label class="field__label" for="record-date">日期</label>
            <input id="record-date" class="field__input" type="date">
          </div>
          <div class="field">
            <label class="field__label" for="record-start-time">开始时间</label>
            <input id="record-start-time" class="field__input" type="time">
          </div>
          <div class="field">
            <label class="field__label" for="record-end-time">结束时间</label>
            <input id="record-end-time" class="field__input" type="time">
          </div>
        ` : ''}
        <div class="achievement-field">
          <div class="achievement-field__label">目标达成</div>
          <div class="achievement-options">
            ${ACHIEVEMENT_OPTIONS.map((option) => {
              return `<button class="achievement-option" type="button" data-value="${option.value}">${option.label}</button>`;
            }).join('')}
          </div>
        </div>
        <div class="rating-field">
          <div class="rating-field__label">产出质量</div>
          <div class="star-rating">
            ${[1, 2, 3, 4, 5].map((value) => {
              return `<button class="star-rating__star" type="button" data-value="${value}" aria-label="${value} 星">★</button>`;
            }).join('')}
          </div>
        </div>
        <div class="energy-field">
          <div class="energy-field__label">精力状态<span class="field__optional">（可选）</span></div>
          <div class="energy-options">
            ${ENERGY_OPTIONS.map((option) => {
              return `<button class="energy-option" type="button" data-value="${option.value}">${option.label}</button>`;
            }).join('')}
          </div>
        </div>
        <div class="field">
          <label class="field__label" for="record-summary">一句话总结</label>
          <textarea id="record-summary" class="field__textarea" placeholder="记录下你的产出或感受"></textarea>
        </div>
        <div class="field">
          <label class="field__checkbox" for="record-interrupted">
            <input id="record-interrupted" type="checkbox">
            <span>是否被打断</span>
          </label>
        </div>
        <div id="record-interruption-note-field" class="field" hidden>
          <label class="field__label" for="record-interruption-note">打断备注</label>
          <input id="record-interruption-note" class="field__note" type="text" placeholder="写下打断发生了什么">
        </div>
        ${reminderPracticeOptions.length ? `
          <div class="field">
            <span class="field__label">本次践行了哪条建议？</span>
            <div class="checkbox-list">
              ${reminderPracticeOptions.map((reminder, index) => {
                const inputId = `record-practiced-reminder-${index}`;
                return `
                  <label class="checkbox-list__item" for="${inputId}">
                    <input
                      id="${inputId}"
                      type="checkbox"
                      value="${reminder.id}"
                      data-practiced-reminder
                    >
                    <span>${escapeHtml(reminder.content)}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
        <div id="record-form-error" class="modal__error" hidden></div>
        <div class="modal__actions">
          <button id="record-cancel-btn" class="btn btn--ghost" type="button">取消</button>
          <button class="btn btn--primary" type="submit">${submitText}</button>
        </div>
      </form>
    </div>
  `);

  const form = modal.querySelector('#record-form');
  const error = modal.querySelector('#record-form-error');
  const goalInput = modal.querySelector('#record-goal');
  const projectSelect = modal.querySelector('#record-project');
  const goalIdSelect = modal.querySelector('#record-goal-id');
  const dateInput = modal.querySelector('#record-date');
  const startTimeInput = modal.querySelector('#record-start-time');
  const endTimeInput = modal.querySelector('#record-end-time');
  const summaryInput = modal.querySelector('#record-summary');
  const interruptedInput = modal.querySelector('#record-interrupted');
  const interruptionNoteField = modal.querySelector('#record-interruption-note-field');
  const interruptionNoteInput = modal.querySelector('#record-interruption-note');
  const practicedReminderInputs = Array.from(modal.querySelectorAll('[data-practiced-reminder]'));
  const achievementButtons = Array.from(modal.querySelectorAll('.achievement-option'));
  const starButtons = Array.from(modal.querySelectorAll('.star-rating__star'));
  const energyButtons = Array.from(modal.querySelectorAll('.energy-option'));
  const cancelButton = modal.querySelector('#record-cancel-btn');
  let selectedAchievement = initialData.achievement || '';
  let selectedQuality = Number(initialData.quality || 0);
  let selectedEnergy = currentEnergy;

  function syncAchievementButtons() {
    achievementButtons.forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.value === selectedAchievement);
    });
  }

  function syncStarButtons() {
    starButtons.forEach((button) => {
      const starValue = Number(button.dataset.value || '0');
      button.classList.toggle('is-active', starValue <= selectedQuality);
    });
  }

  function syncEnergyButtons() {
    energyButtons.forEach((button) => {
      button.classList.toggle('is-selected', Number(button.dataset.value || '0') === selectedEnergy);
    });
  }

  if (goalInput) {
    goalInput.value = initialData.goal || '';
  }

  if (dateInput) {
    dateInput.value = initialData.date || APP_STATE.historySelectedDate || today();
  }

  if (startTimeInput) {
    startTimeInput.value = initialData.startTime || '09:00';
  }

  if (endTimeInput) {
    endTimeInput.value = initialData.endTime || formatMinutesOfDay(parseTimeToMinutes('09:00') + getTimerDurationMinutes());
  }

  summaryInput.value = initialData.summary || '';
  interruptedInput.checked = Boolean(initialData.interrupted);
  interruptionNoteField.hidden = !interruptedInput.checked;
  interruptionNoteInput.value = initialData.interruptionNote || '';
  syncAchievementButtons();
  syncStarButtons();
  syncEnergyButtons();

  cancelButton.addEventListener('click', () => {
    closeActiveModal();
  });

  // 项目切换时重新渲染目标下拉
  if (projectSelect && goalIdSelect) {
    projectSelect.addEventListener('change', () => {
      const goals = getActiveGoalsForProject(projectSelect.value);
      const prevValue = goalIdSelect.value;
      goalIdSelect.replaceChildren();
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '（不关联目标）';
      goalIdSelect.appendChild(defaultOption);
      goals.forEach((goal) => {
        const progress = getGoalProgress(goal);
        const option = document.createElement('option');
        option.value = goal.id;
        option.textContent = `${goal.title}（${progress.done}/${progress.target}）`;
        if (goal.id === prevValue) option.selected = true;
        goalIdSelect.appendChild(option);
      });
    });
  }

  achievementButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedAchievement = button.dataset.value || '';
      syncAchievementButtons();
      error.hidden = true;
    });
  });

  starButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedQuality = Number(button.dataset.value || '0');
      syncStarButtons();
      error.hidden = true;
    });
  });

  energyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.value || '0');
      selectedEnergy = selectedEnergy === value ? 0 : value; // 再次点击可取消
      syncEnergyButtons();
    });
  });

  interruptedInput.addEventListener('change', () => {
    interruptionNoteField.hidden = !interruptedInput.checked;

    if (!interruptedInput.checked) {
      interruptionNoteInput.value = '';
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const summary = summaryInput.value.trim();
    const goal = goalInput ? goalInput.value.trim() : initialData.goal || APP_STATE.sessionGoal;
    let date = initialData.date || APP_STATE.sessionDate;
    let startTime = initialData.startTime || APP_STATE.sessionStartTime;
    let endTime = initialData.endTime || formatTime(new Date());
    let duration = Number(initialData.duration || APP_STATE.sessionDurationMinutes || 0);

    if (goalInput && !goal) {
      error.textContent = '请填写目标。';
      error.hidden = false;
      return;
    }

    if (dateInput && startTimeInput && endTimeInput) {
      date = dateInput.value;
      startTime = startTimeInput.value;
      endTime = endTimeInput.value;

      if (!date || !startTime || !endTime) {
        error.textContent = '请完整填写日期和时间。';
        error.hidden = false;
        return;
      }

      if (date > today()) {
        error.textContent = '不能补录未来日期。';
        error.hidden = false;
        return;
      }

      duration = getDurationMinutes(startTime, endTime);

      if (!duration) {
        error.textContent = '结束时间需要晚于开始时间。';
        error.hidden = false;
        return;
      }
    }

    if (!selectedAchievement) {
      error.textContent = '请选择目标达成情况。';
      error.hidden = false;
      return;
    }

    if (!selectedQuality) {
      error.textContent = '请选择产出质量评分。';
      error.hidden = false;
      return;
    }

    if (!summary) {
      error.textContent = '请填写一句话总结。';
      error.hidden = false;
      return;
    }

    onSubmit({
      goal,
      date,
      startTime,
      endTime,
      duration,
      projectId: projectSelect ? projectSelect.value : (initialData.projectId || UNCATEGORIZED_PROJECT_ID),
      goalId: goalIdSelect ? goalIdSelect.value || '' : (initialData.goalId || ''),
      achievement: selectedAchievement,
      quality: selectedQuality,
      energy: selectedEnergy || null,
      summary,
      interrupted: interruptedInput.checked,
      interruptionNote: interruptedInput.checked ? interruptionNoteInput.value.trim() : '',
      practicedReminderIds: practicedReminderInputs
        .filter((input) => input.checked)
        .map((input) => input.value)
    });
  });

  const focusTarget = goalInput || dateInput || summaryInput;
  focusTarget.focus();
}

function openEvaluationModal() {
  stopAlarm();
  APP_STATE.pendingAlarm = false;
  document.getElementById('alarm-overlay')?.remove();

  if (getSettings().quickEvaluate) {
    openQuickEvaluationModal();
    return;
  }

  const activeReminders = getActiveReminders();

  openRecordFormModal({
    title: '这个番茄怎么样？',
    submitText: '完成番茄 🍅',
    reminderPracticeOptions: activeReminders,
    onSubmit: (formData) => {
      completeSessionEvaluation(formData);
    }
  });
}

function completeSessionEvaluation(formData) {
  const shouldOfferBreak = APP_STATE.timerState === TIMER_STATES.EVALUATING;
  const endDate = new Date();

  addRecord({
    id: generateId(),
    date: APP_STATE.sessionDate,
    startTime: APP_STATE.sessionStartTime,
    endTime: formatTime(endDate),
    duration: APP_STATE.sessionDurationMinutes,
    goal: APP_STATE.sessionGoal,
    projectId: formData.projectId || APP_STATE.sessionProjectId || UNCATEGORIZED_PROJECT_ID,
    goalId: formData.goalId || '',
    achievement: formData.achievement,
    quality: formData.quality,
    energy: formData.energy || null,
    summary: formData.summary,
    interrupted: formData.interrupted,
    interruptionNote: formData.interruptionNote,
    createdAt: endDate.toISOString()
  });

  Array.from(new Set(formData.practicedReminderIds || [])).forEach((reminderId) => {
    markReminderImproved(reminderId);
  });

  closeActiveModal();
  refreshRecordViews();
  checkAndAwardAchievements();
  refreshReminderViews();

  if (shouldOfferBreak) {
    openBreakSelectionModal();
    return;
  }

  resetTimerState({ closeModal: false });
}

function openQuickEvaluationModal() {
  const activeReminders = getActiveReminders();
  const projectId = APP_STATE.sessionProjectId || UNCATEGORIZED_PROJECT_ID;
  const projectGoals = getActiveGoalsForProject(projectId);
  const goalOptions = projectGoals.length
    ? projectGoals.map((goal) => {
        const progress = getGoalProgress(goal);
        return `<option value="${escapeHtml(goal.id)}">${escapeHtml(goal.title)}（${progress.done}/${progress.target}）</option>`;
      }).join('')
    : '';

  const modal = openModal(`
    <h2 class="modal__title">这个番茄怎么样？</h2>
    <div class="modal__body">
      <form id="quick-eval-form">
        <div class="rating-field">
          <div class="rating-field__label">产出质量</div>
          <div class="star-rating">
            ${[1, 2, 3, 4, 5].map((value) => {
              return `<button class="star-rating__star" type="button" data-value="${value}" aria-label="${value} 星">★</button>`;
            }).join('')}
          </div>
        </div>
        ${goalOptions ? `
        <div class="field">
          <label class="field__label" for="quick-eval-goal-id">目标（可选）</label>
          <select id="quick-eval-goal-id" class="field__input">
            <option value="">（不关联目标）</option>
            ${goalOptions}
          </select>
        </div>
        ` : ''}
        <div class="field">
          <label class="field__label" for="quick-eval-summary">一句话总结</label>
          <textarea id="quick-eval-summary" class="field__textarea" placeholder="记录下你的产出或感受"></textarea>
        </div>
        ${activeReminders.length ? `
          <div class="field">
            <span class="field__label">本次践行了哪条建议？</span>
            <div class="checkbox-list">
              ${activeReminders.map((reminder, index) => {
                const inputId = `quick-practiced-reminder-${index}`;
                return `
                  <label class="checkbox-list__item" for="${inputId}">
                    <input id="${inputId}" type="checkbox" value="${reminder.id}" data-practiced-reminder>
                    <span>${escapeHtml(reminder.content)}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
        <div id="quick-eval-error" class="modal__error" hidden></div>
        <div class="modal__actions">
          <button id="quick-eval-cancel" class="btn btn--ghost" type="button">取消</button>
          <button class="btn btn--primary" type="submit">完成番茄 🍅</button>
        </div>
      </form>
    </div>
  `);

  const form = modal.querySelector('#quick-eval-form');
  const error = modal.querySelector('#quick-eval-error');
  const summaryInput = modal.querySelector('#quick-eval-summary');
  const starButtons = Array.from(modal.querySelectorAll('.star-rating__star'));
  const practicedReminderInputs = Array.from(modal.querySelectorAll('[data-practiced-reminder]'));
  let selectedQuality = 0;

  function syncStarButtons() {
    starButtons.forEach((button) => {
      const starValue = Number(button.dataset.value || '0');
      button.classList.toggle('is-active', starValue <= selectedQuality);
    });
  }

  modal.querySelector('#quick-eval-cancel')?.addEventListener('click', () => {
    closeActiveModal();
  });

  starButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedQuality = Number(button.dataset.value || '0');
      syncStarButtons();
      error.hidden = true;
    });
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const summary = summaryInput.value.trim();

    if (!selectedQuality) {
      error.textContent = '请选择产出质量评分。';
      error.hidden = false;
      return;
    }

    if (!summary) {
      error.textContent = '请填写一句话总结。';
      error.hidden = false;
      return;
    }

    completeSessionEvaluation({
      goalId: modal.querySelector('#quick-eval-goal-id')?.value || '',
      achievement: 'full',
      quality: selectedQuality,
      summary,
      interrupted: false,
      interruptionNote: '',
      practicedReminderIds: practicedReminderInputs
        .filter((input) => input.checked)
        .map((input) => input.value)
    });
  });

  summaryInput.focus();
}

function openEditRecordModal(record) {
  openRecordFormModal({
    title: '编辑记录',
    submitText: '保存修改',
    initialData: record,
    onSubmit: (formData) => {
      updateRecord(record.id, {
        projectId: formData.projectId,
        goalId: formData.goalId || '',
        achievement: formData.achievement,
        quality: formData.quality,
        energy: formData.energy || null,
        summary: formData.summary,
        interrupted: formData.interrupted,
        interruptionNote: formData.interruptionNote
      });

      closeActiveModal();
      refreshRecordViews();
    }
  });
}

function openAddRecordModal() {
  openRecordFormModal({
    title: '补录番茄',
    submitText: '保存补录',
    includeGoalField: true,
    includeTimingFields: true,
    initialData: {
      date: APP_STATE.historySelectedDate,
      startTime: '09:00',
      endTime: formatMinutesOfDay(parseTimeToMinutes('09:00') + getTimerDurationMinutes())
    },
    onSubmit: (formData) => {
      addRecord({
        id: generateId(),
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        duration: formData.duration,
        goal: formData.goal,
        projectId: formData.projectId || UNCATEGORIZED_PROJECT_ID,
        goalId: formData.goalId || '',
        achievement: formData.achievement,
        quality: formData.quality,
        energy: formData.energy || null,
        summary: formData.summary,
        interrupted: formData.interrupted,
        interruptionNote: formData.interruptionNote,
        createdAt: new Date().toISOString()
      });

      syncHistoryViewToDate(formData.date);
      closeActiveModal();
      refreshRecordViews();
    }
  });
}

function beginEvaluationFlow() {
  clearTimerInterval();
  clearTimerEndTimeout();
  stopKeepAlive();
  releaseWakeLock();

  if (DOM.calendarReminderArea) {
    DOM.calendarReminderArea.hidden = true;
  }

  APP_STATE.timerState = TIMER_STATES.EVALUATING;
  APP_STATE.remainingSeconds = 0;
  APP_STATE.pendingAlarm = true;
  updateTimerUI();
  startAlarm();

  // 锁屏通知 + 震动
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification('🍅 番茄时钟结束！', {
        body: APP_STATE.sessionGoal ? `目标：${APP_STATE.sessionGoal}` : '去记录这个番茄吧',
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: 'pomodoro-end',
        renotify: true,
        requireInteraction: true,
      });
    }).catch(() => {});
  }

  if (document.visibilityState === 'visible') {
    showAlarmOverlay();
  }
}

function showAlarmOverlay() {
  if (document.getElementById('alarm-overlay')) {
    return;
  }

  if (!APP_STATE.alarmInterval) {
    startAlarm();
  }

  const overlay = document.createElement('div');
  overlay.id = 'alarm-overlay';
  overlay.innerHTML = `
    <div class="alarm-overlay__inner">
      <div class="alarm-overlay__emoji">🍅</div>
      <div class="alarm-overlay__title">番茄完成！</div>
      <div class="alarm-overlay__goal">${escapeHtml(APP_STATE.sessionGoal || '')}</div>
      <button class="btn btn--primary alarm-overlay__btn" id="alarm-dismiss-btn" type="button">好的，去评价</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#alarm-dismiss-btn')?.addEventListener('click', () => {
    overlay.remove();
    openEvaluationModal();
  });
}

function openBreakSelectionModal() {
  const settings = getSettings();
  const shortMin = settings.shortBreak || 5;
  const longMin = settings.longBreak || 15;
  const modal = openModal(`
    <h2 class="modal__title">🎉 番茄完成！选择休息方式</h2>
    <div class="modal__body">
      <div class="break-options">
        <button class="btn btn--primary break-option-btn" type="button" data-type="short">☕ 短休息 ${shortMin} 分钟</button>
        <button class="btn btn--primary break-option-btn" type="button" data-type="long">🛌 长休息 ${longMin} 分钟</button>
        <button class="btn btn--ghost" id="break-skip-btn" type="button">跳过休息</button>
      </div>
    </div>
  `);

  modal.querySelectorAll('.break-option-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.type;
      closeActiveModal();
      startBreakCountdown(type);
    });
  });

  modal.querySelector('#break-skip-btn')?.addEventListener('click', () => {
    closeActiveModal();
    resetTimerState({ closeModal: false });
  });
}

function startBreakCountdown(type) {
  const settings = getSettings();
  const minutes = type === 'long' ? (settings.longBreak || 15) : (settings.shortBreak || 5);

  APP_STATE.timerState = TIMER_STATES.BREAK;
  APP_STATE.breakType = type;
  APP_STATE.remainingSeconds = minutes * 60;
  APP_STATE.sessionEndEpoch = Date.now() + minutes * 60 * 1000;
  updateTimerUI();

  clearTimerInterval();
  APP_STATE.intervalId = window.setInterval(() => {
    if (APP_STATE.timerState !== TIMER_STATES.BREAK) return;

    const remaining = Math.ceil((APP_STATE.sessionEndEpoch - Date.now()) / 1000);
    APP_STATE.remainingSeconds = Math.max(0, remaining);

    if (APP_STATE.remainingSeconds <= 0) {
      endBreak();
      return;
    }

    updateTimerUI();
  }, 500);

  unlockAudio();
  startKeepAlive();
  requestWakeLock();
  scheduleTimerEnd();
}

function endBreak() {
  clearTimerInterval();
  clearTimerEndTimeout();
  stopKeepAlive();
  releaseWakeLock();
  playBeep();

  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }

  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification('⏰ 休息结束，准备下一个番茄！', {
        body: '点击回到计时器',
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: 'break-end',
        renotify: true
      });
    }).catch(() => {});
  }

  resetTimerState();
  showToast('☕ 休息结束，开始下一个番茄吧！');
}

function startCountdown() {
  clearTimerInterval();

  APP_STATE.intervalId = window.setInterval(() => {
    if (APP_STATE.timerState !== TIMER_STATES.RUNNING) return;

    // 从绝对截止时间计算剩余秒数，而非递减，避免后台节流导致误差
    const remaining = Math.ceil((APP_STATE.sessionEndEpoch - Date.now()) / 1000);
    APP_STATE.remainingSeconds = Math.max(0, remaining);

    if (APP_STATE.remainingSeconds <= 0) {
      beginEvaluationFlow();
      return;
    }

    updateTimerUI();
  }, 500); // 500ms 轮询，让误差不超过 0.5 秒
}

function startPomodoro(goal, projectId) {
  const startDate = new Date();

  APP_STATE.sessionGoal = goal;
  APP_STATE.sessionProjectId = projectId || UNCATEGORIZED_PROJECT_ID;
  APP_STATE.sessionStartTime = formatTime(startDate);
  APP_STATE.sessionDate = today();
  APP_STATE.sessionDurationMinutes = getTimerDurationMinutes();
  APP_STATE.remainingSeconds = APP_STATE.sessionDurationMinutes * 60;
  APP_STATE.sessionEndEpoch = Date.now() + APP_STATE.sessionDurationMinutes * 60 * 1000;
  APP_STATE.timerState = TIMER_STATES.RUNNING;

  closeActiveModal();
  updateTimerUI();
  startCountdown();
  unlockAudio();
  startKeepAlive();
  requestWakeLock();
  scheduleTimerEnd();
}

function showGoalModal() {
  const projects = getActiveProjects();
  const lastProjectId = APP_STATE.sessionProjectId || UNCATEGORIZED_PROJECT_ID;
  const projectOptions = projects.map((project) => {
    const selected = project.id === lastProjectId ? ' selected' : '';
    return `<option value="${escapeHtml(project.id)}"${selected}>${escapeHtml(project.icon || '')} ${escapeHtml(project.name)}</option>`;
  }).join('');

  const modal = openModal(`
    <h2 class="modal__title">这个番茄我要产出什么？</h2>
    <div class="modal__body">
      <form id="goal-form">
        <div class="field">
          <label class="field__label" for="goal-project">项目</label>
          <select id="goal-project" class="field__input">${projectOptions}</select>
        </div>
        <div class="field">
          <label class="field__label" for="goal-input">目标</label>
          <input id="goal-input" class="field__input" type="text" placeholder="例如：写完需求评审纪要" required>
        </div>
        <div id="goal-form-error" class="modal__error" hidden></div>
        <div class="modal__actions">
          <button id="goal-cancel-btn" class="btn btn--ghost" type="button">取消</button>
          <button class="btn btn--primary" type="submit">确认</button>
        </div>
      </form>
    </div>
  `);

  const form = modal.querySelector('#goal-form');
  const input = modal.querySelector('#goal-input');
  const projectSelect = modal.querySelector('#goal-project');
  const error = modal.querySelector('#goal-form-error');
  const cancelButton = modal.querySelector('#goal-cancel-btn');

  cancelButton.addEventListener('click', () => {
    closeActiveModal();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const goal = input.value.trim();

    if (!goal) {
      error.textContent = '请先写下这个番茄的目标。';
      error.hidden = false;
      input.focus();
      return;
    }

    startPomodoro(goal, projectSelect ? projectSelect.value : UNCATEGORIZED_PROJECT_ID);
  });

  input.focus();
}

function handlePauseToggle() {
  if (APP_STATE.timerState === TIMER_STATES.RUNNING) {
    clearTimerInterval();
    clearTimerEndTimeout();
    stopKeepAlive();
    releaseWakeLock();
    APP_STATE.sessionEndEpoch = 0; // 暂停期间 epoch 清零，remainingSeconds 是唯一时间源
    APP_STATE.timerState = TIMER_STATES.PAUSED;
    updateTimerUI();
    return;
  }

  if (APP_STATE.timerState === TIMER_STATES.PAUSED) {
    APP_STATE.timerState = TIMER_STATES.RUNNING;
    // 从当前剩余秒数重新锚定绝对截止时间
    APP_STATE.sessionEndEpoch = Date.now() + APP_STATE.remainingSeconds * 1000;
    updateTimerUI();
    startCountdown();
  unlockAudio();
  startKeepAlive();
  requestWakeLock();
  scheduleTimerEnd();

  if (DOM.calendarReminderArea) {
    DOM.calendarReminderArea.hidden = false;
  }
}
}

function handleStopTimer() {
  if (![TIMER_STATES.RUNNING, TIMER_STATES.PAUSED, TIMER_STATES.BREAK].includes(APP_STATE.timerState)) {
    return;
  }

  const confirmText = APP_STATE.timerState === TIMER_STATES.BREAK ? '确定结束当前休息吗？' : '确定停止当前番茄吗？';

  if (confirm(confirmText)) {
    resetTimerState();
  }
}

function bindTimerEvents() {
  if (APP_STATE.timerEventsBound || !DOM.startTimerBtn || !DOM.pauseTimerBtn || !DOM.stopTimerBtn) {
    return;
  }

  DOM.startTimerBtn.addEventListener('click', showGoalModal);
  DOM.pauseTimerBtn.addEventListener('click', handlePauseToggle);
  DOM.stopTimerBtn.addEventListener('click', handleStopTimer);

  if (DOM.calendarReminderBtn) {
    DOM.calendarReminderBtn.addEventListener('click', triggerCalendarReminder);
  }

  document.getElementById('goals-add-btn')?.addEventListener('click', () => {
    openGoalEditModal(null);
  });

  APP_STATE.timerEventsBound = true;
}

function renderHistoryCalendar() {
  if (!DOM.historyCalendar || !DOM.historyTitle || !DOM.historyNextMonth) {
    return;
  }

  const { year, month } = parseDateString(APP_STATE.historySelectedDate);

  if (year !== APP_STATE.historyViewYear || month !== APP_STATE.historyViewMonth + 1) {
    APP_STATE.historySelectedDate = toDateString(APP_STATE.historyViewYear, APP_STATE.historyViewMonth, 1);
  }

  DOM.historyTitle.textContent = getMonthLabel(APP_STATE.historyViewYear, APP_STATE.historyViewMonth);

  const nextMonthDate = new Date(APP_STATE.historyViewYear, APP_STATE.historyViewMonth + 1, 1);
  DOM.historyNextMonth.disabled = isFutureMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth());

  const counts = {};
  getRecords().forEach((record) => {
    const parts = parseDateString(record.date);

    if (parts.year === APP_STATE.historyViewYear && parts.month === APP_STATE.historyViewMonth + 1) {
      counts[record.date] = (counts[record.date] || 0) + 1;
    }
  });

  DOM.historyCalendar.replaceChildren();

  const firstDay = new Date(APP_STATE.historyViewYear, APP_STATE.historyViewMonth, 1).getDay();
  const totalDays = getDaysInMonth(APP_STATE.historyViewYear, APP_STATE.historyViewMonth);

  for (let index = 0; index < firstDay; index += 1) {
    const placeholder = document.createElement('div');
    placeholder.className = 'calendar-day--empty';
    DOM.historyCalendar.appendChild(placeholder);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateStr = toDateString(APP_STATE.historyViewYear, APP_STATE.historyViewMonth, day);
    const button = document.createElement('button');
    button.className = 'calendar-day';
    button.type = 'button';
    button.dataset.date = dateStr;

    if (dateStr === today()) {
      button.classList.add('is-today');
    }

    if (dateStr === APP_STATE.historySelectedDate) {
      button.classList.add('is-selected');
    }

    const content = document.createElement('div');
    content.className = 'calendar-day__content';

    const number = document.createElement('div');
    number.className = 'calendar-day__number';
    number.textContent = String(day);
    content.appendChild(number);

    if (counts[dateStr]) {
      const markers = document.createElement('div');
      markers.className = 'calendar-day__markers';

      const dot = document.createElement('span');
      dot.className = 'calendar-day__dot';

      const count = document.createElement('span');
      count.className = 'calendar-day__count';
      count.textContent = String(counts[dateStr]);

      markers.append(dot, count);
      content.appendChild(markers);
    }

    button.appendChild(content);
    DOM.historyCalendar.appendChild(button);
  }
}

function renderHistoryDetail() {
  if (!DOM.historyDetail || !DOM.historyDetailTitle || !DOM.historyRecords) {
    return;
  }

  const records = sortRecordsByStartTimeDesc(getRecordsByDate(APP_STATE.historySelectedDate));
  DOM.historyDetail.classList.remove('is-animating');
  void DOM.historyDetail.offsetWidth;
  DOM.historyDetail.classList.add('is-animating');
  DOM.historyDetailTitle.textContent = `${formatDateCN(APP_STATE.historySelectedDate)} 的番茄（${records.length} 个）`;
  renderRecordsList(DOM.historyRecords, records, {
    emptyText: '这一天还没有番茄记录。',
    showActions: true
  });
}

function renderHistoryView() {
  if (!DOM.historyCalendar) {
    return;
  }

  renderHistoryCalendar();
  renderHistoryDetail();
}

function changeHistoryMonth(offset) {
  const preferredDay = parseDateString(APP_STATE.historySelectedDate).day || 1;
  const nextMonthDate = new Date(APP_STATE.historyViewYear, APP_STATE.historyViewMonth + offset, 1);

  if (offset > 0 && isFutureMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth())) {
    return;
  }

  setHistoryMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), preferredDay);
  renderHistoryView();
}

function bindHistoryEvents() {
  if (
    APP_STATE.historyEventsBound
    || !DOM.historyPrevMonth
    || !DOM.historyNextMonth
    || !DOM.historyCalendar
    || !DOM.historyAddRecord
    || !DOM.historyRecords
  ) {
    return;
  }

  DOM.historyPrevMonth.addEventListener('click', () => {
    changeHistoryMonth(-1);
  });

  DOM.historyNextMonth.addEventListener('click', () => {
    changeHistoryMonth(1);
  });

  DOM.historyCalendar.addEventListener('click', (event) => {
    const button = event.target.closest('.calendar-day');

    if (!button || !button.dataset.date) {
      return;
    }

    APP_STATE.historySelectedDate = button.dataset.date;
    renderHistoryView();
  });

  DOM.historyAddRecord.addEventListener('click', () => {
    openAddRecordModal();
  });

  DOM.historyRecords.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');

    if (!actionButton) {
      return;
    }

    const { action, id } = actionButton.dataset;
    const record = getRecords().find((item) => item.id === id);

    if (!record) {
      return;
    }

    if (action === 'edit') {
      openEditRecordModal(record);
      return;
    }

    if (action === 'delete' && confirm('确定删除这条记录吗？')) {
      deleteRecord(id);
      refreshRecordViews();
    }
  });

  APP_STATE.historyEventsBound = true;
}

function handleReminderAction(action, reminderId) {
  if (action === 'view-all') {
    showPage('page-coach');
    document.getElementById('coach-pool-title')?.scrollIntoView({ block: 'start' });
    return;
  }

  if (!reminderId) {
    return;
  }

  if (action === 'improve') {
    markReminderImproved(reminderId);
    refreshReminderViews();
    return;
  }

  if (action === 'reactivate') {
    reactivateReminder(reminderId);
    refreshReminderViews();
    return;
  }

  if (action === 'defer' || action === 'ignore') {
    const isIgnore = action === 'ignore';
    promptReminderReason(isIgnore).then((reason) => {
      if (reason === null) {
        return; // 用户取消
      }

      if (isIgnore) {
        ignoreReminder(reminderId, reason);
      } else {
        deferReminder(reminderId, reason);
      }

      refreshReminderViews();
    });
  }
}

// 弹出原因输入框（可填可跳过）。返回 Promise：字符串=原因（可能为空），null=取消
function promptReminderReason(isIgnore) {
  return new Promise((resolve) => {
    const title = isIgnore ? '为什么觉得这条建议没用？' : '为什么暂时搁置这条建议？';
    const hint = isIgnore
      ? '写下原因，教练以后会避免再提这类无效建议（可跳过）。'
      : '写下原因，教练以后会据此调整时机或方式（可跳过）。';

    const modal = openModal(`
      <h2 class="modal__title">${title}</h2>
      <div class="modal__body">
        <p class="modal__hint">${hint}</p>
        <div class="field">
          <textarea id="reminder-reason-input" class="field__textarea" rows="3" placeholder="例如：这条对我不适用，我的卡点其实是……"></textarea>
        </div>
        <div class="modal__actions">
          <button id="reminder-reason-skip" class="btn btn--ghost" type="button">跳过</button>
          <button id="reminder-reason-confirm" class="btn btn--primary" type="button">确认</button>
        </div>
      </div>
    `);

    const input = modal.querySelector('#reminder-reason-input');
    let settled = false;

    const done = (value) => {
      if (settled) return;
      settled = true;
      closeActiveModal();
      resolve(value);
    };

    modal.querySelector('#reminder-reason-confirm')?.addEventListener('click', () => done(input ? input.value.trim() : ''));
    modal.querySelector('#reminder-reason-skip')?.addEventListener('click', () => done(''));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        done(null);
      }
    });

    window.setTimeout(() => input?.focus(), 100);
  });
}

function bindCoachEvents() {
  if (
    APP_STATE.coachEventsBound
    || !DOM.coachNagArea
    || !DOM.coachActiveReminders
    || !DOM.coachArchivedReminders
    || !DOM.generateDailySummaryBtn
    || !DOM.generateWeeklyReportBtn
    || !DOM.chatForm
    || !DOM.coachTabButtons.length
  ) {
    return;
  }

  const handleClick = (event) => {
    const actionButton = event.target.closest('[data-reminder-action]');

    if (!actionButton) {
      return;
    }

    handleReminderAction(actionButton.dataset.reminderAction, actionButton.dataset.id || '');
  };

  DOM.coachNagArea.addEventListener('click', handleClick);
  DOM.coachActiveReminders.addEventListener('click', handleClick);
  DOM.coachArchivedReminders.addEventListener('click', handleClick);
  DOM.coachTabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      clearCoachFeedback();
      switchCoachTab(button.dataset.coachTab || 'daily');
    });
  });
  DOM.generateDailySummaryBtn.addEventListener('click', handleGenerateDailySummary);
  DOM.generateWeeklyReportBtn.addEventListener('click', handleGenerateWeeklyReport);
  DOM.chatForm.addEventListener('submit', handleChatSubmit);

  if (DOM.dailySelfNoteSave) {
    DOM.dailySelfNoteSave.addEventListener('click', () => {
      const text = DOM.dailySelfNote ? DOM.dailySelfNote.value : '';
      setJournal(today(), text);
      showToast('✅ 自评已保存');
    });
  }

  APP_STATE.coachEventsBound = true;
}

function showPage(pageId) {
  const pages = document.querySelectorAll('.page');
  const tabs = document.querySelectorAll('.tabbar__item');

  pages.forEach((page) => {
    page.classList.toggle('active', page.id === pageId);
  });

  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.page === pageId);
  });

  if (pageId === 'page-history') {
    renderHistoryView();
    return;
  }

  if (pageId === 'page-coach') {
    renderCoachPage();
    return;
  }

  if (pageId === 'page-settings') {
    initSettingsPage();
    bindSettingsEvents();
    return;
  }

  if (pageId === 'page-timer') {
    renderNagArea();
    renderGoals();
  }
}

function bindTabbar() {
  const tabs = document.querySelectorAll('.tabbar__item');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      showPage(tab.dataset.page);
    });
  });
}

function cleanOldRecords() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 90);

  const filtered = getRecords().filter((record) => {
    const recordDate = new Date(`${record.date}T00:00:00`);
    return !Number.isNaN(recordDate.getTime()) && recordDate >= cutoff;
  });

  return saveRecords(filtered);
}

function handleSwUpdateNotice() {
  // 如果当前正在计时，不立刻打扰，标记为待处理，等 resetTimerState() 结束后触发
  if (APP_STATE.timerState !== TIMER_STATES.IDLE) {
    APP_STATE.pendingSwUpdate = true;
    return;
  }
  promptSwUpdate();
}

function promptSwUpdate() {
  APP_STATE.pendingSwUpdate = false;
  openModal(`
    <h2 class="modal__title">🎉 发现新版本</h2>
    <div class="modal__body">
      <p style="margin-bottom:16px;line-height:1.6;">番茄教练已更新，刷新后即可使用新版本。<br>你的所有数据不受影响。</p>
      <div class="modal__actions">
        <button id="sw-update-later" class="btn btn--ghost" type="button">稍后再说</button>
        <button id="sw-update-now" class="btn btn--primary" type="button">立即刷新</button>
      </div>
    </div>
  `);
  document.getElementById('sw-update-now').addEventListener('click', () => {
    window.location.reload();
  });
  document.getElementById('sw-update-later').addEventListener('click', () => {
    closeActiveModal();
  });
}

function initApp() {
  cleanOldRecords();
  cleanOldReports();
  ensureProjectMigration();
  loadChatHistoryFromStore();
  checkReminderDays();
  cacheTimerDom();
  syncHistoryViewToDate(today());
  initializeCoachDateInputs();
  bindTabbar();
  bindTimerEvents();
  bindHistoryEvents();
  bindCoachEvents();
  resetTimerState({ closeModal: false });
  refreshRecordViews();
  refreshReminderViews();
  renderCoachPage();
  showPage('page-timer');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});

    // 监听 SW 发来的更新通知
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        const versionEl = document.getElementById('settings-version-display');
        if (versionEl) {
          versionEl.textContent = `当前版本：${BUILD_DATE}（SW v${event.data.version}）`;
        }
        handleSwUpdateNotice();
      }
    });
  }

  // 页面从后台恢复时，重新校准剩余时间并检查是否已到期
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;

    if (APP_STATE.timerState === TIMER_STATES.RUNNING && APP_STATE.sessionEndEpoch) {
      const remaining = Math.ceil((APP_STATE.sessionEndEpoch - Date.now()) / 1000);
      APP_STATE.remainingSeconds = Math.max(0, remaining);

      if (APP_STATE.remainingSeconds <= 0) {
        beginEvaluationFlow();
      } else {
        updateTimerUI();
        // Wake Lock 在页面隐藏时会被系统释放，回到前台且仍在计时则重新申请
        if (!_wakeLock) {
          requestWakeLock();
        }
      }
    }

    if (APP_STATE.pendingAlarm) {
      showAlarmOverlay();
    }
  });

  // 请求通知权限，供番茄结束时发锁屏提醒
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

document.addEventListener('DOMContentLoaded', initApp);