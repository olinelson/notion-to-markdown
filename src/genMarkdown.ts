/* eslint-disable no-case-declarations */
import {Client} from '@notionhq/client'
import {
  DatabasesQueryResponse,
  PropertyValueMap
} from '@notionhq/client/build/src/api-endpoints'
import {
  DatePropertyValue,
  Page,
  RichText,
  RichTextPropertyValue,
  RichTextText,
  TitlePropertyValue
} from '@notionhq/client/build/src/api-types'
import fs from 'fs'
import path from 'path'
import {GenMarkdownResult} from './types'
import * as core from '@actions/core'

function parseRichText(rt: RichText): string {
  const {type} = rt

  if (type === 'text') {
    const {annotations, text} = rt as RichTextText
    const content = text.content.trim()
    const url = text.link?.url
    const quote = content.startsWith('^') ? content.substring(0, 1) : undefined

    if (url) {
      return `[${content}](${url})`
    }

    if (annotations.bold) {
      return `**${content}**`
    }

    if (annotations.italic) {
      return `*${content}*`
    }

    if (annotations.strikethrough) {
      return `~~${content}~~`
    }

    if (annotations.code) {
      const tag = "'`'"
      return `${tag}${content}${tag}`
    }

    if (quote) {
      return `> ' ${content.substring(2)}`
    }
  }

  return ''
}

function parseProperties(
  props: PropertyValueMap,
  keys: string[]
): Record<string, string> {
  const res: Record<string, string> = {}

  for (const k of keys) {
    switch (props[k].type) {
      case 'title':
        const a = props[k] as TitlePropertyValue
        res[k] = a.title[0]?.plain_text || ''
        break
      case 'rich_text':
        const b = props[k] as RichTextPropertyValue
        res[k] = b.rich_text[0]?.plain_text || ''
        break
      case 'date':
        const c = props[k] as DatePropertyValue
        res[k] = c.date?.start || ''
        break
    }
  }

  return res
}

function generateFrontMatter(
  customFrontMatter: Record<string, string>
): string {
  let parsed = ''
  for (const k in customFrontMatter) {
    parsed += `${customFrontMatter[k]}\n`
  }

  return `---
  layout: "../../layouts/BlogPost.astro"
  ${parsed}
  ---
`.replace(/ {2}|\r\n|\r/gm, '')
}

async function createMarkdownFile(notion: Client, page: Page): Promise<string> {
  const parsedProps = parseProperties(page.properties, [
    'Name',
    'Description',
    'Published',
    'Author',
    'HeroImageDescription'
  ])
  let text = generateFrontMatter(parsedProps)

  const page_blocks = await notion.blocks.children.list({
    block_id: page.id
  })

  for (const block of page_blocks.results) {
    switch (block.type) {
      case 'paragraph':
        text += '\n'
        for (const textBlock of block.paragraph.text) {
          text += `${parseRichText(textBlock)} `
        }
        text += '\n'
        break
      case 'heading_1':
        text += `\n#${block.heading_1.text[0].plain_text}\n`
        break
      case 'heading_2':
        text += `\n##${block.heading_2.text[0].plain_text}\n`
        break
      case 'heading_3':
        text += `###${block.heading_3.text[0].plain_text}\n`
        break
      case 'bulleted_list_item':
        text += ` - ${block.bulleted_list_item.text[0].plain_text}\n`
        break
      case 'image':
        const image = block.image
        const caption = (image?.caption && image.caption[0].plain_text) || ''
        const url =
          image.type === 'external' ? image.external.url : image.file.url
        text += `![${caption}](${url} "${caption}")`
        break
      default:
        break
    }
  }

  const fileName = `${parsedProps.Name || 'untitled'}.md`
  const dirPath = path.join(__dirname, '/src/pages/posts')

  fs.writeFileSync(`${dirPath}/${fileName}`, text)

  return fileName
}

export async function genMarkdown(
  notionApiKey: string,
  database_id: string
): Promise<GenMarkdownResult> {
  const notion = new Client({
    auth: notionApiKey
  })

  let hasMore = false
  let start_cursor: string | undefined = undefined

  const filesCreated = []

  try {
    do {
      const res: DatabasesQueryResponse = await notion.databases.query({
        database_id,
        start_cursor
      })

      const pages: Page[] = res.results

      for (const p of pages) {
        const createdFileName = await createMarkdownFile(notion, p)
        filesCreated.push(createdFileName)
      }

      if (res.has_more && res.next_cursor) {
        hasMore = true
        start_cursor = res.next_cursor
      }
    } while (hasMore)

    const result = {
      success: true,
      filesCreated
    }
    core.debug(JSON.stringify(result, undefined, 2))
    return result
  } catch (error) {
    const result = {
      success: false,
      filesCreated,
      error
    }
    core.error(JSON.stringify(result, undefined, 2))
    return result
  }
}
