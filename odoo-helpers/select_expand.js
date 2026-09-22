const vscode = require('vscode');
const pythonParser = require('./python_parser');
const { getActivePythonTextEditor } = require('./common');


function selectExpandCmd() {
	const nActiveTextEditor = getActivePythonTextEditor();
	if (nActiveTextEditor['errorResult']) {
		vscode.window.showWarningMessage(nActiveTextEditor['reason']);
		return;
	}

	const activeTextEditor = nActiveTextEditor.result;
	const cursorPosition = activeTextEditor.selection.active;
	if (cursorPosition.line != activeTextEditor.selection.end.line) {
		vscode.window.showWarningMessage('The selection is expanding on multiple line!');
		return;
	}
	const elemStartEnd = pythonParser.getElemStartEnd(activeTextEditor.document.lineAt(cursorPosition.line).text, activeTextEditor.selection);
	if (elemStartEnd === undefined) {
		vscode.window.showWarningMessage('The cursor isn\'t under any accepted element!');
		return;
	}
	const selectStart = activeTextEditor.selection.active;
	const elemStart =  new vscode.Position(selectStart.line, elemStartEnd.start + 1);
	const elemEnd =  new vscode.Position(selectStart.line, elemStartEnd.end);
	activeTextEditor.selection = new vscode.Selection(elemStart, elemEnd);
}

module.exports = { selectExpandCmd };
