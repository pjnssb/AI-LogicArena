// ====== common.js: 共享工具函数与UI辅助 ======

// 全局状态
let cachedModels = [];
let currentGameMode = 'undercover'; // 'undercover' | 'werewolf'

// API调用
async function callChat(messages, model) {
    const apiBase = document.getElementById('apiBase').value;
    const apiKey = document.getElementById('apiKey').value;
    if (!model) throw new Error("该玩家未配置模型");

    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            api_key: apiKey, api_base: apiBase, model: model, messages: messages, temperature: 0.7
        })
    });
    if (!res.ok) throw new Error((await res.json()).detail);
    return await res.json();
}

// UI辅助函数
function scrollToBottom() {
    const c = document.getElementById('chatContainer');
    c.scrollTop = c.scrollHeight;
}

function appendSystemMessage(msg) {
    const c = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.innerText = msg;
    c.appendChild(div);
    scrollToBottom();
}

function appendLoading(playerId, extra = '') {
    const c = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = 'message-card loading-card';
    div.innerHTML = `<div class="loading"><div class="spinner"></div>正在发送提示词给 ${playerId} 号 AI${extra}，等待回复中...</div>`;
    c.appendChild(div);
    scrollToBottom();
    return div;
}

function appendMessageCard(playerId, roleInfo, reasoning, mind, answer, extraClass = '') {
    const c = document.getElementById('chatContainer');
    const div = document.createElement('div');
    div.className = `message-card highlight ${extraClass}`;
    
    let html = `<div class="msg-header">
        <span>${playerId}号玩家</span>
        <span class="msg-role">${roleInfo}</span>
    </div>`;

    if (reasoning) {
        html += `<div class="reasoning-box"><div class="reasoning-title">🧠 思维链 (Reasoning)</div>${reasoning.replace(/\n/g, '<br>')}</div>`;
    }
    if (mind) {
        html += `<div class="mind-box"><div class="mind-title">💭 心理活动 (Mind)</div>${mind.replace(/\n/g, '<br>')}</div>`;
    }
    if (answer) {
        html += `<div class="answer-box">${answer.replace(/\n/g, '<br>')}</div>`;
    }

    div.innerHTML = html;
    c.appendChild(div);
    scrollToBottom();
    setTimeout(() => div.classList.remove('highlight'), 2000);
}

// 通用解析函数
function parseResponse(content, isVote) {
    let mind = "";
    let answer = "";
    let wodi = "";
    let action = "";
    
    const mindMatch = content.match(/(?:\[mind\]|【mind】|\[mind\]:|\[mind\]：)\s*([\s\S]*?)(?:\[answer\]|【answer】|\[wodi\]|【wodi】|\[action\]|【action】|$)/i);
    if (mindMatch) mind = mindMatch[1].trim();
    else {
        const altMindMatch = content.match(/(?:\[mind\]|【mind】)\s*([\s\S]*)/i);
        if (altMindMatch) mind = altMindMatch[1].trim();
    }

    if (!isVote) {
        const answerMatch = content.match(/(?:\[answer\]|【answer】|\[answer\]:|\[answer\]：)\s*([\s\S]*?)(?:\[wodi\]|【wodi】|\[action\]|【action】|$)/i);
        if (answerMatch) answer = answerMatch[1].trim();
        else if (!mind) answer = content.trim();
    } else {
        const answerMatch = content.match(/(?:\[answer\]|【answer】|\[answer\]:|\[answer\]：)\s*([\s\S]*?)(?:\[wodi\]|【wodi】)/i);
        if (answerMatch) answer = answerMatch[1].trim();

        const wodiMatch = content.match(/(?:\[wodi\]|【wodi】|\[wodi\]:|\[wodi\]：)\s*(\d+)/i);
        if (wodiMatch) wodi = wodiMatch[1].trim();
        else {
            const numMatch = content.match(/\d+/);
            wodi = numMatch ? numMatch[0] : "弃权";
        }
    }
    
    const actionMatch = content.match(/(?:\[action\]|【action】|\[action\]:|\[action\]：)\s*([\s\S]*?)(?:\[|【|$)/i);
    if (actionMatch) action = actionMatch[1].trim();
    
    return { mind, answer, wodi, action };
}

// 随机打乱数组
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
