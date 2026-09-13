/* Critical Spin — the build is the machine.  No framework, no server state. */
(function () {
  'use strict';

  const STORAGE_KEY = 'critical-spin-best-v1';

  const SYMBOLS = {
    sword:  { glyph: '⚔', name: 'SWORD',  color: '#ff9c51' },
    shield: { glyph: '⬟', name: 'SHIELD', color: '#7edaff' },
    potion: { glyph: '✚', name: 'POTION', color: '#ff697a' },
    fire:   { glyph: '✹', name: 'FIRE',   color: '#ff8064' },
    clover: { glyph: '♣', name: 'WILD',   color: '#d7ff64' },
    blank:  { glyph: '·', name: 'BLANK',  color: '#626b84' },
    seven:  { glyph: '7', name: 'SEVEN',  color: '#ffd268' }
  };

  const HEROES = {
    housebreaker: {
      id: 'housebreaker', name: 'The Housebreaker', className: 'Risk runner', portrait: '♠', color: '#d7ff64',
      short: 'Turns bad odds into big swings.', maxHp: 100, baseAttack: 31, baseDefense: 8, baseHeal: 17,
      trait: 'Loaded Dice — every WILD has a 20% chance to become a SEVEN.',
      ability: 'House Edge', abilityIcon: '♜', abilityHint: 'Load a guaranteed triple 7',
      weights: { sword: 28, shield: 15, potion: 11, fire: 7, clover: 14, blank: 19, seven: 6 }
    },
    ironsaint: {
      id: 'ironsaint', name: 'The Iron Saint', className: 'Table guardian', portrait: '♜', color: '#7edaff',
      short: 'Makes the machine pay in shields.', maxHp: 136, baseAttack: 23, baseDefense: 17, baseHeal: 13,
      trait: 'House Insurance — SHIELD blocks 20% extra damage and charges ability faster.',
      ability: 'Double Down', abilityIcon: '⬟', abilityHint: 'Bank a fortress of block + healing',
      weights: { sword: 19, shield: 29, potion: 11, fire: 5, clover: 10, blank: 18, seven: 8 }
    },
    emberjoker: {
      id: 'emberjoker', name: 'The Ember Joker', className: 'Volatile caster', portrait: '✹', color: '#ff9c51',
      short: 'Sets the felt on fire for fun.', maxHp: 93, baseAttack: 29, baseDefense: 6, baseHeal: 14,
      trait: 'Hot Streak — three FIREs ignite the target for 18 damage each round.',
      ability: 'Wild Card', abilityIcon: '✦', abilityHint: 'Make the next pull burn brighter',
      weights: { sword: 18, shield: 13, potion: 10, fire: 28, clover: 17, blank: 18, seven: 6 }
    }
  };

  const ENCOUNTERS = [
    { name: 'The Velvet Rat', flavor: 'A small-time cheat with a very large appetite.', art: '🐀', level: 1, maxHp: 160, attack: 14, reward: 35, drop: 'CLOVER DUST', mood: 'WATCHFUL' },
    { name: 'Neon Pit Boss', flavor: 'His smile is bright. His knuckles are brighter.', art: '🃏', level: 2, maxHp: 275, attack: 22, reward: 65, drop: 'GLOWING CHIP', mood: 'SMILING' },
    { name: 'The Debt Collector', flavor: 'He always finds the one bet you forgot to hedge.', art: '💀', level: 3, maxHp: 430, attack: 29, reward: 105, drop: 'BLACK LEDGER', mood: 'DUE NOW' },
    { name: 'THE HOUSE', flavor: 'Every wager ends here. Make the odds regret you.', art: '♛', level: 7, maxHp: 900, attack: 39, reward: 250, drop: 'THE CROWN', mood: 'THE FINAL TABLE', boss: true }
  ];

  const UPGRADE_POOL = [
    { id: 'seven', icon: '7', title: 'Loaded Chamber', text: '+3% SEVEN weight. The jackpot gets closer.', cost: 'REEL +3%', apply(s) { s.upgrades.seven += 3; } },
    { id: 'attack', icon: '⚔', title: 'Sharper Edges', text: '+6 base weapon damage on every pull.', cost: 'DMG +6', apply(s) { s.upgrades.attack += 6; } },
    { id: 'health', icon: '♥', title: 'Second Wind', text: '+18 maximum vitality and restore 18 now.', cost: 'HP +18', apply(s) { s.upgrades.maxHp += 18; s.playerHp += 18; } },
    { id: 'defense', icon: '⬟', title: 'Felt-Plated', text: '+5 defense. The house hates a guarded table.', cost: 'DEF +5', apply(s) { s.upgrades.defense += 5; } },
    { id: 'wild', icon: '♣', title: 'Lucky Charm', text: '+5% WILD weight and +4% critical luck.', cost: 'WILD +5%', apply(s) { s.upgrades.clover += 5; s.upgrades.luck += 4; } },
    { id: 'potion', icon: '✚', title: 'House Medic', text: '+5 healing each time POTION lands.', cost: 'HEAL +5', apply(s) { s.upgrades.heal += 5; } },
    { id: 'gold', icon: '$', title: 'Side Bet', text: 'Take 45 gold immediately. Spend it on nothing yet.', cost: 'CASH +45g', apply(s) { s.gold += 45; } }
  ];

  const $ = (id) => document.getElementById(id);
  const heroGrid = $('heroGrid');
  const reelsEl = $('reels');
  const logEl = $('combatLog');
  const rewardPanel = $('rewardPanel');
  const upgradeGrid = $('upgradeGrid');
  const resultBanner = $('resultBanner');
  const toast = $('toast');
  const heroPicker = $('heroPicker');
  let modalFocus = null;

  let best = loadBest();
  let spinInterval = null;
  let lockTimers = [];
  let resolveTimer = null;
  let autoTimer = null;
  let toastTimer = null;
  let holdTimer = null;
  let holdStartedAt = 0;
  let holdActive = false;
  let suppressSpinClick = false;
  const HOLD_DURATION = 2000;
  const REEL_STOP_GAP = 200;

  const state = {
    heroId: 'housebreaker', run: 1, encounterIndex: 0, enemy: null, phase: 'battle',
    playerHp: 100, charge: 0, block: 0, burn: 0, streak: 0, spins: 0, gold: 120,
    held: [false, false, false], reels: ['sword', 'shield', 'blank'], log: [], auto: false,
    spinning: false, upgrades: { attack: 0, defense: 0, maxHp: 0, heal: 0, seven: 0, clover: 0, luck: 0 },
    guaranteeSeven: false, wildSurge: false, options: [], dealerChosen: false
  };

  function loadBest() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { run: Number(saved.run) || 0, gold: Number(saved.gold) || 0 };
    } catch (error) {
      return { run: 0, gold: 0 };
    }
  }

  function saveBest() {
    const cleared = state.phase === 'complete' ? ENCOUNTERS.length : state.encounterIndex;
    if (cleared > best.run || state.gold > best.gold) {
      best = { run: Math.max(best.run, cleared), gold: Math.max(best.gold, state.gold) };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(best)); } catch (error) { /* storage can be disabled */ }
    }
  }

  function hero() { return HEROES[state.heroId]; }
  function maxHp() { return hero().maxHp + state.upgrades.maxHp; }
  function attackPower() { return hero().baseAttack + state.upgrades.attack; }
  function defensePower() { return hero().baseDefense + state.upgrades.defense; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function number(value) { return Math.round(value).toLocaleString(); }
  function pad(value) { return String(value).padStart(2, '0'); }

  function effectiveWeights() {
    const weights = { ...hero().weights };
    weights.seven += state.upgrades.seven;
    weights.clover += state.upgrades.clover;
    return weights;
  }

  function rollSymbol() {
    const weights = effectiveWeights();
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let pick = Math.random() * total;
    for (const key of Object.keys(weights)) {
      pick -= weights[key];
      if (pick <= 0) {
        if (hero().id === 'housebreaker' && key === 'clover' && Math.random() < 0.2) return 'seven';
        return key;
      }
    }
    return 'blank';
  }

  function addLog(message, emphasis) {
    state.log.unshift({ message, emphasis: emphasis || '' });
    state.log = state.log.slice(0, 3);
    renderLog();
  }

  function renderLog() {
    logEl.textContent = '';
    if (!state.log.length) {
      const empty = document.createElement('li');
      empty.textContent = 'The dealer is watching. Make the first move.';
      logEl.appendChild(empty);
      return;
    }
    state.log.forEach((entry, index) => {
      const item = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = entry.message;
      if (entry.emphasis) {
        const mark = document.createElement('b');
        mark.textContent = ` ${entry.emphasis}`;
        text.appendChild(mark);
      }
      const time = document.createElement('span');
      time.className = 'log-time';
      time.textContent = index === 0 ? 'NOW' : `-${index} SPIN`;
      item.append(text, time);
      logEl.appendChild(item);
    });
  }

  function renderHeroes() {
    heroGrid.textContent = '';
    Object.values(HEROES).forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `hero-card${entry.id === state.heroId ? ' selected' : ''}`;
      button.style.setProperty('--hero-color', entry.color);
      button.setAttribute('aria-pressed', String(entry.id === state.heroId));
      button.innerHTML = `<span class="hero-portrait" aria-hidden="true">${entry.portrait}</span><span class="hero-copy"><h3>${entry.name}</h3><p>${entry.short}</p></span><span class="hero-tag">${entry.className.toUpperCase()}</span>`;
      button.addEventListener('click', () => selectHero(entry.id));
      heroGrid.appendChild(button);
    });
    // Dealer selection is a first-deal/reset overlay, never a permanent dashboard rail.
    heroPicker.hidden = state.dealerChosen;
  }

  function renderOdds() {
    const weights = effectiveWeights();
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const list = $('oddsList');
    list.textContent = '';
    Object.keys(SYMBOLS).forEach((key) => {
      const symbol = SYMBOLS[key];
      const row = document.createElement('div');
      row.className = 'odds-row';
      row.style.setProperty('--symbol-color', symbol.color);
      const percent = Math.round((weights[key] / total) * 100);
      row.innerHTML = `<span class="odds-symbol" aria-hidden="true">${symbol.glyph}</span><label>${symbol.name}</label><strong>${percent}%</strong><div class="odds-track" aria-hidden="true"><span style="width:${percent}%"></span></div>`;
      list.appendChild(row);
    });
    $('reelPower').textContent = `Power +${state.upgrades.attack + state.upgrades.defense}`;
  }

  function renderReels() {
    reelsEl.textContent = '';
    state.reels.forEach((key, index) => {
      const symbol = SYMBOLS[key];
      const reel = document.createElement('button');
      reel.type = 'button';
      reel.className = `reel${state.held[index] ? ' locked' : ''}`;
      reel.dataset.index = String(index);
      reel.style.setProperty('--symbol-color', symbol.color);
      reel.setAttribute('aria-label', `${state.held[index] ? 'Release' : 'Hold'} reel ${index + 1}. Current symbol ${symbol.name}`);
      // The faded strip gives the machine a real vertical reel. The center value is
      // still the source of truth for combat, while the surrounding symbols make a
      // spin read as movement instead of a single glyph swap.
      const stripKeys = [rollSymbol(), key, rollSymbol(), rollSymbol(), key];
      const strip = stripKeys.map((stripKey) => `<span class="strip-symbol" style="--symbol-color:${SYMBOLS[stripKey].color}">${SYMBOLS[stripKey].glyph}</span>`).join('');
      reel.innerHTML = `${state.held[index] ? '<span class="lock-badge">HELD</span>' : ''}<span class="reel-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></span><span class="reel-window"><span class="reel-strip" aria-hidden="true">${strip}</span><span class="reel-value"><span class="symbol-glyph" aria-hidden="true">${symbol.glyph}</span><span class="symbol-name">${symbol.name}</span></span></span>`;
      reel.addEventListener('click', () => toggleHold(index));
      reelsEl.appendChild(reel);
    });
  }

  function renderEnemy() {
    const enemy = state.enemy;
    if (!enemy) return;
    $('encounterNumber').textContent = pad(state.encounterIndex + 1);
    $('encounterType').textContent = enemy.boss ? 'FINAL TABLE' : 'ANTE ROOM';
    $('encounterTitle').textContent = enemy.name;
    $('enemyName').textContent = enemy.name;
    $('enemyFlavor').textContent = enemy.flavor;
    const enemyArt = $('enemyArt');
    const enemyVariant = ['rat', 'joker', 'skull', 'house'][state.encounterIndex] || 'rat';
    enemyArt.className = `enemy-art enemy-art-${enemyVariant}`;
    enemyArt.setAttribute('aria-label', `${enemy.name} enemy`);
    enemyArt.innerHTML = '<span class="enemy-shadow"></span><span class="enemy-body"></span><span class="enemy-face"></span><span class="enemy-accent"></span>';
    const enemyModalArt = $('enemyModalArt');
    enemyModalArt.className = `enemy-modal-art enemy-art-${enemyVariant}`;
    $('enemyInfoTitle').textContent = enemy.name;
    $('enemyInfoName').textContent = enemy.name;
    $('enemyInfoFlavor').textContent = enemy.flavor;
    $('enemyInfoHp').textContent = `${number(Math.max(0, enemy.hp))} / ${number(enemy.maxHp)}`;
    $('enemyInfoHpBar').style.width = `${clamp((enemy.hp / enemy.maxHp) * 100, 0, 100)}%`;
    $('enemyInfoStatus').textContent = enemy.hp <= 0 ? 'DEFEATED' : (state.burn ? `BURNING · ${state.burn}` : (enemy.stagger ? `STAGGERED · ${enemy.stagger}` : enemy.mood));
    $('enemyInfoReward').textContent = `+${enemy.reward}g`;
    $('enemyInfoDrop').textContent = enemy.drop;
    $('enemyLevel').textContent = `LVL ${enemy.level}`;
    $('enemyMood').textContent = enemy.boss ? '♛' : '♠';
    $('enemyReward').textContent = `+${enemy.reward}g`;
    $('enemyDrop').textContent = enemy.drop;
    $('enemyHpText').textContent = `${number(Math.max(0, enemy.hp))} / ${number(enemy.maxHp)}`;
    $('enemyHpBar').style.width = `${clamp((enemy.hp / enemy.maxHp) * 100, 0, 100)}%`;
    const enemyPanel = $('enemyActor');
    enemyPanel.classList.toggle('defeated', enemy.hp <= 0);
    $('enemyStatus').textContent = enemy.hp <= 0 ? 'DEFEATED' : (state.burn ? `BURNING · ${state.burn}` : (enemy.stagger ? `STAGGERED · ${enemy.stagger}` : enemy.mood));
  }

  function renderPlayer() {
    const currentHero = hero();
    $('runNumber').textContent = pad(state.run);
    $('goldValue').textContent = number(state.gold);
    $('bestValue').textContent = number(best.run);
    $('luckValue').textContent = `${12 + state.upgrades.luck}%`;
    $('playerAvatar').textContent = currentHero.portrait;
    $('playerAvatar').style.color = currentHero.color;
    $('playerHeading').textContent = currentHero.name;
    $('playerClass').textContent = `${currentHero.className} · Level ${Math.min(9, state.encounterIndex + 1)}`;
    const playerSprite = $('playerSprite');
    playerSprite.className = `player-sprite hero-${currentHero.id}`;
    playerSprite.setAttribute('aria-label', `${currentHero.name} seen from behind`);
    $('playerSceneName').textContent = currentHero.name;
    $('playerSceneClass').textContent = `${currentHero.className} · Level ${Math.min(9, state.encounterIndex + 1)}`;
    $('traitText').textContent = currentHero.trait;
    $('abilityName').textContent = currentHero.ability;
    $('abilityIcon').textContent = currentHero.abilityIcon;
    $('abilityHint').textContent = state.guaranteeSeven ? 'LOADED · next pull is a triple 7' : (state.charge >= 100 ? 'READY · press SPACE' : `${currentHero.abilityHint} · ${number(state.charge)}%`);
    $('playerHpText').textContent = `${number(Math.max(0, state.playerHp))} / ${number(maxHp())}`;
    $('playerHpBar').style.width = `${clamp((state.playerHp / maxHp()) * 100, 0, 100)}%`;
    $('chargeText').textContent = `${number(state.charge)}%`;
    $('chargeBar').style.width = `${clamp(state.charge, 0, 100)}%`;
    $('modalPlayerAvatar').textContent = currentHero.portrait;
    $('modalPlayerAvatar').style.color = currentHero.color;
    $('modalPlayerName').textContent = currentHero.name;
    $('modalPlayerClass').textContent = `${currentHero.className} · Level ${Math.min(9, state.encounterIndex + 1)}`;
    $('modalPlayerHp').textContent = `${number(Math.max(0, state.playerHp))} / ${number(maxHp())}`;
    $('modalChargeText').textContent = `${number(state.charge)} / 100`;
    $('modalChargeBar').style.width = `${clamp(state.charge, 0, 100)}%`;
    $('modalAbilityName').textContent = currentHero.ability;
    $('modalAbilityIcon').textContent = currentHero.abilityIcon;
    $('modalAbilityHint').textContent = state.guaranteeSeven ? 'LOADED · next pull is triple 7' : (state.charge >= 100 ? 'READY · pull the reels' : `${currentHero.abilityHint} · ${number(state.charge)}%`);
    $('abilityHint').textContent = state.guaranteeSeven ? 'LOADED' : `${number(state.charge)}%`;
    $('abilityButton').disabled = state.charge < 100 || state.phase !== 'battle' || state.spinning;
    $('abilityButton').setAttribute('aria-label', `Use ${currentHero.ability} skill${state.charge >= 100 ? ' (ready)' : ` (${number(state.charge)}% charged)`}`);
    $('modalAbilityButton').disabled = state.charge < 100 || state.phase !== 'battle' || state.spinning;
    // Keep ATTACK enabled while reels are resolving so a two-second hold can
    // always turn idle mode back off, even when an automatic pull is underway.
    // A tap during a spin remains a harmless no-op inside spin().
    $('spinButton').disabled = state.phase !== 'battle' || state.playerHp <= 0;
    $('abilityHintText').textContent = state.guaranteeSeven ? 'LOADED · TRIPLE 7' : (state.charge >= 100 ? 'READY TO USE' : `CHARGE ${number(state.charge)}%`);
    $('spinButtonHint').textContent = state.phase === 'lost' ? 'THE HOUSE COLLECTS' : (state.phase === 'complete' ? 'RUN CASHED OUT' : (state.spinning ? 'READING THE ODDS…' : (state.auto ? 'IDLE ON · TAP TO EXIT' : 'HOLD 2s: IDLE')));
    $('spinButton').setAttribute('aria-label', state.auto ? 'Attack. Idle mode is on. Tap once to turn idle mode off.' : 'Attack. Hold for 2 seconds to toggle idle mode.');
    $('spinButton').classList.toggle('idle-active', state.auto);
    $('streakValue').textContent = number(state.streak);
    $('streakPips').className = state.streak > 0 ? 'on' : '';
    $('spinCount').textContent = `SPINS ${state.spins}`;
  }

  function render() {
    renderHeroes();
    renderPlayer();
    renderEnemy();
    renderReels();
    renderOdds();
    renderLog();
    renderRewardPanel();
  }

  function selectHero(id) {
    if (!HEROES[id] || state.spinning || state.spins > 0 || state.encounterIndex > 0) {
      if (state.spins > 0 || state.encounterIndex > 0) showToast('Dealer selection locks after the first pull.');
      return;
    }
    state.heroId = id;
    state.dealerChosen = true;
    state.playerHp = maxHp();
    state.log = [];
    addLog(`${HEROES[id].name} takes the table.`, 'NEW DEALER');
    showResult('The table has a new dealer.', HEROES[id].trait, 'normal', HEROES[id].portrait);
    render();
    closeModal('heroPicker');
  }

  function toggleHold(index) {
    if (state.spinning || state.phase !== 'battle') return;
    state.held[index] = !state.held[index];
    const symbol = SYMBOLS[state.reels[index]];
    addLog(`${state.held[index] ? 'Held' : 'Released'} reel ${index + 1}.`, symbol.name);
    renderReels();
  }

  function addCharge(amount) {
    state.charge = clamp(state.charge + amount, 0, 100);
  }

  function setResult(title, detail, kind, icon) {
    $('resultTitle').textContent = title;
    $('resultDetail').textContent = detail;
    $('resultIcon').textContent = icon || '✦';
    resultBanner.className = `result-banner ${kind || ''}`;
  }

  function showResult(title, detail, kind, icon) {
    setResult(title, detail, kind, icon);
  }

  function chooseWildTarget(results) {
    const counts = { sword: 0, fire: 0, shield: 0, potion: 0 };
    results.forEach((key) => { if (counts[key] !== undefined) counts[key] += 1; });
    const order = ['sword', 'fire', 'shield', 'potion'];
    return order.sort((a, b) => counts[b] - counts[a])[0];
  }

  function hasCombo(results) {
    const active = results.filter((key) => key !== 'blank');
    if (active.length !== 3) return false;
    const nonWild = active.filter((key) => key !== 'clover');
    return nonWild.length === 0 || nonWild.every((key) => key === nonWild[0]);
  }

  function formatSymbols(results) {
    return results.map((key) => SYMBOLS[key].name).join(' · ');
  }

  function spin() {
    if (state.spinning || state.phase !== 'battle' || state.playerHp <= 0) return;
    state.spinning = true;
    const reelNodes = [...reelsEl.querySelectorAll('.reel')];
    const activeIndexes = state.held.map((held, index) => held ? -1 : index).filter((index) => index >= 0);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finalResults = state.reels.map((key, index) => state.held[index] ? key : rollSymbol());
    if (state.guaranteeSeven) {
      // House Edge overrides held drums too: a guaranteed jackpot must still
      // resolve as 7-7-7 regardless of the player's current hold pattern.
      finalResults.fill('seven');
      state.guaranteeSeven = false;
    }
    if (state.wildSurge) {
      finalResults.forEach((key, index) => {
        if (!state.held[index] && key === 'blank') finalResults[index] = 'fire';
      });
      state.wildSurge = false;
    }
    reelNodes.forEach((node, index) => {
      if (!state.held[index]) {
        node.classList.remove('locking', 'locked-in');
        node.classList.add('spinning');
      }
    });
    renderPlayer();
    clearSpinTimers();
    let lockedCount = 0;
    const lockedIndexes = new Set();
    spinInterval = window.setInterval(() => {
      // A locked drum is now a source-of-truth visual: only the still-moving
      // drums may receive ticker updates, so later locks never reroll earlier
      // visible results.
      activeIndexes.forEach((index) => {
        if (!lockedIndexes.has(index)) updateReelVisual(index, rollSymbol());
      });
    }, reduced ? 12 : 38);

    const baseDuration = reduced ? 18 : 1280;
    activeIndexes.forEach((index, order) => {
      lockTimers.push(window.setTimeout(() => {
        if (!state.spinning) return;
        if (lockedIndexes.has(index)) return;
        lockedIndexes.add(index);
        state.reels[index] = finalResults[index];
        updateReelVisual(index, finalResults[index]);
        const node = reelsEl.querySelector(`[data-index="${index}"]`);
        if (node) {
          node.classList.remove('spinning');
          node.classList.remove('locking', 'locked-in');
          void node.offsetWidth;
          node.classList.add('locking', 'locked-in');
          triggerReelLock(node);
        }
        lockedCount += 1;
        if (lockedCount === activeIndexes.length) finishSpin(finalResults);
      }, baseDuration + (order * (reduced ? 16 : REEL_STOP_GAP))));
    });

    // With every drum held there is no animation to wait for; resolve immediately.
    if (!activeIndexes.length) finishSpin(finalResults);
  }

  function updateReelVisual(index, key) {
    const node = reelsEl.querySelector(`[data-index="${index}"]`);
    if (!node || !SYMBOLS[key]) return;
    const symbol = SYMBOLS[key];
    node.style.setProperty('--symbol-color', symbol.color);
    const glyph = node.querySelector('.symbol-glyph');
    const name = node.querySelector('.symbol-name');
    if (glyph) glyph.textContent = symbol.glyph;
    if (name) name.textContent = symbol.name;
  }

  function triggerReelLock(node) {
    const sparks = node.querySelector('.reel-sparks');
    if (!sparks) return;
    sparks.classList.remove('burst');
    void sparks.offsetWidth;
    sparks.classList.add('burst');
  }

  function finishSpin(finalResults) {
    if (!state.spinning) return;
    if (spinInterval) window.clearInterval(spinInterval);
    spinInterval = null;
    lockTimers.forEach((timer) => window.clearTimeout(timer));
    lockTimers = [];
    state.reels = finalResults.slice();
    // Keep the lock snap visible for a beat before combat reacts to the final drum.
    resolveTimer = window.setTimeout(() => {
      if (!state.spinning) return;
      resolveTimer = null;
      state.spinning = false;
      renderReels();
      resolvePull(finalResults.slice());
    }, window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300);
  }

  function clearSpinTimers() {
    if (spinInterval) window.clearInterval(spinInterval);
    spinInterval = null;
    lockTimers.forEach((timer) => window.clearTimeout(timer));
    lockTimers = [];
    if (resolveTimer) window.clearTimeout(resolveTimer);
    resolveTimer = null;
  }

  function resolvePull(results) {
    state.spins += 1;
    const enemy = state.enemy;
    const currentHero = hero();
    const wilds = results.filter((key) => key === 'clover').length;
    const sevens = results.filter((key) => key === 'seven').length;
    const combo = hasCombo(results);
    let damage = 0;
    let healing = 0;
    let block = 0;
    let detail = formatSymbols(results);
    let title = 'A quiet pull.';
    let resultKind = 'normal';
    let icon = '·';

    if (state.burn && enemy.hp > 0) {
      const burnDamage = 18;
      enemy.hp -= burnDamage;
      state.burn -= 1;
      addLog(`The burn ticks for ${burnDamage} damage.`, 'EMBER');
      spawnFeedback(`EMBER · -${number(burnDamage)}`, 'damage');
    }

    if (sevens === 3) {
      const ratio = enemy.boss ? 0.30 : 0.80;
      damage = Math.max(1, Math.ceil(enemy.maxHp * ratio));
      enemy.hp -= damage;
      state.streak += 2;
      addCharge(enemy.boss ? 65 : 55);
      title = enemy.boss ? 'THE HOUSE BLINKS.' : 'TRIPLE 7 — JACKPOT!';
      detail = `${number(damage)} damage · ${enemy.boss ? '30% max HP + 2-turn stagger' : '80% max HP erased'} · ${formatSymbols(results)}`;
      resultKind = 'jackpot';
      icon = '7';
      if (enemy.boss) enemy.stagger = 2;
      const stage = $('reelStage');
      stage.classList.remove('jackpot');
      void stage.offsetWidth;
      stage.classList.add('jackpot');
      addLog(`${title} dealt ${number(damage)} damage.`, 'JACKPOT');
    } else {
      const target = chooseWildTarget(results);
      const swordCount = results.filter((key) => key === 'sword').length + (target === 'sword' ? wilds : 0);
      const fireCount = results.filter((key) => key === 'fire').length + (target === 'fire' ? wilds : 0);
      const shieldCount = results.filter((key) => key === 'shield').length + (target === 'shield' ? wilds : 0);
      const potionCount = results.filter((key) => key === 'potion').length + (target === 'potion' ? wilds : 0);
      const cloverOnly = results.every((key) => key === 'clover' || key === 'blank');

      if (swordCount) damage += swordCount * attackPower();
      if (fireCount) damage += Math.round(fireCount * attackPower() * .72);
      if (combo) damage = Math.round(damage * 1.65) || Math.round(attackPower() * 1.25);
      if (damage) {
        const critical = Math.random() < ((12 + state.upgrades.luck) / 100);
        if (critical) damage = Math.round(damage * 1.75);
        enemy.hp -= damage;
        state.streak += combo ? 2 : 1;
        addCharge(10 + damage / 18);
        title = critical ? 'CRITICAL HIT!' : (combo ? `THREE ${SYMBOLS[results.find((key) => key !== 'clover')]?.name || 'WILDS'} — COMBO!` : (fireCount && swordCount ? 'STEEL & FLAME.' : 'Clean hit.'));
        detail = `${number(damage)} damage${critical ? ' · 1.75× critical' : ''} · ${detail}`;
        resultKind = fireCount ? 'hot' : 'normal';
        icon = fireCount ? '✹' : '⚔';
        addLog(`${title} for ${number(damage)} damage.`, combo ? 'COMBO' : 'HIT');
      }
      if (shieldCount) {
        block = shieldCount * defensePower();
        if (currentHero.id === 'ironsaint') block = Math.round(block * 1.2);
        if (combo) block = Math.round(block * 1.4);
        state.block += block;
        addCharge(currentHero.id === 'ironsaint' ? 20 : 12);
        title = title === 'A quiet pull.' ? 'Fortify.' : `${title} + guard.`;
        detail += ` · ${number(block)} shield banked`;
        icon = '⬟';
        addLog(`Banked ${number(block)} shield for the counter-hit.`, 'GUARD');
      }
      if (potionCount) {
        healing = potionCount * (currentHero.baseHeal + state.upgrades.heal);
        if (combo) healing = Math.round(healing * 1.4);
        const before = state.playerHp;
        state.playerHp = clamp(state.playerHp + healing, 0, maxHp());
        healing = state.playerHp - before;
        addCharge(12);
        title = title === 'A quiet pull.' ? 'A sip between swings.' : `${title} + mend.`;
        detail += ` · restored ${number(healing)} vitality`;
        resultKind = 'heal';
        icon = '✚';
        addLog(`Recovered ${number(healing)} vitality.`, 'MEND');
      }
      if (fireCount >= 2) {
        state.burn = Math.max(state.burn, fireCount === 3 ? 3 : 2);
        detail += ` · target burning for ${state.burn} rounds`;
      }
      if (wilds && !damage && !block && !healing) {
        const luck = 4 + state.upgrades.luck;
        addCharge(8);
        state.streak += 1;
        title = cloverOnly && combo ? 'CLOVER CLOVER CLOVER!' : 'A lucky brush.';
        detail = `+${luck}% critical luck for this run · ${detail}`;
        icon = '♣';
        addLog('The WILD tilts the odds.', 'LUCK');
      }
      if (!damage && !block && !healing && !wilds) {
        state.streak = 0;
        title = sevens === 2 ? 'TWO SEVENS. SO CLOSE.' : 'The felt goes cold.';
        detail = sevens === 2 ? `+${number(8)}% charge · ${detail}` : `No effect · ${detail}`;
        addCharge(sevens === 2 ? 8 : 3);
        icon = sevens === 2 ? '7' : '·';
        addLog(title, sevens === 2 ? 'NEAR MISS' : 'BLANK');
      }
      if (sevens === 1 && damage) {
        damage += Math.round(enemy.maxHp * .03);
        enemy.hp -= Math.round(enemy.maxHp * .03);
        detail += ` · lucky 7 bonus`; 
      }
    }

    enemy.hp = Math.max(0, enemy.hp);
    state.charge = clamp(state.charge, 0, 100);
    if (damage) spawnFeedback(sevens === 3 ? `JACKPOT · -${number(damage)}` : `-${number(damage)}`, sevens === 3 ? 'jackpot' : 'damage');
    if (healing) spawnFeedback(`+${number(healing)}`, 'heal');
    if (block) spawnFeedback(`⬟ ${number(block)}`, 'block');
    if (!damage && !healing && !block) spawnFeedback(sevens === 2 ? 'SO CLOSE' : 'MISS', sevens === 2 ? 'jackpot' : 'damage');
    showResult(title, detail, resultKind, icon);
    if (enemy.hp <= 0) {
      finishEncounter();
      return;
    }
    enemyAttack();
    render();
    saveBest();
    scheduleAuto();
  }

  function enemyAttack() {
    const enemy = state.enemy;
    if (!enemy || enemy.hp <= 0) return;
    if (enemy.stagger > 0) {
      enemy.stagger -= 1;
      addLog(`${enemy.name} is staggered and misses the counter-hit.`, 'STAGGER');
      return;
    }
    const incoming = enemy.attack + Math.floor(Math.random() * 7);
    const blocked = Math.min(state.block, incoming);
    const damage = Math.max(0, incoming - state.block);
    state.block = 0;
    state.playerHp = Math.max(0, state.playerHp - damage);
    if (damage) spawnFeedback(`-${number(damage)}`, 'enemy-hit');
    else if (blocked) spawnFeedback(`BLOCK · ${number(blocked)}`, 'block');
    if (blocked) addLog(`Counter-hit absorbed ${number(blocked)} damage.`, damage ? 'BLOCK' : 'PERFECT BLOCK');
    if (damage) addLog(`${enemy.name} hits for ${number(damage)}.`, 'OUCH');
    if (state.playerHp <= 0) {
      state.phase = 'lost';
      state.auto = false;
      clearAuto();
      showResult('THE HOUSE COLLECTS.', `Your run ends at encounter ${pad(state.encounterIndex + 1)}. Reset the table and try a new dealer.`, 'hot', '×');
      addLog('Your chips are gone. The house wins this hand.', 'BUST');
    }
  }

  function finishEncounter() {
    const enemy = state.enemy;
    state.gold += enemy.reward;
    state.encounterIndex += 1;
    state.streak += 1;
    saveBest();
    if (enemy.boss) {
      state.phase = 'complete';
      state.auto = false;
      clearAuto();
      showResult('YOU BEAT THE HOUSE.', `The crown is yours. ${number(enemy.reward)} gold cashed out from the final table.`, 'jackpot', '♛');
      addLog('The final table pays the full jackpot.', 'RUN COMPLETE');
      state.options = [
        { id: 'cash', icon: '$', title: 'Cash Out', text: `Bank your ${number(state.gold)} gold and celebrate the run.`, cost: `RUN ${state.encounterIndex}/4`, apply() { showToast('Run banked. Reset when you want another table.'); } },
        { id: 'again', icon: '↻', title: 'Run It Back', text: 'Deal a fresh run with your best score intact.', cost: 'NEW RUN', apply() { startNewRun(); } }
      ];
    } else {
      state.phase = 'reward';
      state.options = buildUpgradeOptions();
      showResult(`${enemy.name.toUpperCase()} FOLDS.`, `You collect ${enemy.reward} gold and tune the reels before the next encounter.`, 'jackpot', '✓');
      addLog(`${enemy.name} defeated. Choose an upgrade.`, 'PAYOUT');
    }
    render();
    openModal('rewardPanel');
  }

  function buildUpgradeOptions() {
    const pool = UPGRADE_POOL.filter((item) => !(item.id === 'seven' && state.upgrades.seven >= 9));
    const start = (state.encounterIndex + state.upgrades.attack + state.upgrades.clover) % pool.length;
    const options = [];
    for (let i = 0; options.length < 3 && i < pool.length * 2; i += 1) {
      const candidate = pool[(start + i) % pool.length];
      if (!options.some((item) => item.id === candidate.id)) options.push(candidate);
    }
    return options;
  }

  function renderRewardPanel() {
    const isVisible = state.phase === 'reward' || state.phase === 'complete';
    rewardPanel.classList.toggle('hidden', !isVisible);
    rewardPanel.hidden = !isVisible;
    if (!isVisible) return;
    $('rewardHeading').textContent = state.phase === 'complete' ? 'You beat the house.' : 'Choose your next advantage.';
    $('rewardFlavor').textContent = state.phase === 'complete' ? `Four tables. One crown. Final purse: ${number(state.gold)} gold.` : 'The room gets meaner. So should your machine.';
    upgradeGrid.textContent = '';
    state.options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade-card';
      button.innerHTML = `<span class="upgrade-icon" aria-hidden="true">${option.icon}</span><span class="upgrade-cost">${option.cost}</span><h3>${option.title}</h3><p>${option.text}</p>`;
      button.addEventListener('click', () => chooseUpgrade(option));
      upgradeGrid.appendChild(button);
    });
  }

  function chooseUpgrade(option) {
    if (state.phase === 'complete') {
      option.apply(state);
      if (option.id === 'cash') render();
      return;
    }
    option.apply(state);
    state.playerHp = clamp(state.playerHp, 1, maxHp());
    showToast(`${option.title} added to the machine.`);
    addLog(`${option.title} installed between encounters.`, 'UPGRADE');
    startEncounter(state.encounterIndex);
  }

  function useAbility() {
    if (state.phase !== 'battle' || state.spinning || state.charge < 100) return;
    const currentHero = hero();
    state.charge = 0;
    if (currentHero.id === 'housebreaker') {
      state.guaranteeSeven = true;
      showResult('HOUSE EDGE LOADED.', 'Your next pull is a guaranteed triple 7. Make it count.', 'jackpot', '♜');
      addLog('House Edge loads the next pull.', 'READY');
    } else if (currentHero.id === 'ironsaint') {
      const guard = 42 + defensePower();
      state.block += guard;
      const heal = 18;
      state.playerHp = clamp(state.playerHp + heal, 0, maxHp());
      showResult('DOUBLE DOWN.', `Banked ${guard} shield and restored ${heal} vitality.`, 'heal', '⬟');
      addLog(`Double Down banks ${guard} shield.`, 'FORTIFY');
    } else {
      state.wildSurge = true;
      addCharge(0);
      showResult('WILD CARD.', 'Blanks on your next pull burst into FIRE instead.', 'hot', '✦');
      addLog('Wild Card primes the next pull.', 'BURN');
    }
    renderPlayer();
  }

  function startEncounter(index) {
    const template = ENCOUNTERS[index];
    if (!template) return;
    state.encounterIndex = index;
    state.enemy = { ...template, hp: template.maxHp, stagger: 0 };
    state.phase = 'battle';
    state.playerHp = clamp(state.playerHp + Math.ceil(maxHp() * .12), 1, maxHp());
    state.block = 0;
    state.burn = 0;
    state.held = [false, false, false];
    state.reels = ['sword', 'shield', 'blank'];
    showResult(`TABLE ${pad(index + 1)} DEALT.`, template.boss ? 'The final table is open. Find the triple 7.' : 'Tune your holds and pull for an opening hit.', 'normal', template.boss ? '♛' : '♠');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    scheduleAuto();
  }

  function startNewRun() {
    clearAuto();
    clearHoldInteraction();
    clearSpinTimers();
    state.run += 1;
    state.encounterIndex = 0;
    state.enemy = null;
    state.phase = 'battle';
    state.playerHp = maxHp();
    state.charge = 0;
    state.block = 0;
    state.burn = 0;
    state.streak = 0;
    state.spins = 0;
    state.gold = 120;
    state.upgrades = { attack: 0, defense: 0, maxHp: 0, heal: 0, seven: 0, clover: 0, luck: 0 };
    state.playerHp = maxHp();
    state.auto = false;
    state.held = [false, false, false];
    state.reels = ['sword', 'shield', 'blank'];
    state.spinning = false;
    state.guaranteeSeven = false;
    state.wildSurge = false;
    state.log = [];
    state.options = [];
    state.dealerChosen = false;
    state.enemy = { ...ENCOUNTERS[0], hp: ENCOUNTERS[0].maxHp, stagger: 0 };
    addLog('A fresh table opens. Pick your dealer.', 'NEW RUN');
    showResult('THE TABLE IS YOURS.', 'Pick a dealer, hold a reel, and pull the odds in your favor.', 'normal', '✦');
    render();
    openModal('heroPicker');
  }

  function clearAuto() {
    if (autoTimer) window.clearTimeout(autoTimer);
    autoTimer = null;
  }

  function scheduleAuto() {
    clearAuto();
    if (!state.auto || state.phase !== 'battle') return;
    autoTimer = window.setTimeout(() => {
      if (state.auto && state.phase === 'battle' && !state.spinning) spin();
      scheduleAuto();
    }, 2100);
  }

  function toggleAuto() {
    state.auto = !state.auto;
    if (state.auto) {
      showToast('Idle mode on — the machine will spin every 2.1 seconds.');
      scheduleAuto();
    } else {
      clearAuto();
      showToast('Idle mode paused.');
    }
    renderPlayer();
  }

  function setHoldProgress(progress) {
    const button = $('spinButton');
    if (!button) return;
    const percent = clamp(progress, 0, 1) * 100;
    button.style.setProperty('--hold-progress', `${percent}%`);
    button.dataset.holdPercent = `${Math.round(percent)}%`;
    button.classList.toggle('holding', progress > 0);
  }

  function clearHoldInteraction() {
    if (holdTimer) window.clearInterval(holdTimer);
    holdTimer = null;
    holdActive = false;
    holdStartedAt = 0;
    setHoldProgress(0);
  }

  function beginAttackHold(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ($('spinButton').disabled || anyModalOpen()) return;
    // Idle mode is deliberately a single tap target. Do not start another
    // hold timer (or trigger an attack) while the user is turning it off.
    if (state.auto) {
      clearHoldInteraction();
      suppressSpinClick = false;
      return;
    }
    clearHoldInteraction();
    holdActive = true;
    holdStartedAt = performance.now();
    suppressSpinClick = true;
    setHoldProgress(0.01);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (error) { /* capture is optional */ }
    holdTimer = window.setInterval(() => {
      if (!holdActive) return;
      const progress = clamp((performance.now() - holdStartedAt) / HOLD_DURATION, 0, 1);
      setHoldProgress(progress);
      if (progress >= 1) {
        holdActive = false;
        window.clearInterval(holdTimer);
        holdTimer = null;
        setHoldProgress(1);
        toggleAuto();
      }
    }, 16);
  }

  function endAttackHold(event) {
    if (!holdActive) {
      if (holdStartedAt) clearHoldInteraction();
      suppressSpinClick = true;
      return;
    }
    const elapsed = performance.now() - holdStartedAt;
    clearHoldInteraction();
    suppressSpinClick = true;
    if (elapsed < HOLD_DURATION) spin();
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (error) { /* capture is optional */ }
  }

  function cancelAttackHold() {
    if (!holdActive && !holdTimer && !holdStartedAt) return;
    clearHoldInteraction();
    suppressSpinClick = true;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function spawnFeedback(message, kind) {
    const layer = $('battleFeedback');
    if (!layer || !message) return;
    const pop = document.createElement('span');
    pop.className = `feedback-pop ${kind || ''}`;
    pop.textContent = message;
    layer.appendChild(pop);
    window.setTimeout(() => pop.remove(), 1250);
  }

  function isModalVisible(modal) {
    return modal && !modal.hidden && !modal.classList.contains('hidden');
  }

  function anyModalOpen() {
    return [heroPicker, $('characterInfoModal'), $('enemyInfoModal'), $('oddsModal'), $('logModal'), rewardPanel].some(isModalVisible);
  }

  function openModal(id) {
    const modal = $(id);
    if (!modal || (id === 'rewardPanel' && state.phase !== 'reward' && state.phase !== 'complete')) return;
    modalFocus = document.activeElement;
    modal.hidden = false;
    modal.classList.remove('hidden');
    const first = modal.querySelector('button:not([disabled])');
    if (first) window.setTimeout(() => first.focus(), 0);
  }

  function closeModal(id) {
    const modal = $(id);
    if (!modal || id === 'rewardPanel') return;
    if (id === 'heroPicker' && !state.dealerChosen) state.dealerChosen = true;
    modal.hidden = true;
    modal.classList.add('hidden');
    if (modalFocus && typeof modalFocus.focus === 'function') modalFocus.focus();
    modalFocus = null;
  }

  $('abilityButton').addEventListener('click', useAbility);
  $('modalAbilityButton').addEventListener('click', useAbility);
  $('spinButton').addEventListener('pointerdown', beginAttackHold);
  $('spinButton').addEventListener('pointerup', endAttackHold);
  $('spinButton').addEventListener('pointercancel', cancelAttackHold);
  $('spinButton').addEventListener('pointerleave', cancelAttackHold);
  $('spinButton').addEventListener('click', (event) => {
    if (state.auto) {
      clearHoldInteraction();
      suppressSpinClick = false;
      toggleAuto();
      return;
    }
    if (suppressSpinClick) {
      suppressSpinClick = false;
      return;
    }
    // Keyboard activation produces a click without pointer events.
    if (event.detail === 0) spin();
  });
  $('characterInfoButton').addEventListener('click', () => openModal('characterInfoModal'));
  $('oddsButton').addEventListener('click', () => openModal('oddsModal'));
  $('logButton').addEventListener('click', () => openModal('logModal'));
  $('enemyActor').addEventListener('click', () => openModal('enemyInfoModal'));
  $('enemyActor').addEventListener('keydown', (event) => {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      openModal('enemyInfoModal');
    }
  });
  $('changeDealerButton').addEventListener('click', () => {
    if (state.spins > 0 || state.encounterIndex > 0) {
      showToast('Dealer selection locks after the first pull.');
      return;
    }
    closeModal('characterInfoModal');
    openModal('heroPicker');
  });
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal && modal.id !== 'rewardPanel') closeModal(modal.id);
    });
  });
  $('resetButton').addEventListener('click', () => {
    if (window.confirm('Start a fresh run? Your best score will stay saved.')) startNewRun();
  });
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      const open = [rewardPanel, $('logModal'), $('oddsModal'), $('characterInfoModal'), $('enemyInfoModal'), heroPicker].find(isModalVisible);
      if (open && open.id !== 'rewardPanel') { closeModal(open.id); event.preventDefault(); }
      return;
    }
    if (anyModalOpen()) return;
    if (event.code === 'Enter' && !event.repeat && document.activeElement?.tagName !== 'BUTTON') spin();
    if (event.code === 'Space' && !event.repeat && document.activeElement?.tagName !== 'BUTTON') {
      event.preventDefault();
      if (state.charge >= 100) useAbility(); else spin();
    }
  });

  state.enemy = { ...ENCOUNTERS[0], hp: ENCOUNTERS[0].maxHp, stagger: 0 };
  state.playerHp = maxHp();
  addLog('The table is open. Pick a dealer.', 'ANTE UP');
  render();
  openModal('heroPicker');
}());
