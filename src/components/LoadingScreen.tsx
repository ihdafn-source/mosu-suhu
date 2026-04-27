import { motion } from "framer-motion";
import logo from "@/assets/logo.png";


interface LoadingScreenProps {
  onFinish: () => void;
}

const LoadingScreen = ({ onFinish }: LoadingScreenProps) => {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {/* Blue background */}
      <div
        className="absolute inset-0 bg-primary"
      />

      {/* Logo */}
      <motion.div
        className="flex items-center justify-center mb-10 relative z-10"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <img src={logo} alt="Logo" className="w-40 h-40 md:w-64 md:h-64" />
      </motion.div>

      {/* Pulse ring loader */}
      <div className="relative w-16 h-16 flex items-center justify-center z-10">
        <span className="absolute w-full h-full rounded-full border-2 border-secondary animate-pulse-ring" />
        <span className="absolute w-full h-full rounded-full border-2 border-secondary animate-pulse-ring [animation-delay:0.5s]" />
        <span className="w-4 h-4 rounded-full bg-secondary" />
      </div>

      {/* Progress bar */}
      <motion.div
        className="mt-8 w-48 h-1.5 rounded-full bg-foreground/20 overflow-hidden relative z-10"
      >
        <motion.div
          className="h-full rounded-full bg-secondary"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          onAnimationComplete={onFinish}
        />
      </motion.div>
    </motion.div>
  );
};

export default LoadingScreen;
