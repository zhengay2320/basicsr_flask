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
  if (messageBox) {
    messageBox.innerText = msg || "";
  }
}

function fillSelect(selectEl, items, defaultEmpty = true, emptyText = "不选择") {
  if (!selectEl) return;

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
  if (!selectEl) return;

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
  const { resp, result } = await apiFetch(url, options);

  if (!resp.ok) {
    throw new Error(result.message || "request failed");
  }

  return result.data;
}

async function loadTemplates() {
  const templates = await fetchJson("/api/tasks/templates", {
    method: "GET"
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
    method: "GET"
  });

  fillSelect(modelTypeSelect, data.models || []);
  fillSelect(networkGTypeSelect, data.archs || []);
  fillSelect(trainDatasetTypeSelect, data.data || []);
  fillSelect(valDatasetTypeSelect, data.data || []);
  fillSelect(lossTypeSelect, data.losses || []);
}

async function previewTemplate(relativePath) {
  if (!relativePath) {
    if (templatePreview) templatePreview.innerText = "";
    return;
  }

  const data = await fetchJson(
    "/api/tasks/template-detail?relative_path=" + encodeURIComponent(relativePath),
    {
      method: "GET"
    }
  );

  if (templatePreview) {
    templatePreview.innerText = JSON.stringify(data, null, 2);
  }
}

async function loadSectionToEditor(relativePath, sectionPath, editorId) {
  if (!relativePath) return;

  const data = await fetchJson(
    "/api/tasks/template-section?relative_path=" + encodeURIComponent(relativePath) +
    "&section_path=" + encodeURIComponent(sectionPath),
    {
      method: "GET"
    }
  );

  const editor = document.getElementById(editorId);
  if (editor) {
    editor.value = JSON.stringify(data || {}, null, 2);
  }
}

async function initEditorsFromMainTemplate() {
  const mainTpl = templateSelect ? templateSelect.value : "";
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
      method: "GET"
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
  const selectedType = networkGTypeSelect ? networkGTypeSelect.value : "";

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
  const selectedType = trainDatasetTypeSelect ? trainDatasetTypeSelect.value : "";

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
  const selectedType = valDatasetTypeSelect ? valDatasetTypeSelect.value : "";

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
  const selectedType = lossTypeSelect ? lossTypeSelect.value : "";

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

if (templateSelect) {
  templateSelect.addEventListener("change", async () => {
    try {
      showMessage("");
      await previewTemplate(templateSelect.value);
      await initEditorsFromMainTemplate();
    } catch (e) {
      showMessage(e.message);
    }
  });
}

const fillNetworkGBtn = document.getElementById("fillNetworkGBtn");
if (fillNetworkGBtn) {
  fillNetworkGBtn.addEventListener("click", async () => {
    try {
      showMessage("");
      const relativePath = (networkGSourceTemplateSelect && networkGSourceTemplateSelect.value) || (templateSelect && templateSelect.value);
      if (!relativePath) {
        showMessage("请先选择一个用于填充 network_g 的模板");
        return;
      }
      await loadSectionToEditor(relativePath, "network_g", "networkGEditor");
    } catch (e) {
      showMessage(e.message);
    }
  });
}

const fillTrainDatasetBtn = document.getElementById("fillTrainDatasetBtn");
if (fillTrainDatasetBtn) {
  fillTrainDatasetBtn.addEventListener("click", async () => {
    try {
      showMessage("");
      const relativePath = (trainDatasetSourceTemplateSelect && trainDatasetSourceTemplateSelect.value) || (templateSelect && templateSelect.value);
      if (!relativePath) {
        showMessage("请先选择一个用于填充 datasets.train 的模板");
        return;
      }
      await loadSectionToEditor(relativePath, "datasets.train", "trainDatasetEditor");
    } catch (e) {
      showMessage(e.message);
    }
  });
}

const fillValDatasetBtn = document.getElementById("fillValDatasetBtn");
if (fillValDatasetBtn) {
  fillValDatasetBtn.addEventListener("click", async () => {
    try {
      showMessage("");
      const relativePath = (valDatasetSourceTemplateSelect && valDatasetSourceTemplateSelect.value) || (templateSelect && templateSelect.value);
      if (!relativePath) {
        showMessage("请先选择一个用于填充 datasets.val 的模板");
        return;
      }
      await loadSectionToEditor(relativePath, "datasets.val", "valDatasetEditor");
    } catch (e) {
      showMessage(e.message);
    }
  });
}

const fillLossBtn = document.getElementById("fillLossBtn");
if (fillLossBtn) {
  fillLossBtn.addEventListener("click", async () => {
    try {
      showMessage("");
      const relativePath = (lossSourceTemplateSelect && lossSourceTemplateSelect.value) || (templateSelect && templateSelect.value);
      if (!relativePath) {
        showMessage("请先选择一个用于填充 train.pixel_opt 的模板");
        return;
      }
      await loadSectionToEditor(relativePath, "train.pixel_opt", "lossEditor");
    } catch (e) {
      showMessage(e.message);
    }
  });
}

const fillMetricBtn = document.getElementById("fillMetricBtn");
if (fillMetricBtn) {
  fillMetricBtn.addEventListener("click", async () => {
    try {
      showMessage("");
      const relativePath = (metricSourceTemplateSelect && metricSourceTemplateSelect.value) || (templateSelect && templateSelect.value);
      if (!relativePath) {
        showMessage("请先选择一个用于填充 val.metrics 的模板");
        return;
      }
      await loadSectionToEditor(relativePath, "val.metrics", "metricEditor");
    } catch (e) {
      showMessage(e.message);
    }
  });
}

const submitBtn = document.getElementById("submitBtn");
if (submitBtn) {
  submitBtn.addEventListener("click", async () => {
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

      const { resp, result } = await apiFetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

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
}

(async function init() {
  try {
    const ok = await requireLogin();
    if (!ok) return;

    showMessage("");

    await loadTemplates();
    await loadModules();

    await refreshNetworkGTemplateOptions();
    await refreshTrainDatasetTemplateOptions();
    await refreshValDatasetTemplateOptions();
    await refreshLossTemplateOptions();
    await refreshMetricTemplateOptions();

    if (templateSelect && templateSelect.value) {
      await previewTemplate(templateSelect.value);
      await initEditorsFromMainTemplate();
    }

    if (networkGTypeSelect) {
      networkGTypeSelect.addEventListener("change", async () => {
        try {
          await refreshNetworkGTemplateOptions();
        } catch (e) {
          showMessage(e.message);
        }
      });
    }

    if (trainDatasetTypeSelect) {
      trainDatasetTypeSelect.addEventListener("change", async () => {
        try {
          await refreshTrainDatasetTemplateOptions();
        } catch (e) {
          showMessage(e.message);
        }
      });
    }

    if (valDatasetTypeSelect) {
      valDatasetTypeSelect.addEventListener("change", async () => {
        try {
          await refreshValDatasetTemplateOptions();
        } catch (e) {
          showMessage(e.message);
        }
      });
    }

    if (lossTypeSelect) {
      lossTypeSelect.addEventListener("change", async () => {
        try {
          await refreshLossTemplateOptions();
        } catch (e) {
          showMessage(e.message);
        }
      });
    }
  } catch (e) {
    showMessage(e.message);
  }
})();
