class TaskData {
    constructor(name, state, branch, directory, prs=undefined) {
        this.name = name;
        this.state = state;
        this.branch = branch;
        this.directory = directory;
        this.prs = !prs ? [] : prs;
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
