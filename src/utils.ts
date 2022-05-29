import { execFileSync } from 'child_process';
import fetch from 'node-fetch';
import {
    workspace,
    WorkspaceFolder,
    WorkspaceConfiguration,
} from 'vscode';

import ago from 's-ago'

export interface Build {
	number: number;
	status: string;
    finished: number;
    target: string;
    message: string;
    link: string;
}

const parseGitUrl = (url: string) => {
    const giturl = /\:\/\//.test(url) ? url : `ssh://${url.replace(/:~?/g, '/')}`;
    const { pathname } = new URL(giturl);
    return {
        project: pathname!
            .replace('.git', '')
            .replace(/^\/\/?/, '')
            .trim(),
    };
};

export const gitClient =
    (ws: WorkspaceFolder) =>
        (...args: string[]) =>
            execFileSync('git', [`--git-dir`, `${ws.uri.fsPath}/.git/`, ...args])
                .toString()
                .trim();

export const getRepoInfo = () =>
    new Promise<{ project: string }>((resolve, reject) => {
        try {
            const ws = workspace.workspaceFolders![0];
            const git = gitClient(ws);

            const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
            const remote = git('config', '--get', `branch.${branch}.remote`);
            const url = git('config', '--get', `remote.${remote}.url`);

            const { project } = parseGitUrl(url);

            const info = {
                project,
            };
            resolve(info);
        } catch (err) {
            reject(err);
        }
    });


export const fetchDroneLastBuild = (repo: string, config: WorkspaceConfiguration) => {
    return fetch(`${config.get("server")}/api/repos/${repo}/builds/latest`, {
        headers: {
            Authorization: `Bearer ${config.get("token")}`,
        },
    }).then((res) => {
        if (res.ok) {
            return res.json() as Promise<Build>;
        }
        throw new Error(`Unexpected status code: ${res.status}`);
    });
}


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const pullBuildsInfo = async (repo: string, config: WorkspaceConfiguration, cb: (info: Build) => void, errCb: (error: any) => void) => {
    const interval = config.get('interval', 5) * 1000
    while (true) {
        try {
            const info = await fetchDroneLastBuild(repo, config);
            cb(info);
        } catch (err) {
            errCb(err);
        }
        await sleep(interval);
    }
}


const getVsCodeSymbol = (status: string) =>
({
    success: '$(check)',
    failed: '$(x)',
    running: '$(triangle-right)',
    pending: '$(clock)',
}[status] || '');

export const createText = ({ status, finished, target }: { status: string, finished: number, target: string }) => {
    const time = finished ? ago(new Date(finished * 1000)) : '';
    return `${getVsCodeSymbol(status)}${status.toUpperCase()} on '${target}' ${time}`.trim();
};