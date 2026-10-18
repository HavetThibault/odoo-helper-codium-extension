
const { Task, TaskData } = require('./task')
const { PullRequestData } = require('./pull_request');
const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const { getWorkspaceFolder } = require('../common');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const tasksNoteDirectory = '/home/odoo/Documents/tasks';


function loadTasksManager(vsContext, terminalsManager, secretStorage) {
    // vsContext.globalState.update('tasks', []);
    const loadedTasks = vsContext.globalState.get('tasks', []);
    const tasks = [];
    for (let taskName in loadedTasks) {
        const oldTask = loadedTasks[taskName];
        const taskData = new TaskData(oldTask.name, oldTask.state, oldTask.branch, oldTask.directory, oldTask.prs);
        tasks.push(new Task(taskData));
    }
    return new TasksManager(tasks, vsContext, terminalsManager, secretStorage);
}


class TasksManager {
    constructor(tasks, vsContext, terminalsManager, secretStorage) {
        this.tasks = tasks;
        this.vsContext = vsContext;
        this.terminalsManager = terminalsManager;
        this.secretStorage = secretStorage;
        // When calling newTask, make sure that 'this' is passed (as the function is async)
        this.getCurrentTask = this.getCurrentTask.bind(this);
        this.newTask = this.newTask.bind(this);
        this.switchTask = this.switchTask.bind(this);
        this.createBranchChoices = this.createBranchChoices.bind(this);
        this.switchBranchIfNecessary = this.switchBranchIfNecessary.bind(this);
        this.updatePullRequests = this.updatePullRequests.bind(this);
        this.onActivePullRequestUpdatedSubscribers = [];
        this.onTaskCreatedSubscribers = [];
    }

    getTasksNotesDirectories() {
        return this.tasks.map((task) => this.getTaskNoteDirectory(task.data.name));
    }

    getTaskNoteDirectory(taskName) {
        return path.join(tasksNoteDirectory, taskName);
    }

    async getCurrentTask() {
        const workspaceFolderRes = getWorkspaceFolder();
        if (workspaceFolderRes['errorResult']) {
            vscode.window.showWarningMessage(workspaceFolderRes['reason']);
            return undefined;
        }
        const workspaceFolder = workspaceFolderRes['result'];
        let wsBranch;
        try {
            const { stdout } = await execFileAsync('get_ws_branch', [], {
                cwd: workspaceFolder.uri.fsPath,
            });
            wsBranch = stdout.trim();
        } catch (error) {
            vscode.window.showWarningMessage(`Unable to read git branch: ${error.message}`);
            return undefined;
        }
        const matchingTask = this.tasks.filter((task) => task.data.branch === wsBranch);
        if (matchingTask.length === 1) {
            return matchingTask[0];
        }
        return undefined;
    }

    async newTask() {
        const workspaceFolderRes = getWorkspaceFolder();
        if (workspaceFolderRes['errorResult']) {
            vscode.window.showWarningMessage(workspaceFolderRes['reason']);
            return;
        }
        const workspaceFolder = workspaceFolderRes['result'];
        let wsBranch;
        try {
            const { stdout } = await execFileAsync('get_ws_branch', [], {
                cwd: workspaceFolder.uri.fsPath,
            });
            wsBranch = stdout.trim();
        } catch (error) {
            vscode.window.showWarningMessage(`Unable to read git branch: ${error.message}`);
            return
        }
        let matchingTask = this.tasks.filter((task) => task.data.branch === wsBranch);
        if (matchingTask.length >= 1) {
            vscode.window.showWarningMessage(`A task linked to the branch '${wsBranch}' already exists!`);
            return;
        }
        const taskName = await vscode.window.showInputBox({title: 'Create a New Task', value: wsBranch});
        if (taskName === undefined){
            return;
        }
        matchingTask = this.tasks.filter((task) => task.data.name === taskName);
        if (matchingTask.length >= 1) {
            vscode.window.showWarningMessage('A task with that name already exists!');
            return;
        }
        const taskData = new TaskData(taskName, 'ongoing', wsBranch, workspaceFolder.uri.fsPath);
        this.tasks.push(new Task(taskData));
        const folderPath = path.join(tasksNoteDirectory, taskName);
        try {
            await fs.promises.readdir(folderPath);
        } catch {
            // The folder doesn't exist
            await fs.promises.mkdir(folderPath);
        }
        this.saveTasks();
        this.onTaskCreated();
    }

    saveTasks() {
        this.vsContext.globalState.update('tasks', this.tasks.map((task) => task.data));
    }

    onTaskCreated() {
        this.onTaskCreatedSubscribers.forEach(subscriber => subscriber());
    }

    async createBranchChoices() {
        const currentTaskName = (await this.getCurrentTask())?.data.name;
        const branchesChoices = this.tasks.map(task => {
            const label = currentTaskName && currentTaskName == task.data.name ? `>>> ${task.data.name}` : task.data.name;
            return {label: label, detail: task.data.branch, task: task};
        });
        if (branchesChoices.length === 0) {
            vscode.window.showWarningMessage('No tasks to be found!');
            return undefined;
        }
        return branchesChoices;
    }

    async switchTask() {
        const branchesChoices = await this.createBranchChoices();
        if (!branchesChoices) {
            return;
        }
        const taskChoice = await vscode.window.showQuickPick(branchesChoices, {
            title: 'Task switching',
            placeHolder: 'Search for task...',
            matchOnDetail: true,
        });
        if (!taskChoice) {
            return
        }
        const selectedTask = taskChoice.task;
        const workspaceFolderRes = getWorkspaceFolder(true);
        if (workspaceFolderRes['errorResult']) {
            vscode.window.showWarningMessage(workspaceFolderRes['reason']);
            return;
        }
        // Switch directory and branch
        const workspaceFolder = workspaceFolderRes['result'];
        if (workspaceFolder === undefined || workspaceFolder.uri.fsPath != selectedTask.data.directory) {
            this.vsContext.globalState.update('switchToBranch', selectedTask.data.branch);
            vscode.commands.executeCommand(
                'vscode.openFolder',
                vscode.Uri.file(selectedTask.data.directory),
                { forceNewWindow: false }, // true => new window, current one stays put
            );
            return;
        }
        try {
            const availableTerminal = await this.terminalsManager.getAvailableTerminal();
            availableTerminal.show();
            availableTerminal.sendText(`ggswa ${selectedTask.data.branch}`, true);
        } catch (error) {
            vscode.window.showWarningMessage(`Unable to switch branch: ${error.message}`);
            return;
        }
    }

    async switchBranchIfNecessary() {
        let workspaceFolderRes = getWorkspaceFolder();
        if (workspaceFolderRes['errorResult']) {
            vscode.window.showWarningMessage(workspaceFolderRes['reason']);
            return;
        }
        const workspaceFolderPath = workspaceFolderRes['result'].uri.path;
        const targetBranch = this.vsContext.globalState.get('switchToBranch', undefined);
        if (targetBranch !== undefined) {
            // Assert the branch exists in the dir
            const cmdRes = await execFileAsync('list_ws_custom_branches', [], {
                cwd: workspaceFolderPath,
            });
            const customBranches = cmdRes.stdout.split(',');
            // 'list_ws_custom_branches' doesn't display the activ branch (pretty handy here)
            if (customBranches.find((branch) => branch == targetBranch) !== undefined ) {
                try {
                    const availableTerminal = await this.terminalsManager.getAvailableTerminal();
                    availableTerminal.show();
                    availableTerminal.sendText(`ggswa ${targetBranch}`, true);
                } catch (error) {
                    vscode.window.showWarningMessage(`Unable to switch branch ${targetBranch}: ${error.message}`);
                    return;
                }
            }
        }
        delete this.vsContext.globalState.switchToBranch;
    }

    async updatePullRequests() {
        const currentTask = await this.getCurrentTask();
        if (currentTask === undefined) {
            return;
        }
        const owner = 'odoo'
        const repos = [
            ['odoo', 'odoo-dev'],
            ['enterprise', 'odoo-dev'],
            ['upgrade', 'odoo']];
        const token = await this.secretStorage.getGithubToken();
        if (!token) {
            vscode.window.showWarningMessage('Please set your github token!');
            return;
        }
        let prs = [];
        for (let i = 0; i < repos.length; i++) {
            const repo = repos[i][0];
            const pullOriginOwner = repos[i][1];
            // const url = `https://api.github.com/repos/odoo/${repos[i]}/pulls?head=thha-odoo:${currentTask.data.branch}`;
            const urlPrefix = `https://api.github.com/repos/${owner}/${repo}/pulls`;
            const url = urlPrefix + '?head=' + (pullOriginOwner != '' ? `${pullOriginOwner}:${currentTask.data.branch}` : currentTask.data.branch);
            // const url = urlPrefix + '?head=master-dataaaaaaaaaaaaaaaaaaaa'
            // const url = `https://api.github.com/repos/thha-odoo/18.0-tutorial-thha/pulls`;
            const res = await fetch(
                url,
                { headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10'
                }});
            const repoPrs = await res.json();
            if (repoPrs instanceof Array) {
                prs = prs.concat(repoPrs.map(pr => {
                    const createdAt = pr.created_at;
                    const title = pr.title;
                    const body = pr.body;
                    const state = pr.state;
                    const id = pr.number;
                    return new PullRequestData(repo, id, title, body, state, createdAt)
                }));
            }
        }
        currentTask.data.prs = prs;
        this.saveTasks();
        this.onActivePullRequestUpdated();
    }

    onActivePullRequestUpdated() {
        this.onActivePullRequestUpdatedSubscribers.forEach(subscriber => subscriber())
    }
}

module.exports = { TasksManager, loadTasksManager };
