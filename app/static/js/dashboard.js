const token = localStorage.getItem("access_token");

if (!token) {
    window.location.href = "/login";
}

document.getElementById("createTaskBtn").addEventListener("click", () => {
    window.location.href = "/tasks/create";
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
});
async function loadTasks() {
    const resp = await fetch("/api/tasks?_ts=" + Date.now(), {
        headers: {
            "Authorization": "Bearer " + token
        }
    });
    const result = await resp.json();

    const taskList = document.getElementById("taskList");
    const taskEmpty = document.getElementById("taskEmpty");
    taskList.innerHTML = "";

    if (!resp.ok) {
        taskEmpty.style.display = "block";
        taskEmpty.innerText = result.message || "加载任务失败";
        return;
    }

    const tasks = result.data || [];
    if (tasks.length === 0) {
        taskEmpty.style.display = "block";
        taskEmpty.innerText = "当前还没有任务，请先创建一个任务。";
        return;
    }

    taskEmpty.style.display = "none";

    tasks.forEach(task => {
        const div = document.createElement("div");
        div.className = "task-card";
        div.innerHTML = `
    <h3>${task.task_name}</h3>
   <p class="task-desc"><strong>描述：</strong>${task.description ? task.description : "暂无描述"}</p>
    <p>类型：${task.task_type}</p>
    <p>状态：${task.status}</p>
    <p>模板：${task.template_path || "-"}</p>
    <button data-id="${task.id}">进入任务</button>
`;

        div.querySelector("button").addEventListener("click", () => {
            window.location.href = `/tasks/${task.id}`;
        });
        taskList.appendChild(div);
    });
}


loadTasks();
