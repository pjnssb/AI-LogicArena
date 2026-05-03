// ====== undercover.js: 谁是卧底游戏引擎 ======

const UndercoverGame = {
    players: [],
    totalPlayers: 0,
    undercoverCount: 0,
    state: {},

    init() {
        this.totalPlayers = parseInt(document.getElementById('totalPlayers').value);
        this.undercoverCount = parseInt(document.getElementById('undercoverCount').value);
        const civilianWord = document.getElementById('civilianWord').value;
        const undercoverWord = document.getElementById('undercoverWord').value;

        if (this.totalPlayers < 3) { alert("至少3名玩家"); return false; }
        if (this.undercoverCount >= this.totalPlayers - 1) { alert("卧底太多了"); return false; }
        if (!civilianWord || !undercoverWord) { alert("请输入词语"); return false; }

        this.players = [];
        let roles = Array(this.totalPlayers).fill('civilian');
        for (let i = 0; i < this.undercoverCount; i++) roles[i] = 'undercover';
        shuffle(roles);

        for (let i = 0; i < this.totalPlayers; i++) {
            const pModel = document.getElementById(`playerModel-${i+1}`)?.value;
            if (!pModel) { alert(`${i+1}号玩家未选择模型`); return false; }
            this.players.push({
                id: i + 1,
                role: roles[i],
                word: roles[i] === 'civilian' ? civilianWord : undercoverWord,
                dead: false,
                model: pModel,
                isReasoning: document.getElementById(`playerReasoning-${i+1}`)?.checked
            });
        }

        this.state = {
            phase: 'speaking', round: 1, currentSpeakerIndex: 0, isAuto: true,
            historyDescriptions: {}, discussions: {}, votes: {}, eliminations: {}
        };

        appendSystemMessage(`🕵️ 谁是卧底开始！共 ${this.totalPlayers} 名玩家，其中 ${this.undercoverCount} 名卧底。`);
        return true;
    },

    getAlivePlayers() { return this.players.filter(p => !p.dead); },

    renderRoster() {
        const list = document.getElementById('rosterList');
        list.innerHTML = '';
        this.players.forEach(p => {
            const item = document.createElement('div');
            item.className = `roster-item ${p.dead ? 'dead' : 'alive'}`;
            item.innerHTML = `
                <div class="roster-info">
                    <span class="roster-id">玩家 ${p.id}</span>
                    <span class="roster-role">${p.role === 'undercover' ? '🕵️ 卧底 ('+p.word+')' : '👤 平民 ('+p.word+')'}</span>
                </div>
                <div class="roster-status">${p.dead ? '💀' : '💖'}</div>`;
            list.appendChild(item);
        });
        const alive = this.getAlivePlayers();
        document.getElementById('alivePlayersCount').innerText = alive.length;
        document.getElementById('aliveUndercoversCount').innerText = alive.filter(p => p.role === 'undercover').length;
        document.getElementById('enemyBadge').innerHTML = `剩余卧底: <strong id="aliveUndercoversCount">${alive.filter(p => p.role === 'undercover').length}</strong>`;
        document.getElementById('currentPhase').innerText = this.getPhaseLabel();
    },

    getPhaseLabel() {
        const map = { speaking: '描述', discussing: '辩论', voting: '投票', postgame: '赛后', end: '结束' };
        return `第${this.state.round}轮 ${map[this.state.phase] || this.state.phase}`;
    },

    buildGameContext() {
        let ctx = "";
        for (let r = 1; r < this.state.round; r++) {
            ctx += `\n=== 第 ${r} 轮 ===\n`;
            if (this.state.historyDescriptions[r]) {
                ctx += `[描述]\n`;
                for (const pid of Object.keys(this.state.historyDescriptions[r]).sort((a,b)=>a-b))
                    ctx += `${pid}号：${this.state.historyDescriptions[r][pid]}\n`;
            }
            if (this.state.discussions[r]) {
                ctx += `[辩论]\n`;
                for (const pid of Object.keys(this.state.discussions[r]).sort((a,b)=>a-b))
                    ctx += `${pid}号：${this.state.discussions[r][pid]}\n`;
            }
            if (this.state.votes[r]) {
                ctx += `[投票]\n`;
                for (const pid of Object.keys(this.state.votes[r]).sort((a,b)=>a-b))
                    ctx += `${pid}号 投给 ${this.state.votes[r][pid].target}号\n`;
            }
            if (this.state.eliminations[r]) {
                const el = this.state.eliminations[r];
                ctx += el.outIds.length > 0
                    ? `[淘汰] ${el.outIds.join(',')}号 被淘汰（${el.isUndercover ? '卧底' : '平民'}）\n`
                    : `[淘汰] 无人淘汰\n`;
            }
        }
        ctx += `\n=== 当前第 ${this.state.round} 轮 ===\n`;
        if (this.state.historyDescriptions[this.state.round]) {
            ctx += `[本轮描述]\n`;
            for (const [pid, d] of Object.entries(this.state.historyDescriptions[this.state.round]))
                ctx += `${pid}号：${d}\n`;
        }
        if (this.state.discussions[this.state.round]) {
            ctx += `[本轮辩论]\n`;
            for (const [pid, d] of Object.entries(this.state.discussions[this.state.round]))
                ctx += `${pid}号：${d}\n`;
        }
        const aliveIds = this.getAlivePlayers().map(p => p.id);
        const dead = this.players.filter(p => p.dead).map(p => `${p.id}号(${p.role==='undercover'?'卧底':'平民'})`);
        ctx += `\n[状态] 存活：${aliveIds.join(',')} | 已出局：${dead.length>0?dead.join(','):'无'}\n`;
        return ctx;
    },

    buildSysPrompt(player) {
        const cCount = this.totalPlayers - this.undercoverCount;
        return `[system]
你正在玩"谁是卧底"。
规则：平民拿到同一词语，卧底拿到另一个相近词语。你不知道自己的身份。
警告：【绝对不能说出你的词语或包含其中任何字！】
进阶：你可以撒谎、伪装、甩锅！尽情发挥狡猾与演技！
格式要求：除赛后闲聊（postgame）外，所有回复都必须包含 [mind] 段落，不能省略。
本局${this.totalPlayers}人，${this.undercoverCount}卧底，${cCount}平民。
你是【${player.id}号】，词语是"${player.word}"。`;
    },

    async doStep() {
        if (this.state.phase === 'end') return;
        const alive = this.getAlivePlayers();

        if (this.state.phase === 'speaking') {
            if (this.state.currentSpeakerIndex === 0) {
                appendSystemMessage(`--- 第 ${this.state.round} 轮 描述阶段 ---`);
                if (!this.state.historyDescriptions[this.state.round]) this.state.historyDescriptions[this.state.round] = {};
            }
            const player = alive[this.state.currentSpeakerIndex];
            const box = appendLoading(player.id);
            try {
                const msgs = [
                    {role:"system", content: this.buildSysPrompt(player)},
                    {role:"user", content: `[otherai]\n完整记录：\n${this.buildGameContext()}\n\n[rule]\n现在是第${this.state.round}轮描述环节。\n输出 [mind] 思考 + [answer] 你的公开描述。`}
                ];
                const res = await callChat(msgs, player.model);
                box.remove();
                const p = parseResponse(res.content, false);
                appendMessageCard(player.id, `${player.role==='undercover'?'卧底':'平民'} (${player.word})`, res.reasoning_content, p.mind, `🗣️ ${p.answer}`);
                this.state.historyDescriptions[this.state.round][player.id] = p.answer;
                this.state.currentSpeakerIndex++;
                if (this.state.currentSpeakerIndex >= alive.length) { this.state.phase = 'discussing'; this.state.currentSpeakerIndex = 0; }
            } catch(e) { box.remove(); appendSystemMessage(`❌ 失败: ${e.message}`); this.state.isAuto = false; }

        } else if (this.state.phase === 'discussing') {
            if (this.state.currentSpeakerIndex === 0) {
                appendSystemMessage(`--- 第 ${this.state.round} 轮 自由辩论 ---`);
                if (!this.state.discussions[this.state.round]) this.state.discussions[this.state.round] = {};
            }
            const player = alive[this.state.currentSpeakerIndex];
            const box = appendLoading(player.id);
            try {
                const msgs = [
                    {role:"system", content: this.buildSysPrompt(player)},
                    {role:"user", content: `[otherai]\n完整记录：\n${this.buildGameContext()}\n\n[rule]\n现在是第${this.state.round}轮自由辩论。指控异常者或为自己辩解！\n输出 [mind] 思考 + [answer] 公开辩论言论。`}
                ];
                const res = await callChat(msgs, player.model);
                box.remove();
                const p = parseResponse(res.content, false);
                appendMessageCard(player.id, `${player.role==='undercover'?'卧底':'平民'} (${player.word})`, res.reasoning_content, p.mind, `🗣️ 辩论: ${p.answer}`);
                this.state.discussions[this.state.round][player.id] = p.answer;
                this.state.currentSpeakerIndex++;
                if (this.state.currentSpeakerIndex >= alive.length) { this.state.phase = 'voting'; this.state.currentSpeakerIndex = 0; }
            } catch(e) { box.remove(); appendSystemMessage(`❌ 失败: ${e.message}`); this.state.isAuto = false; }

        } else if (this.state.phase === 'voting') {
            if (this.state.currentSpeakerIndex === 0) {
                appendSystemMessage(`--- 第 ${this.state.round} 轮 投票 ---`);
                if (!this.state.votes[this.state.round]) this.state.votes[this.state.round] = {};
            }
            const player = alive[this.state.currentSpeakerIndex];
            const box = appendLoading(player.id);
            try {
                const msgs = [
                    {role:"system", content: this.buildSysPrompt(player)},
                    {role:"user", content: `[otherai]\n完整记录：\n${this.buildGameContext()}\n\n[rule]\n投票阶段。从存活玩家中选出异常者（不能选自己）。\n输出 [mind] 判断 + [wodi] 你投的编号（纯数字）。`}
                ];
                const res = await callChat(msgs, player.model);
                box.remove();
                const p = parseResponse(res.content, true);
                appendMessageCard(player.id, `${player.role==='undercover'?'卧底':'平民'} (${player.word})`, res.reasoning_content, p.mind, `🎯 投票: <strong class="vote-result">${p.wodi}号</strong>`);
                this.state.votes[this.state.round][player.id] = { target: parseInt(p.wodi) };
                this.state.currentSpeakerIndex++;
                if (this.state.currentSpeakerIndex >= alive.length) this.tallyVotes();
            } catch(e) { box.remove(); appendSystemMessage(`❌ 失败: ${e.message}`); this.state.isAuto = false; }

        } else if (this.state.phase === 'postgame') {
            if (this.state.currentSpeakerIndex === 0) {
                appendSystemMessage(`--- 🏆 真相大白，赛后吐槽 ---`);
                if (!this.state.postgameDiscussions) this.state.postgameDiscussions = {};
            }
            const player = this.players[this.state.currentSpeakerIndex];
            const uIds = this.players.filter(p=>p.role==='undercover').map(p=>p.id).join(',');
            const cWord = this.players.find(p=>p.role==='civilian').word;
            const uWord = this.players.find(p=>p.role==='undercover').word;
            let postHist = "";
            if (this.state.postgameDiscussions) {
                for (const [pid, s] of Object.entries(this.state.postgameDiscussions))
                    postHist += `${pid}号：${s}\n`;
            }
            const box = appendLoading(player.id);
            try {
                const msgs = [
                    {role:"system", content: `游戏结束！平民词"${cWord}"，卧底词"${uWord}"。卧底是${uIds}号。你是${player.id}号（${player.role==='undercover'?'卧底':'平民'}）。`},
                    {role:"user", content: `前面的赛后感言：\n${postHist||"（你第一个发言）"}\n\n请发表赛后吐槽，可以嘲讽、辩解、炫耀。\n[mind] 思考 [answer] 公开吐槽。`}
                ];
                const res = await callChat(msgs, player.model);
                box.remove();
                const p = parseResponse(res.content, false);
                appendMessageCard(player.id, `${player.role==='undercover'?'卧底':'平民'}`, res.reasoning_content, p.mind, `💬 ${p.answer}`);
                this.state.postgameDiscussions[player.id] = p.answer;
                this.state.currentSpeakerIndex++;
                if (this.state.currentSpeakerIndex >= this.players.length) {
                    appendSystemMessage(`🏁 游戏彻底结束。`);
                    this.state.phase = 'end'; this.state.isAuto = false;
                }
            } catch(e) { box.remove(); appendSystemMessage(`❌ 失败: ${e.message}`); this.state.isAuto = false; }
        }
        this.renderRoster();
        
        // 自动播放循环
        if (this.state.isAuto && this.state.phase !== 'end') {
            setTimeout(() => this.doStep(), 1500);
        }
    },

    tallyVotes() {
        const counts = {};
        for (const v of Object.values(this.state.votes[this.state.round])) {
            if (!isNaN(v.target)) counts[v.target] = (counts[v.target]||0) + 1;
        }
        let max = 0, cands = [];
        for (const [t,c] of Object.entries(counts)) {
            if (c > max) { max = c; cands = [t]; }
            else if (c === max) cands.push(t);
        }
        if (!this.state.eliminations) this.state.eliminations = {};
        if (cands.length === 1) {
            const outId = parseInt(cands[0]);
            const p = this.players.find(x => x.id === outId);
            if (p) {
                p.dead = true;
                this.state.eliminations[this.state.round] = { outIds: [outId], isUndercover: p.role==='undercover' };
                appendSystemMessage(`🩸 ${outId}号（${max}票）被淘汰！【${p.role==='undercover'?'是':'不是'}】卧底！`);
            }
        } else {
            this.state.eliminations[this.state.round] = { outIds: [] };
            appendSystemMessage(cands.length > 1 ? `⚖️ ${cands.join(',')}号平票，无人出局。` : `⚖️ 全弃权，无人出局。`);
        }
        const alive = this.getAlivePlayers();
        const aU = alive.filter(x=>x.role==='undercover').length;
        const aC = alive.length - aU;
        if (aU === 0) {
            appendSystemMessage(`🎉 平民胜利！进入赛后吐槽...`);
            this.state.phase = 'postgame'; this.state.currentSpeakerIndex = 0; this.state.postgameDiscussions = {};
        } else if (aC <= aU) {
            appendSystemMessage(`😈 卧底胜利！进入赛后吐槽...`);
            this.state.phase = 'postgame'; this.state.currentSpeakerIndex = 0; this.state.postgameDiscussions = {};
        } else {
            this.state.phase = 'speaking'; this.state.round++; this.state.currentSpeakerIndex = 0;
        }
    }
};
