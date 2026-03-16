const runId = window.__RUN_ID__;
const deleteRunBtn = document.getElementById("deleteRunBtn");

const deleteRunModal = document.getElementById("deleteRunModal");
const deleteRunModalStatus = document.getElementById("deleteRunModalStatus");
const cancelDeleteRunBtn = document.getElementById("cancelDeleteRunBtn");
const confirmDeleteRunBtn = document.getElementById("confirmDeleteRunBtn");

if (!runId) {
    alert("缺少运行ID，无法进入监控页面。");
    window.location.href = "/dashboard";
}

const statusBar = document.getElementById("statusBar");
const tbPathBar = document.getElementById("tbPathBar");
const bestWorstBox = document.getElementById("bestWorstBox");
const logWindow = document.getElementById("logWindow");
const logTypeEl = document.getElementById("logType");
const stopRunBtn = document.getElementById("stopRunBtn");
const resumeRunBtn = document.getElementById("resumeRunBtn");

const systemStats = document.getElementById("systemStats");
const gpuStats = document.getElementById("gpuStats");

const lossChart = echarts.init(document.getElementById("lossChart"));
const metricChart = echarts.init(document.getElementById("metricChart"));
const gpuUtilChart = echarts.init(document.getElementById("gpuUtilChart"));
const gpuMemChart = echarts.init(document.getElementById("gpuMemChart"));
const cpuChart = echarts.init(document.getElementById("cpuChart"));
const memChart = echarts.init(document.getElementById("memChart"));

let latestRunStatus = "";

const hardwareHistory = {
    time: [],
    cpu: [],
    memory: [],
    gpuUtil: {},
    gpuMem: {}
};

const MAX_POINTS = 60;


function openDeleteRunModal() {
  if (!deleteRunModal) return;
  if (deleteRunModalStatus) {
    deleteRunModalStatus.textContent = latestRunStatus || "-";
  }
  deleteRunModal.style.display = "block";
  if (cancelDeleteRunBtn) {
    cancelDeleteRunBtn.focus();
  }
}

function closeDeleteRunModal() {
  if (!deleteRunModal) return;
  deleteRunModal.style.display = "none";
}

function pushLimited(arr, value, maxLen = MAX_POINTS) {
    arr.push(value);
    if (arr.length > maxLen) {
        arr.shift();
    }
}

function resizeAllCharts() {
    lossChart.resize();
    metricChart.resize();
    gpuUtilChart.resize();
    gpuMemChart.resize();
    cpuChart.resize();
    memChart.resize();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
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

function setStatusBar(run) {
    let text = `Run ID: ${run.id} | 状态: ${run.status} | PID: ${run.pid || "-"} | GPU: ${run.gpu_devices || "-"} | 开始时间: ${run.started_at || "-"}`;

    if (run.ended_at) {
        text += ` | 结束时间: ${run.ended_at}`;
    }
    if (run.error_message) {
        text += ` | 错误: ${run.error_message}`;
    }

    statusBar.innerText = text;
    statusBar.className = "status-bar";

    if (run.status === "running") {
        statusBar.classList.add("status-running");
    } else if (run.status === "success") {
        statusBar.classList.add("status-success");
    } else if (run.status === "failed") {
        statusBar.classList.add("status-failed");
    } else if (run.status === "stopped") {
        statusBar.classList.add("status-pending");
    } else {
        statusBar.classList.add("status-pending");
    }

    updateActionButtons();
}
function updateActionButtons() {
  if (stopRunBtn) {
    stopRunBtn.disabled = !isActiveRunStatus(latestRunStatus);
  }

  if (resumeRunBtn) {
    const s = String(latestRunStatus || "").toLowerCase();
    const canResume =
      s.includes("stopped") ||
      s.includes("failed") ||
      s.includes("停止") ||
      s.includes("失败");
    resumeRunBtn.disabled = !canResume;
  }

  if (deleteRunBtn) {
    deleteRunBtn.disabled = isActiveRunStatus(latestRunStatus);
  }
}

if (deleteRunBtn) {
  deleteRunBtn.addEventListener("click", () => {
    openDeleteRunModal();
  });
}

if (cancelDeleteRunBtn) {
  cancelDeleteRunBtn.addEventListener("click", () => {
    closeDeleteRunModal();
  });
}

if (deleteRunModal) {
  deleteRunModal.addEventListener("click", (e) => {
    if (e.target.classList.contains("danger-modal-mask")) {
      closeDeleteRunModal();
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (deleteRunModal && deleteRunModal.style.display !== "none") {
      closeDeleteRunModal();
    }
  }
});

if (confirmDeleteRunBtn) {
  confirmDeleteRunBtn.addEventListener("click", async () => {
    confirmDeleteRunBtn.disabled = true;
    try {
      const { resp, result } = await apiFetch(`/api/run-control/${runId}/delete`, {
        method: "POST"
      });

      if (!resp.ok) {
        alert(result.message || "删除失败");
        return;
      }

      closeDeleteRunModal();
      alert("运行已删除");
      window.location.href = `/tasks/${result.data.task_id}`;
    } finally {
      confirmDeleteRunBtn.disabled = false;
    }
  });
}


function renderBestWorst(bestMax, bestMin) {
    if (!bestWorstBox) return;

    const maxMap = bestMax || {};
    const minMap = bestMin || {};

    const metricNames = Array.from(
        new Set([...Object.keys(maxMap), ...Object.keys(minMap)])
    );

    if (metricNames.length === 0) {
        bestWorstBox.innerHTML = "<p><strong>结果摘要：</strong>暂无精度结果</p>";
        return;
    }

    const rows = metricNames.map(name => {
        const maxVal = maxMap[name] !== undefined ? maxMap[name] : "-";
        const minVal = minMap[name] !== undefined ? minMap[name] : "-";
        return `
            <tr>
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(maxVal)}</td>
                <td>${escapeHtml(minVal)}</td>
            </tr>
        `;
    }).join("");

    bestWorstBox.innerHTML = `
        <h3>最好 / 最坏结果摘要</h3>
        <table class="metric-table">
            <thead>
                <tr>
                    <th>指标名</th>
                    <th>最大值</th>
                    <th>最小值</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

async function fetchRunDetail() {
    const { resp, result } = await apiFetch(`/api/runs/${runId}`, {
        method: "GET"
    });

    if (!resp.ok) {
        statusBar.innerText = result.message || "运行信息加载失败";
        return null;
    }

    latestRunStatus = result.data.status;
    setStatusBar(result.data);
    renderBestWorst(result.data.best_metric_max_json, result.data.best_metric_min_json);
    return result.data;
}

async function fetchLog() {
    const logType = logTypeEl ? logTypeEl.value : "train";

    const { resp, result } = await apiFetch(
        `/api/runs/${runId}/log?log_type=${encodeURIComponent(logType)}&max_lines=400`,
        { method: "GET" }
    );

    if (!resp.ok) {
        logWindow.textContent = result.message || "日志读取失败";
        return;
    }

    logWindow.textContent = result.data.content || "";
    logWindow.scrollTop = logWindow.scrollHeight;
}

function splitScalars(scalars) {
    const lossSeries = [];
    const metricSeries = [];

    Object.keys(scalars || {}).forEach(tag => {
        const points = scalars[tag] || [];
        const series = {
            name: tag,
            type: "line",
            showSymbol: false,
            data: points.map(item => [item.step, item.value])
        };

        const lower = tag.toLowerCase();
        if (lower.includes("loss")) {
            lossSeries.push(series);
        } else {
            metricSeries.push(series);
        }
    });

    return { lossSeries, metricSeries };
}

async function fetchScalars() {
    const { resp, result } = await apiFetch(`/api/runs/${runId}/tb-scalars`, {
        method: "GET"
    });

    if (!resp.ok) {
        if (tbPathBar) {
            tbPathBar.innerText = "TensorBoard目录：读取失败";
        }
        return;
    }

    if (tbPathBar) {
        tbPathBar.innerText = "TensorBoard目录：" + (result.data.tensorboard_dir || "未发现");
    }

    const scalars = result.data.scalars || {};
    const { lossSeries, metricSeries } = splitScalars(scalars);

    lossChart.setOption({
        tooltip: { trigger: "axis" },
        legend: { top: 0 },
        xAxis: { type: "value", name: "step" },
        yAxis: { type: "value", name: "loss" },
        series: lossSeries
    });

    metricChart.setOption({
        tooltip: { trigger: "axis" },
        legend: { top: 0 },
        xAxis: { type: "value", name: "step" },
        yAxis: { type: "value", name: "metric" },
        series: metricSeries
    });
}

function renderHardwareCharts() {
    const gpuUtilSeries = Object.keys(hardwareHistory.gpuUtil).map(key => ({
        name: `GPU ${key}`,
        type: "line",
        showSymbol: false,
        data: hardwareHistory.gpuUtil[key]
    }));

    const gpuMemSeries = Object.keys(hardwareHistory.gpuMem).map(key => ({
        name: `GPU ${key}`,
        type: "line",
        showSymbol: false,
        data: hardwareHistory.gpuMem[key]
    }));

    gpuUtilChart.setOption({
        tooltip: { trigger: "axis" },
        legend: { top: 0 },
        xAxis: { type: "category", data: hardwareHistory.time },
        yAxis: { type: "value", name: "%", min: 0, max: 100 },
        series: gpuUtilSeries
    });

    gpuMemChart.setOption({
        tooltip: { trigger: "axis" },
        legend: { top: 0 },
        xAxis: { type: "category", data: hardwareHistory.time },
        yAxis: { type: "value", name: "%", min: 0, max: 100 },
        series: gpuMemSeries
    });

    cpuChart.setOption({
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: hardwareHistory.time },
        yAxis: { type: "value", name: "%", min: 0, max: 100 },
        series: [{
            name: "CPU",
            type: "line",
            showSymbol: false,
            data: hardwareHistory.cpu
        }]
    });

    memChart.setOption({
        tooltip: { trigger: "axis" },
        xAxis: { type: "category", data: hardwareHistory.time },
        yAxis: { type: "value", name: "%", min: 0, max: 100 },
        series: [{
            name: "Memory",
            type: "line",
            showSymbol: false,
            data: hardwareHistory.memory
        }]
    });
}

async function fetchHardware() {
    const { resp, result } = await apiFetch(`/api/runs/${runId}/hardware`, {
        method: "GET"
    });

    if (!resp.ok) {
        if (systemStats) {
            systemStats.innerHTML = `<p>硬件信息读取失败：${escapeHtml(result.message || "unknown error")}</p>`;
        }
        if (gpuStats) {
            gpuStats.innerHTML = "<p>GPU 信息读取失败</p>";
        }
        return;
    }

    const snapshot = result.data.snapshot || {};
    const system = snapshot.system || {};
    const gpus = snapshot.gpus || [];
    const gpuMeta = snapshot.gpu_meta || {};

    const now = new Date();
    const timeLabel = now.toLocaleTimeString();

    pushLimited(hardwareHistory.time, timeLabel);
    pushLimited(hardwareHistory.cpu, system.cpu_percent ?? 0);
    pushLimited(hardwareHistory.memory, system.memory_percent ?? 0);

    let hints = [];

    if (system.ok === false) {
        systemStats.innerHTML = `
            <p><strong>系统信息读取失败</strong></p>
            <p>${escapeHtml(system.error || "未知错误")}</p>
        `;
    } else {
        if ((system.cpu_percent ?? 0) > 90) {
            hints.push("CPU 使用率较高，可能影响数据预处理或加载速度。");
        }

        systemStats.innerHTML = `
            <p><strong>CPU 使用率：</strong>${escapeHtml(system.cpu_percent ?? "-")}%</p>
            <p><strong>内存使用率：</strong>${escapeHtml(system.memory_percent ?? "-")}%</p>
            <p><strong>已用内存：</strong>${escapeHtml(system.memory_used_gb ?? "-")} GB / ${escapeHtml(system.memory_total_gb ?? "-")} GB</p>
            <p><strong>可用内存：</strong>${escapeHtml(system.memory_available_gb ?? "-")} GB</p>
            <p><strong>磁盘使用率：</strong>${escapeHtml(system.disk_percent ?? "-")}%</p>
            <p><strong>磁盘根目录：</strong>${escapeHtml(system.disk_root ?? "-")}</p>
            <p><strong>平台：</strong>${escapeHtml(system.platform ?? "-")}</p>
        `;
    }

    if (!snapshot.gpu_ok) {
        gpuStats.innerHTML = `
            <p><strong>GPU 信息不可用</strong></p>
            <p>后端：${escapeHtml(gpuMeta.backend || "-")}</p>
            <p>NVML 可导入：${gpuMeta.nvml_available ? "是" : "否"}</p>
            <p>NVML 已初始化：${gpuMeta.nvml_ready ? "是" : "否"}</p>
            <p>NVML 错误：${escapeHtml(gpuMeta.nvml_error || "-")}</p>
            <p>nvidia-smi 可用：${gpuMeta.nvidia_smi_found ? "是" : "否"}</p>
            <p>请求 GPU：${escapeHtml(gpuMeta.requested_gpu_devices || "-")}</p>
            <p>解析后索引：${escapeHtml(JSON.stringify(gpuMeta.parsed_gpu_indices || []))}</p>
            <p>实际采样索引：${escapeHtml(JSON.stringify(gpuMeta.effective_gpu_indices || []))}</p>
        `;
    } else if (gpus.length === 0) {
        gpuStats.innerHTML = `
            <p>当前没有可显示的 GPU 数据。</p>
            <p>后端：${escapeHtml(gpuMeta.backend || "-")}</p>
            <p>请求 GPU：${escapeHtml(gpuMeta.requested_gpu_devices || "-")}</p>
            <p>解析后索引：${escapeHtml(JSON.stringify(gpuMeta.parsed_gpu_indices || []))}</p>
            <p>实际采样索引：${escapeHtml(JSON.stringify(gpuMeta.effective_gpu_indices || []))}</p>
        `;
    } else {
        gpuStats.innerHTML = gpus.map(gpu => {
            if ((gpu.mem_percent ?? 0) > 90) {
                hints.push(`GPU ${gpu.gpu_index} 显存占用很高，batch size 可能偏大。`);
            }
            if ((gpu.util_percent ?? 0) < 40 && (gpu.mem_percent ?? 0) < 50) {
                hints.push(`GPU ${gpu.gpu_index} 利用率偏低，可考虑增大 batch size 或检查数据加载瓶颈。`);
            }

            if (gpu.error) {
                return `
                    <div class="gpu-item">
                        <p><strong>GPU ${escapeHtml(gpu.gpu_index)}</strong></p>
                        <p>读取失败：${escapeHtml(gpu.error)}</p>
                    </div>
                `;
            }

            return `
                <div class="gpu-item">
                    <p><strong>GPU ${escapeHtml(gpu.gpu_index)}</strong> - ${escapeHtml(gpu.gpu_name)}</p>
                    <p>利用率：${escapeHtml(gpu.util_percent)}%</p>
                    <p>显存：${escapeHtml(gpu.mem_used_mb)} MB / ${escapeHtml(gpu.mem_total_mb)} MB (${escapeHtml(gpu.mem_percent)}%)</p>
                    <p>温度：${escapeHtml(gpu.temperature ?? "-")} ℃</p>
                    <p>功耗：${escapeHtml(gpu.power_w ?? "-")} W</p>
                    <p>风扇：${escapeHtml(gpu.fan_speed ?? "-")}%</p>
                </div>
            `;
        }).join("");

        gpus.forEach(gpu => {
            if (gpu.error) return;

            const key = String(gpu.gpu_index);

            if (!hardwareHistory.gpuUtil[key]) {
                hardwareHistory.gpuUtil[key] = [];
            }
            if (!hardwareHistory.gpuMem[key]) {
                hardwareHistory.gpuMem[key] = [];
            }

            pushLimited(hardwareHistory.gpuUtil[key], gpu.util_percent ?? 0);
            pushLimited(hardwareHistory.gpuMem[key], gpu.mem_percent ?? 0);
        });
    }

    if (hints.length > 0 && system.ok !== false) {
        systemStats.innerHTML += `
            <div class="msg-box">
                <strong>训练健康提示：</strong><br>
                ${hints.map(h => `- ${escapeHtml(h)}`).join("<br>")}
            </div>
        `;
    }

    renderHardwareCharts();
}

document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");

        resizeAllCharts();
    });
});

if (logTypeEl) {
    logTypeEl.addEventListener("change", async () => {
        await fetchLog();
    });
}

async function refreshAll() {
    await fetchRunDetail();
    await fetchLog();
    await fetchScalars();
    await fetchHardware();
}

window.addEventListener("resize", () => {
    resizeAllCharts();
});
const stopRunModal = document.getElementById("stopRunModal");
const stopRunModalStatus = document.getElementById("stopRunModalStatus");
const cancelStopRunBtn = document.getElementById("cancelStopRunBtn");
const confirmStopRunBtn = document.getElementById("confirmStopRunBtn");

function openStopRunModal() {
  if (!stopRunModal) return;
  if (stopRunModalStatus) {
    stopRunModalStatus.textContent = latestRunStatus || "-";
  }
  stopRunModal.style.display = "block";
  if (cancelStopRunBtn) {
    cancelStopRunBtn.focus();
  }
}

function closeStopRunModal() {
  if (!stopRunModal) return;
  stopRunModal.style.display = "none";
}

if (stopRunBtn) {
  stopRunBtn.addEventListener("click", () => {
    openStopRunModal();
  });
}

if (cancelStopRunBtn) {
  cancelStopRunBtn.addEventListener("click", () => {
    closeStopRunModal();
  });
}

if (stopRunModal) {
  stopRunModal.addEventListener("click", (e) => {
    if (e.target.classList.contains("danger-modal-mask")) {
      closeStopRunModal();
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && stopRunModal && stopRunModal.style.display !== "none") {
    closeStopRunModal();
  }
});

if (confirmStopRunBtn) {
  confirmStopRunBtn.addEventListener("click", async () => {
    confirmStopRunBtn.disabled = true;
    try {
      const { resp, result } = await apiFetch(`/api/run-control/${runId}/stop`, { method: "POST" });
      if (!resp.ok) {
        alert(result.message || "停止失败");
        return;
      }
      closeStopRunModal();
      alert("运行已停止");
      await fetchRunDetail();
    } finally {
      confirmStopRunBtn.disabled = false;
    }
  });
}


if (resumeRunBtn) {
    resumeRunBtn.addEventListener("click", async () => {
        const ok = confirm("确认从当前这条运行恢复训练吗？系统将优先寻找最大的 .state 文件，若未找到则自动使用 --auto_resume。");
        if (!ok) return;

        const { resp, result } = await apiFetch(`/api/run-control/run/${runId}/resume`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                gpu_mode: "single"
            })
        });

        if (!resp.ok) {
            alert(result.message || "恢复失败");
            return;
        }

        alert(`恢复成功，新运行ID=${result.data.run_id}`);
        window.location.href = `/runs/${result.data.run_id}/monitor`;
    });
}

(async function init() {
    const ok = await requireLogin();
    if (!ok) return;

    await refreshAll();

    setInterval(async () => {
        if (document.hidden) return;
        await refreshAll();
    }, 5000);
})();

