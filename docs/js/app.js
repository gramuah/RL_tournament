// RL Course Interactive Arena & Comparator Application
// Author: Course Teaching Staff

const STATE = {
  currentPractical: 1, // 1 for LunarLander, 2 for Taxi
  currentTab: 'arena',
  leaderboards: {
    1: [],
    2: []
  },
  agentA: 'demo_student',
  agentB: 'baseline_heuristic',
  simInterval: null
};

// Default fallback data if running from file:// or without webserver
const FALLBACK_DATA_P1 = [
  {
    participant: "demo_student",
    mean_reward: 234.5,
    std_reward: 18.2,
    avg_steps: 178.4,
    success_rate: 100.0,
    status: "MASTERED 🚀",
    status_code: "mastered"
  },
  {
    participant: "baseline_heuristic",
    mean_reward: -625.59,
    std_reward: 178.43,
    avg_steps: 69.5,
    success_rate: 0.0,
    status: "NEEDS IMPROVEMENT ⚠️",
    status_code: "warning"
  },
  {
    participant: "baseline_random",
    mean_reward: -190.84,
    std_reward: 112.53,
    avg_steps: 91.2,
    success_rate: 0.0,
    status: "NEEDS IMPROVEMENT ⚠️",
    status_code: "warning"
  }
];

const FALLBACK_DATA_P2 = [
  {
    participant: "baseline_random",
    mean_reward: -785.4,
    std_reward: 142.1,
    avg_steps: 200.0,
    success_rate: 0.0,
    status: "NEEDS IMPROVEMENT ⚠️",
    status_code: "warning"
  }
];

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupPracticalSelector();
  setupEventListeners();
  await loadData();
  populateDropdowns();
  updateArenaView();
  renderLeaderboard();
  initSandboxCanvas();
});

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
      populateDropdowns();
      updateArenaView();
      renderLeaderboard();
    });
  });
}

function setupEventListeners() {
  document.getElementById('select-agent-a').addEventListener('change', (e) => {
    STATE.agentA = e.target.value;
    updateCornerStats('a', STATE.agentA);
  });

  document.getElementById('select-agent-b').addEventListener('change', (e) => {
    STATE.agentB = e.target.value;
    updateCornerStats('b', STATE.agentB);
  });

  document.getElementById('btn-start-duel').addEventListener('click', () => {
    triggerDuelSimulation();
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderLeaderboard(e.target.value.toLowerCase().trim());
    });
  }
}

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
  selectA.innerHTML = '';
  selectB.innerHTML = '';

  const list = STATE.leaderboards[STATE.currentPractical] || [];
  const participants = list.map(item => item.participant);

  participants.forEach((p, idx) => {
    const optA = document.createElement('option');
    optA.value = p;
    optA.textContent = p;
    selectA.appendChild(optA);

    const optB = document.createElement('option');
    optB.value = p;
    optB.textContent = p;
    selectB.appendChild(optB);
  });

  if (participants.length > 0) {
    STATE.agentA = participants[0];
    STATE.agentB = participants.length > 1 ? participants[1] : participants[0];
    selectA.value = STATE.agentA;
    selectB.value = STATE.agentB;
  }

  updateCornerStats('a', STATE.agentA);
  updateCornerStats('b', STATE.agentB);
}

function updateCornerStats(corner, participantName) {
  const list = STATE.leaderboards[STATE.currentPractical] || [];
  const agent = list.find(item => item.participant === participantName) || {
    mean_reward: 0,
    std_reward: 0,
    avg_steps: 0,
    success_rate: 0
  };

  document.getElementById(`stat-reward-${corner}`).textContent = `${agent.mean_reward > 0 ? '+' : ''}${agent.mean_reward.toFixed(1)} pts`;
  document.getElementById(`stat-steps-${corner}`).textContent = `${agent.avg_steps ? agent.avg_steps.toFixed(0) : 'N/A'} st`;
  document.getElementById(`stat-success-${corner}`).textContent = `${(agent.success_rate || 0).toFixed(0)}%`;
  document.getElementById(`stat-std-${corner}`).textContent = `±${(agent.std_reward || 0).toFixed(1)}`;
}

function updateArenaView() {
  updateCornerStats('a', STATE.agentA);
  updateCornerStats('b', STATE.agentB);
  updateComparisonBars();
}

function updateComparisonBars() {
  const list = STATE.leaderboards[STATE.currentPractical] || [];
  const agentA = list.find(item => item.participant === STATE.agentA) || { avg_steps: 100, mean_reward: 0 };
  const agentB = list.find(item => item.participant === STATE.agentB) || { avg_steps: 100, mean_reward: 0 };

  const nameElemA = document.querySelectorAll('.agent-name-a');
  const nameElemB = document.querySelectorAll('.agent-name-b');
  nameElemA.forEach(el => el.textContent = STATE.agentA);
  nameElemB.forEach(el => el.textContent = STATE.agentB);

  // Speed (Steps to finish - fewer is faster)
  const stepsA = agentA.avg_steps || 100;
  const stepsB = agentB.avg_steps || 100;
  document.getElementById('bar-val-steps-a').textContent = `${stepsA.toFixed(0)} st`;
  document.getElementById('bar-val-steps-b').textContent = `${stepsB.toFixed(0)} st`;

  const maxSteps = Math.max(stepsA, stepsB, 1);
  document.getElementById('bar-fill-steps-a').style.width = `${Math.min(100, (stepsA / maxSteps) * 100)}%`;
  document.getElementById('bar-fill-steps-b').style.width = `${Math.min(100, (stepsB / maxSteps) * 100)}%`;

  // Reward Bar
  const rA = agentA.mean_reward || 0;
  const rB = agentB.mean_reward || 0;
  document.getElementById('bar-val-reward-a').textContent = `${rA > 0 ? '+' : ''}${rA.toFixed(1)}`;
  document.getElementById('bar-val-reward-b').textContent = `${rB > 0 ? '+' : ''}${rB.toFixed(1)}`;

  const maxR = Math.max(Math.abs(rA), Math.abs(rB), 1);
  document.getElementById('bar-fill-reward-a').style.width = `${Math.min(100, (Math.abs(rA) / maxR) * 100)}%`;
  document.getElementById('bar-fill-reward-b').style.width = `${Math.min(100, (Math.abs(rB) / maxR) * 100)}%`;

  // Speed Winner Banner
  const winnerBadge = document.getElementById('duel-winner-badge');
  if (stepsA < stepsB) {
    const diff = (stepsB - stepsA).toFixed(0);
    winnerBadge.innerHTML = `⚡ <strong>${STATE.agentA}</strong> aterriza <strong>${diff} pasos más rápido</strong> que ${STATE.agentB}!`;
  } else if (stepsB < stepsA) {
    const diff = (stepsA - stepsB).toFixed(0);
    winnerBadge.innerHTML = `⚡ <strong>${STATE.agentB}</strong> aterriza <strong>${diff} pasos más rápido</strong> que ${STATE.agentA}!`;
  } else {
    winnerBadge.innerHTML = `⚖️ Rendimiento y velocidad idénticos entre ambos agentes.`;
  }
}

function triggerDuelSimulation() {
  updateComparisonBars();
  const videoElem = document.getElementById('duel-video');
  const statusElem = document.getElementById('duel-live-status');

  statusElem.textContent = 'RETRANSMISIÓN EN DIRECTO 🔴';
  statusElem.style.color = '#ff0055';

  if (videoElem) {
    videoElem.currentTime = 0;
    videoElem.play().catch(e => console.log('Autoplay prevented:', e));
  }

  // Animate celebratory confetti or highlight
  const duelCard = document.querySelector('.duel-display-card');
  duelCard.style.boxShadow = '0 0 40px rgba(0, 240, 255, 0.4)';
  setTimeout(() => {
    duelCard.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.5)';
  }, 3000);
}

function renderLeaderboard(filter = '') {
  const tbody = document.getElementById('leaderboard-tbody');
  tbody.innerHTML = '';

  const list = STATE.leaderboards[STATE.currentPractical] || [];
  const filtered = list.filter(item => {
    return item.participant.toLowerCase().includes(filter);
  });

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
  STATE.agentB = participant;
  const selectB = document.getElementById('select-agent-b');
  if (selectB) {
    selectB.value = participant;
  }

  // Switch to Arena tab
  const arenaTab = document.querySelector('[data-tab="arena"]');
  if (arenaTab) {
    arenaTab.click();
  }
  updateArenaView();
  triggerDuelSimulation();
};

// Physics Canvas Simulator (LunarLander 60fps in browser)
function initSandboxCanvas() {
  const canvas = document.getElementById('lander-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let lander = {
    x: 400,
    y: 60,
    vx: 1.2,
    vy: 0.5,
    angle: 0.1,
    thrust: false,
    leftThrust: false,
    rightThrust: false,
    landed: false,
    crashed: false
  };

  const gravity = 0.05;
  const mainThrust = 0.12;
  const rotThrust = 0.004;

  function resetLander() {
    lander.x = 250 + Math.random() * 300;
    lander.y = 50;
    lander.vx = (Math.random() - 0.5) * 2;
    lander.vy = 0.2;
    lander.angle = (Math.random() - 0.5) * 0.4;
    lander.landed = false;
    lander.crashed = false;
  }

  // Auto-Pilot Heuristic Agent Loop
  function updatePhysics() {
    if (!lander.landed && !lander.crashed) {
      // PD Heuristic
      const targetAngle = Math.max(-0.35, Math.min(0.35, (lander.x - 400) * 0.002 + lander.vx * 0.3));
      const angleErr = targetAngle - lander.angle;

      lander.leftThrust = angleErr < -0.05;
      lander.rightThrust = angleErr > 0.05;
      lander.thrust = lander.vy > 0.4 || lander.y > 320;

      if (lander.leftThrust) lander.angle -= rotThrust;
      if (lander.rightThrust) lander.angle += rotThrust;

      if (lander.thrust) {
        lander.vx += Math.sin(lander.angle) * mainThrust;
        lander.vy -= Math.cos(lander.angle) * mainThrust;
      }

      lander.vy += gravity;
      lander.x += lander.vx;
      lander.y += lander.vy;

      // Touchdown detection
      if (lander.y >= 380) {
        lander.y = 380;
        if (Math.abs(lander.vx) < 1.0 && Math.abs(lander.vy) < 1.5 && Math.abs(lander.angle) < 0.2) {
          lander.landed = true;
        } else {
          lander.crashed = true;
        }
        setTimeout(resetLander, 2500);
      }
    }

    render();
    requestAnimationFrame(updatePhysics);
  }

  function render() {
    ctx.fillStyle = '#0a0c16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect((i * 97) % canvas.width, (i * 53) % 350, 1.5, 1.5);
    }

    // Moon Terrain
    ctx.fillStyle = '#1e2235';
    ctx.beginPath();
    ctx.moveTo(0, 390);
    ctx.lineTo(340, 390);
    ctx.lineTo(360, 385);
    ctx.lineTo(440, 385); // Landing Pad
    ctx.lineTo(460, 390);
    ctx.lineTo(canvas.width, 390);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.fill();

    // Landing Pad Flags
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(360, 385);
    ctx.lineTo(440, 385);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.fillRect(360, 370, 8, 15);
    ctx.fillRect(432, 370, 8, 15);

    // Render Lander
    ctx.save();
    ctx.translate(lander.x, lander.y);
    ctx.rotate(lander.angle);

    // Lander Body
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-12, -14, 24, 20);

    // Cockpit Window
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-6, -10, 12, 6);

    // Legs
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(-18, 18);
    ctx.moveTo(10, 6);
    ctx.lineTo(18, 18);
    ctx.stroke();

    // Thruster Flames
    if (lander.thrust) {
      ctx.fillStyle = '#ff5500';
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 22 + Math.random() * 8);
      ctx.fill();
    }
    if (lander.leftThrust) {
      ctx.fillStyle = '#00d2ff';
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(-20, -4);
      ctx.lineTo(-12, 0);
      ctx.fill();
    }
    if (lander.rightThrust) {
      ctx.fillStyle = '#00d2ff';
      ctx.beginPath();
      ctx.moveTo(12, -4);
      ctx.lineTo(20, -4);
      ctx.lineTo(12, 0);
      ctx.fill();
    }

    ctx.restore();

    // HUD Text
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px JetBrains Mono';
    ctx.fillText(`Descent Rate: ${lander.vy.toFixed(2)} m/s`, 20, 30);
    ctx.fillText(`Horizontal:   ${lander.vx.toFixed(2)} m/s`, 20, 50);
    ctx.fillText(`Altitude:     ${(380 - lander.y).toFixed(0)} m`, 20, 70);

    if (lander.landed) {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 20px Outfit';
      ctx.fillText('TOUCHDOWN SUCCESSFUL! 🚀', 280, 200);
    } else if (lander.crashed) {
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 20px Outfit';
      ctx.fillText('CRASH DETECTED! 💥', 310, 200);
    }
  }

  resetLander();
  requestAnimationFrame(updatePhysics);
}
