// ====== app.js: 应用主逻辑 ======

const modeUndercoverBtn = document.getElementById('modeUndercover');
const modeWerewolfBtn = document.getElementById('modeWerewolf');
const undercoverConfig = document.getElementById('undercoverConfig');
const werewolfConfig = document.getElementById('werewolfConfig');
const gameModeBadge = document.getElementById('gameModeBadge');
const roleSummary = document.getElementById('roleSummary');

// Mode Switch
modeUndercoverBtn.addEventListener('click', () => {
    currentGameMode = 'undercover';
    modeUndercoverBtn.classList.add('active');
    modeWerewolfBtn.classList.remove('active');
    undercoverConfig.style.display = 'block';
    werewolfConfig.style.display = 'none';
});

modeWerewolfBtn.addEventListener('click', () => {
    currentGameMode = 'werewolf';
    modeWerewolfBtn.classList.add('active');
    modeUndercoverBtn.classList.remove('active');
    werewolfConfig.style.display = 'block';
    undercoverConfig.style.display = 'none';
    updateWerewolfSummary();
});

// Werewolf Role Summary
function updateWerewolfSummary() {
    const roles = ['ww_civilian', 'ww_seer', 'ww_witch', 'ww_hunter', 'ww_guard', 'ww_idiot', 'ww_wolf', 'ww_wolfking', 'ww_whitewolfking'];
    let total = 0, wolves = 0;
    roles.forEach(r => {
        const val = parseInt(document.getElementById(r).value) || 0;
        total += val;
        if(r.includes('wolf')) wolves += val;
    });
    
    document.getElementById('totalPlayers').value = total; // Sync total players for UI grid
    renderPlayerConfigs(); // Re-render grid
    
    roleSummary.innerHTML = `
        <div style="font-weight:bold; font-size:1.1rem; text-align:center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
            当前配置：总计 <span style="color:var(--accent-color)">${total}</span> 人，
            包含 <span style="color:var(--danger-color)">${wolves}</span> 名狼人
            ${wolves % 2 === 0 ? '<span style="color:var(--danger-color); font-size:0.9rem;">(警告：狼人需为单数)</span>' : ''}
        </div>
    `;
}

document.querySelectorAll('.role-input').forEach(input => {
    input.addEventListener('change', updateWerewolfSummary);
});

// Setup Initial State
window.onload = () => {
    if(localStorage.getItem('apiBase')) document.getElementById('apiBase').value = localStorage.getItem('apiBase');
    if(localStorage.getItem('apiKey')) document.getElementById('apiKey').value = localStorage.getItem('apiKey');
    renderPlayerConfigs();
};
document.getElementById('apiBase').addEventListener('change', e => localStorage.setItem('apiBase', e.target.value));
document.getElementById('apiKey').addEventListener('change', e => localStorage.setItem('apiKey', e.target.value));
document.getElementById('fetchModelsBtn').addEventListener('click', fetchModels);

// Render Player Config Grid
async function fetchModels() {
    const apiBase = document.getElementById('apiBase').value;
    const apiKey = document.getElementById('apiKey').value;
    if (!apiKey) return alert("请输入API Key");

    try {
        document.getElementById('fetchModelsBtn').innerText = "获取中...";
        const res = await fetch('/api/models', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({api_key: apiKey, api_base: apiBase})
        });
        const data = await res.json();
        if (res.ok) {
            cachedModels = data.models;
            const modelSelect = document.getElementById('modelSelect');
            modelSelect.innerHTML = '<option value="">默认模型</option>';
            cachedModels.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.innerText = m;
                modelSelect.appendChild(opt);
            });
            renderPlayerConfigs();
        } else {
            alert("错误: " + data.detail);
        }
    } catch (e) {
        alert("网络错误: " + e.message);
    } finally {
        document.getElementById('fetchModelsBtn').innerText = "连接并获取模型";
    }
}

function renderPlayerConfigs() {
    const pCount = parseInt(document.getElementById('totalPlayers').value) || 4;
    const container = document.getElementById('playerConfigs');
    
    let currentValues = {};
    for (let i = 1; i <= 20; i++) {
        const sel = document.getElementById(`playerModel-${i}`);
        const chk = document.getElementById(`playerReasoning-${i}`);
        if (sel) currentValues[i] = { model: sel.value, reasoning: chk.checked };
    }

    let html = '';
    for (let i = 1; i <= pCount; i++) {
        const prev = currentValues[i] || { model: document.getElementById('modelSelect').value, reasoning: document.getElementById('isReasoning').checked };
        
        let optionsHtml = '<option value="">请选择模型</option>';
        cachedModels.forEach(m => {
            optionsHtml += `<option value="${m}" ${m === prev.model ? 'selected' : ''}>${m}</option>`;
        });

        html += `
        <div class="player-card">
            <div class="player-card-header">
                <span>${i}号玩家</span>
                <span style="font-size:1.2rem;">🤖</span>
            </div>
            <select id="playerModel-${i}" class="player-model-select">
                ${optionsHtml}
            </select>
            <div class="checkbox">
                <input type="checkbox" id="playerReasoning-${i}" class="player-reasoning-checkbox" ${prev.reasoning ? 'checked' : ''}>
                <label for="playerReasoning-${i}">支持思维链</label>
            </div>
        </div>`;
    }
    container.innerHTML = html;
}

document.getElementById('totalPlayers').addEventListener('change', renderPlayerConfigs);
document.getElementById('applyDefaultBtn').addEventListener('click', () => {
    const defaultModel = document.getElementById('modelSelect').value;
    const defaultReasoning = document.getElementById('isReasoning').checked;
    
    document.querySelectorAll('.player-model-select').forEach(s => {
        if (defaultModel && Array.from(s.options).some(o => o.value === defaultModel)) s.value = defaultModel;
    });
    document.querySelectorAll('.player-reasoning-checkbox').forEach(c => c.checked = defaultReasoning);
});

// Game Init & Control
document.getElementById('startGameBtn').addEventListener('click', () => {
    let success = false;
    if (currentGameMode === 'undercover') {
        success = UndercoverGame.init();
        gameModeBadge.innerText = '谁是卧底模式';
    } else {
        success = WerewolfGame.init();
        gameModeBadge.innerText = '狼人杀模式';
    }

    if (success) {
        document.getElementById('setupScreen').classList.remove('active');
        setTimeout(() => {
            document.getElementById('setupScreen').classList.add('hidden');
            document.getElementById('gameScreen').classList.remove('hidden');
            void document.getElementById('gameScreen').offsetWidth;
            document.getElementById('gameScreen').classList.add('active');
            
            document.getElementById('chatContainer').innerHTML = '';
            
            if (currentGameMode === 'undercover') {
                UndercoverGame.renderRoster();
                setTimeout(() => UndercoverGame.doStep(), 800);
            } else {
                WerewolfGame.renderRoster();
                setTimeout(() => WerewolfGame.doStep(), 800);
            }
        }, 500);
    }
});

function getActiveGame() {
    return currentGameMode === 'undercover' ? UndercoverGame : WerewolfGame;
}

document.getElementById('nextStepBtn').addEventListener('click', () => { getActiveGame().doStep(); });
document.getElementById('autoPlayBtn').addEventListener('click', () => { 
    getActiveGame().state.isAuto = true; 
    document.getElementById('nextStepBtn').classList.add('hidden');
    document.getElementById('autoPlayBtn').classList.add('hidden');
    document.getElementById('stopPlayBtn').classList.remove('hidden');
    getActiveGame().doStep(); 
});
document.getElementById('stopPlayBtn').addEventListener('click', () => { 
    getActiveGame().state.isAuto = false; 
    document.getElementById('nextStepBtn').classList.remove('hidden');
    document.getElementById('autoPlayBtn').classList.remove('hidden');
    document.getElementById('stopPlayBtn').classList.add('hidden');
});

document.getElementById('backToSetupBtn').addEventListener('click', () => {
    document.getElementById('gameScreen').classList.remove('active');
    setTimeout(() => {
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('setupScreen').classList.remove('hidden');
        void document.getElementById('setupScreen').offsetWidth;
        document.getElementById('setupScreen').classList.add('active');
    }, 500);
});
