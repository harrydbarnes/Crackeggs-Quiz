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
    revealAtEnd: false
};

// Track current view to allow smooth updates
let lastRenderedView = null;

const STORAGE_KEY = 'crackeggs_quiz_state_v2';

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
    loadState();
    render();
}

function setState(newState) {
    Object.assign(state, newState);
    saveState();
    render();
}

function resetGame() {
    if (confirm("Are you sure you want to quit to the main menu?")) {
        setState({ view: 'menu' });
    }
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
            <span id="header-code" style="margin-left: auto; align-self: center; font-weight: 500; margin-right: 16px; opacity: 0.7;">
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
    // Using view-centered for slight offset, but style.css modified it to be top-aligned with more padding
    div.className = 'view view-centered';
    div.innerHTML = `
        <h1 id="intro-title">Ready to crack eggs?</h1>
        <button class="btn btn-filled" id="intro-btn">Click me</button>
    `;

    const btn = div.querySelector('#intro-btn');
    const title = div.querySelector('#intro-title');

    btn.onclick = () => {
        if (btn.innerText === "Click me") {
            title.style.opacity = 0;
            setTimeout(() => {
                title.innerText = "No, you're not egging Olli, that was yesterday silly!";
                title.style.opacity = 1;
                btn.innerText = "Let's Play";
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

        <div class="subtitle">Select Game Mode</div>
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button class="btn" id="mode-solo" onclick="setMode('solo')">Solo Run</button>
            <button class="btn" id="mode-party" onclick="setMode('party')">Party Mode</button>
        </div>
        <div class="info-text" id="mode-desc">
            <!-- text populated by updateMenu -->
        </div>

        <div class="subtitle" style="margin-top: 20px;">Number of Questions</div>
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button class="btn" id="count-5" onclick="setCount(5)">5</button>
            <button class="btn" id="count-10" onclick="setCount(10)">10</button>
            <button class="btn" id="count-20" onclick="setCount(20)">20</button>
        </div>

        <div class="subtitle" style="margin-top: 20px;">Reveal Answers</div>
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
             <button class="btn" id="reveal-immediate" onclick="setReveal(false)">Immediately</button>
             <button class="btn" id="reveal-end" onclick="setReveal(true)">At End</button>
        </div>
        <div class="info-text" id="reveal-desc" style="max-width: 300px;">
             <!-- text populated by updateMenu -->
        </div>

        <div style="margin-bottom: 20px; margin-top: 10px;">
             <label style="display:block; margin-bottom: 5px; font-weight:500;">Quiz Code (Optional)</label>
             <div class="info-text" style="margin-bottom: 8px;">Enter the same code as your friends to get the same questions.</div>
             <input type="number" id="seed-input" placeholder="Random" style="padding: 12px; border-radius: 8px; border: 1px solid #ccc; width: 120px; text-align: center; font-size: 1rem;">
        </div>

        <button class="btn btn-filled" style="width: 200px; margin-top: 20px;" id="start-btn">Start Game</button>
    `;

    div.querySelector('#start-btn').onclick = () => {
        const seedInput = div.querySelector('#seed-input').value;
        const seed = seedInput ? parseInt(seedInput) : Math.floor(Math.random() * 9000) + 1000;

        if (state.mode === 'party') {
            setState({ view: 'setup', seed: seed });
        } else {
            startGame(['Player 1'], seed);
        }
    };

    setTimeout(updateMenu, 0);

    return div;
}

window.setMode = (m) => setState({ mode: m });
window.setCount = (n) => setState({ questionCount: n });
window.setReveal = (atEnd) => setState({ revealAtEnd: atEnd });

function updateMenu() {
    // Mode
    document.getElementById('mode-solo').className = `btn ${state.mode === 'solo' ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('mode-party').className = `btn ${state.mode === 'party' ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('mode-desc').innerText = state.mode === 'solo' ? 'Play by yourself.' : 'Local multiplayer. Pass the phone to the next player after your turn.';

    // Count
    document.getElementById('count-5').className = `btn ${state.questionCount === 5 ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('count-10').className = `btn ${state.questionCount === 10 ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('count-20').className = `btn ${state.questionCount === 20 ? 'btn-filled' : 'btn-outlined'}`;

    // Reveal
    document.getElementById('reveal-immediate').className = `btn ${!state.revealAtEnd ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('reveal-end').className = `btn ${state.revealAtEnd ? 'btn-filled' : 'btn-outlined'}`;
    document.getElementById('reveal-desc').innerText = state.revealAtEnd ?
        'Correct answers hidden until the very end. Perfect for competitive party play!' :
        'See the correct answer and points immediately after every question.';
}


function renderSetup() {
    const div = document.createElement('div');
    div.className = 'view';
    div.innerHTML = `
        <h2 style="margin-top: 0;">Quiz Code: ${state.seed}</h2>
        <h2>Who is playing?</h2>
        <div class="subtitle">Enter player names in order. Pass the phone when prompted.</div>
        <div id="players-list" style="width: 100%; margin-bottom: 20px;">
        </div>
        <button class="btn btn-outlined" id="add-player" style="margin-bottom: 20px;">+ Add Player</button>
        <button class="btn btn-filled" id="start-party">Start Party</button>
    `;

    const list = div.querySelector('#players-list');
    const addBtn = div.querySelector('#add-player');

    const addInput = () => {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '10px';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-input';
        input.placeholder = `Player ${list.children.length + 1}`;
        input.style.padding = '10px';
        input.style.borderRadius = '8px';
        input.style.border = '1px solid #ccc';
        input.style.width = '80%';
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
            alert("Need at least 1 player!");
            return;
        }
        startGame(players, state.seed);
    };

    return div;
}

function startGame(players, seed) {
    const rng = new Random(seed);
    let pool = [...window.QUESTION_DATABASE];

    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng.nextFloat() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const selectedQuestions = pool.slice(0, state.questionCount);

    const answers = {};
    players.forEach(p => {
        answers[p] = {};
    });

    setState({
        view: state.mode === 'party' ? 'pass' : 'game',
        players: players,
        currentPlayerIndex: 0,
        questions: selectedQuestions,
        currentQuestionIndex: 0,
        answers: answers,
        seed: seed
    });
}

function renderPassScreen() {
    const player = state.players[state.currentPlayerIndex];
    const div = document.createElement('div');
    // Also use view-centered for Pass screen
    div.className = 'view view-centered';
    div.style.backgroundColor = 'var(--md-sys-color-primary)';
    div.style.color = 'var(--md-sys-color-on-primary)';

    let titleText = "Pass the phone to";
    if (state.currentPlayerIndex === 0) {
        titleText = "Get ready";
    }

    div.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 64px; margin-bottom: 20px;">smartphone</span>
        <h2>${titleText}</h2>
        <h1>${escapeHTML(player)}</h1>
        <div style="margin-top: 20px;">
             ${state.currentPlayerIndex > 0 ? '(Don\'t peek!)' : ''}
        </div>
        <button class="btn" style="background: white; color: var(--md-sys-color-primary); margin-top: 40px;" id="ready-btn">I am Ready</button>
    `;

    div.querySelector('#ready-btn').onclick = () => {
        setState({ view: 'game' });
    };

    return div;
}

function renderGame() {
    const player = state.players[state.currentPlayerIndex];
    const question = state.questions[state.currentQuestionIndex];

    const div = document.createElement('div');
    div.className = 'view';

    const header = document.createElement('div');
    header.style.width = '100%';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '20px';
    header.innerHTML = `
        <span>${escapeHTML(player)}</span>
        <span>${state.currentQuestionIndex + 1} / ${state.questions.length}</span>
    `;
    div.appendChild(header);

    const card = document.createElement('div');
    card.className = 'card';
    card.style.width = '100%';
    card.style.boxSizing = 'border-box';

    let content = `<div class="question-text">${escapeHTML(question.question).replace(/\n/g, '<br>')}</div>`;

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
                <div style="text-align: center; font-size: 1.5rem; font-weight: bold; margin-top: 10px;" id="slider-val">
                    ${question.type === 'when' ? formatDate(startVal) : startVal}
                </div>
            </div>
            <button class="btn btn-filled" id="submit-slider" style="width: 100%; margin-top: 20px;">Submit</button>
        `;
    }

    card.innerHTML = content;
    div.appendChild(card);

    const feedback = document.createElement('div');
    feedback.className = 'feedback';
    feedback.style.textAlign = 'center';
    feedback.style.marginTop = '10px';
    div.appendChild(feedback);

    // Add Next Button (Hidden initially)
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-filled hidden';
    nextBtn.style.marginTop = '20px';
    nextBtn.style.width = '100%';
    nextBtn.innerText = 'Next Question';
    div.appendChild(nextBtn);

    // Logic for next button
    // When answer submitted, show feedback, THEN show Next button.
    // Click Next -> submitAnswer -> render

    let currentAnswer = null;

    const handleAnswer = (answer) => {
        currentAnswer = answer;

        // Disable inputs
        if (question.type === 'who_said_it') {
            card.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        } else {
            card.querySelector('#submit-slider').disabled = true;
            card.querySelector('#slider-input').disabled = true;
        }

        // Show Feedback
        if (state.revealAtEnd) {
             feedback.innerHTML = '<span style="color:var(--md-sys-color-primary);">Answer Saved</span>';
        } else {
            const points = calculatePoints(question, answer);

            if (question.type === 'who_said_it') {
                const isCorrect = points > 0;
                feedback.innerHTML = isCorrect ?
                        '<span class="correct">Correct! +1000 pts</span>' :
                        `<span class="incorrect">Wrong! It was ${escapeHTML(question.correctAnswer)}</span>`;
            } else {
                // Slider
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

        // Show Next Button
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
                // Visual selection state
                const isCorrect = chosen === question.correctAnswer;

                if (state.revealAtEnd) {
                    btn.classList.add('btn-filled');
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
            valDisplay.innerText = question.type === 'when' ? formatDate(parseInt(slider.value)) : slider.value;
        };

        subBtn.onclick = () => {
            handleAnswer(parseInt(slider.value));
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

    let html = `
        <h1>Results</h1>
        <div class="subtitle">Quiz Code: ${state.seed}</div>
        <div id="leaderboard" style="width: 100%; max-width: 400px; margin-bottom: 20px;">
        </div>

        <button class="btn btn-outlined" id="share-btn">Share Results</button>
        <button class="btn btn-tonal" id="home-btn" style="margin-top: 10px;">Back to Menu</button>
    `;

    div.innerHTML = html;

    const leaderboard = div.querySelector('#leaderboard');
    const shareBtn = div.querySelector('#share-btn');
    const homeBtn = div.querySelector('#home-btn');

    let i = sortedPlayers.length - 1;

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
        }
    };

    setTimeout(revealNext, 500);

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
            navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard!"));
        }
    };

    homeBtn.onclick = () => {
        setState({ view: 'menu' });
    };

    return div;
}

document.addEventListener('DOMContentLoaded', init);
