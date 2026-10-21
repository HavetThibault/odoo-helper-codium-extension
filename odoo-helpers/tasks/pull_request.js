class PullRequestData {
    constructor(repository, id, title, body, state, createdAt) {
        this.repository = repository;
        this.id = id;
        this.title = title;
        this.body = body;
        this.state = state;
        this.createdAt = createdAt;
    }
}

class PullRequest {
    constructor(data) {
        this.data = data;
    }

    getName() {
        return `${this.data.repository.toUpperCase()}#${this.data.id}`;
    }

    getMarkdownLink() {
        return `[${this.data.repository}#${this.data.id}](odoo/${this.data.repository}#${this.data.id})`;
    }

    getGithubUrl() {
        return `https://github.com/odoo/${this.data.repository}/pull/${this.data.id}`;
    }
}

module.exports = { PullRequest, PullRequestData }