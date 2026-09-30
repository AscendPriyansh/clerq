import Link from "next/link";
export default function NotFound() {
  return <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-24"><section className="page-status"><p className="workspace-eyebrow">PAGE NOT FOUND</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">This page isn’t available</h1><p>Check the address or return to your workspace.</p><div className="mt-6 flex flex-wrap gap-3"><Link className="workspace-primary-action" href="/dashboard">Open workspace</Link><Link className="workspace-inline-link" href="/">Back to Clerq</Link></div></section></main>;
}
