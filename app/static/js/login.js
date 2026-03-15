const loginForm = document.getElementById("loginForm");
const resultMessage = document.getElementById("resultMessage");

function clearErrors() {
  document.getElementById("usernameError").innerText = "";
  document.getElementById("passwordError").innerText = "";
  resultMessage.innerText = "";
}

function showResult(text, ok = false) {
  resultMessage.style.color = ok ? "#7ef0b1" : "#ff9d9d";
  resultMessage.innerText = text;
}

loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  clearErrors();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  let valid = true;

  if (!username) {
    document.getElementById("usernameError").innerText = "用户名不能为空";
    valid = false;
  }

  if (!password) {
    document.getElementById("passwordError").innerText = "密码不能为空";
    valid = false;
  }

  if (!valid) return;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!response.ok) {
      showResult(result.message || "登录失败", false);
      return;
    }

    const user = result.data.user || {};
    localStorage.setItem("user_theme", user.theme || "dark");

    showResult("登录成功，正在进入控制台...", true);

    setTimeout(function () {
      window.location.href = "/dashboard";
    }, 400);
  } catch (error) {
    console.error(error);
    showResult("网络异常，请稍后重试", false);
  }
});
