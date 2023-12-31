import process from 'node:process'
import consola from 'consola'
import * as core from '@actions/core'
import type { ResolvedChangelogConfig } from 'changelogen'
import { generateMarkDown, getCurrentGitStatus, getGitDiff, parseCommits } from 'changelogen'
import { bold, yellow } from 'colorette'
import type { ChangelogenConfig, ResolvedChangelogOptions } from './types.js'
import { githubRelease, hasTagOnGitHub } from './github.js'

export default async function defaultMain(config: ResolvedChangelogOptions) {
  consola.log(config)
  if (config.clean) {
    const dirty = await getCurrentGitStatus()
    if (dirty) {
      consola.error('Working directory is not clean.')
      process.exit(1)
    }
  }

  const logger = consola.create({ stdout: process.stderr })
  logger.info(`Generating changelog for ${config.from || ''}...${config.to}`)

  const rawCommits = await getGitDiff(config.from, config.to)

  // Parse commits as conventional commits
  const commits = parseCommits(rawCommits, config as ChangelogenConfig).filter(
    (c) => config.types?.[c.type] && !(c.type === 'chore' && c.scope === 'deps' && !c.isBreaking),
  )

  // Shortcut for canary releases
  // if (args.canary) {
  //   if (args.bump === undefined) {
  //     args.bump = true
  //   }
  //   if (args.versionSuffix === undefined) {
  //     args.versionSuffix = true
  //   }
  //   if (args.nameSuffix === undefined && typeof args.canary === 'string') {
  //     args.nameSuffix = args.canary
  //   }
  // }

  // Rename package name optionally
  // if (typeof args.nameSuffix === 'string') {
  //   await renamePackage(config, `-${args.nameSuffix}`)
  // }

  // Bump version optionally
  // if (args.bump || args.release) {
  //   const bumpOptions = _getBumpVersionOptions(args)
  //   const newVersion = await bumpVersion(commits, config, bumpOptions)
  //   if (!newVersion) {
  //     consola.error('Unable to bump version based on changes.')
  //     process.exit(1)
  //   }
  //   config.newVersion = newVersion
  // }

  // Generate markdown
  const markdown = await generateMarkDown(commits, config as ResolvedChangelogConfig)

  // Show changelog in CLI unless bumping or releasing
  if (config.dry) {
    core.debug('Dry run. Skip releasing')
    consola.log(`\n\n${markdown}\n\n`)
    return
  }

  // Update changelog file (only when bumping or releasing or when --output is specified as a file)
  // if (typeof config.output === 'string' && (args.output || !displayOnly)) {
  //   let changelogMD: string
  //   if (existsSync(config.output)) {
  //     consola.info(`Updating ${config.output}`)
  //     changelogMD = await fsp.readFile(config.output, 'utf8')
  //   } else {
  //     consola.info(`Creating  ${config.output}`)
  //     changelogMD = '# Changelog\n\n'
  //   }

  //   const lastEntry = changelogMD.match(/^###?\s+.*$/m)

  //   if (lastEntry) {
  //     changelogMD =
  //       changelogMD.slice(0, lastEntry.index) +
  //       markdown +
  //       '\n\n' +
  //       changelogMD.slice(lastEntry.index)
  //   } else {
  //     changelogMD += '\n' + markdown + '\n\n'
  //   }

  //   await fsp.writeFile(config.output, changelogMD)
  // }

  // Commit and tag changes for release mode
  // if (args.release) {
  // if (args.commit !== false) {
  //   const filesToAdd = [config.output, 'package.json'].filter(
  //     (f) => f && typeof f === 'string',
  //   ) as string[]
  //   await execa('git', ['add', ...filesToAdd], { cwd })
  //   const msg = config.templates.commitMessage.replaceAll('{{newVersion}}', config.newVersion)
  //   await execa('git', ['commit', '-m', msg], { cwd })
  // }
  // if (args.tag !== false) {
  //   const msg = config.templates.tagMessage.replaceAll('{{newVersion}}', config.newVersion)
  //   const body = config.templates.tagBody.replaceAll('{{newVersion}}', config.newVersion)
  //   await execa('git', ['tag', '-am', msg, body], { cwd })
  // }
  // if (args.push === true) {
  //   await execa('git', ['push', '--follow-tags'], { cwd })
  // }

  if (!(await hasTagOnGitHub(config.to, config as any))) {
    console.error(
      yellow(
        `Current ref "${bold(config.to)}" is not available as tags on GitHub. Release skipped.`,
      ),
    )
    process.exit(1)
  }

  if (config.repo?.provider === 'github') {
    await githubRelease(config as ResolvedChangelogConfig, {
      version: config.newVersion as string,
      body: markdown.split('\n').slice(2).join('\n'),
    })
  }
  // }

  // Publish package optionally
  // if (args.publish) {
  //   if (args.publishTag) {
  //     config.publish.tag = args.publishTag
  //   }
  //   await npmPublish(config)
  // }
}
