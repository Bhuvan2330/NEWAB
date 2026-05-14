(function () {
  "use strict";

  const SESSION_KEY = "absolutions_session";

  const DEMO = {
    vendor: { email: "vendor@absolutions.demo", password: "vendor123" },
    projectAdmin: { email: "projectadmin@absolutions.demo", password: "pa123" },
    admin2: { email: "admin2@absolutions.demo", password: "a2123" },
  };

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function authenticate(role, email, password) {
    const creds = DEMO[role];
    if (!creds) return false;
    return normalizeEmail(email) === creds.email && password === creds.password;
  }

  function sessionPayload(role, email) {
    const name =
      role === "vendor"
        ? "Demo Vendor"
        : role === "projectAdmin"
          ? "Project Admin"
          : "Admin2";
    return { role, email: normalizeEmail(email), name, at: Date.now() };
  }

  /** @returns {boolean} success */
  function signIn(role, email, password) {
    if (!authenticate(role, email, password)) return false;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionPayload(role, email)));
    return true;
  }

  window.ABSPortalAuth = { SESSION_KEY, DEMO, authenticate, signIn, normalizeEmail };
})();
