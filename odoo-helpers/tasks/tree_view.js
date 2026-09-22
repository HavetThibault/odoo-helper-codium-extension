const vscode = require('vscode');
const path = require('path');

class TasksTreeView {
    constructor(treeDataProvider, viewId, tasksManager) {
        this.treeView = vscode.window.createTreeView(viewId, {
            treeDataProvider: treeDataProvider,
            showCollapseAll: true,
        });
        this.dataProvider = treeDataProvider;
        this.tasksManager = tasksManager;

        this.rename = this.rename.bind(this);
        this.delete = this.delete.bind(this);
        this.resolveTargetDir = this.resolveTargetDir.bind(this);
        this.promptName = this.promptName.bind(this);
        this.createElement = this.createElement.bind(this);
    }

    async rename(node) {
        const target = node ?? this.treeView.selection[0];
        if (!target) return;
        const oldName = path.basename(target.uri.fsPath);
        const name = await vscode.window.showInputBox({
            value: oldName,
            valueSelection: [0, path.parse(oldName).name.length],
            validateInput: v => (!v || v.includes('/') ? 'Invalid name' : undefined),
        });
        if (!name || name === oldName) return;
        const dest = vscode.Uri.joinPath(vscode.Uri.file(path.dirname(target.uri.fsPath)), name);
        await vscode.workspace.fs.rename(target.uri, dest, { overwrite: false });
        this.dataProvider.refresh();
    }

    async delete(node) {
        const targets = this.treeView.selection.length ? this.treeView.selection : [node];
        const answer = await vscode.window.showWarningMessage(
            `Delete ${targets.length === 1 ? path.basename(targets[0].uri.fsPath) : targets.length + ' items'}?`,
            { modal: true }, 'Move to Trash');
        if (answer !== 'Move to Trash') return;
        for (const target of targets) {
            await vscode.workspace.fs.delete(target.uri, { recursive: true, useTrash: true });
        }
        this.dataProvider.refresh();
    }

    /**
     * Resolve the directory a new entry should be created in:
     * selected folder → parent of selected file → single root → ask the user.
     */
    async resolveTargetDir(node) {
        const target = node ?? this.treeView.selection[0];
        if (target) {
            return target.isDir ? target.uri.fsPath : path.dirname(target.uri.fsPath);
        }
        const tasksDirectories = this.tasksManager.getTasksNotesDirectories()
        if (tasksDirectories.length === 1) {
            return tasksDirectories[0];
        }
        const picked = await vscode.window.showQuickPick(tasksDirectories, { placeHolder: 'Select a folder' });
        return picked;
    }

    async promptName(dir, isFolder) {
        return vscode.window.showInputBox({
            prompt: `Create ${isFolder ? 'folder' : 'file'} in ${dir}`,
            placeHolder: isFolder ? 'folder name' : 'file name',
            validateInput: (value) => {
                const name = value.trim();
                if (!name) {
                    return 'Name cannot be empty';
                }
                if (name === '.' || name === '..' || path.isAbsolute(name)) {
                    return 'Invalid name';
                }
                // keep the new entry inside `dir`
                const resolved = path.resolve(dir, name);
                if (path.relative(dir, resolved).startsWith('..')) {
                    return 'Name must stay inside the target folder';
                }
                return undefined;
            },
        });
    }

    async createElement(node, isFolder) {
        const dir = await this.resolveTargetDir(node);
        if (!dir) {
            return;
        }
        const name = await this.promptName(dir, isFolder);
        if (!name) {
            return;
        }
        const uri = vscode.Uri.file(path.resolve(dir, name.trim()));
        try {
            await vscode.workspace.fs.stat(uri);
            vscode.window.showErrorMessage(`${name} already exists.`);
            return;
        } catch {
            // does not exist -> good
        }
        try {
            if (isFolder) {
                await vscode.workspace.fs.createDirectory(uri);
            } else {
                // createDirectory on the parent handles intermediate dirs like "a/b/c.py"
                await vscode.workspace.fs.createDirectory(
                    vscode.Uri.file(path.dirname(uri.fsPath)));
                await vscode.workspace.fs.writeFile(uri, new Uint8Array());
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Could not create ${name}: ${error.message}`);
            return;
        }
        this.dataProvider.refresh();
        if (!isFolder) {
            await vscode.window.showTextDocument(uri);
        }
        try {
            await this.treeView.reveal({ uri, isDir: isFolder }, { select: true, focus: !isFolder });
        } catch {
            // reveal needs getParent(); ignore if unavailable
        }
    }
}

module.exports = { TasksTreeView }
