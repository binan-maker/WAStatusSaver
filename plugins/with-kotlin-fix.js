const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withKotlinFix(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let content = config.modResults.contents;

      const resolutionStrategyHook = `
allprojects {
    configurations.all {
        resolutionStrategy.eachDependency { DependencyResolveDetails details ->
            if (details.requested.group == 'org.jetbrains.kotlin') {
                details.useVersion '2.2.0'
            }
        }
    }
}
`;
      // Append the fallback forced version configuration to the base layout
      config.modResults.contents = content + resolutionStrategyHook;
    }
    return config;
  });
};
