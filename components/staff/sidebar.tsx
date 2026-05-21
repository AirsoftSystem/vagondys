import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-white/10 bg-black px-6 py-8">
      <nav className="space-y-4 text-sm">
        <Link href="/staff" className="block hover:text-white">
          Dashboard
        </Link>
        <Link href="/staff/messages" className="block hover:text-white">
          Messages
        </Link>
        <Link href="/staff/users" className="block hover:text-white">
          Staff
        </Link>
      </nav>
    </aside>
  )
}
