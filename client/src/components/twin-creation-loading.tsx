import { motion } from "framer-motion";

export function TwinCreationLoading() {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center space-y-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-32 h-32"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              className="absolute w-32 h-32 rounded-full border-4 border-primary"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div 
              className="absolute w-32 h-32 rounded-full border-4 border-primary/50"
              animate={{ 
                scale: [1, 1.5],
                opacity: [1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center space-y-4"
        >
          <h2 className="text-2xl font-semibold text-foreground">Creating Your Digital Twin</h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground"
          >
            Analyzing your profile and generating personality...
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}