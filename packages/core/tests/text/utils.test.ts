/**
 * Tests for text utilities: tag, splitClauses, isImperativeStart, findWords
 *
 * Covers:
 * - Req 2.2: span offsets must be accurate
 * - Examples from docs/smells.md
 * - Edge cases: empty text, punctuation, mixed case
 */

import { describe, it, expect } from 'vitest'
import { tag, splitClauses, isImperativeStart, imperativeStartInfo, isDeclarativeClause, findWords } from '../../src/text/utils.js'

// ---------------------------------------------------------------------------
// tag()
// ---------------------------------------------------------------------------
describe('tag()', () => {
  it('returns empty array for empty string', () => {
    expect(tag('')).toEqual([])
  })

  it('returns empty array for whitespace-only string', () => {
    expect(tag('   ')).toEqual([])
  })

  it('returns tokens with correct text values', () => {
    const tokens = tag('Click the button')
    expect(tokens.map(t => t.text)).toEqual(['Click', 'the', 'button'])
  })

  it('tags "Click" with Imperative', () => {
    const tokens = tag('Click the button')
    const first = tokens[0]
    expect(first).toBeDefined()
    expect(first!.tags).toContain('Imperative')
  })

  it('tags "Open" with Imperative', () => {
    const tokens = tag('Open any application')
    expect(tokens[0]!.tags).toContain('Imperative')
  })

  it('tags "verify" with Verb', () => {
    const tokens = tag('verify the total')
    expect(tokens[0]!.tags).toContain('Verb')
  })

  it('tags "should" with Modal and Auxiliary', () => {
    const tokens = tag('should appear')
    expect(tokens[0]!.tags).toContain('Modal')
    expect(tokens[0]!.tags).toContain('Auxiliary')
  })

  it('tags "is" with Auxiliary', () => {
    const tokens = tag('The monitor is connected')
    const isTok = tokens.find(t => t.normal === 'is')
    expect(isTok).toBeDefined()
    expect(isTok!.tags).toContain('Auxiliary')
  })

  it('tags "quickly" with Adverb', () => {
    const tokens = tag('The page loads quickly')
    const quickly = tokens.find(t => t.normal === 'quickly')
    expect(quickly).toBeDefined()
    expect(quickly!.tags).toContain('Adverb')
  })

  it('tags "faster" with Comparative', () => {
    const tokens = tag('loads faster')
    const faster = tokens.find(t => t.normal === 'faster')
    expect(faster).toBeDefined()
    expect(faster!.tags).toContain('Comparative')
  })

  it('provides accurate character offsets that align with original text', () => {
    const text = 'Click the button'
    const tokens = tag(text)
    for (const token of tokens) {
      expect(text.slice(token.start, token.end)).toBe(token.text)
    }
  })

  it('handles punctuation in the text without crashing', () => {
    const tokens = tag('Click Save.')
    expect(tokens.length).toBeGreaterThan(0)
    // All offsets must be within bounds
    const text = 'Click Save.'
    for (const token of tokens) {
      expect(token.start).toBeGreaterThanOrEqual(0)
      expect(token.end).toBeLessThanOrEqual(text.length)
    }
  })

  it('offsets cover the whole word in "Open any application"', () => {
    const text = 'Open any application'
    const tokens = tag(text)
    for (const token of tokens) {
      expect(text.slice(token.start, token.end)).toBe(token.text)
    }
  })
})

// ---------------------------------------------------------------------------
// splitClauses()
// ---------------------------------------------------------------------------
describe('splitClauses()', () => {
  it('returns empty array for empty string', () => {
    expect(splitClauses('')).toEqual([])
  })

  it('returns single clause for a simple action with no splits', () => {
    expect(splitClauses('Click Save.')).toHaveLength(1)
  })

  it('splits "Open settings, change language and save." into 3 clauses', () => {
    const clauses = splitClauses('Open settings, change language and save.')
    expect(clauses).toHaveLength(3)
    expect(clauses[0]).toMatch(/open settings/i)
    expect(clauses[1]).toMatch(/change language/i)
    expect(clauses[2]).toMatch(/save/i)
  })

  it('splits "Close flip and reopen the app." on "and"', () => {
    const clauses = splitClauses('Close flip and reopen the app.')
    expect(clauses.length).toBeGreaterThanOrEqual(2)
  })

  it('splits on semicolon', () => {
    const clauses = splitClauses('Open settings; click Accounts.')
    expect(clauses).toHaveLength(2)
  })

  it('splits on sentence boundary', () => {
    const clauses = splitClauses('Click Save. The file is saved.')
    expect(clauses).toHaveLength(2)
  })

  it('returns no empty strings', () => {
    const clauses = splitClauses('Open settings, change language and save.')
    for (const c of clauses) {
      expect(c.trim().length).toBeGreaterThan(0)
    }
  })

  it('handles text with no clause boundaries (single clause)', () => {
    const clauses = splitClauses('Navigate to the settings page')
    expect(clauses).toHaveLength(1)
  })

  it('splits ", then" as a clause separator', () => {
    const clauses = splitClauses('Open the app, then click Settings.')
    expect(clauses.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// isImperativeStart()
// ---------------------------------------------------------------------------
describe('isImperativeStart()', () => {
  it('returns false for empty string', () => {
    expect(isImperativeStart('')).toBe(false)
  })

  it('returns true for "Click" (imperative verb)', () => {
    expect(isImperativeStart('Click the button')).toBe(true)
  })

  it('returns true for "Open" (imperative verb)', () => {
    expect(isImperativeStart('Open any application')).toBe(true)
  })

  it('returns true for "Navigate" (imperative verb)', () => {
    expect(isImperativeStart('Navigate to the settings page')).toBe(true)
  })

  it('returns true for "Verify" (imperative verb — even though it is a verification verb)', () => {
    // isImperativeStart doesn't know about verb ownership; it only detects grammatical form
    expect(isImperativeStart('Verify the total is 100')).toBe(true)
  })

  it('returns false for "The menu" (noun phrase start)', () => {
    expect(isImperativeStart('The menu should appear')).toBe(false)
  })

  it('returns false for "should appear" (modal auxiliary start)', () => {
    expect(isImperativeStart('should appear')).toBe(false)
  })

  it('returns false for "The monitor is not connected" (declarative state)', () => {
    expect(isImperativeStart('The monitor is not connected')).toBe(false)
  })

  it('returns false for punctuation-only text', () => {
    expect(isImperativeStart('...')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// findWords()
// ---------------------------------------------------------------------------
describe('findWords()', () => {
  it('returns empty array for empty text', () => {
    expect(findWords('', ['quickly'])).toEqual([])
  })

  it('returns empty array for empty word list', () => {
    expect(findWords('Check the page loads quickly', [])).toEqual([])
  })

  it('finds "quickly" with correct offsets', () => {
    const text = 'Check the page loads quickly'
    const spans = findWords(text, ['quickly'])
    expect(spans).toHaveLength(1)
    expect(spans[0]!.text.toLowerCase()).toBe('quickly')
    expect(text.slice(spans[0]!.start, spans[0]!.end).toLowerCase()).toBe('quickly')
  })

  it('returns empty array when word is not present', () => {
    const spans = findWords('Click the button', ['quickly'])
    expect(spans).toEqual([])
  })

  it('matches case-insensitively', () => {
    const spans = findWords('VERIFY the total', ['verify'])
    expect(spans).toHaveLength(1)
    expect(spans[0]!.start).toBe(0)
  })

  it('does not match partial words ("check" does not match "checkbox")', () => {
    const spans = findWords('Click the checkbox', ['check'])
    expect(spans).toHaveLength(0)
  })

  it('finds multiple words from the list', () => {
    const text = 'Check the page and verify the total'
    const spans = findWords(text, ['check', 'verify'])
    expect(spans).toHaveLength(2)
  })

  it('finds multi-word phrase "in case"', () => {
    const text = 'Press Esc in case the dialog does not close'
    const spans = findWords(text, ['in case'])
    expect(spans).toHaveLength(1)
    expect(text.slice(spans[0]!.start, spans[0]!.end).toLowerCase()).toBe('in case')
  })

  it('finds multi-word phrase "depending on"', () => {
    const text = 'Proceed depending on the result'
    const spans = findWords(text, ['depending on'])
    expect(spans).toHaveLength(1)
  })

  it('returns spans sorted by start offset', () => {
    const text = 'verify and then check the result'
    const spans = findWords(text, ['check', 'verify'])
    expect(spans[0]!.start).toBeLessThan(spans[1]!.start)
  })

  it('span start and end offsets correctly index into the original text', () => {
    const text = 'The page loads quickly and properly'
    const spans = findWords(text, ['quickly', 'properly'])
    for (const span of spans) {
      expect(text.slice(span.start, span.end).toLowerCase()).toBe(span.text.toLowerCase())
    }
  })

  // Req 2.2: offsets are accurate
  it('Req 2.2 — offsets are accurate for a verification verb in a step action', () => {
    const action = 'Close flip and check app continuity'
    const spans = findWords(action, ['check'])
    expect(spans).toHaveLength(1)
    const span = spans[0]!
    expect(action.slice(span.start, span.end).toLowerCase()).toBe('check')
  })

  // Req 10.2: word list exclusivity
  it('Req 10.2 — finds "if" from subordinating conjunctions list, not from another list', () => {
    const text = 'If you have a USB drive, plug it in'
    const spans = findWords(text, ['if'])
    expect(spans).toHaveLength(1)
  })
})


// ---------------------------------------------------------------------------
// isImperativeStart() — compromise mis-tag fixes (COMMON_ACTION_VERBS fallback)
// ---------------------------------------------------------------------------
describe('isImperativeStart() — compromise mis-tag fixes', () => {
  it('"Close flip" → true (compromise mis-tags "Close" as Adjective)', () => {
    expect(isImperativeStart('Close flip')).toBe(true)
  })

  it('"Check the page title" → true (compromise mis-tags "Check" as Noun)', () => {
    expect(isImperativeStart('Check the page title')).toBe(true)
  })

  it('"then click Settings" → true (leading connector skipped)', () => {
    expect(isImperativeStart('then click Settings')).toBe(true)
  })

  it('"The close button is visible" → false (noun phrase start, "close" is not the first word)', () => {
    expect(isImperativeStart('The close button is visible')).toBe(false)
  })

  it('"and reopen the app" → true (leading "and" skipped, "reopen" is an action verb)', () => {
    expect(isImperativeStart('and reopen the app')).toBe(true)
  })

  it('"also save the file" → true (leading "also" skipped)', () => {
    expect(isImperativeStart('also save the file')).toBe(true)
  })

  it('"please select an option" → true (leading "please" skipped)', () => {
    expect(isImperativeStart('please select an option')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// splitClauses() + isImperativeStart() integration
// ---------------------------------------------------------------------------
describe('splitClauses() + isImperativeStart() integration', () => {
  it('"Close flip and reopen the app." → 2 clauses, both imperative', () => {
    const clauses = splitClauses('Close flip and reopen the app.')
    expect(clauses).toHaveLength(2)
    for (const clause of clauses) {
      expect(isImperativeStart(clause)).toBe(true)
    }
  })

  it('"Open settings, change language and save." → 3 clauses, all imperative', () => {
    const clauses = splitClauses('Open settings, change language and save.')
    expect(clauses).toHaveLength(3)
    for (const clause of clauses) {
      expect(isImperativeStart(clause)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// hasStateDescription()
// ---------------------------------------------------------------------------
import { hasStateDescription } from '../../src/text/utils.js'

describe('hasStateDescription()', () => {
  it.each([
    'The monitor is not connected, and the PC is not paired.',
    'The user is already logged in.',
    'Make sure the user is logged in.',
    'Ensure that the file is saved.',
    'Wi-Fi has been enabled.',
    'The dialog is open.',
    'The app is broken.',
    'The user is gone.',
    'The file is read.',
    'The password has been reset.',
  ])('"%s" → true', text => {
    expect(hasStateDescription(text)).toBe(true)
  })

  it.each([
    '',
    'Click Save.',
    'Make sure to click Save.',
    'Open settings, change language and save.',
    'Log in as the admin user.',
    'The page is loading.',
    'The total is 100.',
    'The button is then clicked.',
  ])('"%s" → false', text => {
    expect(hasStateDescription(text)).toBe(false)
  })
})

describe('isImperativeStart() — multi-word verbs and tag() cache', () => {
  it.each(['Log in as admin', 'Log out of the app', 'Sign in with Google'])('"%s" → true', text => {
    expect(isImperativeStart(text)).toBe(true)
  })

  it('tag() returns the same result for repeated text (cached)', () => {
    const a = tag('Open settings, change language and save.')
    const b = tag('Open settings, change language and save.')
    expect(b).toBe(a)
    expect(b.map(t => t.normal)).toEqual(a.map(t => t.normal))
  })
})

describe('isDeclarativeClause', () => {
  const declarative = (s: string) => {
    const info = imperativeStartInfo(s)
    return info ? isDeclarativeClause(info) : null
  }

  it.each(['Close button is disabled.', 'Message appears.', 'Save button is enabled.'])(
    '"%s" → statement',
    s => expect(declarative(s)).toBe(true),
  )

  it.each(['Open the file that is saved in Documents.', 'Close the dialog.', 'Click Save so the file is stored.', 'Select the option which is checked.'])(
    '"%s" → command',
    s => expect(declarative(s)).toBe(false),
  )
})

describe('hasStateDescription — "has/have/had" + participle', () => {
  it.each(['The app has started.', 'The device has connected.', 'Drivers had been installed.'])('"%s" → true', s => {
    expect(hasStateDescription(s)).toBe(true)
  })
  it.each(['User has an account.', 'The user has admin rights.', 'The user has to log in.'])('"%s" → false', s => {
    expect(hasStateDescription(s)).toBe(false)
  })
})

describe('isDeclarativeClause — noun subjects with a preposition', () => {
  it('"Set of items is loaded." → statement ("Set" is a noun here)', () => {
    const info = imperativeStartInfo('Set of items is loaded.')!
    expect(info.via).toBe('list')
    expect(isDeclarativeClause(info)).toBe(true)
  })
  it.each(['Switch to the tab that is open.', 'Set to 50 and press Enter.'])('"%s" → command', s => {
    expect(isDeclarativeClause(imperativeStartInfo(s)!)).toBe(false)
  })
})

describe('review follow-ups from the benchmark', () => {
  it('"right-click" and "double-click" start a command (compromise splits them)', () => {
    expect(imperativeStartInfo('Right-click the applet')?.normal).toBe('right-click')
    expect(imperativeStartInfo('Double-click the file')?.word).toBe('Double-click')
  })

  it('"is running" is a state; "is loading" is not', () => {
    expect(hasStateDescription('The window is running.')).toBe(true)
    expect(hasStateDescription('The page is loading.')).toBe(false)
  })
})
