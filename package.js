Package.describe({
  name: 'murb:geoboundspicker',
  version: '0.1',
  summary: 'Geo bounds picker component',
  git: 'https://github.com/murb/geoboundspicker',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.0.1');

  api.use('jquery@1.11.3_2', ["client"]);

  api.addFiles('geoboundspicker.js', ["client"]);
  api.addFiles('geoboundspicker.css', ["client"]);
});
