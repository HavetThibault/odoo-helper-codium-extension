const vscode = require('vscode');
const { getActivePythonTextEditor } = require('./common');


function replaceDateUnderCursorCmd() {
    const nActiveTextEditor = getActivePythonTextEditor();
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

module.exports = { replaceDateUnderCursorCmd };
