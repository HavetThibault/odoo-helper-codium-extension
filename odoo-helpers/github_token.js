const vscode = require('vscode')

class SecretStorageForSecretSettings {
    constructor(vsContext) {
        this.vsContext = vsContext;
        this.setGithubToken = this.setGithubToken.bind(this);
        this.getGithubToken = this.getGithubToken.bind(this);
    }

    async setGithubToken() {
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your GitHub token',
            password: true, // masked input
            ignoreFocusOut: true
        });
        if (token) {
            await this.vsContext.secrets.store('githubToken', token);
            vscode.window.showInformationMessage('GitHub token saved securely.');
        }
    }

    clearGithubToken() {
        this.vsContext.secrets.delete('githubToken')
    }

    async getGithubToken() {
       return await this.vsContext.secrets.get('githubToken');
    }
}

module.exports = { SecretStorageForSecretSettings }