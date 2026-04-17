import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

export function BackButton({ className, fallbackPath = "/dashboard", ...props }) {
  const navigate = useNavigate();

  const handleBack = (e) => {
    e.preventDefault();
    // A heuristic for history. Since modern SPAs use the History API, 
    // a length <= 2 often implies the user opened this link directly in a new tab.
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleBack}
      className={cn(
        "group w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] shadow-sm backdrop-blur-md transition-all duration-300 shrink-0",
        className
      )}
      title="Go Back"
      aria-label="Go Back"
      {...props}
    >
      <ArrowLeft 
        size={18} 
        className="text-slate-400 group-hover:text-slate-100 group-hover:-translate-x-1 transition-all duration-300" 
      />
    </Button>
  );
}
