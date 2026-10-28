/* ============================================================
   QUANTUM PUZZLE — APEX SUEZ LAB
   Classical way: swap pieces one by one until the picture is
   rebuilt (trial and error).
   Quantum way: every possible arrangement explored at once —
   the answer collapses in under a second.
   ============================================================ */
(function () {
  "use strict";

  var stage = document.getElementById("puzzleStage");
  if (!stage) return;

  /* ---------- elements ---------- */
  var board = document.getElementById("puzzleBoard");
  var ghost = document.getElementById("puzzleGhost");
  var overlay = document.getElementById("puzzleOverlay");
  var povStats = document.getElementById("povStats");
  var povCombos = document.getElementById("povCombos");
  var povClassical = document.getElementById("povClassical");
  var povQuantum = document.getElementById("povQuantum");
  var povAgain = document.getElementById("povAgain");
  var povQuantumBtn = document.getElementById("povQuantumBtn");
  var hudPieces = document.getElementById("hudPieces");
  var hudMoves = document.getElementById("hudMoves");
  var hudTime = document.getElementById("hudTime");
  var caption = document.getElementById("puzzleCaption");
  var sizeSeg = document.getElementById("sizeSeg");
  var sizeHint = document.getElementById("sizeHint");
  var imgThumbs = document.getElementById("imgThumbs");
  var puzShuffle = document.getElementById("puzShuffle");
  var puzPeek = document.getElementById("puzPeek");
  var puzQuantum = document.getElementById("puzQuantum");

  var qModal = document.getElementById("qModal");
  var raceClassical = document.getElementById("raceClassical");
  var raceQuantum = document.getElementById("raceQuantum");
  var raceTagC = document.getElementById("raceTagC");
  var raceTagQ = document.getElementById("raceTagQ");
  var raceTries = document.getElementById("raceTries");
  var raceBar = document.getElementById("raceBar");
  var raceSubC = document.getElementById("raceSubC");
  var raceQCount = document.getElementById("raceQCount");
  var raceBarQ = document.getElementById("raceBarQ");
  var raceSubQ = document.getElementById("raceSubQ");
  var racePunch = document.getElementById("racePunch");
  var raceReplay = document.getElementById("raceReplay");

  var IMAGES = [
    { src: "assets/quantum-core.jpg", label: "Quantum core" },
    { src: "assets/hero-lab.jpg", label: "The lab" },
    { src: "assets/goals-waves.jpg", label: "Waves" }
  ];
  var CAPTION_DEFAULT = "Tap a piece, then tap another to swap them. Rebuild the picture.";

  var N = 4;
  var img = IMAGES[0].src;
  var tiles = [];          /* tiles[homeIndex] = { h, cell, el } */
  var selected = -1;
  var moves = 0;
  var won = false;
  var peekOn = false;
  var timerId = null, t0 = null;

  /* ---------- big-number helpers ---------- */
  function factorial(n) {
    var r = 1n;
    for (var i = 2n; i <= BigInt(n); i++) r *= i;
    return r;
  }
  function groupDigits(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  /* an N×N board has (N²)! possible arrangements */
  function factDigits(n) { return groupDigits(factorial(n * n).toString()); }
  /* full number with commas when it fits, otherwise scientific notation */
  function shortCombos(n) {
    var f = factorial(n * n).toString();
    if (f.length <= 16) return groupDigits(f);
    var x = Number(factorial(n * n));
    var e = Math.floor(Math.log10(x));
    var m = x / Math.pow(10, e);
    return "\u2248 " + m.toFixed(1) + " \u00d7 10<sup>" + e + "</sup>";
  }
  function humanTime(sec) {
    if (sec < 1) return "less than a second";
    if (sec < 90) return Math.round(sec) + " seconds";
    var m = sec / 60;
    if (m < 90) return Math.round(m) + " minutes";
    var h = m / 60;
    if (h < 48) return (Math.round(h * 10) / 10) + " hours";
    var d = h / 24;
    if (d < 365) return Math.round(d) + " days";
    var y = d / 365.25;
    if (y < 1000) return Math.round(y) + " years";
    if (y < 1e6) return Math.round(y / 1000) + " thousand years";
    if (y < 1e9) return (Math.round(y / 1e5) / 10) + " million years";
    return (Math.round(y / 1e8) / 10) + " billion years";
  }

  /* ---------- rendering helpers ---------- */
  function bgFor(el, h, n, src) {
    var r0 = Math.floor(h / n), c0 = h % n;
    el.style.backgroundImage = "url('" + src + "')";
    el.style.backgroundSize = (n * 100) + "% " + (n * 100) + "%";
    el.style.backgroundPosition =
      ((c0 / (n - 1)) * 100).toFixed(4) + "% " + ((r0 / (n - 1)) * 100).toFixed(4) + "%";
  }
  function place(t) {
    var r = Math.floor(t.cell / N), c = t.cell % N;
    t.el.style.transform = "translate(" + (c * 100) + "%," + (r * 100) + "%)";
  }

  /* ---------- main board ---------- */
  function buildBoard() {
    board.innerHTML = "";
    board.style.setProperty("--n", N);
    tiles = [];
    var frag = document.createDocumentFragment();
    for (var h = 0; h < N * N; h++) {
      var el = document.createElement("button");
      el.type = "button";
      el.className = "ptile";
      el.setAttribute("aria-label", "Puzzle piece " + (h + 1));
      bgFor(el, h, N, img);
      var t = { h: h, cell: h, el: el };
      el.addEventListener("click", function (t) { return function () { onTile(t); }; }(t));
      place(t);
      frag.appendChild(el);
      tiles.push(t);
    }
    board.appendChild(frag);
    ghost.style.backgroundImage = "url('" + img + "')";
    hudPieces.textContent = N * N;
  }

  function shuffleTiles() {
    var n2 = N * N, cells = [], i, j, tmp;
    for (i = 0; i < n2; i++) cells.push(i);
    for (i = n2 - 1; i > 0; i--) {
      j = (Math.random() * (i + 1)) | 0;
      tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
    }
    var solved = true;
    for (i = 0; i < n2; i++) if (cells[i] !== i) { solved = false; break; }
    if (solved) return shuffleTiles();
    for (i = 0; i < n2; i++) { tiles[i].cell = cells[i]; place(tiles[i]); }
  }

  function deselect() {
    if (selected !== -1) tiles[selected].el.classList.remove("sel");
    selected = -1;
  }

  function onTile(t) {
    if (won) return;
    if (selected === -1) {
      selected = t.h;
      t.el.classList.add("sel");
      return;
    }
    if (selected === t.h) { deselect(); return; }
    var a = tiles[selected];
    deselect();
    var tmp = a.cell; a.cell = t.cell; t.cell = tmp;
    place(a); place(t);
    moves++;
    hudMoves.textContent = moves;
    startTimer();
    checkWin();
  }

  function isSolved() {
    for (var i = 0; i < tiles.length; i++) if (tiles[i].cell !== tiles[i].h) return false;
    return true;
  }

  /* ---------- timer ---------- */
  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function startTimer() {
    if (t0 !== null) return;
    t0 = Date.now();
    timerId = setInterval(function () {
      hudTime.textContent = fmtTime(Date.now() - t0);
    }, 250);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  /* ---------- win ---------- */
  function checkWin() {
    if (!isSolved()) return;
    won = true;
    stopTimer();
    stage.classList.add("solved");
    caption.textContent = "Solved! Now for the interesting part\u2026";
    setTimeout(showWin, 550);
  }

  function showWin() {
    var secs = fmtTime(t0 === null ? 0 : Date.now() - t0);
    var fact = factorial(N * N);
    var totalSec = Number(fact) / 1e9;
    povStats.textContent = N + "\u00d7" + N + " grid \u00b7 " + moves + (moves === 1 ? " move" : " moves") + " \u00b7 " + secs;
    povCombos.innerHTML = "<span class='pov-num'>" + shortCombos(N) + "</span><span class='pov-num-label'>possible arrangements</span>";
    povClassical.innerHTML = "A classical computer checking <b>1,000,000,000 arrangements every second</b> would need about <b>" + humanTime(totalSec) + "</b> to be sure of the answer.";
    povQuantum.innerHTML = "A quantum computer explores all of them <b>at the same time</b> \u2014 and lands on the right one in less than a second.";
    overlay.classList.add("show");
  }

  function resetAll() {
    deselect();
    won = false;
    moves = 0;
    hudMoves.textContent = "0";
    stopTimer();
    t0 = null;
    hudTime.textContent = "0:00";
    stage.classList.remove("solved");
    overlay.classList.remove("show");
    caption.textContent = CAPTION_DEFAULT;
    buildBoard();
    shuffleTiles();
  }

  /* ---------- side controls ---------- */
  function updateSizeHint() {
    sizeHint.innerHTML = "<b>" + shortCombos(N) + "</b> possible arrangements";
  }

  puzShuffle.addEventListener("click", resetAll);
  povAgain.addEventListener("click", resetAll);

  puzPeek.addEventListener("click", function () {
    peekOn = !peekOn;
    stage.classList.toggle("peek", peekOn);
    puzPeek.textContent = peekOn ? "Hide the Picture" : "Peek at the Picture";
  });

  sizeSeg.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-n]");
    if (!b) return;
    N = parseInt(b.getAttribute("data-n"), 10);
    sizeSeg.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
    updateSizeHint();
    resetAll();
  });

  function buildThumbs() {
    imgThumbs.innerHTML = "";
    IMAGES.forEach(function (im) {
      var b = document.createElement("button");
      b.type = "button";
      b.title = im.label;
      b.setAttribute("aria-label", "Picture: " + im.label);
      b.style.backgroundImage = "url('" + im.src + "')";
      if (im.src === img) b.classList.add("on");
      b.addEventListener("click", function () {
        if (img === im.src) return;
        img = im.src;
        imgThumbs.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        resetAll();
      });
      imgThumbs.appendChild(b);
    });
  }

  /* ---------- the quantum race ---------- */
  var race = { cList: [], qList: [], tick: null, sub: null, q1: null, q2: null, tries: 0n, tStart: 0 };

  function buildMini(el, n, src) {
    el.innerHTML = "";
    el.style.setProperty("--n", n);
    var list = [];
    for (var h = 0; h < n * n; h++) {
      var d = document.createElement("div");
      d.className = "rtile";
      bgFor(d, h, n, src);
      el.appendChild(d);
      list.push({ h: h, cell: h, el: d });
    }
    return list;
  }
  function placeList(list, n) {
    list.forEach(function (t) {
      var r = Math.floor(t.cell / n), c = t.cell % n;
      t.el.style.transform = "translate(" + (c * 100) + "%," + (r * 100) + "%)";
    });
  }
  function scrambleList(list, n) {
    var n2 = n * n, cells = [], i, j, tmp;
    for (i = 0; i < n2; i++) cells.push(i);
    for (i = n2 - 1; i > 0; i--) {
      j = (Math.random() * (i + 1)) | 0;
      tmp = cells[i]; cells[i] = cells[j]; cells[j] = tmp;
    }
    for (i = 0; i < n2; i++) list[i].cell = cells[i];
  }

  function stopRace() {
    if (race.tick) { clearInterval(race.tick); race.tick = null; }
    if (race.sub) { clearInterval(race.sub); race.sub = null; }
    if (race.q1) { clearTimeout(race.q1); race.q1 = null; }
    if (race.q2) { clearTimeout(race.q2); race.q2 = null; }
  }

  function runRace() {
    stopRace();
    race.tries = 0n;
    race.cList = buildMini(raceClassical, N, img);
    race.qList = buildMini(raceQuantum, N, img);
    scrambleList(race.cList, N); placeList(race.cList, N);
    scrambleList(race.qList, N); placeList(race.qList, N);
    raceClassical.classList.remove("super", "flash");
    raceQuantum.classList.remove("super", "flash");

    var fact = factorial(N * N);
    var factNum = Number(fact);
    var totalSec = factNum / 1e9;           /* seconds at 1 billion checks/s */
    var tiny = totalSec < 5;                /* 3×3 — brute force actually finishes */

    raceTries.textContent = "0";
    raceBar.style.width = "0%";
    raceBarQ.style.width = "0%";
    raceQCount.innerHTML = "all of them \u2014 at once";
    raceSubQ.textContent = "preparing superposition\u2026";
    raceTagQ.innerHTML = "exploring ALL " + shortCombos(N) + " arrangements at the same time\u2026";
    raceTagC.textContent = tiny ? "brute-forcing this tiny one\u2026" : "trying arrangements one by one\u2026";
    raceSubC.textContent = tiny ? "small enough to finish \u2014 but watch what more pieces do\u2026" : "checking one billion arrangements every second\u2026";
    racePunch.innerHTML = tiny
      ? "This puzzle is small \u2014 brute force still wins. But every extra piece multiplies the possibilities: 4\u00d74 needs <b>\u2248 5.8 hours</b>, 5\u00d75 needs <b>\u2248 491 million years</b>. The quantum way doesn't care \u2014 it explores everything at once."
      : "The classical machine walks the possibilities <b>one by one</b> \u2014 a full search needs about <b>" + humanTime(totalSec) + "</b>. The quantum machine holds them <b>all at the same time</b> \u2014 the right answer appears in less than a second.";

    /* classical side — tries counter at a realistic 1e9 per second */
    race.tStart = performance.now();
    race.tick = setInterval(function () {
      for (var s = 0; s < 4; s++) {
        var a = (Math.random() * N * N) | 0, b = (Math.random() * N * N) | 0;
        var tmp = race.cList[a].cell; race.cList[a].cell = race.cList[b].cell; race.cList[b].cell = tmp;
      }
      placeList(race.cList, N);
      race.tries += 90000000n; /* 90 ms \u00d7 1,000,000,000/s */
      if (tiny && race.tries > fact) race.tries = fact;
      raceTries.textContent = groupDigits(race.tries.toString());
      var pct = (Number(race.tries) / factNum) * 100;
      raceBar.style.width = Math.min(Math.max(pct, 0.4), 100) + "%";
      if (tiny && race.tries === fact) {
        raceTagC.textContent = "found it \u2014 this one was tiny";
        raceSubC.innerHTML = factDigits(N) + " arrangements \u2014 brute force finishes small puzzles. 4\u00d74 \u2192 \u2248 5.8 hours. 5\u00d75 \u2192 \u2248 491 million years.";
      }
    }, 90);

    race.sub = setInterval(function () {
      if (tiny) return;
      var el = (performance.now() - race.tStart) / 1000;
      var pct = (Number(race.tries) / factNum) * 100;
      raceSubC.innerHTML = "elapsed " + el.toFixed(1) + "s \u00b7 " + (pct < 0.01 ? "&lt;0.01" : pct.toFixed(2)) + "% of all arrangements \u00b7 full search \u2248 " + humanTime(totalSec);
    }, 500);

    /* quantum side — superposition, then collapse */
    raceQuantum.classList.add("super");
    race.q1 = setTimeout(function () {
      raceQuantum.classList.remove("super");
      raceQuantum.classList.add("flash");
      for (var i = 0; i < race.qList.length; i++) race.qList[i].cell = race.qList[i].h;
      placeList(race.qList, N);
      raceQCount.innerHTML = "<b>" + shortCombos(N) + "</b> explored \u2014 at once";
      raceBarQ.style.width = "100%";
      raceSubQ.textContent = "collapsed \u2014 correct arrangement found instantly";
      raceTagQ.innerHTML = "answer found \u2014 in less than a second \u2713";
      race.q2 = setTimeout(function () { raceQuantum.classList.remove("flash"); }, 1800);
    }, 1500);
  }

  function openRace() {
    qModal.classList.add("open");
    qModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    runRace();
  }
  function closeRace() {
    qModal.classList.remove("open");
    qModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    stopRace();
  }

  povQuantumBtn.addEventListener("click", openRace);
  puzQuantum.addEventListener("click", openRace);
  raceReplay.addEventListener("click", runRace);
  qModal.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) closeRace();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && qModal.classList.contains("open")) closeRace();
  });

  /* ---------- hidden presenter/debug hooks ---------- */
  window.__apexPuzzle = {
    solve: function () {
      deselect();
      tiles.forEach(function (t) { t.cell = t.h; place(t); });
      checkWin();
    },
    race: openRace,
    reset: resetAll
  };

  /* ---------- init ---------- */
  buildThumbs();
  updateSizeHint();
  resetAll();
})();
