const taskIdCfg = window.__TASK_ID__;
const configEditor = document.getElementById("configEditor");
const configNameEl = document.getElementById("configName");
const versionList = document.getElementById("versionList");
const msgBox = document.getElementById("msgBox");

async function loadCurrentConfig() {
  const { resp, result } = await apiFetch(`/api/configs/task/${taskIdCfg}/current`, {
    method: "GET"
  });

  if (!resp.ok) {
    msgBox.innerText = result.message || "加载当前配置失败";
    return;
  }

  configEditor.value = result.data.config_text || "";
}

async function loadVersions() {
  const { resp, result } = await apiFetch(`/api/configs/task/${taskIdCfg}/versions`, {
    method: "GET"
  });

  if (!resp.ok) {
    versionList.innerText = result.message || "加载版本失败";
    return;
  }

  versionList.innerHTML = "";

  (result.data || []).forEach(item => {
    const div = document.createElement("div");
    div.className = "run-card";
    div.innerHTML = `
      <p>版本号: v${item.version_no}</p>
      <p>名称: ${item.config_name || "-"}</p>
      <p>路径: ${item.yaml_path || "-"}</p>
      <p>创建时间: ${item.created_at || "-"}</p>
      <p>当前版本: ${item.is_current ? "是" : "否"}</p>
      <button class="rollback-btn">回退到该版本</button>
    `;

    div.querySelector(".rollback-btn").addEventListener("click", async () => {
      const ok = confirm(`确认回退到 v${item.version_no} 吗？这会生成一个新的当前版本。`);
      if (!ok) return;

      const { resp: rollbackResp, result: rollbackResult } = await apiFetch(
        `/api/configs/task/${taskIdCfg}/rollback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ version_no: item.version_no })
        }
      );

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

  const { resp, result } = await apiFetch(`/api/configs/task/${taskIdCfg}/save-version`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      config_text: configText,
      config_name: configName
    })
  });

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
  const ok = await requireLogin();
  if (!ok) return;

  await loadCurrentConfig();
  await loadVersions();
})();
