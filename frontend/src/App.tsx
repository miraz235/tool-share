import '@/App.css';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import { CurrencyProvider } from '@/lib/currency';
import { AppRouter } from '@/router';

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
            <AppRouter />
            <Toaster position="top-right" richColors />
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
