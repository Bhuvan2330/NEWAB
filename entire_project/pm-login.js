document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => mainNav.classList.toggle("open"));
  }

  const tabButtons = document.querySelectorAll(".tab-button");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const loginError = document.getElementById("pmLoginError");
  const auth = window.ABSPortalAuth;
  if (!auth) return;

  function setActiveTab(button) {
    tabButtons.forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    });
    tabPanels.forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    button.setAttribute("aria-selected", "true");
    const target = document.getElementById(button.dataset.target);
    if (target) target.classList.add("active");
    if (loginError) loginError.textContent = "";
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button));
  });

  document.querySelectorAll("#pmFormPa, #pmFormA2").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = "";
      const role = form.dataset.role;
      const fd = new FormData(form);
      const ok = auth.signIn(role, fd.get("email"), fd.get("password"));
      if (!ok) {
        if (loginError) {
          loginError.textContent =
            "Invalid credentials. Use the Project Admin or Admin2 demo accounts listed beside the form.";
        }
        return;
      }
      window.location.href = "tasks.html";
    });
  });
});
