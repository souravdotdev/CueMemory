module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow long lines in commit bodies (e.g. pasted output, long explanations).
    "body-max-line-length": [0],
  },
};
