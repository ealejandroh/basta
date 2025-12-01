document.addEventListener('DOMContentLoaded', () => {
    // State
    let players = [];
    let playersCache = [];
    let currentPlayerIndex = -1;
    let synth = window.speechSynthesis;
    let timerInterval;
    let timeLeft;
    let turnDuration = 10;
    let audioCtx;
    let history = []; // History stack
    let wins = {}; // Win counters

    let tickTimeout;

    const URGENTE_TIME = 5;

    // Elements
    const playerInput = document.getElementById('player-input');
    const timeInput = document.getElementById('time-input');
    const addBtn = document.getElementById('add-btn');
    const moveBtn = document.getElementById('move-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const playerList = document.getElementById('player-list');
    const startGameBtn = document.getElementById('start-game-btn');
    const setupSection = document.getElementById('setup-section');
    const gameSection = document.getElementById('game-section');
    const currentPlayerDisplay = document.getElementById('current-player-display');
    const turnoDisplay = document.getElementById('turno-display');
    const timerDisplay = document.getElementById('timer-display');
    const press = document.getElementById('press');
    const bastaBtn = document.getElementById('basta-btn');
    const resetBtn = document.getElementById('reset-btn');
    const undoBtn = document.getElementById('undo-btn');

    // Audio Helper
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    function playBeep(freq = 800, duration = 0.1, type = 'sine') {
        if (!audioCtx) initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    }

    function playTickSound() {
        // Short, high-pitched tick
        playBeep(1000, 0.05, 'triangle');
    }

    function startTicking() {
        clearTimeout(tickTimeout);

        const tick = () => {
            if (timeLeft <= 0) return;

            playTickSound();

            // Calculate delay: faster as time runs out
            // Map timeLeft (turnDuration -> 0) to delay (1000ms -> 100ms)
            const progress = timeLeft / turnDuration;
            // Non-linear curve for more dramatic effect
            const delay = Math.max(150, Math.pow(progress, 1.5) * 1000);

            tickTimeout = setTimeout(tick, delay);
        };

        tick();
    }

    function stopTicking() {
        clearTimeout(tickTimeout);
    }

    function playAlarm() {
        playBeep(600, 0.5, 'square');
        setTimeout(() => playBeep(400, 0.5, 'square'), 200);
    }

    // Helper: Speak text
    function speak(text) {
        if (synth.speaking) {
            synth.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 1.0;
        synth.speak(utterance);
    }

    // Helper: Update UI List
    function updatePlayerList() {
        playerList.innerHTML = '';
        players.forEach((player, index) => {
            const li = document.createElement('li');
            li.className = 'player-item';
            const winCount = wins[player] || 0;
            li.innerHTML = `
                <div class="player-info">
                    <span>${player}</span>
                    ${winCount > 0 ? `<span class="win-count">(${winCount} 🏆)</span>` : ''}
                </div>
                <button class="delete-btn" onclick="removePlayer(${index})">&times;</button>
            `;
            playerList.appendChild(li);
        });

        startGameBtn.disabled = players.length < 2;
    }

    // Global function for inline onclick
    window.removePlayer = (index) => {
        // No history for setup phase removals for now, or maybe we should? 
        // The requirement is "Turno anterior", implying game phase. 
        // Let's keep it simple for now.
        players.splice(index, 1);
        updatePlayerList();
    };

    // History Logic
    function saveState() {
        history.push({
            players: [...players],
            currentPlayerIndex: currentPlayerIndex,
            wins: { ...wins } // Clone wins object
        });
    }

    function undo() {
        if (history.length === 0) return;

        const previousState = history.pop();
        players = previousState.players;
        currentPlayerIndex = previousState.currentPlayerIndex;
        if (previousState.wins) {
            wins = previousState.wins;
        }

        // Stop current timer/sound
        clearInterval(timerInterval);
        stopTicking();

        // Restore UI
        // If we undid an elimination, we might need to reset the display
        if (currentPlayerIndex >= 0 && currentPlayerIndex < players.length) {
             const currentPlayer = players[currentPlayerIndex];
             currentPlayerDisplay.textContent = currentPlayer;
             currentPlayerDisplay.style.color = '';
             speak(`Sigue ${currentPlayer}`);
             startTimer();
        } else {
            // Should not happen if logic is correct, but fallback
            currentPlayerDisplay.textContent = "Presiona para iniciar";
        }
        
        // Reset timer display
        timeLeft = turnDuration;
        updateTimerDisplay();
        timerDisplay.classList.remove('urgent');

        // Reset buttons
        bastaBtn.disabled = false;
        bastaBtn.style.opacity = '1';
        bastaBtn.style.cursor = 'pointer';
        
        turnoDisplay.classList.remove('hidden');
        timerDisplay.classList.remove('hidden');
        press.classList.add('hidden');
    }

    undoBtn.addEventListener('click', undo);

    // Add Player Logic
    function addPlayer() {
        const name = playerInput.value.trim();
        if (name) {
            players.push(name);
            if (wins[name] === undefined) {
                wins[name] = 0;
            }
            playerInput.value = '';
            updatePlayerList();
            playerInput.focus();
        }
    }

    addBtn.addEventListener('click', addPlayer);
    playerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPlayer();
    });

    // Player List Controls
    moveBtn.addEventListener('click', () => {
        if (players.length < 2) return;
        const first = players.shift();
        players.push(first);
        updatePlayerList();
    });

    shuffleBtn.addEventListener('click', () => {
        if (players.length < 2) return;
        // Fisher-Yates Shuffle
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        updatePlayerList();
    });

    // Timer Logic
    function startTimer() {
        clearInterval(timerInterval);
        stopTicking(); // Reset ticking
        timeLeft = turnDuration;
        updateTimerDisplay();

        startTicking(); // Start the sound loop

        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                stopTicking();
                playAlarm();
                saveState(); // Save before elimination
                handleElimination();
                timerDisplay.classList.remove('urgent');
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= URGENTE_TIME) {
            timerDisplay.classList.add('urgent');
        } else {
            timerDisplay.classList.remove('urgent');
        }
    }

    function handleElimination() {
        const eliminatedPlayer = players[currentPlayerIndex];

        // Visual & Audio Feedback
        currentPlayerDisplay.textContent = `${eliminatedPlayer} FUERA`;
        currentPlayerDisplay.style.color = 'var(--danger-color)';
        speak(`${eliminatedPlayer} sale del juego`);

        // Remove player
        players.splice(currentPlayerIndex, 1);

        // Adjust index so next click picks the correct next player
        currentPlayerIndex--;

        if (players.length === 1) {
            setTimeout(() => {
                declareWinner(players[0]);
            }, 2000);
        }
    }

    function declareWinner(winner) {
        wins[winner] = (wins[winner] || 0) + 1;
        currentPlayerDisplay.textContent = `¡${winner} GANA!`;
        currentPlayerDisplay.style.color = 'var(--accent-color)';
        timerDisplay.textContent = '🏆';
        speak(`¡Felicidades, ganó ${winner}!`);

        // Disable game button
        bastaBtn.disabled = true;
        bastaBtn.style.opacity = '0.5';
        bastaBtn.style.cursor = 'not-allowed';
    }

    // Start Game Logic
    startGameBtn.addEventListener('click', () => {
        if (players.length < 2) return;

        turnDuration = parseInt(timeInput.value) || 10;
        currentPlayerIndex = -1;

        turnoDisplay.classList.add('hidden');
        timerDisplay.classList.add('hidden');
        setupSection.classList.add('hidden');
        gameSection.classList.remove('hidden');
        press.classList.remove('hidden');
        currentPlayerDisplay.textContent = "Presiona para iniciar";
        currentPlayerDisplay.style.color = ''; // Reset color
        timerDisplay.textContent = turnDuration;

        // Reset button state if restarting
        bastaBtn.disabled = false;
        bastaBtn.style.opacity = '1';
        bastaBtn.style.cursor = 'pointer';

        playersCache = [...players];
        history = []; // Clear history on new game

        initAudio(); // Pre-init audio context
    });

    // Game Button Logic
    bastaBtn.addEventListener('click', () => {
        if (players.length === 0) return;
        if (players.length === 1) return; // Should be handled by declareWinner but safety check

        turnoDisplay.classList.remove('hidden');
        timerDisplay.classList.remove('hidden');
        press.classList.add('hidden');

        // Logic: Move to next player
        saveState();
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        const nextPlayer = players[currentPlayerIndex];

        // Update Display
        currentPlayerDisplay.textContent = nextPlayer;
        currentPlayerDisplay.style.color = ''; // Reset color

        // Animate Text
        currentPlayerDisplay.style.animation = 'none';
        currentPlayerDisplay.offsetHeight; /* trigger reflow */
        currentPlayerDisplay.style.animation = 'slideIn 0.3s ease';

        // Speak & Start Timer
        speak(`Sigue ${nextPlayer}`);
        startTimer();
    });

    // Reset Logic
    resetBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        stopTicking();
        players = [...playersCache];
        gameSection.classList.add('hidden');
        setupSection.classList.remove('hidden');
        // Update list in case players were removed
        updatePlayerList();
    });
});
