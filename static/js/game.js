document.addEventListener('DOMContentLoaded', () => {
    // Game canvas setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Game constants
    const DEFAULT_GAME_SPEED = 160; // milliseconds
    const GRID_SIZE = 20;
    let CANVAS_SIZE = 400;
    let CELL_SIZE = CANVAS_SIZE / GRID_SIZE;
    
    // Detect if user is on mobile device
    const isMobileDevice = () => {
        return (window.innerWidth <= 800) && (
            ('ontouchstart' in window) || 
            (navigator.maxTouchPoints > 0) || 
            (navigator.msMaxTouchPoints > 0)
        );
    };
    
    // Adjust game speed for mobile devices
    const getInitialGameSpeed = () => {
        // Use the same speed on mobile and desktop for consistency
        return DEFAULT_GAME_SPEED;
    };
    
    // Adjust canvas size for mobile
    function adjustCanvasSize() {
        const maxWidth = isMobileDevice() 
            ? Math.min(window.innerWidth - 20, 400)
            : 400;
        
        canvas.width = maxWidth;
        canvas.height = maxWidth;
        CANVAS_SIZE = maxWidth;
        CELL_SIZE = CANVAS_SIZE / GRID_SIZE;
    }
    
    // Call on page load and resize
    adjustCanvasSize();
    window.addEventListener('resize', adjustCanvasSize);
    window.addEventListener('orientationchange', () => {
        // Wait for the orientation change to complete
        setTimeout(adjustCanvasSize, 300);
        
        // Pause the game during orientation change to prevent accidental moves
        if (gameRunning) {
            clearInterval(gameInterval);
            setTimeout(() => {
                if (gameRunning) {
                    gameInterval = setInterval(gameLoop, gameSpeed);
                }
            }, 500);
        }
    });
    
    // Game variables
    let snake = [];
    let direction = 'right';
    let food = {};
    let score = 0;
    let gameRunning = false;
    let gameInterval;
    let gameSpeed = getInitialGameSpeed();
    let foodEmojis = ['🐷', '🐘', '🦁'];
    let currentFoodEmoji = foodEmojis[0];
    let foodMoveInterval;
    let foodDirection = { x: 1, y: 0 };
    let highScore = localStorage.getItem('snakeHighScore') || 0;
    let hardMode = false;
    
    // DOM elements
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('highScore');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const muteBtn = document.getElementById('muteBtn');
    const speedStatusElement = document.getElementById('speedStatus');
    const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
    const upBtn = document.getElementById('upBtn');
    const downBtn = document.getElementById('downBtn');
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    
    // Sound elements
    const moveSound = document.getElementById('moveSound');
    const eatSound = document.getElementById('eatSound');
    const gameOverSound = document.getElementById('gameOverSound');
    const buttonSound = document.getElementById('buttonSound');
    
    // Sound state
    let soundMuted = localStorage.getItem('snakeSoundMuted') === 'true';
    let soundsLoaded = false;
    let audioContext = null;
    let audioInitialized = false;
    
    // Audio initialization for mobile
    function initAudio() {
        if (audioInitialized) return;
        
        console.log("Initializing audio system...");
        
        try {
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume audio context (needed for mobile)
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log("Audio context resumed successfully");
                }).catch(err => {
                    console.error("Failed to resume audio context:", err);
                });
            }
            
            // Unlock audio on iOS
            const unlockiOSAudio = () => {
                // Create and play a silent buffer
                const buffer = audioContext.createBuffer(1, 1, 22050);
                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(audioContext.destination);
                source.start(0);
                
                console.log("iOS audio unlock attempted");
                
                // Try to play each sound with zero volume
                [moveSound, eatSound, gameOverSound, buttonSound].forEach(sound => {
                    sound.volume = 0;
                    const promise = sound.play();
                    if (promise) {
                        promise.then(() => {
                            sound.pause();
                            sound.currentTime = 0;
                            console.log(`Sound unlocked: ${sound.id}`);
                        }).catch(e => {
                            console.log(`Could not unlock ${sound.id}:`, e);
                        });
                    }
                });
            };
            
            unlockiOSAudio();
            audioInitialized = true;
            console.log("Audio system initialized");
            
            // Play a test sound
            setTimeout(() => {
                playSound(buttonSound, true);
            }, 500);
            
        } catch (e) {
            console.error("Audio initialization error:", e);
        }
    }
    
    // Add audio initialization to various user interactions
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    
    // Sound functions
    function playSound(sound, force = false) {
        if (soundMuted && !force) return;
        
        try {
            console.log(`Attempting to play sound: ${sound.id}`);
            
            // Make sure audio is initialized
            if (!audioInitialized) {
                initAudio();
            }
            
            // Reset the sound to the beginning
            sound.currentTime = 0;
            sound.volume = 0.8;
            
            // Play the sound with promise handling
            const playPromise = sound.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log(`Sound played successfully: ${sound.id}`);
                }).catch(error => {
                    console.error(`Error playing sound ${sound.id}:`, error);
                    
                    // Try to recover by re-initializing audio
                    if (!force) {
                        initAudio();
                        // Try once more with a slight delay
                        setTimeout(() => {
                            playSound(sound, true);
                        }, 100);
                    }
                });
            }
        } catch (e) {
            console.error(`Error in playSound for ${sound.id}:`, e);
        }
    }
    
    // Load sounds
    const sounds = [moveSound, eatSound, gameOverSound, buttonSound];
    let loadedSounds = 0;
    
    sounds.forEach(sound => {
        sound.addEventListener('canplaythrough', () => {
            loadedSounds++;
            if (loadedSounds === sounds.length) {
                console.log('All sounds loaded');
                soundsLoaded = true;
            }
        });
        
        sound.addEventListener('error', (e) => {
            console.error('Error loading sound:', e);
        });
    });
    
    // Update mute button state
    function updateMuteButton() {
        if (soundMuted) {
            muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            muteBtn.classList.add('muted');
        } else {
            muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            muteBtn.classList.remove('muted');
        }
    }
    
    // Initialize mute button state
    updateMuteButton();
    
    // Initialize high score display
    highScoreElement.textContent = highScore;
    
    // Initialize speed display on page load
    function updateSpeedStatus() {
        // Display the actual gameSpeed value in milliseconds
        speedStatusElement.textContent = gameSpeed;
    }
    updateSpeedStatus();
    
    // Initialize game
    function initGame() {
        // Get selected difficulty
        hardMode = document.querySelector('input[name="difficulty"]:checked').value === 'hard';
        
        // Create initial snake (3 segments)
        snake = [
            {x: 5, y: 10},
            {x: 4, y: 10},
            {x: 3, y: 10}
        ];
        
        // Generate initial food
        generateFood();
        
        // Reset score
        score = 0;
        scoreElement.textContent = score;
        
        // Reset speed to default
        gameSpeed = getInitialGameSpeed();
        
        // Reset speed display
        updateSpeedStatus();
        
        // Set initial direction
        direction = 'right';
        
        // Clear any existing food movement interval
        if (foodMoveInterval) {
            clearInterval(foodMoveInterval);
            foodMoveInterval = null;
        }
        
        // Start food movement if in hard mode
        if (hardMode && gameRunning) {
            startFoodMovement();
        }
        
        // Draw initial state
        draw();
    }
    
    // Generate food at random position
    function generateFood() {
        food = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        
        // Rotate to next food emoji
        const currentIndex = foodEmojis.indexOf(currentFoodEmoji);
        const nextIndex = (currentIndex + 1) % foodEmojis.length;
        currentFoodEmoji = foodEmojis[nextIndex];
        
        // Make sure food doesn't appear on snake
        for (let segment of snake) {
            if (segment.x === food.x && segment.y === food.y) {
                generateFood(); // Try again
                break;
            }
        }
    }
    
    // Game loop
    function gameLoop() {
        // Move snake
        moveSnake();
        
        // Check collisions
        if (checkCollision()) {
            gameOver();
            return;
        }
        
        // Check if snake eats food
        if (checkFoodCollision()) {
            // Don't remove tail (snake grows)
        } else {
            // Remove tail (snake moves)
            snake.pop();
        }
        
        // Draw updated state
        draw();
    }
    
    // Check if snake eats food
    function checkFoodCollision() {
        const head = snake[0];
        if (head.x === food.x && head.y === food.y) {
            // Increase score
            score++;
            scoreElement.textContent = score;
            
            // Play eat sound
            playSound(eatSound);
            
            // Check if new high score
            if (score > highScore) {
                highScore = score;
                highScoreElement.textContent = highScore;
                localStorage.setItem('snakeHighScore', highScore);
            }
            
            // Generate new food
            generateFood();
            
            // Increase speed slightly
            if (gameSpeed > 80 && score % 2 === 0) {
                clearInterval(gameInterval);
                gameSpeed -= 1;
                gameInterval = setInterval(gameLoop, gameSpeed);
                
                // Update speed display
                updateSpeedStatus();
            }
            
            // Don't remove tail (snake grows)
            return true;
        }
        return false;
    }
    
    // Move snake based on current direction
    function moveSnake() {
        const head = {x: snake[0].x, y: snake[0].y};
        
        switch (direction) {
            case 'up':
                head.y--;
                break;
            case 'down':
                head.y++;
                break;
            case 'left':
                head.x--;
                break;
            case 'right':
                head.x++;
                break;
        }
        
        // Add new head
        snake.unshift(head);
    }
    
    // Check for collisions with walls or self
    function checkCollision() {
        const head = snake[0];
        
        // Check wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
            return true;
        }
        
        // Check self collision (skip head)
        for (let i = 1; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                return true;
            }
        }
        
        return false;
    }
    
    // Move food randomly (for hard mode)
    function moveFood() {
        if (!hardMode || !gameRunning) return;
        
        // Randomly change direction sometimes
        if (Math.random() < 0.3) {
            const directions = ['up', 'down', 'left', 'right'];
            foodDirection = directions[Math.floor(Math.random() * directions.length)];
        }
        
        // Check if food would collide with snake
        const nextFoodPos = { x: food.x, y: food.y };
        
        switch (foodDirection) {
            case 'up':
                nextFoodPos.y--;
                break;
            case 'down':
                nextFoodPos.y++;
                break;
            case 'left':
                nextFoodPos.x--;
                break;
            case 'right':
                nextFoodPos.x++;
                break;
        }
        
        // Check if next position would be inside snake
        const wouldCollideWithSnake = snake.some(segment => 
            segment.x === nextFoodPos.x && segment.y === nextFoodPos.y
        );
        
        if (wouldCollideWithSnake) {
            // Change to opposite direction
            switch (foodDirection) {
                case 'up': foodDirection = 'down'; break;
                case 'down': foodDirection = 'up'; break;
                case 'left': foodDirection = 'right'; break;
                case 'right': foodDirection = 'left'; break;
            }
            return; // Skip this move
        }
        
        // Move food according to direction
        switch (foodDirection) {
            case 'up':
                food.y--;
                // Check top border
                if (food.y < 0) {
                    food.y = 0;
                    foodDirection = 'down'; // Bounce back
                }
                break;
            case 'down':
                food.y++;
                // Check bottom border
                if (food.y >= GRID_SIZE) {
                    food.y = GRID_SIZE - 1;
                    foodDirection = 'up'; // Bounce back
                }
                break;
            case 'left':
                food.x--;
                // Check left border
                if (food.x < 0) {
                    food.x = 0;
                    foodDirection = 'right'; // Bounce back
                }
                break;
            case 'right':
                food.x++;
                // Check right border
                if (food.x >= GRID_SIZE) {
                    food.x = GRID_SIZE - 1;
                    foodDirection = 'left'; // Bounce back
                }
                break;
        }
    }
    
    // Start food movement interval
    function startFoodMovement() {
        if (hardMode) {
            // Move food every 800ms (much slower than snake)
            foodMoveInterval = setInterval(moveFood, 800);
        }
    }
    
    // Stop food movement
    function stopFoodMovement() {
        if (foodMoveInterval) {
            clearInterval(foodMoveInterval);
            foodMoveInterval = null;
        }
    }
    
    // Game over
    function gameOver() {
        gameRunning = false;
        clearInterval(gameInterval);
        if (hardMode) {
            clearInterval(foodMoveInterval);
        }
        
        // Play game over sound
        playSound(gameOverSound);
        
        // Show alert after a short delay
        setTimeout(() => {
            alert(`Game Over! Your score: ${score}`);
        }, 100);
    }
    
    // Draw everything
    function draw() {
        // Clear canvas
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw snake
        for (let i = 0; i < snake.length; i++) {
            // Head is a different color
            if (i === 0) {
                ctx.fillStyle = '#4CAF50'; // Green head
            } else {
                ctx.fillStyle = '#8BC34A'; // Lighter green body
            }
            
            ctx.fillRect(
                snake[i].x * CELL_SIZE,
                snake[i].y * CELL_SIZE,
                CELL_SIZE - 1,
                CELL_SIZE - 1
            );
        }
        
        // Draw food as emoji
        ctx.font = `${CELL_SIZE * 1.2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            currentFoodEmoji,
            food.x * CELL_SIZE + CELL_SIZE / 2,
            food.y * CELL_SIZE + CELL_SIZE / 2
        );
        
        // Draw grid (optional, for debugging)
        // drawGrid();
    }
    
    // Draw grid lines (helper function)
    function drawGrid() {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        
        // Vertical lines
        for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
    
    // Handle keyboard input
    document.addEventListener('keydown', (e) => {
        if (!gameRunning) return;
        
        // Prevent default behavior for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
        
        let directionChanged = false;
        
        switch (e.key) {
            case 'ArrowUp':
                if (direction !== 'down') {
                    direction = 'up';
                    directionChanged = true;
                }
                break;
            case 'ArrowDown':
                if (direction !== 'up') {
                    direction = 'down';
                    directionChanged = true;
                }
                break;
            case 'ArrowLeft':
                if (direction !== 'right') {
                    direction = 'left';
                    directionChanged = true;
                }
                break;
            case 'ArrowRight':
                if (direction !== 'left') {
                    direction = 'right';
                    directionChanged = true;
                }
                break;
        }
        
        if (directionChanged) {
            playSound(moveSound);
        }
    });
    
    // Mobile control buttons with touch feedback
    upBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        initAudio();
    }, { passive: false });
    
    upBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (gameRunning && direction !== 'down') {
            direction = 'up';
            playSound(buttonSound);
        }
    }, { passive: false });
    
    downBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        initAudio();
    }, { passive: false });
    
    downBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (gameRunning && direction !== 'up') {
            direction = 'down';
            playSound(buttonSound);
        }
    }, { passive: false });
    
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        initAudio();
    }, { passive: false });
    
    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (gameRunning && direction !== 'right') {
            direction = 'left';
            playSound(buttonSound);
        }
    }, { passive: false });
    
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        initAudio();
    }, { passive: false });
    
    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (gameRunning && direction !== 'left') {
            direction = 'right';
            playSound(buttonSound);
        }
    }, { passive: false });
    
    // Also keep click events for hybrid devices
    upBtn.addEventListener('click', () => {
        initAudio(); // Ensure audio is initialized
        if (gameRunning && direction !== 'down') {
            direction = 'up';
            playSound(buttonSound);
        }
    });
    
    downBtn.addEventListener('click', () => {
        initAudio(); // Ensure audio is initialized
        if (gameRunning && direction !== 'up') {
            direction = 'down';
            playSound(buttonSound);
        }
    });
    
    leftBtn.addEventListener('click', () => {
        initAudio(); // Ensure audio is initialized
        if (gameRunning && direction !== 'right') {
            direction = 'left';
            playSound(buttonSound);
        }
    });
    
    rightBtn.addEventListener('click', () => {
        initAudio(); // Ensure audio is initialized
        if (gameRunning && direction !== 'left') {
            direction = 'right';
            playSound(buttonSound);
        }
    });
    
    // Touch swipe controls
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    
    canvas.addEventListener('touchstart', (e) => {
        // Prevent default to stop scrolling
        e.preventDefault();
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        // Prevent default to stop scrolling
        if (gameRunning) {
            e.preventDefault();
        }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        if (!gameRunning) return;
        
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, false);
    
    function handleSwipe() {
        const xDiff = touchStartX - touchEndX;
        const yDiff = touchStartY - touchEndY;
        
        // Determine if the swipe was horizontal or vertical
        if (Math.abs(xDiff) > Math.abs(yDiff)) {
            // Horizontal swipe
            if (xDiff > 10) {
                // Swipe left
                if (direction !== 'right') {
                    direction = 'left';
                    playSound(buttonSound);
                }
            } else if (xDiff < -10) {
                // Swipe right
                if (direction !== 'left') {
                    direction = 'right';
                    playSound(buttonSound);
                }
            }
        } else {
            // Vertical swipe
            if (yDiff > 10) {
                // Swipe up
                if (direction !== 'down') {
                    direction = 'up';
                    playSound(buttonSound);
                }
            } else if (yDiff < -10) {
                // Swipe down
                if (direction !== 'up') {
                    direction = 'down';
                    playSound(buttonSound);
                }
            }
        }
    }
    
    // Add visual feedback for mobile buttons
    const controlButtons = document.querySelectorAll('.control-btn');
    
    controlButtons.forEach(btn => {
        // Add active class on touch start
        btn.addEventListener('touchstart', () => {
            btn.classList.add('active');
        });
        
        // Remove active class on touch end
        btn.addEventListener('touchend', () => {
            btn.classList.add('touch-release');
            setTimeout(() => {
                btn.classList.remove('active');
                btn.classList.remove('touch-release');
            }, 150);
        });
        
        // Remove active class if touch moves out of button
        btn.addEventListener('touchcancel', () => {
            btn.classList.remove('active');
        });
    });
    
    // Start button
    startBtn.addEventListener('click', () => {
        // Initialize audio on first interaction
        initAudio();
        
        // Small delay to ensure audio is initialized
        setTimeout(() => {
            playSound(buttonSound);
            
            if (gameRunning) {
                // Pause game
                clearInterval(gameInterval);
                if (hardMode) {
                    clearInterval(foodMoveInterval);
                }
                gameRunning = false;
                startBtn.textContent = 'Resume Game';
            } else {
                // Start or resume game
                gameInterval = setInterval(gameLoop, gameSpeed);
                if (hardMode) {
                    startFoodMovement();
                }
                gameRunning = true;
                startBtn.textContent = 'Pause Game';
            }
        }, 50);
    });
    
    // Reset button
    resetBtn.addEventListener('click', () => {
        // Initialize audio on first interaction
        initAudio();
        
        // Small delay to ensure audio is initialized
        setTimeout(() => {
            playSound(buttonSound);
            clearInterval(gameInterval);
            if (hardMode) {
                clearInterval(foodMoveInterval);
            }
            gameRunning = false;
            startBtn.textContent = 'Start Game';
            initGame();
        }, 50);
    });
    
    // Mute button
    muteBtn.addEventListener('click', () => {
        // Initialize audio on first interaction
        initAudio();
        
        soundMuted = !soundMuted;
        localStorage.setItem('snakeSoundMuted', soundMuted);
        updateMuteButton();
        
        // Play a sound if unmuting
        if (!soundMuted) {
            setTimeout(() => {
                playSound(buttonSound);
            }, 50);
        }
    });
    
    // Difficulty change handler
    difficultyRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            hardMode = radio.value === 'hard';
            
            // Only reset if game is not running
            if (!gameRunning) {
                initGame();
            }
        });
    });
    
    // Initialize game on load
    initGame();
});
