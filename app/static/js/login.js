const loginForm = document.getElementById("loginForm");
const resultMessage = document.getElementById("resultMessage");

function clearErrors() {
    document.getElementById("usernameError").innerText = "";
    document.getElementById("passwordError").innerText = "";
    resultMessage.innerText = "";
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
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const result = await response.json();

        if (!response.ok) {
            resultMessage.style.color = "#f56c6c";
            resultMessage.innerText = result.message || "登录失败";
            return;
        }

        const token = result.data.access_token;
        localStorage.setItem("access_token", token);

        resultMessage.style.color = "#67c23a";
        resultMessage.innerText = "登录成功，正在跳转...";

        setTimeout(() => {
            window.location.href = "/dashboard";
        }, 800);

    } catch (error) {
        resultMessage.style.color = "#f56c6c";
        resultMessage.innerText = "网络异常，请稍后重试";
        console.error(error);
    }
});
