import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProfessionalDashboard from "./pages/ProfessionalDashboard.tsx";
import ProfessionalLogin from "./pages/ProfessionalLogin.tsx";
import CompanyLanding from "./pages/CompanyLanding.tsx";
import CompanyDashboard from "./pages/CompanyDashboard.tsx";
import PartnerRegistration from "./pages/PartnerRegistration.tsx";
import CompanySignup from "./pages/CompanySignup.tsx";
import Subscribe from "./pages/Subscribe.tsx";
import MySubscription from "./pages/MySubscription.tsx";
import AffiliatePortal from "./pages/AffiliatePortal.tsx";
import PublicLeaderboard from "./pages/PublicLeaderboard.tsx";
import { AccessGate } from "./components/AccessGate";
import { lazy, Suspense } from "react";

const HealthReport = lazy(() => import("./components/report/HealthReport"));
const ProfessionalReport = lazy(() => import("./components/report/ProfessionalReport"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <Routes>
              <Route path="/empresa/:slug" element={<CompanyLanding />} />
              <Route path="/cadastro-parceiro" element={<PartnerRegistration />} />
              <Route path="/cadastro/:token" element={<CompanySignup />} />
              <Route path="/painel-publico/:token" element={<PublicLeaderboard />} />
              <Route path="/assinar/:slug" element={<Subscribe />} />
              {/* Backward compat */}
              <Route path="/cidade/:slug" element={<CompanyLanding />} />
              <Route path="/painel/:slug" element={<CompanyDashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/relatorio"
                element={
                  <ProtectedRoute>
                    <AccessGate>
                      <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>Carregando...</div>}>
                        <HealthReport />
                      </Suspense>
                    </AccessGate>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorio/medico/:token"
                element={
                  <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>Carregando...</div>}>
                    <ProfessionalReport />
                  </Suspense>
                }
              />
              <Route
                path="/perfil/assinatura"
                element={
                  <ProtectedRoute>
                    <MySubscription />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/afiliado"
                element={
                  <ProtectedRoute>
                    <AffiliatePortal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AccessGate>
                      <Index />
                    </AccessGate>
                  </ProtectedRoute>
                }
              />
              {/* Admin routes */}
              <Route path="/admin" element={<AdminLogin />} />
              <Route
                path="/admin/painel"
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route path="/login-profissional" element={<ProfessionalLogin />} />
              <Route
                path="/painel-profissional"
                element={
                  <ProtectedRoute>
                    <ProfessionalDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
