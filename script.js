// State
const state = {
    view: 'intro', // intro, menu, setup, game, results, pass
    mode: 'solo', // solo, party
    questionCount: 5,
    players: [],
    currentPlayerIndex: 0,
    questions: [],
    currentQuestionIndex: 0,
    answers: {}, // { playerName: { questionId: answer } }
    scores: {}, // { playerName: score }
    seed: null,
    revealAtEnd: false,
    enableChips: true,
    playerChips: {}, // { playerName: { '5050': true, 'range': true, 'audience': true, 'context': true } }
    soloName: 'Player 1',
    filterYear: false,
    startYear: 2020,
    endYear: 2024,
    minDbYear: 2000,
    maxDbYear: 2030
};

// Sounds
const sounds = {
    drum: new Audio('https://actions.google.com/sounds/v1/cartoon/drum_roll.ogg'),
    confetti: new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg')
};

// Track current view to allow smooth updates
let lastRenderedView = null;

const STORAGE_KEY = 'crackeggs_quiz_state_v3';

// --- UI Utilities ---

function createUIContainers() {
    const app = document.body;

    // Toast Container
    if (!document.getElementById('toast-container')) {
        const tc = document.createElement('div');
        tc.id = 'toast-container';
        app.appendChild(tc);
    }

    // Modal Overlay
    if (!document.getElementById('modal-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <div class="modal-title" id="modal-title"></div>
                <div class="modal-content" id="modal-content"></div>
                <div class="modal-actions" id="modal-actions"></div>
            </div>
        `;
        app.appendChild(overlay);
    }
}

function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return; // Guard
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);

    // Trigger reflow
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) container.removeChild(toast);
        }, 300);
    }, duration);
}

function showModal(title, content, actions = []) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        const mTitle = document.getElementById('modal-title');
        const mContent = document.getElementById('modal-content');
        const mActions = document.getElementById('modal-actions');

        if (title) {
            mTitle.innerText = title;
            mTitle.style.display = 'block';
        } else {
            mTitle.style.display = 'none';
        }

        mContent.innerText = content || '';
        mActions.innerHTML = '';

        if (actions.length === 0) {
            // Default OK
            actions.push({ text: 'OK', primary: true, value: true });
        }

        actions.forEach(action => {
            const btn = document.createElement('button');
            if (action.style === 'text') {
                 btn.className = 'btn';
            } else {
                 btn.className = action.primary ? 'btn btn-filled' : 'btn btn-outlined';
            }
            // Overrides
            btn.innerText = action.text;
            btn.style.marginLeft = '8px';
            btn.onclick = () => {
                closeModal();
                resolve(action.value);
            };
            mActions.appendChild(btn);
        });

        overlay.classList.add('show');

        function closeModal() {
            overlay.classList.remove('show');
        }
    });
}

function triggerConfetti() {
    sounds.confetti.currentTime = 0;
    sounds.confetti.play().catch(e => console.warn('Confetti sound failed', e));
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 98 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        confetti.style.opacity = Math.random();
        document.body.appendChild(confetti);

        setTimeout(() => {
            if (document.body.contains(confetti)) document.body.removeChild(confetti);
        }, 5000);
    }
}


// --- Utilities ---

class Random {
    constructor(seed) {
        this.m = 0x80000000;
        this.a = 1103515245;
        this.c = 12345;
        this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
    }

    nextInt() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state;
    }

    nextFloat() {
        return this.nextInt() / (this.m - 1);
    }

    // Shuffle in place
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.nextFloat() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}

function formatDate(timestamp) {
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString();
}

function updateYearInfoVisibility() {
    const yearInfo = document.getElementById('year-info');
    if (yearInfo) {
        const isFullRange = state.startYear === state.minDbYear && state.endYear === state.maxDbYear;
        yearInfo.style.display = isFullRange ? 'none' : 'block';
    }
}

// --- Persistence ---

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save state', e);
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(state, parsed);
        }
    } catch (e) {
        console.warn('Failed to load state', e);
    }
}

// --- App Logic ---

function init() {
    createUIContainers();

    // Determine DB Year Range
    const years = window.QUESTION_DATABASE
        .map(q => q.year)
        .filter(y => y !== null && y !== undefined);

    if (years.length > 0) {
        state.minDbYear = Math.min(...years);
        state.maxDbYear = Math.max(...years);
        // Set defaults if not loaded from state (loadState will override if exists, but we want valid bounds)
        state.startYear = state.minDbYear;
        state.endYear = state.maxDbYear;
    }

    loadState();

    // Check URL for code
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
        const code = parseInt(params.get('code'), 10);
        if (!isNaN(code)) {
            setState({ seed: code, view: 'menu' });
        }
    }

    render();
}

function setState(newState) {
    Object.assign(state, newState);
    saveState();
    render();
}

function resetGame() {
    showModal("Quit Game?", "Are you sure you want to quit to the main menu?", [
        { text: "Cancel", primary: false, value: false },
        { text: "Quit", primary: true, value: true }
    ]).then(result => {
        if (result) {
            setState({ view: 'menu' });
        }
    });
}

function calculatePoints(question, answer) {
    if (question.type === 'who_said_it') {
        return (answer === question.correctAnswer) ? 1000 : 0;
    } else {
        const diff = Math.abs(answer - question.correctAnswer);
        const range = question.max - question.min;
        const safeRange = range === 0 ? 1 : range;

        // Linear drop off
        const points = Math.max(0, 1000 * (1 - (diff / safeRange)));
        return Math.round(points);
    }
}

function render() {
    const app = document.getElementById('app');

    // If view hasn't changed, try to update in-place
    if (state.view === lastRenderedView) {
        if (state.view === 'menu') {
            updateMenu();
            return;
        }
    }

    lastRenderedView = state.view;
    app.innerHTML = '';

    // Global Elements (Top Bar)
    if (state.view !== 'intro') {
        const topBar = document.createElement('div');
        topBar.className = 'top-bar';
        topBar.innerHTML = `
            <button class="icon-btn material-symbols-outlined" id="back-btn">arrow_back</button>
            <span id="header-code" class="header-code">
               ${state.seed && (state.view === 'game' || state.view === 'setup') ? 'Quiz Code: ' + state.seed : ''}
            </span>
        `;
        topBar.querySelector('#back-btn').onclick = () => {
            if (state.view === 'menu') {
                setState({ view: 'intro' });
            } else if (state.view === 'results') {
                setState({ view: 'menu' });
            } else {
                resetGame();
            }
        };
        app.appendChild(topBar);
    }

    switch (state.view) {
        case 'intro':
            app.appendChild(renderIntro());
            break;
        case 'menu':
            app.appendChild(renderMenu());
            break;
        case 'setup':
            app.appendChild(renderSetup());
            break;
        case 'game':
            app.appendChild(renderGame());
            break;
        case 'pass':
            app.appendChild(renderPassScreen());
            break;
        case 'results':
            app.appendChild(renderResults());
            break;
    }
}

// --- Views ---

function renderIntro() {
    const div = document.createElement('div');
    div.className = 'view view-centered';
    div.innerHTML = `
        <div id="intro-text-container">
            <h1 id="intro-title" class="m-0">Ready to crack eggs?</h1>
        </div>
        <button class="btn btn-filled" id="intro-btn">Click me</button>
    `;

    const btn = div.querySelector('#intro-btn');
    const title = div.querySelector('#intro-title');
    const container = div.querySelector('#intro-text-container');

    btn.onclick = () => {
        if (btn.innerText === "Click me") {
            const startHeight = container.offsetHeight;
            container.style.height = `${startHeight}px`;
            title.style.opacity = 0;

            setTimeout(() => {
                title.innerText = "No, you're not egging Olli, that was yesterday silly!";
                container.style.height = 'auto';
                const newHeight = container.offsetHeight;
                container.style.height = `${startHeight}px`;
                void container.offsetHeight;
                container.style.height = `${newHeight}px`;
                title.style.opacity = 1;
                btn.innerText = "Let's Play";
                setTimeout(() => {
                    container.style.height = 'auto';
                }, 300);
            }, 300);
        } else {
            div.classList.add('fade-out');
            setTimeout(() => setState({ view: 'menu' }), 300);
        }
    };

    return div;
}

function renderMenu() {
    const div = document.createElement('div');
    div.className = 'view';
    div.innerHTML = `
        <h1>Crackeggs Quiz</h1>

        <div class="subtitle mb-small">Select Game Mode</div>
        <div class="flex-row mb-small">
            <button class="btn" id="mode-solo" onclick="setMode('solo')">Solo Run</button>
            <button class="btn" id="mode-party" onclick="setMode('party')">Party Mode</button>
        </div>
        <div class="info-text" id="mode-desc">
            <!-- text populated by updateMenu -->
        </div>

        <div id="solo-name-section" class="mt-small" style="display: none;">
             <input type="text" id="solo-name-input" class="input-standard" value="${state.soloName}" placeholder="Your Name">
        </div>

        <div class="subtitle mt-med mb-small">Number of Questions</div>
        <div class="flex-row mb-small">
            <button class="btn" id="count-5" onclick="setCount(5)">5</button>
            <button class="btn" id="count-10" onclick="setCount(10)">10</button>
            <button class="btn" id="count-20" onclick="setCount(20)">20</button>
        </div>

        <div class="subtitle mt-med mb-small">Reveal Answers</div>
        <div class="flex-row mb-small">
             <button class="btn" id="reveal-immediate" onclick="setReveal(false)">Immediately</button>
             <button class="btn" id="reveal-end" onclick="setReveal(true)">At End</button>
        </div>
        <div class="info-text max-w-300" id="reveal-desc">
             <!-- text populated by updateMenu -->
        </div>

        <div class="subtitle mt-med mb-small">Chip Mode</div>
        <div class="flex-row mb-small">
             <button class="btn" id="chips-yes" onclick="setEnableChips(true)">Yes</button>
             <button class="btn" id="chips-no" onclick="setEnableChips(false)">No</button>
        </div>
        <div class="info-text">50/50, Range Reducer, Ask Audience, Context</div>

        <div class="subtitle mt-med m-0">Year Range</div>
        <div id="year-range-container" class="flex-col-center mt-xsmall">
            <div id="year-display" class="year-display">
                ${state.startYear} - ${state.endYear}
            </div>
            <div class="slider-wrapper">
                <div class="slider-track-bg"></div>
                <div class="slider-track-fill" id="slider-track"></div>
                <input type="range" id="range-min" class="range-input" min="${state.minDbYear}" max="${state.maxDbYear}" value="${state.startYear}" step="1">
                <input type="range" id="range-max" class="range-input" min="${state.minDbYear}" max="${state.maxDbYear}" value="${state.endYear}" step="1">
            </div>
        </div>
        <div id="year-info" class="info-text mb-small" style="display:none;">Excludes 'Count' questions.</div>

        <div class="mb-med mt-small">
             <label style="display:block; margin-bottom: 5px; font-weight:500;">Quiz Code (Optional)</label>
             <div class="info-text mb-small">Enter the same code as your friends to get the same questions.</div>
             <div class="flex-center">
                <input type="number" id="seed-input" class="input-small" placeholder="Random" value="${state.seed || ''}">
                <button class="btn btn-outlined" id="share-code-btn" title="Share Code"><span class="material-symbols-outlined">share</span></button>
             </div>
        </div>

        <button class="btn btn-filled mt-med" style="width: 200px;" id="start-btn">Start Game</button>
    `;

    // Handle solo name input
    const nameInput = div.querySelector('#solo-name-input');
    if (nameInput) {
        nameInput.oninput = (e) => {
            state.soloName = e.target.value;
        };
    }

    // Handle Seed Input
    const seedIn = div.querySelector('#seed-input');
    seedIn.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        state.seed = isNaN(val) ? null : val;
    };

    // Handle Year Inputs (Slider)
    const rangeMin = div.querySelector('#range-min');
    const rangeMax = div.querySelector('#range-max');
    const track = div.querySelector('#slider-track');
    const display = div.querySelector('#year-display');

    const updateSlider = () => {
        let minVal = parseInt(rangeMin.value, 10);
        let maxVal = parseInt(rangeMax.value, 10);

        state.startYear = minVal;
        state.endYear = maxVal;

        display.innerText = `${state.startYear} - ${state.endYear}`;

        const total = state.maxDbYear - state.minDbYear;
        const safeTotal = total === 0 ? 1 : total;
        const minPercent = ((state.startYear - state.minDbYear) / safeTotal) * 100;
        const maxPercent = ((state.endYear - state.minDbYear) / safeTotal) * 100;

        track.style.left = `${minPercent}%`;
        track.style.width = `${maxPercent - minPercent}%`;

        updateYearInfoVisibility();
    };

    if (rangeMin && rangeMax) {
        rangeMin.oninput = () => {
            if (parseInt(rangeMin.value, 10) > parseInt(rangeMax.value, 10)) {
                rangeMin.value = rangeMax.value;
            }
            updateSlider();
        };

        rangeMax.oninput = () => {
            if (parseInt(rangeMax.value, 10) < parseInt(rangeMin.value, 10)) {
                rangeMax.value = rangeMin.value;
            }
            updateSlider();
        };

        setTimeout(updateSlider, 0);
    }

    div.querySelector('#share-code-btn').onclick = () => {
        const code = seedIn.value || 'Random';
        if (code === 'Random') {
            showToast("Enter a code first to share!");
            return;
        }
        const url = window.location.href.split('?')[0] + '?code=' + code;
        const text = `Join my Crackeggs Quiz! Code: ${code}\n${url}`;
        if (navigator.share) {
            navigator.share({ title: 'Crackeggs Quiz', text: text, url: url }).catch(console.error);
        } else {
            navigator.clipboard.writeText(text).then(() => showToast("Link copied to clipboard!"));
        }
    };

    div.querySelector('#start-btn').onclick = () => {
        const seedInput = div.querySelector('#seed-input').value;
        const seed = seedInput ? parseInt(seedInput, 10) : Math.floor(Math.random() * 9000) + 1000;

        if (state.mode === 'party') {
            setState({ view: 'setup', seed: seed });
        } else {
            startGame([state.soloName || 'Player 1'], seed);
        }
    };

    setTimeout(updateMenu, 0);

    return div;
}

window.setMode = (m) => setState({ mode: m });
window.setCount = (n) => setState({ questionCount: n });
window.setReveal = (atEnd) => setState({ revealAtEnd: atEnd });
window.setEnableChips = (enabled) => setState({ enableChips: enabled });
window.setFilterYear = (enabled) => setState({ filterYear: enabled });

function updateMenu() {
    document.getElementById('mode-solo').className = `btn ${state.mode === 'solo' ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('mode-party').className = `btn ${state.mode === 'party' ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('mode-desc').innerText = state.mode === 'solo' ? 'Play by yourself.' : 'Local multiplayer. Pass the phone to the next player after your turn.';

    const soloSection = document.getElementById('solo-name-section');
    if (soloSection) soloSection.style.display = state.mode === 'solo' ? 'block' : 'none';

    document.getElementById('count-5').className = `btn ${state.questionCount === 5 ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('count-10').className = `btn ${state.questionCount === 10 ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('count-20').className = `btn ${state.questionCount === 20 ? 'btn-filled' : 'btn-outlined'}`;

    document.getElementById('reveal-immediate').className = `btn ${!state.revealAtEnd ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('reveal-end').className = `btn ${state.revealAtEnd ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('reveal-desc').innerText = state.revealAtEnd ?
        'Correct answers hidden until the very end. Perfect for competitive party play!' :
        'See the correct answer and points immediately after every question.';

    // Chip Mode Buttons
    const btnYes = document.getElementById('chips-yes');
    const btnNo = document.getElementById('chips-no');
    if (btnYes && btnNo) {
        btnYes.className = `btn ${state.enableChips ? 'btn-filled' : 'btn-outlined'}`;
        btnNo.className = `btn ${!state.enableChips ? 'btn-filled' : 'btn-outlined'}`;
    }

    updateYearInfoVisibility();
}


function renderSetup() {
    const div = document.createElement('div');
    div.className = 'view';
    div.innerHTML = `
        <h2 class="m-0">Quiz Code: ${state.seed}</h2>
        <h2>Who is playing?</h2>
        <div class="subtitle">Enter player names in order. Pass the phone when prompted.</div>
        <div id="players-list" class="w-100 mb-med">
        </div>
        <button class="btn btn-outlined setup-btn-add" id="add-player">+ Add Player</button>
        <button class="btn btn-filled" id="start-party">Start Party</button>
    `;

    const list = div.querySelector('#players-list');
    const addBtn = div.querySelector('#add-player');

    const addInput = () => {
        const wrap = document.createElement('div');
        wrap.className = 'setup-list-item';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-input input-player';
        input.placeholder = `Player ${list.children.length + 1}`;
        wrap.appendChild(input);
        list.appendChild(wrap);
    };

    addInput();
    addInput();

    addBtn.onclick = addInput;

    div.querySelector('#start-party').onclick = () => {
        const inputs = div.querySelectorAll('.player-input');
        const players = Array.from(inputs).map(i => i.value.trim()).filter(v => v);
        if (players.length < 1) {
            showToast("Need at least 1 player!");
            return;
        }
        startGame(players, state.seed);
    };

    return div;
}

function startGame(players, seed) {
    const rng = new Random(seed);
    let pool = [...window.QUESTION_DATABASE];

    // Check if filtering is needed
    const isFullRange = state.startYear === state.minDbYear && state.endYear === state.maxDbYear;

    if (!isFullRange) {
         pool = pool.filter(q => {
             // Exclude if no year (e.g. Count) or outside range
             return q.year && q.year >= state.startYear && q.year <= state.endYear;
         });

         if (pool.length === 0) {
             showToast("No questions found for this year range!");
             return;
         }

         if (pool.length < state.questionCount) {
             showToast(`Only ${pool.length} questions available for this range!`);
         }
    }

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng.nextFloat() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selectedQuestions = pool.slice(0, state.questionCount);

    const answers = {};
    const playerChips = {};
    players.forEach(p => {
        answers[p] = {};
        playerChips[p] = { '5050': true, 'range': true, 'audience': true, 'context': true };
    });

    setState({
        view: state.mode === 'party' ? 'pass' : 'game',
        players: players,
        currentPlayerIndex: 0,
        questions: selectedQuestions,
        currentQuestionIndex: 0,
        answers: answers,
        playerChips: playerChips,
        seed: seed
    });
}

function renderPassScreen() {
    const player = state.players[state.currentPlayerIndex];
    const div = document.createElement('div');
    div.className = 'view view-centered';
    div.style.backgroundColor = 'var(--md-sys-color-primary)';
    div.style.color = 'var(--md-sys-color-on-primary)';

    let titleText = "Pass the phone to";
    if (state.currentPlayerIndex === 0) {
        titleText = "Get ready";
    }

    div.innerHTML = `
        <span class="material-symbols-outlined pass-icon">smartphone</span>
        <h2>${titleText}</h2>
        <h1>${escapeHTML(player)}</h1>
        <div class="mt-med">
             ${state.currentPlayerIndex > 0 ? '(Don\'t peek!)' : ''}
        </div>
        <button class="btn btn-white-primary" id="ready-btn">I am Ready</button>
    `;

    div.querySelector('#ready-btn').onclick = () => {
        setState({ view: 'game' });
    };

    return div;
}

function renderGame() {
    const player = state.players[state.currentPlayerIndex];
    const question = state.questions[state.currentQuestionIndex];
    const chips = state.playerChips[player];

    const div = document.createElement('div');
    div.className = 'view';

    const header = document.createElement('div');
    header.className = 'flex-justify-between w-100 mb-med';
    header.innerHTML = `
        <span>${escapeHTML(player)}</span>
        <span>${state.currentQuestionIndex + 1} / ${state.questions.length}</span>
    `;
    div.appendChild(header);

    // Chip buttons
    if (state.enableChips) {
        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'chips-container';

        // 50/50
        const btn5050 = document.createElement('button');
        btn5050.className = 'chip-btn';
        btn5050.innerText = '50/50';
        btn5050.disabled = !chips['5050'] || question.type !== 'who_said_it';

        // Ask Audience
        const btnAudience = document.createElement('button');
        btnAudience.className = 'chip-btn';
        btnAudience.innerText = 'Ask Audience';
        btnAudience.disabled = !chips['audience'];

        // Range
        const btnRange = document.createElement('button');
        btnRange.className = 'chip-btn';
        btnRange.innerText = 'Range';
        btnRange.disabled = !chips['range'] || question.type === 'who_said_it';

        // Context
        const btnContext = document.createElement('button');
        btnContext.className = 'chip-btn';
        btnContext.innerText = 'Context';
        btnContext.disabled = !chips['context'] || !question.context;

        chipsDiv.appendChild(btn5050);
        chipsDiv.appendChild(btnAudience);
        chipsDiv.appendChild(btnRange);
        chipsDiv.appendChild(btnContext);
        div.appendChild(chipsDiv);

        // Handlers
        btnContext.onclick = () => {
             showModal("Context", question.context.join('\n\n'), [
                 { text: "Close", primary: true, value: true }
             ]).then(() => {
                 chips['context'] = false;
                 btnContext.disabled = true;
                 saveState();
             });
        };

        btn5050.onclick = () => {
            showModal("Use 50/50 Chip?", "This will remove 2 incorrect options.", [
                { text: "Cancel", primary: false, value: false },
                { text: "Use Chip", primary: true, value: true }
            ]).then(result => {
                if (result) {
                    chips['5050'] = false;
                    btn5050.disabled = true;

                    // Hide 2 wrong options
                    const opts = Array.from(card.querySelectorAll('.option-btn'));
                    const correct = question.correctAnswer;
                    const wrongOpts = opts.filter(b => b.dataset.value !== correct);

                    // Shuffle wrong opts
                    for (let i = wrongOpts.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [wrongOpts[i], wrongOpts[j]] = [wrongOpts[j], wrongOpts[i]];
                    }

                    // Hide first 2
                    if (wrongOpts.length >= 2) {
                        wrongOpts[0].style.visibility = 'hidden';
                        wrongOpts[1].style.visibility = 'hidden';
                    }
                    saveState();
                }
            });
        };

        btnRange.onclick = () => {
             showModal("Use Range Chip?", "This will reduce the slider range to 20%.", [
                 { text: "Cancel", primary: false, value: false },
                 { text: "Use Chip", primary: true, value: true }
             ]).then(result => {
                 if (result) {
                     chips['range'] = false;
                     btnRange.disabled = true;

                     const slider = card.querySelector('#slider-input');
                     const currentRange = question.max - question.min;
                     const newRangeSize = currentRange * 0.2; // 20%

                     const half = newRangeSize / 2;
                     let newMin = Math.floor(question.correctAnswer - half);
                     let newMax = Math.ceil(question.correctAnswer + half);

                     // Clamp
                     if (newMin < question.min) newMin = question.min;
                     if (newMax > question.max) newMax = question.max;

                     // Update slider
                     slider.min = newMin;
                     slider.max = newMax;
                     slider.value = question.correctAnswer; // Snap to answer? Or center?
                     const mid = Math.floor((newMin + newMax) / 2);
                     slider.value = mid;

                     // Update display
                     card.querySelector('#slider-val').innerText = question.type === 'when' ? formatDate(mid) : mid;

                     // Feedback
                     showToast("Range reduced! The answer is within the new slider limits.");
                     saveState();
                 }
             });
        };

        btnAudience.onclick = () => {
             showModal("Ask the Audience?", "See what the (virtual) audience thinks.", [
                 { text: "Cancel", primary: false, value: false },
                 { text: "Ask", primary: true, value: true }
             ]).then(result => {
                 if (result) {
                     chips['audience'] = false;
                     btnAudience.disabled = true;

                     if (question.type === 'who_said_it') {
                         // Generate votes
                         const opts = question.options;
                         const correct = question.correctAnswer;
                         let remainingPercent = 100;
                         let votes = {};

                         const isSmart = Math.random() < 0.6;
                         const correctShare = isSmart ? (50 + Math.random() * 30) : (Math.random() * 40);

                         votes[correct] = correctShare;
                         remainingPercent -= correctShare;

                         const others = opts.filter(o => o !== correct);
                         others.forEach((o, idx) => {
                             if (idx === others.length - 1) {
                                 votes[o] = remainingPercent;
                             } else {
                                 const share = Math.random() * remainingPercent;
                                 votes[o] = share;
                                 remainingPercent -= share;
                             }
                         });

                         // Show chart
                         let msg = "";
                         opts.forEach(o => {
                             msg += `${o}: ${Math.round(votes[o])}%\n`;
                         });
                         showModal("Audience Vote", msg);

                     } else {
                         // Slider
                         const isSmart = Math.random() < 0.6;
                         let guess;
                         if (isSmart) {
                             // Within 10% range
                             const range = question.max - question.min;
                             const offset = (Math.random() - 0.5) * (range * 0.1);
                             guess = question.correctAnswer + offset;
                         } else {
                             // Random within range
                             guess = question.min + Math.random() * (question.max - question.min);
                         }
                         guess = Math.round(guess);
                         const val = question.type === 'when' ? formatDate(guess) : guess;
                         showModal("Audience Says", `The audience thinks the answer is around: ${val}`);
                     }
                     saveState();
                 }
             });
        };
    }

    const card = document.createElement('div');
    card.className = 'card w-100';

    let content = `<div class="question-text">
        ${escapeHTML(question.question).replace(/\n/g, '<br>')}
        ${question.dateDisplay ?
          `<button class="icon-btn material-symbols-outlined show-date-btn" id="show-date-btn" title="Show Date">calendar_month</button>`
          : ''}
    </div>`;

    if (question.type === 'who_said_it') {
        content += `<div class="options-grid">`;
        question.options.forEach(opt => {
            content += `<button class="btn btn-outlined option-btn" data-value="${escapeHTML(opt)}">${escapeHTML(opt)}</button>`;
        });
        content += `</div>`;
    } else if (question.type === 'count' || question.type === 'when') {
        const min = question.min || 0;
        const max = question.max || 100;
        const startVal = Math.floor((min + max) / 2);

        content += `
            <div class="slider-container">
                <input type="range" min="${min}" max="${max}" value="${startVal}" class="slider" id="slider-input">
                <div class="text-center text-bold mt-small" style="font-size: 1.5rem;" id="slider-val">
                    ${question.type === 'when' ? formatDate(startVal) : startVal}
                </div>
            </div>
            <button class="btn btn-filled w-100 mt-med" id="submit-slider">Submit</button>
        `;
    }

    card.innerHTML = content;
    div.appendChild(card);

    const dateBtn = card.querySelector('#show-date-btn');
    if (dateBtn) {
        dateBtn.onclick = () => showToast("Date: " + question.dateDisplay);
    }

    const feedback = document.createElement('div');
    feedback.className = 'feedback text-center mt-small';
    div.appendChild(feedback);

    // Add Next Button (Hidden initially)
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-filled hidden w-100 mt-med';
    nextBtn.innerText = 'Next Question';
    div.appendChild(nextBtn);

    let currentAnswer = null;

    const handleAnswer = (answer) => {
        currentAnswer = answer;

        if (question.type === 'who_said_it') {
            card.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        } else {
            card.querySelector('#submit-slider').disabled = true;
            card.querySelector('#slider-input').disabled = true;
        }

        // Disable remaining chips
        if (state.enableChips) {
            Array.from(div.querySelectorAll('.chip-btn')).forEach(b => b.disabled = true);
        }

        if (state.revealAtEnd) {
             feedback.innerHTML = '<span class="primary-color">Answer Saved</span>';
        } else {
            const points = calculatePoints(question, answer);

            if (question.type === 'who_said_it') {
                const isCorrect = points > 0;
                feedback.innerHTML = isCorrect ?
                        '<span class="correct">Correct! +1000 pts</span>' :
                        `<span class="incorrect">Wrong! It was ${escapeHTML(question.correctAnswer)}</span>`;
            } else {
                const diff = Math.abs(answer - question.correctAnswer);
                let msg = '';
                if (diff === 0) {
                    msg = '<span class="correct">Exact Match! +1000 pts</span>';
                } else {
                    const ansText = question.type === 'when' ? formatDate(question.correctAnswer) : question.correctAnswer;
                    if (points > 0) {
                        msg = `<span class="partial">Close! The answer was ${ansText}. <br>+${points} pts</span>`;
                    } else {
                        msg = `<span class="incorrect">Missed it! The answer was ${ansText}. <br>0 pts</span>`;
                    }
                }
                feedback.innerHTML = msg;
            }
        }

        nextBtn.classList.remove('hidden');
        nextBtn.onclick = () => {
            submitAnswer(question.id, currentAnswer);
        };
    };

    if (question.type === 'who_said_it') {
        const opts = card.querySelectorAll('.option-btn');
        opts.forEach(btn => {
            btn.onclick = () => {
                const chosen = btn.dataset.value;
                const isCorrect = chosen === question.correctAnswer;

                // Mark selection
                btn.classList.add('selected');

                if (state.revealAtEnd) {
                    // Just rely on .selected style
                } else {
                    btn.classList.add(isCorrect ? 'btn-filled' : 'btn-tonal');
                    if (!isCorrect) {
                        btn.style.backgroundColor = '#ffcdd2';
                        btn.style.borderColor = 'red';
                    } else {
                        btn.style.backgroundColor = '#c8e6c9';
                        btn.style.borderColor = 'green';
                    }
                }
                handleAnswer(chosen);
            };
        });
    } else {
        const slider = card.querySelector('#slider-input');
        const valDisplay = card.querySelector('#slider-val');
        const subBtn = card.querySelector('#submit-slider');

        slider.oninput = () => {
            valDisplay.innerText = question.type === 'when' ? formatDate(parseInt(slider.value, 10)) : slider.value;
        };

        subBtn.onclick = () => {
            handleAnswer(parseInt(slider.value, 10));
        };
    }

    return div;
}

function submitAnswer(qId, answer) {
    const player = state.players[state.currentPlayerIndex];
    state.answers[player][qId] = answer;

    if (state.currentQuestionIndex < state.questions.length - 1) {
        state.currentQuestionIndex++;
        render();
    } else {
        if (state.currentPlayerIndex < state.players.length - 1) {
            state.currentPlayerIndex++;
            state.currentQuestionIndex = 0;
            setState({ view: 'pass' });
        } else {
            calculateScores();
            setState({ view: 'results' });
        }
    }
}

function calculateScores() {
    state.scores = {};
    state.players.forEach(p => {
        let score = 0;
        state.questions.forEach(q => {
            const ans = state.answers[p][q.id];
            score += calculatePoints(q, ans);
        });
        state.scores[p] = score;
    });
}

function renderResults() {
    const div = document.createElement('div');
    div.className = 'view';

    const sortedPlayers = [...state.players].sort((a, b) => state.scores[b] - state.scores[a]);

    let drumRollHtml = `
        <button class="btn btn-filled btn-large" id="drum-roll-btn">
            🥁 Drum Roll 🥁
        </button>
    `;

    let html = `
        <h1>Results</h1>
        <div class="subtitle">Quiz Code: ${state.seed}</div>
        <div class="mb-med text-bold primary-color">(Higher Score is Better!)</div>

        <div id="drum-container">${drumRollHtml}</div>

        <div id="leaderboard" class="w-100 max-w-300 mb-med">
            <!-- filled by animation -->
        </div>

        <div id="action-buttons" class="hidden">
            <button class="btn btn-outlined" id="share-btn">Share Results</button>
            <button class="btn btn-tonal" id="home-btn" style="margin-top: 10px;">Back to Menu</button>
        </div>
    `;

    div.innerHTML = html;

    const drumContainer = div.querySelector('#drum-container');
    const drumBtn = div.querySelector('#drum-roll-btn');
    const leaderboard = div.querySelector('#leaderboard');
    const actionButtons = div.querySelector('#action-buttons');
    const shareBtn = div.querySelector('#share-btn');
    const homeBtn = div.querySelector('#home-btn');

    drumBtn.onclick = () => {
        sounds.drum.currentTime = 0;
        sounds.drum.play().catch(e => console.warn('Drum sound failed', e));

        drumContainer.innerHTML = '';

        // Create full screen overlay
        const overlay = document.createElement('div');
        overlay.id = 'drum-overlay';
        overlay.innerHTML = '<div class="drum-anim">🥁</div>';
        document.body.appendChild(overlay);

        setTimeout(() => {
            document.body.removeChild(overlay);

            // Start reveal
            let i = sortedPlayers.length - 1;

            // Trigger Confetti
            triggerConfetti();

            const revealNext = () => {
                if (i >= 0) {
                    const p = sortedPlayers[i];
                    const score = state.scores[p];
                    const item = document.createElement('div');
                    item.className = 'leaderboard-item';
                    item.innerHTML = `
                        <span style="font-weight: bold;">${i + 1}. ${escapeHTML(p)}</span>
                        <span>${score} pts</span>
                    `;
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(10px)';
                    item.style.transition = 'all 0.5s';

                    if (leaderboard.firstChild) {
                        leaderboard.insertBefore(item, leaderboard.firstChild);
                    } else {
                        leaderboard.appendChild(item);
                    }

                    if (navigator.vibrate) navigator.vibrate(200);

                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, 50);

                    i--;
                    setTimeout(revealNext, 1500);
                } else {
                    actionButtons.classList.remove('hidden');
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 400]);
                }
            };

            revealNext();
        }, 3000); // 3 seconds drum roll
    };

    shareBtn.onclick = () => {
        let text = `Crackeggs Quiz Results (Code: ${state.seed})\n`;
        sortedPlayers.forEach((p, idx) => {
            text += `${idx + 1}. ${p}: ${state.scores[p]} pts\n`;
        });

        if (navigator.share) {
            navigator.share({
                title: 'Crackeggs Quiz Results',
                text: text
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!"));
        }
    };

    homeBtn.onclick = () => {
        setState({ view: 'menu' });
    };

    return div;
}

document.addEventListener('DOMContentLoaded', init);
