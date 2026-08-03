import { describe, expect, it } from 'vitest'
import {
  appendChildAtPath,
  getAtPath,
  insertAtPath,
  isSelfOrDescendantPath,
  isValidShellTreeDestination,
  moveShellSubtree,
  removeAtPath,
  subtreeHeight,
  type ShellTreeDestination,
} from '../../dev-runtime/shell-config-panel/shell-tree-mutations'

interface Item {
  label: string
  children?: Item[]
}

function leaf(label: string): Item {
  return { label }
}

function branch(label: string, children: Item[]): Item {
  return { label, children }
}

describe('getAtPath', () => {
  const tree: Item[] = [
    leaf('root-0'),
    branch('root-1', [leaf('root-1-0'), branch('root-1-1', [leaf('root-1-1-0'), leaf('root-1-1-1')])]),
  ]

  it('resolves a root-level node', () => {
    expect(getAtPath(tree, '0')).toEqual(leaf('root-0'))
  })

  it('resolves a node nested one level deep', () => {
    expect(getAtPath(tree, '1.0')).toEqual(leaf('root-1-0'))
  })

  it('resolves a node nested three levels deep', () => {
    expect(getAtPath(tree, '1.1.1')).toEqual(leaf('root-1-1-1'))
  })

  it('returns null when the last segment is out of range', () => {
    expect(getAtPath(tree, '1.1.5')).toBeNull()
  })

  it('returns null when an intermediate segment is out of range', () => {
    expect(getAtPath(tree, '5.0')).toBeNull()
  })

  it('returns null when descending through a leaf node that has no children', () => {
    expect(getAtPath(tree, '0.0')).toBeNull()
  })
})

describe('removeAtPath / insertAtPath / appendChildAtPath', () => {
  it('removeAtPath does not mutate the original tree', () => {
    const original: Item[] = [leaf('A'), leaf('B'), leaf('C')]
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = removeAtPath(original, '1')

    expect(original).toEqual(snapshot)
    expect(result).toEqual([leaf('A'), leaf('C')])
  })

  it('removeAtPath removes a nested node without touching its siblings', () => {
    const original: Item[] = [branch('root', [leaf('a'), leaf('b'), leaf('c')])]
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = removeAtPath(original, '0.1')

    expect(original).toEqual(snapshot)
    expect(result).toEqual([branch('root', [leaf('a'), leaf('c')])])
  })

  it('insertAtPath with parentPath "" inserts into the root list without mutating the original', () => {
    const original: Item[] = [leaf('A'), leaf('B')]
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = insertAtPath(original, '', 1, leaf('NEW'))

    expect(original).toEqual(snapshot)
    expect(result).toEqual([leaf('A'), leaf('NEW'), leaf('B')])
  })

  it('insertAtPath with an existing node\'s parentPath inserts into its children', () => {
    const original: Item[] = [branch('root', [leaf('a'), leaf('c')])]
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = insertAtPath(original, '0', 1, leaf('b'))

    expect(original).toEqual(snapshot)
    expect(result).toEqual([branch('root', [leaf('a'), leaf('b'), leaf('c')])])
  })

  it('appendChildAtPath appends to the end of an already non-empty children array, preserving order', () => {
    const original: Item[] = [branch('root', [leaf('a'), leaf('b')])]
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = appendChildAtPath(original, '0', leaf('c'))

    expect(original).toEqual(snapshot)
    expect(result).toEqual([branch('root', [leaf('a'), leaf('b'), leaf('c')])])
  })

  it('appendChildAtPath on a leaf node (no children defined) creates children: [node] instead of failing', () => {
    const original: Item[] = [leaf('root')]
    const snapshot = JSON.parse(JSON.stringify(original))

    const result = appendChildAtPath(original, '0', leaf('only-child'))

    expect(original).toEqual(snapshot)
    expect(result).toEqual([branch('root', [leaf('only-child')])])
  })
})

describe('isSelfOrDescendantPath', () => {
  it('is true for the same path', () => {
    expect(isSelfOrDescendantPath('0.1', '0.1')).toBe(true)
  })

  it('is true for a direct descendant', () => {
    expect(isSelfOrDescendantPath('0.1', '0')).toBe(true)
  })

  it('is true for an indirect descendant', () => {
    expect(isSelfOrDescendantPath('0.1.2', '0')).toBe(true)
  })

  it('is false for a sibling', () => {
    expect(isSelfOrDescendantPath('1', '0')).toBe(false)
  })

  it('is false for a path that shares a textual prefix without being a real descendant', () => {
    expect(isSelfOrDescendantPath('01', '0')).toBe(false)
  })
})

describe('subtreeHeight', () => {
  it('is 0 for a node without children', () => {
    expect(subtreeHeight(leaf('a'))).toBe(0)
  })

  it('is 1 for a node whose children are all leaves', () => {
    expect(subtreeHeight(branch('a', [leaf('b'), leaf('c')]))).toBe(1)
  })

  it('is the max of unequal branch heights, not the sum', () => {
    const node = branch('root', [leaf('shallow'), branch('deep', [branch('deeper', [leaf('deepest')])])])
    expect(subtreeHeight(node)).toBe(3)
  })
})

describe('isValidShellTreeDestination with maxDepth: 1 (header)', () => {
  const tree: Item[] = [
    leaf('root-0'),
    branch('root-1', [leaf('root-1-0')]),
    branch('root-2-with-children', [leaf('root-2-0')]),
  ]

  it('accepts a nest destination on a root item (depth 0)', () => {
    const destination: ShellTreeDestination = { type: 'nest', path: '1' }
    expect(isValidShellTreeDestination(tree, '0', destination, 1)).toBe(true)
  })

  it('rejects a nest destination on an item already at depth 1', () => {
    const destination: ShellTreeDestination = { type: 'nest', path: '1.0' }
    expect(isValidShellTreeDestination(tree, '0', destination, 1)).toBe(false)
  })

  it('accepts a gap destination with parentPath "" regardless of depth', () => {
    const destination: ShellTreeDestination = { type: 'gap', parentPath: '', index: 1 }
    expect(isValidShellTreeDestination(tree, '0', destination, 1)).toBe(true)
  })

  it('rejects nesting a branch with subtreeHeight 1 onto the body of another root item', () => {
    const destination: ShellTreeDestination = { type: 'nest', path: '0' }
    expect(isValidShellTreeDestination(tree, '2', destination, 1)).toBe(false)
  })
})

describe('isValidShellTreeDestination with maxDepth: null (sidebar)', () => {
  const deepTree: Item[] = [
    leaf('root-0'),
    branch('root-1', [branch('root-1-0', [branch('root-1-0-0', [leaf('root-1-0-0-0')])])]),
  ]

  it('accepts a nest destination regardless of source subtree height', () => {
    const destination: ShellTreeDestination = { type: 'nest', path: '0' }
    expect(isValidShellTreeDestination(deepTree, '1', destination, null)).toBe(true)
  })

  it('accepts a gap destination at any depth', () => {
    const destination: ShellTreeDestination = { type: 'gap', parentPath: '1.0.0', index: 1 }
    expect(isValidShellTreeDestination(deepTree, '0', destination, null)).toBe(true)
  })
})

describe('isValidShellTreeDestination cycle rejection', () => {
  const tree: Item[] = [branch('root-0', [branch('root-0-0', [leaf('root-0-0-0')])])]

  it('rejects a nest destination equal to sourcePath itself with maxDepth 1', () => {
    const destination: ShellTreeDestination = { type: 'nest', path: '0' }
    expect(isValidShellTreeDestination(tree, '0', destination, 1)).toBe(false)
  })

  it('rejects a nest destination on a descendant of sourcePath with maxDepth null', () => {
    const destination: ShellTreeDestination = { type: 'nest', path: '0.0.0' }
    expect(isValidShellTreeDestination(tree, '0', destination, null)).toBe(false)
  })

  it('rejects a gap destination whose parentPath is sourcePath itself with maxDepth 1', () => {
    const destination: ShellTreeDestination = { type: 'gap', parentPath: '0', index: 0 }
    expect(isValidShellTreeDestination(tree, '0', destination, 1)).toBe(false)
  })

  it('rejects a gap destination whose parentPath is a descendant of sourcePath with maxDepth null', () => {
    const destination: ShellTreeDestination = { type: 'gap', parentPath: '0.0', index: 0 }
    expect(isValidShellTreeDestination(tree, '0', destination, null)).toBe(false)
  })
})

describe('moveShellSubtree', () => {
  it('moves a root node to another root position (reorder) and remaps both the moved node and shifted siblings', () => {
    // A 3-item list exposes 4 gap zones (0..3); index 3 is "after C" — moving A (index 0) there
    // means A ends up last, even though index 3 is stale by one position once A is removed.
    const tree: Item[] = [leaf('A'), leaf('B'), leaf('C')]

    const { tree: result, pathRemap } = moveShellSubtree(tree, '0', { type: 'gap', parentPath: '', index: 3 })

    expect(result).toEqual([leaf('B'), leaf('C'), leaf('A')])
    expect(pathRemap.get('0')).toBe('2')
    expect(pathRemap.get('1')).toBe('0')
    expect(pathRemap.get('2')).toBe('1')
  })

  it('nests a root item onto another leaf root item, creating children: [node]', () => {
    const tree: Item[] = [leaf('A'), leaf('B')]

    const { tree: result, pathRemap } = moveShellSubtree(tree, '0', { type: 'nest', path: '1' })

    expect(result).toEqual([branch('B', [leaf('A')])])
    expect(pathRemap.get('0')).toBe('0.0')
  })

  it('nests a root item onto another item that already has children, appending at the end', () => {
    const tree: Item[] = [leaf('A'), branch('B', [leaf('existing')])]

    const { tree: result } = moveShellSubtree(tree, '0', { type: 'nest', path: '1' })

    expect(result).toEqual([branch('B', [leaf('existing'), leaf('A')])])
  })

  it('preserves the internal structure of a moved branch under its new base path, remapping every descendant', () => {
    const movedBranch = branch('moved', [leaf('child-0'), branch('child-1', [leaf('grandchild')])])
    const tree: Item[] = [leaf('other'), movedBranch]

    const { tree: result, pathRemap } = moveShellSubtree(tree, '1', { type: 'gap', parentPath: '', index: 0 })

    expect(result).toEqual([movedBranch, leaf('other')])
    // Moved node: old base path '1' -> new base path '0'; every descendant keeps the same
    // relative suffix under its new base.
    expect(pathRemap.get('1')).toBe('0')
    expect(pathRemap.get('1.0')).toBe('0.0')
    expect(pathRemap.get('1.1')).toBe('0.1')
    expect(pathRemap.get('1.1.0')).toBe('0.1.0')
  })

  it('moving an item to the only available gap of a single-element list does not throw and yields an equivalent tree', () => {
    const tree: Item[] = [leaf('only')]

    const { tree: result } = moveShellSubtree(tree, '0', { type: 'gap', parentPath: '', index: 0 })

    expect(result).toEqual([leaf('only')])
  })

  // Regression (found while implementing 0125-T5): `insertAtPath`'s `parentPath`/`appendChildAtPath`'s
  // `targetPath` used to be re-resolved by looking up, in a post-removal tree, the *original*
  // destination node's object identity — but removing a node rebuilds every ancestor along its own
  // path (new object, same address), so resolving a destination that is exactly the removed node's
  // own parent (the single most common case: reordering within a non-root `children` list) crashed
  // with "Cannot read properties of undefined (reading 'split')" instead of reordering. None of the
  // cases above exercise this because they only reorder within the *root* list (`parentPath: ''`,
  // resolved as a literal without any lookup) or move between two different root-level branches.
  it('reorders within a non-root children list without throwing (same-parent gap destination)', () => {
    const tree: Item[] = [branch('parent', [leaf('a'), leaf('b'), leaf('c')])]

    const { tree: result, pathRemap } = moveShellSubtree(tree, '0.0', { type: 'gap', parentPath: '0', index: 3 })

    expect(result).toEqual([branch('parent', [leaf('b'), leaf('c'), leaf('a')])])
    expect(pathRemap.get('0.0')).toBe('0.2')
    expect(pathRemap.get('0.1')).toBe('0.0')
    expect(pathRemap.get('0.2')).toBe('0.1')
  })

  it('nests a child onto a sibling within the very same non-root children list without throwing', () => {
    const tree: Item[] = [branch('parent', [leaf('a'), leaf('b')])]

    const { tree: result } = moveShellSubtree(tree, '0.0', { type: 'nest', path: '0.1' })

    expect(result).toEqual([branch('parent', [branch('b', [leaf('a')])])])
  })
})
