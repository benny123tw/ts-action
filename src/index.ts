import * as core from '@actions/core'
import { resolveConfig } from './config.js'
import defaultMain from './default.js'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get from input
    const config = await resolveConfig()
    // Load config, parse commit, generate markdown
    defaultMain(config)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(error.message)
    }
  }
}

run()
