import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Layout } from "@/components/layout";
import TelegramLogin from "./pages/telegram-login";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Companies from "@/pages/companies";
import People from "@/pages/people";
import { TestSuggestions } from "@/components/test-suggestions";
import { TestMessage } from "@/components/test-message";
import ImportData from "@/pages/ImportData";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route>
        <Layout>
          <Switch>
            <ProtectedRoute path="/" component={Dashboard} />
            <ProtectedRoute path="/people" component={People} />
            <ProtectedRoute path="/companies" component={Companies} />
            <ProtectedRoute path="/telegram-login" component={TelegramLogin} />
            <ProtectedRoute path="/test-suggestions" component={TestSuggestions} />
            <ProtectedRoute path="/test-message" component={TestMessage} />
            <ProtectedRoute path="/import-data" component={ImportData} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;