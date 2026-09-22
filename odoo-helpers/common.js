const vscode = require('vscode');


function getActiveTextEditor() {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (!activeTextEditor) {
        return {'errorResult': true, 'reason': 'No opened file!'};
    }
    return {'errorResult': false, 'result': activeTextEditor};
}

function getActivePythonTextEditor() {
    const activeTextEditor = getActiveTextEditor();
    if (activeTextEditor['errorResult']) {
        return activeTextEditor;
    }
    const editorFileName = activeTextEditor['result'].document.fileName;
    if (editorFileName.substring(editorFileName.length - 3) != '.py') {
        return {'errorResult': true, 'reason': 'The active editor is not a python file!'};
    }
    return {'errorResult': false, 'result': activeTextEditor['result']};
}

function getWorkspaceFolder(acceptZeroFolder) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders === undefined || workspaceFolders.length === 0) {
        if (acceptZeroFolder) {
            return {'errorResult': false, 'result': undefined};
        }
        return {'errorResult': true, 'reason': 'No opened folder!'};
    }
    if (workspaceFolders.length > 1) {
        return {'errorResult': true, 'reason': 'Didn\'t expect multiple workspace folders!'};
    }
    return {'errorResult': false, 'result': workspaceFolders[0]};
}

function startsWith(str, start_str) {
    return str.substring(0, start_str.length) == start_str;
}


module.exports = { getActiveTextEditor, getActivePythonTextEditor, getWorkspaceFolder, startsWith };
