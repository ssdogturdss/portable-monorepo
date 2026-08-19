import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import MainIde from '@/pages/main-ide';
import TemplatesPage from '@/pages/templates';
import { IdeProvider } from '@/hooks/use-ide-store';
import { useAuth } from '@workspace/replit-auth-web';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function LoginScreen() {
  const { login } = useAuth();
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">AI IDE</h1>
          <p className="text-muted-foreground mt-1">Sign in to access your workspace</p>
        </div>
        <button
          onClick={login}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Log in
        </button>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={MainIde} />
        <Route path="/templates" component={TemplatesPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <IdeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthGuard>
              <Router />
            </AuthGuard>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </IdeProvider>
    </QueryClientProvider>
  );
}

export default App;
