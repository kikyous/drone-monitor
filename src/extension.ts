import * as vscode from 'vscode';
import { createText, getRemoteProject, getRepoState, pullBuildsInfo } from './utils';

let myStatusBarItem: vscode.StatusBarItem;
let lastBuildInfo = { number: 0, updated: 0 };


export async function activate({ subscriptions }: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('droneMonitor')

	const state = await getRepoState();
	const project = getRemoteProject(state);

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
		if (info.updated === lastBuildInfo.updated) { return }
		lastBuildInfo = info;
		myStatusBarItem.text = createText(info);
		myStatusBarItem.tooltip = new vscode.MarkdownString(`${project} - [${info.message}](${info.link})`);
	}, (error) => {
		myStatusBarItem.text = String(error);
	})
}
