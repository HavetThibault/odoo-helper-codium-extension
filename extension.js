
const vscode = require('vscode');

const { SecretStorageForSecretSettings } = require('./odoo-helpers/github_token');
const { runPythonUnitTest } = require('./odoo-helpers/python_unit_test');
const { runPythonClassTest } = require('./odoo-helpers/python_class_test');
const { runTigBlame } = require('./odoo-helpers/tig_blame');
const { runMoveToSetup } = require('./odoo-helpers/mv_var_to_setup');
const { replaceDateUnderCursorCmd } = require('./odoo-helpers/replace_date_under_cursor');
const { selectExpandCmd } = require('./odoo-helpers/select_expand');
const { TaskTreeDataProvider } = require('./odoo-helpers/tasks/tree_data_provider');
const { loadTasksManager } = require('./odoo-helpers/tasks/tasks_manager');
const { FileTreeView } = require('./odoo-helpers/tasks/tree_view');
const { LinksTreeDataProvider } = require('./odoo-helpers/tasks/links_tree_data_provider');
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
	addCmd(context, 'run-python-class-test', runPythonClassTest(terminalsManager));
	addCmd(context, 'run-tig-blame', runTigBlame(terminalsManager));

	addCmd(context, 'python-move-var-to-setup', runMoveToSetup);
	addCmd(context, 'python-replace-date', replaceDateUnderCursorCmd);
	addCmd(context, 'python-select-expand', selectExpandCmd);

	const secretStorage = new SecretStorageForSecretSettings(context);
	addCmd(context, 'setGithubToken', secretStorage.setGithubToken);
	addCmd(context, 'clearGithubToken', secretStorage.clearGithubToken);

	const tasksManager = loadTasksManager(context, terminalsManager, secretStorage);
	addCmd(context, 'new-task', tasksManager.newTask);
	addCmd(context, 'switch-task', tasksManager.switchTask);

    const provider = new TaskTreeDataProvider(tasksManager);
	tasksManager.onTaskCreatedSubscribers.push(provider.refresh.bind(provider));

    const taskTreeView = new FileTreeView(provider, 'odoo-helpers.folders', tasksManager)
    context.subscriptions.push(taskTreeView.treeView);
    addCmd(context, 'folders.rename', taskTreeView.rename);
    addCmd(context, 'folders.delete', taskTreeView.delete);
    addCmd(context, 'folders.refresh', provider.refresh);
    addCmd(context, 'folders.newFile', (node) => taskTreeView.createElement(node, false));
    addCmd(context, 'folders.newFolder', (node) => taskTreeView.createElement(node, true));
    addCmd(context, 'open-link', (link) => vscode.env.openExternal(vscode.Uri.parse(link)));
	
	const linksDataProvider = new LinksTreeDataProvider(tasksManager);
	context.subscriptions.push(vscode.window.createTreeView('odoo-helpers.active-task-links', {
		treeDataProvider: linksDataProvider,
	}));

	addCmd(context, 'active-task-links.updateLinks', tasksManager.updatePullRequests);
	const linksRefresh = linksDataProvider.refresh.bind(linksDataProvider);
	tasksManager.onTaskCreatedSubscribers.push(linksRefresh);
	tasksManager.onActivePullRequestUpdatedSubscribers.push(linksRefresh);

	context.subscriptions.push(
        vscode.window.onDidStartTerminalShellExecution(terminalsManager.onTerminalStartCmd),
        vscode.window.onDidEndTerminalShellExecution(terminalsManager.onTerminalEndCmd)
    );

	tasksManager.switchBranchIfNecessary();
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
