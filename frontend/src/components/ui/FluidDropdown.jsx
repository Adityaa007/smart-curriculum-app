import * as React from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { ChevronDown, Layers } from "lucide-react";

// Utility function for className merging
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Custom hook for click outside detection
function useClickAway(ref, handler) {
  React.useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

const Button = React.forwardRef(({ className, variant, children, disabled, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex w-full items-center justify-between rounded-xl text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "outline" && "border border-white/[0.08] bg-white/[0.03] shadow-inner backdrop-blur-sm",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
Button.displayName = "Button";

// Icon wrapper with animation
const IconWrapper = ({ icon: Icon, isHovered, color }) => (
  <motion.div 
    className="w-4 h-4 mr-2 relative shrink-0" 
    initial={false} 
    animate={isHovered ? { scale: 1.2 } : { scale: 1 }}
  >
    {Icon ? <Icon className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
    {isHovered && (
      <motion.div
        className="absolute inset-0"
        style={{ color: color || "#c084fc" }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      >
        {Icon ? <Icon className="w-4 h-4" strokeWidth={2} /> : <Layers className="w-4 h-4" strokeWidth={2} />}
      </motion.div>
    )}
  </motion.div>
);

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function FluidDropdown({
  options = [],
  value,
  onChange,
  placeholder = "Select option",
  disabled = false,
  className
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredCategory, setHoveredCategory] = React.useState(null);
  const dropdownRef = React.useRef(null);

  useClickAway(dropdownRef, () => setIsOpen(false));

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const selectedItem = options.find((opt) => opt.id === value) || null;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("w-full relative", className)} ref={dropdownRef}>
        <Button
          variant="outline"
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full justify-between text-slate-200",
            !disabled && "hover:bg-white/[0.05]",
            "transition-all duration-200 ease-in-out",
            "px-4 py-3",
            isOpen && "bg-white/[0.05] ring-1 ring-white/10"
          )}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span className="flex items-center min-w-0 pr-4">
            {selectedItem ? (
              <>
                <IconWrapper 
                  icon={selectedItem.icon || Layers} 
                  isHovered={isOpen} 
                  color={selectedItem.color || "#c084fc"} 
                />
                <span className="text-slate-100 font-semibold truncate">{selectedItem.label}</span>
              </>
            ) : (
              <span className="text-slate-400 truncate">{placeholder}</span>
            )}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center shrink-0 w-5 h-5"
          >
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </motion.div>
        </Button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.2,
                  ease: "easeOut"
                },
              }}
              exit={{
                opacity: 0,
                y: 5,
                transition: {
                  duration: 0.15,
                  ease: "easeIn"
                },
              }}
              className="absolute left-0 right-0 top-full mt-2 z-dropdown"
              onKeyDown={handleKeyDown}
            >
              <div
                className="w-full rounded-2xl border border-white/10 bg-[#0B0F1A] p-1.5 shadow-2xl overflow-hidden"
              >
                <motion.div 
                  className="py-1 relative max-h-[250px] overflow-y-auto custom-scrollbar" 
                  variants={containerVariants} 
                  initial="hidden" 
                  animate="visible"
                >
                  {options.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      No options available
                    </div>
                  ) : (
                    <>
                      {options.map((category) => {
                        const isSelected = value === category.id;
                        return (
                          <motion.button
                            key={category.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              onChange(category.id);
                              setIsOpen(false);
                            }}
                            onHoverStart={() => setHoveredCategory(category.id)}
                            onHoverEnd={() => setHoveredCategory(null)}
                            className={cn(
                              "relative flex w-full items-center px-4 py-3 text-sm rounded-xl mb-1 last:mb-0",
                              "transition-all duration-150 text-left",
                              "focus:outline-none",
                              isSelected 
                                ? "bg-white/[0.08] text-white" 
                                : "hover:bg-white/5 text-slate-300 hover:text-white"
                            )}
                            whileTap={{ scale: 0.98 }}
                            variants={itemVariants}
                          >
                            <IconWrapper
                              icon={category.icon || Layers}
                              isHovered={hoveredCategory === category.id || isSelected}
                              color={category.color || "#c084fc"}
                            />
                            <span className={cn("truncate flex-1 font-medium", isSelected && "font-bold")}>
                              {category.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
