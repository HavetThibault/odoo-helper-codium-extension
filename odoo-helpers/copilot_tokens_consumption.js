const vscode = require('vscode')
const { addCmd } = require('./common');

class CopilotTokensConsumption {

    constructor(secretStorage, vsContext) {
        this.secretStorage = secretStorage;
        this.vsContext = vsContext;
        this.updateConsumedTokens = this.updateConsumedTokens.bind(this);
    }

    createStatusBarItem() {
        this.tokensConsumptionItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.updateDisplay();
        this.tokensConsumptionItem.command = 'odoo-helpers.fetch-github-credit-consumption';
        this.tokensConsumptionItem.show();

        this.vsContext.subscriptions.push(this.tokensConsumptionItem);
        addCmd(this.vsContext, 'fetch-github-credit-consumption', this.updateConsumedTokens);
    }

    resetDisplay() {
        this.tokensConsumptionItem.text = '$(copilot) ----/----';
        this.tokensConsumptionItem.tooltip = '';
    }

    updateDisplay() {
        const aiCredits = this.vsContext.globalState.get('aiCredits', undefined);
        if (!aiCredits) {
            this.resetDisplay();
        } else {
            this.tokensConsumptionItem.text = `$(copilot) ${aiCredits.credits_used}/${aiCredits.entitlement}`;
            const updateDate = new Date(aiCredits.timestamp_utc)
            this.tokensConsumptionItem.tooltip = `Updated on ${updateDate.toLocaleDateString()} ${updateDate.toLocaleTimeString()}`;
        }
    }

    async updateConsumedTokens() {
        const token = await this.secretStorage.getGithubToken();
        if (!token) {
            vscode.window.showWarningMessage('Please set your github token!');
            return;
        }
        this.resetDisplay();
        // const url = 'https://api.github.com/enterprises/odoo-dev/settings/billing/ai_credit/usage';
        // const url = 'https://api.github.com/users/thha-odoo/settings/billing/usage';
        // const url = 'https://api.github.com/organizations/odoo-dev/settings/billing/ai_credit/usage?user=thha-odoo';
        // const url = 'https://api.github.com/orgs/odoo-dev/copilot/metrics/reports/organization-1-day?day=2026-10-30';
        // const url = 'https://api.github.com/enterprises/odoo-dev/copilot/metrics/reports/users-1-day?day=2026-10-30';
        // const url = 'https://api.github.com/orgs/odoo-dev/copilot/metrics/reports/users-28-day/latest';
        try {
            const url = 'https://api.github.com/copilot_internal/user';
            const res = await fetch(
                url,
                { headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10'
                }});
            if (res.status == 200) {
                const result = await res.json();
                const interactions = result.quota_snapshots.premium_interactions;
                this.vsContext.globalState.update('aiCredits', {
                    credits_used: interactions.credits_used,
                    entitlement: interactions.entitlement,
                    timestamp_utc: interactions.timestamp_utc,
                });
                this.updateDisplay();
            } else {
                vscode.window.showWarningMessage(`Could not fetch from github, received code ${status} !`);
            }
        } catch {
            this.updateDisplay();
        }
    }
}

module.exports = {CopilotTokensConsumption}
