(function () {
  "use strict";

  const STORAGE_KEY = "absolutions_data_v1";
  const SESSION_KEY = "absolutions_session";

  const TASK_PIPELINE = [
    {
      key: "enquiry",
      order: 1,
      shortLabel: "Enquiry",
      title: "Vendor enquiry",
      description: "Capture scope, commercial signals, and fit for the selected project.",
      feedsInto: "meeting",
      roles: ["vendor"],
    },
    {
      key: "meeting",
      order: 2,
      shortLabel: "Meeting",
      title: "Vendor meeting & notes",
      description:
        "Choose a communication channel (Google Meet or Microsoft Teams), attach the join link, and file notes so delivery stays tied to the enquiry.",
      dependsOn: "enquiry",
      roles: ["vendor"],
      fields: ["channel", "meetingLink", "notes"],
    },
    {
      key: "vendorOnboarding",
      order: 3,
      shortLabel: "Vendor on-boarding",
      title: "Vendor onboarding",
      description: "Compliance, contracts, and access provisioning—continues after meeting outcomes are recorded.",
      dependsOn: "meeting",
      roles: ["vendor"],
    },
    {
      key: "projectOnboarding",
      order: 5,
      shortLabel: "Project on-boarding",
      title: "Project onboarding",
      description: "Project-side onboarding builds on vendor onboarding: milestones, environments, RAID.",
      dependsOn: "vendorOnboarding",
      roles: ["vendor"],
    },
    {
      key: "requirements",
      order: 6,
      shortLabel: "Requirements",
      title: "Requirement gathering",
      description: "Consolidate requirements once project onboarding anchors scope and delivery structure.",
      dependsOn: "projectOnboarding",
      roles: ["vendor"],
    },
    {
      key: "kickoff",
      order: 7,
      shortLabel: "Kickoff",
      title: "Project kickoff",
      description: "Final step: formal kickoff after requirements are captured and agreed for this vendor–project pair.",
      dependsOn: "requirements",
      roles: ["vendor"],
    },
  ];

  const DEFAULT_PROJECTS = [
    {
      id: "prj-edge",
      name: "Edge telemetry refresh",
      description: "Modernize field gateways, streaming pipelines, and observability for industrial telemetry.",
    },
    {
      id: "prj-identity",
      name: "Identity fabric hardening",
      description: "Zero-trust alignment across IdP, device compliance, and privileged access workflows.",
    },
    {
      id: "prj-data",
      name: "Data platform consolidation",
      description: "Lakehouse design, batch + streaming ingestion, and governed self-service analytics.",
    },
  ];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function ensureSeed() {
    let state = loadState();
    if (!state || !Array.isArray(state.projects)) {
      state = {
        projects: DEFAULT_PROJECTS,
        submissions: [],
      };
      saveState(state);
    }
    if (!Array.isArray(state.submissions)) state.submissions = [];
    if (migrateSubmissions(state)) saveState(state);
    return state;
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function uid() {
    return "sub_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function submissionStatus(sub) {
    if (sub.rejected) return "rejected";
    if (sub.acceptedByPa && sub.acceptedByA2) return "accepted_both";
    if (sub.acceptedByPa || sub.acceptedByA2) return "partial";
    return "pending";
  }

  function statusLabel(sub) {
    const st = submissionStatus(sub);
    if (st === "rejected") return "Rejected";
    if (st === "accepted_both") return "Accepted by Project Admin & Admin2";
    if (st === "partial") return "Awaiting second admin";
    return "Awaiting Project Admin & Admin2";
  }

  function isTaskUnlocked(sub, taskKey) {
    if (submissionStatus(sub) !== "accepted_both") return taskKey === "enquiry";
    const idx = TASK_PIPELINE.findIndex((t) => t.key === taskKey);
    if (idx <= 0) return true;
    for (let i = 0; i < idx; i += 1) {
      const prev = TASK_PIPELINE[i].key;
      if (!sub.tasks[prev] || !sub.tasks[prev].done) return false;
    }
    return true;
  }

  /** Why a task is locked: admin gate, or previous step incomplete. */
  function taskGate(sub, taskKey) {
    if (taskKey === "enquiry") return { kind: "open" };
    const st = submissionStatus(sub);
    if (st !== "accepted_both") {
      return {
        kind: "admin",
        message: `Waiting for Project Admin and Admin2 to accept this vendor–project pairing (${statusLabel(sub)}).`,
      };
    }
    const idx = TASK_PIPELINE.findIndex((t) => t.key === taskKey);
    for (let i = 0; i < idx; i += 1) {
      const prevDef = TASK_PIPELINE[i];
      const prevTask = sub.tasks[prevDef.key];
      if (!prevTask || !prevTask.done) {
        return {
          kind: "sequence",
          message: `Complete step ${prevDef.order} (${prevDef.title}) before step ${TASK_PIPELINE[idx].order}.`,
        };
      }
    }
    return { kind: "open" };
  }

  function taskDefByKey(key) {
    return TASK_PIPELINE.find((t) => t.key === key);
  }

  function mergeTaskDefaults(raw) {
    const o = { ...(raw || {}) };
    TASK_PIPELINE.forEach((t) => {
      if (!o[t.key]) {
        o[t.key] = { done: false, summary: "", channel: "", meetingLink: "", notes: "" };
      } else {
        o[t.key] = {
          done: !!o[t.key].done,
          summary: String(o[t.key].summary || ""),
          channel: String(o[t.key].channel || ""),
          meetingLink: String(o[t.key].meetingLink || ""),
          notes: String(o[t.key].notes || ""),
        };
      }
    });
    return o;
  }

  function migrateSubmissions(state) {
    let changed = false;
    (state.submissions || []).forEach((sub) => {
      if (!sub.tasks) {
        sub.tasks = defaultTasks();
        changed = true;
        return;
      }
      const merged = mergeTaskDefaults(sub.tasks);
      if (JSON.stringify(merged) !== JSON.stringify(sub.tasks)) {
        sub.tasks = merged;
        changed = true;
      }
    });
    return changed;
  }

  function pipelineRibbonHtml(sub) {
    const currentDef =
      TASK_PIPELINE.find((def) => {
        const g = taskGate(sub, def.key);
        const t = sub.tasks[def.key] || {};
        return g.kind === "open" && !t.done;
      }) || null;

    return `<div class="pipeline-ribbon" role="list" aria-label="Task chain for this engagement">${TASK_PIPELINE.map((def, i) => {
      const task = sub.tasks[def.key] || {};
      const gate = taskGate(sub, def.key);
      let css = "pipeline-step--locked";
      let badge = "Locked";

      if (def.key === "enquiry") {
        if (task.done) {
          css = "pipeline-step--done";
          badge = "Done";
        } else if (task.summary) {
          css = "pipeline-step--current";
          badge = "Submitted";
        } else {
          css = "pipeline-step--current";
          badge = "Draft";
        }
      } else if (gate.kind === "admin") {
        css = "pipeline-step--locked";
        badge = "Awaiting admins";
      } else if (gate.kind === "sequence") {
        css = "pipeline-step--locked";
        badge = "Queued";
      } else if (task.done) {
        css = "pipeline-step--done";
        badge = "Done";
      } else if (currentDef && def.key === currentDef.key) {
        css = "pipeline-step--current";
        badge = "In progress";
      } else {
        css = "pipeline-step--locked";
        badge = "Queued";
      }

      const conn =
        i < TASK_PIPELINE.length - 1
          ? `<span class="pipeline-conn" aria-hidden="true"><span class="pipeline-conn-line"></span></span>`
          : "";
      return `<div class="pipeline-step-wrap">
        <div class="pipeline-step ${css}" title="${escapeHtml(def.title)}">
          <span class="pipeline-num">${def.order}</span>
          <span class="pipeline-label">${escapeHtml(def.shortLabel)}</span>
          <span class="pipeline-state">${badge}</span>
        </div>${conn}</div>`;
    }).join("")}</div>`;
  }

  function vendorWorkflowLabel(sub) {
    if (submissionStatus(sub) !== "accepted_both") {
      return "Step 1 only · waiting for Project Admin + Admin2";
    }
    const allDone = TASK_PIPELINE.every((d) => sub.tasks[d.key] && sub.tasks[d.key].done);
    if (allDone) return "All steps complete (through kickoff)";
    const cur =
      TASK_PIPELINE.find((d) => {
        const g = taskGate(sub, d.key);
        const t = sub.tasks[d.key] || {};
        return g.kind === "open" && !t.done;
      }) || null;
    return cur ? `Working step ${cur.order}: ${cur.title}` : "—";
  }

  function relationshipHintHtml(def, sub, unlocked) {
    const st = submissionStatus(sub);
    if (def.key === "enquiry") {
      if (st !== "accepted_both") {
        return `<p class="task-feed muted"><strong>How the chain works:</strong> Step <strong>2</strong> (meeting & notes under <em>Google Meet</em> or <em>Microsoft Teams</em>) unlocks only after both admins accept this enquiry for the project.</p>`;
      }
      return `<p class="task-feed muted"><strong>Feeds into step 2:</strong> Your enquiry is the baseline. Step 2 must record the official <strong>communication channel</strong>, join link, and meeting notes before step 3 can start.</p>`;
    }
    if (def.key === "meeting" && unlocked) {
      return `<p class="task-feed muted"><strong>Communication layer:</strong> Pick <strong>Google Meet</strong> or <strong>Microsoft Teams</strong>, paste the join or scheduling URL, and capture notes that trace back to step 1.</p>`;
    }
    if (unlocked && def.dependsOn) {
      const prev = taskDefByKey(def.dependsOn);
      if (prev) {
        return `<p class="task-feed muted"><strong>Relationship:</strong> Step ${def.order} follows step ${prev.order} (${prev.title}). Finish step ${prev.order} first; this summary should reflect what that step produced.</p>`;
      }
    }
    return "";
  }

  function validateMeetingSave(wantDone, channel, meetingLink, notes) {
    if (!wantDone) return null;
    if (channel !== "Google Meet" && channel !== "Microsoft Teams") {
      return "To complete step 2, choose Google Meet or Microsoft Teams as the communication channel.";
    }
    const link = String(meetingLink || "").trim();
    if (!/^https?:\/\//i.test(link)) {
      return "Paste a valid http(s) meeting link for the selected channel.";
    }
    if (String(notes || "").trim().length < 8) {
      return "Add meeting notes (at least a few words) so step 3 can reference this session.";
    }
    return null;
  }

  function validateGenericSave(wantDone, summary) {
    if (!wantDone) return null;
    if (String(summary || "").trim().length < 12) {
      return "Add a short summary of evidence or outcomes before marking this step complete.";
    }
    return null;
  }

  function showFormError(form, message) {
    let el = form.querySelector(".inline-error");
    if (!el) {
      el = document.createElement("p");
      el.className = "inline-error";
      el.setAttribute("role", "alert");
      form.insertBefore(el, form.firstChild);
    }
    el.textContent = message;
  }

  function clearFormError(form) {
    const el = form.querySelector(".inline-error");
    if (el) el.textContent = "";
  }

  function defaultTasks() {
    const o = {};
    TASK_PIPELINE.forEach((t) => {
      o[t.key] = {
        done: false,
        summary: "",
        channel: "",
        meetingLink: "",
        notes: "",
      };
    });
    o.enquiry.done = false;
    return o;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  }

  function renderVendorTaskBlock(sub, projects) {
    const proj = projects.find((p) => p.id === sub.projectId);
    const st = submissionStatus(sub);
    const blocks = TASK_PIPELINE.map((def) => {
      const unlocked = isTaskUnlocked(sub, def.key);
      const gate = taskGate(sub, def.key);
      const task = sub.tasks[def.key] || {};
      const lockMsg =
        !unlocked && def.key !== "enquiry"
          ? `<p class="warn">${escapeHtml(gate.message || "This step is locked.")}</p>`
          : "";
      const rel = relationshipHintHtml(def, sub, unlocked);
      const enquiryBody =
        def.key === "enquiry"
          ? `<p><strong>Submitted copy</strong></p><pre class="pre-block">${escapeHtml(sub.tasks.enquiry.summary || "")}</pre>`
          : "";
      const meetingForm =
        def.key === "meeting" && unlocked
          ? `<form class="inline-task-form" data-sub="${escapeHtml(sub.id)}" data-task="meeting">
              <p class="inline-error" role="alert"></p>
              <label>Communication channel <span class="req">*</span>
                <select name="channel">
                  <option value="">Select Google Meet or Microsoft Teams…</option>
                  <option value="Google Meet" ${task.channel === "Google Meet" ? "selected" : ""}>Google Meet</option>
                  <option value="Microsoft Teams" ${task.channel === "Microsoft Teams" ? "selected" : ""}>Microsoft Teams</option>
                </select>
              </label>
              <label>Meeting link (join / schedule URL) <span class="req">*</span>
                <input name="meetingLink" type="url" placeholder="https://meet.google.com/… or https://teams.microsoft.com/…" value="${escapeHtml(task.meetingLink || "")}" />
              </label>
              <label>Meeting notes <span class="req">*</span>
                <textarea name="notes" rows="4" placeholder="Decisions, attendees, risks, follow-ups—must align with the enquiry in step 1.">${escapeHtml(task.notes || "")}</textarea>
              </label>
              <label class="check"><input type="checkbox" name="done" ${task.done ? "checked" : ""}/> Mark step 2 complete (requires channel, link, and notes)</label>
              <button type="submit" class="btn btn-primary">Save step 2</button>
            </form>`
          : "";
      const genericForm =
        def.key !== "enquiry" && def.key !== "meeting" && unlocked
          ? `<form class="inline-task-form" data-sub="${escapeHtml(sub.id)}" data-task="${escapeHtml(def.key)}">
              <p class="inline-error" role="alert"></p>
              <label>Summary / evidence <span class="req">*</span>
                <textarea name="summary" rows="4" placeholder="Artifacts, checklist outcomes, links—required to mark this step complete.">${escapeHtml(task.summary || "")}</textarea>
              </label>
              <label class="check"><input type="checkbox" name="done" ${task.done ? "checked" : ""}/> Mark step ${def.order} complete</label>
              <button type="submit" class="btn btn-primary">Save ${escapeHtml(def.title)}</button>
            </form>`
          : "";
      const stateLabel = task.done
        ? "Done"
        : unlocked
          ? "In progress"
          : gate.kind === "admin"
            ? "Awaiting admins"
            : "Queued";
      return `
        <details class="task-details" ${def.key === "enquiry" ? "open" : ""}>
          <summary>
            <span class="task-order">${def.order}.</span> ${escapeHtml(def.title)}
            <span class="task-meta">${escapeHtml(proj ? proj.name : sub.projectId)} · ${stateLabel}</span>
          </summary>
          <div class="task-body">
            <p class="muted">${escapeHtml(def.description)}</p>
            ${rel}
            ${lockMsg}
            ${enquiryBody}
            ${meetingForm}
            ${genericForm}
          </div>
        </details>`;
    }).join("");

    return `
      <section class="engagement-block">
        <div class="engagement-head">
          <h3>${escapeHtml(proj ? proj.name : sub.projectId)}</h3>
          <span class="status-chip status-${escapeHtml(st)}">${escapeHtml(statusLabel(sub))}</span>
        </div>
        ${pipelineRibbonHtml(sub)}
        <p class="pipeline-legend muted">Working order: <strong>1</strong> Vendor enquiry → <strong>2</strong> Meeting &amp; notes (Google Meet or Microsoft Teams) → <strong>3</strong> Vendor onboarding → <strong>5</strong> Project onboarding → <strong>6</strong> Requirement gathering → <strong>7</strong> Project kickoff.</p>
        <div class="task-stack">${blocks}</div>
      </section>`;
  }

  function renderVendor(state, session, root) {
    const mySubs = state.submissions.filter((s) => s.vendorEmail === session.email);
    const projects = state.projects;

    const projectsOptions = projects
      .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
      .join("");

    const rows = mySubs
      .map((sub) => {
        const proj = projects.find((p) => p.id === sub.projectId);
        const st = submissionStatus(sub);
        const wf = vendorWorkflowLabel(sub);
        return `
        <tr data-sub="${escapeHtml(sub.id)}">
          <td>${escapeHtml(proj ? proj.name : sub.projectId)}</td>
          <td><span class="status-chip status-${escapeHtml(st)}">${escapeHtml(statusLabel(sub))}</span></td>
          <td class="muted small">${escapeHtml(wf)}</td>
        </tr>`;
      })
      .join("");

    const taskStackHtml = mySubs.length
      ? mySubs.map((s) => renderVendorTaskBlock(s, projects)).join("")
      : `<p class="muted">Submit an enquiry to see the task pipeline for that engagement.</p>`;

    root.innerHTML = `
      <div class="portal-grid">
        <section class="portal-card">
          <h2>Vendor/project relationship</h2>
          <p class="muted">Each enquiry is tied to a project selection and a shared approval record. Project Admin and Admin2 sign off the pairing so meeting notes, onboarding, requirements, and kickoff stay connected to the same vendor–project login relationship.</p>
        </section>
        <section class="portal-card span-2">
          <h2>Propose against a project</h2>
          <p class="muted">Select a project and submit your enquiry. <strong>Project Admin</strong> and <strong>Admin2</strong> must both accept before the rest of the tasks unlock.</p>
          <form class="portal-form" id="vendorCreateForm">
            <label>Project
              <select name="projectId" required>${projectsOptions}</select>
            </label>
            <label>Enquiry title
              <input name="title" required maxlength="160" placeholder="Short title for your proposal" />
            </label>
            <label>Enquiry detail
              <textarea name="detail" rows="4" required placeholder="Capabilities, timelines, assumptions…"></textarea>
            </label>
            <button type="submit" class="btn btn-primary">Submit vendor enquiry</button>
          </form>
        </section>

        <section class="portal-card">
          <h2>Your engagements</h2>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Project</th><th>Admin gate</th><th>Vendor workflow</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="3" class="muted">No submissions yet.</td></tr>`}</tbody>
            </table>
          </div>
        </section>

        <section class="portal-card span-2" id="vendorTaskPanel">
          <h2>Task pipeline</h2>
          <p class="muted">Relationship model: <strong>1 → 2 → 3 → 5 → 6 → 7</strong> runs in order for each vendor–project pair. Step <strong>2</strong> is anchored to <em>Google Meet</em> or <em>Microsoft Teams</em>. Steps 2–7 stay locked until Project Admin <em>and</em> Admin2 accept the pairing.</p>
          ${taskStackHtml}
        </section>
      </div>
    `;

    const form = document.getElementById("vendorCreateForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const projectId = fd.get("projectId");
        const title = String(fd.get("title") || "").trim();
        const detail = String(fd.get("detail") || "").trim();
        const fresh = ensureSeed();
        const sub = {
          id: uid(),
          projectId,
          vendorEmail: session.email,
          vendorName: session.name || "Vendor",
          title,
          detail,
          rejected: false,
          acceptedByPa: false,
          acceptedByA2: false,
          tasks: defaultTasks(),
        };
        sub.tasks.enquiry.summary = `${title}\n\n${detail}`;
        sub.tasks.enquiry.done = true;
        fresh.submissions.push(sub);
        saveState(fresh);
        window.location.reload();
      });
    }

    root.querySelectorAll(".inline-task-form").forEach((f) => {
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        clearFormError(f);
        const subId = f.dataset.sub;
        const taskKey = f.dataset.task;
        const fd = new FormData(f);
        const data = ensureSeed();
        const sub = data.submissions.find((s) => s.id === subId);
        if (!sub) return;
        if (!isTaskUnlocked(sub, taskKey)) {
          showFormError(f, "This step is not available yet.");
          return;
        }
        const t = sub.tasks[taskKey];
        const wantDone = fd.get("done") === "on";
        if (taskKey === "meeting") {
          const channel = String(fd.get("channel") || "");
          const meetingLink = String(fd.get("meetingLink") || "").trim();
          const notes = String(fd.get("notes") || "").trim();
          const err = validateMeetingSave(wantDone, channel, meetingLink, notes);
          if (err) {
            showFormError(f, err);
            return;
          }
          t.channel = channel;
          t.meetingLink = meetingLink;
          t.notes = notes;
          t.done = wantDone;
        } else {
          const summary = String(fd.get("summary") || "").trim();
          const err = validateGenericSave(wantDone, summary);
          if (err) {
            showFormError(f, err);
            return;
          }
          t.summary = summary;
          t.done = wantDone;
        }
        saveState(data);
        window.location.reload();
      });
    });
  }

  function renderAdmin(state, session, root, role) {
    const label = role === "projectAdmin" ? "Project Admin" : "Admin2 (Assistant Admin)";
    const subs = state.submissions.slice().reverse();

    const rows = subs
      .map((sub) => {
        const proj = state.projects.find((p) => p.id === sub.projectId);
        const st = submissionStatus(sub);
        const paDone = sub.acceptedByPa;
        const a2Done = sub.acceptedByA2;
        const canAct =
          role === "projectAdmin" ? !paDone && !sub.rejected : !a2Done && !sub.rejected;
        const btn =
          st === "accepted_both" || sub.rejected
            ? ""
            : `<button type="button" class="btn btn-primary btn-small" data-accept="${escapeHtml(sub.id)}" ${canAct ? "" : "disabled"}>${
                role === "projectAdmin" ? "Accept as Project Admin" : "Accept as Admin2"
              }</button>`;
        const wf = vendorWorkflowLabel(sub);
        return `<tr>
          <td>${escapeHtml(sub.vendorName)}<div class="muted small">${escapeHtml(sub.vendorEmail)}</div></td>
          <td>${escapeHtml(proj ? proj.name : sub.projectId)}</td>
          <td>${escapeHtml(sub.title)}</td>
          <td><span class="status-chip status-${escapeHtml(st)}">${escapeHtml(statusLabel(sub))}</span></td>
          <td class="muted small">${escapeHtml(wf)}</td>
          <td>PA: ${paDone ? "✓" : "—"} · A2: ${a2Done ? "✓" : "—"}</td>
          <td class="actions">${btn}</td>
        </tr>`;
      })
      .join("");

    root.innerHTML = `
      <section class="portal-card">
        <h2>Shared engagement record</h2>
        <p class="muted">This workspace links vendors and the project team through the same vendor–project submission. Enquiry, meeting notes, onboarding, requirements, and kickoff are all attached to the same pairing that both admins approve.</p>
      </section>
      <section class="portal-card span-2">
        <h2>${escapeHtml(label)} · Approvals</h2>
        <p class="muted">Each row is a vendor-selected project with enquiry. Both Project Admin and Admin2 must accept to unlock the downstream task chain for that vendor.</p>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Project</th>
                <th>Enquiry</th>
                <th>Pairing status</th>
                <th>Vendor workflow</th>
                <th>Sign-offs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows || ""}</tbody>
          </table>
        </div>
      </section>

      <section class="portal-card span-2">
        <h2>Task reference</h2>
        <ol class="task-ref-list">
          ${TASK_PIPELINE.map((t) => `<li><strong>${t.order}. ${escapeHtml(t.title)}</strong> — ${escapeHtml(t.description)}</li>`).join("")}
        </ol>
      </section>
    `;

    root.querySelectorAll("[data-accept]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-accept");
        const data = ensureSeed();
        const sub = data.submissions.find((s) => s.id === id);
        if (!sub || sub.rejected) return;
        if (role === "projectAdmin") sub.acceptedByPa = true;
        if (role === "admin2") sub.acceptedByA2 = true;
        saveState(data);
        window.location.reload();
      });
    });
  }

  function init() {
    const root = document.getElementById("portalRoot");
    const loading = document.getElementById("portalLoading");
    const session = getSession();
    if (!session || !session.role) {
      window.location.href = "login.html";
      return;
    }

    if (loading) loading.remove();

    const rolePill = document.getElementById("rolePill");
    if (rolePill) {
      rolePill.textContent =
        session.role === "vendor"
          ? "Vendor"
          : session.role === "projectAdmin"
            ? "Project Admin"
            : "Admin2";
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);

    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");
    if (menuToggle && mainNav) {
      menuToggle.addEventListener("click", () => mainNav.classList.toggle("open"));
    }

    const state = ensureSeed();

    if (session.role === "vendor") renderVendor(state, session, root);
    else if (session.role === "projectAdmin" || session.role === "admin2") renderAdmin(state, session, root, session.role);
    else {
      root.innerHTML = `<p class="warn">Unknown role. <a href="login.html">Login</a></p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
