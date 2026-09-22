const vscode = require('vscode');
const pythonParser = require('./python_parser');
const { getActivePythonTextEditor } = require('./common');


async function runMoveToSetup() {
	const nActiveTextEditor = getActivePythonTextEditor();
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

module.exports = { runMoveToSetup };
