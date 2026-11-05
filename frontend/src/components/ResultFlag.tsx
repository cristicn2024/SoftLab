import type { Flag } from '../features/results/interpretation'

export function ResultFlag({ value }: { value: Flag }) {
  return <span className={`flag flag-${value.toLowerCase()}`}>{value}</span>
}
