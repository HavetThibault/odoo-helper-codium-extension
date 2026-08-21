
// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
const common = require('./common');
const pythonParser = require('./python_parser');

const startsWith = common.startsWith;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const disposable1 = vscode.commands.registerCommand('odoo-helpers.run-python-unit-test', runPythonUnitTest);
	const disposable2 = vscode.commands.registerCommand('odoo-helpers.run-tig-blame', runTigBlame);
	const disposable3 = vscode.commands.registerCommand('odoo-helpers.python-move-var-to-setup', runMoveToSetup);
	context.subscriptions.push(disposable1, disposable2, disposable3);
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
		if (startsWith(lineText.trimStart(), 'def ')) {
			if (startsWith(lineText.substring(8), 'test_')) {
				const test_method_name = lineText.substring(8).split('(', 1)
				const activeTerminal = common.getActiveOrCreateTerminal();
				activeTerminal.sendText('o -t .' + test_method_name);
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

function runTigBlame() {
	let activeTextEditor = common.getActiveTextEditor();
	if (activeTextEditor['errorResult']) {
		vscode.window.showWarningMessage(activeTextEditor['reason']);
		return;
	}
	const activeTextEditorFilePath = activeTextEditor['result'].uri.path;

	let workspaceFolder = common.getWorkspaceFolder();
	if (workspaceFolder['errorResult']){
		vscode.window.showWarningMessage(workspaceFolder['reason']);
		return;
	}
	const workspaceFolderPath = workspaceFolder['result'].uri.path;
	if (!startsWith(activeTextEditorFilePath, workspaceFolderPath)) {
		vscode.window.showWarningMessage('The focused editor is related to a new file, or to a file that doesn\'t belong to the project!');
		return;
	}
	const fileRelativePath = activeTextEditorFilePath.path.substring(workspaceFolderPath.length + 1);
	const activeTerminal = common.getActiveOrCreateTerminal();
	activeTerminal.sendText('o tblame ' + fileRelativePath);
	activeTerminal.show();
}

async function runMoveToSetup() {
	const nActiveTextEditor = common.getActivePythonTextEditor();
	if (nActiveTextEditor['errorResult']) {
		vscode.window.showWarningMessage(nActiveTextEditor['reason']);
		return;
	}
	const activeTextEditor = nActiveTextEditor.result;
	const text = activeTextEditor.document.getText();

	// Find the start and end positions of the setUpClass(cls) function
	const setUpClassRegex = /def setUpClass\(cls\):(?:\s|.)*?(?=\n    def |\nclass |\n$)/g;
	const setupClassMatch = setUpClassRegex.exec(text);

	if (!setupClassMatch) {
		vscode.window.showInformationMessage('No setUpClass(cls) function found!');
		return;
	}

	try {
		let assignmentStartEnd = pythonParser.getAssignmentStartEnd(activeTextEditor);
		const firstAssignmentLineIndent = pythonParser.getIndent(activeTextEditor.document.lineAt(assignmentStartEnd.startLine.line).text);
		activeTextEditor.selection = new vscode.Selection(assignmentStartEnd.startLine, assignmentStartEnd.endLine);
		const userInputName = await vscode.window.showInputBox();

		const setUpClassText = setupClassMatch[0];
		const setUpClassStartIndex = setupClassMatch.index;
		const setUpClassEndIndex = setUpClassStartIndex + setUpClassText.length;

		const firstSetupInstruction = setUpClassText.split('\n')[1]
		const setupIndent = pythonParser.getIndent(firstSetupInstruction)

		const lastLineStart = activeTextEditor.document.positionAt(setUpClassEndIndex - 1);
		const lastLine = activeTextEditor.document.lineAt(lastLineStart.line);

		const assignmentValue = activeTextEditor.document.getText(activeTextEditor.selection);
		activeTextEditor.edit((editBuilder) => {
			// Edit-Remove assignment lines
			const selection_start = activeTextEditor.selection.start;
			editBuilder.delete(activeTextEditor.selection);
			editBuilder.insert(selection_start, `self.${userInputName}`)

			// Insert the text in the setupClass
            let insertPosition = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
			const assignmentLines = assignmentValue.split('\n');
			let assignmentNewLine = `\n${' '.repeat(setupIndent)}cls.${userInputName} = ${assignmentLines[0]}`
			let assignmentEntireText = assignmentNewLine;
			for (let i = 1; i < assignmentLines.length; i++) {
				let assignmentLineIndent = pythonParser.getIndent(assignmentLines[i]);
				let lineRelativIndent = assignmentLineIndent - firstAssignmentLineIndent;
				let newIndent = setupIndent + lineRelativIndent;
				let indentDiff = assignmentLineIndent - newIndent;
				if (indentDiff < 0) {
					assignmentNewLine = `\n${' '.repeat(-indentDiff)}${assignmentLines[i]}`;
				} else if (indentDiff > 0) {
					assignmentNewLine = `\n${assignmentLines[i].slice(indentDiff)}`;
				} else {
					assignmentNewLine = `\n${assignmentLines[i]}`;
				}
				assignmentEntireText += assignmentNewLine
			}
			editBuilder.insert(insertPosition, assignmentEntireText);
        });
	} catch (e) {
		vscode.window.showWarningMessage(e.message);
	}
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
