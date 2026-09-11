        // 6. 颜色生成器 — 保留原样
        // ================================================
        const energyColors = {
            major: { c1: '#6889A8', c2: '#4A6B8A' },
            wands: { c1: '#C4986C', c2: '#A07850' },
            cups: { c1: '#5C98C5', c2: '#3E78A5' },
            swords: { c1: '#8CA0B8', c2: '#6D8298' },
            pentacles: { c1: '#78A888', c2: '#5A8868' },
            lenormand: { c1: '#B89478', c2: '#987458' }
        };

        function getCardGradient(isMajor, suitName, deckId, cardId) {
            if (deckId === 'iching') {
                const hex = ichingData[cardId];
                if (!hex) return `linear-gradient(145deg, #B8A99A, #A89585)`;
                const upperElem = hex.lowerElement || '土';
                const lowerElem = hex.upperElement || '土';
                const upperCol = fiveElementColors[upperElem] || fiveElementColors.土;
                const lowerCol = fiveElementColors[lowerElem] || fiveElementColors.土;
                return `linear-gradient(180deg, ${upperCol.c1}, ${lowerCol.c2})`;
            }

            if (deckId === 'lenormand') {
                const p = energyColors.lenormand;
                return `linear-gradient(145deg, ${p.c1}, ${p.c2})`;
            }

            if (isMajor) {
                const p = energyColors.major;
                return `linear-gradient(145deg, ${p.c1}, ${p.c2})`;
            } else {
                let key = 'major';
                switch (suitName) {
                    case '权杖':
                        key = 'wands';
                        break;
                    case '圣杯':
                        key = 'cups';
                        break;
                    case '宝剑':
                        key = 'swords';
                        break;
                    case '星币':
                        key = 'pentacles';
                        break;
                    default:
                        key = 'major';
                }
                const p = energyColors[key];
                return `linear-gradient(145deg, ${p.c1}, ${p.c2})`;
            }
        }

        // ================================================
        // 7. 简笔画 SVGs 生成器 — 保留原样
        // ================================================
        function getCardSVG(cardId, suitName, isMajor, deckId) {
            if (deckId === 'iching') {
                const hex = ichingData[cardId];
                if (!hex) return '';
                const lines = hex.lines;
                let path = '';
                const yOffset = 50;
                const lineLength = 34;
                const gap = 8;
                for (let i = 0; i < 6; i++) {
                    const y = yOffset - (i * gap) + (i * 0.5);
                    const isYang = lines[i] === 1;
                    if (isYang) {
                        path +=
                            `<line x1="${(50 - lineLength/2)}" y1="${y}" x2="${(50 + lineLength/2)}" y2="${y}" stroke-width="2.5"/>`;
                    } else {
                        const segLen = lineLength * 0.38;
                        const gapLen = lineLength * 0.24;
                        const startX = 50 - lineLength / 2;
                        path += `<line x1="${startX}" y1="${y}" x2="${startX + segLen}" y2="${y}" stroke-width="2.5"/>`;
                        path +=
                            `<line x1="${startX + segLen + gapLen}" y1="${y}" x2="${startX + lineLength}" y2="${y}" stroke-width="2.5"/>`;
                    }
                }
                return `<svg viewBox="0 0 100 100">${path}</svg>`;
            }

            if (deckId === 'lenormand') {
                return '';
            }

            if (!isMajor) {
                let svg = '';
                switch (suitName) {
                    case '权杖':
                        svg =
                            `<svg viewBox="0 0 100 100"><path d="M50 16 L50 82" stroke-width="2.5" stroke="rgba(255,255,255,0.95)" stroke-linecap="round"/><path d="M38 34 Q38 16 50 16 Q62 16 62 34" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="14" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="44" y1="45" x2="44" y2="55" stroke-width="2" stroke="rgba(255,255,255,0.7)"/><line x1="56" y1="45" x2="56" y2="55" stroke-width="2" stroke="rgba(255,255,255,0.7)"/><path d="M35 64 Q50 58 65 64" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`;
                        break;
                    case '圣杯':
                        svg =
                            `<svg viewBox="0 0 100 100"><path d="M34 38 L34 72 A16 16 0 0 0 66 72 L66 38" stroke-width="2.5" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M34 38 L50 22 L66 38" stroke-width="2.5" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M34 38 L66 38" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><circle cx="50" cy="58" r="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M42 52 Q50 46 58 52" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`;
                        break;
                    case '宝剑':
                        svg =
                            `<svg viewBox="0 0 100 100"><path d="M50 20 L50 78" stroke-width="2.5" stroke="rgba(255,255,255,0.95)" stroke-linecap="round"/><path d="M38 56 L50 78 L62 56" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="20" r="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="40" y1="42" x2="60" y2="42" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><circle cx="50" cy="35" r="2" fill="rgba(255,255,255,0.7)"/></svg>`;
                        break;
                    case '星币':
                        svg =
                            `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="28" stroke-width="2.5" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="50" r="22" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none" stroke-dasharray="3 5"/><polygon points="50,24 57,45 80,45 62,58 68,80 50,66 32,80 38,58 20,45 43,45" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)" stroke-width="1.5"/><circle cx="50" cy="50" r="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)" stroke-width="2"/></svg>`;
                        break;
                    default:
                        svg =
                            `<svg viewBox="0 0 100 100"><rect x="25" y="25" width="50" height="50" rx="10" stroke-width="2.5"/><path d="M50 35 L50 65 M35 50 L65 50" stroke-width="2.5"/></svg>`;
                }
                return svg;
            }

            const s = 'stroke-width="2"';
            const f = 'fill="none"';
            const w = 'stroke="rgba(255,255,255,0.95)"';
            const wa = 'stroke="rgba(255,255,255,0.7)"';
            const fa = 'fill="rgba(255,255,255,0.15)"';
            const fw = 'fill="rgba(255,255,255,0.9)"';
            let svg = '';

            switch (cardId) {
                case 0:
                    svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="22" r="16" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 38 L50 62 M38 50 L50 62 L62 50" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 72 L50 62 L65 72" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="33" y1="28" x2="40" y2="22" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><circle cx="33" cy="28" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M40 72 L50 62 L60 72" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none" stroke-dasharray="2 3"/></svg>`;
                    break;
                case 1:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 15 L50 42" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="13" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><rect x="30" y="45" width="40" height="24" rx="4" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="38" cy="57" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="57" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="62" cy="57" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M50 8 L44 18 L56 18 Z" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`;
                    break;
                case 2:
                    svg = `<svg viewBox="0 0 100 100"><rect x="28" y="22" width="10" height="52" rx="3" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><rect x="62" y="22" width="10" height="52" rx="3" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><text x="33" y="22" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.7)">B</text><text x="67" y="22" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.7)">J</text><path d="M50 38 L50 74" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 30 Q50 22 65 30" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="28" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`;
                    break;
                case 3:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 16 L50 30 M42 24 L58 24" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="18" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M35 34 L28 20 L72 20 L65 34" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 34 L35 55 L65 55 L65 34" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M33 70 L33 55 M67 70 L67 55" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="44" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M40 34 L50 20 L60 34" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`;
                    break;
                case 4:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 16 L42 30 L58 30 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 33 L25 22 L75 22 L65 33" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 33 L35 52 L65 52 L65 33" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><rect x="30" y="52" width="40" height="20" rx="3" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="42" y1="56" x2="42" y2="68" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="58" y1="56" x2="58" y2="68" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="42" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`;
                    break;
                case 5:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 18 L44 34 L56 34 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M44 34 L35 48 L65 48 L56 34" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 48 L32 65 L68 65 L65 48" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="45" y1="65" x2="42" y2="76" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="55" y1="65" x2="58" y2="76" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="42" y1="76" x2="28" y2="76" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="58" y1="76" x2="72" y2="76" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="40" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="12" r="3" fill="rgba(255,255,255,0.9)"/></svg>`;
                    break;
                case 6:
                    svg = `<svg viewBox="0 0 100 100"><circle cx="36" cy="32" r="8" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="64" cy="32" r="8" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 15 L46 26 L54 26 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M46 26 L38 35 M54 26 L62 35" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M36 40 L64 40" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none" stroke-dasharray="2 3"/><circle cx="50" cy="15" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`;
                    break;
                case 7:
                    svg = `<svg viewBox="0 0 100 100"><rect x="32" y="30" width="36" height="28" rx="3" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M32 30 L16 18 L84 18 L68 30" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="42" cy="44" r="6" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="58" cy="44" r="6" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M32 58 L32 76" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M68 58 L68 76" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="32" y1="67" x2="68" y2="67" stroke-width="2" stroke="rgba(255,255,255,0.95)"/></svg>`;
                    break;
                case 8:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 68 L50 45" stroke-width="2.5" stroke="rgba(255,255,255,0.95)" fill="none" stroke-linecap="round"/><path d="M50 45 Q38 50 35 38 Q32 28 50 30 Q68 28 65 38 Q62 50 50 45" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="72" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M42 25 Q50 15 58 25" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/><text x="50" y="23" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.7)">&infin;</text></svg>`;
                    break;
                case 9:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 78 L50 48" stroke-width="2.5" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 48 Q38 58 35 38 Q32 22 50 25 Q68 22 65 38 Q62 58 50 48" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="22" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="22" r="2" fill="rgba(255,255,255,0.9)"/><path d="M38 62 L62 62" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none" stroke-dasharray="2 3"/></svg>`;
                    break;
                case 10:
                    svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="28" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="50" r="22" stroke-width="1.5" stroke="rgba(255,255,255,0.7)" fill="none" stroke-dasharray="3 5"/><circle cx="50" cy="50" r="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M50 22 L50 32" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><path d="M50 68 L50 78" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><path d="M22 50 L32 50" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><path d="M68 50 L78 50" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="16" r="2" fill="rgba(255,255,255,0.7)"/><circle cx="50" cy="84" r="2" fill="rgba(255,255,255,0.7)"/><circle cx="16" cy="50" r="2" fill="rgba(255,255,255,0.7)"/><circle cx="84" cy="50" r="2" fill="rgba(255,255,255,0.7)"/></svg>`;
                    break;
                case 11:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 28 L35 70 L65 70 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="28" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><rect x="44" y="70" width="12" height="8" rx="2" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M42 22 L58 22" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/><path d="M36 46 L64 46" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`;
                    break;
                case 12:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 15 L50 28" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 28 L65 28" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M42 28 L50 45 L58 28" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M38 45 L38 55 M62 45 L62 55" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M38 45 A12 12 0 0 0 62 45" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="15" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="62" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)"/></svg>`;
                    break;
                case 13:
                    svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="30" r="14" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="44" cy="28" r="3" fill="rgba(255,255,255,0.9)"/><circle cx="56" cy="28" r="3" fill="rgba(255,255,255,0.9)"/><path d="M46 38 L44 42 L38 42 L40 38 Z" stroke-width="1.5" stroke="rgba(255,255,255,0.7)" fill="none"/><path d="M50 44 L50 62" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 56 L50 62 L65 56" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M40 68 L50 62 L60 68" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="45" y1="64" x2="55" y2="64" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`;
                    break;
                case 14:
                    svg = `<svg viewBox="0 0 100 100"><path d="M42 22 L50 45 L42 68" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M58 22 L50 45 L58 68" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M42 22 L58 22" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M42 68 L58 68" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="42" cy="45" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="58" cy="45" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M50 12 L50 22" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/><path d="M50 68 L50 78" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`;
                    break;
                case 15:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 18 L36 40 L64 40 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M36 40 L30 62 L70 62 L64 40" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="44" cy="32" r="3" fill="rgba(255,255,255,0.9)"/><circle cx="56" cy="32" r="3" fill="rgba(255,255,255,0.9)"/><circle cx="50" cy="52" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M30 62 L35 76 L65 76 L70 62" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="38" y1="70" x2="62" y2="70" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`;
                    break;
                case 16:
                    svg = `<svg viewBox="0 0 100 100"><rect x="38" y="28" width="24" height="50" rx="2" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 12 L54 22 L46 22 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M30 18 L38 28" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><path d="M70 18 L62 28" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><circle cx="45" cy="50" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="55" cy="42" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="46" y1="30" x2="46" y2="36" stroke-width="1.5" stroke="rgba(255,255,255,0.7)"/><line x1="54" y1="30" x2="54" y2="36" stroke-width="1.5" stroke="rgba(255,255,255,0.7)"/></svg>`;
                    break;
                case 17:
                    svg = `<svg viewBox="0 0 100 100"><circle cx="30" cy="22" r="3" fill="rgba(255,255,255,0.9)"/><circle cx="44" cy="18" r="2.5" fill="rgba(255,255,255,0.9)"/><circle cx="58" cy="18" r="2.5" fill="rgba(255,255,255,0.9)"/><circle cx="70" cy="22" r="3" fill="rgba(255,255,255,0.9)"/><circle cx="38" cy="28" r="2" fill="rgba(255,255,255,0.9)"/><circle cx="50" cy="14" r="4" fill="rgba(255,255,255,0.9)"/><circle cx="62" cy="28" r="2" fill="rgba(255,255,255,0.9)"/><path d="M50 34 L50 50" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 58 L50 78 L65 58" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="62" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M38 46 Q50 38 62 46" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none" stroke-dasharray="2 3"/></svg>`;
                    break;
                case 18:
                    svg = `<svg viewBox="0 0 100 100"><path d="M65 28 A22 22 0 1 0 65 72" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 55 L45 65 M40 60 L50 70" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M60 65 L70 55" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M30 78 L50 86 L70 78" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/><circle cx="68" cy="22" r="2" fill="rgba(255,255,255,0.9)"/><circle cx="55" cy="20" r="1.5" fill="rgba(255,255,255,0.9)"/></svg>`;
                    break;
                case 19:
                    svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="22" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 16 L44 24 M50 16 L56 24 M50 16 L50 10" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M38 28 L34 22 M62 28 L66 22" stroke-width="2" stroke="rgba(255,255,255,0.7)"/><path d="M28 38 L22 34 M72 38 L78 34" stroke-width="2" stroke="rgba(255,255,255,0.7)"/><path d="M30 48 L26 54 M70 48 L74 54" stroke-width="2" stroke="rgba(255,255,255,0.7)"/><path d="M46 42 Q46 62 50 68 Q54 62 54 42" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="42" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`;
                    break;
                case 20:
                    svg = `<svg viewBox="0 0 100 100"><path d="M50 22 L44 32 L56 32 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 32 L50 52" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M38 45 L62 45" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/><path d="M28 68 L50 52 L72 68" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 78 L28 68 M65 78 L72 68" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="68" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="12" r="3" fill="rgba(255,255,255,0.9)"/><path d="M42 12 L58 12" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`;
                    break;
                case 21:
                    svg = `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="32" ry="18" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><ellipse cx="50" cy="50" rx="22" ry="12" stroke-width="1.5" stroke="rgba(255,255,255,0.7)" fill="none" stroke-dasharray="3 5"/><path d="M50 32 L50 45" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 55 L50 68" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="30" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="42" cy="50" r="2.5" fill="rgba(255,255,255,0.7)"/><circle cx="58" cy="50" r="2.5" fill="rgba(255,255,255,0.7)"/><circle cx="50" cy="38" r="2" fill="rgba(255,255,255,0.5)"/></svg>`;
                    break;
                default:
                    svg =
                        `<svg viewBox="0 0 100 100"><rect x="25" y="25" width="50" height="50" rx="10" ${s} ${w} ${f}/><circle cx="50" cy="50" r="15" ${s} ${w} ${f}/></svg>`;
            }
            return svg;
        }

        // ================================================
        // 8. 太极 SVG
        // ================================================
        function getTaijiSVG(size) {
            const s = size || 36;
            return `<span style="display:inline-block; font-size:${s}px; line-height:1; width:${s}px; height:${s}px; text-align:center;">☯</span>`;
        }

        // ================================================
        // 9. 雷诺曼 SVG — 保留原样
        // ================================================
        function getLenormandSVG(cardId) {
            const c = 'stroke="rgba(255,255,255,0.95)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"';
            const f = 'fill="rgba(255,255,255,0.15)"';
            const sw = 'stroke-width="2"';
            const svgs = [
                `<svg viewBox="0 0 100 100"><circle cx="53" cy="28" r="7" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M53 35 L53 58 M40 45 L53 58 L66 45" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M34 70 L53 58 L72 70" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="43" y1="70" x2="63" y2="70" stroke-width="2" stroke="rgba(255,255,255,0.7)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 78 L50 48" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 48 Q45 38 40 32 Q35 28 42 26 Q50 24 50 32 Q50 24 58 26 Q65 28 60 32 Q55 38 50 48" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 48 Q38 55 42 58 Q50 62 50 52 Q50 62 58 58 Q62 55 50 48" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 70 L28 50 L50 30 L72 50 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 30 L50 12" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M42 18 L58 20" stroke-width="1.5" stroke="rgba(255,255,255,0.7)" fill="none"/><path d="M28 50 L72 50" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/><circle cx="50" cy="58" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 76 L26 50 L50 24 L74 50 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><rect x="38" y="62" width="24" height="14" rx="2" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="38" y1="76" x2="62" y2="76" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="42" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 80 L50 50" stroke-width="2.5" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 50 Q30 42 32 28 Q34 18 50 22 Q66 18 68 28 Q70 42 50 50" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="38" cy="24" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="62" cy="24" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="20" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M35 55 Q50 35 65 55" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M32 45 Q48 28 68 45" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M30 35 Q48 20 70 35" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 55 L35 64 M65 55 L65 64" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M30 50 Q45 30 70 50" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M25 58 Q45 38 75 58" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="42" cy="50" r="2.5" fill="rgba(255,255,255,0.9)"/><circle cx="58" cy="46" r="2.5" fill="rgba(255,255,255,0.9)"/><line x1="50" y1="62" x2="50" y2="72" stroke-width="2" stroke="rgba(255,255,255,0.7)"/></svg>`,
                `<svg viewBox="0 0 100 100"><rect x="35" y="32" width="30" height="42" rx="4" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M35 32 L50 54 L65 32" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="42" y1="44" x2="58" y2="44" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="42" y1="52" x2="58" y2="52" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 26 L50 72" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="34" cy="38" r="5" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="66" cy="38" r="5" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="24" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="34" cy="58" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="66" cy="58" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 22 L50 65" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 22 Q36 34 38 52 Q40 60 50 65" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="38" y1="42" x2="28" y2="38" stroke-width="1.5" stroke="rgba(255,255,255,0.7)"/><line x1="42" y1="55" x2="32" y2="58" stroke-width="1.5" stroke="rgba(255,255,255,0.7)"/><circle cx="52" cy="22" r="3" fill="rgba(255,255,255,0.9)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M30 70 Q45 50 50 45 Q55 50 70 70" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="40" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><path d="M50 45 L50 35" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="34" y1="66" x2="38" y2="54" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="66" y1="66" x2="62" y2="54" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M28 48 Q50 28 72 48" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="34" cy="46" r="3" fill="rgba(255,255,255,0.9)"/><circle cx="66" cy="46" r="3" fill="rgba(255,255,255,0.9)"/><path d="M28 48 L22 58 L32 58" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M72 48 L78 58 L68 58" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="42" r="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="14" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="44" cy="34" r="2.5" fill="rgba(255,255,255,0.9)"/><circle cx="56" cy="34" r="2.5" fill="rgba(255,255,255,0.9)"/><path d="M50 52 L50 72" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M40 62 L50 52 L60 62" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M44 68 L50 72 L56 68" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="42" r="10" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M38 42 L62 42" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><path d="M50 52 Q30 72 50 80 Q70 72 50 52" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="40" cy="58" r="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="60" cy="58" r="2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="44" r="24" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="38" cy="38" r="3" fill="rgba(255,255,255,0.9)"/><circle cx="62" cy="38" r="3" fill="rgba(255,255,255,0.9)"/><path d="M50 68 Q38 74 43 78 Q50 85 57 78 Q62 74 50 68" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="50" y1="20" x2="50" y2="26" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="34" y1="28" x2="28" y2="24" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="66" y1="28" x2="72" y2="24" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><polygon points="50,24 58,44 78,44 62,58 68,78 50,66 32,78 38,58 22,44 42,44" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 24 L42 46 L58 46 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 24 L50 46" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M42 46 L42 76" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M58 46 L58 76" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="46" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="38" y1="64" x2="62" y2="64" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="42" r="12" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="44" cy="40" r="2.5" fill="rgba(255,255,255,0.9)"/><circle cx="56" cy="40" r="2.5" fill="rgba(255,255,255,0.9)"/><path d="M50 54 L50 70" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="40" y1="63" x2="60" y2="63" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="44" y1="72" x2="56" y2="72" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><rect x="30" y="30" width="40" height="52" rx="4" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M30 30 L50 50 L70 30" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><rect x="40" y="54" width="20" height="22" rx="2" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/><circle cx="50" cy="38" r="2" fill="rgba(255,255,255,0.9)"/></svg>`,
                `<svg viewBox="0 0 100 100"><rect x="26" y="38" width="48" height="40" rx="4" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M26 38 L50 26 L74 38" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="34" y1="52" x2="66" y2="52" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="34" y1="62" x2="58" y2="62" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><circle cx="50" cy="46" r="2" fill="rgba(255,255,255,0.9)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M36 72 L50 28 L64 72 Z" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M42 72 L60 48" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="40" y1="64" x2="60" y2="64" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><circle cx="50" cy="42" r="2" fill="rgba(255,255,255,0.9)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 28 L50 78" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 28 L30 50 M50 28 L70 50" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="28" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="30" cy="50" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="70" cy="50" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="38" r="8" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="40" cy="36" r="2" fill="rgba(255,255,255,0.9)"/><circle cx="60" cy="36" r="2" fill="rgba(255,255,255,0.9)"/><path d="M50 46 L50 66" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M46 66 L50 60 L54 66" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="40" y1="56" x2="60" y2="56" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 24 Q68 44 50 64 Q32 44 50 24" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="44" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="36" y1="38" x2="50" y2="50" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="64" y1="38" x2="50" y2="50" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="22" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="50" r="8" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="50" y1="28" x2="50" y2="38" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="50" y1="62" x2="50" y2="72" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="28" y1="50" x2="38" y2="50" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="62" y1="50" x2="72" y2="50" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><rect x="32" y="28" width="36" height="50" rx="4" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="38" y1="38" x2="62" y2="38" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="38" y1="48" x2="62" y2="48" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="38" y1="58" x2="55" y2="58" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><rect x="30" y="28" width="40" height="50" rx="4" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 24 L50 20" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="42" y1="20" x2="58" y2="20" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="46" r="8" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M50 54 L50 62" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="44" y1="66" x2="56" y2="66" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="32" r="10" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="44" cy="28" r="2.5" fill="rgba(255,255,255,0.9)"/><circle cx="56" cy="28" r="2.5" fill="rgba(255,255,255,0.9)"/><path d="M50 42 L50 72" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M40 56 L50 42 L60 56" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="44" y1="64" x2="56" y2="64" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="32" r="10" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="44" cy="28" r="2.5" fill="rgba(255,255,255,0.9)"/><circle cx="56" cy="28" r="2.5" fill="rgba(255,255,255,0.9)"/><path d="M50 42 L50 72" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M40 56 L50 42 L60 56" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M42 62 L50 52 L58 62" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M50 78 L50 42" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M30 52 Q48 30 68 52" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="40" cy="48" r="3.5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><circle cx="60" cy="48" r="3.5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="45" y1="44" x2="55" y2="54" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="22" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="50" y1="28" x2="50" y2="22" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="50" y1="78" x2="50" y2="72" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="28" y1="50" x2="22" y2="50" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="78" y1="50" x2="72" y2="50" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="34" y1="34" x2="26" y2="26" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="66" y1="66" x2="74" y2="74" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="66" y1="34" x2="74" y2="26" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="34" y1="66" x2="26" y2="74" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><circle cx="50" cy="50" r="5" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M75 28 A28 28 0 1 0 75 72" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M25 35 A14 14 0 0 0 25 65" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><path d="M28 44 A5 5 0 0 1 28 56" stroke-width="1.5" stroke="rgba(255,255,255,0.5)" fill="none"/><circle cx="65" cy="28" r="2.5" fill="rgba(255,255,255,0.9)"/><circle cx="72" cy="50" r="2" fill="rgba(255,255,255,0.9)"/><circle cx="65" cy="65" r="2" fill="rgba(255,255,255,0.9)"/></svg>`,
                `<svg viewBox="0 0 100 100"><circle cx="70" cy="50" r="10" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="60" y1="50" x2="24" y2="50" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="28" y1="42" x2="36" y2="42" stroke-width="1.5" stroke="rgba(255,255,255,0.95)"/><line x1="28" y1="58" x2="36" y2="58" stroke-width="1.5" stroke="rgba(255,255,255,0.95)"/><circle cx="70" cy="50" r="4" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="24" y1="50" x2="28" y2="45" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="24" y1="50" x2="28" y2="55" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><path d="M30 56 Q50 36 70 56 Q50 76 30 56" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><circle cx="44" cy="54" r="3" fill="rgba(255,255,255,0.9)"/><circle cx="56" cy="54" r="3" fill="rgba(255,255,255,0.9)"/><line x1="30" y1="56" x2="25" y2="50" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="30" y1="56" x2="25" y2="62" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`,
                `<svg viewBox="0 0 100 100"><line x1="50" y1="26" x2="50" y2="76" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><path d="M32 58 Q50 78 68 58" stroke-width="2" stroke="rgba(255,255,255,0.95)" fill="none"/><line x1="32" y1="58" x2="28" y2="55" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="68" y1="58" x2="72" y2="55" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><circle cx="50" cy="26" r="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/></svg>`,
                `<svg viewBox="0 0 100 100"><line x1="50" y1="22" x2="50" y2="78" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><line x1="28" y1="50" x2="72" y2="50" stroke-width="2" stroke="rgba(255,255,255,0.95)"/><circle cx="50" cy="50" r="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.95)"/><line x1="42" y1="22" x2="58" y2="78" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/><line x1="58" y1="22" x2="42" y2="78" stroke-width="1.5" stroke="rgba(255,255,255,0.5)"/></svg>`
            ];
            return svgs[cardId] || svgs[0];
        }

        // ================================================
