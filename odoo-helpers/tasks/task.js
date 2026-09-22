class TaskData {
    constructor(name, state, branch, directory, taskLinks=undefined) {
        this.name = name;
        this.state = state;
        this.branch = branch;
        this.directory = directory;
        this.taskLinks = !taskLinks ? [] : taskLinks;
    }
}

class Task {
    constructor(data) {
        this.data = data;
    }

    getRunbotUrl() {
        return `https://runbot.odoo.com/runbot/bundle/${this.data.branch}`;
    }
}


module.exports = { Task, TaskData }
