// Options for Jest

module.exports = {
    collectCoverage: true,
    testEnvironment: "jsdom",
    moduleFileExtensions: ["ts", "js", "json"],
    transform: {
        "\\.(ts)$": "ts-jest"
    },
    testRegex: "/tests/.*\\.(test.ts)$",
    moduleNameMapper: {
        "Vector": "<rootDir>/app/utils/math/Vector.ts",
        "math/(.*)$": "<rootDir>/app/utils/math/$1.ts",
        "app/(.*)$": "<rootDir>/app/$1.ts",
    }
};
