
// The module 'vscode' contains the VS Code extensibility API
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const common = require('./common');
const pythonParser = require('./python_parser');
const execFileAsync = promisify(execFile);

const startsWith = common.startsWith;
let vsContext;
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const disposable1 = vscode.commands.registerCommand('odoo-helpers.run-python-unit-test', runPythonUnitTest);
	const disposable2 = vscode.commands.registerCommand('odoo-helpers.run-tig-blame', runTigBlame);
	const disposable3 = vscode.commands.registerCommand('odoo-helpers.python-move-var-to-setup', runMoveToSetup);
	const disposable4 = vscode.commands.registerCommand('odoo-helpers.python-replace-date', runReplaceDateUnderCursor);
	const disposable5 = vscode.commands.registerCommand('odoo-helpers.python-select-expand', runSelectExpand);
	const disposable6 = vscode.commands.registerCommand('odoo-helpers.new-task', newTask);
	const disposable7 = vscode.commands.registerCommand('odoo-helpers.switch-task', switchTask);
	context.subscriptions.push(disposable1, disposable2, disposable3, disposable4, disposable5, disposable6, disposable7);
	vsContext = context;
	// vsContext.globalState.update('tasks', {});
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
				const test_method_name = lineText.substring(8).split('(', 1);
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
	const activeTextEditorFilePath = activeTextEditor['result'].document.uri.path;

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
	const fileRelativePath = activeTextEditorFilePath.substring(workspaceFolderPath.length + 1);
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

function runReplaceDateUnderCursor() {
	const nActiveTextEditor = common.getActivePythonTextEditor();
	if (nActiveTextEditor['errorResult']) {
		vscode.window.showWarningMessage(nActiveTextEditor['reason']);
		return;
	}

	const activeTextEditor = nActiveTextEditor.result;
	const cursorPosition = activeTextEditor.selection.active;
	const lineText = activeTextEditor.document.lineAt(cursorPosition.line).text;
	const cursorChar = cursorPosition.character;

	let quoteStart = -1;
	let quoteChar = '';
	for (let i = cursorChar; i >= 0; i--) {
		if (lineText[i] === '\'' || lineText[i] === '"') {
			quoteStart = i;
			quoteChar = lineText[i];
			break;
		}
	}

	if (quoteStart === -1) {
		vscode.window.showWarningMessage('The cursor is not on a date!');
		return;
	}

	const quoteEnd = lineText.indexOf(quoteChar, quoteStart + 1);
	if (quoteEnd === -1 || cursorChar > quoteEnd) {
		vscode.window.showWarningMessage('The cursor is not on a date!');
		return;
	}

	const candidate = lineText.slice(quoteStart + 1, quoteEnd);
	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(candidate);
	if (!dateMatch) {
		vscode.window.showWarningMessage('The cursor is not on a date!');
		return;
	}

	const replacement = `date(${parseInt(dateMatch[1], 10)}, ${parseInt(dateMatch[2], 10)}, ${parseInt(dateMatch[3], 10)})`;
	const range = new vscode.Range(cursorPosition.line, quoteStart, cursorPosition.line, quoteEnd + 1);
	activeTextEditor.edit((editBuilder) => {
		editBuilder.replace(range, replacement);
	});

}

function runSelectExpand() {
	const nActiveTextEditor = common.getActivePythonTextEditor();
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

async function newTask() {
	const workspaceFolder = common.getWorkspaceFolder();
	if (workspaceFolder['errorResult']) {
		vscode.window.showWarningMessage(workspaceFolder['reason']);
		return;
	}
	const workspaceF = workspaceFolder['result']
	let branch;
	try {
		const { stdout } = await execFileAsync('get_ws_branch', [], {
			cwd: workspaceF.uri.fsPath,
		});
		branch = stdout.trim();
	} catch (error) {
		vscode.window.showWarningMessage(`Unable to read git branch: ${error.message}`);
		return
	}
	const tasks = vsContext.globalState.get('tasks', {});
	if (tasks[branch] !== undefined) {
		vscode.window.showWarningMessage(`A task linked to the branch '${branch}' already exists!`);
		return;
	}
	const taskName = await vscode.window.showInputBox({title: 'Create a New Task', value: branch});
	if (taskName === undefined){
		return;
	}
	if (tasks[taskName] !== undefined) {
		vscode.window.showWarningMessage('A task with that name already exists!');
		return;
	}
	tasks[taskName] = {branch: branch, directory: workspaceF.uri.fsPath};
	if (tasks.tasks === undefined) {
		tasks.tasks = [taskName];
	} else {
		tasks.tasks.push(taskName)
	}
	vsContext.globalState.update('tasks', tasks);
}

async function switchTask() {
	const branches_choices = [];
	const tasks = vsContext.globalState.get('tasks', {});
	if (tasks.tasks === undefined) {
		vscode.window.showWarningMessage('No tasks to be found!');
		return;
	}
	for (let taskName of tasks.tasks) {
		branches_choices.push({
			label: taskName,
			detail: tasks[taskName].branch,
		})
	}
	const taskChoice = await vscode.window.showQuickPick(branches_choices, {
		title: 'Task switching',
		placeHolder: 'Switch to task...',
		matchOnDetail: true,
	});
	if (taskChoice === undefined) {
		return
	}
	const selectedTask = tasks[taskChoice.label];
	const workspaceFolder = common.getWorkspaceFolder();
	if (workspaceFolder['errorResult']) {
		vscode.window.showWarningMessage(workspaceFolder['reason']);
		return;
	}
	const workspaceF = workspaceFolder['result']
	if (workspaceF.uri.fsPath != selectedTask.directory) {
		await vscode.commands.executeCommand(
			'vscode.openFolder',
			vscode.Uri.file(selectedTask.directory),
			{ forceNewWindow: false }, // true => new window, current one stays put
		);
	}
	try {
		const activeTerminal = common.getActiveOrCreateTerminal();
		activeTerminal.sendText('ggswa', true);
	} catch (error) {
		vscode.window.showWarningMessage(`Unable to switch branch: ${error.message}`);
		return
	}
}



class FoldersProvider {
    constructor(roots) {
        this.roots = roots;                       // array of absolute folder paths
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        const item = new vscode.TreeItem(
            element.uri,
            element.isDir
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
        );
        if (element.label) {
            item.label = element.label;
        }
        if (!element.isDir) {
            item.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [element.uri],
            };
        }
        item.contextValue = element.isDir ? 'folder' : 'file';
        return item;
    }

    async getChildren(element) {
        if (!element) {
            return this.roots
                .filter(p => fs.existsSync(p))
                .map(p => ({ uri: vscode.Uri.file(p), isDir: true, label: p }));
        }
        const entries = await fs.promises.readdir(element.uri.fsPath, { withFileTypes: true });
        return entries
            .map(e => ({
                uri: vscode.Uri.file(path.join(element.uri.fsPath, e.name)),
                isDir: e.isDirectory(),
            }))
            .sort((a, b) => (b.isDir - a.isDir) || a.uri.fsPath.localeCompare(b.uri.fsPath));
    }
}

module.exports = { FoldersProvider };

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
