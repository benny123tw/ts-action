import process from 'node:process'
import * as core from '@actions/core'
import type { ChangelogConfig } from 'changelogen'
import { loadChangelogConfig } from 'changelogen'
import { getFirstGitCommit, getLastGitTag } from 'changelogithub'
import { consola } from 'consola'
import type { ChangelogOptions, ChangelogenConfig, ResolvedChangelogOptions } from './types.js'

export function defineConfig(config: ChangelogConfig) {
  return config
}

export const defaultConfig: ChangelogOptions = {
  capitalize: true,
  contributors: true,
  cwd: process.cwd(),
  draft: false,
  dry: false,
  emoji: true,
  from: '',
  group: true,
  name: '',
  newVersion: '',
  output: '',
  prerelease: false,
  token: '',
  clean: false,
}

export async function resolveConfig(options?: ChangelogOptions) {
  core.debug('Resolve config from changelogen')
  const inputs = core.isDebug() ? await getInputVariablesDebugMode() : getInputVariables()
  const cwd = inputs.cwd || process.cwd()

  const config = await loadChangelogConfig(cwd, Object.assign(inputs, options) as ChangelogenConfig)

  if (config.to === config.from)
    config.from = (await getLastGitTag(-1)) || (await getFirstGitCommit())
  if (!config.newVersion) {
    config.newVersion = /v\d+\.\d+\.\d+/.test(config.to) ? config.to.slice(1) : config.to
  }

  consola.box(`${config.from}...${config.to}`)

  return config as ResolvedChangelogOptions
}

export function getInputVariables() {
  core.debug('Get input from yaml')
  const name = core.getInput('name')
  const from = core.getInput('from')
  const cwd = core.getInput('directory') || process.cwd()
  const to = core.getInput('to')
  const newVersion = core.getInput('version')
  const emoji = core.getBooleanInput('emoji')
  const contributors = core.getBooleanInput('contributors')
  const prerelease = core.getBooleanInput('prerelease')
  const draft = core.getBooleanInput('draft')
  const group = core.getBooleanInput('group')
  const capitalize = core.getBooleanInput('capitalize')
  const token = core.getInput('token')
  const dry = core.getBooleanInput('dry')

  return {
    dry,
    name,
    from,
    cwd,
    to,
    newVersion,
    emoji,
    contributors,
    prerelease,
    draft,
    group,
    capitalize,
    token,
  }
}

async function getInputVariablesDebugMode() {
  const { loadConfig } = await import('c12')
  const config = await loadConfig({
    name: 'chanction',
    defaultConfig,
  }).then((r) => r.config || defaultConfig)

  return config
}
