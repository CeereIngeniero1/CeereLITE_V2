import { Outlet } from 'react-router-dom';
import { useCompany } from '../auth/CompanyContext';
import { EmpresaSelectModal } from '../components/EmpresaSelectModal';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const { needsPick, ready } = useCompany();

  return (
    <div className="app-shell">
      {ready && needsPick ? <EmpresaSelectModal /> : null}
      <Sidebar />
      <div className="app-content">
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
