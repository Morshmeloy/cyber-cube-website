// D4NMS — Section Background Animations
// Each section gets its own unique 3D canvas animation
(function () {
    'use strict';

    // ── Utility: create canvas behind a section ──────────────────────────────
    function createCanvas(section) {
        const cv = document.createElement('canvas');
        cv.style.cssText = `
            position:absolute; top:0; left:0;
            width:100%; height:100%;
            pointer-events:none; z-index:0;
            opacity:0.55;
        `;
        section.style.position = 'relative';
        section.style.overflow = 'hidden';
        // Make sure content sits above canvas
        const container = section.querySelector('.container');
        if (container) container.style.position = 'relative', container.style.zIndex = '1';
        section.insertBefore(cv, section.firstChild);
        return cv;
    }

    function resizeCanvas(cv, section) {
        cv.width  = section.offsetWidth;
        cv.height = section.offsetHeight;
    }

    // ════════════════════════════════════════════════════════════════════════
    // 1. FEATURES — Floating hexagonal network grid (protocol topology)
    // ════════════════════════════════════════════════════════════════════════
    function initFeatures(section) {
        const cv = createCanvas(section);
        const ctx = cv.getContext('2d');
        let W, H, nodes = [], t = 0;

        function resize() {
            W = cv.width  = section.offsetWidth;
            H = cv.height = section.offsetHeight;
            nodes = [];
            const cols = Math.ceil(W / 90) + 2;
            const rows = Math.ceil(H / 78) + 2;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const ox = (r % 2) * 45;
                    nodes.push({
                        bx: c * 90 + ox - 45,
                        by: r * 78 - 39,
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.003 + Math.random() * 0.004,
                        pulse: Math.random() < 0.15,
                        pulsePhase: Math.random() * Math.PI * 2,
                    });
                }
            }
        }

        function drawHex(ctx, cx, cy, r, alpha, glow) {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i - Math.PI / 6;
                i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
                        : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
            }
            ctx.closePath();
            if (glow) {
                ctx.strokeStyle = `rgba(33,150,243,${alpha * 1.5})`;
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#2196f3';
                ctx.shadowBlur = 12;
            } else {
                ctx.strokeStyle = `rgba(33,150,243,${alpha * 0.35})`;
                ctx.lineWidth = 0.8;
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        function frame() {
            t += 0.012;
            ctx.clearRect(0, 0, W, H);
            nodes.forEach(n => {
                n.pulsePhase += n.speed;
                const wave = Math.sin(n.bx * 0.015 + n.by * 0.01 + t) * 0.5 + 0.5;
                const y = n.by + Math.sin(n.phase + t * 0.4) * 6;
                const alpha = 0.2 + wave * 0.5;
                const r = 32 + wave * 8;
                drawHex(ctx, n.bx, y, r, alpha, n.pulse && Math.sin(n.pulsePhase) > 0.7);

                // Dot at center for active nodes
                if (n.pulse) {
                    const pa = (Math.sin(n.pulsePhase) + 1) / 2;
                    ctx.beginPath();
                    ctx.arc(n.bx, y, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(33,150,243,${pa * 0.9})`;
                    ctx.shadowColor = '#21cbf3';
                    ctx.shadowBlur = 8;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });
        }

        resize();
        window.addEventListener('resize', resize);
        return frame;
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. SCREENSHOTS — Matrix digital rain (data streams)
    // ════════════════════════════════════════════════════════════════════════
    function initScreenshots(section) {
        const cv = createCanvas(section);
        cv.style.opacity = '0.35';
        const ctx = cv.getContext('2d');
        let W, H, cols = [], fontSize = 13;

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+{}[]|<>~`ПИНГСНМП'.split('');

        function resize() {
            W = cv.width  = section.offsetWidth;
            H = cv.height = section.offsetHeight;
            const numCols = Math.floor(W / fontSize);
            cols = Array.from({ length: numCols }, () => ({
                y: Math.random() * -H,
                speed: 1.5 + Math.random() * 3,
                length: 8 + Math.floor(Math.random() * 20),
                chars: Array.from({ length: 30 }, () => chars[Math.floor(Math.random() * chars.length)]),
                mutTimer: 0,
            }));
        }

        function frame() {
            ctx.fillStyle = 'rgba(10,14,39,0.1)';
            ctx.fillRect(0, 0, W, H);

            cols.forEach((col, i) => {
                col.y += col.speed;
                col.mutTimer++;
                if (col.mutTimer > 4) {
                    col.chars[Math.floor(Math.random() * col.chars.length)] =
                        chars[Math.floor(Math.random() * chars.length)];
                    col.mutTimer = 0;
                }
                if (col.y > H + col.length * fontSize) {
                    col.y = -col.length * fontSize;
                    col.speed = 1.5 + Math.random() * 3;
                }

                col.chars.slice(0, col.length).forEach((ch, j) => {
                    const x = i * fontSize;
                    const y = col.y - j * fontSize;
                    if (y < -fontSize || y > H) return;
                    const isHead = j === 0;
                    const fade = 1 - j / col.length;
                    ctx.font = `${fontSize}px monospace`;
                    if (isHead) {
                        ctx.fillStyle = `rgba(255,255,255,${fade})`;
                        ctx.shadowColor = '#21cbf3';
                        ctx.shadowBlur = 8;
                    } else {
                        ctx.fillStyle = `rgba(33,150,243,${fade * 0.7})`;
                        ctx.shadowBlur = 0;
                    }
                    ctx.fillText(ch, x, y);
                    ctx.shadowBlur = 0;
                });
            });
        }

        resize();
        window.addEventListener('resize', resize);
        return frame;
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. TECH STACK — 3D Rotating wireframe cube / circuit board
    // ════════════════════════════════════════════════════════════════════════
    function initTechStack(section) {
        const cv = createCanvas(section);
        cv.style.opacity = '0.5';
        const ctx = cv.getContext('2d');
        let W, H, t = 0;

        // Circuit nodes
        let circuits = [];

        function resize() {
            W = cv.width  = section.offsetWidth;
            H = cv.height = section.offsetHeight;
            circuits = [];
            const count = Math.floor((W * H) / 18000);
            for (let i = 0; i < count; i++) {
                circuits.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    size: 3 + Math.random() * 5,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.02 + Math.random() * 0.03,
                    connections: [],
                    active: Math.random() < 0.3,
                });
            }
            // Build connections
            circuits.forEach((a, i) => {
                circuits.forEach((b, j) => {
                    if (i >= j) return;
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 160 && Math.random() < 0.4) {
                        a.connections.push(j);
                    }
                });
            });
        }

        // Packet animation
        let packets = [];
        function spawnPacket() {
            if (circuits.length < 2) return;
            const a = circuits[Math.floor(Math.random() * circuits.length)];
            if (!a.connections.length) return;
            const bIdx = a.connections[Math.floor(Math.random() * a.connections.length)];
            const b = circuits[bIdx];
            packets.push({ x1:a.x, y1:a.y, x2:b.x, y2:b.y, t:0, speed:0.02+Math.random()*0.03 });
        }

        function frame() {
            t += 0.008;
            ctx.clearRect(0, 0, W, H);

            // Draw connections
            circuits.forEach((a, i) => {
                a.connections.forEach(j => {
                    const b = circuits[j];
                    const wave = Math.sin(t * 2 + i * 0.5) * 0.5 + 0.5;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    // Orthogonal circuit-board style lines
                    const mx = a.x + (b.x - a.x) * 0.5;
                    ctx.lineTo(mx, a.y);
                    ctx.lineTo(mx, b.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(156,39,176,${0.15 + wave * 0.2})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                });
            });

            // Draw nodes
            circuits.forEach((n, i) => {
                n.phase += n.speed;
                const pulse = (Math.sin(n.phase) + 1) / 2;
                const alpha = n.active ? 0.5 + pulse * 0.5 : 0.2 + pulse * 0.15;
                const r = n.size * (n.active ? 1 + pulse * 0.5 : 1);

                // Square node (circuit style)
                ctx.beginPath();
                ctx.rect(n.x - r, n.y - r, r * 2, r * 2);
                ctx.strokeStyle = n.active
                    ? `rgba(33,150,243,${alpha})`
                    : `rgba(156,39,176,${alpha})`;
                ctx.lineWidth = n.active ? 1.5 : 0.8;
                if (n.active) { ctx.shadowColor = '#2196f3'; ctx.shadowBlur = 10; }
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Inner dot
                ctx.beginPath();
                ctx.arc(n.x, n.y, r * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = n.active
                    ? `rgba(33,150,243,${alpha})`
                    : `rgba(156,39,176,${alpha * 0.5})`;
                ctx.fill();
            });

            // Packets
            if (Math.random() < 0.05) spawnPacket();
            packets = packets.filter(p => p.t < 1);
            packets.forEach(p => {
                p.t += p.speed;
                const x = p.x1 + (p.x2 - p.x1) * p.t;
                const y = p.y1 + (p.y2 - p.y1) * p.t;
                const grd = ctx.createRadialGradient(x,y,0,x,y,8);
                grd.addColorStop(0, 'rgba(255,255,255,0.9)');
                grd.addColorStop(0.4, 'rgba(33,150,243,0.6)');
                grd.addColorStop(1, 'transparent');
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();
            });
        }

        resize();
        window.addEventListener('resize', resize);
        return frame;
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. REQUIREMENTS — Particle field with orbiting rings (system specs feel)
    // ════════════════════════════════════════════════════════════════════════
    function initRequirements(section) {
        const cv = createCanvas(section);
        cv.style.opacity = '0.45';
        const ctx = cv.getContext('2d');
        let W, H, t = 0;
        let orbs = [], stars = [];

        function resize() {
            W = cv.width  = section.offsetWidth;
            H = cv.height = section.offsetHeight;

            // Background stars
            stars = Array.from({ length: 80 }, () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 0.5 + Math.random() * 1.5,
                phase: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.02,
            }));

            // Orbiting systems
            orbs = [
                { cx: W * 0.2,  cy: H * 0.5, rings: [
                    { r:60,  speed:0.008, dots:5, color:'rgba(76,175,80,' },
                    { r:100, speed:-0.005, dots:3, color:'rgba(33,150,243,' },
                ]},
                { cx: W * 0.8,  cy: H * 0.5, rings: [
                    { r:70,  speed:-0.007, dots:4, color:'rgba(33,150,243,' },
                    { r:110, speed:0.004,  dots:6, color:'rgba(76,175,80,' },
                ]},
                { cx: W * 0.5,  cy: H * 0.15, rings: [
                    { r:45, speed:0.012, dots:3, color:'rgba(156,39,176,' },
                ]},
            ];
            orbs.forEach(o => {
                o.rings.forEach(ring => {
                    ring.angle = Math.random() * Math.PI * 2;
                });
            });
        }

        function frame() {
            t += 0.008;
            ctx.clearRect(0, 0, W, H);

            // Stars
            stars.forEach(s => {
                s.phase += s.speed;
                const a = (Math.sin(s.phase) + 1) / 2;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(180,210,255,${a * 0.5})`;
                ctx.fill();
            });

            // Orbiting rings
            orbs.forEach(o => {
                o.rings.forEach(ring => {
                    ring.angle += ring.speed;

                    // Draw orbit circle
                    ctx.beginPath();
                    ctx.arc(o.cx, o.cy, ring.r, 0, Math.PI * 2);
                    ctx.strokeStyle = ring.color + '0.12)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Dots on orbit
                    for (let d = 0; d < ring.dots; d++) {
                        const a = ring.angle + (d / ring.dots) * Math.PI * 2;
                        const x = o.cx + ring.r * Math.cos(a);
                        const y = o.cy + ring.r * Math.sin(a);
                        const grd = ctx.createRadialGradient(x,y,0,x,y,6);
                        grd.addColorStop(0, ring.color + '0.9)');
                        grd.addColorStop(1, 'transparent');
                        ctx.beginPath();
                        ctx.arc(x, y, 4, 0, Math.PI * 2);
                        ctx.fillStyle = grd;
                        ctx.shadowColor = ring.color + '1)';
                        ctx.shadowBlur = 8;
                        ctx.fill();
                        ctx.shadowBlur = 0;

                        // Tail
                        for (let tail = 1; tail <= 5; tail++) {
                            const ta = a - (tail * 0.12 * Math.sign(ring.speed));
                            const tx = o.cx + ring.r * Math.cos(ta);
                            const ty = o.cy + ring.r * Math.sin(ta);
                            ctx.beginPath();
                            ctx.arc(tx, ty, 3 - tail * 0.4, 0, Math.PI * 2);
                            ctx.fillStyle = ring.color + (0.4 - tail * 0.07) + ')';
                            ctx.fill();
                        }
                    }

                    // Core center
                    const pg = ctx.createRadialGradient(o.cx,o.cy,0,o.cx,o.cy,15);
                    pg.addColorStop(0, 'rgba(255,255,255,0.6)');
                    pg.addColorStop(0.4, ring.color + '0.3)');
                    pg.addColorStop(1, 'transparent');
                    ctx.beginPath();
                    ctx.arc(o.cx, o.cy, 15, 0, Math.PI * 2);
                    ctx.fillStyle = pg;
                    ctx.fill();
                });
            });

            // Connecting lines between orbs (pulsing)
            const pulse = (Math.sin(t * 1.5) + 1) / 2;
            for (let i = 0; i < orbs.length - 1; i++) {
                const a = orbs[i], b = orbs[i+1];
                ctx.beginPath();
                ctx.moveTo(a.cx, a.cy);
                ctx.lineTo(b.cx, b.cy);
                ctx.strokeStyle = `rgba(76,175,80,${0.05 + pulse * 0.1})`;
                ctx.lineWidth = 1;
                ctx.setLineDash([6, 10]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        resize();
        window.addEventListener('resize', resize);
        return frame;
    }

    // ════════════════════════════════════════════════════════════════════════
    // Master RAF loop — all sections share one loop
    // ════════════════════════════════════════════════════════════════════════
    const renderers = [];

    const sectionMap = [
        { selector: '.features-section',     init: initFeatures },
        { selector: '.screenshots-section',  init: initScreenshots },
        { selector: '.tech-stack-section',   init: initTechStack },
        { selector: '.requirements-section', init: initRequirements },
    ];

    sectionMap.forEach(({ selector, init }) => {
        const el = document.querySelector(selector);
        if (el) renderers.push(init(el));
    });

    if (renderers.length) {
        (function loop() {
            requestAnimationFrame(loop);
            renderers.forEach(fn => fn());
        })();
    }

})();
