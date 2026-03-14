const token3 = localStorage.getItem("access_token");
if (!token3) {
    window.location.href = "/login";
}

const taskId = window.__TASK_ID__;
const taskInfo = document.getElementById("taskInfo");
const runList = document.getElementById("runList");
const runMsg = document.getElementById("runMsg");

const startRunBtn = document.getElementById("startRunBtn");
const viewConfigBtn = document.getElementById("viewConfigBtn");
const deleteTaskBtn = document.getElementById("deleteTaskBtn");
const exportTaskBtn = document.getElementById("exportTaskBtn");

const deleteTaskModal = document.getElementById("deleteTaskModal");
const deletePasswordInput = document.getElementById("deletePassword");
const deleteTaskMsg = document.getElementById("deleteTaskMsg");
const confirmDeleteTaskBtn = document.getElementById("confirmDeleteTaskBtn");
const cancelDeleteTaskBtn = document.getElementById("cancelDeleteTaskBtn");

async function requestJson(url, options = {}) {
    const resp = await fetch(url, options);
    const result = await resp.json();
    return { resp, result };
}

function formatMetricSummary(bestMaxJson, bestMinJson) {
    const bestMax = bestMaxJson || {};
    const bestMin = bestMinJson || {};

    const metricNames = Array.from(
        new Set([...Object.keys(bestMax), ...Object.keys(bestMin)])
    );

    if (metricNames.length === 0) {
        return "<p><strong>结果摘要：</strong>暂无精度结果</p>";
    }

    const items = metricNames.map(name => {
        const maxVal = bestMax[name] !== undefined ? bestMax[name] : "-";
        const minVal = bestMin[name] !== undefined ? bestMin[name] : "-";
        return `<p><strong>${name}</strong>：max=${maxVal}，min=${minVal}</p>`;
    });

    return `
        <div class="metric-summary">
            <p><strong>结果摘要：</strong></p>
            ${items.join("")}
        </div>
    `;
}

async function loadTask() {
    const { resp, result } = await requestJson(`/api/tasks/${taskId}`, {
        headers: {
            "Authorization": "Bearer " + token3
        }
    });

    if (!resp.ok) {
        taskInfo.innerText = result.message || "任务加载失败";
        return;
    }

    const task = result.data;
    taskInfo.innerHTML = `
        <p><strong>ID:</strong> ${task.id}</p>
        <p><strong>任务名:</strong> ${task.task_name}</p>
        <p><strong>描述:</strong> ${task.description ? task.description : "暂无描述"}</p>
        <p><strong>类型:</strong> ${task.task_type}</p>
        <p><strong>状态:</strong> ${task.status}</p>
        <p><strong>模板:</strong> ${task.template_path || "-"}</p>
        <p><strong>当前配置ID:</strong> ${task.current_config_id || "-"}</p>
        <p><strong>当前配置路径:</strong> ${task.current_config ? task.current_config.yaml_path : "-"}</p>
    `;
}

async function loadRuns() {
    const { resp, result } = await requestJson(`/api/runs/task/${taskId}`, {
        headers: {
            "Authorization": "Bearer " + token3
        }
    });

    runList.innerHTML = "";

    if (!resp.ok) {
        runList.innerText = result.message || "运行记录加载失败";
        return;
    }

    const runs = (result.data || []).filter(run => Number(run.task_id) === Number(taskId));

    if (runs.length === 0) {
        runList.innerHTML = "<div class='empty-box'>当前没有执行记录</div>";
        return;
    }

    runs.forEach(run => {
        const div = document.createElement("div");
        div.className = "run-card clickable";

        div.innerHTML = `
            <p><strong>运行ID:</strong> ${run.id}</p>
            <p><strong>任务ID:</strong> ${run.task_id}</p>
            <p><strong>运行名:</strong> ${run.run_name || "-"}</p>
            <p><strong>状态:</strong> ${run.status}</p>
            <p><strong>运行类型:</strong> ${run.run_type || "-"}</p>
            <p><strong>GPU模式:</strong> ${run.gpu_mode}</p>
            <p><strong>GPU设备:</strong> ${run.gpu_devices || "-"}</p>
            <p><strong>PID:</strong> ${run.pid || "-"}</p>
            <p><strong>开始时间:</strong> ${run.started_at || "-"}</p>
            <p><strong>结束时间:</strong> ${run.ended_at || "-"}</p>
            ${formatMetricSummary(run.best_metric_max_json, run.best_metric_min_json)}
            <p><strong>说明:</strong> 点击进入该次运行的监控页面，可执行停止/恢复操作</p>
        `;

        div.addEventListener("click", () => {
            window.location.href = `/runs/${run.id}/monitor`;
        });

        runList.appendChild(div);
    });
}

startRunBtn.addEventListener("click", async () => {
    runMsg.innerText = "";

    const payload = {
        task_id: taskId,
        run_name: document.getElementById("runName").value.trim(),
        gpu_mode: document.getElementById("gpuMode").value,
        gpu_devices: document.getElementById("gpuDevices").value.trim()
    };

    const { resp, result } = await requestJson("/api/runs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token3
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        runMsg.innerText = result.message || "启动失败";
        return;
    }

    runMsg.innerText = `任务已启动，run_id=${result.data.run_id}`;
    await loadRuns();
});

if (viewConfigBtn) {
    viewConfigBtn.addEventListener("click", () => {
        window.location.href = `/tasks/${taskId}/config`;
    });
}

if (exportTaskBtn) {
    exportTaskBtn.addEventListener("click", () => {
        window.location.href = `/api/export/task/${taskId}/results.csv`;
    });
}

if (deleteTaskBtn) {
    deleteTaskBtn.addEventListener("click", () => {
        deleteTaskModal.style.display = "flex";
        deletePasswordInput.value = "";
        deleteTaskMsg.innerText = "";
        deletePasswordInput.focus();
    });
}

if (cancelDeleteTaskBtn) {
    cancelDeleteTaskBtn.addEventListener("click", () => {
        deleteTaskModal.style.display = "none";
        deletePasswordInput.value = "";
        deleteTaskMsg.innerText = "";
    });
}

if (confirmDeleteTaskBtn) {
    confirmDeleteTaskBtn.addEventListener("click", async () => {
        const password = deletePasswordInput.value;

        if (!password.trim()) {
            deleteTaskMsg.innerText = "请输入当前登录密码";
            return;
        }

        const { resp, result } = await requestJson(`/api/tasks/${taskId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token3
            },
            body: JSON.stringify({
                password: password
            })
        });

        if (!resp.ok) {
            deleteTaskMsg.innerText = result.message || "删除失败";
            return;
        }

        deleteTaskModal.style.display = "none";
        window.location.href = "/dashboard";
    });
}

(async function init() {
    await loadTask();
    await loadRuns();
})();
