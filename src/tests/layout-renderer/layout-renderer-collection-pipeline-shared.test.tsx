import { fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'
import { useRuntimeStateActions } from '../../runtime/runtime-state/use-runtime-state'

function QuerySeedControls({
  seeds,
  pendingQueries = [],
}: {
  seeds: Record<string, unknown>
  pendingQueries?: string[]
}) {
  const { initializeQuery, setQuerySuccess } = useRuntimeStateActions()

  useEffect(() => {
    for (const [queryName, data] of Object.entries(seeds)) {
      initializeQuery(queryName)
      setQuerySuccess(queryName, data)
    }
    for (const queryName of pendingQueries) {
      initializeQuery(queryName)
    }
    // Seed once on mount; the object/array identities are stable for the lifetime of a single test render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function renderRuntimePageWithSeeds(
  activePage: RuntimePageConfig,
  seeds: Record<string, unknown> = {},
  pendingQueries: string[] = [],
) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <QuerySeedControls seeds={seeds} pendingQueries={pendingQueries} />
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('RuntimePage collection pipeline source (list/select/radioGroup/checkboxGroup)', () => {
  it('regression: a list source without a pipeline renders the same items as before the feature', () => {
    renderRuntimePageWithSeeds(
      {
        id: 'list-no-pipeline',
        layout: [
          {
            type: 'list',
            props: {
              items: {
                source: 'queries.items.data',
                itemType: 'scalar',
              },
            },
          },
        ],
      },
      { items: ['Reusable layout nodes', 'Static content'] },
    )

    expect(within(screen.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Reusable layout nodes',
      'Static content',
    ])
  })

  it('renders a list object shape (itemText) filtered and ordered by a pipeline', () => {
    renderRuntimePageWithSeeds(
      {
        id: 'list-object-pipeline',
        layout: [
          {
            type: 'list',
            props: {
              items: {
                source: 'queries.orders.data | filter:status,eq,"pending" | orderby:total,desc',
                itemText: 'id',
              },
            },
          },
        ],
      },
      {
        orders: [
          { id: 'o1', status: 'pending', total: 50 },
          { id: 'o2', status: 'shipped', total: 80 },
          { id: 'o3', status: 'pending', total: 120 },
          { id: 'o4', status: 'pending', total: 30 },
        ],
      },
    )

    expect(within(screen.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'o3',
      'o1',
      'o4',
    ])
  })

  it('renders a list scalar shape sliced by a pipeline', () => {
    renderRuntimePageWithSeeds(
      {
        id: 'list-scalar-pipeline',
        layout: [
          {
            type: 'list',
            props: {
              items: {
                source: 'queries.tags.data | slice:0,3',
                itemType: 'scalar',
              },
            },
          },
        ],
      },
      { tags: ['red', 'green', 'blue', 'yellow', 'purple'] },
    )

    expect(within(screen.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'red',
      'green',
      'blue',
    ])
  })

  it('renders a dynamic select filtered by a literal "in" list pipeline', () => {
    renderRuntimePageWithSeeds(
      {
        id: 'select-in-pipeline',
        layout: [
          {
            type: 'form',
            id: 'roles-form',
            children: [
              {
                type: 'select',
                props: {
                  fieldId: 'userName',
                  label: 'User',
                  items: {
                    source: 'queries.usersRoles.data | filter:role,in,["admin","editor"]',
                    itemType: 'object',
                    label: 'name',
                    value: 'name',
                  },
                },
              },
            ],
          },
        ],
      },
      {
        usersRoles: [
          { role: 'admin', name: 'Ada' },
          { role: 'editor', name: 'Grace' },
          { role: 'viewer', name: 'Zoe' },
        ],
      },
    )

    expect(
      within(screen.getByRole('combobox', { name: 'User' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['', 'Ada', 'Grace'])
  })

  it('renders a dynamic radioGroup ordered alphabetically by a pipeline', () => {
    renderRuntimePageWithSeeds(
      {
        id: 'radio-orderby-pipeline',
        layout: [
          {
            type: 'form',
            id: 'categories-form',
            children: [
              {
                type: 'radioGroup',
                props: {
                  fieldId: 'category',
                  label: 'Category',
                  items: {
                    source: 'queries.categories.data | orderby:name,asc',
                    itemType: 'object',
                    label: 'name',
                    value: 'name',
                  },
                },
              },
            ],
          },
        ],
      },
      { categories: [{ name: 'Zebra' }, { name: 'Apple' }, { name: 'Mango' }] },
    )

    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'Apple',
      'Mango',
      'Zebra',
    ])
  })

  it('renders a dynamic checkboxGroup filtered by an equality pipeline', () => {
    renderRuntimePageWithSeeds(
      {
        id: 'checkbox-filter-pipeline',
        layout: [
          {
            type: 'form',
            id: 'tags-form',
            children: [
              {
                type: 'checkboxGroup',
                props: {
                  fieldId: 'featuredTags',
                  label: 'Featured tags',
                  items: {
                    source: 'queries.tagsCatalog.data | filter:featured,eq,"true"',
                    itemType: 'object',
                    label: 'name',
                    value: 'name',
                  },
                },
              },
            ],
          },
        ],
      },
      {
        tagsCatalog: [
          { name: 'Featured A', featured: 'true' },
          { name: 'Not featured', featured: 'false' },
          { name: 'Featured B', featured: 'true' },
        ],
      },
    )

    expect(screen.getAllByRole('checkbox').map((checkbox) => checkbox.parentElement?.textContent)).toEqual([
      'Featured A',
      'Featured B',
    ])
  })

  it('reacts to a dynamic filter argument changing without any explicit action', () => {
    const page: RuntimePageConfig = {
      id: 'select-reactive-filter-arg',
      layout: [
        {
          type: 'form',
          id: 'filterForm',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'role',
                label: 'Role filter',
                defaultValue: 'admin',
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'userId',
                label: 'User',
                items: {
                  source: 'queries.usersReactive.data | filter:role,eq,forms.filterForm.role',
                  itemType: 'object',
                  label: 'name',
                  value: 'name',
                },
              },
            },
          ],
        },
      ],
    }

    renderRuntimePageWithSeeds(page, {
      usersReactive: [
        { role: 'admin', name: 'Ada' },
        { role: 'editor', name: 'Grace' },
        { role: 'admin', name: 'Zoe' },
      ],
    })

    const select = screen.getByRole('combobox', { name: 'User' })
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['', 'Ada', 'Zoe'])

    fireEvent.change(screen.getByLabelText('Role filter'), { target: { value: 'editor' } })

    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['', 'Grace'])
  })

  it('does not apply the filter stage and shows every item when the dynamic argument is absent (empty string)', () => {
    const page: RuntimePageConfig = {
      id: 'select-empty-filter-arg',
      layout: [
        {
          type: 'form',
          id: 'filterForm',
          children: [
            {
              type: 'input',
              props: {
                fieldId: 'role',
                label: 'Role filter',
                defaultValue: '',
              },
            },
            {
              type: 'select',
              props: {
                fieldId: 'userId',
                label: 'User',
                items: {
                  source: 'queries.usersReactive.data | filter:role,eq,forms.filterForm.role',
                  itemType: 'object',
                  label: 'name',
                  value: 'name',
                },
              },
            },
          ],
        },
      ],
    }

    renderRuntimePageWithSeeds(page, {
      usersReactive: [
        { role: 'admin', name: 'Ada' },
        { role: 'editor', name: 'Grace' },
        { role: 'admin', name: 'Zoe' },
      ],
    })

    expect(
      within(screen.getByRole('combobox', { name: 'User' })).getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['', 'Ada', 'Grace', 'Zoe'])
  })

  it('degrades a pipeline source to an empty collection when the base reference is not yet an array', () => {
    renderRuntimePageWithSeeds(
      {
        id: 'list-pending-base-reference',
        layout: [
          {
            type: 'list',
            props: {
              items: {
                source: 'queries.pendingOrders.data | slice:0,2',
                itemType: 'scalar',
              },
            },
          },
        ],
      },
      {},
      ['pendingOrders'],
    )

    expect(within(screen.getByRole('list')).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('degrades to an empty collection without throwing when a malformed pipeline source reaches runtime', () => {
    renderRuntimePageWithSeeds(
      {
        id: 'list-malformed-pipeline',
        layout: [
          {
            type: 'list',
            props: {
              items: {
                source: 'queries.tags.data | filter:bad',
                itemType: 'scalar',
              },
            },
          },
        ],
      },
      { tags: ['red', 'green', 'blue'] },
    )

    expect(within(screen.getByRole('list')).queryAllByRole('listitem')).toHaveLength(0)
  })
})
