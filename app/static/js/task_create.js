const token2 = localStorage.getItem("access_token");
if (!token2) {
    window.location.href = "/login";
}

const templateSelect = document.getElementById("templateSelect");
const templatePreview = document.getElementById("templatePreview");
const messageBox = document.getElementById("messageBox");

const networkGTypeSelect = document.getElementById("networkGType");
const networkGSourceTemplateSelect = document.getElementById("networkGSourceTemplate");
const trainDatasetSourceTemplateSelect = document.getElementById("trainDatasetSourceTemplate");
const valDatasetSourceTemplateSelect = document.getElementById("valDatasetSourceTemplate");
const lossSourceTemplateSelect = document.getElementById("lossSourceTemplate");
const metricSourceTemplateSelect = document.getElementById("metricSourceTemplate");

const trainDatasetTypeSelect = document.getElementById("trainDatasetType");
const valDatasetTypeSelect = document.getElementById("valDatasetType");
const lossTypeSelect = document.getElementById("lossType");

let allTemplates = [];
const templateNetworkGTypeCache = {};
const templateTrainDatasetTypeCache = {};
const templateValDatasetTypeCache = {};
const templateLossTypeCache = {};
const templateMetricTypeCache = {};

// 填充下拉菜单选项
function fillSelect(selectEl, items, defaultEmpty=true, emptyText="不选择") {
    selectEl.innerHTML = "";
    if (defaultEmpty) {
        const op = document.createElement("option");
        op.value = "";
        op.textContent = emptyText;
        selectEl.appendChild(op);
    }
    items.forEach(item => {
        const op = document.createElement("option");
        op.value = item;
        op.textContent = item;
        selectEl.appendChild(op);
    });
}

// 填充模板选择框
function fillTemplateSelect(selectEl, items, allowEmpty=false) {
    selectEl.innerHTML = "";  // 清空现有选项

    if (allowEmpty) {
        const op = document.createElement("option");
        op.value = "";
        op.textContent = "不选择";
        selectEl.appendChild(op);
    }

    // 确保我们展示的是模板的 `relative_path` 或其他描述性字段，而不是整个对象
    items.forEach(item => {
        const op = document.createElement("option");
        op.value = item.relative_path;  // 使用 relative_path 作为模板标识符
        op.textContent = item.relative_path;  // 显示 template 的相对路径（或其他字段）
        selectEl.appendChild(op);
    });
}

// 获取 JSON 数据的方法
async function fetchJson(url, options={}) {
    const resp = await fetch(url, options);
    const result = await resp.json();
    if (!resp.ok) {
        throw new Error(result.message || "request failed");
    }
    return result.data;
}

// 加载任务模板
async function loadTemplates() {
    const templates = await fetchJson("/api/tasks/templates", {
        headers: { "Authorization": "Bearer " + token2 }
    });

    allTemplates = templates || [];

    // 填充模板选择框
    fillTemplateSelect(templateSelect, templates, false);

    // 填充其他模板选择框
    [
        "networkGSourceTemplate",
        "trainDatasetSourceTemplate",
        "valDatasetSourceTemplate",
        "lossSourceTemplate",
        "metricSourceTemplate"
    ].forEach(id => fillTemplateSelect(document.getElementById(id), templates, true));

    return templates;
}

// 获取某个模板中 network_g.type 的值（带缓存）
async function getTemplateNetworkGType(relativePath) {
    if (!relativePath) return null;
    if (templateNetworkGTypeCache[relativePath] !== undefined) {
        return templateNetworkGTypeCache[relativePath];
    }
    try {
        const section = await fetchJson(
            "/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) +
            "&section_path=" + encodeURIComponent("network_g"),
            { headers: { "Authorization": "Bearer " + token2 } }
        );
        const t = (section && typeof section === "object") ? section.type || section["type"] : null;
        templateNetworkGTypeCache[relativePath] = t || null;
        return templateNetworkGTypeCache[relativePath];
    } catch (e) {
        templateNetworkGTypeCache[relativePath] = null;
        return null;
    }
}

// 根据当前选择的网络类型过滤可选模板
async function refreshNetworkGTemplateOptions() {
    const selectedType = networkGTypeSelect.value;
    if (!selectedType) {
        // 如果未选择网络类型，则展示全部模板（含“不选择”）
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

// -------- datasets.train: 根据数据集类型过滤可选模板 --------
async function getTemplateTrainDatasetType(relativePath) {
    if (!relativePath) return null;
    if (templateTrainDatasetTypeCache[relativePath] !== undefined) {
        return templateTrainDatasetTypeCache[relativePath];
    }
    try {
        const section = await fetchJson(
            "/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) +
            "&section_path=" + encodeURIComponent("datasets.train"),
            { headers: { "Authorization": "Bearer " + token2 } }
        );
        const t = (section && typeof section === "object") ? section.type || section["type"] : null;
        templateTrainDatasetTypeCache[relativePath] = t || null;
        return templateTrainDatasetTypeCache[relativePath];
    } catch (e) {
        templateTrainDatasetTypeCache[relativePath] = null;
        return null;
    }
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

// -------- datasets.val: 根据数据集类型过滤可选模板 --------
async function getTemplateValDatasetType(relativePath) {
    if (!relativePath) return null;
    if (templateValDatasetTypeCache[relativePath] !== undefined) {
        return templateValDatasetTypeCache[relativePath];
    }
    try {
        const section = await fetchJson(
            "/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) +
            "&section_path=" + encodeURIComponent("datasets.val"),
            { headers: { "Authorization": "Bearer " + token2 } }
        );
        const t = (section && typeof section === "object") ? section.type || section["type"] : null;
        templateValDatasetTypeCache[relativePath] = t || null;
        return templateValDatasetTypeCache[relativePath];
    } catch (e) {
        templateValDatasetTypeCache[relativePath] = null;
        return null;
    }
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

// -------- 损失函数：根据 lossType 过滤可选模板（使用 train.pixel_opt.type） --------
async function getTemplateLossType(relativePath) {
    if (!relativePath) return null;
    if (templateLossTypeCache[relativePath] !== undefined) {
        return templateLossTypeCache[relativePath];
    }
    try {
        const section = await fetchJson(
            "/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) +
            "&section_path=" + encodeURIComponent("train.pixel_opt"),
            { headers: { "Authorization": "Bearer " + token2 } }
        );
        const t = (section && typeof section === "object") ? section.type || section["type"] : null;
        templateLossTypeCache[relativePath] = t || null;
        return templateLossTypeCache[relativePath];
    } catch (e) {
        templateLossTypeCache[relativePath] = null;
        return null;
    }
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

// -------- 指标：根据 metrics 中首个 metric 的 type 进行过滤 --------
async function getTemplateMetricType(relativePath) {
    if (!relativePath) return null;
    if (templateMetricTypeCache[relativePath] !== undefined) {
        return templateMetricTypeCache[relativePath];
    }
    try {
        const section = await fetchJson(
            "/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) +
            "&section_path=" + encodeURIComponent("val.metrics"),
            { headers: { "Authorization": "Bearer " + token2 } }
        );
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

async function refreshMetricTemplateOptions() {
    // 指标这里没有单独的“类型下拉”，通常按模板来选
    // 为保持一致，如果未来增加 metricType 下拉，可在此接入。
    // 目前先不做额外过滤，保持全量模板可选。
    fillTemplateSelect(metricSourceTemplateSelect, allTemplates, true);
}

// 加载模块类型（模型，网络等）
async function loadModules() {
    const data = await fetchJson("/api/tasks/modules", {
        headers: { "Authorization": "Bearer " + token2 }
    });

    fillSelect(document.getElementById("modelType"), data.models || []);
    fillSelect(document.getElementById("networkGType"), data.archs || []);
    fillSelect(document.getElementById("trainDatasetType"), data.data || []);
    fillSelect(document.getElementById("valDatasetType"), data.data || []);
    fillSelect(document.getElementById("lossType"), data.losses || []);
}

// 加载模板并填充预览
async function previewTemplate(relativePath) {
    if (!relativePath) {
        templatePreview.innerText = "";
        return;
    }
    const data = await fetchJson(
        "/api/tasks/template-detail?relative_path=" + encodeURIComponent(relativePath),
        { headers: { "Authorization": "Bearer " + token2 } }
    );
    templatePreview.innerText = JSON.stringify(data, null, 2);
}

// 填充编辑器内容
async function loadSectionToEditor(relativePath, sectionPath, editorId) {
    if (!relativePath) return;
    const data = await fetchJson("/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) + "&section_path=" + encodeURIComponent(sectionPath), {
        headers: { "Authorization": "Bearer " + token2 }
    });
    document.getElementById(editorId).value = JSON.stringify(data || {}, null, 2);
}

// 初始化编辑器
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

templateSelect.addEventListener("change", async () => {
    try {
        await previewTemplate(templateSelect.value);
        await initEditorsFromMainTemplate();
    } catch (e) {
        messageBox.innerText = e.message;
    }
});

// “从模板填充”按钮逻辑
document.getElementById("fillNetworkGBtn").addEventListener("click", async () => {
    try {
        const relativePath = networkGSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            messageBox.innerText = "请先选择一个用于填充 network_g 的模板";
            return;
        }
        await loadSectionToEditor(relativePath, "network_g", "networkGEditor");
    } catch (e) {
        messageBox.innerText = e.message;
    }
});

document.getElementById("fillTrainDatasetBtn").addEventListener("click", async () => {
    try {
        const relativePath = trainDatasetSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            messageBox.innerText = "请先选择一个用于填充 datasets.train 的模板";
            return;
        }
        await loadSectionToEditor(relativePath, "datasets.train", "trainDatasetEditor");
    } catch (e) {
        messageBox.innerText = e.message;
    }
});

document.getElementById("fillValDatasetBtn").addEventListener("click", async () => {
    try {
        const relativePath = valDatasetSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            messageBox.innerText = "请先选择一个用于填充 datasets.val 的模板";
            return;
        }
        await loadSectionToEditor(relativePath, "datasets.val", "valDatasetEditor");
    } catch (e) {
        messageBox.innerText = e.message;
    }
});

document.getElementById("fillLossBtn").addEventListener("click", async () => {
    try {
        const relativePath = lossSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            messageBox.innerText = "请先选择一个用于填充 train.pixel_opt 的模板";
            return;
        }
        await loadSectionToEditor(relativePath, "train.pixel_opt", "lossEditor");
    } catch (e) {
        messageBox.innerText = e.message;
    }
});

document.getElementById("fillMetricBtn").addEventListener("click", async () => {
    try {
        const relativePath = metricSourceTemplateSelect.value || templateSelect.value;
        if (!relativePath) {
            messageBox.innerText = "请先选择一个用于填充 val.metrics 的模板";
            return;
        }
        await loadSectionToEditor(relativePath, "val.metrics", "metricEditor");
    } catch (e) {
        messageBox.innerText = e.message;
    }
});

// 提交表单并创建任务
document.getElementById("submitBtn").addEventListener("click", async () => {
    try {
        messageBox.innerText = "";
        const payload = {
            task_name: document.getElementById("taskName").value.trim(),
            task_type: document.getElementById("taskType").value,
            description: document.getElementById("description").value,
            template_relative_path: templateSelect.value,
            manual_patch_text: document.getElementById("manualPatch").value,
            section_overrides: {
                model_type: document.getElementById("modelType").value || "",
                network_g: JSON.parse(document.getElementById("networkGEditor").value || "{}"),
                "datasets.train": JSON.parse(document.getElementById("trainDatasetEditor").value || "{}"),
                "datasets.val": JSON.parse(document.getElementById("valDatasetEditor").value || "{}"),
                "train.pixel_opt": JSON.parse(document.getElementById("lossEditor").value || "{}"),
                "val.metrics": JSON.parse(document.getElementById("metricEditor").value || "{}"),
                train: JSON.parse(document.getElementById("trainEditor").value || "{}")
            }
        };

        if (!payload.task_name) {
            messageBox.innerText = "任务名称不能为空";
            return;
        }
        if (!payload.template_relative_path) {
            messageBox.innerText = "必须先选择主模板";
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
            messageBox.innerText = result.message || "创建失败";
            return;
        }

        messageBox.innerText = "创建成功，正在跳转...";
        setTimeout(() => {
            window.location.href = "/dashboard";
        }, 800);
    } catch (e) {
        messageBox.innerText = "参数区 JSON 格式错误：" + e.message;
    }
});

// 页面初始化
(async function init() {
    try {
        await loadTemplates();  // 加载模板
        await loadModules();    // 加载模块类型（如模型、数据集等）

        // 根据当前选择预过滤各类参数来源模板
        await refreshNetworkGTemplateOptions();
        await refreshTrainDatasetTemplateOptions();
        await refreshValDatasetTemplateOptions();
        await refreshLossTemplateOptions();
        await refreshMetricTemplateOptions();

        // 如果模板选择框有默认值，加载预览和编辑器内容
        if (templateSelect.value) {
            await previewTemplate(templateSelect.value);
            await initEditorsFromMainTemplate();  // 初始化编辑器
        }

        // 监听类型变化，动态过滤各自参数模板
        networkGTypeSelect.addEventListener("change", async () => {
            try {
                await refreshNetworkGTemplateOptions();
            } catch (e) {
                messageBox.innerText = e.message;
            }
        });

        trainDatasetTypeSelect.addEventListener("change", async () => {
            try {
                await refreshTrainDatasetTemplateOptions();
            } catch (e) {
                messageBox.innerText = e.message;
            }
        });

        valDatasetTypeSelect.addEventListener("change", async () => {
            try {
                await refreshValDatasetTemplateOptions();
            } catch (e) {
                messageBox.innerText = e.message;
            }
        });

        lossTypeSelect.addEventListener("change", async () => {
            try {
                await refreshLossTemplateOptions();
            } catch (e) {
                messageBox.innerText = e.message;
            }
        });
    } catch (e) {
        messageBox.innerText = e.message;
    }
})();
