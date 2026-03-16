document.addEventListener("DOMContentLoaded", () => {
    const runId = window.__RUN_ID__;

    if (!runId) {
        alert("缺少运行ID，无法进入监控页面。");
        window.location.href = "/dashboard";
        return;
    }

    const deleteRunBtn = document.getElementById("deleteRunBtn");
    const deleteRunModal = document.getElementById("deleteRunModal");
    const deleteRunModalStatus = document.getElementById("deleteRunModalStatus");
    const cancelDeleteRunBtn = document.getElementById("cancelDeleteRunBtn");
    const confirmDeleteRunBtn = document.getElementById("confirmDeleteRunBtn");

    const stopRunBtn = document.getElementById("stopRunBtn");
    const stopRunModal = document.getElementById("stopRunModal");
    const stopRunModalStatus = document.getElementById("stopRunModalStatus");
    const cancelStopRunBtn = document.getElementById("cancelStopRunBtn");
    const confirmStopRunBtn = document.getElementById("confirmStopRunBtn");

    const viewRunConfigBtn = document.getElementById("viewRunConfigBtn");
    const runConfigModal = document.getElementById("runConfigModal");
    const closeRunConfigModalBtn = document.getElementById("closeRunConfigModalBtn");
    const runConfigMeta = document.getElementById("runConfigMeta");
    const runConfigContent = document.getElementById("runConfigContent");

    const statusBar = document.getElementById("statusBar");
    const tbPathBar = document.getElementById("tbPathBar");
    const bestWorstBox = document.getElementById("bestWorstBox");
    const logWindow = document.getElementById("logWindow");
    const metricLegendSummary = document.getElementById("metricLegendSummary");


    const logTypeEl = document.getElementById("logType");
    const resumeRunBtn = document.getElementById("resumeRunBtn");

    const systemStats = document.getElementById("systemStats");
    const gpuStats = document.getElementById("gpuStats");

    const lossChartDom = document.getElementById("lossChart");
    const metricChartDom = document.getElementById("metricChart");
    const gpuUtilChartDom = document.getElementById("gpuUtilChart");
    const gpuMemChartDom = document.getElementById("gpuMemChart");
    const cpuChartDom = document.getElementById("cpuChart");
    const memChartDom = document.getElementById("memChart");

    const lossChart = lossChartDom ? echarts.init(lossChartDom) : null;
    const metricChart = metricChartDom ? echarts.init(metricChartDom) : null;
    const gpuUtilChart = gpuUtilChartDom ? echarts.init(gpuUtilChartDom) : null;
    const gpuMemChart = gpuMemChartDom ? echarts.init(gpuMemChartDom) : null;
    const cpuChart = cpuChartDom ? echarts.init(cpuChartDom) : null;
    const memChart = memChartDom ? echarts.init(memChartDom) : null;

    let latestRunStatus = "";

    const hardwareHistory = {
        time: [],
        cpu: [],
        memory: [],
        gpuUtil: {},
        gpuMem: {}
    };

    const MAX_POINTS = 60;

    function openModal(modal) {
        if (!modal) return;
        modal.style.display = "block";
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.style.display = "none";
    }

    function bindMaskClose(modal, closeFn) {
        if (!modal) return;
        modal.addEventListener("click", (e) => {
            if (e.target.classList.contains("danger-modal-mask")) {
                closeFn();
            }
        });
    }

    function pushLimited(arr, value, maxLen = MAX_POINTS) {
        arr.push(value);
        if (arr.length > maxLen) arr.shift();
    }

    function resizeAllCharts() {
        if (lossChart) lossChart.resize();
        if (metricChart) metricChart.resize();
        if (gpuUtilChart) gpuUtilChart.resize();
        if (gpuMemChart) gpuMemChart.resize();
        if (cpuChart) cpuChart.resize();
        if (memChart) memChart.resize();
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
        if (!statusBar) return;

        let text = `Run ID: ${run.id} | 状态: ${run.status} | PID: ${run.pid || "-"} | GPU: ${run.gpu_devices || "-"} | 开始时间: ${run.started_at || "-"}`;

        if (run.ended_at) text += ` | 结束时间: ${run.ended_at}`;
        if (run.error_message) text += ` | 错误: ${run.error_message}`;

        statusBar.innerText = text;
        statusBar.className = "status-bar";

        if (run.status === "running") {
            statusBar.classList.add("status-running");
        } else if (run.status === "success") {
            statusBar.classList.add("status-success");
        } else if (run.status === "failed") {
            statusBar.classList.add("status-failed");
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

    function renderBestWorst(bestMax, bestMin) {
        if (!bestWorstBox) return;

        const maxMap = bestMax || {};
        const minMap = bestMin || {};
        const metricNames = Array.from(new Set([...Object.keys(maxMap), ...Object.keys(minMap)]));

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
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    async function fetchRunDetail() {
        const { resp, result } = await apiFetch(`/api/runs/${runId}`, { method: "GET" });

        if (!resp.ok) {
            if (statusBar) statusBar.innerText = result.message || "运行信息加载失败";
            return null;
        }

        latestRunStatus = result.data.status;
        setStatusBar(result.data);
        renderBestWorst(result.data.best_metric_max_json, result.data.best_metric_min_json);
        return result.data;
    }

    async function fetchLog() {
        if (!logWindow) return;

        const logType = logTypeEl ? logTypeEl.value : "stdout";
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
    function normalizeMetricScalars(scalars) {
    const normalized = {};
    const rawStats = {};

    Object.keys(scalars || {}).forEach(tag => {
        const points = scalars[tag] || [];
        if (!points.length) return;

        const values = points.map(item => Number(item.value)).filter(v => !Number.isNaN(v));
        if (!values.length) return;

        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal;

        normalized[tag] = points.map(item => {
            const rawValue = Number(item.value);
            let normValue = 0.5;

            if (!Number.isNaN(rawValue)) {
                if (range > 1e-12) {
                    normValue = (rawValue - minVal) / range;
                } else {
                    normValue = 0.5;
                }
            }

            return {
                step: item.step,
                value: normValue,
                rawValue: rawValue
            };
        });

        rawStats[tag] = {
            min: minVal,
            max: maxVal,
            last: values[values.length - 1]
        };
    });

    return { normalized, rawStats };
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

            if (tag.toLowerCase().includes("loss")) {
                lossSeries.push(series);
            } else {
                metricSeries.push(series);
            }
        });

        return { lossSeries, metricSeries };
    }

    function renderMetricLegendSummary(seriesList, rawStats) {
    if (!metricLegendSummary) return;

    if (!seriesList || !seriesList.length) {
        metricLegendSummary.innerHTML = "<p>暂无 metric 数据</p>";
        return;
    }

    const rows = seriesList.map(series => {
        const tag = series.name;
        const color = series.lineStyle?.color || series.itemStyle?.color || "#999";
        const stat = rawStats[tag] || {};
        const last = stat.last !== undefined ? Number(stat.last).toFixed(6) : "-";
        const min = stat.min !== undefined ? Number(stat.min).toFixed(6) : "-";
        const max = stat.max !== undefined ? Number(stat.max).toFixed(6) : "-";

        return `
            <div class="metric-summary-item" style="display:flex; align-items:center; gap:8px; margin:4px 0;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${color};"></span>
                <span style="min-width:120px;">${escapeHtml(tag)}</span>
                <span>当前值: <strong>${escapeHtml(last)}</strong></span>
                <span>最小值: ${escapeHtml(min)}</span>
                <span>最大值: ${escapeHtml(max)}</span>
            </div>
        `;
    }).join("");

    metricLegendSummary.innerHTML = rows;
}


    async function fetchScalars() {
        const { resp, result } = await apiFetch(`/api/runs/${runId}/tb-scalars`, { method: "GET" });

        if (!resp.ok) {
            if (tbPathBar) tbPathBar.innerText = "TensorBoard目录：读取失败";
            return;
        }

        if (tbPathBar) {
            tbPathBar.innerText = "TensorBoard目录：" + (result.data.tensorboard_dir || "未发现");
        }

        const scalars = result.data.scalars || {};
        const { lossSeries, metricSeries } = splitScalars(scalars);

// loss 保持原样
        lossChart.setOption({
            tooltip: { trigger: "axis" },
            legend: { top: 0 },
            xAxis: { type: "value", name: "step" },
            yAxis: { type: "value", name: "loss" },
            series: lossSeries
            });

            // metric 改成归一化
        const metricRawMap = {};
        Object.keys(scalars || {}).forEach(tag => {
            const lower = tag.toLowerCase();
            if (!lower.includes("loss")) {
            metricRawMap[tag] = scalars[tag];
            }
        });

        const { normalized, rawStats } = normalizeMetricScalars(metricRawMap);

        const normalizedMetricSeries = Object.keys(normalized).map(tag => ({
            name: tag,
            type: "line",
             showSymbol: false,
             data: normalized[tag].map(item => [item.step, item.value, item.rawValue])
            }));

        metricChart.setOption({
    tooltip: {
        trigger: "axis",
        formatter: function (params) {
            if (!params || !params.length) return "";

            const lines = [`step: ${params[0].axisValue}`];
            params.forEach(item => {
                const rawValue = item.data && item.data[2] !== undefined ? item.data[2] : "-";
                lines.push(
                    `${item.marker}${item.seriesName}: 归一化=${Number(item.data[1]).toFixed(4)}, 原始值=${rawValue}`
                );
            });
            return lines.join("<br/>");
        }
    },
    legend: { top: 0 },
    xAxis: { type: "value", name: "step" },
    yAxis: {
        type: "value",
        name: "normalized metric",
        min: 0,
        max: 1
    },
    series: normalizedMetricSeries
    });

const option = metricChart.getOption();
const chartSeries = (option && option.series) ? option.series : normalizedMetricSeries;
renderMetricLegendSummary(chartSeries, rawStats);

    }

    function renderHardwareCharts() {
        if (gpuUtilChart) {
            const gpuUtilSeries = Object.keys(hardwareHistory.gpuUtil).map(key => ({
                name: `GPU ${key}`,
                type: "line",
                showSymbol: false,
                data: hardwareHistory.gpuUtil[key]
            }));

            gpuUtilChart.setOption({
                tooltip: { trigger: "axis" },
                legend: { top: 0 },
                xAxis: { type: "category", data: hardwareHistory.time },
                yAxis: { type: "value", name: "%", min: 0, max: 100 },
                series: gpuUtilSeries
            });
        }

        if (gpuMemChart) {
            const gpuMemSeries = Object.keys(hardwareHistory.gpuMem).map(key => ({
                name: `GPU ${key}`,
                type: "line",
                showSymbol: false,
                data: hardwareHistory.gpuMem[key]
            }));

            gpuMemChart.setOption({
                tooltip: { trigger: "axis" },
                legend: { top: 0 },
                xAxis: { type: "category", data: hardwareHistory.time },
                yAxis: { type: "value", name: "%", min: 0, max: 100 },
                series: gpuMemSeries
            });
        }

        if (cpuChart) {
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
        }

        if (memChart) {
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
    }

    async function fetchHardware() {
        const { resp, result } = await apiFetch(`/api/runs/${runId}/hardware`, { method: "GET" });

        if (!resp.ok) {
            if (systemStats) systemStats.innerHTML = `<p>硬件信息读取失败：${escapeHtml(result.message || "unknown error")}</p>`;
            if (gpuStats) gpuStats.innerHTML = "<p>GPU 信息读取失败</p>";
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

        if (systemStats) {
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
        }

        if (gpuStats) {
            if (!snapshot.gpu_ok) {
                gpuStats.innerHTML = `
                    <p><strong>GPU 信息不可用</strong></p>
                    <p>后端：${escapeHtml(gpuMeta.backend || "-")}</p>
                    <p>NVML 可导入：${gpuMeta.nvml_available ? "是" : "否"}</p>
                    <p>NVML 已初始化：${gpuMeta.nvml_ready ? "是" : "否"}</p>
                    <p>NVML 错误：${escapeHtml(gpuMeta.nvml_error || "-")}</p>
                    <p>nvidia-smi 可用：${gpuMeta.nvidia_smi_found ? "是" : "否"}</p>
                `;
            } else if (gpus.length === 0) {
                gpuStats.innerHTML = `<p>当前没有可显示的 GPU 数据。</p>`;
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

                    const key = String(gpu.gpu_index);
                    if (!hardwareHistory.gpuUtil[key]) hardwareHistory.gpuUtil[key] = [];
                    if (!hardwareHistory.gpuMem[key]) hardwareHistory.gpuMem[key] = [];
                    pushLimited(hardwareHistory.gpuUtil[key], gpu.util_percent ?? 0);
                    pushLimited(hardwareHistory.gpuMem[key], gpu.mem_percent ?? 0);

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
            }
        }

        if (systemStats && hints.length > 0 && system.ok !== false) {
            systemStats.innerHTML += `
                <div class="msg-box">
                    <strong>训练健康提示：</strong><br>
                    ${hints.map(h => `- ${escapeHtml(h)}`).join("<br>")}
                </div>
            `;
        }

        renderHardwareCharts();
    }

    async function loadRunBoundConfig() {
        if (runConfigMeta) runConfigMeta.textContent = "加载中...";
        if (runConfigContent) runConfigContent.value = "";
        openModal(runConfigModal);

        try {
            const { resp, result } = await apiFetch(`/api/runs/${runId}/config`, { method: "GET" });

            if (!resp.ok) {
                alert(result.message || "加载运行配置失败");
                return;
            }

            const data = result.data || {};

            if (runConfigMeta) {
                runConfigMeta.textContent =
                    `配置版本: v${data.config_version_no} | 配置名称: ${data.config_name || "-"} | 配置ID: ${data.config_id}`;
            }

            if (runConfigContent) {
                runConfigContent.value = data.content || "";
            }
        } catch (err) {
            alert("加载运行配置失败");
        }
    }

    async function refreshAll() {
        await fetchRunDetail();
        await fetchLog();
        await fetchScalars();
        await fetchHardware();
    }

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
            btn.classList.add("active");
            const panel = document.getElementById(btn.dataset.tab);
            if (panel) panel.classList.add("active");
            resizeAllCharts();
        });
    });

    if (logTypeEl) {
        logTypeEl.addEventListener("change", async () => {
            await fetchLog();
        });
    }

    if (deleteRunBtn) {
        deleteRunBtn.addEventListener("click", () => {
            openModal(deleteRunModal);
            if (deleteRunModalStatus) deleteRunModalStatus.textContent = latestRunStatus || "-";
        });
    }

    if (cancelDeleteRunBtn) {
        cancelDeleteRunBtn.addEventListener("click", () => closeModal(deleteRunModal));
    }

    if (confirmDeleteRunBtn) {
        confirmDeleteRunBtn.addEventListener("click", async () => {
            confirmDeleteRunBtn.disabled = true;
            try {
                const { resp, result } = await apiFetch(`/api/run-control/${runId}/delete`, { method: "POST" });
                if (!resp.ok) {
                    alert(result.message || "删除失败");
                    return;
                }
                closeModal(deleteRunModal);
                alert("运行已删除");
                window.location.href = `/tasks/${result.data.task_id}`;
            } finally {
                confirmDeleteRunBtn.disabled = false;
            }
        });
    }

    if (stopRunBtn) {
        stopRunBtn.addEventListener("click", () => {
            openModal(stopRunModal);
            if (stopRunModalStatus) stopRunModalStatus.textContent = latestRunStatus || "-";
        });
    }

    if (cancelStopRunBtn) {
        cancelStopRunBtn.addEventListener("click", () => closeModal(stopRunModal));
    }

    if (confirmStopRunBtn) {
        confirmStopRunBtn.addEventListener("click", async () => {
            confirmStopRunBtn.disabled = true;
            try {
                const { resp, result } = await apiFetch(`/api/run-control/${runId}/stop`, { method: "POST" });
                if (!resp.ok) {
                    alert(result.message || "停止失败");
                    return;
                }
                closeModal(stopRunModal);
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gpu_mode: "single" })
            });

            if (!resp.ok) {
                alert(result.message || "恢复失败");
                return;
            }

            alert(`恢复成功，新运行ID=${result.data.run_id}`);
            window.location.href = `/runs/${result.data.run_id}/monitor`;
        });
    }

    if (viewRunConfigBtn) {
        viewRunConfigBtn.addEventListener("click", async () => {
            await loadRunBoundConfig();
        });
    }

    if (closeRunConfigModalBtn) {
        closeRunConfigModalBtn.addEventListener("click", () => closeModal(runConfigModal));
    }

    bindMaskClose(deleteRunModal, () => closeModal(deleteRunModal));
    bindMaskClose(stopRunModal, () => closeModal(stopRunModal));
    bindMaskClose(runConfigModal, () => closeModal(runConfigModal));

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        closeModal(deleteRunModal);
        closeModal(stopRunModal);
        closeModal(runConfigModal);
    });

    window.addEventListener("resize", () => {
        resizeAllCharts();
    });

    (async function init() {
        const ok = await requireLogin();
        if (!ok) return;

        await refreshAll();

        setInterval(async () => {
            if (document.hidden) return;
            await refreshAll();
        }, 5000);
    })();
});
