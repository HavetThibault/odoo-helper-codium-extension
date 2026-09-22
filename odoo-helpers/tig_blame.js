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

		const workspaceFolderRes = getWorkspaceFolder();
		if (workspaceFolderRes['errorResult']){
			vscode.window.showWarningMessage(workspaceFolderRes['reason']);
			return;
		}
		const workspaceFolderPath = workspaceFolderRes['result'].uri.path;
		if (!startsWith(activeTextEditorFilePath, workspaceFolderPath)) {
			vscode.window.showWarningMessage('The focused editor is related to a new file, or to a file that doesn\'t belong to the project!');
			return;
		}
		const fileRelativePath = activeTextEditorFilePath.substring(workspaceFolderPath.length + 1);
		const activeTerminal = await terminalsManager.getAvailableTerminal();
		activeTerminal.show();
		activeTerminal.sendText('o tblame ' + fileRelativePath);
	}
}

module.exports = { runTigBlame };
