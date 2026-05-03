/**
 * PomodoroRecord
 * id: 唯一标识
 * date: 记录日期，格式 YYYY-MM-DD
 * startTime: 开始时间，格式 HH:MM
 * endTime: 结束时间，格式 HH:MM
 * duration: 专注时长，单位分钟
 * goal: 本次番茄钟目标
 * achievement: 完成情况，full | partial | none
 * quality: 专注质量，范围 1-5
 * summary: 本次总结
 * interrupted: 是否被中断
 * interruptionNote: 中断说明
 * createdAt: 创建时间，ISO 字符串
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
  syncPwdHint: 'tc_sync_pwd_hint' // 仅存一个密码提示词，帮助用户回忆
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiBase: 'https://api.openai.com/v1',
  model: 'deepseek-v4-flash',
  coachTone: 'gentle',
  timerDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  quickEvaluate: false,
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
  const reports = getReports()
    .slice()
    .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
    .slice(0, 30);

  return saveReports(reports);
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
  EVALUATING: 'evaluating'
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
  remainingSeconds: DEFAULT_SETTINGS.timerDuration * 60,
  sessionGoal: '',
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
  pendingSwUpdate: false
};

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

  try {
    const password = await promptSyncPassword('sync');
    saveSettings({ syncPassword: password });
  } catch (error) {
    return false;
  }

  renderSyncStatus('syncing');

  const previousSyncState = _syncInProgress;
  _syncInProgress = true;

  try {
    const nowIso = new Date().toISOString();
    const localRecords = getRecords();
    const localReminders = getReminders();
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
        version: 1,
        lastModified: nowIso,
        records: localRecords,
        reminders: localReminders
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
    const addedRecordCount = Math.max(0, mergedRecords.length - localRecords.length);
    const addedReminderCount = Math.max(0, mergedReminders.length - localReminders.length);

    saveRecords(mergedRecords);
    saveReminders(mergedReminders);

    const encryptedPayload = await encryptData(JSON.stringify({
      version: 1,
      lastModified: nowIso,
      records: mergedRecords,
      reminders: mergedReminders
    }));

    await updateGistData(token, activeGistId, {
      encrypted: true,
      data: encryptedPayload
    });

    saveSettings({ gistId: activeGistId, lastSyncedAt: nowIso });
    refreshRecordViews();
    refreshReminderViews();
    showToast(`✅ 同步完成：新增 ${addedRecordCount} 条记录，${addedReminderCount} 条提醒`);
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
    saveSettings({ syncPassword: '' });
    _syncInProgress = previousSyncState;
  }
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

function deferReminder(reminderId) {
  updateReminder(reminderId, {
    status: 'deferred'
  });
}

function ignoreReminder(reminderId) {
  updateReminder(reminderId, {
    status: 'ignored'
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
      TIMER_STATES.PAUSED
    ].includes(APP_STATE.timerState);
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

  const body = document.createElement('div');
  body.className = 'record-card__body';

  const header = document.createElement('div');
  header.className = 'record-card__header';

  const meta = document.createElement('div');
  meta.className = 'record-card__meta';
  meta.textContent = `${record.startTime}-${record.endTime} | ⭐${record.quality}颗 | ${ACHIEVEMENT_ICONS[record.achievement] || '❔'}`;

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
  goal.textContent = record.goal;

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
  scheduleDebouncedSync();
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

  return `- ${record.date} ${record.startTime}-${record.endTime} | 目标：${record.goal} | 达成：${getAchievementLabel(record.achievement)} | 质量：${record.quality}/5 | 被打断：${interruptionText} | 总结：${record.summary}`;
}

function buildHistoricalContext() {
  const allRecords = getRecords();
  const dateKeys = [];

  for (let index = 1; index <= 7; index += 1) {
    dateKeys.push(formatDateValue(new Date(Date.now() - index * 86400000)));
  }

  const historicalRecords = allRecords.filter((record) => dateKeys.includes(record.date));

  if (!historicalRecords.length) {
    return '';
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

  const activeReminders = getActiveReminders().slice(0, 3);
  lines.push(`- 活跃待改进项（${activeReminders.length}条）：`);
  activeReminders.forEach((reminder, index) => {
    lines.push(`  ${index + 1}. ${reminder.content}（已关注 ${getReminderDayCount(reminder)} 使用日）`);
  });

  return lines.join('\n');
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
      : `${String(report.dateKey || '').replace('_', ' 至 ')} · ${report.recordCount} 个番茄`;
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

async function callLLM(systemPrompt, userMessage) {
  const settings = getSettings();
  const apiKey = (settings.apiKey || '').trim();
  const apiBase = (settings.apiBase || DEFAULT_SETTINGS.apiBase).replace(/\/$/, '');
  const model = settings.model || DEFAULT_SETTINGS.model;

  if (!apiKey) {
    const message = '未配置 API Key，请先到设置页配置。';
    showCoachFeedback(message);
    showToast(message, 'error');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, 30000);

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
        temperature: 0.7
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
      return callLLM(systemPrompt, userMessage);
    }
    callLLM._retrying = false;

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

  return `你是番茄教练，语气${getToneDescription(getSettings().coachTone)}。用户给你今日的番茄工作记录，请生成教练式日报，包含：
1. 🌟 高光时刻（最好的番茄/成就）
2. 📉 低谷时刻（最差的/被打断的）
3. 🔍 今日模式（工作节奏/情绪词汇/规律）
4. 💡 明日行动建议（具体可操作，2-3条）
5. 🎯 待改进项（格式严格为：【待改进】条目内容，每条一行，最多3条）

语气说明：gentle=温和鼓励, sharp=犀利直接, funny=轻松幽默

【重要约束】每条【待改进】建议必须：①可在单次番茄中直接执行 ②能被清晰验证是否做到 ③不超过25字。禁止输出"保持专注"等无法验证的模糊建议。若背景数据中有活跃待改进项，优先评估其进展而非新增。${empathyNote}`;
}

function buildDailySummaryUserMessage(records) {
  const lines = records.length
    ? records.map((record) => buildRecordContextLine(record)).join('\n')
    : '- 今天还没有任何番茄记录，请根据空记录给出轻量复盘。';

  const originalContent = `日期：${today()}
今日番茄数：${records.length}
今日记录：
${lines}`;
  const ctx = buildHistoricalContext();

  return `${originalContent}${ctx ? `\n\n${ctx}` : ''}`;
}

function buildWeeklyReportSystemPrompt() {
  return `你是番茄教练，语气${getToneDescription(getSettings().coachTone)}。用户给你一段时间的番茄记录，请生成教练式周报，包含：
1. ⏰ 黄金时段分析（什么时候最稳、最有产出）
2. 🧮 任务性价比（哪些任务最值得继续投入）
3. 🚧 打断模式（最常见的打断来源和代价）
4. 📌 下周行动建议（具体可执行，2-3条）
5. 🎯 一句总评（点出这周最该盯住的核心模式）

若背景数据中有超过7天未改善的活跃待改进项，请在行动建议中明确指出是否考虑重新审视该项的有效性。`;
}

function buildWeeklyReportUserMessage(startDate, endDate, records) {
  const lines = records.length
    ? records.map((record) => buildRecordContextLine(record)).join('\n')
    : '- 这个时间范围内没有番茄记录，请基于空记录给出保守结论。';

  const originalContent = `统计范围：${startDate} 至 ${endDate}
番茄总数：${records.length}
记录明细：
${lines}`;
  const ctx = buildHistoricalContext();

  return `${originalContent}${ctx ? `\n\n${ctx}` : ''}`;
}

function buildCoachChatSystemPrompt() {
  return `你是番茄教练，语气${getToneDescription(getSettings().coachTone)}。请基于用户提供的番茄记录上下文和对话历史回答问题。回答要具体、可执行，尽量指出规律；如果上下文不足，直接说明。`;
}

function buildCoachChatUserMessage(history, question) {
  const todayRecords = sortRecordsByStartTimeDesc(getRecordsByDate(today()));
  const weekRange = getCurrentWeekRange();
  const contextRecords = todayRecords.length ? todayRecords : getRecordsByDateRange(weekRange.startDate, weekRange.endDate);
  const limitedRecords = contextRecords.slice(0, 20);
  const contextTitle = todayRecords.length
    ? `今日番茄记录（${today()}）`
    : `本周番茄记录（${weekRange.startDate} 至 ${weekRange.endDate}）`;
  const contextLines = limitedRecords.length
    ? limitedRecords.map((record) => buildRecordContextLine(record)).join('\n')
    : '- 当前没有可用的番茄记录。';
  const historyLines = history.length
    ? history.slice(-12).map((item) => `${item.role === 'user' ? '用户' : '教练'}：${item.content}`).join('\n')
    : '无';
  const truncationNotes = [];

  if (contextRecords.length > 20) {
    truncationNotes.push('（已截取最近 20 条记录作为上下文）');
  }

  if (history.length > 12) {
    truncationNotes.push('（对话历史已截断至最近 6 轮）');
  }

  const truncationText = truncationNotes.length ? `${truncationNotes.join('\n')}\n\n` : '';

  return `${contextTitle}：
${contextLines}

历史对话：
${historyLines}

${truncationText}当前问题：
${question}`;
}

async function handleGenerateDailySummary() {
  if (!DOM.generateDailySummaryBtn) {
    return;
  }

  const records = sortRecordsByStartTimeDesc(getRecordsByDate(today()));
  setCoachActionLoading(DOM.generateDailySummaryBtn, true);
  const result = await callLLM(buildDailySummarySystemPrompt(records), buildDailySummaryUserMessage(records));
  setCoachActionLoading(DOM.generateDailySummaryBtn, false);

  if (!result) {
    return;
  }

  setResultCardContent(DOM.dailySummaryResult, result, '今天的教练报告会显示在这里。');
  addReport({ id: generateId(), type: 'daily', dateKey: today(), content: result, createdAt: new Date().toISOString(), recordCount: records.length });
  renderReportHistory('daily');
  extractReminders(result);
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
  const result = await callLLM(
    buildWeeklyReportSystemPrompt(),
    buildWeeklyReportUserMessage(startDate, endDate, records)
  );
  setCoachActionLoading(DOM.generateWeeklyReportBtn, false);

  if (!result) {
    return;
  }

  setResultCardContent(DOM.weeklyReportResult, result, '选择日期范围后生成周报。');
  addReport({ id: generateId(), type: 'weekly', dateKey: `${startDate}_${endDate}`, content: result, createdAt: new Date().toISOString(), recordCount: records.length });
  renderReportHistory('weekly');
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

  setCoachActionLoading(DOM.sendChatBtn, true);
  const answer = await callLLM(
    buildCoachChatSystemPrompt(),
    buildCoachChatUserMessage(historySnapshot, question)
  );
  setCoachActionLoading(DOM.sendChatBtn, false);

  if (!answer) {
    return;
  }

  APP_STATE.coachChatHistory.push({ role: 'assistant', content: answer });
  renderChatHistory();
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
    '日期,开始时间,结束时间,时长,目标,达成,质量,总结,打断,打断备注'
  ];

  sortRecordsByDateTimeDesc(getRecords()).forEach((record) => {
    lines.push([
      csvEscape(record.date),
      csvEscape(record.startTime),
      csvEscape(record.endTime),
      csvEscape(record.duration),
      csvEscape(record.goal),
      csvEscape(achievementLabels[record.achievement] || '未知'),
      csvEscape(record.quality),
      csvEscape(record.summary),
      csvEscape(record.interrupted ? '是' : '否'),
      csvEscape(record.interruptionNote)
    ].join(','));
  });

  const csv = `\uFEFF${lines.join('\n')}`;
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `tomato-coach-${today()}.csv`);
  showToast('✅ CSV 已开始下载');
}

async function exportJSON() {
  let passwordProvided = false;

  try {
    const password = await promptSyncPassword('export');
    saveSettings({ syncPassword: password });
    passwordProvided = true;

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      records: getRecords(),
      reminders: getReminders()
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

    if (!hasVersion || (!Array.isArray(parsed.records) && !Array.isArray(parsed.reminders))) {
      showToast('文件格式不正确', 'error');
      return;
    }

    const modal = openModal(`
      <h2 class="modal__title">导入确认</h2>
      <div class="modal__body">
        <p>将导入 ${records.length} 条记录、${reminders.length} 条提醒</p>
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
      closeActiveModal();
      showToast('✅ 已合并导入');
      refreshRecordViews();
      refreshReminderViews();
    });

    modal.querySelector('#import-replace-btn')?.addEventListener('click', () => {
      saveRecords(records);
      saveReminders(reminders);
      closeActiveModal();
      showToast('✅ 已覆盖导入');
      refreshRecordViews();
      refreshReminderViews();
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

  APP_STATE.settingsEventsBound = true;
}

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, now);
    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    oscillator.start(now);
    oscillator.stop(now + 0.18);
    oscillator.onended = () => {
      audioContext.close().catch(() => {});
    };
  } catch (error) {
    // ignore beep failures to avoid blocking the evaluation flow
  }
}

function resetTimerState(options = {}) {
  const shouldCloseModal = options.closeModal !== false;

  clearTimerInterval();

  if (shouldCloseModal) {
    closeActiveModal();
  }

  APP_STATE.timerState = TIMER_STATES.IDLE;
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
              return `<button class="star-rating__star" type="button" data-value="${value}" aria-label="${value} 星">⭐</button>`;
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
  const cancelButton = modal.querySelector('#record-cancel-btn');
  let selectedAchievement = initialData.achievement || '';
  let selectedQuality = Number(initialData.quality || 0);

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

  cancelButton.addEventListener('click', () => {
    closeActiveModal();
  });

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
      achievement: selectedAchievement,
      quality: selectedQuality,
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
  const endDate = new Date();

  addRecord({
    id: generateId(),
    date: APP_STATE.sessionDate,
    startTime: APP_STATE.sessionStartTime,
    endTime: formatTime(endDate),
    duration: APP_STATE.sessionDurationMinutes,
    goal: APP_STATE.sessionGoal,
    achievement: formData.achievement,
    quality: formData.quality,
    summary: formData.summary,
    interrupted: formData.interrupted,
    interruptionNote: formData.interruptionNote,
    createdAt: endDate.toISOString()
  });

  Array.from(new Set(formData.practicedReminderIds || [])).forEach((reminderId) => {
    markReminderImproved(reminderId);
  });

  closeActiveModal();
  resetTimerState({ closeModal: false });
  refreshRecordViews();
  checkAndAwardAchievements();
  refreshReminderViews();
}

function openQuickEvaluationModal() {
  const activeReminders = getActiveReminders();
  const modal = openModal(`
    <h2 class="modal__title">这个番茄怎么样？</h2>
    <div class="modal__body">
      <form id="quick-eval-form">
        <div class="rating-field">
          <div class="rating-field__label">产出质量</div>
          <div class="star-rating">
            ${[1, 2, 3, 4, 5].map((value) => {
              return `<button class="star-rating__star" type="button" data-value="${value}" aria-label="${value} 星">⭐</button>`;
            }).join('')}
          </div>
        </div>
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
        achievement: formData.achievement,
        quality: formData.quality,
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
        achievement: formData.achievement,
        quality: formData.quality,
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
  APP_STATE.timerState = TIMER_STATES.EVALUATING;
  APP_STATE.remainingSeconds = 0;
  updateTimerUI();
  playBeep();
  openEvaluationModal();
}

function startCountdown() {
  clearTimerInterval();

  APP_STATE.intervalId = window.setInterval(() => {
    APP_STATE.remainingSeconds -= 1;

    if (APP_STATE.remainingSeconds <= 0) {
      beginEvaluationFlow();
      return;
    }

    updateTimerUI();
  }, 1000);
}

function startPomodoro(goal) {
  const startDate = new Date();

  APP_STATE.sessionGoal = goal;
  APP_STATE.sessionStartTime = formatTime(startDate);
  APP_STATE.sessionDate = today();
  APP_STATE.sessionDurationMinutes = getTimerDurationMinutes();
  APP_STATE.remainingSeconds = APP_STATE.sessionDurationMinutes * 60;
  APP_STATE.timerState = TIMER_STATES.RUNNING;

  closeActiveModal();
  updateTimerUI();
  startCountdown();
}

function showGoalModal() {
  const modal = openModal(`
    <h2 class="modal__title">这个番茄我要产出什么？</h2>
    <div class="modal__body">
      <form id="goal-form">
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

    startPomodoro(goal);
  });

  input.focus();
}

function handlePauseToggle() {
  if (APP_STATE.timerState === TIMER_STATES.RUNNING) {
    clearTimerInterval();
    APP_STATE.timerState = TIMER_STATES.PAUSED;
    updateTimerUI();
    return;
  }

  if (APP_STATE.timerState === TIMER_STATES.PAUSED) {
    APP_STATE.timerState = TIMER_STATES.RUNNING;
    updateTimerUI();
    startCountdown();
  }
}

function handleStopTimer() {
  if (![TIMER_STATES.RUNNING, TIMER_STATES.PAUSED].includes(APP_STATE.timerState)) {
    return;
  }

  if (confirm('确定停止当前番茄吗？')) {
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
  } else if (action === 'defer') {
    deferReminder(reminderId);
  } else if (action === 'ignore') {
    ignoreReminder(reminderId);
  } else if (action === 'reactivate') {
    reactivateReminder(reminderId);
  } else {
    return;
  }

  refreshReminderViews();
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
        handleSwUpdateNotice();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);