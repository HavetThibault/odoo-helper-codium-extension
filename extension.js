
// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
const common = require('./common');

const startsWith = common.startsWith;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const disposable1 = vscode.commands.registerCommand('odoo-helpers.run-python-unit-test', runPythonUnitTest);
	const disposable2 = vscode.commands.registerCommand('odoo-helpers.run-tig-blame', runTigBlame);
	context.subscriptions.push(disposable1, disposable2);
}

function runPythonUnitTest() {
	let activeTextEditor = common.getActivePythonTextEditor();
	if (activeTextEditor['errorResult']) {
		vscode.window.showWarningMessage(activeTextEditor['reason']);
		return;
	}
	activeTextEditor = activeTextEditor['result'];
	const selectionPosition = activeTextEditor.selection.start;
	let line = selectionPosition.line;
	while (line >= 0) {
		const lineText = activeTextEditor.document.lineAt(line).text;
		if (startsWith(lineText, '    def ')) {
			if (startsWith(lineText.substring(8), 'test_')) {
				const test_method_name = lineText.substring(8).split('(', 1)
				const activeTerminal = common.getActiveOrCreateTerminal();
				activeTerminal.sendText('o -t .' + test_method_name);
				activeTerminal.show();
				return;
			} else {
				vscode.window.showWarningMessage('The cursor is not in the body of a test !');
				return;
			}
		}
		line--;
	}
}

function runTigBlame() {
	let activeTextEditor = common.getActiveTextEditor();
	if (activeTextEditor['errorResult']) {
		vscode.window.showWarningMessage(activeTextEditor['reason']);
		return;
	}
	activeTextEditor = activeTextEditor['result'];

	let workspaceFolder = common.getWorkspaceFolder();
	if (workspaceFolder['errorResult']){
		vscode.window.showWarningMessage(workspaceFolder['reason']);
		return;
	}
	workspaceFolder = workspaceFolder['result']
	if (!startsWith(activeTextEditor.document.uri.path, workspaceFolder.uri.path)) {
		vscode.window.showWarningMessage('The focused editor is related to a new file, or to a file that doesn\'t belong to the project!');
		return;
	}
	const fileRelativePath = activeTextEditor.document.uri.path.substring(workspaceFolder.uri.path.length + 1);
	const activeTerminal = common.getActiveOrCreateTerminal();
	activeTerminal.sendText('o tblame ' + fileRelativePath);
	activeTerminal.show();
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
