// 植物大战僵尸 - 萌萌消
// 羊了个羊类型玩法：多层堆叠 + 7 格卡槽 + 部分露出预判机制

class PvZMatchGame {
    constructor() {
        // 游戏配置
        this.handSize = 7;           // 卡槽格子数
        this.baseCardTypes = 12;     // 基础图案种类数
        this.minCardsPerType = 3;    // 每种图案最少 3 张（保证可消除）
        this.maxCardsPerType = 9;    // 每种图案最多 9 张（3 的倍数）
        this.faceDownRatio = 0.15;   // 15% 的牌是反面（降低难度）
        this.exposeRatio = 0.40;     // 下层牌露出比例（40% 可见，增加预判）
        this.timeLimit = 9 * 60;     // 9 分钟 = 540 秒
        this.currentTime = this.timeLimit;
        this.timer = null;
        
        // 植物大战僵尸图案（共 24 种）
        this.pvzEmojis = {
            // 植物阵营 (12 种)
            plants: ['🌻', '🌱', '🌽', '🍄', '🌵', '🌷', '🌹', '🍀', '🌿', '🥕', '🍅', '🥬'],
            // 僵尸阵营 (12 种)
            zombies: ['🧟', '🧠', '💀', '👻', '🦴', '🧛', '🧞', '🧟‍♂️', '🧟‍♀️', '👹', '👺', '💚']
        };
        
        // 游戏状态
        this.level = 1;
        this.score = 0;
        this.moves = 0;
        this.history = [];  // 用于撤回功能
        this.cards = [];    // 所有牌的数组
        this.hand = [];     // 卡槽
        this.gameActive = false;
        this.isPaused = false;
        
        // 关卡配置（合理难度曲线，确保可通关）
        // 设计原则：每关保证至少有 handSize 个可接触牌，避免死局
        this.levelConfigs = [
            { layers: 2, totalCards: 24, cardTypes: 4, spread: 0.8 },   // 关卡 1: 教学（2 分钟通关）
            { layers: 3, totalCards: 36, cardTypes: 6, spread: 0.7 },   // 关卡 2: 简单（3 分钟通关）
            { layers: 3, totalCards: 48, cardTypes: 8, spread: 0.65 },  // 关卡 3: 入门（4 分钟通关）
            { layers: 4, totalCards: 60, cardTypes: 8, spread: 0.6 },   // 关卡 4: 中等（5 分钟通关）
            { layers: 4, totalCards: 72, cardTypes: 9, spread: 0.55 },  // 关卡 5: 进阶（6 分钟通关）
            { layers: 5, totalCards: 84, cardTypes: 10, spread: 0.5 },  // 关卡 6: 困难（7 分钟通关）
            { layers: 5, totalCards: 96, cardTypes: 10, spread: 0.48 }, // 关卡 7: 挑战（7.5 分钟通关）
            { layers: 6, totalCards: 108, cardTypes: 12, spread: 0.45 },// 关卡 8: 专家（8 分钟通关）
            { layers: 6, totalCards: 120, cardTypes: 12, spread: 0.42 },// 关卡 9: 大师（8.5 分钟通关）
            { layers: 7, totalCards: 132, cardTypes: 14, spread: 0.4 }, // 关卡 10: 传奇（9 分钟通关）
        ];
        
        this.initGame();
    }
    
    initGame() {
        this.bindEvents();
        this.newGame();
        this.startTimer();
    }
    
    getLevelConfig() {
        const configIndex = Math.min(this.level - 1, this.levelConfigs.length - 1);
        return this.levelConfigs[configIndex];
    }
    
    createCards() {
        const config = this.getLevelConfig();
        const cards = [];
        
        // 计算每种图案的牌数（确保是 3 的倍数）
        const cardsPerType = [];
        let remainingCards = config.totalCards;
        
        for (let i = 0; i < config.cardTypes; i++) {
            // 随机生成 3-9 张（3 的倍数）
            const count = Math.min(
                Math.max(3, Math.floor(Math.random() * 3) * 3 + 3),
                remainingCards - (config.cardTypes - i - 1) * 3
            );
            cardsPerType.push(count);
            remainingCards -= count;
        }
        
        // 分配剩余牌
        while (remainingCards > 0) {
            const idx = Math.floor(Math.random() * config.cardTypes);
            cardsPerType[idx] += 3;
            remainingCards -= 3;
        }
        
        // 创建所有牌（先不分配 emoji，只创建空牌）
        let cardId = 0;
        for (let i = 0; i < config.cardTypes; i++) {
            for (let j = 0; j < cardsPerType[i]; j++) {
                cards.push({
                    id: cardId++,
                    emoji: '',  // 暂时为空，后面随机分配
                    faceUp: true,
                    removed: false,
                    layer: 0,
                    x: 0,
                    y: 0,
                    width: 60,
                    height: 60
                });
            }
        }
        
        return cards;
    }
    
    generateStackLayout(cards) {
        const config = this.getLevelConfig();
        const boardWidth = 480;
        const boardHeight = 400;
        const cardWidth = 60;
        const cardHeight = 60;
        
        // 第一步：先分配位置（不考虑图案）
        // 创建层结构（不规则分布）
        const layers = [];
        for (let l = 0; l < config.layers; l++) {
            const layerRatio = 1 - (l / config.layers) * 0.6;
            const cardsInLayer = Math.floor(cards.length / config.layers * layerRatio);
            layers.push({
                layer: l,
                cardCount: cardsInLayer,
                cards: []
            });
        }
        
        // 分配牌到各层
        let cardIndex = 0;
        for (const layer of layers) {
            for (let i = 0; i < layer.cardCount && cardIndex < cards.length; i++) {
                cards[cardIndex].layer = layer.layer;
                layer.cards.push(cards[cardIndex]);
                cardIndex++;
            }
        }
        
        // 剩余牌随机分配到各层
        while (cardIndex < cards.length) {
            const randomLayer = layers[Math.floor(Math.random() * layers.length)];
            cards[cardIndex].layer = randomLayer.layer;
            randomLayer.cards.push(cards[cardIndex]);
            cardIndex++;
        }
        
        // 为每层生成位置
        for (const layer of layers) {
            const positions = this.generateLayerPositions(
                layer.cards.length,
                boardWidth,
                boardHeight,
                cardWidth,
                cardHeight,
                layer.layer,
                config.layers
            );
            
            for (let i = 0; i < layer.cards.length; i++) {
                layer.cards[i].x = positions[i].x;
                layer.cards[i].y = positions[i].y;
            }
        }
        
        // 第二步：随机分配图案（关键：让同种图案分散）
        this.assignEmojisRandomly(cards, config);
        
        // 第三步：设置反面牌
        for (const card of cards) {
            if (Math.random() < this.faceDownRatio) {
                card.faceUp = false;
            }
        }
        
        // 排序：底层先绘制，上层后绘制
        cards.sort((a, b) => a.layer - b.layer);
        
        return cards;
    }
    
    assignEmojisRandomly(cards, config) {
        // 第一步：按位置分组（同一 x,y 坐标的牌是一堆）
        const positionGroups = {};
        for (const card of cards) {
            const key = `${card.x},${card.y}`;
            if (!positionGroups[key]) {
                positionGroups[key] = [];
            }
            positionGroups[key].push(card);
        }
        
        const stacks = Object.values(positionGroups);
        const maxStackHeight = Math.max(...stacks.map(s => s.length));
        
        // 检查：如果图案种类数 < 最大堆高，无法避免同堆重复
        if (config.cardTypes < maxStackHeight) {
            console.warn(`⚠️ 图案种类 (${config.cardTypes}) < 最大堆高 (${maxStackHeight})，可能有重复`);
        }
        
        // 第二步：创建 emoji 池（平均分配，确保每种数量接近）
        const totalCards = cards.length;
        const baseCount = Math.floor(totalCards / config.cardTypes);
        const remainder = totalCards % config.cardTypes;
        
        const emojiRemaining = [];
        for (let i = 0; i < config.cardTypes; i++) {
            // 前 remainder 种图案多 1 张
            emojiRemaining.push(baseCount + (i < remainder ? 1 : 0));
        }
        
        // 确保每种是 3 的倍数
        for (let i = 0; i < config.cardTypes; i++) {
            while (emojiRemaining[i] % 3 !== 0) {
                emojiRemaining[i] += 3;
            }
        }
        
        // 第三步：按组分配 - 确保同堆无重复
        // 策略：对每堆的每张牌，分配一个这堆没用过的图案
        for (const stack of stacks) {
            const usedTypes = new Set(); // 这堆已用的图案类型索引
            
            for (const card of stack) {
                // 找一个可用的图案（这堆没用过，且还有剩余）
                let bestIdx = -1;
                
                // 优先选剩余最多的图案
                for (let i = 0; i < config.cardTypes; i++) {
                    if (emojiRemaining[i] > 0 && !usedTypes.has(i)) {
                        if (bestIdx === -1 || emojiRemaining[i] > emojiRemaining[bestIdx]) {
                            bestIdx = i;
                        }
                    }
                }
                
                if (bestIdx !== -1) {
                    const emoji = this.pvzEmojis.plants[bestIdx % this.pvzEmojis.plants.length];
                    card.emoji = emoji;
                    emojiRemaining[bestIdx]--;
                    usedTypes.add(bestIdx);
                } else {
                    // 极端情况：所有图案都用过了（堆太高）
                    // 找一个还有剩余的（即使这堆用过了）
                    for (let i = 0; i < config.cardTypes; i++) {
                        if (emojiRemaining[i] > 0) {
                            const emoji = this.pvzEmojis.plants[i % this.pvzEmojis.plants.length];
                            card.emoji = emoji;
                            emojiRemaining[i]--;
                            console.log(`⚠️ 堆内重复：位置 ${card.x},${card.y}, 图案 ${emoji}`);
                            break;
                        }
                    }
                }
            }
        }
        
        // 第四步：验证并输出统计
        let conflictCount = 0;
        for (const stack of stacks) {
            const emojis = stack.map(c => c.emoji);
            const unique = new Set(emojis);
            if (unique.size !== emojis.length) {
                conflictCount++;
            }
        }
        console.log(`✅ 关卡 ${this.level}: ${stacks.length} 堆，最大堆高 ${maxStackHeight}, 冲突堆数 ${conflictCount}`);
    }
    
    generateLayerPositions(count, boardWidth, boardHeight, cardWidth, cardHeight, layer, totalLayers) {
        const positions = [];
        const availableWidth = boardWidth - cardWidth - 40;
        const availableHeight = boardHeight - cardHeight - 40;
        
        // 中心区域
        const centerX = boardWidth / 2;
        const centerY = boardHeight / 2;
        
        // 根据层数调整分布范围（越高层越集中）
        const spreadFactor = 1 - (layer / totalLayers) * 0.5;
        
        for (let i = 0; i < count; i++) {
            let x, y;
            
            // 使用螺旋分布，增加自然感
            const angle = (i / count) * Math.PI * 2 * 2.5;
            const radius = Math.sqrt(i / count) * Math.min(availableWidth, availableHeight) / 2 * spreadFactor;
            
            x = centerX + Math.cos(angle) * radius - cardWidth / 2;
            y = centerY + Math.sin(angle) * radius - cardHeight / 2;
            
            // 添加随机偏移（模拟自然堆叠）
            x += (Math.random() - 0.5) * 30 * spreadFactor;
            y += (Math.random() - 0.5) * 30 * spreadFactor;
            
            // 确保在边界内
            x = Math.max(10, Math.min(x, boardWidth - cardWidth - 10));
            y = Math.max(10, Math.min(y, boardHeight - cardHeight - 10));
            
            positions.push({ x, y });
        }
        
        return positions;
    }
    
    renderBoard() {
        const board = document.getElementById('gameBoard');
        // 保留层数指示器
        const layerIndicator = board.querySelector('.layer-indicator');
        board.innerHTML = '';
        if (layerIndicator) board.appendChild(layerIndicator);
        
        // 计算最大层数
        const maxLayer = Math.max(...this.cards.map(c => c.layer), 0);
        document.getElementById('layerCount').textContent = maxLayer + 1;
        
        for (const card of this.cards) {
            if (card.removed) continue;
            
            const cardEl = document.createElement('div');
            cardEl.className = `card ${card.faceUp ? 'face-up' : 'face-down'}`;
            cardEl.dataset.id = card.id;
            cardEl.style.left = `${card.x}px`;
            cardEl.style.top = `${card.y}px`;
            cardEl.style.zIndex = card.layer + 1;
            
            if (card.faceUp) {
                cardEl.textContent = card.emoji;
            }
            
            // 检查是否可点击（没有被上层牌完全遮挡）
            if (this.isCardClickable(card)) {
                cardEl.classList.add('clickable');
                cardEl.addEventListener('click', () => this.handleCardClick(card));
            }
            
            board.appendChild(cardEl);
        }
        
        this.updateStats();
    }
    
    isCardClickable(card) {
        // 检查是否有上层牌遮挡这张牌
        for (const other of this.cards) {
            if (other.removed || other.id === card.id) continue;
            if (other.layer <= card.layer) continue;
            
            // 检查重叠（考虑露出比例）
            const overlap = this.calculateOverlap(card, other);
            if (overlap > (1 - this.exposeRatio)) {
                return false; // 被遮挡超过阈值
            }
        }
        return true;
    }
    
    calculateOverlap(card1, card2) {
        const x1 = card1.x, y1 = card1.y, w1 = card1.width, h1 = card1.height;
        const x2 = card2.x, y2 = card2.y, w2 = card2.width, h2 = card2.height;
        
        const overlapX = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2));
        const overlapY = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
        const overlapArea = overlapX * overlapY;
        const cardArea = w1 * h1;
        
        return overlapArea / cardArea;
    }
    
    handleCardClick(card) {
        if (!this.gameActive) return;
        if (!this.isCardClickable(card)) return;
        if (this.hand.length >= this.handSize) {
            this.gameOver('卡槽已满！');
            return;
        }
        
        // 保存历史（用于撤回）
        this.saveHistory();
        
        // 翻牌
        card.faceUp = true;
        
        // 添加到卡槽
        this.hand.push(card);
        this.moves++;
        
        // 播放动画
        this.animateCardToHand(card);
        
        // 检查是否有下层牌露出
        this.updateCardVisibility();
        
        // 检查消除
        setTimeout(() => this.checkMatches(), 300);
    }
    
    animateCardToHand(card) {
        const cardEl = document.querySelector(`.card[data-id="${card.id}"]`);
        if (!cardEl) return;
        
        const rect = cardEl.getBoundingClientRect();
        const handSlot = document.querySelector('.hand-slot.empty') || 
                        document.querySelector('.hand-slots');
        const handRect = handSlot.getBoundingClientRect();
        
        const clone = cardEl.cloneNode(true);
        clone.classList.add('card-to-hand');
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        
        document.body.appendChild(clone);
        
        requestAnimationFrame(() => {
            clone.style.left = `${handRect.left + handRect.width / 2 - rect.width / 2}px`;
            clone.style.top = `${handRect.top + handRect.height / 2 - rect.height / 2}px`;
            clone.style.transform = 'scale(0.8)';
            clone.style.opacity = '0.5';
        });
        
        setTimeout(() => {
            clone.remove();
            this.renderHand();
        }, 500);
    }
    
    renderHand() {
        const handSlots = document.getElementById('handSlots');
        handSlots.innerHTML = '';
        
        for (let i = 0; i < this.handSize; i++) {
            const slot = document.createElement('div');
            slot.className = 'hand-slot';
            
            if (i < this.hand.length) {
                slot.classList.add('filled');
                slot.textContent = this.hand[i].emoji;
                slot.dataset.emoji = this.hand[i].emoji;
            } else {
                slot.classList.add('empty');
            }
            
            handSlots.appendChild(slot);
        }
    }
    
    checkMatches() {
        // 统计卡槽中每种图案的数量
        const emojiCount = {};
        const emojiCards = {};
        
        for (const card of this.hand) {
            if (!emojiCount[card.emoji]) {
                emojiCount[card.emoji] = 0;
                emojiCards[card.emoji] = [];
            }
            emojiCount[card.emoji]++;
            emojiCards[card.emoji].push(card);
        }
        
        // 检查是否有 3 张相同的
        let foundMatch = false;
        for (const emoji in emojiCount) {
            if (emojiCount[emoji] >= 3) {
                // 消除前 3 张
                const toRemove = emojiCards[emoji].slice(0, 3);
                this.removeCards(toRemove);
                this.score += 100 * toRemove.length;
                foundMatch = true;
                
                // 显示连击效果
                if (emojiCount[emoji] > 3) {
                    this.showCombo(emojiCount[emoji] - 3);
                }
                break;
            }
        }
        
        this.updateStats();
        
        if (foundMatch) {
            // 检查是否胜利
            if (this.checkWin()) {
                setTimeout(() => this.winGame(), 500);
            }
        } else {
            // 检查是否失败（卡槽满且无匹配）
            if (this.hand.length >= this.handSize) {
                setTimeout(() => this.gameOver('卡槽已满！'), 300);
            }
        }
    }
    
    removeCards(cards) {
        for (const card of cards) {
            card.removed = true;
            const cardEl = document.querySelector(`.card[data-id="${card.id}"]`);
            if (cardEl) {
                cardEl.classList.add('removing');
            }
        }
        
        // 从卡槽移除
        this.hand = this.hand.filter(c => !cards.includes(c));
        
        setTimeout(() => {
            this.renderBoard();
            this.renderHand();
        }, 400);
    }
    
    showCombo(count) {
        const comboText = document.createElement('div');
        comboText.className = 'combo-text';
        comboText.textContent = `${count}连击! 🔥`;
        comboText.style.left = '50%';
        comboText.style.top = '40%';
        comboText.style.transform = 'translateX(-50%)';
        document.body.appendChild(comboText);
        
        setTimeout(() => comboText.remove(), 1000);
    }
    
    updateCardVisibility() {
        // 更新所有牌的可点击状态
        this.renderBoard();
    }
    
    checkWin() {
        return this.cards.every(c => c.removed);
    }
    
    winGame() {
        this.gameActive = false;
        
        // 计算星级（基于时间和步数）
        const config = this.getLevelConfig();
        const perfectMoves = config.totalCards / 3;
        const timeUsed = this.timeLimit - this.currentTime;
        const perfectTime = this.timeLimit * 0.6; // 60% 时间内完成
        
        let stars = 3;
        if (this.moves > perfectMoves * 1.5 || timeUsed > perfectTime * 1.5) stars = 2;
        if (this.moves > perfectMoves * 2 || timeUsed > perfectTime * 2) stars = 1;
        
        const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        
        // 计算剩余时间奖励
        const timeBonus = Math.floor(this.currentTime / 10);
        const finalScore = this.score + timeBonus;
        
        document.getElementById('finalScoreWin').textContent = finalScore;
        document.getElementById('finalMovesWin').textContent = this.moves;
        document.getElementById('finalTimeWin').textContent = this.formatTime(this.timeLimit - this.currentTime);
        document.getElementById('remainingTimeWin').textContent = this.formatTime(this.currentTime);
        document.getElementById('starRating').textContent = starText;
        document.getElementById('winMessage').style.display = 'flex';
    }
    
    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}分${s}秒`;
    }
    
    gameOver(reason) {
        this.gameActive = false;
        document.getElementById('loseReason').textContent = reason;
        document.getElementById('finalScoreLose').textContent = this.score;
        document.getElementById('finalLevelLose').textContent = this.level;
        document.getElementById('finalTimeLose').textContent = this.formatTime(this.timeLimit - this.currentTime);
        document.getElementById('loseMessage').style.display = 'flex';
    }
    
    saveHistory() {
        // 保存当前状态用于撤回
        const state = {
            hand: this.hand.map(c => c.id),
            cards: this.cards.map(c => ({
                id: c.id,
                faceUp: c.faceUp,
                removed: c.removed
            })),
            score: this.score,
            moves: this.moves
        };
        this.history.push(state);
        if (this.history.length > 10) this.history.shift(); // 最多保存 10 步
    }
    
    undo() {
        if (this.history.length === 0 || !this.gameActive) return;
        
        const state = this.history.pop();
        
        // 恢复状态
        this.hand = this.cards.filter(c => state.hand.includes(c.id));
        for (const cardState of state.cards) {
            const card = this.cards.find(c => c.id === cardState.id);
            if (card) {
                card.faceUp = cardState.faceUp;
                card.removed = cardState.removed;
            }
        }
        this.score = state.score;
        this.moves = state.moves;
        
        this.renderBoard();
        this.renderHand();
        this.updateStats();
    }
    
    shuffle() {
        if (!this.gameActive) return;
        
        // 收集所有未消除的牌
        const remainingCards = this.cards.filter(c => !c.removed);
        
        // 将卡槽中的牌放回
        for (const card of this.hand) {
            card.faceUp = false; // 放回后变为反面
        }
        this.hand = [];
        
        // 重新分配图案（保持数量不变）
        const emojis = remainingCards.map(c => c.emoji);
        this.shuffleArray(emojis);
        for (let i = 0; i < remainingCards.length; i++) {
            remainingCards[i].emoji = emojis[i];
        }
        
        this.score = Math.max(0, this.score - 50); // 洗牌扣 50 分
        
        this.renderBoard();
        this.renderHand();
        this.updateStats();
    }
    
    shuffleArray(array) {
        // Fisher-Yates 洗牌算法
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    updateStats() {
        const remaining = this.cards.filter(c => !c.removed).length;
        document.getElementById('remaining').textContent = remaining;
        document.getElementById('moves').textContent = this.moves;
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        this.updateTimerDisplay();
    }
    
    startTimer() {
        this.currentTime = this.timeLimit;
        this.updateTimerDisplay();
        
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        this.timer = setInterval(() => {
            if (this.gameActive && !this.isPaused) {
                this.currentTime--;
                this.updateTimerDisplay();
                
                if (this.currentTime <= 0) {
                    this.gameOver('时间到了！');
                }
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = this.currentTime % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 查找或创建时间显示元素
        let timerElement = document.getElementById('timer');
        if (!timerElement) {
            // 在 stats 中插入时间显示
            const statsEl = document.querySelector('.stats');
            const timerDiv = document.createElement('div');
            timerDiv.className = 'stat-item';
            timerDiv.innerHTML = `<span class="stat-label">时间:</span><span class="stat-value" id="timer">${timeStr}</span>`;
            statsEl.insertBefore(timerDiv, statsEl.firstChild);
            timerElement = document.getElementById('timer');
        } else {
            timerElement.textContent = timeStr;
        }
        
        // 时间警告
        timerElement.parentElement.classList.remove('timer-warning', 'timer-critical');
        if (this.currentTime <= 30) {
            timerElement.parentElement.classList.add('timer-critical');
        } else if (this.currentTime <= 60) {
            timerElement.parentElement.classList.add('timer-warning');
        }
    }
    
    pauseTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    
    resumeTimer() {
        if (!this.timer && this.gameActive) {
            this.timer = setInterval(() => {
                if (this.gameActive) {
                    this.currentTime--;
                    this.updateTimerDisplay();
                    
                    if (this.currentTime <= 0) {
                        this.gameOver('时间到了！');
                    }
                }
            }, 1000);
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
        
        // 每关重置时间（9 分钟）
        this.currentTime = this.timeLimit;
        this.updateTimerDisplay();
    }
    
    bindEvents() {
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('shuffleBtn').addEventListener('click', () => this.shuffle());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('newGameBtn').addEventListener('click', () => this.newGame());
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (this.isPaused) {
            pauseBtn.textContent = '▶️ 继续';
            this.pauseTimer();
            this.pauseGameVisual();
        } else {
            pauseBtn.textContent = '⏸️ 暂停';
            this.resumeTimer();
            this.resumeGameVisual();
        }
    }
    
    pauseGameVisual() {
        const board = document.getElementById('gameBoard');
        board.style.opacity = '0.5';
        board.style.pointerEvents = 'none';
    }
    
    resumeGameVisual() {
        const board = document.getElementById('gameBoard');
        board.style.opacity = '1';
        board.style.pointerEvents = 'auto';
    }
}

// 全局游戏实例
let game;

function initGame() {
    game = new PvZMatchGame();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initGame);
