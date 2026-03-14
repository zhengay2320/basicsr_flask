const token2 = localStorage.getItem("access_token");
if (!token2) {
    window.location.href = "/login";
}

const templateSelect = document.getElementById("templateSelect");
const templatePreview = document.getElementById("templatePreview");
const messageBox = document.getElementById("messageBox");

const modelTypeSelect = document.getElementById("modelType");
const networkGTypeSelect = document.getElementById("networkGType");
const trainDatasetTypeSelect = document.getElementById("trainDatasetType");
const valDatasetTypeSelect = document.getElementById("valDatasetType");
const lossTypeSelect = document.getElementById("lossType");

const networkGSourceTemplateSelect = document.getElementById("networkGSourceTemplate");
const trainDatasetSourceTemplateSelect = document.getElementById("trainDatasetSourceTemplate");
const valDatasetSourceTemplateSelect = document.getElementById("valDatasetSourceTemplate");
const lossSourceTemplateSelect = document.getElementById("lossSourceTemplate");
const metricSourceTemplateSelect = document.getElementById("metricSourceTemplate");

let allTemplates = [];

const templateNetworkGTypeCache = {};
const templateTrainDatasetTypeCache = {};
const templateValDatasetTypeCache = {};
const templateLossTypeCache = {};
const templateMetricTypeCache = {};

function showMessage(msg) {
    messageBox.innerText = msg || "";
}

function fillSelect(selectEl, items, defaultEmpty = true, emptyText = "不选择") {
    selectEl.innerHTML = "";

    if (defaultEmpty) {
        const op = document.createElement("option");
        op.value = "";
        op.textContent = emptyText;
        selectEl.appendChild(op);
    }

    (items || []).forEach(item => {
        const op = document.createElement("option");

        if (typeof item === "string") {
            op.value = item;
            op.textContent = item;
        } else {
            op.value = item.value || "";
            op.textContent = item.label || item.value || "";
        }

        selectEl.appendChild(op);
    });
}

function fillTemplateSelect(selectEl, items, allowEmpty = false) {
    selectEl.innerHTML = "";

    if (allowEmpty) {
        const op = document.createElement("option");
        op.value = "";
        op.textContent = "不选择";
        selectEl.appendChild(op);
    }

    (items || []).forEach(item => {
        const op = document.createElement("option");
        op.value = item.relative_path;
        op.textContent = item.relative_path;
        selectEl.appendChild(op);
    });
}

async function fetchJson(url, options = {}) {
    const resp = await fetch(url, options);
    const result = await resp.json();

    if (!resp.ok) {
        throw new Error(result.message || "request failed");
    }

    return result.data;
}

async function loadTemplates() {
    const templates = await fetchJson("/api/tasks/templates", {
        headers: { "Authorization": "Bearer " + token2 }
    });

    allTemplates = templates || [];

    fillTemplateSelect(templateSelect, allTemplates, false);
    fillTemplateSelect(networkGSourceTemplateSelect, allTemplates, true);
    fillTemplateSelect(trainDatasetSourceTemplateSelect, allTemplates, true);
    fillTemplateSelect(valDatasetSourceTemplateSelect, allTemplates, true);
    fillTemplateSelect(lossSourceTemplateSelect, allTemplates, true);
    fillTemplateSelect(metricSourceTemplateSelect, allTemplates, true);
}

async function loadModules() {
    const data = await fetchJson("/api/tasks/modules", {
        headers: { "Authorization": "Bearer " + token2 }
    });

    fillSelect(modelTypeSelect, data.models || []);
    fillSelect(networkGTypeSelect, data.archs || []);
    fillSelect(trainDatasetTypeSelect, data.data || []);
    fillSelect(valDatasetTypeSelect, data.data || []);
    fillSelect(lossTypeSelect, data.losses || []);
}

async function previewTemplate(relativePath) {
    if (!relativePath) {
        templatePreview.innerText = "";
        return;
    }

    const data = await fetchJson(
        "/api/tasks/template-detail?relative_path=" + encodeURIComponent(relativePath),
        {
            headers: { "Authorization": "Bearer " + token2 }
        }
    );

    templatePreview.innerText = JSON.stringify(data, null, 2);
}

async function loadSectionToEditor(relativePath, sectionPath, editorId) {
    if (!relativePath) {
        return;
    }

    const data = await fetchJson(
        "/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) +
        "&section_path=" + encodeURIComponent(sectionPath),
        {
            headers: { "Authorization": "Bearer " + token2 }
        }
    );

    document.getElementById(editorId).value = JSON.stringify(data || {}, null, 2);
}

async function initEditorsFromMainTemplate() {
    const mainTpl = templateSelect.value;
    if (!mainTpl) return;

    await loadSectionToEditor(mainTpl, "network_g", "networkGEditor");
    await loadSectionToEditor(mainTpl, "datasets.train", "trainDatasetEditor");
    await loadSectionToEditor(mainTpl, "datasets.val", "valDatasetEditor");
    await loadSectionToEditor(mainTpl, "train.pixel_opt", "lossEditor");
    await loadSectionToEditor(mainTpl, "val.metrics", "metricEditor");
    await loadSectionToEditor(mainTpl, "train", "trainEditor");
}

async function getTemplateSection(relativePath, sectionPath) {
    if (!relativePath) return null;

    return await fetchJson(
        "/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) +
        "&section_path=" + encodeURIComponent(sectionPath),
        {
            headers: { "Authorization": "Bearer " + token2 }
        }
    );
}

async function getTemplateNetworkGType(relativePath) {
    if (!relativePath) return null;
    if (templateNetworkGTypeCache[relativePath] !== undefined) {
        return templateNetworkGTypeCache[relativePath];
    }

    try {
        const section = await getTemplateSection(relativePath, "network_g");
        const t = (section && typeof section === "object") ? (section.type || section["type"]) : null;
        templateNetworkGTypeCache[relativePath] = t || null;
        return templateNetworkGTypeCache[relativePath];
    } catch (e) {
        templateNetworkGTypeCache[relativePath] = null;
        return null;
    }
}

async function getTemplateTrainDatasetType(relativePath) {
    if (!relativePath) return null;
    if (templateTrainDatasetTypeCache[relativePath] !== undefined) {
        return templateTrainDatasetTypeCache[relativePath];
    }

    try {
        const section = await getTemplateSection(relativePath, "datasets.train");
        const t = (section && typeof section === "object") ? (section.type || section["type"]) : null;
        templateTrainDatasetTypeCache[relativePath] = t || null;
        return templateTrainDatasetTypeCache[relativePath];
    } catch (e) {
        templateTrainDatasetTypeCache[relativePath] = null;
        return null;
    }
}

async function getTemplateValDatasetType(relativePath) {
    if (!relativePath) return null;
    if (templateValDatasetTypeCache[relativePath] !== undefined) {
        return templateValDatasetTypeCache[relativePath];
    }

    try {
        const section = await getTemplateSection(relativePath, "datasets.val");
        const t = (section && typeof section === "object") ? (section.type || section["type"]) : null;
        templateValDatasetTypeCache[relativePath] = t || null;
        return templateValDatasetTypeCache[relativePath];
    } catch (e) {
        templateValDatasetTypeCache[relativePath] = null;
        return null;
    }
}

async function getTemplateLossType(relativePath) {
    if (!relativePath) return null;
    if (templateLossTypeCache[relativePath] !== undefined) {
        return templateLossTypeCache[relativePath];
    }

    try {
        const section = await getTemplateSection(relativePath, "train.pixel_opt");
        const t = (section && typeof section === "object") ? (section.type || section["type"]) : null;
        templateLossTypeCache[relativePath] = t || null;
        return templateLossTypeCache[relativePath];
    } catch (e) {
        templateLossTypeCache[relativePath] = null;
        return null;
    }
}

async function getTemplateMetricType(relativePath) {
    if (!relativePath) return null;
    if (templateMetricTypeCache[relativePath] !== undefined) {
        return templateMetricTypeCache[relativePath];
    }

    try {
        const section = await getTemplateSection(relativePath, "val.metrics");
        let t = null;

        if (section && typeof section === "object") {
            for (const key of Object.keys(section)) {
                const cfg = section[key];
                if (cfg && typeof cfg === "object" && (cfg.type || cfg["type"])) {
                    t = cfg.type || cfg["type"];
                    break;
                }
            }
        }

        templateMetricTypeCache[relativePath] = t || null;
        return templateMetricTypeCache[relativePath];
    } catch (e) {
        templateMetricTypeCache[relativePath] = null;
        return null;
    }
}

async function refreshNetworkGTemplateOptions() {
    const selectedType = networkGTypeSelect.value;

    if (!selectedType) {
        fillTemplateSelect(networkGSourceTemplateSelect, allTemplates, true);
        return;
    }

    const matched = [];
    for (const tpl of allTemplates) {
        const t = await getTemplateNetworkGType(tpl.relative_path);
        if (t === selectedType) {
            matched.push(tpl);
        }
    }

    fillTemplateSelect(networkGSourceTemplateSelect, matched, true);
}

async function refreshTrainDatasetTemplateOptions() {
    const selectedType = trainDatasetTypeSelect.value;

    if (!selectedType) {
        fillTemplateSelect(trainDatasetSourceTemplateSelect, allTemplates, true);
        return;
    }

    const matched = [];
    for (const tpl of allTemplates) {
        const t = await getTemplateTrainDatasetType(tpl.relative_path);
        if (t === selectedType) {
            matched.push(tpl);
        }
    }

    fillTemplateSelect(trainDatasetSourceTemplateSelect, matched, true);
}

async function refreshValDatasetTemplateOptions() {
    const selectedType = valDatasetTypeSelect.value;

    if (!selectedType) {
        fillTemplateSelect(valDatasetSourceTemplateSelect, allTemplates, true);
        return;
    }

    const matched = [];
    for (const tpl of allTemplates) {
        const t = await getTemplateValDatasetType(tpl.relative_path);
        if (t === selectedType) {
            matched.push(tpl);
        }
    }

    fillTemplateSelect(valDatasetSourceTemplateSelect, matched, true);
}

async function refreshLossTemplateOptions() {
    const selectedType = lossTypeSelect.value;

    if (!selectedType) {
        fillTemplateSelect(lossSourceTemplateSelect, allTemplates, true);
        return;
    }

    const matched = [];
    for (const tpl of allTemplates) {
        const t = await getTemplateLossType(tpl.relative_path);
        if (t === selectedType) {
            matched.push(tpl);
        }
    }

    fillTemplateSelect(lossSourceTemplateSelect, matched, true);
}

async function refreshMetricTemplateOptions() {
    fillTemplateSelect(metricSourceTemplateSelect, allTemplates, true);
}

templateSelect.addEventListener("change", async () => {
    try {
        showMessage("");
        await previewTemplate(templateSelect.value);
        await initEditorsFromMainTemplate();
    } catch (e) {
        showMessage(e.message);
    }
});

document.getElementById("fillNetworkGBtn").addEventListener("click", async () => {
    try {
        showMessage("");
        const relativePath = networkGSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            showMessage("请先选择一个用于填充 network_g 的模板");
            return;
        }
        await loadSectionToEditor(relativePath, "network_g", "networkGEditor");
    } catch (e) {
        showMessage(e.message);
    }
});

document.getElementById("fillTrainDatasetBtn").addEventListener("click", async () => {
    try {
        showMessage("");
        const relativePath = trainDatasetSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            showMessage("请先选择一个用于填充 datasets.train 的模板");
            return;
        }
        await loadSectionToEditor(relativePath, "datasets.train", "trainDatasetEditor");
    } catch (e) {
        showMessage(e.message);
    }
});

document.getElementById("fillValDatasetBtn").addEventListener("click", async () => {
    try {
        showMessage("");
        const relativePath = valDatasetSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            showMessage("请先选择一个用于填充 datasets.val 的模板");
            return;
        }
        await loadSectionToEditor(relativePath, "datasets.val", "valDatasetEditor");
    } catch (e) {
        showMessage(e.message);
    }
});

document.getElementById("fillLossBtn").addEventListener("click", async () => {
    try {
        showMessage("");
        const relativePath = lossSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            showMessage("请先选择一个用于填充 train.pixel_opt 的模板");
            return;
        }
        await loadSectionToEditor(relativePath, "train.pixel_opt", "lossEditor");
    } catch (e) {
        showMessage(e.message);
    }
});

document.getElementById("fillMetricBtn").addEventListener("click", async () => {
    try {
        showMessage("");
        const relativePath = metricSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            showMessage("请先选择一个用于填充 val.metrics 的模板");
            return;
        }
        await loadSectionToEditor(relativePath, "val.metrics", "metricEditor");
    } catch (e) {
        showMessage(e.message);
    }
});

document.getElementById("submitBtn").addEventListener("click", async () => {
    try {
        showMessage("");

        const payload = {
            task_name: document.getElementById("taskName").value.trim(),
            task_type: document.getElementById("taskType").value,
            description: document.getElementById("description").value,
            template_relative_path: templateSelect.value,
            manual_patch_text: document.getElementById("manualPatch").value,
            section_overrides: {
                model_type: modelTypeSelect.value || "",
                network_g: JSON.parse(document.getElementById("networkGEditor").value || "{}"),
                "datasets.train": JSON.parse(document.getElementById("trainDatasetEditor").value || "{}"),
                "datasets.val": JSON.parse(document.getElementById("valDatasetEditor").value || "{}"),
                "train.pixel_opt": JSON.parse(document.getElementById("lossEditor").value || "{}"),
                "val.metrics": JSON.parse(document.getElementById("metricEditor").value || "{}"),
                train: JSON.parse(document.getElementById("trainEditor").value || "{}")
            }
        };

        if (!payload.task_name) {
            showMessage("任务名称不能为空");
            return;
        }

        if (!payload.template_relative_path) {
            showMessage("必须先选择主模板");
            return;
        }

        const resp = await fetch("/api/tasks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token2
            },
            body: JSON.stringify(payload)
        });

        const result = await resp.json();

        if (!resp.ok) {
            showMessage(result.message || "创建失败");
            return;
        }

        showMessage("创建成功，正在跳转...");
        setTimeout(() => {
            window.location.href = "/dashboard";
        }, 800);
    } catch (e) {
        showMessage("参数区 JSON 格式错误：" + e.message);
    }
});

(async function init() {
    try {
        showMessage("");

        await loadTemplates();
        await loadModules();

        await refreshNetworkGTemplateOptions();
        await refreshTrainDatasetTemplateOptions();
        await refreshValDatasetTemplateOptions();
        await refreshLossTemplateOptions();
        await refreshMetricTemplateOptions();

        if (templateSelect.value) {
            await previewTemplate(templateSelect.value);
            await initEditorsFromMainTemplate();
        }

        networkGTypeSelect.addEventListener("change", async () => {
            try {
                await refreshNetworkGTemplateOptions();
            } catch (e) {
                showMessage(e.message);
            }
        });

        trainDatasetTypeSelect.addEventListener("change", async () => {
            try {
                await refreshTrainDatasetTemplateOptions();
            } catch (e) {
                showMessage(e.message);
            }
        });

        valDatasetTypeSelect.addEventListener("change", async () => {
            try {
                await refreshValDatasetTemplateOptions();
            } catch (e) {
                showMessage(e.message);
            }
        });

        lossTypeSelect.addEventListener("change", async () => {
            try {
                await refreshLossTemplateOptions();
            } catch (e) {
                showMessage(e.message);
            }
        });
    } catch (e) {
        showMessage(e.message);
    }
})();

const taskCreateForm = document.getElementById("taskCreateForm");
const taskCreateMessage = document.getElementById("taskCreateMessage");
const taskResetBtn = document.getElementById("taskResetBtn");

function clearTaskErrors() {
  const ids = [
    "taskNameError",
    "taskTypeError",
    "datasetError",
    "modelNameError",
    "configContentError"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = "";
  });
  if (taskCreateMessage) taskCreateMessage.innerText = "";
}

function showTaskMessage(text, ok = false) {
  if (!taskCreateMessage) return;
  taskCreateMessage.style.color = ok ? "var(--success)" : "var(--danger)";
  taskCreateMessage.innerText = text;
}

taskCreateForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  clearTaskErrors();

  const payload = {
    task_name: document.getElementById("taskName").value.trim(),
    task_type: document.getElementById("taskType").value,
    dataset: document.getElementById("dataset").value.trim(),
    model_name: document.getElementById("modelName").value.trim(),
    config_content: document.getElementById("configContent").value.trim(),
    remark: document.getElementById("remark").value.trim()
  };

  let valid = true;

  if (!payload.task_name) {
    document.getElementById("taskNameError").innerText = "请输入任务名称";
    valid = false;
  }
  if (!payload.task_type) {
    document.getElementById("taskTypeError").innerText = "请选择任务类型";
    valid = false;
  }
  if (!payload.dataset) {
    document.getElementById("datasetError").innerText = "请输入数据集路径";
    valid = false;
  }
  if (!payload.model_name) {
    document.getElementById("modelNameError").innerText = "请输入模型名称";
    valid = false;
  }
  if (!payload.config_content) {
    document.getElementById("configContentError").innerText = "请输入配置内容";
    valid = false;
  }

  if (!valid) return;

  // 这里先做占位。你后端如果已有任务创建 API，
  // 把下面注释替换成真实 fetch 即可。
  showTaskMessage("前端表单校验已完成。下一步把这里对接你的任务创建接口。", true);
});

taskResetBtn.addEventListener("click", function () {
  taskCreateForm.reset();
  clearTaskErrors();
});
