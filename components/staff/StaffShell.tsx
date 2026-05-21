// Avant : layout avec sidebar
// Après : layout plein écran
type StaffShellProps = {
  children: React.ReactNode
}

export default function StaffShell({ children }: StaffShellProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Suppression de <Sidebar /> */}
      <main className="w-full p-8">
        {children}
      </main>
    </div>
  )
}
