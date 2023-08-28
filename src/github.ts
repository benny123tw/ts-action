import process from 'node:process'
import { consola } from 'consola'
import { type ResolvedChangelogConfig, resolveGithubToken, syncGithubRelease } from 'changelogen'
import { cyan } from 'colorette'
import { $fetch } from 'ofetch'
import type { ChangelogOptions } from './types.js'

export async function githubRelease(
  config: ResolvedChangelogConfig,
  release: { version: string; body: string },
) {
  if (!config.tokens.github) {
    config.tokens.github = await resolveGithubToken(config).catch(() => undefined)
  }
  consola.log(config)
  const result = await syncGithubRelease(config, release)
  if (result.status === 'manual') {
    if (result.error) {
      consola.error(result.error)
      process.exitCode = 1
    }
    consola.error(result.url)
  } else {
    consola.success(`Synced ${cyan(`v${release.version}`)} to Github releases!`)
  }
}

function getHeaders(options: ChangelogOptions) {
  return {
    accept: 'application/vnd.github.v3+json',
    authorization: `token ${options.tokens?.github}`,
  }
}

export async function hasTagOnGitHub(tag: string, options: ChangelogOptions) {
  try {
    await $fetch(`https://api.github.com/repos/${options.repo?.repo}/git/ref/tags/${tag}`, {
      headers: getHeaders(options),
    })
    return true
  } catch (e) {
    consola.error(e)
    return false
  }
}
