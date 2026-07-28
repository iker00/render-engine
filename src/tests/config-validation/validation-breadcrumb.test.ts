import { describe, it, expect } from 'vitest'
import type { ContainerLayoutNode, FormLayoutNode, InputLayoutNode, HeadingLayoutNode, ButtonLayoutNode, RuntimeConfigError } from '../../config/runtime-config-types'
import {
  buildBreadcrumbSegment,
  buildBreadcrumbSegmentFromNode,
  formatBreadcrumb,
  buildNodeExcerpt,
  buildNodeExcerptFromNode,
  enrichErrorMessage,
  enrichedInvalidLayout,
  enrichErrorResult,
  type BreadcrumbSegment,
} from '../../config/validation-breadcrumb'

describe('buildBreadcrumbSegment', () => {
  it('uses id qualifier for node with id', () => {
    const rawNode = { type: 'form', id: 'user', children: [] }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('form("user")')
  })

  it('uses id qualifier for modal with id', () => {
    const rawNode = { type: 'modal', id: 'confirm-dialog', children: [] }
    const segment = buildBreadcrumbSegment(rawNode, 2)
    expect(segment.label).toBe('modal("confirm-dialog")')
  })

  it('uses props.fieldId for input node', () => {
    const rawNode = { type: 'input', props: { fieldId: 'name', label: 'Name' } }
    const segment = buildBreadcrumbSegment(rawNode, 1)
    expect(segment.label).toBe('input(fieldId: "name")')
  })

  it('uses props.fieldId for textarea node', () => {
    const rawNode = { type: 'textarea', props: { fieldId: 'bio', label: 'Bio' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('textarea(fieldId: "bio")')
  })

  it('uses props.fieldId for select node', () => {
    const rawNode = { type: 'select', props: { fieldId: 'role', label: 'Role', items: [] } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('select(fieldId: "role")')
  })

  it('uses props.fieldId for radioGroup node', () => {
    const rawNode = { type: 'radioGroup', props: { fieldId: 'color', label: 'Color', items: [] } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('radioGroup(fieldId: "color")')
  })

  it('uses props.fieldId for checkboxGroup node', () => {
    const rawNode = { type: 'checkboxGroup', props: { fieldId: 'tags', label: 'Tags', items: [] } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('checkboxGroup(fieldId: "tags")')
  })

  it('uses props.fieldId for toggle node', () => {
    const rawNode = { type: 'toggle', props: { fieldId: 'active', label: 'Active' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('toggle(fieldId: "active")')
  })

  it('uses props.fieldId for fileInput node', () => {
    const rawNode = { type: 'fileInput', props: { fieldId: 'avatar', label: 'Avatar' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('fileInput(fieldId: "avatar")')
  })

  it('uses props.label for button node', () => {
    const rawNode = { type: 'button', props: { label: 'Submit' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('button("Submit")')
  })

  it('uses props.label for accordion node', () => {
    const rawNode = { type: 'accordion', props: { label: 'Details' } }
    const segment = buildBreadcrumbSegment(rawNode, 1)
    expect(segment.label).toBe('accordion("Details")')
  })

  it('uses props.label for badge node', () => {
    const rawNode = { type: 'badge', props: { label: 'New' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('badge("New")')
  })

  it('uses props.label for link node', () => {
    const rawNode = { type: 'link', props: { label: 'Go back' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('link("Go back")')
  })

  it('uses props.text for heading node', () => {
    const rawNode = { type: 'heading', props: { text: 'Datos personales', level: 2 } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('heading("Datos personales")')
  })

  it('uses props.text for paragraph node', () => {
    const rawNode = { type: 'paragraph', props: { text: 'Welcome message' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('paragraph("Welcome message")')
  })

  it('uses props.operationName for fileManager node', () => {
    const rawNode = { type: 'fileManager', props: { operationName: 'uploadFiles' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('fileManager(operationName: "uploadFiles")')
  })

  it('uses positional index for node without identifier (container)', () => {
    const rawNode = { type: 'container', children: [] }
    const segment = buildBreadcrumbSegment(rawNode, 3)
    expect(segment.label).toBe('container[3]')
  })

  it('uses positional index for divider node', () => {
    const rawNode = { type: 'divider' }
    const segment = buildBreadcrumbSegment(rawNode, 5)
    expect(segment.label).toBe('divider[5]')
  })

  it('uses positional index for repeater node', () => {
    const rawNode = { type: 'repeater', props: { items: { source: 'queries.data', key: 'id' }, template: [] } }
    const segment = buildBreadcrumbSegment(rawNode, 2)
    expect(segment.label).toBe('repeater[2]')
  })

  it('uses positional index for node type not in heuristic', () => {
    const rawNode = { type: 'unknownType' }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('unknownType[0]')
  })

  it('truncates identifier exceeding 30 characters', () => {
    const longId = 'a'.repeat(35)
    const rawNode = { type: 'form', id: longId }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe(`form("${'a'.repeat(30)}...")`)
  })

  it('does not truncate identifier exactly 30 characters', () => {
    const exactId = 'a'.repeat(30)
    const rawNode = { type: 'form', id: exactId }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe(`form("${exactId}")`)
  })

  it('prefers id over type-specific prop', () => {
    const rawNode = { type: 'input', id: 'my-input', props: { fieldId: 'name', label: 'Name' } }
    const segment = buildBreadcrumbSegment(rawNode, 0)
    expect(segment.label).toBe('input("my-input")')
  })
})

describe('buildBreadcrumbSegmentFromNode', () => {
  it('uses id qualifier for FormLayoutNode', () => {
    const node: FormLayoutNode = {
      type: 'form',
      id: 'user',
    }
    const segment = buildBreadcrumbSegmentFromNode(node, 0)
    expect(segment.label).toBe('form("user")')
  })

  it('uses props.fieldId for InputLayoutNode', () => {
    const node: InputLayoutNode = {
      type: 'input',
      props: { fieldId: 'name', label: 'Name' },
    }
    const segment = buildBreadcrumbSegmentFromNode(node, 1)
    expect(segment.label).toBe('input(fieldId: "name")')
  })

  it('uses props.label for ButtonLayoutNode', () => {
    const node: ButtonLayoutNode = {
      type: 'button',
      props: { label: 'Submit' },
    }
    const segment = buildBreadcrumbSegmentFromNode(node, 0)
    expect(segment.label).toBe('button("Submit")')
  })

  it('uses props.text for HeadingLayoutNode', () => {
    const node: HeadingLayoutNode = {
      type: 'heading',
      props: { text: 'Title', level: 1 },
    }
    const segment = buildBreadcrumbSegmentFromNode(node, 0)
    expect(segment.label).toBe('heading("Title")')
  })

  it('uses positional index for ContainerLayoutNode without id', () => {
    const node: ContainerLayoutNode = {
      type: 'container',
    }
    const segment = buildBreadcrumbSegmentFromNode(node, 2)
    expect(segment.label).toBe('container[2]')
  })
})

describe('formatBreadcrumb', () => {
  it('returns single segment without separator', () => {
    const segments: BreadcrumbSegment[] = [{ label: 'container[0]' }]
    expect(formatBreadcrumb(segments)).toBe('container[0]')
  })

  it('separates multiple segments with " > "', () => {
    const segments: BreadcrumbSegment[] = [
      { label: 'container[0]' },
      { label: 'heading("Title")' },
    ]
    expect(formatBreadcrumb(segments)).toBe('container[0] > heading("Title")')
  })

  it('returns empty string for empty array', () => {
    expect(formatBreadcrumb([])).toBe('')
  })
})

describe('buildNodeExcerpt', () => {
  it('includes type + fieldId + label when present', () => {
    const rawNode = {
      type: 'input',
      props: { fieldId: 'name', label: 'Nombre', placeholder: 'Enter name', validations: { required: { value: true } } },
      visibility: { reference: 'forms.x.y', operator: 'equals', value: 'a' },
    }
    const excerpt = buildNodeExcerpt(rawNode)
    expect(excerpt).toBe('{"type":"input","props":{"fieldId":"name","label":"Nombre"}}')
  })

  it('includes type + id when present', () => {
    const rawNode = {
      type: 'form',
      id: 'user',
      children: [{ type: 'input', props: { fieldId: 'x', label: 'X' } }],
      submitAction: { type: 'executeOperation', operationName: 'submit' },
    }
    const excerpt = buildNodeExcerpt(rawNode)
    expect(excerpt).toBe('{"type":"form","id":"user"}')
  })

  it('includes type + props.text when present', () => {
    const rawNode = {
      type: 'heading',
      props: { text: 'Welcome', level: 2, icon: 'star' },
    }
    const excerpt = buildNodeExcerpt(rawNode)
    expect(excerpt).toBe('{"type":"heading","props":{"text":"Welcome"}}')
  })

  it('includes only type when no identifying props', () => {
    const rawNode = {
      type: 'container',
      children: [{ type: 'heading', props: { text: 'Title', level: 1 } }],
      props: { direction: 'column', gap: '4' },
    }
    const excerpt = buildNodeExcerpt(rawNode)
    expect(excerpt).toBe('{"type":"container"}')
  })

  it('does not include children, visibility, queryStateFeedback, layout, or full props', () => {
    const rawNode = {
      type: 'input',
      props: {
        fieldId: 'email',
        label: 'Email',
        placeholder: 'test@test.com',
        inputType: 'email',
        validations: { required: { value: true }, email: { value: true } },
      },
      children: [{ type: 'heading' }],
      visibility: { reference: 'forms.x.y', operator: 'equals', value: 'a' },
      queryStateFeedback: { query: 'posts', states: {} },
      layout: { span: 6 },
    }
    const excerpt = buildNodeExcerpt(rawNode)
    const parsed = JSON.parse(excerpt)
    expect(parsed).not.toHaveProperty('children')
    expect(parsed).not.toHaveProperty('visibility')
    expect(parsed).not.toHaveProperty('queryStateFeedback')
    expect(parsed).not.toHaveProperty('layout')
    expect(parsed.props).not.toHaveProperty('placeholder')
    expect(parsed.props).not.toHaveProperty('inputType')
    expect(parsed.props).not.toHaveProperty('validations')
    expect(parsed).toEqual({ type: 'input', props: { fieldId: 'email', label: 'Email' } })
  })

  it('includes props.operationName for fileManager', () => {
    const rawNode = {
      type: 'fileManager',
      props: { operationName: 'uploadDocs', fieldName: 'file', multiple: true },
    }
    const excerpt = buildNodeExcerpt(rawNode)
    expect(excerpt).toBe('{"type":"fileManager","props":{"operationName":"uploadDocs","fieldName":"file"}}')
  })
})

describe('buildNodeExcerptFromNode', () => {
  it('extracts identifying props from typed LayoutNode', () => {
    const node: InputLayoutNode = {
      type: 'input',
      props: { fieldId: 'name', label: 'Name' },
    }
    const excerpt = buildNodeExcerptFromNode(node)
    expect(excerpt).toBe('{"type":"input","props":{"fieldId":"name","label":"Name"}}')
  })

  it('extracts id from FormLayoutNode', () => {
    const node: FormLayoutNode = {
      type: 'form',
      id: 'contact',
    }
    const excerpt = buildNodeExcerptFromNode(node)
    expect(excerpt).toBe('{"type":"form","id":"contact"}')
  })

  it('includes only type for ContainerLayoutNode without identifying props', () => {
    const node: ContainerLayoutNode = {
      type: 'container',
      props: { direction: 'column', gap: '4' },
    }
    const excerpt = buildNodeExcerptFromNode(node)
    expect(excerpt).toBe('{"type":"container"}')
  })
})

describe('enrichErrorMessage', () => {
  it('appends breadcrumb and excerpt lines when breadcrumb is not empty', () => {
    const message = 'Page "home" has an invalid layout at "layout[0].props.fieldId".'
    const breadcrumb = 'container[0] > input(fieldId: "name")'
    const excerpt = '{"type":"input","props":{"fieldId":"name","label":"Name"}}'

    const result = enrichErrorMessage(message, breadcrumb, excerpt)

    expect(result).toBe(
      'Page "home" has an invalid layout at "layout[0].props.fieldId".\n' +
      '  → container[0] > input(fieldId: "name")\n' +
      '  Node: {"type":"input","props":{"fieldId":"name","label":"Name"}}',
    )
  })

  it('returns original message when breadcrumb is empty', () => {
    const message = 'Page "home" has an invalid layout at "layout".'
    const result = enrichErrorMessage(message, '', '{"type":"container"}')
    expect(result).toBe(message)
  })
})

describe('enrichedInvalidLayout', () => {
  it('returns error shape with enriched message', () => {
    const rawNode = { type: 'input', props: { fieldId: 'name', label: 'Name' } }
    const breadcrumb: BreadcrumbSegment[] = [
      { label: 'container[0]' },
      { label: 'input(fieldId: "name")' },
    ]
    const message = 'Page "home" has an invalid layout at "layout[0].children[1].props.validations.required".'

    const result = enrichedInvalidLayout(message, breadcrumb, rawNode)

    expect(result.status).toBe('error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.displayMode).toBe('development-only')
    expect(result.error.message).toBe(
      'Page "home" has an invalid layout at "layout[0].children[1].props.validations.required".\n' +
      '  → container[0] > input(fieldId: "name")\n' +
      '  Node: {"type":"input","props":{"fieldId":"name","label":"Name"}}',
    )
  })

  it('returns unenriched message when breadcrumb is empty', () => {
    const rawNode = { type: 'container' }
    const message = 'Page "home" has an invalid layout at "layout".'

    const result = enrichedInvalidLayout(message, [], rawNode)

    expect(result.error.message).toBe(message)
  })
})

describe('enrichErrorResult', () => {
  it('enriches existing error result message', () => {
    const original: { status: 'error'; error: RuntimeConfigError } = {
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Page "home" has an invalid layout at "layout[0].props.label".',
      },
    }
    const breadcrumb: BreadcrumbSegment[] = [{ label: 'button("Submit")' }]
    const rawNode = { type: 'button', props: { label: 'Submit' } }

    const result = enrichErrorResult(original, breadcrumb, rawNode)

    expect(result.status).toBe('error')
    expect(result.error.code).toBe('invalid-layout')
    expect(result.error.displayMode).toBe('development-only')
    expect(result.error.message).toBe(
      'Page "home" has an invalid layout at "layout[0].props.label".\n' +
      '  → button("Submit")\n' +
      '  Node: {"type":"button","props":{"label":"Submit"}}',
    )
  })

  it('preserves original error when breadcrumb is empty', () => {
    const original: { status: 'error'; error: RuntimeConfigError } = {
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message: 'Some error.',
      },
    }
    const rawNode = { type: 'container' }

    const result = enrichErrorResult(original, [], rawNode)

    expect(result.error.message).toBe('Some error.')
  })
})
