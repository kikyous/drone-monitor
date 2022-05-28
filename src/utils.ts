import fetch from 'node-fetch';
import {
    WorkspaceConfiguration, extensions
} from 'vscode';
import ago from 's-ago'


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


const fetchDrone = (repo: string, config: WorkspaceConfiguration) => {
    return fetch(`${config.get("server")}/api/repos/${repo}/builds/latest`, {
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${config.get("token")}`,
        },
    }).then((res) => {
        if (res.status === 200) {
            return res.json();
        }
        throw new Error(`Unexpected status code: ${res.status}`);
    });
}


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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


export const getRepoState = async () => {
	return new Promise((resolve, reject) => {
		const gitExtension = extensions.getExtension('vscode.git')!.exports;
		const api = gitExtension.getAPI(1);

		const resolveState = () => {
			const repo = api.repositories[0];
			if (repo.state.HEAD) {
				resolve(repo.state);
			} else {
				repo.state.onDidChange(() => {
					resolve(repo.state)
				})
			}
		}

		if (api.state === 'uninitialized') {
			api.onDidOpenRepository(resolveState);
		} else {
			const repo = api.repositories[0];
			repo.state.onDidChange(resolveState)
		}
	})
}

export const getRemoteProject = (state: any) => {
	const remote = state.HEAD.upstream.remote;
	const remoteData = state.remotes.find((i: any) => i.name === remote);
	return parseGitUrl(remoteData.pushUrl).project;
}

