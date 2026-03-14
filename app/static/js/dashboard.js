const token = localStorage.getItem("access_token");
if (!token) {
    window.location.href = "/login";
}

const createTaskBtn = document.getElementById("createTaskBtn");
const logoutBtn = document.getElementById("logoutBtn");

if (createTaskBtn) {
    createTaskBtn.addEventListener("click", () => {
        window.location.href = "/tasks/create";
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
    });
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

async function loadTasks() {
    const taskList = document.getElementById("taskList");
    const taskEmpty = document.getElementById("taskEmpty");
    const activeTaskCount = document.getElementById("activeTaskCount");
    const activeRunCount = document.getElementById("activeRunCount");

    taskList.innerHTML = "";

    const { resp, result } = await requestJson("/api/tasks?_ts=" + Date.now(), {
        headers: { "Authorization": "Bearer " + token }
    });

    if (!resp.ok) {
        taskEmpty.style.display = "block";
        taskEmpty.innerText = result.message || "加载任务失败";
        return;
    }

    const tasks = result.data || [];

    if (tasks.length === 0) {
        taskEmpty.style.display = "block";
        taskEmpty.innerText = "当前还没有任务，请先创建一个任务。";
        if (activeTaskCount) activeTaskCount.innerText = "0";
        if (activeRunCount) activeRunCount.innerText = "0";
        return;
    }

    taskEmpty.style.display = "none";

    const taskRunMap = {};
    for (const task of tasks) {
        const { resp: runResp, result: runResult } = await requestJson(`/api/runs/task/${task.id}`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!runResp.ok) {
            taskRunMap[task.id] = [];
            continue;
        }

        taskRunMap[task.id] = (runResult.data || []).filter(run => isActiveRunStatus(run.status));
    }

    const runningTaskCountValue = tasks.filter(task => (taskRunMap[task.id] || []).length > 0).length;
    const runningRunCountValue = tasks.reduce((sum, task) => sum + (taskRunMap[task.id] || []).length, 0);

    if (activeTaskCount) activeTaskCount.innerText = String(runningTaskCountValue);
    if (activeRunCount) activeRunCount.innerText = String(runningRunCountValue);

    tasks.forEach(task => {
        const activeRuns = taskRunMap[task.id] || [];
        const div = document.createElement("div");
        div.className = "task-card";

        div.innerHTML = `
            <div class="task-card-head">
                <h3 class="task-title">${task.task_name}</h3>
                <div class="${getStatusBadgeClass(task.status)}">${task.status || "-"}</div>
            </div>

            <p class="task-desc"><strong>描述：</strong>${task.description ? task.description : "暂无描述"}</p>
            <p><strong>类型：</strong>${task.task_type}</p>
            <p><strong>模板：</strong>${task.template_path || "-"}</p>

            <div class="task-run-summary">
                ${
                    activeRuns.length > 0
                    ? `<span class="status-badge running">执行中 ${activeRuns.length} 个</span>`
                    : `<span class="status-badge stopped">当前无运行</span>`
                }
            </div>

            <div class="task-card-actions">
                <button class="enter-btn" data-id="${task.id}">进入任务</button>
            </div>
        `;

        div.querySelector(".enter-btn").addEventListener("click", () => {
            window.location.href = `/tasks/${task.id}`;
        });

        taskList.appendChild(div);
    });
}

loadTasks();
