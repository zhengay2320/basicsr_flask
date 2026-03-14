const APP_THEME_KEY = "user_theme";
const token = localStorage.getItem("access_token");

function safeText(value, fallback = "-") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function applyTheme(theme) {
  const current = theme || localStorage.getItem(APP_THEME_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", current);

  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    themeSelect.value = current;
  }

  localStorage.setItem(APP_THEME_KEY, current);
}

function fillUserCard(user) {
  const usernameEl = document.getElementById("globalUsername");
  const roleEl = document.getElementById("globalUserRole");
  const emailEl = document.getElementById("globalUserEmail");
  const avatarEl = document.getElementById("userAvatar");

  if (usernameEl) usernameEl.innerText = safeText(user.username);
  if (roleEl) roleEl.innerText = safeText(user.role);
  if (emailEl) emailEl.innerText = safeText(user.email);
  if (avatarEl) avatarEl.innerText = (safeText(user.username, "U")).charAt(0).toUpperCase();
}

async function fetchCurrentUser() {
  if (!token) {
    window.location.href = "/login";
    return null;
  }

  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const result = await response.json();

    if (!response.ok) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      return null;
    }

    const user = result.data;
    fillUserCard(user);
    applyTheme(user.theme || "dark");
    return user;
  } catch (error) {
    console.error("load current user failed:", error);
    return null;
  }
}

async function updateTheme(theme) {
  applyTheme(theme);

  if (!token) return;

  try {
    const response = await fetch("/api/auth/theme", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ theme })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error(result.message || "theme update failed");
    }
  } catch (error) {
    console.error("theme save failed:", error);
  }
}

function bindLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", function () {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  });
}

function bindThemeSelect() {
  const themeSelect = document.getElementById("themeSelect");
  if (!themeSelect) return;

  themeSelect.addEventListener("change", function (e) {
    updateTheme(e.target.value);
  });
}

function bindThemeCycle() {
  const themeCycleBtn = document.getElementById("themeCycleBtn");
  if (!themeCycleBtn) return;

  const themes = ["light", "dark", "green", "purple", "ocean"];
  themeCycleBtn.addEventListener("click", function () {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const index = themes.indexOf(current);
    const next = themes[(index + 1) % themes.length];
    updateTheme(next);
  });
}

function initPet() {
  const pet = document.getElementById("petWidget");
  if (!pet) return;

  document.addEventListener("mousemove", function (e) {
    const offsetX = (e.clientX / window.innerWidth - 0.5) * 10;
    const offsetY = (e.clientY / window.innerHeight - 0.5) * 10;
    pet.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });

  pet.addEventListener("click", function () {
    pet.classList.remove("pet-bounce");
    void pet.offsetWidth;
    pet.classList.add("pet-bounce");
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  applyTheme(localStorage.getItem(APP_THEME_KEY) || "dark");
  bindLogout();
  bindThemeSelect();
  bindThemeCycle();
  initPet();
  await fetchCurrentUser();
});

.form-item select,
.form-item textarea,
.form-item input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 16px;
  outline: none;
  padding: 14px 16px;
  color: var(--text);
  background: var(--panel-strong);
  transition: .22s ease;
  font: inherit;
}

.form-item input,
.form-item select {
  min-height: 50px;
}

.form-item textarea {
  resize: vertical;
  min-height: 120px;
}

.form-item input:focus,
.form-item select:focus,
.form-item textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent);
  transform: translateY(-1px);
}

.light-error {
  color: var(--danger);
  min-height: 18px;
  margin-top: 8px;
  font-size: 13px;
}

.task-page-grid,
.task-detail-grid {
  display: grid;
  gap: 18px;
}

.task-page-grid {
  grid-template-columns: 1.35fr .65fr;
}

.task-detail-grid {
  grid-template-columns: 1fr 320px;
}

.task-form-card,
.detail-main-card,
.detail-config-card,
.detail-log-card {
  min-width: 0;
}

.helper-card,
.detail-side-card {
  align-self: start;
}

.form-row {
  margin-bottom: 18px;
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.task-form-actions,
.detail-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.task-result {
  margin-top: 14px;
  min-height: 22px;
}

.helper-list {
  margin: 0;
  padding-left: 18px;
  color: var(--subtext);
  line-height: 1.9;
}

.detail-info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.code-panel {
  margin: 0;
  padding: 18px;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.18);
  color: var(--text);
  overflow: auto;
  line-height: 1.7;
  font-family: Consolas, Monaco, monospace;
  border: 1px solid var(--border);
}

.timeline-list {
  display: grid;
  gap: 14px;
}

.timeline-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 0;
  border-bottom: 1px dashed var(--border);
}

.timeline-item:last-child {
  border-bottom: 0;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  margin-top: 7px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--primary), var(--primary-2));
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary) 14%, transparent);
}

.timeline-title {
  font-weight: 700;
  margin-bottom: 4px;
}

.timeline-sub {
  color: var(--subtext);
  font-size: 13px;
}

.empty-state-card {
  text-align: center;
  padding: 52px 24px;
}

.empty-emoji {
  font-size: 72px;
  margin-bottom: 14px;
}

.empty-state-card h2 {
  margin: 0 0 10px;
}

.empty-state-card p {
  margin: 0;
  color: var(--subtext);
}

@media (max-width: 1180px) {
  .task-page-grid,
  .task-detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .two-col,
  .detail-info-grid {
    grid-template-columns: 1fr;
  }
}
