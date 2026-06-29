/**
 * 军事理论刷题 · 主应用逻辑
 * Main application controller with all features
 */
(function() {
  'use strict';

  // ==================== App State ====================
  const state = {
    page: 'practice',     // practice | exam | wrong | review | search | favorites | settings
    typeFilter: 'all',    // all | judge | single | multi
    queue: [],            // shuffled question indices
    currentIdx: 0,
    selected: {},         // qIdx -> selected value
    examTimer: null,
    examTimeLeft: 0,
    searchQuery: '',
    wrongSortBy: 'recent' // recent | frequent | unreviewed
  };

  // ==================== DOM References ====================
  function $(id) { return document.getElementById(id); }

  // ==================== Utility ====================
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function typeLabel(type) {
    if (type === 'judge') return '<span class="q-type judge">判断题</span>';
    if (type === 'single') return '<span class="q-type single">单选题</span>';
    return '<span class="q-type multi">多选题</span>';
  }

  function getAnswerText(qIdx) {
    const q = ALL_QUESTIONS[qIdx];
    if (!q) return '';
    const a = q.answer;
    if (q.type === 'judge') {
      return a === '√' ? '✅ 正确 (√)' : '❌ 错误 (×)';
    }
    if (q.type === 'single') {
      for (let i = 0; i < q.options.length; i++) {
        if (q.options[i].label === a) return a + '. ' + q.options[i].text;
      }
      return a;
    }
    // multi
    const labels = a.replace(/ /g, '').split('');
    const parts = [];
    for (let j = 0; j < labels.length; j++) {
      for (let i = 0; i < q.options.length; i++) {
        if (q.options[i].label === labels[j]) {
          parts.push(labels[j] + '. ' + q.options[i].text);
          break;
        }
      }
    }
    return parts.join('；');
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function formatDate(isoStr) {
    const d = new Date(isoStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // ==================== Toast ====================
  function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // ==================== Auto-Generated Explanation ====================
  function generateExplanation(qIdx) {
    const q = ALL_QUESTIONS[qIdx];
    if (!q) return '暂无解析';

    let exp = '';
    if (q.type === 'judge') {
      const isTrue = q.answer === '√';
      // Extract key concept from the question text
      const text = q.text.replace(/[（(]\s*[）)]/g, '').trim();
      // Find key terms (text in quotes or key phrases)
      const keywordMatch = text.match(/["""]([^""""]+)["”"]/);
      const keyword = keywordMatch ? keywordMatch[1] : '';

      if (isTrue) {
        exp = '该说法<strong>正确</strong>。';
        if (keyword) {
          exp += '关于"' + keyword + '"的表述符合相关法规/教材的规定。';
        }
        // Add context based on text patterns
        if (text.includes('国防') || text.includes('兵役') || text.includes('军事')) {
          exp += '\n本题考察的是军事理论基础知识，需要对相关概念有准确的理解。';
        }
        if (text.includes('根据') || text.includes('规定')) {
          exp += '建议查阅相关法规原文以加深理解。';
        }
      } else {
        exp = '该说法<strong>错误</strong>。';
        if (keyword) {
          exp += '关于"' + keyword + '"的表述与正确概念存在偏差。';
        }
        // Try to identify what might be wrong
        if (text.includes('中立') || text.includes('不')) {
          exp += '请注意题干中的关键限定词，这些往往是判断题的考点。';
        }
        if (text.includes('所有') || text.includes('一切') || text.includes('仅仅') || text.includes('只')) {
          exp += '注意"所有/一切/仅仅"等绝对化表述，在军事理论中往往需要具体分析。';
        }
      }
    } else if (q.type === 'single' || q.type === 'multi') {
      exp = '<strong>正确答案：' + getAnswerText(qIdx) + '</strong>\n';
      // Generate option-by-option brief analysis
      if (q.options && q.options.length > 0) {
        const correctLabels = q.answer.replace(/ /g, '').split('');
        for (let i = 0; i < q.options.length; i++) {
          const opt = q.options[i];
          const isCorrect = correctLabels.indexOf(opt.label) >= 0;
          if (isCorrect) {
            exp += '\n' + opt.label + ' ✅ 正确选项：' + opt.text;
          }
        }
      }
      if (q.type === 'multi') {
        exp += '\n⚠️ 多选题需选出所有正确选项，漏选、多选均不得分。';
      }
    }

    // Add general study tip
    const tips = [
      '\n💡 建议结合教材原文理解该知识点。',
      '\n💡 可将其加入收藏夹，反复巩固。',
      '\n💡 类似题目可以对比记忆，注意细微差别。',
    ];
    exp += tips[Math.floor(Math.random() * tips.length)];

    return exp;
  }

  // ==================== Get Filtered Questions ====================
  function getFiltered() {
    let filtered = ALL_QUESTIONS.slice();
    if (state.typeFilter !== 'all') {
      filtered = filtered.filter(q => q.type === state.typeFilter);
    }
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.text.toLowerCase().includes(q) ||
        (item.answer && item.answer.toLowerCase().includes(q)) ||
        (item.options && item.options.some(o => o.text.toLowerCase().includes(q)))
      );
    }
    return filtered;
  }

  // ==================== Navigation ====================
  function navigate(page) {
    state.page = page;
    // Update desktop tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));
    // Update mobile nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    // Show/hide filter bar
    const filterArea = $('filterArea');
    if (filterArea) {
      filterArea.classList.toggle('hidden', !['practice'].includes(page));
    }
    // Stop exam timer when leaving exam
    if (page !== 'exam' && state.examTimer) {
      clearInterval(state.examTimer);
      state.examTimer = null;
    }
    render();
  }

  function setTypeFilter(t) {
    state.typeFilter = t;
    state.searchQuery = '';
    if ($('searchInput')) $('searchInput').value = '';
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('on', c.dataset.type === t));
    buildQueue();
    state.currentIdx = 0;
    state.selected = {};
    render();
  }

  function buildQueue() {
    const filtered = shuffle(getFiltered());
    state.queue = filtered.map(q => ALL_QUESTIONS.indexOf(q));
    state.currentIdx = 0;
    state.selected = {};
  }

  // ==================== Main Render ====================
  function render() {
    updateStats();
    const c = $('mainContent');

    switch (state.page) {
      case 'practice': renderPractice(c); break;
      case 'exam': renderExam(c); break;
      case 'wrong': renderWrong(c); break;
      case 'review': renderReview(c); break;
      case 'search': renderSearch(c); break;
      case 'favorites': renderFavorites(c); break;
      case 'settings': renderSettings(c); break;
      default: renderPractice(c);
    }
  }

  // ==================== Stats Update ====================
  function updateStats() {
    const stats = Storage.getFullStats();
    $('statTotal').textContent = stats.total;
    $('statCorrect').textContent = stats.correct;
    $('statWrong').textContent = stats.wrong;
    $('statRate').textContent = stats.total > 0 ? stats.rate + '%' : '0%';
    // Progress bar
    const pct = stats.total > 0 ? Math.round(stats.correct / Math.max(stats.total, 1) * 100) : 0;
    $('progressFill').style.width = Math.min(pct, 100) + '%';
  }

  // ==================== Practice Mode ====================
  function renderPractice(c) {
    if (state.queue.length === 0) {
      c.innerHTML = '<div class="empty"><div class="icon">📦</div><p>当前筛选条件下没有题目</p><button class="btn btn-primary mt-12" onclick="App.setTypeFilter(\'all\')">显示全部题目</button></div>';
      return;
    }
    if (state.currentIdx >= state.queue.length) {
      // Round complete
      const stats = Storage.getFullStats();
      const history = Storage.getHistory();
      const lastSession = history.length > 0 ? history[0] : null;
      let html = '<div class="empty"><div class="icon">🎉</div><p style="font-size:1.1rem;font-weight:700">本轮完成！</p>';
      if (lastSession) {
        html += '<p style="color:var(--muted);font-size:.85rem">上次得分：' + lastSession.correct + '/' + lastSession.total + '</p>';
      }
      html += '<div class="btn-row" style="justify-content:center;margin-top:16px">';
      html += '<button class="btn btn-primary" onclick="App.startPractice()">继续刷题</button>';
      html += '<button class="btn btn-secondary" onclick="App.navigate(\'review\')">查看统计</button>';
      html += '</div></div>';
      c.innerHTML = html;
      return;
    }

    const qIdx = state.queue[state.currentIdx];
    const q = ALL_QUESTIONS[qIdx];
    if (!q) { c.innerHTML = '<div class="empty"><div class="icon">⚠️</div><p>题目数据异常</p></div>'; return; }

    const a = Storage.getAnswer(qIdx);
    const isFav = Storage.isFavorite(qIdx);
    const pct = Math.round((state.currentIdx / state.queue.length) * 100);
    $('progressFill').style.width = pct + '%';

    let cardClass = 'question-card';
    if (a) cardClass += a.isCorrect ? ' correct' : ' wrong';
    if (isFav) cardClass += ' favorited';

    let html = '<div class="' + cardClass + '">';

    // Header
    html += '<div class="q-header">';
    html += typeLabel(q.type);
    html += '<div class="q-actions">';
    html += '<button class="q-action-btn' + (isFav ? ' active' : '') + '" onclick="App.toggleFav(' + qIdx + ')" title="收藏">⭐</button>';
    html += '<span class="q-num">' + (state.currentIdx + 1) + ' / ' + state.queue.length + '</span>';
    html += '</div></div>';

    // Section info
    if (q.section) {
      html += '<div style="font-size:.7rem;color:var(--muted);margin-bottom:6px">' + esc(q.section) + '</div>';
    }

    // Question text
    html += '<div class="q-text">' + esc(q.text) + '</div>';

    // Options
    if (q.type === 'judge') {
      const sel = state.selected[qIdx] || '';
      const dis = a ? ' disabled' : '';
      const selY = sel === '√';
      const selN = sel === '×';
      let clsY = 'judge-btn';
      let clsN = 'judge-btn';
      if (a) {
        clsY += ' disabled';
        clsN += ' disabled';
        if (q.answer === '√') clsY += ' correct-answer';
        else clsN += ' correct-answer';
        if (selY && q.answer !== '√') clsY += ' wrong-answer';
        if (selN && q.answer !== '×') clsN += ' wrong-answer';
      } else {
        if (selY) clsY += ' selected';
        if (selN) clsN += ' selected';
      }
      html += '<div class="judge-btns">';
      html += '<div class="' + clsY + '" onclick="App.selectJudge(' + qIdx + ',\'√\')">✔ 正确 (√)</div>';
      html += '<div class="' + clsN + '" onclick="App.selectJudge(' + qIdx + ',\'×\')">✘ 错误 (×)</div>';
      html += '</div>';
    } else {
      html += '<div class="options">';
      const sel = state.selected[qIdx];
      const isMulti = q.type === 'multi';
      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i];
        let isSelected = false;
        if (isMulti && Array.isArray(sel)) {
          isSelected = sel.indexOf(opt.label) >= 0;
        } else {
          isSelected = (sel === opt.label);
        }
        const isCorrect = q.answer.replace(/ /g, '').indexOf(opt.label) >= 0;
        let cls = 'opt';
        if (a) {
          cls += ' disabled';
          if (isCorrect) cls += ' correct-answer';
          if (isSelected && !isCorrect) cls += ' wrong-answer';
        } else if (isSelected) {
          cls += ' selected';
        }
        html += '<div class="' + cls + '" onclick="App.selectOption(' + qIdx + ',\'' + opt.label + '\',' + isMulti + ')">';
        html += '<span class="opt-label">' + opt.label + '</span><span>' + esc(opt.text) + '</span></div>';
      }
      html += '</div>';
    }

    // Answer reveal
    if (a) {
      html += '<div class="answer-reveal show ' + (a.isCorrect ? '' : 'wrong-reveal') + '">';
      html += a.isCorrect ? '✔ 回答正确！' : '✘ 回答错误';
      html += '　正确答案：' + esc(getAnswerText(qIdx));
      html += '</div>';

      // Explanation
      if (Storage.getSettings().showExplanation) {
        const wb = Storage.getWrongBookEntry(qIdx);
        html += '<div class="explanation-box">';
        html += '<div class="exp-title">📖 题目解析</div>';
        html += generateExplanation(qIdx);
        if (wb && wb.wrongCount > 1) {
          html += '<div style="margin-top:6px;color:var(--warn);font-size:.75rem">⚠️ 已做错 <strong>' + wb.wrongCount + '</strong> 次，需要重点复习！</div>';
        }
        html += '</div>';
      }
    }

    html += '</div>';

    // Action buttons
    html += '<div class="btn-row">';
    if (!a && q.type === 'multi') {
      html += '<button class="btn btn-primary" onclick="App.submitAnswer(' + qIdx + ')">确认提交</button>';
    }
    html += '<button class="btn btn-secondary" onclick="App.nextQuestion()">下一题 →</button>';
    if (a) {
      html += '<button class="btn btn-secondary btn-sm" onclick="App.retryQuestion(' + qIdx + ')">🔄 重做</button>';
    }
    html += '</div>';

    // Swipe hint on mobile
    html += '<div style="text-align:center;color:var(--muted);font-size:.7rem;margin-top:4px">💡 做错自动加入错题本 · 点击 ⭐ 收藏</div>';

    c.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== Practice Actions ====================
  function selectJudge(qIdx, val) {
    if (Storage.isAnswered(qIdx)) return;
    state.selected[qIdx] = val;
    const q = ALL_QUESTIONS[qIdx];
    const isCorrect = val === q.answer;
    Storage.setAnswer(qIdx, val, q.answer, isCorrect);
    render();
  }

  function selectOption(qIdx, label, isMulti) {
    if (Storage.isAnswered(qIdx)) return;
    if (!state.selected[qIdx]) state.selected[qIdx] = isMulti ? [] : '';

    if (isMulti) {
      const arr = state.selected[qIdx];
      const idx = arr.indexOf(label);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(label);
    } else {
      state.selected[qIdx] = label;
      const q = ALL_QUESTIONS[qIdx];
      const isCorrect = label === q.answer;
      Storage.setAnswer(qIdx, label, q.answer, isCorrect);
    }
    render();
  }

  function submitAnswer(qIdx) {
    if (Storage.isAnswered(qIdx)) return;
    const q = ALL_QUESTIONS[qIdx];
    const sel = state.selected[qIdx];
    if (!sel || (Array.isArray(sel) && sel.length === 0)) {
      showToast('请至少选择一个选项');
      return;
    }
    const correctNorm = q.answer.replace(/ /g, '').split('').sort().join('');
    const selNorm = Array.isArray(sel) ? sel.slice().sort().join('') : sel;
    const isCorrect = correctNorm === selNorm;
    Storage.setAnswer(qIdx, sel, q.answer, isCorrect);
    render();
  }

  function nextQuestion() {
    if (state.currentIdx < state.queue.length - 1) {
      state.currentIdx++;
      if (state.selected[state.queue[state.currentIdx]] === undefined) {
        // Don't carry over selected from previous
      }
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Save session to history
      const sessionQIdx = state.queue[state.currentIdx];
      if (sessionQIdx !== undefined && Storage.isAnswered(sessionQIdx)) {
        savePracticeSession();
      }
      state.currentIdx++;
      render();
    }
  }

  function retryQuestion(qIdx) {
    Storage.deleteAnswered(qIdx);
    state.selected[qIdx] = undefined;
    render();
  }

  function toggleFav(qIdx) {
    const added = Storage.toggleFavorite(qIdx);
    showToast(added ? '已加入收藏 ⭐' : '已取消收藏');
    render();
  }

  function savePracticeSession() {
    const answered = Storage.getAnswered();
    let correct = 0, total = 0;
    for (const qIdx of state.queue) {
      if (answered[qIdx]) {
        total++;
        if (answered[qIdx].isCorrect) correct++;
      }
    }
    if (total > 0) {
      Storage.addHistory({ mode: 'practice', total, correct, wrong: total - correct, typeFilter: state.typeFilter });
    }
  }

  function startPractice() {
    state.typeFilter = 'all';
    state.searchQuery = '';
    if ($('searchInput')) $('searchInput').value = '';
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('on', c.dataset.type === 'all'));
    buildQueue();
    navigate('practice');
  }

  // ==================== Exam Mode ====================
  function renderExam(c) {
    if (state.queue.length === 0) {
      buildQueue();
      if (state.queue.length === 0) {
        c.innerHTML = '<div class="empty"><div class="icon">📝</div><p>没有题目可供考试</p></div>';
        return;
      }
    }
    // Limit to exam count
    const settings = Storage.getSettings();
    const examQueue = state.queue.slice(0, Math.min(settings.examCount, state.queue.length));
    state.queue = examQueue;

    // Timer display
    const m = Math.floor(state.examTimeLeft / 60);
    const s = state.examTimeLeft % 60;
    const answered = Object.keys(state.selected).filter(k => state.queue.indexOf(parseInt(k)) >= 0).length;
    const warnClass = state.examTimeLeft < 300 ? ' warning' : '';

    let html = '<div class="exam-timer' + warnClass + '">⏰ 剩余时间: <strong>' +
      (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s +
      '</strong> ｜ 已答: ' + answered + '/' + state.queue.length + '</div>';

    // All questions on one page
    for (let i = 0; i < state.queue.length; i++) {
      const qIdx = state.queue[i];
      const q = ALL_QUESTIONS[qIdx];
      if (!q) continue;

      html += '<div class="question-card" id="eq' + i + '">';
      html += '<div class="q-header">' + typeLabel(q.type) + '<span class="q-num">' + (i + 1) + ' / ' + state.queue.length + '</span></div>';
      html += '<div class="q-text">' + esc(q.text) + '</div>';

      if (q.type === 'judge') {
        const sel = state.selected[qIdx];
        html += '<div class="judge-btns">';
        html += '<div class="judge-btn' + (sel === '√' ? ' selected' : '') + '" id="ej' + i + 'Y" onclick="App.examSelect(' + i + ',\'√\')">✔ 正确 (√)</div>';
        html += '<div class="judge-btn' + (sel === '×' ? ' selected' : '') + '" id="ej' + i + 'N" onclick="App.examSelect(' + i + ',\'×\')">✘ 错误 (×)</div>';
        html += '</div>';
      } else {
        html += '<div class="options">';
        for (let j = 0; j < q.options.length; j++) {
          const opt = q.options[j];
          const sel = state.selected[qIdx];
          let isSelected = q.type === 'multi' ? (Array.isArray(sel) && sel.indexOf(opt.label) >= 0) : (sel === opt.label);
          html += '<div class="opt' + (isSelected ? ' selected' : '') + '" id="eo' + i + opt.label + '" onclick="App.examSelectOpt(' + i + ',\'' + opt.label + '\',' + (q.type === 'multi') + ')">';
          html += '<span class="opt-label">' + opt.label + '</span><span>' + esc(opt.text) + '</span></div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    html += '<div class="btn-row" style="margin-top:12px">';
    html += '<button class="btn btn-primary btn-block" onclick="App.submitExam()">📝 提交试卷</button>';
    html += '</div>';

    c.innerHTML = html;
  }

  function examSelect(qIdx, val) {
    state.selected[qIdx] = val;
    const btnY = document.getElementById('ej' + qIdx + 'Y');
    const btnN = document.getElementById('ej' + qIdx + 'N');
    if (btnY) btnY.className = 'judge-btn' + (val === '√' ? ' selected' : '');
    if (btnN) btnN.className = 'judge-btn' + (val === '×' ? ' selected' : '');
    updateExamAnswered();
  }

  function examSelectOpt(qIdx, label, isMulti) {
    if (!state.selected[qIdx]) state.selected[qIdx] = isMulti ? [] : '';
    if (isMulti) {
      const arr = state.selected[qIdx];
      const idx = arr.indexOf(label);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(label);
      const q = ALL_QUESTIONS[qIdx];
      for (let i = 0; i < q.options.length; i++) {
        const el = document.getElementById('eo' + qIdx + q.options[i].label);
        if (el) el.className = 'opt' + (arr.indexOf(q.options[i].label) >= 0 ? ' selected' : '');
      }
    } else {
      state.selected[qIdx] = label;
      const q = ALL_QUESTIONS[qIdx];
      for (let i = 0; i < q.options.length; i++) {
        const el = document.getElementById('eo' + qIdx + q.options[i].label);
        if (el) el.className = 'opt' + (q.options[i].label === label ? ' selected' : '');
      }
    }
    updateExamAnswered();
  }

  function updateExamAnswered() {
    const answered = Object.keys(state.selected).filter(k => state.queue.indexOf(parseInt(k)) >= 0).length;
    const timerEl = document.querySelector('.exam-timer strong');
    if (timerEl) {
      const m = Math.floor(state.examTimeLeft / 60);
      const s = state.examTimeLeft % 60;
      timerEl.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    const statEl = document.querySelector('.exam-timer');
    if (statEl) {
      statEl.innerHTML = statEl.innerHTML.replace(/已答: \d+/, '已答: ' + answered);
    }
  }

  function submitExam() {
    if (state.examTimer) {
      clearInterval(state.examTimer);
      state.examTimer = null;
    }
    let correct = 0;
    const total = state.queue.length;

    for (let i = 0; i < state.queue.length; i++) {
      const qIdx = state.queue[i];
      const q = ALL_QUESTIONS[qIdx];
      const sel = state.selected[qIdx];
      if (!sel || (Array.isArray(sel) && sel.length === 0)) {
        Storage.setAnswer(qIdx, '未作答', q.answer, false);
      } else {
        const correctNorm = q.answer.replace(/ /g, '').split('').sort().join('');
        const selNorm = Array.isArray(sel) ? sel.slice().sort().join('') : sel;
        const isCorrect = correctNorm === selNorm;
        Storage.setAnswer(qIdx, sel, q.answer, isCorrect);
        if (isCorrect) correct++;
      }
    }

    const rate = Math.round(correct / total * 100);
    const settings = Storage.getSettings();
    Storage.addHistory({
      mode: 'exam',
      total, correct, wrong: total - correct,
      duration: settings.examTime * 60 - state.examTimeLeft,
      typeFilter: state.typeFilter
    });

    let msg = rate >= 90 ? '🏆 太棒了！优秀！' : rate >= 80 ? '👏 很好！继续保持！' : rate >= 60 ? '👍 及格了，还有提升空间！' : '📚 需要加强复习！';

    let html = '<div class="empty">';
    html += '<div class="icon">📊</div>';
    html += '<p style="font-size:1.2rem;font-weight:700;margin-bottom:8px">考试结束！</p>';
    html += '<p style="font-size:1.1rem;margin-bottom:4px">得分：<strong style="color:' + (rate >= 60 ? 'var(--correct)' : 'var(--wrong)') + '">' + correct + '/' + total + ' (' + rate + '%)</strong></p>';
    html += '<p style="color:var(--muted);font-size:.85rem;margin-bottom:16px">' + msg + '</p>';

    // Quick answer review
    html += '<div style="text-align:left;margin-top:16px">';
    html += '<h3 style="font-size:.9rem;margin-bottom:10px">📋 答题详情</h3>';
    for (let i = 0; i < state.queue.length; i++) {
      const qIdx = state.queue[i];
      const q = ALL_QUESTIONS[qIdx];
      const a = Storage.getAnswer(qIdx);
      const cls = a && a.isCorrect ? 'ri-correct' : 'ri-wrong';
      html += '<div class="review-item ' + cls + '">';
      html += '<div class="ri-text">' + typeLabel(q.type) + ' ' + esc(q.text) + '</div>';
      html += '<div class="ri-meta">你的答案：' + esc(String(a ? (Array.isArray(a.selected) ? a.selected.join('') : a.selected) : '-')) + '　正确答案：' + esc(getAnswerText(qIdx)) + '</div>';
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="btn-row" style="justify-content:center;margin-top:16px">';
    html += '<button class="btn btn-primary" onclick="App.startExam()">重新考试</button>';
    html += '<button class="btn btn-secondary" onclick="App.navigate(\'practice\')">继续练习</button>';
    html += '</div></div>';

    $('mainContent').innerHTML = html;
    updateStats();
  }

  function startExam() {
    state.typeFilter = 'all';
    state.searchQuery = '';
    const settings = Storage.getSettings();
    buildQueue();
    state.queue = state.queue.slice(0, Math.min(settings.examCount, state.queue.length));
    state.currentIdx = 0;
    state.selected = {};
    state.examTimeLeft = settings.examTime * 60;
    navigate('exam');

    if (state.examTimer) clearInterval(state.examTimer);
    state.examTimer = setInterval(() => {
      state.examTimeLeft--;
      // Update timer display
      const m = Math.floor(state.examTimeLeft / 60);
      const s = state.examTimeLeft % 60;
      const answered = Object.keys(state.selected).filter(k => state.queue.indexOf(parseInt(k)) >= 0).length;
      const timerEl = document.querySelector('.exam-timer');
      if (timerEl) {
        const warnClass = state.examTimeLeft < 300 ? ' warning' : '';
        timerEl.className = 'exam-timer' + warnClass;
        timerEl.innerHTML = '⏰ 剩余时间: <strong>' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '</strong> ｜ 已答: ' + answered + '/' + state.queue.length;
      }
      if (state.examTimeLeft <= 0) {
        clearInterval(state.examTimer);
        state.examTimer = null;
        showToast('⏰ 时间到！自动提交');
        submitExam();
      }
    }, 1000);
  }

  // ==================== Wrong Book ====================
  function renderWrong(c) {
    const wrongIds = Storage.getWrongIds();
    if (wrongIds.length === 0) {
      c.innerHTML = '<div class="empty"><div class="icon">✅</div><p>没有错题，继续加油！</p></div>';
      return;
    }

    const sortedIds = Storage.getSortedWrongIds(state.wrongSortBy);
    const wb = Storage.getWrongBook();

    let html = '<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">';
    html += '<span style="color:var(--muted);font-size:.82rem">共 <strong style="color:var(--wrong)">' + wrongIds.length + '</strong> 道错题</span>';
    html += '<div class="filter-row" style="margin:0">';
    html += '<span class="filter-chip' + (state.wrongSortBy === 'recent' ? ' on' : '') + '" onclick="App.wrongSort(\'recent\')">最新</span>';
    html += '<span class="filter-chip' + (state.wrongSortBy === 'frequent' ? ' on' : '') + '" onclick="App.wrongSort(\'frequent\')">高频</span>';
    html += '<span class="filter-chip' + (state.wrongSortBy === 'unreviewed' ? ' on' : '') + '" onclick="App.wrongSort(\'unreviewed\')">未复习</span>';
    html += '</div></div>';

    html += '<div class="btn-row">';
    html += '<button class="btn btn-primary" onclick="App.practiceWrong()">📝 刷错题</button>';
    html += '<button class="btn btn-secondary" onclick="App.clearWrong()">🗑️ 清空错题本</button>';
    html += '</div>';

    for (let k = 0; k < sortedIds.length; k++) {
      const qIdx = sortedIds[k];
      const q = ALL_QUESTIONS[qIdx];
      const a = Storage.getAnswer(qIdx);
      const entry = wb[qIdx];
      html += '<div class="review-item ri-wrong">';
      html += '<div class="ri-text">' + typeLabel(q.type) + ' ' + esc(q.text) + '</div>';
      html += '<div class="ri-meta">';
      html += '<span>你的答案：' + esc(String(a ? (Array.isArray(a.selected) ? a.selected.join('') : a.selected) : '-')) + '</span>';
      html += '<span>正确：' + esc(getAnswerText(qIdx)) + '</span>';
      if (entry) {
        html += '<span style="color:var(--warn)">做错' + entry.wrongCount + '次</span>';
        if (entry.lastWrong) html += '<span>' + formatDate(new Date(entry.lastWrong).toISOString()) + '</span>';
      }
      html += '</div></div>';
    }
    c.innerHTML = html;
  }

  function wrongSort(by) {
    state.wrongSortBy = by;
    render();
  }

  function practiceWrong() {
    const wrongIds = Storage.getSortedWrongIds(state.wrongSortBy);
    state.queue = wrongIds;
    state.currentIdx = 0;
    state.selected = {};
    state.typeFilter = 'all';
    if ($('searchInput')) $('searchInput').value = '';
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('on', c.dataset.type === 'all'));
    navigate('practice');
  }

  function clearWrong() {
    if (!confirm('确定要清空所有错题记录吗？此操作不可恢复。')) return;
    Storage.clearAnswered();
    updateStats();
    render();
    showToast('错题本已清空');
  }

  // ==================== Review / Stats ====================
  function renderReview(c) {
    const stats = Storage.getFullStats();
    const history = Storage.getHistory();
    const dailyActivity = Storage.getDailyActivity(84); // 12 weeks

    let html = '';

    // Score ring
    const circumference = 2 * Math.PI * 52;
    html += '<div style="text-align:center;padding:16px 0">';
    html += '<svg class="score-ring" viewBox="0 0 120 120">';
    html += '<circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" stroke-width="8"/>';
    html += '<circle cx="60" cy="60" r="52" fill="none" stroke="' + (stats.rate >= 60 ? 'var(--correct)' : 'var(--wrong)') + '" stroke-width="8" stroke-dasharray="' + (stats.rate * circumference / 100) + ' ' + circumference + '" stroke-linecap="round" transform="rotate(-90 60 60)"/>';
    html += '<text x="60" y="60" text-anchor="middle" dominant-baseline="central" fill="var(--text)" font-size="24" font-weight="700">' + stats.rate + '%</text>';
    html += '</svg><p style="color:var(--muted);font-size:.82rem">总正确率</p></div>';

    // Stats cards
    html += '<div class="stats">';
    html += '<div class="stat"><div class="num">' + stats.total + '</div><div class="label">总答题</div></div>';
    html += '<div class="stat"><div class="num" style="color:var(--correct)">' + stats.correct + '</div><div class="label">正确</div></div>';
    html += '<div class="stat"><div class="num" style="color:var(--wrong)">' + stats.wrong + '</div><div class="label">错误</div></div>';
    html += '<div class="stat"><div class="num" style="color:var(--warn)">' + stats.wrongBookCount + '</div><div class="label">错题</div></div>';
    html += '</div>';

    // By type
    html += '<div style="margin-top:12px"><h3 style="font-size:.88rem;margin-bottom:8px">📊 各题型正确率</h3><div class="stats">';
    html += '<div class="stat"><div class="num" style="font-size:1rem">' + (stats.byType.judge.t ? Math.round(stats.byType.judge.c / stats.byType.judge.t * 100) : 0) + '%</div><div class="label">判断 (' + stats.byType.judge.c + '/' + stats.byType.judge.t + ')</div></div>';
    html += '<div class="stat"><div class="num" style="font-size:1rem">' + (stats.byType.single.t ? Math.round(stats.byType.single.c / stats.byType.single.t * 100) : 0) + '%</div><div class="label">单选 (' + stats.byType.single.c + '/' + stats.byType.single.t + ')</div></div>';
    html += '<div class="stat"><div class="num" style="font-size:1rem">' + (stats.byType.multi.t ? Math.round(stats.byType.multi.c / stats.byType.multi.t * 100) : 0) + '%</div><div class="label">多选 (' + stats.byType.multi.c + '/' + stats.byType.multi.t + ')</div></div>';
    html += '</div></div>';

    // Weekly stats
    html += '<div style="margin-top:12px"><h3 style="font-size:.88rem;margin-bottom:8px">📅 本周统计</h3><div class="stats">';
    html += '<div class="stat"><div class="num">' + stats.weekTotal + '</div><div class="label">本周答题</div></div>';
    html += '<div class="stat"><div class="num" style="color:' + (stats.weekRate >= 60 ? 'var(--correct)' : 'var(--wrong)') + '">' + stats.weekRate + '%</div><div class="label">本周正确率</div></div>';
    html += '<div class="stat"><div class="num">' + stats.historyCount + '</div><div class="label">考试/练习次数</div></div>';
    html += '</div></div>';

    // Activity heatmap (last 12 weeks)
    html += '<div style="margin-top:14px"><h3 style="font-size:.88rem;margin-bottom:8px">🔥 学习热力图（近12周）</h3>';
    html += '<div class="calendar-grid" style="grid-template-columns:repeat(12,1fr)">';
    const days = Object.keys(dailyActivity).sort().reverse().slice(0, 84);
    for (let i = 0; i < Math.min(84, days.length); i++) {
      const d = dailyActivity[days[i]];
      let level = 0;
      if (d && d.total > 0) {
        if (d.total >= 20) level = 4;
        else if (d.total >= 12) level = 3;
        else if (d.total >= 6) level = 2;
        else level = 1;
      }
      const dateLabel = days[i] ? days[i].slice(5) : '';
      const title = days[i] + ': ' + (d ? d.total + '题, ' + (d.total > 0 ? Math.round(d.correct / d.total * 100) : 0) + '%' : '无记录');
      html += '<div class="calendar-cell level-' + level + '" title="' + title + '">' + dateLabel + '</div>';
    }
    html += '</div>';
    html += '<div style="display:flex;gap:4px;align-items:center;font-size:.65rem;color:var(--muted);margin-top:4px;justify-content:flex-end">';
    html += '<span>少</span>';
    html += '<span class="calendar-cell level-0" style="width:12px;height:12px;aspect-ratio:auto"></span>';
    html += '<span class="calendar-cell level-1" style="width:12px;height:12px;aspect-ratio:auto"></span>';
    html += '<span class="calendar-cell level-2" style="width:12px;height:12px;aspect-ratio:auto"></span>';
    html += '<span class="calendar-cell level-3" style="width:12px;height:12px;aspect-ratio:auto"></span>';
    html += '<span class="calendar-cell level-4" style="width:12px;height:12px;aspect-ratio:auto"></span>';
    html += '<span>多</span></div></div>';

    // Recent history
    html += '<div style="margin-top:14px"><h3 style="font-size:.88rem;margin-bottom:8px">📜 最近记录</h3>';
    const recentHistory = history.slice(0, 10);
    if (recentHistory.length === 0) {
      html += '<p style="color:var(--muted);font-size:.82rem">暂无记录</p>';
    } else {
      for (let i = 0; i < recentHistory.length; i++) {
        const h = recentHistory[i];
        const rate = h.total > 0 ? Math.round(h.correct / h.total * 100) : 0;
        const modeIcon = h.mode === 'exam' ? '📝' : '📖';
        const modeName = h.mode === 'exam' ? '考试' : '练习';
        html += '<div class="review-item ' + (rate >= 60 ? 'ri-correct' : 'ri-wrong') + '">';
        html += '<div class="ri-text">' + modeIcon + ' ' + modeName + ' — ' + h.correct + '/' + h.total + ' (' + rate + '%)';
        if (h.duration > 0) {
          html += ' · 用时' + formatTime(h.duration);
        }
        html += '</div>';
        html += '<div class="ri-meta">' + formatDate(h.date) + ' · ' + (h.typeFilter === 'all' ? '全部' : (h.typeFilter === 'judge' ? '判断题' : (h.typeFilter === 'single' ? '单选题' : '多选题'))) + '</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    // Export/Import buttons
    html += '<div class="btn-row" style="margin-top:16px;justify-content:center">';
    html += '<button class="btn btn-secondary btn-sm" onclick="App.exportData()">📤 导出数据</button>';
    html += '<button class="btn btn-secondary btn-sm" onclick="App.importData()">📥 导入数据</button>';
    html += '<button class="btn btn-danger btn-sm" onclick="App.resetData()">🔄 重置全部</button>';
    html += '</div>';

    c.innerHTML = html;
  }

  // ==================== Search ====================
  function renderSearch(c) {
    let html = '<div class="search-bar">';
    html += '<span class="search-icon">🔍</span>';
    html += '<input type="text" id="searchInputPage" placeholder="搜索题目关键词..." value="' + esc(state.searchQuery) + '" oninput="App.doSearch(this.value)">';
    html += '</div>';

    if (state.searchQuery) {
      const results = getFiltered();
      html += '<p style="color:var(--muted);font-size:.8rem;margin-bottom:8px">找到 ' + results.length + ' 道相关题目</p>';
      if (results.length === 0) {
        html += '<div class="empty"><div class="icon">🔍</div><p>没有找到相关题目</p></div>';
      } else {
        for (let i = 0; i < Math.min(results.length, 50); i++) {
          const q = results[i];
          const qIdx = ALL_QUESTIONS.indexOf(q);
          const a = Storage.getAnswer(qIdx);
          const isFav = Storage.isFavorite(qIdx);
          html += '<div class="review-item' + (a ? (a.isCorrect ? ' ri-correct' : ' ri-wrong') : '') + '" onclick="App.searchJump(' + qIdx + ')" style="cursor:pointer">';
          html += '<div class="ri-text">' + typeLabel(q.type) + ' ' + esc(q.text);
          if (isFav) html += ' ⭐';
          html += '</div>';
          if (a) {
            html += '<div class="ri-meta">' + (a.isCorrect ? '✅ ' : '❌ ') + '答案：' + esc(getAnswerText(qIdx)) + '</div>';
          }
          html += '</div>';
        }
      }
    } else {
      html += '<div class="empty"><div class="icon">🔍</div><p>输入关键词搜索题库</p><p style="font-size:.75rem;color:var(--muted)">支持搜索题干、选项内容</p></div>';
    }

    c.innerHTML = html;
  }

  function doSearch(query) {
    state.searchQuery = query;
    render();
  }

  function searchJump(qIdx) {
    state.queue = [qIdx];
    state.currentIdx = 0;
    state.selected = {};
    state.searchQuery = '';
    navigate('practice');
  }

  // ==================== Favorites ====================
  function renderFavorites(c) {
    const favIds = Storage.getFavoriteIds();
    if (favIds.length === 0) {
      c.innerHTML = '<div class="empty"><div class="icon">⭐</div><p>还没有收藏的题目</p><p style="font-size:.8rem;color:var(--muted)">刷题时点击 ⭐ 即可收藏</p></div>';
      return;
    }

    let html = '<p style="color:var(--muted);font-size:.82rem;margin-bottom:8px">共收藏 <strong>' + favIds.length + '</strong> 道题</p>';
    html += '<div class="btn-row"><button class="btn btn-primary" onclick="App.practiceFavs()">📝 刷收藏题</button></div>';

    for (let i = 0; i < favIds.length; i++) {
      const qIdx = favIds[i];
      const q = ALL_QUESTIONS[qIdx];
      const a = Storage.getAnswer(qIdx);
      html += '<div class="review-item' + (a ? (a.isCorrect ? ' ri-correct' : ' ri-wrong') : '') + '">';
      html += '<div class="ri-text">' + typeLabel(q.type) + ' ' + esc(q.text) + '</div>';
      html += '<div class="ri-meta">';
      if (a) {
        html += '<span>' + (a.isCorrect ? '✅' : '❌') + ' 答案：' + esc(getAnswerText(qIdx)) + '</span>';
      } else {
        html += '<span>未作答</span>';
      }
      html += '<span style="cursor:pointer;color:var(--warn)" onclick="event.stopPropagation();App.toggleFav(' + qIdx + ');App.render()">取消收藏</span>';
      html += '</div></div>';
    }
    c.innerHTML = html;
  }

  function practiceFavs() {
    const favIds = Storage.getFavoriteIds();
    state.queue = shuffle(favIds);
    state.currentIdx = 0;
    state.selected = {};
    navigate('practice');
  }

  // ==================== Settings ====================
  function renderSettings(c) {
    const settings = Storage.getSettings();
    const storageSize = Storage.getStorageSize();

    let html = '<div class="settings-section">';
    html += '<h3>⚙️ 考试设置</h3>';
    html += '<div class="setting-row"><span>题目数量</span><span>';
    html += '<input type="number" value="' + settings.examCount + '" min="10" max="200" step="10" style="width:70px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);text-align:center" onchange="App.updateSetting(\'examCount\',parseInt(this.value))"> 题</span></div>';
    html += '<div class="setting-row"><span>考试时间</span><span>';
    html += '<input type="number" value="' + settings.examTime + '" min="10" max="180" step="5" style="width:70px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--text);text-align:center" onchange="App.updateSetting(\'examTime\',parseInt(this.value))"> 分钟</span></div>';
    html += '</div>';

    html += '<div class="settings-section">';
    html += '<h3>🎯 刷题设置</h3>';
    html += '<div class="setting-row"><span>显示题目解析</span><span class="toggle' + (settings.showExplanation ? ' on' : '') + '" onclick="App.toggleSetting(\'showExplanation\')"></span></div>';
    html += '</div>';

    html += '<div class="settings-section">';
    html += '<h3>📊 数据管理</h3>';
    html += '<div class="setting-row"><span>存储空间</span><span style="font-size:.8rem;color:var(--muted)">' + (storageSize / 1024).toFixed(1) + ' KB</span></div>';
    html += '<div class="btn-row" style="margin-top:8px">';
    html += '<button class="btn btn-secondary btn-sm" onclick="App.exportData()">📤 导出数据</button>';
    html += '<button class="btn btn-secondary btn-sm" onclick="App.importData()">📥 导入数据</button>';
    html += '<button class="btn btn-danger btn-sm" onclick="App.resetData()">🔄 重置全部</button>';
    html += '</div></div>';

    html += '<div class="settings-section">';
    html += '<h3>ℹ️ 关于</h3>';
    html += '<p style="font-size:.8rem">军事理论应知应会刷题系统 v2.0</p>';
    html += '<p style="font-size:.78rem">题库来源：2526B军事理论应知应会（本科2026.5）</p>';
    html += '<p style="font-size:.78rem">共 427 题（判断 169 + 单选 143 + 多选 115）</p>';
    html += '<p style="font-size:.78rem;margin-top:4px">💡 数据存储在浏览器本地，建议定期导出备份</p>';
    html += '</div>';

    c.innerHTML = html;
  }

  function updateSetting(key, value) {
    Storage.updateSetting(key, value);
    showToast('设置已保存');
  }

  function toggleSetting(key) {
    const settings = Storage.getSettings();
    Storage.updateSetting(key, !settings[key]);
    render();
  }

  // ==================== Data Export/Import ====================
  function exportData() {
    const data = Storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '军事理论刷题_备份_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('数据已导出 ✅');
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function() {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          Storage.importData(data);
          showToast('数据已导入 ✅');
          updateStats();
          render();
        } catch (err) {
          showToast('导入失败：' + err.message + ' ❌');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function resetData() {
    if (!confirm('确定要清除所有答题记录、错题本、收藏和历史吗？\n\n此操作不可恢复！建议先导出数据备份。')) return;
    Storage.clearAnswered();
    Storage.clearHistory();
    localStorage.removeItem('mt_favorites');
    updateStats();
    navigate('practice');
    showToast('所有记录已重置');
  }

  // ==================== Init ====================
  function init() {
    // Desktop tab listeners
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', function() {
        const page = this.dataset.page;
        if (page === 'practice') startPractice();
        else if (page === 'exam') startExam();
        else navigate(page);
      });
    });

    // Mobile nav listeners
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', function() {
        const page = this.dataset.page;
        if (page === 'practice') startPractice();
        else if (page === 'exam') startExam();
        else navigate(page);
      });
    });

    // Filter chip listeners
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', function() {
        setTypeFilter(this.dataset.type);
      });
    });

    // Start
    startPractice();

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (state.page === 'practice' && state.queue.length > 0 && state.currentIdx < state.queue.length) {
        const qIdx = state.queue[state.currentIdx];
        const q = ALL_QUESTIONS[qIdx];
        if (Storage.isAnswered(qIdx)) {
          if (e.key === 'ArrowRight' || e.key === 'n') { e.preventDefault(); nextQuestion(); }
          if (e.key === 'ArrowLeft' || e.key === 'p') {
            e.preventDefault();
            if (state.currentIdx > 0) { state.currentIdx--; render(); }
          }
          return;
        }
        if (q.type === 'judge') {
          if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); selectJudge(qIdx, '√'); }
          if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); selectJudge(qIdx, '×'); }
        } else if (q.type === 'single') {
          const keyMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 };
          const idx = keyMap[e.key];
          if (idx !== undefined && q.options[idx]) {
            e.preventDefault();
            selectOption(qIdx, q.options[idx].label, false);
          }
        }
      }
    });
  }

  // ==================== Public API ====================
  window.App = {
    navigate,
    setTypeFilter,
    startPractice,
    startExam,
    submitExam,
    examSelect,
    examSelectOpt,
    practiceWrong,
    clearWrong,
    wrongSort,
    practiceFavs,
    selectJudge,
    selectOption,
    submitAnswer,
    nextQuestion,
    retryQuestion,
    toggleFav,
    render: () => render(),
    doSearch,
    searchJump,
    exportData,
    importData,
    resetData,
    updateSetting,
    toggleSetting,
    renderReview: () => render(),
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
