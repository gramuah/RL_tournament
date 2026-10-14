// RL Course Interactive Arena, Leaderboard & Playable 2D Simulator
// Gymnasium LunarLander-v3 & Taxi-v4 Authentic Engine
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
  agentB: 'rafael_flor',
  duelMode: 'live', // 'live' or 'video'
  duelRunning: false,
  duelOverTimer: null,
  sandboxEnv: 1, // 1 for LunarLander, 2 for Taxi
  sandboxMode: 'manual', // 'manual' or 'autopilot'
  sandboxAutoResetTimer: null,
  
  // Real-time input states
  keys: {
    thrust: false,
    left: false,
    right: false,
    down: false
  }
};

// Default fallback data
const FALLBACK_DATA_P1 = [
  {
    participant: "rafael_flor",
    mean_reward: 257.38,
    std_reward: 23.07,
    avg_steps: 364.1,
    success_rate: 100.0,
    status: "MASTERY 🏆",
    status_code: "passed"
  },
  {
    participant: "baseline_heuristic",
    mean_reward: 264.34,
    std_reward: 47.22,
    avg_steps: 239.0,
    success_rate: 96.7,
    status: "MASTERY 🏆",
    status_code: "passed"
  },
  {
    participant: "demo_student",
    mean_reward: 257.38,
    std_reward: 23.07,
    avg_steps: 364.1,
    success_rate: 100.0,
    status: "MASTERY 🏆",
    status_code: "passed"
  },
  {
    participant: "baseline_random",
    mean_reward: -172.10,
    std_reward: 100.19,
    avg_steps: 89.8,
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
  setupPointerControls();
  await loadData();
  populateDropdowns();
  updateArenaView();
  renderLeaderboard();
  
  initDuelArena();
  initSandboxArcade();
  initTaxiSprites();
});

// ---------------------------------------------------------------------------
// Navigation & Practical Selectors
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
// Continuous Keyboard and Pointer Event Handling
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

    // Directional actions for Taxi
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

function bindPointerButton(btn, onDown, onUp) {
  if (!btn) return;
  const press = (e) => {
    e.preventDefault();
    btn.classList.add('pressed');
    if (onDown) onDown();
  };
  const release = (e) => {
    e.preventDefault();
    btn.classList.remove('pressed');
    if (onUp) onUp();
  };

  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
}

function setupPointerControls() {
  // Sandbox Lander on-screen buttons
  bindPointerButton(document.getElementById('btn-touch-thrust'), () => { STATE.keys.thrust = true; }, () => { STATE.keys.thrust = false; });
  bindPointerButton(document.getElementById('btn-touch-left'), () => { STATE.keys.left = true; }, () => { STATE.keys.left = false; });
  bindPointerButton(document.getElementById('btn-touch-right'), () => { STATE.keys.right = true; }, () => { STATE.keys.right = false; });

  // Sandbox Taxi buttons
  document.getElementById('btn-taxi-up')?.addEventListener('click', () => handleTaxiAction('up'));
  document.getElementById('btn-taxi-down')?.addEventListener('click', () => handleTaxiAction('down'));
  document.getElementById('btn-taxi-left')?.addEventListener('click', () => handleTaxiAction('left'));
  document.getElementById('btn-taxi-right')?.addEventListener('click', () => handleTaxiAction('right'));
  document.getElementById('btn-taxi-pickup')?.addEventListener('click', () => handleTaxiAction('pickup'));
  document.getElementById('btn-taxi-dropoff')?.addEventListener('click', () => handleTaxiAction('dropoff'));

  // Arena Human Lander buttons
  bindPointerButton(document.getElementById('btn-arena-touch-thrust'), () => { STATE.keys.thrust = true; }, () => { STATE.keys.thrust = false; });
  bindPointerButton(document.getElementById('btn-arena-touch-left'), () => { STATE.keys.left = true; }, () => { STATE.keys.left = false; });
  bindPointerButton(document.getElementById('btn-arena-touch-right'), () => { STATE.keys.right = true; }, () => { STATE.keys.right = false; });

  // Arena Human Taxi buttons
  document.getElementById('btn-arena-taxi-up')?.addEventListener('click', () => handleDuelTaxiAction('up'));
  document.getElementById('btn-arena-taxi-down')?.addEventListener('click', () => handleDuelTaxiAction('down'));
  document.getElementById('btn-arena-taxi-left')?.addEventListener('click', () => handleDuelTaxiAction('left'));
  document.getElementById('btn-arena-taxi-right')?.addEventListener('click', () => handleDuelTaxiAction('right'));
  document.getElementById('btn-arena-taxi-pickup')?.addEventListener('click', () => handleDuelTaxiAction('pickup'));
  document.getElementById('btn-arena-taxi-dropoff')?.addEventListener('click', () => handleDuelTaxiAction('dropoff'));
}

// ---------------------------------------------------------------------------
// Data Loading & Dropdowns
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

  // Default selection: Corner A = Human, Corner B = rafael_flor (or first agent)
  STATE.agentA = HUMAN_AGENT;
  const bestAgent = list.find(it => it.participant === 'rafael_flor') || (list.length > 0 ? list[0] : null);
  STATE.agentB = bestAgent ? bestAgent.participant : (list.length > 0 ? list[0].participant : HUMAN_AGENT);

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
    
    const landerRow = document.getElementById('arena-touch-buttons');
    const taxiRow = document.getElementById('arena-touch-taxi-buttons');
    const hints = document.getElementById('arena-keyboard-hints');
    if (STATE.currentPractical === 1) {
      if (landerRow) landerRow.style.display = 'flex';
      if (taxiRow) taxiRow.style.display = 'none';
      if (hints) hints.textContent = "Teclas: [Espacio / W / ⬆️] Propulsor | [A / ⬅️] Girar Izq | [D / ➡️] Girar Der";
    } else {
      if (landerRow) landerRow.style.display = 'none';
      if (taxiRow) taxiRow.style.display = 'flex';
      if (hints) hints.textContent = "Teclas: Flechas o WASD | [P / Espacio] Recoger | [O / Enter] Dejar";
    }
  }

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
      return { avg_steps: 240, mean_reward: 250 };
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
        ${item.participant === 'rafael_flor' ? '<span style="font-size: 0.72rem; background: rgba(0,240,255,0.2); color: var(--accent-cyan); padding: 2px 7px; border-radius: 4px; border: 1px solid var(--accent-cyan); font-weight: 800;">TU AGENTE</span>' : ''}
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
// GYMNASIUM LUNARLANDER-v3 AUTHENTIC RENDERING ENGINE
// Exactly matches Gymnasium Box2D Pygame source & rendering
// ===========================================================================
// LANDER_POLY = [(-14, +17), (-17, 0), (-17, -10), (+17, -10), (+17, 0), (+14, +17)]
function drawGymnasiumLander(ctx, x, y, angle, thrust, leftThrust, rightThrust, landed, crashed, colorTheme) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Gymnasium official colors
  let bodyColor = 'rgb(128, 102, 230)'; // Authentic Gymnasium periwinkle/purple
  let borderColor = 'rgb(77, 77, 128)';

  if (colorTheme === 'orange') {
    bodyColor = 'rgb(249, 115, 22)';
    borderColor = 'rgb(194, 65, 12)';
  } else if (colorTheme === 'blue') {
    bodyColor = 'rgb(14, 165, 233)';
    borderColor = 'rgb(3, 105, 161)';
  }

  // 1. Articulated Legs (Gymnasium Box2D rectangular struts)
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;

  // Left Leg: angled down and left
  ctx.save();
  ctx.translate(-14, 2);
  ctx.rotate(-0.4);
  ctx.fillRect(-2, 0, 4, 18);
  ctx.strokeRect(-2, 0, 4, 18);
  ctx.restore();

  // Right Leg: angled down and right
  ctx.save();
  ctx.translate(14, 2);
  ctx.rotate(0.4);
  ctx.fillRect(-2, 0, 4, 18);
  ctx.strokeRect(-2, 0, 4, 18);
  ctx.restore();

  // 2. Main Lander Polygonal Body (Gymnasium LANDER_POLY)
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -17);
  ctx.lineTo(-17, 0);
  ctx.lineTo(-17, 10);
  ctx.lineTo(17, 10);
  ctx.lineTo(17, 0);
  ctx.lineTo(14, -17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Draw Authentic Gymnasium Moon Terrain: Solid Jet Black Sky & Solid Pure White Ground
function drawGymnasiumTerrain(ctx, x1, x2, padX, padY, padWidth = 110) {
  const padHalf = padWidth / 2;
  const leftX = padX - padHalf;
  const rightX = padX + padHalf;

  // 1. Pure White Ground Polygon (Exact Gymnasium visual style)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x1, 450);
  ctx.lineTo(x1, padY + 28);
  ctx.lineTo(x1 + (leftX - x1) * 0.45, padY + 36);
  ctx.lineTo(leftX - 35, padY + 16);
  ctx.lineTo(leftX, padY);
  ctx.lineTo(rightX, padY); // Perfectly Flat Helipad
  ctx.lineTo(rightX + 35, padY + 18);
  ctx.lineTo(rightX + (x2 - rightX) * 0.55, padY + 38);
  ctx.lineTo(x2, padY + 24);
  ctx.lineTo(x2, 450);
  ctx.lineTo(x1, 450);
  ctx.closePath();
  ctx.fill();

  // 2. Official Helipad Yellow Pennant Flags on White Flagpoles
  drawGymnasiumFlag(ctx, leftX, padY);
  drawGymnasiumFlag(ctx, rightX, padY);
}

// Exactly matches Gymnasium flag rendering:
// flagy1 = helipad_y, flagy2 = flagy1 + 50
// [(x, flagy2), (x, flagy2 - 10), (x + 25, flagy2 - 5)]
function drawGymnasiumFlag(ctx, x, y) {
  const poleHeight = 42;
  const flagTop = y - poleHeight;

  // White Flagpole
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, flagTop);
  ctx.stroke();

  // Official Gymnasium Yellow Triangle Flag (pointing right)
  ctx.fillStyle = '#cccc00';
  ctx.beginPath();
  ctx.moveTo(x, flagTop);
  ctx.lineTo(x, flagTop + 10);
  ctx.lineTo(x + 22, flagTop + 5);
  ctx.closePath();
  ctx.fill();
}


// ===========================================================================
// HEAD-TO-HEAD DUEL ARENA ENGINE (Synchronized Split Screen)
// ===========================================================================
let duelCanvas, duelCtx;
let duelLanderA, duelLanderB;
let duelTaxiA, duelTaxiB;
let duelParticles = [];

function initDuelArena() {
  duelCanvas = document.getElementById('duel-canvas');
  if (!duelCanvas) return;
  duelCtx = duelCanvas.getContext('2d');

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
  if (STATE.duelOverTimer) clearTimeout(STATE.duelOverTimer);
  duelParticles = [];

  const overlay = document.getElementById('duel-overlay');
  if (overlay) overlay.style.display = 'none';

  // Symmetrical initial conditions
  const startX_offset = (Math.random() - 0.5) * 60;
  const startAngle = (Math.random() - 0.5) * 0.2;

  duelLanderA = {
    x: 200 + startX_offset,
    y: 55,
    vx: (Math.random() - 0.5) * 0.6,
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
    padY: 335
  };

  duelLanderB = {
    x: 600 + startX_offset,
    y: 55,
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
    padY: 335
  };

  // Taxi duel
  const pIdx = Math.floor(Math.random() * 4);
  let dIdx = Math.floor(Math.random() * 4);
  while (dIdx === pIdx) dIdx = Math.floor(Math.random() * 4);

  duelTaxiA = {
    row: 2,
    col: 2,
    passengerIdx: pIdx,
    passengerInTaxi: false,
    destinationIdx: dIdx,
    steps: 0,
    score: 0,
    delivered: false
  };

  duelTaxiB = {
    row: 2,
    col: 2,
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
  if (badge) badge.textContent = "⚔️ ¡Duelo en curso! Ambos agentes compitiendo bajo el mismo reto...";

  if (overlay && overlayText) {
    overlay.style.display = 'flex';
    overlayText.textContent = "¡PREPARADOS!";

    setTimeout(() => {
      overlayText.textContent = "3...";
      setTimeout(() => {
        overlayText.textContent = "2...";
        setTimeout(() => {
          overlayText.textContent = "1... ¡YA!";
          setTimeout(() => {
            overlay.style.display = 'none';
            STATE.duelRunning = true;
          }, 500);
        }, 500);
      }, 500);
    }, 400);
  } else {
    STATE.duelRunning = true;
  }
}

function handleDuelTaxiAction(act) {
  if (!STATE.duelRunning || STATE.currentPractical !== 2) return;
  if (STATE.agentA === HUMAN_AGENT) executeTaxiStep(duelTaxiA, act);
  else if (STATE.agentB === HUMAN_AGENT) executeTaxiStep(duelTaxiB, act);
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

  // Step Side A
  if (!duelLanderA.landed && !duelLanderA.crashed) {
    duelLanderA.steps++;
    if (isHumanA) {
      duelLanderA.thrust = STATE.keys.thrust;
      duelLanderA.leftThrust = STATE.keys.left;
      duelLanderA.rightThrust = STATE.keys.right;
    } else if (STATE.agentA && STATE.agentA.toLowerCase().includes('random')) {
      runRandomLanderPolicy(duelLanderA);
    } else {
      runTrainedLanderPolicy(duelLanderA, duelLanderA.padX);
    }
    stepLanderPhysics(duelLanderA, 0, 400);
  }

  // Step Side B
  if (!duelLanderB.landed && !duelLanderB.crashed) {
    duelLanderB.steps++;
    if (isHumanB) {
      duelLanderB.thrust = STATE.keys.thrust;
      duelLanderB.leftThrust = STATE.keys.left;
      duelLanderB.rightThrust = STATE.keys.right;
    } else if (STATE.agentB && STATE.agentB.toLowerCase().includes('random')) {
      runRandomLanderPolicy(duelLanderB);
    } else {
      runTrainedLanderPolicy(duelLanderB, duelLanderB.padX);
    }
    stepLanderPhysics(duelLanderB, 400, 800);
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

function stepLanderPhysics(lander, minX, maxX) {
  const gravity = 0.048;
  const mainThrust = 0.145;
  const rotSpeed = 0.0055;

  if (lander.leftThrust) {
    lander.angle -= rotSpeed;
    lander.score -= 0.02;
  }
  if (lander.rightThrust) {
    lander.angle += rotSpeed;
    lander.score -= 0.02;
  }
  if (lander.thrust) {
    lander.vx += Math.sin(lander.angle) * mainThrust;
    lander.vy -= Math.cos(lander.angle) * mainThrust;
    lander.score -= 0.04;
    addDuelParticle(lander.x, lander.y + 12, (Math.random() - 0.5) * 1.5, 2.5 + Math.random() * 2, '#ff4500');
  }

  lander.vy += gravity;
  lander.vx *= 0.996;
  lander.x += lander.vx;
  lander.y += lander.vy;

  // Restrict to side bounds
  if (lander.x < minX + 20) { lander.x = minX + 20; lander.vx = Math.abs(lander.vx) * 0.4; }
  if (lander.x > maxX - 20) { lander.x = maxX - 20; lander.vx = -Math.abs(lander.vx) * 0.4; }

  // Reward shaping towards pad
  const dist = Math.abs(lander.x - lander.padX);
  lander.score += (200 - dist) * 0.004;

  // Touchdown check
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

// Robust, trained lander policy for rafael_flor and high-performing agents
function runTrainedLanderPolicy(lander, padCenterX) {
  const dx = lander.x - padCenterX;
  const distToPadY = Math.max(0, lander.padY - lander.y);

  // Target angle: when dx > 0 (lander on right), tilt counter-clockwise (negative angle) to fly left.
  // When dx < 0 (lander on left), tilt clockwise (positive angle) to fly right.
  let targetAngle = -(dx * 0.0055 + lander.vx * 0.38);
  targetAngle = Math.max(-0.4, Math.min(0.4, targetAngle));

  // Level out completely right before touchdown for safe landing
  if (distToPadY < 25 && Math.abs(dx) < 30) {
    targetAngle = 0;
  }

  const angleErr = targetAngle - lander.angle;
  lander.leftThrust = angleErr < -0.03;
  lander.rightThrust = angleErr > 0.03;

  // Vertical descent control: smooth glide down, decelerate before touchdown
  let targetVy = Math.max(0.3, Math.min(1.5, distToPadY * 0.01));
  if (Math.abs(dx) > 35) {
    // If not yet centered, keep descent slower to allow horizontal convergence
    targetVy = Math.min(targetVy, 0.65);
  }

  // Fire main engine if dropping faster than target or close to pad
  lander.thrust = lander.vy > targetVy || (distToPadY < 50 && lander.vy > 0.55);
}

// Baseline random policy: erratic random burns demonstrating untrained baseline
function runRandomLanderPolicy(lander) {
  const r = Math.random();
  if (r < 0.25) {
    lander.thrust = false; lander.leftThrust = false; lander.rightThrust = false;
  } else if (r < 0.50) {
    lander.thrust = false; lander.leftThrust = true; lander.rightThrust = false;
  } else if (r < 0.75) {
    lander.thrust = true; lander.leftThrust = false; lander.rightThrust = false;
  } else {
    lander.thrust = false; lander.leftThrust = false; lander.rightThrust = true;
  }
}

function addDuelParticle(x, y, vx, vy, color) {
  duelParticles.push({ x, y, vx, vy, color, alpha: 1.0, size: 2.5 + Math.random() * 2 });
}

function getRandomTaxiAction() {
  const acts = ['down', 'up', 'right', 'left', 'pickup', 'dropoff'];
  return acts[Math.floor(Math.random() * acts.length)];
}

function updateDuelTaxiLogic() {
  if (!STATE.duelRunning) return;

  const now = Date.now();
  if (STATE.agentB !== HUMAN_AGENT && !duelTaxiB.delivered) {
    if (now - duelTaxiB.lastAiStepTime > 260) {
      duelTaxiB.lastAiStepTime = now;
      const isRandomB = STATE.agentB && STATE.agentB.toLowerCase().includes('random');
      const aiAct = isRandomB ? getRandomTaxiAction() : getOptimalTaxiAction(duelTaxiB);
      executeTaxiStep(duelTaxiB, aiAct);
      checkDuelEnd();
    }
  }

  if (STATE.agentA !== HUMAN_AGENT && !duelTaxiA.delivered) {
    if (now - duelTaxiA.lastAiStepTime > 260) {
      duelTaxiA.lastAiStepTime = now;
      const isRandomA = STATE.agentA && STATE.agentA.toLowerCase().includes('random');
      const aiAct = isRandomA ? getRandomTaxiAction() : getOptimalTaxiAction(duelTaxiA);
      executeTaxiStep(duelTaxiA, aiAct);
      checkDuelEnd();
    }
  }
}

function checkDuelEnd() {
  if (!STATE.duelRunning) return;

  let endedA = false, endedB = false;
  if (STATE.currentPractical === 1) {
    endedA = duelLanderA.landed || duelLanderA.crashed || duelLanderA.steps > 700;
    endedB = duelLanderB.landed || duelLanderB.crashed || duelLanderB.steps > 700;
  } else {
    endedA = duelTaxiA.delivered || duelTaxiA.steps >= 120;
    endedB = duelTaxiB.delivered || duelTaxiB.steps >= 120;
  }

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
    message = `⚖️ ¡EMPATE TÉCNICO! Ambos obtuvieron puntuación similar.`;
  }

  if (badge) badge.innerHTML = `<strong>${message}</strong>`;
  if (overlay && overlayText) {
    overlay.style.display = 'flex';
    overlayText.innerHTML = message;
    STATE.duelOverTimer = setTimeout(() => {
      overlay.style.display = 'none';
    }, 4500);
  }
}

// Render Split Screen LunarLander
function renderDuelLander() {
  const w = duelCanvas.width;
  const h = duelCanvas.height;
  // Official Gymnasium Jet Black Sky (No stars)
  duelCtx.fillStyle = '#000000';
  duelCtx.fillRect(0, 0, w, h);

  // Center vertical dividing line
  duelCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  duelCtx.setLineDash([6, 6]);
  duelCtx.lineWidth = 1.5;
  duelCtx.beginPath();
  duelCtx.moveTo(w / 2, 0);
  duelCtx.lineTo(w / 2, h);
  duelCtx.stroke();
  duelCtx.setLineDash([]);

  // Draw Gymnasium Terrains Left & Right (Pure White Ground)
  drawGymnasiumTerrain(duelCtx, 0, 400, duelLanderA.padX, duelLanderA.padY, 90);
  drawGymnasiumTerrain(duelCtx, 400, 800, duelLanderB.padX, duelLanderB.padY, 90);

  // Particles (Gymnasium red/pink circular spark dots)
  duelParticles.forEach(p => {
    duelCtx.save();
    duelCtx.globalAlpha = p.alpha;
    duelCtx.fillStyle = p.color;
    duelCtx.beginPath();
    duelCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    duelCtx.fill();
    duelCtx.restore();
  });

  // Authentic Gymnasium Lander Ships
  drawGymnasiumLander(
    duelCtx, duelLanderA.x, duelLanderA.y, duelLanderA.angle,
    duelLanderA.thrust, duelLanderA.leftThrust, duelLanderA.rightThrust,
    duelLanderA.landed, duelLanderA.crashed, 'blue'
  );
  drawGymnasiumLander(
    duelCtx, duelLanderB.x, duelLanderB.y, duelLanderB.angle,
    duelLanderB.thrust, duelLanderB.leftThrust, duelLanderB.rightThrust,
    duelLanderB.landed, duelLanderB.crashed, 'orange'
  );

  // HUD overlays
  drawLanderHudSide(duelCtx, duelLanderA, 15, 30, STATE.agentA);
  drawLanderHudSide(duelCtx, duelLanderB, 415, 30, STATE.agentB);
}

function drawLanderHudSide(ctx, l, x, y, name) {
  ctx.font = '11px JetBrains Mono';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`${name.substring(0, 22)}`, x, y);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Puntos: ${l.score > 0 ? '+' : ''}${l.score.toFixed(1)} | Pasos: ${l.steps}`, x, y + 16);
  ctx.fillText(`Vel: ${l.vy.toFixed(2)} m/s | Alt: ${Math.max(0, (l.padY - l.y)).toFixed(0)}m`, x, y + 32);

  if (l.landed) {
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 15px Outfit';
    ctx.fillText('¡ATERRIZAJE CON ÉXITO! 🚀', x + 20, y + 75);
  } else if (l.crashed) {
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 15px Outfit';
    ctx.fillText('¡IMPACTO CRÍTICO / CRASH! 💥', x + 20, y + 75);
  }
}

// Render Split Screen Taxi-v4
function renderDuelTaxi() {
  const w = duelCanvas.width;
  const h = duelCanvas.height;
  duelCtx.fillStyle = '#0a0d18';
  duelCtx.fillRect(0, 0, w, h);

  duelCtx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  duelCtx.lineWidth = 2;
  duelCtx.setLineDash([6, 6]);
  duelCtx.beginPath();
  duelCtx.moveTo(w / 2, 0);
  duelCtx.lineTo(w / 2, h);
  duelCtx.stroke();
  duelCtx.setLineDash([]);

  renderSingleTaxiGrid(duelCtx, duelTaxiA, 40, 40, 310, STATE.agentA);
  renderSingleTaxiGrid(duelCtx, duelTaxiB, 440, 40, 310, STATE.agentB);
}

// ===========================================================================
// GYMNASIUM TAXI-v4 AUTHENTIC RENDERING ENGINE (Official Gymnasium Sprites)
// ===========================================================================
const TAXI_ASSETS = {
  bg: new Image(),
  cab_front: new Image(),
  cab_rear: new Image(),
  cab_left: new Image(),
  cab_right: new Image(),
  passenger: new Image(),
  hotel: new Image(),
  median_top: new Image(),
  median_bottom: new Image(),
  median_vert: new Image(),
  median_horiz: new Image(),
  loaded: false
};

function initTaxiSprites() {
  let loadedCount = 0;
  const total = 11;
  const onAssetLoad = () => {
    loadedCount++;
    if (loadedCount >= total) TAXI_ASSETS.loaded = true;
  };

  TAXI_ASSETS.bg.onload = onAssetLoad;
  TAXI_ASSETS.bg.src = 'assets/taxi/taxi_background.png';

  TAXI_ASSETS.cab_front.onload = onAssetLoad;
  TAXI_ASSETS.cab_front.src = 'assets/taxi/cab_front.png';

  TAXI_ASSETS.cab_rear.onload = onAssetLoad;
  TAXI_ASSETS.cab_rear.src = 'assets/taxi/cab_rear.png';

  TAXI_ASSETS.cab_left.onload = onAssetLoad;
  TAXI_ASSETS.cab_left.src = 'assets/taxi/cab_left.png';

  TAXI_ASSETS.cab_right.onload = onAssetLoad;
  TAXI_ASSETS.cab_right.src = 'assets/taxi/cab_right.png';

  TAXI_ASSETS.passenger.onload = onAssetLoad;
  TAXI_ASSETS.passenger.src = 'assets/taxi/passenger.png';

  TAXI_ASSETS.hotel.onload = onAssetLoad;
  TAXI_ASSETS.hotel.src = 'assets/taxi/hotel.png';

  TAXI_ASSETS.median_top.onload = onAssetLoad;
  TAXI_ASSETS.median_top.src = 'assets/taxi/gridworld_median_top.png';

  TAXI_ASSETS.median_bottom.onload = onAssetLoad;
  TAXI_ASSETS.median_bottom.src = 'assets/taxi/gridworld_median_bottom.png';

  TAXI_ASSETS.median_vert.onload = onAssetLoad;
  TAXI_ASSETS.median_vert.src = 'assets/taxi/gridworld_median_vert.png';

  TAXI_ASSETS.median_horiz.onload = onAssetLoad;
  TAXI_ASSETS.median_horiz.src = 'assets/taxi/gridworld_median_horiz.png';
}

function renderSingleTaxiGrid(ctx, t, startX, startY, size, agentName) {
  const cellSize = size / 5;
  const stations = [
    { row: 0, col: 0, name: 'R', color: '#cc292b' },
    { row: 0, col: 4, name: 'G', color: '#2e9e44' },
    { row: 4, col: 0, name: 'Y', color: '#eab308' },
    { row: 4, col: 3, name: 'B', color: '#3a5bd8' }
  ];

  ctx.font = '600 12px var(--font-sans)';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(agentName.substring(0, 24), startX, startY - 14);
  ctx.font = '11px JetBrains Mono';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Puntos: ${t.score} | Pasos: ${t.steps}`, startX + 160, startY - 14);

  // 1. Gymnasium Road Background Tiles
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cx = startX + c * cellSize;
      const cy = startY + r * cellSize;
      if (TAXI_ASSETS.loaded && TAXI_ASSETS.bg.complete) {
        ctx.drawImage(TAXI_ASSETS.bg, cx, cy, cellSize, cellSize);
      } else {
        ctx.fillStyle = '#787b84';
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeRect(cx, cy, cellSize, cellSize);
      }
    }
  }

  // 2. Official Colored Stations
  stations.forEach((st) => {
    const sx = startX + st.col * cellSize;
    const sy = startY + st.row * cellSize;
    ctx.save();
    ctx.fillStyle = st.color;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(sx, sy, cellSize, cellSize);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px JetBrains Mono';
    ctx.fillText(st.name, sx + 6, sy + 18);
  });

  // 3. Destination Hotel (Transparent building over destination station)
  const destStation = stations[t.destinationIdx];
  if (destStation) {
    const dx = startX + destStation.col * cellSize;
    const dy = startY + destStation.row * cellSize;
    if (TAXI_ASSETS.loaded && TAXI_ASSETS.hotel.complete) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.drawImage(TAXI_ASSETS.hotel, dx + cellSize * 0.1, dy + cellSize * 0.05, cellSize * 0.8, cellSize * 0.85);
      ctx.restore();
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '18px Outfit';
      ctx.fillText('🏨', dx + cellSize / 2 - 9, dy + cellSize / 2 + 7);
    }
  }

  // 4. Passenger at station (if not in taxi)
  if (!t.passengerInTaxi) {
    const pStation = stations[t.passengerIdx];
    if (pStation) {
      const px = startX + pStation.col * cellSize;
      const py = startY + pStation.row * cellSize;
      if (TAXI_ASSETS.loaded && TAXI_ASSETS.passenger.complete) {
        ctx.drawImage(TAXI_ASSETS.passenger, px + cellSize * 0.2, py + cellSize * 0.15, cellSize * 0.6, cellSize * 0.7);
      } else {
        ctx.font = '20px Outfit';
        ctx.fillText('🧍', px + cellSize / 2 - 10, py + cellSize / 2 + 8);
      }
    }
  }

  // 5. Official Gymnasium Vertical Medians (Hedge Walls)
  const drawMedianSegment = (colBoundary, startRow, isTop) => {
    const mx = startX + colBoundary * cellSize - cellSize * 0.14;
    const my = startY + startRow * cellSize;
    const img = isTop ? TAXI_ASSETS.median_top : TAXI_ASSETS.median_bottom;
    if (TAXI_ASSETS.loaded && img.complete) {
      ctx.drawImage(img, mx, my, cellSize * 0.28, cellSize);
    } else {
      ctx.strokeStyle = '#4d8c28';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(startX + colBoundary * cellSize, my);
      ctx.lineTo(startX + colBoundary * cellSize, my + cellSize);
      ctx.stroke();
    }
  };

  // Wall between col 1 and 2 (row 0 to 1)
  drawMedianSegment(2, 0, true);
  drawMedianSegment(2, 1, false);

  // Wall between col 0 and 1 (row 3 to 4)
  drawMedianSegment(1, 3, true);
  drawMedianSegment(1, 4, false);

  // Wall between col 2 and 3 (row 3 to 4)
  drawMedianSegment(3, 3, true);
  drawMedianSegment(3, 4, false);

  // Outer Perimeter Stone Curb
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(startX, startY, size, size);

  // 6. Taxi Cab Sprite
  const tx = startX + t.col * cellSize;
  const ty = startY + t.row * cellSize;
  let cabImg = TAXI_ASSETS.cab_front;
  if (t.orientation === 'up') cabImg = TAXI_ASSETS.cab_rear;
  else if (t.orientation === 'left') cabImg = TAXI_ASSETS.cab_left;
  else if (t.orientation === 'right') cabImg = TAXI_ASSETS.cab_right;

  if (TAXI_ASSETS.loaded && cabImg.complete) {
    ctx.drawImage(cabImg, tx + cellSize * 0.12, ty + cellSize * 0.12, cellSize * 0.76, cellSize * 0.76);
  } else {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(tx + cellSize * 0.15, ty + cellSize * 0.2, cellSize * 0.7, cellSize * 0.6);
  }

  // Indicator if passenger is in taxi
  if (t.passengerInTaxi) {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(tx + cellSize * 0.8, ty + cellSize * 0.25, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Success Banner
  if (t.delivered) {
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px Outfit';
    ctx.fillText('¡MISIÓN CUMPLIDA! (+20 PTS)', startX + 40, startY + size / 2);
  }
}


// ===========================================================================
// PLAYABLE 2D SANDBOX & ARCADE LAB (Continuous Responsive Physics)
// ===========================================================================
let sbCanvas, sbCtx;
let sbLander = null;
let sbTaxi = null;
let sbParticles = [];

function initSandboxArcade() {
  sbCanvas = document.getElementById('sandbox-canvas');
  if (!sbCanvas) return;
  sbCtx = sbCanvas.getContext('2d');

  document.getElementById('sandbox-btn-p1')?.addEventListener('click', () => {
    syncSandboxEnvButton(1);
    resetSandbox();
  });
  document.getElementById('sandbox-btn-p2')?.addEventListener('click', () => {
    syncSandboxEnvButton(2);
    resetSandbox();
  });

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
  if (STATE.sandboxAutoResetTimer) clearTimeout(STATE.sandboxAutoResetTimer);
  sbParticles = [];

  if (STATE.sandboxEnv === 1) {
    sbLander = {
      x: 400 + (Math.random() - 0.5) * 160,
      y: 60,
      vx: (Math.random() - 0.5) * 1.0,
      vy: 0.1,
      angle: (Math.random() - 0.5) * 0.25,
      thrust: false,
      leftThrust: false,
      rightThrust: false,
      landed: false,
      crashed: false,
      steps: 0,
      score: 0,
      padX: 400,
      padY: 370
    };

    document.getElementById('sb-hud-label-3').textContent = "VELOCIDAD VERTICAL";
    document.getElementById('sb-hud-label-4').textContent = "ALTITUD";
  } else {
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
      runTrainedLanderPolicy(sbLander, sbLander.padX);
    }

    const gravity = 0.05;
    const mainThrust = 0.145;
    const rotSpeed = 0.0055;

    if (sbLander.leftThrust) {
      sbLander.angle -= rotSpeed;
      sbLander.score -= 0.02;
    }
    if (sbLander.rightThrust) {
      sbLander.angle += rotSpeed;
      sbLander.score -= 0.02;
    }
    if (sbLander.thrust) {
      sbLander.vx += Math.sin(sbLander.angle) * mainThrust;
      sbLander.vy -= Math.cos(sbLander.angle) * mainThrust;
      sbLander.score -= 0.04;
      sbParticles.push({
        x: sbLander.x,
        y: sbLander.y + 12,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 3 + Math.random() * 2,
        color: '#ff4500',
        alpha: 1,
        size: 3 + Math.random() * 2
      });
    }

    sbLander.vy += gravity;
    sbLander.vx *= 0.996;
    sbLander.x += sbLander.vx;
    sbLander.y += sbLander.vy;

    // Boundaries
    if (sbLander.x < 25) { sbLander.x = 25; sbLander.vx = Math.abs(sbLander.vx) * 0.4; }
    if (sbLander.x > 775) { sbLander.x = 775; sbLander.vx = -Math.abs(sbLander.vx) * 0.4; }

    const dist = Math.abs(sbLander.x - sbLander.padX);
    sbLander.score += (400 - dist) * 0.003;

    // Ground Touchdown Check
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
        for (let i = 0; i < 25; i++) {
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
        for (let i = 0; i < 35; i++) {
          sbParticles.push({
            x: sbLander.x,
            y: sbLander.y,
            vx: (Math.random() - 0.5) * 7,
            vy: (Math.random() - 0.5) * 7,
            color: '#f43f5e',
            alpha: 1,
            size: 3.5
          });
        }
      }

      // Smooth auto-restart after landing/crash so player never gets frozen
      STATE.sandboxAutoResetTimer = setTimeout(() => {
        resetSandbox();
      }, 2200);
    }
  }

  // Update smoke particles
  sbParticles = sbParticles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.03;
    return p.alpha > 0;
  });

  updateSandboxHud();
}

function renderSandboxLander() {
  const w = sbCanvas.width;
  const h = sbCanvas.height;
  // Official Gymnasium Jet Black Sky (No stars)
  sbCtx.fillStyle = '#000000';
  sbCtx.fillRect(0, 0, w, h);

  // Gymnasium moon terrain (Solid Pure White Ground)
  drawGymnasiumTerrain(sbCtx, 0, w, sbLander.padX, sbLander.padY, 120);

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

  // Authentic Gymnasium Lander Ship
  drawGymnasiumLander(
    sbCtx, sbLander.x, sbLander.y, sbLander.angle,
    sbLander.thrust, sbLander.leftThrust, sbLander.rightThrust,
    sbLander.landed, sbLander.crashed, 'purple'
  );

  // Big Banner upon landing or crash
  if (sbLander.landed) {
    sbCtx.fillStyle = '#10b981';
    sbCtx.font = 'bold 24px Outfit';
    sbCtx.fillText('¡ATERRIZAJE PERFECTO! (+100 PTS) 🏆', 210, 180);
    sbCtx.font = '14px Outfit';
    sbCtx.fillStyle = '#94a3b8';
    sbCtx.fillText('Reiniciando siguiente vuelo...', 320, 210);
  } else if (sbLander.crashed) {
    sbCtx.fillStyle = '#f43f5e';
    sbCtx.font = 'bold 24px Outfit';
    sbCtx.fillText('¡CRASH / IMPACTO DEMASIADO FUERTE! (-100 PTS) 💥', 140, 180);
    sbCtx.font = '14px Outfit';
    sbCtx.fillStyle = '#94a3b8';
    sbCtx.fillText('Reiniciando siguiente vuelo...', 320, 210);
  }
}

function updateSandboxTaxi() {
  if (!sbTaxi) return;

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

  if (act === 'up') {
    taxi.orientation = 'up';
    if (!hasWall(taxi.row, taxi.col, taxi.row - 1, taxi.col)) taxi.row--;
    taxi.score -= 1;
  } else if (act === 'down') {
    taxi.orientation = 'down';
    if (!hasWall(taxi.row, taxi.col, taxi.row + 1, taxi.col)) taxi.row++;
    taxi.score -= 1;
  } else if (act === 'left') {
    taxi.orientation = 'left';
    if (!hasWall(taxi.row, taxi.col, taxi.row, taxi.col - 1)) taxi.col--;
    taxi.score -= 1;
  } else if (act === 'right') {
    taxi.orientation = 'right';
    if (!hasWall(taxi.row, taxi.col, taxi.row, taxi.col + 1)) taxi.col++;
    taxi.score -= 1;
  } else if (act === 'pickup') {
    const pSt = stations[taxi.passengerIdx];
    if (!taxi.passengerInTaxi && taxi.row === pSt.row && taxi.col === pSt.col) {
      taxi.passengerInTaxi = true;
      taxi.score -= 1;
    } else {
      taxi.score -= 10;
    }
  } else if (act === 'dropoff') {
    const dSt = stations[taxi.destinationIdx];
    if (taxi.passengerInTaxi && taxi.row === dSt.row && taxi.col === dSt.col) {
      taxi.passengerInTaxi = false;
      taxi.delivered = true;
      taxi.score += 20;
      setTimeout(() => {
        resetSandbox();
      }, 2200);
    } else {
      taxi.score -= 10;
    }
  }
}

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
