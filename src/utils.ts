import { execFileSync } from 'child_process';
import fetch from 'node-fetch';
import { parse } from 'url';
import {
    workspace,
    WorkspaceFolder,
    WorkspaceConfiguration,
} from 'vscode';

import ago from 's-ago'



export const parseGitUrl = (url: string) => {
    const giturl = /\:\/\//.test(url) ? url : `ssh://${url.replace(/:~?/g, '/')}`;
    const { path } = parse(giturl);
    return {
        project: path!
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
            console.log(err);
            reject(err);
        }
    });


export const fetchDrone = (repo: string, config: WorkspaceConfiguration) => {
    return fetch(`${config.get("droneServer")}/api/repos/${repo}/builds/latest`, {
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${config.get("droneToken")}`,
        },
    }).then((res) => {
        if (res.status === 200) {
            return res.json();
        }
        throw new Error(`Unexpected status code: ${res.status}`);
    });
}


export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const pullBuildsInfo = async (repo: string, config: WorkspaceConfiguration, cb: (info: any) => void, errCb: (error: any) => void) => {
    const interval = config.get('interval', 5) * 1000
    while (true) {
        try {
            const info = await fetchDrone(repo, config);
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
    const time = finished ? ago(new Date(finished*1000)) : '';
    return `${getVsCodeSymbol(status)}${status.toUpperCase()} on '${target}' ${time}`.trim();
};


