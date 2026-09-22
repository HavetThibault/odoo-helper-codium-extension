const vscode = require('vscode');
const { getActivePythonTextEditor, startsWith } = require('./common');


function runPythonUnitTest(terminalsManager) {
	return async function() {
		let activeTextEditor = getActivePythonTextEditor();
		if (activeTextEditor['errorResult']) {
			vscode.window.showWarningMessage(activeTextEditor['reason']);
			return;
		}
		activeTextEditor = activeTextEditor['result'];
		const selectionPosition = activeTextEditor.selection.start;
		let line = selectionPosition.line;
		while (line >= 0) {
			const lineText = activeTextEditor.document.lineAt(line).text;
			if (startsWith(lineText.trimStart(), 'def ')) {
				if (startsWith(lineText.substring(8), 'test_')) {
					const test_method_name = lineText.substring(8).split('(', 1);
					const activeTerminal = await terminalsManager.getAvailableTerminal();
					activeTerminal.sendText('o -t .' + test_method_name, true);
					// TODO: add settings to decide whether to show the terminal
					return;
				} else {
					vscode.window.showWarningMessage('The cursor is not in the body of a test !');
					return;
				}	
			}
			line--;
		}
	}
}

module.exports = { runPythonUnitTest };