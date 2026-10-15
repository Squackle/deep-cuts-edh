/* Owner Command Center: presentation and local session hygiene only.
 * Server-side bearer authorization remains mandatory for every privileged action.
 * Never persist the operator key or one-time issued credentials.
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const main = document.querySelector("main.ops");
  const form = $("opsForm");
  const heading = main?.querySelector("h1");
  const consoleArea = $("ownerConsole");
  if (!main || !form || !heading || !consoleArea) return;

  const intro = heading.nextElementSibling;
  const warning = intro?.nextElementSibling;
  const keyInput = form.elements.operatorKey;
  const keyLabel = keyInput?.closest("label");
  if (!keyInput || !keyLabel) return;
  heading.textContent = "Owner Command Center";
  document.title = "Owner Command Center | Deep Cuts EDH";

  const element = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const subtitle = element("p", "owner-subtitle", "One compact workspace for membership, community, and site operations.");
  const access = element("div", "owner-access-bar");
  keyInput.setAttribute("form", "opsForm");
  keyLabel.classList.add("owner-key-label");
  keyLabel.firstChild && (keyLabel.firstChild.textContent = "Private owner key");
  const keyHelp = element("span", "owner-key-help", "Key stays in this tab only. Every protected action still requires server authorization.");
  const lockButton = element("button", "owner-lock-button", "Lock & clear");
  lockButton.type = "button";
  lockButton.id = "ownerLock";
  const lockStatus = element("span", "owner-lock-status", "Not authenticated · key required");
  lockStatus.id = "ownerLockStatus";
  access.append(keyLabel, lockButton, lockStatus, keyHelp);
  heading.after(subtitle, access);

  const definitions = [
    ["overview", "Overview"],
    ["members", "Memberships"],
    ["directory", "Directory"],
    ["grants", "Free access"],
    ["evidence", "Evidence"],
    ["adfree", "Ad-free"],
    ["tools", "Tools"]
  ];
  const nav = element("nav", "owner-main-nav");
  nav.setAttribute("aria-label", "Admin sections");
  const stage = element("div", "owner-panel-stage");
  const panels = {};
  const buttons = {};
  for (const [id, label] of definitions) {
    const button = element("button", "", label);
    button.type = "button";
    button.dataset.ownerPanel = id;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-controls", "owner-panel-" + id);
    nav.append(button);
    buttons[id] = button;
    const panel = element("section", "owner-workspace-panel");
    panel.id = "owner-panel-" + id;
    panel.setAttribute("aria-label", label);
    panel.hidden = true;
    stage.append(panel);
    panels[id] = panel;
    button.addEventListener("click", () => show(id));
  }
  access.after(nav, stage);

  const overview = panels.overview;
  const overviewTitle = element("h2", "", "Operations at a glance");
  const overviewDescription = element("p", "owner-muted", "Choose a workspace. Only one set of controls is open at a time, and nothing is loaded without the private owner key.");
  overview.append(overviewTitle, overviewDescription);
  const cards = element("div", "owner-overview-grid");
  const cardsData = [
    ["members", "Paid memberships", "Verify Ko-fi payments, issue or revoke a subscriber key."],
    ["directory", "People & activity", "Profiles, membership records, devices, and audit history."],
    ["grants", "Complimentary access", "Create temporary access keys for playtesters or contributors."],
    ["evidence", "Evidence moderation", "Feature legitimate discoveries and hide spam."],
    ["adfree", "Ad-free reconciliation", "Recognize independently verified Ko-fi subscription payments."],
    ["tools", "Operations tools", "Diagnostics, support resources, and security guidance."]
  ];
  for (const [id, label, description] of cardsData) {
    const card = element("button", "owner-overview-card");
    card.type = "button";
    const name = element("strong", "", label);
    const note = element("span", "", description);
    card.append(name, note);
    card.addEventListener("click", () => show(id));
    cards.append(card);
  }
  overview.append(cards);

  const memberTitle = element("h2", "", "Ko-fi membership issuance");
  const memberDescription = element("p", "owner-muted", "Verify payment and account ownership independently before issuing, replacing, or revoking access.");
  panels.members.append(memberTitle, memberDescription);
  if (intro?.tagName === "P") panels.members.append(intro);
  if (warning?.tagName === "P") panels.members.append(warning);
  panels.members.append(form, $("operatorStatus"));

  const issued = $("issuedKeySection");
  if (issued) {
    issued.classList.add("owner-one-time-key");
    stage.before(issued);
  }
  const directoryStatus = $("ownerConsoleStatus");
  if (directoryStatus) {
    directoryStatus.classList.add("owner-global-status");
    directoryStatus.setAttribute("aria-live", "polite");
    panels.directory.prepend(directoryStatus);
  }
  const directoryTitle = element("h2", "", "Member directory & audit");
  panels.directory.append(directoryTitle, consoleArea);
  const moveFormSection = (formId, panelId, title) => {
    const section = $(formId)?.closest("section.owner-grant-form");
    if (!section) return;
    section.classList.add("owner-focused-form");
    panels[panelId].append(section);
    const h = section.querySelector("h3");
    if (h) h.textContent = title;
  };
  moveFormSection("complimentaryForm", "grants", "Complimentary access");
  const grantStatus = element("output", "owner-grant-status");
  grantStatus.id = "ownerGrantStatus";
  grantStatus.setAttribute("role", "status");
  grantStatus.setAttribute("aria-live", "polite");
  panels.grants.append(grantStatus);
  moveFormSection("ownerEvidenceForm", "evidence", "Evidence board moderation");
  moveFormSection("ownerAdFreeForm", "adfree", "Ad-free reconciliation");
  const footer = Array.from(main.children).find(n => n.tagName === "P" && n.querySelector('a[href="diagnostics.html"]'));
  const toolsTitle = element("h2", "", "Tools and security");
  panels.tools.append(toolsTitle);
  if (footer) panels.tools.append(footer);
  const toolsText = element("p", "owner-muted", "Cloudflare Access guards the owner page and dedicated private APIs. Every protected operation also requires your separate owner key, which is never saved in browser storage. Lock & clear removes displayed private data.");
  panels.tools.append(toolsText);

  function show(id) {
    if (!panels[id]) return;
    for (const [key, panel] of Object.entries(panels)) {
      const active = key === id;
      panel.hidden = !active;
      buttons[key].setAttribute("aria-pressed", String(active));
    }
  }
  show("overview");

  function clearSession(reason = "Owner key cleared. Re-enter it to continue.") {
    keyInput.value = "";
    form.reset();
    for (const id of ["complimentaryForm", "ownerEvidenceForm", "ownerAdFreeForm"]) $(id)?.reset();
    if (issued) issued.hidden = true;
    if ($("issuedKey")) $("issuedKey").textContent = "";
    if ($("ownerStats")) $("ownerStats").replaceChildren();
    if ($("ownerTable")) $("ownerTable").replaceChildren(element("p", "", "Locked — reload private records after entering your key."));
    for (const id of ["operatorStatus", "ownerConsoleStatus", "ownerGrantStatus", "ownerEvidenceStatus", "ownerAdFreeStatus"]) {
      if ($(id)) $(id).textContent = "";
    }
    lockStatus.textContent = reason;
  }
  lockButton.addEventListener("click", () => clearSession());

  const idleMs = 15 * 60 * 1000;
  let lastActivity = Date.now();
  let idleTimer;
  const arm = () => {
    lastActivity = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (keyInput.value || !issued?.hidden) clearSession("Auto-locked after 15 minutes of inactivity.");
    }, idleMs);
  };
  for (const event of ["pointerdown", "keydown"]) document.addEventListener(event, arm, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastActivity >= idleMs && (keyInput.value || !issued?.hidden)) {
      clearSession("Auto-locked after 15 minutes of inactivity.");
    }
  });
  keyInput.addEventListener("input", () => {
    lockStatus.textContent = keyInput.value ? "Owner key entered · verification occurs on every request" : "Not authenticated · key required";
    arm();
  });
  arm();
})();
