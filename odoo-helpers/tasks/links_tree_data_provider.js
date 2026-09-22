const vscode = require('vscode')
const { parse } = require('node-html-parser');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const { getWorkspaceFolder } = require('../common');
const { TaskLink, TaskLinkData } = require('./task_link');

function getRunbotUrl(task) {
    return `https://runbot.odoo.com/runbot/bundle/${task.data.branch}`;
}

function extractTasksLinks(html) {
    const root = parse(html);

    // find the <tr> whose first <td> is "Branches"
    const row = root.querySelectorAll('tr').find(
        tr => tr.querySelector('td')?.text.trim() === 'Branches'
    );
    if (!row) return [];

    const valueCell = row.querySelectorAll('td')[1];
    if (!valueCell) return [];

    return valueCell.querySelectorAll('div.btn-group').map(group => {
        const githubLinkElem = group.querySelector('a[title="View Branch on Github"]');
        const repoUriElem = group.querySelector('a[href="#"]');
        const branchSpan = group.querySelector('a[title="View Branch Details"] span');

        if (branchSpan?.classList.contains('line-through') ?? false) {
            return undefined;
        }
        const reposUri = repoUriElem?.text.trim();
        if (!['odoo/odoo', 'odoo/enterprise', 'odoo/upgrade'].find(reposUri)) {
            return undefined;
        }
        const githubLink = githubLinkElem?.getAttribute('href');
        if (!githubLink) {
            return undefined;
        }
        // <div class="btn-toolbar mb-1" role="toolbar">
        //     <div class="btn-group btn-group-ssm" role="group">
        //         <a class="btn btn-default text-start" title="View Branch on Github" href="https://github.com/odoo-dev/odoo/tree/master-dimona-student-constraints-thha"><i class="fa fa-github"></i></a>
        //         <a href="#" class="btn btn-default disabled text-start">odoo-dev/odoo</a>
        //         <a class="btn btn-default text-start" title="View Branch Details" href="/runbot/branch/1058200"><span class="">master-dimona-student-constraints-thha</span> </a>
        //     </div>
        // </div>

        // <div class="btn-toolbar mb-1" role="toolbar">
        //     <div class="btn-group btn-group-ssm" role="group">
        //         <a class="btn btn-default text-start" title="View Branch on Github" href="https://github.com/odoo/enterprise/pull/114431"><i class="fa fa-github"></i></a>
        //         <a href="#" class="btn btn-default disabled text-start">odoo/enterprise</a>
        //         <a class="btn btn-default text-start" title="View Branch Details" href="/runbot/branch/1042156"><span class="">114431</span> </a>
        //     </div>
        // </div>

        //https://github.com/odoo/odoo/pull/264148
        //https://github.com/odoo/enterprise/pull/264148
        // Removes 'odoo/'
        const repos = reposUri.substring(5);
        const prId = githubLink.split('/').at(-1);
        return new TaskLink(repos, prId);
    }).filter(item => item !== undefined);
}

class LinksTreeDataProvider {
    constructor(taskManager) {
        this.taskManager = taskManager;                       // array of absolute folder paths
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.getChilden = this.getChildren.bind(this);
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
        item.command = {
            command: 'odoo-helpers.open-link',
            title: 'Open Link',
            arguments: [element.url],
        };
        item.contextValue = element.name;
        return item;
    }

    async getChildren() {
        const currentTask = await this.taskManager.getCurrentTask();
        if (currentTask === undefined) {
            return [];
        }

        const runbotUrl = currentTask.getRunbotUrl();
        let elements;
        if (!currentTask.data.taskLinks) {
            elements = [];
        } else {
            elements = currentTask.data.taskLinks.map(taskLinkData => {
                const taskLink = new TaskLink(taskLinkData);
                return {
                    name: taskLink.getName(),
                    url: taskLink.getGithubUrl()
                };
            });
        }
        elements.splice(0, 0, {
            name: 'RUNBOT',
            url: runbotUrl,
        });
        return elements;
    }
}

module.exports = { LinksTreeDataProvider }
