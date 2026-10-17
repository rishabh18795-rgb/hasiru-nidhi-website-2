import Link from "next/link";

export default function StayNotFound() {
  return (
    <section className="bg-cream pb-24 pt-40">
      <div className="container-nidhi max-w-xl text-center">
        <h1 className="text-3xl font-medium text-forest-950">This stay isn&apos;t available</h1>
        <p className="mt-3 text-sm text-ink/65">It may have been unpublished, or the link may be wrong.</p>
        <Link href="/stays" className="mt-6 inline-flex h-11 items-center rounded-full bg-forest-800 px-6 text-sm font-medium text-cream hover:bg-forest-700">Explore stays</Link>
      </div>
    </section>
  );
}
