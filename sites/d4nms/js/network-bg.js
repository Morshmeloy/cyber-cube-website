// D4NMS — 3D Network Background Animation
(function () {
    const canvas = document.getElementById('networkCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, mouseX = 0, mouseY = 0;
    let animFrame;

    // --- Config ---
    const CONFIG = {
        nodeCount: 70,
        maxDist: 180,
        nodeRadius: { min: 1.5, max: 4 },
        speed: { min: 0.007, max: 0.025 },
        depth: 600,         // Z-depth range
        fov: 400,           // Perspective FOV
        colors: {
            nodes: ['#2196f3', '#00d4ff', '#42a5f5', '#9c27b0', '#21cbf3', '#4ecdc4'],
            lines: 'rgba(33,150,243,',
            pulse: '#00d4ff',
        },
        pulseInterval: 2500, // ms between pulses
        mouseInfluence: 120, // px radius of mouse repel
    };

    // --- Node class ---
    class Node {
        constructor() { this.reset(true); }

        reset(initial = false) {
            this.x = (Math.random() - 0.5) * 1.6;  // -0.8..0.8 of W
            this.y = (Math.random() - 0.5) * 1.6;  // relative
            this.z = initial
                ? Math.random() * CONFIG.depth
                : CONFIG.depth;

            this.vx = (Math.random() - 0.5) * CONFIG.speed.max;
            this.vy = (Math.random() - 0.5) * CONFIG.speed.max;
            this.vz = -(Math.random() * (CONFIG.speed.max - CONFIG.speed.min) + CONFIG.speed.min) * 0.8;

            this.baseRadius = Math.random() * (CONFIG.nodeRadius.max - CONFIG.nodeRadius.min) + CONFIG.nodeRadius.min;
            this.color = CONFIG.colors.nodes[Math.floor(Math.random() * CONFIG.colors.nodes.length)];

            // Pulse ring
            this.pulse = Math.random() < 0.18;
            this.pulsePhase = Math.random() * Math.PI * 2;
            this.pulseSpeed = 0.006 + Math.random() * 0.006;

            // Twinkle
            this.twinkleSpeed = 0.004 + Math.random() * 0.008;
            this.twinklePhase = Math.random() * Math.PI * 2;

            // Data packet travelling on an edge
            this.packet = null;
        }

        project() {
            const scale = CONFIG.fov / (CONFIG.fov + this.z);
            this.sx = this.x * W * scale + W / 2;
            this.sy = this.y * H * scale + H / 2;
            this.scale = scale;
            this.screenR = this.baseRadius * scale * 2.5;
        }

        update() {
            this.z += this.vz;
            this.x += this.vx * 0.003;
            this.y += this.vy * 0.003;

            this.twinklePhase += this.twinkleSpeed;
            this.pulsePhase += this.pulseSpeed;

            // Mouse repel
            const dx = this.sx - mouseX;
            const dy = this.sy - mouseY;
            const md = Math.sqrt(dx * dx + dy * dy);
            if (md < CONFIG.mouseInfluence) {
                const force = (1 - md / CONFIG.mouseInfluence) * 0.6;
                this.x += (dx / md) * force * 0.004;
                this.y += (dy / md) * force * 0.004;
            }

            // Reset if too close or out
            if (this.z <= 0 || Math.abs(this.sx - W / 2) > W || Math.abs(this.sy - H / 2) > H) {
                this.reset();
            }
        }

        draw() {
            const alpha = Math.max(0, Math.min(1, this.scale * 1.5));
            const twinkle = 0.7 + 0.3 * Math.sin(this.twinklePhase);
            const r = this.screenR * twinkle;

            // Glow
            const grd = ctx.createRadialGradient(this.sx, this.sy, 0, this.sx, this.sy, r * 3.5);
            grd.addColorStop(0, this.color + 'cc');
            grd.addColorStop(0.4, this.color + '55');
            grd.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(this.sx, this.sy, r * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.globalAlpha = alpha * 0.6;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(this.sx, this.sy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = alpha * twinkle;
            ctx.fill();

            // Pulse ring
            if (this.pulse) {
                const pr = r + (r * 3) * ((Math.sin(this.pulsePhase) + 1) / 2);
                const pa = (1 - (pr - r) / (r * 3)) * 0.5 * alpha;
                ctx.beginPath();
                ctx.arc(this.sx, this.sy, pr, 0, Math.PI * 2);
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 1;
                ctx.globalAlpha = pa;
                ctx.stroke();
            }

            ctx.globalAlpha = 1;
        }
    }

    // --- Data Packet ---
    class Packet {
        constructor(x1, y1, x2, y2, color) {
            this.x1 = x1; this.y1 = y1;
            this.x2 = x2; this.y2 = y2;
            this.t = 0;
            this.speed = 0.0024 + Math.random() * 0.003;
            this.color = color;
            this.done = false;
        }
        update() {
            this.t += this.speed;
            if (this.t >= 1) this.done = true;
        }
        draw() {
            const x = this.x1 + (this.x2 - this.x1) * this.t;
            const y = this.y1 + (this.y2 - this.y1) * this.t;
            const grd = ctx.createRadialGradient(x, y, 0, x, y, 6);
            grd.addColorStop(0, '#ffffff');
            grd.addColorStop(0.4, this.color + 'cc');
            grd.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.globalAlpha = 0.9 * (1 - Math.abs(this.t - 0.5) * 1.5);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // --- Hexagonal grid overlay (subtle) ---
    function drawHexGrid() {
        const size = 60;
        const h = size * Math.sqrt(3);
        ctx.strokeStyle = 'rgba(33,150,243,0.04)';
        ctx.lineWidth = 1;
        for (let row = -2; row < H / h + 2; row++) {
            for (let col = -2; col < W / (size * 1.5) + 2; col++) {
                const cx = col * size * 1.5;
                const cy = row * h + (col % 2 === 0 ? 0 : h / 2);
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const px = cx + size * Math.cos(angle);
                    const py = cy + size * Math.sin(angle);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            }
        }
    }

    // --- Scanline effect ---
    let scanY = 0;
    function drawScanline() {
        scanY = (scanY + 0.3) % H;
        const grd = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
        grd.addColorStop(0, 'transparent');
        grd.addColorStop(0.5, 'rgba(33,150,243,0.04)');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0, scanY - 60, W, 120);
    }

    // --- State ---
    let nodes = [];
    let packets = [];
    let lastPacketTime = 0;

    function init() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        nodes = Array.from({ length: CONFIG.nodeCount }, () => new Node());
    }

    function spawnPacket() {
        // Pick two nearby projected nodes
        const visible = nodes.filter(n => n.scale > 0.3);
        if (visible.length < 2) return;
        const a = visible[Math.floor(Math.random() * visible.length)];
        const b = visible[Math.floor(Math.random() * visible.length)];
        if (a === b) return;
        const dx = a.sx - b.sx, dy = a.sy - b.sy;
        if (Math.sqrt(dx * dx + dy * dy) < CONFIG.maxDist) {
            packets.push(new Packet(a.sx, a.sy, b.sx, b.sy, a.color));
        }
    }

    function drawConnections() {
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                const dx = a.sx - b.sx;
                const dy = a.sy - b.sy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONFIG.maxDist) {
                    const alpha = (1 - dist / CONFIG.maxDist) * Math.min(a.scale, b.scale) * 0.7;
                    const depthFade = Math.min(a.scale, b.scale);

                    // Gradient line
                    const grd = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
                    grd.addColorStop(0, a.color + Math.round(alpha * 180).toString(16).padStart(2, '0'));
                    grd.addColorStop(1, b.color + Math.round(alpha * 180).toString(16).padStart(2, '0'));

                    ctx.beginPath();
                    ctx.moveTo(a.sx, a.sy);
                    ctx.lineTo(b.sx, b.sy);
                    ctx.strokeStyle = grd;
                    ctx.lineWidth = depthFade * 1.5;
                    ctx.globalAlpha = alpha;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
    }

    // --- Floating data labels ---
    const dataLabels = [
        { text: 'PING 1ms', x: 0.15, y: 0.25, vx: 0.00008, vy: 0.00005 },
        { text: 'SSH OK', x: 0.75, y: 0.15, vx: -0.00006, vy: 0.00007 },
        { text: 'SNMP v3', x: 0.85, y: 0.7, vx: -0.00005, vy: -0.00006 },
        { text: 'WS ●', x: 0.2, y: 0.75, vx: 0.00007, vy: -0.00008 },
        { text: '99.9% UP', x: 0.55, y: 0.88, vx: -0.00004, vy: -0.00005 },
    ];
    let labelPhase = 0;

    function drawDataLabels() {
        labelPhase += 0.003;
        ctx.font = '11px monospace';
        dataLabels.forEach((lbl, i) => {
            lbl.x += lbl.vx;
            lbl.y += lbl.vy;
            if (lbl.x < 0.05 || lbl.x > 0.92) lbl.vx *= -1;
            if (lbl.y < 0.05 || lbl.y > 0.92) lbl.vy *= -1;

            const px = lbl.x * W;
            const py = lbl.y * H;
            const alpha = 0.3 + 0.2 * Math.sin(labelPhase + i * 1.3);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#42a5f5';
            ctx.fillText(lbl.text, px, py);

            // Small bracket decoration
            ctx.strokeStyle = 'rgba(33,150,243,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px - 8, py - 10);
            ctx.lineTo(px - 4, py - 10);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px - 8, py + 3);
            ctx.lineTo(px - 4, py + 3);
            ctx.stroke();

            ctx.globalAlpha = 1;
        });
    }

    function animate(now = 0) {
        animFrame = requestAnimationFrame(animate);

        // Clear with trail
        ctx.fillStyle = 'rgba(10,14,39,0.25)';
        ctx.fillRect(0, 0, W, H);

        // Hex grid
        drawHexGrid();

        // Scanline
        drawScanline();

        // Update & project nodes
        nodes.forEach(n => { n.project(); n.update(); });

        // Connections
        drawConnections();

        // Packets
        if (now - lastPacketTime > CONFIG.pulseInterval * 0.3) {
            spawnPacket();
            lastPacketTime = now;
        }
        packets = packets.filter(p => !p.done);
        packets.forEach(p => { p.update(); p.draw(); });

        // Nodes on top
        nodes.forEach(n => n.draw());

        // Floating labels
        drawDataLabels();

        // Vignette
        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
        vig.addColorStop(0, 'transparent');
        vig.addColorStop(1, 'rgba(10,14,39,0.65)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
    }

    window.addEventListener('resize', init);
    window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

    init();
    animate();
})();
