const vscode = require('vscode');


const ODOO_CLIENT_TERMINAL = 'close-odoo-client'

function getUserTerminals() {
    return vscode.window.terminals.filter(terminal => terminal.name !== ODOO_CLIENT_TERMINAL);
}


class TerminalsManager {
    constructor() {
        this.terminalStates = [];

        this.onTerminalStartCmd = this.onTerminalStartCmd.bind(this);
        this.onTerminalEndCmd = this.onTerminalEndCmd.bind(this);
        this.getAvailableTerminal = this.getAvailableTerminal.bind(this);
    }

    async onTerminalStartCmd(event) {
        if (event.terminal.name === ODOO_CLIENT_TERMINAL) {
            return
        }
        const ps = await event.terminal.processId;
        this.setTerminalState(ps, true);
    }

    async onTerminalEndCmd(event) {
        if (event.terminal.name === ODOO_CLIENT_TERMINAL) {
            return
        }
        const ps = await event.terminal.processId;
        this.setTerminalState(ps, false);
    }

    setTerminalState(processId, isBusy) {
        const terminal = this.terminalStates.filter(terminal => terminal.processId == processId);
        if (terminal.length == 1) {
            terminal[0].isBusy = isBusy;
        } else if(terminal.length == 0) {
            this.terminalStates.push({processId: processId, isBusy: isBusy});
        } else {
            throw new Error('Found multiple terminals with the same processId!');
        }
    }

    async getAvailableTerminal() {
        const activeTerminal = vscode.window.activeTerminal;
        // const names = vscode.window.terminals.map(terminal => terminal.name);
        if (activeTerminal !== undefined) {
            if (!this.isTerminalBusy((await activeTerminal.processId))) {
                return activeTerminal;
            }
        }
        const terminals = getUserTerminals();
        for (let i = 0; i < terminals.length; i++) {
            if (terminals[i] === activeTerminal) {
                continue;
            }
            if (!this.isTerminalBusy((await terminals[i].processId))) {
                return terminals[i];
            }
        }
        return vscode.window.createTerminal();
    }

    isTerminalBusy(processId) {
        const terminalState = this.terminalStates.filter(state => state.processId == processId);
        if (terminalState.length == 1) {
            return terminalState[0].isBusy;
        }
        return false;
    }

    async anyTerminalBusy() {
        const terminals = getUserTerminals();
        const terminalPsIds = Promise.all(terminals.map((terminal) => terminal.processId))
        return (await terminalPsIds).some((ps) => this.isTerminalBusy(ps));
    }
}

module.exports = { TerminalsManager };
