const vscode = require('vscode');
const { getActiveTextEditor, getWorkspaceFolder, startsWith } = require('./common');


function runTigBlame(terminalsManager) {
	return async function () {
		let activeTextEditor = getActiveTextEditor();
		if (activeTextEditor['errorResult']) {
			vscode.window.showWarningMessage(activeTextEditor['reason']);
			return;
		}
		const activeTextEditorFilePath = activeTextEditor['result'].document.uri.path;

		let workspaceFolder = getWorkspaceFolder();
		if (workspaceFolder['errorResult']){
			vscode.window.showWarningMessage(workspaceFolder['reason']);
			return;
		}
		const workspaceFolderPath = workspaceFolder['result'].uri.path;
		if (!startsWith(activeTextEditorFilePath, workspaceFolderPath)) {
			vscode.window.showWarningMessage('The focused editor is related to a new file, or to a file that doesn\'t belong to the project!');
			return;
		}
		const fileRelativePath = activeTextEditorFilePath.substring(workspaceFolderPath.length + 1);
		const activeTerminal = await terminalsManager.getAvailableTerminal();
		activeTerminal.sendText('o tblame ' + fileRelativePath);
		activeTerminal.show();
	}
}

module.exports = { runTigBlame };
