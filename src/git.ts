import type { RepoConfig } from 'changelogen'
import { getRepoConfig } from 'changelogen'
import { consola } from 'consola'

export async function getGitHubRepo(): Promise<RepoConfig> {
  consola.log(getRepoConfig())
  const url = await execCommand('git', ['config', '--get', 'remote.origin.url'])
  const match = url.match(/github\.com[\/:]([\w\d._-]+?)\/([\w\d._-]+?)(\.git)?$/i)
  if (!match) {
    throw new Error(`Can not parse GitHub repo from url ${url}`)
  }
  return {
    provider: 'github',
    repo: `${match[1]}/${match[2]}`,
    domain: new URL(url).hostname,
  }
}

async function execCommand(cmd: string, args: string[]) {
  const { execa } = await import('execa')
  const res = await execa(cmd, args)
  return res.stdout.trim()
}
