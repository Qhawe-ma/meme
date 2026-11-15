export default function Loading() {
  return (
    <div className="px-3 py-4">
      <div className="skel h-10 w-48" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="skel h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
