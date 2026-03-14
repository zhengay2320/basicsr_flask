const registerForm = document.getElementById("registerForm");
const resultMessage = document.getElementById("resultMessage");

function clearErrors() {
  document.getElementById("usernameError").innerText = "";
  document.getElementById("emailError").innerText = "";
  document.getElementById("passwordError").innerText = "";
  document.getElementById("confirmPasswordError").innerText = "";
  resultMessage.innerText = "";
}

function showResult(text, ok = false) {
  resultMessage.style.color = ok ? "#7ef0b1" : "#ff9d9d";
  resultMessage.innerText = text;
}

registerForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  clearErrors();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  let valid = true;

  if (!username) {
    document.getElementById("usernameError").innerText = "用户名不能为空";
    valid = false;
  } else if (username.length < 3) {
    document.getElementById("usernameError").innerText = "用户名至少 3 个字符";
    valid = false;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById("emailError").innerText = "邮箱格式不正确";
    valid = false;
  }

  if (!password) {
    document.getElementById("passwordError").innerText = "密码不能为空";
    valid = false;
  } else if (password.length < 6) {
    document.getElementById("passwordError").innerText = "密码至少 6 位";
    valid = false;
  }

  if (!confirmPassword) {
    document.getElementById("confirmPasswordError").innerText = "请确认密码";
    valid = false;
  } else if (password !== confirmPassword) {
    document.getElementById("confirmPasswordError").innerText = "两次密码输入不一致";
    valid = false;
  }

  if (!valid) return;

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        email,
        password
      })
    });

    const result = await response.json();

    if (!response.ok) {
      showResult(result.message || "注册失败", false);
      return;
    }

    showResult("注册成功，正在跳转到登录页...", true);

    setTimeout(function () {
      window.location.href = "/login";
    }, 900);
  } catch (error) {
    console.error(error);
    showResult("网络异常，请稍后重试", false);
  }
});
