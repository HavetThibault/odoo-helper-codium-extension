const vscode = require('vscode');
const { getActivePythonTextEditor, startsWith } = require('./common');


function runPythonClassTest(terminalsManager) {
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
			if (startsWith(lineText, 'class ')) {
				const testClassAndCo = lineText.substring(6);
				if (startsWith(testClassAndCo, 'Test') && lineText.includes('(')) {
					const testClassName = testClassAndCo.split('(', 1);
					const availableTerminal = await terminalsManager.getAvailableTerminal();
					availableTerminal.show()
					availableTerminal.sendText('o -t :' + testClassName, true);
					// TODO: add settings to decide whether to show the terminal
					return;
				} else {
					vscode.window.showWarningMessage('The cursor is not in the body of a test class !');
					return;
				}	
			}
			line--;
		}
	}
}

module.exports = { runPythonClassTest };