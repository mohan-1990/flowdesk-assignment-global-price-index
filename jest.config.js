module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "**/Tests/**/*.test.ts", // This will include any test files under the 'Tests' folder
  ],
  reporters: ["default", "jest-summary-reporter"],
};
