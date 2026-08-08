import Sidebar from '../Sidebar/Sidebar'
import Footer from '../Footer/Footer'

export default function Layout({ children, activePage, onNavigate }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-x-hidden p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
