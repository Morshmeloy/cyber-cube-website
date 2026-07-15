'use strict';

/**
 * Основной класс приложения-теста.
 * Управляет состоянием, рендерингом экранов, навигацией, проверкой ответов
 * и сохранением прогресса в localStorage.
 */
class QuizApp {

    /**
     * @param {Array} questions — массив вопросов из questions.js.
     *   Каждый вопрос должен иметь поля: id, q, o (массив строк), a (массив индексов), src (источник).
     */
    constructor(questions) {
        // Базовая валидация данных
        if (!Array.isArray(questions) || questions.length === 0) {
            document.getElementById('app').innerHTML = `
                <div style="text-align:center;margin-top:4rem;color:var(--text2)">
                    <h2>Ошибка загрузки вопросов</h2>
                    <p>Файл questions.js пуст или имеет неверный формат.</p>
                </div>`;
            throw new Error('QuizApp: массив вопросов пуст или отсутствует');
        }

        this.questions = questions.map(q => ({
            ...q,
            multi: q.a.length > 1,
            correctIndices: q.a
        }));
        this.state = {
            mode: 'all',          // 'all' | 'random' | 'wrong'
            order: [],            // порядок индексов вопросов
            currentIndex: 0,
            answers: new Map()    // Map<questionId, {selected, checked, correct}>
        };
        this.wrongIds = [];       // ID вопросов с неверными ответами для режима "Только ошибки"
        this.storageAvailable = this.isStorageAvailable();
        if (!this.storageAvailable) {
            console.warn('localStorage недоступен. Прогресс не будет сохранён.');
        }
        this.animTimer = null;    // таймер для анимации кольца на странице результатов
        this.initTheme();         // создаём плавающую кнопку переключения темы
        this.checkSavedProgress(); // проверяем, есть ли незавершённый тест
    }

    /* Проверяет доступность localStorage (может быть заблокирован в приватном режиме) */
    isStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /** Инициализирует тему (тёмная/светлая/синтвейв) и добавляет плавающую кнопку переключения */
    initTheme() {
        const savedTheme = localStorage.getItem('quizTheme');
        const validThemes = ['light', 'dark', 'synthwave'];
        // Применяем сохранённую тему или удаляем атрибут (тогда работает системная тема)
        if (savedTheme && validThemes.includes(savedTheme)) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        const btn = document.createElement('button');
        btn.className = 'theme-toggle-floating';
        btn.setAttribute('aria-label', 'Переключить тему');

        /** Обновляет текст на кнопке в зависимости от текущей темы */
        const updateButtonText = () => {
            const current = document.documentElement.getAttribute('data-theme');
            // Если тема не выбрана вручную, ориентируемся на системные настройки
            const isLight = !current
                ? window.matchMedia('(prefers-color-scheme: light)').matches
                : current === 'light';
            const isSynthwave = current === 'synthwave';

            if (isSynthwave) btn.textContent = '🌆 Синтвейв';
            else if (isLight) btn.textContent = '☀️ Светлая';
            else btn.textContent = '🌙 Тёмная';
        };
        updateButtonText();

        // Циклическое переключение: dark → light → synthwave → dark
        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            let next = 'dark';
            if (current === 'dark') next = 'light';
            else if (current === 'light') next = 'synthwave';
            else next = 'dark';

            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('quizTheme', next);
            updateButtonText();
        });

        document.body.appendChild(btn);
    }

    /**
     * Проверяет наличие сохранённого прогресса в localStorage.
     * Если есть — показывает диалог восстановления, иначе отрисовывает стартовый экран.
     */
    checkSavedProgress() {
        if (!this.storageAvailable) { this.renderStart(); return; }
        const saved = localStorage.getItem('quizState');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.order && parsed.order.length > 0 && Object.keys(parsed.answers || {}).length > 0) {
                    this.showResumeDialog();
                    return;
                }
            } catch (e) { /* битые данные — игнорируем */ }
        }
        this.renderStart();
    }

    /**
     * Показывает модальное окно с предложением продолжить или начать заново.
     * Реализована фокус-ловушка для доступности.
     */
    showResumeDialog() {
        const overlay = document.createElement('div');
        overlay.className = 'resume-dialog-overlay';
        overlay.innerHTML = `
            <div class="resume-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
                <h3 id="dialog-title">Незавершённый тест</h3>
                <p>У вас есть несохранённый прогресс. Хотите продолжить?</p>
                <div class="resume-dialog-buttons">
                    <button class="btn-primary" data-action="resume-yes">Продолжить</button>
                    <button class="btn-secondary" data-action="resume-no">Начать заново</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        const firstBtn = overlay.querySelector('[data-action="resume-yes"]');
        if (firstBtn) firstBtn.focus();

        // Фокус-ловушка: Tab и Shift+Tab циклически перемещают фокус внутри диалога
        const trapFocus = (e) => {
            const focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            } else if (e.key === 'Escape') { this.handleResumeNo(overlay); }
        };
        overlay.addEventListener('keydown', trapFocus);
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.dataset.action === 'resume-yes') this.handleResumeYes(overlay);
            else if (btn.dataset.action === 'resume-no') this.handleResumeNo(overlay);
        });
    }

    handleResumeYes(overlay) {
        document.body.removeChild(overlay);
        this.loadProgress();
        this.state.order.length > 0 ? this.renderQuiz() : this.renderStart();
    }

    handleResumeNo(overlay) {
        document.body.removeChild(overlay);
        localStorage.removeItem('quizState');  // удаляем старый прогресс
        this.renderStart();
    }

    /** Сохраняет текущее состояние теста в localStorage */
    saveProgress() {
        if (!this.storageAvailable) return;
        try {
            const serializable = {
                mode: this.state.mode,
                order: this.state.order,
                currentIndex: this.state.currentIndex,
                answers: Array.from(this.state.answers.entries())
            };
            localStorage.setItem('quizState', JSON.stringify(serializable));
        } catch (e) { console.warn('Не удалось сохранить прогресс.'); }
    }

    /** Загружает состояние из localStorage (вызывается только при восстановлении сессии) */
    loadProgress() {
        if (!this.storageAvailable) return;
        try {
            const saved = localStorage.getItem('quizState');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state.mode = parsed.mode || 'all';
                this.state.order = parsed.order || [];
                this.state.currentIndex = parsed.currentIndex || 0;
                this.state.answers = new Map(parsed.answers);
            }
        } catch (e) { console.warn('Ошибка загрузки прогресса.'); }
    }

    /** Безопасное экранирование HTML-сущностей для защиты от XSS */
    escapeHtml(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Отрисовывает стартовый экран с выбором режима */
    renderStart() {
        const total = this.questions.length;
        const multiCount = this.questions.filter(q => q.multi).length;
        let description = `${total} вопросов по материалам книги.`;
        if (multiCount > 0) description += ` Вопросы с несколькими правильными ответами отмечены специальным значком.`;

        // Здесь и далее используется innerHTML для рендеринга статических экранов.
        // Это безопасно, потому что все вставляемые значения проходят через escapeHtml().
        document.getElementById('app').innerHTML = `
            <div id="start-screen">
                <div class="brand-banner">
                    <h1 class="brand-title"><span class="brand-mark">CS</span><span class="brand-name">Сети</span></h1>
                    <div class="brand-line" aria-hidden="true"></div>
                </div>
                <div class="start-card">
                    <div class="start-badge">Таненбаум, 6-е изд.</div>
                    <h2>Тест по компьютерным сетям</h2>
                    <p>${description}</p>
                    <div class="start-stats">
                        <div class="start-stat"><div class="start-stat-num">${total}</div><div class="start-stat-label">вопросов</div></div>
                        ${multiCount > 0 ? `<div class="start-stat"><div class="start-stat-num">${multiCount}</div><div class="start-stat-label">мульти-ответов</div></div>` : ''}
                        <div class="start-stat"><div class="start-stat-num">∞</div><div class="start-stat-label">попыток</div></div>
                    </div>
                    <div class="mode-select">
                        <label>Режим прохождения:</label>
                        <div class="mode-btns" id="mode-btns">
                            <button class="mode-btn active" data-mode="all">Все вопросы</button>
                            <button class="mode-btn" data-mode="random">Случайный порядок</button>
                            <button class="mode-btn" data-mode="wrong">Только ошибки</button>
                        </div>
                    </div>
                    <button class="btn-primary" id="start-btn">Начать тестирование →</button>
                </div>
            </div>
        `;
        document.getElementById('mode-btns').addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.mode = e.target.dataset.mode;
            }
        });
        document.getElementById('start-btn').addEventListener('click', () => this.startQuiz());
    }

    /** Запускает тест: формирует порядок вопросов и сбрасывает прогресс */
    startQuiz() {
        localStorage.removeItem('quizState');  // всегда начинаем с чистого листа
        const indices = this.questions.map((_, i) => i);
        if (this.state.mode === 'all') this.state.order = [...indices];
        else if (this.state.mode === 'random') this.state.order = indices.sort(() => Math.random() - 0.5);
        else if (this.state.mode === 'wrong') this.state.order = this.wrongIds.length > 0 ? [...this.wrongIds] : [...indices];
        this.state.currentIndex = 0;
        this.state.answers.clear();
        this.saveProgress();
        this.renderQuiz();
    }

    countCorrect() { let cnt = 0; this.state.answers.forEach(a => { if (a.checked && a.correct) cnt++; }); return cnt; }
    countDone() { let cnt = 0; this.state.answers.forEach(a => { if (a.checked) cnt++; }); return cnt; }

    /** Главный метод рендеринга вопроса и навигации */
    renderQuiz() {
        if (this.animTimer) clearTimeout(this.animTimer);
        const total = this.state.order.length;
        if (total === 0) { this.renderStart(); return; }
        const qIndex = this.state.order[this.state.currentIndex];
        const q = this.questions[qIndex];
        const ans = this.state.answers.get(q.id);
        const checked = ans ? ans.checked : false;

        const html = `
            <div id="quiz-screen">
                <header class="header">
                    <div class="header-logo" role="img" aria-label="CS"></div>
                    <div>
                        <div class="header-title">Компьютерные сети — Таненбаум</div>
                        <div class="header-sub">Вопрос ${this.state.currentIndex + 1} из ${total}</div>
                    </div>
                    <div class="header-right">
                        <div class="progress-chip"><span class="score-num score-num--ok">${this.countCorrect()}</span> верно / <span class="score-num score-num--done">${this.countDone()}</span> отвечено</div>
                        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${(this.countDone() / total) * 100}%" role="progressbar" aria-valuenow="${this.countDone()}" aria-valuemin="0" aria-valuemax="${total}"></div></div>
                    </div>
                </header>
                <div class="quiz-layout">
                    <nav class="q-nav" aria-label="Навигация по вопросам">
                        <button class="q-nav-btn" id="btn-prev" ${this.state.currentIndex === 0 ? 'disabled' : ''}>← Назад</button>
                        <div class="q-counter">${this.state.currentIndex + 1} / ${total}</div>
                        <button class="q-nav-btn" id="btn-next" ${this.state.currentIndex === total - 1 ? 'disabled' : ''}>Вперёд →</button>
                    </nav>
                    <article class="question-card" aria-label="Вопрос">
                        <div class="q-meta">
                            <span class="q-num" tabindex="-1">Вопрос ${q.id}</span>
                            ${q.multi ? '<span class="q-multi-badge">⊞ Несколько ответов</span>' : ''}
                        </div>
                        <div class="q-text">${this.escapeHtml(q.q)}</div>
                    </article>
                    <fieldset class="options" id="options-container" aria-label="Варианты ответа"></fieldset>
                    <div class="q-actions">
                        <button class="btn-check" id="btn-check" ${(!ans || ans.selected.length === 0) ? 'disabled' : ''}>Проверить</button>
                        <button class="btn-next-q" id="btn-next-question" style="display:${checked ? '' : 'none'}">Следующий →</button>
                        <button class="btn-skip" id="btn-skip">Пропустить</button>
                        <button class="btn-skip" id="btn-finish" style="margin-left:auto">Завершить тест</button>
                    </div>
                    <div class="feedback" id="feedback" role="status" aria-live="polite"></div>
                    <div class="q-map-wrap" style="margin-top:20px">
                        <div class="q-map-title">Карта вопросов</div>
                        <div class="q-map" id="q-map"></div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;

        // Назначаем обработчики заново, так как DOM полностью обновился
        document.getElementById('btn-prev').addEventListener('click', () => this.navigate(-1));
        document.getElementById('btn-next').addEventListener('click', () => this.navigate(1));
        document.getElementById('btn-check').addEventListener('click', () => this.checkAnswer());
        document.getElementById('btn-next-question').addEventListener('click', () => this.navigate(1));
        document.getElementById('btn-skip').addEventListener('click', () => this.skipQuestion());
        document.getElementById('btn-finish').addEventListener('click', () => this.finishQuiz());

        this.renderOptions(q);
        this.renderMap();
        this.renderFeedback(q);

        // Переводим фокус на номер вопроса для скринридеров
        const heading = document.querySelector('.q-num');
        if (heading) heading.focus();
    }

    /** Отрисовывает варианты ответов для текущего вопроса */
    renderOptions(q) {
        const container = document.getElementById('options-container');
        container.innerHTML = '';
        const ans = this.state.answers.get(q.id);
        const checked = ans ? ans.checked : false;

        // Скрытый legend для screen reader
        const legend = document.createElement('legend');
        legend.textContent = 'Варианты ответа';
        legend.style.cssText = 'position:absolute;left:-9999px';
        container.appendChild(legend);

        q.o.forEach((opt, oi) => {
            const div = document.createElement('div');
            let cls = 'option';
            if (q.multi) cls += ' is-checkbox';
            const isSelected = ans && ans.selected.includes(oi);
            if (isSelected) cls += ' selected';
            if (checked) {
                const isCorrect = q.correctIndices.includes(oi);
                if (isCorrect && isSelected) cls += ' correct';
                else if (!isCorrect && isSelected) cls += ' wrong';
                else if (isCorrect && !isSelected) cls += ' missed';
                cls += ' disabled';
            }
            div.className = cls;
            div.setAttribute('role', q.multi ? 'checkbox' : 'radio');
            div.setAttribute('aria-checked', isSelected);
            div.setAttribute('tabindex', '0');
            div.innerHTML = `<div class="opt-indicator">${isSelected ? '✓' : ''}</div><span>${this.escapeHtml(opt)}</span>`;
            div.addEventListener('click', () => this.toggleOption(q, oi));
            div.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.toggleOption(q, oi); }
            });
            container.appendChild(div);
        });
    }

    /** Выбирает или снимает выбор с варианта ответа */
    toggleOption(q, oi) {
        let ans = this.state.answers.get(q.id);
        if (ans && ans.checked) return;  // после проверки менять нельзя
        if (!ans) ans = { selected: [], checked: false, correct: false };
        if (q.multi) {
            const idx = ans.selected.indexOf(oi);
            idx === -1 ? ans.selected.push(oi) : ans.selected.splice(idx, 1);
        } else {
            ans.selected = [oi];
        }
        this.state.answers.set(q.id, ans);
        const btn = document.getElementById('btn-check');
        if (btn) btn.disabled = ans.selected.length === 0;
        this.renderOptions(q);
    }

    /** Проверяет ответ и запускает анимацию shake/glitch при ошибке */
    checkAnswer() {
        const q = this.getCurrentQuestion();
        if (!q) return;
        const ans = this.state.answers.get(q.id);
        if (!ans || ans.selected.length === 0) return;

        const selectedSorted = ans.selected.slice().sort().toString();
        const correctSorted = q.correctIndices.slice().sort().toString();
        const isCorrect = (selectedSorted === correctSorted);

        ans.checked = true;
        ans.correct = isCorrect;
        this.state.answers.set(q.id, ans);
        this.saveProgress();
        this.renderQuiz();

        // Визуальные эффекты при неверном ответе
        if (!isCorrect) {
            setTimeout(() => {
                const correctOption = document.querySelector('.option.correct');
                if (correctOption) {
                    correctOption.classList.add('glitch-effect');
                    setTimeout(() => correctOption.classList.remove('glitch-effect'), 300);
                }
                const wrongOption = document.querySelector('.option.wrong');
                if (wrongOption) {
                    wrongOption.classList.add('shake-effect');
                    setTimeout(() => wrongOption.classList.remove('shake-effect'), 300);
                }
            }, 50);
        }
    }

    skipQuestion() {
        const q = this.getCurrentQuestion();
        if (q && !this.state.answers.has(q.id)) {
            this.state.answers.set(q.id, { selected: [], checked: false, correct: false, skipped: true });
        }
        this.navigate(1);
    }

    navigate(dir) {
        const idx = this.state.currentIndex + dir;
        if (idx < 0 || idx >= this.state.order.length) return;
        this.state.currentIndex = idx;
        this.saveProgress();
        this.renderQuiz();
    }

    jumpTo(index) {
        if (index < 0 || index >= this.state.order.length) return;
        this.state.currentIndex = index;
        this.saveProgress();
        this.renderQuiz();
    }

    getCurrentQuestion() {
        return this.questions[this.state.order[this.state.currentIndex]];
    }

    renderFeedback(q) {
        const fb = document.getElementById('feedback');
        if (!fb) return;
        const ans = this.state.answers.get(q.id);
        fb.className = 'feedback';
        fb.innerHTML = '';
        if (ans && ans.checked) {
            fb.classList.add('show');
            if (ans.correct) {
                fb.classList.add('ok'); fb.innerHTML = '<div>✓ Правильно!</div>';
            } else {
                fb.classList.add('fail');
                const txt = q.correctIndices.map(i => q.o[i]).join('; ');
                fb.innerHTML = `<div>✗ Неверно. Правильный ответ: ${this.escapeHtml(txt)}</div>`;
            }
            if (q.src) fb.innerHTML += `<div class="feedback-source">${this.escapeHtml(q.src)}</div>`;
        }
    }

    renderMap() {
        const map = document.getElementById('q-map');
        if (!map) return;
        map.innerHTML = '';
        this.state.order.forEach((qid, i) => {
            const ans = this.state.answers.get(this.questions[qid].id);
            let cls = 'q-dot-button';
            if (i === this.state.currentIndex) cls += ' current';
            else if (ans && ans.checked) cls += ans.correct ? ' answered-ok' : ' answered-fail';
            else if (ans && ans.skipped) cls += ' skipped';
            const btn = document.createElement('button');
            btn.className = cls;
            btn.setAttribute('aria-label', `Вопрос ${i + 1}`);
            btn.dataset.index = i;
            btn.textContent = i + 1;
            btn.addEventListener('click', () => this.jumpTo(i));
            map.appendChild(btn);
        });
    }

    finishQuiz() {
        if (this.animTimer) clearTimeout(this.animTimer);
        const total = this.state.order.length;
        const done = this.countDone();
        const correct = this.countCorrect();
        const skipped = total - done;
        const wrong = done - correct;
        this.wrongIds = [];
        this.state.order.forEach(qid => {
            const ans = this.state.answers.get(this.questions[qid].id);
            if (ans && ans.checked && !ans.correct) this.wrongIds.push(qid);
        });
        // Собираем детали ошибок для отправки учителю
        const mistakesForChat = [];
        this.state.order.forEach(qid => {
            const q = this.questions[qid];
            const ans = this.state.answers.get(q.id);
            if (ans && ans.checked && !ans.correct) {
                mistakesForChat.push({
                    id: q.id,
                    question: q.q,
                    options: q.o,
                    correct: q.correctIndices[0],
                    userAnswer: ans.selected.length > 0 ? ans.selected[0] : null,
                    src: q.src || ''
                });
            }
        });
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
        let title = 'Тест завершён';
        if (pct >= 90) title = 'Отличный результат!';
        else if (pct >= 70) title = 'Хороший результат';
        else if (pct >= 50) title = 'Можно лучше';
        else title = 'Нужно повторить материал';

        // Инлайн-стиль для кнопки заменён классом .btn-restart
        document.getElementById('app').innerHTML = `
            <div id="results-screen">
                <div class="results-hero">
                    <div class="results-score-ring">
                        <svg viewBox="0 0 120 120" role="img" aria-label="Результат ${pct}%">
                            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="10"/>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#5b7fff" stroke-width="10"
                                stroke-linecap="round" stroke-dasharray="314" id="score-arc" stroke-dashoffset="314"/>
                        </svg>
                        <div class="results-score-text">${pct}%</div>
                    </div>
                    <h2 class="results-title">${title}</h2>
                    <p class="results-sub">Отвечено: ${done} из ${total}</p>
                    <div class="results-stats">
                        <div class="results-stat"><div class="results-stat-num g">${correct}</div><div class="results-stat-label">Верно</div></div>
                        <div class="results-stat"><div class="results-stat-num r">${wrong}</div><div class="results-stat-label">Неверно</div></div>
                        <div class="results-stat"><div class="results-stat-num y">${skipped}</div><div class="results-stat-label">Пропущено</div></div>
                        <div class="results-stat"><div class="results-stat-num">${total}</div><div class="results-stat-label">Всего</div></div>
                    </div>
                </div>
                <div class="results-actions">
                    <button class="btn-primary btn-restart" id="btn-restart">Пройти заново</button>
                    <button class="btn-secondary" id="btn-retry" ${this.wrongIds.length === 0 ? 'disabled' : ''}>Повторить ошибки</button>
                    <button class="btn-secondary" id="btn-chat" ${mistakesForChat.length === 0 ? 'style="display:none"' : ''}>🧑‍🏫 Объяснить ошибки</button>
                    <button class="btn-secondary" id="btn-show-results">Подробный разбор</button>
                </div>
                <div class="results-detail" id="results-detail" style="display:none">
                    <h3>Разбор по вопросам</h3>
                    <div id="results-list"></div>
                </div>
            </div>
        `;
        document.getElementById('btn-restart').addEventListener('click', () => this.restartQuiz());
        document.getElementById('btn-retry').addEventListener('click', () => this.retryWrong());
        document.getElementById('btn-show-results').addEventListener('click', () => this.showResults());
        const chatBtn = document.getElementById('btn-chat');
        if (chatBtn && mistakesForChat.length > 0) {
            chatBtn.addEventListener('click', () => this.openTeacherChat(mistakesForChat));
        }


        this.animTimer = setTimeout(() => {
            const arc = document.getElementById('score-arc');
            if (arc) { arc.style.transition = 'stroke-dashoffset 1s ease'; arc.style.strokeDashoffset = 314 - (314 * pct / 100); }
        }, 100);
    }

    restartQuiz() {
        localStorage.removeItem('quizState');
        this.state.order = []; this.state.answers.clear();
        if (this.animTimer) clearTimeout(this.animTimer);
        this.renderStart();
    }

    retryWrong() {
        if (this.wrongIds.length === 0) return;
        localStorage.removeItem('quizState');
        this.state.order = [...this.wrongIds]; this.state.currentIndex = 0; this.state.answers.clear();
        this.saveProgress(); this.renderQuiz();
    }

    showResults() {
        const detail = document.getElementById('results-detail');
        const list = document.getElementById('results-list');
        if (detail.style.display === 'block') { detail.style.display = 'none'; return; }
        detail.style.display = 'block';
        list.innerHTML = this.state.order.map(qid => {
            const q = this.questions[qid];
            const ans = this.state.answers.get(q.id);
            let status = 'skip', badge = '?', badgeCls = 'skip';
            if (ans && ans.checked) {
                status = ans.correct ? 'ok' : 'fail';
                badge = ans.correct ? '✓' : '✗';
                badgeCls = ans.correct ? 'ok' : 'fail';
            }
            const ansRows = q.o.map((opt, oi) => {
                const isCor = q.correctIndices.includes(oi);
                const isSel = ans && ans.selected.includes(oi);
                let cls = 'r-neutral', icon = '○';
                if (isCor && isSel) { cls = 'r-ok'; icon = '✓'; }
                else if (isSel && !isCor) { cls = 'r-fail'; icon = '✗'; }
                else if (isCor && !isSel) { cls = 'r-miss'; icon = '!'; }
                return `<div class="result-ans-row ${cls}"><span>${icon}</span><span>${this.escapeHtml(opt)}</span></div>`;
            }).join('');
            const srcBlock = q.src ? `<div class="result-source"><strong>Источник:</strong> ${this.escapeHtml(q.src)}</div>` : '';
            return `<div class="result-item">
                <div class="result-item-head">
                    <div class="result-badge ${badgeCls}">${badge}</div>
                    <div>
                        <div class="result-q-num">Вопрос ${q.id}</div>
                        <div class="result-q-text">${this.escapeHtml(q.q)}</div>
                    </div>
                </div>
                <div class="result-answers">${ansRows}</div>
                ${srcBlock}
            </div>`;
        }).join('');
    }

    /**
 * Открывает полноэкранное модальное окно с разбором ошибок и чатом учителя.
 * @param {Array} mistakes – массив объектов с полями id, question, options, correct, src.
 */
    async openTeacherChat(mistakes) {
        // 1. Создаём оверлей и модальное окно
        const overlay = document.createElement('div');
        overlay.className = 'chat-overlay';
        // Собираем HTML для разбора ошибок
        const mistakesHtml = mistakes.map(m => {
            const userAnswer = m.options[m.userAnswer] || '(не выбрано)';
            const correctAnswer = m.options[m.correct];
            return `
                <div class="mistake-item">
                    <div class="mistake-question">${m.question}</div>
                    <div class="mistake-answers">
                        <span class="user-answer">Ваш ответ: <strong>${userAnswer}</strong></span>
                        <span class="correct-answer">Правильный: <strong>${correctAnswer}</strong></span>
                    </div>
                </div>
            `;
        }).join('');

        overlay.innerHTML = `
            <div class="chat-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
                <div class="chat-modal-header">
                    <h3 id="chat-title">🧑‍🏫 Разбор ошибок</h3>
                    <button class="btn-close" aria-label="Закрыть">✕</button>
                </div>
                <div class="chat-body">
                    <div class="mistakes-list">
                        <h4>Вопросы с ошибками:</h4>
                        ${mistakesHtml}
                    </div>
                    <div class="chat-section">
                        <div class="chat-messages" id="chat-messages">
                            <p>⏳ Учитель готовит объяснения...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const messagesDiv = overlay.querySelector('#chat-messages');
        const closeBtn = overlay.querySelector('.btn-close');
        closeBtn.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // 2. Запрашиваем объяснения у сервера
        try {
            const response = await fetch('/teacher/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mistakes })
            });

            if (!response.ok) {
                throw new Error(`Сервер вернул ошибку: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                messagesDiv.innerHTML = `<p class="error">${data.error}</p>`;
                return;
            }

            // 3. Отображаем объяснения в виде диалога
            messagesDiv.innerHTML = '';
            data.explanations.forEach(exp => {
                const q = mistakes.find(m => m.id === exp.id);
                const questionText = q ? q.question : `Вопрос ${exp.id}`;
                const msgBlock = document.createElement('div');
                msgBlock.className = 'chat-msg';
                msgBlock.innerHTML = `
                        <div class="chat-question">❓ ${questionText}</div>
                        <div class="chat-answer">🤖 ${exp.explanation}</div>
                        <button class="btn-detail" data-id="${exp.id}" data-explanation="${this.escapeHtml(exp.explanation)}">📖 Рассказать подробнее</button>
                    `;
                messagesDiv.appendChild(msgBlock);
            });

            messagesDiv.querySelectorAll('.btn-detail').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const button = e.target;
                    const msgDiv = button.closest('.chat-msg');          // находим родительский блок сообщения
                    const questionId = parseInt(button.dataset.id);
                    const q = mistakes.find(m => m.id === questionId);
                    if (!q) return;

                    // Получаем предыдущее объяснение из элемента .chat-answer
                    const answerEl = msgDiv.querySelector('.chat-answer');
                    const previousExplanation = answerEl ? answerEl.textContent.replace(/^🤖\s*/, '') : '';

                    // Меняем текст кнопки на время загрузки
                    button.textContent = '⏳ Готовлю...';
                    button.disabled = true;

                    try {
                        const resp = await fetch('/teacher/api/chat/detail', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: q.id,
                                question: q.question,
                                options: q.options,
                                correct: q.correct,
                                previous_explanation: previousExplanation
                            })
                        });
                        const detailData = await resp.json();
                        if (detailData.error) {
                            alert('Ошибка: ' + detailData.error);
                            button.textContent = '📖 Рассказать подробнее';
                            button.disabled = false;
                            return;
                        }

                        // Добавляем новое сообщение от учителя
                        const detailBlock = document.createElement('div');
                        detailBlock.className = 'chat-msg';
                        detailBlock.innerHTML = `
                    <div class="chat-question">📚 Подробнее о вопросе ${q.id}</div>
                    <div class="chat-answer">🤖 ${detailData.detail}</div>
                `;
                        messagesDiv.appendChild(detailBlock);
                        messagesDiv.scrollTop = messagesDiv.scrollHeight; // прокрутка вниз

                        // Скрываем кнопку, чтобы не плодить одинаковые запросы
                        button.style.display = 'none';

                    } catch (err) {
                        console.error(err);
                        button.textContent = '📖 Рассказать подробнее';
                        button.disabled = false;
                    }
                });
            });

            // Добавим поле для дополнительных вопросов (заглушка)
            const followup = document.createElement('div');
            followup.className = 'chat-followup';
            followup.innerHTML = `
                <p>Есть вопросы по объяснениям? Напишите:</p>
                <input type="text" id="followup-input" placeholder="Задайте уточняющий вопрос..." disabled>
                <button disabled>Отправить</button>
                <small>Функция в разработке</small>
            `;
            messagesDiv.appendChild(followup);

        } catch (err) {
            console.error(err);
            messagesDiv.innerHTML = `<p class="error">Ошибка соединения с сервером. Проверьте, запущен ли сервер.</p>`;
        }
    }
}
// Привязка прогресса к пользователю
(function () {
    // Получаем имя пользователя из localStorage
    let username = 'unknown';
    try {
        const u = localStorage.getItem('d4_user');
        if (u) {
            const parsed = JSON.parse(u);
            username = parsed.username || 'unknown';
        }
    } catch (e) { }

    // Сохраняем оригинальные методы
    const origSave = QuizApp.prototype.saveProgress;
    const origLoad = QuizApp.prototype.loadProgress;

    // Переопределяем saveProgress
    QuizApp.prototype.saveProgress = function () {
        if (!this.storageAvailable) return;
        try {
            const serializable = {
                mode: this.state.mode,
                order: this.state.order,
                currentIndex: this.state.currentIndex,
                answers: Array.from(this.state.answers.entries())
            };
            localStorage.setItem('quizState_' + username, JSON.stringify(serializable));
        } catch (e) { console.warn('Не удалось сохранить прогресс.'); }
    };

    // Переопределяем loadProgress
    QuizApp.prototype.loadProgress = function () {
        if (!this.storageAvailable) return;
        try {
            const saved = localStorage.getItem('quizState_' + username);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state.mode = parsed.mode || 'all';
                this.state.order = parsed.order || [];
                this.state.currentIndex = parsed.currentIndex || 0;
                this.state.answers = new Map(parsed.answers);
            }
        } catch (e) { console.warn('Ошибка загрузки прогресса.'); }
    };
})();
// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => { new QuizApp(QUESTIONS); });