const APP_THEME_KEY = "user_theme";

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

  const username = safeText(user.username, "用户");
  const role = safeText(user.role, "普通用户");
  const email = safeText(user.email, "--");

  if (usernameEl) usernameEl.textContent = username;
  if (roleEl) roleEl.textContent = role;
  if (emailEl) emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();
}

async function apiFetch(url, options = {}) {
  const finalOptions = {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {})
    }
  };

  const resp = await fetch(url, finalOptions);
  let result = {};
  try {
    result = await resp.json();
  } catch (e) {
    result = {};
  }

  if (resp.status === 401) {
    window.location.href = "/login";
    return { resp, result };
  }

  return { resp, result };
}

async function fetchCurrentUser() {
  try {
    const { resp, result } = await apiFetch("/api/auth/me", {
      method: "GET"
    });

    if (!resp.ok) {
      return null;
    }

    const user = result.data || {};
    fillUserCard(user);
    applyTheme(user.theme || localStorage.getItem(APP_THEME_KEY) || "dark");
    return user;
  } catch (error) {
    console.error("load current user failed:", error);
    return null;
  }
}

async function requireLogin() {
  const user = await fetchCurrentUser();
  if (!user) {
    window.location.href = "/login";
    return false;
  }
  return true;
}

async function updateTheme(theme) {
  applyTheme(theme);

  try {
    const { resp, result } = await apiFetch("/api/auth/theme", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ theme })
    });

    if (!resp.ok) {
      console.error(result.message || "theme update failed");
    }
  } catch (error) {
    console.error("theme save failed:", error);
  }
}

async function logoutAndRedirect() {
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST"
    });
  } finally {
    window.location.href = "/login";
  }
}

function bindLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async function () {
    await logoutAndRedirect();
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
    const currentIndex = themes.indexOf(current);
    const next = themes[(currentIndex + 1) % themes.length];
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
