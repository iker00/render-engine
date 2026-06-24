import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RuntimeConfig, RuntimePageConfig } from '../../config/runtime-config'
import { RuntimePage } from '../../runtime/runtime-page'
import { RuntimeStateProvider } from '../../runtime/runtime-state/runtime-state-provider'

function renderRuntimePage(activePage: RuntimePageConfig) {
  const config: RuntimeConfig = {
    api: {},
    initialPage: activePage.id,
    pages: [activePage],
  }

  return render(
    <RuntimeStateProvider config={config}>
      <RuntimePage />
    </RuntimeStateProvider>,
  )
}

describe('ButtonNode style variants', () => {
  it('renders a danger solid button with semantic bg-danger-600', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Delete',
            color: 'danger',
            variant: 'solid',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button.className).toContain('bg-danger-600')
    expect(button.className).not.toMatch(/red-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a primary outline button with semantic border-primary-500 and text-primary-600', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Edit',
            color: 'primary',
            variant: 'outline',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Edit' })
    expect(button.className).toContain('border-primary-500')
    expect(button.className).toContain('text-primary-600')
    expect(button.className).not.toMatch(/blue-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a success ghost button with semantic text-success-600', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Confirm',
            color: 'success',
            variant: 'ghost',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Confirm' })
    expect(button.className).toContain('text-success-600')
    expect(button.className).not.toMatch(/green-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders an info link button with semantic text-info-600 and hover:underline', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'More info',
            color: 'info',
            variant: 'link',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'More info' })
    expect(button.className).toContain('text-info-600')
    expect(button.className).toContain('hover:underline')
    expect(button.className).not.toMatch(/cyan-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a button without color or variant with default primary solid (bg-primary-600)', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Default',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Default' })
    expect(button.className).toContain('bg-primary-600')
    expect(button.className).not.toMatch(/blue-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a button with fullWidth: true with w-full class', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Wide',
            fullWidth: true,
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Wide' })
    expect(button.className).toContain('w-full')
    expect(button.className).not.toContain('self-start')
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a button without fullWidth (default false) with self-start class', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Narrow',
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Narrow' })
    expect(button.className).toContain('self-start')
    expect(button.className).not.toContain('w-full')
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders an implicit submit button inside a form with danger outline (border-red-500) and type=submit', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'form',
          id: 'myForm',
          children: [
            {
              type: 'input',
              props: { fieldId: 'name', label: 'Name' },
            },
            {
              type: 'button',
              props: {
                label: 'Submit form',
                color: 'danger',
                variant: 'outline',
              },
            },
          ],
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Submit form' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button.className).toContain('border-danger-500')
    expect(button.className).not.toMatch(/red-/)
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders an implicit submit button inside a form with fullWidth and type=submit', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'form',
          id: 'myForm',
          children: [
            {
              type: 'input',
              props: { fieldId: 'name', label: 'Name' },
            },
            {
              type: 'button',
              props: {
                label: 'Submit form',
                fullWidth: true,
              },
            },
          ],
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Submit form' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button.className).toContain('w-full')
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })

  it('renders a non-submit button with fullWidth: false and type=button', () => {
    renderRuntimePage({
      id: 'page',
      layout: [
        {
          type: 'button',
          props: {
            label: 'Action',
            fullWidth: false,
            action: { type: 'goBack' },
          },
        },
      ],
    })

    const button = screen.getByRole('button', { name: 'Action' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button.className).toContain('self-start')
    expect(button).toHaveAttribute('data-layout-node', 'button')
  })
})
