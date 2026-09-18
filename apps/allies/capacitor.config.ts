import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.allies.app",
  appName: "Allies",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;