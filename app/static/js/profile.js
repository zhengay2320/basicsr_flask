const resultMessage = document.getElementById("resultMessage");

async function loadProfile() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    window.location.href = "/login";
    return;
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
      return;
    }

    const user = result.data;

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

document.addEventListener("DOMContentLoaded", function () {
  loadProfile();
});
