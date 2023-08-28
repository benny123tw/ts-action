import type { ChangelogConfig, RepoProvider as ChangelogenRepoProvider } from 'changelogen'

export type ChangelogenConfig = ChangelogConfig
export type RepoProvider = ChangelogenRepoProvider | 'gitea'

export interface RepoConfig {
  domain?: string | undefined
  repo?: string | undefined
  provider?: RepoProvider | undefined
  token?: string | undefined
}

export interface ChangelogOptions extends Partial<Omit<ChangelogenConfig, 'repo'>> {
  /**
   * Dry run. Skip releasing to GitHub.
   */
  dry?: boolean
  /**
   * Repository.
   */
  repo?: RepoConfig
  /**
   * Determine if the working directory is clean and if it is not clean, exit.
   */
  clean?: boolean
  /**
   * Whether to include contributors in release notes.
   *
   * @default true
   */
  contributors?: boolean
  /**
   * Name of the release
   */
  name?: string
  /**
   * Mark the release as a draft
   */
  draft?: boolean
  /**
   * Mark the release as prerelease
   */
  prerelease?: boolean
  /**
   * GitHub Token
   */
  token?: string
  /**
   * Custom titles
   */
  titles?: {
    breakingChanges?: string
  }
  /**
   * Capitalize commit messages
   * @default true
   */
  capitalize?: boolean
  /**
   * Nest commit messages under their scopes
   * @default true
   */
  group?: boolean | 'multiple'
  /**
   * Use emojis in section titles
   * @default true
   */
  emoji?: boolean
}
