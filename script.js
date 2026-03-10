/* ============================================================
   OUR CREATIVE WORKS — v10 Engine (Canvas, Optimized)
   Canvas drawImage · FRAME_SKIP=2 · Lazy Load · Viewport-Only Draw
   ============================================================ */

(function () {
    'use strict';

    const CONFIGS = [
        { secId: 's-editing', canvasId: 'c-editing', folder: 'Professional Video And Image Editing', frames: 240 },
        { secId: 's-film', canvasId: 'c-film', folder: 'FILM MAKING', frames: 240 },
        { secId: 's-video', canvasId: 'c-video', folder: 'Videography Reel', frames: 240 },
        { secId: 's-web', canvasId: 'c-web', folder: 'Web Development', frames: 240 },
        { secId: 's-events', canvasId: 'c-events', folder: 'MINI EVENTS', frames: 180 },
        { secId: 's-ads', canvasId: 'c-ads', folder: 'ADS MANAGEMENT', frames: 240 },
        { secId: 's-logo', canvasId: 'c-logo', folder: 'Our Creative Works Logo', frames: 180 },
    ];

    const FRAME_SKIP = 1; // use ALL frames for smoothest scroll
    const CANVAS_PCT = 65;
    const PANEL_PCT = 35;

    const sections = [];
    let toLoad = 0, loaded = 0, ready = false;
    let rafId = null;
    let canvasW = 0, canvasH = 0;
    let lastScrollY = window.pageYOffset;

    const loader = document.getElementById('loader');
    const loaderBar = document.getElementById('loaderBar');
    const loaderPct = document.getElementById('loaderPercent');
    const nav = document.getElementById('nav');
    const dots = document.querySelectorAll('.nav-dot');
    const logoFin = document.getElementById('logoFinale');

    /* ============ BOOT ============ */
    document.addEventListener('DOMContentLoaded', () => {
        build();
        splitWords();
        preloadInitial();
        initNav();
        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', onResize);
    });

    /* ---- Build ---- */
    function build() {
        CONFIGS.forEach((cfg, idx) => {
            const sec = document.getElementById(cfg.secId);
            const canvas = document.getElementById(cfg.canvasId);
            if (!sec || !canvas) return;
            const ctx = canvas.getContext('2d', { alpha: false });
            const sCan = canvas.closest('.split-canvas');
            const sPanel = sec.querySelector('.split-panel');
            const bar = sec.querySelector('.sec-progress-bar');
            const fade = sec.querySelector('.sec-fade');
            const isLogo = cfg.secId === 's-logo';

            sizeCanvas(canvas);

            const usable = Math.ceil(cfg.frames / FRAME_SKIP);

            sections.push({
                sec, canvas, ctx,
                sCan, sPanel, bar, fade,
                folder: cfg.folder,
                totalOrig: cfg.frames, total: usable,
                imgs: new Array(usable),
                drawn: -1,
                isLogo, panelVis: false,
                loaded: false, loading: false,
                index: idx,
            });
        });
    }

    /* ---- Word split ---- */
    function splitWords() {
        document.querySelectorAll('.panel-title .rev, .panel-caption .rev, .panel-body .rev').forEach(el => {
            const txt = el.textContent.trim();
            const words = txt.split(/\s+/);
            const parent = el.closest('.panel-title, .panel-caption, .panel-body');
            let base = 0;
            if (parent) {
                if (parent.classList.contains('panel-title')) base = 0.05;
                else if (parent.classList.contains('panel-caption')) base = 0.50;
                else if (parent.classList.contains('panel-body')) base = 0.80;
            }
            el.innerHTML = '';
            words.forEach((w, i) => {
                const s = document.createElement('span');
                s.className = 'word';
                s.style.setProperty('--d', (base + i * 0.09).toFixed(2) + 's');
                s.textContent = w;
                el.appendChild(s);
                if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
            });
        });
    }

    /* ---- Canvas sizing — use DPR=1 for perf ---- */
    function sizeCanvas(c) {
        const w = c.clientWidth || 1;
        const h = c.clientHeight || 1;
        c.width = w;
        c.height = h;
    }
    function onResize() {
        sections.forEach(d => {
            sizeCanvas(d.canvas);
            d.drawn = -1;
        });
    }

    /* ============ LAZY LOADING ============ */
    function preloadInitial() {
        for (let i = 0; i < Math.min(2, sections.length); i++) {
            loadSection(sections[i]);
        }
    }

    function loadSection(d) {
        if (d.loaded || d.loading) return;
        d.loading = true;

        let count = 0;
        for (let i = 0; i < d.total; i++) {
            toLoad++;
            const img = new Image();
            const origIdx = i * FRAME_SKIP + 1;
            img.src = encodeURI(d.folder + '/ezgif-frame-' + String(origIdx).padStart(3, '0') + '.jpg');
            img.onload = img.onerror = () => {
                loaded++;
                count++;
                if (count >= d.total) d.loaded = true;
                updLoad();
            };
            d.imgs[i] = img;
        }
    }

    function lazyCheck() {
        const sy = window.pageYOffset, vh = innerHeight;
        for (const d of sections) {
            if (d.loaded || d.loading) continue;
            if (sy + vh * 2.5 > d.sec.offsetTop) loadSection(d);
        }
    }

    function updLoad() {
        const p = Math.min(100, Math.round(loaded / toLoad * 100));
        loaderBar.style.width = p + '%';
        loaderPct.textContent = p + '%';

        if (!ready) {
            const s0 = sections[0], s1 = sections[1];
            const need = (s0 ? s0.total : 0) + (s1 ? s1.total : 0);
            if (loaded >= need) {
                ready = true;
                sections.forEach(d => drawFrame(d, 0));
                setTimeout(() => {
                    loader.classList.add('hidden');
                    onScroll();
                }, 350);
            }
        }
    }

    /* ---- Draw frame (cover-fit) ---- */
    function drawFrame(d, idx) {
        idx = Math.max(0, Math.min(idx, d.total - 1));
        if (idx === d.drawn) return;
        const img = d.imgs[idx];
        if (!img || !img.complete || !img.naturalWidth) return;

        const cw = d.canvas.width, ch = d.canvas.height;
        if (cw < 1 || ch < 1) return;

        const ir = img.naturalWidth / img.naturalHeight;
        const cr = cw / ch;
        let dw, dh, dx, dy;

        if (d.isLogo) {
            // 'contain' logic for the logo to prevent cutting off text
            if (cr > ir) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
            else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
            d.ctx.clearRect(0, 0, cw, ch);
        } else {
            // 'cover' logic for background videos
            if (cr > ir) { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
            else { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; }
        }

        d.ctx.drawImage(img, dx, dy, dw, dh);
        d.drawn = idx;
    }

    /* ---- Nav ---- */
    function initNav() {
        dots.forEach(dt => dt.addEventListener('click', () => {
            const i = +dt.dataset.idx;
            const t = i === 0 ? document.getElementById('hero') : sections[i - 1]?.sec;
            if (t) window.scrollTo({ top: t.offsetTop, behavior: 'smooth' });
        }));
    }

    /* ============ SCROLL — RAF throttled ============ */
    function scheduleUpdate() {
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                onScroll();
                rafId = null;
            });
        }
    }

    function onScroll() {
        if (!ready) return;
        const sy = window.pageYOffset, vh = innerHeight;

        // Hide nav on scroll down, show on scroll up
        if (sy > lastScrollY && sy > vh * 0.35) {
            nav.classList.remove('show');
        } else if (sy < lastScrollY && sy > vh * 0.35) {
            nav.classList.add('show');
        } else if (sy <= vh * 0.35) {
            nav.classList.remove('show');
        }
        lastScrollY = sy;

        let ai = 0;
        for (let i = 0; i < sections.length; i++) {
            if (sections[i].sec.getBoundingClientRect().top <= vh * 0.5) ai = i + 1;
        }
        dots.forEach((d, i) => d.classList.toggle('active', i === ai));

        /* Only process sections near viewport */
        sections.forEach(d => {
            const top = d.sec.offsetTop;
            const bot = top + d.sec.offsetHeight;
            const inView = (sy + vh > top - vh) && (sy < bot + vh);
            if (inView) updateSection(d, sy, vh);
        });

        lazyCheck();
    }

    /* ---- Per-section ---- */
    function updateSection(d, sy, vh) {
        const top = d.sec.offsetTop;
        const h = d.sec.offsetHeight;
        const range = h - vh;
        const into = sy - top;
        let p = Math.max(0, Math.min(1, into / range));

        const mob = innerWidth <= 768;

        /* Draw frame */
        if (into > -vh && into < h) {
            const idx = Math.floor(p * (d.total - 1));
            /* Resize canvas if needed */
            const cw = d.canvas.clientWidth, ch = d.canvas.clientHeight;
            if (cw > 0 && ch > 0 && (d.canvas.width !== cw || d.canvas.height !== ch)) {
                d.canvas.width = cw;
                d.canvas.height = ch;
                d.drawn = -1;
            }
            drawFrame(d, idx);
        }

        if (d.bar) d.bar.style.height = (p * 100) + '%';

        if (d.isLogo) {
            if (logoFin) {
                const show = p > 0.5;
                logoFin.classList.toggle('show', show);
                if (show) {
                    const g = logoFin.querySelector('.logo-glow');
                    if (g) {
                        g.style.transform = 'translate(-50%,-50%) scale(' + (1 + (p - .5) * 4) + ')';
                        g.style.opacity = Math.min(1, (p - .5) * 4);
                    }
                }
            }
            return;
        }

        if (!d.sCan || !d.sPanel) return;

        /* ==== 5-Phase Split Animation ==== */
        let cW, pW, showPanel, fadeOp = 0, zoom = 1;

        const targetCanPct = mob ? 50 : CANVAS_PCT;
        const targetPanPct = mob ? 50 : PANEL_PCT;

        if (p < 0.15) {
            cW = 100; pW = 0; showPanel = false;
            zoom = 1 + (p / 0.15) * 0.06;
        } else if (p < 0.35) {
            const t = (p - 0.15) / 0.20;
            const e = 1 - Math.pow(1 - t, 3);
            cW = 100 - e * (100 - targetCanPct);
            pW = e * targetPanPct;
            showPanel = false;
            zoom = 1.06 - e * 0.06;
        } else if (p < 0.45) {
            cW = targetCanPct; pW = targetPanPct;
            showPanel = true;
            zoom = 1;
        } else if (p < 0.85) {
            cW = targetCanPct; pW = targetPanPct; showPanel = true; zoom = 1;
        } else {
            const t = (p - 0.85) / 0.15;
            const e = t * t;
            cW = targetCanPct + e * (100 - targetCanPct);
            pW = targetPanPct * (1 - e);
            showPanel = e < 0.35;
            zoom = 1;
            fadeOp = Math.max(0, (t - 0.3) / 0.7);
        }

        if (mob) {
            d.sCan.style.width = '100%'; d.sCan.style.height = cW + '%';
            d.sPanel.style.width = '100%'; d.sPanel.style.height = pW + '%';
        } else {
            d.sCan.style.width = cW + '%'; d.sCan.style.height = '100%';
            d.sPanel.style.width = pW + '%'; d.sPanel.style.height = '100%';
        }
        d.sCan.style.transform = 'scale(' + zoom.toFixed(4) + ')';

        /* Simple fade */
        if (d.fade) d.fade.style.opacity = fadeOp;

        /* Panel clip wipe — panel clips in from side */
        if (showPanel !== d.panelVis) {
            d.sPanel.classList.toggle('visible', showPanel);
            if (showPanel) {
                d.sPanel.classList.remove('clip-hidden');
            } else {
                d.sPanel.classList.add('clip-hidden');
            }
            d.panelVis = showPanel;
        }
    }

})();

/* ============================================================
   IMMERSIVE CURSOR — Dot + Ring + SCROLL Label + 3D Tilt + Orb
   ============================================================ */
(function () {
    'use strict';

    if (window.matchMedia('(max-width: 768px)').matches) return;

    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    const label = document.getElementById('cursorLabel');
    if (!dot || !ring || !label) return;

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let dx = mx, dy = my, rx = mx, ry = my;

    const DOT_SPEED = 0.18;
    const RING_SPEED = 0.09;
    /* Track mouse */
    document.addEventListener('mousemove', e => {
        mx = e.clientX;
        my = e.clientY;
        updateHoverState(e);
    });

    /* Animation loop — lerp dot + ring + label (SCROLL centered in ring) */
    function tick() {
        dx += (mx - dx) * DOT_SPEED;
        dy += (my - dy) * DOT_SPEED;
        rx += (mx - rx) * RING_SPEED;
        ry += (my - ry) * RING_SPEED;

        dot.style.left = dx + 'px'; dot.style.top = dy + 'px';
        ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
        /* SCROLL label sits exactly at ring center */
        label.style.left = rx + 'px'; label.style.top = ry + 'px';

        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    /* Hover detection */
    const LINK_SEL = 'a, button, .chip, .panel-cta, .soc-link, .nav-dot, [role="button"]';

    function updateHoverState(e) {
        const el = e.target;
        const link = el.closest(LINK_SEL);
        // Show SCROLL label broadly across page areas (hero, panels, footer)
        const isHoverArea = el.closest('section, footer');

        dot.classList.toggle('hover-link', !!link);
        ring.classList.toggle('hover-link', !!link);
        dot.classList.toggle('hover-canvas', !!isHoverArea && !link);
        ring.classList.toggle('hover-canvas', !!isHoverArea && !link);
        label.classList.toggle('hover-canvas', !!isHoverArea && !link);
    }

    /* Hide cursor when leaving window */
    document.addEventListener('mouseleave', () => {
        dot.style.opacity = '0';
        ring.style.opacity = '0';
        label.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
        dot.style.opacity = '1';
        ring.style.opacity = '1';
    });

    /* Init: start panels clipped */
    const allPanels = document.querySelectorAll('.split-panel');
    allPanels.forEach(p => p.classList.add('clip-hidden'));

})();

/* ============================================================
   CANVAS INTERACTIVE REPULSION GRID
   ============================================================ */
(function () {
    class RepulsionGrid {
        constructor(canvas, container, options = {}) {
            this.canvas = canvas;
            this.container = container;
            this.ctx = canvas.getContext('2d');
            this.nodes = [];

            // Grid settings
            this.spacing = options.spacing || 60;
            this.mouse = { x: -1000, y: -1000 };

            // Physics settings
            this.repelRadius = options.repelRadius || 350;
            this.forceDistMultiplier = options.forceDistMultiplier || 0.06;
            this.spring = options.spring || 0.05;
            this.friction = options.friction || 0.85;

            // Visibility (increased per user request)
            this.baseAlpha = options.baseAlpha || 0.12;
            this.maxAlpha = options.maxAlpha || 0.6;

            this.resize();
            this.initNodes();

            // Observe the container so the canvas perfectly matches changing CSS heights (fixes Inspect bug)
            const ro = new ResizeObserver(() => {
                this.resize();
                this.initNodes();
            });
            ro.observe(this.container);

            window.addEventListener('resize', () => {
                this.resize();
                this.initNodes();
            });

            window.addEventListener('mousemove', (e) => {
                // track raw mouse position
                this.mouse.x = e.clientX;
                this.mouse.y = e.clientY;
            });

            this.render = this.render.bind(this);
            requestAnimationFrame(this.render);
        }

        resize() {
            this.bounds = this.container.getBoundingClientRect();
            // Scale for high DPI displays
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = this.bounds.width * dpr;
            this.canvas.height = this.bounds.height * dpr;
            this.ctx.scale(dpr, dpr);
        }

        initNodes() {
            this.nodes = [];
            const sw = this.bounds.width;
            const sh = this.bounds.height;
            // pad grid outside bounds so edges don't break
            const cols = Math.ceil(sw / this.spacing) + 2;
            const rows = Math.ceil(sh / this.spacing) + 2;

            for (let y = -1; y <= rows; y++) {
                for (let x = -1; x <= cols; x++) {
                    this.nodes.push({
                        ox: x * this.spacing,
                        oy: y * this.spacing,
                        x: x * this.spacing,
                        y: y * this.spacing,
                        vx: 0,
                        vy: 0
                    });
                }
            }
            this.cols = cols + 2;
            this.rows = rows + 2;
        }

        render() {
            // Re-check container bounds without causing layout thrashing if possible
            // We just need offset to viewport
            const rect = this.container.getBoundingClientRect();
            // Local mouse coordinates for the canvas
            const localMouseX = this.mouse.x - rect.left;
            const localMouseY = this.mouse.y - rect.top;

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            // Must re-apply on render because resize resets context state
            this.ctx.globalCompositeOperation = 'screen';

            // Update physics
            for (let i = 0; i < this.nodes.length; i++) {
                const node = this.nodes[i];

                // Distance to local cursor
                const dx = node.x - localMouseX;
                const dy = node.y - localMouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Repulsion
                if (dist < this.repelRadius) {
                    const force = (this.repelRadius - dist) * this.forceDistMultiplier;
                    const angle = Math.atan2(dy, dx);
                    node.vx += Math.cos(angle) * force;
                    node.vy += Math.sin(angle) * force;
                }

                // Spring back
                node.vx += (node.ox - node.x) * this.spring;
                node.vy += (node.oy - node.y) * this.spring;

                // Friction
                node.vx *= this.friction;
                node.vy *= this.friction;

                // Update pos
                node.x += node.vx;
                node.y += node.vy;
            }

            // Draw grid
            for (let y = 0; y < this.rows; y++) {
                for (let x = 0; x < this.cols; x++) {
                    const i = y * this.cols + x;
                    const node = this.nodes[i];

                    // Determine alpha based on distance to cursor
                    const dx = node.x - localMouseX;
                    const dy = node.y - localMouseY;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    let alpha = this.baseAlpha;
                    if (dist < this.repelRadius * 1.5) {
                        const falloff = 1 - (dist / (this.repelRadius * 1.5));
                        alpha = this.baseAlpha + (this.maxAlpha - this.baseAlpha) * falloff;
                    }

                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
                    this.ctx.lineWidth = 1;

                    // Draw right
                    if (x < this.cols - 1) {
                        const rightNode = this.nodes[i + 1];
                        this.ctx.beginPath();
                        this.ctx.moveTo(node.x, node.y);
                        this.ctx.lineTo(rightNode.x, rightNode.y);
                        this.ctx.stroke();
                    }
                    // Draw bottom
                    if (y < this.rows - 1) {
                        const bottomNode = this.nodes[i + this.cols];
                        this.ctx.beginPath();
                        this.ctx.moveTo(node.x, node.y);
                        this.ctx.lineTo(bottomNode.x, bottomNode.y);
                        this.ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(this.render);
        }
    }

    // Initialize on existing canvases
    const canvases = document.querySelectorAll('.grid-canvas');
    canvases.forEach(canvas => {
        new RepulsionGrid(canvas, canvas.parentElement);
    });

    // Inject canvas into split panels
    const panels = document.querySelectorAll('.split-panel');
    panels.forEach(panel => {
        const canvas = document.createElement('canvas');
        canvas.classList.add('grid-canvas');
        panel.insertBefore(canvas, panel.firstChild);
        new RepulsionGrid(canvas, panel, { 
            repelRadius: 180, 
            spacing: 40,
            spring: 0.08,             
            forceDistMultiplier: 0.03, 
            baseAlpha: 0.08,          // Raised further so lines are clearly visible
            maxAlpha: 0.4             
        });
    });

})();
