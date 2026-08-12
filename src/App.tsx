import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Domains from "./pages/Domains";
import Timeline from "./pages/Timeline";
import ReviewQueue from "./pages/ReviewQueue";
import Archive from "./pages/Archive";
import Trash from "./pages/Trash";
import Settings from "./pages/Settings";
import CategoryDetail from "./pages/CategoryDetail";
import Tags from "./pages/Tags";
import TagDetail from "./pages/TagDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/domains" element={<Domains />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/review-queue" element={<ReviewQueue />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/trash" element={<Trash />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/categories/:id" element={<CategoryDetail />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/tags/:tag" element={<TagDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
