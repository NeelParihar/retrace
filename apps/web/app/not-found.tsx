import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16">
      <p className="num text-muted">404</p>
      <h1 className="mt-1 text-[18px] font-medium">Nothing here.</h1>
      <p className="mt-1 text-muted">That trace doesn't exist, or the link is malformed.</p>
      <Link href="/" className="btn mt-4">
        Back to traces
      </Link>
    </div>
  );
}
