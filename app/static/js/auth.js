async function safeJson(resp) {
  try {
    return await resp.json();
  } catch (e) {
    return { message: "响应解析失败" };
  }
}

async function refreshAccessToken() {
  const resp = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin"
  });
  const result = await safeJson(resp);
  return { resp, result };
}

async function apiFetch(url, options = {}, retry = true) {
  const finalOptions = {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {})
    }
  };

  const resp = await fetch(url, finalOptions);
  const result = await safeJson(resp);

  if (resp.status === 401 && retry) {
    const refreshRet = await refreshAccessToken();
    if (refreshRet.resp.ok) {
      return apiFetch(url, options, false);
    }

    // refresh 失败，说明真正登录失效
    window.location.href = "/login";
    return { resp, result };
  }

  return { resp, result };
}

async function requireLogin() {
  const { resp } = await apiFetch("/api/auth/me", { method: "GET" });
  if (!resp.ok) {
    window.location.href = "/login";
    return false;
  }
  return true;
}

async function logoutAndRedirect() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin"
    });
  } catch (e) {
    console.error(e);
  } finally {
    localStorage.removeItem("user_theme");
    window.location.href = "/login";
  }
}
