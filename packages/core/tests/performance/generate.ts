/**
 * Generates realistic, unique synthetic test steps for the performance test.
 * Every step text is different (so the tag cache cannot hide the cost), and
 * the mix covers all 7 smells plus clean steps.
 */

import type { TestSuite } from '../../src/models/index.js'

const OBJECTS = [
  'invoice', 'profile', 'report', 'account', 'settings', 'dashboard', 'message', 'calendar', 'contact', 'payment',
  'order', 'device', 'language', 'password', 'address', 'card', 'statement', 'alert', 'document', 'session',
]

const ACTIONS: ((a: string, b: string) => string)[] = [
  (a) => `Click the ${a} tab.`,
  (a) => `Open the ${a} page.`,
  (a, b) => `Open ${a}, change ${b} and save.`,
  (a) => `If the ${a} dialog opens, click OK.`,
  (a) => `Verify the ${a} total is 100.`,
  (a) => `The ${a} list should appear.`,
  (a) => `Reload the ${a} page quickly.`,
  (a) => `Open any ${a} and close it.`,
  (a, b) => `Select the ${a} and press Enter in the ${b} field.`,
  (a) => `Type ${a} in the search box.`,
  (a) => `The ${a} account is already set up.`,
]

const VERIFICATIONS: ((a: string) => string)[] = [
  (a) => `The ${a} page is shown.`,
  (a) => `Click OK to continue to ${a}.`,
  (a) => `A ${a} message appears.`,
  (a) => `The ${a} works.`,
  () => '',
]

/** Build a suite with `cases × stepsPerCase` steps; `seed` makes every text unique. */
export function generateSuite(cases: number, stepsPerCase: number, seed: string): TestSuite {
  let n = 0
  const word = () => {
    const w = `${OBJECTS[n % OBJECTS.length]}${seed}${Math.floor(n / OBJECTS.length)}`
    n++
    return w
  }
  return {
    id: `perf-${seed}`,
    name: `Performance suite ${seed}`,
    cases: Array.from({ length: cases }, (_, c) => ({
      id: `perf-${seed}-${c}`,
      title: `Generated case ${c}`,
      preconditions: [],
      steps: Array.from({ length: stepsPerCase }, (_, s) => {
        const action = ACTIONS[(c + s) % ACTIONS.length]!(word(), word())
        const verification = VERIFICATIONS[(c * 3 + s) % VERIFICATIONS.length]!(word())
        return { index: s, action, verifications: verification ? [verification] : [] }
      }),
    })),
  }
}
