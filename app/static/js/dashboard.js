const createTaskBtn = document.getElementById("createTaskBtn");
const logoutBtn = document.getElementById("logoutBtn");

if (createTaskBtn) {
  createTaskBtn.addEventListener("click", () => {
    window.location.href = "/tasks/create";
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await logoutAndRedirect();
  });
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
    ) &&
    !(
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
  if (s.includes("success") || s.includes("完成")) return "status-badge success";
  if (s.includes("failed") || s.includes("失败")) return "status-badge failed";
  if (s.includes("stop") || s.includes("停止")) return "status-badge stopped";
  if (isActiveRunStatus(status)) return "status-badge running";
  return "status-badge pending";
}

async function requestJson(url, options = {}) {
  return apiFetch(url, options);
}

async function loadTasks() {
  const taskList = document.getElementById("taskList");
  const taskEmpty = document.getElementById("taskEmpty");
  const activeTaskCount = document.getElementById("activeTaskCount");
  const activeRunCount = document.getElementById("activeRunCount");

  taskList.innerHTML = "";

  const { resp, result } = await requestJson("/api/tasks?_ts=" + Date.now(), {
    method: "GET"
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
      method: "GET"
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
      <h3>${task.task_name}</h3>
      <p><strong>状态：</strong>${task.status || "-"}</p>
      <p><strong>描述：</strong>${task.description ? task.description : "暂无描述"}</p>
      <p><strong>类型：</strong>${task.task_type}</p>
      <p><strong>模板：</strong>${task.template_path || "-"}</p>
      <p><strong>运行情况：</strong>${activeRuns.length > 0 ? `执行中 ${activeRuns.length} 个` : `当前无运行`}</p>
      <button class="enter-btn">进入任务</button>
    `;

    div.querySelector(".enter-btn").addEventListener("click", () => {
      window.location.href = `/tasks/${task.id}`;
    });

    taskList.appendChild(div);
  });
}

(async function init() {
  const ok = await requireLogin();
  if (!ok) return;
  await loadTasks();
})();
