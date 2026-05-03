// ====== werewolf.js: 狼人杀游戏引擎 ======

const WerewolfGame = {
    players: [],
    totalPlayers: 0,
    state: {},

    init() {
        const roles = [];
        const roleMap = {
            'civilian': parseInt(document.getElementById('ww_civilian').value) || 0,
            'seer': parseInt(document.getElementById('ww_seer').value) || 0,
            'witch': parseInt(document.getElementById('ww_witch').value) || 0,
            'hunter': parseInt(document.getElementById('ww_hunter').value) || 0,
            'guard': parseInt(document.getElementById('ww_guard').value) || 0,
            'idiot': parseInt(document.getElementById('ww_idiot').value) || 0,
            'wolf': parseInt(document.getElementById('ww_wolf').value) || 0,
            'wolfking': parseInt(document.getElementById('ww_wolfking').value) || 0,
            'whitewolfking': parseInt(document.getElementById('ww_whitewolfking').value) || 0,
        };

        for (const [r, c] of Object.entries(roleMap)) {
            for (let i = 0; i < c; i++) roles.push(r);
        }

        this.totalPlayers = roles.length;
        if (this.totalPlayers < 3) { alert("总人数不足3人！"); return false; }
        
        const wolfCount = roleMap['wolf'] + roleMap['wolfking'] + roleMap['whitewolfking'];
        if (wolfCount === 0 || wolfCount % 2 === 0) { alert("狼人阵营总数必须是单数！"); return false; }

        shuffle(roles);
        this.players = [];

        for (let i = 0; i < this.totalPlayers; i++) {
            const pModel = document.getElementById(`playerModel-${i+1}`)?.value;
            if (!pModel) { alert(`${i+1}号玩家未选择模型`); return false; }
            this.players.push({
                id: i + 1,
                role: roles[i],
                dead: false,
                model: pModel,
                isReasoning: document.getElementById(`playerReasoning-${i+1}`)?.checked,
                // 女巫状态
                hasSave: roles[i] === 'witch' ? true : undefined,
                hasPoison: roles[i] === 'witch' ? true : undefined,
                // 猎人状态
                hunterCanShoot: roles[i] === 'hunter' ? true : undefined,
                // 白痴状态
                idiotRevealed: false,
                // 预言家查验记录
                seerChecks: roles[i] === 'seer' ? [] : undefined,
            });
        }

        this.state = {
            phase: 'night_guard', // 标准顺序：守卫 → 狼人 → 女巫 → 预言家
            day: 1,
            currentSpeakerIndex: 0,
            isAuto: true,
            nightKilled: null,
            witchSaved: false,
            witchPoisoned: null,
            seerChecked: null,
            guardProtected: null,
            guardLastProtected: null,
            deathsThisNight: [],
            deathCause: {},
            historyLogs: [],
            votes: {}, 
            eliminations: {},
            lastSpeakerIndex: 0,
            whitewolfBoomed: false,
        };

        appendSystemMessage(`🐺 狼人杀游戏开始！共 ${this.totalPlayers} 人入局。天黑请闭眼...`);
        return true;
    },

    getAlivePlayers() { return this.players.filter(p => !p.dead); },
    getPlayersByRole(rolesArray) { return this.players.filter(p => rolesArray.includes(p.role)); },
    getAliveByRole(rolesArray) { return this.getAlivePlayers().filter(p => rolesArray.includes(p.role)); },

    getRoleName(role) {
        const map = { civilian: '平民', seer: '预言家', witch: '女巫', hunter: '猎人', guard: '守卫', idiot: '白痴', wolf: '狼人', wolfking: '狼王', whitewolfking: '白狼王' };
        return map[role] || role;
    },

    parsePlayerIdFromText(text) {
        const match = (text || '').match(/\d+/);
        if (!match) return 0;
        const id = parseInt(match[0], 10);
        if (isNaN(id)) return 0;
        return id;
    },

    pickMajorityTarget(votesObj) {
        let max = 0;
        let target = null;
        for (const [t, c] of Object.entries(votesObj || {})) {
            if (c > max) {
                max = c;
                target = parseInt(t, 10);
            }
        }
        return target;
    },

    resolveDeathSkillChain(deathList, deathCause) {
        const queue = [...deathList];
        const triggered = new Set();

        while (queue.length > 0) {
            const deadId = queue.shift();
            const deadPlayer = this.players.find(x => x.id === deadId);
            if (!deadPlayer) continue;

            // 猎人：被毒死不能开枪
            if (deadPlayer.role === 'hunter' && deadPlayer.hunterCanShoot && deathCause[deadId] !== 'poison') {
                const key = `hunter-${deadId}`;
                if (!triggered.has(key)) {
                    triggered.add(key);
                    const aliveWolves = this.getAliveByRole(['wolf', 'wolfking', 'whitewolfking']);
                    if (aliveWolves.length > 0) {
                        const target = aliveWolves[Math.floor(Math.random() * aliveWolves.length)];
                        if (!target.dead) {
                            target.dead = true;
                            appendSystemMessage(`🔫 ${deadId}号猎人死亡，开枪带走了${target.id}号（${this.getRoleName(target.role)}）！`);
                            this.state.historyLogs.push(`[猎人开枪] ${deadId}号死亡时开枪带走了${target.id}号。`);
                            if (!deathList.includes(target.id)) {
                                deathList.push(target.id);
                                deathCause[target.id] = 'hunter_shoot';
                                queue.push(target.id);
                            }
                        }
                    }
                }
            }

            // 狼王：被毒死不能开枪
            if (deadPlayer.role === 'wolfking' && deathCause[deadId] !== 'poison') {
                const key = `wolfking-${deadId}`;
                if (!triggered.has(key)) {
                    triggered.add(key);
                    const aliveGood = this.getAlivePlayers().filter(x => !['wolf', 'wolfking', 'whitewolfking'].includes(x.role));
                    if (aliveGood.length > 0) {
                        const target = aliveGood[Math.floor(Math.random() * aliveGood.length)];
                        if (!target.dead) {
                            target.dead = true;
                            appendSystemMessage(`💥 ${deadId}号狼王死亡，开枪带走了${target.id}号（${this.getRoleName(target.role)}）！`);
                            this.state.historyLogs.push(`[狼王开枪] ${deadId}号死亡时开枪带走了${target.id}号。`);
                            if (!deathList.includes(target.id)) {
                                deathList.push(target.id);
                                deathCause[target.id] = 'wolfking_shoot';
                                queue.push(target.id);
                            }
                        }
                    }
                }
            }
        }
    },

    renderRoster() {
        const list = document.getElementById('rosterList');
        list.innerHTML = '';
        this.players.forEach(p => {
            const item = document.createElement('div');
            item.className = `roster-item ${p.dead ? 'dead' : 'alive'}`;
            let extra = '';
            if (p.idiotRevealed) extra = ' (已翻牌)';
            item.innerHTML = `
                <div class="roster-info">
                    <span class="roster-id">玩家 ${p.id}${extra}</span>
                    <span class="roster-role">${this.getRoleName(p.role)}</span>
                </div>
                <div class="roster-status">${p.dead ? '💀' : '💖'}</div>`;
            list.appendChild(item);
        });
        
        const alive = this.getAlivePlayers();
        const wolfCount = alive.filter(p => ['wolf','wolfking','whitewolfking'].includes(p.role)).length;
        document.getElementById('alivePlayersCount').innerText = alive.length;
        document.getElementById('aliveUndercoversCount').innerText = wolfCount;
        document.getElementById('enemyBadge').innerHTML = `存活狼队: <strong id="aliveUndercoversCount">${wolfCount}</strong>`;
        document.getElementById('currentPhase').innerText = this.getPhaseLabel();
    },

    getPhaseLabel() {
        const map = { 
            night_guard: '守卫行动', night_wolf: '狼人刀人', night_witch: '女巫行动', night_seer: '预言家验人',
            day_announce: '公布死讯', day_speak: '白天发言', day_vote: '白天投票', postgame: '赛后', end: '结束' 
        };
        return `第${this.state.day}天 ${map[this.state.phase] || this.state.phase}`;
    },

    buildSysPrompt(player) {
        let roleRules = "";
        const isWolf = ['wolf','wolfking','whitewolfking'].includes(player.role);
        if (isWolf) {
            const wolfIds = this.getPlayersByRole(['wolf','wolfking','whitewolfking']).map(p=>p.id).join(',');
            const aliveWolves = this.getAliveByRole(['wolf','wolfking','whitewolfking']).map(p=>p.id).join(',');
            roleRules = `你的狼队友是：${wolfIds}号（存活：${aliveWolves}）。你们是一个团队，夜晚共同协商刀人目标。你要伪装成好人，隐藏身份。`;
            if (player.role === 'wolfking') roleRules += ` 你是狼王，出局时可以开枪带走一人（被毒死则不能开枪）。`;
            if (player.role === 'whitewolfking') roleRules += ` 你是白狼王，白天发言时可以选择自爆并带走一人，然后直接进入黑夜。`;
        } else if (player.role === 'witch') {
            roleRules = `你可以救活被狼人杀害的人（仅一次），或者毒死一个人（仅一次）。`;
            if (player.hasSave !== undefined) roleRules += ` 解药：${player.hasSave ? '可用' : '已用'}。毒药：${player.hasPoison ? '可用' : '已用'}。`;
        } else if (player.role === 'seer') {
            roleRules = `你每晚可以查验一个人的阵营（好人或狼人）。白天要适当利用信息带领好人。`;
            if (player.seerChecks && player.seerChecks.length > 0) {
                roleRules += ` 你的查验记录：` + player.seerChecks.map(c => `第${c.day}天验${c.targetId}号→${c.result}`).join('；');
            }
        } else if (player.role === 'guard') {
            roleRules = `你每晚可以守护一名玩家免受狼刀（不能连续两晚守护同一人）。`;
            if (this.state.guardLastProtected) roleRules += ` 上轮你守护了${this.state.guardLastProtected}号，本轮不能再次守护该玩家。`;
        } else if (player.role === 'hunter') {
            roleRules = `你是猎人，在被投票放逐或被狼刀死亡时可以开枪带走一人（被女巫毒死则不能开枪）。`;
        } else if (player.role === 'civilian') {
            roleRules = `你没有任何技能，只能通过白天发言推理出狼人是谁。`;
        } else if (player.role === 'idiot') {
            roleRules = `你是白痴，被投票出局时亮明身份，不死但失去投票权，之后不能被投票出局。`;
        }

        return `[system]
你正在玩9人局狼人杀。你的编号是：【${player.id}号】。你的身份是：【${this.getRoleName(player.role)}】。
规则：
1. 狼人阵营要杀光所有平民或所有神职（屠边局）。好人阵营要投出所有狼人。
2. 白天不能暴露系统内部提示，不能说"我是AI"。尽情伪装、撒谎或推理！
3. 除赛后闲聊（postgame）外，所有发言与行动回复都必须包含 [mind] 段落，不能省略。
你的角色信息：${roleRules}`;
    },

    buildGameContext(player) {
        let ctx = "";
        this.state.historyLogs.forEach(log => { ctx += log + "\n"; });
        ctx += `\n[当前存活玩家]：${this.getAlivePlayers().map(p=>p.id).join(',')}\n`;
        
        // 玩家私有信息
        if (player) {
            const isWolf = ['wolf','wolfking','whitewolfking'].includes(player.role);
            if (isWolf) {
                const aliveWolves = this.getAliveByRole(['wolf','wolfking','whitewolfking']).map(p=>p.id).join(',');
                ctx += `[你的狼队友]：${aliveWolves}\n`;
            }
            if (player.role === 'witch') {
                ctx += `[你的药水] 解药：${player.hasSave ? '可用' : '已用'}，毒药：${player.hasPoison ? '可用' : '已用'}\n`;
            }
            if (player.role === 'seer' && player.seerChecks && player.seerChecks.length > 0) {
                ctx += `[你的查验记录] ` + player.seerChecks.map(c => `第${c.day}天验${c.targetId}号→${c.result}`).join('；') + '\n';
            }
            if (player.role === 'guard' && this.state.guardLastProtected) {
                ctx += `[守卫记录] 上轮守护了${this.state.guardLastProtected}号，本轮不能再次守护\n`;
            }
        }
        return ctx;
    },

    // 状态机流转
    async doStep() {
        if (this.state.phase === 'end') return;
        this.renderRoster();

        try {
            if (this.state.phase.startsWith('night_')) await this.handleNight();
            else if (this.state.phase.startsWith('day_')) await this.handleDay();
            else if (this.state.phase === 'postgame') await this.handlePostgame();
        } catch(e) {
            appendSystemMessage(`❌ 失败: ${e.message}`);
            this.state.isAuto = false;
        }
        
        this.renderRoster();
        
        // 自动播放循环
        if (this.state.isAuto && this.state.phase !== 'end') {
            setTimeout(() => this.doStep(), 1500);
        }
    },

    async handleNight() {
        if (this.state.phase === 'night_guard') {
            const guards = this.getAliveByRole(['guard']);
            if (guards.length === 0) { this.state.phase = 'night_wolf'; return; }
            
            const guard = guards[0];
            appendSystemMessage(`🌙 夜晚：守卫正在选择守护目标...`);
            const box = appendLoading(guard.id, " (守卫)");
            
            let restriction = '';
            if (this.state.guardLastProtected) {
                restriction = `\n注意：你上一晚守护了${this.state.guardLastProtected}号，本轮不能再次守护他。`;
            }
            const prompt = `[otherai]\n系统：现在是夜晚，守卫行动。存活玩家：${this.getAlivePlayers().map(p=>p.id).join(',')}。${restriction}\n请选择你要守护的玩家。\n[mind] 你的思考\n[action] 守护的玩家编号（纯数字）`;
            const res = await callChat([{role:"system", content:this.buildSysPrompt(guard)}, {role:"user", content:prompt}], guard.model);
            box.remove();
            const p = parseResponse(res.content, false);
            const targetId = this.parsePlayerIdFromText(p.action);
            
            // 检查是否合法（不能连续守护同一人）
            if (targetId && targetId !== this.state.guardLastProtected) {
                this.state.guardProtected = targetId;
            } else if (targetId === this.state.guardLastProtected) {
                appendSystemMessage(`⚠️ 守卫尝试连续守护${targetId}号，操作无效！`);
                this.state.guardProtected = null;
            } else {
                this.state.guardProtected = null;
            }
            
            appendMessageCard(guard.id, "守卫", res.reasoning_content, p.mind, `🛡️ 守护: ${this.state.guardProtected ? this.state.guardProtected + '号' : '无人'}`, 'seer-msg');
            this.state.phase = 'night_wolf';
            
        } else if (this.state.phase === 'night_wolf') {
            const wolves = this.getAliveByRole(['wolf', 'wolfking', 'whitewolfking']);
            if (wolves.length === 0) { this.state.phase = 'night_witch'; return; }
            
            appendSystemMessage(`🌙 夜晚：狼人正在讨论刀人...`);
            const wolfTeamIds = wolves.map(w=>w.id).join(',');

            // 第一轮：每个狼人先给出初始建议
            const firstRoundChoices = {};
            const firstRoundVotes = {};
            for (let wolf of wolves) {
                const box = appendLoading(wolf.id, " (狼人)");
                const prompt = `[otherai]\n系统：现在是夜晚，狼人行动。场上存活玩家：${this.getAlivePlayers().map(p=>p.id).join(',')}。\n你的狼队友是：${wolfTeamIds}。请先给出你的首轮刀口建议。\n[mind] 你的思考\n[action] 首轮建议刀的玩家编号（纯数字，不刀填0）`;
                const res = await callChat([{role:"system", content:this.buildSysPrompt(wolf)}, {role:"user", content:prompt}], wolf.model);
                box.remove();
                const p = parseResponse(res.content, false);
                const targetId = this.parsePlayerIdFromText(p.action);
                firstRoundChoices[wolf.id] = targetId || 0;
                if (targetId) firstRoundVotes[targetId] = (firstRoundVotes[targetId] || 0) + 1;
                appendMessageCard(wolf.id, "狼人内部", res.reasoning_content, p.mind, `🔪 首轮建议: ${targetId || 0}号`, 'wolf-msg');
            }

            const suggestionText = wolves.map(w => `${w.id}号→${firstRoundChoices[w.id] || 0}号`).join('；');
            appendSystemMessage(`🐺 狼队首轮建议汇总：${suggestionText}`);

            // 第二轮：拿到队友建议后再确认，尽量形成共识
            const finalRoundVotes = {};
            for (let wolf of wolves) {
                const box = appendLoading(wolf.id, " (狼人)");
                const prompt = `[otherai]\n系统：狼人第二轮协商。队内首轮建议为：${suggestionText}。\n请参考队友意见，尽量达成一致并给出最终刀口。\n[mind] 你的思考（围绕团队共识）\n[action] 最终建议刀的玩家编号（纯数字，不刀填0）`;
                const res = await callChat([{role:"system", content:this.buildSysPrompt(wolf)}, {role:"user", content:prompt}], wolf.model);
                box.remove();
                const p = parseResponse(res.content, false);
                const targetId = this.parsePlayerIdFromText(p.action);
                if (targetId) finalRoundVotes[targetId] = (finalRoundVotes[targetId] || 0) + 1;
                appendMessageCard(wolf.id, "狼人内部", res.reasoning_content, p.mind, `⚔️ 最终建议: ${targetId || 0}号`, 'wolf-msg');
            }
            
            // 最终落刀：优先使用第二轮多数；若无人给出有效目标，则回退第一轮多数
            let target = this.pickMajorityTarget(finalRoundVotes);
            if (!target) target = this.pickMajorityTarget(firstRoundVotes);

            this.state.nightKilled = target;
            appendSystemMessage(`🐺 狼队最终决定刀：${target || '无人'}号`);
            this.state.phase = 'night_witch';
            
        } else if (this.state.phase === 'night_witch') {
            const witches = this.getAliveByRole(['witch']);
            if (witches.length === 0) { this.state.phase = 'night_seer'; return; }
            
            const witch = witches[0];
            appendSystemMessage(`🌙 夜晚：女巫正在行动...`);
            const box = appendLoading(witch.id, " (女巫)");
            let info = `今晚被狼人刀的是：${this.state.nightKilled || '没人'}号。`;
            if (!witch.hasSave) info += ` 你的解药已用完。`;
            if (!witch.hasPoison) info += ` 你的毒药已用完。`;
            
            const prompt = `[otherai]\n系统：现在是夜晚，女巫行动。${info}\n存活玩家：${this.getAlivePlayers().map(p=>p.id).join(',')}。\n你要使用药水吗？\n请严格按格式输出 [action]：解药：救X 或 不救；毒药：毒Y 或 不毒。\n规则：解药只能救今晚刀口玩家；若写的X不是今晚刀口，则解药视为无效。\n[mind] 思考\n[action] 解药：救X/不救；毒药：毒Y/不毒`;
            const res = await callChat([{role:"system", content:this.buildSysPrompt(witch)}, {role:"user", content:prompt}], witch.model);
            box.remove();
            const p = parseResponse(res.content, false);
            
            // 解药解析：优先新格式“救X”，兼容旧格式“使用解药”
            const saveMatch = p.action.match(/救\s*(\d+)/);
            const explicitNoSave = /不救|不用解药|不使用解药/.test(p.action);
            const legacyUseSave = /使用解药/.test(p.action) && !/不使用解药/.test(p.action);
            if (witch.hasSave && this.state.nightKilled && !explicitNoSave) {
                if (saveMatch) {
                    const saveTarget = parseInt(saveMatch[1], 10);
                    if (saveTarget === this.state.nightKilled) {
                        this.state.witchSaved = true;
                        witch.hasSave = false;
                    } else {
                        appendSystemMessage(`⚠️ 女巫尝试救${saveTarget}号，但今晚刀口是${this.state.nightKilled}号，解药无效。`);
                    }
                } else if (legacyUseSave) {
                    // 兼容旧表达：默认救当晚刀口
                    this.state.witchSaved = true;
                    witch.hasSave = false;
                }
            }

            // 毒药解析：支持“毒Y”，并兼容“毒 Y”
            const poisonMatch = p.action.match(/毒\s*(\d+)/);
            const explicitNoPoison = /不毒|不使用毒药/.test(p.action);
            if (witch.hasPoison && poisonMatch && !explicitNoPoison) {
                this.state.witchPoisoned = parseInt(poisonMatch[1]);
                witch.hasPoison = false;
            }
            
            appendMessageCard(witch.id, "女巫", res.reasoning_content, p.mind, `🧪 行动: ${p.action}`, 'witch-msg');
            this.state.phase = 'night_seer';
            
        } else if (this.state.phase === 'night_seer') {
            const seers = this.getAliveByRole(['seer']);
            if (seers.length === 0) { this.resolveNight(); return; }
            
            const seer = seers[0];
            appendSystemMessage(`🌙 夜晚：预言家正在查验...`);
            const box = appendLoading(seer.id, " (预言家)");
            const prompt = `[otherai]\n系统：现在是夜晚，预言家验人。存活玩家：${this.getAlivePlayers().map(p=>p.id).join(',')}。\n你要查验谁的身份？\n[mind] 思考\n[action] 玩家编号`;
            const res = await callChat([{role:"system", content:this.buildSysPrompt(seer)}, {role:"user", content:prompt}], seer.model);
            box.remove();
            const p = parseResponse(res.content, false);
            const targetId = this.parsePlayerIdFromText(p.action);
            
            let result = "未知";
            if (targetId) {
                const target = this.players.find(x=>x.id===targetId);
                result = (target && ['wolf','wolfking','whitewolfking'].includes(target.role)) ? '狼人' : '好人';
                // 存储查验结果
                if (!seer.seerChecks) seer.seerChecks = [];
                seer.seerChecks.push({ day: this.state.day, targetId, result });
            }
            appendMessageCard(seer.id, "预言家", res.reasoning_content, p.mind, `👁️ 验 ${targetId}号 -> ${result}`, 'seer-msg');
            this.resolveNight();
        }
    },

    resolveNight() {
        this.state.deathsThisNight = [];
        this.state.deathCause = {};
        this.resolveNightDeaths();
        this.applyNightDeaths();
        this.resolveDeathSkillChain(this.state.deathsThisNight, this.state.deathCause);
        
        // 记录守卫本轮守护（用于下一轮限制）
        this.state.guardLastProtected = this.state.guardProtected;

        // 夜晚死亡后检查胜负
        if (this.checkWin()) return;
        
        this.state.phase = 'day_announce';
    },

    resolveNightDeaths() {
        // 奶穿判定：守卫守护 + 女巫解药同时作用在同一人 → 死亡
        const milkPierce = this.state.guardProtected && this.state.witchSaved &&
            this.state.guardProtected === this.state.nightKilled;

        if (milkPierce) {
            this.state.deathsThisNight.push(this.state.nightKilled);
            this.state.deathCause[this.state.nightKilled] = 'milk_pierce';
        } else if (this.state.nightKilled && !this.state.witchSaved && this.state.nightKilled !== this.state.guardProtected) {
            this.state.deathsThisNight.push(this.state.nightKilled);
            this.state.deathCause[this.state.nightKilled] = 'wolf';
        }

        if (this.state.witchPoisoned && !this.state.deathsThisNight.includes(this.state.witchPoisoned)) {
            this.state.deathsThisNight.push(this.state.witchPoisoned);
            this.state.deathCause[this.state.witchPoisoned] = 'poison';
        }
    },

    applyNightDeaths() {
        this.state.deathsThisNight.forEach(id => {
            const p = this.players.find(x => x.id === id);
            if (!p) return;
            p.dead = true;
            // 猎人被毒死不能开枪
            if (p.role === 'hunter' && this.state.deathCause[id] === 'poison') {
                p.hunterCanShoot = false;
            }
        });
    },

    async handleDay() {
        if (this.state.phase === 'day_announce') {
            appendSystemMessage(`☀️ 第 ${this.state.day} 天 白天到来。`);
            this.state.historyLogs.push(`\n=== 第 ${this.state.day} 天 ===`);
            
            if (this.state.deathsThisNight.length === 0) {
                // 区分平安夜原因
                let reason = '';
                if (this.state.witchSaved && this.state.guardProtected !== this.state.nightKilled) {
                    reason = `（女巫使用解药救活了${this.state.nightKilled}号）`;
                } else if (this.state.guardProtected === this.state.nightKilled && !this.state.witchSaved) {
                    reason = `（守卫守护了${this.state.nightKilled}号）`;
                } else {
                    reason = `（无人被刀）`;
                }
                appendSystemMessage(`昨晚是平安夜！${reason}`);
                this.state.historyLogs.push(`[公布死讯] 昨晚是平安夜。${reason}`);
            } else {
                const causeMap = { wolf: '被狼刀', poison: '被毒杀', milk_pierce: '同守同救（奶穿）', hunter_shoot: '被猎人开枪', wolfking_shoot: '被狼王开枪' };
                const deathDetails = this.state.deathsThisNight.map(id => {
                    const cause = this.state.deathCause[id] || 'unknown';
                    return `${id}号(${causeMap[cause] || cause})`;
                }).join('、');
                appendSystemMessage(`昨晚 ${deathDetails}！`);
                this.state.historyLogs.push(`[公布死讯] 昨晚 ${deathDetails} 死亡。`);
                
                // 首夜遗言
                if (this.state.day === 1) {
                    appendSystemMessage(`📝 首夜死亡玩家发表遗言...`);
                    for (const deadId of this.state.deathsThisNight) {
                        const deadPlayer = this.players.find(x=>x.id===deadId);
                        if (deadPlayer) {
                            this.state.historyLogs.push(`[遗言] ${deadId}号（${this.getRoleName(deadPlayer.role)}）：我有话要说...`);
                        }
                    }
                }
                
                if (this.checkWin()) return;
            }
            this.state.phase = 'day_speak';
            this.state.currentSpeakerIndex = 0;
            this.state.daySpeeches = {};
            this.state.whitewolfBoomed = false;
            
        } else if (this.state.phase === 'day_speak') {
            const alive = this.getAlivePlayers();
            if (this.state.currentSpeakerIndex >= alive.length) {
                this.state.phase = 'day_vote';
                this.state.currentSpeakerIndex = 0;
                this.state.votes[this.state.day] = {};
                return;
            }
            
            const player = alive[this.state.currentSpeakerIndex];
            const box = appendLoading(player.id);
            
            // 白狼王可以自爆
            let boomPrompt = '';
            if (player.role === 'whitewolfking' && !player.dead) {
                boomPrompt = `\n[特殊能力] 你是白狼王，可以选择自爆带走一人：在 [action] 中写"自爆带走X号"即可立即执行，跳过本轮投票直接进入黑夜。不想自爆则不要写。`;
            }
            
            const msgs = [
                {role:"system", content: this.buildSysPrompt(player)},
                {role:"user", content: `[otherai]\n游戏历史记录：\n${this.buildGameContext(player)}\n\n[rule]\n现在是白天发言环节，轮到你了。\n请分析局势，伪装或者起跳带队！${boomPrompt}\n[mind] 思考\n[answer] 你的公开发言。`}
            ];
            const res = await callChat(msgs, player.model);
            box.remove();
            const p = parseResponse(res.content, false);
            
            // 检查白狼王自爆
            const boomMatch = p.action && p.action.match(/自爆带走\s*(\d+)/);
            if (player.role === 'whitewolfking' && !player.dead && boomMatch) {
                const boomTarget = parseInt(boomMatch[1]);
                const target = this.players.find(x=>x.id===boomTarget);
                if (target && !target.dead) {
                    player.dead = true;
                    target.dead = true;
                    appendSystemMessage(`💥 ${player.id}号白狼王自爆，带走了${boomTarget}号！直接进入黑夜。`);
                    this.state.historyLogs.push(`[白狼王自爆] ${player.id}号白狼王自爆，带走了${boomTarget}号。`);
                    this.state.whitewolfBoomed = true;
                    appendMessageCard(player.id, `玩家`, res.reasoning_content, p.mind, `💥 自爆带走 ${boomTarget}号！`);
                    if (this.checkWin()) return;
                    // 直接进入黑夜
                    this.state.day++;
                    this.state.nightKilled = null;
                    this.state.witchSaved = false;
                    this.state.witchPoisoned = null;
                    this.state.guardProtected = null;
                    this.state.phase = 'night_guard';
                    return;
                }
            }
            
            appendMessageCard(player.id, `玩家`, res.reasoning_content, p.mind, `🗣️ 发言: ${p.answer}`);
            this.state.historyLogs.push(`[白天发言] ${player.id}号：${p.answer}`);
            this.state.currentSpeakerIndex++;
            
        } else if (this.state.phase === 'day_vote') {
            // 排除已翻牌的白痴
            const voters = this.getAlivePlayers().filter(p => !p.idiotRevealed);
            if (this.state.currentSpeakerIndex >= voters.length) {
                this.tallyDayVotes();
                return;
            }
            
            const player = voters[this.state.currentSpeakerIndex];
            const box = appendLoading(player.id);
            const msgs = [
                {role:"system", content: this.buildSysPrompt(player)},
                {role:"user", content: `[otherai]\n游戏历史记录：\n${this.buildGameContext(player)}\n\n[rule]\n现在是投票出局环节。\n[mind] 思考\n[wodi] 你投票的玩家编号（纯数字，不能选自己，弃权填0）。`}
            ];
            const res = await callChat(msgs, player.model);
            box.remove();
            const p = parseResponse(res.content, true);
            
            appendMessageCard(player.id, `玩家`, res.reasoning_content, p.mind, `🎯 投票: <strong class="vote-result">${p.wodi}号</strong>`);
            this.state.historyLogs.push(`[投票结果] ${player.id}号 投票给了 ${p.wodi}号`);
            this.state.votes[this.state.day][player.id] = parseInt(p.wodi);
            this.state.currentSpeakerIndex++;
        }
    },

    tallyDayVotes() {
        const counts = {};
        for (const v of Object.values(this.state.votes[this.state.day])) {
            if (!isNaN(v) && v !== 0) {
                // 不能投已翻牌的白痴
                const target = this.players.find(x=>x.id===v);
                if (target && !target.idiotRevealed) {
                    counts[v] = (counts[v]||0) + 1;
                }
            }
        }
        let max = 0, cands = [];
        for (const [t,c] of Object.entries(counts)) {
            if (c > max) { max = c; cands = [t]; }
            else if (c === max) cands.push(t);
        }
        
        if (cands.length === 1) {
            const outId = parseInt(cands[0]);
            const p = this.players.find(x => x.id === outId);
            if (p) {
                // 白痴免死
                if (p.role === 'idiot' && !p.idiotRevealed) {
                    p.idiotRevealed = true;
                    appendSystemMessage(`🤡 ${outId}号（${max}票）被公投，但他是白痴！亮明身份，不死但失去投票权。`);
                    this.state.historyLogs.push(`[公投结果] ${outId}号（白痴）被公投，亮明身份，不死。`);
                } else {
                    p.dead = true;
                    appendSystemMessage(`🩸 投票结果：${outId}号（${max}票）被公投出局！`);
                    this.state.historyLogs.push(`[公投出局] ${outId}号 被公投出局。身份是：${this.getRoleName(p.role)}。`);

                    // 白天公投死亡触发技能（支持连锁触发）
                    const dayDeaths = [outId];
                    const dayDeathCause = { [outId]: 'vote' };
                    this.resolveDeathSkillChain(dayDeaths, dayDeathCause);
                }
            }
        } else {
            appendSystemMessage(cands.length > 1 ? `⚖️ ${cands.join(',')}号平票，无人出局。` : `⚖️ 全弃权，无人出局。`);
            this.state.historyLogs.push(`[公投结果] 平票或弃权，无人出局。`);
        }
        
        if (this.checkWin()) return;
        
        // Reset for next night
        this.state.day++;
        this.state.nightKilled = null;
        this.state.witchSaved = false;
        this.state.witchPoisoned = null;
        this.state.guardProtected = null;
        this.state.phase = 'night_guard';
    },

    checkWin() {
        const alive = this.getAlivePlayers();
        const wolves = alive.filter(p => ['wolf','wolfking','whitewolfking'].includes(p.role));
        const gods = alive.filter(p => ['seer','witch','hunter','guard','idiot'].includes(p.role));
        const civilians = alive.filter(p => p.role === 'civilian');
        
        if (wolves.length === 0) {
            appendSystemMessage(`🎉 游戏结束：狼人全部出局，好人阵营胜利！`);
            this.state.phase = 'postgame'; this.state.currentSpeakerIndex = 0; return true;
        }
        if (gods.length === 0 || civilians.length === 0) {
            appendSystemMessage(`😈 游戏结束：屠边成功，狼人阵营胜利！`);
            this.state.phase = 'postgame'; this.state.currentSpeakerIndex = 0; return true;
        }
        return false;
    },

    async handlePostgame() {
        if (this.state.currentSpeakerIndex === 0) {
            appendSystemMessage(`--- 🏆 赛后吐槽环节 ---`);
        }
        const player = this.players[this.state.currentSpeakerIndex];
        const box = appendLoading(player.id);
        const msgs = [
            {role:"system", content: `游戏结束！你是${player.id}号，真实身份是【${this.getRoleName(player.role)}】。`},
            {role:"user", content: `请发表赛后吐槽，可以嘲讽、炫耀或者分析。\n[mind] 思考 [answer] 公开吐槽。`}
        ];
        const res = await callChat(msgs, player.model);
        box.remove();
        const p = parseResponse(res.content, false);
        appendMessageCard(player.id, this.getRoleName(player.role), res.reasoning_content, p.mind, `💬 ${p.answer}`);
        this.state.currentSpeakerIndex++;
        if (this.state.currentSpeakerIndex >= this.players.length) {
            appendSystemMessage(`🏁 游戏彻底结束。`);
            this.state.phase = 'end'; this.state.isAuto = false;
        }
    }
};
