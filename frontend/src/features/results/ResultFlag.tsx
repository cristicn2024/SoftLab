import type { Flag } from './interpretation'

export function ResultFlag({ value }: { value: Flag }) {
  return <span className={`flag flag-${value.toLowerCase()}`}>{value}</span>
}
