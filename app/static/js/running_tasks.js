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
  return apiFetch(url, options);
}

async function loadRunningTasks() {
  const runningTaskCount = document.getElementById("runningTaskCount");
  const runningRunCount = document.getElementById("runningRunCount");
  const runningEmpty = document.getElementById("runningEmpty");
  const runningTaskGroups = document.getElementById("runningTaskGroups");

  runningTaskGroups.innerHTML = "";

  const { resp, result } = await requestJson("/api/tasks?_ts=" + Date.now(), {
    method: "GET"
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
      method: "GET"
    });
    if (!runResp.ok) continue;

    const runs = (runResult.data || []).filter(run => isActiveRunStatus(run.status));
    if (runs.length > 0) {
      grouped.push({ task, runs });
    }
  }

  grouped.sort((a, b) => {
    if (b.runs.length !== a.runs.length) return b.runs.length - a.runs.length;
    return String(a.task.task_name || "").localeCompare(String(b.task.task_name || ""), "zh-CN");
  });

  const totalRunCount = grouped.reduce((sum, item) => sum + item.runs.length, 0);
  runningTaskCount.innerText = String(grouped.length);
  runningRunCount.innerText = String(totalRunCount);

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
      <div class="run-card clickable" data-run-id="${run.id}">
        <h4>${run.run_name || ("运行 #" + run.id)}</h4>
        <p><span class="${getStatusBadgeClass(run.status)}">${run.status || "-"}</span></p>
        <p>运行ID：${run.id}</p>
        <p>任务ID：${run.task_id}</p>
        <p>运行类型：${run.run_type || "-"}</p>
        <p>GPU模式：${run.gpu_mode || "-"}</p>
        <p>GPU设备：${run.gpu_devices || "-"}</p>
        <p>PID：${run.pid || "-"}</p>
        <p>开始时间：${run.started_at || "-"}</p>
      </div>
    `).join("");

    section.innerHTML = `
      <h3>${item.task.task_name || "-"}</h3>
      <p>任务ID：${item.task.id}</p>
      <p>描述：${item.task.description || "暂无描述"}</p>
      <p>运行中：${item.runs.length} 个</p>
      <div class="run-list">${runsHtml}</div>
    `;

    section.querySelectorAll(".run-card.clickable").forEach(card => {
      card.addEventListener("click", () => {
        const runId = card.getAttribute("data-run-id");
        window.location.href = `/runs/${runId}/monitor`;
      });
    });

    runningTaskGroups.appendChild(section);
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  const ok = await requireLogin();
  if (!ok) return;

  await loadRunningTasks();
});
