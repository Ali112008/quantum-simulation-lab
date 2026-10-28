/* ============================================================
   QUANTUM MAZE — lightweight canvas game
   Classical way: move cell-by-cell, hit a wall = lose.
   Quantum way: every path explored at once (~3s), exit found.
   ============================================================ */
(function () {
  "use strict";

  var COLS = 21, ROWS = 13;
  var stage = document.getElementById("mazeStage");
  if (!stage) return;
  var canvas = document.getElementById("mazeCanvas");
  var ctx = canvas.getContext("2d");
  var overlay = document.getElementById("mazeOverlay");
  var oTitle = document.getElementById("mazeTitle");
  var oMsg = document.getElementById("mazeMsg");
  var oRetry = document.getElementById("mazeRetry");
  var oQuantum = document.getElementById("mazeQuantum");
  var hudMoves = document.getElementById("hudMoves");
  var hudCrashes = document.getElementById("hudCrashes");
  var hudTime = document.getElementById("hudTime");
  var caption = document.getElementById("mazeCaption");
  var btnRestart = document.getElementById("mazeRestart");
  var btnQuantum = document.getElementById("mazeQuantumBtn");
  var dpad = document.getElementById("dpad");

  var CAPTION_DEFAULT = "Arrow keys work too — one wrong move and you start over. That's trial and error.";
  var exit = { x: COLS - 2, y: ROWS - 2 };

  var grid = null;
  var player = { x: 1, y: 1, px: 1, py: 1 };
  var state = "playing"; /* playing | dead | won | quantum | qdone */
  var moves = 0, crashes = 0;
  var t0 = null, tEnd = null;
  var anim = null;        /* movement tween */
  var crashFx = null;     /* {x,y,t0} wall flash */
  var shakeUntil = 0;
  var quantum = null;     /* wavefront animation */
  var cell = 24, dpr = 1;

  /* ---------- maze generation (recursive backtracker) ---------- */
  function genMaze() {
    var g = [], x, y, i;
    for (y = 0; y < ROWS; y++) { g.push([]); for (x = 0; x < COLS; x++) g[y].push(0); }
    var stack = [[1, 1]];
    g[1][1] = 1;
    var dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (stack.length) {
      var cur = stack[stack.length - 1];
      var opts = [];
      for (i = 0; i < 4; i++) {
        var nx = cur[0] + dirs[i][0], ny = cur[1] + dirs[i][1];
        if (nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && !g[ny][nx]) opts.push([nx, ny, dirs[i][0], dirs[i][1]]);
      }
      if (!opts.length) { stack.pop(); continue; }
      var o = opts[(Math.random() * opts.length) | 0];
      g[cur[1] + o[3] / 2][cur[0] + o[2] / 2] = 1;
      g[o[1]][o[0]] = 1;
      stack.push([o[0], o[1]]);
    }
    return g;
  }

  /* ---------- BFS: distance + parents for the quantum wave ---------- */
  function bfs() {
    var dist = [], prev = [], x, y;
    for (y = 0; y < ROWS; y++) {
      dist.push([]); prev.push([]);
      for (x = 0; x < COLS; x++) { dist[y].push(-1); prev[y].push(null); }
    }
    var q = [[1, 1]];
    dist[1][1] = 0;
    var head = 0;
    while (head < q.length) {
      var c = q[head++];
      var nb = [[c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]];
      for (var i = 0; i < 4; i++) {
        var nx = nb[i][0], ny = nb[i][1];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (!grid[ny][nx] || dist[ny][nx] !== -1) continue;
        dist[ny][nx] = dist[c[1]][c[0]] + 1;
        prev[ny][nx] = [c[0], c[1]];
        q.push([nx, ny]);
      }
    }
    return { dist: dist, prev: prev };
  }

  /* ---------- game state ---------- */
  function newGame() {
    grid = genMaze();
    player.x = player.px = 1;
    player.y = player.py = 1;
    state = "playing";
    moves = 0; crashes = 0;
    t0 = null; tEnd = null;
    anim = null; crashFx = null; quantum = null;
    hideOverlay();
    caption.textContent = CAPTION_DEFAULT;
    updateHud();
    hudTime.textContent = "0.0s";
    resize();
  }

  function updateHud() {
    hudMoves.textContent = moves;
    hudCrashes.textContent = crashes;
  }

  function showOverlay(title, msg) {
    oTitle.textContent = title;
    oMsg.textContent = msg;
    overlay.classList.add("show");
  }
  function hideOverlay() { overlay.classList.remove("show"); }

  /* ---------- movement ---------- */
  function move(dir) {
    if (state !== "playing") return;
    var d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    var nx = player.x + d[0], ny = player.y + d[1];
    if (t0 === null) t0 = performance.now();

    var hitWall = nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || !grid[ny][nx];
    if (hitWall) {
      crashes++;
      crashFx = { x: Math.min(Math.max(nx, 0), COLS - 1), y: Math.min(Math.max(ny, 0), ROWS - 1), t0: performance.now() };
      shakeUntil = performance.now() + 420;
      state = "dead";
      tEnd = performance.now();
      updateHud();
      caption.textContent = "Ouch — a wall. That's what trial and error feels like.";
      setTimeout(function () {
        if (state !== "dead") return;
        showOverlay("You hit the wall.",
          "One wrong path — and a classical machine starts all over. You made " + moves + (moves === 1 ? " move" : " moves") + " so far. Try again… or let quantum finish it.");
      }, 650);
      return;
    }

    moves++;
    updateHud();
    anim = { fx: player.x, fy: player.y, tx: nx, ty: ny, t0: performance.now(), dur: 110 };
    player.x = nx; player.y = ny;
    anim.onDone = function () {
      player.px = nx; player.py = ny;
      if (nx === exit.x && ny === exit.y) {
        state = "won";
        tEnd = performance.now();
        caption.textContent = "You made it — the hard way.";
        setTimeout(function () {
          if (state !== "won") return;
          var secs = ((tEnd - t0) / 1000).toFixed(1);
          showOverlay("You reached the exit!",
            "The classical way: " + moves + (moves === 1 ? " move" : " moves") + ", " + crashes + (crashes === 1 ? " crash" : " crashes") + ", " + secs + "s. Now see how a quantum computer does it.");
        }, 450);
      }
    };
  }

  /* ---------- the quantum way ---------- */
  function startQuantum() {
    if (state === "quantum") return;
    var r = bfs();
    var levels = {}, maxD = 0, count = 0, x, y;
    for (y = 0; y < ROWS; y++) for (x = 0; x < COLS; x++) {
      var d = r.dist[y][x];
      if (d < 0) continue;
      if (!levels[d]) levels[d] = [];
      levels[d].push([x, y]);
      if (d > maxD) maxD = d;
      count++;
    }
    var path = [];
    var cur = [exit.x, exit.y];
    while (cur) { path.push(cur); cur = r.prev[cur[1]][cur[0]]; }
    path.reverse();

    var waveMs = Math.min(2200, Math.max(1200, maxD * 26));
    quantum = {
      dist: r.dist, levels: levels, maxD: maxD, count: count,
      path: path, t0: performance.now(), waveMs: waveMs, pathMs: 800
    };
    state = "quantum";
    hideOverlay();
    caption.textContent = "Exploring every path at the same time\u2026";
    setTimeout(function () {
      if (state !== "quantum") return;
      state = "qdone";
      var secs = ((waveMs + quantum.pathMs) / 1000).toFixed(1);
      caption.textContent = "All " + count.toLocaleString("en-US") + " open paths at once — exit found in " + secs + "s.";
      showOverlay("That's the Quantum Way.",
        "Every one of the " + count.toLocaleString("en-US") + " open paths explored at the same time — the exit found in " + secs + "s, no wrong turns, no restarting.");
    }, waveMs + quantum.pathMs + 450);
  }

  /* ---------- rendering ---------- */
  function resize() {
    var w = stage.clientWidth || 600;
    cell = Math.max(12, Math.floor(w / COLS));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = COLS * cell * dpr;
    canvas.height = ROWS * cell * dpr;
    canvas.style.width = COLS * cell + "px";
    canvas.style.height = ROWS * cell + "px";
  }

  function draw(now) {
    requestAnimationFrame(draw);
    if (!grid) return;

    /* ease the moving player */
    if (anim) {
      var p = Math.min((now - anim.t0) / anim.dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      player.px = anim.fx + (anim.tx - anim.fx) * e;
      player.py = anim.fy + (anim.ty - anim.fy) * e;
      if (p >= 1) { var cb = anim.onDone; anim = null; player.px = player.x; player.py = player.y; if (cb) cb(); }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var ox = 0, oy = 0;
    if (now < shakeUntil) { ox = (Math.random() - 0.5) * 5; oy = (Math.random() - 0.5) * 5; }
    ctx.clearRect(0, 0, COLS * cell, ROWS * cell);
    ctx.translate(ox, oy);

    /* floor */
    ctx.fillStyle = "#0a1428";
    ctx.fillRect(-10, -10, COLS * cell + 20, ROWS * cell + 20);

    /* quantum wavefront */
    var waveL = -1, pathP = 0;
    if (quantum) {
      waveL = ((now - quantum.t0) / quantum.waveMs) * (quantum.maxD + 2);
      pathP = Math.min(Math.max((now - quantum.t0 - quantum.waveMs) / quantum.pathMs, 0), 1);
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        var d = quantum.dist[y][x];
        if (d < 0 || d > waveL) continue;
        var a = 0.10 + 0.30 * (1 - d / quantum.maxD);
        if (quantum.maxD - d < 2) a += 0.22;
        ctx.fillStyle = "rgba(34,211,238," + Math.min(a, 0.55).toFixed(3) + ")";
        ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }
    }

    /* walls */
    for (var wy = 0; wy < ROWS; wy++) for (var wx = 0; wx < COLS; wx++) {
      if (grid[wy][wx]) continue;
      ctx.fillStyle = "#14203c";
      ctx.fillRect(wx * cell + 1, wy * cell + 1, cell - 2, cell - 2);
    }

    /* crash flash */
    if (crashFx) {
      var age = now - crashFx.t0;
      if (age < 550) {
        ctx.fillStyle = "rgba(239,68,68," + (0.75 * (1 - age / 550)).toFixed(3) + ")";
        ctx.fillRect(crashFx.x * cell + 1, crashFx.y * cell + 1, cell - 2, cell - 2);
      }
    }

    /* exit — pulsing violet ring */
    var ex = (exit.x + 0.5) * cell, ey = (exit.y + 0.5) * cell;
    var pulse = 0.6 + 0.4 * Math.sin(now / 280);
    ctx.save();
    ctx.strokeStyle = "rgba(139,92,246," + (0.45 + 0.55 * pulse).toFixed(3) + ")";
    ctx.lineWidth = Math.max(2, cell * 0.09);
    ctx.beginPath(); ctx.arc(ex, ey, cell * 0.32 + cell * 0.06 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(139,92,246,0.9)";
    ctx.beginPath(); ctx.arc(ex, ey, cell * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* quantum shortest path */
    if (quantum && pathP > 0) {
      var pts = quantum.path, total = (pts.length - 1) * pathP;
      ctx.save();
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = Math.max(3, cell * 0.22);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.shadowColor = "#8b5cf6"; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo((pts[0][0] + 0.5) * cell, (pts[0][1] + 0.5) * cell);
      for (var i = 1; i < pts.length; i++) {
        var seg = Math.min(Math.max(total - (i - 1), 0), 1);
        if (seg <= 0) break;
        var ax = (pts[i - 1][0] + 0.5) * cell, ay = (pts[i - 1][1] + 0.5) * cell;
        var bx = (pts[i][0] + 0.5) * cell, by = (pts[i][1] + 0.5) * cell;
        ctx.lineTo(ax + (bx - ax) * seg, ay + (by - ay) * seg);
      }
      ctx.stroke();
      ctx.restore();
    }

    /* player — glowing cyan dot */
    var px = (player.px + 0.5) * cell, py = (player.py + 0.5) * cell;
    ctx.save();
    ctx.globalAlpha = (state === "dead") ? 0.55 : 1;
    ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 14;
    ctx.fillStyle = "#22d3ee";
    ctx.beginPath(); ctx.arc(px, py, cell * 0.30, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#e0faff";
    ctx.beginPath(); ctx.arc(px - cell * 0.07, py - cell * 0.08, cell * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ---------- input ---------- */
  function inView() {
    var r = stage.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }
  document.addEventListener("keydown", function (e) {
    var m = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key];
    if (!m || !inView()) return;
    e.preventDefault();
    move(m);
  });
  dpad.addEventListener("click", function (e) {
    var b = e.target.closest("[data-dir]");
    if (b) move(b.getAttribute("data-dir"));
  });
  oRetry.addEventListener("click", newGame);
  btnRestart.addEventListener("click", newGame);
  oQuantum.addEventListener("click", startQuantum);
  btnQuantum.addEventListener("click", startQuantum);

  /* ---------- timer ---------- */
  setInterval(function () {
    if (t0 === null) return;
    if (tEnd !== null) { hudTime.textContent = ((tEnd - t0) / 1000).toFixed(1) + "s"; return; }
    if (state === "playing" || state === "dead" || state === "won") {
      hudTime.textContent = ((performance.now() - t0) / 1000).toFixed(1) + "s";
    }
  }, 100);

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener("resize", resize);

  newGame();
  requestAnimationFrame(draw);
})();
