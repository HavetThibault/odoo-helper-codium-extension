const { Task } = require('./task')
const path = require('path');
const fs = require('fs');

const vscode = require('vscode');
const { getWorkspaceFolder } = require('../common');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const tasksNoteDirectory = '/home/odoo/Documents/tasks';


function loadTasksManager(vsContext, terminalsManager) {
    const loadedTasks = vsContext.globalState.get('tasks', {});
    return new TasksManager(loadedTasks, vsContext);
}


class TasksManager {
    constructor(tasks, vsContext, terminalsManager) {
        this.tasks = tasks;
        this.vsContext = vsContext;
        this.terminalsManager = terminalsManager;
        // When calling newTask, make sure that 'this' is passed (as the function is async)
        this.newTask = this.newTask.bind(this);
        this.switchTask = this.switchTask.bind(this);
    }

    getTasksNotesDirectories() {
        const tasksDirectories = [];
        for (let taskName in this.tasks) {
            tasksDirectories.push(this.getTaskNoteDirectory(taskName))
        }
        return tasksDirectories;
    }

    getTaskNoteDirectory(taskName) {
        return path.join(tasksNoteDirectory, taskName);
    }

    async newTask() {
        const workspaceFolder = getWorkspaceFolder();
        if (workspaceFolder['errorResult']) {
            vscode.window.showWarningMessage(workspaceFolder['reason']);
            return;
        }
        const workspaceF = workspaceFolder['result']
        let branch;
        try {
            const { stdout } = await execFileAsync('get_ws_branch', [], {
                cwd: workspaceF.uri.fsPath,
            });
            branch = stdout.trim();
        } catch (error) {
            vscode.window.showWarningMessage(`Unable to read git branch: ${error.message}`);
            return
        }
        for (let task in this.tasks) {
            if (this.tasks[task].branch == branch) {
                vscode.window.showWarningMessage(`A task linked to the branch '${branch}' already exists!`);
                return;
            }
        }
        const taskName = await vscode.window.showInputBox({title: 'Create a New Task', value: branch});
        if (taskName === undefined){
            return;
        }
        if (this.tasks[taskName] !== undefined) {
            vscode.window.showWarningMessage('A task with that name already exists!');
            return;
        }
        this.tasks[taskName] = new Task(taskName, 'ongoing', branch, workspaceF.uri.fsPath);
        await execFileAsync('mkdir', [taskName], {
            cwd: tasksNoteDirectory,
        });
        this.vsContext.globalState.update('tasks', this.tasks);
    }

    async switchTask() {
        const branchesChoices = [];
        for (let taskName in this.tasks) {
            branchesChoices.push({
                label: taskName,
                detail: this.tasks[taskName].branch,
                task: this.tasks[taskName],
            })
        }
        if (branchesChoices.length === 0) {
            vscode.window.showWarningMessage('No tasks to be found!');
            return;
        }
        const taskChoice = await vscode.window.showQuickPick(branchesChoices, {
            title: 'Task switching',
            placeHolder: 'Switch to task...',
            matchOnDetail: true,
        });
        if (taskChoice === undefined) {
            return
        }
        const selectedTask = taskChoice.task;
        const workspaceFolderRes = getWorkspaceFolder();
        if (workspaceFolderRes['errorResult']) {
            vscode.window.showWarningMessage(workspaceFolderRes['reason']);
            return;
        }
        const workspaceFolder = workspaceFolderRes['result']
        if (workspaceFolder.uri.fsPath != selectedTask.directory) {
            this.vsContext.globalState.update('switchToBranch', selectedTask.branch);
            await execFileAsync('touch', ['.run_odoo_helper_early'], {
                cwd: selectedTask.directory,
            });
            vscode.commands.executeCommand(
                'vscode.openFolder',
                vscode.Uri.file(selectedTask.directory),
                { forceNewWindow: false }, // true => new window, current one stays put
            );
            return
        }
        try {
            await execFileAsync('ggswa', [selectedTask.branch], {
                cwd: selectedTask.directory,
            });
            const activeTerminal = await this.terminalsManager.getAvailableTerminal();
            activeTerminal.show();
            activeTerminal.sendText('gsa', true);
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
        const dirElements = await fs.promises.readdir(workspaceFolderPath, { withFileTypes: true });
        if (dirElements.filter((elem) => elem.name == '.run_odoo_helper_early').length == 1) {
            const targetBranch = this.vsContext.globalState.get('switchToBranch', undefined);
            if (targetBranch !== undefined) {
                // Assert the branch exists in the dir
                const cmdRes = await execFileAsync('list_ws_custom_branches', [], {
                    cwd: workspaceFolderPath,
                });
                const customBranches = cmdRes.stdout.split('\n');
                if (customBranches.find((branch) => branch == targetBranch) !== undefined ) {
                    try {
                        await execFileAsync('ggswa', [targetBranch], {cwd: workspaceFolderPath});
                        vscode.window.showInformationMessage(`Successfuly switched to branch ${targetBranch}`)
                    } catch (error) {
                        vscode.window.showWarningMessage(`Unable to switch branch ${targetBranch}: ${error.message}`);
                        return;
                    }
                }
            }
            fs.promises.rm(path.join(workspaceFolderPath, '.run_odoo_helper_early'));
        }
        delete this.vsContext.globalState.switchToBranch;
    }
}

module.exports = { TasksManager, loadTasksManager };
