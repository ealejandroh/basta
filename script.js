document.addEventListener('DOMContentLoaded', () => {
    // State
    let players = [];
    let currentPlayerIndex = -1;
    let synth = window.speechSynthesis;
    let timerInterval;
    let timeLeft;
    let turnDuration = 10;
    let audioCtx;

    const URGENTE_TIME = 5;

    // Elements
    const playerInput = document.getElementById('player-input');
    const timeInput = document.getElementById('time-input');
    const addBtn = document.getElementById('add-btn');
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
            li.innerHTML = `
                <span>${player}</span>
                <button class="delete-btn" onclick="removePlayer(${index})">&times;</button>
            `;
            playerList.appendChild(li);
        });

        startGameBtn.disabled = players.length < 2;
    }

    // Global function for inline onclick
    window.removePlayer = (index) => {
        players.splice(index, 1);
        updatePlayerList();
    };

    // Add Player Logic
    function addPlayer() {
        const name = playerInput.value.trim();
        if (name) {
            players.push(name);
            playerInput.value = '';
            updatePlayerList();
            playerInput.focus();
        }
    }

    addBtn.addEventListener('click', addPlayer);
    playerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPlayer();
    });

    // Timer Logic
    function startTimer() {
        clearInterval(timerInterval);
        timeLeft = turnDuration;
        updateTimerDisplay();

        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();

            if (timeLeft <= URGENTE_TIME && timeLeft > 0) {
                playBeep(800, 0.1); // Warning beeps
            }

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                playAlarm();
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
        currentPlayerDisplay.textContent = "Presiona para iniciar";
        currentPlayerDisplay.style.color = ''; // Reset color
        timerDisplay.textContent = turnDuration;

        // Reset button state if restarting
        bastaBtn.disabled = false;
        bastaBtn.style.opacity = '1';
        bastaBtn.style.cursor = 'pointer';

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
        gameSection.classList.add('hidden');
        setupSection.classList.remove('hidden');
        // Update list in case players were removed
        updatePlayerList();
    });
});
