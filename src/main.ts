import * as core from '@actions/core'
import {genMarkdown} from './genMarkdown'

async function run(): Promise<void> {
  try {
    const NOTION_API_KEY = core.getInput('NOTION_API_KEY', {required: true})
    const NOTION_DATABASE_ID = core.getInput('NOTION_DATABASE_ID', {
      required: true
    })
    await genMarkdown(NOTION_API_KEY, NOTION_DATABASE_ID)
    return
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
