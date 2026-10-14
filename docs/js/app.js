// RL Course Interactive Arena, Leaderboard & Playable 2D Simulator
// Author: Course Teaching Staff & Rafael Flor (rflor01)

const HUMAN_AGENT = "🎮 Tú (Humano / Control Manual)";

const STATE = {
  currentPractical: 1, // 1 for LunarLander, 2 for Taxi
  currentTab: 'arena',
  leaderboards: {
    1: [],
    2: []
  },
  agentA: HUMAN_AGENT,
  agentB: 'demo_student',
  duelMode: 'live', // 'live' or 'video'
  duelRunning: false,
  duelInterval: null,
  sandboxEnv: 1, // 1 for LunarLander, 2 for Taxi
  sandboxMode: 'manual', // 'manual' or 'autopilot'
  
  // Active human inputs
  keys: {
    thrust: false,
    left: false,
    right: false,
    down: false,
    pickup: false,
    dropoff: false
  }
};

// Default fallback data if running offline or without webserver
const FALLBACK_DATA_P1 = [
  {
    participant: "demo_student",
    mean_reward: 253.55,
    std_reward: 24.67,
    avg_steps: 364.6,
    success_rate: 100.0,
    status: "MASTERY 🏆",
    status_code: "passed"
  },
  {
    participant: "baseline_heuristic",
    mean_reward: 255.97,
    std_reward: 54.46,
    avg_steps: 231.9,
    success_rate: 95.0,
    status: "MASTERY 🏆",
    status_code: "passed"
  },
  {
    participant: "baseline_random",
    mean_reward: -159.96,
    std_reward: 94.45,
    avg_steps: 92.3,
    success_rate: 0.0,
    status: "NEEDS IMPROVEMENT ⚠️",
    status_code: "warning"
  }
];

const FALLBACK_DATA_P2 = [
  {
    participant: "baseline_random",
    mean_reward: -789.0,
    std_reward: 75.2,
    avg_steps: 196.7,
    success_rate: 0.0,
    status: "NEEDS IMPROVEMENT ⚠️",
    status_code: "warning"
  }
];

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupPracticalSelector();
  setupKeyListeners();
  setupTouchControls();
  await loadData();
  populateDropdowns();
  updateArenaView();
  renderLeaderboard();
  
  initDuelArena();
  initSandboxArcade();
});

// ---------------------------------------------------------------------------
// Navigation & Tabs
// ---------------------------------------------------------------------------
function setupNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetView = tab.dataset.tab;
      STATE.currentTab = targetView;

      document.querySelectorAll('.view-section').forEach(sec => {
        sec.style.display = 'none';
      });

      const activeSec = document.getElementById(`${targetView}-view`);
      if (activeSec) {
        activeSec.style.display = 'block';
      }

      if (targetView === 'sandbox') {
        resetSandbox();
      } else if (targetView === 'arena') {
        resetDuel();
      }
    });
  });
}

function setupPracticalSelector() {
  const pills = document.querySelectorAll('.p-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      STATE.currentPractical = parseInt(pill.dataset.practical, 10);
      
      // Also sync sandbox env button
      syncSandboxEnvButton(STATE.currentPractical);

      populateDropdowns();
      updateArenaView();
      renderLeaderboard();
      resetDuel();
      resetSandbox();
    });
  });
}

function syncSandboxEnvButton(pNum) {
  STATE.sandboxEnv = pNum;
  document.querySelectorAll('.sandbox-env-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.sandboxEnv, 10) === pNum);
  });
  
  const landerCtrl = document.getElementById('sb-controls-lander');
  const taxiCtrl = document.getElementById('sb-controls-taxi');
  if (landerCtrl && taxiCtrl) {
    landerCtrl.style.display = pNum === 1 ? 'block' : 'none';
    taxiCtrl.style.display = pNum === 2 ? 'block' : 'none';
  }
}

// ---------------------------------------------------------------------------
// Global Keyboard & Touch Listeners
// ---------------------------------------------------------------------------
function setupKeyListeners() {
  window.addEventListener('keydown', (e) => {
    const isGameTab = STATE.currentTab === 'sandbox' || STATE.currentTab === 'arena';
    
    // Prevent default scrolling for gameplay keys
    if (isGameTab && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      STATE.keys.thrust = true;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      STATE.keys.left = true;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      STATE.keys.right = true;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      STATE.keys.down = true;
    }
    if (e.key === 'p' || e.key === 'P') {
      handleTaxiAction('pickup');
    }
    if (e.key === 'o' || e.key === 'O' || e.key === 'Enter') {
      handleTaxiAction('dropoff');
    }
    if (e.key === 'r' || e.key === 'R') {
      if (STATE.currentTab === 'sandbox') resetSandbox();
      if (STATE.currentTab === 'arena') resetDuel();
    }

    // Directional triggers for Taxi in sandbox or arena
    if (STATE.currentTab === 'sandbox' && STATE.sandboxEnv === 2) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') handleTaxiAction('up');
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') handleTaxiAction('down');
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') handleTaxiAction('left');
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleTaxiAction('right');
    }
    if (STATE.currentTab === 'arena' && STATE.currentPractical === 2 && (STATE.agentA === HUMAN_AGENT || STATE.agentB === HUMAN_AGENT)) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') handleDuelTaxiAction('up');
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') handleDuelTaxiAction('down');
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') handleDuelTaxiAction('left');
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleDuelTaxiAction('right');
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      STATE.keys.thrust = false;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      STATE.keys.left = false;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      STATE.keys.right = false;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      STATE.keys.down = false;
    }
  });
}

function bindPressEvents(btn, onDown, onUp) {
  if (!btn) return;
  const start = (e) => {
    e.preventDefault();
    btn.classList.add('pressed');
    if (onDown) onDown();
  };
  const end = (e) => {
    e.preventDefault();
    btn.classList.remove('pressed');
    if (onUp) onUp();
  };
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('touchstart', start, { passive: false });
  btn.addEventListener('touchend', end, { passive: false });
}

function setupTouchControls() {
  // Sandbox Lander buttons
  bindPressEvents(document.getElementById('btn-touch-thrust'), () => { STATE.keys.thrust = true; }, () => { STATE.keys.thrust = false; });
  bindPressEvents(document.getElementById('btn-touch-left'), () => { STATE.keys.left = true; }, () => { STATE.keys.left = false; });
  bindPressEvents(document.getElementById('btn-touch-right'), () => { STATE.keys.right = true; }, () => { STATE.keys.right = false; });

  // Sandbox Taxi buttons
  document.getElementById('btn-taxi-up')?.addEventListener('click', () => handleTaxiAction('up'));
  document.getElementById('btn-taxi-down')?.addEventListener('click', () => handleTaxiAction('down'));
  document.getElementById('btn-taxi-left')?.addEventListener('click', () => handleTaxiAction('left'));
  document.getElementById('btn-taxi-right')?.addEventListener('click', () => handleTaxiAction('right'));
  document.getElementById('btn-taxi-pickup')?.addEventListener('click', () => handleTaxiAction('pickup'));
  document.getElementById('btn-taxi-dropoff')?.addEventListener('click', () => handleTaxiAction('dropoff'));

  // Arena Human Lander buttons
  bindPressEvents(document.getElementById('btn-arena-touch-thrust'), () => { STATE.keys.thrust = true; }, () => { STATE.keys.thrust = false; });
  bindPressEvents(document.getElementById('btn-arena-touch-left'), () => { STATE.keys.left = true; }, () => { STATE.keys.left = false; });
  bindPressEvents(document.getElementById('btn-arena-touch-right'), () => { STATE.keys.right = true; }, () => { STATE.keys.right = false; });

  // Arena Human Taxi buttons
  document.getElementById('btn-arena-taxi-up')?.addEventListener('click', () => handleDuelTaxiAction('up'));
  document.getElementById('btn-arena-taxi-down')?.addEventListener('click', () => handleDuelTaxiAction('down'));
  document.getElementById('btn-arena-taxi-left')?.addEventListener('click', () => handleDuelTaxiAction('left'));
  document.getElementById('btn-arena-taxi-right')?.addEventListener('click', () => handleDuelTaxiAction('right'));
  document.getElementById('btn-arena-taxi-pickup')?.addEventListener('click', () => handleDuelTaxiAction('pickup'));
  document.getElementById('btn-arena-taxi-dropoff')?.addEventListener('click', () => handleDuelTaxiAction('dropoff'));
}

// ---------------------------------------------------------------------------
// Leaderboards & Dropdowns
// ---------------------------------------------------------------------------
async function loadData() {
  try {
    const res1 = await fetch('./data/leaderboard_p1.json');
    if (res1.ok) {
      STATE.leaderboards[1] = await res1.json();
    } else {
      STATE.leaderboards[1] = FALLBACK_DATA_P1;
    }
  } catch (e) {
    STATE.leaderboards[1] = FALLBACK_DATA_P1;
  }

  try {
    const res2 = await fetch('./data/leaderboard_p2.json');
    if (res2.ok) {
      STATE.leaderboards[2] = await res2.json();
    } else {
      STATE.leaderboards[2] = FALLBACK_DATA_P2;
    }
  } catch (e) {
    STATE.leaderboards[2] = FALLBACK_DATA_P2;
  }
}

function populateDropdowns() {
  const selectA = document.getElementById('select-agent-a');
  const selectB = document.getElementById('select-agent-b');
  if (!selectA || !selectB) return;

  selectA.innerHTML = '';
  selectB.innerHTML = '';

  const list = STATE.leaderboards[STATE.currentPractical] || [];
  const participants = [HUMAN_AGENT, ...list.map(item => item.participant)];

  participants.forEach((p) => {
    const optA = document.createElement('option');
    optA.value = p;
    optA.textContent = p;
    selectA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = p;
    optB.textContent = p;
    selectB.appendChild(optB);
  });

  // Default selection: Player A = Human, Player B = Top Bot
  STATE.agentA = HUMAN_AGENT;
  STATE.agentB = list.length > 0 ? list[0].participant : HUMAN_AGENT;
  selectA.value = STATE.agentA;
  selectB.value = STATE.agentB;

  selectA.onchange = (e) => {
    STATE.agentA = e.target.value;
    updateArenaView();
    resetDuel();
  };

  selectB.onchange = (e) => {
    STATE.agentB = e.target.value;
    updateArenaView();
    resetDuel();
  };
}

function updateCornerStats(corner, participantName) {
  const isHuman = participantName === HUMAN_AGENT;
  const list = STATE.leaderboards[STATE.currentPractical] || [];
  const agent = list.find(item => item.participant === participantName) || {
    mean_reward: 0,
    std_reward: 0,
    avg_steps: 0,
    success_rate: 0
  };

  const statReward = document.getElementById(`stat-reward-${corner}`);
  const statSteps = document.getElementById(`stat-steps-${corner}`);
  const statSuccess = document.getElementById(`stat-success-${corner}`);
  const statStd = document.getElementById(`stat-std-${corner}`);

  if (isHuman) {
    if (statReward) statReward.textContent = "EN VIVO 🎮";
    if (statSteps) statSteps.textContent = "Tu ritmo";
    if (statSuccess) statSuccess.textContent = "Tú decides";
    if (statStd) statStd.textContent = "Manual";
  } else {
    if (statReward) statReward.textContent = `${agent.mean_reward > 0 ? '+' : ''}${agent.mean_reward.toFixed(1)} pts`;
    if (statSteps) statSteps.textContent = `${agent.avg_steps ? agent.avg_steps.toFixed(0) : 'N/A'} st`;
    if (statSuccess) statSuccess.textContent = `${(agent.success_rate || 0).toFixed(0)}%`;
    if (statStd) statStd.textContent = `±${(agent.std_reward || 0).toFixed(1)}`;
  }
}

function updateArenaView() {
  updateCornerStats('a', STATE.agentA);
  updateCornerStats('b', STATE.agentB);

  // Update corner badges and names
  const lblA = document.getElementById('lbl-agent-a-badge');
  const lblB = document.getElementById('lbl-agent-b-badge');
  if (lblA) lblA.textContent = STATE.agentA === HUMAN_AGENT ? "🔵 TÚ (HUMANO)" : `🔵 ${STATE.agentA}`;
  if (lblB) lblB.textContent = STATE.agentB === HUMAN_AGENT ? "🟠 TÚ (HUMANO)" : `🟠 ${STATE.agentB}`;

  const hasHuman = STATE.agentA === HUMAN_AGENT || STATE.agentB === HUMAN_AGENT;
  const humanCtrlPanel = document.getElementById('arena-human-controls');
  const liveWrapper = document.getElementById('duel-live-wrapper');
  const videoWrapper = document.getElementById('duel-video-wrapper');
  const modeGroup = document.getElementById('duel-mode-toggle-group');

  if (humanCtrlPanel) {
    humanCtrlPanel.style.display = hasHuman ? 'flex' : 'none';
    
    // Toggle lander vs taxi buttons in arena
    const landerRow = document.getElementById('arena-touch-buttons');
    const taxiRow = document.getElementById('arena-touch-taxi-buttons');
    const hints = document.getElementById('arena-keyboard-hints');
    if (STATE.currentPractical === 1) {
      if (landerRow) landerRow.style.display = 'flex';
      if (taxiRow) taxiRow.style.display = 'none';
      if (hints) hints.textContent = "Teclas: [A / ⬅️] Girar Izq | [D / ➡️] Girar Der | [Espacio / W / ⬆️] Propulsor";
    } else {
      if (landerRow) landerRow.style.display = 'none';
      if (taxiRow) taxiRow.style.display = 'flex';
      if (hints) hints.textContent = "Teclas: Flechas o WASD | [P / Espacio] Recoger | [O / Enter] Dejar";
    }
  }

  // If a human is playing, force live simulation mode
  if (hasHuman) {
    STATE.duelMode = 'live';
    if (liveWrapper) liveWrapper.style.display = 'flex';
    if (videoWrapper) videoWrapper.style.display = 'none';
    if (modeGroup) modeGroup.style.display = 'none';
  } else {
    if (modeGroup) modeGroup.style.display = 'flex';
  }

  updateComparisonBars();
}

function updateComparisonBars() {
  const list = STATE.leaderboards[STATE.currentPractical] || [];
  const getStats = (pName) => {
    if (pName === HUMAN_AGENT) {
      return { avg_steps: 220, mean_reward: 200 };
    }
    return list.find(item => item.participant === pName) || { avg_steps: 200, mean_reward: 0 };
  };

  const a = getStats(STATE.agentA);
  const b = getStats(STATE.agentB);

  document.querySelectorAll('.agent-name-a').forEach(el => el.textContent = STATE.agentA);
  document.querySelectorAll('.agent-name-b').forEach(el => el.textContent = STATE.agentB);

  const stepsA = a.avg_steps || 100;
  const stepsB = b.avg_steps || 100;
  const valStepsA = document.getElementById('bar-val-steps-a');
  const valStepsB = document.getElementById('bar-val-steps-b');
  if (valStepsA) valStepsA.textContent = `${stepsA.toFixed(0)} st`;
  if (valStepsB) valStepsB.textContent = `${stepsB.toFixed(0)} st`;

  const maxSteps = Math.max(stepsA, stepsB, 1);
  const fillA = document.getElementById('bar-fill-steps-a');
  const fillB = document.getElementById('bar-fill-steps-b');
  if (fillA) fillA.style.width = `${Math.min(100, (stepsA / maxSteps) * 100)}%`;
  if (fillB) fillB.style.width = `${Math.min(100, (stepsB / maxSteps) * 100)}%`;

  const rA = a.mean_reward || 0;
  const rB = b.mean_reward || 0;
  const valRA = document.getElementById('bar-val-reward-a');
  const valRB = document.getElementById('bar-val-reward-b');
  if (valRA) valRA.textContent = `${rA > 0 ? '+' : ''}${rA.toFixed(1)}`;
  if (valRB) valRB.textContent = `${rB > 0 ? '+' : ''}${rB.toFixed(1)}`;

  const maxR = Math.max(Math.abs(rA), Math.abs(rB), 1);
  const fillRA = document.getElementById('bar-fill-reward-a');
  const fillRB = document.getElementById('bar-fill-reward-b');
  if (fillRA) fillRA.style.width = `${Math.min(100, (Math.abs(rA) / maxR) * 100)}%`;
  if (fillRB) fillRB.style.width = `${Math.min(100, (Math.abs(rB) / maxR) * 100)}%`;
}

function renderLeaderboard(filter = '') {
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = STATE.leaderboards[STATE.currentPractical] || [];
  const filtered = list.filter(item => item.participant.toLowerCase().includes(filter));

  filtered.forEach((item, idx) => {
    const tr = document.createElement('tr');
    let rankBadge = `<span class="rank-badge rank-other">#${idx + 1}</span>`;
    if (idx === 0) rankBadge = `<span class="rank-badge rank-1">🥇</span>`;
    if (idx === 1) rankBadge = `<span class="rank-badge rank-2">🥈</span>`;
    if (idx === 2) rankBadge = `<span class="rank-badge rank-3">🥉</span>`;

    const rewardClass = item.mean_reward >= 100 ? 'text-emerald-400' : 'text-slate-300';

    tr.innerHTML = `
      <td>${rankBadge}</td>
      <td class="participant-cell">
        <span>${item.participant}</span>
        ${item.participant.includes('baseline') ? '<span style="font-size: 0.7rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">BASELINE</span>' : ''}
      </td>
      <td style="font-family: var(--font-mono); font-weight: 700;" class="${rewardClass}">
        ${item.mean_reward > 0 ? '+' : ''}${item.mean_reward.toFixed(1)}
      </td>
      <td style="font-family: var(--font-mono); color: var(--text-dim);">
        ±${item.std_reward.toFixed(1)}
      </td>
      <td style="font-family: var(--font-mono);">
        ${(item.success_rate || 0).toFixed(0)}%
      </td>
      <td style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-amber);">
        ${item.avg_steps ? item.avg_steps.toFixed(0) : 'N/A'} st
      </td>
      <td>
        <button class="btn-challenge" onclick="challengeAgent('${item.participant}')">
          ⚔️ Retar en Arena
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.challengeAgent = function(participant) {
  STATE.agentA = HUMAN_AGENT;
  STATE.agentB = participant;
  
  const selectA = document.getElementById('select-agent-a');
  const selectB = document.getElementById('select-agent-b');
  if (selectA) selectA.value = STATE.agentA;
  if (selectB) selectB.value = STATE.agentB;

  const arenaTab = document.querySelector('[data-tab="arena"]');
  if (arenaTab) arenaTab.click();

  updateArenaView();
  startLiveDuel();
};


// ===========================================================================
// HEAD-TO-HEAD DUEL ARENA ENGINE (Synchronized Split Screen: Human vs AI)
// ===========================================================================
let duelCanvas, duelCtx;
let duelLanderA, duelLanderB;
let duelTaxiA, duelTaxiB;
let duelParticles = [];

function initDuelArena() {
  duelCanvas = document.getElementById('duel-canvas');
  if (!duelCanvas) return;
  duelCtx = duelCanvas.getContext('2d');

  // Duel mode toggle buttons (Live vs Video)
  const btnLive = document.getElementById('btn-mode-live');
  const btnVideo = document.getElementById('btn-mode-video');
  const liveWrapper = document.getElementById('duel-live-wrapper');
  const videoWrapper = document.getElementById('duel-video-wrapper');

  btnLive?.addEventListener('click', () => {
    btnLive.classList.add('active');
    btnVideo?.classList.remove('active');
    STATE.duelMode = 'live';
    if (liveWrapper) liveWrapper.style.display = 'flex';
    if (videoWrapper) videoWrapper.style.display = 'none';
  });

  btnVideo?.addEventListener('click', () => {
    btnVideo.classList.add('active');
    btnLive?.classList.remove('active');
    STATE.duelMode = 'video';
    if (liveWrapper) liveWrapper.style.display = 'none';
    if (videoWrapper) videoWrapper.style.display = 'flex';
    const videoElem = document.getElementById('duel-video');
    if (videoElem) {
      videoElem.currentTime = 0;
      videoElem.play().catch(e => console.log('Autoplay:', e));
    }
  });

  document.getElementById('btn-start-duel')?.addEventListener('click', () => {
    startLiveDuel();
  });

  resetDuel();
  requestAnimationFrame(duelLoop);
}

function resetDuel() {
  STATE.duelRunning = false;
  duelParticles = [];

  const overlay = document.getElementById('duel-overlay');
  if (overlay) overlay.style.display = 'none';

  // Seeded initialization for fair identical conditions
  const startX_offset = (Math.random() - 0.5) * 80;
  const startAngle = (Math.random() - 0.5) * 0.25;

  duelLanderA = {
    x: 200 + startX_offset,
    y: 60,
    vx: (Math.random() - 0.5) * 0.8,
    vy: 0.1,
    angle: startAngle,
    thrust: false,
    leftThrust: false,
    rightThrust: false,
    landed: false,
    crashed: false,
    steps: 0,
    score: 0,
    padX: 200,
    padY: 340
  };

  duelLanderB = {
    x: 600 + startX_offset,
    y: 60,
    vx: duelLanderA.vx,
    vy: duelLanderA.vy,
    angle: startAngle,
    thrust: false,
    leftThrust: false,
    rightThrust: false,
    landed: false,
    crashed: false,
    steps: 0,
    score: 0,
    padX: 600,
    padY: 340
  };

  // Taxi duel initialization
  const stations = [
    { row: 0, col: 0, name: 'R', color: '#f43f5e' },
    { row: 0, col: 4, name: 'G', color: '#10b981' },
    { row: 4, col: 0, name: 'Y', color: '#f59e0b' },
    { row: 4, col: 3, name: 'B', color: '#3b82f6' }
  ];
  const pIdx = Math.floor(Math.random() * 4);
  let dIdx = Math.floor(Math.random() * 4);
  while (dIdx === pIdx) dIdx = Math.floor(Math.random() * 4);

  const startTaxi = { row: 2, col: 2 };

  duelTaxiA = {
    row: startTaxi.row,
    col: startTaxi.col,
    passengerIdx: pIdx,
    passengerInTaxi: false,
    destinationIdx: dIdx,
    steps: 0,
    score: 0,
    delivered: false
  };

  duelTaxiB = {
    row: startTaxi.row,
    col: startTaxi.col,
    passengerIdx: pIdx,
    passengerInTaxi: false,
    destinationIdx: dIdx,
    steps: 0,
    score: 0,
    delivered: false,
    lastAiStepTime: 0
  };
}

function startLiveDuel() {
  resetDuel();
  const overlay = document.getElementById('duel-overlay');
  const overlayText = document.getElementById('duel-overlay-text');
  const badge = document.getElementById('duel-winner-badge');
  if (badge) badge.textContent = "¡Duelo en curso! Ambos compiten bajo el mismo desafío...";

  if (overlay && overlayText) {
    overlay.style.display = 'flex';
    overlayText.textContent = "¡PREPARADOS!";

    setTimeout(() => {
      overlayText.textContent = "3...";
      setTimeout(() => {
        overlayText.textContent = "2...";
        setTimeout(() => {
          overlayText.textContent = "1... ¡DESPEGUE!";
          setTimeout(() => {
            overlay.style.display = 'none';
            STATE.duelRunning = true;
          }, 600);
        }, 600);
      }, 600);
    }, 400);
  } else {
    STATE.duelRunning = true;
  }
}

function handleDuelTaxiAction(act) {
  if (!STATE.duelRunning || STATE.currentPractical !== 2) return;
  // Human moves their taxi
  const isHumanA = STATE.agentA === HUMAN_AGENT;
  const isHumanB = STATE.agentB === HUMAN_AGENT;
  if (isHumanA) executeTaxiStep(duelTaxiA, act);
  else if (isHumanB) executeTaxiStep(duelTaxiB, act);
  checkDuelEnd();
}

function duelLoop() {
  if (STATE.currentTab === 'arena' && duelCtx) {
    if (STATE.currentPractical === 1) {
      updateDuelLanderPhysics();
      renderDuelLander();
    } else {
      updateDuelTaxiLogic();
      renderDuelTaxi();
    }
  }
  requestAnimationFrame(duelLoop);
}

function updateDuelLanderPhysics() {
  if (!STATE.duelRunning) return;

  const isHumanA = STATE.agentA === HUMAN_AGENT;
  const isHumanB = STATE.agentB === HUMAN_AGENT;

  // Update Side A
  if (!duelLanderA.landed && !duelLanderA.crashed) {
    duelLanderA.steps++;
    if (isHumanA) {
      duelLanderA.thrust = STATE.keys.thrust;
      duelLanderA.leftThrust = STATE.keys.left;
      duelLanderA.rightThrust = STATE.keys.right;
    } else {
      runLanderHeuristic(duelLanderA, duelLanderA.padX);
    }
    stepLanderPhysics(duelLanderA);
  }

  // Update Side B
  if (!duelLanderB.landed && !duelLanderB.crashed) {
    duelLanderB.steps++;
    if (isHumanB) {
      duelLanderB.thrust = STATE.keys.thrust;
      duelLanderB.leftThrust = STATE.keys.left;
      duelLanderB.rightThrust = STATE.keys.right;
    } else {
      runLanderHeuristic(duelLanderB, duelLanderB.padX);
    }
    stepLanderPhysics(duelLanderB);
  }

  // Update particles
  duelParticles = duelParticles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.025;
    return p.alpha > 0;
  });

  checkDuelEnd();
}

function stepLanderPhysics(lander) {
  const gravity = 0.045;
  const mainThrust = 0.12;
  const rotSpeed = 0.005;

  if (lander.leftThrust) {
    lander.angle -= rotSpeed;
    lander.score -= 0.02;
    addDuelParticle(lander.x - 12, lander.y, 1, 0, '#00d2ff');
  }
  if (lander.rightThrust) {
    lander.angle += rotSpeed;
    lander.score -= 0.02;
    addDuelParticle(lander.x + 12, lander.y, -1, 0, '#00d2ff');
  }
  if (lander.thrust) {
    lander.vx += Math.sin(lander.angle) * mainThrust;
    lander.vy -= Math.cos(lander.angle) * mainThrust;
    lander.score -= 0.05;
    addDuelParticle(lander.x, lander.y + 10, (Math.random() - 0.5) * 1.5, 2.5 + Math.random() * 2, '#ff5500');
  }

  lander.vy += gravity;
  lander.vx *= 0.995;
  lander.x += lander.vx;
  lander.y += lander.vy;

  // Reward shaping towards pad
  const dist = Math.abs(lander.x - lander.padX);
  lander.score += (200 - dist) * 0.005;

  // Touchdown / Ground check
  if (lander.y >= lander.padY) {
    lander.y = lander.padY;
    const padMargin = 45;
    const onPad = Math.abs(lander.x - lander.padX) <= padMargin;
    const safeVy = lander.vy < 1.6;
    const safeVx = Math.abs(lander.vx) < 1.0;
    const safeAngle = Math.abs(lander.angle) < 0.28;

    if (onPad && safeVy && safeVx && safeAngle) {
      lander.landed = true;
      lander.score += 100;
      for (let i = 0; i < 20; i++) {
        addDuelParticle(lander.x, lander.y, (Math.random() - 0.5) * 4, -Math.random() * 3, '#10b981');
      }
    } else {
      lander.crashed = true;
      lander.score -= 100;
      for (let i = 0; i < 30; i++) {
        addDuelParticle(lander.x, lander.y, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, '#f43f5e');
      }
    }
  }
}

function runLanderHeuristic(lander, padCenterX) {
  const xErr = (lander.x - padCenterX) * 0.0035 + lander.vx * 0.28;
  const targetAngle = Math.max(-0.35, Math.min(0.35, xErr));
  const angleErr = targetAngle - lander.angle;

  lander.leftThrust = angleErr < -0.04;
  lander.rightThrust = angleErr > 0.04;

  const targetVy = 0.5 * Math.min(1.0, (lander.padY - lander.y) / 120);
  lander.thrust = lander.vy > targetVy || lander.y > (lander.padY - 40);
}

function addDuelParticle(x, y, vx, vy, color) {
  duelParticles.push({ x, y, vx, vy, color, alpha: 1.0, size: 2 + Math.random() * 2 });
}

function updateDuelTaxiLogic() {
  if (!STATE.duelRunning) return;

  const now = Date.now();
  // If bot is on side B (or A), step every 260ms
  if (STATE.agentB !== HUMAN_AGENT && !duelTaxiB.delivered) {
    if (now - duelTaxiB.lastAiStepTime > 260) {
      duelTaxiB.lastAiStepTime = now;
      const aiAct = getOptimalTaxiAction(duelTaxiB);
      executeTaxiStep(duelTaxiB, aiAct);
      checkDuelEnd();
    }
  }

  if (STATE.agentA !== HUMAN_AGENT && !duelTaxiA.delivered) {
    if (now - duelTaxiA.lastAiStepTime > 260) {
      duelTaxiA.lastAiStepTime = now;
      const aiAct = getOptimalTaxiAction(duelTaxiA);
      executeTaxiStep(duelTaxiA, aiAct);
      checkDuelEnd();
    }
  }
}

function checkDuelEnd() {
  if (!STATE.duelRunning) return;

  let endedA = false, endedB = false;
  if (STATE.currentPractical === 1) {
    endedA = duelLanderA.landed || duelLanderA.crashed || duelLanderA.steps > 800;
    endedB = duelLanderB.landed || duelLanderB.crashed || duelLanderB.steps > 800;
  } else {
    endedA = duelTaxiA.delivered || duelTaxiA.steps >= 150;
    endedB = duelTaxiB.delivered || duelTaxiB.steps >= 150;
  }

  // Update live telemetry in Duel cards
  const scoreA = STATE.currentPractical === 1 ? duelLanderA.score : duelTaxiA.score;
  const scoreB = STATE.currentPractical === 1 ? duelLanderB.score : duelTaxiB.score;
  const stepsA = STATE.currentPractical === 1 ? duelLanderA.steps : duelTaxiA.steps;
  const stepsB = STATE.currentPractical === 1 ? duelLanderB.steps : duelTaxiB.steps;

  document.getElementById('bar-val-reward-a').textContent = `${scoreA > 0 ? '+' : ''}${scoreA.toFixed(1)}`;
  document.getElementById('bar-val-reward-b').textContent = `${scoreB > 0 ? '+' : ''}${scoreB.toFixed(1)}`;
  document.getElementById('bar-val-steps-a').textContent = `${stepsA} st`;
  document.getElementById('bar-val-steps-b').textContent = `${stepsB} st`;

  if (endedA && endedB) {
    STATE.duelRunning = false;
    declareDuelWinner(scoreA, scoreB, stepsA, stepsB);
  }
}

function declareDuelWinner(scoreA, scoreB, stepsA, stepsB) {
  const badge = document.getElementById('duel-winner-badge');
  const overlay = document.getElementById('duel-overlay');
  const overlayText = document.getElementById('duel-overlay-text');

  let winnerName = "";
  let message = "";

  if (scoreA > scoreB) {
    winnerName = STATE.agentA;
    const delta = (scoreA - scoreB).toFixed(1);
    message = `🏆 ¡${winnerName} GANA EL DUELO! (+${delta} pts de ventaja en ${stepsA} pasos)`;
  } else if (scoreB > scoreA) {
    winnerName = STATE.agentB;
    const delta = (scoreB - scoreA).toFixed(1);
    message = `🏆 ¡${winnerName} GANA EL DUELO! (+${delta} pts de ventaja en ${stepsB} pasos)`;
  } else {
    message = `⚖️ ¡EMPATE TÉCNICO! Ambos obtuvieron exactamente la misma puntuación.`;
  }

  if (badge) badge.innerHTML = `<strong>${message}</strong>`;
  if (overlay && overlayText) {
    overlay.style.display = 'flex';
    overlayText.innerHTML = message;
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 4500);
  }
}

// Render Split Screen LunarLander
function renderDuelLander() {
  const w = duelCanvas.width;
  const h = duelCanvas.height;
  duelCtx.fillStyle = '#070913';
  duelCtx.fillRect(0, 0, w, h);

  // Divider line
  duelCtx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  duelCtx.setLineDash([6, 6]);
  duelCtx.lineWidth = 2;
  duelCtx.beginPath();
  duelCtx.moveTo(w / 2, 0);
  duelCtx.lineTo(w / 2, h);
  duelCtx.stroke();
  duelCtx.setLineDash([]);

  // Stars
  duelCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  for (let i = 0; i < 40; i++) {
    duelCtx.fillRect((i * 67) % w, (i * 43) % 280, 1.5, 1.5);
  }

  // Draw Ground Left & Right
  drawTerrainSide(duelCtx, 0, 400, duelLanderA.padX, duelLanderA.padY);
  drawTerrainSide(duelCtx, 400, 800, duelLanderB.padX, duelLanderB.padY);

  // Particles
  duelParticles.forEach(p => {
    duelCtx.save();
    duelCtx.globalAlpha = p.alpha;
    duelCtx.fillStyle = p.color;
    duelCtx.beginPath();
    duelCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    duelCtx.fill();
    duelCtx.restore();
  });

  // Draw Ships
  drawLanderShip(duelCtx, duelLanderA, '#00d2ff');
  drawLanderShip(duelCtx, duelLanderB, '#ff7b00');

  // HUD overlays
  drawLanderHudSide(duelCtx, duelLanderA, 15, 30, STATE.agentA);
  drawLanderHudSide(duelCtx, duelLanderB, 415, 30, STATE.agentB);
}

function drawTerrainSide(ctx, x1, x2, padX, padY) {
  ctx.fillStyle = '#161928';
  ctx.beginPath();
  ctx.moveTo(x1, padY + 15);
  ctx.lineTo(padX - 45, padY + 15);
  ctx.lineTo(padX - 40, padY);
  ctx.lineTo(padX + 40, padY);
  ctx.lineTo(padX + 45, padY + 15);
  ctx.lineTo(x2, padY + 15);
  ctx.lineTo(x2, 380);
  ctx.lineTo(x1, 380);
  ctx.fill();

  // Landing Pad glow line
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(padX - 40, padY);
  ctx.lineTo(padX + 40, padY);
  ctx.stroke();

  // Flags
  ctx.fillStyle = '#10b981';
  ctx.fillRect(padX - 40, padY - 14, 7, 14);
  ctx.fillRect(padX + 33, padY - 14, 7, 14);
}

function drawLanderShip(ctx, l, themeColor) {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.angle);

  // Body
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-11, -12, 22, 18);

  // Cockpit window
  ctx.fillStyle = themeColor;
  ctx.fillRect(-6, -9, 12, 5);

  // Legs
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-9, 6);
  ctx.lineTo(-16, 16);
  ctx.moveTo(9, 6);
  ctx.lineTo(16, 16);
  ctx.stroke();

  // Thruster flames
  if (l.thrust) {
    ctx.fillStyle = '#ff4500';
    ctx.beginPath();
    ctx.moveTo(-5, 6);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 18 + Math.random() * 6);
    ctx.fill();
  }
  if (l.leftThrust) {
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(-11, -3);
    ctx.lineTo(-18, -3);
    ctx.lineTo(-11, 0);
    ctx.fill();
  }
  if (l.rightThrust) {
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(11, -3);
    ctx.lineTo(18, -3);
    ctx.lineTo(11, 0);
    ctx.fill();
  }

  ctx.restore();
}

function drawLanderHudSide(ctx, l, x, y, name) {
  ctx.font = '11px JetBrains Mono';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${name.substring(0, 22)}`, x, y);
  ctx.fillText(`Puntos: ${l.score > 0 ? '+' : ''}${l.score.toFixed(1)} | Pasos: ${l.steps}`, x, y + 16);
  ctx.fillText(`Vel: ${l.vy.toFixed(2)} m/s | Alt: ${(l.padY - l.y).toFixed(0)}m`, x, y + 32);

  if (l.landed) {
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 15px Outfit';
    ctx.fillText('¡ATERRIZAJE CON ÉXITO! 🚀', x + 20, y + 80);
  } else if (l.crashed) {
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 15px Outfit';
    ctx.fillText('¡IMPACTO CRÍTICO / CRASH! 💥', x + 20, y + 80);
  }
}

// Render Split Screen Taxi-v4
function renderDuelTaxi() {
  const w = duelCanvas.width;
  const h = duelCanvas.height;
  duelCtx.fillStyle = '#0a0d18';
  duelCtx.fillRect(0, 0, w, h);

  // Center divider
  duelCtx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
  duelCtx.lineWidth = 2;
  duelCtx.setLineDash([6, 6]);
  duelCtx.beginPath();
  duelCtx.moveTo(w / 2, 0);
  duelCtx.lineTo(w / 2, h);
  duelCtx.stroke();
  duelCtx.setLineDash([]);

  // Render Left Side Taxi Grid (Player/Agent A)
  renderSingleTaxiGrid(duelCtx, duelTaxiA, 40, 40, 310, STATE.agentA);

  // Render Right Side Taxi Grid (Agent B)
  renderSingleTaxiGrid(duelCtx, duelTaxiB, 440, 40, 310, STATE.agentB);
}

function renderSingleTaxiGrid(ctx, t, startX, startY, size, agentName) {
  const cellSize = size / 5;
  const stations = [
    { row: 0, col: 0, name: 'R', color: '#ef4444' },
    { row: 0, col: 4, name: 'G', color: '#10b981' },
    { row: 4, col: 0, name: 'Y', color: '#f59e0b' },
    { row: 4, col: 3, name: 'B', color: '#3b82f6' }
  ];

  // Title / HUD
  ctx.font = '12px Outfit';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(agentName.substring(0, 24), startX, startY - 14);
  ctx.font = '11px JetBrains Mono';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Puntos: ${t.score} | Pasos: ${t.steps}`, startX + 160, startY - 14);

  // Grid background
  ctx.fillStyle = '#121626';
  ctx.fillRect(startX, startY, size, size);

  // Cells
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize);
    }
  }

  // Stations
  stations.forEach((st, idx) => {
    const sx = startX + st.col * cellSize;
    const sy = startY + st.row * cellSize;
    ctx.fillStyle = `${st.color}22`;
    ctx.fillRect(sx, sy, cellSize, cellSize);
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, sy + 2, cellSize - 4, cellSize - 4);

    ctx.fillStyle = st.color;
    ctx.font = 'bold 16px Outfit';
    ctx.fillText(st.name, sx + cellSize / 2 - 6, sy + cellSize / 2 + 6);

    // If destination
    if (idx === t.destinationIdx) {
      ctx.fillStyle = '#ffd700';
      ctx.font = '12px Outfit';
      ctx.fillText('🏁', sx + 6, sy + 18);
    }

    // If passenger waiting here
    if (idx === t.passengerIdx && !t.passengerInTaxi) {
      ctx.font = '20px Outfit';
      ctx.fillText('🙋‍♂️', sx + cellSize / 2 - 10, sy + cellSize / 2 + 10);
    }
  });

  // Taxi Walls (Gymnasium Taxi layout)
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 4;
  // Wall between (0,1)-(0,2) and (1,1)-(1,2)
  drawGridWall(ctx, startX, startY, cellSize, 0, 2, 2, 2);
  // Wall between (3,0)-(3,1) and (4,0)-(4,1)
  drawGridWall(ctx, startX, startY, cellSize, 3, 1, 5, 1);
  // Wall between (3,2)-(3,3) and (4,2)-(4,3)
  drawGridWall(ctx, startX, startY, cellSize, 3, 3, 5, 3);

  // Taxi Car Sprite
  const tx = startX + t.col * cellSize + cellSize / 2;
  const ty = startY + t.row * cellSize + cellSize / 2;
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(tx - 16, ty - 12, 32, 24);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(tx - 10, ty - 8, 20, 16);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '10px Outfit';
  ctx.fillText(t.passengerInTaxi ? '👨‍✈️' : '🚖', tx - 8, ty + 4);

  if (t.delivered) {
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px Outfit';
    ctx.fillText('¡MISIÓN CUMPLIDA! 🏁', startX + 50, startY + size / 2);
  }
}

function drawGridWall(ctx, startX, startY, cellSize, r1, c1, r2, c2) {
  ctx.beginPath();
  ctx.moveTo(startX + c1 * cellSize, startY + r1 * cellSize);
  ctx.lineTo(startX + c2 * cellSize, startY + r2 * cellSize);
  ctx.stroke();
}


// ===========================================================================
// PLAYABLE 2D SANDBOX & ARCADE LAB
// ===========================================================================
let sbCanvas, sbCtx;
let sbLander = null;
let sbTaxi = null;
let sbParticles = [];

function initSandboxArcade() {
  sbCanvas = document.getElementById('sandbox-canvas');
  if (!sbCanvas) return;
  sbCtx = sbCanvas.getContext('2d');

  // Environment Switcher Buttons
  document.getElementById('sandbox-btn-p1')?.addEventListener('click', () => {
    syncSandboxEnvButton(1);
    resetSandbox();
  });
  document.getElementById('sandbox-btn-p2')?.addEventListener('click', () => {
    syncSandboxEnvButton(2);
    resetSandbox();
  });

  // Mode Switcher Buttons (Manual vs Autopilot)
  const btnManual = document.getElementById('btn-sandbox-manual');
  const btnAuto = document.getElementById('btn-sandbox-autopilot');

  btnManual?.addEventListener('click', () => {
    btnManual.classList.add('active');
    btnAuto?.classList.remove('active');
    STATE.sandboxMode = 'manual';
  });

  btnAuto?.addEventListener('click', () => {
    btnAuto.classList.add('active');
    btnManual?.classList.remove('active');
    STATE.sandboxMode = 'autopilot';
  });

  document.getElementById('btn-sandbox-reset')?.addEventListener('click', () => {
    resetSandbox();
  });

  resetSandbox();
  requestAnimationFrame(sandboxLoop);
}

function resetSandbox() {
  sbParticles = [];

  if (STATE.sandboxEnv === 1) {
    sbLander = {
      x: 350 + (Math.random() - 0.5) * 160,
      y: 60,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.1,
      angle: (Math.random() - 0.5) * 0.3,
      thrust: false,
      leftThrust: false,
      rightThrust: false,
      landed: false,
      crashed: false,
      steps: 0,
      score: 0,
      padX: 400,
      padY: 375
    };

    document.getElementById('sb-hud-label-3').textContent = "VELOCIDAD VERTICAL";
    document.getElementById('sb-hud-label-4').textContent = "ALTITUD";
  } else {
    // Taxi Reset
    const pIdx = Math.floor(Math.random() * 4);
    let dIdx = Math.floor(Math.random() * 4);
    while (dIdx === pIdx) dIdx = Math.floor(Math.random() * 4);

    sbTaxi = {
      row: Math.floor(Math.random() * 5),
      col: Math.floor(Math.random() * 5),
      passengerIdx: pIdx,
      passengerInTaxi: false,
      destinationIdx: dIdx,
      steps: 0,
      score: 0,
      delivered: false,
      lastAiStepTime: 0
    };

    document.getElementById('sb-hud-label-3').textContent = "PASAJERO";
    document.getElementById('sb-hud-label-4').textContent = "DESTINO";
  }

  updateSandboxHud();
}

function sandboxLoop() {
  if (STATE.currentTab === 'sandbox' && sbCtx) {
    if (STATE.sandboxEnv === 1) {
      updateSandboxLander();
      renderSandboxLander();
    } else {
      updateSandboxTaxi();
      renderSandboxTaxi();
    }
  }
  requestAnimationFrame(sandboxLoop);
}

function updateSandboxLander() {
  if (!sbLander) return;

  if (!sbLander.landed && !sbLander.crashed) {
    sbLander.steps++;

    if (STATE.sandboxMode === 'manual') {
      sbLander.thrust = STATE.keys.thrust;
      sbLander.leftThrust = STATE.keys.left;
      sbLander.rightThrust = STATE.keys.right;
    } else {
      runLanderHeuristic(sbLander, sbLander.padX);
    }

    const gravity = 0.05;
    const mainThrust = 0.13;
    const rotSpeed = 0.005;

    if (sbLander.leftThrust) {
      sbLander.angle -= rotSpeed;
      sbLander.score -= 0.02;
      sbParticles.push({ x: sbLander.x - 12, y: sbLander.y, vx: 1, vy: 0, color: '#00d2ff', alpha: 1, size: 3 });
    }
    if (sbLander.rightThrust) {
      sbLander.angle += rotSpeed;
      sbLander.score -= 0.02;
      sbParticles.push({ x: sbLander.x + 12, y: sbLander.y, vx: -1, vy: 0, color: '#00d2ff', alpha: 1, size: 3 });
    }
    if (sbLander.thrust) {
      sbLander.vx += Math.sin(sbLander.angle) * mainThrust;
      sbLander.vy -= Math.cos(sbLander.angle) * mainThrust;
      sbLander.score -= 0.05;
      sbParticles.push({
        x: sbLander.x,
        y: sbLander.y + 12,
        vx: (Math.random() - 0.5) * 2,
        vy: 3 + Math.random() * 2,
        color: '#ff5500',
        alpha: 1,
        size: 3 + Math.random() * 3
      });
    }

    sbLander.vy += gravity;
    sbLander.vx *= 0.995;
    sbLander.x += sbLander.vx;
    sbLander.y += sbLander.vy;

    // Boundary bounce
    if (sbLander.x < 20) { sbLander.x = 20; sbLander.vx = Math.abs(sbLander.vx) * 0.5; }
    if (sbLander.x > 780) { sbLander.x = 780; sbLander.vx = -Math.abs(sbLander.vx) * 0.5; }

    // Distance shaping reward
    const dist = Math.abs(sbLander.x - sbLander.padX);
    sbLander.score += (400 - dist) * 0.002;

    // Ground touchdown check
    if (sbLander.y >= sbLander.padY) {
      sbLander.y = sbLander.padY;
      const padMargin = 55;
      const onPad = Math.abs(sbLander.x - sbLander.padX) <= padMargin;
      const safeVy = sbLander.vy < 1.6;
      const safeVx = Math.abs(sbLander.vx) < 1.0;
      const safeAngle = Math.abs(sbLander.angle) < 0.28;

      if (onPad && safeVy && safeVx && safeAngle) {
        sbLander.landed = true;
        sbLander.score += 100;
        for (let i = 0; i < 30; i++) {
          sbParticles.push({
            x: sbLander.x,
            y: sbLander.y,
            vx: (Math.random() - 0.5) * 5,
            vy: -Math.random() * 4,
            color: '#10b981',
            alpha: 1,
            size: 3
          });
        }
      } else {
        sbLander.crashed = true;
        sbLander.score -= 100;
        for (let i = 0; i < 40; i++) {
          sbParticles.push({
            x: sbLander.x,
            y: sbLander.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            color: '#f43f5e',
            alpha: 1,
            size: 4
          });
        }
      }
    }
  }

  // Update particles
  sbParticles = sbParticles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.025;
    return p.alpha > 0;
  });

  updateSandboxHud();
}

function renderSandboxLander() {
  const w = sbCanvas.width;
  const h = sbCanvas.height;
  sbCtx.fillStyle = '#070912';
  sbCtx.fillRect(0, 0, w, h);

  // Stars
  sbCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let i = 0; i < 50; i++) {
    sbCtx.fillRect((i * 97) % w, (i * 61) % 320, 1.5, 1.5);
  }

  // Moon Surface with craters
  sbCtx.fillStyle = '#181c2e';
  sbCtx.beginPath();
  sbCtx.moveTo(0, 390);
  sbCtx.lineTo(330, 390);
  sbCtx.lineTo(345, sbLander.padY);
  sbCtx.lineTo(455, sbLander.padY);
  sbCtx.lineTo(470, 390);
  sbCtx.lineTo(w, 390);
  sbCtx.lineTo(w, h);
  sbCtx.lineTo(0, h);
  sbCtx.fill();

  // Landing Pad & Runway lights
  sbCtx.strokeStyle = '#ffd700';
  sbCtx.lineWidth = 4;
  sbCtx.beginPath();
  sbCtx.moveTo(345, sbLander.padY);
  sbCtx.lineTo(455, sbLander.padY);
  sbCtx.stroke();

  // Flags
  sbCtx.fillStyle = '#10b981';
  sbCtx.fillRect(345, sbLander.padY - 18, 10, 18);
  sbCtx.fillRect(445, sbLander.padY - 18, 10, 18);

  // Particles
  sbParticles.forEach(p => {
    sbCtx.save();
    sbCtx.globalAlpha = p.alpha;
    sbCtx.fillStyle = p.color;
    sbCtx.beginPath();
    sbCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    sbCtx.fill();
    sbCtx.restore();
  });

  // Lander Ship
  drawLanderShip(sbCtx, sbLander, '#00f0ff');

  // Victory / Crash text overlay
  if (sbLander.landed) {
    sbCtx.fillStyle = '#10b981';
    sbCtx.font = 'bold 24px Outfit';
    sbCtx.fillText('¡ATERRIZAJE PERFECTO! (+100 PTS) 🏆', 210, 200);
  } else if (sbLander.crashed) {
    sbCtx.fillStyle = '#f43f5e';
    sbCtx.font = 'bold 24px Outfit';
    sbCtx.fillText('¡CRASH / IMPACTO DEMASIADO FUERTE! (-100 PTS) 💥', 140, 200);
  }
}

function updateSandboxTaxi() {
  if (!sbTaxi) return;

  // If in autopilot mode, advance every 280ms
  if (STATE.sandboxMode === 'autopilot' && !sbTaxi.delivered) {
    const now = Date.now();
    if (now - sbTaxi.lastAiStepTime > 280) {
      sbTaxi.lastAiStepTime = now;
      const act = getOptimalTaxiAction(sbTaxi);
      executeTaxiStep(sbTaxi, act);
    }
  }

  updateSandboxHud();
}

function renderSandboxTaxi() {
  const w = sbCanvas.width;
  const h = sbCanvas.height;
  sbCtx.fillStyle = '#080a14';
  sbCtx.fillRect(0, 0, w, h);

  // Render centered 5x5 Taxi grid
  const gridSize = 340;
  const startX = (w - gridSize) / 2;
  const startY = 35;
  renderSingleTaxiGrid(sbCtx, sbTaxi, startX, startY, gridSize, 'Práctica 2: Taxi-v4');
}

function updateSandboxHud() {
  const scoreElem = document.getElementById('sb-hud-score');
  const stepsElem = document.getElementById('sb-hud-steps');
  const val3Elem = document.getElementById('sb-hud-val-3');
  const val4Elem = document.getElementById('sb-hud-val-4');
  const statusElem = document.getElementById('sb-hud-status');

  if (STATE.sandboxEnv === 1 && sbLander) {
    if (scoreElem) scoreElem.textContent = `${sbLander.score > 0 ? '+' : ''}${sbLander.score.toFixed(1)} pts`;
    if (stepsElem) stepsElem.textContent = `${sbLander.steps} st`;
    if (val3Elem) val3Elem.textContent = `${sbLander.vy.toFixed(2)} m/s`;
    if (val4Elem) val4Elem.textContent = `${Math.max(0, (sbLander.padY - sbLander.y)).toFixed(0)} m`;
    if (statusElem) {
      if (sbLander.landed) {
        statusElem.textContent = "ATERRIZADO 🏆";
        statusElem.style.color = "#10b981";
      } else if (sbLander.crashed) {
        statusElem.textContent = "CRASH 💥";
        statusElem.style.color = "#f43f5e";
      } else {
        statusElem.textContent = "EN VUELO 🚀";
        statusElem.style.color = "#00f0ff";
      }
    }
  } else if (STATE.sandboxEnv === 2 && sbTaxi) {
    const stations = ['R (Rojo)', 'G (Verde)', 'Y (Amarillo)', 'B (Azul)'];
    if (scoreElem) scoreElem.textContent = `${sbTaxi.score} pts`;
    if (stepsElem) stepsElem.textContent = `${sbTaxi.steps} st`;
    if (val3Elem) val3Elem.textContent = sbTaxi.passengerInTaxi ? "A bordo 👨‍✈️" : stations[sbTaxi.passengerIdx];
    if (val4Elem) val4Elem.textContent = stations[sbTaxi.destinationIdx];
    if (statusElem) {
      if (sbTaxi.delivered) {
        statusElem.textContent = "ENTREGADO 🏁";
        statusElem.style.color = "#10b981";
      } else if (sbTaxi.passengerInTaxi) {
        statusElem.textContent = "HACIA DESTINO 🚕";
        statusElem.style.color = "#3b82f6";
      } else {
        statusElem.textContent = "A POR PASAJERO 🙋‍♂️";
        statusElem.style.color = "#f59e0b";
      }
    }
  }
}

// Taxi action handler for manual inputs
function handleTaxiAction(act) {
  if (STATE.sandboxEnv !== 2 || !sbTaxi || sbTaxi.delivered) return;
  executeTaxiStep(sbTaxi, act);
  updateSandboxHud();
}

function executeTaxiStep(taxi, act) {
  if (taxi.delivered) return;
  taxi.steps++;

  const stations = [
    { row: 0, col: 0 },
    { row: 0, col: 4 },
    { row: 4, col: 0 },
    { row: 4, col: 3 }
  ];

  // Walls dictionary
  const hasWall = (r1, c1, r2, c2) => {
    if (r2 < 0 || r2 > 4 || c2 < 0 || c2 > 4) return true;
    // Between col 1 and 2 in rows 0-1
    if ((c1 === 1 && c2 === 2) || (c1 === 2 && c2 === 1)) {
      if (r1 === 0 || r1 === 1) return true;
    }
    // Between col 0 and 1 in rows 3-4
    if ((c1 === 0 && c2 === 1) || (c1 === 1 && c2 === 0)) {
      if (r1 === 3 || r1 === 4) return true;
    }
    // Between col 2 and 3 in rows 3-4
    if ((c1 === 2 && c2 === 3) || (c1 === 3 && c2 === 2)) {
      if (r1 === 3 || r1 === 4) return true;
    }
    return false;
  };

  if (act === 'up') {
    if (!hasWall(taxi.row, taxi.col, taxi.row - 1, taxi.col)) taxi.row--;
    taxi.score -= 1;
  } else if (act === 'down') {
    if (!hasWall(taxi.row, taxi.col, taxi.row + 1, taxi.col)) taxi.row++;
    taxi.score -= 1;
  } else if (act === 'left') {
    if (!hasWall(taxi.row, taxi.col, taxi.row, taxi.col - 1)) taxi.col--;
    taxi.score -= 1;
  } else if (act === 'right') {
    if (!hasWall(taxi.row, taxi.col, taxi.row, taxi.col + 1)) taxi.col++;
    taxi.score -= 1;
  } else if (act === 'pickup') {
    const pSt = stations[taxi.passengerIdx];
    if (!taxi.passengerInTaxi && taxi.row === pSt.row && taxi.col === pSt.col) {
      taxi.passengerInTaxi = true;
      taxi.score -= 1;
    } else {
      taxi.score -= 10; // Illegal pickup
    }
  } else if (act === 'dropoff') {
    const dSt = stations[taxi.destinationIdx];
    if (taxi.passengerInTaxi && taxi.row === dSt.row && taxi.col === dSt.col) {
      taxi.passengerInTaxi = false;
      taxi.delivered = true;
      taxi.score += 20; // Delivery success reward
    } else {
      taxi.score -= 10; // Illegal dropoff
    }
  }
}

// BFS shortest path policy for AI Taxi
function getOptimalTaxiAction(taxi) {
  const stations = [
    { row: 0, col: 0 },
    { row: 0, col: 4 },
    { row: 4, col: 0 },
    { row: 4, col: 3 }
  ];

  const target = taxi.passengerInTaxi ? stations[taxi.destinationIdx] : stations[taxi.passengerIdx];

  if (taxi.row === target.row && taxi.col === target.col) {
    return taxi.passengerInTaxi ? 'dropoff' : 'pickup';
  }

  // BFS to target
  const queue = [{ r: taxi.row, c: taxi.col, firstAct: null }];
  const visited = new Set();
  visited.add(`${taxi.row},${taxi.col}`);

  const moves = [
    { act: 'up', dr: -1, dc: 0 },
    { act: 'down', dr: 1, dc: 0 },
    { act: 'left', dr: 0, dc: -1 },
    { act: 'right', dr: 0, dc: 1 }
  ];

  const hasWall = (r1, c1, r2, c2) => {
    if (r2 < 0 || r2 > 4 || c2 < 0 || c2 > 4) return true;
    if ((c1 === 1 && c2 === 2) || (c1 === 2 && c2 === 1)) {
      if (r1 === 0 || r1 === 1) return true;
    }
    if ((c1 === 0 && c2 === 1) || (c1 === 1 && c2 === 0)) {
      if (r1 === 3 || r1 === 4) return true;
    }
    if ((c1 === 2 && c2 === 3) || (c1 === 3 && c2 === 2)) {
      if (r1 === 3 || r1 === 4) return true;
    }
    return false;
  };

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr.r === target.row && curr.c === target.col) {
      return curr.firstAct || 'pickup';
    }

    for (const m of moves) {
      const nr = curr.r + m.dr;
      const nc = curr.c + m.dc;
      const key = `${nr},${nc}`;
      if (!visited.has(key) && !hasWall(curr.r, curr.c, nr, nc)) {
        visited.add(key);
        queue.push({
          r: nr,
          c: nc,
          firstAct: curr.firstAct === null ? m.act : curr.firstAct
        });
      }
    }
  }

  return 'down';
}
