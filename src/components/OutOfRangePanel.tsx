import { EmptyPanel } from './Feedback'

export function OutOfRangePanel({
  page,
  totalPages,
  itemName,
  firstHref,
  lastHref,
}: {
  page: number
  totalPages: number
  itemName: string
  firstHref: string
  lastHref: string
}) {
  return (
    <EmptyPanel title={`No ${itemName} on this page`}>
      <p>
        {page > totalPages
          ? `Page ${page} is outside the available range (1–${totalPages}).`
          : `Page ${page} returned no ${itemName}.`}
      </p>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <a href={firstHref} className="font-medium text-teal hover:underline">
          First page
        </a>
        <a href={lastHref} className="font-medium text-teal hover:underline">
          Last page ({totalPages})
        </a>
      </p>
    </EmptyPanel>
  )
}
