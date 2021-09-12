import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    const NOTION_API_KEY = core.getInput('NOTION_API_KEY', { required: true });
    const NOTION_DATABASE_ID = core.getInput('NOTION_DATABASE_ID', { required: true });
    const ms: string = core.getInput('milliseconds')
    core.
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
