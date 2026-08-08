// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "odoo-helpers" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('odoo-helpers.helloWorld', function () {
		let activeTerminal = vscode.window.activeTerminal;
		if (!activeTerminal) {
			activeTerminal = vscode.window.createTerminal();
		}
		let activeTextEditor = vscode.window.activeTextEditor
		if (!activeTextEditor || activeTextEditor.document.fileName.substring(activeTextEditor.document.fileName.length - 3) != '.py') {
			vscode.window.showInformationMessage('Please set the cursor in a python file.');
			return
		}
		let selectionPosition = activeTextEditor.selection.start;
		let line = selectionPosition.line;
		while (line >= 0) {
			const lineText = activeTextEditor.document.lineAt(line).text;
			if (lineText.substring(0, 13) == '    def test_'){
				const test_method_name = lineText.substring(8).split('(', 1)
				activeTerminal.show();
				activeTerminal.sendText('o -t .' + test_method_name, false);
				return
			}
			line--;
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
