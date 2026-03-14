const token = localStorage.getItem("access_token");
if (!token) {
    window.location.href = "/login";
}

function isActiveRunStatus(status) {
    const s = String(status || "").toLowerCase();
    return (
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
    );
}

function getStatusBadgeClass(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("success") || s.includes("完成")) return "status-badge success";
    if (s.includes("failed") || s.includes("失败")) return "status-badge failed";
    if (s.includes("stop") || s.includes("停止")) return "status-badge stopped";
    if (isActiveRunStatus(status)) return "status-badge running";
    return "status-badge pending";
}

async function requestJson(url, options = {}) {
    const resp = await fetch(url, options);
    const result = await resp.json();
    return { resp, result };
}

async function loadRunningTasks() {
    const runningTaskCount = document.getElementById("runningTaskCount");
    const runningRunCount = document.getElementById("runningRunCount");
    const runningEmpty = document.getElementById("runningEmpty");
    const runningTaskGroups = document.getElementById("runningTaskGroups");

    runningTaskGroups.innerHTML = "";

    const { resp, result } = await requestJson("/api/tasks?_ts=" + Date.now(), {
        headers: { "Authorization": "Bearer " + token }
    });

    if (!resp.ok) {
        runningEmpty.style.display = "block";
        runningEmpty.innerText = result.message || "加载任务失败";
        return;
    }

    const tasks = result.data || [];
    const grouped = [];

    for (const task of tasks) {
        const { resp: runResp, result: runResult } = await requestJson(`/api/runs/task/${task.id}`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!runResp.ok) continue;

        const runs = (runResult.data || []).filter(run => isActiveRunStatus(run.status));
        if (runs.length > 0) {
            grouped.push({
                task,
                runs
            });
        }
    }

    grouped.sort((a, b) => {
        if (b.runs.length !== a.runs.length) return b.runs.length - a.runs.length;
        return String(a.task.task_name || "").localeCompare(String(b.task.task_name || ""), "zh-CN");
    });

    const totalRunCount = grouped.reduce((sum, item) => sum + item.runs.length, 0);

    runningTaskCount.innerText = grouped.length;
    runningRunCount.innerText = totalRunCount;

    if (grouped.length === 0) {
        runningEmpty.style.display = "block";
        runningEmpty.innerText = "当前没有正在执行的任务";
        return;
    }

    runningEmpty.style.display = "none";

    grouped.forEach(item => {
        const section = document.createElement("div");
        section.className = "content-card running-task-group";

        const runsHtml = item.runs.map(run => `
            <div class="run-card clickable">
                <div class="run-card-head">
                    <h4>${run.run_name || ("运行 #" + run.id)}</h4>
                    <span class="${getStatusBadgeClass(run.status)}">${run.status || "-"}</span>
                </div>
                <p><strong>运行ID：</strong>${run.id}</p>
                <p><strong>GPU模式：</strong>${run.gpu_mode || "-"}</p>
                <p><strong>GPU设备：</strong>${run.gpu_devices || "-"}</p>
                <p><strong>PID：</strong>${run.pid || "-"}</p>
                <p><strong>开始时间：</strong>${run.started_at || "-"}</p>
                <div class="task-card-actions">
                    <button class="enter-run-btn" data-run-id="${run.id}">进入监控</button>
                </div>
            </div>
        `).join("");

        section.innerHTML = `
            <div class="running-task-group-head">
                <div>
                    <h3>${item.task.task_name}</h3>
                    <p class="task-desc">描述：${item.task.description || "暂无描述"}</p>
                </div>
                <div class="running-task-group-meta">
                    <span class="status-badge running">运行中 ${item.runs.length} 个</span>
                    <button class="enter-task-btn" data-task-id="${item.task.id}">进入任务</button>
                </div>
            </div>
            <div class="running-run-grid">
                ${runsHtml}
            </div>
        `;

        section.querySelector(".enter-task-btn").addEventListener("click", () => {
            window.location.href = `/tasks/${item.task.id}`;
        });

        section.querySelectorAll(".enter-run-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                window.location.href = `/runs/${btn.dataset.runId}/monitor`;
            });
        });

        runningTaskGroups.appendChild(section);
    });
}

loadRunningTasks();
