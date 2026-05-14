document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      mainNav.classList.toggle("open");
    });
  }

  const yearEl = document.getElementById("yearCopy");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const contactForm = document.getElementById("contactForm");
  const contactNote = document.getElementById("contactFormNote");
  if (contactForm && contactNote) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      contactNote.textContent = "Thanks — this demo form does not send mail; your message was noted locally.";
      contactForm.reset();
    });
  }

  const loader = document.getElementById("pageLoader");
  const loaderFill = document.getElementById("loaderBarFill");
  const loaderText = document.getElementById("loaderText");
  if (loader && loaderFill) {
    let p = 0;
    const messages = [
      "Initializing AB Solutions shell…",
      "Hydrating vendor graph…",
      "Warming up the hero experience…",
      "Ready.",
    ];
    const tick = () => {
      p += Math.random() * 18 + 6;
      if (p > 100) p = 100;
      loaderFill.style.width = `${p}%`;
      const msg = messages[Math.min(messages.length - 1, Math.floor((p / 100) * messages.length))];
      if (loaderText) loaderText.textContent = msg;
      if (p < 100) {
        requestAnimationFrame(() => setTimeout(tick, 120 + Math.random() * 140));
      } else {
        setTimeout(() => {
          loader.classList.add("loader--done");
          loader.setAttribute("aria-busy", "false");
          setTimeout(() => {
            loader.style.display = "none";
          }, 700);
        }, 280);
      }
    };
    tick();
  }

  const hero = document.getElementById("home");
  if (hero && document.body.classList.contains("page-home")) {
    hero.style.setProperty("--spot-x", "50%");
    hero.style.setProperty("--spot-y", "42%");

    hero.addEventListener(
      "pointermove",
      (e) => {
        const r = hero.getBoundingClientRect();
        const x = ((e.clientX - r.left) / Math.max(r.width, 1)) * 100;
        const y = ((e.clientY - r.top) / Math.max(r.height, 1)) * 100;
        hero.style.setProperty("--spot-x", `${x}%`);
        hero.style.setProperty("--spot-y", `${y}%`);
      },
      { passive: true }
    );

    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--spot-x", "50%");
      hero.style.setProperty("--spot-y", "42%");
    });

    const magnetic = hero.querySelector(".hero-actions");
    const magBtns = magnetic ? magnetic.querySelectorAll("a.btn") : [];
    if (magnetic && magBtns.length) {
      magnetic.addEventListener(
        "pointermove",
        (e) => {
          magBtns.forEach((btn) => {
            const br = btn.getBoundingClientRect();
            const cx = br.left + br.width / 2;
            const cy = br.top + br.height / 2;
            const dx = e.clientX - cx;
            const dy = e.clientY - cy;
            const dist = Math.hypot(dx, dy);
            const pull = Math.max(0, 1 - Math.min(dist, 220) / 220);
            const mx = dx * 0.08 * pull;
            const my = dy * 0.08 * pull;
            btn.style.transform = `translate(${mx}px, ${my}px)`;
          });
        },
        { passive: true }
      );
      magnetic.addEventListener("pointerleave", () => {
        magBtns.forEach((btn) => {
          btn.style.transform = "";
        });
      });
    }
  }
});
