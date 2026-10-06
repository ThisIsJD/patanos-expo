import { describe, expect, test } from '@jest/globals'

const fs = require('node:fs')
const path = require('node:path')
const contextRoot = path.resolve('ProjectContext')
const plan = fs.readFileSync(path.join(contextRoot, 'implementationPlan.md'), 'utf8')
const requirements = fs.readFileSync(path.join(contextRoot, 'specifications/releaseRequirements.md'), 'utf8')
const tasks = [...plan.matchAll(/^- \[([ x])\] \*\*(P\d+-(?:\d+|GATE))\*\*/gm)]

function markdownFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(folder, entry.name)
    return entry.isDirectory() ? markdownFiles(file) : file.endsWith('.md') ? [file] : []
  })
}

describe('compact project context organization', () => {
  test('preserves stable task IDs and keeps checkboxes only in the tracker', () => {
    const taskIds = tasks.map(task => task[2])
    const scopeIds = [...requirements.matchAll(/^#### (P\d+-(?:\d+|GATE))$/gm)].map(scope => scope[1])
    expect(taskIds).toHaveLength(103)
    expect(new Set(taskIds).size).toBe(103)
    expect(scopeIds).toEqual(taskIds)
    expect(requirements).not.toMatch(/^- \[[ x]\]/m)
  })

  test('every condensed task links to its complete scope', () => {
    for (const task of tasks) {
      const line = plan.slice(task.index).split('\n')[0]
      expect(line).toContain(`specifications/releaseRequirements.md#${task[2].toLowerCase()}`)
    }
  })

  test('top-level context contains only the index, tracker and decision log', () => {
    expect(fs.readdirSync(contextRoot).filter(file => file.endsWith('.md')).sort())
      .toEqual(['README.md', 'architectureDecisions.md', 'implementationPlan.md'])
  })

  test('all local Markdown links resolve after consolidation', () => {
    const missing = []
    for (const file of [...markdownFiles(contextRoot), 'AGENTS.md', 'CONTRIBUTING.md', 'README.md']) {
      const content = fs.readFileSync(file, 'utf8')
      // Expo route-group paths contain balanced parentheses, e.g. app/(pos).
      for (const match of content.matchAll(/\]\(((?:[^()\n]|\([^()\n]*\))*)\)/g)) {
        if (/^(https?:|mailto:|#|\/)/.test(match[1])) continue
        const target = match[1].split('#')[0].replace(/:\d+$/, '')
        if (!fs.existsSync(path.resolve(path.dirname(file), target))) missing.push(`${file}: ${target}`)
      }
    }
    expect(missing).toEqual([])
  })

  test('the cafe fixture references the preserved menu asset', () => {
    const fixture = JSON.parse(fs.readFileSync('tests/fixtures/cafeAcceptance.json', 'utf8'))
    expect(fixture.source).toBe('ProjectContext/assets/Patanos-Menu.jpg')
    expect(fs.existsSync(fixture.source)).toBe(true)
  })
})
