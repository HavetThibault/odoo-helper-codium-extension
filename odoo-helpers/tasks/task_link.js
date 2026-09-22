class TaskLinkData {
    constructor(repository, prId) {
        this.repository = repository;
        this.prId = prId;
    }
}

class TaskLink {
    constructor(data) {
        this.data = data;
    }

    getName() {
        return `${this.data.repository}#${this.data.prId}`;
    }

    getGithubUrl() {
        return `https://github.com/odoo/${this.data.repository}/pull/${this.data.prId}`;
    }
}

module.exports = { TaskLink, TaskLinkData }