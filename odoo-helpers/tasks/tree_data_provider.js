const vscode = require('vscode')
const fs = require('fs')
const path = require('path')

class TaskTreeDataProvider {
    constructor(taskManager) {
        this.taskManager = taskManager;                       // array of absolute folder paths
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.getChilden = this.getChildren.bind(this);
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        const item = new vscode.TreeItem(
            element.uri,
            element.isDir
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
        );
        if (element.label) {
            item.label = element.label;
        }
        if (!element.isDir) {
            item.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [element.uri],
            };
        }
        item.contextValue = element.isDir ? 'folder' : 'file';
        return item;
    }

    async getChildren(element) {
        if (!element) {
            const children = [];
            for (let taskName in this.taskManager.tasks) {
                const task = this.taskManager.tasks[taskName];
                const taskNoteDir = this.taskManager.getTaskNoteDirectory(taskName);
                if (fs.existsSync(taskNoteDir)) {
                    children.push({ uri: vscode.Uri.file(taskNoteDir), isDir: true, label: task.name })
                }
            }
            return children;
        }
        const dirElements = await fs.promises.readdir(element.uri.fsPath, { withFileTypes: true });
        return dirElements
            .map(e => ({
                uri: vscode.Uri.file(path.join(element.uri.fsPath, e.name)),
                isDir: e.isDirectory(),
            }))
            .sort((a, b) => (b.isDir - a.isDir) || a.uri.fsPath.localeCompare(b.uri.fsPath));
    }
}

module.exports = { TaskTreeDataProvider }
