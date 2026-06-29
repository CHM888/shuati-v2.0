/**
 * 军事理论刷题 · 数据存储管理
 * Enhanced storage with history, error tracking, favorites, and settings
 */
var Storage = (function() {
  'use strict';

  const VERSION = 3;
  const KEYS = {
    answered: 'mt_answered',
    history: 'mt_history',
    wrongBook: 'mt_wrongbook',
    favorites: 'mt_favorites',
    settings: 'mt_settings',
    dailyLog: 'mt_dailylog'
  };

  // ==================== Migration ====================
  function migrate() {
    // Migrate from old schema
    const oldData = localStorage.getItem('militaryQuiz');
    if (oldData && !localStorage.getItem(KEYS.answered)) {
      try {
        const old = JSON.parse(oldData);
        // Old format: { questionIndex: { selected, correct, isCorrect } }
        // New format: { questionIndex: { selected, correct, isCorrect, ts, count } }
        const upgraded = {};
        for (const [key, val] of Object.entries(old)) {
          upgraded[key] = {
            selected: val.selected,
            correct: val.correct,
            isCorrect: val.isCorrect,
            ts: Date.now(),
            count: 1
          };
        }
        localStorage.setItem(KEYS.answered, JSON.stringify(upgraded));
        // Build wrong book from old data
        const wb = {};
        for (const [key, val] of Object.entries(old)) {
          if (!val.isCorrect) {
            wb[key] = { wrongCount: 1, lastWrong: Date.now(), reviewed: 0 };
          }
        }
        localStorage.setItem(KEYS.wrongBook, JSON.stringify(wb));
        // Clean old keys
        localStorage.removeItem('militaryQuiz');
        localStorage.removeItem('militaryQuiz_v2');
      } catch (e) {
        console.warn('Migration failed:', e);
      }
    }
  }

  // ==================== Answered Questions ====================
  function getAnswered() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.answered) || '{}');
    } catch (e) { return {}; }
  }

  function saveAnswered(data) {
    try { localStorage.setItem(KEYS.answered, JSON.stringify(data)); } catch (e) {}
  }

  function getAnswer(qIdx) {
    const a = getAnswered();
    return a[qIdx] || null;
  }

  function setAnswer(qIdx, selected, correct, isCorrect) {
    const a = getAnswered();
    const existing = a[qIdx];
    a[qIdx] = {
      selected: selected,
      correct: correct,
      isCorrect: isCorrect,
      ts: Date.now(),
      count: existing ? existing.count + 1 : 1
    };
    saveAnswered(a);

    // Update wrong book
    if (!isCorrect) {
      addWrongRecord(qIdx);
    } else if (existing && !existing.isCorrect) {
      // Was previously wrong, now correct - mark as reviewed
      markWrongReviewed(qIdx);
    }

    // Update daily log
    logTodayActivity(isCorrect);

    return a[qIdx];
  }

  function isAnswered(qIdx) {
    return !!getAnswer(qIdx);
  }

  function getAnsweredCount() {
    return Object.keys(getAnswered()).length;
  }

  function getCorrectCount() {
    const a = getAnswered();
    return Object.values(a).filter(v => v.isCorrect).length;
  }

  function getWrongIds() {
    const a = getAnswered();
    return Object.keys(a).filter(k => !a[k].isCorrect).map(Number);
  }

  function clearAnswered() {
    localStorage.removeItem(KEYS.answered);
    localStorage.removeItem(KEYS.wrongBook);
  }

  function deleteAnswered(qIdx) {
    const a = getAnswered();
    delete a[qIdx];
    saveAnswered(a);
    // Also remove from wrong book
    const wb = getWrongBook();
    delete wb[qIdx];
    saveWrongBook(wb);
  }

  // ==================== Wrong Book (Enhanced) ====================
  function getWrongBook() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.wrongBook) || '{}');
    } catch (e) { return {}; }
  }

  function saveWrongBook(data) {
    try { localStorage.setItem(KEYS.wrongBook, JSON.stringify(data)); } catch (e) {}
  }

  function addWrongRecord(qIdx) {
    const wb = getWrongBook();
    if (wb[qIdx]) {
      wb[qIdx].wrongCount++;
      wb[qIdx].lastWrong = Date.now();
    } else {
      wb[qIdx] = { wrongCount: 1, lastWrong: Date.now(), reviewed: 0 };
    }
    saveWrongBook(wb);
  }

  function markWrongReviewed(qIdx) {
    const wb = getWrongBook();
    if (wb[qIdx]) {
      wb[qIdx].reviewed++;
      // If reviewed enough times without error, remove from wrong book
      if (wb[qIdx].reviewed >= 2) {
        delete wb[qIdx];
      } else {
        wb[qIdx].lastReviewed = Date.now();
      }
    }
    saveWrongBook(wb);
  }

  function getSortedWrongIds(sortBy) {
    // sortBy: 'recent' | 'frequent' | 'unreviewed'
    const wb = getWrongBook();
    const ids = Object.keys(wb).map(Number);
    if (sortBy === 'frequent') {
      ids.sort((a, b) => wb[b].wrongCount - wb[a].wrongCount);
    } else if (sortBy === 'unreviewed') {
      ids.sort((a, b) => (wb[a].reviewed || 0) - (wb[b].reviewed || 0));
    } else {
      // recent
      ids.sort((a, b) => wb[b].lastWrong - wb[a].lastWrong);
    }
    return ids;
  }

  function getWrongBookEntry(qIdx) {
    const wb = getWrongBook();
    return wb[qIdx] || null;
  }

  // ==================== Favorites ====================
  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.favorites) || '[]');
    } catch (e) { return []; }
  }

  function toggleFavorite(qIdx) {
    const favs = getFavorites();
    const idx = favs.indexOf(qIdx);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(qIdx);
    }
    localStorage.setItem(KEYS.favorites, JSON.stringify(favs));
    return idx < 0; // returns true if added
  }

  function isFavorite(qIdx) {
    return getFavorites().indexOf(qIdx) >= 0;
  }

  function getFavoriteIds() {
    return getFavorites();
  }

  // ==================== History / Study Sessions ====================
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.history) || '[]');
    } catch (e) { return []; }
  }

  function addHistory(session) {
    const h = getHistory();
    h.unshift({
      id: Date.now(),
      date: new Date().toISOString(),
      mode: session.mode,
      total: session.total,
      correct: session.correct,
      wrong: session.wrong,
      duration: session.duration || 0,
      typeFilter: session.typeFilter || 'all'
    });
    // Keep last 100 sessions
    if (h.length > 100) h.length = 100;
    localStorage.setItem(KEYS.history, JSON.stringify(h));
  }

  function getHistoryByDateRange(days) {
    const cutoff = Date.now() - days * 86400000;
    return getHistory().filter(s => s.id > cutoff);
  }

  function clearHistory() {
    localStorage.removeItem(KEYS.history);
  }

  // ==================== Daily Activity Log (for heatmap) ====================
  function getDailyLog() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.dailyLog) || '{}');
    } catch (e) { return {}; }
  }

  function logTodayActivity(isCorrect) {
    const today = new Date().toISOString().slice(0, 10);
    const log = getDailyLog();
    if (!log[today]) {
      log[today] = { total: 0, correct: 0 };
    }
    log[today].total++;
    if (isCorrect) log[today].correct++;
    // Keep last 365 days
    const keys = Object.keys(log).sort();
    while (keys.length > 365) {
      delete log[keys.shift()];
    }
    localStorage.setItem(KEYS.dailyLog, JSON.stringify(log));
  }

  function getDailyActivity(days) {
    const log = getDailyLog();
    const result = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      result[key] = log[key] || { total: 0, correct: 0 };
    }
    return result;
  }

  // ==================== Settings ====================
  const DEFAULT_SETTINGS = {
    darkMode: true,
    examCount: 50,
    examTime: 50,    // minutes
    autoNext: false, // auto-advance on single-select answer
    showExplanation: true,
    reminderInterval: 0 // days (0 = disabled)
  };

  function getSettings() {
    try {
      return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(KEYS.settings) || '{}'));
    } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  }

  function saveSettings(s) {
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
  }

  function updateSetting(key, value) {
    const s = getSettings();
    s[key] = value;
    saveSettings(s);
  }

  // ==================== Stats ====================
  function getFullStats() {
    const answered = getAnswered();
    const vals = Object.values(answered);
    const total = vals.length;
    const correct = vals.filter(v => v.isCorrect).length;
    const wrong = total - correct;
    const rate = total > 0 ? Math.round(correct / total * 100) : 0;

    // By type
    const byType = { judge: { t: 0, c: 0 }, single: { t: 0, c: 0 }, multi: { t: 0, c: 0 } };
    for (const [key, val] of Object.entries(answered)) {
      // Need ALL_QUESTIONS to get type
      const q = window.ALL_QUESTIONS ? window.ALL_QUESTIONS[key] : null;
      if (q) {
        byType[q.type].t++;
        if (val.isCorrect) byType[q.type].c++;
      }
    }

    // Wrong book stats
    const wb = getWrongBook();
    const wbEntries = Object.values(wb);

    // History stats
    const history = getHistory();
    const last7Days = getHistoryByDateRange(7);
    const weekTotal = last7Days.reduce((s, h) => s + h.total, 0);
    const weekCorrect = last7Days.reduce((s, h) => s + h.correct, 0);

    return {
      total, correct, wrong, rate,
      byType,
      wrongBookCount: Object.keys(wb).length,
      worstQuestion: wbEntries.length > 0 ?
        wbEntries.reduce((a, b) => a.wrongCount > b.wrongCount ? a : b) : null,
      historyCount: history.length,
      weekTotal, weekCorrect,
      weekRate: weekTotal > 0 ? Math.round(weekCorrect / weekTotal * 100) : 0
    };
  }

  // ==================== Data Export / Import ====================
  function exportData() {
    return {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      answered: getAnswered(),
      wrongBook: getWrongBook(),
      favorites: getFavorites(),
      history: getHistory(),
      dailyLog: getDailyLog(),
      settings: getSettings()
    };
  }

  function importData(data) {
    if (!data || data.version < 2) {
      throw new Error('数据格式不兼容，请使用最新版本导出的数据');
    }
    if (data.answered) localStorage.setItem(KEYS.answered, JSON.stringify(data.answered));
    if (data.wrongBook) localStorage.setItem(KEYS.wrongBook, JSON.stringify(data.wrongBook));
    if (data.favorites) localStorage.setItem(KEYS.favorites, JSON.stringify(data.favorites));
    if (data.history) localStorage.setItem(KEYS.history, JSON.stringify(data.history));
    if (data.dailyLog) localStorage.setItem(KEYS.dailyLog, JSON.stringify(data.dailyLog));
    if (data.settings) localStorage.setItem(KEYS.settings, JSON.stringify(data.settings));
  }

  function getStorageSize() {
    let bytes = 0;
    for (const key of Object.values(KEYS)) {
      const item = localStorage.getItem(key);
      if (item) bytes += item.length * 2; // UTF-16
    }
    return bytes;
  }

  // ==================== Init ====================
  migrate();

  // ==================== Public API ====================
  return {
    // Answered
    getAnswered, getAnswer, setAnswer, isAnswered,
    getAnsweredCount, getCorrectCount, getWrongIds,
    clearAnswered, deleteAnswered,

    // Wrong Book
    getWrongBook, addWrongRecord, markWrongReviewed,
    getSortedWrongIds, getWrongBookEntry,

    // Favorites
    getFavorites, toggleFavorite, isFavorite, getFavoriteIds,

    // History
    getHistory, addHistory, getHistoryByDateRange, clearHistory,

    // Daily Log
    getDailyLog, logTodayActivity, getDailyActivity,

    // Settings
    getSettings, saveSettings, updateSetting,

    // Stats
    getFullStats,

    // Import/Export
    exportData, importData, getStorageSize,
  };
})();
