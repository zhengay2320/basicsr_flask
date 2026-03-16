const taskId = window.__TASK_ID__;
const taskInfo = document.getElementById("taskInfo");
const runList = document.getElementById("runList");
const runMsg = document.getElementById("runMsg");

const startRunBtn = document.getElementById("startRunBtn");
const viewConfigBtn = document.getElementById("viewConfigBtn");
const deleteTaskBtn = document.getElementById("deleteTaskBtn");
const exportTaskBtn = document.getElementById("exportTaskBtn");
const updateDescriptionBtn = document.getElementById("updateDescriptionBtn");
const taskDescriptionInput = document.getElementById("taskDescriptionInput");
const taskDescriptionMsg = document.getElementById("taskDescriptionMsg");

const deleteTaskModal = document.getElementById("deleteTaskModal");
const deletePasswordInput = document.getElementById("deletePassword");
const deleteTaskMsg = document.getElementById("deleteTaskMsg");
const confirmDeleteTaskBtn = document.getElementById("confirmDeleteTaskBtn");
const cancelDeleteTaskBtn = document.getElementById("cancelDeleteTaskBtn");

let currentTask = null;

if (!taskId || String(taskId).trim() === "") {
    alert("请先从任务列表进入具体任务详情页。");
    window.location.href = "/dashboard";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function normalizeDescription(value) {
    return String(value ?? "").trim();
}

function isActiveRunStatus(status) {
    const s = String(status || "").toLowerCase();
    return (
        (
            s.includes("running") ||
            s.includes("pending") ||
            s.includes("queued") ||
            s.includes("resume") ||
            s.includes("启动") ||
            s.includes("运行") ||
            s.includes("执行") ||
            s.includes("恢复")
        ) && !(
            s.includes("success") ||
            s.includes("failed") ||
            s.includes("stopped") ||
            s.includes("finished") ||
            s.includes("completed") ||
            s.includes("停止") ||
            s.includes("失败") ||
            s.includes("完成") ||
            s.includes("结束")
        )
    );
}

function getStatusBadgeClass(status) {
    const s = String(status || "").toLowerCase();

    if (s.includes("success") || s.includes("完成")) {
        return "status-badge success";
    }
    if (s.includes("failed") || s.includes("失败")) {
        return "status-badge failed";
    }
    if (s.includes("stop") || s.includes("停止")) {
        return "status-badge stopped";
    }
    if (isActiveRunStatus(status)) {
        return "status-badge running";
    }
    return "status-badge pending";
}

async function requestJson(url, options = {}) {
    return apiFetch(url, options);
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
        return `<p><strong>${escapeHtml(name)}</strong>：max=${escapeHtml(maxVal)}，min=${escapeHtml(minVal)}</p>`;
    });

    return `
        <div class="metric-summary">
            <p><strong>结果摘要：</strong></p>
            ${items.join("")}
        </div>
    `;
}

function renderTask(task) {
    currentTask = task;

    taskInfo.innerHTML = `
        <p><strong>ID:</strong> ${escapeHtml(task.id)}</p>
        <p><strong>任务名:</strong> ${escapeHtml(task.task_name)}</p>
        <p><strong>当前描述:</strong> ${escapeHtml(task.description ? task.description : "暂无描述")}</p>
        <p><strong>类型:</strong> ${escapeHtml(task.task_type)}</p>
        <p><strong>状态:</strong> <span class="${getStatusBadgeClass(task.status)}">${escapeHtml(task.status || "-")}</span></p>
        <p><strong>模板:</strong> ${escapeHtml(task.template_path || "-")}</p>
        <p><strong>当前配置ID:</strong> ${escapeHtml(task.current_config_id || "-")}</p>
        <p><strong>当前配置路径:</strong> ${escapeHtml(task.current_config ? task.current_config.yaml_path : "-")}</p>
    `;

    if (taskDescriptionInput) {
        taskDescriptionInput.value = task.description || "";
    }
}

async function loadTask() {
    if (!taskId) return;

    const { resp, result } = await requestJson(`/api/tasks/${taskId}`, {
        method: "GET"
    });

    if (!resp.ok) {
        taskInfo.innerText = result.message || "任务加载失败";
        return;
    }

    renderTask(result.data);
}

async function updateTaskDescription() {
    if (!taskDescriptionInput || !updateDescriptionBtn || !currentTask) return;

    const nextDescription = normalizeDescription(taskDescriptionInput.value);
    const prevDescription = normalizeDescription(currentTask.description);

    taskDescriptionMsg.innerText = "";

    if (nextDescription === prevDescription) {
        taskDescriptionMsg.innerText = "描述未修改，无需提交";
        return;
    }

    updateDescriptionBtn.disabled = true;

    try {
        const { resp, result } = await requestJson(`/api/tasks/${taskId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ description: nextDescription })
        });

        if (!resp.ok) {
            taskDescriptionMsg.innerText = result.message || "描述修改失败";
            return;
        }

        taskDescriptionMsg.innerText = "任务描述已更新";
        await loadTask();
    } catch (err) {
        console.error(err);
        taskDescriptionMsg.innerText = "描述修改失败，请稍后重试";
    } finally {
        updateDescriptionBtn.disabled = false;
    }
}

async function loadRuns() {
    if (!taskId) return;

    const { resp, result } = await requestJson(`/api/runs/task/${taskId}`, {
        method: "GET"
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
            <p><strong>运行ID:</strong> ${escapeHtml(run.id)}</p>
            <p><strong>任务ID:</strong> ${escapeHtml(run.task_id)}</p>
            <p><strong>运行名:</strong> ${escapeHtml(run.run_name || "-")}</p>
            <p><strong>状态:</strong> <span class="${getStatusBadgeClass(run.status)}">${escapeHtml(run.status || "-")}</span></p>
            <p><strong>运行类型:</strong> ${escapeHtml(run.run_type || "-")}</p>
            <p><strong>GPU模式:</strong> ${escapeHtml(run.gpu_mode)}</p>
            <p><strong>GPU设备:</strong> ${escapeHtml(run.gpu_devices || "-")}</p>
            <p><strong>PID:</strong> ${escapeHtml(run.pid || "-")}</p>
            <p><strong>开始时间:</strong> ${escapeHtml(run.started_at || "-")}</p>
            <p><strong>结束时间:</strong> ${escapeHtml(run.ended_at || "-")}</p>
            ${formatMetricSummary(run.best_metric_max_json, run.best_metric_min_json)}
            <p><strong>说明:</strong> 点击进入该次运行的监控页面，可执行停止/恢复操作</p>
        `;

        div.addEventListener("click", () => {
            window.location.href = `/runs/${run.id}/monitor`;
        });

        runList.appendChild(div);
    });
}

if (startRunBtn) {
    startRunBtn.addEventListener("click", async () => {
        runMsg.innerText = "";
        startRunBtn.disabled = true;

        try {
            const gpuMode = document.getElementById("gpuMode").value;
            const payload = {
                task_id: taskId,
                run_name: document.getElementById("runName").value.trim(),
                gpu_mode: gpuMode === "auto" ? "single" : gpuMode,
                gpu_devices: document.getElementById("gpuDevices").value.trim()
            };

            const { resp, result } = await requestJson("/api/runs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!resp.ok) {
                runMsg.innerText = result.message || "启动失败";
                return;
            }

            runMsg.innerText = `任务已启动，run_id=${result.data.run_id}`;
            await loadTask();
            await loadRuns();
        } catch (err) {
            console.error(err);
            runMsg.innerText = "启动失败，请稍后重试";
        } finally {
            startRunBtn.disabled = false;
        }
    });
}

if (viewConfigBtn) {
    viewConfigBtn.addEventListener("click", () => {
        window.location.href = `/tasks/${taskId}/config`;
    });
}

if (exportTaskBtn) {
    exportTaskBtn.addEventListener("click", async () => {
        try {
            const { resp } = await requestJson("/api/auth/me", {
                method: "GET"
            });

            if (!resp.ok) {
                alert("当前登录状态已失效，请重新登录");
                window.location.href = "/login";
                return;
            }

            window.location.href = `/api/export/task/${taskId}/results.csv`;
        } catch (err) {
            console.error(err);
            alert("导出失败，请稍后重试");
        }
    });
}

if (updateDescriptionBtn) {
    updateDescriptionBtn.addEventListener("click", updateTaskDescription);
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

        confirmDeleteTaskBtn.disabled = true;
        deleteTaskMsg.innerText = "";

        try {
            const { resp, result } = await requestJson(`/api/tasks/${taskId}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ password: password })
            });

            if (!resp.ok) {
                deleteTaskMsg.innerText = result.message || "删除失败";
                return;
            }

            deleteTaskModal.style.display = "none";
            window.location.href = "/dashboard";
        } catch (err) {
            console.error(err);
            deleteTaskMsg.innerText = "删除失败，请稍后重试";
        } finally {
            confirmDeleteTaskBtn.disabled = false;
        }
    });
}

(async function init() {
    const ok = await requireLogin();
    if (!ok) return;

    await loadTask();
    await loadRuns();
})();
