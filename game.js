// PvZ Match-3 Game - Core Logic
// Version: 2026-03-08

class PvZMatchGame {
    constructor() {
        this.handSize = 7;
        this.baseCardTypes = 12;
        this.faceDownRatio = 0.15;
        this.exposeRatio = 0.40;
        this.timeLimit = 9 * 60;
        this.currentTime = this.timeLimit;
        this.timer = null;
        
        this.pvzEmojis = {
            plants: ['🌻', '🌱', '🌽', '🍄', '🌵', '🌷', '🌹', '🍀', '🌿', '🥕', '🍅', '🥬'],
            zombies: ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8', 'Z9', 'Z10', 'Z11', 'Z12']
        };
        
        this.level = 1;
        this.score = 0;
        this.moves = 0;
        this.history = [];
        this.cards = [];
        this.hand = [];
        this.gameActive = false;
        this.isPaused = false;
        
        this.levelConfigs = [
            { layers: 3, totalCards: 90, cardTypes: 12, spread: 0.9 },
            { layers: 3, totalCards: 108, cardTypes: 12, spread: 0.85 },
            { layers: 4, totalCards: 126, cardTypes: 14, spread: 0.8 },
            { layers: 4, totalCards: 144, cardTypes: 16, spread: 0.75 },
            { layers: 5, totalCards: 162, cardTypes: 18, spread: 0.7 },
            { layers: 5, totalCards: 180, cardTypes: 20, spread: 0.65 },
            { layers: 6, totalCards: 198, cardTypes: 22, spread: 0.6 },
            { layers: 6, totalCards: 216, cardTypes: 24, spread: 0.55 },
            { layers: 7, totalCards: 234, cardTypes: 24, spread: 0.5 },
            { layers: 7, totalCards: 252, cardTypes: 24, spread: 0.45 },
        ];
        
        this.initGame();
    }
    
    initGame() {
        this.bindEvents();
        this.newGame();
        this.startTimer();
    }
    
    getLevelConfig() {
        return this.levelConfigs[Math.min(this.level - 1, this.levelConfigs.length - 1)];
    }
    
    createCards() {
        const config = this.getLevelConfig();
        const cards = [];
        const cardsPerType = [];
        let remaining = config.totalCards;
        
        for (let i = 0; i < config.cardTypes; i++) {
            const count = Math.min(Math.max(3, Math.floor(Math.random() * 3) * 3 + 3), remaining - (config.cardTypes - i - 1) * 3);
            cardsPerType.push(count);
            remaining -= count;
        }
        
        while (remaining > 0) {
            const idx = Math.floor(Math.random() * config.cardTypes);
            cardsPerType[idx] += 3;
            remaining -= 3;
        }
        
        let id = 0;
        for (let i = 0; i < config.cardTypes; i++) {
            for (let j = 0; j < cardsPerType[i]; j++) {
                cards.push({ id: id++, emoji: '', faceUp: true, removed: false, layer: 0, x: 0, y: 0, width: 60, height: 60, rotation: 0 });
            }
        }
        return cards;
    }
    
    generateStackLayout(cards) {
        const config = this.getLevelConfig();
        const positions = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 10; col++) {
                const baseX = 20 + col * 45;
                const baseY = 20 + row * 45;
                const height = Math.floor(Math.random() * config.layers) + 1;
                
                for (let l = 0; l < height; l++) {
                    positions.push({
                        x: baseX + l * 3 + (Math.random() - 0.5) * 20,
                        y: baseY - l * 3 + (Math.random() - 0.5) * 20,
                        layer: l,
                        rotation: (Math.random() - 0.5) * 30
                    });
                }
            }
        }
        
        while (positions.length < cards.length) {
            const base = positions[Math.floor(Math.random() * positions.length)];
            positions.push({
                x: base.x + 3 + (Math.random() - 0.5) * 30,
                y: base.y - 3 + (Math.random() - 0.5) * 30,
                layer: base.layer + 1,
                rotation: (Math.random() - 0.5) * 45
            });
        }
        
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        for (let i = 0; i < cards.length; i++) {
            cards[i].x = positions[i].x;
            cards[i].y = positions[i].y;
            cards[i].layer = positions[i].layer;
            cards[i].rotation = positions[i].rotation || 0;
        }
        
        this.assignEmojis(cards, config);
        
        for (const card of cards) {
            if (Math.random() < this.faceDownRatio) card.faceUp = false;
        }
        
        cards.sort((a, b) => a.layer - b.layer);
        return cards;
    }
    
    assignEmojis(cards, config) {
        const groups = {};
        for (const card of cards) {
            const key = `${card.x - card.layer * 4},${card.y + card.layer * 4}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(card);
        }
        
        const stacks = Object.values(groups);
        const total = cards.length;
        const base = Math.floor(total / config.cardTypes);
        const remainder = total % config.cardTypes;
        
        const remaining = [];
        for (let i = 0; i < config.cardTypes; i++) {
            let count = base + (i < remainder ? 1 : 0);
            while (count % 3 !== 0) count++;
            remaining.push(count);
        }
        
        const layerGroups = {};
        for (const stack of stacks) {
            for (const card of stack) {
                if (!layerGroups[card.layer]) layerGroups[card.layer] = [];
                layerGroups[card.layer].push(card);
            }
        }
        
        const layers = Object.keys(layerGroups).map(Number).sort((a, b) => b - a);
        
        for (const layer of layers) {
            const usedInLayer = new Set();
            for (const card of layerGroups[layer]) {
                const stack = groups[`${card.x - card.layer * 4},${card.y + card.layer * 4}`];
                const usedInStack = new Set(stack.filter(c => c.emoji).map(c => c.emoji));
                
                let best = -1;
                for (let i = 0; i < config.cardTypes; i++) {
                    const emoji = this.pvzEmojis.plants[i % 12];
                    if (remaining[i] > 0 && !usedInLayer.has(i) && !usedInStack.has(emoji)) {
                        if (best === -1 || remaining[i] > remaining[best]) best = i;
                    }
                }
                
                if (best !== -1) {
                    card.emoji = this.pvzEmojis.plants[best % 12];
                    remaining[best]--;
                    usedInLayer.add(best);
                } else {
                    for (let i = 0; i < config.cardTypes; i++) {
                        const emoji = this.pvzEmojis.plants[i % 12];
                        if (remaining[i] > 0 && !usedInStack.has(emoji)) {
                            card.emoji = emoji;
                            remaining[i]--;
                            break;
                        }
                    }
                }
            }
        }
    }
    
    renderBoard() {
        const board = document.getElementById('gameBoard');
        if (!board) return;
        
        const indicator = board.querySelector('.layer-indicator');
        const fragment = document.createDocumentFragment();
        if (indicator) fragment.appendChild(indicator);
        
        const maxLayer = Math.max(...this.cards.map(c => c.layer), 0);
        const el = document.getElementById('layerCount');
        if (el) el.textContent = maxLayer + 1;
        
        const handIds = new Set(this.hand.map(c => c.id));
        let count = 0;
        
        for (const card of this.cards) {
            if (card.removed || handIds.has(card.id)) continue;
            count++;
            
            const el = document.createElement('div');
            el.className = 'card ' + (card.faceUp ? 'face-up' : 'face-down');
            el.dataset.id = card.id;
            el.style.left = card.x + 'px';
            el.style.top = card.y + 'px';
            el.style.zIndex = card.layer + 1;
            if (card.rotation) el.style.transform = 'rotate(' + card.rotation + 'deg)';
            if (card.faceUp) el.textContent = card.emoji;
            
            if (this.isCardClickable(card)) {
                el.classList.add('clickable');
                el.addEventListener('click', () => this.handleCardClick(card));
            }
            fragment.appendChild(el);
        }
        
        board.innerHTML = '';
        board.appendChild(fragment);
        this.updateStats();
    }
    
    isCardClickable(card) {
        if (card.removed || this.hand.some(c => c.id === card.id)) return false;
        
        // 检查是否有上层牌遮挡
        for (const other of this.cards) {
            if (other.removed || other.id === card.id || other.layer <= card.layer) continue;
            
            const overlap = this.calcOverlap(card, other);
            // 只有遮挡超过 60% 才认为不可点击（原来是 40%）
            if (overlap > 0.60) return false;
        }
        return true;
    }
    
    calcOverlap(c1, c2) {
        const ox = Math.max(0, Math.min(c1.x + 60, c2.x + 60) - Math.max(c1.x, c2.x));
        const oy = Math.max(0, Math.min(c1.y + 60, c2.y + 60) - Math.max(c1.y, c2.y));
        return (ox * oy) / 3600;
    }
    
    handleCardClick(card) {
        if (!this.gameActive) return;
        if (!this.isCardClickable(card)) return;
        
        // 检查手牌是否已满
        if (this.hand.length >= this.handSize) {
            this.gameOver('卡槽已满！');
            return;
        }
        
        this.saveHistory();
        
        // 获取目标位置
        const slots = document.querySelectorAll('.hand-slot');
        const targetSlot = slots[this.hand.length - 1];
        const targetRect = targetSlot ? targetSlot.getBoundingClientRect() : null;
        
        // 先添加到数据（但不渲染手牌）
        card.faceUp = true;
        this.hand.push(card);
        this.moves++;
        
        // 桌面牌的动画
        const el = document.querySelector('.card[data-id="' + card.id + '"]');
        if (el && targetRect) {
            // 创建克隆用于动画
            const clone = el.cloneNode(true);
            clone.style.position = 'fixed';
            clone.style.zIndex = '9999';
            clone.style.pointerEvents = 'none';
            clone.style.transition = 'none';
            
            const rect = el.getBoundingClientRect();
            clone.style.left = rect.left + 'px';
            clone.style.top = rect.top + 'px';
            clone.style.width = rect.width + 'px';
            clone.style.height = rect.height + 'px';
            document.body.appendChild(clone);
            
            // 隐藏原牌
            el.style.opacity = '0';
            
            // 动画：先向上，再向手牌区
            const midX = rect.left + (targetRect.left - rect.left) / 2;
            const midY = rect.top - 100;
            
            requestAnimationFrame(() => {
                clone.style.transition = 'all 0.2s ease-out';
                clone.style.left = midX + 'px';
                clone.style.top = midY + 'px';
                clone.style.transform = 'scale(0.9)';
            });
            
            // 动画结束后，更新手牌区
            setTimeout(() => {
                clone.style.transition = 'all 0.25s ease-in';
                clone.style.left = targetRect.left + 'px';
                clone.style.top = targetRect.top + 'px';
                clone.style.transform = 'scale(0.7) rotate(180deg)';
                clone.style.opacity = '0.3';
            }, 200);
            
            // 动画完全结束后，更新手牌并检查消除
            setTimeout(() => { 
                clone.remove();
                
                // 先渲染手牌区（让用户看到牌已加入）
                this.renderHand();
                this.updateStats();
                
                // 短暂延迟后再检查消除（让用户看清）
                setTimeout(() => {
                    const hasMatch = this.checkMatches();
                    
                    // 如果没有消除，再移除桌面的牌
                    if (!hasMatch) {
                        this.renderBoard();
                    }
                }, 100);
            }, 450);
        } else {
            // 没有动画，直接更新
            this.renderHand();
            this.renderBoard();
            this.updateStats();
            this.checkMatches();
        }
    }
    
    // animateToHand removed - animation is now handled in handleCardClick
    
    renderHand() {
        const container = document.getElementById('handSlots');
        if (!container) return;
        
        container.innerHTML = '';
        for (let i = 0; i < this.handSize; i++) {
            const slot = document.createElement('div');
            slot.className = 'hand-slot' + (i < this.hand.length ? ' filled' : '');
            const card = this.hand[i];
            if (card && card.emoji) slot.textContent = card.emoji;
            container.appendChild(slot);
        }
    }
    
    checkMatches() {
        if (this.hand.length < 3) {
            // 手牌未满 3 张，检查是否已满
            if (this.hand.length >= this.handSize) {
                setTimeout(() => this.gameOver('卡槽已满！'), 300);
            }
            return false;
        }
        
        const counts = {};
        for (const card of this.hand) {
            if (!card || !card.emoji) continue;
            counts[card.emoji] = (counts[card.emoji] || 0) + 1;
        }
        
        for (const emoji in counts) {
            if (counts[emoji] >= 3) {
                const toRemove = [];
                for (const card of this.hand) {
                    if (card.emoji === emoji && toRemove.length < 3) {
                        toRemove.push(card);
                    }
                }
                
                // 标记为已移除
                for (const card of toRemove) card.removed = true;
                // 从手牌中移除
                this.hand = this.hand.filter(c => !toRemove.includes(c));
                this.score += 300;
                
                // 重新渲染桌面和手牌
                this.renderBoard();
                this.renderHand();
                this.updateStats();
                
                // 检查胜利
                if (this.checkWin()) setTimeout(() => this.winGame(), 500);
                return true;
            }
        }
        
        // 没有匹配，检查是否手牌已满
        if (this.hand.length >= this.handSize) {
            setTimeout(() => this.gameOver('卡槽已满！'), 300);
        }
        
        return false;
    }
    
    checkWin() { return this.cards.every(c => c.removed); }
    winGame() { 
        this.gameActive = false; 
        const scoreEl = document.getElementById('finalScoreWin'); 
        if (scoreEl) scoreEl.textContent = this.score; 
        const winMsg = document.getElementById('winMessage');
        if (winMsg) winMsg.style.display = 'flex'; 
    }
    
    gameOver(reason) { 
        this.gameActive = false; 
        const reasonEl = document.getElementById('loseReason');
        if (reasonEl) reasonEl.textContent = reason;
        const loseMsg = document.getElementById('loseMessage');
        if (loseMsg) loseMsg.style.display = 'flex'; 
    }
    
    saveHistory() {
        this.history.push({
            hand: this.hand.map(c => c.id),
            cards: this.cards.map(c => ({ id: c.id, faceUp: c.faceUp, removed: c.removed })),
            score: this.score,
            moves: this.moves
        });
        if (this.history.length > 10) this.history.shift();
    }
    
    undo() {
        if (this.history.length === 0 || !this.gameActive) return;
        const state = this.history.pop();
        this.hand = this.cards.filter(c => state.hand.includes(c.id));
        for (const s of state.cards) {
            const card = this.cards.find(c => c.id === s.id);
            if (card) { card.faceUp = s.faceUp; card.removed = s.removed; }
        }
        this.score = state.score;
        this.moves = state.moves;
        this.renderBoard();
        this.renderHand();
        this.updateStats();
    }
    
    shuffle() {
        if (!this.gameActive) return;
        const remaining = this.cards.filter(c => !c.removed);
        for (const card of this.hand) card.faceUp = false;
        this.hand = [];
        const emojis = remaining.map(c => c.emoji);
        for (let i = emojis.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [emojis[i], emojis[j]] = [emojis[j], emojis[i]];
        }
        for (let i = 0; i < remaining.length; i++) remaining[i].emoji = emojis[i];
        this.score = Math.max(0, this.score - 50);
        this.renderBoard();
        this.renderHand();
        this.updateStats();
    }
    
    updateStats() {
        const remaining = this.cards.filter(c => !c.removed).length - this.hand.length;
        const remainingEl = document.getElementById('remaining');
        const movesEl = document.getElementById('moves');
        const scoreEl = document.getElementById('score');
        const levelEl = document.getElementById('level');
        
        if (remainingEl) remainingEl.textContent = remaining;
        if (movesEl) movesEl.textContent = this.moves;
        if (scoreEl) scoreEl.textContent = this.score;
        if (levelEl) levelEl.textContent = this.level;
        
        this.updateTimer();
    }
    
    startTimer() {
        this.currentTime = this.timeLimit;
        this.updateTimer();
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            if (this.gameActive && !this.isPaused) {
                this.currentTime--;
                this.updateTimer();
                if (this.currentTime <= 0) this.gameOver('Time!');
            }
        }, 1000);
    }
    
    updateTimer() {
        const m = Math.floor(this.currentTime / 60);
        const s = this.currentTime % 60;
        const timeStr = m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
        
        let timerEl = document.getElementById('timer');
        if (!timerEl) {
            const statsEl = document.querySelector('.stats');
            if (statsEl) {
                const timerDiv = document.createElement('div');
                timerDiv.className = 'stat-item';
                timerDiv.innerHTML = '<span class="stat-label">时间:</span><span class="stat-value" id="timer">' + timeStr + '</span>';
                statsEl.insertBefore(timerDiv, statsEl.firstChild);
            }
        } else {
            if (timerEl) timerEl.textContent = timeStr;
        }
    }
    
    newGame() {
        this.level = 1;
        this.score = 0;
        this.moves = 0;
        this.history = [];
        this.hand = [];
        this.currentTime = this.timeLimit;
        this.startLevel();
    }
    
    nextLevel() {
        this.level++;
        this.history = [];
        this.hand = [];
        document.getElementById('winMessage').style.display = 'none';
        this.startLevel();
    }
    
    restartLevel() {
        this.history = [];
        this.hand = [];
        document.getElementById('loseMessage').style.display = 'none';
        this.startLevel();
    }
    
    startLevel() {
        this.gameActive = true;
        this.cards = this.createCards();
        this.cards = this.generateStackLayout(this.cards);
        this.renderBoard();
        this.renderHand();
        this.updateStats();
        this.currentTime = this.timeLimit;
        this.updateTimer();
    }
    
    bindEvents() {
        const pauseBtn = document.getElementById('pauseBtn');
        const shuffleBtn = document.getElementById('shuffleBtn');
        const undoBtn = document.getElementById('undoBtn');
        const newGameBtn = document.getElementById('newGameBtn');
        
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.togglePause());
        if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.shuffle());
        if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
        if (newGameBtn) newGameBtn.addEventListener('click', () => this.newGame());
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) pauseBtn.textContent = this.isPaused ? '▶️' : '⏸️';
        if (this.isPaused) {
            this.pauseTimer();
            const board = document.getElementById('gameBoard');
            if (board) {
                board.style.opacity = '0.5';
                board.style.pointerEvents = 'none';
            }
        } else {
            this.resumeTimer();
            const board = document.getElementById('gameBoard');
            if (board) {
                board.style.opacity = '1';
                board.style.pointerEvents = 'auto';
            }
        }
    }
    
    pauseTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
    resumeTimer() { if (!this.timer && this.gameActive) this.startTimer(); }
}

let game;

function initGame() {
    if (window.game) return;
    game = new PvZMatchGame();
    window.game = game;
}

// Force init
initGame();
setTimeout(initGame, 10);
setTimeout(initGame, 100);
setTimeout(initGame, 500);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
}

window.addEventListener('load', function() {
    setTimeout(initGame, 10);
    setTimeout(initGame, 100);
});

if (typeof window !== 'undefined') window.PvZMatchGame = PvZMatchGame;
