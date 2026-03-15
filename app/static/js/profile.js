const resultMessage = document.getElementById("resultMessage");

async function loadProfile() {
  try {
    const { resp, result } = await apiFetch("/api/auth/me", {
      method: "GET"
    });

    if (!resp.ok) {
      if (resultMessage) {
        resultMessage.innerText = result.message || "加载用户信息失败";
      }
      return;
    }

    const user = result.data || {};

    document.getElementById("userId").innerText = user.id ?? "-";
    document.getElementById("username").innerText = user.username ?? "-";
    document.getElementById("email").innerText = user.email ?? "-";
    document.getElementById("role").innerText = user.role ?? "-";
    document.getElementById("theme").innerText = user.theme ?? "-";
    document.getElementById("status").innerText = user.status ?? "-";
  } catch (error) {
    console.error(error);
    if (resultMessage) {
      resultMessage.innerText = "加载用户信息失败";
    }
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  const ok = await requireLogin();
  if (!ok) return;
  await loadProfile();
});
