mkdir -p backup_ui_$(date +%Y%m%d_%H%M%S)
cp app/templates/run_monitor.html backup_ui_$(date +%Y%m%d_%H%M%S)/run_monitor.html.bak 2>/dev/null || true
cp app/templates/task_config.html backup_ui_$(date +%Y%m%d_%H%M%S)/task_config.html.bak 2>/dev/null || true
cp app/static/css/task.css backup_ui_$(date +%Y%m%d_%H%M%S)/task.css.bak 2>/dev/null || true

cat > app/templates/run_monitor.html <<'EOF'
{% extends "base.html" %}

{% block title %}训练监控{% endblock %}
{% block page_title %}训练监控{% endblock %}
{% block page_subtitle %}保留原有监控、日志、曲线与硬件状态能力，仅统一后台视觉风格{% endblock %}

{% block extra_css %}
<link rel="stylesheet" href="{{ url_for('static', filename='css/task.css') }}">
{% endblock %}

{% block content %}
<div class="monitor-shell">
  <div class="monitor-header-card content-card">
    <div>
      <div class="hero-badge">RUN MONITOR</div>
      <h2>训练监控</h2>
      <p>实时查看运行状态、日志输出、TensorBoard 曲线以及硬件使用情况。</p>
    </div>
    <div class="monitor-header-actions">
      <button class="ghost-btn" type="button" onclick="history.back()">返回上一页</button>
    </div>
  </div>

  <div class="content-card monitor-main-card">
    <div id="statusBar" class="status-bar status-pending">状态加载中...</div>
    <div id="tbPathBar" class="tb-path-bar">TensorBoard目录：-</div>
    <div id="bestWorstBox" class="metric-summary monitor-summary-box"></div>

    <div class="form-row action-row monitor-action-row">
      <button id="stopRunBtn" class="danger-btn" type="button">停止当前运行</button>
      <button id="resumeRunBtn" class="primary-btn" type="button">恢复当前运行</button>
    </div>

    <div class="tab-bar monitor-tab-bar">
      <button class="tab-btn active" data-tab="logTab" type="button">日志窗口</button>
      <button class="tab-btn" data-tab="curveTab" type="button">曲线监控</button>
      <button class="tab-btn" data-tab="hardwareTab" type="button">硬件监控</button>
    </div>

    <div id="logTab" class="tab-panel active">
      <div class="form-row monitor-log-filter-row">
        <label for="logType">日志类型</label>
        <select id="logType">
          <option value="stdout">stdout</option>
          <option value="stderr">stderr</option>
        </select>
      </div>
      <pre id="logWindow" class="log-window"></pre>
    </div>

    <div id="curveTab" class="tab-panel">
      <div class="chart-grid">
        <div class="chart-card">
          <h3>Loss 曲线</h3>
          <div id="lossChart" class="chart-box"></div>
        </div>
        <div class="chart-card">
          <h3>Metric 曲线</h3>
          <div id="metricChart" class="chart-box"></div>
        </div>
      </div>
    </div>

    <div id="hardwareTab" class="tab-panel">
      <div class="hardware-summary">
        <div class="hardware-card">
          <h3>系统概览</h3>
          <div id="systemStats"></div>
        </div>
        <div class="hardware-card">
          <h3>GPU 概览</h3>
          <div id="gpuStats"></div>
        </div>
      </div>

      <div class="chart-grid">
        <div class="chart-card">
          <h3>GPU 利用率曲线</h3>
          <div id="gpuUtilChart" class="chart-box"></div>
        </div>
        <div class="chart-card">
          <h3>GPU 显存占用曲线</h3>
          <div id="gpuMemChart" class="chart-box"></div>
        </div>
        <div class="chart-card">
          <h3>CPU 使用率曲线</h3>
          <div id="cpuChart" class="chart-box"></div>
        </div>
        <div class="chart-card">
          <h3>内存使用率曲线</h3>
          <div id="memChart" class="chart-box"></div>
        </div>
      </div>
    </div>
  </div>
</div>
{% endblock %}

{% block extra_js %}
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<script>
  window.__RUN_ID__ = {{ run_id }};
</script>
<script src="{{ url_for('static', filename='js/run_monitor.js') }}"></script>
{% endblock %}
EOF

cat > app/templates/task_config.html <<'EOF'
{% extends "base.html" %}

{% block title %}任务配置管理{% endblock %}
{% block page_title %}任务配置管理{% endblock %}
{% block page_subtitle %}保留原有在线编辑与版本保存逻辑，仅统一页面布局和主题视觉{% endblock %}

{% block extra_css %}
<link rel="stylesheet" href="{{ url_for('static', filename='css/task.css') }}">
{% endblock %}

{% block content %}
<div class="config-shell">
  <div class="config-header-card content-card">
    <div>
      <div class="hero-badge">CONFIG MANAGER</div>
      <h2>任务配置管理</h2>
      <p>在线编辑当前配置、保存版本，并查看任务配置历史。</p>
    </div>
    <div class="config-header-actions">
      <button class="ghost-btn" type="button" onclick="history.back()">返回任务页</button>
    </div>
  </div>

  <div class="config-grid">
    <div class="content-card config-editor-card">
      <div class="section-title">当前配置内容（可在线修改）</div>

      <div class="form-row">
        <textarea id="configEditor" rows="28" class="code-editor"></textarea>
      </div>

      <div class="form-row">
        <label for="configName">保存说明（可选）</label>
        <input id="configName" type="text" placeholder="例如：调整学习率后的版本">
      </div>

      <div class="detail-actions">
        <button id="saveVersionBtn" class="primary-btn" type="button">保存为新版本</button>
      </div>

      <div id="msgBox" class="msg-box"></div>
    </div>

    <div class="content-card config-version-card detail-side-card">
      <div class="section-title">历史版本</div>
      <div id="versionList" class="timeline-list"></div>
    </div>
  </div>
</div>
{% endblock %}

{% block extra_js %}
<script>
  window.__TASK_ID__ = {{ task_id }};
</script>
<script src="{{ url_for('static', filename='js/task_config.js') }}"></script>
{% endblock %}
EOF

cat >> app/static/css/task.css <<'EOF'

/* ===== Theme-aware overrides for task pages ===== */
body {
    color: var(--text, #172033);
    background: transparent;
}

.container {
    width: min(1180px, 100%);
    margin: 0;
}

.topbar h1,
.topbar h2,
.topbar h3,
h1, h2, h3 {
    color: var(--text, #172033);
}

button {
    background: linear-gradient(135deg, var(--primary, #4f46e5), var(--primary-2, #7c3aed));
    color: #fff;
    border-radius: 14px;
    box-shadow: 0 12px 24px rgba(79, 70, 229, 0.18);
}

button:hover {
    background: linear-gradient(135deg, var(--primary, #4f46e5), var(--primary-2, #7c3aed));
    transform: translateY(-1px);
}

.danger-btn {
    background: linear-gradient(135deg, var(--danger, #ef4444), #f97316);
}

.form-box,
.task-card,
.run-card,
.empty-box,
.chart-card,
.hardware-card,
.metric-summary,
.metric-table,
.modal-card {
    background: var(--panel, rgba(255, 255, 255, 0.78));
    border: 1px solid var(--border, rgba(148, 163, 184, 0.22));
    box-shadow: var(--shadow, 0 18px 48px rgba(17, 24, 39, 0.12));
    color: var(--text, #172033);
    backdrop-filter: blur(16px);
}

.form-row label,
.tb-path-bar,
.task-desc,
.msg-box,
.metric-table th,
.modal-card p,
.gpu-item,
.task-card p,
.run-card p,
.hardware-card p {
    color: var(--subtext, #667085);
}

.form-row input,
.form-row select,
.form-row textarea,
.theme-select {
    color: var(--text, #172033);
    background: var(--panel-strong, rgba(255, 255, 255, 0.92));
    border: 1px solid var(--border, rgba(148, 163, 184, 0.22));
    border-radius: 14px;
}

.form-row input:focus,
.form-row select:focus,
.form-row textarea:focus {
    border-color: var(--primary, #4f46e5);
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
}

.preview-box,
.log-window,
.code-panel {
    background: rgba(15, 23, 42, 0.88);
    color: #dbeafe;
    border: 1px solid rgba(148, 163, 184, 0.18);
}

.metric-table th {
    background: rgba(255, 255, 255, 0.06);
}

.metric-table td,
.metric-table th,
.gpu-item {
    border-color: var(--border, rgba(148, 163, 184, 0.22));
}

.tab-btn {
    background: var(--panel-strong, rgba(255, 255, 255, 0.92));
    color: var(--text, #172033);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.22));
    box-shadow: none;
}

.tab-btn.active {
    background: linear-gradient(135deg, var(--primary, #4f46e5), var(--primary-2, #7c3aed));
    color: #fff;
    border-color: transparent;
}

.status-running {
    background: linear-gradient(135deg, var(--primary, #4f46e5), var(--primary-2, #7c3aed));
}

.status-success {
    background: linear-gradient(135deg, var(--success, #10b981), #22c55e);
}

.status-failed {
    background: linear-gradient(135deg, var(--danger, #ef4444), #f97316);
}

.status-pending {
    background: linear-gradient(135deg, #64748b, #94a3b8);
}

.monitor-shell,
.config-shell {
    display: grid;
    gap: 20px;
}

.monitor-header-card,
.config-header-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 24px;
}

.monitor-header-card h2,
.config-header-card h2 {
    margin: 10px 0 8px;
    font-size: 30px;
    font-weight: 800;
}

.monitor-header-card p,
.config-header-card p {
    margin: 0;
    color: var(--subtext, #667085);
    line-height: 1.8;
}

.monitor-main-card,
.config-editor-card,
.config-version-card {
    padding: 24px;
}

.monitor-header-actions,
.config-header-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.monitor-action-row {
    margin: 18px 0;
}

.monitor-summary-box {
    margin-bottom: 16px;
}

.monitor-log-filter-row {
    max-width: 260px;
}

.config-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 18px;
}

#versionList {
    display: grid;
    gap: 12px;
}

#versionList .run-card,
#versionList > div {
    padding: 14px 16px;
    border-radius: 18px;
    background: rgba(255,255,255,.05);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.22));
}

@media (max-width: 1080px) {
    .config-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 768px) {
    .monitor-header-card,
    .config-header-card {
        flex-direction: column;
        align-items: flex-start;
    }

    .monitor-header-actions,
    .config-header-actions {
        width: 100%;
    }

    .monitor-header-actions .ghost-btn,
    .config-header-actions .ghost-btn {
        width: 100%;
    }
}
EOF
