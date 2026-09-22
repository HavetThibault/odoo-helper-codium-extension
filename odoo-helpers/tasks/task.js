class Task {
    constructor(name, state, branch, directory) {
        this.name = name;
        this.state = state;
        this.branch = branch;
        this.directory = directory;
    }
}

module.exports = { Task }
