import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithLayout } from './helpers'

function createFileManagerNode(propsOverrides: Record<string, unknown> = {}, nodeOverrides: Record<string, unknown> = {}) {
  return {
    type: 'fileManager',
    props: {
      fieldName: 'documentos',
      ...propsOverrides,
    },
    ...nodeOverrides,
  }
}

function createFullFileManagerNode() {
  return {
    type: 'fileManager',
    props: {
      fieldName: 'documentos',
      fileField: 'file',
      listPath: 'files',
      fileIdField: 'id',
      fileNameField: 'name',
      multiple: true,
      prefix: 'EXP',
      acceptExtension: ['.pdf', '.jpg'],
      getOperation: 'getDocuments',
      uploadOperation: 'uploadDocuments',
      deleteOperation: 'deleteDocument',
      viewOperation: 'viewDocument',
      downloadOperation: false,
      validations: {
        accept: { value: ['application/pdf', 'image/jpeg'] },
        maxFileSize: { value: 2 },
        maxTotalSize: { value: 10 },
        minFiles: { value: 0 },
        maxFiles: { value: 10 },
        validFileNames: { value: ['^FACT_\\d{4}_\\d{3}\\.pdf$'] },
      },
      pagination: {
        pageSize: 5,
      },
    },
  }
}

function createConfigWithFileManagerAndApi(
  fileManagerNode: Record<string, unknown>,
  api: Record<string, unknown> = {},
) {
  return {
    api: {
      getDocuments: { method: 'GET', endpoint: '/api/docs' },
      uploadDocuments: { method: 'POST', endpoint: '/api/docs/upload' },
      deleteDocument: { method: 'POST', endpoint: '/api/docs/delete' },
      viewDocument: { method: 'GET', endpoint: '/api/docs/view' },
      ...api,
    },
    pages: [
      {
        id: 'home',
        layout: [fileManagerNode],
      },
    ],
    initialPage: 'home',
  }
}

// ─── Shape acceptance tests (T6) ─────────────────────────────────────────────

describe('validateRuntimeConfig — fileManager node: acceptance (shape)', () => {
  it('accepts a fileManager node with all props populated', () => {
    const result = validateRuntimeConfig(createConfigWithFileManagerAndApi(createFullFileManagerNode()))
    expect(result.status).toBe('ready')
  })

  it('accepts a minimal fileManager node with only fieldName and no explicit operations', () => {
    const result = validateRuntimeConfig(createConfigWithLayout([createFileManagerNode()]))
    expect(result.status).toBe('ready')
  })

  it('accepts operations as string values', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        createFileManagerNode({ getOperation: 'getDocuments', uploadOperation: 'uploadDocuments' }),
      ),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts operations as false when at least one operation is not false (schema shape)', () => {
    // T6 shape test: false is a valid value for individual operation fields.
    // At least one operation must be enabled for the cross-check (T7) to pass.
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        createFileManagerNode({
          getOperation: 'getDocuments',
          uploadOperation: false,
          deleteOperation: false,
          viewOperation: false,
          downloadOperation: false,
        }),
      ),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts multiple: false', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ multiple: false })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts multiple: true', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ multiple: true })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts pagination with a valid pageSize', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ pagination: { pageSize: 10 } })]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts validations.accept as an array of strings', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { accept: { value: ['application/pdf'] } } }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts validations.maxFileSize as a number', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { maxFileSize: { value: 1 } } }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts validations.validFileNames as an array of strings (regex validation deferred to T7)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { validFileNames: { value: ['^FACT_.*\\.pdf$'] } } }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts layout.span, visibility and queryStateFeedback declared at node level', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode(
          {},
          {
            visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
            queryStateFeedback: { query: 'q' },
            layout: { span: 6 },
          },
        ),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts fileManager as a child of a container', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'container',
          children: [createFileManagerNode()],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts all operations mixed: string, false, and omitted', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        createFileManagerNode({
          getOperation: 'getDocuments',
          uploadOperation: false,
          // deleteOperation, viewOperation, downloadOperation are omitted
        }),
      ),
    )
    expect(result.status).toBe('ready')
  })
})

// ─── Shape rejection tests (T6) ──────────────────────────────────────────────

describe('validateRuntimeConfig — fileManager node: rejection (shape)', () => {
  it('rejects fileManager with type but missing props object entirely', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([{ type: 'fileManager' }]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('props')
    }
  })

  it('rejects fileManager when getOperation is true (only string | false allowed)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ getOperation: true })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('getOperation')
    }
  })

  it('rejects fileManager when uploadOperation is a number', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ uploadOperation: 42 })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('uploadOperation')
    }
  })

  it('rejects fileManager when multiple is not a boolean', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ multiple: 'yes' })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('multiple')
    }
  })

  it('rejects fileManager when pagination.pageSize is 0 (not a positive integer)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ pagination: { pageSize: 0 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('pagination')
    }
  })

  it('rejects fileManager when pagination.pageSize is negative', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ pagination: { pageSize: -1 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('pagination')
    }
  })

  it('rejects fileManager when pagination.pageSize is a non-integer', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ pagination: { pageSize: 2.5 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('pagination')
    }
  })

  it('rejects fileManager when validations.accept.value is not an array', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { accept: { value: 'application/pdf' } } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('validations')
    }
  })

  it('rejects fileManager when validations.maxFileSize.value is not a number', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { maxFileSize: { value: 'large' } } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('validations')
    }
  })

  it('rejects fileManager with invalid layout.span — error contains layout.span', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({}, { layout: { span: 99 } })]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout.span')
    }
  })
})

// ─── Cross-check tests (T7) ───────────────────────────────────────────────────

describe('validateRuntimeConfig — fileManager node: cross-checks (T7)', () => {
  // Rule 1: at least one operation must be enabled
  it('rejects when all operations are false with exact path .props', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({
          getOperation: false,
          uploadOperation: false,
          deleteOperation: false,
          viewOperation: false,
          downloadOperation: false,
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('layout[0].props')
      expect(result.error.message).toContain('at least one operation must be enabled')
    }
  })

  it('rejects when all operations are omitted and no fieldName is provided', () => {
    // No fieldName, no operations → at least one operation required
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        { type: 'fileManager', props: {} },
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('at least one operation must be enabled')
    }
  })

  // Rule 2: fieldName required when some operations are omitted
  it('rejects when some operations are omitted without fieldName', () => {
    // Explicitly create a raw node without fieldName and with only some operations declared
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi({
        type: 'fileManager',
        props: {
          // no fieldName — operations below are explicitly declared as strings, rest are omitted
          getOperation: 'getDocuments',
          // uploadOperation, deleteOperation, viewOperation, downloadOperation are omitted → need fieldName
        },
      }),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('fieldName')
      expect(result.error.message).toContain('fieldName is required when an operation is omitted')
    }
  })

  it('accepts mode with all operations declared as string or false — no fieldName needed', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        {
          type: 'fileManager',
          props: {
            // no fieldName
            getOperation: 'getDocuments',
            uploadOperation: 'uploadDocuments',
            deleteOperation: 'deleteDocument',
            viewOperation: 'viewDocument',
            downloadOperation: false,
          },
        },
      ),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts legacy mode with fieldName and all operations omitted', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([createFileManagerNode({ fieldName: 'documentos' })]),
    )
    expect(result.status).toBe('ready')
  })

  // Rule 3: declared operations must exist in config.api
  it('rejects when uploadOperation references a non-existent api operation', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        createFileManagerNode({ uploadOperation: 'noExiste' }),
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('uploadOperation')
      expect(result.error.message).toContain('"noExiste" is not declared in api')
    }
  })

  it('rejects when getOperation references a non-existent api operation', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        createFileManagerNode({ getOperation: 'missingOp' }),
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('getOperation')
      expect(result.error.message).toContain('"missingOp" is not declared in api')
    }
  })

  // Rule 4: viewOperation / downloadOperation must be GET
  it('rejects when viewOperation points to a POST operation', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        createFileManagerNode({ viewOperation: 'uploadDocuments' }),
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('viewOperation')
      expect(result.error.message).toContain('must use method "GET" for view/download links')
    }
  })

  it('rejects when downloadOperation points to a POST operation', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        createFileManagerNode({ downloadOperation: 'uploadDocuments' }),
      ),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('downloadOperation')
      expect(result.error.message).toContain('must use method "GET" for view/download links')
    }
  })

  it('accepts when viewOperation points to a GET operation', () => {
    const result = validateRuntimeConfig(
      createConfigWithFileManagerAndApi(
        createFileManagerNode({ viewOperation: 'viewDocument' }),
      ),
    )
    expect(result.status).toBe('ready')
  })

  // Rule 5: validations.validFileNames must contain valid regex strings
  it('rejects when validations.validFileNames contains an invalid regex', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({
          validations: { validFileNames: { value: ['[invalid('] } },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('validFileNames[0]')
      expect(result.error.message).toContain('invalid regex')
    }
  })

  it('accepts validations.validFileNames with a valid regex pattern', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({
          validations: { validFileNames: { value: ['^FACT_\\d{4}\\.pdf$'] } },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  // Rule 6: numeric validation values must be >= 0
  it('rejects when validations.maxFileSize is negative', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { maxFileSize: { value: -1 } } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('validations.maxFileSize')
    }
  })

  it('rejects when validations.maxTotalSize is negative', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { maxTotalSize: { value: -5 } } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('validations.maxTotalSize')
    }
  })

  it('rejects when validations.minFiles is negative', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { minFiles: { value: -1 } } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('validations.minFiles')
    }
  })

  it('rejects when validations.maxFiles is negative', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({ validations: { maxFiles: { value: -3 } } }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('validations.maxFiles')
    }
  })

  // Rule 7: maxFiles >= minFiles
  it('rejects when validations.maxFiles < validations.minFiles', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({
          validations: { maxFiles: { value: 2 }, minFiles: { value: 5 } },
        }),
      ]),
    )
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('validations.maxFiles')
      expect(result.error.message).toContain('maxFiles must be greater than or equal to minFiles')
    }
  })

  it('accepts when validations.maxFiles equals validations.minFiles', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode({
          validations: { maxFiles: { value: 3 }, minFiles: { value: 3 } },
        }),
      ]),
    )
    expect(result.status).toBe('ready')
  })

  // Rule 9 (placement): fileManager inside form.children is rejected
  it('rejects fileManager as a direct child of form.children', () => {
    const result = validateRuntimeConfig({
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                createFileManagerNode({ fieldName: 'docs' }),
              ],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('"fileManager" is not allowed inside a form')
    }
  })

  it('rejects fileManager inside a container that is inside form.children (transitive)', () => {
    const result = validateRuntimeConfig({
      api: {
        submitForm: { method: 'POST', endpoint: '/api/submit' },
      },
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'form',
              id: 'my-form',
              submitAction: { type: 'executeOperation', operationName: 'submitForm' },
              children: [
                {
                  type: 'container',
                  children: [createFileManagerNode({ fieldName: 'docs' })],
                },
              ],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('error')
    if (result.status === 'error') {
      expect(result.error.message).toContain('"fileManager" is not allowed inside a form')
    }
  })

  // fileManager is allowed inside other containers
  it('accepts fileManager inside a container outside form', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        {
          type: 'container',
          children: [createFileManagerNode()],
        },
      ]),
    )
    expect(result.status).toBe('ready')
  })

  it('accepts fileManager inside modal.children', () => {
    const result = validateRuntimeConfig({
      api: {},
      pages: [
        {
          id: 'home',
          layout: [
            {
              type: 'modal',
              id: 'my-modal',
              props: { label: 'My Modal' },
              children: [createFileManagerNode()],
            },
          ],
        },
      ],
      initialPage: 'home',
    })
    expect(result.status).toBe('ready')
  })

  it('accepts the full example from the spec contract with all operations declared', () => {
    const result = validateRuntimeConfig(createConfigWithFileManagerAndApi(createFullFileManagerNode()))
    expect(result.status).toBe('ready')
  })

  // visibility and queryStateFeedback regression
  it('accepts fileManager with visibility and queryStateFeedback declared (T7 regression)', () => {
    const result = validateRuntimeConfig(
      createConfigWithLayout([
        createFileManagerNode(
          {},
          {
            visibility: { reference: 'queries.q.status', operator: 'equals', value: 'success' },
            queryStateFeedback: { query: 'q' },
          },
        ),
      ]),
    )
    expect(result.status).toBe('ready')
  })
})
