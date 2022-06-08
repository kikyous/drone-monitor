import * as vscode from 'vscode';
import { exec } from 'child_process';
import { Build, createText, getRepoInfo, pullBuildsInfo } from './utils';

let myStatusBarItem: vscode.StatusBarItem;
let lastBuildInfo: Build = { number: 0, status: '', finished: 0, target: '', message: '', link: '' };

function statusChangedTo(build: Build, status: string = 'success') {
	return Boolean(build.status === status && lastBuildInfo.status && lastBuildInfo.status !== status)
}

export async function activate({ subscriptions }: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('droneMonitor')

	const { project } = await getRepoInfo()

	const myCommandId = 'drone.openInBrowser';
	subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
		if (lastBuildInfo.number) {
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.get('server')}/${project}/${lastBuildInfo.number}`));
		}
	}));

	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999999);
	myStatusBarItem.command = myCommandId;
	myStatusBarItem.show();

	subscriptions.push(myStatusBarItem);

	pullBuildsInfo(project, config, (info) => {
		if (info.number === lastBuildInfo.number && info.status === lastBuildInfo.status) { return }
		myStatusBarItem.text = createText(info);
		myStatusBarItem.tooltip = new vscode.MarkdownString(`${project} - [${info.message}](${info.link})`);

		const cmdOnSuccess = config.get<string>('cmdOnSuccess')
		const cmdOnFailure = config.get<string>('cmdOnFailure')

		if (cmdOnSuccess && statusChangedTo(info, 'success')) {
			exec(cmdOnSuccess)
		} else if (cmdOnFailure && statusChangedTo(info, 'failure')) {
			exec(cmdOnFailure)
		}

		lastBuildInfo = info;
	}, (error) => {
		lastBuildInfo.number = 0;
		myStatusBarItem.text = String(error);
	})
}
