import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from '../../config/runtime-config'
import { createConfigWithFormLayout } from './helpers'

describe('validateRuntimeConfig — tabs inside form', () => {
  it('accepts form.children with a tabs node containing two items each with a distinct input', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'tabs',
              props: {
                items: [
                  {
                    id: 'tab-1',
                    label: 'Personal',
                    children: [
                      {
                        type: 'input',
                        props: { fieldId: 'name', label: 'Name' },
                      },
                    ],
                  },
                  {
                    id: 'tab-2',
                    label: 'Contact',
                    children: [
                      {
                        type: 'input',
                        props: { fieldId: 'email', label: 'Email' },
                      },
                    ],
                  },
                ],
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        }),
      ).status,
    ).toBe('ready')
  })

  it('accepts nested form → container → tabs → container → input', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'container',
              children: [
                {
                  type: 'tabs',
                  props: {
                    items: [
                      {
                        id: 'tab-a',
                        label: 'Tab A',
                        children: [
                          {
                            type: 'container',
                            children: [
                              {
                                type: 'input',
                                props: { fieldId: 'username', label: 'Username' },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        }),
      ).status,
    ).toBe('ready')
  })

  it('accepts nested form → tabs → accordion → input', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'tabs',
              props: {
                items: [
                  {
                    id: 'tab-1',
                    label: 'Details',
                    children: [
                      {
                        type: 'accordion',
                        props: { label: 'Extra info' },
                        children: [
                          {
                            type: 'input',
                            props: { fieldId: 'bio', label: 'Bio' },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        }),
      ).status,
    ).toBe('ready')
  })

  it('accepts nested form → accordion → tabs → input', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'accordion',
              props: { label: 'More fields' },
              children: [
                {
                  type: 'tabs',
                  props: {
                    items: [
                      {
                        id: 'tab-1',
                        label: 'Tab 1',
                        children: [
                          {
                            type: 'input',
                            props: { fieldId: 'phone', label: 'Phone' },
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
            {
              type: 'button',
              props: { label: 'Submit' },
            },
          ],
        }),
      ).status,
    ).toBe('ready')
  })

  it('rejects two inputs with the same fieldId in different items of the same tabs inside form', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'tabs',
              props: {
                items: [
                  {
                    id: 'tab-1',
                    label: 'Tab 1',
                    children: [
                      {
                        type: 'input',
                        props: { fieldId: 'email', label: 'Email' },
                      },
                    ],
                  },
                  {
                    id: 'tab-2',
                    label: 'Tab 2',
                    children: [
                      {
                        type: 'input',
                        props: { fieldId: 'email', label: 'Email duplicate' },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          `Page "home" has an invalid layout at "layout[0].children[0].props.items[1].children[0].props.fieldId": duplicate fieldId "email" in form "user-form".
  → form("user-form") > tabs[0] > input(fieldId: "email")
  Node: {"type":"input","props":{"fieldId":"email","label":"Email duplicate"}}`,
      },
    })
  })

  it('rejects duplicate fieldId when one input is outside tabs and another is inside a tabs item in the same form', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'input',
              props: { fieldId: 'email', label: 'Email' },
            },
            {
              type: 'tabs',
              props: {
                items: [
                  {
                    id: 'tab-1',
                    label: 'More',
                    children: [
                      {
                        type: 'input',
                        props: { fieldId: 'email', label: 'Email again' },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          `Page "home" has an invalid layout at "layout[0].children[1].props.items[0].children[0].props.fieldId": duplicate fieldId "email" in form "user-form".
  → form("user-form") > tabs[1] > input(fieldId: "email")
  Node: {"type":"input","props":{"fieldId":"email","label":"Email again"}}`,
      },
    })
  })

  it('rejects fileManager inside a tabs item inside a form', () => {
    expect(
      validateRuntimeConfig(
        createConfigWithFormLayout({
          children: [
            {
              type: 'tabs',
              props: {
                items: [
                  {
                    id: 'tab-1',
                    label: 'Files',
                    children: [
                      {
                        type: 'fileManager',
                        props: {},
                      },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      ),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          `Page "home" has an invalid layout at "layout[0].children[0].props.items[0].children[0]": "fileManager" is not allowed inside a form.
  → form("user-form") > tabs[0] > fileManager[0]
  Node: {"type":"fileManager"}`,
      },
    })
  })

  it('rejects form with tabs when submitAction references a GET operation with body', () => {
    expect(
      validateRuntimeConfig({
        api: {
          searchUsers: { method: 'GET', endpoint: '/api/users' },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'search-form',
                submitAction: {
                  type: 'executeOperation',
                  operationName: 'searchUsers',
                  body: { q: 'Ada' },
                },
                children: [
                  {
                    type: 'tabs',
                    props: {
                      items: [
                        {
                          id: 'tab-1',
                          label: 'Tab 1',
                          children: [
                            {
                              type: 'input',
                              props: { fieldId: 'query', label: 'Query' },
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
        initialPage: 'home',
      }),
    ).toMatchObject({
      status: 'error',
      error: {
        code: 'invalid-layout',
        message: expect.stringContaining('submitAction.body'),
      },
    })
  })

  it('rejects a button with executeOperation GET + body inside a tabs item inside a form', () => {
    expect(
      validateRuntimeConfig({
        api: {
          searchUsers: { method: 'GET', endpoint: '/api/users' },
          submitUserForm: { method: 'POST', endpoint: '/api/forms' },
        },
        pages: [
          {
            id: 'home',
            layout: [
              {
                type: 'form',
                id: 'user-form',
                submitAction: {
                  type: 'executeOperation',
                  operationName: 'submitUserForm',
                },
                children: [
                  {
                    type: 'tabs',
                    props: {
                      items: [
                        {
                          id: 'tab-1',
                          label: 'Tab 1',
                          children: [
                            {
                              type: 'button',
                              props: {
                                label: 'Search',
                                action: {
                                  type: 'executeOperation',
                                  operationName: 'searchUsers',
                                  body: { q: 'Ada' },
                                },
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
        initialPage: 'home',
      }),
    ).toEqual({
      status: 'error',
      error: {
        code: 'invalid-layout',
        displayMode: 'development-only',
        message:
          `Page "home" has an invalid layout at "layout[0].children[0].props.items[0].children[0].props.action.body": GET operations do not support body.
  → form("user-form") > tabs[0] > button("Search")
  Node: {"type":"button","props":{"label":"Search"}}`,
      },
    })
  })
})
