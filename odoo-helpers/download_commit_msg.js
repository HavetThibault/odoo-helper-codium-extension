const vscode = require('vscode');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execFileAsync = promisify(execFile);

const { PullRequest } = require('./tasks/pull_request');
const { getWorkspaceFolder, startsWith } = require('./common');

const SCHEME = 'odoo-helpers-diff';
const pathToTextMap = new Map();

function showDiffActionNotification() {
    vscode.window.showInformationMessage('My Lord, here is the fetched message.', 'Apply Message').then((selection) => {
        if (!selection) {
            return;
        }

        const message = selection === 'Use PR message' ? "HIHIHI" : "HAHAHA";

        vscode.env.clipboard.writeText(message).then(() => {
            const label = selection === 'Use PR message' ? 'PR' : 'HEAD';
            vscode.window.showInformationMessage(`${label} message copied to clipboard.`);
        });
    });
}

function subscribeApplyPrMessage(vsContext) {
    const provider = {
        onDidChange: new vscode.EventEmitter().event,
        provideTextDocumentContent(uri) {
            return pathToTextMap.get(uri.path) ?? '';
        },
    };
    vsContext.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (!editor || editor.document?.uri?.scheme !== SCHEME) {
                return;
            }
            showDiffActionNotification();
        })
    );
}

async function applyPrMessage(taskManager) {
    const currentTask = await taskManager.getCurrentTask();
    if (!currentTask) {
        return;
    }
    const reposChoices = currentTask.data.prs.map(prData => {
        const pr = new PullRequest(prData);
        return {label: pr.getName(), pr: pr};
    });
    if (reposChoices.length === 0) {
        vscode.window.showWarningMessage('Current task has no pull requests!');
        return undefined;
    }

    const quickPickRes = await vscode.window.showQuickPick(reposChoices, {
        title: 'Select a Repository',
        placeHolder: 'Search for repos...'
    });
    if (!quickPickRes) {
        return;
    }
    const selectedPr = quickPickRes.pr;
    const prText = `${selectedPr.data.title}\n\n${convertMarkdownToCommitMsg(selectedPr.data.body)}`

    const workspaceFolderRes = getWorkspaceFolder();
    if (workspaceFolderRes['errorResult']){
        vscode.window.showWarningMessage(workspaceFolderRes['reason']);
        return;
    }
    const workspaceFolderPath = workspaceFolderRes['result'].uri.path;
    const repoPath = path.join(workspaceFolderPath, selectedPr.data.repository);
    const { stdout } = await execFileAsync('git', ['log', '-1', '--pretty=%B'], { cwd: repoPath });
    pathToTextMap.set('/HEAD message', stdout.trimEnd());
    pathToTextMap.set('/new message', prText);

    const left = vscode.Uri.from({ scheme: SCHEME, path: '/HEAD message' });
    const rightDocument = await vscode.workspace.openTextDocument({
        language: 'plaintext',
        content: prText,
    });
    const right = rightDocument.uri;

    await vscode.commands.executeCommand(
        'vscode.diff',
        left,
        right,
        'Commit message: HEAD ↔ New'
    );
}

const maxLineLength = 100;
function convertMarkdownToCommitMsg(body) {
    const commitMsgLines = [];
    const lines = body.split('\n');
    lines.forEach(line => {
        if (/^#+\s/.test(line)) {
            const titleStart = line.indexOf('# ') + 2;
            const titleLine = `${line.substring(titleStart, line.length - 1)}:`
            commitMsgLines.push(titleLine);
            commitMsgLines.push('-'.repeat(titleLine.length));
            return;
        }
        if (/^\[(odoo|enterprise|upgrade)#[1-9]+\]/.test(line)) {
            const repoAndPrId = line.substring(1).split(']')[0].split('#');
            const repository = repoAndPrId[0];
            const prId = repoAndPrId[1];
            commitMsgLines.push(`${repository}#${prId}`);
            return;
        }
        let leftLine = line;
        let offset = 0;
        while((line.length - offset) > maxLineLength) {
            const linePart = leftLine.substring(offset, offset + maxLineLength);
            let i = linePart.length - 1;
            for (; ![')', '\'', '"', ' ', ''].includes(linePart.at(i)) && i >= 0; i--) {}
            const noWordCutPartLine = linePart.substring(0, linePart.length - ((linePart.length - 1) - i)).trimEnd();
            offset += noWordCutPartLine.length;
            commitMsgLines.push(noWordCutPartLine);
        }
        commitMsgLines.push(leftLine.substring(offset));
    });
    return commitMsgLines.join('\n');
}

module.exports = { subscribeApplyPrMessage, applyPrMessage };
