interface ViewerCountProps {
  count: number;
}

export function ViewerCount({ count }: ViewerCountProps) {
  return (
    <div className="viewer-count">
      {count.toLocaleString('tr-TR')} izliyor
    </div>
  );
}
