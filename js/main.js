/* ============================================================
   QUANTUM SIMULATION LAB — main.js
   Lightweight interactions: reveal on scroll, counters,
   navbar state, mobile menu, particles, budget bars, form.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Navbar: scrolled state ---------- */
  const navbar = document.getElementById("navbar");
  const onScroll = () => {
    navbar.classList.toggle("scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  toggle.addEventListener("click", () => links.classList.toggle("open"));
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("open"))
  );

  /* ---------- Reveal on scroll ---------- */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );
  document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

  /* ---------- Animated counters ---------- */
  const formatNum = (n, pre, suf) =>
    (pre || "") + n.toLocaleString("en-US") + (suf || "");

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        counterObserver.unobserve(el);
        const target = parseInt(el.dataset.target, 10) || 0;
        const pre = el.dataset.prefix || "";
        const suf = el.dataset.suffix || "";
        const dur = 1600;
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min((t - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = formatNum(Math.round(target * eased), pre, suf);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    { threshold: 0.5 }
  );
  document.querySelectorAll(".counter").forEach((el) => counterObserver.observe(el));

  /* ---------- Versus bars ---------- */
  const barObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        barObserver.unobserve(entry.target);
        const classic = document.querySelector(".v-classic");
        const q = document.querySelector(".v-q");
        if (classic) classic.style.width = "96%";
        if (q) q.style.width = "2.5%";
      });
    },
    { threshold: 0.4 }
  );
  const versus = document.querySelector(".versus");
  if (versus) barObserver.observe(versus);

  /* ---------- Budget bars ---------- */
  const budgetObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        budgetObserver.unobserve(entry.target);
        entry.target
          .querySelectorAll(".b-track i")
          .forEach((bar) => (bar.style.width = bar.dataset.w + "%"));
      });
    },
    { threshold: 0.3 }
  );
  const budget = document.querySelector(".budget-rows");
  if (budget) budgetObserver.observe(budget);

  /* ---------- Hero particles (CSS-driven, cheap) ---------- */
  const holder = document.getElementById("particles");
  if (holder && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const COUNT = 26;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < COUNT; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      const size = Math.random() * 3 + 1.5;
      p.style.width = p.style.height = size + "px";
      p.style.left = Math.random() * 100 + "%";
      p.style.setProperty("--drift", Math.random() * 120 - 60 + "px");
      p.style.animationDuration = Math.random() * 10 + 8 + "s";
      p.style.animationDelay = Math.random() * 12 + "s";
      frag.appendChild(p);
    }
    holder.appendChild(frag);
  }

  /* ---------- Invest form (static demo submit) ---------- */
  const form = document.getElementById("investForm");
  const ok = document.getElementById("formOk");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      ok.classList.add("show");
      form.querySelector('button[type="submit"]').textContent = "Sent ✓";
      setTimeout(() => {
        form.reset();
        form.querySelector('button[type="submit"]').textContent = "Send";
      }, 2600);
    });
  }
})();
