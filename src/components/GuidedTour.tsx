import { useState, useEffect } from "react";
import { X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "littleimp_guided_tour_dismissed";

const STEPS = [
  {
    title: "Save a bookmark",
    description:
      'Paste any URL in the search bar above or use the add button to save your first bookmark. You can also use the bookmarklet from your browser.',
  },
  {
    title: "Search everything",
    description:
      "Try searching for a topic. Keyword search works immediately. AI-powered semantic search activates when you configure a provider in Settings.",
  },
  {
    title: "Stay organized",
    description:
      "Categories, tags, and AI suggestions help you find things later. Check your Review Queue for auto-generated suggestions.",
  },
];

export function GuidedTour() {
  const [stepIndex, setStepIndex] = useState(0);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setDismissed(false);
      }
    } catch {
      // localStorage unavailable — never show tour
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // non-critical
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-background border rounded-lg shadow-xl max-w-sm w-full mx-4 p-5 space-y-4">
        {/* Step indicator */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i === stepIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            aria-label="Close tour"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step content */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{step.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>
          <Button
            size="sm"
            onClick={() => {
              if (isLastStep) {
                dismiss();
              } else {
                setStepIndex((i) => i + 1);
              }
            }}
          >
            {isLastStep ? "Got it" : "Next"}
            {!isLastStep && <ChevronRight className="h-3.5 w-3.5 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
