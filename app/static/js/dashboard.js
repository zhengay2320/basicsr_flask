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
            <div class="task-card-head">
                <h3 class="task-title">${task.task_name}</h3>
                <div class="task-status">${task.status}</div>
            </div>

            <p class="task-desc"><strong>描述：</strong>${task.description ? task.description : "暂无描述"}</p>
            <p><strong>类型：</strong>${task.task_type}</p>
            <p><strong>模板：</strong>${task.template_path || "-"}</p>

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
