import type { CSSProperties, ReactNode } from 'react'
import type { LayoutNode, LayoutNodeCollection } from '../config/runtime-config'

const gapMap: Record<string, string> = {
  sm: '0.75rem',
  md: '1.25rem',
  lg: '2rem',
}

export interface LayoutRendererProps {
  nodes: LayoutNodeCollection
}

export function LayoutRenderer({ nodes }: LayoutRendererProps) {
  return (
    <>
      {nodes.map((node, index) => (
        <LayoutFragment key={node.id ?? `${node.type}-${index}`} node={node} />
      ))}
    </>
  )
}

function renderLayoutNode(node: LayoutNode): ReactNode {
  switch (node.type) {
    case 'container':
      return (
        <div
          key={node.id}
          data-layout-node="container"
          style={getContainerStyle(node.props?.direction, node.props?.gap)}
        >
          {node.children?.map((child, index) => (
            <LayoutFragment key={child.id ?? `${child.type}-${index}`} node={child} />
          ))}
        </div>
      )
    case 'heading': {
      const HeadingTag = getHeadingTag(node.props.level)

      return (
        <HeadingTag key={node.id} data-layout-node="heading" style={getHeadingStyle(node.props.level)}>
          {node.props.text}
        </HeadingTag>
      )
    }
    case 'paragraph':
      return (
        <p key={node.id} data-layout-node="paragraph" style={paragraphStyle}>
          {node.props.text}
        </p>
      )
    case 'list':
      return (
        <ul key={node.id} data-layout-node="list" style={listStyle}>
          {node.props.items.map((item, index) => (
            <li key={`${item}-${index}`} style={listItemStyle}>
              {item}
            </li>
          ))}
        </ul>
      )
  }
}

interface LayoutFragmentProps {
  node: LayoutNode
}

function LayoutFragment({ node }: LayoutFragmentProps) {
  return <>{renderLayoutNode(node)}</>
}

function getHeadingTag(level: number) {
  if (level <= 1) {
    return 'h1'
  }

  if (level === 2) {
    return 'h2'
  }

  if (level === 3) {
    return 'h3'
  }

  if (level === 4) {
    return 'h4'
  }

  if (level === 5) {
    return 'h5'
  }

  return 'h6'
}

function getContainerStyle(direction?: string, gap?: string): CSSProperties {
  return {
    display: 'flex',
    flexDirection: direction === 'row' ? 'row' : 'column',
    gap: gap ? (gapMap[gap] ?? gap) : '0',
    width: '100%',
  }
}

function getHeadingStyle(level: number): CSSProperties {
  const sizeMap: Record<number, string> = {
    1: '3rem',
    2: '2.25rem',
    3: '1.75rem',
    4: '1.5rem',
    5: '1.25rem',
    6: '1.125rem',
  }

  return {
    margin: 0,
    color: '#f8fafc',
    fontWeight: 600,
    letterSpacing: '-0.03em',
    fontSize: sizeMap[level] ?? sizeMap[6],
    lineHeight: 1.1,
  }
}

const paragraphStyle: CSSProperties = {
  margin: 0,
  color: '#cbd5e1',
  fontSize: '1rem',
  lineHeight: 1.7,
}

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.25rem',
  color: '#e2e8f0',
  display: 'grid',
  gap: '0.5rem',
}

const listItemStyle: CSSProperties = {
  lineHeight: 1.6,
}
