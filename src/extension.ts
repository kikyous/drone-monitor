/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/


import * as vscode from 'vscode';
import { createText, getRepoInfo, pullBuildsInfo } from './utils';

let myStatusBarItem: vscode.StatusBarItem;

let lastBuildInfo = { number: 0 };

export async function activate({ subscriptions }: vscode.ExtensionContext) {

	const config = vscode.workspace.getConfiguration('droneMonitorSetting')

	const { project } = await getRepoInfo()

	const myCommandId = 'drone.openInBrowser';
	subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
		if (lastBuildInfo.number) {
			vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.get('droneServer')}/${project}/${lastBuildInfo.number}`));
		}
	}));

	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999999);
	myStatusBarItem.command = myCommandId;
	myStatusBarItem.show();

	subscriptions.push(myStatusBarItem);

	pullBuildsInfo(project, config, (info) => {
		lastBuildInfo = info;
		myStatusBarItem.text = createText(info);
	}, (error) => {
		myStatusBarItem.text = String(error);
	})
}
