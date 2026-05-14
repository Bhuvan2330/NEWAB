document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => mainNav.classList.toggle("open"));
  }

  const form = document.getElementById("vendorLoginForm");
  const err = document.getElementById("loginError");
  const auth = window.ABSPortalAuth;
  if (!form || !auth) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (err) err.textContent = "";
    const fd = new FormData(form);
    const ok = auth.signIn("vendor", fd.get("email"), fd.get("password"));
    if (!ok) {
      if (err) err.textContent = "Invalid vendor email or password. Use the demo account shown on the left.";
      return;
    }
    window.location.href = "tasks.html";
  });
});
