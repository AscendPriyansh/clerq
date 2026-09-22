module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1", "^server-only$": "<rootDir>/tests/server-only.ts" },
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { module: "commonjs", moduleResolution: "node", jsx: "react-jsx", esModuleInterop: true }, diagnostics: true }] },
};
