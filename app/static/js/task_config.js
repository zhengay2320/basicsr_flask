const tokenCfg = localStorage.getItem("access_token");
if (!tokenCfg) {
    window.location.href = "/login";
}

const taskIdCfg = window.__TASK_ID__;
const configEditor = document.getElementById("configEditor");
const configNameEl = document.getElementById("configName");
const versionList = document.getElementById("versionList");
const msgBox = document.getElementById("msgBox");

async function loadCurrentConfig() {
    const resp = await fetch(`/api/configs/task/${taskIdCfg}/current`, {
        headers: { "Authorization": "Bearer " + tokenCfg }
    });
    const result = await resp.json();
    if (!resp.ok) {
        msgBox.innerText = result.message || "加载当前配置失败";
        return;
    }

    configEditor.value = result.data.config_text || "";
}

async function loadVersions() {
    const resp = await fetch(`/api/configs/task/${taskIdCfg}/versions`, {
        headers: { "Authorization": "Bearer " + tokenCfg }
    });
    const result = await resp.json();
    if (!resp.ok) {
        versionList.innerText = result.message || "加载版本失败";
        return;
    }

    versionList.innerHTML = "";
    (result.data || []).forEach(item => {
        const div = document.createElement("div");
        div.className = "run-card";
        div.innerHTML = `
            <p><strong>版本号:</strong> v${item.version_no}</p>
            <p><strong>名称:</strong> ${item.config_name || "-"}</p>
            <p><strong>路径:</strong> ${item.yaml_path || "-"}</p>
            <p><strong>创建时间:</strong> ${item.created_at || "-"}</p>
            <p><strong>当前版本:</strong> ${item.is_current ? "是" : "否"}</p>
            <button class="rollback-btn">回退到该版本</button>
        `;

        div.querySelector(".rollback-btn").addEventListener("click", async () => {
            const ok = confirm(`确认回退到 v${item.version_no} 吗？这会生成一个新的当前版本。`);
            if (!ok) return;

            const rollbackResp = await fetch(`/api/configs/task/${taskIdCfg}/rollback`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + tokenCfg
                },
                body: JSON.stringify({ version_no: item.version_no })
            });

            const rollbackResult = await rollbackResp.json();
            if (!rollbackResp.ok) {
                msgBox.innerText = rollbackResult.message || "回退失败";
                return;
            }

            msgBox.innerText = "回退成功，已生成新的当前版本";
            await loadCurrentConfig();
            await loadVersions();
        });

        versionList.appendChild(div);
    });
}

document.getElementById("saveVersionBtn").addEventListener("click", async () => {
    const configText = configEditor.value;
    const configName = configNameEl.value.trim();

    if (!configText.trim()) {
        msgBox.innerText = "配置内容不能为空";
        return;
    }

    const resp = await fetch(`/api/configs/task/${taskIdCfg}/save-version`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + tokenCfg
        },
        body: JSON.stringify({
            config_text: configText,
            config_name: configName
        })
    });

    const result = await resp.json();
    if (!resp.ok) {
        msgBox.innerText = result.message || "保存版本失败";
        return;
    }

    msgBox.innerText = `新版本已保存：v${result.data.version_no}`;
    configNameEl.value = "";
    await loadCurrentConfig();
    await loadVersions();
});

(async function init() {
    await loadCurrentConfig();
    await loadVersions();
})();
