// D4NMS — EXPLOSIVE Scroll Animations
(function () {
    'use strict';

    // ─── Inject global styles ────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        .section-title { opacity: 0; position: relative; }
        .section-title.explode-in {
            animation: titleExplode 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes titleExplode {
            0%   { opacity:0; transform: scale(2) skewX(-10deg); filter: blur(20px) brightness(3); }
            40%  { opacity:1; transform: scale(0.95) skewX(2deg); filter: blur(0) brightness(2); }
            70%  { transform: scale(1.04) skewX(-1deg); filter: brightness(1.5); }
            100% { opacity:1; transform: scale(1) skewX(0); filter: brightness(1); }
        }

        .feature-card { opacity: 0; transform: scale(0) rotate(var(--rot,0deg)); }
        .feature-card.blast-in {
            animation: cardBlast 0.55s cubic-bezier(0.34,1.8,0.64,1) forwards;
        }
        @keyframes cardBlast {
            0%   { opacity:0; transform: scale(0) rotate(var(--rot,0deg)) translateY(40px); filter: brightness(3) blur(8px); }
            50%  { opacity:1; filter: brightness(1.8); }
            75%  { transform: scale(1.08) rotate(0) translateY(-4px); }
            100% { opacity:1; transform: scale(1) rotate(0) translateY(0); filter: brightness(1); }
        }

        .screenshot-item { opacity: 0; clip-path: inset(50%); }
        .screenshot-item.shatter-in {
            animation: shatterIn 0.7s cubic-bezier(0.25,0.46,0.45,0.94) forwards;
        }
        @keyframes shatterIn {
            0%   { opacity:1; clip-path: inset(50%); filter: brightness(5); }
            40%  { clip-path: inset(0%); filter: brightness(2); box-shadow: 0 0 60px rgba(33,150,243,0.9); }
            70%  { transform: scale(1.05); filter: brightness(1.3); }
            100% { opacity:1; clip-path: inset(0%); transform: scale(1); filter: brightness(1); }
        }

        .tech-column { opacity: 0; }
        .tech-column.slam-in {
            animation: slamIn 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes slamIn {
            0%   { opacity:0; transform: translateY(-120px) scaleY(1.5); filter: blur(10px) brightness(3); }
            50%  { opacity:1; transform: translateY(12px) scaleY(0.92); filter: brightness(1.5); }
            75%  { transform: translateY(-5px) scaleY(1.03); }
            100% { opacity:1; transform: translateY(0) scaleY(1); filter: brightness(1); }
        }

        .tech-list li { opacity: 0; transform: translateX(-30px); transition: color 0.2s, padding-left 0.2s; }
        .tech-list li.zap-in {
            animation: zapIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes zapIn {
            0%   { opacity:0; transform: translateX(-50px); filter: brightness(4) blur(4px); }
            100% { opacity:1; transform: translateX(0); filter: brightness(1); }
        }
        .tech-list li:hover { color:#fff !important; padding-left:10px; }

        .requirements-card { opacity: 0; position: relative; }
        .requirements-card.crash-in {
            animation: crashIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes crashIn {
            0%   { opacity:0; transform: scale(0.3) skewY(15deg); filter: brightness(4) blur(12px); }
            50%  { transform: scale(1.1) skewY(-3deg); filter: brightness(2); }
            75%  { transform: scale(0.97) skewY(1deg); }
            100% { opacity:1; transform: scale(1) skewY(0); filter: brightness(1); }
        }
        .requirements-card li { opacity:0; transform: translateX(30px); }
        .requirements-card li.zap-right {
            animation: zapRight 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        @keyframes zapRight {
            0%   { opacity:0; transform: translateX(50px); filter: brightness(4) blur(4px); }
            100% { opacity:1; transform: translateX(0); filter: brightness(1); }
        }
        .requirements-card li:hover { color:#fff !important; padding-left:8px; }
        .requirements-card::before {
            content:''; position:absolute; inset:0; border-radius:20px;
            background: linear-gradient(135deg,rgba(76,175,80,0.3),rgba(33,150,243,0.2));
            opacity:0; transition:opacity 0.4s; pointer-events:none;
        }
        .requirements-card:hover::before { opacity:1; }

        .download-section h2, .download-section p { opacity:0; }
        .download-section h2.explode-in, .download-section p.explode-in {
            animation: titleExplode 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .btn-download { opacity:0; transform:scale(0.5); }
        .btn-download.btn-blast {
            animation: btnBlast 0.7s cubic-bezier(0.34,2,0.64,1) forwards;
        }
        @keyframes btnBlast {
            0%   { opacity:0; transform:scale(0.2); filter:brightness(5) blur(8px); }
            60%  { transform:scale(1.15); filter:brightness(1.5); }
            80%  { transform:scale(0.95); }
            100% { opacity:1; transform:scale(1); filter:brightness(1); }
        }

        @keyframes shockwave {
            0%   { transform:translate(-50%,-50%) scale(0); opacity:0.9; }
            100% { transform:translate(-50%,-50%) scale(5); opacity:0; }
        }
        @keyframes ringPulse {
            0%   { transform:translate(-50%,-50%) scale(1); opacity:0.7; }
            100% { transform:translate(-50%,-50%) scale(3.5); opacity:0; }
        }
        @keyframes neonLine {
            0%   { background-position:200% 0; opacity:0.4; }
            50%  { opacity:1; }
            100% { background-position:-200% 0; opacity:0.4; }
        }

        .features-section, .screenshots-section, .tech-stack-section, .requirements-section {
            position:relative;
        }
        .features-section::before, .screenshots-section::before,
        .tech-stack-section::before, .requirements-section::before {
            content:''; position:absolute; top:0; left:0; right:0; height:3px;
            background: linear-gradient(90deg,transparent,#2196f3 20%,#21cbf3 50%,#9c27b0 80%,transparent);
            background-size:200% 100%;
            animation: neonLine 2.5s linear infinite;
            z-index:2;
        }

        .tech-column { position:relative; }
        .tech-column::after {
            content:''; position:absolute; inset:-1px; border-radius:21px;
            background: linear-gradient(135deg,#2196f3,#9c27b0,#21cbf3,#4caf50,#2196f3);
            background-size:300% 300%;
            animation: rotateBorder 3s linear infinite;
            z-index:-1; opacity:0.5;
        }
        @keyframes rotateBorder {
            0%   { background-position:0% 0%; }
            100% { background-position:300% 300%; }
        }


        .screenshot-item { transition: transform 0.35s ease, box-shadow 0.35s ease !important; }
        .screenshot-item:hover {
            box-shadow: 0 0 0 2px #2196f3, 0 0 40px rgba(33,150,243,0.6), 0 20px 40px rgba(0,0,0,0.7) !important;
            transform: scale(1.04) !important;
        }

        .download-section { position:relative; overflow:hidden; }
        .download-section::after {
            content:''; position:absolute; inset:0; pointer-events:none;
            background:radial-gradient(ellipse at 50% 80%,rgba(33,150,243,0.1) 0%,transparent 60%);
            animation: breathe 4s ease-in-out infinite;
        }
        @keyframes breathe {
            0%,100% { opacity:0.5; transform:scale(1); }
            50%      { opacity:1;   transform:scale(1.1); }
        }
    `;
    document.head.appendChild(style);

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function onVisible(el, cb, threshold = 0.1) {
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) { cb(el); obs.unobserve(el); }
        }, { threshold });
        obs.observe(el);
    }

    function shockwave(section, color = '#2196f3') {
        const rect = section.getBoundingClientRect();
        const sw = document.createElement('div');
        sw.style.cssText = `
            position:fixed; pointer-events:none; z-index:9999;
            left:${rect.left+rect.width/2}px; top:${rect.top+60}px;
            width:120px; height:120px; border-radius:50%;
            border:3px solid ${color}; box-shadow:0 0 20px ${color};
            animation:shockwave 0.9s ease-out forwards;
        `;
        document.body.appendChild(sw);
        // Second ring
        const sw2 = sw.cloneNode();
        sw2.style.animationDelay = '0.15s';
        sw2.style.borderColor = color + '88';
        document.body.appendChild(sw2);
        setTimeout(() => { sw.remove(); sw2.remove(); }, 1100);
    }

    function explodeParticles(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
            const dist  = 40 + Math.random() * 120;
            const size  = 2 + Math.random() * 5;
            p.style.cssText = `
                position:fixed; pointer-events:none; z-index:9999;
                left:${x}px; top:${y}px;
                width:${size}px; height:${size}px; border-radius:50%;
                background:${color}; box-shadow:0 0 ${size*2}px ${color};
                transition: transform ${0.5+Math.random()*0.5}s cubic-bezier(0.25,0.46,0.45,0.94),
                            opacity ${0.4+Math.random()*0.4}s ease;
            `;
            document.body.appendChild(p);
            requestAnimationFrame(() => {
                p.style.transform = `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px) scale(0)`;
                p.style.opacity   = '0';
            });
            setTimeout(() => p.remove(), 1000);
        }
    }

    function electricSpark(el, color = '#21cbf3') {
        const rect = el.getBoundingClientRect();
        for (let i = 0; i < 3; i++) {
            setTimeout(() => explodeParticles(
                rect.left + Math.random() * rect.width,
                rect.top  + Math.random() * rect.height * 0.3,
                color, 8
            ), i * 80);
        }
    }

    // ─── 1. Section Titles ───────────────────────────────────────────────────
    document.querySelectorAll('.section-title').forEach(el => {
        onVisible(el, t => {
            const r = t.getBoundingClientRect();
            explodeParticles(r.left + r.width/2, r.top + r.height/2, '#2196f3', 18);
            t.classList.add('explode-in');
            setTimeout(() => {
                t.classList.remove('explode-in');
                t.style.opacity = '1';
                t.style.transform = 'none';
                t.style.filter = 'none';
                // Force green color to stay — pick based on parent section
                const section = t.closest('section');
                const colors = {
                    'features-section':    ['#00ff88','#a8ff78','#69ff47','#00e676'],
                    'screenshots-section': ['#69ff47','#b2ff59','#00ff88','#76ff03'],
                    'tech-stack-section':  ['#00e676','#ffd93d','#a8ff78','#00ff88'],
                    'requirements-section':['#b2ff59','#00ff88','#69ff47','#a8ff78'],
                };
                let palette = colors['features-section'];
                if (section) {
                    for (const cls of Object.keys(colors)) {
                        if (section.classList.contains(cls)) { palette = colors[cls]; break; }
                    }
                }
                let ci = 0;
                t.style.color = palette[0];
                const colorInterval = setInterval(() => {
                    ci = (ci + 1) % palette.length;
                    t.style.color = palette[ci];
                }, 750);
                // Store interval id on element to avoid duplicates
                if (t._colorInterval) clearInterval(t._colorInterval);
                t._colorInterval = colorInterval;
            }, 650);
        });
    });

    // ─── 2. Feature Cards ────────────────────────────────────────────────────
    const rots = ['-8deg','5deg','-5deg','7deg','-6deg','4deg'];
    document.querySelectorAll('.feature-card').forEach((c,i) => c.style.setProperty('--rot', rots[i]||'0deg'));

    onVisible(document.querySelector('.features-grid'), grid => {
        shockwave(grid, '#2196f3');
        grid.querySelectorAll('.feature-card').forEach((card,i) => {
            setTimeout(() => {
                card.classList.add('blast-in');
                electricSpark(card, '#2196f3');
            }, i * 100);
        });
    });

    // ─── 3. Screenshots ──────────────────────────────────────────────────────
    onVisible(document.querySelector('.screenshots-grid'), grid => {
        shockwave(grid, '#4ecdc4');
        grid.querySelectorAll('.screenshot-item').forEach((item,i) => {
            setTimeout(() => {
                item.classList.add('shatter-in');
                electricSpark(item, '#4ecdc4');
            }, i * 130);
        });
    });

    // ─── 4. Tech Columns ─────────────────────────────────────────────────────
    onVisible(document.querySelector('.tech-stack-section'), section => {
        shockwave(section, '#9c27b0');
        section.querySelectorAll('.tech-column').forEach((col,i) => {
            setTimeout(() => {
                col.classList.add('slam-in');
                electricSpark(col, '#9c27b0');
                col.querySelectorAll('.tech-list li').forEach((li,j) => {
                    if (!li.querySelector('.li-pfx')) {
                        const pfx = document.createElement('span');
                        pfx.className = 'li-pfx';
                        pfx.style.color = '#4caf50';
                        pfx.textContent = '> ';
                        li.prepend(pfx);
                    }
                    setTimeout(() => li.classList.add('zap-in'), 400 + j*100);
                });
            }, i * 180);
        });
    });

    // ─── 5. Requirements ─────────────────────────────────────────────────────
    onVisible(document.querySelector('.requirements-section'), section => {
        shockwave(section, '#4caf50');
        section.querySelectorAll('.requirements-card').forEach((card,i) => {
            setTimeout(() => {
                card.classList.add('crash-in');
                electricSpark(card, '#4caf50');
                card.querySelectorAll('li').forEach((li,j) => {
                    setTimeout(() => li.classList.add('zap-right'), 400 + j*90);
                });
            }, i * 220);
        });
    });

    // ─── 6. Download Section ─────────────────────────────────────────────────
    onVisible(document.querySelector('.requirements-section'), section => {
        shockwave(section, '#ffd93d');
        explodeParticles(window.innerWidth/2, section.getBoundingClientRect().top+60, '#ffd93d', 35);

        const h2  = section.querySelector('.download-title');
        const p   = section.querySelector('.download-subtitle');
        const btn = section.querySelector('.btn-download');

        if (h2) { h2.style.animationDelay='0.1s'; h2.classList.add('explode-in'); }
        if (p)  { p.style.animationDelay='0.25s'; p.classList.add('explode-in'); }
        if (btn) {
            setTimeout(() => {
                btn.classList.add('btn-blast');
                electricSpark(btn, '#ffd93d');
                setInterval(() => {
                    const r = btn.getBoundingClientRect();
                    const ring = document.createElement('div');
                    ring.style.cssText = `
                        position:fixed; pointer-events:none; z-index:9999;
                        left:${r.left+r.width/2}px; top:${r.top+r.height/2}px;
                        width:${r.width}px; height:${r.height}px; border-radius:50px;
                        border:2px solid rgba(33,150,243,0.7);
                        animation:ringPulse 1.5s ease-out forwards;
                    `;
                    document.body.appendChild(ring);
                    setTimeout(() => ring.remove(), 1550);
                }, 2200);
            }, 500);
        }
    });


    // ─── 8. Click particles everywhere ───────────────────────────────────────
    document.addEventListener('click', e => {
        explodeParticles(e.clientX, e.clientY, '#2196f3', 14);
    });

    // ─── 9. Fast-scroll particles ────────────────────────────────────────────
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const now = window.scrollY;
        const speed = Math.abs(now - lastScroll);
        if (speed > 25) {
            explodeParticles(
                Math.random()*window.innerWidth,
                speed > 80 ? 10 : window.innerHeight-10,
                speed > 80 ? '#ff6b6b' : '#2196f3',
                Math.min(speed/8, 10)
            );
        }
        lastScroll = now;
    });




})();