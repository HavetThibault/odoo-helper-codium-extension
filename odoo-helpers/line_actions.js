const vscode = require('vscode');
const fs = require('fs');
const { getActiveTextEditor } = require('./common');


const LINES_FILE_PATH = '/tmp/odoo_pres_lines.txt';


function getCurrentLine() {
    const activeTextEditor = getActiveTextEditor();
    if (activeTextEditor['errorResult']) {
        vscode.window.showWarningMessage(activeTextEditor['reason']);
        return undefined;
    }
    const editor = activeTextEditor['result'];
    const line = editor.document.lineAt(editor.selection.active.line);
    return { editor, text: line.text };
}

function moveCursorToNextLineStart(editor) {
    const nextLine = Math.min(editor.selection.active.line + 1, editor.document.lineCount - 1);
    const position = new vscode.Position(nextLine, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
}

async function printLineToFile() {
    const current = getCurrentLine();
    if (!current) {
        return;
    }
    try {
        await fs.promises.appendFile(LINES_FILE_PATH, current.text + '\n');
    } catch (error) {
        vscode.window.showErrorMessage(`Could not write to ${LINES_FILE_PATH}: ${error.message}`);
        return;
    }
    moveCursorToNextLineStart(current.editor);
}

function sendLineToTerminal() {
    const current = getCurrentLine();
    if (!current) {
        return;
    }
    const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal();
    terminal.show(true);
    terminal.sendText(current.text, true);
    moveCursorToNextLineStart(current.editor);
}

async function clearLinesFile() {
    try {
        await fs.promises.writeFile(LINES_FILE_PATH, '');
    } catch (error) {
        vscode.window.showErrorMessage(`Could not clear ${LINES_FILE_PATH}: ${error.message}`);
        return;
    }
    vscode.window.showInformationMessage(`${LINES_FILE_PATH} cleared.`);
}

module.exports = { printLineToFile, sendLineToTerminal, clearLinesFile, LINES_FILE_PATH };
