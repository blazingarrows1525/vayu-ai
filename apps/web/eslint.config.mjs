import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** Next 16 removed `next lint`; this is the equivalent flat config (Core Web Vitals + TypeScript). */
const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: [".next/**", "next-env.d.ts", "test-results/**", "playwright-report/**"] },
  {
    // React Compiler readiness rules (eslint-plugin-react-hooks v6). The app doesn't use the
    // compiler, and these flag established patterns (fetch-on-mount, reading the DOM theme once,
    // mutating animation refs in rAF loops). Kept visible as warnings to migrate deliberately.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default config;
