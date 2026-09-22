
// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');

const { runPythonUnitTest } = require('./odoo-helpers/python_unit_test');
const { runTigBlame } = require('./odoo-helpers/tig_blame');
const { runMoveToSetup } = require('./odoo-helpers/mv_var_to_setup');
const { replaceDateUnderCursorCmd } = require('./odoo-helpers/replace_date_under_cursor');
const { selectExpandCmd } = require('./odoo-helpers/select_expand');
const { TaskTreeDataProvider } = require('./odoo-helpers/tasks/tree_data_provider');
const { loadTasksManager } = require('./odoo-helpers/tasks/tasks_manager');
const { TasksTreeView } = require('./odoo-helpers/tasks/tree_view');
const { TerminalsManager } = require('./odoo-helpers/terminal_manager')


function addCmd(context, name, callback) {
	context.subscriptions.push(
		vscode.commands.registerCommand(`odoo-helpers.${name}`, callback));
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const terminalsManager = new TerminalsManager();
	addCmd(context, 'run-python-unit-test', runPythonUnitTest(terminalsManager));
	addCmd(context, 'run-tig-blame', runTigBlame(terminalsManager));

	addCmd(context, 'python-move-var-to-setup', runMoveToSetup);
	addCmd(context, 'python-replace-date', replaceDateUnderCursorCmd);
	addCmd(context, 'python-select-expand', selectExpandCmd);

	const tasksManager = loadTasksManager(context);
	addCmd(context, 'new-task', tasksManager.newTask);
	addCmd(context, 'switch-task', tasksManager.switchTask);

    const provider = new TaskTreeDataProvider(tasksManager);
    const taskTreeView = new TasksTreeView(provider, 'odoo-helpers.folders', tasksManager)
    context.subscriptions.push(taskTreeView.treeView);
    addCmd(context, 'folders.refresh', () => provider.refresh());
    addCmd(context, 'folders.rename', taskTreeView.rename);
    addCmd(context, 'folders.delete', taskTreeView.delete);
    addCmd(context, 'folders.newFile', (node) => taskTreeView.createElement(node, false));
    addCmd(context, 'folders.newFolder', (node) => taskTreeView.createElement(node, true));

	context.subscriptions.push(
        vscode.window.onDidStartTerminalShellExecution(terminalsManager.onTerminalStartCmd),
        vscode.window.onDidEndTerminalShellExecution(terminalsManager.onTerminalEndCmd)
    );

	tasksManager.switchBranchIfNecessary();
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
